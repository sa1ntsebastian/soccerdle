# Soccerdle - Daten-Import (nur kostenlose Quellen)
#
#   Wikipedia      Teilnehmer der CL-Ligaphase, Kader (Nummer, Position, sportl. Nationalitaet)
#   Wikidata       Transfermarkt-ID (Verknuepfung) + Ersatzwerte fuer Geburtsdatum/Groesse
#   transfermarkt-datasets   Fuss, Groesse, Geburtsdatum, Detailposition (Stand Juli 2026)
#   Wikimedia Pageviews      Bekanntheit (en + de, 12 Monate, zwischengespeichert)
#
# Aufruf:  $env:SOCCERDLE_CONTACT = "mail oder url";  .\pipeline\build.ps1
param(
  [string]$Competition = '2026–27 UEFA Champions League league phase',
  [string]$CacheDir    = "$PSScriptRoot\..\.cache",
  [string]$OutFile     = "$PSScriptRoot\..\data\players.json",
  [string[]]$OnlyClubs = @(),  # z. B. -OnlyClubs 'LASK','Arsenal F.C.' zum Testen
  [switch]$SkipPageviews        # schneller Probelauf ohne Bekanntheit
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir)
$OutFile  = [IO.Path]::GetFullPath($OutFile)

# Kontakt fuer Wikimedia (User-Agent): Umgebungsvariable oder lokale Datei pipeline/contact.local.txt (wird nicht hochgeladen)
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.2 ($contact)" }

function Invoke-Api($url) {
  for ($try = 1; $try -le 6; $try++) {
    Start-Sleep -Milliseconds 250
    try { return Invoke-RestMethod -Headers $UA $url }
    catch {
      $code = $_.Exception.Response.StatusCode.value__
      if ($code -ne 429 -and $code -lt 500) { throw }
      Start-Sleep -Seconds (5 * $try)
    }
  }
  throw "Abbruch nach 6 Versuchen: $url"
}
function Get-Wikitext($title) {
  $t = [uri]::EscapeDataString(($title -replace ' ', '_'))
  (Invoke-Api "https://en.wikipedia.org/w/api.php?action=parse&page=$t&prop=wikitext&format=json&formatversion=2&redirects=1").parse.wikitext
}
function Write-Utf8($path, $text) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false))
}

# Liga: nur Top-5 mit Namen, alles andere "Andere" (Land wird trotzdem gespeichert)
$TOP5 = @{ ENG = 'Premier League'; ESP = 'LaLiga'; ITA = 'Serie A'; GER = 'Bundesliga'; FRA = 'Ligue 1' }

# Wikipedia nutzt teils abweichende Codes -> auf FIFA-Code vereinheitlichen
$NAT_ALIAS = @{ KOS = 'KVX'; NGR = 'NGA'; ROM = 'ROU'; SLO = 'SVN'; SPA = 'ESP' }

# ---------- 1. Teilnehmer ----------
$w = Get-Wikitext $Competition
$sec = $w.Substring($w.IndexOf('==Teams and seeding=='))
$sec = $sec.Substring(0, $sec.IndexOf("`n==", 5))
$clubs = foreach ($m in [regex]::Matches($sec, 'fbaicon\|(\w+)\}\}\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')) {
  $code = $m.Groups[1].Value
  [ordered]@{
    country = $code
    wiki    = $m.Groups[2].Value
    name    = $(if ($m.Groups[3].Success) { $m.Groups[3].Value } else { $m.Groups[2].Value })
    league  = $(if ($TOP5[$code]) { $TOP5[$code] } else { 'Andere' })
  }
}
if ($OnlyClubs.Count) { $clubs = @($clubs | Where-Object { $_.wiki -in $OnlyClubs -or $_.name -in $OnlyClubs }) }
Write-Host "Teilnehmer: $(@($clubs).Count)"

# ---------- 2. Kader aus Wikipedia ----------
$squadTpl = '\{\{\s*(?:[Ff]s player|[Ff]ootball squad player)\s*\|(.*?)\}\}'
$players = New-Object System.Collections.ArrayList
$clubReport = @()
foreach ($c in $clubs) {
  $w = Get-Wikitext $c.wiki
  $section = ''; $count = 0
  foreach ($line in $w -split "`n") {
    if ($line -match '^(=+)\s*(.+?)\s*\1\s*$') { $section = $matches[2]; continue }
    $isSquad = $section -match '(?i)squad|players|first[- ]team' -and
               $section -notmatch '(?i)loan|reserve|academy|youth|junior|\bII\b|\bB\b|women|former|retired|campus|notable|records|u-?\d\d|under-'
    if (-not $isSquad) { continue }
    foreach ($m in [regex]::Matches($line, $squadTpl)) {
      $f = @{}
      foreach ($part in ($m.Groups[1].Value -replace '\[\[([^|\]]*)\|([^\]]*)\]\]', '[[$1@@$2]]') -split '\|') {
        if ($part -match '^\s*(\w+)\s*=\s*(.*)$') { $f[$matches[1]] = $matches[2].Trim() }
      }
      $link = [regex]::Match([string]$f['name'], '\[\[([^@\]]+)(?:@@([^\]]+))?\]\]')
      if (-not $link.Success) { continue }   # Spieler ohne Wikipedia-Artikel -> zu unbekannt
      [void]$players.Add([ordered]@{
        wikiTitle = $link.Groups[1].Value
        name      = $(if ($link.Groups[2].Success) { $link.Groups[2].Value } else { $link.Groups[1].Value })
        club      = $c.name
        league    = $c.league
        leagueCountry = $c.country
        number    = $(if ($f['no'] -match '^\d+$') { [int]$f['no'] } else { $null })
        wikiPos   = $f['pos']
        nat       = $(if ($NAT_ALIAS[$f['nat']]) { $NAT_ALIAS[$f['nat']] } else { $f['nat'] })
      })
      $count++
    }
  }
  $clubReport += "{0,-28} {1,3}" -f $c.name, $count
}
Write-Host "Spieler aus Kadern: $($players.Count)"

# ---------- 3. Wikidata ----------
$titles = @($players | ForEach-Object { $_.wikiTitle } | Sort-Object -Unique)
$qidByTitle = @{}
for ($i = 0; $i -lt $titles.Count; $i += 50) {
  $batch = ($titles[$i..([Math]::Min($i + 49, $titles.Count - 1))] | ForEach-Object { [uri]::EscapeDataString($_) }) -join '|'
  $r = Invoke-Api "https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=$batch"
  $back = @{}
  foreach ($x in @($r.query.normalized) + @($r.query.redirects)) { if ($x) { $back[$x.to] = $x.from } }
  foreach ($pg in $r.query.pages) {
    $q = $pg.pageprops.wikibase_item; if (-not $q) { continue }
    $t = $pg.title; $qidByTitle[$t] = $q
    $guard = 0; while ($back.ContainsKey($t) -and $guard++ -lt 5) { $t = $back[$t]; $qidByTitle[$t] = $q }
  }
}
$wd = @{}
$qids = @($qidByTitle.Values | Sort-Object -Unique)
for ($i = 0; $i -lt $qids.Count; $i += 50) {
  $batch = $qids[$i..([Math]::Min($i + 49, $qids.Count - 1))] -join '|'
  $r = Invoke-Api "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$batch&props=claims|sitelinks&sitefilter=dewiki&format=json"
  foreach ($e in $r.entities.PSObject.Properties) {
    $cl = $e.Value.claims
    $info = @{ tmId = $null; dob = $null; height = $null; deTitle = $null }
    if ($cl.P2446) { $info.tmId = $cl.P2446[0].mainsnak.datavalue.value }
    if ($cl.P569 -and $cl.P569[0].mainsnak.datavalue) { $info.dob = $cl.P569[0].mainsnak.datavalue.value.time.Substring(1, 10) }
    if ($cl.P2048 -and $cl.P2048[0].mainsnak.datavalue) {
      $v = $cl.P2048[0].mainsnak.datavalue.value
      $amt = [double]::Parse($v.amount.TrimStart('+'), [Globalization.CultureInfo]::InvariantCulture)
      if ($v.unit -like '*Q11573') { $amt *= 100 }          # Meter -> cm
      if ($amt -gt 140 -and $amt -lt 220) { $info.height = [int][Math]::Round($amt) }
    }
    if ($e.Value.sitelinks.dewiki) { $info.deTitle = $e.Value.sitelinks.dewiki.title }
    $wd[$e.Name] = $info
  }
}

# ---------- 4. Transfermarkt-Datensatz ----------
$tmDir = Join-Path $CacheDir 'tm'
$tmCsv = Join-Path $tmDir 'players.csv'
if (-not (Test-Path $tmCsv)) {
  New-Item -ItemType Directory -Force $tmDir | Out-Null
  Write-Host 'Lade transfermarkt-datasets ...'
  Invoke-WebRequest 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/players.csv.gz' -OutFile "$tmCsv.gz"
  $in = [IO.File]::OpenRead("$tmCsv.gz"); $gz = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress)
  $out = [IO.File]::Create($tmCsv); $gz.CopyTo($out); $out.Close(); $gz.Close(); $in.Close()
}
$tm = @{}
Get-Content $tmCsv -Encoding UTF8 | ConvertFrom-Csv | ForEach-Object { $tm[$_.player_id] = $_ }

# ---------- 5. Pageviews (mit Cache) ----------
$end = (Get-Date -Day 1).AddDays(-1); $start = $end.AddMonths(-11)
$from = $start.ToString('yyyyMM') + '01'; $to = $end.ToString('yyyyMMdd')
$pvFile = Join-Path $CacheDir "pageviews-$from-$to.json"
$pv = @{}
if (Test-Path $pvFile) {
  ([IO.File]::ReadAllText($pvFile) | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $pv[$_.Name] = [int]$_.Value }
}
$pvNew = 0
function Get-Views($project, $title) {
  if (-not $title -or $SkipPageviews) { return 0 }
  $key = "$project|$title"
  if ($pv.ContainsKey($key)) { return $pv[$key] }
  Start-Sleep -Milliseconds 400
  try {
    $t = [uri]::EscapeDataString(($title -replace ' ', '_'))
    $r = Invoke-Api "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/$project/all-access/user/$t/monthly/$from/$to"
    $v = [int](($r.items | Measure-Object views -Sum).Sum)
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -ne 404) { Write-Host "  Pageviews fehlgeschlagen ($code): $key"; return 0 }   # nicht cachen, naechstes Mal erneut
    $v = 0
  }
  $script:pv[$key] = $v
  $script:pvNew++
  if ($script:pvNew % 50 -eq 0) {
    Write-Utf8 $pvFile ($script:pv | ConvertTo-Json -Compress)
    Write-Host "  Pageviews: $($script:pvNew) neu abgefragt ..."
  }
  return $v
}

# ---------- 6. Zusammenfuehren ----------
$posMap   = @{ GK = 'TW'; DF = 'ABW'; MF = 'MF'; FW = 'ST' }
$tmPosMap = @{ Goalkeeper = 'TW'; Defender = 'ABW'; Midfield = 'MF'; Attack = 'ST' }
$footMap  = @{ right = 'R'; left = 'L'; both = 'B' }
$seen = @{}
$result = New-Object System.Collections.ArrayList
foreach ($p in $players) {
  $qid = $qidByTitle[$p.wikiTitle]
  $key = if ($qid) { $qid } else { $p.wikiTitle }
  if ($seen.ContainsKey($key)) { continue }   # doppelt gelistet
  $seen[$key] = $true
  $d = if ($qid) { $wd[$qid] } else { $null }
  $t = if ($d -and $d.tmId) { $tm[$d.tmId] } else { $null }
  $pos = @()
  if ($posMap[$p.wikiPos]) { $pos += $posMap[$p.wikiPos] }
  if ($t -and $tmPosMap[$t.position] -and $tmPosMap[$t.position] -notin $pos) { $pos += $tmPosMap[$t.position] }
  $dob = if ($t -and $t.date_of_birth) { $t.date_of_birth.Substring(0, 10) } elseif ($d) { $d.dob } else { $null }
  $height = if ($t -and $t.height_in_cm) { [int]$t.height_in_cm } elseif ($d) { $d.height } else { $null }
  [void]$result.Add([ordered]@{
    id            = $key
    name          = $p.name
    club          = $p.club
    league        = $p.league
    leagueCountry = $p.leagueCountry
    nationality   = $p.nat
    positions     = $pos
    birthDate     = $dob
    heightCm      = $height
    foot          = $(if ($t) { $footMap[$t.foot] } else { $null })
    number        = $p.number
    subPosition   = $(if ($t) { $t.sub_position } else { $null })
    pageviews     = (Get-Views 'en.wikipedia' $p.wikiTitle) + (Get-Views 'de.wikipedia' $(if ($d) { $d.deTitle }))
    tmId          = $(if ($d) { $d.tmId } else { $null })
    wikiTitle     = $p.wikiTitle
  })
}
Write-Utf8 $pvFile ($pv | ConvertTo-Json -Compress)
$result = @($result | Sort-Object { -$_.pageviews })
Write-Utf8 $OutFile (ConvertTo-Json @($result) -Depth 5)

# ---------- 7. Bericht ----------
$n = $result.Count
$report = @("=== Soccerdle Import $(Get-Date -Format 'yyyy-MM-dd HH:mm') ===", "Spieler: $n", '', 'Kader pro Verein:') + $clubReport + @('', 'Fehlende Werte:')
foreach ($f in 'nationality', 'positions', 'birthDate', 'heightCm', 'foot', 'number', 'tmId') {
  $missing = @($result | Where-Object { -not $_[$f] -or ($_[$f] -is [array] -and $_[$f].Count -eq 0) })
  $report += "{0,-12} {1,4}/{2} gefuellt   {3}" -f $f, ($n - $missing.Count), $n, ((@($missing | Select-Object -First 15) | ForEach-Object { "$($_.name) ($($_.club))" }) -join ', ')
}
$report += '', "Zweitposition erkannt: $(@($result | Where-Object { $_.positions.Count -gt 1 }).Count)"
$codes = @($result | ForEach-Object { $_.nationality } | Sort-Object -Unique)
$report += "Nationalitaeten-Codes: $($codes -join ' ')"
$report += '', 'Top 20 nach Bekanntheit:'
$report += @($result | Select-Object -First 20 | ForEach-Object { "  {0,-26} {1,-22} {2,12:N0}" -f $_.name, $_.club, $_.pageviews })
$reportText = $report -join "`n"
Write-Utf8 (Join-Path (Split-Path $OutFile) 'report.txt') $reportText
Write-Host $reportText

# ---------- 8. Fuer das Spiel exportieren ----------
if ($SkipPageviews) { Write-Host 'Probelauf: web/data/players.js NICHT ueberschrieben' } else { & "$PSScriptRoot\export-web.ps1" -InFile $OutFile }
