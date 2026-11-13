/* 燈燈相續・燈坊裡跟燈有關的東西（window.DDShop）
 *
 * index.html 的燈坊（#shop）會呼叫：
 *   DDShop.tiles()        → 「用燈油換」那一格格：燈海的景、燈上的紋樣
 *   DDShop.collections()  → 「收藏」那一列列：燈譜、我的燈海
 * 花燈油：S.spent += 價錢（可用燈油 = availOil() = oil() − S.spent）。
 * 買過的存在 S.lampOwned = {scenes:[...], patterns:[...]}；正在用的是 S.lampScene、S.lampPattern。
 * 按鈕都用自己的 data-ddshop／data-ddshop-open，不經過 index.html 的 data-act。
 * 需要先載入 lamp.js、sky.js。
 */
(function () {
"use strict";

const PRICE = { scene: 30, pattern: 20 };

function gS() { try { return S; } catch (e) { return window.S || {}; } }
function save() { try { persist(); } catch (e) { if (window.DDLampDemoSave) window.DDLampDemoSave(); } }
function rerender() { try { render(); } catch (e) { if (window.DDLampDemoRender) window.DDLampDemoRender(); } }
function avail() { try { return availOil(); } catch (e) { return 999; } }
function say(m) { try { toast(m); } catch (e) {} }
const esc_ = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 已經有的景與紋樣。夜空和素面（預設紋樣）本來就有。 */
function owned() {
  const S_ = gS();
  const o = S_.lampOwned || {};
  return { scenes: ["night", ...(o.scenes || []).filter((k) => k !== "night")], patterns: (o.patterns || []).slice() };
}
function addOwned(type, key) {
  const S_ = gS();
  S_.lampOwned = S_.lampOwned || { scenes: [], patterns: [] };
  const arr = S_.lampOwned[type === "scene" ? "scenes" : "patterns"] = S_.lampOwned[type === "scene" ? "scenes" : "patterns"] || [];
  if (!arr.includes(key)) arr.push(key);
}

/** 燈坊「用燈油換」：兩格。 */
function tiles() {
  const a = avail();
  const ow = owned();
  const nS = DDSky.SCENES.length, nP = Object.keys(DDLamp.PATTERNS).length - 1;   // 素面不用買
  return `<button class="shop-tile" data-ddshop="scene"><span class="st-ic">🌌</span><b>燈海的景</b><small class="num">${PRICE.scene} 滴・已有 ${ow.scenes.length}／${nS}</small></button>
    <button class="shop-tile" data-ddshop="pattern"><span class="st-ic">🪔</span><b>燈上的紋樣</b><small class="num">${PRICE.pattern} 滴・已有 ${ow.patterns.filter((k) => k !== "plain").length}／${nP}</small></button>`;
}

/** 燈坊「收藏」：燈譜、我的燈海。 */
function collections() {
  const seen = DDLamp.seenForms();
  const nF = Object.keys(seen).length, allF = Object.keys(DDLamp.FORMS).length;
  const info = DDSky.skyInfo();
  return `<button class="coll-row" data-ddshop-open="album"><span class="st-ic">🏮</span><b>燈譜</b><span class="num">${nF}／${allF}</span><span class="tile-go">›</span></button>
    <button class="coll-row" data-ddshop-open="sea"><span class="st-ic">🌌</span><b>我的燈海${info.cur > 1 ? `・第 ${info.no} 片` : ""}</b><span class="num">${info.filled}／${DDSky.SKY_SIZE}</span><span class="tile-go">›</span></button>`;
}

function openCollection(which) {
  if (which === "album") {
    DDLamp.overlay(`${DDSky.album()}<div class="btns"><button class="btn" data-ddl-close>關閉</button></div>`);
  } else {
    DDLamp.overlay(`<h2 class="ddshop-h">我的燈海</h2><div data-ddsky-host>${DDSky.mySea()}</div>
      <p class="mini-note ddshop-note">每天的燈飄在這裡，108 盞是一片。點一盞看那天做了什麼。</p>
      <div class="btns"><button class="btn" data-ddl-close>關閉</button></div>`);
  }
}

/** 景的小預覽：用目前這一片的燈，換底色畫一張小圖。 */
function sceneThumb(key) {
  const info = DDSky.skyInfo();
  const spots = DDSky.layoutOf(info.lamps, info.filled >= 108);
  const no = DDSky.SCENES.findIndex((s) => s.key === key) + 1;
  return `<svg class="ddshop-thumb" viewBox="0 0 1080 1080" aria-hidden="true">${DDSky.skySVG({ layout: spots, filled: info.filled, reached: info.reached, skyNo: no, height: 1080 })}</svg>`;
}

/** 紋樣的小預覽：今天的燈（還沒點就用一盞示範燈）換上那個紋樣。 */
function patternThumb(key) {
  const base = DDLamp.lampOf(DDLamp.today()) || { form: "round", bowl: "cinnabar", flame: "gamboge" };
  return DDLamp.render(Object.assign({}, base, { pattern: key || "plain", name: "" }), { size: 64 });
}

function picker(type) {
  const S_ = gS(), ow = owned(), a = avail(), price = PRICE[type];
  const isScene = type === "scene";
  const opts = isScene
    ? DDSky.SCENES.map((s) => ({ key: s.key, name: s.name, have: ow.scenes.includes(s.key), cur: (S_.lampScene || "night") === s.key, art: sceneThumb(s.key) }))
    : Object.keys(DDLamp.PATTERNS).map((k) => ({ key: k, name: DDLamp.PATTERNS[k].name, have: k === "plain" || ow.patterns.includes(k), cur: (S_.lampPattern || "plain") === k, art: patternThumb(k) }));
  const L = DDLamp.overlay(`<h2 class="ddshop-h">${isScene ? "🌌 燈海的景" : "🪔 燈上的紋樣"}</h2>
    <p class="mini-note ddshop-note">可用燈油 <b>${a}</b> 滴・換一${isScene ? "種景" : "種紋樣"} ${price} 滴，換過的可以隨時換回來。</p>
    <div class="ddshop-opts ${isScene ? "scenes" : "patterns"}">${opts.map((o) => `<div class="ddshop-opt ${o.cur ? "cur" : ""}">
        ${o.art}<b>${esc_(o.name)}</b>
        ${o.cur ? `<span class="ddshop-st">使用中</span>`
          : o.have ? `<button class="btn small" data-ddshop-use="${type}:${o.key}">換上</button>`
          : `<button class="btn small primary" data-ddshop-buy="${type}:${o.key}" ${a >= price ? "" : "disabled"}>${price} 滴</button>`}
      </div>`).join("")}</div>
    <div class="btns"><button class="btn" data-ddl-close>關閉</button></div>`);
  return L;
}

function use(type, key) {
  const S_ = gS();
  if (type === "scene") S_.lampScene = key; else S_.lampPattern = key;
  save();
}

function buy(type, key) {
  const price = PRICE[type];
  if (avail() < price) { say("可用燈油不夠"); return; }
  const S_ = gS();
  S_.spent = (S_.spent || 0) + price;
  addOwned(type, key);
  use(type, key);
  say(type === "scene" ? "燈海換了新的景" : "燈換上新的紋樣");
}

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ddshop]");
  if (t) { picker(t.dataset.ddshop); return; }
  const c = e.target.closest("[data-ddshop-open]");
  if (c) { openCollection(c.dataset.ddshopOpen); return; }
  const u = e.target.closest("[data-ddshop-use]");
  if (u) { const [type, key] = u.dataset.ddshopUse.split(":"); use(type, key); rerender(); picker(type); return; }
  const b = e.target.closest("[data-ddshop-buy]");
  if (b) { const [type, key] = b.dataset.ddshopBuy.split(":"); buy(type, key); rerender(); picker(type); }
});

window.DDShop = { PRICE, owned, tiles, collections, picker, buy, use, openCollection };
})();
