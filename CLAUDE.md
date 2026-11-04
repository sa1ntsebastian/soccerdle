# Soccerdle – Projektkontext für Claude

Fußball-Ratespiel im Stil von Loldle/Pokedle (Champions League 2026/27 + historische Spieler).
Besitzer: Sebastian (AT). Kommunikation auf **Deutsch**. Zielplattform: **normaler Webspace** (statische Dateien, kein Server-Code).

## Grundprinzipien
- **`web/` ist das komplette Spiel**: reines HTML/CSS/JS, kein Build, keine Abhängigkeiten, kein Backend.
  Daten liegen als `.js`-Dateien (`window.SOCCERDLE_…`), damit `index.html` auch per Doppelklick (file://) läuft.
- **DSGVO**: nichts von Fremd-CDNs laden. Flaggen (`web/flags/`, flag-icons MIT) und Schriften (`web/fonts/`, Barlow Condensed + Inter, OFL) sind selbst gehostet.
- **Rechtliches**: keine Vereinswappen, keine Spielerfotos, keine EA/FIFA-Werte veröffentlichen (siehe Rating).
- Design **Pixel-Arcade** (seit 2026-11): hell + dunkel (Umschalter, `data-theme`), Farben als CSS-Variablen in `web/style.css`. Schriften (selbst gehostet, OFL): **Tiny5** (Text), **Pixelify Sans** (Titel), **Press Start 2P** (nur Logo – in Pixelify wirkt das C wie ein O). Ziffern in Titeln/Zahlen kommen aus Press Start 2P (`@font-face "Digits"`, nur U+0030–0039): in Pixelify sehen 2 und 5 wie ein S aus; große Zahlen nur 3 px Schatten, sonst laufen die Löcher in 8/0/6 zu. Kacheln: weiße Schrift mit schwarzer Pixel-Kontur auf kräftigen Farben, auch auf Gelb. Sprites/Pixel-Rasen: `web/pixel.js` (CSS-Variablen `--spr-*`, `--pitch-bg`). Entwürfe/Vergleiche: `design/`.
- **Sticker-Album ist jetzt das Standard-Design** (`<html data-skin="sticker">`, Overrides in `web/skin-sticker.css` über `style.css`; der Pixel-Skin-Umschalter wurde entfernt, `style.css` bleibt als Basis). Teilen-Bild (`drawShareCard`, app.js) ebenfalls im Sticker-Stil: gelbe Streifen, Album-Seite, Impact-Logo mit Ball, Sticker-Kacheln/-Karten, Barlow Condensed.


## Struktur
```
web/                  Spiel (hochladen = Inhalt dieses Ordners)
  index.html          Gerüst, Tabs, Dialoge
  pixel.js            Pixel-Optik: Spieler-Sprites + Pixel-Rasen als SVG-CSS-Variablen
  app.js              Klassik-Modus + gemeinsame Helfer (esc, normalize, todayStr, hashStr, store, ICON, COUNTRIES, CONFIG)
  modes.js            Karriere, Raster, Mitspieler, Wer fehlt + Navigation (GAMES, showGame) + Suche (createSearch)
  draft.js            Draft-Modus (registriert sich als GAMES.draft)
  data/players.js     aktuelle CL-Spieler (Klassik)
  data/history.js     ~9.100 historische Spieler mit Karrieren, Vereine, Rating-Gewichte
  data/lineups.js     51 Finalspiele mit Startelfen
  data/nations.js     Turnierkader WM/EM (Draft-Nationalteams)
pipeline/             PowerShell-Skripte, die die Daten erzeugen
data/                 Zwischenergebnisse der Pipeline (JSON), werden ins Repo committed
design/               Design-Entwürfe (Mockups), nicht Teil des Spiels
.cache/               Rohdaten-Cache (NICHT im Repo, ~800 MB, enthält u. a. FIFA-Daten)
```

## Spielmodi
| Tab | Inhalt |
|---|---|
| **Klassik** | Spieler erraten über 7 Kacheln: Liga, Nation, Position, Alter, Größe, Fuß, Nr. Täglich + Endlos (Leicht/Mittel/Schwer). |
| **Karriere** | Vereinsstationen mit Jahren → Spieler erraten. Getippte Spieler markieren gemeinsame Stationen (✓). |
| **Raster** | 3×3, Zeilen/Spalten = große Vereine, Spieler nennen, der für beide gespielt hat. 9 Versuche. |
| **Mitspieler** | 3 Mitspieler (+1 pro Fehlversuch, max. 6) → gesuchter Spieler. Auch richtig: jemand, der mit ALLEN gezeigten zusammenspielte. |
| **Wer fehlt** | Startelf eines Finals auf dem Spielfeld, eine Position fehlt. |
| **Draft** | 11 Runden, je 3 zufällige Team-Saisons bzw. Nationalteams (WM/EM) → Mannschaft festlegen → Spieler per Drag & Drop (Handy: antippen) auf 4-2-3-1 → ✓. Kein Tagesmodus, jeder Start neu zufällig. |

Tagesmodi: gleiche Rätsel für alle per Hash aus Datum (`Europe/Vienna`), Fortschritt in localStorage.
`CONFIG.testMode = true` (app.js) zeigt „Neues Rätsel (Test)“ – **vor Launch auf false**.

### Wichtige Design-Entscheidungen (vom Besitzer festgelegt)
- **Liga (Klassik)**: Top-5-Ligen mit Namen, alle anderen = „Andere“. Spielen Tipp und Gesuchter beide in „Andere“ → **grün** (genaue Liga wird nicht verraten), Tooltip/Antippen erklärt das.
- **Nation** = sportliche Nationalität (Nationalteam), orange bei gleichem Kontinentalverband.
- **Position (Klassik)**: TW/ABW/MF/ST, mehrere möglich (z. B. Laimer ABW+MF) → orange bei Überschneidung. Darstellung: Pixel-Mini-Spielfeld (Tor links, 4 Zonen, aktive Zonen weiß, `ICON.pitch`) + Text.
- **Hinweise** (nach 3/5/7/10 Fehlversuchen: Liga, Detailposition, Verein, Initialen) werden nur **freigeschaltet**, aufdecken per Klick, wieder ausblendbar. Benutzte Hinweise → 💡 beim Teilen.
- **Lösungs-Pool** nur bekannte Spieler (≥ 100.000 Wikipedia-Aufrufe/Jahr), tippen darf man alle.
- Kein Marktwert als Feld. Keine Vereinswappen (Markenrecht) – Trikot-Modus wäre die Alternative.

## Daten & Pipeline (PowerShell 5.1, Windows)
Reihenfolge:
```powershell
.\pipeline\build.ps1              # CL-Kader (Wikipedia) + Wikidata + transfermarkt-datasets + Pageviews -> data/players.json -> web/data/players.js
.\pipeline\build-history.ps1      # Wikidata: Fußballer mit >= 25 Sprachversionen, Karrieren (P54), Nation, Position -> data/history.json
.\pipeline\build-lineups.ps1      # Wikipedia-Finalartikel -> data/lineups.json
.pipelinebuild-nations.ps1      # Wikipedia-Turnierkader WM/EM -> data/nations.json
.\pipeline\build-positions.ps1    # genaue Positionen (TM sub_position, sonst Wikidata P413) -> data/positions.json
.\pipeline\calibrate-ratings.ps1  # Rating-Gewichte (FIFA nur lokal zum Eichen) -> data/rating-model.json
.\pipeline\export-modes.ps1       # -> web/data/history.js + lineups.js + nations.js (inkl. Rating-Gewichte + rating-overrides.json)
.\pipeline\download-flags.ps1     # Flaggen nach web/flags/ (einmalig)
```
- (`build-uk-nations.ps1` → data/uk-nations.json, danach `export-modes.ps1`.)
- Wikimedia verlangt Kontakt im User-Agent: `pipeline/contact.local.txt` (eine Zeile, Mail) – **nicht im Repo**, auf neuem Rechner neu anlegen. Ohne Kontakt drosselt Wikimedia stark (HTTP 429).
- Caches in `.cache/` (Wikidata-Blöcke, Pageviews, transfermarkt-datasets, FIFA). Fehlen sie, laden die Skripte neu (30–60 min).
- transfermarkt-datasets (dcaribou, CC0) ist seit Juli 2026 eingefroren → nur für statische Werte (Fuß, Größe, Geburtsdatum, Position) nutzen.
- Deutsche Vereinsnamen für Klassik: Tabelle `$CLUB_DE` in `pipeline/export-web.ps1`.

### Soccerdle-Rating (Draft) – Umstellung auf Leistung statt Ruhm
- Problem: Bekanntheit (Sitelinks) misst Ruhm, nicht Leistung („Messi-Ronaldo-Debatte“); die FIFA-Eichung erklärt nur R² = 0,44.
- **Neu**: Basis = **Transfermarkt-Marktwert der Saison** (`pipeline/build-market.ps1` → `data/market.json` → `web/data/market.js`; veröffentlicht werden nur abgeleitete Rating-Punkte je Spieler+Saison, nicht die Marktwerte). `marketRating()`/`ageAdjust()` in draft.js; ohne Marktwert (vor ~2004 / unbekannt) greift die alte Formel unten.
- **PROVISORISCH**: Mapping Marktwert → Rating ist eine Ankertabelle (`$ANCHORS` in build-market.ps1) und der Alters-/Torhüter-Ausgleich (`ageAdjust`, +5 TW) nach Augenmaß, weil die FIFA-Eichdatei (`.cache/fifa/fifa_slim.tsv`) auf diesem Rechner fehlt. Mit der Datei: `calibrate-ratings.ps1` um ln(Marktwert) erweitern und beides per Regression ersetzen.
- Reihenfolge: `build-alt-positions.ps1` (erzeugt .cache/tm-ids.json) → `build-market.ps1` → `export-modes.ps1`.

Alte Formel (Fallback):
`rating = b0 + b1·ln(Sitelinks) + b2·Vereinsstärke(Saison) + b3·max(0,26−Alter)² + b4·max(0,Alter−30)² + b5·Torwart + Korrektur`
- Gewichte per Regression an FIFA 15–23 geeicht (~24.000 Spieler-Saisons, mittlere Abweichung 3,6). **Veröffentlicht werden nur die Gewichte**, nie FIFA-Werte (EU-Datenbankrecht).
- Manuelle Korrekturen: `pipeline/rating-overrides.json` (`"Q-ID": { "name", "punkte" }`), danach `export-modes.ps1`.
- Positionsabzug im Draft: Abstand auf dem Spielfeld (seitlich halb gewichtet), `1 − 0.8·(d/100)^1.5`; Torwart ↔ Feld = Faktor 0,2.
- Draft-Ergebnis: siehe „Draft – Stand“ (Team-Rating vs. perfekte Elf, `optimalDraft` in draft.js).

## Stolperfallen
- **PowerShell-Variablen sind case-insensitiv**: `$line`/`$LINE`, `$pos`/`$POS`, `$matches` (automatisch!) haben schon Bugs verursacht.
- PowerShell entpackt Ein-Element-Arrays → `@(...)` verwenden, sonst `$null[0]`-Fehler oder String-Verkettung (z. B. "Q1000Q1000").
- `.ps1` mit Umlauten als **UTF-8 mit BOM** speichern (PS 5.1 liest sonst ANSI).
- Wikidata führt englische Vereine unter „Vereinigtes Königreich“ (kein FIFA-Code) → `ICON.flag` zeigt nur bekannte Codes aus `COUNTRIES`.
- Node (v24) ist installiert (Logik-Tests/Simulationen: Skripte per `vm` mit DOM-Stubs laden), Python nicht. Optik per **Edge headless** (Screenshot), z. B.:
  `msedge --headless=new --window-size=1100,1000 --virtual-time-budget=6000 --screenshot=out.png file:///…/web/index.html`
  Testseiten (`web/_test.html`) nach dem Test wieder löschen.

## Nächste Schritte
### Draft – Stand (umgesetzt, noch nicht auf echtem Handy getestet)
- **Ratings bleiben sichtbar** (Kader, Ø bei den Angeboten, Live-Team-Rating) – ohne wäre es zu schwer (Besitzer-Entscheidung, ersetzt den früheren Wunsch „Ratings weg“).
- **Ablauf**: Mannschaft wählen ist **endgültig** (kein Durchklicken, Spieler sieht man erst danach) → Spieler setzen → kleines ✓ (bzw. ↩ zum Zurücknehmen) → erst nach Bestätigung kommen 3 neue Teams. **Kein nachträgliches Verschieben.**
- **Nationalteams** (WM 1990–2022, EM 1992–2024) als Draft-Teams, ca. 20 % der Angebote (`DRAFT.nationShare`). Daten: `build-nations.ps1` (Wikipedia „… squads“) → `data/nations.json` → `export-modes.ps1` → `web/data/nations.js`. Land = häufigste Nationalität der Spieler. Rating im Nationalteam = Stärke des Vereins, bei dem der Spieler in dieser Saison war.
  - **Offen**: EM 2016 hat nur 12 von 24 Kadern (England, Frankreich, Deutschland … fehlen – vermutlich andere Vorlage im Wikitext), EM 1992 evtl. unvollständig. (behoben: Parser kennt jetzt `{{sortname}}`, EM 2016 hat 23 Kader.)
  - **Teams-Auswahl**: keine Titel-Beschränkung; nur Top-60-Vereine bzw. Kader mit ≥ 16 (Verein) / ≥ 15 (Nation) bekannten Spielern. Falls es zu beliebig wird: strengeren Filter über die Kaderstärke (`strength`) ergänzen.
- **Positionsabzug**: ZDM/ZM/ZOM, LM/LA und RM/RA ohne Abzug tauschbar (`SAME_GROUP`); Abzug nur bei groben Fehlbesetzungen.
- **Zweitpositionen** (z. B. Kimmich ZDM + RV): `pipeline/build-alt-positions.ps1` zählt aus transfermarkt-datasets `game_lineups.csv` (Position je Startelf-Einsatz, ca. 2013–2026) die Positionen mit ≥ 8 Spielen und ≥ 15 % der Einsätze → `data/alt-positions.json` → `history.js` (9. Feld) → im Draft kein Abzug auf diesen Positionen („auch RV“). Braucht `.cache/tm-ids.json` (Wikidata P2446, wird erzeugt) und lädt ~125 MB.
- **Ergebnis = Team-Rating** (Ø der 11 Positionswerte inkl. Positionsabzug), kein „x von 100“ mehr (Besitzer-Wunsch: ein allgemeines Rating zum Vergleichen). Daneben das Rating der **perfekten Elf** aus denselben Angeboten (Glück der Angebote wird so sichtbar) und je Position der Rückstand („−11“ am Spieler). Rekord: localStorage `soccerdle-draft-best-rating`. Optimum nimmt jeden Spieler nur einmal (Branch & Bound über Ungarischen Algorithmus). Ratings sind pro Spieler **und Saison/Verein** verschieden – Ronaldo 2014 ≠ Ronaldo 2020.
- **Auswertung**: Gegenüberstellung „Deine Elf“ vs. „Perfekte Elf“ als zwei Spielfelder (grün = gleicher Spieler auf gleicher Position).
- **Anleitung**: „?“ im Draft zeigt `DraftMode.helpHtml` (Mechanismus `showModeHelp(game)` in modes.js, Dialog `#dlg-help-mode`); beim ersten Start einmalig automatisch.
- Optional/offen: Chemie-Bonus, Formationswahl.

### Anleitungen – umgesetzt
- Jeder Modus hat eine Kurz-Anleitung (3–4 Punkte): Klassik in `index.html` (`#dlg-help`), die anderen als `helpHtml` am Modus (`showModeHelp`/`maybeShowModeHelp` in modes.js). „?“ zeigt die des offenen Modus, beim ersten Öffnen einmalig automatisch (localStorage `soccerdle-seen-help-<modus>`).
- Noch offen: Farb-Legende als Grafik/Beispiele statt Text, Feinschliff nach Test.

### Klassik – Extras (bekannte Spieler außerhalb der CL)
- Messi, Ronaldo, Neymar, Saudi-/MLS-Stars usw. stehen in `pipeline/extra-players.json` (Name, Verein, Land, Nummer **von Hand gepflegt**, Wikidata ist hier oft veraltet – vor Launch prüfen!). `build-extras.ps1` ergänzt Nation/Position/Größe/Fuß/Pageviews → `data/extras.json`; `export-web.ps1` hängt sie an `players.js` an. Liga = „Andere“ (außer Top-5-Land).

### Mitspieler – Auswahl eingeschränkt
- Gezeigte Mitspieler nur aus den Top-70-Vereinen (`MODE_CONFIG.mates.topClubs`), ≥ 50 Sitelinks, höchstens 2 je Verein, mind. 3 verschiedene Vereine. Idee (offen): Schwierigkeits-Umschalter, z. B. „Weltstars / Kenner / Experte“ mit unterschiedlichen `clueMinSl`/`topClubs`.

### Klassik – Ligen
- Ligen mit eigenem Namen: `NAMED_LEAGUES` in app.js = Top 5 + Saudi Pro League + MLS (die „out of the box“-Ligen); alle anderen „Andere“ (Hinweis „Liga“ nach 3 Fehlversuchen nennt das Land).

### Teilen / Statistik
- **Teilen** erzeugt ein Bild (Canvas, `drawShareCard` in app.js: Klassik = Farbkacheln, Draft = Elf auf dem Feld, sonst Emoji-Zeilen) und öffnet am Smartphone den Teilen-Dialog (`navigator.share` mit Datei + Text + Link, `shareResult`); am Desktop wird das Bild bzw. der Text kopiert. **`CONFIG.siteUrl` ist ein Platzhalter** ('https://deine-domain.at') – vor Launch setzen.
- Klassik zeigt „Gestern gesucht: …“ (rechnet die Hash-Formel für gestern, ohne Server; bei fester Rätsel-Liste anpassen).
- **Statistik (Idee, noch offen)**: Durchschnittliche Versuche, „X % hatten bei Versuch n auch Spieler Y“ usw. braucht einen kleinen Server-Teil (statisch reicht nicht): z. B. ein PHP-Skript auf dem Webspace, das pro gelöstem Rätsel anonym {Modus, Rätsel-Nr., Versuche, getippte Spieler-IDs} entgegennimmt und aggregiert (JSON/SQLite); die Seite liest nur die Aggregate. Keine Cookies/IDs, aber in die Datenschutzerklärung aufnehmen; Missbrauchsschutz (Rate-Limit). Vorher klären: unterstützt der Webspace PHP?

### Raster – Rerolls umgesetzt
- 2 Rerolls von Anfang an, der **3. wird mit 3 gelösten Feldern verdient** (`MODE_CONFIG.grid.rerolls / earnRerollAt`). ↻ an der Überschrift tauscht einen Verein (nur in Zeilen/Spalten ohne gelöstes Feld, kostet keinen Versuch). Ersatz-Verein hat zu allen 3 Gegenübern ≥ 3 Lösungen. **Jeder Spieler kommt nur einmal vor** (Suche sperrt bereits verwendete) und es gibt immer eine Lösung mit 9 verschiedenen Spielern (`gridSolve`, bipartites Matching, auch beim Reroll geprüft; Auflösung zeigt genau diese Lösung).

### Design – Entscheidung (offen: Umsetzung im Spiel)
- **Aktueller Favorit: Pixel-Arcade** (`design/retro-e-pixelbowl.html`, v2): Rasen-Grün + Creme + Gelb + Rot (kein Orange/Lila-Blau mehr), Namen in Pixelify Sans 14 px auf dunklem Schild (lesbar), Press Start 2P nur für Logo/Titel/Zahlen, Pixel-Figuren je Position (Rot/Blau/Creme/Gelb), Pixel-Rasen mit Grasbüscheln, Zielflaggen-Schachbrett unter dem Kopf, Tag + Nacht. Das Sticker-Album unten ist die Alternative.
- Gewählt: **Sticker-Album** (Variante B1: Gelb/Rot/Blau, Tag + Nacht). Logo „Ball statt O“ im Schriftzug, Kopf = **Album-Seite** (ganzes Blatt mit Rahmen, Eckhaltern, gestrichelter Trennlinie), **kein Kachel-Glanz**, Standard-Stil (harte Schatten, dicke Konturen). Kein „Champions League 2026/27“-Zusatz im Kopf.
- **Endgültig Variante 1** (nicht die Panini-Variante). Schrift für Logo/Titel/große Zahlen: **Impact** (Fallback Arial Black), kursiv, dunkle Kontur + kurzer Schatten wie bei der Rating-Zahl; Ball-O sitzt auf der Grundlinie, Höhe = Versalienhöhe (per Canvas gemessen, `--cap`). Lilita One (Google Fonts) wurde ausprobiert und verworfen. Tag: blau/rot, Nacht: rosa/gelb. Schriftvergleich: `design/logo-fonts.html`.
- Kachel-Schrift (weiß auf Grün/Rot) hat schwarze Kontur, knallige Farben bleiben.
- Nacht: Titel rosa, Kopf/Logo rosa+gelb mit dunkler Kontur (alle Texte auf Lesbarkeit geprüft). Entwurf: `design/sticker-final.html` (Varianten-Labor: `design/sticker-lab.html`, Übersicht `design/retro.html`). Skin in `design/sticker.css`, Struktur `design/stile-base.css`.
- Desktop: breiter Rahmen (max. 1320/1440 px), zwei Spalten (Klassik links, Draft rechts). Nächster Schritt: in `web/style.css` übernehmen (alle Modi, Dialoge, Teilen-Bilder, Anleitungen).

- Zusätzlicher Entwurf (nicht gewählt, evtl. später als Theme): Pixel-Arcade im Retro-Bowl-Stil, `design/retro-e-pixelbowl.html` (Press Start 2P + Pixelify Sans, beide OFL; Pixel-Sprites, Pixel-Rasen als SVG).

### Allgemein / Launch
- Tagesrätsel: feste, vorab erzeugte Liste (keine Wiederholungen) statt Hash-Zufall.
- Impressum + Datenschutzerklärung (Pflicht AT/DE), `CONFIG.testMode = false`, `<meta name="robots" content="noindex">` in index.html entfernen.
- Testversion läuft über GitHub Pages (`.github/workflows/pages.yml` veröffentlicht `web/` bei jedem Push auf main; Repo dafür öffentlich).
- Test auf echtem Handy.
- Flaggen: für alle Modi ergänzt (Alias-Codes über `FLAG_FILE` in app.js, historische YUG/URS/GDR von Wikimedia Commons). Britische Spieler mit nur „GBR“ werden über `build-uk-nations.ps1` (P54 → ENG/SCO/WAL/NIR) aufgelöst, ~230 bleiben GBR (UK-Flagge).
- Datenqualität Wikidata (fehlende Jahre, doppelte Stationen, Leihen in Kadern).
- Ideen-Speicher: Stadion-Umriss (OpenStreetMap), Zitat-Modus, Trikot-Modus (Farben/Muster statt Wappen), legendäre Tore als Passstafette (StatsBomb Open Data, Lizenz prüfen).
