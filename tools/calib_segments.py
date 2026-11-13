"""校準止觀初探（s）、止觀初探・毗缽舍那（v）每講的分段點。

build_segments.py 原本是依逐字稿字數比例推算時間，再對到附近的停頓，可能差到一兩分鐘。
這裡改用聲音對位：每講整個解碼一次，在每個分段點推算時間前後 90 秒用 faster-whisper 辨識，
用拼音比對「上一段最後 10 個字」（講完之後的下一句切），或「這一段開頭 10 個字」。
結果存 tools/segments_align.json：{講次: {分段的字數位置: 秒數}}，build_segments.py 會優先採用。

用法：python tools/calib_segments.py [--only s1 v3] [--workers 4] [--threads 3]
"""
import argparse, json, os, re, subprocess, sys
from multiprocessing import Pool

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from calib_starts import han, P, find, init  # noqa: E402
import calib_starts  # noqa: E402

OUT = os.path.join(ROOT, "tools", "segments_align.json")
CACHE = os.path.join(ROOT, "tools", "cache", "segalign")
WIN = 90


def body_and_secs(text, dur):
    import build_segments as bs
    secs, total = bs.sections(text, dur)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and not l.startswith("註：") and not bs.HEAD.match(l)]
    return "".join(lines), secs, total or 1


def work(job):
    key, mp3, text, dur = job
    out = os.path.join(CACHE, key + ".json")
    if os.path.exists(out):
        return json.load(open(out, encoding="utf8"))
    import numpy as np
    body, secs, total = body_and_secs(text, dur)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    real = len(x) / 16000
    res = {"key": key, "dur": real, "b": []}
    for title, c in secs[1:]:
        t = c / total * real
        if t < 20 or t > real - 20:
            continue
        prev, nxt = han(body[:c])[-10:], han(body[c:])[:10]
        a, z = max(0.0, t - WIN), min(real, t + WIN)
        chars, segl = calib_starts.asr(x, a, z)
        new, how, sc = None, "", {}
        if chars:
            ap = P([ch[0] for ch in chars])
            sp, pi = find(P(prev), ap, last=True) if len(prev) >= 5 else (0, -1)
            sn, ni = find(P(nxt), ap) if len(nxt) >= 5 else (0, -1)
            sc = {"sp": round(sp, 2), "sn": round(sn, 2)}
            t_next = chars[ni][1] if sn >= 0.8 else None
            if sp >= 0.7:
                k = min(len(chars) - 1, pi + len(prev) - 1)
                end_prev, si = chars[k][2], chars[k][3]
                after = [sg[0] for sg in segl[si + 1:] if sg[0] >= end_prev - 0.3]
                cand = after[0] if after else end_prev
                if t_next is None or cand <= t_next + 0.5:
                    new, how = cand, "prev"
            if new is None and t_next is not None:
                si = chars[ni][3]
                new, how = (segl[si][0] if segl[si][0] >= t_next - 1.5 else t_next), "next"
        r = {"c": c, "title": title, "est": round(t, 1), "new": None if new is None else round(max(0.0, new - 0.3), 1), "how": how}
        r.update(sc)
        res["b"].append(r)
    json.dump(res, open(out, "w", encoding="utf8"), ensure_ascii=False)
    return res


def main():
    import build_segments as bs
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--threads", type=int, default=3)
    a = ap.parse_args()
    os.makedirs(CACHE, exist_ok=True)
    jobs = []
    for it in bs.items():
        if a.only and it["key"] not in a.only:
            continue
        if not it["tx"]:
            continue
        try:
            text = bs.get(it["tx"])
        except Exception:
            continue
        jobs.append((it["key"], it["mp3"], text, it["dur"]))
    print("講次 %d" % len(jobs), flush=True)
    n = 0
    with Pool(a.workers, initializer=init, initargs=(a.threads,)) as pool:
        for res in pool.imap_unordered(work, jobs):
            n += 1
            ok = sum(1 for r in res["b"] if r["new"] is not None)
            print("%d/%d %s：%d/%d 對到" % (n, len(jobs), res["key"], ok, len(res["b"])), flush=True)
    al = {}
    for f in os.listdir(CACHE):
        r = json.load(open(os.path.join(CACHE, f), encoding="utf8"))
        al[r["key"]] = {str(b["c"]): b["new"] for b in r["b"] if b["new"] is not None}
    json.dump(al, open(OUT, "w", encoding="utf8"), indent=0)
    print("segments_align", sum(len(v) for v in al.values()), "個分段點", flush=True)


if __name__ == "__main__":
    main()
