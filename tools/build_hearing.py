"""聞法勝利前行：師父南普陀廣論講「聽聞勝利」的部分（卷 17 後段～卷 19 前段），
照講解段落的時間切成約 2 分鐘一小段，輸出 tools/out/hearing_chunks.json（給人寫主題與目標用）。
最後由 tools/hearing_meta.json（主題、目標）合成 hearing.js。"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_lamrim import fetch, paras_of, ROOT

RANGE = [(17, 1537, None), (18, 11, None), (19, 11, 737)]
TARGET, LO, HI = 120, 85, 165


def main():
    pts = []   # (卷, 秒, 是否原文, 文字)
    for v, s, e in RANGE:
        d = fetch(v)
        dur = sum(m.get("duration") or 0 for m in d.get("media", []))
        last = None
        for kai, t, text in paras_of(d):
            if t is not None:
                last = t
            tt = t if t is not None else last
            if tt is None or tt < s - 1 or (e and tt >= e):
                continue
            pts.append((v, tt, kai, text))
        pts.append((v, e or dur, None, None))  # 卷尾
    # 依時間切塊
    chunks, cur = [], None
    for v, t, kai, text in pts:
        if kai is None:
            if cur:
                cur["plan"][-1][2] = None if t and cur["plan"][-1][0] != 19 else t
                cur["plan"][-1][2] = t if v == 19 else None
            continue
        if cur is None:
            cur = {"plan": [[v, t, None]], "q": [], "txt": [], "len": 0, "t": t, "v": v}
        if cur["plan"][-1][0] != v:
            cur["plan"].append([v, t, None]); cur["t"] = t; cur["v"] = v
        el = cur["len"] + (t - cur["t"])
        if el >= LO and not kai and (el >= TARGET or False):
            cur["plan"][-1][2] = t
            chunks.append(cur)
            cur = {"plan": [[v, t, None]], "q": [], "txt": [], "len": 0, "t": t, "v": v}
        else:
            cur["len"] = el; cur["t"] = t
        (cur["q"] if kai else cur["txt"]).append(text)
    if cur:
        chunks.append(cur)
    out = []
    for c in chunks:
        sec = sum(((p[2] if p[2] is not None else 0) - p[1]) for p in c["plan"] if p[2] is not None)
        out.append({"plan": c["plan"], "q": c["q"], "txt": "".join(c["txt"])[:900]})
    os.makedirs(os.path.join(ROOT, "tools", "out"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "tools", "out", "hearing_chunks.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(out))




def write_js():
    C = json.load(open(os.path.join(ROOT, "tools", "out", "hearing_chunks.json"), encoding="utf-8"))
    M = json.load(open(os.path.join(ROOT, "tools", "hearing_meta.json"), encoding="utf-8"))
    assert len(C) == len(M), (len(C), len(M))
    fp = os.path.join(ROOT, "tools", "hearing_fix.json")
    FIX = json.load(open(fp, encoding="utf-8")) if os.path.exists(fp) else {}
    fx = lambda v, t: t if t is None else FIX.get("%d:%g" % (v, t), t)   # 聲音對位校準過的切點（calib_hearing.py）
    for c in C:
        c["plan"] = [[v, fx(v, s), fx(v, e)] for v, s, e in c["plan"]]
    out, lastq = [], ""
    for c, (topic, goal) in zip(C, M):
        q = "\n".join(c["q"]) or lastq
        lastq = c["q"][-1] if c["q"] else lastq
        out.append([q, c["plan"], topic, goal])
    js = ("/* 聞法勝利前行：師父南普陀廣論講「聽聞勝利」（卷 17 後段～卷 19 前段），約 2 分鐘一小段，由 tools/build_hearing.py 產生。\n"
          "   HB=[原文, 播放計畫[[卷, 開始秒, 結束秒或 null＝到卷尾]], 主題, 目標] */\n"
          "window.HB=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open(os.path.join(ROOT, "hearing.js"), "w", encoding="utf-8").write(js)
    print("hearing.js", len(out))


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "js":
    write_js()

if __name__ == "__main__" and len(sys.argv) == 1:
    main()
