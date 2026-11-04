# Exportiert historische Datenbank + Aufstellungen fuers Spiel (web/data/history.js, web/data/lineups.js)
# Kompaktes Format (Arrays statt Objekte), damit die Dateien klein bleiben.
param(
  [string]$HistoryFile = "$PSScriptRoot\..\data\history.json",
  [string]$LineupsFile = "$PSScriptRoot\..\data\lineups.json",
  [string]$OutDir      = "$PSScriptRoot\..\web\data"
)
$ErrorActionPreference = 'Stop'
$OutDir = [IO.Path]::GetFullPath($OutDir)
function Write-Utf8($path, $text) { [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false)) }
$stamp = (Get-Date).ToString('yyyy-MM-dd')

# Vereinsnamen: deutsche Wikidata-Bezeichnung, ein paar Kuerzungen fuer die Anzeige
$CLUB_SHORT = @{
  'FC Bayern München' = 'FC Bayern'; 'Futbol Club Barcelona' = 'FC Barcelona'; 'Club Atlético de Madrid' = 'Atlético Madrid'
}

# ---------- Historie ----------
$h = [IO.File]::ReadAllText([IO.Path]::GetFullPath($HistoryFile), [Text.Encoding]::UTF8) | ConvertFrom-Json
$clubIds = @($h.clubs.PSObject.Properties.Name)
$clubIdx = @{}; for ($i = 0; $i -lt $clubIds.Count; $i++) { $clubIdx[$clubIds[$i]] = $i }
$clubsArr = foreach ($id in $clubIds) {
  $c = $h.clubs.$id
  $name = if ($CLUB_SHORT[$c.name]) { $CLUB_SHORT[$c.name] } else { $c.name }
  , @($name, $(if ($c.country) { $c.country } else { '' }))
}
$posFile = Join-Path (Split-Path $HistoryFile) 'positions.json'
$positions = if (Test-Path $posFile) { [IO.File]::ReadAllText($posFile, [Text.Encoding]::UTF8) | ConvertFrom-Json } else { $null }

# Auswahl-/Verbandsteams (z. B. "Katalanische Fussballauswahl"), die Wikidata nicht als Nationalteam fuehrt
$SELECTION_RX = '(?i)auswahl|selecci[oó]n|s[eé]lection|nationalmannschaft|national team|landslag|\bXI\b'   # NICHT "Olymp" (Olympique Lyon!)
$playersArr = foreach ($p in $h.players) {
  $flat = New-Object System.Collections.ArrayList
  foreach ($s in $p.career) {
    if ($h.clubs.($s.c).name -match $SELECTION_RX) { continue }
    [void]$flat.AddRange(@($clubIdx[$s.c], [int]$s.f, [int]$s.t, [int]$s.l))
  }
  if ($flat.Count -eq 0) { continue }
  $detail = if ($positions -and $positions.($p.id)) { $positions.($p.id) } else { '' }
  , @($p.id, $p.name, $(if ($p.dob) { $p.dob } else { '' }), $(if ($p.nat) { $p.nat } else { '' }), (@($p.pos) -join ','), [int]$p.sl, @($flat), $detail)
}
# Draft: Rating-Formel (Gewichte aus calibrate-ratings.ps1) + manuelle Korrekturen (Punkte +/- je Wikidata-ID)
$model = [IO.File]::ReadAllText((Join-Path (Split-Path $HistoryFile) 'rating-model.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$overridesFile = Join-Path $PSScriptRoot 'rating-overrides.json'
$overrides = if (Test-Path $overridesFile) { [IO.File]::ReadAllText($overridesFile, [Text.Encoding]::UTF8) | ConvertFrom-Json } else { @{} }
$adj = [ordered]@{}; foreach ($pr in $overrides.PSObject.Properties) { if ($pr.Name -match '^Q\d+$') { $adj[$pr.Name] = $pr.Value.punkte } }
$hjs = "// Automatisch erzeugt von pipeline/export-modes.ps1 am $stamp (Quelle: Wikidata, CC0)`nwindow.SOCCERDLE_HISTORY = " +
  (ConvertTo-Json ([ordered]@{ clubs = @($clubsArr); players = @($playersArr); ratingModel = $model.weights; ratingAdjust = $adj }) -Depth 6 -Compress) + ";`n"
Write-Utf8 (Join-Path $OutDir 'history.js') $hjs
Write-Host ("history.js: {0} Spieler, {1} Vereine, {2:N0} KB" -f @($playersArr).Count, @($clubsArr).Count, ((Get-Item (Join-Path $OutDir 'history.js')).Length / 1KB))

# ---------- Aufstellungen ----------
$l = [IO.File]::ReadAllText([IO.Path]::GetFullPath($LineupsFile), [Text.Encoding]::UTF8) | ConvertFrom-Json
$games = foreach ($g in $l) {
  $map = { param($lu) @($lu | ForEach-Object { [ordered]@{ pos = $_.pos; no = $_.no; name = $_.name; full = ($_.title -replace '\s*\([^)]*\)$', ''); nat = $_.nat; id = $_.id } }) }
  [ordered]@{ id = $g.id; comp = $g.comp; year = $g.year; team1 = $g.team1; team2 = $g.team2; score = $g.score; penalties = $g.penalties; stadium = $g.stadium
    lineup1 = (& $map $g.lineup1); lineup2 = (& $map $g.lineup2) }
}
$ljs = "// Automatisch erzeugt von pipeline/export-modes.ps1 am $stamp (Quelle: Wikipedia, CC BY-SA)`nwindow.SOCCERDLE_LINEUPS = " + (ConvertTo-Json @($games) -Depth 6 -Compress) + ";`n"
Write-Utf8 (Join-Path $OutDir 'lineups.js') $ljs
Write-Host ("lineups.js: {0} Spiele, {1:N0} KB" -f @($games).Count, ((Get-Item (Join-Path $OutDir 'lineups.js')).Length / 1KB))
