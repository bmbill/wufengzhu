# 廣海明月學習單（網頁／PWA）

網址（發布後）：https://bmbill.github.io/wufengzhu/guanghai/
本機預覽：`__AI\.claude\launch.json` 的 `wfz`，開 http://localhost:8779/guanghai/

每一講一份學習單，照六步走：聽前準備 → 先聽師父 → 再聽老師 → 共學 → 一週練習 → 四層核對。
每完成一步，月亮亮一分；六步做完就是月圓。寫的內容只存在使用者自己的裝置（localStorage `gh-v1`），可以匯出、匯入備份，也可以印出來寫。

## 新增一講

1. 照 572 講的範本寫學習單 md，放在 `__AI\廣海明月學習單\第NNN講_學習單.md`。
   - 開頭的表格要有：廣論段落（偈頌用「」括起來）、科判位置、所屬單元、原音與逐字稿（網址）、共學場次。
   - 六節標題用「## 一、…」到「## 六、…」；第二、三步的參考答案寫在「## 附錄」，用「**二、…**」「**三、…**」分段。
   - 第四節的比較放在「### …」小節底下，網頁上會藏在「寫完再看」裡。
   - 第五節要有「**觸發點**：①…②…③…」、「**遇到時做四步**」（1.～4. 每條以 **粗體標籤**： 開頭）、「**提醒**：…」。
2. 在 `無風燭` 資料夾執行：`python tools/build_guanghai.py`
   → 產生 `guanghai/lessons/NNNN.json`，並更新 `guanghai/lessons/index.json`（目錄依「所屬單元」分組）。
3. 把 `guanghai/sw.js` 的 `CACHE` 版本號加一（例如 gh-v2 → gh-v3），手機上的離線快取才會更新。
4. commit、push 後，GitHub Pages 就會更新。

## 檔案

- `index.html`、`style.css`、`app.js`：網頁本體（不需要建置）。
- `sw.js`、`manifest.webmanifest`、`icon-*.png`：PWA，離線可用，可安裝到手機主畫面。
- `lessons/`：每講的資料（由 md 轉出，不要手改）。
