# Soccerdle - leistungsnahe Basis fuer das Draft-Rating: Transfermarkt-Marktwerte je Saison
# Idee: Bekanntheit (Wikipedia-Sprachversionen) misst Ruhm, nicht Leistung ("Messi-Ronaldo-Debatte"). Der Marktwert zum
# jeweiligen Zeitpunkt spiegelt Leistung, Einsatzzeit und Niveau der Liga deutlich besser.
# Quelle: transfermarkt-datasets player_valuations.csv (CC0) + .cache/tm-ids.json (aus build-alt-positions.ps1)
# Veroeffentlicht werden NICHT die Marktwerte, sondern nur daraus abgeleitete Rating-Punkte je Spieler und Saison
# (web/data/market.js, siehe export-modes.ps1). Zuordnung Marktwert -> Rating: Tabelle $ANCHORS (provisorisch, siehe unten).
# Ergebnis: data/market.json  { "Q-ID": { "2014": 91, ... } }   (Saison y = Juli y bis Juni y+1)
param(
  [string]$CacheDir = "$PSScriptRoot\..\.cache",
  [string]$OutFile  = "$PSScriptRoot\..\data\market.json"
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir); $OutFile = [IO.Path]::GetFullPath($OutFile)

# Marktwert (Mio. EUR) -> Rating-Punkte (FIFA-aehnliche Skala). PROVISORISCH: Ankerpunkte nach Augenmass. Mit der FIFA-Eichdatei
# (calibrate-ratings.ps1) kann man diese Tabelle per Regression ersetzen (ln(Marktwert) -> FIFA-Wert, getrennt nach Alter).
$ANCHORS = @( @(0.1, 50), @(0.3, 56), @(1, 62), @(3, 67), @(8, 72), @(20, 78), @(40, 82), @(80, 87), @(150, 91), @(250, 94) )
function Map-Rating([double]$mioEur) {
  $x = [Math]::Log($mioEur)
  $first = $ANCHORS[0]; $last = $ANCHORS[$ANCHORS.Count - 1]
  if ($x -le [Math]::Log($first[0])) { return [double]$first[1] }
  if ($x -ge [Math]::Log($last[0])) { return [double]$last[1] }
  for ($i = 1; $i -lt $ANCHORS.Count; $i++) {
    $x0 = [Math]::Log($ANCHORS[$i - 1][0]); $x1 = [Math]::Log($ANCHORS[$i][0])
    if ($x -le $x1) { return $ANCHORS[$i - 1][1] + ($ANCHORS[$i][1] - $ANCHORS[$i - 1][1]) * ($x - $x0) / ($x1 - $x0) }
  }
}

$tmIdsFile = Join-Path $CacheDir 'tm-ids.json'
if (-not (Test-Path $tmIdsFile)) { throw 'tm-ids.json fehlt - zuerst build-alt-positions.ps1 laufen lassen' }
$tmIds = [IO.File]::ReadAllText($tmIdsFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$wanted = @{}; foreach ($kv in $tmIds.PSObject.Properties) { if ($kv.Value) { $wanted["$($kv.Value)"] = $kv.Name } }

$gz = Join-Path $CacheDir 'tm\player_valuations.csv.gz'
New-Item -ItemType Directory -Force (Split-Path $gz) | Out-Null
if (-not (Test-Path $gz)) { Invoke-WebRequest 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/player_valuations.csv.gz' -OutFile $gz }

# Zeilen: "player_id","date","market_value_in_eur",... -> Split('"'): player 1, date 3, value 5
$vals = @{}   # TMID -> Liste (Datum als Tage seit 1970, Wert)
$fs = [IO.File]::OpenRead($gz); $zs = New-Object IO.Compression.GZipStream($fs, [IO.Compression.CompressionMode]::Decompress)
$sr = New-Object IO.StreamReader($zs, [Text.Encoding]::UTF8)
$null = $sr.ReadLine(); $n = 0
$epoch = [datetime]'1970-01-01'
while ($null -ne ($line = $sr.ReadLine())) {
  $f = $line.Split('"'); if ($f.Length -lt 6) { continue }
  $id = $f[1]; if (-not $wanted.ContainsKey($id)) { continue }
  $d = [datetime]::ParseExact($f[3], 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
  if (-not $vals.ContainsKey($id)) { $vals[$id] = New-Object System.Collections.ArrayList }
  [void]$vals[$id].Add(@(($d - $epoch).TotalDays, [double]$f[5]))
  $n++
}
$sr.Close()
Write-Host "Marktwert-Zeilen: $n, Spieler: $($vals.Count)"

# je Saison der Wert, der dem 15. Januar der Saison am naechsten liegt (max. 400 Tage Abstand)
$out = [ordered]@{}
foreach ($id in $vals.Keys) {
  $list = $vals[$id]; $perSeason = [ordered]@{}
  $minY = [int]([Math]::Floor(($epoch.AddDays($list[0][0])).Year)) - 1
  for ($y = 2000; $y -le 2026; $y++) {
    $target = (([datetime]"$($y + 1)-01-15") - $epoch).TotalDays
    $best = $null; $bd = 400
    foreach ($e in $list) { $dd = [Math]::Abs($e[0] - $target); if ($dd -lt $bd) { $bd = $dd; $best = $e } }
    if ($best -and $best[1] -gt 0) { $perSeason["$y"] = [int][Math]::Round((Map-Rating ($best[1] / 1e6))) }
  }
  if ($perSeason.Count) { $out[$wanted[$id]] = $perSeason }
}
[IO.File]::WriteAllText($OutFile, ($out | ConvertTo-Json -Depth 3 -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Spieler mit Marktwert-Rating: $($out.Count)"
