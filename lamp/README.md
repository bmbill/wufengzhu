# lamp/：一天一盞燈・記一則善行・我的燈海・燈譜

從燈燈悅心（bmbill/dengdeng）搬過來、改成燈燈相續的四學（戒・定・慧・善）。
設計見 `__AI\燈燈相續_改版設計書.md` 第四節。全部是一般 script（不是 ES module），只讀寫 index.html 的全域 `S`、`DAYS`。

自己測：開 `lamp/demo.html`（假資料存在另一個 localStorage key，不影響網站）。

| 檔案 | 掛在 | 做什麼 |
|---|---|---|
| `lamp.js` | `window.DDLamp` | 燈的畫法（20 形制、燈身色、焰色、描金鎏金、紋樣）、四學決定一盞燈、每件功課抽一次只往上、開獎畫面、點開某天看做了什麼 |
| `shan.js` | `window.Shan` | 記一則善行（善行點滴／觀功念恩／誦經／其他，每天最多 3 則），自帶輸入彈層 |
| `sky.js` | `window.DDSky` | 我的燈海（108 盞一片、景會長、可翻片）、燈譜（形制 20 種 × 顏色 5 種） |
| `lamp.css` | | 上面全部的樣式；顏色優先用網站的 `--card`、`--ink`、`--mute`、`--shadow` |

## 一天一盞燈的規則

- 今天做了任何一學的任何一件，燈就亮。
- **燈身色**：哪一學做最多（戒＝朱、定＝藤黃、慧＝石青、善＝石綠；兩學差不多＝赭）。該做的幾學都做到＝泥金（沒開毗缽舍那時是戒定善三學，開了是四學）。
- **焰色**：連續天數剛好走到 7／21／49 的倍數那天變白／青／紫；其他看今天做了幾學、幾件。
- **形制**：今天每多一件就再抽一次，只往上換；做得越滿，難得的機率越高。
- **紋樣**：`S.lampPattern`（`plain`／`lotus`／`cloud`／`key`／`bead`），沒設就依這個人固定一種。燈坊可以賣「換紋樣」。
- 四學各算哪些紀錄（`DDLamp.countsOf`）：
  - 戒：`S.lr.done` 當天的段數＋`DAYS[日].hb`＋`DAYS[日].night`
  - 定：`DAYS[日].sits` 座數＋`min`＋`breath`＋`S.heard` 當天聽完的講
  - 慧：`DAYS[日].vthink`＋`S.vheard` 當天的講＋`S.vquiz` 當天答對的題
  - 善：`DAYS[日].shan` 的則數
- 存的只有 `DAYS[日].lamp = {form, n}`（形制、抽了幾次）和 `S.lampSalt`；顏色每次依紀錄算。

## 接進 index.html

1. **引入**（放在 `hearing.js` 那幾行後面）：
   ```html
   <link rel="stylesheet" href="lamp/lamp.css">
   <script src="lamp/lamp.js"></script>
   <script src="lamp/shan.js"></script>
   <script src="lamp/sky.js"></script>
   ```
   `sw.js` 的 `CORE` 加上這四個檔，`CACHE` 版本加一。

2. **每做完一件功課就點燈**：在所有「完成一件功課」的地方（聽完一段 `openLrAfter` 的 save、上座結束、保底、呼吸警報、睡前反省、聞法勝利、觀察修、聽完一講、小測驗答對）`persist()` 之後加：
   ```js
   DDLamp.reveal(DDLamp.sync());
   ```
   最省事的做法：包一個 `function lit(){ DDLamp.reveal(DDLamp.sync()); }`，在這些地方呼叫。
   `sync()` 會回傳 `changed`：`"new"`（第一次點亮，跳開獎）、`"up"`（換更難得的，跳開獎）、`"same"`（只 toast 一行）。
   注意：開獎會用 `#layer`，如果那時候已經有別的彈層（例如聽完的筆記），請在那個彈層關掉之後再呼叫 `reveal`。

3. **首頁**（`vToday`）：
   - 「今天的燈」：`DDLamp.todayCard()`（放在 hero 裡，取代或搭配原本的 3D 蠟燭）。
   - 三大塊下面加一條善行：`Shan.strip()`。點了會自己開「記一則」彈層，記完會自己 `persist()`、點燈、`render()`。
   - 「今天完成 n／3 塊」可以改成看 `DDLamp.countsOf(today()).kinds`。

4. **燈坊**（新分頁）：
   - 我的燈海：`<div data-ddsky-host>${DDSky.mySea()}</div>`（`data-ddsky-host` 讓「上一片／下一片」可以就地重畫）。換景：`DDSky.mySea({scene:"lake"})`。
   - 燈譜：`DDSky.album()`。
   - 燈和燈譜都可以點，點了自己開「那一天」的小卡（`data-ddl-open`）。

5. **進度頁「善」圓環**：`Shan.stats()` → `{total, days, pages, deed, grat, sutra, other}`。

6. **燈油**：`oil()` 加上 `DDLamp.oilBonus()`（善行每則 +1、每天最多 3；該做的幾學都做到 +3）。`OIL_RULES` 也要加這兩條。

7. **備份**：資料都在 `S`、`DAYS` 裡，原本的下載／上傳備份就包含了，不用另外處理。

## 還沒做的（之後可以加）

- 分享圖卡（燈燈悅心 `src/share.js`：canvas 畫圖，`DDLamp.renderFlat` 和 `DDSky.skySVG` 已經是圖卡用的版本）。
- 同修燈海（第二階段，Supabase）。
- 燈坊賣的「燈海的景」目前只有夜空／湖面／山谷三種；要加更多景，在 `sky.js` 的 `SCENES`、`skyPaint` 加。
