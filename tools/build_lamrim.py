"""產生「戒」的每日一段：師父南普陀廣論（大慈恩 B000027，320 卷）的廣論原文段＋講解範圍＋音檔起訖時間。

輸出 lamrim.js：
  window.LR_CATS = [[法類, 部（道前基礎/下士道/中士道/上士道）, 第一段的索引], ...]
  window.LR = [[卷, 原文, 開始秒, 結束秒, 講解段落起, 講解段落迄, 法類索引, 續卷講解段落數], ...]
師父講解的逐字稿不存進來，播放時由網頁向大慈恩讀取（跟修信念恩日記的做法相同）。
廣論原文（法尊法師譯）照存，讓每天的卡片離線也看得到原文。

分段規則：
- 原文段（scripture-kai）後面接的講解段落，都屬於這一段；段落開頭的 data-time 是時間。
- 很短的原文（例如「第二思惟暇滿利大者」這類科判句）併到下一段。
- 每段至少約 3 分鐘、最多約 12 分鐘；太短的與下一段合併（不跨法類、不跨卷）。
- 卷首在第一段原文之前的講解，是上一卷最後一段的延續，記在上一段的「續卷講解」。
- 開始秒數＝第一段講解的時間 − 念原文的估計時間（每字約 0.28 秒）。
"""
import html, json, os, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://cdn.amec.amrtf.org/volume/B000027/%d"
UA = {"User-Agent": "Mozilla/5.0 (dengdeng lamrim index)"}
CACHE_DIR = os.path.join(ROOT, "tools", "cache", "nanputuo")
LAST_LR = 284          # 第 285 卷起是《略論》止觀淺釋，屬於「定、慧」
MIN_SEC, MAX_SEC, PIECE = 180, 330, 270   # 每段約 3～5 分鐘

# 法類（照廣論次第）：名稱、所屬部
CATS = [
    ("皈敬頌", "道前基礎"), ("造者殊勝", "道前基礎"), ("教授殊勝", "道前基礎"), ("聽聞軌理", "道前基礎"),
    ("說法軌理", "道前基礎"), ("完結軌理", "道前基礎"), ("親近善士", "道前基礎"), ("修習軌理", "道前基礎"),
    ("暇滿", "道前基礎"), ("道次引導", "道前基礎"),
    ("念死無常", "下士道"), ("三惡趣苦", "下士道"), ("皈依三寶", "下士道"), ("深信業果", "下士道"),
    ("皈敬", "中士道"), ("希求解脫", "中士道"), ("思惟苦諦", "中士道"), ("思惟集諦", "中士道"),
    ("十二緣起", "中士道"), ("除邪分別", "中士道"), ("解脫正道", "中士道"),
    ("入大乘門", "上士道"), ("菩提心次第", "上士道"), ("儀軌受法", "上士道"), ("學菩薩行", "上士道"),
    ("布施波羅蜜", "上士道"), ("持戒波羅蜜", "上士道"), ("忍辱波羅蜜", "上士道"), ("精進波羅蜜", "上士道"),
    ("靜慮波羅蜜", "上士道"), ("般若波羅蜜", "上士道"), ("四攝法", "上士道"),
]
CAT_NAMES = [c[0] for c in CATS]
ALIAS = {"思維集諦": "思惟集諦", "上士道": "入大乘門"}


def fetch(n):
    os.makedirs(CACHE_DIR, exist_ok=True)
    p = os.path.join(CACHE_DIR, "%03d.json" % n)
    if os.path.exists(p):
        return json.load(open(p, encoding="utf-8"))
    d = json.loads(urllib.request.urlopen(urllib.request.Request(API % n, headers=UA), timeout=60).read())
    json.dump(d, open(p, "w", encoding="utf-8"), ensure_ascii=False)
    return d


def paras_of(d):
    """回傳 [(是否原文, 時間或 None, 純文字)]，順序與網頁端解析 <p> 的順序相同。"""
    body = d.get("body") or ""
    m = re.search(r"<body[^>]*>(.*)</body>", body, re.S)
    body = m.group(1) if m else body
    out = []
    for p in re.findall(r"<p\b[^>]*>(.*?)</p>", body, re.S):
        kai = "scripture-kai" in p
        tm = re.findall(r'data-time="(\d+(?:\.\d+)?)"', p)
        text = html.unescape(re.sub(r"<[^>]+>", "", p)).strip()
        out.append((kai, float(tm[0]) if tm else None, text))
    return out


def cats_of(kp):
    """把卷的科判字串（如「道前基礎 暇滿 ~ 道次引導」）轉成法類名稱清單。"""
    names = []
    for part in re.split(r"[~～]", kp or ""):
        part = part.strip()
        for w in reversed(part.split()):
            w = ALIAS.get(w, w)
            if w in CAT_NAMES:
                names.append(w)
                break
        else:
            if "上士道" in part and not names:
                names.append("入大乘門")
    return names


KEPAN = re.compile(r"^(第[一二三四五六七八九十]+|初|今初|今當|此中分|此分|分[二三四五六]|[一二三四五六七八九十]、)")
CITE = re.compile(r"^(?:如|又|亦如|即此|此|故)?《([^》]{1,12})》(?:中)?(?:亦|又)?(?:云|說|中說)")


def clip(t, n=18):
    t = t.strip("「」『』。，；：、 ")
    return t if len(t) <= n else t[:n] + "…"


def topic_of(q):
    lines = [l.strip() for l in q.split("\n") if l.strip()]
    for l in lines[:4]:
        if KEPAN.match(l) and len(l) <= 40:
            t = re.split(r"[。；]", l)[0]
            return clip(re.sub(r"者$", "", t), 22)
    for l in lines[:3]:
        if len(l) <= 23 and re.search(r"者。?$", l):
            return clip(re.sub(r"者。?$", "", l), 22)
    l = lines[0] if lines else ""
    m = CITE.match(l)
    if m:
        body = l[m.end():].lstrip("：「 ")
        return "《%s》：%s" % (m.group(1), clip(re.split(r"[，。；]", body)[0], 12))
    parts = [p for p in re.split(r"[，。；：！？]", l) if p]
    t = parts[0] if parts else l
    if len(t) < 6 and len(parts) > 1:
        t = t + "，" + parts[1]
    return clip(t)


def main():
    vols = list(range(1, LAST_LR + 1))
    with ThreadPoolExecutor(10) as ex:
        data = dict(zip(vols, ex.map(fetch, vols)))
    units, cur_cat = [], 0
    carry_to = None   # 上一卷最後一段的索引（接收續卷講解）
    for v in vols:
        d = data[v]
        kp = next((f.get("value") for f in d.get("front", []) if f.get("title") == "科判"), "")
        names = cats_of(kp)
        if names:
            cur_cat = max(cur_cat, CAT_NAMES.index(names[0]))
        target_next = CAT_NAMES.index(names[-1]) if len(names) > 1 else None
        dur = sum(m.get("duration") or 0 for m in d.get("media", [])) or 1800
        ps = paras_of(d)
        # 卷首、第一段原文之前的講解 → 上一卷最後一段的延續
        first = next((i for i, (k, _, t) in enumerate(ps) if k and t), None)
        if first is None:
            continue
        # 整卷都是上一段原文的續講（例如第 5 卷）：最後一段被標成原文、後面沒有講解
        if first >= len(ps) - 1 and carry_to is not None:
            pq = units[carry_to]
            units.append([v, pq[1].split(chr(10))[0][:40] + "（續）", 0.0, float(dur), 0, len(ps), pq[6], 0, 1])
            carry_to = len(units) - 1
            continue
        carry_first = first if (carry_to is not None and first > 0 and any(t for k, t, x in ps[:first] if not k and t is not None)) else 0
        # 收集原文段：[原文文字, 講解起, 講解迄, 開始秒]
        raw = []
        i = first
        while i < len(ps):
            if ps[i][0] and ps[i][2]:
                q = [ps[i][2]]
                j = i + 1
                while j < len(ps) and ps[j][0]:
                    if ps[j][2]:
                        q.append(ps[j][2])
                    j += 1
                k = j
                while k < len(ps) and not ps[k][0]:
                    k += 1
                t = next((ps[x][1] for x in range(j, k) if ps[x][1] is not None), None)
                raw.append(["\n".join(q), j, k, t])
                i = k
            else:
                i += 1
        # 估計開始時間
        for r in raw:
            if r[3] is not None:
                r[3] = max(0.0, r[3] - len(r[0]) * 0.28 - 2)
        # 補沒有時間的
        for idx, r in enumerate(raw):
            if r[3] is None:
                prev = next((raw[x][3] for x in range(idx - 1, -1, -1) if raw[x][3] is not None), 0.0)
                r[3] = prev
        # 法類切換點：卷內第一個提到下一法類名稱的原文
        switch = None
        if target_next is not None:
            key = CAT_NAMES[target_next]
            switch = next((x for x, r in enumerate(raw) if key[:2] in r[0]), None)
            if switch is None:
                switch = len(raw) // 2
        # 合併：短的科判句併到下一段；每段至少 MIN_SEC
        merged = []
        for x, r in enumerate(raw):
            cat = target_next if (switch is not None and x >= switch) else cur_cat
            if merged:
                last = merged[-1]
                last_len = r[3] - last["t0"]
                short_head = len(last["q"]) < 18 and last["p1"] - last["p0"] <= 1
                if last["cat"] == cat and (short_head or last_len < MIN_SEC):
                    last["q"] += "\n" + r[0]
                    last["p1"] = r[2]
                    continue
            merged.append({"q": r[0], "p0": r[1], "p1": r[2], "t0": r[3], "cat": cat})
        if switch is not None:
            cur_cat = target_next
        # 卷首的續講：超過 2.5 分鐘就自成一段（標「續」），太長的會在後面再切；短的照舊接在上一段後面播
        if carry_first:
            if merged and merged[0]["t0"] >= 150:
                pq = units[carry_to]
                units.append([v, pq[1].split(chr(10))[0][:40] + "（續）", 0.0, round(merged[0]["t0"], 1), 0, carry_first, pq[6], 0, 1])
            else:
                units[carry_to][7] = carry_first
        for x, m in enumerate(merged):
            t1 = merged[x + 1]["t0"] if x + 1 < len(merged) else float(dur)
            units.append([v, m["q"], round(m["t0"], 1), round(t1, 1), m["p0"], m["p1"], m["cat"], 0])
        carry_to = len(units) - 1
        if v % 40 == 0:
            print("  卷 %d，累計 %d 段" % (v, len(units)))
    # 太短的段（不到 60 秒）併到同卷同法類的前一段
    tidy = []
    for u in units:
        if tidy and u[3] - u[2] < 60 and tidy[-1][0] == u[0] and tidy[-1][6] == u[6] and not tidy[-1][7]:
            p = tidy[-1]
            p[1] += "\n" + u[1]; p[3] = u[3]; p[5] = u[5]; p[7] = u[7]
        else:
            tidy.append(u)
    units = tidy
    # 太長的段（超過 MAX_SEC）照講解段落的時間再切成幾天，原文標（二）（三）……
    NUM = "一二三四五六七八九十"
    split = []
    for u in units:
        length = u[3] - u[2]
        if length <= MAX_SEC:
            split.append(u)
            continue
        ps = paras_of(data[u[0]])
        timed = [(x, ps[x][1]) for x in range(u[4], u[5]) if ps[x][1] is not None and not ps[x][0]]
        k = int(-(-length // PIECE))
        cuts = []
        for j in range(1, k):
            target = u[2] + length * j / k
            best = min(timed, key=lambda xt: abs(xt[1] - target), default=None)
            if best and best[1] - u[2] > 120 and u[3] - best[1] > 120 and (not cuts or best[0] > cuts[-1][0] and best[1] - cuts[-1][1] > 120):
                cuts.append(best)
        if not cuts:
            split.append(u)
            continue
        bounds = [(u[4], u[2])] + cuts + [(u[5], u[3])]
        for j in range(len(bounds) - 1):
            q = u[1] if j == 0 else "%s（%s）" % (u[1].split("\n")[0][:40], NUM[j] if j < 10 else j + 1)
            split.append([u[0], q, round(bounds[j][1], 1), round(bounds[j + 1][1], 1),
                          bounds[j][0] if j else u[4], bounds[j + 1][0], u[6], u[7] if j == len(bounds) - 2 else 0,
                          1 if j else (u[8] if len(u) > 8 else 0)])
    units = [x if len(x) == 9 else x + [0] for x in split]
    # 每段的主題（從原文自動摘出：科判句優先，其次是引文出處或第一句）
    for x, u in enumerate(units):
        if u[8]:
            base = units[x - 1][9].split("（")[0] if x else topic_of(u[1])
            m = re.search(r"（([一二三四五六七八九十\d]+)）$", u[1])
            u.append("%s（%s）" % (base, m.group(1) if m else "續"))
        else:
            u.append(topic_of(u[1]))
    # 人工（AI 讀講解後）寫的主題與目標：tools/lr_topics.json；有的段落覆蓋自動主題，並加上第 11 欄「目標」
    tp = os.path.join(ROOT, "tools", "lr_topics.json")
    TOP = json.load(open(tp, encoding="utf-8")) if os.path.exists(tp) else {}
    for u in units:
        m = TOP.get("%d.%d" % (u[0], u[4]))
        if m:
            u[9] = m[0]
            u.append(m[1])
    # 法類目錄
    cats = []
    for idx, u in enumerate(units):
        if not cats or cats[-1][0] != CATS[u[6]][0]:
            cats.append([CATS[u[6]][0], CATS[u[6]][1], idx])
    # 把法類索引改成 cats 的索引
    ci = 0
    for idx, u in enumerate(units):
        while ci + 1 < len(cats) and cats[ci + 1][2] <= idx:
            ci += 1
        u[6] = ci
    js = ("/* 燈燈相續・戒：師父南普陀廣論（大慈恩 B000027）每日一段的索引，由 tools/build_lamrim.py 產生。\n"
          "   LR_CATS=[法類,部,第一段索引]；LR=[卷,廣論原文,開始秒,結束秒,講解段落起,講解段落迄,法類索引,續卷講解段落數,是否為同一原文的後續講解,主題,目標（可能沒有）] */\n"
          "window.LR_CATS=" + json.dumps(cats, ensure_ascii=False, separators=(",", ":")) + ";\n"
          "window.LR=" + json.dumps(units, ensure_ascii=False, separators=(",", ":")) + ";\n")
    open(os.path.join(ROOT, "lamrim.js"), "w", encoding="utf-8").write(js)
    secs = [u[3] - u[2] for u in units]
    print("完成：%d 段、%d 個法類；每段中位數 %.0f 秒" % (len(units), len(cats), sorted(secs)[len(secs) // 2]))


if __name__ == "__main__":
    main()
