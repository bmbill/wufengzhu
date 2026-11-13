/* 燈燈相續・善：記一則善行（window.Shan）
 *
 * 取自燈燈悅心的主體：隨手記一則善行點滴、觀功念恩、誦經或其他，一天最多 3 則。
 * 寫一則就算今天有做「善」，會一起點亮今天的燈（DDLamp.sync）。
 *
 * 資料存在 DAYS[日期].shan = [{k:"deed"|"grat"|"sutra"|"other", t:文字, s:經名, p:頁數, at:"HH:MM"}]
 * 一般 script，不是 ES module；需要先載入 lamp/lamp.js。接法見 lamp/README.md。
 */
(function () {
"use strict";

const KINDS = {
  deed:  { name: "善行點滴", icon: "🌱", hint: "再小都算：幫人開個門、忍住一句話。" },
  grat:  { name: "觀功念恩", icon: "🙏", hint: "看到誰的好，替他高興一下。" },
  sutra: { name: "誦經",     icon: "📖", hint: "翻幾頁都算，頁數可以留空。" },
  other: { name: "其他",     icon: "✏️", hint: "想到什麼寫什麼。" },
};
const ORDER = ["deed", "grat", "sutra", "other"];
const MAX = 3;
const MAXLEN = 200;

/* 記完之後的一句回應（不引用任何人的話）。 */
const REPLY = {
  deed:  ["記下來了，這也是一盞燈。", "再小的好事，記下來就不會忘。", "這一件，替今天添了一點光。"],
  grat:  ["看見別人的好，自己的心也亮了。", "念恩的心，是最暖的燈油。", "替他歡喜，也替你歡喜。"],
  sutra: ["經聲也是燈。", "翻過的每一頁都算數。", "今天的經，讀進心裡了。"],
  other: ["記下來了。", "今天的這一筆，收好了。", "寫下來，就看得見了。"],
};

function gS() { try { return S; } catch (e) { return window.S || {}; } }
function gDays() { try { return DAYS; } catch (e) { return window.DAYS || {}; } }
function todayK() { return window.DDLamp ? DDLamp.today() : new Date().toISOString().slice(0, 10); }
function save(date) { try { persist(date); } catch (e) { if (window.DDLampDemoSave) window.DDLampDemoSave(); } }
function rerender() { try { render(); } catch (e) { if (window.DDLampDemoRender) window.DDLampDemoRender(); } }
const esc_ = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function entries(date) { const d = gDays()[date || todayK()]; return (d && d.shan) || []; }

/** 首頁的一條：「善」＋記一則＋今天幾則（三個小點）。 */
function strip() {
  const n = entries().length;
  return `<div class="shan-strip">
    <span class="shan-k" aria-hidden="true">善</span>
    <button class="shan-add" data-shan-open>${n >= MAX ? "今天記滿了" : "＋ 記一則"}</button>
    <span class="shan-n" aria-label="今天記了 ${n} 則，最多 ${MAX} 則">${[0, 1, 2].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>
  </div>`;
}

let picked = "deed";

/** 記一則的彈層：四個圖示選類別、一行字、誦經可以填經名和頁數；底下是今天記過的，可以移掉。 */
function open() {
  const date = todayK(), list = entries(date), full = list.length >= MAX;
  const S_ = gS();
  const mic = typeof micBtn === "function" ? micBtn("shan-t") : "";
  const L = DDLamp.overlay(`
    <div class="shan-head"><span class="shan-k" aria-hidden="true">善</span><h2>記一則</h2><span class="shan-n">${[0, 1, 2].map((i) => `<i class="${i < list.length ? "on" : ""}"></i>`).join("")}</span></div>
    ${full ? `<p class="shan-full">今天記滿 ${MAX} 則了。想換一則，可以先移掉一則。</p>` : `
    <div class="shan-kinds" role="radiogroup" aria-label="類別">${ORDER.map((k) => `<button type="button" role="radio" aria-checked="${k === picked}" class="${k === picked ? "on" : ""}" data-k="${k}"><span class="i">${KINDS[k].icon}</span><span class="n">${KINDS[k].name}</span></button>`).join("")}</div>
    <p class="shan-hint" id="shan-hint">${esc_(KINDS[picked].hint)}</p>
    <div class="shan-sutra" ${picked === "sutra" ? "" : "hidden"}>
      <input id="shan-s" placeholder="經名" value="${esc_(S_.shanSutra || "")}" maxlength="30">
      <input id="shan-p" type="number" inputmode="numeric" min="0" max="999" placeholder="頁數">
    </div>
    ${mic}<textarea id="shan-t" rows="2" maxlength="${MAXLEN}" placeholder="一句話就好"></textarea>
    <div class="btns"><button class="btn primary" id="shan-ok">記下來</button><button class="btn ghost" data-ddl-close>取消</button></div>`}
    ${list.length ? `<ul class="shan-list">${list.map((e, i) => `<li><span class="i">${KINDS[e.k] ? KINDS[e.k].icon : ""}</span><span class="t">${esc_(e.t || KINDS[e.k].name)}${e.p ? `<small>${esc_(e.s || "")} ${e.p} 頁</small>` : ""}</span><button class="x" data-del="${i}" aria-label="移掉這一則">✕</button></li>`).join("")}</ul>` : ""}
    ${full ? `<div class="btns"><button class="btn" data-ddl-close>關閉</button></div>` : ""}`);

  L.querySelectorAll(".shan-kinds [data-k]").forEach((b) => {
    b.onclick = () => {
      picked = b.dataset.k;
      L.querySelectorAll(".shan-kinds [data-k]").forEach((x) => { const on = x.dataset.k === picked; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
      L.querySelector("#shan-hint").textContent = KINDS[picked].hint;
      L.querySelector(".shan-sutra").hidden = picked !== "sutra";
    };
  });
  L.querySelectorAll("[data-del]").forEach((b) => { b.onclick = () => remove(Number(b.dataset.del)); });
  const ok = L.querySelector("#shan-ok");
  if (ok) ok.onclick = () => {
    const t = L.querySelector("#shan-t").value.trim().slice(0, MAXLEN);
    const s = picked === "sutra" ? L.querySelector("#shan-s").value.trim() : "";
    const p = picked === "sutra" ? Math.max(0, Math.min(999, parseInt(L.querySelector("#shan-p").value, 10) || 0)) : 0;
    if (!t && !p) { L.querySelector("#shan-t").focus(); return; }
    add({ k: picked, t, s, p });
  };
}

/** 記一則。回傳今天的燈有沒有變（給呼叫的人決定要不要開獎）。 */
function add(e) {
  const date = todayK(), D = gDays();
  if (!D[date]) D[date] = { sits: [] };
  const d = D[date];
  d.shan = d.shan || [];
  if (d.shan.length >= MAX) return null;
  const now = new Date();
  const k = KINDS[e.k] ? e.k : "other";
  // c：類別的中文名稱（進度頁讀這個）；k：類別代號（這裡自己用）
  d.shan.push({ c: KINDS[k].name, k, t: e.t || "", s: e.s || "", p: e.p || 0, at: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0") });
  if (e.s) gS().shanSutra = e.s;
  save(date);
  const res = DDLamp.sync(date);
  const L = document.getElementById("layer"); if (L) L.innerHTML = "";
  rerender();
  if (res && (res.changed === "new" || res.changed === "up")) DDLamp.reveal(res);
  else { const r = REPLY[e.k] || REPLY.other; try { toast(r[d.shan.length % r.length]); } catch (er) {} }
  return res;
}

function remove(i) {
  const date = todayK(), d = gDays()[date];
  if (!d || !d.shan || !d.shan[i]) return;
  d.shan.splice(i, 1);
  save(date);
  DDLamp.sync(date);
  rerender();
  open();
}

/** 某一天記了幾則、各類幾則、誦經幾頁（進度頁用）。 */
function stats() {
  const D = gDays(), out = { total: 0, days: 0, pages: 0, deed: 0, grat: 0, sutra: 0, other: 0 };
  for (const k in D) {
    const l = (D[k] && D[k].shan) || [];
    if (l.length) out.days++;
    l.forEach((e) => { out.total++; const k = kindOf(e); out[k] = (out[k] || 0) + 1; out.pages += e.p || 0; });
  }
  return out;
}

/** 類別代號：新資料有 k；只有中文名稱 c 的舊資料，從名稱查回來。 */
function kindOf(e) {
  if (e && KINDS[e.k]) return e.k;
  const c = e && (e.c || e.type || e.cat);
  return ORDER.find((k) => KINDS[k].name === c) || "other";
}

/**
 * 設定頁「善」分頁（index.html 有 Shan.settingsHTML 才會出現這個分頁）。
 * 輸入框、按鈕都用自己的 data-shan-set，不經過 index.html 的 data-act。
 */
function settingsHTML() {
  const S_ = gS(), st = stats();
  const own = window.DDShop ? DDShop.owned() : { scenes: ["night"], patterns: [] };
  const P = window.DDLamp ? DDLamp.PATTERNS : {};
  const curPat = S_.lampPattern || "";
  const SC = window.DDSky ? DDSky.SCENES : [];
  const curSc = S_.lampScene || "night";
  return `<section class="section"><div class="card shan-set">
    <div class="shan-set-row"><span class="shan-k" aria-hidden="true">善</span><b>記一則善行</b><span class="mini-note">每天最多 ${MAX} 則</span></div>
    <div class="shan-set-stats">${ORDER.map((k) => `<span><i>${KINDS[k].icon}</i>${st[k] || 0}</span>`).join("")}<span><i>📄</i>${st.pages} 頁</span></div>
    <label class="shan-set-l" for="shan-sutra">誦經的預設經名</label>
    <input id="shan-sutra" data-shan-set="sutra" value="${esc_(S_.shanSutra || "")}" placeholder="例如：大般若經" maxlength="30">
  </div></section>
  ${window.DDLamp ? `<section class="section"><div class="card shan-set">
    <div class="shan-set-row"><span class="st-ic" aria-hidden="true">🪔</span><b>我的燈</b><span class="mini-note">在燈坊用燈油換更多</span></div>
    <span class="shan-set-l">燈上的紋樣</span>
    <div class="shan-set-pick">${["", ...Object.keys(P)].map((k) => {
      const ok = !k || k === "plain" || own.patterns.includes(k);
      return `<button data-shan-set="pattern" data-v="${k}" class="${curPat === k ? "on" : ""}" ${ok ? "" : "disabled"} aria-pressed="${curPat === k}">${k ? esc_(P[k].name) : "預設"}${ok ? "" : " 🔒"}</button>`;
    }).join("")}</div>
    <span class="shan-set-l">燈海的景</span>
    <div class="shan-set-pick">${SC.map((s) => {
      const ok = own.scenes.includes(s.key);
      return `<button data-shan-set="scene" data-v="${s.key}" class="${curSc === s.key ? "on" : ""}" ${ok ? "" : "disabled"} aria-pressed="${curSc === s.key}">${esc_(s.name)}${ok ? "" : " 🔒"}</button>`;
    }).join("")}</div>
  </div></section>` : ""}`;
}

document.addEventListener("click", (e) => {
  if (e.target.closest("[data-shan-open]")) { open(); return; }
  const b = e.target.closest("button[data-shan-set]");
  if (!b) return;
  const S_ = gS(), k = b.dataset.shanSet;
  if (k === "pattern") { if (b.dataset.v) S_.lampPattern = b.dataset.v; else delete S_.lampPattern; }
  if (k === "scene") S_.lampScene = b.dataset.v;
  save(); rerender();
});
document.addEventListener("change", (e) => {
  const i = e.target.closest("input[data-shan-set=sutra]");
  if (!i) return;
  gS().shanSutra = i.value.trim().slice(0, 30);
  save();
  try { toast("記住了"); } catch (er) {}
});

window.Shan = { KINDS, ORDER, MAX, strip, open, add, remove, entries, stats, kindOf, settingsHTML };
})();
