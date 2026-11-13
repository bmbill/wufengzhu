/* 燈燈相續・一天一盞燈（window.DDLamp）
 *
 * 燈的畫法（20 種形制、燈身色、焰色、描金鎏金、紋樣）整段取自燈燈悅心 src/lamp.js（bmbill/dengdeng），
 * 決定燈的規則改成燈燈相續的四學：
 *   燈身色 ← 今天戒・定・慧・善哪一學做最多（你的選擇）；該做的幾學都做到 → 泥金
 *   焰　色 ← 連續天數剛好走到 7／21／49 的倍數那天變色，其他看今天的份量
 *   形　制 ← 每完成一件功課抽一次，只往上換（看到新的圖）；份量越足，難得的機率越高
 *   紋　樣 ← 這個人（S.lampPattern 可以換，例如用燈油在燈坊換）
 *
 * 一般 script，不是 ES module。讀的是 index.html 裡的全域 S、DAYS
 * （只讀，另外只寫 DAYS[日期].lamp、S.lampSalt）。接法見 lamp/README.md。
 */
(function () {
"use strict";
const BOWLS = {
  // 善行點滴 —— 朱
  cinnabar:  { name: '朱砂', dark: '#C4553A', light: '#D8674C', foot: '#A9713F' },
  vermilion: { name: '銀朱', dark: '#D4644A', light: '#E37B60', foot: '#B0603F' },
  // 觀功念恩 —— 黃
  gamboge:   { name: '藤黃', dark: '#C9952F', light: '#DCAB4C', foot: '#A9713F' },
  orpiment:  { name: '雌黃', dark: '#B8862A', light: '#CC9C42', foot: '#96682C' },
  // 誦經 —— 青
  azurite:   { name: '石青', dark: '#43707F', light: '#557F8F', foot: '#3B5E6B' },
  indigo:    { name: '螺青', dark: '#3A4A6B', light: '#4C5D80', foot: '#2E3A55' },
  // 其他 —— 赭
  ochre:     { name: '赭石', dark: '#A9713F', light: '#BC854F', foot: '#8A6234' },
  earth:     { name: '土黃', dark: '#B08A4E', light: '#C49E63', foot: '#8F6E3A' },
  // 均衡 —— 綠
  malachite: { name: '石綠', dark: '#4F6F4C', light: '#627F5E', foot: '#3F5A3C' },
  moss:      { name: '苔綠', dark: '#6E8F6B', light: '#83A17F', foot: '#55724F' },
  // 一天之內寫了三種不同的事，才會遇到
  gold:      { name: '泥金', dark: '#C9A227', light: '#E0BC4A', foot: '#A07E1B' },
};

const FLAMES = {
  gamboge:   { name: '藤黃焰', outer: '#D9A441', inner: '#C4553A', halo: '#F4D9A0' },
  cinnabar:  { name: '朱焰',   outer: '#C4553A', inner: '#F2C877', halo: '#F5A98A' },
  malachite: { name: '碧焰',   outer: '#6FB08C', inner: '#D9F0DF', halo: '#A8DCC0' },
  white:     { name: '白焰',   outer: '#EFE7D4', inner: '#9FD4E0', halo: '#BCE3EC' },
  azure:     { name: '青焰',   outer: '#6FA8C8', inner: '#E4F1F7', halo: '#A9D2E6' },
  violet:    { name: '紫焰',   outer: '#9B7BB8', inner: '#F0E4F5', halo: '#C9B0DC' },
};

/* ── 鎏金 ──
 *
 * 難得的燈其實看不見：燈海裡飄的是天燈，形制要點開才知道，
 * 而那盞天燈的紙是燈身色、底下的火是焰色，只有大小是稀有度。
 * 抽到難得卻幾乎看不出來，那個驚喜就沒有落地。
 *
 * 所以金不是第 12 種燈身色 —— 燈身色仍然是你決定的（今天寫了什麼）。
 * 金是加在上面的一層：少見描一道金邊，難得整盞鎏金、連焰心都是金的。
 * 這樣「顏色是你決定的，形制是運氣」沒有被打破，運氣只是多了顏色。
 */
const GILT = { rim: '#F2DFA8', deep: '#9C7516', core: '#F8E6B0' };

/** 金有名字才看得懂那道邊是什麼。常見的燈沒有金，也就沒有這一格。 */
const GILT_LABEL = { uncommon: '描金', rare: '鎏金' };

/* ── 形制 ──
 * tier: common / uncommon / rare
 * 名字取自佛教燈供的實際形制，不是隨便編的。 */

const FORMS = {
  round:   { name: '圓缽燈', tier: 'common' },
  square:  { name: '方座燈', tier: 'common' },
  tall:    { name: '高足燈', tier: 'common' },
  petal:   { name: '蓮瓣燈', tier: 'common' },

  tripod:  { name: '三足燈', tier: 'common' },
  tile:    { name: '瓦燈',   tier: 'common' },

  double:  { name: '雙層燈', tier: 'uncommon' },
  pond:    { name: '蓮池燈', tier: 'uncommon' },
  banner:  { name: '幡燈',   tier: 'uncommon' },
  handle:  { name: '提燈',   tier: 'uncommon' },

  cloud:   { name: '雲座燈', tier: 'uncommon' },
  bell:    { name: '鈴燈',   tier: 'uncommon' },
  fish:    { name: '雙魚燈', tier: 'uncommon' },

  pagoda:  { name: '塔燈',   tier: 'rare' },
  seven:   { name: '七層燈', tier: 'rare' },
  mani:    { name: '摩尼燈', tier: 'rare' },
  eternal: { name: '長明燈', tier: 'rare' },
  tree:    { name: '燈樹',   tier: 'rare' },
  boat:    { name: '法船燈', tier: 'rare' },
  wheel:   { name: '法輪燈', tier: 'rare' },
};

const TIER_LABEL = { common: '常見', uncommon: '少見', rare: '難得' };

/** 難得程度的高低。重抽只往上：抽到比現在這盞難得才換。 */
const TIER_RANK = { common: 0, uncommon: 1, rare: 2 };

/* ── 燈身紋樣 ──
 *
 * 這個不是抽的，是「誰供的」決定的：同一個人的燈永遠同一種紋。
 *
 * 為什麼要有它：形制和顏色都由當天做了什麼決定，所以一群人
 * 做同樣的事就會供出一模一樣的燈。紋樣讓每個人的燈認得出來——
 * 在共同燈海裡點開，一眼就知道是誰的。 */

const PATTERNS = {
  plain:  { name: '素面' },
  lotus:  { name: '蓮紋' },
  cloud:  { name: '雲紋' },
  key:    { name: '迴紋' },
  bead:   { name: '連珠' },
};

const PATTERN_KEYS = Object.keys(PATTERNS);

const PATTERN_ART = {
  plain: '',
  lotus: '<path d="M13.5 39.4q4.2 3.4 8.5 0M22 39.4q4.2 3.4 8.5 0" stroke="var(--light)" stroke-width="1.1" fill="none" opacity=".62" stroke-linecap="round"/>',
  cloud: '<path d="M12 39.8q2.5-2.2 5 0t5 0 5 0 5 0" stroke="var(--light)" stroke-width="1.1" fill="none" opacity=".62" stroke-linecap="round"/>',
  key:   [0, 1, 2, 3].map((i) => `<rect x="${13 + i * 4.8}" y="38.4" width="3.2" height="3.2" rx=".6" stroke="var(--light)" stroke-width="1" fill="none" opacity=".6"/>`).join(''),
  bead:  [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${13 + i * 3.4}" cy="40" r="1.05" fill="var(--light)" opacity=".62"/>`).join(''),
};

/** 同一個人永遠同一種紋。 */
function patternFor(ownerId) {
  return PATTERN_KEYS[hash(String(ownerId || '')) % PATTERN_KEYS.length];
}

/* ── 抽形制 ── */

function hash(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** 同一個 seed 永遠抽出同一盞燈，所以重新整理不會換獎。 */
function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickForm(seed, depth) {
  // 做得越滿，稀有形制的權重越高，但永遠不保證。
  const tierWeight = {
    common:   100 - 40 * depth,
    uncommon: 34 + 20 * depth,
    rare:     9 + 20 * depth,
  };
  const entries = Object.entries(FORMS);
  const weights = entries.map(([, f]) => tierWeight[f.tier]);
  const total = weights.reduce((a, b) => a + b, 0);

  let roll = rng(seed)() * total;
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return entries[i][0];
  }
  return entries[0][0];
}

/* ── 繪製 ──
 * viewBox 0 0 44 50：焰在上（y 5~25），缽口 y=31，缽底 y≈43.6，座 y=45.5。
 * 每個形制回傳 behind（畫在缽後面）與 front（畫在缽前面）兩段。 */

const FORM_ART = {
  round: () => ({ behind: '', front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>' }),

  square: () => ({
    behind: '',
    front: '<rect x="12" y="43.4" width="20" height="4.4" rx="1.6" fill="var(--foot)"/>',
  }),

  tall: () => ({
    behind: '',
    front: '<path d="M22 43v3.4" stroke="var(--foot)" stroke-width="3" stroke-linecap="round"/>'
         + '<ellipse cx="22" cy="47.4" rx="8.5" ry="2.2" fill="var(--foot)"/>',
  }),

  petal: () => ({
    behind: '<path d="M8 31c-3.4-1.4-5.6-3.6-6.4-6.6 3.4.3 6 2.4 6.4 6.6z" fill="var(--light)"/>'
          + '<path d="M36 31c3.4-1.4 5.6-3.6 6.4-6.6-3.4.3-6 2.4-6.4 6.6z" fill="var(--light)"/>',
    front: '<path d="M11 33.5c-1.8 2.6-2.2 5.2-1.2 7.8 2.4-1.6 3.6-4 3.4-7.2z" fill="var(--light)"/>'
         + '<path d="M33 33.5c1.8 2.6 2.2 5.2 1.2 7.8-2.4-1.6-3.6-4-3.4-7.2z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  tripod: () => ({
    behind: '',
    front: '<path d="M13.5 43.4l-2.4 4.4M22 44v4M30.5 43.4l2.4 4.4" stroke="var(--foot)" stroke-width="2.3" stroke-linecap="round"/>',
  }),

  tile: () => ({
    behind: '',
    front: '<path d="M8.5 43.6h27l2.8 4.2H5.7z" fill="var(--foot)"/>',
  }),

  cloud: () => ({
    behind: '',
    front: '<circle cx="13.5" cy="46.2" r="4.4" fill="var(--light)"/>'
         + '<circle cx="22" cy="45.4" r="5.4" fill="var(--light)"/>'
         + '<circle cx="30.5" cy="46.2" r="4.4" fill="var(--light)"/>',
  }),

  bell: () => ({
    behind: '',
    front: '<path d="M8.6 38v5.4M35.4 38v5.4" stroke="var(--foot)" stroke-width="1.3" stroke-linecap="round"/>'
         + '<path d="M6 48.4c0-2 1.2-3.4 2.6-3.4s2.6 1.4 2.6 3.4z" fill="var(--light)"/>'
         + '<path d="M32.8 48.4c0-2 1.2-3.4 2.6-3.4s2.6 1.4 2.6 3.4z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  fish: () => ({
    behind: '<path d="M4.5 33.5c3.4-3.4 6.8-4 9.4-1.6-1.6 3.4-5 4.8-9.4 3.4z" fill="#9FD4E0"/>'
          + '<path d="M39.5 33.5c-3.4-3.4-6.8-4-9.4-1.6 1.6 3.4 5 4.8 9.4 3.4z" fill="#9FD4E0"/>'
          + '<circle cx="7.6" cy="33.4" r=".9" fill="#3B5E6B"/><circle cx="36.4" cy="33.4" r=".9" fill="#3B5E6B"/>',
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  tree: () => ({
    behind: '<path d="M22 30V13M22 20l-8-5M22 20l8-5M22 26l-6.5-4M22 26l6.5-4" stroke="var(--foot)" stroke-width="1.6" stroke-linecap="round" fill="none"/>'
          + [[14, 15], [30, 15], [15.5, 22], [28.5, 22], [22, 12]].map(([x, y]) =>
              `<circle cx="${x}" cy="${y}" r="2.4" fill="var(--flame-outer)" opacity=".9"/>`).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  boat: () => ({
    behind: '',
    front: '<path d="M3.5 43.4h37c-1.8 4.6-7.4 7-18.5 7S5.3 48 3.5 43.4z" fill="var(--foot)"/>'
         + '<path d="M9 46.4h26" stroke="var(--light)" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>',
  }),

  wheel: () => ({
    behind: '<circle cx="22" cy="19" r="15" stroke="var(--flame-halo)" stroke-width="1.8" fill="none" opacity=".6"/>'
          + '<circle cx="22" cy="19" r="4.6" stroke="var(--flame-halo)" stroke-width="1.5" fill="none" opacity=".6"/>'
          + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (Math.PI * 2 * i) / 8;
              const x1 = (22 + Math.cos(a) * 5).toFixed(1);
              const y1 = (19 + Math.sin(a) * 5).toFixed(1);
              const x2 = (22 + Math.cos(a) * 14.4).toFixed(1);
              const y2 = (19 + Math.sin(a) * 14.4).toFixed(1);
              return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--flame-halo)" stroke-width="1.3" opacity=".5"/>`;
            }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  double: () => ({
    behind: '',
    front: '<path d="M11.5 44h21c0 3.4-4.7 5.5-10.5 5.5S11.5 47.4 11.5 44z" fill="var(--foot)"/>',
  }),

  pond: () => ({
    behind: '<path d="M4.5 30.5c2.6-1.6 5.4-2.4 8.4-2.4-1.6 2.6-3.9 4.5-6.9 5.6-1.5.6-2.6-2.3-1.5-3.2z" fill="#9FBE9C"/>'
          + '<path d="M39.5 30.5c-2.6-1.6-5.4-2.4-8.4-2.4 1.6 2.6 3.9 4.5 6.9 5.6 1.5.6 2.6-2.3 1.5-3.2z" fill="#9FBE9C"/>',
    front: '<path d="M6 46.5c4.5-1.6 9.8-2.4 16-2.4s11.5.8 16 2.4" stroke="#6E8F6B" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  }),

  banner: () => ({
    behind: '',
    front: '<path d="M10 43.5c0 3.5-.6 5.4-1.8 6 -1.2-.6-1.8-2.5-1.8-6z" fill="var(--light)"/>'
         + '<path d="M37.6 43.5c0 3.5-.6 5.4-1.8 6 -1.2-.6-1.8-2.5-1.8-6z" fill="var(--light)"/>'
         + '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  handle: () => ({
    behind: '<path d="M10 30C10 20 15 15 22 15s12 5 12 15" stroke="var(--foot)" stroke-width="2" fill="none" stroke-linecap="round"/>',
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  pagoda: () => ({
    behind: '<path d="M22 2.5l9 5.5H13z" fill="var(--dark)"/>'
          + '<path d="M22 8.5l7.5 4.5h-15z" fill="var(--light)"/>',
    front: '<path d="M10 43.8h24l-2.5 4.4h-19z" fill="var(--foot)"/>',
  }),

  seven: () => ({
    behind: [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = (-Math.PI * 0.82) + (Math.PI * 0.64 * i) / 6;
      const x = (22 + Math.cos(a) * 17).toFixed(1);
      const y = (30 + Math.sin(a) * 15).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="1.9" fill="var(--flame-outer)" opacity=".85"/>`;
    }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  mani: () => ({
    behind: '<circle cx="22" cy="17" r="13.5" fill="var(--flame-halo)" opacity=".3"/>'
          + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
              const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
              const x1 = (22 + Math.cos(a) * 15.5).toFixed(1);
              const y1 = (17 + Math.sin(a) * 15.5).toFixed(1);
              const x2 = (22 + Math.cos(a) * 19).toFixed(1);
              const y2 = (17 + Math.sin(a) * 19).toFixed(1);
              return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="var(--flame-outer)" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
            }).join(''),
    front: '<path d="M14.5 45.5h15" stroke="var(--foot)" stroke-width="2.4" stroke-linecap="round"/>',
  }),

  eternal: () => ({
    behind: '<circle cx="22" cy="19" r="16" stroke="var(--flame-halo)" stroke-width="1.6" fill="none" opacity=".55"/>'
          + '<circle cx="22" cy="19" r="19.5" stroke="var(--flame-halo)" stroke-width="1" fill="none" opacity=".3"/>',
    front: '<path d="M11.5 44h21c0 3.4-4.7 5.5-10.5 5.5S11.5 47.4 11.5 44z" fill="var(--foot)"/>'
         + '<path d="M17 47h10" stroke="var(--light)" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>',
  }),
};

/** 缽身。鎏金要沿著同一條路徑描，所以抽出來共用。 */
const BOWL = 'M8 31h28c0 7.8-6.3 12.6-14 12.6S8 38.8 8 31z';

/**
 * 把一盞燈畫成 SVG 字串。
 * @param {{form:string, bowl:string, flame:string}} lamp
 * @param {{size?:number, lit?:boolean}} opts lit=false 畫成未點亮的灰燈
 */
function renderLamp(lamp, opts = {}) {
  const { size = 120, lit = true } = opts;
  const b = BOWLS[lamp.bowl] || BOWLS.cinnabar;
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  const art = (FORM_ART[lamp.form] || FORM_ART.round)();

  // 沒點亮的灰燈不鎏金。舊資料沒存 tier，從形制查得回來。
  const tier = lit ? (lamp.tier || (FORMS[lamp.form]&&FORMS[lamp.form].tier) || 'common') : 'common';

  const vars = lit
    ? `--dark:${b.dark};--light:${b.light};--foot:${b.foot};--flame-outer:${f.outer};--flame-halo:${f.halo}`
    : '--dark:#DDD2BE;--light:#E6DDCB;--foot:#CFC2AA;--flame-outer:#DDD2BE;--flame-halo:#E6DDCB';

  const flame = lit
    ? `<ellipse cx="22" cy="17" rx="10.5" ry="14" fill="${f.halo}" opacity=".45"/>
       <path d="M22 5.5c4.4 6 6.8 9.3 6.8 12.9a6.8 6.8 0 0 1-13.6 0c0-3.6 2.4-6.9 6.8-12.9z" fill="${f.outer}"/>
       <path d="M22 13.6c2.1 3.3 3.1 5 3.1 6.6a3.1 3.1 0 0 1-6.2 0c0-1.6 1-3.3 3.1-6.6z" fill="${tier === 'rare' ? GILT.core : f.inner}"/>`
    : '';

  // xmlns 是必要的：內嵌在 HTML 裡沒差，但把這串 SVG 當成圖片載入
  // （分享圖卡會這樣做）時，少了它整張圖就不會 render。
  // 紋樣畫在缽身上。舊資料沒有這個欄位，就當素面。
  const pattern = lit ? (PATTERN_ART[lamp.pattern] || '') : '';

  // 金邊描兩道：深的在下、亮的在上。一道不夠——泥金的燈身本來就是金的，
  // 單描一條亮金等於沒描；有了深色那道才有邊，深淺燈身都看得出來。
  const edge = (d, w, cap) =>
    `<path d="${d}" fill="none" stroke="${GILT.deep}" stroke-width="${w + 1.2}" stroke-linejoin="round" stroke-linecap="${cap}" opacity=".55"/>`
    + `<path d="${d}" fill="none" stroke="${GILT.rim}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="${cap}"/>`;

  // 難得描整圈（那條路徑自己就含缽口），少見只描缽口那一道。
  const gilt = tier === 'rare'
    ? edge(BOWL, 1.4, 'round')
    : tier === 'uncommon'
      ? edge('M8 31h28', 1.3, 'round')
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 50 / 44)}" viewBox="0 0 44 50" fill="none" style="${vars}" role="img" aria-label="${lamp.name || '燈'}">
    ${art.behind}
    ${flame}
    <path d="${BOWL}" fill="var(--dark)"/>
    <path d="M8 31h28c0 2.5-.7 4.7-1.9 6.5H9.9C8.7 35.7 8 33.5 8 31z" fill="var(--light)"/>
    ${pattern}
    ${gilt}
    ${art.front}
  </svg>`;
}

/**
 * 把 CSS 變數換成實際顏色。
 * 畫到 canvas 的時候需要 —— SVG 被當成圖片載入時沒有外部樣式表，
 * var(--dark) 這種寫法會變成沒有顏色。
 */
function renderLampFlat(lamp, opts = {}) {
  const b = BOWLS[lamp.bowl] || BOWLS.cinnabar;
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  return renderLamp(lamp, opts)
    .replace(/var\(--dark\)/g, b.dark)
    .replace(/var\(--light\)/g, b.light)
    .replace(/var\(--foot\)/g, b.foot)
    .replace(/var\(--flame-outer\)/g, f.outer)
    .replace(/var\(--flame-halo\)/g, f.halo);
}

/* ── 天上那盞燈 ──
 *
 * 試過兩種都不對：
 * 畫成圓光點，一整片看下來是一堆圓圈，看不出是燈；
 * 把缽畫出來，缽是該擺在桌上的東西，讓它浮在半空就成了鬼火。
 *
 * 所以改成天燈。天燈本來就是飄在天上的燈——它浮著是對的，
 * 底下那圈火光也是真的往下開口。形狀是個鼓起來的紙袋，不是圓；
 * 紙身用燈身色、底下的火用焰色，「暈是你決定的、焰是運氣」照舊。
 * 骨架和提把在這個尺寸畫出來只會糊成一團，所以不畫。
 */
const SPARK_VB = { x: 0, y: 0, w: 28, h: 34 };

/** 紙身。鼓起來，往下收口。 */
const SKY_BODY = 'M14 2.5C19.4 2.5 22.5 6.3 22.5 11.3C22.5 15.8 21.2 20 20.1 23.4'
  + 'C19.8 24.5 19.2 25 18.2 25H9.8C8.8 25 8.2 24.5 7.9 23.4C6.8 20 5.5 15.8 5.5 11.3'
  + 'C5.5 6.3 8.6 2.5 14 2.5Z';

/** 下半截。火在底下，紙是從下往上被照亮的，所以近火這一圈比上面亮。
 * 只取最下面那一截——分到一半就不是被照亮，是兩塊拼色。 */
const SKY_LIT = 'M6.9 17.5C9 18.3 11.4 18.6 14 18.6C16.6 18.6 19 18.3 21.1 17.5'
  + 'C20.7 20 20.4 22 20.1 23.4C19.8 24.5 19.2 25 18.2 25H9.8C8.8 25 8.2 24.5 7.9 23.4'
  + 'C7.6 22 7.3 20 6.9 17.5Z';

const SKY_MOUTH = 'M9.8 25h8.4';

/**
 * 天上那盞燈，畫在 28×34 的格子裡。
 * DOM 包成 <svg viewBox>，分享圖包成 <g transform>，兩邊是同一段。
 */
function sparkArt(lamp) {
  const f = FLAMES[lamp.flame] || FLAMES.gamboge;
  const b = BOWLS[lamp.bowl] || BOWLS.cinnabar;
  const tier = lamp.tier || 'common';

  // 鎏金在這裡是一圈金邊，不是更亮 —— 亮度已經被隨喜佔走了，
  // 兩件事用同一個訊號就會分不出「難得」和「很多人隨喜」。
  // 跟大燈同一條規矩：難得描整張紙，少見只描底下開口那一道。
  const edge = (d, w, cap) =>
    `<path d="${d}" fill="none" stroke="${GILT.deep}" stroke-width="${(w + 1).toFixed(1)}" stroke-linejoin="round" stroke-linecap="${cap}" opacity=".55"/>`
    + `<path d="${d}" fill="none" stroke="${GILT.rim}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="${cap}"/>`;
  const gilt = tier === 'rare'
    ? edge(SKY_BODY, 1.1, 'round')
    : tier === 'uncommon' ? edge(SKY_MOUTH, 1.1, 'round') : '';

  // 開口就是火本身，所以不另外畫一簇焰——這個尺寸畫了只會變成一個三角形。
  return `<path d="${SKY_BODY}" fill="${b.dark}"/>
    <path d="${SKY_LIT}" fill="${b.light}"/>
    <ellipse cx="14" cy="24.1" rx="3.9" ry="1.7" fill="${f.outer}"/>
    <ellipse cx="14" cy="24.3" rx="2" ry=".9" fill="${tier === 'rare' ? GILT.core : f.inner}"/>
    ${gilt}`;
}


/* ══════════════ 燈燈相續：四學決定一盞燈 ══════════════ */

const XUE = {
  jie:  { name: "戒", fam: ["cinnabar", "vermilion"] },
  ding: { name: "定", fam: ["gamboge", "orpiment"] },
  hui:  { name: "慧", fam: ["azurite", "indigo"] },
  shan: { name: "善", fam: ["moss", "malachite"] },
};
const XUE_KEYS = ["jie", "ding", "hui", "shan"];

/* index.html 的 S、DAYS 是頂層 let（不在 window 上），但同一頁的 script 之間叫得到 */
function gS() { try { return S; } catch (e) { return window.S || {}; } }
function gDays() { try { return DAYS; } catch (e) { return window.DAYS || {}; } }
function todayK() {
  try { return today(); } catch (e) {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
}
function save(date) { try { persist(date); } catch (e) { if (window.DDLampDemoSave) window.DDLampDemoSave(); } }
function dayOf(date) {
  const D = gDays();
  if (!D[date]) D[date] = { sits: [] };
  return D[date];
}
function shift(date, n) { const d = new Date(date + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

/** 該做到幾學才算「都做到」：沒開毗缽舍那的人，慧不算進去。 */
function needKinds() { return gS().vipOn ? 4 : 3; }

/** 某一天四學各做了幾件。資料來源都是燈燈相續原本就有的紀錄。 */
function countsOf(date) {
  const S_ = gS(), d = gDays()[date] || {};
  const on = (obj) => { let n = 0; for (const k in obj || {}) if (obj[k] === date) n++; return n; };
  const c = {
    jie: on(S_.lr && S_.lr.done) + (d.hb ? 1 : 0) + (d.night ? 1 : 0),
    ding: (d.sits || []).length + (d.min ? 1 : 0) + (d.breath ? 1 : 0) + on(S_.heard),
    hui: (d.vthink ? 1 : 0) + on(S_.vheard) + on(S_.vquiz),
    shan: (d.shan || []).length,
  };
  c.total = c.jie + c.ding + c.hui + c.shan;
  c.kinds = XUE_KEYS.filter((k) => c[k] > 0).length;
  return c;
}

/** 0~1：今天做得多滿。只影響抽到難得形制的機率，不影響燈亮不亮。 */
function depthOf(c) {
  return Math.min(1, c.total / 6) * 0.7 + Math.min(1, c.kinds / needKinds()) * 0.3;
}

function bowlFor(c) {
  if (c.kinds >= needKinds()) return "gold";
  const deep = depthOf(c) >= 0.5 ? 1 : 0;
  const w = XUE_KEYS.map((k) => [k, c[k]]).sort((a, b) => b[1] - a[1]);
  if (w[0][1] <= 0) return XUE.shan.fam[0];
  if (w[1][1] > 0 && w[1][1] >= w[0][1] * 0.8) return ["ochre", "earth"][deep];   // 兩學差不多：赭
  return XUE[w[0][0]].fam[deep];
}

function flameFor(c, streak) {
  const n = streak || 0;
  if (n > 0 && n % 49 === 0) return "violet";
  if (n > 0 && n % 21 === 0) return "azure";
  if (n > 0 && n % 7 === 0) return "white";
  if (c.kinds >= 3) return "malachite";
  if (c.total >= 4) return "cinnabar";
  return "gamboge";
}

/** 有做功課的日子（任何一學）。 */
function activeDates() {
  const set = new Set(), S_ = gS(), D = gDays();
  for (const k in D) {
    const d = D[k];
    if (d && ((d.sits || []).length || d.min || d.breath || d.night || d.hb || d.vthink || (d.shan || []).length)) set.add(k);
  }
  [S_.lr && S_.lr.done, S_.heard, S_.vheard, S_.vquiz].forEach((o) => { for (const k in o || {}) if (o[k]) set.add(o[k]); });
  return set;
}

/** 連續天數：從這一天往回數。斷了只是那天空著，燈不會不見。 */
function streakAt(date, set) {
  set = set || activeDates();
  let n = 0, k = date;
  while (set.has(k)) { n++; k = shift(k, -1); }
  return n;
}

function salt() {
  const S_ = gS();
  if (!S_.lampSalt) S_.lampSalt = Math.random().toString(36).slice(2, 10);
  return S_.lampSalt;
}

function firstDate() {
  const D = gDays();
  return Object.keys(D).filter((k) => D[k] && D[k].lamp).sort()[0] || null;
}

/** 組出某一天的燈（顏色、焰色依紀錄算；形制讀存下來的）。沒有燈回傳 null。 */
function lampOf(date, set) {
  const d = gDays()[date];
  if (!d || !d.lamp) return null;
  const c = countsOf(date);
  const S_ = gS();
  const form = FORMS[d.lamp.form] ? d.lamp.form : "round";
  return {
    date, form,
    tier: FORMS[form].tier,
    bowl: bowlFor(c),
    flame: flameFor(c, streakAt(date, set)),
    pattern: S_.lampPattern || patternFor(salt()),
    name: date === firstDate() ? "初發心燈" : FORMS[form].name,
    counts: c,
  };
}

/**
 * 做完一件功課之後呼叫。今天每多一件就多抽一次，只往上換。
 * 回傳 { lamp, changed }：changed = "new"（第一次點亮）／"up"（換成更難得的）／
 * "same"（抽了但留原本的）／null（沒變）。過去的日子不再抽（那天的燈已經定了）。
 */
function sync(date) {
  date = date || todayK();
  const c = countsOf(date);
  const d = dayOf(date);
  if (!c.total) {            // 全部移掉了（例如刪掉唯一一則善行）：今天的燈收回去
    if (d.lamp && date === todayK()) { delete d.lamp; save(date); }
    return { lamp: null, changed: null };
  }
  if (date !== todayK() && d.lamp) return { lamp: lampOf(date), changed: null };
  let form = d.lamp ? d.lamp.form : null, n = d.lamp ? d.lamp.n : 0, changed = null;
  const depth = depthOf(c);
  while (n < c.total) {
    n++;
    const f = pickForm(date + "|" + salt() + "|" + n, depth);
    if (!form) { form = f; changed = "new"; }
    else if (TIER_RANK[FORMS[f].tier] > TIER_RANK[FORMS[form].tier]) { form = f; changed = "up"; }
    else if (!changed) changed = "same";
  }
  if (!d.lamp || d.lamp.form !== form || d.lamp.n !== n) { d.lamp = { form, n }; save(date); }
  return { lamp: lampOf(date), changed };
}

/** 所有點亮過的燈，照日期排。 */
function list() {
  const D = gDays(), set = activeDates();
  return Object.keys(D).filter((k) => D[k] && D[k].lamp).sort().map((k) => lampOf(k, set));
}

/** 燈身色屬於哪一學（燈譜收集顏色用）：jie／ding／hui／shan／gold；兩學差不多的赭色不算。 */
function colorOf(bowl) {
  if (bowl === "gold") return "gold";
  for (const k of XUE_KEYS) if (XUE[k].fam.includes(bowl)) return k;
  return null;
}
const COLORS = ["jie", "ding", "hui", "shan", "gold"];

/** 點過哪些形制（燈譜用）：{形制: 第一次點亮的那盞燈}；colors 是這個形制點過哪幾種顏色。 */
function seenForms() {
  const out = {};
  list().forEach((l) => {
    if (!out[l.form]) out[l.form] = Object.assign({}, l, { colors: {} });
    const c = colorOf(l.bowl);
    if (c && !out[l.form].colors[c]) out[l.form].colors[c] = l.date;
  });
  return out;
}

/** 燈油加成建議：善行每則 +1（每天最多 3）、該做的幾學都做到 +3。給 index.html 的 oil() 加總用。 */
function oilBonus() {
  const D = gDays(); let o = 0;
  for (const k in D) {
    const d = D[k]; if (!d) continue;
    o += Math.min(3, (d.shan || []).length);
    if (d.lamp && countsOf(k).kinds >= needKinds()) o += 3;
  }
  return o;
}

/* ── 畫面 ── */

const esc_ = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** 四學的小圓點：做了的亮，沒做的淡。 */
function dots(c) {
  const keys = needKinds() === 4 ? XUE_KEYS : ["jie", "ding", "shan"];
  return `<span class="ddl-dots">${keys.map((k) => `<i class="x-${k}${c && c[k] ? " on" : ""}" title="${XUE[k].name}${c && c[k] ? " " + c[k] : ""}">${XUE[k].name}</i>`).join("")}</span>`;
}

const GREY = { form: "round", bowl: "cinnabar", flame: "gamboge", name: "還沒點亮" };

/** 首頁「今天的燈」小卡（還沒點亮就是灰燈）。點了看今天做了什麼。 */
function todayCard() {
  const t = todayK(), l = lampOf(t), c = countsOf(t);
  const art = l ? renderLamp(l, { size: 52 }) : renderLamp(GREY, { size: 52, lit: false });
  return `<button class="ddl-today" data-ddl-open="${t}" aria-label="今天的燈${l ? "：" + esc_(l.name) : "，還沒點亮"}">
    <span class="ddl-art">${art}</span>
    <span class="ddl-meta"><b>${l ? esc_(l.name) : "今天的燈"}</b>${l && l.tier !== "common" ? `<small class="ddl-tier t-${l.tier}">${TIER_LABEL[l.tier]}</small>` : ""}${dots(c)}</span>
  </button>`;
}

function overlay(html) {
  let L = document.getElementById("layer");
  if (!L) { L = document.createElement("div"); L.id = "layer"; document.body.appendChild(L); }
  L.innerHTML = `<div class="sheet ddl-sheet" role="dialog" aria-modal="true"><div class="panel">${html}</div></div>`;
  L.querySelectorAll("[data-ddl-close]").forEach((b) => { b.onclick = () => { L.innerHTML = ""; }; });
  return L;
}

/** 點亮／換燈的那一下。changed="same" 只跳一行小提示。 */
function reveal(res) {
  if (!res || !res.lamp || !res.changed) return;
  const l = res.lamp;
  if (res.changed === "same") {
    try { toast(`又抽了一次，留著「${l.name}」`); } catch (e) {}
    return;
  }
  const head = res.changed === "new" ? "今天的燈點亮了" : "換成更難得的燈";
  overlay(`<div class="ddl-reveal ${res.changed}"><div class="ddl-glow"></div>${renderLamp(l, { size: 150 })}</div>
    <p class="ddl-eyebrow">${head}</p>
    <h2 class="ddl-name">${esc_(l.name)}</h2>
    <p class="ddl-sub"><span class="ddl-tier${l.tier !== "common" ? " t-" + l.tier : ""}">${TIER_LABEL[l.tier]}${GILT_LABEL[l.tier] ? "・" + GILT_LABEL[l.tier] : ""}</span> ${BOWLS[l.bowl].name}・${FLAMES[l.flame].name}</p>
    ${dots(l.counts)}
    <p class="ddl-hint">今天每多做一件，就再抽一次，只會往上換。</p>
    <div class="btns"><button class="btn primary" data-ddl-close>好</button></div>`);
}

/** 點開某一天的燈：那天做了什麼。 */
function openDay(date) {
  const l = lampOf(date), c = countsOf(date), d = gDays()[date] || {};
  const shan = (d.shan || []).map((e) => `<li class="ddl-shan"><span class="k">${esc_((window.Shan && Shan.KINDS[e.k] || {}).icon || "")}</span>${esc_(e.t || "")}${e.p ? `<small>${esc_(e.s || "")} ${e.p} 頁</small>` : ""}</li>`).join("");
  const rows = XUE_KEYS.filter((k) => c[k]).map((k) => `<span class="ddl-row x-${k}"><i>${XUE[k].name}</i>${c[k]}</span>`).join("");
  overlay(`<div class="ddl-reveal">${renderLamp(l || GREY, { size: 110, lit: !!l })}</div>
    <h2 class="ddl-date">${Number(date.slice(5, 7))}／${Number(date.slice(8))}</h2>
    <p class="ddl-sub">${l ? `${esc_(l.name)}・${TIER_LABEL[l.tier]}` : "這一天還沒點燈"}</p>
    ${rows ? `<div class="ddl-rows">${rows}</div>` : ""}
    ${shan ? `<ul class="ddl-shans">${shan}</ul>` : ""}
    <div class="btns"><button class="btn" data-ddl-close>關閉</button></div>`);
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ddl-open]");
  if (b) openDay(b.dataset.ddlOpen);
});

window.DDLamp = {
  // 畫
  render: renderLamp, renderFlat: renderLampFlat, sparkArt, SPARK_VB, GREY,
  // 常數
  BOWLS, FLAMES, FORMS, TIER_LABEL, TIER_RANK, GILT, GILT_LABEL, PATTERNS, XUE, XUE_KEYS,
  // 資料
  countsOf, lampOf, sync, list, seenForms, colorOf, COLORS, streakAt, activeDates, needKinds, oilBonus, firstDate, today: todayK,
  // 畫面
  todayCard, reveal, openDay, dots, overlay,
};
})();
