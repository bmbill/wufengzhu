"""產生無風燭的語音引導 mp3（Azure 曉曉・溫柔語氣，破音字用 SSML phoneme 指定讀音）。

用法：python tools/make_voice.py lines.json
  lines.json＝在網頁主控台執行 allVoiceLines() 得到的陣列。
金鑰讀 %USERPROFILE%\.beilan-azure\speech.json（{"key": "...", "region": "eastasia"}），不會寫進這個 repo。
破音字表沿用備覽小教室 build.py 的 READ，再加上本 App 自己的詞（APP_READ）。
已經產生過的句子（同樣文字＋同樣讀音）不會重做。
"""
import ast, hashlib, json, os, re, sys, time, urllib.request, urllib.error
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "voice")
VOICE, STYLE, RATE = "zh-CN-XiaoxiaoNeural", "gentle", "-8%"
BUILD = r"C:\Users\User\Dropbox\廣論內容\_備覽\AI研討紀錄\.claude\skills\beilan-donghua\scripts\build.py"

def load_read():
    try:
        tree = ast.parse(open(BUILD, encoding="utf-8").read())
        for node in tree.body:
            if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "READ" for t in node.targets):
                return {k: v[0] for k, v in ast.literal_eval(node.value).items()}
    except Exception as e:
        print("讀不到備覽的破音字表，只用本 App 的：", e)
    return {}

APP_READ = {
    "調身": "調tiao2", "調息": "調tiao2", "調回來": "調tiao2",
    "數呼吸": "數shu3", "數十次": "數shu3", "數完": "數shu3", "數到": "數shu3", "數亂": "數shu3",
    "默數": "數shu3", "先數": "數shu3", "數數字": "數shu3數shu4",
    "重來": "重chong2", "重聽": "重chong2", "散盤": "散san3", "散了": "散san4", "散亂": "散san4",
    "坐著": "著zhe5", "看著": "著zhe5", "帶著": "著zhe5",
    "為利": "為wei4", "為明天": "為wei4", "更長": "長chang2", "入行論": "行xing2", "苦行": "行xing2", "惡行": "行xing2",
    "覺知": "覺jue2", "感覺": "覺jue2", "正知": "正zheng4", "還是": "還hai2", "還在": "還hai2", "還會": "還hai2",
    "止住修": "住zhu4", "要破的": "要yao4",
    "了脫": "了liao3", "為了": "為wei4", "還清楚": "還hai2",
}
PRON = load_read(); PRON.update(APP_READ)

def ssml_body(text):
    words = sorted((w for w in PRON if w in text), key=len, reverse=True)
    out, i = [], 0
    while i < len(text):
        w = next((w for w in words if text.startswith(w, i)), None)
        if not w:
            out.append(escape(text[i])); i += 1; continue
        marks = re.findall(r"(\D)([a-z]+\d)", PRON[w])
        k = 0
        for ch in w:
            if k < len(marks) and marks[k][0] == ch:
                py = marks[k][1]; k += 1
                out.append("<phoneme alphabet='sapi' ph='%s %s'>%s</phoneme>" % (py[:-1], py[-1], escape(ch)))
            else:
                out.append(escape(ch))
        i += len(w)
    return "".join(out)

def azure(text, path):
    c = json.load(open(os.path.join(os.path.expanduser("~"), ".beilan-azure", "speech.json"), encoding="utf-8"))
    ssml = ("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>"
            "<voice name='%s'><mstts:express-as style='%s'><prosody rate='%s'>%s</prosody></mstts:express-as></voice></speak>"
            % (VOICE, STYLE, RATE, ssml_body(text)))
    url = "https://%s.tts.speech.microsoft.com/cognitiveservices/v1" % c["region"].strip()
    hdr = {"Ocp-Apim-Subscription-Key": c["key"].strip(), "Content-Type": "application/ssml+xml",
           "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "wufengzhu"}
    for tries in range(6):
        try:
            req = urllib.request.Request(url, data=ssml.encode("utf-8"), headers=hdr, method="POST")
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 2000: raise RuntimeError("音檔太小")
            open(path, "wb").write(data); return
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403): raise RuntimeError("HTTP %d %s" % (e.code, e.read()[:200]))
            wait = float(e.headers.get("Retry-After") or 0) or 5 * (tries + 1)
        except Exception as e:
            wait = 4 * (tries + 1); print("  重試：", e)
        time.sleep(min(wait, 60))
    raise RuntimeError("試了 6 次都失敗")

def silence():
    p = os.path.join(OUT, "silence.mp3")
    if os.path.exists(p): return
    import imageio_ffmpeg, subprocess
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", "0.3", "-b:a", "32k", p],
                   check=True, capture_output=True)

def main():
    lines = json.load(open(sys.argv[1], encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True); silence()
    vmap = {}
    for n, text in enumerate(lines, 1):
        key = hashlib.sha1((VOICE + STYLE + RATE + ssml_body(text)).encode("utf-8")).hexdigest()[:12]
        fn = key + ".mp3"; path = os.path.join(OUT, fn)
        if not os.path.exists(path):
            print("[%d/%d] %s" % (n, len(lines), text[:24])); azure(text, path); time.sleep(3.2)   # F0：每分鐘 20 次
        vmap[text] = fn
    used = set(vmap.values()) | {"silence.mp3", "map.js"}
    for f in os.listdir(OUT):
        if f not in used: os.remove(os.path.join(OUT, f))
    js = "window.VOICE_INFO=" + json.dumps({"name": "曉曉・溫柔", "voice": VOICE}, ensure_ascii=False) + ";\n"
    js += "window.VOICE_MAP=" + json.dumps(vmap, ensure_ascii=False, indent=0) + ";\n"
    open(os.path.join(OUT, "map.js"), "w", encoding="utf-8").write(js)
    print("完成：%d 句" % len(vmap))
    # 列出破音字標記，方便檢查
    for text in lines:
        b = ssml_body(text)
        if "phoneme" in b:
            print("  ", re.sub(r"<phoneme alphabet='sapi' ph='([a-z]+) (\d)'>(.)</phoneme>", r"\3[\1\2]", b))

if __name__ == "__main__":
    main()
