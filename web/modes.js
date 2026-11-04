'use strict';

/* =========================================================================
   Soccerdle – weitere Tagesmodi: Karriere, Raster, Mitspieler, Wer fehlt
   Nutzt Hilfsfunktionen aus app.js (esc, normalize, todayStr, hashStr, store, ICON, COUNTRIES, CONFIG).
   Daten: data/history.js (Wikidata-Karrieren), data/lineups.js (Final-Aufstellungen)
   ========================================================================= */

const MODE_CONFIG = {
  career:  { minSl: 60, minStations: 3, hints: [3, 5, 7] },
  grid:    { attempts: 9, minAnswers: 3, topClubs: 50, answerMinSl: 25 },
  mates:   { minSl: 60, clueMinSl: 35, startClues: 3, maxClues: 6, hints: [4, 6, 8] },
  lineup:  { hints: [2, 4, 6] },
};

/* ---------- Daten aufbereiten ---------- */
const HIST = (() => {
  const raw = window.SOCCERDLE_HISTORY;
  if (!raw) return { players: [], clubs: [], byId: new Map() };
  const clubs = raw.clubs.map(([name, country]) => ({ name, country }));
  const players = raw.players.map(([id, name, dob, nat, pos, sl, flat, detail]) => {
    const career = [];
    for (let i = 0; i < flat.length; i += 4) career.push({ c: flat[i], f: flat[i + 1] || null, t: flat[i + 2] || null, loan: !!flat[i + 3] });
    return { id, name, dob: dob || null, nat: nat || null, pos: pos ? pos.split(',') : [], sl, career, detail: detail || null };
  });
  return { players, clubs, byId: new Map(players.map(p => [p.id, p])), model: raw.ratingModel || null, adjust: raw.ratingAdjust || {} };
})();
const LINEUPS = window.SOCCERDLE_LINEUPS || [];

// Such-Universum: historische Spieler + Spieler aus Aufstellungen + aktuelle CL-Spieler (dedupliziert per Wikidata-ID)
const UNIVERSE = (() => {
  const m = new Map();
  for (const p of HIST.players) m.set(p.id, { id: p.id, name: p.name, nat: p.nat, sl: p.sl });
  for (const g of LINEUPS) for (const p of g.lineup1.concat(g.lineup2)) {
    if (p.id && !m.has(p.id)) m.set(p.id, { id: p.id, name: p.full || p.name, nat: p.nat, sl: 0 });
  }
  for (const p of (window.SOCCERDLE_DATA ? window.SOCCERDLE_DATA.players : [])) {
    if (!m.has(p.id)) m.set(p.id, { id: p.id, name: p.name, nat: p.nationality, sl: 0, pv: p.pageviews });
  }
  const list = [...m.values()];
  list.forEach(p => { p.norm = normalize(p.name); });
  list.sort((a, b) => (b.sl - a.sl) || ((b.pv || 0) - (a.pv || 0)));
  return { list, byId: m };
})();
const DUP_UNI = (() => {
  const seen = new Set(), dup = new Set();
  for (const p of UNIVERSE.list) { const n = p.norm; (seen.has(n) ? dup : seen).add(n); }
  return dup;
})();

/* ---------- Hilfsfunktionen ---------- */
function rng(seedStr) { // mulberry32 – deterministisch je Tag und Modus
  let a = hashStr(seedStr);
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pickOne = (arr, r) => arr[Math.floor(r() * arr.length)];
function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clubName = idx => (HIST.clubs[idx] || { name: '?' }).name;
// Vereinsflagge nur für bekannte FIFA-Codes (Wikidata führt englische Vereine unter "Vereinigtes Königreich" -> kein FIFA-Code)
const clubFlag = idx => { const c = HIST.clubs[idx]; return c && COUNTRIES[c.country] ? ICON.flag(c.country).replace('class="flag"', 'class="flag mini"') : ''; };
const years = (f, t) => f ? (t ? (f === t ? `${f}` : `${f}–${t}`) : `seit ${f}`) : (t ? `bis ${t}` : '');
const countryName = code => (COUNTRIES[code] || [code])[0];
const POS_DE = { TW: 'Torwart', ABW: 'Abwehr', MF: 'Mittelfeld', ST: 'Sturm' };
const thisYear = () => Number(todayStr().slice(0, 4));

function playedFor(p, clubIdx) { return p.career.some(s => s.c === clubIdx); }
function stintsOverlap(a, b) {
  const af = a.f, at = a.t || (a.f ? thisYear() : null), bf = b.f, bt = b.t || (b.f ? thisYear() : null);
  if (!af || !bf) return false;
  return Math.max(af, bf) < Math.min(at, bt) || (af === bf && af === at); // mind. eine gemeinsame Saison
}
function sharedStints(p, q) {
  const out = [];
  for (const a of p.career) for (const b of q.career) if (a.c === b.c && stintsOverlap(a, b)) {
    out.push({ c: a.c, f: Math.max(a.f, b.f), t: Math.min(a.t || thisYear(), b.t || thisYear()) });
  }
  return out;
}

/* ---------- Gemeinsame UI-Bausteine ---------- */
// Suchfeld mit Vorschlagsliste über das gesamte Spieler-Universum
function createSearch(host, { placeholder = 'Spielername eingeben …', onPick, isExcluded = () => false }) {
  host.innerHTML = `<div class="search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="text" class="mode-search" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" aria-label="Spieler suchen">
      <ul class="suggest-list" role="listbox" hidden></ul></div>`;
  const input = host.querySelector('input'), list = host.querySelector('ul');
  let ids = [], active = 0;
  const update = () => {
    const q = normalize(input.value);
    if (!q) { list.hidden = true; return; }
    const res = [];
    for (const p of UNIVERSE.list) {
      if (isExcluded(p.id)) continue;
      const score = p.norm.startsWith(q) ? 0 : p.norm.split(/[\s-]+/).some(w => w.startsWith(q)) ? 1 : p.norm.includes(q) ? 2 : -1;
      if (score >= 0) res.push({ p, score });
      if (res.length > 400) break;
    }
    res.sort((a, b) => (a.score - b.score) || (b.p.sl - a.p.sl));
    const top = res.slice(0, 8);
    ids = top.map(x => x.p.id); active = 0;
    list.innerHTML = top.length ? top.map((x, i) => {
      const extra = DUP_UNI.has(x.p.norm) && x.p.nat ? `<span class="club">${esc(countryName(x.p.nat))}</span>` : '';
      return `<li data-id="${esc(x.p.id)}" class="${i === 0 ? 'active' : ''}"><span><span class="nm">${esc(x.p.name)}</span>${extra}</span></li>`;
    }).join('') : '<li class="empty">Kein Spieler gefunden</li>';
    list.hidden = false;
  };
  const pick = id => { if (!id) return; input.value = ''; list.hidden = true; onPick(id); input.focus(); };
  input.addEventListener('input', update);
  input.addEventListener('keydown', e => {
    const items = [...list.querySelectorAll('li[data-id]')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle('active', i === active));
    } else if (e.key === 'Enter') { e.preventDefault(); pick(ids[active]); }
    else if (e.key === 'Escape') list.hidden = true;
  });
  list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-id]'); if (li) { e.preventDefault(); pick(li.dataset.id); } });
  document.addEventListener('click', e => { if (!host.contains(e.target)) list.hidden = true; });
  return { input, setDisabled(d, text) { input.disabled = d; if (text) input.placeholder = text; }, focus() { input.focus(); } };
}

// Hinweise wie bei Klassik: nach X Fehlversuchen freigeschaltet, Klick deckt auf/versteckt
function hintsHtml(defs, misses, revealed, done) {
  return `<div class="hints">${defs.map((h, i) => {
    const unlocked = done || misses >= h.after, shown = done || revealed.includes(i), left = h.after - misses;
    if (!unlocked) return `<div class="hint"><div class="lbl">${esc(h.label)}</div><div class="lock">${ICON.lock} in ${left}<span class="long">${left === 1 ? 'Versuch' : 'Versuchen'}</span></div></div>`;
    return `<button class="hint ${shown ? 'open' : 'ready'}" data-mhint="${i}" ${done ? 'disabled' : ''}>
      <div class="lbl">${esc(h.label)}</div>${shown ? `<div class="val">${h.html}</div>` : '<div class="reveal-txt">Anzeigen</div>'}</button>`;
  }).join('')}</div>`;
}

function shareButton(text) {
  return async e => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); e.target.textContent = 'Kopiert ✓'; }
    } catch { /* abgebrochen */ }
  };
}

/* ---------- Rahmen für einen Modus: Zustand, Speicherung, Test-Rätsel ---------- */
function makeMode(key, impl) {
  const mode = {
    key, impl, root: null, test: null, s: null, puzzle: null,
    storeKey() { return `soccerdle-${key}-${todayStr()}`; },
    start(root) {
      this.root = root;
      const seed = this.test || `soccerdle:${key}:${todayStr()}`;
      this.puzzle = impl.generate(rng(seed));
      const saved = this.test ? null : store.get(this.storeKey(), null);
      this.s = Object.assign(impl.freshState(this.puzzle), saved || {});
      this.render();
    },
    save() { if (!this.test) store.set(this.storeKey(), this.s); updateDoneDots(); },
    newTest() { this.test = 'test:' + Math.random(); this.start(this.root); },
    render() {
      if (!this.puzzle) { this.root.innerHTML = `<section class="card play"><p>Für diesen Modus fehlen die Daten (data/history.js / data/lineups.js).</p></section>`; return; }
      impl.render.call(this);
    },
    header(title, sub) {
      const testBtn = CONFIG.testMode ? `<button class="btn test-btn" data-act="test">↻ Neues Rätsel (Test)</button>` : '';
      return `<div class="play-top"><b>${esc(this.test ? title + ' · Test' : title)}</b>
        <span class="play-right"><span>${esc(sub)}</span>${testBtn}</span></div>`;
    },
    bind() {
      const r = this.root;
      r.querySelectorAll('[data-act="test"]').forEach(b => b.onclick = () => this.newTest());
      r.querySelectorAll('[data-mhint]').forEach(b => b.onclick = () => {
        const i = Number(b.dataset.mhint);
        this.s.revealed = this.s.revealed.includes(i) ? this.s.revealed.filter(x => x !== i) : [...this.s.revealed, i];
        if (!this.s.usedHints.includes(i)) this.s.usedHints.push(i);
        this.save(); this.render();
      });
      r.querySelectorAll('[data-act="giveup"]').forEach(b => b.onclick = () => { this.s.done = true; this.s.won = false; this.save(); this.render(); });
      r.querySelectorAll('[data-act="share"]').forEach(b => b.onclick = shareButton(impl.shareText.call(this)));
    },
    isDone() { const s = store.get(this.storeKey(), null); return !!(s && s.done); },
  };
  return mode;
}

function resultCard(won, title, body, mode) {
  return `<section class="card result-card ${won ? 'won' : 'lost'}">
    <h2>${esc(title)}</h2>${body}
    <div class="result-actions">
      <button class="primary" data-act="share">Ergebnis teilen</button>
      ${mode.test ? '<button class="secondary" data-act="test">Neues Rätsel (Test)</button>' : '<p class="countdown">Neues Rätsel morgen</p>'}
    </div></section>`;
}

/* =========================================================================
   1) KARRIERE – Vereinsstationen, wer ist es?
   ========================================================================= */
const CareerMode = makeMode('career', {
  generate(r) {
    const c = MODE_CONFIG.career;
    const pool = HIST.players.filter(p => p.sl >= c.minSl && p.career.length >= c.minStations
      && p.career.every(s => s.f) && p.career.some(s => s.f >= 1995));
    return pool.length ? { target: pickOne(pool, r).id } : null;
  },
  freshState: () => ({ guesses: [], done: false, won: false, revealed: [], usedHints: [] }),
  shareText() {
    const n = this.s.guesses.length;
    return `Soccerdle Karriere ${this.s.won ? `⚽ ${n} ${n === 1 ? 'Versuch' : 'Versuche'}` : '❌'}${this.s.usedHints.length ? ' ' + '💡'.repeat(this.s.usedHints.length) : ''}`;
  },
  render() {
    const t = HIST.byId.get(this.puzzle.target), s = this.s;
    const misses = s.guesses.filter(id => id !== t.id).length;
    const guessed = s.guesses.map(id => HIST.byId.get(id)).filter(Boolean);
    const defs = [
      { after: 3, label: 'Nation', html: t.nat ? `${ICON.flag(t.nat).replace('class="flag"', 'class="flag mini"')} ${esc(countryName(t.nat))}` : '–' },
      { after: 5, label: 'Position', html: esc(t.pos.map(x => POS_DE[x]).join(' / ') || '–') },
      { after: 7, label: 'Initialen', html: esc(initials(t.name)) },
    ];
    // Stationen; Häkchen, wenn ein getippter Spieler auch dort war
    const rows = t.career.map(st => {
      const also = guessed.filter(g => g.id !== t.id && playedFor(g, st.c)).map(g => g.name);
      return `<li class="${also.length ? 'shared' : ''}">
        <span class="yr">${esc(years(st.f, st.t))}</span>
        <span class="cl">${clubFlag(st.c)}${esc(clubName(st.c))}${st.loan ? ' <em>(Leihe)</em>' : ''}</span>
        ${also.length ? `<span class="also" title="${esc(also.join(', '))}">✓ ${esc(also[0])}${also.length > 1 ? ' +' + (also.length - 1) : ''}</span>` : ''}
      </li>`;
    }).join('');
    const sub = s.done ? (s.won ? `Gelöst in ${s.guesses.length}` : 'Aufgelöst') : `${s.guesses.length} Versuche`;
    this.root.innerHTML = `
      <section class="card play">
        ${this.header('Karriere', sub)}
        <p class="mode-intro">Wessen Karriere ist das?</p>
        <div id="m-search"></div>
        ${hintsHtml(defs, misses, s.revealed, s.done)}
      </section>
      ${s.done ? resultCard(s.won, s.won ? 'Richtig!' : 'Schade!', `<p class="result-label">Gesucht war</p><div class="result-player">${esc(t.name)}</div>`, this) : ''}
      <section class="card career"><ol class="timeline">${rows}</ol>
        ${s.done ? '' : '<div class="mode-foot"><button class="btn danger" data-act="giveup">Aufgeben</button></div>'}</section>
      ${guessed.filter(g => g.id !== t.id).length ? `<section class="card wrong-list"><b>Falsch getippt</b>
        <ul>${guessed.filter(g => g.id !== t.id).reverse().map(g => `<li>${g.nat ? ICON.flag(g.nat).replace('class="flag"', 'class="flag mini"') : ''}${esc(g.name)}</li>`).join('')}</ul></section>` : ''}`;
    const search = createSearch(this.root.querySelector('#m-search'), {
      isExcluded: id => s.guesses.includes(id),
      onPick: id => {
        s.guesses.push(id);
        if (id === t.id) { s.done = true; s.won = true; }
        this.save(); this.render();
      },
    });
    if (s.done) search.setDisabled(true, 'Gelöst – morgen gibt es ein neues Rätsel');
    this.bind();
  },
});

/* =========================================================================
   2) RASTER – 3×3: Spieler, die für Zeilen- UND Spaltenverein gespielt haben
   ========================================================================= */
const GridMode = makeMode('grid', {
  generate(r) {
    const c = MODE_CONFIG.grid;
    // Nur die großen Vereine: die mit den meisten sehr bekannten Spielern (Top N)
    const count = new Map();
    for (const p of HIST.players) if (p.sl >= 60) for (const ci of new Set(p.career.map(s => s.c))) count.set(ci, (count.get(ci) || 0) + 1);
    const bigClubs = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, c.topClubs).map(([ci]) => ci);
    // Vorab: Verein -> Menge der (ausreichend bekannten) Spieler-IDs
    const members = new Map(bigClubs.map(ci => [ci, new Set()]));
    for (const p of HIST.players) if (p.sl >= c.answerMinSl) for (const st of p.career) if (members.has(st.c)) members.get(st.c).add(p.id);
    const answers = (a, b) => { let n = 0; for (const id of members.get(a)) if (members.get(b).has(id)) n++; return { length: n }; };
    for (let tries = 0; tries < 4000; tries++) {
      const six = shuffle(bigClubs, r).slice(0, 6);
      const rows = six.slice(0, 3), cols = six.slice(3);
      let ok = true;
      for (const a of rows) { for (const b of cols) { if (answers(a, b).length < c.minAnswers) { ok = false; break; } } if (!ok) break; }
      if (ok) return { rows, cols };
    }
    return null;
  },
  freshState: () => ({ cells: Array(9).fill(null), wrong: 0, used: 0, done: false, won: false, active: null, revealed: [], usedHints: [] }),
  shareText() {
    const s = this.s, n = s.cells.filter(Boolean).length;
    const g = [0, 1, 2].map(r => [0, 1, 2].map(c => s.cells[r * 3 + c] ? '🟩' : '⬛').join('')).join('\n');
    return `Soccerdle Raster ${n}/9\n${g}`;
  },
  render() {
    const { rows, cols } = this.puzzle, s = this.s, c = MODE_CONFIG.grid;
    const left = c.attempts - s.used;
    const head = idx => `<div class="g-head">${clubFlag(idx)}<span>${esc(clubName(idx))}</span></div>`;
    let grid = `<div class="g-corner"><b>${left}</b><span>Versuche</span></div>${cols.map(head).join('')}`;
    rows.forEach((ri, r) => {
      grid += head(ri);
      cols.forEach((ci, k) => {
        const i = r * 3 + k, id = s.cells[i];
        if (id) grid += `<div class="g-cell filled"><span>${esc(UNIVERSE.byId.get(id).name)}</span></div>`;
        else if (s.done) {
          const sol = HIST.players.filter(p => p.sl >= c.answerMinSl && playedFor(p, ri) && playedFor(p, ci)).sort((a, b) => b.sl - a.sl)[0];
          grid += `<div class="g-cell missed"><span>${sol ? esc(sol.name) : '–'}</span></div>`;
        } else grid += `<button class="g-cell${s.active === i ? ' active' : ''}" data-cell="${i}" aria-label="${esc(clubName(ri))} und ${esc(clubName(ci))}">+</button>`;
      });
    });
    const activeTxt = s.active != null && !s.done
      ? `Spieler für <b>${esc(clubName(rows[Math.floor(s.active / 3)]))}</b> und <b>${esc(clubName(cols[s.active % 3]))}</b>:`
      : 'Wähle ein Feld und nenne einen Spieler, der für beide Vereine gespielt hat.';
    const filled = s.cells.filter(Boolean).length;
    this.root.innerHTML = `
      <section class="card play">
        ${this.header('Raster', `${filled}/9 gelöst`)}
        <p class="mode-intro" id="g-msg">${activeTxt}</p>
        <div id="m-search"></div>
        <p class="g-feedback" id="g-feedback"></p>
      </section>
      ${s.done ? resultCard(filled === 9, `${filled} von 9`, `<p class="result-label">${filled === 9 ? 'Perfektes Raster!' : 'Graue Felder: eine mögliche Lösung'}</p>`, this) : ''}
      <section class="card grid-card"><div class="grid3">${grid}</div>
        ${s.done ? '' : '<div class="mode-foot"><button class="btn danger" data-act="giveup">Aufgeben</button></div>'}</section>`;
    const search = createSearch(this.root.querySelector('#m-search'), {
      isExcluded: id => s.cells.includes(id),
      onPick: id => {
        if (s.active == null) { this.root.querySelector('#g-feedback').textContent = 'Erst ein Feld im Raster auswählen.'; return; }
        const p = HIST.byId.get(id), ri = rows[Math.floor(s.active / 3)], ci = cols[s.active % 3];
        s.used++;
        const ok = p && playedFor(p, ri) && playedFor(p, ci);
        if (ok) { s.cells[s.active] = id; s.active = null; } else s.wrong++;
        if (s.used >= c.attempts || s.cells.every(Boolean)) { s.done = true; s.won = s.cells.every(Boolean); }
        this.save(); this.render();
        if (!ok) this.root.querySelector('#g-feedback').textContent = `✗ ${UNIVERSE.byId.get(id).name} passt nicht.`;
      },
    });
    if (s.done) search.setDisabled(true, 'Fertig – morgen gibt es ein neues Raster');
    else if (s.active == null) search.setDisabled(false, 'Erst ein Feld wählen …');
    else search.focus();
    this.root.querySelectorAll('[data-cell]').forEach(b => b.onclick = () => { s.active = Number(b.dataset.cell); this.render(); });
    this.bind();
  },
});

/* =========================================================================
   3) MITSPIELER – mit wem haben diese Spieler alle zusammengespielt?
   ========================================================================= */
const MatesMode = makeMode('mates', {
  generate(r) {
    const c = MODE_CONFIG.mates;
    const known = HIST.players.filter(p => p.sl >= c.clueMinSl && p.career.every(s => s.f));
    const targets = shuffle(HIST.players.filter(p => p.sl >= c.minSl && p.career.length >= 2 && p.career.every(s => s.f)), r);
    for (const t of targets.slice(0, 300)) {
      // Mitspieler sammeln, pro Verein die bekanntesten, gemischt über Vereine
      const byClub = new Map();
      for (const q of known) {
        if (q.id === t.id) continue;
        const sh = sharedStints(t, q);
        if (!sh.length) continue;
        const st = sh[0];
        if (!byClub.has(st.c)) byClub.set(st.c, []);
        byClub.get(st.c).push({ id: q.id, sl: q.sl, c: st.c, f: st.f, t: st.t });
      }
      if (byClub.size < 2) continue;
      const lists = [...byClub.values()].map(l => l.sort((a, b) => b.sl - a.sl));
      const clues = [];
      for (let round = 0; clues.length < c.maxClues && round < 6; round++) for (const l of lists) if (l[round] && clues.length < c.maxClues) clues.push(l[round]);
      if (clues.length < c.maxClues) continue;
      // Reihenfolge: schwer -> leicht (unbekanntere zuerst), aber erste drei aus verschiedenen Vereinen
      return { target: t.id, clues: shuffle(clues, r) };
    }
    return null;
  },
  freshState: () => ({ guesses: [], done: false, won: false, revealed: [], usedHints: [], also: null }),
  shareText() {
    const n = this.s.guesses.length;
    return `Soccerdle Mitspieler ${this.s.won ? `⚽ ${n} ${n === 1 ? 'Versuch' : 'Versuche'}` : '❌'}${this.s.usedHints.length ? ' ' + '💡'.repeat(this.s.usedHints.length) : ''}`;
  },
  render() {
    const c = MODE_CONFIG.mates, s = this.s, t = HIST.byId.get(this.puzzle.target);
    const misses = s.guesses.filter(id => !(s.won && id === s.guesses[s.guesses.length - 1])).length;
    const shown = s.done ? c.maxClues : Math.min(c.maxClues, c.startClues + misses);
    const clues = this.puzzle.clues.slice(0, shown);
    const defs = [
      { after: c.hints[0], label: 'Nation', html: t.nat ? `${ICON.flag(t.nat).replace('class="flag"', 'class="flag mini"')} ${esc(countryName(t.nat))}` : '–' },
      { after: c.hints[1], label: 'Position', html: esc(t.pos.map(x => POS_DE[x]).join(' / ') || '–') },
      { after: c.hints[2], label: 'Initialen', html: esc(initials(t.name)) },
    ];
    const cards = this.puzzle.clues.map((cl, i) => {
      if (i >= shown) return `<li class="mate locked">${ICON.lock}<span>Weiterer Mitspieler nach Fehlversuch</span></li>`;
      const q = HIST.byId.get(cl.id);
      return `<li class="mate"><div class="mate-n">${q.nat ? ICON.flag(q.nat).replace('class="flag"', 'class="flag mini"') : ''}${esc(q.name)}</div>
        <div class="mate-c">${clubFlag(cl.c)}${esc(clubName(cl.c))} · ${esc(years(cl.f, cl.t))}</div></li>`;
    }).join('');
    const sub = s.done ? (s.won ? `Gelöst in ${s.guesses.length}` : 'Aufgelöst') : `${s.guesses.length} Versuche`;
    const wrong = s.guesses.filter(id => id !== t.id && !(s.won && id === s.guesses[s.guesses.length - 1]));
    this.root.innerHTML = `
      <section class="card play">
        ${this.header('Mitspieler', sub)}
        <p class="mode-intro">Mit welchem Spieler haben <b>alle</b> diese Spieler zusammengespielt?</p>
        <div id="m-search"></div>
        ${hintsHtml(defs, misses, s.revealed, s.done)}
      </section>
      ${s.done ? resultCard(s.won, s.won ? 'Richtig!' : 'Schade!', `<p class="result-label">Gesucht war</p><div class="result-player">${esc(t.name)}</div>${s.also ? `<p class="result-label">Dein Tipp ${esc(s.also)} passt auch – stark!</p>` : ''}`, this) : ''}
      <section class="card"><ol class="mates">${cards}</ol>
        ${s.done ? '' : '<div class="mode-foot"><button class="btn danger" data-act="giveup">Aufgeben</button></div>'}</section>
      ${wrong.length ? `<section class="card wrong-list"><b>Falsch getippt</b><ul>${wrong.slice().reverse().map(id => `<li>${esc(UNIVERSE.byId.get(id).name)}</li>`).join('')}</ul></section>` : ''}`;
    const search = createSearch(this.root.querySelector('#m-search'), {
      isExcluded: id => s.guesses.includes(id),
      onPick: id => {
        s.guesses.push(id);
        const p = HIST.byId.get(id);
        // Richtig: der Gesuchte – oder jemand, der mit ALLEN angezeigten Mitspielern zusammengespielt hat
        const fitsAll = p && clues.every(cl => { const q = HIST.byId.get(cl.id); return q && q.id !== p.id && sharedStints(p, q).length; });
        if (id === t.id || fitsAll) { s.done = true; s.won = true; if (id !== t.id) s.also = p.name; }
        this.save(); this.render();
      },
    });
    if (s.done) search.setDisabled(true, 'Gelöst – morgen gibt es ein neues Rätsel');
    this.bind();
  },
});

/* =========================================================================
   4) WER FEHLT – Startelf eines legendären Spiels, ein Spieler fehlt
   ========================================================================= */
// Position -> [Mannschaftsteil (0 = Tor … 5 = Sturm), Seite L/C/R]
const POS_XY = {
  GK: [0, 'C'], SW: [1, 'C'], CB: [1, 'C'], RB: [1, 'R'], LB: [1, 'L'], RWB: [2, 'R'], LWB: [2, 'L'],
  DM: [2, 'C'], CM: [3, 'C'], RM: [3, 'R'], LM: [3, 'L'], AM: [4, 'C'], RW: [4, 'R'], LW: [4, 'L'],
  RF: [5, 'R'], LF: [5, 'L'], SS: [5, 'C'], CF: [5, 'C'],
};
const LINE_Y = [91, 73, 59, 45, 30, 14]; // Höhe je Mannschaftsteil in % (oben = Angriff)
const POS_LINEUP_DE = { GK: 'Torwart', SW: 'Libero', CB: 'Innenverteidiger', RB: 'Rechtsverteidiger', LB: 'Linksverteidiger',
  RWB: 'Rechter Flügelverteidiger', LWB: 'Linker Flügelverteidiger', DM: 'Defensives MF', CM: 'Zentrales MF', RM: 'Rechtes MF',
  LM: 'Linkes MF', AM: 'Offensives MF', RW: 'Rechtsaußen', LW: 'Linksaußen', RF: 'Rechter Stürmer', LF: 'Linker Stürmer',
  SS: 'Hängende Spitze', CF: 'Mittelstürmer' };
const teamLabel = t => t && t[0] === '@' ? countryName(t.slice(1)) : (t || '?');

function layoutLineup(players) {
  // Spieler nach Höhe (y) gruppieren und in jeder Reihe von links nach rechts verteilen
  const rows = new Map();
  players.forEach((p, i) => {
    const [line, side] = POS_XY[p.pos] || [3, 'C'];
    if (!rows.has(line)) rows.set(line, []);
    rows.get(line).push({ p, i, side: side === 'L' ? 0 : side === 'C' ? 1 : 2 });
  });
  const out = [];
  for (const [line, row] of rows) {
    // Wikipedia listet meist rechts -> links; daher innerhalb gleicher Seite umgekehrte Reihenfolge
    row.sort((a, b) => (a.side - b.side) || (b.i - a.i));
    row.forEach((x, k) => out.push({ ...x, x: (k + 1) * 100 / (row.length + 1), y: LINE_Y[line] }));
  }
  return out;
}

const LineupMode = makeMode('lineup', {
  generate(r) {
    if (!LINEUPS.length) return null;
    // Alle möglichen Rätsel (Spiel × Team), bekannteste fehlende Spieler bevorzugt
    const options = [];
    LINEUPS.forEach((g, gi) => [1, 2].forEach(side => {
      const lu = side === 1 ? g.lineup1 : g.lineup2;
      const cands = lu.map((p, i) => ({ i, sl: (HIST.byId.get(p.id) || { sl: 0 }).sl })).filter(x => x.sl >= 30);
      if (cands.length) options.push({ gi, side, cands });
    }));
    const o = pickOne(options, r);
    // gewichtet nach Bekanntheit
    const total = o.cands.reduce((s, x) => s + x.sl, 0);
    let roll = r() * total, miss = o.cands[0].i;
    for (const x of o.cands) { roll -= x.sl; if (roll <= 0) { miss = x.i; break; } }
    return { gi: o.gi, side: o.side, miss };
  },
  freshState: () => ({ guesses: [], done: false, won: false, revealed: [], usedHints: [] }),
  shareText() {
    const n = this.s.guesses.length;
    return `Soccerdle Wer fehlt ${this.s.won ? `⚽ ${n} ${n === 1 ? 'Versuch' : 'Versuche'}` : '❌'}${this.s.usedHints.length ? ' ' + '💡'.repeat(this.s.usedHints.length) : ''}`;
  },
  render() {
    const c = MODE_CONFIG.lineup, s = this.s, g = LINEUPS[this.puzzle.gi];
    const lu = this.puzzle.side === 1 ? g.lineup1 : g.lineup2;
    const team = this.puzzle.side === 1 ? g.team1 : g.team2, opp = this.puzzle.side === 1 ? g.team2 : g.team1;
    const missing = lu[this.puzzle.miss];
    const misses = s.guesses.filter(id => id !== missing.id).length;
    const defs = [
      { after: c.hints[0], label: 'Nation', html: missing.nat ? `${ICON.flag(missing.nat).replace('class="flag"', 'class="flag mini"')} ${esc(countryName(missing.nat))}` : '–' },
      { after: c.hints[1], label: 'Rückennummer', html: esc(missing.no) },
      { after: c.hints[2], label: 'Initialen', html: esc(initials(UNIVERSE.byId.get(missing.id) ? UNIVERSE.byId.get(missing.id).name : missing.name)) },
    ];
    const dots = layoutLineup(lu).map(({ p, i, x, y }) => {
      const isMiss = i === this.puzzle.miss;
      const label = isMiss ? (s.done ? (UNIVERSE.byId.get(p.id) || p).name : '?') : p.name;
      return `<div class="lu-p${isMiss ? ' miss' : ''}${isMiss && s.done ? (s.won ? ' won' : ' lost') : ''}" style="left:${x}%;top:${y}%">
        <span class="lu-shirt">${isMiss && !s.done ? '?' : esc(p.no)}</span><span class="lu-name">${esc(label)}</span></div>`;
    }).join('');
    const score = `${esc(g.score)}${g.penalties ? ` (i. E. ${esc(g.penalties)})` : ''}`;
    const sub = s.done ? (s.won ? `Gelöst in ${s.guesses.length}` : 'Aufgelöst') : `${s.guesses.length} Versuche`;
    const wrong = s.guesses.filter(id => id !== missing.id);
    this.root.innerHTML = `
      <section class="card play">
        ${this.header('Wer fehlt?', sub)}
        <p class="mode-intro">Welcher Spieler fehlt in dieser Startelf? <span class="pos-pill">${esc(POS_LINEUP_DE[missing.pos] || missing.pos)}</span></p>
        <div id="m-search"></div>
        ${hintsHtml(defs, misses, s.revealed, s.done)}
      </section>
      ${s.done ? resultCard(s.won, s.won ? 'Richtig!' : 'Schade!', `<p class="result-label">Gesucht war</p><div class="result-player">${esc((UNIVERSE.byId.get(missing.id) || missing).name)}</div>`, this) : ''}
      <section class="card lineup-card">
        <div class="lu-match"><span class="lu-comp">${esc(g.comp)} ${esc(g.year)}${g.stadium ? ' · ' + esc(g.stadium) : ''}</span>
          <span class="lu-teams">${esc(teamLabel(g.team1))} ${score} ${esc(teamLabel(g.team2))}</span>
          <span class="lu-side">Startelf von <b>${esc(teamLabel(team))}</b></span></div>
        <div class="lu-pitch">${dots}</div>
        ${s.done ? '' : '<div class="mode-foot"><button class="btn danger" data-act="giveup">Aufgeben</button></div>'}
      </section>
      ${wrong.length ? `<section class="card wrong-list"><b>Falsch getippt</b><ul>${wrong.slice().reverse().map(id => `<li>${esc(UNIVERSE.byId.get(id).name)}</li>`).join('')}</ul></section>` : ''}`;
    const search = createSearch(this.root.querySelector('#m-search'), {
      isExcluded: id => s.guesses.includes(id),
      onPick: id => {
        s.guesses.push(id);
        if (id === missing.id) { s.done = true; s.won = true; }
        this.save(); this.render();
      },
    });
    if (s.done) search.setDisabled(true, 'Gelöst – morgen gibt es ein neues Rätsel');
    this.bind();
  },
});

/* =========================================================================
   Navigation zwischen den Spielmodi
   ========================================================================= */
const GAMES = { career: CareerMode, grid: GridMode, mates: MatesMode, lineup: LineupMode };

function isClassicDoneToday() { const s = store.get('soccerdle-daily-' + todayStr(), null); return !!(s && s.done); }
function updateDoneDots() {
  document.querySelectorAll('.game').forEach(b => {
    const g = b.dataset.game;
    if (g !== 'classic' && !GAMES[g]) return; // z. B. Draft (eigene Datei) noch nicht geladen
    const done = g === 'classic' ? isClassicDoneToday() : GAMES[g].isDone();
    let dot = b.querySelector('.done-dot');
    if (done && !dot) { dot = document.createElement('i'); dot.className = 'done-dot'; dot.title = 'Heute gelöst'; b.appendChild(dot); }
    if (!done && dot) dot.remove();
  });
}

function showGame(game) {
  document.querySelectorAll('.game').forEach(b => b.classList.toggle('active', b.dataset.game === game));
  const classic = game === 'classic';
  document.getElementById('classic').hidden = !classic;
  const other = document.getElementById('other-mode');
  other.hidden = classic;
  if (!classic) { GAMES[game].test = null; GAMES[game].start(other); }
  try { localStorage.setItem('soccerdle-game', game); } catch { /* egal */ }
  window.scrollTo({ top: 0 });
}

document.querySelectorAll('.game').forEach(b => b.addEventListener('click', () => showGame(b.dataset.game)));
updateDoneDots();
setInterval(updateDoneDots, 5000);
// Zuletzt gewählten Modus wiederherstellen – erst wenn alle Skripte (auch draft.js) geladen sind
document.addEventListener('DOMContentLoaded', () => {
  let g = null; try { g = localStorage.getItem('soccerdle-game'); } catch { /* egal */ }
  if (g && (g === 'classic' || GAMES[g])) showGame(g);
  updateDoneDots();
});
