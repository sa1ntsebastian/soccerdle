# Soccerdle - zusaetzliche bekannte Spieler fuer Klassik (nicht in der Champions League: Saudi-Liga, MLS, ...)
# Eingabe:  pipeline/extra-players.json (Name, Verein, Land, Nummer von Hand)
# Daten:    history.json (Nation, Geburtsdatum, Position), tm-ids.json + transfermarkt players.csv (Groesse, Fuss, Detailposition),
#           Wikipedia-Pageviews (Bekanntheit). Ergebnis: data/extras.json - export-web.ps1 haengt sie an players.js an.
# Reihenfolge: build-alt-positions.ps1 (erzeugt .cache/tm-ids.json) -> build-extras.ps1 -> export-web.ps1
param(
  [string]$CacheDir = "$PSScriptRoot\..\.cache",
  [string]$OutFile  = "$PSScriptRoot\..\data\extras.json"
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir); $OutFile = [IO.Path]::GetFullPath($OutFile)
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($contact)" }
function Invoke-Api($url) {
  for ($try = 1; $try -le 5; $try++) {
    Start-Sleep -Milliseconds 400
    try { return Invoke-RestMethod -Headers $UA -TimeoutSec 60 $url } catch { Start-Sleep -Seconds (4 * $try) }
  }
  throw "Abbruch: $url"
}
$TOP5 = @{ ENG = 'Premier League'; ESP = 'LaLiga'; ITA = 'Serie A'; GER = 'Bundesliga'; FRA = 'Ligue 1' }
$dataDir = Split-Path $OutFile
$cfg = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'extra-players.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$hist = [IO.File]::ReadAllText((Join-Path $dataDir 'history.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$cl = [IO.File]::ReadAllText((Join-Path $dataDir 'players.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$clIds = @{}; foreach ($p in $cl) { $clIds[$p.id] = $true }
$tmIdsFile = Join-Path $CacheDir 'tm-ids.json'
$tmIds = if (Test-Path $tmIdsFile) { [IO.File]::ReadAllText($tmIdsFile, [Text.Encoding]::UTF8) | ConvertFrom-Json } else { $null }

# Transfermarkt players.csv (Groesse, Fuss, Position)
$tmCsv = Join-Path $CacheDir 'tm\players.csv'
if (-not (Test-Path $tmCsv)) {
  New-Item -ItemType Directory -Force (Split-Path $tmCsv) | Out-Null
  Invoke-WebRequest 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz' -OutFile "$tmCsv.gz"
  $in = [IO.File]::OpenRead("$tmCsv.gz"); $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
  $out = [IO.File]::Create($tmCsv); $gz.CopyTo($out); $out.Close(); $gz.Close(); $in.Close()
}
$tm = @{}; Get-Content $tmCsv -Encoding UTF8 | ConvertFrom-Csv | ForEach-Object { $tm[$_.player_id] = $_ }
$footMap = @{ right = 'R'; left = 'L'; both = 'B' }

# Pageviews (12 Monate, en + de)
$end = (Get-Date -Day 1).AddDays(-1); $start = $end.AddMonths(-11)
$from = $start.ToString('yyyyMM') + '01'; $to = $end.ToString('yyyyMMdd')
function Get-Views($project, $title) {
  if (-not $title) { return 0 }
  try {
    $t = [uri]::EscapeDataString(($title -replace ' ', '_'))
    $r = Invoke-Api "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/$project/all-access/user/$t/monthly/$from/$to"
    return [int](($r.items | Measure-Object views -Sum).Sum)
  } catch { return 0 }
}

$result = New-Object System.Collections.ArrayList
foreach ($e in $cfg.players) {
  $hp = @($hist.players | Where-Object { if ($e.id) { $_.id -eq $e.id } else { $_.name -eq $e.name } })   # optional "id" bei mehrdeutigen Namen
  if ($hp.Count -ne 1) { Write-Host "Uebersprungen (nicht eindeutig in history.json): $($e.name) [$($hp.Count)]"; continue }
  $p = $hp[0]
  if ($clIds[$p.id]) { Write-Host "Schon in der Champions League: $($e.name)"; continue }
  $t = if ($tmIds -and $tmIds.($p.id)) { $tm["$($tmIds.($p.id))"] } else { $null }
  $sl = (Invoke-Api "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$($p.id)&props=sitelinks&sitefilter=enwiki|dewiki&format=json").entities.($p.id).sitelinks
  $views = (Get-Views 'en.wikipedia' $sl.enwiki.title) + (Get-Views 'de.wikipedia' $sl.dewiki.title)
  $dob = if ($t -and $t.date_of_birth) { $t.date_of_birth.Substring(0, 10) } else { $p.dob }
  [void]$result.Add([ordered]@{
    id = $p.id; name = $p.name; club = $e.club
    league = $(if ($TOP5[$e.country]) { $TOP5[$e.country] } else { 'Andere' }); leagueCountry = $e.country
    nationality = $p.nat; positions = @($p.pos); birthDate = $dob
    heightCm = $(if ($t -and $t.height_in_cm) { [int]$t.height_in_cm } else { $null })
    foot = $(if ($t) { $footMap[$t.foot] } else { $null }); number = $e.number
    subPosition = $(if ($t) { $t.sub_position } else { $null }); pageviews = $views
  })
  Write-Host ("{0,-26} {1,-22} {2,10:N0} Aufrufe, {3} cm, Fuss {4}" -f $p.name, $e.club, $views, $result[-1].heightCm, $result[-1].foot)
}
[IO.File]::WriteAllText($OutFile, (ConvertTo-Json @($result) -Depth 4 -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Extras: $($result.Count)"
