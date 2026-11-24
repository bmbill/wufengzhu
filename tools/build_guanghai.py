# 把「廣海明月學習單」的 md 轉成網頁用的 JSON（guanghai/lessons/）。
# 用法：python tools/build_guanghai.py
# 來源：__AI\廣海明月學習單\第NNN講_學習單.md（照 572 講的範本寫：一～六節＋附錄）
# 產出：guanghai/lessons/NNNN.json（每講一份）＋ guanghai/lessons/index.json（目錄）
import json, os, re, glob, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SRC = os.path.join(os.path.dirname(SITE), "廣海明月學習單")
OUT = os.path.join(SITE, "guanghai", "lessons")
BLANK = re.compile(r"＿{3,}")

def split_sections(text):
    """依 '## ' 切成 {標題: 內文}，保留順序。"""
    secs, cur, buf = [], None, []
    for line in text.splitlines():
        if line.startswith("## "):
            if cur is not None:
                secs.append((cur, "\n".join(buf).strip()))
            cur, buf = line[3:].strip(), []
        elif cur is not None:
            buf.append(line)
    if cur is not None:
        secs.append((cur, "\n".join(buf).strip()))
    return secs

def table(lines):
    rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in lines if l.strip().startswith("|")]
    return [r for r in rows if not all(re.fullmatch(r":?-{3,}:?", c) for c in r if c)]

def tables(body):
    """回傳 body 裡所有表格（每個是列的 list，第一列是表頭）。"""
    out, buf = [], []
    for l in body.splitlines() + [""]:
        if l.strip().startswith("|"):
            buf.append(l)
        elif buf:
            out.append(table(buf)); buf = []
    return out

def numbered(body):
    """1. 2. 3. 開頭的條目；續行（縮排）併進同一條。"""
    items = []
    for l in body.splitlines():
        m = re.match(r"^(\d+)[.、]\s+(.*)", l)
        if m:
            items.append([m.group(2).strip()])
        elif items and l.startswith("   ") and l.strip():
            items[-1].append(l.strip())
        elif items and not l.strip():
            continue
        elif items and not l.startswith(" "):
            items.append(None)  # 斷開
    return [i for i in items if i]

def paras_before(body, stop):
    """取 body 開頭、遇到 stop(條件) 之前的段落文字。"""
    out = []
    for l in body.splitlines():
        if stop(l):
            break
        if l.strip():
            out.append(l.strip())
    return "\n".join(out)

def clean(s):
    return BLANK.sub("", s).strip().rstrip("：:").strip()

def head_title(s):
    """'一、聽前準備（5 分鐘）' → ('聽前準備', 5)"""
    s = re.sub(r"^[一二三四五六七八九十]+、", "", s).strip()
    m = re.search(r"（(\d+)\s*分鐘）", s)
    mins = int(m.group(1)) if m else None
    s = re.sub(r"（\d+\s*分鐘）", "", s).strip()
    return s, mins

def parse(path):
    text = open(path, encoding="utf-8").read()
    no = int(re.search(r"第\s*(\d+)\s*講", os.path.basename(path)).group(1))
    h1 = re.search(r"^# (.+)$", text, re.M).group(1)
    title = h1.split("：", 1)[1].strip() if "：" in h1 else h1
    intro = paras_before(text.split("\n", 1)[1], lambda l: l.startswith("|") or l.startswith("## "))
    # 網頁上答案不在最後，而是藏在各步驟裡
    intro = re.sub(r"答案放在最後的附錄[，,]?\s*\*\*聽完、寫完再翻\*\*。?",
                   "老師的講法藏在各步驟的「寫完了，看老師怎麼講」，**寫完再打開**。", intro)
    meta = {}
    for r in tables(text.split("## ", 1)[0])[0][1:] if tables(text.split("## ", 1)[0]) else []:
        meta[r[0]] = r[1]
    secs = split_sections(text)
    L = {"no": no, "id": f"{no:04d}", "title": title, "intro": intro, "meta": meta, "steps": []}
    url = re.search(r"https?://\S+?(?=[\s）)]|$)", meta.get("原音與逐字稿", ""))
    L["audio"] = url.group(0) if url else f"https://www.amrtf.org/zh-hant/clear-moonlight-great-ocean-{no:04d}/"
    verse = re.search(r"「([^」]{8,})」", meta.get("廣論段落", ""))
    L["verse"] = verse.group(1) if verse else ""
    appendix = ""
    for head, body in secs:
        if head.startswith("附錄"):
            appendix = body
            continue
        t, mins = head_title(head)
        key = head[:1]
        st = {"key": key, "title": t, "minutes": mins}
        if key == "一":
            st["kind"] = "prompts"
            st["items"] = []
            for it in numbered(body):
                first = it[0]
                m = re.match(r"\*\*(.+?)\*\*[：:]?\s*(.*)", first)
                label, prompt = (m.group(1), m.group(2)) if m else ("", first)
                hint = " ".join(x for x in it[1:] if not BLANK.fullmatch(x.strip()))
                st["items"].append({"label": label, "prompt": clean(prompt), "hint": hint.strip("（）() ")})
        elif key == "二":
            st["kind"] = "questions"
            st["lead"] = paras_before(body, lambda l: re.match(r"^\d+[.、]", l))
            st["items"] = [{"prompt": clean(" ".join(it))} for it in numbered(body)]
        elif key == "三":
            st["kind"] = "compare"
            st["lead"] = paras_before(body, lambda l: l.startswith("|"))
            tb = tables(body)
            st["cols"] = tb[0][0][1:] if tb else ["我", "老師"]
            st["rows"] = [r[0] for r in tb[0][1:]] if tb else []
            m = re.search(r"\*\*(.+?)\*\*\s*＿", body)
            st["closing"] = m.group(1) if m else ""
        elif key == "四":
            st["kind"] = "sessions"
            main, _, reveal = body.partition("\n### ")
            st["lead"] = paras_before(main, lambda l: l.startswith("|"))
            tb = tables(main)
            st["sessions"] = [{"who": r[0], "focus": r[1]} for r in tb[0][1:]] if tb else []
            if reveal:
                rt, _, rb = reveal.partition("\n")
                # 指向本機資料夾的說明在網頁上沒用，拿掉
                rb = re.sub(r"各場詳細內容見[^。]*。", "", rb)
                st["reveal"] = {"title": rt.strip(), "md": rb.strip()}
        elif key == "五":
            st["kind"] = "practice"
            m = re.search(r"\*\*觸發點\*\*[：:]\s*(.+)", body)
            trig = m.group(1) if m else ""
            trig = re.sub(r"^[^①]*", "", trig)
            st["triggers"] = [x.strip("；;。 ") for x in re.split(r"[①②③④⑤⑥]", trig) if x.strip("；;。 ")]
            m = re.search(r"\*\*遇到時做四步\*\*(.*)", body)
            st["stepsNote"] = m.group(1).strip("（）()：: ") if m else ""
            st["moves"] = []
            for it in numbered(body):
                m = re.match(r"\*\*(.+?)\*\*[：:]\s*(.*)", it[0])
                if m:
                    st["moves"].append({"label": m.group(1), "text": m.group(2)})
            st["phrases"] = re.findall(r"「([^」]{6,}?)」", " ".join(x["text"] for x in st["moves"] if "法" in x["label"]))
            m = re.search(r"\*\*每天至少記一筆\*\*(.*)", body)
            st["logNote"] = m.group(1).strip("（）()：: ") if m else ""
            m = re.search(r"\*\*提醒\*\*[：:]\s*(.+)", body)
            st["reminder"] = m.group(1).strip() if m else ""
        elif key == "六":
            st["kind"] = "levels"
            tb = tables(body)
            st["levels"] = [{"name": re.sub(r"^\d+\.\s*", "", r[0]), "how": r[1], "pass": r[2]} for r in tb[0][1:]] if tb else []
            m = re.search(r"\*\*(留一個問題.+?)\*\*", body)
            st["closing"] = re.sub(r"\*\*", "", body[body.find("最後"):].split("\n")[0]).strip("＿：: ") if "最後" in body else ""
            st["closing"] = clean(st["closing"])
        else:
            st["kind"] = "md"; st["md"] = body
        L["steps"].append(st)
    # 附錄：依「**二、…**」「**三、…**」分給對應步驟當「看老師怎麼講」
    if appendix:
        chunks = re.split(r"^\*\*([一二三四五六])、(.+?)\*\*\s*$", appendix, flags=re.M)
        lead = chunks[0].strip()
        found = {}
        for i in range(1, len(chunks), 3):
            found[chunks[i]] = {"title": chunks[i + 1].strip(), "md": chunks[i + 2].strip()}
        for st in L["steps"]:
            if st["key"] in found:
                st["answer"] = found[st["key"]]
        if lead:
            L["appendixLead"] = lead
    return L

def main():
    os.makedirs(OUT, exist_ok=True)
    idx = []
    files = sorted(glob.glob(os.path.join(SRC, "第*講_學習單.md")))
    if not files:
        sys.exit("找不到學習單：" + SRC)
    for f in files:
        L = parse(f)
        json.dump(L, open(os.path.join(OUT, L["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        idx.append({"no": L["no"], "id": L["id"], "title": L["title"], "verse": L["verse"],
                    "unit": L["meta"].get("所屬單元", "").split("。")[0],
                    "kepan": L["meta"].get("科判位置", ""), "steps": len(L["steps"])})
        print("ok", L["id"], L["title"], [s["kind"] for s in L["steps"]])
    idx.sort(key=lambda x: x["no"])
    json.dump({"lessons": idx}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("index:", len(idx))

if __name__ == "__main__":
    main()
