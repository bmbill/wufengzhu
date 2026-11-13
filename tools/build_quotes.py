"""法語卡：把挑好的師父原話（tools/out/quotes/pick.json）逐字核對逐字稿，產生 quotes.js 和審閱清單。

核對：每一句都必須是該段（段落識別碼）師父講解逐字稿裡一字不差的連續文字；對不上的不收，列在清單最後。
審閱清單：法語卡_審閱清單.md（照法類排，給法師／班長看；不要的句子在 tools/quotes_drop.json 填它的編號再重跑）。
用法：python tools/build_quotes.py
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_lamrim import fetch, paras_of  # noqa: E402

MOODS = {"happy", "cheer", "gentle", "think", "fight", "wow", "calm"}
WHO = {"jie", "ding", "hui"}


def main():
    s = open(os.path.join(ROOT, "lamrim.js"), encoding="utf8").read()
    L = json.loads(re.search(r"window.LR=(.*?);\n", s, re.S).group(1))
    C = json.loads(re.search(r"window.LR_CATS=(.*?);\n", s, re.S).group(1))
    U = {"%d.%d" % (u[0], u[4]): u for u in L}
    P = json.load(open(os.path.join(ROOT, "tools", "out", "quotes", "pick.json"), encoding="utf8"))
    dp = os.path.join(ROOT, "tools", "quotes_drop.json")
    drop = set(json.load(open(dp, encoding="utf8"))) if os.path.exists(dp) else set()
    cache, out, bad, seen = {}, [], [], set()
    for x in P:
        t = x["t"].strip()
        u = U.get(x["id"])
        if not u or t in seen:
            bad.append((x, "找不到段落" if not u else "重複"))
            continue
        v = u[0]
        if v not in cache:
            cache[v] = paras_of(fetch(v))
        ps = cache[v]
        body = "".join(tx for k, _, tx in ps[u[4]:u[5]] if not k)
        if u[7]:  # 接到下一卷卷首的續講
            nv = v + 1
            if nv not in cache:
                cache[nv] = paras_of(fetch(nv))
            body += "".join(tx for k, _, tx in cache[nv][:u[7]] if not k)
        if t not in body:
            bad.append((x, "逐字稿裡沒有這句（可能被改寫）"))
            continue
        seen.add(t)
        if t.count("「") > t.count("」"):   # 句子裡師父引的話沒結束：顯示時補上收尾引號
            t = t + "」"
        out.append([t, x["id"], x.get("mood") if x.get("mood") in MOODS else "happy", x.get("who") if x.get("who") in WHO else "jie", C[u[6]][0]])
    keep = [q[:4] for i, q in enumerate(out) if i + 1 not in drop]
    js = ("/* 法語卡：師父南普陀廣論原話（逐字核對過逐字稿）。QUOTES=[原話, 段落識別碼, 角色表情, 哪一格的角色(jie/ding/hui)]，由 tools/build_quotes.py 產生 */\n"
          "window.QUOTES=" + json.dumps(keep, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open(os.path.join(ROOT, "quotes.js"), "w", encoding="utf8").write(js)
    # 審閱清單
    lines = ["# 法語卡審閱清單", "",
             "法語卡上的句子，都是師父南普陀廣論的原話，已用程式逐字核對過逐字稿。",
             "請看看有沒有：斷章取義、單獨看會誤解、不夠有力、不適合放在卡片上的句子。",
             "不要的句子，告訴 Claude 編號（或填進 `tools/quotes_drop.json`，例如 `[3, 17]`）再重跑。", "",
             "共 %d 句（已排除 %d 句）。" % (len(out), len(drop)), ""]
    cur = None
    for i, q in enumerate(out, 1):
        if q[4] != cur:
            cur = q[4]
            lines += ["", "## " + cur, ""]
        mark = "~~" if i in drop else ""
        lines.append("%d. %s「%s」%s　<small>第 %s 卷・段落 %s</small>" % (i, mark, q[0], mark, q[1].split(".")[0], q[1]))
    if bad:
        lines += ["", "## 沒有收進來的（核對不過）", ""]
        for x, why in bad:
            lines.append("- 「%s」（%s）：%s" % (x.get("t"), x.get("id"), why))
    open(os.path.join(ROOT, "法語卡_審閱清單.md"), "w", encoding="utf8").write("\n".join(lines) + "\n")
    print("收 %d 句、排除 %d、核對不過 %d" % (len(keep), len(drop), len(bad)))


if __name__ == "__main__":
    main()
