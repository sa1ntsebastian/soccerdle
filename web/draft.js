'use strict';

/* =========================================================================
   Soccerdle – Draft
   11 Runden: je 3 zufällige Team-Saisons -> Team öffnen -> Spieler auf eine Position ziehen.
   Soccerdle-Rating: eigene Formel (Bekanntheit, Vereinsstärke der Saison, Alter), an FIFA geeicht.
   Positionsabzug nach Abstand auf dem Spielfeld (Mittelfeld-Rollen und Flügel frei tauschbar). Ergebnis: Team-Rating (Ø der 11) im Vergleich zur perfekten Elf.
   ========================================================================= */

const DRAFT = {
  // 4-2-3-1 – x/y in % der Spielfeld-Darstellung (oben = Angriff)
  formation: [
    { pos: 'ST', x: 50, y: 11 },
    { pos: 'LA', x: 15, y: 29 }, { pos: 'ZOM', x: 50, y: 32 }, { pos: 'RA', x: 85, y: 29 },
    { pos: 'ZDM', x: 33, y: 53 }, { pos: 'ZDM', x: 67, y: 53 },
    { pos: 'LV', x: 11, y: 71 }, { pos: 'IV', x: 36, y: 76 }, { pos: 'IV', x: 64, y: 76 }, { pos: 'RV', x: 89, y: 71 },
    { pos: 'TW', x: 50, y: 91 },
  ],
  topClubs: 60,      // nur Team-Saisons der großen Vereine
  minSquad: 16,      // mind. so viele bekannte Spieler im Kader
  minNatSquad: 15,   // Nationalteams (Turnierkader): mind. so viele bekannte Spieler
  nationShare: 0.2,  // Anteil der Nationalteams an den Angeboten
  fromYear: 1990,
};

// Team-Schlüssel: Verein "<Vereinsindex>|<Saison>", Nationalteam "N|<Code>|<WM|EM>|<Jahr>"
function parseKey(k) {
  const a = k.split('|');
  if (a[0] === 'N') return { nat: true, code: a[1], comp: a[2], year: Number(a[3]), group: 'N' + a[1] };
  return { nat: false, club: Number(a[0]), year: Number(a[1]), group: a[0] };
}

// Lage der Positionen auf dem Feld (x: links->rechts, y: eigenes Tor -> Angriff) für den Positionsabzug
const POS_FIELD = { TW: [50, 0], IV: [50, 22], LV: [12, 28], RV: [88, 28], ZDM: [50, 42], ZM: [50, 55], ZOM: [50, 70],
  LM: [12, 58], RM: [88, 58], LA: [12, 78], RA: [88, 78], ST: [50, 90] };
const POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', ZDM: 'Defensives MF',
  ZM: 'Zentrales MF', ZOM: 'Offensives MF', LM: 'Linkes MF', RM: 'Rechtes MF', LA: 'Linksaußen', RA: 'Rechtsaußen', ST: 'Stürmer' };
const POS_GROUPS = [['Tor', ['TW']], ['Abwehr', ['RV', 'IV', 'LV']], ['Mittelfeld', ['ZDM', 'ZM', 'ZOM', 'RM', 'LM']], ['Angriff', ['RA', 'LA', 'ST']]];

// Positionen, die untereinander ohne Abzug tauschbar sind (Abzug soll nur grobe Fehlbesetzungen wie Stürmer in der Abwehr treffen)
const SAME_GROUP = [new Set(['ZDM', 'ZM', 'ZOM']), new Set(['LM', 'LA']), new Set(['RM', 'RA'])];

// Faktor für "spielt auf Position slot, ist eigentlich natural": 1 = kein Abzug
function positionFactor(natural, slot) {
  if (Array.isArray(natural)) return Math.max(...natural.map(n => positionFactor(n, slot)));   // Haupt- und Zweitpositionen: die beste zählt
  if (!natural || natural === slot) return 1;
  if (natural === 'TW' || slot === 'TW') return 0.2;               // Feldspieler im Tor / Torwart im Feld
  if (SAME_GROUP.some(g => g.has(natural) && g.has(slot))) return 1; // ZDM/ZM/ZOM, LM/LA, RM/RA kaum unterscheidbar -> kein Abzug
  const [x1, y1] = POS_FIELD[natural], [x2, y2] = POS_FIELD[slot];
  const d = Math.hypot((x1 - x2) * 0.5, y1 - y2);                  // seitlich zählt nur halb (LA <-> RA ist kein Drama)
  return 1 - 0.8 * Math.pow(d / 100, 1.5);
}

/* ---------- Kader-Index: welcher Spieler war in welcher Saison bei welchem Verein ---------- */
const currentSeason = () => { const [y, m] = todayStr().split('-').map(Number); return m >= 7 ? y : y - 1; };
let DRAFT_INDEX = null;
function draftIndex() {
  if (DRAFT_INDEX) return DRAFT_INDEX;
  const cur = currentSeason();
  const squads = new Map(); // "club|saison" -> [player]
  for (const p of HIST.players) {
    if (!p.detail) continue;
    for (const s of p.career) {
      if (!s.f) continue;
      // Saison y/y+1 zählt, wenn der Spieler davor/zu Beginn kam und bis mind. Saisonende blieb
      const last = s.t ? s.t - 1 : cur;
      for (let y = Math.max(s.f, DRAFT.fromYear); y <= last; y++) {
        const k = s.c + '|' + y;
        if (!squads.has(k)) squads.set(k, []);
        const list = squads.get(k);
        if (!list.includes(p)) list.push(p);
      }
    }
  }
  // Vereinsstärke je Saison: Ø ln(Bekanntheit) der 11 bekanntesten
  const strength = new Map();
  for (const [k, list] of squads) {
    const top = list.map(p => Math.log(p.sl)).sort((a, b) => b - a).slice(0, 11);
    strength.set(k, top.reduce((a, b) => a + b, 0) / Math.max(1, top.length));
  }
  // Große Vereine
  const count = new Map();
  for (const p of HIST.players) if (p.sl >= 60) for (const ci of new Set(p.career.map(s => s.c))) count.set(ci, (count.get(ci) || 0) + 1);
  const big = new Set([...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, DRAFT.topClubs).map(([ci]) => ci));
  const teams = [...squads.entries()].filter(([k, l]) => big.has(Number(k.split('|')[0])) && l.length >= DRAFT.minSquad).map(([k]) => k);

  // Nationalteams: Turnierkader (WM/EM) aus data/nations.js -> [Code, Turnier, Jahr, [Wikidata-IDs]]
  const natTeams = [];
  for (const [code, comp, year, ids] of (window.SOCCERDLE_NATIONS || [])) {
    const list = ids.map(id => HIST.byId.get(id)).filter(p => p && p.detail);
    if (list.length < DRAFT.minNatSquad) continue;
    const k = `N|${code}|${comp}|${year}`;
    squads.set(k, list);
    const top = list.map(p => Math.log(p.sl)).sort((a, b) => b - a).slice(0, 11);
    strength.set(k, top.reduce((a, b) => a + b, 0) / Math.max(1, top.length));
    natTeams.push(k);
  }
  DRAFT_INDEX = { squads, strength, teams, natTeams };
  return DRAFT_INDEX;
}

// Marktwert-Rating je Spieler und Saison (data/market.js, aus build-market.ps1): "2014:91,2015:90,..." -> { 2014: 91, ... }
let MARKET = null;
function marketRating(id, y) {
  if (!MARKET) {
    MARKET = new Map();
    for (const [pid, s] of Object.entries(window.SOCCERDLE_MARKET || {})) { const o = {}; for (const kv of s.split(',')) { const [yy, r] = kv.split(':'); o[yy] = Number(r); } MARKET.set(pid, o); }
  }
  const o = MARKET.get(id);
  return o && o[y] != null ? o[y] : null;
}
// Marktwert spiegelt Alter mit: Junge sind "zu teuer", Ältere "zu billig" -> grob ausgleichen (provisorisch, siehe CLAUDE.md)
const ageAdjust = age => age >= 31 ? Math.min(8, (age - 30) * 1.3) : age <= 21 ? -Math.min(4, 22 - age) : 0;

function soccerdleRating(p, teamKey) {
  const w = HIST.model;
  if (!w) return 60;
  const tk = parseKey(teamKey);
  const y = tk.nat ? tk.year - 1 : tk.year;                 // Saison, in der das Turnier stattfand
  const age = p.dob ? y - Number(p.dob.slice(0, 4)) : 27;
  // Nationalteam: Stärke des Vereins, bei dem der Spieler in dieser Saison war (sonst Stärke des Kaders)
  let stKey = teamKey;
  if (tk.nat) {
    const idx = draftIndex();
    const stint = p.career.find(s => s.f && s.f <= y && (!s.t || s.t - 1 >= y) && idx.strength.has(s.c + '|' + y));
    if (stint) stKey = stint.c + '|' + y;
  }
  const mr = marketRating(p.id, y);
  if (mr != null) return Math.max(40, Math.min(99, Math.round(mr + ageAdjust(age) + (p.detail === 'TW' ? 5 : 0) + (HIST.adjust[p.id] || 0))));   // Torhüter-Marktwerte liegen bei gleicher Stärke niedriger   // leistungsnah (Marktwert der Saison)
  const st = draftIndex().strength.get(stKey) || 3;
  const r = w.konstante + w.ln_bekanntheit * Math.log(p.sl) + w.vereinsstaerke * st
    + w.jung2 * Math.max(0, 26 - age) ** 2 + w.alt2 * Math.max(0, age - 30) ** 2
    + w.torwart * (p.detail === 'TW' ? 1 : 0) + (HIST.adjust[p.id] || 0);
  return Math.max(40, Math.min(99, Math.round(r)));
}

const seasonLabel = y => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
const teamTitle = k => {
  const t = parseKey(k);
  if (t.nat) return { club: countryName(t.code), season: `${t.comp === 'WM' ? 'WM' : 'EM'} ${t.year}`, flag: COUNTRIES[t.code] ? ICON.flag(t.code).replace('class="flag"', 'class="flag mini"') : '' };
  return { club: clubName(t.club), season: seasonLabel(t.year), flag: clubFlag(t.club) };
};
function squadOf(teamKey) {
  return (draftIndex().squads.get(teamKey) || []).map(p => ({ id: p.id, name: p.name, nat: p.nat, pos: p.detail, poss: [p.detail, ...(p.alt || [])], rating: soccerdleRating(p, teamKey) }))
    .sort((a, b) => b.rating - a.rating);
}
const posList = x => x.poss || x.pos;   // Haupt- + Zweitpositionen (ältere Spielstände: nur Hauptposition)
const effective = sl => sl ? Math.round(sl.rating * positionFactor(posList(sl), sl.slotPos)) : 0;
const effRaw = (rating, pos, slotPos) => rating * positionFactor(pos, slotPos);
function teamRating(slots, divideBy = 11) {
  const sum = slots.reduce((s, x) => s + (x ? effective(x) : 0), 0);
  return Math.round(sum / divideBy * 10) / 10;   // eine Nachkommastelle: 17 Punkte Rückstand auf 11 Spieler = 1,5 Rating-Punkte
}

/* ---------- 100 Punkte = bestmögliche Elf aus den angebotenen Teams ----------
   Jede Runde liefert genau einen Spieler (aus einem ihrer 3 Teams) für genau eine Position.
   Optimum = Zuordnung Runden -> Positionen mit maximaler Summe (Ungarischer Algorithmus, 11x11). */
function hungarianMin(cost) {
  const n = cost.length, u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const rowToCol = Array(n);
  for (let j = 1; j <= n; j++) if (p[j]) rowToCol[p[j] - 1] = j - 1;
  return rowToCol;
}

function optimalDraft(history) {
  const pools = history.map(offers => offers.flatMap(k => squadOf(k).map(p => ({ ...p, team: k }))));
  // Löst die Zuordnung Runde -> Position; "banned" = Set aus "Runde|Spieler-ID" (Spieler in dieser Runde nicht erlaubt)
  const solve = banned => {
    const best = pools.map((pool, r) => DRAFT.formation.map(f => {
      let top = null, val = -1;
      for (const p of pool) {
        if (banned.has(r + '|' + p.id)) continue;
        const e = effRaw(p.rating, posList(p), f.pos);
        if (e > val) { val = e; top = p; }
      }
      return { p: top, val };
    }));
    const assign = hungarianMin(best.map(row => row.map(x => -x.val)));
    const picks = assign.map((slot, r) => ({ r, slot, ...best[r][slot] }));
    const byId = new Map();
    for (const x of picks) if (x.p) { if (!byId.has(x.p.id)) byId.set(x.p.id, []); byId.get(x.p.id).push(x); }
    return { picks, sum: picks.reduce((a, x) => a + x.val, 0), dup: [...byId.values()].find(l => l.length > 1) };
  };
  // Derselbe Spieler darf nur einmal vorkommen: bei Doppelung verzweigen (jede Runde darf ihn behalten, die anderen nicht)
  let bestSol = null, nodes = 0;
  const search = banned => {
    if (++nodes > 400) return;
    const s = solve(banned);
    if (bestSol && s.sum <= bestSol.sum) return;
    if (!s.dup) { bestSol = s; return; }
    for (const keep of s.dup) {
      const b = new Set(banned);
      for (const o of s.dup) if (o !== keep) b.add(o.r + '|' + o.p.id);
      search(b);
    }
  };
  search(new Set());
  if (!bestSol) bestSol = solve(new Set());
  const lineup = Array(11).fill(null);
  bestSol.picks.forEach(x => { lineup[x.slot] = x.p && { ...x.p, slotPos: DRAFT.formation[x.slot].pos }; });
  return { sum: bestSol.sum, lineup };
}

// Ergebnis = Team-Rating: Ø der 11 angezeigten Positionswerte (mit Positionsabzug). Zum Vergleich die perfekte Elf aus denselben Angeboten;
// der Rückstand je Position steht in der Auswertung am Spieler.
const slotValue = x => x ? Math.round(effRaw(x.rating, posList(x), x.slotPos)) : 0;
const lineupRating = lineup => Math.round(lineup.reduce((a, x) => a + slotValue(x), 0) / 11 * 10) / 10;
const fmt1 = v => v.toFixed(1).replace('.', ',');   // 83,4
const draftRating = s => lineupRating(s.slots);

/* ---------- Modus ---------- */
const DraftMode = {
  root: null, test: null, s: null, selected: null,
  storeKey: 'soccerdle-draft-current',
  isDone() { return false; },
  fresh() { return { round: 0, slots: Array(11).fill(null), offers: this.newOffers([]), open: null, pending: null, done: false, history: [] }; },
  newOffers(slots) {
    const { teams, natTeams } = draftIndex();
    const picked = new Set(slots.filter(Boolean).map(x => x.id));
    const out = [], clubs = new Set();
    for (let guard = 0; out.length < 3 && guard < 500; guard++) {
      const pool = natTeams.length && Math.random() < DRAFT.nationShare ? natTeams : teams;
      const k = pool[Math.floor(Math.random() * pool.length)];
      const c = parseKey(k).group;                   // pro Runde jeder Verein / jedes Land nur einmal
      if (clubs.has(c)) continue;
      // Team muss noch mind. 3 nicht gedraftete Spieler haben
      if ((draftIndex().squads.get(k) || []).filter(p => !picked.has(p.id)).length < 3) continue;
      clubs.add(c); out.push(k);
    }
    return out;
  },
  start(root) {
    this.root = root;
    if (!HIST.players.length || !HIST.model) { root.innerHTML = '<section class="card play"><p>Für den Draft fehlen die Daten (data/history.js).</p></section>'; return; }
    this.s = store.get(this.storeKey, null);
    if (!this.s || !this.s.history) this.s = this.fresh(); // auch alte Spielstände ohne Angebots-Verlauf neu starten
    this.selected = null;
    this.render();
    if (!store.get('soccerdle-seen-help-draft', false)) { store.set('soccerdle-seen-help-draft', true); showModeHelp('draft'); }
  },
  helpTitle: 'Draft',
  helpHtml: HT.page('Stell aus Vereins-Saisons und Nationalteams die beste Elf zusammen – 11 Runden, Formation 4-2-3-1.', [
    { title: 'Mannschaft wählen', text: 'Du bekommst 3 Angebote: Vereins-Saisons oder Nationalteams bei WM/EM. <b>Du musst dich festlegen</b> – erst danach siehst du die Spieler.',
      art: '<div class="ex-row"><span class="ex-offer">FC Everton<b>2010/11</b><small>Ø 79</small></span><span class="ex-offer on">Deutschland<b>WM 2014</b><small>Ø 85</small></span><span class="ex-offer">Ajax<b>2011/12</b><small>Ø 75</small></span></div>' },
    { title: 'Spieler aufstellen', text: 'Spieler auf eine freie Position ziehen (Handy: antippen), dann mit <b>✓</b> bestätigen. Danach gibt es kein Zurück und 3 neue Mannschaften.',
      art: HT.pitch([[75, 28, '', ''], [28, 62, ''], [75, 66, '✓', 'ok'], [122, 62, ''], [52, 108, ''], [98, 108, ''], [22, 140, ''], [58, 150, ''], [92, 150, ''], [128, 140, ''], [75, 174, '']]) },
    { title: 'Positionen', text: 'ZDM/ZM/ZOM, LM/LA und RM/RA sind frei tauschbar, Zweitpositionen (z. B. Kimmich als RV) ebenso. <b>Grobe Fehlbesetzungen</b> kosten Punkte.',
      art: '<div class="ex-row">' + HT.tile('ZDM → RV', 'Kimmich', 'hit') + HT.tile('ST → IV', '−45 %', 'miss') + '</div>' },
    { title: 'Team-Rating', text: 'Am Ende zählt der <b>Durchschnitt deiner 11 Spieler</b> (inkl. Positionsabzug). Zum Vergleich siehst du die <b>perfekte Elf</b> aus deinen Angeboten – am Spieler steht, wie viele Rating-Punkte sie auf der Position voraus ist.',
      art: '<div class="ex-row ex-eq">' + HT.tile('Dein Team', '83,4', 'near') + '<span class="ex-op">vs.</span>' + HT.tile('Perfekte Elf', '84,9', 'hit') + '</div>' },
  ]),
  save() { store.set(this.storeKey, this.s); },
  restart() { this.s = this.fresh(); this.selected = null; this.save(); this.render(); },

  place(player, slotIdx) {   // Spieler vorläufig setzen – erst ✓ bestätigt endgültig
    const s = this.s;
    if (s.done || s.pending != null || s.slots[slotIdx]) return;
    s.slots[slotIdx] = { ...player, slotPos: DRAFT.formation[slotIdx].pos, team: s.open };
    s.pending = slotIdx;
    this.selected = null;
    this.save(); this.render();
  },
  undo() {                   // vorläufige Wahl zurücknehmen (Mannschaft bleibt gewählt)
    const s = this.s;
    if (s.pending == null) return;
    s.slots[s.pending] = null; s.pending = null; this.selected = null;
    this.save(); this.render();
  },
  confirm() {                // endgültig: nächste Runde mit 3 neuen Mannschaften
    const s = this.s;
    if (s.pending == null) return;
    s.history.push(s.offers.slice());          // Angebote dieser Runde merken (für die perfekte Elf)
    s.round++; s.pending = null; this.selected = null;
    if (s.round >= 11) {
      s.done = true; s.open = null;
      s.opt = optimalDraft(s.history);
      this.updateBest();
    } else {
      s.offers = this.newOffers(s.slots); s.open = null;
    }
    this.save(); this.render();
  },
  chooseTeam(k) {            // Mannschaft wählen ist endgültig – erst danach sieht man die Spieler
    const s = this.s;
    if (s.open || s.done) return;
    s.open = k; this.selected = null; this.save(); this.render();
  },
  updateBest() {
    const r = draftRating(this.s), best = store.get('soccerdle-draft-best-rating', 0);
    this.s.newBest = r > best;
    if (this.s.newBest) store.set('soccerdle-draft-best-rating', r);
  },

  // Spielfeld mit Aufstellung. kind: 'play' (interaktiv) | 'mine' | 'opt' (Gegenüberstellung am Ende)
  pitchHtml(slots, kind) {
    const s = this.s, other = kind === 'mine' ? (s.opt ? s.opt.lineup : []) : kind === 'opt' ? s.slots : [];
    return DRAFT.formation.map((f, i) => {
      const x = slots[i];
      if (!x) {
        const hint = kind === 'play' && this.selected && this.selected.type === 'player' && s.pending == null ? ' target' : '';
        return `<div class="d-slot empty${hint}" data-slot="${i}" style="left:${f.x}%;top:${f.y}%"><span class="d-pos">${f.pos}</span></div>`;
      }
      const eff = effective(x), factor = positionFactor(posList(x), x.slotPos);
      const pen = factor < 1 ? `<span class="d-pen" title="${esc(POS_NAME[x.pos])} auf ${esc(POS_NAME[x.slotPos])}">−${Math.round((1 - factor) * 100)}%</span>` : '';
      const pend = kind === 'play' && s.pending === i;
      const same = kind !== 'play' && other[i] && other[i].id === x.id;
      const meta = kind === 'opt' && x.team ? (t => `${t.club} ${t.season}`)(teamTitle(x.team)) : `${x.pos}${x.pos !== x.slotPos ? (factor === 1 && (x.poss || []).includes(x.slotPos) ? ' · auch ' + x.slotPos : ' → ' + x.slotPos) : ''}`;
      const dl = kind === 'mine' && other[i] ? slotValue(other[i]) - slotValue(x) : 0;
      const delta = dl ? `<span class="d-delta${dl < 0 ? ' plus' : ''}" title="Unterschied zur perfekten Elf auf dieser Position">${dl > 0 ? '−' : '+'}${Math.abs(dl)}</span>` : '';
      const ok = pend ? `<span class="d-acts"><button class="d-ok" data-act="confirm" title="Bestätigen">✓</button><button class="d-undo" data-act="undo" title="Zurücknehmen">↩</button></span>` : '';
      return `<div class="d-slot filled${factor < 1 ? ' off' : ''}${pend ? ' pend' : ''}${same ? ' same' : ''}" data-slot="${i}" data-pos="${x.slotPos}" style="left:${f.x}%;top:${f.y}%">
        <span class="d-rating">${eff}</span>${pen}${delta}${ok}<span class="d-name">${esc(x.name)}</span><span class="d-meta">${esc(meta)}</span></div>`;
    }).join('');
  },

  render() {
    const s = this.s;
    const filled = s.slots.filter(Boolean).length;
    const live = filled ? teamRating(s.slots, filled) : 0;
    const best = store.get('soccerdle-draft-best-rating', 0);

    let body;
    if (s.done) {
      const opt = s.opt || optimalDraft(s.history);
      s.opt = opt;
      const optRating = lineupRating(opt.lineup), myRating = draftRating(s);
      const same = s.slots.filter((x, i) => x && opt.lineup[i] && x.id === opt.lineup[i].id).length;
      body = `
        <section class="card result-card won">
          <p class="result-label">Team-Rating deiner Elf</p>
          <div class="d-points"><b>${fmt1(myRating)}</b></div>
          <p class="result-label">Perfekte Elf aus deinen Angeboten: <b>${fmt1(optRating)}</b> · ${same} von 11 Spielern gleich</p>
          <p class="result-label">${s.newBest ? 'Neuer persönlicher Rekord! 🎉' : `Dein Rekord: ${fmt1(best)}`}</p>
          <div class="result-actions"><button class="primary" data-act="share">Ergebnis teilen</button>
          <button class="secondary" data-act="restart">Neuer Draft</button></div></section>
        <div class="d-compare">
          <section class="card d-pitch-card"><div class="d-score"><span>Deine Elf</span><b>${fmt1(myRating)}</b><small>Team-Rating</small></div>
            <div class="d-pitch">${this.pitchHtml(s.slots, 'mine')}</div></section>
          <section class="card d-pitch-card"><div class="d-score"><span>Perfekte Elf</span><b>${fmt1(optRating)}</b><small>Team-Rating</small></div>
            <div class="d-pitch">${this.pitchHtml(opt.lineup, 'opt')}</div></section>
        </div>
        <p class="mode-intro d-legend">Das Team-Rating ist der Durchschnitt der 11 Werte (die Rückstände an den Spielern summieren sich, geteilt durch 11, zum Unterschied der Ratings). Das rote „−11“ an einem Spieler heißt: Die perfekte Elf hat auf dieser Position 11 Rating-Punkte mehr. Weiß umrandet mit ✓ = derselbe Spieler. Bei der perfekten Elf steht darunter, aus welchem Team er kam.</p>`;
    } else {
      const locked = !!s.open;
      const offers = s.offers.map(k => {
        const t = teamTitle(k), sq = squadOf(k);
        const avg = Math.round(sq.slice(0, 11).reduce((a, p) => a + p.rating, 0) / Math.min(11, sq.length));
        const cls = s.open === k ? ' active' : locked ? ' gone' : '';
        return `<button class="d-offer${cls}" data-team="${esc(k)}" ${locked ? 'disabled' : ''}>
          <span class="d-club">${t.flag}${esc(t.club)}</span><span class="d-season">${esc(t.season)}</span><span class="d-avg">Ø ${avg}</span></button>`;
      }).join('');
      let squad = '';
      if (s.open) {
        const picked = new Set(s.slots.filter(Boolean).map(x => x.id));
        const list = squadOf(s.open);
        squad = `<div class="d-squad">${POS_GROUPS.map(([label, poss]) => {
          const ps = list.filter(p => poss.includes(p.pos));
          if (!ps.length) return '';
          return `<div class="d-group"><b>${label}</b>${ps.map(p => {
            const used = picked.has(p.id) || s.pending != null, sel = this.selected && this.selected.type === 'player' && this.selected.p.id === p.id;
            return `<div class="d-player${used ? ' used' : ''}${sel ? ' sel' : ''}" ${used ? '' : `draggable="true" data-pid="${esc(p.id)}"`}>
              <span class="d-ppos">${esc(p.pos)}</span>${p.nat ? ICON.flag(p.nat).replace('class="flag"', 'class="flag mini"') : ''}
              <span class="d-pname">${esc(p.name)}</span><span class="d-prating">${p.rating}</span></div>`;
          }).join('')}</div>`;
        }).join('')}</div>`;
      }
      const hint = s.pending != null ? '<b>Passt das so?</b> Mit ✓ am Spielfeld bestätigen (↩ nimmt die Wahl zurück). Danach gibt es 3 neue Mannschaften – verschieben geht nicht mehr.'
        : s.open ? '<b>Spieler auf eine freie Position ziehen</b> – oder antippen und dann die Position antippen.'
        : '<b>Entscheide dich für eine Mannschaft.</b> Erst dann siehst du die Spieler – umentscheiden geht nicht.';
      body = `
        <div class="d-layout">
          <section class="card d-pitch-card">
            <div class="d-score"><span>Team-Rating</span><b>${filled ? fmt1(live) : '–'}</b><small>${filled ? `Ø der ${filled} Spieler` : 'noch kein Spieler'}</small></div>
            <div class="d-pitch">${this.pitchHtml(s.slots, 'play')}</div>
          </section>
          <div class="d-side"><section class="card d-pick">
            <p class="mode-intro">${hint}</p>
            ${s.pending != null ? '<button class="primary d-confirm" data-act="confirm">✓ Bestätigen</button>' : ''}
            <div class="d-offers">${offers}</div>${squad}</section></div>
        </div>`;
    }

    this.root.innerHTML = `
      <section class="card play">
        <div class="play-top"><b>Draft</b><span class="play-right"><span>${s.done ? 'Fertig' : `Runde ${s.round + 1} von 11`} · Rekord ${best ? fmt1(best) : '–'}</span>
          <button class="btn test-btn" data-act="restart">↻ Neuer Draft</button></span></div>
        <p class="mode-intro">Bau dir aus Team-Saisons und Nationalteams die beste Elf. Am Ende siehst du dein <b>Team-Rating</b> und die perfekte Elf aus allen Teams, die dir angeboten wurden. <button class="linklike" data-act="help">Wie funktioniert’s?</button></p>
      </section>${body}`;
    this.bind();
  },

  bind() {
    const r = this.root, s = this.s;
    r.querySelectorAll('[data-act="restart"]').forEach(b => b.onclick = () => this.restart());
    r.querySelectorAll('[data-act="help"]').forEach(b => b.onclick = () => showModeHelp('draft'));
    r.querySelectorAll('[data-act="confirm"]').forEach(b => b.onclick = e => { e.stopPropagation(); this.confirm(); });
    r.querySelectorAll('[data-act="undo"]').forEach(b => b.onclick = e => { e.stopPropagation(); this.undo(); });
    r.querySelectorAll('[data-act="share"]').forEach(b => {
      if (!s.done) return;
      const my = draftRating(s), perfect = lineupRating((s.opt || optimalDraft(s.history)).lineup);
      b.onclick = shareButton(`Soccerdle Draft ⭐ Team-Rating ${fmt1(my)} (perfekte Elf: ${fmt1(perfect)})`, {
        mode: 'Draft', big: fmt1(my), sub: `Team-Rating · perfekte Elf: ${fmt1(perfect)}`,
        pitch: { slots: DRAFT.formation.map((f, i) => ({ x: f.x, y: f.y, name: s.slots[i].name.split(' ').slice(-1)[0], rating: effective(s.slots[i]) })), caption: '4-2-3-1' },
      });
    });
    r.querySelectorAll('[data-team]').forEach(b => b.onclick = () => this.chooseTeam(b.dataset.team));
    if (s.done) return;

    const playerById = id => squadOf(s.open).find(p => p.id === id);
    // Antippen: Spieler wählen -> Position wählen
    r.querySelectorAll('.d-player[data-pid]').forEach(el => {
      el.onclick = () => {
        const p = playerById(el.dataset.pid);
        this.selected = (this.selected && this.selected.p && this.selected.p.id === p.id) ? null : { type: 'player', p };
        this.render();
        // Handy: Spielfeld liegt unter der Liste -> hinscrollen, damit man die Position antippen kann
        if (this.selected && matchMedia('(max-width: 860px)').matches) this.root.querySelector('.d-pitch-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'p:' + el.dataset.pid); e.dataTransfer.effectAllowed = 'move'; });
    });
    r.querySelectorAll('.d-slot.empty').forEach(el => {
      const idx = Number(el.dataset.slot);
      el.onclick = () => { if (this.selected && this.selected.type === 'player') this.place(this.selected.p, idx); };
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('over');
        const data = e.dataTransfer.getData('text/plain');
        if (data.startsWith('p:')) { const p = playerById(data.slice(2)); if (p) this.place(p, idx); }
      });
    });
  },
};
GAMES.draft = DraftMode;
