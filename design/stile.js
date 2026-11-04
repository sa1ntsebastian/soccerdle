// Gemeinsame Beispielseite für die 4 Stil-Entwürfe (nur Mockup, nicht das Spiel).
// Gleiches HTML-Gerüst, jeder Stil liefert nur sein eigenes CSS + Logo.
(function () {
  const ico = {
    classic: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/></svg>',
    career: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="12" cy="7" r="2"/><circle cx="19" cy="15" r="2"/><path d="M6.5 16.5 10.5 8.8M13.6 8.2 17.6 13.6"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>',
    mates: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 1.5 6 5"/></svg>',
    lineup: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>',
    draft: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>',
    stats: '<svg viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-8"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg>',
  };
  const flag = c => `<img class="flag" src="../web/flags/${c}.svg" alt="">`;
  const arrow = { up: '↑', down: '↓' };
  const rows = [
    { name: 'Vedat Muriqi', club: 'Fenerbahçe', t: [['Andere', 'miss'], [flag('KVX'), 'near'], ['ST', 'hit'], ['32 ↓', 'miss'], ['194 ↓', 'miss'], ['Links', 'hit'], ['19 ↓', 'near']] },
    { name: 'Khvicha Kvaratskhelia', club: 'Paris Saint-Germain', t: [['Ligue 1', 'miss'], [flag('GEO'), 'near'], ['ST', 'hit'], ['25 ↓', 'near'], ['183 ↓', 'near'], ['Beide', 'near'], ['7 ↑', 'miss']] },
    { name: 'Michael Olise', club: 'FC Bayern München', win: true, t: [['Bundesliga', 'hit'], [flag('FRA'), 'hit'], ['ST', 'hit'], ['24', 'hit'], ['180', 'hit'], ['Links', 'hit'], ['17', 'hit']] },
  ];
  const cols = ['Liga', 'Nation', 'Pos.', 'Alter', 'Größe', 'Fuß', 'Nr.'];
  const slots = [
    { x: 50, y: 11, pos: 'ST', n: 'Mbappé', r: 92 }, { x: 15, y: 29, pos: 'LA', n: 'Vinícius', r: 90 }, { x: 50, y: 32, pos: 'ZOM', n: 'Bellingham', r: 89 },
    { x: 85, y: 29, pos: 'RA', n: 'Yamal', r: 88 }, { x: 33, y: 53, pos: 'ZDM', n: 'Rodri', r: 91 }, { x: 67, y: 53, pos: 'ZDM', n: 'Kimmich', r: 88, pend: true },
    { x: 11, y: 71, pos: 'LV' }, { x: 36, y: 76, pos: 'IV', n: 'Van Dijk', r: 89 }, { x: 64, y: 76, pos: 'IV' }, { x: 89, y: 71, pos: 'RV', n: 'Hakimi', r: 86 }, { x: 50, y: 91, pos: 'TW', n: 'Neuer', r: 87 },
  ];
  const squad = [['TW', 'Manuel Neuer', 'GER', 87], ['IV', 'Dayot Upamecano', 'FRA', 82], ['ZDM', 'Joshua Kimmich', 'GER', 88], ['ZOM', 'Thomas Müller', 'GER', 85], ['ST', 'Robert Lewandowski', 'POL', 91]];

  window.renderMock = function (root, opts) {
    const tabs = [['classic', 'Klassik'], ['career', 'Karriere'], ['grid', 'Raster'], ['mates', 'Mitspieler'], ['lineup', 'Wer fehlt'], ['draft', 'Draft']];
    root.innerHTML = `
    <header class="top">
      <a class="logo">${opts.fullLogo ? opts.logo : `${opts.logo}<span class="logo-txt"><span class="wm"><span class="w1">SOCCER</span><span class="w2">DLE</span></span><small>Champions League 2026/27</small></span>`}</a>
      <div class="tools"><button class="theme-toggle" aria-label="Tag-/Nacht-Modus" title="Tag-/Nacht-Modus">${ico.sun}</button><button aria-label="Statistik">${ico.stats}</button><button aria-label="Hilfe">${ico.help}</button></div>
    </header>
    <nav class="tabs">${tabs.map(([k, l], i) => `<button class="${i === 0 ? 'on' : ''}">${ico[k]}<span>${l}</span></button>`).join('')}</nav>
    <main>
      <div class="col">
      <section class="card play">
        <div class="subtabs"><button class="on">Täglich</button><button>Endlos</button></div>
        <div class="play-top"><b>Rätsel #4</b><span class="muted">3 Versuche</span></div>
        <p class="yest">Gestern gesucht: <b>Youri Tielemans</b></p>
        <label class="search">${ico.search}<input placeholder="Spielername eingeben …"></label>
        <div class="hints">
          <div class="hint open"><i>Liga</i><b>Bundesliga</b></div>
          <div class="hint"><i>Detailposition</i><span>${ico.lock} in 2</span></div>
          <div class="hint"><i>Verein</i><span>${ico.lock} in 4</span></div>
          <div class="hint"><i>Initialen</i><span>${ico.lock} in 7</span></div>
        </div>
      </section>
      <section class="card guesses">
        <div class="g-head"><span></span>${cols.map(c => `<em>${c}</em>`).join('')}</div>
        ${rows.map(r => `<div class="g-row ${r.win ? 'win' : ''}"><div class="g-name"><b>${r.name}</b><small>${r.club}</small></div>
          <div class="tiles">${r.t.map(([v, s]) => `<span class="t ${s}">${v}</span>`).join('')}</div></div>`).join('')}
        <div class="legend"><span><i class="hit"></i>richtig</span><span><i class="near"></i>fast</span><span><i class="miss"></i>falsch</span></div>
      </section>
      </div>
      <section class="card draft">
        <div class="play-top"><b>Draft</b><span class="muted">Runde 6 von 11 · Rekord 84,2</span></div>
        <div class="d-grid">
          <div class="d-field">
            <div class="d-score"><span>Team-Rating</span><b>87,5</b></div>
            <div class="pitch">${slots.map(s => s.n
              ? `<div class="slot filled ${s.pend ? 'pend' : ''} ${s.r >= 90 ? 'foil' : ''}" data-pos="${s.pos}" style="left:${s.x}%;top:${s.y}%"><b class="r">${s.r}</b><span class="n">${s.n}</span><small>${s.pos}</small>${s.pend ? '<span class="acts"><i class="ok">✓</i><i class="undo">↩</i></span>' : ''}</div>`
              : `<div class="slot empty" style="left:${s.x}%;top:${s.y}%"><span>${s.pos}</span></div>`).join('')}</div>
          </div>
          <div class="d-side">
            <p class="intro"><b>Spieler auf eine freie Position ziehen</b> – oder antippen und dann die Position antippen.</p>
            <div class="offers">
              <div class="offer"><span>FC Everton</span><b>2010/11</b><small>Ø 79</small></div>
              <div class="offer on"><span>FC Bayern</span><b>2019/20</b><small>Ø 86</small></div>
              <div class="offer gone"><span>Deutschland</span><b>WM 2014</b><small>Ø 85</small></div>
            </div>
            <div class="squad">${squad.map(([p, n, c, r]) => `<div class="pl" data-pos="${p}"><em>${p}</em>${flag(c)}<span>${n}</span><b>${r}</b></div>`).join('')}</div>
          </div>
        </div>
      </section>
    </main>
    <footer>Inoffizielles Fanprojekt · Daten: Wikipedia, Wikidata · Flaggen: flag-icons</footer>`;
    // Tag-/Nacht-Modus: gemerkt in localStorage, sonst nach Systemeinstellung
    const root_ = document.documentElement, btn = root.querySelector('.theme-toggle');
    const paint = () => { btn.innerHTML = root_.dataset.theme === 'dark' ? ico.sun : ico.moon; };
    let saved = null; try { saved = localStorage.getItem('stile-theme'); } catch (e) {}
    root_.dataset.theme = new URLSearchParams(location.search).get('theme') || saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    paint();
    btn.onclick = () => { root_.dataset.theme = root_.dataset.theme === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('stile-theme', root_.dataset.theme); } catch (e) {} paint(); };
  };
})();
