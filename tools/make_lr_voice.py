"""戒的聽聞：每段開頭、結尾的引導語（主題、目標）用 Azure 曉曉錄音，放在 voice-lr/。

句子清單 tools/lr_lines.json 是從網站本身匯出的（聞法勝利 16 段×2、南普陀 2196 段×2），確保錄的字和網站念的字一樣。
檔名＝句子的 FNV-1a 雜湊（8 位十六進位），網站用同一個算法找檔案，不需要對照表；找不到就用手機內建語音。
破音字照 make_voice.py 的讀音表。音質用 16kHz 32kbps 單聲道（省空間）。Azure F0 每分鐘 20 次，約 4 小時；中斷重跑會跳過已錄的。
用法：python tools/make_lr_voice.py
"""
import json, os, sys, time, urllib.error, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_voice as mv  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "voice-lr")


def fnv(s):
    h = 0x811c9dc5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xffffffff
    return "%08x" % h


def synth(text, path):
    c = json.load(open(os.path.join(os.path.expanduser("~"), ".beilan-azure", "speech.json"), encoding="utf-8"))
    ssml = ("<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='zh-CN'>"
            "<voice name='%s'><mstts:express-as style='%s'><prosody rate='%s'>%s</prosody></mstts:express-as></voice></speak>"
            % (mv.VOICE, mv.STYLE, mv.RATE, mv.ssml_body(text)))
    url = "https://%s.tts.speech.microsoft.com/cognitiveservices/v1" % c["region"].strip()
    hdr = {"Ocp-Apim-Subscription-Key": c["key"].strip(), "Content-Type": "application/ssml+xml",
           "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3", "User-Agent": "dengdeng"}
    for tries in range(8):
        try:
            req = urllib.request.Request(url, data=ssml.encode("utf-8"), headers=hdr, method="POST")
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 1500:
                raise RuntimeError("音檔太小")
            tmp = path + ".part"
            open(tmp, "wb").write(data)
            os.replace(tmp, path)
            return
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403):
                raise RuntimeError("HTTP %d %s" % (e.code, e.read()[:200]))
            wait = float(e.headers.get("Retry-After") or 0) or 6 * (tries + 1)
        except Exception as e:
            wait = 5 * (tries + 1)
            print("  重試：", e, flush=True)
        time.sleep(min(wait, 90))
    raise RuntimeError("試了 8 次都失敗")


def main():
    lines = json.load(open(os.path.join(ROOT, "tools", "lr_lines.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)
    names = {}
    for t in lines:
        k = fnv(t)
        if k in names and names[k] != t:
            raise SystemExit("雜湊撞名：%s / %s" % (names[k], t))
        names[k] = t
    todo = [t for t in lines if not os.path.exists(os.path.join(OUT, fnv(t) + ".mp3"))]
    print("共 %d 句，還要錄 %d 句" % (len(lines), len(todo)), flush=True)
    for n, t in enumerate(todo, 1):
        synth(t, os.path.join(OUT, fnv(t) + ".mp3"))
        if n % 50 == 0:
            print("%d/%d" % (n, len(todo)), flush=True)
        time.sleep(3.1)
    keep = {fnv(t) + ".mp3" for t in lines}
    for f in os.listdir(OUT):
        if f.endswith(".mp3") and f not in keep:
            os.remove(os.path.join(OUT, f))
    print("完成", flush=True)


if __name__ == "__main__":
    main()
