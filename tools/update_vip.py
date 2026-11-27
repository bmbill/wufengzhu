"""更新《廣論止觀初探・毗缽舍那》的講次清單（lectures_vip.js）。

老師還在講，所以由 GitHub Actions 每週自動執行一次（.github/workflows/update-vip.yml），
有新的一講就更新檔案並提交。手動執行：python tools/update_vip.py
資料來源：大慈恩譯經基金會 Podcast RSS B000211。
"""
import html, json, os, re, sys, urllib.request

RSS = "https://www.amrtf.org/podcast/rss/B000211.xml"
VOL = "https://cdn.amec.amrtf.org/volume/B000211/%d"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lectures_vip.js")


def clean(s):
    return html.unescape(s.replace("<![CDATA[", "").replace("]]>", "")).strip()


def main():
    req = urllib.request.Request(RSS, headers={"User-Agent": "Mozilla/5.0 (wufengzhu lecture list)"})
    x = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    out = {}
    for it in re.findall(r"<item>(.*?)</item>", x, re.S):
        title = clean(re.search(r"<title>(.*?)</title>", it, re.S).group(1))
        m = re.match(r"(\d{3,4})\s*[　 ]*(.*)", title)
        if not m:
            continue
        n, name = int(m.group(1)), m.group(2).strip()
        enc = re.search(r'<enclosure url="([^"]+)"', it)
        dur = re.search(r"<itunes:duration>(\d+)<", it)
        link = re.search(r"<link>(.*?)</link>", it, re.S)
        if not enc:
            continue
        out[n] = [enc.group(1), int(dur.group(1)) if dur else 0, name, clean(link.group(1)) if link else ""]
    # RSS 給的 taskMedia 網址有些已經失效（45、46 講 403），改用大慈恩網站本身用的 volumeMedia 網址；抓不到才留 RSS 的
    for n in out:
        try:
            v = json.load(urllib.request.urlopen(urllib.request.Request(VOL % n, headers=req.headers), timeout=30))
            a = [m for m in v.get("media", []) if m.get("mediaType") == "audio/mpeg"]
            if a and a[0].get("src"):
                out[n][0] = a[0]["src"]
        except Exception as e:
            print("第 %d 講讀不到 volume，保留 RSS 網址：%s" % (n, e))
    if len(out) < 10:
        sys.exit("清單太少（%d 講），可能抓取失敗，不更新" % len(out))
    data = {str(k): out[k] for k in sorted(out)}
    js = ("/* 真如老師《廣論止觀初探・毗缽舍那》各講（大慈恩譯經基金會 Podcast RSS B000211；tools/update_vip.py 自動更新）："
          "講次: [mp3, 秒數, 標題, 全文網址] */\nwindow.VIP_AUDIO=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    if old == js:
        print("沒有新講次（%d 講）" % len(data))
        return
    open(OUT, "w", encoding="utf-8").write(js)
    print("已更新：%d 講，最新第 %d 講" % (len(data), max(out)))


if __name__ == "__main__":
    main()
