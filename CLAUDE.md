# Soccerdle – Projektkontext für Claude

Fußball-Ratespiel im Stil von Loldle/Pokedle (Champions League 2026/27 + historische Spieler).
Besitzer: Sebastian (AT). Kommunikation auf **Deutsch**. Zielplattform: **normaler Webspace** (statische Dateien, kein Server-Code).

## Grundprinzipien
- **`web/` ist das komplette Spiel**: reines HTML/CSS/JS, kein Build, keine Abhängigkeiten, kein Backend.
  Daten liegen als `.js`-Dateien (`window.SOCCERDLE_…`), damit `index.html` auch per Doppelklick (file://) läuft.
- **DSGVO**: nichts von Fremd-CDNs laden. Flaggen (`web/flags/`, flag-icons MIT) und Schriften (`web/fonts/`, Barlow Condensed + Inter, OFL) sind selbst gehostet.
- **Rechtliches**: keine Vereinswappen, keine Spielerfotos, keine EA/FIFA-Werte veröffentlichen (siehe Rating).
- Design „Matchday v3“: hell + dunkel (Umschalter, `data-theme`), Farben als CSS-Variablen in `web/style.css`.

## Struktur
```
web/                  Spiel (hochladen = Inhalt dieses Ordners)
  index.html          Gerüst, Tabs, Dialoge
  app.js              Klassik-Modus + gemeinsame Helfer (esc, normalize, todayStr, hashStr, store, ICON, COUNTRIES, CONFIG)
  modes.js            Karriere, Raster, Mitspieler, Wer fehlt + Navigation (GAMES, showGame) + Suche (createSearch)
  draft.js            Draft-Modus (registriert sich als GAMES.draft)
  data/players.js     aktuelle CL-Spieler (Klassik)
  data/history.js     ~9.100 historische Spieler mit Karrieren, Vereine, Rating-Gewichte
  data/lineups.js     51 Finalspiele mit Startelfen
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
| **Draft** | 11 Runden, je 3 zufällige Team-Saisons → Kader → Spieler per Drag & Drop (Handy: antippen) auf 4-2-3-1. Kein Tagesmodus, jeder Start neu zufällig. |

Tagesmodi: gleiche Rätsel für alle per Hash aus Datum (`Europe/Vienna`), Fortschritt in localStorage.
`CONFIG.testMode = true` (app.js) zeigt „Neues Rätsel (Test)“ – **vor Launch auf false**.

### Wichtige Design-Entscheidungen (vom Besitzer festgelegt)
- **Liga (Klassik)**: Top-5-Ligen mit Namen, alle anderen = „Andere“. Spielen Tipp und Gesuchter beide in „Andere“ → **grün** (genaue Liga wird nicht verraten), Tooltip/Antippen erklärt das.
- **Nation** = sportliche Nationalität (Nationalteam), orange bei gleichem Kontinentalverband.
- **Position (Klassik)**: TW/ABW/MF/ST, mehrere möglich (z. B. Laimer ABW+MF) → orange bei Überschneidung. Darstellung: Mini-Spielfeld.
- **Hinweise** (nach 4/7/10 Fehlversuchen) werden nur **freigeschaltet**, aufdecken per Klick, wieder ausblendbar. Benutzte Hinweise → 💡 beim Teilen.
- **Lösungs-Pool** nur bekannte Spieler (≥ 100.000 Wikipedia-Aufrufe/Jahr), tippen darf man alle.
- Kein Marktwert als Feld. Keine Vereinswappen (Markenrecht) – Trikot-Modus wäre die Alternative.

## Daten & Pipeline (PowerShell 5.1, Windows)
Reihenfolge:
```powershell
.\pipeline\build.ps1              # CL-Kader (Wikipedia) + Wikidata + transfermarkt-datasets + Pageviews -> data/players.json -> web/data/players.js
.\pipeline\build-history.ps1      # Wikidata: Fußballer mit >= 25 Sprachversionen, Karrieren (P54), Nation, Position -> data/history.json
.\pipeline\build-lineups.ps1      # Wikipedia-Finalartikel -> data/lineups.json
.\pipeline\build-positions.ps1    # genaue Positionen (TM sub_position, sonst Wikidata P413) -> data/positions.json
.\pipeline\calibrate-ratings.ps1  # Rating-Gewichte (FIFA nur lokal zum Eichen) -> data/rating-model.json
.\pipeline\export-modes.ps1       # -> web/data/history.js + lineups.js (inkl. Rating-Gewichte + rating-overrides.json)
.\pipeline\download-flags.ps1     # Flaggen nach web/flags/ (einmalig)
```
- Wikimedia verlangt Kontakt im User-Agent: `pipeline/contact.local.txt` (eine Zeile, Mail) – **nicht im Repo**, auf neuem Rechner neu anlegen. Ohne Kontakt drosselt Wikimedia stark (HTTP 429).
- Caches in `.cache/` (Wikidata-Blöcke, Pageviews, transfermarkt-datasets, FIFA). Fehlen sie, laden die Skripte neu (30–60 min).
- transfermarkt-datasets (dcaribou, CC0) ist seit Juli 2026 eingefroren → nur für statische Werte (Fuß, Größe, Geburtsdatum, Position) nutzen.
- Deutsche Vereinsnamen für Klassik: Tabelle `$CLUB_DE` in `pipeline/export-web.ps1`.

### Soccerdle-Rating (Draft)
`rating = b0 + b1·ln(Sitelinks) + b2·Vereinsstärke(Saison) + b3·max(0,26−Alter)² + b4·max(0,Alter−30)² + b5·Torwart + Korrektur`
- Gewichte per Regression an FIFA 15–23 geeicht (~24.000 Spieler-Saisons, mittlere Abweichung 3,6). **Veröffentlicht werden nur die Gewichte**, nie FIFA-Werte (EU-Datenbankrecht).
- Manuelle Korrekturen: `pipeline/rating-overrides.json` (`"Q-ID": { "name", "punkte" }`), danach `export-modes.ps1`.
- Positionsabzug im Draft: Abstand auf dem Spielfeld (seitlich halb gewichtet), `1 − 0.8·(d/100)^1.5`; Torwart ↔ Feld = Faktor 0,2.
- Draft-Punkte: 100 = bestmögliche Elf aus den angebotenen Teams (Ungarischer Algorithmus, `optimalDraft` in draft.js).

## Stolperfallen
- **PowerShell-Variablen sind case-insensitiv**: `$line`/`$LINE`, `$pos`/`$POS`, `$matches` (automatisch!) haben schon Bugs verursacht.
- PowerShell entpackt Ein-Element-Arrays → `@(...)` verwenden, sonst `$null[0]`-Fehler oder String-Verkettung (z. B. "Q1000Q1000").
- `.ps1` mit Umlauten als **UTF-8 mit BOM** speichern (PS 5.1 liest sonst ANSI).
- Wikidata führt englische Vereine unter „Vereinigtes Königreich“ (kein FIFA-Code) → `ICON.flag` zeigt nur bekannte Codes aus `COUNTRIES`.
- Kein Node/Python auf dem Arbeitsrechner. Tests per **Edge headless** (Screenshot), z. B.:
  `msedge --headless=new --window-size=1100,1000 --virtual-time-budget=6000 --screenshot=out.png file:///…/web/index.html`
  Testseiten (`web/_test.html`) nach dem Test wieder löschen.

## Nächste Schritte
### Draft (vom Besitzer gewünscht)
1. **Ratings komplett weg während des Drafts** – keine Spieler-Ratings im Kader, keine Ø-Ratings bei den Team-Angeboten, auch kein Live-Team-Rating. Ratings/Punkte erst am Ende (Auflösung + perfekte Elf).
2. **Nationalteams als Draft-Teams ergänzen** – z. B. „Deutschland · WM 2014“, „Spanien · EM 2012“ neben den Vereins-Saisons. Datenbasis: Turnierkader (Wikipedia „… squads“-Artikel) bzw. die Final-Aufstellungen in `data/lineups.json`. *(Vom Besitzer kurz bestätigen lassen, falls unklar – gemeint könnte auch nur „Nation/Flagge im Kader anzeigen“ sein; das ist bereits umgesetzt.)*
3. **Draft-Erklärung** im Spiel: kurze Anleitung beim ersten Start bzw. über „?“ (Ablauf in 3–4 Schritten, Positionsabzug, wie die 100 Punkte entstehen).
4. **Punkte strecken**: Wer sich „nicht dumm anstellt“, soll bei **80–90** landen; **über 95 muss wirklich schwer** sein.
   Idee: 0 = Durchschnittswahl (z. B. mittlerer Spieler der angebotenen Kader auf passender Position), 100 = Optimum, dazwischen nicht-linear (z. B. Potenzkurve) und mit Simulationen kalibrieren (gierige Strategie *ohne* Rating-Kenntnis ≈ 80–85).
5. Optimum darf denselben Spieler nicht doppelt nehmen (gleicher Spieler in zwei Team-Saisons) – derzeit möglich.
6. Optional: Chemie-Bonus, Formationswahl.

### Anleitungen (vom Besitzer gewünscht)
- **Generell übersichtlicher und einfacher**: pro Modus eine kurze Anleitung (max. 3–4 Punkte, Beispiele statt Fließtext, Farb-Legende als Grafik).
- Der „?“-Knopf zeigt die Anleitung **des gerade offenen Modus** (derzeit nur Klassik, und die ist zu lang).
- Beim ersten Öffnen eines Modus einmalig die Kurz-Anleitung zeigen.

### Allgemein / Launch
- Tagesrätsel: feste, vorab erzeugte Liste (keine Wiederholungen) statt Hash-Zufall.
- Impressum + Datenschutzerklärung (Pflicht AT/DE), `CONFIG.testMode = false`, `<meta name="robots" content="noindex">` in index.html entfernen.
- Testversion läuft über GitHub Pages (`.github/workflows/pages.yml` veröffentlicht `web/` bei jedem Push auf main; Repo dafür öffentlich).
- Test auf echtem Handy.
- Datenqualität Wikidata (fehlende Jahre, doppelte Stationen, Leihen in Kadern).
- Ideen-Speicher: Stadion-Umriss (OpenStreetMap), Zitat-Modus, Trikot-Modus (Farben/Muster statt Wappen), legendäre Tore als Passstafette (StatsBomb Open Data, Lizenz prüfen).
