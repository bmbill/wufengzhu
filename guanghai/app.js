/* 廣海明月學習單：目錄（#/）與每一講（#/572）。寫的東西都存在這台裝置（localStorage），可以匯出備份。 */
(() => {
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const KEY = "gh-v1";
const PHASES = ["聽前", "師父", "老師", "共學", "練習", "核對"];
const CN = "一二三四五六七八九十";

/* ---------- storage ---------- */
let DB = { lessons: {}, last: null };
try { DB = Object.assign(DB, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
let saveT = 0;
function save(now) {
  clearTimeout(saveT);
  const w = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("這台裝置不能儲存，請記得匯出備份"); } };
  now ? w() : (saveT = setTimeout(w, 300));
}
const L = id => (DB.lessons[id] = DB.lessons[id] || { a: {}, done: {}, log: [], lvl: {} });

/* ---------- helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(\d{1,2}:\d{2}(?:\]–\[\d{1,2}:\d{2})?)\]/g, '<span class="tc">$1</span>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s（(])(https?:\/\/[^\s）)<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">開啟連結</a>');
}
function md(text) {
  const lines = String(text || "").split("\n"); let h = "", i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim() || /^-{3,}$/.test(l.trim())) { i++; continue; }
    if (l.trim().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const r = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (!r.every(c => /^:?-{3,}:?$/.test(c))) rows.push(r); i++;
      }
      h += '<div class="tbl"><table><thead><tr>' + rows[0].map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
        rows.slice(1).map(r => "<tr>" + r.map((c, ci) => `<td data-l="${esc(rows[0][ci] || "")}">${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>";
      continue;
    }
    if (/^\s*\d+[.、]\s/.test(l)) {
      h += "<ol>"; while (i < lines.length && /^\s*\d+[.、]\s/.test(lines[i])) { h += "<li>" + inline(lines[i].replace(/^\s*\d+[.、]\s+/, "")) + "</li>"; i++; } h += "</ol>"; continue;
    }
    if (/^\s*[-*]\s/.test(l)) {
      h += "<ul>"; while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) { h += "<li>" + inline(lines[i].replace(/^\s*[-*]\s+/, "")) + "</li>"; i++; } h += "</ul>"; continue;
    }
    h += "<p>" + inline(l.trim().replace(/^#+\s*/, "")) + "</p>"; i++;
  }
  return h;
}
/* moon icon: p = 0..1 lit fraction (waxing, lit on the right) */
function moon(p, cls = "") {
  const r = 20, c = 24, rx = Math.abs(1 - 2 * p) * r;
  let lit = "";
  if (p >= 0.999) lit = `<circle cx="${c}" cy="${c}" r="${r}" fill="#f8efd4"/>`;
  else if (p > 0.001) lit = `<path d="M${c} ${c - r}A${r} ${r} 0 0 1 ${c} ${c + r}A${rx} ${r} 0 0 ${p < .5 ? 0 : 1} ${c} ${c - r}Z" fill="#f8efd4"/>`;
  return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="${c}" cy="${c}" r="${r}" fill="#22355f"/><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(248,239,212,.35)" stroke-width="1"/>${lit}</svg>`;
}
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  go: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  ear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 0 1 4 0"/></svg>',
};
function waves() {
  const path = y => { let d = `M0 ${y}`; for (let x = 0; x <= 1600; x += 100) d += ` Q${x + 50} ${y - 7} ${x + 100} ${y} T${x + 200} ${y}`; return d; };
  return `<svg class="waves" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true">
    <path class="w1" d="${path(20)}"/><path class="w2" d="${path(34)}"/><path class="w3" d="${path(46)}"/>
    <path class="shore" d="M0 58 Q200 50 400 58 T800 58 V70 H0Z"/></svg>`;
}
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2200); }
const progress = (id, n = 6) => { const d = (DB.lessons[id] || {}).done || {}; return Math.min(1, Object.values(d).filter(Boolean).length / n); };
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

/* ---------- data ---------- */
let INDEX = null; const CACHE = {};
async function getJSON(u) { const r = await fetch(u, { cache: "no-cache" }); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }
async function index() { return INDEX || (INDEX = (await getJSON("lessons/index.json")).lessons); }
async function lesson(id) { return CACHE[id] || (CACHE[id] = await getJSON(`lessons/${id}.json`)); }

/* ---------- routes ---------- */
async function route() {
  const m = location.hash.match(/^#\/(\d{1,4})/);
  window.scrollTo(0, 0);
  try {
    if (m) await renderLesson(String(+m[1]).padStart(4, "0"));
    else await renderHome();
  } catch (e) {
    app.innerHTML = `<section class="sea"><div class="wrap"><div class="topbar"><a class="brand" href="#/">廣海明月學習單</a></div>
      <p style="padding:30px 0">這一講還沒有學習單，或是網路沒有連上。</p></div>${waves()}</section>
      <div class="wrap paper"><a class="btn" style="display:inline-grid;place-items:center;text-decoration:none" href="#/">回目錄</a></div>`;
  }
}

async function renderHome() {
  document.title = "廣海明月學習單";
  const list = await index();
  const overall = list.length ? list.reduce((s, x) => s + progress(x.id), 0) / list.length : 0;
  const last = DB.last && list.find(x => x.id === DB.last);
  const units = [];
  for (const x of list) { const u = x.unit || "其他"; let g = units.find(g => g.u === u); if (!g) units.push(g = { u, items: [] }); g.items.push(x); }
  app.innerHTML = `
  <section class="sea"><div class="stars"></div><div class="moonlight"></div><div class="wrap">
    <div class="topbar"><a class="brand" href="../">燈燈相續</a><span class="sp"></span>
      <button class="iconbtn" id="install" hidden>安裝到手機</button></div>
    <div class="hero">
      <div><h1><small>真如老師 · 廣海明月</small>廣海明月<br>學習單</h1>
        <p>每一講一份，照著做：聽前準備、先聽師父、再聽老師、共學、一週練習、四層核對。每完成一步，月亮就亮一分；做完一講，月就圓了。</p></div>
      ${moon(overall, "moon-big")}
    </div></div>${waves()}</section>
  <div class="wrap paper">
    ${last ? `<a class="card continue" href="#/${last.no}">${moon(progress(last.id))}
      <div><div class="k">接著學</div><h3>第 ${last.no} 講・${esc(last.title)}</h3></div><span class="go">${ICON.go}</span></a>` : ""}
    ${units.map(g => `<div class="unit"><div class="unit-h">${esc(g.u)}</div>
      ${g.items.map(x => `<a class="lrow" href="#/${x.no}"><span class="no">${x.no}</span>
        <div><h3>${esc(x.title)}</h3><p>${esc(x.verse || x.kepan)}</p></div>${moon(progress(x.id))}</a>`).join("")}</div>`).join("")}
    <div class="howto">
      ${PHASES.map((p, i) => `<div>${moon((i + 1) / 6)}<b>${p}</b><span>${["寫下想處理的煩惱，接上一講", "只聽師父原音，先自己答", "聽老師講解，看他停在哪裡", "每場共學帶一個問題去聽", "三種小事當觸發點，每天記一筆", "說得出、認得出、轉得動、生得起"][i]}</span></div>`).join("")}
    </div>
    ${footer()}
  </div>`;
  wireFooter(); wireInstall();
}

function footer() {
  return `<footer><button class="btn ghost" data-act="export">匯出備份</button><button class="btn ghost" data-act="import">匯入備份</button>
    <span style="flex:1"></span><span>寫的內容只存在這台裝置</span></footer>`;
}
function wireFooter() {
  app.querySelectorAll("[data-act]").forEach(b => b.onclick = () => {
    if (b.dataset.act === "export") {
      const u = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: u, download: `廣海明月學習單備份-${today()}.json` }); a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
    } else {
      const f = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json" });
      f.onchange = async () => {
        try {
          const d = JSON.parse(await f.files[0].text()); if (!d || typeof d.lessons !== "object") throw 0;
          for (const [k, v] of Object.entries(d.lessons)) DB.lessons[k] = Object.assign(L(k), v);
          save(true); toast("已匯入"); route();
        } catch (e) { toast("這個檔案不是學習單備份"); }
      };
      f.click();
    }
  });
}
function wireInstall() {
  const b = $("#install"); if (!b) return;
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (window.__bip || ios) b.hidden = false;
  b.onclick = async () => {
    if (window.__bip) { window.__bip.prompt(); await window.__bip.userChoice; window.__bip = null; b.hidden = true; }
    else toast("iPhone：點下方分享鈕，選「加入主畫面」");
  };
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); window.__bip = e; const b = $("#install"); if (b) b.hidden = false; });

/* ---------- lesson ---------- */
async function renderLesson(id) {
  const X = await lesson(id), S = L(id);
  DB.last = id; save();
  document.title = `第 ${X.no} 講・${X.title}｜廣海明月學習單`;
  const meta = Object.entries(X.meta || {}).filter(([k]) => !/原音/.test(k));
  const done = k => !!S.done[k];
  app.innerHTML = `
  <div class="mini" id="mini"><div class="wrap"><a class="iconbtn" href="#/" aria-label="回目錄">${ICON.back}</a>
    <nav class="ph-tabs mini-tabs" aria-label="三段">${phaseTabs(X, S)}</nav><span id="miniMoon">${moon(progress(id))}</span></div></div>
  <section class="sea"><div class="stars"></div><div class="wrap">
    <div class="topbar"><a class="iconbtn" href="#/" aria-label="回目錄">${ICON.back}</a><a class="brand" href="#/">廣海明月學習單</a></div>
    <div class="lhero">
      <div class="lno"><span>第</span>${X.no}<span>講</span></div>
      <h1>${esc(X.title)}</h1>
      ${X.verse ? `<div class="verse">${esc(X.verse)}</div>` : ""}
      <div class="lactions">
        <a class="pill solid" href="${esc(X.audio)}" target="_blank" rel="noopener">${ICON.play}原音與逐字稿</a>
        <button class="pill" id="print">${ICON.print}印出來寫</button>
      </div>
      <nav class="rail" aria-label="六個步驟">${X.steps.map((s, i) => `<button data-go="${s.key}" class="${done(s.key) ? "done" : ""}">${moon((i + 1) / 6)}<b>${PHASES[i] || s.title}</b></button>`).join("")}</nav>
    </div></div>${waves()}</section>
  <div class="wrap paper">
    <nav class="ph-tabs ph-main" aria-label="三段">${phaseTabs(X, S)}</nav>
    ${PH.map((g, pi) => `<div class="phase" data-ph="${pi}"${pi === curPh(S) ? "" : " hidden"}>
      <p class="ph-sub">${esc(g.sub)}</p>
      ${pi === 0 && X.intro ? `<details class="meta"><summary>這張學習單怎麼用</summary><div class="intro md">${md(X.intro)}</div></details>` : ""}
      ${pi === 0 && meta.length ? `<details class="meta"><summary>這一講在廣論的哪裡</summary><dl class="metagrid">
        ${meta.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="md">${inline(v)}</dd></div>`).join("")}</dl></details>` : ""}
      ${g.steps.filter(i => X.steps[i]).map(i => stepHTML(X, S, X.steps[i], i)).join("")}
      ${pi < PH.length - 1 ? `<button type="button" class="ph-next" data-toph="${pi + 1}">下一段：${esc(PH[pi + 1].name)}<span>${esc(PH[pi + 1].sub)}</span>${ICON.go}</button>` : `<div id="full"></div>`}
    </div>`).join("")}
    ${footer()}
  </div>`;
  wireLesson(X, S);
  wireFooter();
}

// 六步分成三段，手機上一次只看一段
const PH = [
  { name: "聽聞前行", sub: "先想想自己，再寫下現在的理解", steps: [0] },
  { name: "正聽", sub: "先聽師父，再聽老師怎麼講", steps: [1, 2] },
  { name: "聽之後", sub: "讀共學、平常練、核對有沒有學會", steps: [3, 4, 5] },
];
const curPh = S => Math.min(Math.max(+S.ph || 0, 0), PH.length - 1);
function phaseTabs(X, S) {
  return PH.map((g, pi) => {
    const ks = g.steps.filter(i => X.steps[i]).map(i => X.steps[i].key), d = ks.filter(k => S.done[k]).length;
    return `<button type="button" data-toph="${pi}" aria-pressed="${pi === curPh(S)}"><b>${esc(g.name)}</b><span class="dots">${ks.map(k => `<i class="${S.done[k] ? "on" : ""}"></i>`).join("")}</span></button>`;
  }).join("");
}
// 整講音檔的分段播放（第三步每一步、第四步每一場的切入處）
const segBtn = (sg, label = "") => sg ? `<button type="button" class="segp" data-s="${sg[0]}" data-e="${sg[1]}" aria-label="播放 ${mmss(sg[0])}–${mmss(sg[1])}">${ICON.play}<span>${label ? esc(label) + " " : ""}${mmss(sg[0])}–${mmss(sg[1])}</span><i></i></button>` : "";
let segAudio = null, segCur = null;
function stopSeg() { if (segAudio) segAudio.pause(); }
function wireSegs(X) {
  if (!X.lecture) { app.querySelectorAll(".segp").forEach(b => b.remove()); return; }
  const ui = () => app.querySelectorAll(".segp").forEach(b => {
    const on = b === segCur && segAudio && !segAudio.paused;
    b.classList.toggle("on", on); b.querySelector("svg").outerHTML = on ? ICON.pause : ICON.play;
    const s = +b.dataset.s, e = +b.dataset.e, p = b === segCur && segAudio ? Math.min(Math.max((segAudio.currentTime - s) / (e - s), 0), 1) : 0;
    b.style.setProperty("--p", (p * 100) + "%");
  });
  app.querySelectorAll(".segp").forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (!segAudio) {
      segAudio = new Audio(X.lecture); segAudio.preload = "auto";
      segAudio.addEventListener("timeupdate", () => { if (segCur && segAudio.currentTime >= +segCur.dataset.e) { segAudio.pause(); } ui(); });
      ["play", "pause"].forEach(e => segAudio.addEventListener(e, ui));
      segAudio.addEventListener("error", () => toast("音檔載入失敗，請確認網路"));
    }
    if (segCur === b && !segAudio.paused) { segAudio.pause(); return; }
    document.dispatchEvent(new Event("gh-play"));
    const s = +b.dataset.s, e = +b.dataset.e;
    if (segCur !== b || segAudio.currentTime < s || segAudio.currentTime >= e - 0.3) segAudio.currentTime = s;
    segCur = b; segAudio.play().catch(() => toast("無法播放，請確認網路")); ui();
  });
}
function field(S, key, ph = "寫在這裡…", rows = 2) {
  return `<textarea data-k="${key}" rows="${rows}" placeholder="${esc(ph)}">${esc(S.a[key] || "")}</textarea>`;
}
function reveal(id, title, body, note = "寫完了，看老師怎麼講") {
  return `<div class="reveal" data-r="${id}"><button aria-expanded="false">${ICON.eye}<span>${esc(note)}</span>${ICON.chev}</button>
    <div class="body md">${title ? `<p><strong>${esc(title)}</strong></p>` : ""}${md(body)}</div></div>`;
}
// 師父原音：只播 start～end 這一段，播完停下、回到開頭
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function player(m) {
  return `<div class="mplayer" data-src="${esc(m.src)}" data-s="${m.start}" data-e="${m.end}">
    <button class="mp-btn" aria-label="播放師父原音">${ICON.play}</button>
    <div class="mp-mid"><b>師父原音</b><span class="mp-t">0:00 / ${mmss(m.end - m.start)}</span>
      <div class="mp-bar" role="slider" aria-label="播放位置" aria-valuemin="0" aria-valuemax="${m.end - m.start}" aria-valuenow="0" tabindex="0"><i></i></div></div>
    <button class="mp-re" aria-label="從頭再聽" title="從頭再聽"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></button></div>
  <p class="hint mp-note">只播師父那一段（${mmss(m.start)}–${mmss(m.end)}），播完會自動停下，不會接到老師的講解。需要連網。</p>`;
}
function wirePlayer(el) {
  const s = +el.dataset.s, e = +el.dataset.e, len = e - s;
  const btn = el.querySelector(".mp-btn"), bar = el.querySelector(".mp-bar"), fill = bar.firstElementChild, tt = el.querySelector(".mp-t");
  let a = null;
  const ui = () => {
    const p = a ? Math.min(Math.max(a.currentTime - s, 0), len) : 0;
    fill.style.width = (p / len * 100) + "%"; tt.textContent = `${mmss(p)} / ${mmss(len)}`; bar.setAttribute("aria-valuenow", Math.round(p));
    const on = a && !a.paused; btn.innerHTML = on ? ICON.pause : ICON.play; btn.setAttribute("aria-label", on ? "暫停" : "播放師父原音"); el.classList.toggle("on", !!on);
  };
  const get = () => {
    if (a) return a;
    a = new Audio(el.dataset.src); a.preload = "auto";
    a.addEventListener("timeupdate", () => { if (a.currentTime >= e) { a.pause(); a.currentTime = s; } ui(); });
    ["play", "pause", "loadedmetadata"].forEach(ev => a.addEventListener(ev, ui));
    a.addEventListener("error", () => toast("師父原音載入失敗，請確認網路"));
    a.currentTime = s; return a;
  };
  const go = sec => { const x = get(); x.currentTime = s + Math.min(Math.max(sec, 0), len - 0.5); ui(); };
  document.addEventListener("gh-play", () => { if (a && !a.paused) a.pause(); });
  btn.onclick = () => { const x = get(); if (x.paused) { stopSeg(); if (x.currentTime < s || x.currentTime >= e) x.currentTime = s; x.play().catch(() => toast("無法播放，請確認網路")); } else x.pause(); };
  el.querySelector(".mp-re").onclick = () => { go(0); const x = get(); if (x.paused) x.play().catch(() => {}); };
  bar.onclick = ev => { const r = bar.getBoundingClientRect(); go((ev.clientX - r.left) / r.width * len); };
  bar.onkeydown = ev => { if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); go((a ? a.currentTime - s : 0) + (ev.key === "ArrowRight" ? 5 : -5)); } };
}
const chkNote = (g, n) => g ? `我也做到了 ${g}／${n} 步。沒打勾的，就是下次聽師父時可以試試的。` : "做到的就點一下打勾。";
function qItem(S, k, q, j, no) {
  const key = `${k}.${j}`, core = q.role === "core";
  const head = `<div class="lab"><i>${no}</i><span>${q.label ? `<strong>${esc(q.label)}</strong>　` : ""}${inline(q.prompt)}${q.multi ? `<em class="tagm">可複選</em>` : ""}</span></div>`;
  if (q.options) {
    const v = (S.a[key] || "").split("｜").filter(Boolean);
    // 舊版是寫字題：寫過的字不在選項裡，照樣留著給他看
    const old = v.length && !v.some(x => q.options.includes(x)) ? S.a[key] : "";
    if (old) return `<div class="q">${head}${field(S, key)}</div>`;
    return `<div class="q choice" data-q="${key}">${head}<div class="opts">${q.options.map(o => `<button type="button" class="opt${v.length && q.answer && q.answer.includes(o) ? " teach" : ""}" data-v="${esc(o)}" aria-pressed="${v.includes(o)}">${inline(o)}</button>`).join("")}</div>
      <div class="fb" aria-live="polite">${fbHTML(q, v)}</div></div>`;
  }
  return `<div class="q${core ? " core" : ""}">${head}${field(S, key, core ? "寫一句就好" : "寫在這裡…")}${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ""}</div>`;
}
function fbHTML(q, v) {
  if (!v.length) return "";
  let h = "";
  if (q.answer && !q.multi) h = v[0] === q.answer[0] ? `<b class="ok">和老師想的一樣。</b>` : `<b>老師的看法是：${inline(q.answer[0])}</b>`;
  else if (q.answer) { const same = v.filter(x => q.answer.includes(x)).length; h = `<b>${same ? `有 ${same} 個和老師一樣。` : "和老師停的地方不一樣，比一比。"}</b>標「老師」的是老師停下來的。`; }
  return h + (q.explain ? ` ${inline(q.explain)}` : "");
}
function stepHTML(X, S, s, i) {
  const k = s.key, n = CN[i] || i + 1;
  let b = "";
  if (s.kind === "prompts" || s.kind === "questions") {
    // 要寫的只有 ★ 核心題；點選題點一下；其他寫字題收進「選做」
    const its = s.items.map((q, j) => [q, j]);
    const shown = its.filter(([q]) => (q.role || "core") !== "extra"), extra = its.filter(([q]) => q.role === "extra");
    let n = 0;
    b = (s.lead ? `<div class="lead md">${md(s.lead)}</div>` : "") + (i === 1 && X.master ? player(X.master) : "") +
      shown.map(([q, j]) => qItem(S, k, q, j, q.role === "core" ? "★" : ++n)).join("") +
      (extra.length ? `<details class="more"${extra.some(([q, j]) => S.a[`${k}.${j}`]) ? " open" : ""}><summary>想多想一點（選做 ${extra.length} 題）</summary>
        ${extra.map(([q, j], m) => qItem(S, k, q, j, m + 1)).join("")}</details>` : "");
  } else if (s.kind === "checklist") {
    const got = s.checks.filter((c, j) => S.a[`${k}.c${j}`]).length;
    b = (s.lead ? `<div class="lead md">${md(s.lead)}</div>` : "") +
      `<div class="checks">${s.checks.map((c, j) => `<div class="chk${S.a[`${k}.c${j}`] ? " on" : ""}">
        <div class="chk-t"><b>${esc(c.label)}</b>${c.seg && X.lecture ? "" : c.time ? `<span class="tc">${esc(c.time)}</span>` : ""}<span class="chk-d">${inline(c.text)}</span>${segBtn(c.seg, "聽這一段")}</div>
        <button type="button" class="chk-b" data-c="${k}.c${j}" aria-pressed="${!!S.a[`${k}.c${j}`]}" aria-label="${esc(c.label)}：我也有做到">${ICON.check}</button></div>`).join("")}</div>
      <p class="chk-n" id="chkn-${k}">${chkNote(got, s.checks.length)}</p>` +
      (s.closing ? `<div class="q core"><div class="lab"><i>★</i><span><strong>${esc(s.closing)}</strong></span></div>${field(S, `${k}.end`, "寫一句就好")}</div>` : "");
  } else if (s.kind === "compare") {
    b = (s.lead ? `<div class="lead md">${md(s.lead)}</div>` : "") +
      s.rows.map((r, j) => `<div class="cmp-row"><b>${inline(r)}</b><div class="cmp">
        ${s.cols.map((c, ci) => `<div><label>${esc(c)}</label>${field(S, `${k}.${j}.${ci}`, ci ? "聽完老師再寫" : "先寫我的")}</div>`).join("")}</div></div>`).join("") +
      (s.closing ? `<div class="q"><div class="lab"><i>★</i><span><strong>${esc(s.closing)}</strong></span></div>${field(S, `${k}.end`)}</div>` : "");
  } else if (s.kind === "sessions") {
    // 預設使用者沒聽過共學：每場一張卡，先看「從這一講的哪裡切入」（可以聽那一段），細節收起來
    const fav = S.a[`${k}.fav`];
    const [first, ...more] = (s.lead || "").split("\n");
    b = `<div class="lead">${inline(first.replace(/（[^）]*）/g, ""))}${s.recording ? ` 有福智學員帳號，也可以到<a href="${esc(s.recording)}" target="_blank" rel="noopener">線上課程</a>補聽。` : ""}</div>` +
      `<div class="sess2s">${s.sessions.map((x, j) => {
        const m = x.who.match(/^(\d{1,2}\/\d{1,2})\s*(.*)$/), on = fav === String(j);
        return `<div class="sess2${on ? " fav-on" : ""}">
          <div class="s2-top"><span class="s2-who">${m ? `<span class="num">${esc(m[1])}</span>${esc(m[2])}` : esc(x.who)}</span>
            <button type="button" class="fav" data-fav="${j}" aria-pressed="${on}" aria-label="這場對我最有用">${on ? "♥" : "♡"}</button></div>
          ${x.from ? `<div class="s2-from"><span class="lbl">從這一講的這裡</span>${inline(x.from)}${segBtn(x.seg)}</div>` : ""}
          ${x.head ? `<div class="s2-head"><span class="arr" aria-hidden="true">↓</span>帶出的主題：${inline(x.head)}</div>` : ""}
          ${x.brief && x.brief.length ? `<details class="more s2"><summary>法師怎麼帶</summary><div class="brief">${x.brief.map(([h, v]) => `<div><span>${esc(h)}</span>${inline(v)}</div>`).join("")}</div></details>` : ""}
        </div>`;
      }).join("")}</div>
      <p class="chk-n">${fav != null && s.sessions[+fav] ? `最有用的一場：${esc(s.sessions[+fav].who)}` : "點 ♡ 選出對自己最有用的一場。"}</p>` +
      (s.rest ? `<details class="more"><summary>四場合起來看</summary><div class="together md">${md(s.rest)}</div>${more.filter(l => l.trim()).map(l => `<p class="hint">${inline(l)}</p>`).join("")}</details>` : "") +
      (s.closing ? `<div class="q core" style="margin-top:14px"><div class="lab"><i>★</i><span><strong>${esc(s.closing)}</strong></span></div>${field(S, `${k}.end`, "寫一句就好")}</div>` : "");
  } else if (s.kind === "practice") {
    b = `<div class="q"><div class="lab"><span><strong>觸發點</strong>：每天都會遇到的小事（點一下，直接記一筆）</span></div>
        <div class="chips">${s.triggers.map((t, j) => `<button type="button" class="chip" data-pick="${j}">${esc(t)}</button>`).join("")}</div></div>
      <div class="q"><div class="lab"><span><strong>遇到時做四步</strong>${s.stepsNote ? `（${esc(s.stepsNote)}）` : ""}</span></div>
        <ol class="ladder">${s.moves.map(m => `<li><div><b>${esc(m.label)}</b><div>${inline(m.text)}</div></div></li>`).join("")}</ol></div>
      ${s.phrases.length ? `<div class="phrases">${s.phrases.map(p => `<div class="phrase">${esc(p.replace(/[！!。]$/, ""))}</div>`).join("")}</div>` : ""}
      <div class="section-h" style="margin-top:24px"><h2 style="font-size:18px">每天記一筆</h2><span class="n" id="logcount"></span></div>
      ${s.logNote ? `<p class="hint" style="margin:-6px 0 6px;color:var(--mute);font-size:14px">${esc(s.logNote)}</p>` : ""}
      <div class="week" id="week"></div>
      <form class="logform card" id="logform" style="box-shadow:none">
        <label>日期</label><input type="date" name="date" value="${today()}">
        <label>遇到的境</label><div class="chips" id="trig">${s.triggers.map(t => `<button type="button" class="chip" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
        <input type="text" name="scene" placeholder="例如：午餐的菜太鹹">
        <label>當下的心</label><input type="text" name="mind" placeholder="例如：心裡一直嘀咕，想去外面買">
        <label>當下認得了嗎？</label><div class="seg" id="seg">${["當下", "事後", "沒有"].map(t => `<button type="button" aria-pressed="false">${t}</button>`).join("")}</div>
        <label>用了哪一句法</label><select name="phrase"><option value="">（沒有用／自己寫在結果裡）</option>${s.phrases.map(p => `<option>${esc(p)}</option>`).join("")}</select>
        <label>結果</label><input type="text" name="result" placeholder="例如：停下抱怨，好好吃完">
        <button class="btn" type="submit">記下來</button>
      </form>
      <div class="entries" id="entries"></div>
      ${s.reminder ? `<div class="quote md">${md("**提醒**：" + s.reminder)}</div>` : ""}`;
  } else if (s.kind === "levels") {
    b = `<div class="card" style="box-shadow:none;padding:4px 18px">${s.levels.map((v, j) => `<div class="lvl">
        <button class="tick" data-lvl="${j}" aria-pressed="${!!S.lvl[j]}" aria-label="${esc(v.name)}做到了">${ICON.check}</button>
        <h3>${j + 1}. ${esc(v.name)}</h3><div class="how">${inline(v.how)}</div><div class="pass">${inline(v.pass)}</div>
        <div class="auto" data-auto="${j}"></div><details class="more lv"${S.a[`${k}.${j}`] ? " open" : ""}><summary>寫一點我的狀況（選做）</summary>${field(S, `${k}.${j}`, "我的狀況", 1)}</details></div>`).join("")}</div>
      ${s.closing ? `<div class="q core" style="margin-top:16px"><div class="lab"><i>★</i><span><strong>${esc(s.closing)}</strong></span></div>${field(S, `${k}.ask`)}</div>` : ""}`;
  } else {
    b = `<div class="md">${md(s.md || "")}</div>`;
  }
  if (s.answer) b += reveal(`${k}.ans`, s.answer.title, s.answer.md);
  return `<section class="step" id="s-${k}">
    <div class="step-h">${moon((i + 1) / 6)}<div><div class="k">第${n}步</div><h2>${esc(s.title)}${s.minutes ? `<span class="min">${s.minutes} 分鐘</span>` : ""}</h2></div></div>
    <div class="card">${b}</div>
    <div class="stepdone"><button data-done="${k}" aria-pressed="${!!S.done[k]}">${ICON.check}<span>${S.done[k] ? "這一步完成了" : "這一步做完了"}</span></button></div>
  </section>`;
}

function wireLesson(X, S) {
  const id = X.id;
  app.querySelectorAll(".mplayer").forEach(wirePlayer);
  wireSegs(X);
  // 三段切換
  const showPh = (pi, scroll = true) => {
    S.ph = pi; save();
    app.querySelectorAll(".phase").forEach(el => el.hidden = +el.dataset.ph !== pi);
    app.querySelectorAll(".ph-tabs [data-toph]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.toph === pi));
    stopSeg();
    if (scroll) { const top = $(".ph-main").getBoundingClientRect().top + scrollY - 8; if (scrollY > top) scrollTo({ top, behavior: "instant" }); }
  };
  app.querySelectorAll("[data-toph]").forEach(b => b.onclick = () => showPh(+b.dataset.toph));
  // 點選題
  app.querySelectorAll(".q.choice").forEach(box => {
    const [k, j] = box.dataset.q.split("."), q = X.steps.find(s => s.key === k).items[+j];
    box.querySelectorAll(".opt").forEach(o => o.onclick = () => {
      let v = (S.a[box.dataset.q] || "").split("｜").filter(Boolean);
      const x = o.dataset.v;
      v = q.multi ? (v.includes(x) ? v.filter(y => y !== x) : [...v, x]) : (v[0] === x ? [] : [x]);
      if (v.length) S.a[box.dataset.q] = v.join("｜"); else delete S.a[box.dataset.q];
      save();
      box.querySelectorAll(".opt").forEach(b => { b.setAttribute("aria-pressed", v.includes(b.dataset.v)); b.classList.toggle("teach", !!(v.length && q.answer && q.answer.includes(b.dataset.v))); });
      box.querySelector(".fb").innerHTML = fbHTML(q, v);
    });
  });
  // 第三步：老師的步驟，我也做到就打勾
  app.querySelectorAll(".chk-b").forEach(c => c.onclick = () => {
    const key = c.dataset.c, on = !S.a[key]; if (on) S.a[key] = "y"; else delete S.a[key]; save();
    c.setAttribute("aria-pressed", on); c.closest(".chk").classList.toggle("on", on);
    const k = key.split(".")[0], st = X.steps.find(s => s.key === k);
    $("#chkn-" + CSS.escape(k)).textContent = chkNote(st.checks.filter((x, j) => S.a[`${k}.c${j}`]).length, st.checks.length);
  });
  // 第四步：最有用的一場
  app.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => {
    const k = b.closest(".step").id.slice(2), key = `${k}.fav`, on = S.a[key] !== b.dataset.fav;
    if (on) S.a[key] = b.dataset.fav; else delete S.a[key]; save();
    app.querySelectorAll("[data-fav]").forEach(x => { const p = on && x === b; x.setAttribute("aria-pressed", p); x.textContent = p ? "♥" : "♡"; x.closest(".sess2").classList.toggle("fav-on", p); });
    const st = X.steps.find(s => s.key === k), n = b.closest(".step").querySelector(".chk-n");
    if (n) n.textContent = on ? `最有用的一場：${st.sessions[+b.dataset.fav].who}` : "點 ♡ 選出對自己最有用的一場。";
  });
  // textareas: autosize + autosave
  const grow = t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
  app.querySelectorAll("textarea[data-k]").forEach(t => {
    grow(t);
    t.addEventListener("input", () => { grow(t); S.a[t.dataset.k] = t.value; if (!t.value) delete S.a[t.dataset.k]; save(); });
  });
  // rail jump
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    const i = X.steps.findIndex(s => s.key === b.dataset.go), pi = PH.findIndex(g => g.steps.includes(i));
    if (pi >= 0) showPh(pi, false);
    $("#s-" + CSS.escape(b.dataset.go)).scrollIntoView({ behavior: "smooth" });
  });
  // reveals
  app.querySelectorAll(".reveal > button").forEach(b => b.onclick = () => {
    const r = b.parentElement, open = r.classList.toggle("open"); b.setAttribute("aria-expanded", open);
  });
  // step done
  const refresh = () => {
    const p = progress(id, X.steps.length);
    $("#miniMoon").innerHTML = moon(p);
    app.querySelectorAll(".rail [data-go]").forEach(b => b.classList.toggle("done", !!S.done[b.dataset.go]));
    app.querySelectorAll(".ph-tabs").forEach(n => { n.innerHTML = phaseTabs(X, S); n.querySelectorAll("[data-toph]").forEach(b => b.onclick = () => showPh(+b.dataset.toph)); });
    $("#full").innerHTML = p >= 1 ? `<div class="fullmoon">${moon(1)}<h2>月圓了</h2><p>第 ${X.no} 講六步都走過一輪。把「留一個問題去請益」帶去研討班吧。</p></div>` : "";
  };
  app.querySelectorAll("[data-done]").forEach(b => b.onclick = () => {
    const k = b.dataset.done, on = !S.done[k]; S.done[k] = on; if (!on) delete S.done[k]; save(true);
    b.setAttribute("aria-pressed", on); b.querySelector("span").textContent = on ? "這一步完成了" : "這一步做完了";
    refresh(); if (on) toast(progress(id, X.steps.length) >= 1 ? "月圓了" : "月亮又亮了一分");
  });
  // levels
  app.querySelectorAll("[data-lvl]").forEach(b => b.onclick = () => {
    const j = b.dataset.lvl; S.lvl[j] = !S.lvl[j]; if (!S.lvl[j]) delete S.lvl[j]; b.setAttribute("aria-pressed", !!S.lvl[j]); save(true);
  });
  // practice log
  const form = $("#logform");
  if (form) {
    let trig = "", seen = "";
    form.querySelectorAll("#trig .chip").forEach(c => c.onclick = () => {
      trig = c.getAttribute("aria-pressed") === "true" ? "" : c.textContent;
      form.querySelectorAll("#trig .chip").forEach(x => x.setAttribute("aria-pressed", x === c && trig ? "true" : "false"));
    });
    app.querySelectorAll("[data-pick]").forEach(p => p.onclick = () => {
      const c = form.querySelectorAll("#trig .chip")[+p.dataset.pick];
      if (c.getAttribute("aria-pressed") !== "true") c.click();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => form.scene.focus({ preventScroll: true }), 400);
    });
    form.querySelectorAll("#seg button").forEach(c => c.onclick = () => {
      seen = c.textContent; form.querySelectorAll("#seg button").forEach(x => x.setAttribute("aria-pressed", x === c));
    });
    form.onsubmit = e => {
      e.preventDefault();
      const f = new FormData(form), en = { id: Date.now(), date: f.get("date") || today(), trig, scene: f.get("scene").trim(), mind: f.get("mind").trim(), seen, phrase: f.get("phrase"), result: f.get("result").trim() };
      if (!en.trig && !en.scene && !en.mind) { toast("先寫下遇到的境"); return; }
      S.log.push(en); save(true); form.reset(); form.date.value = today(); trig = seen = "";
      form.querySelectorAll("[aria-pressed]").forEach(x => x.setAttribute("aria-pressed", "false"));
      drawLog(); toast("記下來了");
    };
    drawLog();
  }
  function drawLog() {
    const box = $("#entries"); if (!box) return;
    const list = [...S.log].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    box.innerHTML = list.map(e => `<div class="entry"><div class="when">${esc(e.date)}${e.trig ? `<span class="tag">${esc(e.trig)}</span>` : ""}${e.seen ? `<span class="tag ${e.seen === "當下" ? "now" : ""}">${esc(e.seen)}認得</span>` : ""}</div>
      ${e.scene ? `<div>境：${esc(e.scene)}</div>` : ""}${e.mind ? `<div>心：${esc(e.mind)}</div>` : ""}${e.phrase ? `<div>法：「${esc(e.phrase)}」</div>` : ""}${e.result ? `<div>結果：${esc(e.result)}</div>` : ""}
      <button class="del" data-del="${e.id}" aria-label="刪除這一筆">✕</button></div>`).join("");
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      if (!confirm("刪除這一筆紀錄？")) return;
      S.log = S.log.filter(x => x.id !== +b.dataset.del); save(true); drawLog();
    });
    // 7-day strip ending today
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
    const has = new Set(S.log.map(e => e.date));
    $("#week").innerHTML = days.map((d, i) => `<span class="${has.has(d) ? "on" : ""} ${i === 6 ? "today" : ""}" title="${d}"></span>`).join("");
    $("#logcount").textContent = S.log.length ? `共 ${S.log.length} 筆・最近 7 天 ${days.filter(d => has.has(d)).length} 天` : "";
    // auto hints for levels 2 & 3
    const now = S.log.filter(e => e.seen === "當下").length, turned = S.log.filter(e => e.phrase && e.result).length;
    const a2 = $('[data-auto="1"]'), a3 = $('[data-auto="2"]');
    if (a2) a2.textContent = `練習紀錄：當下認得 ${now} 次`;
    if (a3) a3.textContent = `練習紀錄：有用一句法、也寫了結果的 ${turned} 次`;
  }
  // print
  $("#print").onclick = () => { app.querySelectorAll(".reveal").forEach(r => r.classList.add("open")); app.querySelectorAll("details.more, details.meta").forEach(d => d.open = true); app.querySelectorAll(".phase").forEach(el => el.hidden = false); print(); app.querySelectorAll(".phase").forEach(el => el.hidden = +el.dataset.ph !== curPh(S)); };
  // mini bar
  const mini = $("#mini"), hero = $(".sea");
  new IntersectionObserver(([e]) => mini.classList.toggle("on", !e.isIntersecting), { threshold: 0 }).observe(hero);
  refresh();
}

addEventListener("hashchange", route);
addEventListener("pagehide", () => save(true));
route();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
