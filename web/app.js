'use strict';

/* =========================================================================
   Soccerdle
   Reine statische Seite: keine Abhängigkeiten, kein Build, kein Server.
   ========================================================================= */

const CONFIG = {
  // Testphase: zeigt "Neues Rätsel (Test)" – lädt zufällige Spieler aus dem Tages-Pool,
  // ohne Statistik/Tagesrätsel zu verändern. VOR DEM LAUNCH auf false setzen.
  testMode: true,
  siteUrl: 'https://deine-domain.at',   // PLATZHALTER: Adresse der Seite (kommt in den Teilen-Text und aufs Bild)
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
    { after: 3,  label: 'Liga',           get: p => p.league === 'Andere' ? 'Andere (' + countryName2(p.leagueCountry) + ')' : p.league },
    { after: 5,  label: 'Detailposition', get: p => SUBPOS[p.subPosition] || p.subPosition || '–' },
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
  // ergänzt: Länder mit wenigen Spielern, UK (Wikidata führt England/Schottland/Wales teils als GBR) und historische Teams
  GBR: ['Vereinigtes Königreich', 'UEFA'], THA: ['Thailand', 'AFC'], PRK: ['Nordkorea', 'AFC'], VIE: ['Vietnam', 'AFC'],
  IND: ['Indien', 'AFC'], BAN: ['Bangladesch', 'AFC'], MAS: ['Malaysia', 'AFC'], SIN: ['Singapur', 'AFC'], BRU: ['Brunei', 'AFC'],
  BHU: ['Bhutan', 'AFC'], KUW: ['Kuwait', 'AFC'], OMA: ['Oman', 'AFC'], TJK: ['Tadschikistan', 'AFC'], CAM: ['Kambodscha', 'AFC'],
  TRI: ['Trinidad und Tobago', 'CONCACAF'], GUA: ['Guatemala', 'CONCACAF'], ESA: ['El Salvador', 'CONCACAF'], BAR: ['Barbados', 'CONCACAF'],
  ARU: ['Aruba', 'CONCACAF'], AHO: ['Niederländische Antillen', 'CONCACAF'],
  AND: ['Andorra', 'UEFA'], FRO: ['Färöer', 'UEFA'], LIE: ['Liechtenstein', 'UEFA'], SMR: ['San Marino', 'UEFA'], MLT: ['Malta', 'UEFA'],
  SLE: ['Sierra Leone', 'CAF'], SUD: ['Sudan', 'CAF'], BDI: ['Burundi', 'CAF'], LBR: ['Liberia', 'CAF'], CAF: ['Zentralafrika', 'CAF'],
  SEY: ['Seychellen', 'CAF'], TAN: ['Tansania', 'CAF'], NAM: ['Namibia', 'CAF'],
  FIJ: ['Fidschi', 'OFC'], SAM: ['Samoa', 'OFC'],
  // alte / abweichende Codes (Flagge über FLAG_FILE)
  NGR: ['Nigeria', 'CAF'], IRI: ['Iran', 'AFC'], SLO: ['Slowenien', 'UEFA'], BUR: ['Burkina Faso', 'CAF'], LAT: ['Lettland', 'UEFA'],
  INA: ['Indonesien', 'AFC'], KOS: ['Kosovo', 'UEFA'], LBA: ['Libyen', 'CAF'], GEQ: ['Äquatorialguinea', 'CAF'], GBS: ['Guinea-Bissau', 'CAF'],
  SCG: ['Serbien und Montenegro', 'UEFA'], FRY: ['Bundesrepublik Jugoslawien', 'UEFA'], YUG: ['Jugoslawien', 'UEFA'],
  TCH: ['Tschechoslowakei', 'UEFA'], URS: ['Sowjetunion', 'UEFA'], GDR: ['DDR', 'UEFA'], FRG: ['BR Deutschland', 'UEFA'],
};
// Code -> Dateiname der Flagge, wenn er vom Code abweicht (Dateien in flags/)
const FLAG_FILE = { NGR: 'NGA', IRI: 'IRN', SLO: 'SVN', BUR: 'BFA', LAT: 'LVA', INA: 'IDN', KOS: 'KVX', LBA: 'LBY', GEQ: 'EQG', GBS: 'GNB',
  SCG: 'SRB', FRY: 'YUG', TCH: 'CZE', FRG: 'GER', AHO: 'CUW' };

const SUBPOS = {
  'Goalkeeper': 'Torwart', 'Centre-Back': 'Innenverteidiger', 'Left-Back': 'Linksverteidiger',
  'Right-Back': 'Rechtsverteidiger', 'Defensive Midfield': 'Defensives MF', 'Central Midfield': 'Zentrales MF',
  'Attacking Midfield': 'Offensives MF', 'Left Midfield': 'Linkes MF', 'Right Midfield': 'Rechtes MF',
  'Left Winger': 'Linksaußen', 'Right Winger': 'Rechtsaußen', 'Second Striker': 'Hängende Spitze',
  'Centre-Forward': 'Mittelstürmer',
};
const FOOT = { R: 'Rechts', L: 'Links', B: 'Beide' };
const POS_ORDER = ['TW', 'ABW', 'MF', 'ST'];

/* ---------- Anleitungen: Schritt-Karten mit Mini-Grafiken ---------- */
const HT = {
  // Anleitung = Einleitung + nummerierte Schritte (Titel, Text, optionale Grafik)
  page(lead, steps, extra = '') {
    return `<div class="howto"><p class="ht-lead">${lead}</p>${extra}
      ${steps.map((s, i) => `<div class="ht-step"><span class="ht-num">${i + 1}</span><div class="ht-body">
        <b class="ht-title">${s.title}</b><p>${s.text}</p>${s.art ? `<div class="ht-art">${s.art}</div>` : ''}</div></div>`).join('')}</div>`;
  },
  // Kachel wie im Spiel: status = hit | near | miss | unknown
  tile: (label, value, status) => `<span class="ex-tile ${status}"><small>${label}</small><b>${value}</b></span>`,
  legend: () => `<div class="ex-legend"><span><i class="hit"></i>richtig</span><span><i class="near"></i>fast</span><span><i class="miss"></i>falsch</span></div>`,
  flag: code => `<img class="flag mini" src="flags/${code}.svg" alt="">`,
  // Mini-Spielfeld mit Punkten: dots = [x, y, text, cls]
  pitch(dots, w = 150, h = 190) {
    return `<svg class="ex-pitch" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="8" fill="#2f9555" stroke="rgba(255,255,255,.6)" stroke-width="2"/>
      <circle cx="${w / 2}" cy="0" r="${w * .17}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
      <rect x="${w * .27}" y="${h - h * .13}" width="${w * .46}" height="${h * .13}" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/>
      ${dots.map(([x, y, t, c]) => `<g class="ex-dot ${c || ''}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${t || ''}</text></g>`).join('')}</svg>`;
  },
};

// Elf auf dem Mini-Feld (4-2-3-1), optional mit markierter Position
const HT_ELF = [[75, 28], [28, 62], [75, 66], [122, 62], [52, 108], [98, 108], [22, 140], [58, 150], [92, 150], [128, 140], [75, 174]];
const htElf = (hi = -1, text = '?') => HT.pitch(HT_ELF.map(([x, y], i) => [x, y, i === hi ? text : '', i === hi ? 'q' : '']));

/* ---------- Teilen: Ergebnis-Bild (Canvas, Pixel-Optik) + Teilen-Dialog des Smartphones ---------- */
// card = { mode, big, sub, grid?: [['hit','near',...], ...], lines?: ['🟩⬛⬛', ...], pitch?: { slots: [{x, y, name, rating}], caption } }
function drawShareCard(card) {
  const W = 1080, H = card.pitch ? 1500 : 1080;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const FONT = "'Digits', 'Pixelify Sans', 'Courier New', monospace", BODY = "'Tiny5', 'Courier New', monospace";
  const COL = { hit: '#1d8a43', near: '#ffd33d', miss: '#cf2f2f', unknown: '#7a8290' }, INK = '#14172b';
  // Pixel-Kasten mit Treppen-Ecken (Umriss ohne Eckpixel)
  const box = (x, y, w, h, fill, line = INK, t = 6) => { g.fillStyle = line; g.fillRect(x - t, y, w + 2 * t, h); g.fillRect(x, y - t, w, h + 2 * t); g.fillStyle = fill; g.fillRect(x, y, w, h); };
  // Text mit Pixel-Kontur
  const outlined = (txt, x, y, fill, o = 5) => { g.fillStyle = '#0b0f1c'; for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]]) g.fillText(txt, x + dx, y + dy); g.fillStyle = fill; g.fillText(txt, x, y); };
  // Hintergrund: Pixel-Rasen mit Streifen und Büscheln
  g.fillStyle = '#3f9b4a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#378f43'; for (let y = 0; y < H; y += 128) g.fillRect(0, y, W, 64);
  g.fillStyle = '#2f7d3a'; for (let y = 16; y < H; y += 48) for (let x = (y / 48 % 2) * 24 + 8; x < W; x += 96) g.fillRect(x, y, 8, 8);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  // Kopfleiste mit Zielflaggen-Schachbrett
  g.fillStyle = '#123524'; g.fillRect(0, 0, W, 190);
  for (let x = 0; x < W; x += 32) for (let r = 0; r < 2; r++) { g.fillStyle = (x / 32 + r) % 2 ? INK : '#ffd33d'; g.fillRect(x, 190 + r * 16, 32, 16); }
  g.font = `400 64px 'Press Start 2P', ${FONT}`;   // Logo-Schrift (in Pixelify wirkt das C wie ein O)
  const w1 = g.measureText('SOCCER').width, w2 = g.measureText('DLE').width, x0 = (W - w1 - w2) / 2;
  g.textAlign = 'left'; outlined('SOCCER', x0, 116, '#ffd33d', 5); outlined('DLE', x0 + w1, 116, '#fff', 5); g.textAlign = 'center';
  g.fillStyle = '#ffd33d'; g.font = `500 40px ${BODY}`; g.fillText(card.mode.toUpperCase(), W / 2, 162);
  // großes Ergebnis
  let bigSize = card.pitch ? 150 : 170;
  g.font = `700 ${bigSize}px ${FONT}`;
  while (g.measureText(card.big).width > W - 160 && bigSize > 60) { bigSize -= 8; g.font = `700 ${bigSize}px ${FONT}`; }
  outlined(card.big, W / 2, card.pitch ? 380 : 440, '#fff', 8);
  g.font = `500 44px ${BODY}`; if (card.sub) outlined(card.sub, W / 2, card.pitch ? 446 : 510, '#f6ecd2', 3);
  let y = card.pitch ? 500 : 570;
  if (card.grid) {          // Kacheln wie im Spiel
    const rows = card.grid.slice(0, 8), n = rows[0] ? rows[0].length : 7, s = 84, gap = 22, w0 = n * s + (n - 1) * gap, x0g = (W - w0) / 2;
    rows.forEach((r, i) => r.forEach((st, k) => box(x0g + k * (s + gap), y + i * (s + gap), s, s, COL[st] || COL.unknown, INK, 6)));
    y += rows.length * (s + gap);
    if (card.grid.length > rows.length) { g.font = `500 36px ${BODY}`; outlined(`+ ${card.grid.length - rows.length} weitere`, W / 2, y + 40, '#fff', 3); }
  }
  if (card.lines) { g.font = `500 64px ${BODY}`; card.lines.slice(0, 8).forEach((l, i) => { g.fillStyle = '#fff'; g.fillText(l, W / 2, y + 70 + i * 86); }); }
  if (card.pitch) {         // Elf als Namensschilder mit Rating auf dem Rasen
    const px = 130, py = y, pw = W - 260, ph = 880;
    g.fillStyle = '#2f8f3c'; g.fillRect(px, py, pw, ph); g.fillStyle = '#44a853'; for (let yy = 0; yy < ph; yy += 160) g.fillRect(px, py + yy, pw, 80);
    g.fillStyle = INK; for (const [rx, ry, rw, rh] of [[px - 8, py - 8, pw + 16, 8], [px - 8, py + ph, pw + 16, 8], [px - 8, py - 8, 8, ph + 16], [px + pw, py - 8, 8, ph + 16]]) g.fillRect(rx, ry, rw, rh);
    g.fillStyle = '#f4f4f4'; g.fillRect(px + 16, py + 16, pw - 32, 6); g.fillRect(px + 16, py + ph - 22, pw - 32, 6); g.fillRect(px + 16, py + 16, 6, ph - 32); g.fillRect(px + pw - 22, py + 16, 6, ph - 32); g.fillRect(px + 16, py + ph / 2 - 3, pw - 32, 6);
    g.fillRect(px + pw / 2 - 90, py + ph / 2 - 90, 180, 6); g.fillRect(px + pw / 2 - 90, py + ph / 2 + 84, 180, 6); g.fillRect(px + pw / 2 - 90, py + ph / 2 - 90, 6, 180); g.fillRect(px + pw / 2 + 84, py + ph / 2 - 90, 6, 180);
    for (const s of card.pitch.slots) {
      const cx = px + pw * s.x / 100, cy = py + ph * s.y / 100 + 6;
      box(cx - 70, cy - 40, 140, 80, '#101426', '#fff', 4);
      g.font = `700 36px ${FONT}`; g.fillStyle = '#ffd33d'; g.fillText(String(s.rating), cx, cy - 2);
      g.font = `500 26px ${BODY}`; g.fillStyle = '#fff'; g.fillText(s.name.length > 11 ? s.name.slice(0, 10) + '…' : s.name, cx, cy + 28);
    }
    if (card.pitch.caption) { g.font = `500 34px ${BODY}`; outlined(card.pitch.caption, W / 2, py + ph + 64, '#fff', 3); }
  }
  g.font = `500 38px ${BODY}`; outlined(CONFIG.siteUrl.replace(/^https?:\/\//, ''), W / 2, H - 44, '#ffd33d', 3);
  return c;
}

// Smartphone: Teilen-Dialog mit Bild + Text + Link (WhatsApp zeigt den Link an). Desktop: Bild bzw. Text in die Zwischenablage.
async function shareResult(text, card, btn) {
  const full = text + '\n' + CONFIG.siteUrl;
  const touch = matchMedia('(pointer: coarse)').matches;
  let file = null;
  try { await document.fonts.load('20px Digits', '0123456789'); } catch { /* egal */ }
  try {
    const blob = await new Promise(res => drawShareCard(card).toBlob(res, 'image/png'));
    file = new File([blob], 'soccerdle.png', { type: 'image/png' });
  } catch { /* ohne Bild weiter */ }
  try {
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: full }); return; }
    if (touch && navigator.share) { await navigator.share({ text: full }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const done = t => { if (btn) btn.textContent = t; };
  try {
    if (file && window.ClipboardItem && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file, 'text/plain': new Blob([full], { type: 'text/plain' }) })]); done('Bild kopiert ✓'); return;
    }
  } catch { /* Fallback Text */ }
  try { await navigator.clipboard.writeText(full); done('Text kopiert ✓'); } catch { /* egal */ }
}
// Aus dem Share-Text eine einfache Karte bauen: 1. Zeile = Ergebnis, weitere Zeilen = Emoji-Raster
function cardFromText(text, mode) {
  const [first, ...rest] = text.split('\n');
  return { mode, big: first.replace(/^Soccerdle\s+[^\d⚽❌⭐]*/i, '').trim() || first, sub: '', lines: rest.filter(Boolean) };
}

/* ---------- Icons ---------- */
const ICON = {
  pitch(active) {
    const zones = [['TW', 4, 8], ['ABW', 15, 14], ['MF', 32, 14], ['ST', 49, 11]];   // Tor links, Angriff rechts
    return `<svg class="ico-pitch" viewBox="0 0 64 36" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="64" height="36" fill="#14172b"/>
      ${zones.map(([z, x, w]) => `<rect x="${x}" y="4" width="${w}" height="28" fill="${active.includes(z) ? '#ffffff' : '#39406a'}"/>`).join('')}
      <rect x="29" y="4" width="2" height="28" fill="#14172b" opacity=".35"/>
      <rect x="0" y="13" width="2" height="10" fill="#ffd33d"/><rect x="62" y="13" width="2" height="10" fill="#ffd33d"/></svg>`;
  },
  feet(f) {
    const sole = 'M10 2 C15 2 17 8 16 15 C15 22 14 26 14 31 C14 35 12 38 9 38 C6 38 4 35 4 31 C4 25 3 20 4 13 C5 6 6 2 10 2 Z';
    const on = s => (f === s || f === 'B') ? 'on' : '';
    return `<svg class="ico-feet" viewBox="0 0 44 40" aria-hidden="true">
      <path d="${sole}" transform="translate(21 0) scale(-1 1)" class="${on('L')}"/><path d="${sole}" transform="translate(22 0)" class="${on('R')}"/></svg>`;
  },
  // Nur bekannte FIFA-Codes (Wikidata liefert z. B. "GBR" für britische Staatsbürgerschaft -> keine Flagge statt Kürzel)
  flag: code => COUNTRIES[code] ? `<img class="flag" src="flags/${encodeURIComponent(FLAG_FILE[code] || code)}.svg" alt="" loading="lazy"
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
// Ligen mit eigenem Namen (nach Land des Vereins); alle anderen = "Andere". Hier erweitern/kürzen.
const countryName2 = code => (COUNTRIES[code] || [code || '?'])[0];   // vor ICON/CONFIG-Nutzung verfügbar
const NAMED_LEAGUES = { ENG: 'Premier League', ESP: 'LaLiga', ITA: 'Serie A', GER: 'Bundesliga', FRA: 'Ligue 1', KSA: 'Saudi Pro League', USA: 'MLS' };
for (const p of DATA.players) p.league = NAMED_LEAGUES[p.leagueCountry] || 'Andere';
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
    // Ligen aus NAMED_LEAGUES mit Namen, alle anderen zählen als Gruppe "Andere":
    // Spielen eingegebener UND gesuchter Spieler beide in einer "anderen" Liga -> grün (genaue Liga wird nicht verraten).
    label: 'Liga', cmp: (g, t) => {
      const hit = g.league === t.league, other = g.league === 'Andere';
      return {
        status: hit ? 'hit' : 'miss', arrow: '',
        main: `<span class="league${g.league.length >= 10 && !g.league.includes(' ') ? ' long' : ''}">${esc(g.league)}</span>`, sub: '',
        tip: other ? (hit
          ? '„Andere“ = Liga außerhalb der Top 5 (Saudi Pro League und MLS stehen extra). Der gesuchte Spieler spielt auch in so einer Liga – in welcher, bleibt geheim.'
          : '„Andere“ = Liga außerhalb der Top 5 (Saudi Pro League und MLS stehen extra). Der gesuchte Spieler spielt nicht in so einer Liga.') : null,
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
// Gestriges Tagesrätsel (gleiche Formel wie startDaily, ohne Server)
function yesterdayTarget() {
  const y = new Date(Date.parse(todayStr() + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  if (y < CONFIG.launchDate) return null;
  const pool = poolFor('daily');
  return pool[hashStr('soccerdle:' + y) % pool.length] || null;
}

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
  const vlen = (cell.sub || '').replace(/<[^>]*>|&[a-z]+;/g, '').length, vcls = vlen >= 11 ? ' vxs' : vlen >= 9 ? ' vs' : '';   // lange Länder (Deutschland) etwas kleiner, damit sie in die Leiste passen
  const tipAttr = cell.tip ? ' data-tip tabindex="0"' : '';
  return `<div class="chip ${cell.status}${solo}${extraClass}"${tipAttr} aria-label="${esc(label)}">
    <span class="k">${esc(label)}</span><span class="main">${cell.main}</span><span class="v${vcls}">${cell.sub || '&nbsp;'}</span>
    ${cell.tip ? ICON.info + `<span class="tip">${esc(cell.tip)}</span>` : ''}</div>`;
}

function render({ animateLast = false } = {}) {
  $('#data-date').textContent = DATA.updated;
  $('#endless-bar').hidden = state.mode !== 'endless';
  $('#btn-giveup').hidden = state.done;
  const tabMode = state.mode === 'test' ? 'daily' : state.mode;
  document.querySelectorAll('.sub-mode').forEach(b => b.classList.toggle('active', b.dataset.sub === tabMode));
  $('#btn-test').hidden = !CONFIG.testMode || state.mode === 'endless';

  const n = state.guesses.length;
  const tries = `${n} ${n === 1 ? 'Versuch' : 'Versuche'}`;
  const yEl = $('#yesterday'), yt = state.mode === 'daily' ? yesterdayTarget() : null;
  yEl.hidden = !yt; if (yt) yEl.innerHTML = 'Gestern gesucht: <b>' + esc(yt.name) + '</b>';
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
  return `${head} ${res}${hints}${state.usedAssist ? ' 🛟' : ''}\n${grid}`.trim();
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
  dlg.querySelector('#btn-share').onclick = e => {
    const n = state.guesses.length;
    shareResult(shareText(), {
      mode: state.mode === 'daily' ? 'Klassik · Rätsel #' + puzzleNumber() : 'Klassik',
      big: state.won ? `⚽ ${n} ${n === 1 ? 'Versuch' : 'Versuche'}` : '❌ aufgegeben',
      sub: state.usedHints.length ? '💡'.repeat(state.usedHints.length) + ' Hinweise genutzt' : '',
      grid: rows.map(r => r.map(c => c.status)),
    }, e.target);
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
// Klassik-Anleitung (die der anderen Modi hängen als helpHtml an den Modi, siehe modes.js / draft.js)
const NAMED_LIST = [...new Set(Object.values(NAMED_LEAGUES))].join(', ');
$('#dlg-help').innerHTML = '<h2>Klassik</h2>' + HT.page('Errate den gesuchten Spieler aus der Champions League und weiteren Stars. Jeder Tipp färbt <b>7 Kacheln</b> – so siehst du, wie nah du dran bist.', [
  { title: 'Spieler tippen', text: 'Jede Kachel vergleicht deinen Tipp mit dem gesuchten Spieler:',
    art: '<div class="ex-row">' + HT.tile('Liga', 'Serie A', 'miss') + HT.tile('Nation', HT.flag('ESP'), 'near') + HT.tile('Pos.', 'MF', 'hit')
      + HT.tile('Alter', '27 ↑', 'near') + HT.tile('Größe', '181 ↓', 'miss') + HT.tile('Fuß', 'Rechts', 'hit') + HT.tile('Nr.', '8', 'miss') + '</div>' + HT.legend() },
  { title: 'Pfeile & Orange', text: 'Bei <b>Alter · Größe · Nr.</b> zeigt der Pfeil, ob der Gesuchte mehr ↑ oder weniger ↓ hat. Orange heißt knapp daneben (±2 Jahre, ±3 cm, ±3 Nummern). Bei <b>Nation</b> ist Orange der gleiche Kontinent, bei <b>Position</b> teilweise gleich, bei <b>Fuß</b> beidfüßig.' },
  { title: 'Liga „Andere“', text: 'Diese Ligen haben einen eigenen Namen: ' + NAMED_LIST + '. Jede andere Liga heißt <b>„Andere“</b>. Steht bei deinem Tipp und beim gesuchten Spieler „Andere“, wird die Kachel grün – <b>welche</b> Liga, bleibt geheim.',
    art: '<div class="ex-row ex-eq">' + HT.tile('eingegebener Spieler', 'Andere', 'unknown') + '<span class="ex-op">+</span>' + HT.tile('gesuchter Spieler', 'Andere', 'unknown') + '<span class="ex-op">=</span>' + HT.tile('Liga', 'Andere', 'hit') + '</div>' },
  { title: 'Hinweise', text: 'Nach <b>3, 5, 7 und 10</b> Fehlversuchen werden Hinweise freigeschaltet. Aufdecken per Klick – benutzte Hinweise zeigt 💡 beim Teilen.',
    art: '<div class="ex-row"><span class="ex-chip">' + ICON.lock + ' 3</span><span class="ex-chip">' + ICON.lock + ' 5</span><span class="ex-chip">' + ICON.lock + ' 7</span><span class="ex-chip">' + ICON.lock + ' 10</span></div>' },
]) + '<form method="dialog"><button class="primary">Los geht’s</button></form>';
$('#btn-help').addEventListener('click', () => { const g = window.currentGame; if (g && g !== 'classic' && typeof GAMES !== 'undefined' && GAMES[g] && GAMES[g].helpHtml) showModeHelp(g); else $('#dlg-help').showModal(); });
$('#btn-stats').addEventListener('click', showStats);
$('#btn-theme').addEventListener('click', toggleTheme);
// Design umschalten: Pixel-Arcade <-> Sticker-Album (gemerkt in localStorage, siehe skin-sticker.css)
$('#btn-skin').addEventListener('click', () => { const r = document.documentElement; r.dataset.skin = r.dataset.skin === 'sticker' ? 'pixel' : 'sticker'; try { localStorage.setItem('soccerdle-skin', r.dataset.skin); } catch { /* egal */ } });

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
