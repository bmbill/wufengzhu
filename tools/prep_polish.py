"""打磨用的輸入：每段的完整師父講解、初稿主題與目標、前後段初稿主題。輸出 tools/out/polish/in_XX.jsonl。"""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from build_lamrim import fetch, paras_of, ROOT
s = open(os.path.join(ROOT, "lamrim.js"), encoding="utf8").read()
L = json.loads(re.search(r"window.LR=(.*?);\n", s, re.S).group(1))
C = json.loads(re.search(r"window.LR_CATS=(.*?);\n", s, re.S).group(1))
D = {}
for f in glob.glob(os.path.join(ROOT, "tools", "out", "topics", "out_*.jsonl")):
    for l in open(f, encoding="utf8"):
        if l.strip():
            try:
                o = json.loads(l); D[o["id"]] = (o["t"], o["g"])
            except Exception:
                pass
cache, rows = {}, []
for i, u in enumerate(L):
    v = u[0]
    if v not in cache:
        cache[v] = paras_of(fetch(v))
    ps = cache[v]
    ex = "".join(t for k, _, t in ps[u[4]:u[5]] if not k)
    if u[7]:  # 接在後面播的下一卷卷首續講
        if v + 1 not in cache:
            cache[v + 1] = paras_of(fetch(v + 1))
        ex += "".join(t for k, _, t in cache[v + 1][:u[7]] if not k)
    ex = re.sub(r"\s+", "", ex)
    if len(ex) > 2600:
        ex = ex[:2000] + "……（中略）……" + ex[-550:]
    did = "%d.%d" % (u[0], u[4])
    nb = lambda j: D.get("%d.%d" % (L[j][0], L[j][4]), ("", ""))[0] if 0 <= j < len(L) else ""
    d = D.get(did, ("", ""))
    rows.append({"id": did, "cat": C[u[6]][0], "cont": u[8], "原文": u[1].replace("\n", " ")[:300],
                 "講解": ex, "初稿主題": d[0], "初稿目標": d[1], "前一段主題": nb(i - 1), "後一段主題": nb(i + 1)})
out = os.path.join(ROOT, "tools", "out", "polish"); os.makedirs(out, exist_ok=True)
n = 10; size = -(-len(rows) // n)
for b in range(n):
    with open(os.path.join(out, "in_%02d.jsonl" % b), "w", encoding="utf8") as f:
        for r in rows[b * size:(b + 1) * size]:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
miss = sum(1 for r in rows if not r["初稿主題"])
print(len(rows), size, "no draft:", miss, "chars", sum(len(r["講解"]) for r in rows))
