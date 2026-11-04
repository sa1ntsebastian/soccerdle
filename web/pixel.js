'use strict';

/* =========================================================================
   Soccerdle – Pixel-Optik: Spieler-Sprites, Pixel-Rasen (Draft/„Wer fehlt“) als SVG-Hintergrund.
   Alles wird als CSS-Variablen gesetzt (--spr-*, --pitch-bg, --pitch-bg-lu); Farben je Hell/Dunkel.
   ========================================================================= */
const PIXEL = (() => {
  const svgUri = s => `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`;
  const rects = list => list.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');

  // Spieler-Sprite 10 x 16: Haare, Gesicht, Trikot mit Kragen, Hose, Beine, Stutzen, Schuhe
  const sprite = (shirt, shirt2, shorts) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 16" shape-rendering="crispEdges">` + rects([
    [3, 0, 4, 1, '#3b2a1a'], [3, 1, 4, 3, '#f1c27d'], [3, 1, 1, 1, '#3b2a1a'], [6, 1, 1, 1, '#3b2a1a'], [4, 2, 1, 1, '#1b2038'], [6, 2, 1, 1, '#1b2038'], [4, 3, 2, 1, '#d99a5b'],
    [2, 4, 6, 4, shirt], [1, 4, 1, 2, shirt], [8, 4, 1, 2, shirt], [1, 6, 1, 2, '#f1c27d'], [8, 6, 1, 2, '#f1c27d'], [4, 4, 2, 1, shirt2], [2, 6, 6, 1, shirt2],
    [3, 8, 4, 3, shorts], [3, 11, 1, 3, '#f1c27d'], [6, 11, 1, 3, '#f1c27d'], [3, 12, 1, 2, shirt], [6, 12, 1, 2, shirt], [2, 14, 2, 1, '#1b2038'], [6, 14, 2, 1, '#1b2038']]) + `</svg>`);

  // Pixel-Rasen: Streifen, Grasbüschel, Linien, Strafräume, Mittelkreis aus Quadraten
  function pitch(dark, H) {
    const W = 136, g1 = dark ? '#1f5f2e' : '#3f9b4a', g2 = dark ? '#1a5528' : '#378f43', tuft = dark ? '#16491f' : '#2f7d3a', L = '#f4f4f4', out = [];
    for (let i = 0; i * 16 < H; i++) out.push([0, i * 16, W, 16, i % 2 ? g2 : g1]);
    let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * (W - 10) + 4), y = Math.floor(rnd() * (H - 10) + 4); out.push([x, y, 3, 1, tuft], [x + 1, y - 1, 1, 1, tuft]); }
    out.push([6, 6, W - 12, 2, L], [6, H - 8, W - 12, 2, L], [6, 6, 2, H - 12, L], [W - 8, 6, 2, H - 12, L], [6, H / 2 - 1, W - 12, 2, L]);
    out.push([34, 6, 2, 26, L], [W - 36, 6, 2, 26, L], [34, 30, 68, 2, L], [34, H - 32, 68, 2, L], [34, H - 32, 2, 26, L], [W - 36, H - 32, 2, 26, L]);
    out.push([52, 6, 2, 12, L], [W - 54, 6, 2, 12, L], [52, 16, 32, 2, L], [52, H - 18, 32, 2, L], [52, H - 18, 2, 12, L], [W - 54, H - 18, 2, 12, L]);
    out.push([66, 22, 4, 2, L], [66, H - 24, 4, 2, L]);
    const R = 16, cx = W / 2, cy = H / 2; let x = R, y = 0, e = 1 - R; const pts = new Set();
    while (x >= y) { for (const [a, b] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) pts.add(`${Math.round((cx + a) / 2) * 2},${Math.round((cy + b) / 2) * 2}`); y++; if (e < 0) e += 2 * y + 1; else { x--; e += 2 * (y - x) + 1; } }
    pts.forEach(p => { const [px, py] = p.split(',').map(Number); out.push([px - 1, py - 1, 2, 2, L]); });
    out.push([cx - 1, cy - 1, 2, 2, L]);
    return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects(out)}</svg>`);
  }

  const isDark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches); };
  function apply() {
    const st = document.documentElement.style, d = isDark();
    st.setProperty('--spr-att', sprite('#e24a4a', '#a82020', '#ffffff'));
    st.setProperty('--spr-mid', sprite('#4fa8f0', '#1f6fb8', '#ffffff'));
    st.setProperty('--spr-def', sprite('#f6ecd2', '#c9b98a', '#2a2f55'));
    st.setProperty('--spr-gk', sprite('#ffd33d', '#c89500', '#1b2038'));
    st.setProperty('--pitch-bg', pitch(d, 176));      // Draft (68 : 88)
    st.setProperty('--pitch-bg-lu', pitch(d, 160));   // Wer fehlt (68 : 80)
  }
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  return { sprite, pitch, apply };
})();
