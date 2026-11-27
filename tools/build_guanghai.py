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

SEG = re.compile(r"\[(\d{1,2}):(\d{2})\s*[–~-]\s*(\d{1,2}):(\d{2})\]")

def seg_of(s):
    """「[01:16–02:11]」→ [76, 131]（秒），沒有就 None。"""
    m = SEG.search(s or "")
    return [int(m.group(1)) * 60 + int(m.group(2)), int(m.group(3)) * 60 + int(m.group(4))] if m else None

CHOICE = re.compile(r"^選項(（可複選）)?[：:]\s*(.+)$")

def items_of(body):
    """一、二步的題目：★ 開頭＝核心題（要寫）；續行「選項：A｜B」＝點選題（「選項（可複選）：」可複選）；
    其他寫字題＝選做。"""
    out = []
    for it in numbered(body):
        first = it[0]
        core = first.startswith("★")
        first = first.lstrip("★ ").strip()
        m = re.match(r"\*\*(.+?)\*\*[：:]?\s*(.*)", first)
        label, prompt = (m.group(1), m.group(2)) if m else ("", first)
        opts, multi, hint = None, False, []
        for x in it[1:]:
            c = CHOICE.match(x)
            if c:
                opts = [o.strip() for o in c.group(2).split("｜") if o.strip()]; multi = bool(c.group(1))
            elif not BLANK.fullmatch(x.strip()):
                hint.append(x)
        q = {"label": label, "prompt": clean(prompt), "hint": " ".join(hint).strip("（）() ")}
        if opts:
            q["options"] = opts
            if multi: q["multi"] = True
        q["role"] = "core" if core else ("choice" if opts else "extra")
        out.append(q)
    return out

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
    # 師父原音：「00:00–01:16 https://cdn...」→ 第二步只播這一段
    # 師父分幾段時（老師中間插講）：「00:08–02:00、05:16–06:56 https://cdn...」→ parts，播放器只播這幾段
    mm = meta.get("師父原音", "")
    src = re.search(r"https?://\S+", mm)
    parts = [[int(a) * 60 + int(b), int(c) * 60 + int(d)] for a, b, c, d in re.findall(r"(\d{1,2}):(\d{2})\s*[–~-]\s*(\d{1,2}):(\d{2})", mm.split("http")[0])]
    if src and parts:
        L["master"] = {"src": src.group(0), "start": parts[0][0], "end": parts[-1][1]}
        if len(parts) > 1:
            L["master"]["parts"] = parts
        L["lecture"] = src.group(0)  # 整講音檔：第三步、第四步可以分段播
    # 師父原音在別講的音檔裡（例如 566 講沒有師父原音、要聽 565 講的）：另給「整講音檔」一列
    whole = re.search(r"https?://\S+?(?=[\s）)]|$)", meta.get("整講音檔", ""))
    if whole:
        L["lecture"] = whole.group(0)
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
        if key in "一二":
            st["kind"] = "questions"
            st["lead"] = paras_before(body, lambda l: re.match(r"^\d+[.、]", l))
            st["items"] = items_of(body)
        elif key == "三":
            m = re.search(r"\*\*(.+?)\*\*\s*＿", body)
            st["closing"] = m.group(1) if m else ""
            if tables(body):  # 舊格式：我／老師對照表
                st["kind"] = "compare"
                st["lead"] = paras_before(body, lambda l: l.startswith("|"))
                tb = tables(body)
                st["cols"] = tb[0][0][1:]
                st["rows"] = [r[0] for r in tb[0][1:]]
            else:  # 新格式：老師的步驟清單，逐條打勾「我也有做到」
                st["kind"] = "checklist"
                st["lead"] = paras_before(body, lambda l: re.match(r"^\d+[.、]", l))
                st["checks"] = []
                for it in numbered(body):
                    m = re.match(r"\*\*(.+?)\*\*\s*(?:（(\[[^）]+\])）)?[：:]\s*(.*)", " ".join(it))
                    if m:
                        st["checks"].append({"label": m.group(1), "time": (m.group(2) or "").strip("[]").replace("]–[", "–"), "seg": seg_of(m.group(2)), "text": m.group(3)})
        elif key == "四":
            # 共學：預設使用者沒聽過，每場一張卡——從這一講的哪裡切入（可播那一段）、切入點、怎麼帶、獨有的一點
            st["kind"] = "sessions"
            st["lead"] = paras_before(body, lambda l: l.startswith("|"))
            tb = tables(body)
            st["sessions"] = []
            if tb:
                hdr = tb[0][0]
                for r in tb[0][1:]:
                    x = {"who": r[0], "brief": []}
                    for h, v in zip(hdr[1:], r[1:]):
                        if "切入" in h and "哪裡" in h:
                            x["from"] = re.sub(r"（\[[^\]]+\]）", "", v).strip()
                            x["seg"] = seg_of(v)
                        elif h == "切入點":
                            x["head"] = v
                        elif h == "重點":  # 一場一段重點；有兩三點時用「｜」分開
                            x["points"] = [p.strip() for p in v.split("｜") if p.strip()]
                        elif h == "怎麼帶":  # 這場的架構：①②③…一步一步
                            x["flow"] = [s.strip() for s in re.split(r"[①-⑳]", v) if s.strip()]
                        elif v:
                            x["brief"].append([h, v])
                    st["sessions"].append(x)
            lines = body.splitlines()
            last = max((i for i, l in enumerate(lines) if l.strip().startswith("|")), default=-1)
            rest = [l for l in lines[last + 1:] if not l.startswith("★")]
            st["rest"] = chr(10).join(rest).strip()
            m = re.search(r"^★.*?\*\*(.+?)\*\*", body, re.M)
            st["closing"] = m.group(1) if m else ""
            m = re.search(r"https?://\S+?(?=[\s）)]|$)", L["meta"].get("共學錄影", ""))
            if m:
                st["recording"] = m.group(0)
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
            st["closing"] = clean(st["closing"]).lstrip("★ ")
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
                # 點選題：附錄同號的條目當「選完看老師怎麼說」；開頭「答：X。」＝老師的答案（可複選用｜分隔）
                if st.get("items"):
                    ans = [" ".join(a) for a in numbered(found[st["key"]]["md"])]
                    for j, q in enumerate(st["items"]):
                        if q.get("options") and j < len(ans):
                            m = re.match(r"答[：:]\s*(.+?)。\s*(.*)", ans[j])
                            if m:
                                q["answer"] = [x.strip() for x in m.group(1).split("｜")]
                                q["explain"] = m.group(2)
                            else:
                                q["explain"] = ans[j]
                    # 全部答案的「看老師怎麼講」不重複「答：X。」
                    st["answer"]["md"] = re.sub(r"^(\d+[.、]\s+)答[：:][^。]*。\s*", r"\1", st["answer"]["md"], flags=re.M)
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
