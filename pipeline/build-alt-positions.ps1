# Soccerdle - Zweitpositionen fuer den Draft (z. B. Kimmich: ZDM, aber oft RV gespielt)
# Quelle: transfermarkt-datasets game_lineups.csv (Position je Spiel in der Startelf, ca. 2013 - 2026, CC0)
#         + Wikidata P2446 (Transfermarkt-ID) fuer den Abgleich mit unseren Spielern
# Ergebnis: data/alt-positions.json  { "Q-ID": ["RV", ...] }  - Positionen (ausser der Hauptposition), auf denen der Spieler
#           mindestens $MinStarts Spiele UND mindestens $MinShare aller Startelf-Einsaetze hatte. Dort gibt es im Draft keinen Abzug.
# Zeitaufwand: Download ~125 MB, Auswertung einige Minuten.
param(
  [string]$CacheDir = "$PSScriptRoot\..\.cache",
  [string]$OutFile  = "$PSScriptRoot\..\data\alt-positions.json",
  [int]$MinStarts = 8,
  [double]$MinShare = 0.15
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir); $OutFile = [IO.Path]::GetFullPath($OutFile)
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($contact)" }
$TM_MAP = @{
  'Goalkeeper' = 'TW'; 'Centre-Back' = 'IV'; 'Sweeper' = 'IV'; 'Left-Back' = 'LV'; 'Right-Back' = 'RV'
  'Defensive Midfield' = 'ZDM'; 'Central Midfield' = 'ZM'; 'Attacking Midfield' = 'ZOM'
  'Left Midfield' = 'LM'; 'Right Midfield' = 'RM'; 'Left Winger' = 'LA'; 'Right Winger' = 'RA'
  'Second Striker' = 'ST'; 'Centre-Forward' = 'ST'
}
New-Item -ItemType Directory -Force (Join-Path $CacheDir 'tm') | Out-Null

# ---------- 1) Wikidata-ID -> Transfermarkt-ID (P2446), nur fuer unsere Spieler, gecacht ----------
$dataDir = Split-Path $OutFile
$hist = [IO.File]::ReadAllText((Join-Path $dataDir 'history.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$tmIdFile = Join-Path $CacheDir 'tm-ids.json'
$tmIds = @{}
if (Test-Path $tmIdFile) { foreach ($kv in ([IO.File]::ReadAllText($tmIdFile, [Text.Encoding]::UTF8) | ConvertFrom-Json).PSObject.Properties) { $tmIds[$kv.Name] = $kv.Value } }
$todo = @($hist.players | ForEach-Object { $_.id } | Where-Object { -not $tmIds.ContainsKey($_) })
Write-Host "Transfermarkt-IDs von Wikidata laden: $($todo.Count) Spieler"
for ($i = 0; $i -lt $todo.Count; $i += 50) {
  $batch = $todo[$i..([Math]::Min($i + 49, $todo.Count - 1))] -join '|'
  $r = $null
  for ($try = 1; $try -le 5 -and -not $r; $try++) {
    try { Start-Sleep -Milliseconds 300; $r = Invoke-RestMethod -Headers @{ 'User-Agent' = $UA['User-Agent'] } -TimeoutSec 120 "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$batch&props=claims&format=json" }
    catch { Start-Sleep -Seconds (4 * $try) }
  }
  if (-not $r) { throw "Abbruch bei Batch $i" }
  foreach ($kv in $r.entities.PSObject.Properties) {
    $v = @($kv.Value.claims.P2446 | ForEach-Object { $_.mainsnak.datavalue.value })[0]
    $tmIds[$kv.Name] = $(if ($v) { "$v" } else { '' })
  }
  if (($i / 50) % 20 -eq 19) { [IO.File]::WriteAllText($tmIdFile, ($tmIds | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false)); Write-Host "  $($i + 50) / $($todo.Count)" }
}
[IO.File]::WriteAllText($tmIdFile, ($tmIds | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))

# ---------- 2) unsere Spieler + Hauptposition ----------
$main = [IO.File]::ReadAllText((Join-Path $dataDir 'positions.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$wanted = @{}   # TM-ID -> Wikidata-ID
foreach ($p in $hist.players) { $tm = $tmIds[$p.id]; if ($tm) { $wanted["$tm"] = $p.id } }
Write-Host "Spieler mit Transfermarkt-ID: $($wanted.Count) von $(@($hist.players).Count)"

# ---------- 3) game_lineups.csv.gz laden ----------
$gz = Join-Path $CacheDir 'tm\game_lineups.csv.gz'
if (-not (Test-Path $gz)) {
  Write-Host 'Lade game_lineups.csv.gz (~125 MB) ...'
  Invoke-WebRequest 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/game_lineups.csv.gz' -OutFile $gz
}

# ---------- 4) Startelf-Einsaetze je Spieler und Position zaehlen ----------
# Zeile: "id","date","game_id","player_id","club_id","name","type","position","number","captain"  -> Split('"'): Werte an ungeraden Indizes
$counts = @{}   # "TMID|Pos" -> Anzahl
$total = @{}    # TMID -> Startelf-Einsaetze
$fs = [IO.File]::OpenRead($gz); $zs = New-Object IO.Compression.GZipStream($fs, [IO.Compression.CompressionMode]::Decompress)
$sr = New-Object IO.StreamReader($zs, [Text.Encoding]::UTF8)
$null = $sr.ReadLine(); $n = 0
while ($null -ne ($line = $sr.ReadLine())) {
  $n++
  $f = $line.Split('"')
  if ($f.Length -lt 17 -or $f[13] -ne 'starting_lineup') { continue }
  $tm = $f[7]
  if (-not $wanted.ContainsKey($tm)) { continue }
  $pos = $TM_MAP[$f[15]]; if (-not $pos) { continue }
  $k = "$tm|$pos"
  $counts[$k] = 1 + [int]$counts[$k]
  $total[$tm] = 1 + [int]$total[$tm]
}
$sr.Close()
Write-Host "Zeilen gelesen: $n"

# ---------- 5) Zweitpositionen ableiten ----------
$out = [ordered]@{}
foreach ($k in $counts.Keys) {
  $tm, $pos = $k.Split('|'); $q = $wanted[$tm]
  if ($main.$q -eq $pos) { continue }
  $c = $counts[$k]
  if ($c -ge $MinStarts -and ($c / $total[$tm]) -ge $MinShare) {
    if (-not $out.Contains($q)) { $out[$q] = @() }
    $out[$q] += , @($pos, $c)
  }
}
$final = [ordered]@{}
foreach ($q in $out.Keys) { $final[$q] = @($out[$q] | Sort-Object { -$_[1] } | ForEach-Object { $_[0] }) }
[IO.File]::WriteAllText($OutFile, ($final | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Spieler mit Zweitposition: $($final.Count)"
