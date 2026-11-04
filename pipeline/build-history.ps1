# Soccerdle - historische Spieler-Datenbank (Wikidata, CC0)
# Grundlage fuer Karriereweg, 3x3-Raster, Mitspieler und "Wer fehlt".
#
#   1. Liste bekannter Fussballer (>= MinSitelinks Wikipedia-Sprachversionen)
#   2. Details je Spieler (Name, Geburt, Nation, Position, Vereinsstationen mit Jahren)
#   3. Vereine + Laender (Name, Typ -> Nationalteams/Jugend raus, FIFA-Code)
#
# Rohdaten werden in .cache/wd/ zwischengespeichert -> erneuter Lauf ist schnell.
param(
  [int]$MinSitelinks = 25,
  [string]$CacheDir  = "$PSScriptRoot\..\.cache\wd",
  [string]$OutFile   = "$PSScriptRoot\..\data\history.json",
  [switch]$Refresh   # Cache ignorieren und alles neu laden
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir); $OutFile = [IO.Path]::GetFullPath($OutFile)
New-Item -ItemType Directory -Force $CacheDir | Out-Null

$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($contact)" }

function Invoke-Api($url, $headers = $UA) {
  for ($try = 1; $try -le 6; $try++) {
    Start-Sleep -Milliseconds 200
    try { return Invoke-RestMethod -Headers $headers -TimeoutSec 120 $url }
    catch {
      $code = $_.Exception.Response.StatusCode.value__
      if ($code -and $code -ne 429 -and $code -lt 500) { throw }
      Start-Sleep -Seconds (5 * $try)
    }
  }
  throw "Abbruch nach 6 Versuchen: $url"
}
function Write-Utf8($path, $text) {
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false))
}
function Read-Json($path) { [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json }

# Laedt Wikidata-Entitaeten in 50er-Bloecken, mit Datei-Cache pro Block
function Get-Entities([string[]]$ids, [string]$props, [string]$tag) {
  $all = @{}
  $ids = @($ids | Sort-Object -Unique)
  for ($i = 0; $i -lt $ids.Count; $i += 50) {
    $batch = $ids[$i..([Math]::Min($i + 49, $ids.Count - 1))]
    $key = '{0}-{1:D5}' -f $tag, ($i / 50)
    $file = Join-Path $CacheDir "$key.json"
    if ((Test-Path $file) -and -not $Refresh) { $r = Read-Json $file }
    else {
      $r = Invoke-Api "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$($batch -join '|')&props=$props&languages=de|en&format=json"
      Write-Utf8 $file ($r | ConvertTo-Json -Depth 30 -Compress)
    }
    foreach ($e in $r.entities.PSObject.Properties) { $all[$e.Name] = $e.Value }
    if (($i / 50) % 20 -eq 0) { Write-Host "  $tag : $([Math]::Min($i + 50, $ids.Count)) / $($ids.Count)" }
  }
  return $all
}
function Get-Label($e) {
  if ($e.labels.de) { return $e.labels.de.value }
  if ($e.labels.en) { return $e.labels.en.value }
  return $null
}
function Get-Year($snak) {
  if (-not $snak -or -not $snak.datavalue) { return $null }
  return [int]$snak.datavalue.value.time.Substring(1, 4)
}
function Get-ItemIds($claims, $prop) {
  @($claims.$prop | Where-Object { $_.rank -ne 'deprecated' -and $_.mainsnak.datavalue } | ForEach-Object { $_.mainsnak.datavalue.value.id })
}

# ---------- 1. Liste bekannter Fussballer ----------
$listFile = Join-Path $CacheDir "list-$MinSitelinks.json"
if ((Test-Path $listFile) -and -not $Refresh) { $list = Read-Json $listFile }
else {
  Write-Host "SPARQL: Fussballer mit >= $MinSitelinks Sprachversionen ..."
  $q = "SELECT ?p ?sl WHERE { ?p wikibase:sitelinks ?sl . FILTER(?sl >= $MinSitelinks) ?p wdt:P106 wd:Q937857 . }"
  $h = $UA.Clone(); $h['Accept'] = 'application/sparql-results+json'
  $r = Invoke-Api "https://query.wikidata.org/sparql?query=$([uri]::EscapeDataString($q))" $h
  $list = @($r.results.bindings | ForEach-Object { [ordered]@{ id = ($_.p.value -split '/')[-1]; sl = [int]$_.sl.value } })
  Write-Utf8 $listFile (ConvertTo-Json @($list) -Compress)
}
$slById = @{}; foreach ($x in $list) { $slById[$x.id] = [int]$x.sl }
Write-Host "Spieler in Liste: $($slById.Count)"

# ---------- 2. Spieler-Details ----------
$players = Get-Entities @($slById.Keys) 'labels|claims' 'p'

# ---------- 3. Vereine + Laender ----------
$clubIds = New-Object System.Collections.Generic.HashSet[string]
$countryIds = New-Object System.Collections.Generic.HashSet[string]
foreach ($e in $players.Values) {
  foreach ($c in $e.claims.P54) { if ($c.mainsnak.datavalue) { [void]$clubIds.Add($c.mainsnak.datavalue.value.id) } }
  foreach ($id in @(Get-ItemIds $e.claims 'P1532') + @(Get-ItemIds $e.claims 'P27')) { [void]$countryIds.Add($id) }
}
Write-Host "Vereine/Teams: $($clubIds.Count), Laender: $($countryIds.Count)"
$clubs = Get-Entities @($clubIds) 'labels|claims' 'c'
$countries = Get-Entities @($countryIds) 'labels|claims' 'n'

# Laender -> FIFA-Code (P3441)
$fifaByCountry = @{}
foreach ($kv in $countries.GetEnumerator()) {
  $code = @($kv.Value.claims.P3441 | ForEach-Object { $_.mainsnak.datavalue.value })[0]
  if (-not $code) { $code = @($kv.Value.claims.P984 | ForEach-Object { $_.mainsnak.datavalue.value })[0] }   # IOC-Code als Ersatz
  if ($code) { $fifaByCountry[$kv.Key] = $code }
}

# Vereins-Filter: Nationalteams, Jugend-/Reserveteams raus
$NATIONAL_TYPES = @('Q6979593', 'Q1194951', 'Q23759293', 'Q23905105', 'Q28140340', 'Q23901137', 'Q23847779', 'Q23901123')
$YOUTH_RX = '(?i)\b(U-?\s?\d{2}|II|III|B|C|Jugend|Youth|Juvenil|Primavera|Reserves?|Amateure|Academy|Akademie|Jong|Castilla|Atlètic|Next Gen)\b|(-?\s?(Sub|U)\s?\d{2})'
$clubInfo = @{}
foreach ($kv in $clubs.GetEnumerator()) {
  $e = $kv.Value
  $types = Get-ItemIds $e.claims 'P31'
  $name = Get-Label $e
  if (-not $name) { continue }
  $isNational = @($types | Where-Object { $_ -in $NATIONAL_TYPES }).Count -gt 0 -or $name -match '(?i)nationalmannschaft|national (football )?team|olympi'
  $isYouth = $name -match $YOUTH_RX
  $country = @(Get-ItemIds $e.claims 'P17')[0]
  $clubInfo[$kv.Key] = [ordered]@{ name = $name; national = $isNational; youth = $isYouth; country = $(if ($country) { $fifaByCountry[$country] }) }
}

# Positionen (Wikidata-Items -> TW/ABW/MF/ST), inkl. haeufiger Unterpositionen
$POS_MAP = @{
  Q201330 = 'TW'
  Q336286 = 'ABW'; Q1059153 = 'ABW'; Q2128928 = 'ABW'; Q1373542 = 'ABW'; Q1196129 = 'ABW'; Q4794193 = 'ABW'; Q1145313 = 'ABW'; Q5141364 = 'ABW'
  Q193592 = 'MF'; Q1756136 = 'MF'; Q9049206 = 'MF'; Q12382049 = 'MF'; Q1150286 = 'MF'; Q16951015 = 'MF'; Q192548 = 'MF'
  Q280658 = 'ST'; Q2006016 = 'ST'; Q1152519 = 'ST'; Q694589 = 'ST'
}

# ---------- 4. Zusammenbauen ----------
$out = New-Object System.Collections.ArrayList
$usedClubs = @{}
foreach ($kv in $players.GetEnumerator()) {
  $e = $kv.Value; $c = $e.claims
  $name = Get-Label $e
  if (-not $name) { continue }
  $dobSnak = @($c.P569 | Where-Object { $_.rank -ne 'deprecated' })[0]
  $dob = if ($dobSnak -and $dobSnak.mainsnak.datavalue) { $dobSnak.mainsnak.datavalue.value.time.Substring(1, 10) } else { $null }
  $natQ = @(Get-ItemIds $c 'P1532') + @(Get-ItemIds $c 'P27') | Where-Object { $fifaByCountry[$_] } | Select-Object -First 1
  $pos = @(Get-ItemIds $c 'P413' | ForEach-Object { $POS_MAP[$_] } | Where-Object { $_ } | Sort-Object -Unique)

  $career = foreach ($st in @($c.P54 | Where-Object { $_.rank -ne 'deprecated' -and $_.mainsnak.datavalue })) {
    $club = $st.mainsnak.datavalue.value.id
    $ci = $clubInfo[$club]
    if (-not $ci -or $ci.national -or $ci.youth) { continue }
    $from = Get-Year @($st.qualifiers.P580)[0]
    $to   = Get-Year @($st.qualifiers.P582)[0]
    $loan = @($st.qualifiers.P1642 | Where-Object { $_.datavalue.value.id -eq 'Q2914547' }).Count -gt 0
    $usedClubs[$club] = $true
    [ordered]@{ c = $club; f = $from; t = $to; l = $(if ($loan) { 1 } else { 0 }) }
  }
  $career = @($career | Sort-Object { if ($_.f) { $_.f } else { 9999 } })
  if ($career.Count -eq 0) { continue }

  [void]$out.Add([ordered]@{
    id = $kv.Key; name = $name; dob = $dob
    nat = $(if ($natQ) { $fifaByCountry[$natQ] } else { $null })
    pos = $pos; sl = $slById[$kv.Key]; career = $career
  })
}
$clubOut = [ordered]@{}
foreach ($id in $usedClubs.Keys) { $clubOut[$id] = [ordered]@{ name = $clubInfo[$id].name; country = $clubInfo[$id].country } }

$result = [ordered]@{ generated = (Get-Date -Format 'yyyy-MM-dd'); players = @($out | Sort-Object { -$_.sl }); clubs = $clubOut }
Write-Utf8 $OutFile ($result | ConvertTo-Json -Depth 8 -Compress)

# ---------- 5. Bericht ----------
$n = $out.Count
$withYears = @($out | Where-Object { @($_.career | Where-Object { $_.f }).Count -eq $_.career.Count }).Count
Write-Host "`n=== Historische Datenbank ==="
Write-Host "Spieler mit Vereinsstationen: $n"
Write-Host "  davon alle Stationen mit Startjahr: $withYears"
Write-Host "  mit Nation: $(@($out | Where-Object { $_['nat'] }).Count) · mit Position: $(@($out | Where-Object { @($_['pos']).Count -gt 0 }).Count) · mit Geburtsdatum: $(@($out | Where-Object { $_['dob'] }).Count)"
Write-Host "Vereine: $($clubOut.Count)"
Write-Host "Datei: $OutFile ($([Math]::Round((Get-Item $OutFile).Length / 1MB, 1)) MB)"
