"""校準「戒」每段在音檔裡的起點。

大慈恩逐字稿的段落時間（data-time）只是大約：實測同一卷裡會比音檔晚 18～58 秒不等，
而且原本每段開頭還要再減掉「念原文」的估計時間。這裡改成用聲音本身對位：

1. 每一卷音檔整個解碼一次（16kHz 單聲道），可以精確切片。
2. 每個段落分界，取逐字稿時間前 75 秒到後 15 秒，用 faster-whisper（small，CPU）辨識，附逐字時間。
3. 用拼音（容許捲舌、前後鼻音不分、錯幾個字）比對：
   - 上一段講解的最後 10 個字 → 在它講完之後的下一句切（最準）；
   - 找不到，就用這一段講解的開頭 10 個字；
   - 再找不到，就找這段廣論原文有沒有念出來（前面有「下面…念一遍」之類的引導語就從引導語開始）。
4. 結果存 tools/start_fix.json：{段落識別碼: 起點秒}；build_lamrim.py 會套用（同卷上一段的結束點跟著改）。
   每卷的辨識結果暫存在 tools/cache/starts/，中斷後重跑會跳過做過的卷。

用法：python tools/calib_starts.py [--vols 17,108] [--workers 4] [--threads 3]
"""
import argparse, json, os, re, subprocess, sys
from multiprocessing import Pool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", "cache", "starts")
BEFORE, AFTER = 75, 15
LEAD = re.compile(r"下面|念一[遍下]|唸一[遍下]|我們看|翻到|翻過|第.{1,4}頁|原文|文字|論上|書上|看這|看下")
PROMPT = "以下是日常老和尚講解菩提道次第廣論。"
_model = None


def han(t):
    return [c for c in t if "一" <= c <= "鿿"]


def py(chars):
    from pypinyin import lazy_pinyin
    return lazy_pinyin(chars)


def norm(p):
    # 台灣口音、辨識誤差：捲舌不分、前後鼻音不分
    p = p.replace("zh", "z").replace("ch", "c").replace("sh", "s")
    return re.sub(r"ng$", "n", p)


def P(chars):
    return [norm(p) for p in py("".join(chars))]


def find(tp, ap, last=False):
    """在辨識結果的拼音 ap 裡找 tp（容許錯幾個字、多或少一個字）。回傳 (分數 0~1, 起點)。"""
    n = len(tp)
    best, bi = 0, -1
    for i in range(len(ap)):
        sc = sum(1 for k in range(n) if i + k < len(ap) and ap[i + k] == tp[k])
        sc2 = sum(1 for k in range(n) if i + k + 1 < len(ap) and ap[i + k + 1] == tp[k]) - 0.5
        sc3 = sum(1 for k in range(1, n) if 0 <= i + k - 1 < len(ap) and ap[i + k - 1] == tp[k]) - 0.5
        sc = max(sc, sc2, sc3)
        if sc > best or (last and sc == best and sc > 0):
            best, bi = sc, i
    return best / max(1, n), bi


def init(threads):
    global _model
    from faster_whisper import WhisperModel
    _model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=threads)


def asr(x, a, b):
    import numpy as np
    seg = x[int(a * 16000):int(b * 16000)]
    segs, _ = _model.transcribe(seg, language="zh", beam_size=1, word_timestamps=True,
                                condition_on_previous_text=False, initial_prompt=PROMPT)
    chars, segl = [], []
    for s in segs:
        segl.append([round(a + s.start, 2), round(a + s.end, 2), s.text])
        for w in (s.words or []):
            cs = han(w.word)
            for k, c in enumerate(cs):
                t1 = w.start + (w.end - w.start) * k / max(1, len(cs))
                t2 = w.start + (w.end - w.start) * (k + 1) / max(1, len(cs))
                chars.append((c, a + t1, a + t2, len(segl) - 1))
    return chars, segl


def locate(b, x, dur, a=None, z=None):
    """b: 一個段落分界。回傳 (新起點或 None, 方法, 分數們)。"""
    te = b["te"]
    a = max(0.0, te - BEFORE) if a is None else a
    z = min(dur, te + AFTER) if z is None else z
    chars, segl = asr(x, a, z)
    if not chars:
        return None, "", {}, segl
    ap = P([c[0] for c in chars])
    sp, pi = find(P(b["prev"]), ap, last=True) if len(b["prev"]) >= 5 else (0, -1)
    sn, ni = find(P(b["next"]), ap) if len(b["next"]) >= 5 else (0, -1)
    sq, qi = find(P(b["q"]), ap) if len(b["q"]) >= 5 else (0, -1)
    sc = {"sp": round(sp, 2), "sn": round(sn, 2), "sq": round(sq, 2)}
    t_next = chars[ni][1] if sn >= 0.8 else None
    if sp >= 0.7:
        k = min(len(chars) - 1, pi + len(b["prev"]) - 1)
        end_prev = chars[k][2]
        si = chars[k][3]
        nxt = [sg[0] for sg in segl[si + 1:] if sg[0] >= end_prev - 0.3]
        cand = nxt[0] if nxt else end_prev
        if t_next is None or cand <= t_next + 0.5:
            return cand, "prev", sc, segl
    if sq >= 0.7 and (t_next is None or chars[qi][1] <= t_next):
        cand = chars[qi][1]
        si = chars[qi][3]
        if segl[si][0] >= cand - 1.5:
            cand = min(cand, segl[si][0])
        j = si - 1
        while j >= 0 and segl[j][0] >= cand - 12 and LEAD.search(segl[j][2]):
            cand = segl[j][0]
            j -= 1
        return cand, "q", sc, segl
    if t_next is not None:
        si = chars[ni][3]
        cand = segl[si][0] if segl[si][0] >= t_next - 1.5 else t_next
        return cand, "next", sc, segl
    return None, "", sc, segl


def work(job):
    v, src, bounds = job
    out = os.path.join(CACHE, "v%03d.json" % v)
    if os.path.exists(out):
        return json.load(open(out, encoding="utf8"))
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    dur = len(x) / 16000
    res = []
    for b in bounds:
        if dur < 10:
            res.append({"id": b["id"], "te": b["te"], "est": b["est"], "new": None, "how": "noaudio"})
            continue
        t, how, sc, segl = locate(b, x, dur)
        if t is None and b["te"] - BEFORE > 0:
            # 第二輪：再往前找（逐字稿時間有時晚到 1 分多鐘）
            t, how, sc2, segl = locate(b, x, dur, max(0.0, b["te"] - 160), max(0.0, b["te"] - BEFORE + 10))
            if t is not None:
                how += "2"; sc = sc2
        r = {"id": b["id"], "te": b["te"], "est": b["est"], "new": None if t is None else round(max(0.0, t - 0.3), 1), "how": how}
        r.update(sc)
        res.append(r)
    json.dump(res, open(out, "w", encoding="utf8"), ensure_ascii=False)
    return res


def jobs_of(vols=None):
    from build_lamrim import fetch, paras_of
    s = open(os.path.join(ROOT, "lamrim.js"), encoding="utf8").read()
    L = json.loads(re.search(r"window.LR=(.*?);\n", s, re.S).group(1))
    byv = {}
    for u in L:
        if u[2] <= 1:   # 卷首從 0 秒開始的段，不用校
            continue
        v = u[0]
        if vols and v not in vols:
            continue
        byv.setdefault(v, []).append(u)
    jobs = []
    for v, us in sorted(byv.items()):
        d = fetch(v)
        m = next((m for m in d.get("media", []) if m.get("mediaType") == "audio/mpeg" and m.get("src")), None)
        if not m:
            continue
        ps = paras_of(d)
        bounds = []
        for u in us:
            s0 = u[4]
            if not u[8]:
                while s0 > 0 and ps[s0 - 1][0]:
                    s0 -= 1
            prev = next((ps[k][2] for k in range(s0 - 1, -1, -1) if not ps[k][0] and ps[k][2]), "")
            nh = next((ps[k][2] for k in range(u[4], u[5]) if not ps[k][0] and ps[k][2]), "")
            te = next((ps[k][1] for k in range(u[4], u[5]) if ps[k][1] is not None), u[2])
            bounds.append({"id": "%d.%d" % (u[0], u[4]), "est": u[2], "te": te,
                           "prev": han(prev)[-10:], "next": han(nh)[:10], "q": [] if u[8] else han(u[1])[:10]})
        jobs.append((v, m["src"] + "-48kHz-64kbs", bounds))
    return jobs


def collect():
    fix, stat = {}, {}
    for f in os.listdir(CACHE):
        if not f.startswith("v"):
            continue
        rs = json.load(open(os.path.join(CACHE, f), encoding="utf8"))
        ok = [r for r in rs if r["new"] is not None and -165 <= r["new"] - r["te"] <= 15]
        offs = sorted(r["new"] - r["te"] for r in ok)
        med = offs[len(offs) // 2] if len(offs) >= 2 else None
        for r in rs:
            if r in ok:
                fix[r["id"]] = r["new"]; k = r["how"]
            elif med is not None:
                # 這一卷對到的段落，逐字稿平均晚多少，就照那個量往前移
                fix[r["id"]] = round(max(0.0, r["te"] + med), 1); k = "median"
            else:
                k = "none"
            stat[k] = stat.get(k, 0) + 1
    json.dump(fix, open(os.path.join(ROOT, "tools", "start_fix.json"), "w", encoding="utf8"), indent=0)
    print("start_fix", len(fix), stat, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vols", default="")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--threads", type=int, default=3)
    args = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)
    vols = {int(x) for x in args.vols.split(",") if x} or None
    jobs = jobs_of(vols)
    n = sum(len(j[2]) for j in jobs)
    print("卷 %d、分界 %d" % (len(jobs), n), flush=True)
    done = 0
    with Pool(args.workers, initializer=init, initargs=(args.threads,)) as pool:
        for res in pool.imap_unordered(work, jobs):
            done += len(res)
            ok = sum(1 for r in res if r["new"] is not None)
            print("%d/%d  卷 %s：%d/%d 對到" % (done, n, res[0]["id"].split(".")[0] if res else "?", ok, len(res)), flush=True)
    collect()


if __name__ == "__main__":
    main()
