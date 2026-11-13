/* 分享卡：把法語卡、今天的燈畫成一張圖，可以傳到 LINE 或存到相簿。
   一鍵加到主畫面：Android／電腦 Chrome 直接跳安裝；iPhone 照步驟；LINE 等 App 內的瀏覽器先換到外部瀏覽器。 */
(function () {
  "use strict";
  const SITE = "bmbill.github.io/wufengzhu";
  const FD = '"LXGW WenKai TC","Noto Serif TC","PingFang TC",serif';
  const FB = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const FN = '"Outfit","Noto Sans TC",sans-serif';
  const WD = ["日", "一", "二", "三", "四", "五", "六"];

  function img(src) {
    return new Promise((res) => {
      if (!src) return res(null);
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => res(null);
      i.src = src;
    });
  }
  const svgImg = (svg) => img("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.includes("xmlns=") ? svg : svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"')));
  async function fonts(text) {
    try {
      await Promise.all([
        document.fonts.load("700 60px " + FD, text), document.fonts.load("400 60px " + FD, text),
        document.fonts.load("500 30px " + FB, text), document.fonts.load("500 30px " + FN, "0123456789.No"),
      ]);
    } catch (e) {}
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function cover(c, im, W, H) {
    const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
    c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  function center(c, t, x, y, font, color) { c.font = font; c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "alphabetic"; c.fillText(t, x, y); }

  /* 直書：標點放右上，引號換直式 */
  const VMAP = { "「": "﹁", "」": "﹂", "『": "﹃", "』": "﹄", "（": "︵", "）": "︶", "─": "︱", "—": "︱", "…": "︙", "～": "︴" };
  const PUNC = /[，。、；：！？]/;
  function vText(c, text, box, color) {
    const chars = [...text.replace(/\s+/g, "")].map((ch) => VMAP[ch] || ch);
    let fs = 0, cap = 0, cols = 0;
    for (fs = 104; fs >= 44; fs -= 4) {
      cap = Math.floor(box.h / (fs * 1.18));
      cols = Math.ceil(chars.length / cap);
      if (cols * fs * 1.62 <= box.w) break;
    }
    /* 每行字數平均，避免最後一行只剩一兩個字 */
    cap = Math.ceil(chars.length / cols);
    const colW = fs * 1.62, total = cols * colW;
    const x0 = box.x + (box.w + total) / 2 - colW / 2;   // 第一行（最右）中心
    const colH = cap * fs * 1.18;
    const y0 = box.y + (box.h - colH) / 2;
    c.font = "700 " + fs + "px " + FD; c.fillStyle = color; c.textAlign = "center"; c.textBaseline = "middle";
    chars.forEach((ch, i) => {
      const col = Math.floor(i / cap), row = i % cap;
      const x = x0 - col * colW, y = y0 + row * fs * 1.18 + fs * 0.59;
      if (PUNC.test(ch)) c.fillText(ch, x + fs * 0.32, y - fs * 0.3);
      else c.fillText(ch, x, y);
    });
    return { left: x0 - (cols - 1) * colW - colW / 2, bottom: y0 + colH, fs };
  }

  /* ---------- 法語卡 ---------- */
  const PART_INK = ["#5a2f22", "#fff6e0", "#1f4a44", "#5a3312"];
  const PART_PAPER = ["rgba(255,250,240,.80)", "rgba(30,26,70,.55)", "rgba(250,255,253,.78)", "rgba(255,250,236,.80)"];
  async function quoteCanvas(k) {
    const Q = QS(), q = Q[k];
    const pi = qPart(q), who = tileWho(q[3] || "jie"), mood = qPose(q, k, who);
    const W = 1080, H = 1512, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const src = qSource(q), cat = qCat(q);
    await fonts(q[0] + src + cat + "燈燈相續法語" + SITE);
    const [bg, ch] = await Promise.all([img("cards/p" + pi + ".webp"), img(charSrc(who, mood, curTheme()))]);
    if (bg) cover(c, bg, W, H);
    else { const tmp = await svgImg(CARD_ART[pi]); if (tmp) cover(c, tmp, W, H); else { c.fillStyle = "#f6e6d0"; c.fillRect(0, 0, W, H); } }
    const ink = PART_INK[pi];
    // 紙
    rr(c, 64, 64, W - 128, H - 128, 36); c.fillStyle = PART_PAPER[pi]; c.fill();
    c.lineWidth = 5; c.strokeStyle = "#c9a24a"; c.stroke();
    rr(c, 84, 84, W - 168, H - 168, 26); c.lineWidth = 1.6; c.strokeStyle = "rgba(201,162,74,.8)"; c.stroke();
    // 四角
    c.strokeStyle = "#c9a24a"; c.lineWidth = 3;
    [[104, 104, 1, 1], [W - 104, 104, -1, 1], [104, H - 104, 1, -1], [W - 104, H - 104, -1, -1]].forEach(([x, y, sx, sy]) => {
      c.beginPath(); c.moveTo(x, y + sy * 46); c.lineTo(x, y + sy * 10); c.quadraticCurveTo(x, y, x + sx * 10, y); c.lineTo(x + sx * 46, y); c.stroke();
      c.beginPath(); c.arc(x + sx * 6, y + sy * 6, 4, 0, 7); c.fillStyle = "#c9a24a"; c.fill();
    });
    // 頂端
    c.textBaseline = "alphabetic";
    c.font = "500 30px " + FN; c.fillStyle = ink; c.globalAlpha = .75; c.textAlign = "left"; c.fillText("No." + String(k + 1).padStart(3, "0"), 140, 170);
    c.font = "500 30px " + FB; c.textAlign = "right"; c.fillText(cat, W - 140, 170); c.globalAlpha = 1;
    // 法語（直書）
    const r = vText(c, q[0], { x: 150, y: 220, w: W - 300, h: 740 }, ink);
    // 印章
    const sx = Math.max(130, r.left - 100), sy = Math.min(r.bottom - 84, 860);
    c.save(); c.translate(sx + 42, sy + 42); c.rotate(-0.06);
    rr(c, -40, -40, 80, 80, 10); c.fillStyle = "#c8432f"; c.fill();
    c.font = "700 30px " + FD; c.fillStyle = "#fff4e6"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("法", 0, -15); c.fillText("語", 0, 19); c.restore();
    // 角色
    if (ch) { const s = 300 / Math.max(ch.width, ch.height); c.drawImage(ch, 110, 1090 - ch.height * s + 150, ch.width * s, ch.height * s); }
    // 出處、網站
    c.fillStyle = ink; c.globalAlpha = .85; c.font = "500 32px " + FB; c.textAlign = "right"; c.textBaseline = "alphabetic";
    c.fillText(src, W - 140, 1300);
    c.globalAlpha = .7; c.font = "700 34px " + FD; c.fillText("燈燈相續", W - 140, 1372);
    c.font = "400 24px " + FN; c.fillText(SITE, W - 140, 1408); c.globalAlpha = 1;
    return cv;
  }

  /* ---------- 今天的燈 ---------- */
  async function lampCanvas(date) {
    date = date || today();
    const L = window.DDLamp; const l = L && L.lampOf(date); const cnt = L ? L.countsOf(date) : {};
    const W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d");
    const dt = new Date(date + "T00:00:00");
    const line1 = date.replace(/-/g, ".") + "・星期" + WD[dt.getDay()];
    const streak = L ? L.streakAt(date) : 0;
    const name = l ? l.name : "今天的燈";
    const verse = "譬如一燈燃百千燈，冥者皆明，明終不盡。";
    await fonts(line1 + name + verse + "今天點了一盞燈戒定慧善連續天燈燈相續" + (l ? L.TIER_LABEL[l.tier] : "") + SITE);
    // 背景
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#2b2557"); g.addColorStop(.55, "#5b4a9a"); g.addColorStop(1, "#f3b48f");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    let seed = 0; for (const ch of date) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 70; i++) { c.globalAlpha = .25 + rnd() * .6; c.fillStyle = "#fff"; c.beginPath(); c.arc(rnd() * W, rnd() * H * .6, 1 + rnd() * 2.6, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    const glow = c.createRadialGradient(W / 2, 640, 20, W / 2, 640, 420); glow.addColorStop(0, "rgba(255,214,120,.55)"); glow.addColorStop(1, "rgba(255,214,120,0)");
    c.fillStyle = glow; c.fillRect(0, 200, W, 900);
    // 字
    center(c, line1, W / 2, 150, "500 34px " + FN, "rgba(255,255,255,.75)");
    center(c, l ? "今天點了一盞燈" : "今天也點一盞燈", W / 2, 236, "700 72px " + FD, "#fff");
    // 燈
    if (L) {
      const svg = L.renderFlat(l || L.GREY, { size: 520, lit: !!l });
      const im = await svgImg(svg);
      if (im) { const s = 520 / Math.max(im.width, im.height); c.drawImage(im, W / 2 - im.width * s / 2, 330, im.width * s, im.height * s); }
    }
    center(c, name, W / 2, 940, "700 60px " + FD, "#fff4d6");
    if (l) center(c, L.TIER_LABEL[l.tier], W / 2, 990, "500 30px " + FB, "rgba(255,255,255,.75)");
    // 四學
    const ks = ["jie", "ding", "hui", "shan"].filter((k) => cnt[k]);
    const cw = 150, x0 = W / 2 - (ks.length * cw + (ks.length - 1) * 20) / 2;
    ks.forEach((k, i) => {
      const x = x0 + i * (cw + 20);
      rr(c, x, 1030, cw, 70, 35); c.fillStyle = "rgba(255,255,255,.92)"; c.fill();
      c.beginPath(); c.arc(x + 38, 1065, 24, 0, 7); c.fillStyle = XUE[k][1]; c.fill();
      center(c, XUE[k][0], x + 38, 1076, "700 28px " + FD, "#fff");
      center(c, String(cnt[k]), x + 102, 1077, "700 34px " + FN, "#2b2350");
    });
    if (streak > 1) center(c, "連續 " + streak + " 天", W / 2, 1158, "700 36px " + FB, "#fff");
    center(c, verse, W / 2, 1224, "400 32px " + FD, "rgba(43,35,80,.85)");
    center(c, "燈燈相續 ・ " + SITE, W / 2, 1290, "500 26px " + FB, "rgba(43,35,80,.7)");
    return cv;
  }

  /* ---------- 預覽＋分享 ---------- */
  function blobOf(cv) { return new Promise((res) => cv.toBlob(res, "image/png")); }
  async function preview(make, fname, text) {
    const Ly = document.getElementById("layer");
    Ly.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-h"><div class="panel share-panel"><span class="eyebrow">分享卡</span><h2 id="sh-h" class="sr">分享卡</h2><div class="share-prev"><p class="mini-note">畫圖中…</p></div><div class="btns" id="shBtns"></div></div></div>`;
    let blob;
    try { blob = await blobOf(await make()); if (!blob) throw new Error("沒有圖"); } catch (e) { console.error(e); Ly.innerHTML = ""; toast("分享卡畫不出來，再試一次"); return; }
    const url = URL.createObjectURL(blob);
    const file = new File([blob], fname, { type: "image/png" });
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    Ly.querySelector(".share-prev").innerHTML = `<img src="${url}" alt="分享卡預覽">`;
    const B = Ly.querySelector("#shBtns");
    B.innerHTML = `${canShare ? `<button class="btn primary" id="shGo">分享（LINE、相簿…）</button>` : ""}<button class="btn ${canShare ? "" : "primary"}" id="shSave">儲存圖片</button><button class="btn ghost" id="shX">關閉</button>`
      + `<p class="mini-note" style="width:100%">${canShare ? "" : "也可以長按上面的圖片，選「儲存」或「分享」。"}</p>`;
    const go = document.getElementById("shGo");
    if (go) go.onclick = async () => { try { await navigator.share({ files: [file], title: "燈燈相續", text }); } catch (e) { if (e && e.name !== "AbortError") toast("沒有分享出去"); } };
    document.getElementById("shSave").onclick = () => { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); };
    document.getElementById("shX").onclick = () => { Ly.innerHTML = ""; URL.revokeObjectURL(url); };
  }
  window.shareQuote = (k) => preview(() => quoteCanvas(k), "燈燈相續-法語卡-" + String(k + 1).padStart(3, "0") + ".png", "師父的法語・燈燈相續 https://" + SITE + "/");
  window.shareLamp = (date) => preview(() => lampCanvas(date), "燈燈相續-" + (date || today()) + ".png", "今天也點了一盞燈・燈燈相續 https://" + SITE + "/");

  /* ---------- 一鍵加到主畫面 ---------- */
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const inLine = /\bLine\//i.test(ua);
  const inApp = inLine || /FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK/i.test(ua);
  const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua) && !inApp;
  window.isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  window.addEventListener("appinstalled", () => { window.__bip = null; try { toast("加好了！之後從主畫面的燈燈相續打開"); render(); } catch (e) {} });
  const SHARE_IC = `<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="#2f7cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="#2f7cf6" stroke-width="2" stroke-linecap="round"/></svg>`;
  const ADD_IC = `<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:-4px"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="#333" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="#333" stroke-width="2" stroke-linecap="round"/></svg>`;
  function guide(html) {
    const Ly = document.getElementById("layer");
    Ly.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="ins-h"><div class="panel"><span class="eyebrow">加到主畫面</span><h2 id="ins-h">像 App 一樣打開</h2>${html}<div class="btns"><button class="btn ghost" id="insX">知道了</button></div></div></div>`;
    document.getElementById("insX").onclick = () => { Ly.innerHTML = ""; };
    const cp = document.getElementById("insCopy");
    if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText("https://" + SITE + "/"); toast("網址複製好了"); } catch (e) { prompt("複製這個網址", "https://" + SITE + "/"); } };
  }
  window.installApp = async () => {
    if (window.__bip) {
      const e = window.__bip; window.__bip = null;
      try { e.prompt(); const r = await e.userChoice; if (r && r.outcome === "accepted") return; } catch (x) {}
      return;
    }
    const ext = location.origin + location.pathname + "?openExternalBrowser=1";
    if (inLine) return guide(`<p>現在是在 LINE 裡面開的，要先換到${isIOS ? " Safari" : "瀏覽器"}才能加到主畫面。</p><div class="btns"><a class="btn primary" href="${ext}">用${isIOS ? " Safari" : "瀏覽器"}打開</a></div><p class="mini-note">打開之後，再按一次「加到主畫面」。進度是跟著瀏覽器存的：LINE 裡的進度不會自動搬過去，需要的話先在「設定 → 資料」下載備份，再到新的地方還原。</p>`);
    if (inApp) return guide(`<p>現在是在 App 裡面開的。請按右上角「⋯」，選「用${isIOS ? " Safari" : "瀏覽器"}開啟」，或複製網址貼到${isIOS ? " Safari" : " Chrome"}。</p><div class="btns"><button class="btn primary" id="insCopy">複製網址</button></div>`);
    if (isIOS && !isSafari) return guide(`<ol class="ins-steps"><li>按網址列旁邊的 ${SHARE_IC}「分享」</li><li>往下找 ${ADD_IC}「加入主畫面」</li><li>按右上角「新增」</li></ol><p class="mini-note">如果找不到「加入主畫面」，請改用 Safari 開啟這個網站。</p><div class="btns"><button class="btn" id="insCopy">複製網址</button></div>`);
    if (isIOS) return guide(`<ol class="ins-steps"><li>按畫面下方（或上方）的 ${SHARE_IC}「分享」</li><li>往下滑，選 ${ADD_IC}「加入主畫面」</li><li>按右上角「新增」</li></ol><p class="mini-note">iPhone 不允許網站自己安裝，只能照這三步。加好之後從主畫面打開，進度比較不會被系統清掉。</p>`);
    if (/Android/.test(ua)) return guide(`<ol class="ins-steps"><li>按 Chrome 右上角「⋮」</li><li>選「加到主畫面」或「安裝應用程式」</li><li>按「安裝」</li></ol>`);
    return guide(`<p>用 Chrome 或 Edge 開啟時，網址列右邊會有一個安裝圖示 ⊕，按下去就好；或從選單選「安裝燈燈相續」。</p>`);
  };
  window.installCard = () => {
    if (!S.onboarded || isInstalled()) return "";
    if (S.installHide && daysBetween(S.installHide, today()) < 14) return "";
    return `<div class="card install-card"><div><h3>加到主畫面</h3><p class="meta">像 App 一樣一點就開，進度也比較不會被系統清掉。</p></div><div class="btns"><button class="btn small primary" data-act="install">${window.__bip ? "一鍵加到主畫面" : "加到主畫面"}</button><button class="btn small ghost" data-act="install-later">之後再說</button></div></div>`;
  };
})();
