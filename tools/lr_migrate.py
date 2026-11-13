"""在 lamrim.js 尾端加上 LR_OLD：舊版（tools/old/lamrim_v1.js，每段最長 12 分鐘）的段落識別碼 → [講解段落起, 講解段落迄]。
網頁載入時，聽過的舊段落所涵蓋的新小段都算聽過。重新產生 lamrim.js 後要再跑一次。"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ld = lambda p: json.loads(re.search(r"window.LR=(.*?);\n", open(p, encoding="utf8").read(), re.S).group(1))
O = ld(os.path.join(ROOT, "tools", "old", "lamrim_v1.js"))
p = os.path.join(ROOT, "lamrim.js")
N = ld(p)
nid = {"%d.%d" % (u[0], u[4]): u for u in N}
mig = {}
for u in O:
    k = "%d.%d" % (u[0], u[4])
    n = nid.get(k)
    if n is None or n[5] < u[5]:
        mig[k] = [u[4], u[5]]
s = open(p, encoding="utf8").read()
s = s.split("\n/* 舊版")[0].rstrip() + "\n/* 舊版段落→新小段的對照（進度搬移用） */\nwindow.LR_OLD=" + json.dumps(mig, separators=(",", ":")) + ";\n"
open(p, "w", encoding="utf8").write(s)
print("LR_OLD", len(mig))
