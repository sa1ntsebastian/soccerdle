// Gemeinsame Beispieldaten + Icons für beide Design-Entwürfe (nur Mockup, nicht das Spiel)
// Gesucht: Michael Olise (Bundesliga, FRA, ST, 24, 180 cm, links, #17)
window.MOCK = {
  hints: [
    { label: 'Detailposition', value: 'Rechtsaußen', open: true },
    { label: 'Verein', value: null, left: 1 },
    { label: 'Initialen', value: null, left: 4 },
  ],
  columns: ['Spieler', 'Liga', 'Nation', 'Position', 'Alter', 'Größe', 'Fuß', 'Nr.'],
  rows: [
    { name: 'Michael Olise', club: 'FC Bayern München', win: true,
      league: ['Bundesliga', 'hit'], nat: ['FRA', 'Frankreich', 'hit'], pos: [['ST'], 'hit'],
      age: [24, 'hit', ''], height: [180, 'hit', ''], foot: ['L', 'hit'], number: [17, 'hit', ''] },
    { name: 'Vedat Muriqi', club: 'Fenerbahçe',
      league: ['Andere', 'miss'], nat: ['KVX', 'Kosovo', 'near'], pos: [['ST'], 'hit'],
      age: [32, 'miss', 'down'], height: [194, 'miss', 'down'], foot: ['L', 'hit'], number: [19, 'near', 'down'] },
    { name: 'Khvicha Kvaratskhelia', club: 'Paris Saint-Germain',
      league: ['Ligue 1', 'miss'], nat: ['GEO', 'Georgien', 'near'], pos: [['ST'], 'hit'],
      age: [25, 'near', 'down'], height: [183, 'near', 'down'], foot: ['B', 'near'], number: [7, 'miss', 'up'] },
    { name: 'Konrad Laimer', club: 'FC Bayern München',
      league: ['Bundesliga', 'hit'], nat: ['AUT', 'Österreich', 'near'], pos: [['ABW', 'MF'], 'miss'],
      age: [29, 'miss', 'down'], height: [180, 'hit', ''], foot: ['R', 'miss'], number: [27, 'miss', 'down'] },
    { name: 'Thibaut Courtois', club: 'Real Madrid',
      league: ['LaLiga', 'miss'], nat: ['BEL', 'Belgien', 'near'], pos: [['TW'], 'miss'],
      age: [34, 'miss', 'down'], height: [199, 'miss', 'down'], foot: ['L', 'hit'], number: [1, 'miss', 'up'] },
  ],
};

window.ICONS = {
  // Trikot mit Rückennummer
  jersey: (n, cls = '') => `<svg class="ico-jersey ${cls}" viewBox="0 0 80 76" aria-hidden="true">
      <path d="M22 4 L33 1 Q40 9 47 1 L58 4 L76 18 L66 32 L58 27 L58 74 L22 74 L22 27 L14 32 L4 18 Z"/>
      <text x="40" y="56" text-anchor="middle">${n}</text></svg>`,
  // Mini-Spielfeld: Positionszonen von links (Tor) nach rechts (Angriff)
  pitch: (active) => {
    const zones = [['TW', 0, 9], ['ABW', 9, 17], ['MF', 26, 18], ['ST', 44, 16]];
    return `<svg class="ico-pitch" viewBox="0 0 60 40" aria-hidden="true">
      ${zones.map(([z, x, w]) => `<rect x="${x}" y="0" width="${w}" height="40" class="${active.includes(z) ? 'on' : ''}"/>`).join('')}
      <rect x="0.75" y="0.75" width="58.5" height="38.5" class="line"/>
      <line x1="30" y1="0" x2="30" y2="40" class="line"/>
      <circle cx="30" cy="20" r="6" class="line"/>
      <rect x="0.75" y="11" width="7" height="18" class="line"/></svg>`;
  },
  // Zwei Schuhsohlen, der starke Fuß ist hervorgehoben
  feet: (f) => {
    const sole = 'M10 2 C15 2 17 8 16 15 C15 22 14 26 14 31 C14 35 12 38 9 38 C6 38 4 35 4 31 C4 25 3 20 4 13 C5 6 6 2 10 2 Z';
    const on = s => (f === s || f === 'B') ? 'on' : '';
    return `<svg class="ico-feet" viewBox="0 0 44 40" aria-hidden="true">
      <path d="${sole}" transform="translate(21 0) scale(-1 1)" class="${on('L')}"/>
      <path d="${sole}" transform="translate(22 0)" class="${on('R')}"/></svg>`;
  },
  flag: code => `<img class="flag" src="../web/flags/${code}.svg" alt="">`,
  lock: '<svg class="ico-lock" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V11a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>',
};
window.FOOT_TEXT = { L: 'Links', R: 'Rechts', B: 'Beide' };
