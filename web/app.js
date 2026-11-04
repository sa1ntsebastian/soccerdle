'use strict';

/* =========================================================================
   Soccerdle
   Reine statische Seite: keine Abhängigkeiten, kein Build, kein Server.
   ========================================================================= */

const CONFIG = {
  // Testphase: zeigt "Neues Rätsel (Test)" – lädt zufällige Spieler aus dem Tages-Pool,
  // ohne Statistik/Tagesrätsel zu verändern. VOR DEM LAUNCH auf false setzen.
  testMode: true,
  season: 'Champions League 2026/27',
  launchDate: '2026-11-01',      // Tag 1 für die Rätsel-Nummer
  timeZone: 'Europe/Vienna',     // Tageswechsel um Mitternacht (AT/DE)
  dailyPoolSize: 100,            // Täglich: nur die bekanntesten N Spieler
  difficulty: { leicht: 100, mittel: 300, schwer: Infinity }, // Endlos: Top-N nach Bekanntheit
  // Gesucht wird nie ein Spieler unter dieser Bekanntheit (Wikipedia-Aufrufe/Jahr, en+de).
  // Tippen darf man trotzdem alle. Grenze ~100k = ca. 450 von 983 CL-Spielern.
  minPageviewsForSolution: 100000,
  near: { age: 2, height: 3, number: 3 },
  hints: [
    { after: 4,  label: 'Detailposition', get: p => SUBPOS[p.subPosition] || p.subPosition || '–' },
    { after: 7,  label: 'Verein',         get: p => p.club },
    { after: 10, label: 'Initialen',      get: p => initials(p.name) },
  ],
};

// FIFA-Code -> [Name, Kontinentalverband]. Flaggen liegen als flags/<CODE>.svg bereit.
const COUNTRIES = {
  GER: ['Deutschland', 'UEFA'], AUT: ['Österreich', 'UEFA'], SUI: ['Schweiz', 'UEFA'], FRA: ['Frankreich', 'UEFA'],
  ESP: ['Spanien', 'UEFA'], POR: ['Portugal', 'UEFA'], ITA: ['Italien', 'UEFA'], ENG: ['England', 'UEFA'],
  SCO: ['Schottland', 'UEFA'], WAL: ['Wales', 'UEFA'], NIR: ['Nordirland', 'UEFA'], IRL: ['Irland', 'UEFA'],
  NED: ['Niederlande', 'UEFA'], BEL: ['Belgien', 'UEFA'], DEN: ['Dänemark', 'UEFA'], NOR: ['Norwegen', 'UEFA'],
  SWE: ['Schweden', 'UEFA'], FIN: ['Finnland', 'UEFA'], ISL: ['Island', 'UEFA'], POL: ['Polen', 'UEFA'],
  CZE: ['Tschechien', 'UEFA'], SVK: ['Slowakei', 'UEFA'], HUN: ['Ungarn', 'UEFA'], SVN: ['Slowenien', 'UEFA'],
  CRO: ['Kroatien', 'UEFA'], SRB: ['Serbien', 'UEFA'], BIH: ['Bosnien-H.', 'UEFA'], MNE: ['Montenegro', 'UEFA'],
  MKD: ['Nordmazedonien', 'UEFA'], ALB: ['Albanien', 'UEFA'], KVX: ['Kosovo', 'UEFA'], GRE: ['Griechenland', 'UEFA'],
  TUR: ['Türkei', 'UEFA'], ROU: ['Rumänien', 'UEFA'], BUL: ['Bulgarien', 'UEFA'], UKR: ['Ukraine', 'UEFA'],
  RUS: ['Russland', 'UEFA'], GEO: ['Georgien', 'UEFA'], ARM: ['Armenien', 'UEFA'], AZE: ['Aserbaidschan', 'UEFA'],
  ISR: ['Israel', 'UEFA'], CYP: ['Zypern', 'UEFA'], LUX: ['Luxemburg', 'UEFA'], EST: ['Estland', 'UEFA'],
  LVA: ['Lettland', 'UEFA'], LTU: ['Litauen', 'UEFA'], BLR: ['Belarus', 'UEFA'], MDA: ['Moldau', 'UEFA'],
  KAZ: ['Kasachstan', 'UEFA'],
  BRA: ['Brasilien', 'CONMEBOL'], ARG: ['Argentinien', 'CONMEBOL'], URU: ['Uruguay', 'CONMEBOL'], COL: ['Kolumbien', 'CONMEBOL'],
  ECU: ['Ecuador', 'CONMEBOL'], CHI: ['Chile', 'CONMEBOL'], PAR: ['Paraguay', 'CONMEBOL'], PER: ['Peru', 'CONMEBOL'],
  VEN: ['Venezuela', 'CONMEBOL'], BOL: ['Bolivien', 'CONMEBOL'],
  USA: ['USA', 'CONCACAF'], CAN: ['Kanada', 'CONCACAF'], MEX: ['Mexiko', 'CONCACAF'], CRC: ['Costa Rica', 'CONCACAF'],
  JAM: ['Jamaika', 'CONCACAF'], PAN: ['Panama', 'CONCACAF'], HON: ['Honduras', 'CONCACAF'], HAI: ['Haiti', 'CONCACAF'],
  CUW: ['Curaçao', 'CONCACAF'], SUR: ['Suriname', 'CONCACAF'], DOM: ['Dom. Republik', 'CONCACAF'], GLP: ['Guadeloupe', 'CONCACAF'],
  MAR: ['Marokko', 'CAF'], ALG: ['Algerien', 'CAF'], TUN: ['Tunesien', 'CAF'], EGY: ['Ägypten', 'CAF'],
  SEN: ['Senegal', 'CAF'], CIV: ['Elfenbeinküste', 'CAF'], GHA: ['Ghana', 'CAF'], NGA: ['Nigeria', 'CAF'],
  CMR: ['Kamerun', 'CAF'], MLI: ['Mali', 'CAF'], BFA: ['Burkina Faso', 'CAF'], GUI: ['Guinea', 'CAF'],
  COD: ['DR Kongo', 'CAF'], CGO: ['Kongo', 'CAF'], GAB: ['Gabun', 'CAF'], RSA: ['Südafrika', 'CAF'],
  ANG: ['Angola', 'CAF'], CPV: ['Kap Verde', 'CAF'], GAM: ['Gambia', 'CAF'], ZAM: ['Sambia', 'CAF'],
  ZIM: ['Simbabwe', 'CAF'], TOG: ['Togo', 'CAF'], BEN: ['Benin', 'CAF'], EQG: ['Äquatorialguinea', 'CAF'],
  GNB: ['Guinea-Bissau', 'CAF'], MAD: ['Madagaskar', 'CAF'], MOZ: ['Mosambik', 'CAF'], KEN: ['Kenia', 'CAF'],
  LBY: ['Libyen', 'CAF'], MTN: ['Mauretanien', 'CAF'], RWA: ['Ruanda', 'CAF'],
  JPN: ['Japan', 'AFC'], KOR: ['Südkorea', 'AFC'], CHN: ['China', 'AFC'], AUS: ['Australien', 'AFC'],
  IRN: ['Iran', 'AFC'], IRQ: ['Irak', 'AFC'], KSA: ['Saudi-Arabien', 'AFC'], QAT: ['Katar', 'AFC'],
  UAE: ['VAE', 'AFC'], UZB: ['Usbekistan', 'AFC'], JOR: ['Jordanien', 'AFC'], SYR: ['Syrien', 'AFC'],
  PHI: ['Philippinen', 'AFC'], IDN: ['Indonesien', 'AFC'],
  NZL: ['Neuseeland', 'OFC'],
};

const SUBPOS = {
  'Goalkeeper': 'Torwart', 'Centre-Back': 'Innenverteidiger', 'Left-Back': 'Linksverteidiger',
  'Right-Back': 'Rechtsverteidiger', 'Defensive Midfield': 'Defensives MF', 'Central Midfield': 'Zentrales MF',
  'Attacking Midfield': 'Offensives MF', 'Left Midfield': 'Linkes MF', 'Right Midfield': 'Rechtes MF',
  'Left Winger': 'Linksaußen', 'Right Winger': 'Rechtsaußen', 'Second Striker': 'Hängende Spitze',
  'Centre-Forward': 'Mittelstürmer',
};
const FOOT = { R: 'Rechts', L: 'Links', B: 'Beide' };
const POS_ORDER = ['TW', 'ABW', 'MF', 'ST'];

/* ---------- Icons ---------- */
const ICON = {
  pitch(active) {
    const zones = [['TW', 0, 9], ['ABW', 9, 17], ['MF', 26, 18], ['ST', 44, 16]];
    return `<svg class="ico-pitch" viewBox="0 0 60 40" aria-hidden="true">
      ${zones.map(([z, x, w]) => `<rect x="${x}" y="0" width="${w}" height="40" class="${active.includes(z) ? 'on' : ''}"/>`).join('')}
      <rect x="0.75" y="0.75" width="58.5" height="38.5" class="line"/><line x1="30" y1="0" x2="30" y2="40" class="line"/>
      <circle cx="30" cy="20" r="6" class="line"/><rect x="0.75" y="11" width="7" height="18" class="line"/></svg>`;
  },
  feet(f) {
    const sole = 'M10 2 C15 2 17 8 16 15 C15 22 14 26 14 31 C14 35 12 38 9 38 C6 38 4 35 4 31 C4 25 3 20 4 13 C5 6 6 2 10 2 Z';
    const on = s => (f === s || f === 'B') ? 'on' : '';
    return `<svg class="ico-feet" viewBox="0 0 44 40" aria-hidden="true">
      <path d="${sole}" transform="translate(21 0) scale(-1 1)" class="${on('L')}"/><path d="${sole}" transform="translate(22 0)" class="${on('R')}"/></svg>`;
  },
  // Nur bekannte FIFA-Codes (Wikidata liefert z. B. "GBR" für britische Staatsbürgerschaft -> keine Flagge statt Kürzel)
  flag: code => COUNTRIES[code] ? `<img class="flag" src="flags/${encodeURIComponent(code)}.svg" alt="" loading="lazy"
    onerror="this.outerHTML='<span class=&quot;flag-fallback&quot;>${esc(code)}</span>'">` : '',
  up: '<svg class="dir" viewBox="0 0 24 24" aria-label="höher"><path d="M12 20V5M5 11l7-7 7 7"/></svg>',
  down: '<svg class="dir" viewBox="0 0 24 24" aria-label="niedriger"><path d="M12 4v15M5 13l7 7 7-7"/></svg>',
  info: '<svg class="info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>',
  lock: '<svg class="ico-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};

/* ---------- Daten ---------- */
const DATA = window.SOCCERDLE_DATA || { players: [], updated: '?' };
const PLAYERS = [...DATA.players].sort((a, b) => (b.pageviews || 0) - (a.pageviews || 0)); // Index = Rang
const BY_ID = new Map(PLAYERS.map(p => [p.id, p]));
const DUP_NAMES = (() => { // gleiche Namen -> Verein in der Suche dazuschreiben
  const seen = new Set(), dup = new Set();
  for (const p of PLAYERS) { const n = p.name.toLowerCase(); (seen.has(n) ? dup : seen).add(n); }
  return dup;
})();

/* ---------- Hilfsfunktionen ---------- */
const $ = sel => document.querySelector(sel);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/[łŁ]/g, 'l').replace(/[đĐ]/g, 'd').replace(/ı/g, 'i')
    .toLowerCase().trim();
}
function initials(name) { return name.split(/\s+/).map(w => w[0] + '.').join(' '); }
function todayStr() { return new Intl.DateTimeFormat('sv-SE', { timeZone: CONFIG.timeZone }).format(new Date()); }
function dayDiff(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
function ageOf(p) {
  if (!p.birthDate) return null;
  const [y, m, d] = p.birthDate.split('-').map(Number);
  const [ty, tm, td] = todayStr().split('-').map(Number);
  return ty - y - ((tm < m || (tm === m && td < d)) ? 1 : 0);
}
function hashStr(s) { // FNV-1a – deterministisch, damit alle dasselbe Tagesrätsel bekommen
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* privates Fenster o. ä. */ } },
};

/* ---------- Vergleichslogik ----------
   Jede Spalte liefert: status (hit/near/miss/unknown), arrow (up/down/''), main/sub (HTML), share-relevante Infos. */
function numeric(g, t, near, unit) {
  if (g == null || t == null) return { status: 'unknown', arrow: '', main: `<span class="num">${g ?? '?'}</span>`, sub: unit };
  const diff = t - g;
  const arrow = diff > 0 ? 'up' : diff < 0 ? 'down' : '';
  return {
    status: diff === 0 ? 'hit' : Math.abs(diff) <= near ? 'near' : 'miss',
    arrow, main: `<span class="num">${g}</span>${arrow ? ICON[arrow] : ''}`, sub: unit,
  };
}

const COLUMNS = [
  {
    // Top-5-Ligen mit Namen. Alle anderen zählen als Gruppe "Andere":
    // Spielen Tipp UND Gesuchter beide außerhalb der Top 5 -> grün (genaue Liga wird nicht verraten).
    label: 'Liga', cmp: (g, t) => {
      const hit = g.league === t.league, other = g.league === 'Andere';
      return {
        status: hit ? 'hit' : 'miss', arrow: '',
        main: `<span class="league">${esc(g.league)}</span>`, sub: '',
        tip: other ? (hit
          ? 'Keine Top-5-Liga. Der Gesuchte spielt auch außerhalb der Top 5 – ob in derselben Liga, wird nicht verraten.'
          : 'Keine Top-5-Liga.') : null,
      };
    },
  },
  {
    label: 'Nation', cmp: (g, t) => {
      const [gn, gc] = COUNTRIES[g.nationality] || [g.nationality, null];
      const [, tc] = COUNTRIES[t.nationality] || [t.nationality, null];
      return {
        status: g.nationality === t.nationality ? 'hit' : (gc && gc === tc) ? 'near' : 'miss', arrow: '',
        main: ICON.flag(g.nationality), sub: esc(gn),
      };
    },
  },
  {
    label: 'Position', cmp: (g, t) => {
      const gs = new Set(g.positions), ts = new Set(t.positions);
      const same = gs.size === ts.size && [...gs].every(x => ts.has(x));
      const overlap = [...gs].some(x => ts.has(x));
      const sorted = [...gs].sort((a, b) => POS_ORDER.indexOf(a) - POS_ORDER.indexOf(b));
      return {
        status: same ? 'hit' : overlap ? 'near' : 'miss', arrow: '',
        main: ICON.pitch(sorted), sub: `<b class="pos-txt">${sorted.join(' / ')}</b>`,
      };
    },
  },
  { label: 'Alter', cmp: (g, t) => numeric(ageOf(g), ageOf(t), CONFIG.near.age, 'Jahre') },
  { label: 'Größe', cmp: (g, t) => numeric(g.heightCm, t.heightCm, CONFIG.near.height, 'cm') },
  {
    label: 'Fuß', cmp: (g, t) => {
      if (!g.foot || !t.foot) return { status: 'unknown', arrow: '', main: g.foot ? ICON.feet(g.foot) : '<span class="num">?</span>', sub: FOOT[g.foot] || 'unbekannt' };
      return {
        status: g.foot === t.foot ? 'hit' : (g.foot === 'B' || t.foot === 'B') ? 'near' : 'miss', arrow: '',
        main: ICON.feet(g.foot), sub: FOOT[g.foot],
      };
    },
  },
  { label: 'Nr.', cmp: (g, t) => numeric(g.number, t.number, CONFIG.near.number, '') },
];

const compare = (g, t) => COLUMNS.map(c => c.cmp(g, t));
const signature = cells => cells.map(c => c.status + c.arrow).join('|');

/* ---------- Spielzustand ---------- */
const state = {
  mode: 'daily',
  difficulty: store.get('soccerdle-difficulty', 'mittel'),
  target: null,
  guesses: [],        // Spieler-IDs, ältester zuerst
  done: false,
  won: false,
  usedAssist: false,
  revealed: [],       // aktuell aufgedeckte Hinweise (Index)
  usedHints: [],      // jemals aufgedeckte Hinweise (fürs Teilen)
};
const FRESH_ROUND = () => ({ guesses: [], done: false, won: false, usedAssist: false, revealed: [], usedHints: [] });

function poolFor(mode) {
  const n = mode === 'daily' ? CONFIG.dailyPoolSize : CONFIG.difficulty[state.difficulty];
  const known = PLAYERS.filter(p => (p.pageviews || 0) >= CONFIG.minPageviewsForSolution);
  return known.slice(0, Math.min(n, known.length));
}
const dailyKey = () => 'soccerdle-daily-' + todayStr();
const puzzleNumber = () => dayDiff(CONFIG.launchDate, todayStr()) + 1;

function startDaily() {
  const pool = poolFor('daily');
  state.target = pool[hashStr('soccerdle:' + todayStr()) % pool.length];
  const saved = store.get(dailyKey(), null);
  state.guesses = saved ? saved.guesses.filter(id => BY_ID.has(id)) : [];
  state.done = saved ? !!saved.done : false;
  state.won = saved ? !!saved.won : false;
  state.usedAssist = saved ? !!saved.usedAssist : false;
  state.revealed = saved && saved.revealed ? saved.revealed : [];
  state.usedHints = saved && saved.usedHints ? saved.usedHints : [];
}

function startEndless() {
  const pool = poolFor('endless');
  let next;
  do { next = pool[Math.floor(Math.random() * pool.length)]; }
  while (pool.length > 1 && state.target && next.id === state.target.id);
  Object.assign(state, FRESH_ROUND(), { target: next });
}

// Test-Rätsel: wie das Tagesrätsel (gleicher Pool), aber zufällig und ohne Speichern/Statistik
function startTest() {
  const pool = poolFor('daily');
  let next;
  do { next = pool[Math.floor(Math.random() * pool.length)]; }
  while (pool.length > 1 && state.target && next.id === state.target.id);
  Object.assign(state, FRESH_ROUND(), { mode: 'test', target: next });
  $('#search').value = '';
  $('#suggestions').hidden = true;
  render();
  $('#search').focus();
}

function saveDaily() {
  if (state.mode !== 'daily') return;
  store.set(dailyKey(), {
    guesses: state.guesses, done: state.done, won: state.won, usedAssist: state.usedAssist,
    revealed: state.revealed, usedHints: state.usedHints,
  });
}

function finishDailyStats() {
  const s = store.get('soccerdle-stats', { played: 0, won: 0, streak: 0, maxStreak: 0, lastWon: null, dist: {} });
  const today = todayStr();
  if (s.lastPlayed === today) return; // schon gezählt
  s.played++;
  s.lastPlayed = today;
  if (state.won) {
    s.won++;
    s.streak = (s.lastWon && dayDiff(s.lastWon, today) === 1) ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastWon = today;
    const n = state.guesses.length, bucket = n >= 10 ? '10+' : String(n);
    s.dist[bucket] = (s.dist[bucket] || 0) + 1;
  } else {
    s.streak = 0;
  }
  store.set('soccerdle-stats', s);
}

/* ---------- Aktionen ---------- */
function makeGuess(id) {
  if (state.done || state.guesses.includes(id)) return;
  state.guesses.push(id);
  if ($('#assist').checked) state.usedAssist = true;
  if (id === state.target.id) { state.done = true; state.won = true; }
  saveDaily();
  if (state.done && state.mode === 'daily') finishDailyStats();
  render({ animateLast: true });
  if (state.done) setTimeout(showResult, 1100);
}

function giveUp() {
  if (state.done) return;
  state.done = true; state.won = false;
  render();
  showResult();
}

/* ---------- Darstellung ---------- */
function chipHtml(label, cell, extraClass = '') {
  const solo = cell.sub ? '' : ' solo';
  const tipAttr = cell.tip ? ' data-tip tabindex="0"' : '';
  return `<div class="chip ${cell.status}${solo}${extraClass}"${tipAttr} aria-label="${esc(label)}">
    <span class="k">${esc(label)}</span><span class="main">${cell.main}</span><span class="v">${cell.sub || '&nbsp;'}</span>
    ${cell.tip ? ICON.info + `<span class="tip">${esc(cell.tip)}</span>` : ''}</div>`;
}

function render({ animateLast = false } = {}) {
  $('#season').textContent = CONFIG.season;
  $('#data-date').textContent = DATA.updated;
  $('#endless-bar').hidden = state.mode !== 'endless';
  $('#btn-giveup').hidden = state.done;
  const tabMode = state.mode === 'test' ? 'daily' : state.mode;
  document.querySelectorAll('.sub-mode').forEach(b => b.classList.toggle('active', b.dataset.sub === tabMode));
  $('#btn-test').hidden = !CONFIG.testMode || state.mode === 'endless';

  const n = state.guesses.length;
  const tries = `${n} ${n === 1 ? 'Versuch' : 'Versuche'}`;
  $('#play-title').textContent = state.mode === 'daily' ? `Rätsel #${puzzleNumber()}`
    : state.mode === 'test' ? 'Test-Rätsel' : 'Endlos';
  $('#play-count').textContent = state.done
    ? (state.won ? `Gelöst in ${n} ${n === 1 ? 'Versuch' : 'Versuchen'}` : 'Aufgelöst')
    : tries;

  const input = $('#search');
  input.disabled = state.done;
  input.placeholder = state.done
    ? (state.mode === 'daily' ? 'Morgen gibt es ein neues Rätsel'
      : state.mode === 'test' ? 'Klick auf „Neues Rätsel (Test)“' : 'Klick auf „Neuer Spieler“')
    : 'Spielername eingeben …';

  renderHints();

  const head = n ? `<div class="col-head"><span></span><div class="chips">${COLUMNS.map(c => `<span>${esc(c.label)}</span>`).join('')}</div></div>` : '';
  const rows = [...state.guesses].reverse().map((id, i) => {
    const g = BY_ID.get(id);
    const cells = compare(g, state.target);
    const win = id === state.target.id;
    return `<article class="card guess${win ? ' win' : ''}${animateLast && i === 0 ? ' reveal' : ''}">
      <div class="who"><div class="n">${esc(g.name)}</div><div class="c">${esc(g.club)}</div></div>
      <div class="chips">${cells.map((c, j) => chipHtml(COLUMNS[j].label, c)).join('')}</div>
    </article>`;
  });
  $('#board').innerHTML = head + rows.join('');
}

// Hinweise: werden nach X Fehlversuchen freigeschaltet, aber erst auf Klick aufgedeckt (und wieder versteckt).
function renderHints() {
  const misses = state.guesses.filter(id => id !== state.target.id).length;
  $('#hints').innerHTML = CONFIG.hints.map((h, i) => {
    const unlocked = state.done || misses >= h.after;
    const shown = state.done || state.revealed.includes(i);
    const left = h.after - misses;
    if (!unlocked) {
      return `<div class="hint"><div class="lbl">${esc(h.label)}</div>
        <div class="lock">${ICON.lock} in ${left}<span class="long">${left === 1 ? 'Versuch' : 'Versuchen'}</span></div></div>`;
    }
    return `<button class="hint ${shown ? 'open' : 'ready'}" data-hint="${i}" ${state.done ? 'disabled' : ''}
              title="${shown ? 'Klicken zum Verstecken' : 'Klicken zum Anzeigen'}">
      <div class="lbl">${esc(h.label)}</div>
      ${shown ? `<div class="val">${esc(h.get(state.target))}</div>` : '<div class="reveal-txt">Anzeigen</div>'}</button>`;
  }).join('');
}

function toggleHint(i) {
  if (state.done) return;
  state.revealed = state.revealed.includes(i) ? state.revealed.filter(x => x !== i) : [...state.revealed, i];
  // Einmal angesehen zählt fürs Teilen (💡), auch wenn wieder versteckt
  if (!state.usedHints.includes(i)) state.usedHints = [...state.usedHints, i];
  saveDaily();
  renderHints();
}

/* ---------- Suche ---------- */
let suggestionIds = [];
let activeIndex = 0;

function isConsistent(candidate) {
  // Hätte dieser Kandidat bei allen bisherigen Tipps exakt dieselben Farben/Pfeile erzeugt?
  return state.guesses.every(id => {
    const g = BY_ID.get(id);
    return signature(compare(g, candidate)) === signature(compare(g, state.target));
  });
}

function updateSuggestions() {
  const q = normalize($('#search').value);
  const list = $('#suggestions');
  if (!q || state.done) { list.hidden = true; $('#search').setAttribute('aria-expanded', 'false'); return; }

  const assist = $('#assist').checked;
  // Tippen darf man immer alle Spieler (nicht nur den Lösungs-Pool)
  const matches = PLAYERS
    .filter(p => !state.guesses.includes(p.id))
    .map(p => {
      const n = normalize(p.name);
      const score = n.startsWith(q) ? 0 : n.split(/[\s-]+/).some(w => w.startsWith(q)) ? 1 : n.includes(q) ? 2 : -1;
      return { p, score };
    })
    .filter(x => x.score >= 0)
    .map(x => ({ ...x, ok: !assist || isConsistent(x.p) }))
    .sort((a, b) => (b.ok - a.ok) || (a.score - b.score) || ((b.p.pageviews || 0) - (a.p.pageviews || 0)))
    .slice(0, 8);

  suggestionIds = matches.map(x => x.p.id);
  activeIndex = 0;
  list.innerHTML = matches.length
    ? matches.map((x, i) => {
        const club = DUP_NAMES.has(x.p.name.toLowerCase()) ? `<span class="club">${esc(x.p.club)}</span>` : '';
        return `<li role="option" data-id="${esc(x.p.id)}" class="${i === 0 ? 'active' : ''}${x.ok ? '' : ' unlikely'}">
          <span><span class="nm">${esc(x.p.name)}</span>${club}</span>${x.ok ? '' : '<span class="why">passt nicht</span>'}</li>`;
      }).join('')
    : '<li class="empty">Kein Spieler gefunden</li>';
  list.hidden = false;
  $('#search').setAttribute('aria-expanded', 'true');
}

function pick(id) {
  if (!id) return;
  $('#search').value = '';
  $('#suggestions').hidden = true;
  makeGuess(id);
  $('#search').focus();
}

function moveActive(delta) {
  const items = [...document.querySelectorAll('#suggestions li[data-id]')];
  if (!items.length) return;
  activeIndex = (activeIndex + delta + items.length) % items.length;
  items.forEach((li, i) => li.classList.toggle('active', i === activeIndex));
  items[activeIndex].scrollIntoView({ block: 'nearest' });
}

/* ---------- Dialoge ---------- */
function shareText() {
  const emoji = { hit: '🟩', near: '🟧', miss: '🟥', unknown: '⬜' };
  const grid = state.guesses.map(id => compare(BY_ID.get(id), state.target).map(c => emoji[c.status]).join('')).join('\n');
  const head = state.mode === 'daily' ? `Soccerdle #${puzzleNumber()}`
    : state.mode === 'test' ? 'Soccerdle (Test)' : `Soccerdle Endlos (${state.difficulty})`;
  const n = state.guesses.length;
  const res = state.won ? `⚽ ${n} ${n === 1 ? 'Versuch' : 'Versuche'}` : '❌ aufgegeben';
  const hints = state.usedHints.length ? ' ' + '💡'.repeat(state.usedHints.length) : '';
  return `${head} ${res}${hints}${state.usedAssist ? ' 🛟' : ''}\n${grid}\n${location.href.startsWith('http') ? location.origin + location.pathname : ''}`.trim();
}

function showResult() {
  const t = state.target;
  const [country] = COUNTRIES[t.nationality] || [t.nationality];
  const rows = state.guesses.map(id => compare(BY_ID.get(id), t));
  const maxRows = 8;
  const dlg = $('#dlg-result');
  dlg.innerHTML = `
    <h2>${state.won ? 'Richtig!' : 'Schade!'}</h2>
    <p class="result-label">Gesucht war</p>
    <div class="result-player">${esc(t.name)}</div>
    <div class="result-meta">${ICON.flag(t.nationality)}<span>${esc(country)} · ${esc(t.club)}${t.number != null ? ' · #' + esc(t.number) : ''}</span></div>
    <div class="share-grid">${rows.slice(0, maxRows).map(r => `<div class="share-row">${r.map(c => `<i class="${c.status}"></i>`).join('')}</div>`).join('')}
      ${rows.length > maxRows ? `<div class="share-more">+ ${rows.length - maxRows} weitere</div>` : ''}</div>
    ${state.mode === 'daily' ? '<p class="countdown">Nächstes Rätsel in <b id="countdown"></b></p>' : ''}
    <button class="primary" id="btn-share">Ergebnis teilen</button>
    ${state.mode === 'endless' ? '<button class="secondary" id="btn-again">Nächster Spieler</button>' : ''}
    ${state.mode === 'test' ? '<button class="secondary" id="btn-again-test">Neues Rätsel (Test)</button>' : ''}
    <form method="dialog"><button class="secondary">Schließen</button></form>`;
  dlg.querySelector('#btn-share').onclick = async e => {
    const text = shareText();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); e.target.textContent = 'Kopiert ✓'; }
    } catch { /* abgebrochen */ }
  };
  const again = dlg.querySelector('#btn-again');
  if (again) again.onclick = () => { dlg.close(); startEndless(); render(); $('#search').focus(); };
  const againTest = dlg.querySelector('#btn-again-test');
  if (againTest) againTest.onclick = () => { dlg.close(); startTest(); };
  if (!dlg.open) dlg.showModal();
  tickCountdown();
}

function tickCountdown() {
  const el = document.getElementById('countdown');
  if (!el) return;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: CONFIG.timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).reduce((o, p) => (o[p.type] = +p.value, o), {});
  const left = 86400 - (parts.hour * 3600 + parts.minute * 60 + parts.second);
  const pad = v => String(v).padStart(2, '0');
  el.textContent = `${pad(Math.floor(left / 3600))}:${pad(Math.floor(left % 3600 / 60))}:${pad(left % 60)}`;
}
setInterval(tickCountdown, 1000);

function showStats() {
  const s = store.get('soccerdle-stats', { played: 0, won: 0, streak: 0, maxStreak: 0, dist: {} });
  const pct = s.played ? Math.round(s.won / s.played * 100) : 0;
  const dlg = $('#dlg-stats');
  dlg.innerHTML = `
    <h2>Statistik</h2>
    <p class="result-label">Tägliches Rätsel</p>
    <div class="stats">
      <div><b>${s.played}</b><span>Gespielt</span></div>
      <div><b>${pct}%</b><span>Gelöst</span></div>
      <div><b>${s.streak}</b><span>Serie</span></div>
      <div><b>${s.maxStreak}</b><span>Beste Serie</span></div>
    </div>
    <form method="dialog"><button class="primary">Schließen</button></form>`;
  dlg.showModal();
}

/* ---------- Hell / Dunkel ---------- */
const root = document.documentElement;
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
const paintThemeIcon = () => { $('#theme-ico').innerHTML = isDark() ? ICON.sun : ICON.moon; };
function toggleTheme() {
  root.dataset.theme = isDark() ? 'light' : 'dark';
  try { localStorage.setItem('soccerdle-theme', root.dataset.theme); } catch { /* egal */ }
  paintThemeIcon();
}

/* ---------- Events ---------- */
function setMode(mode) {
  state.mode = mode;
  if (mode === 'daily') startDaily(); else startEndless();
  $('#search').value = '';
  $('#suggestions').hidden = true;
  render();
}

$('#search').addEventListener('input', updateSuggestions);
$('#search').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
  else if (e.key === 'Enter') { e.preventDefault(); pick(suggestionIds[activeIndex]); }
  else if (e.key === 'Escape') { $('#suggestions').hidden = true; }
});
$('#suggestions').addEventListener('mousedown', e => {
  const li = e.target.closest('li[data-id]');
  if (li) { e.preventDefault(); pick(li.dataset.id); }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.search')) $('#suggestions').hidden = true;
  // Tooltip am Handy: Kachel antippen zum Ein-/Ausblenden
  const chip = e.target.closest('.chip[data-tip]');
  document.querySelectorAll('.chip.show-tip').forEach(c => c !== chip && c.classList.remove('show-tip'));
  if (chip) chip.classList.toggle('show-tip');
});
$('#assist').addEventListener('change', () => { store.set('soccerdle-assist', $('#assist').checked); updateSuggestions(); });

document.querySelectorAll('.sub-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.sub)));
$('#difficulty').addEventListener('change', e => { state.difficulty = e.target.value; store.set('soccerdle-difficulty', state.difficulty); setMode('endless'); });
$('#btn-new').addEventListener('click', () => { startEndless(); render(); $('#search').focus(); });
$('#btn-giveup').addEventListener('click', giveUp);
$('#btn-test').addEventListener('click', startTest);
$('#hints').addEventListener('click', e => {
  const btn = e.target.closest('[data-hint]');
  if (btn) toggleHint(Number(btn.dataset.hint));
});
$('#btn-help').addEventListener('click', () => $('#dlg-help').showModal());
$('#btn-stats').addEventListener('click', showStats);
$('#btn-theme').addEventListener('click', toggleTheme);

/* ---------- Start ---------- */
paintThemeIcon();
if (!PLAYERS.length) {
  $('#play-title').textContent = 'Keine Spielerdaten gefunden (data/players.js fehlt).';
} else {
  $('#difficulty').value = state.difficulty;
  $('#assist').checked = store.get('soccerdle-assist', false);
  setMode('daily');
  if (!store.get('soccerdle-seen-help', false)) { $('#dlg-help').showModal(); store.set('soccerdle-seen-help', true); }
  else if (state.done) setTimeout(showResult, 300);
}
