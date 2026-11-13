"""校準聞法勝利 16 小段的切點（卷 17～19 的逐字稿時間會晚 5 秒到 1 分多鐘）。
方法同 calib_starts.py：在每個切點附近辨識，找「上一段最後 10 個字」講完的地方，或「下一段開頭 10 個字」。
結果存 tools/hearing_fix.json：{"卷:舊秒數": 新秒數}；build_hearing.py js 會套用。
用法：python tools/calib_hearing.py [--threads 4]
"""
import json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import calib_starts as cs  # noqa: E402
from build_lamrim import fetch, paras_of  # noqa: E402


def main():
    threads = int(sys.argv[sys.argv.index("--threads") + 1]) if "--threads" in sys.argv else 4
    cs.init(threads)
    C = json.load(open(os.path.join(ROOT, "tools", "out", "hearing_chunks.json"), encoding="utf-8"))
    pts = set()
    for c in C:
        for v, s, e in c["plan"]:
            if s > 1:
                pts.add((v, s))
            if e is not None:
                pts.add((v, e))
    fix = {}
    for v in sorted({p[0] for p in pts}):
        d = fetch(v)
        m = next(m for m in d["media"] if m.get("mediaType") == "audio/mpeg")
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", m["src"] + "-48kHz-64kbs", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
        import numpy as np
        x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
        dur = len(x) / 16000
        ps = paras_of(d)
        for vv, t in sorted(p for p in pts if p[0] == v):
            k = next((i for i, (kai, tt, tx) in enumerate(ps) if tt == t), None)
            if k is None:
                continue
            prev = next((ps[j][2] for j in range(k - 1, -1, -1) if ps[j][2]), "")
            nh = next((ps[j][2] for j in range(k, len(ps)) if ps[j][2]), "")
            b = {"te": t, "prev": cs.han(prev)[-10:], "next": cs.han(nh)[:10], "q": []}
            new, how, sc, _ = cs.locate(b, x, dur)
            if new is None:
                new, how, sc, _ = cs.locate(b, x, dur, max(0.0, t - 160), max(0.0, t - cs.BEFORE + 10))
            print(v, t, "→", None if new is None else round(new, 1), how, sc, flush=True)
            if new is not None and -165 <= new - t <= 15:
                fix["%d:%g" % (v, t)] = round(max(0.0, new - 0.3), 1)
    json.dump(fix, open(os.path.join(ROOT, "tools", "hearing_fix.json"), "w", encoding="utf-8"), indent=0)
    print("hearing_fix", len(fix), "/", len(pts))


if __name__ == "__main__":
    main()
