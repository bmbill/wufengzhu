"""把 tools/out/topics/out_*.jsonl（每段的主題 t、目標 g）合成 tools/lr_topics.json：{段落識別碼: [主題, 目標]}。
build_lamrim.py 會讀這個檔，有寫的段落就用它的主題與目標，沒有的才用自動摘的主題。"""
import glob, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
bad = 0
files = sorted(glob.glob(os.path.join(ROOT, "tools", "out", "topics", "out_*.jsonl"))) + sorted(glob.glob(os.path.join(ROOT, "tools", "out", "polish", "out_*.jsonl")))  # 打磨稿覆蓋初稿
for f in files:
    for line in open(f, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        try:
            o = json.loads(line)
            out[o["id"]] = [o["t"].strip(), o["g"].strip()]
        except Exception:
            bad += 1
p = os.path.join(ROOT, "tools", "lr_topics.json")
json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("topics", len(out), "bad lines", bad)
