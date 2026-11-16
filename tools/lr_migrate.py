"""在 lamrim.js 尾端加上舊版段落→新小段的對照，網頁載入時把聽過的舊段落所涵蓋的新小段都算聽過。
LR_OLD：第 1 版（tools/old/lamrim_v1.js，每段最長 12 分鐘）；LR_OLD2：第 2 版（tools/old/lamrim_v2.js，照時間平均切長段）。
重新產生 lamrim.js 後要再跑一次。"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NL = chr(10)


def ld(p):
    return json.loads(re.search(r"window.LR=(.*?);" + NL, open(p, encoding="utf8").read(), re.S).group(1))


p = os.path.join(ROOT, "lamrim.js")
N = ld(p)
nid = {"%d.%d" % (u[0], u[4]): u for u in N}
out = []
for name, var in (("lamrim_v1.js", "LR_OLD"), ("lamrim_v2.js", "LR_OLD2")):
    mig = {}
    for u in ld(os.path.join(ROOT, "tools", "old", name)):
        k = "%d.%d" % (u[0], u[4])
        n = nid.get(k)
        if n is None or n[5] != u[5]:
            mig[k] = [u[4], u[5]]
    out.append("window.%s=%s;" % (var, json.dumps(mig, separators=(",", ":"))))
    print(var, len(mig))
s = open(p, encoding="utf8").read()
s = s.split(NL + "/* 舊版")[0].rstrip() + NL + "/* 舊版段落→新小段的對照（進度搬移用） */" + NL + NL.join(out) + NL
open(p, "w", encoding="utf8").write(s)
