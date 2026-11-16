"""從網站本身匯出戒的聽聞會念的每一句（聞法勝利、南普陀每段的開頭與結尾），存 tools/lr_lines.json，給 make_lr_voice.py 錄音。
用網頁自己的函式產生句子，確保錄的字和網站念的字一樣。需要 playwright（Chrome）。
用法：python tools/export_lr_lines.py"""
import json, os, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = """()=>{const out=[];const H=window.HB||[];
  for(const hb of H){out.push(`聽法之前，我們先聽一段師父講聞法勝利：${hb[2]}。`);const g=goalSay(hb[3]);if(g)out.push(g)}
  const L=LRA(),C=LRC();
  for(let i=0;i<L.length;i++){out.push(`接下來，正式聽師父講${C[L[i][6]][0]}：${lrTopic(i)}。`);const g=goalSay(lrGoal(i));if(g)out.push(g)}
  return [...new Set(out)]}"""
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    pg = b.new_page()
    pg.goto((ROOT / "index.html").as_uri())
    pg.wait_for_timeout(1500)
    lines = pg.evaluate(JS)
    b.close()
json.dump(lines, open(ROOT / "tools" / "lr_lines.json", "w", encoding="utf8"), ensure_ascii=False, indent=0)
print("共 %d 句、%d 字" % (len(lines), sum(len(x) for x in lines)))
