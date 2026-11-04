'use strict';

/* =========================================================================
   Soccerdle – Draft
   11 Runden: je 3 zufällige Team-Saisons -> Team öffnen -> Spieler auf eine Position ziehen.
   Soccerdle-Rating: eigene Formel (Bekanntheit, Vereinsstärke der Saison, Alter), an FIFA geeicht.
   Positionsabzug nach Abstand auf dem Spielfeld. Ergebnis: Team-Rating (Ø der 11 Spieler).
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
  fromYear: 1990,
};

// Lage der Positionen auf dem Feld (x: links->rechts, y: eigenes Tor -> Angriff) für den Positionsabzug
const POS_FIELD = { TW: [50, 0], IV: [50, 22], LV: [12, 28], RV: [88, 28], ZDM: [50, 42], ZM: [50, 55], ZOM: [50, 70],
  LM: [12, 58], RM: [88, 58], LA: [12, 78], RA: [88, 78], ST: [50, 90] };
const POS_NAME = { TW: 'Torwart', IV: 'Innenverteidiger', LV: 'Linksverteidiger', RV: 'Rechtsverteidiger', ZDM: 'Defensives MF',
  ZM: 'Zentrales MF', ZOM: 'Offensives MF', LM: 'Linkes MF', RM: 'Rechtes MF', LA: 'Linksaußen', RA: 'Rechtsaußen', ST: 'Stürmer' };
const POS_GROUPS = [['Tor', ['TW']], ['Abwehr', ['RV', 'IV', 'LV']], ['Mittelfeld', ['ZDM', 'ZM', 'ZOM', 'RM', 'LM']], ['Angriff', ['RA', 'LA', 'ST']]];

// Faktor für "spielt auf Position slot, ist eigentlich natural": 1 = kein Abzug
function positionFactor(natural, slot) {
  if (!natural || natural === slot) return 1;
  if (natural === 'TW' || slot === 'TW') return 0.2;               // Feldspieler im Tor / Torwart im Feld
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
  DRAFT_INDEX = { squads, strength, teams };
  return DRAFT_INDEX;
}

function soccerdleRating(p, teamKey) {
  const w = HIST.model;
  if (!w) return 60;
  const y = Number(teamKey.split('|')[1]);
  const age = p.dob ? y - Number(p.dob.slice(0, 4)) : 27;
  const st = draftIndex().strength.get(teamKey) || 3;
  const r = w.konstante + w.ln_bekanntheit * Math.log(p.sl) + w.vereinsstaerke * st
    + w.jung2 * Math.max(0, 26 - age) ** 2 + w.alt2 * Math.max(0, age - 30) ** 2
    + w.torwart * (p.detail === 'TW' ? 1 : 0) + (HIST.adjust[p.id] || 0);
  return Math.max(40, Math.min(99, Math.round(r)));
}

const seasonLabel = y => `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
const teamTitle = k => { const [c, y] = k.split('|').map(Number); return { club: clubName(c), season: seasonLabel(y), flag: clubFlag(c) }; };
function squadOf(teamKey) {
  return (draftIndex().squads.get(teamKey) || []).map(p => ({ id: p.id, name: p.name, nat: p.nat, pos: p.detail, rating: soccerdleRating(p, teamKey) }))
    .sort((a, b) => b.rating - a.rating);
}
const effective = sl => sl ? Math.round(sl.rating * positionFactor(sl.pos, sl.slotPos)) : 0;
const effRaw = (rating, pos, slotPos) => rating * positionFactor(pos, slotPos);
function teamRating(slots, divideBy = 11) {
  const sum = slots.reduce((s, x) => s + (x ? effective(x) : 0), 0);
  return Math.round(sum / divideBy);
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
  // best[r][slot] = bester Spieler der Runde r für diese Position (inkl. Positionsabzug)
  const best = history.map(offers => {
    const pool = offers.flatMap(k => squadOf(k).map(p => ({ ...p, team: k })));
    return DRAFT.formation.map(f => {
      let top = null, val = -1;
      for (const p of pool) { const e = effRaw(p.rating, p.pos, f.pos); if (e > val) { val = e; top = p; } }
      return { p: top, val };
    });
  });
  const assign = hungarianMin(best.map(row => row.map(x => -x.val)));
  const lineup = Array(11).fill(null);
  let sum = 0;
  assign.forEach((slot, r) => { const b = best[r][slot]; sum += b.val; lineup[slot] = { ...b.p, slotPos: DRAFT.formation[slot].pos }; });
  return { sum, lineup };
}

function draftPoints(s) {
  if (!s.history || s.history.length < 11) return null;
  const opt = s.opt || optimalDraft(s.history);
  const mine = s.slots.reduce((a, x) => a + (x ? effRaw(x.rating, x.pos, x.slotPos) : 0), 0);
  return Math.min(100, Math.round(100 * mine / opt.sum));
}

/* ---------- Modus ---------- */
const DraftMode = {
  root: null, test: null, s: null, selected: null,
  storeKey: 'soccerdle-draft-current',
  isDone() { return false; },
  fresh() { return { round: 0, slots: Array(11).fill(null), offers: this.newOffers([]), open: null, done: false, history: [] }; },
  newOffers(slots) {
    const { teams } = draftIndex();
    const picked = new Set(slots.filter(Boolean).map(x => x.id));
    const out = [], clubs = new Set();
    for (let guard = 0; out.length < 3 && guard < 500; guard++) {
      const k = teams[Math.floor(Math.random() * teams.length)];
      const c = k.split('|')[0];
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
  },
  save() { store.set(this.storeKey, this.s); },
  restart() { this.s = this.fresh(); this.selected = null; this.save(); this.render(); },

  place(player, slotIdx) {
    const s = this.s;
    if (s.done || s.slots[slotIdx]) return;
    s.slots[slotIdx] = { ...player, slotPos: DRAFT.formation[slotIdx].pos, team: s.open };
    s.history.push(s.offers.slice());          // Angebote dieser Runde merken (für die perfekte Elf)
    s.round++;
    this.selected = null;
    if (s.round >= 11) {
      s.done = true; s.open = null;
      s.opt = optimalDraft(s.history);
      this.updateBest();
    } else {
      s.offers = this.newOffers(s.slots); s.open = null;
    }
    this.save(); this.render();
  },
  swap(a, b) { // bereits platzierte Spieler umstellen
    const s = this.s, A = s.slots[a], B = s.slots[b];
    s.slots[a] = B ? { ...B, slotPos: DRAFT.formation[a].pos } : null;
    s.slots[b] = A ? { ...A, slotPos: DRAFT.formation[b].pos } : null;
    if (s.done) this.updateBest();
    this.selected = null; this.save(); this.render();
  },
  updateBest() {
    const pts = draftPoints(this.s), best = store.get('soccerdle-draft-best-points', 0);
    this.s.newBest = pts > best;
    if (this.s.newBest) store.set('soccerdle-draft-best-points', pts);
  },

  render() {
    const s = this.s;
    const filled = s.slots.filter(Boolean).length;
    const live = filled ? teamRating(s.slots, filled) : 0;
    const best = store.get('soccerdle-draft-best-points', 0);
    const points = s.done ? draftPoints(s) : null;
    const pitch = DRAFT.formation.map((f, i) => {
      const x = s.slots[i];
      const sel = this.selected && this.selected.type === 'slot' && this.selected.idx === i;
      if (!x) {
        const hint = this.selected && this.selected.type === 'player' ? ' target' : '';
        return `<div class="d-slot empty${hint}" data-slot="${i}" style="left:${f.x}%;top:${f.y}%"><span class="d-pos">${f.pos}</span></div>`;
      }
      const eff = effective(x), factor = positionFactor(x.pos, x.slotPos);
      const pen = factor < 1 ? `<span class="d-pen" title="${esc(POS_NAME[x.pos])} auf ${esc(POS_NAME[x.slotPos])}">−${Math.round((1 - factor) * 100)}%</span>` : '';
      return `<div class="d-slot filled${sel ? ' sel' : ''}${factor < 1 ? ' off' : ''}" data-slot="${i}" draggable="true" style="left:${f.x}%;top:${f.y}%">
        <span class="d-rating">${eff}</span>${pen}<span class="d-name">${esc(x.name)}</span><span class="d-meta">${esc(x.pos)}${x.pos !== x.slotPos ? ' → ' + esc(x.slotPos) : ''}</span></div>`;
    }).join('');

    let side = '';
    if (s.done) {
      const opt = s.opt || optimalDraft(s.history);
      const optRows = DRAFT.formation.map((f, i) => {
        const o = opt.lineup[i], mine = s.slots[i];
        const oEff = o ? Math.round(effRaw(o.rating, o.pos, f.pos)) : 0;
        const same = mine && o && mine.id === o.id;
        const t = o ? teamTitle(o.team) : null;
        return `<li class="${same ? 'same' : ''}"><span class="o-pos">${f.pos}</span>
          <span class="o-name">${o ? esc(o.name) : '–'}<small>${t ? esc(t.club + ' ' + t.season) : ''}</small></span>
          <span class="o-val">${oEff}</span></li>`;
      }).join('');
      side = `<section class="card result-card won">
        <p class="result-label">Deine Elf im Vergleich zur bestmöglichen</p>
        <div class="d-points"><b>${points}</b><span>/ 100</span></div>
        <p class="result-label">${s.newBest ? 'Neuer persönlicher Rekord! 🎉' : `Dein Rekord: ${best} Punkte`} · Team-Rating ${teamRating(s.slots)}</p>
        <div class="result-actions"><button class="primary" data-act="share">Ergebnis teilen</button>
        <button class="secondary" data-act="restart">Neuer Draft</button></div></section>
        <section class="card d-optimal"><b>Die perfekte Elf aus deinen Angeboten</b>
          <p class="mode-intro">Grün = hast du genauso gewählt. Spieler auf dem Feld kannst du noch umstellen.</p>
          <ol>${optRows}</ol></section>`;
    } else {
      const offers = s.offers.map(k => {
        const t = teamTitle(k), sq = squadOf(k);
        const avg = Math.round(sq.slice(0, 11).reduce((a, p) => a + p.rating, 0) / Math.min(11, sq.length));
        return `<button class="d-offer${s.open === k ? ' active' : ''}" data-team="${esc(k)}">
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
            const used = picked.has(p.id), sel = this.selected && this.selected.type === 'player' && this.selected.p.id === p.id;
            return `<div class="d-player${used ? ' used' : ''}${sel ? ' sel' : ''}" ${used ? '' : `draggable="true" data-pid="${esc(p.id)}"`}>
              <span class="d-ppos">${esc(p.pos)}</span>${p.nat ? ICON.flag(p.nat).replace('class="flag"', 'class="flag mini"') : ''}
              <span class="d-pname">${esc(p.name)}</span><span class="d-prating">${p.rating}</span></div>`;
          }).join('')}</div>`;
        }).join('')}</div>`;
      }
      side = `<section class="card d-pick">
        <p class="mode-intro">${s.open ? '<b>Spieler auf eine freie Position ziehen</b> – oder antippen und dann die Position antippen.' : 'Wähle eine der drei Mannschaften:'}</p>
        <div class="d-offers">${offers}</div>${squad}</section>`;
    }

    this.root.innerHTML = `
      <section class="card play">
        <div class="play-top"><b>Draft</b><span class="play-right"><span>${s.done ? 'Fertig' : `Runde ${s.round + 1} von 11`} · Rekord ${best || '–'}</span>
          <button class="btn test-btn" data-act="restart">↻ Neuer Draft</button></span></div>
        <p class="mode-intro">Bau dir aus Team-Saisons die beste Elf. <b>100 Punkte</b> = die bestmögliche Elf aus allen Teams, die dir angeboten werden. Spieler auf fremden Positionen bekommen Abzug – je weiter weg, desto mehr.</p>
      </section>
      <div class="d-layout">
        <section class="card d-pitch-card">
          <div class="d-score">${s.done
            ? `<span>Punkte</span><b>${points}</b><small>von 100</small>`
            : `<span>Team-Rating</span><b>${filled ? live : '–'}</b><small>${filled ? `Ø der ${filled} Spieler · Punkte am Ende` : 'Punkte gibt es am Ende'}</small>`}</div>
          <div class="d-pitch">${pitch}</div>
        </section>
        <div class="d-side">${side}</div>
      </div>`;
    this.bind();
  },

  bind() {
    const r = this.root, s = this.s;
    r.querySelectorAll('[data-act="restart"]').forEach(b => b.onclick = () => this.restart());
    r.querySelectorAll('[data-act="share"]').forEach(b => b.onclick = shareButton(
      `Soccerdle Draft ⭐ ${draftPoints(s)}/100 Punkte\n` +
      DRAFT.formation.map((f, i) => `${f.pos} ${s.slots[i] ? s.slots[i].name.split(' ').slice(-1)[0] : '–'}`).join(' · ')));
    r.querySelectorAll('[data-team]').forEach(b => b.onclick = () => { s.open = b.dataset.team; this.selected = null; this.save(); this.render(); });

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
    r.querySelectorAll('.d-slot').forEach(el => {
      const idx = Number(el.dataset.slot);
      el.onclick = () => {
        const sel = this.selected;
        if (sel && sel.type === 'player' && !s.slots[idx]) return this.place(sel.p, idx);
        if (sel && sel.type === 'slot' && sel.idx !== idx) return this.swap(sel.idx, idx);
        if (s.slots[idx]) { this.selected = (sel && sel.type === 'slot' && sel.idx === idx) ? null : { type: 'slot', idx }; this.render(); }
      };
      if (s.slots[idx]) el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 's:' + idx); });
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('over'); });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => {
        e.preventDefault(); el.classList.remove('over');
        const data = e.dataTransfer.getData('text/plain');
        if (data.startsWith('p:')) { const p = playerById(data.slice(2)); if (p && !s.slots[idx]) this.place(p, idx); }
        else if (data.startsWith('s:')) { const from = Number(data.slice(2)); if (from !== idx) this.swap(from, idx); }
      });
    });
  },
};
GAMES.draft = DraftMode;
