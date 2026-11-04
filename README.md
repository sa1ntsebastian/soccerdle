# Soccerdle

Fußballer-Ratespiel (Champions League 2026/27). Prototyp mit Bayern, Real Madrid und PSG.

## Ordner

| Ordner | Inhalt |
|---|---|
| `web/` | **Das Spiel.** Reine statische Seite, genau dieser Ordner wird hochgeladen. |
| `pipeline/` | Skripte, die die Spielerdaten erzeugen (PowerShell) |
| `data/` | Rohausgabe der Pipeline (wird nicht hochgeladen) |
| `.cache/` | Heruntergeladene Quelldaten (wird nicht hochgeladen) |

## Lokal testen

`web/index.html` per Doppelklick im Browser öffnen. Ein Server ist nicht nötig.

## Auf den Webspace hochladen

Den **Inhalt** von `web/` per FTP/SFTP in das Webverzeichnis kopieren (z. B. `public_html/` oder `htdocs/`):

```
index.html
style.css
app.js        (Klassik)
modes.js      (Karriere, Raster, Mitspieler, Wer fehlt)
draft.js      (Draft)
data/         (players.js, history.js, lineups.js)
flags/        (Flaggen, selbst gehostet)
fonts/        (Schriften, selbst gehostet)
```

## Daten-Pipeline (Reihenfolge)

```powershell
.\pipeline\build.ps1              # Klassik: aktuelle CL-Kader -> web/data/players.js
.\pipeline\build-history.ps1      # historische Spieler + Karrieren (Wikidata)
.\pipeline\build-lineups.ps1      # Final-Aufstellungen (Wikipedia)
.\pipeline\build-positions.ps1    # genaue Positionen fuer den Draft
.\pipeline\calibrate-ratings.ps1  # Soccerdle-Rating: Gewichte bestimmen (FIFA nur lokal zum Eichen)
.\pipeline\export-modes.ps1       # -> web/data/history.js + lineups.js
```

Rating-Korrekturen von Hand: `pipeline/rating-overrides.json` (Punkte +/- je Spieler), danach `export-modes.ps1`.

Es werden weder PHP noch eine Datenbank oder Node auf dem Server gebraucht.

## Daten aktualisieren

```powershell
$env:SOCCERDLE_CONTACT = "deine-mail-oder-projekt-url"   # verlangt Wikimedia
.\pipeline\build-test.ps1     # holt Daten und schreibt web/data/players.js
```

Danach nur `web/data/players.js` neu hochladen.
