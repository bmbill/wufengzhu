"""依內容替每一講分段（產生 segments.js），讓「分段聽清楚」停在段落之間，而不是每 5 分鐘硬切。

做法：
1. 讀大慈恩 Podcast 的逐字稿（RSS 裡的 podcast:transcript），用老師的段落標題【……】切段；
   沒有標題的講次，改用自然段落湊成約 4～6 分鐘一段。
2. 依每段的字數比例推算開始時間。
3. 在推算時間前後 25 秒內找講話的停頓（ffmpeg silencedetect），把分段點對齊到停頓上。
   只下載分段點附近約 50 秒的音檔，不下載整講。
4. 太短（不到 60 秒）併到前一段；太長（超過 9 分鐘）在中間找停頓再切一次。

用法：python tools/build_segments.py            （只做還沒做過的講次）
      python tools/build_segments.py --only s1  （重做指定講次）
      python tools/build_segments.py --all      （全部重做）
結果存在 segments.js；中間結果快取在 tools/segments_cache.json。
"""
import argparse, html, json, os, re, shutil, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEEDS = {"s": "B000036", "v": "B000211"}
CACHE = os.path.join(ROOT, "tools", "segments_cache.json")
OUT = os.path.join(ROOT, "segments.js")
UA = {"User-Agent": "Mozilla/5.0 (wufengzhu segments)"}
HEAD = re.compile(r"^\s*【(.+?)】\s*$")


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


FF = ffmpeg()


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read().decode("utf-8", "replace")


def clean(s):
    return html.unescape(s.replace("<![CDATA[", "").replace("]]>", "")).strip()


def items():
    out = []
    for ch, fid in FEEDS.items():
        x = get("https://www.amrtf.org/podcast/rss/%s.xml" % fid)
        for it in re.findall(r"<item>(.*?)</item>", x, re.S):
            m = re.match(r"(\d{3,4})", clean(re.search(r"<title>(.*?)</title>", it, re.S).group(1)))
            enc = re.search(r'<enclosure url="([^"]+)"', it)
            tx = re.search(r'<podcast:transcript url="([^"]+)"', it)
            dur = re.search(r"<itunes:duration>(\d+)<", it)
            if m and enc and dur:
                out.append({"key": ch + str(int(m.group(1))), "mp3": enc.group(1), "tx": tx.group(1) if tx else None, "dur": int(dur.group(1))})
    return out


COLLOQ = re.compile(r"的|了|我們|大家|你們|就是|這個|那個|什麼|喔|吧|呢|嗎|啊")


def is_root_text(p):
    """這一段是不是老師念的廣論原文（文言文）。"""
    if len(p) < 20:
        return False
    hits = len(COLLOQ.findall(p))
    return hits / len(p) < 0.006


def brief(p, n=12):
    s = re.split(r"[，。：；、！？「」]", p)
    head = ""
    for part in s:
        if len(head) + len(part) > n and head:
            break
        head += part + "，"
    head = head.rstrip("，")
    return (head[:n] if len(head) > n else head) + "……"


def sections(text, dur):
    """回傳 [(標題, 這段開始前的字數)]、總字數。"""
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if l and not l.startswith("註：")]
    secs, chars, cur = [], 0, None
    heads = sum(1 for l in lines if HEAD.match(l))
    if heads >= 2:
        for l in lines:
            m = HEAD.match(l)
            if m:
                secs.append([m.group(1).strip(), chars])
            else:
                if not secs:
                    secs.append(["開場", 0])
                chars += len(l)
        # 開場很短就併進第一個標題
        if len(secs) > 1 and secs[0][0] == "開場" and secs[1][1] < 250:
            secs[1][1] = 0
            secs.pop(0)
        return secs, chars
    paras = [l for l in lines if not HEAD.match(l)]
    # 沒有標題：照老師念的廣論原文段來切（原文是文言，幾乎不用「的、了、我們」等白話字）
    secs, acc = [], 0
    for p in paras:
        if is_root_text(p):
            if not secs and acc > 250:
                secs.append(["開場", 0])
            secs.append(["「%s」" % brief(p), acc])
        acc += len(p)
    if len(secs) >= 2:
        if secs[0][1] < 250:
            secs[0][1] = 0
        return secs, acc
    # 也找不到原文段：用自然段落湊成約 5 分鐘一段
    total = sum(len(p) for p in paras) or 1
    n = max(2 if dur >= 360 else 1, round(dur / 300))
    target = total / n
    acc, start = 0, 0
    secs = [["開頭", 0]]
    for p in paras:
        if acc - start >= target * 0.85 and len(secs) < n:
            secs.append(["從「%s」開始" % brief(p, 10), acc])
            start = acc
        acc += len(p)
    return secs, total


def silences(url, t0, span):
    """回傳 [(停頓開始, 停頓結束)]（絕對秒數）。"""
    t0 = max(0.0, t0)
    cmd = [FF, "-hide_banner", "-nostats", "-ss", "%.2f" % t0, "-t", "%.2f" % span, "-i", url,
           "-af", "silencedetect=noise=-33dB:d=0.3", "-f", "null", "-"]
    try:
        err = subprocess.run(cmd, capture_output=True, timeout=120).stderr.decode("utf-8", "replace")
    except Exception:
        return []
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    out = []
    for i, s in enumerate(st):
        e = en[i] if i < len(en) else s + 0.3
        if s < 0.1:          # 讀取起點本身會被當成停頓，排除
            continue
        out.append((t0 + s, t0 + e))
    return out


def snap(url, t, dur, win=25):
    sil = silences(url, t - win, win * 2)
    if not sil:
        return t, False
    # 越長的停頓越像段落之間；同時不要離推算點太遠
    best = max(sil, key=lambda se: (se[1] - se[0]) * 2.5 - abs((se[0] + se[1]) / 2 - t) / win)
    return max(0.0, min(dur - 5, best[1] - 0.2)), True


def build(it):
    try:
        text = get(it["tx"]) if it["tx"] else ""
    except Exception:
        text = ""
    dur = it["dur"]
    if text:
        secs, total = sections(text, dur)
    else:
        n = max(1, round(dur / 300))
        secs, total = [["", i * 1000] for i in range(n)], n * 1000
    total = total or 1
    out = [[0.0, secs[0][0]]]
    for title, c in secs[1:]:
        t = c / total * dur
        if t < 20 or t > dur - 20:
            continue
        s, ok = snap(it["mp3"], t, dur)
        out.append([round(s, 1), title])
    out.sort(key=lambda x: x[0])
    # 太短的段併到前一段
    merged = [out[0]]
    for s, title in out[1:]:
        if s - merged[-1][0] < 60:
            if title and merged[-1][1]:
                merged[-1][1] += "・" + title
            elif title:
                merged[-1][1] = title
        else:
            merged.append([s, title])
    if len(merged) > 1 and dur - merged[-1][0] < 45:
        last = merged.pop()
        if last[1]:
            merged[-1][1] += "・" + last[1]
    # 太長的段在中間找停頓再切一次
    final = []
    for i, (s, title) in enumerate(merged):
        e = merged[i + 1][0] if i + 1 < len(merged) else dur
        final.append([s, title])
        if e - s > 540:
            mid, ok = snap(it["mp3"], (s + e) / 2, dur, win=40)
            if ok and mid - s > 120 and e - mid > 120:
                final.append([round(mid, 1), (title + "（續）") if title else ""])
    return it["key"], {"dur": dur, "segs": final, "tx": bool(text)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--workers", type=int, default=6)
    a = ap.parse_args()
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    its = items()
    todo = [it for it in its if a.all or (a.only and it["key"] in a.only) or (not a.only and it["key"] not in cache)]
    print("講次 %d，要做 %d" % (len(its), len(todo)))
    done = 0
    with ThreadPoolExecutor(a.workers) as ex:
        for key, res in ex.map(build, todo):
            cache[key] = res
            done += 1
            if done % 10 == 0 or done == len(todo):
                print("  %d/%d" % (done, len(todo)))
                json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)
    data = {k: v["segs"] for k, v in sorted(cache.items(), key=lambda kv: (kv[0][0], int(kv[0][1:])))}
    js = ("/* 各講的內容分段（tools/build_segments.py 依逐字稿段落標題＋講話停頓產生）：講次: [[開始秒數, 段落標題], ...] */\n"
          "window.SEGS=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open(OUT, "w", encoding="utf-8").write(js)
    print("完成：segments.js（%d 講）" % len(data))


if __name__ == "__main__":
    main()
