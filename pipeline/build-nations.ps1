# Soccerdle - Turnierkader der Nationalteams (WM 1990-2022, EM 1992-2024) fuer den Draft
# Quelle: Wikipedia-Artikel "<Jahr> FIFA World Cup squads" / "UEFA Euro <Jahr> squads"
# Ergebnis: data/nations.json  [{ comp, year, team (Ueberschrift), ids = Wikidata-IDs }]
# Das Land (FIFA-Code) wird erst in export-modes.ps1 aus der Nationalitaet der Spieler bestimmt.
param(
  [string]$OutFile = "$PSScriptRoot\..\data\nations.json"
)
$ErrorActionPreference = 'Stop'
$OutFile = [IO.Path]::GetFullPath($OutFile)
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($contact)" }

function Invoke-Api($url) {
  for ($try = 1; $try -le 6; $try++) {
    Start-Sleep -Milliseconds 300
    try { return Invoke-RestMethod -Headers $UA -TimeoutSec 60 $url }
    catch {
      $code = $_.Exception.Response.StatusCode.value__
      if ($code -and $code -ne 429 -and $code -lt 500) { throw }
      Start-Sleep -Seconds (5 * $try)
    }
  }
  throw "Abbruch: $url"
}

$tournaments = @()
foreach ($y in 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022) { $tournaments += @{ title = "$y FIFA World Cup squads"; comp = 'WM'; year = $y } }
foreach ($y in 1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024) { $tournaments += @{ title = "UEFA Euro $y squads"; comp = 'EM'; year = $y } }

$out = New-Object System.Collections.ArrayList
$problems = @()
foreach ($tn in $tournaments) {
  $t = [uri]::EscapeDataString(($tn.title -replace ' ', '_'))
  try { $w = (Invoke-Api "https://en.wikipedia.org/w/api.php?action=parse&page=$t&prop=wikitext&format=json&formatversion=2&redirects=1").parse.wikitext }
  catch { $problems += "$($tn.title): Artikel nicht gefunden"; continue }

  # Zeilen durchgehen: Ueberschrift (Ebene 3/4) = neues Team, "{{Nat fs g player|...|name=[[Titel|Anzeige]]|...}}" = Spieler
  $teams = New-Object System.Collections.ArrayList
  $cur = $null
  foreach ($ln in ($w -split "`n")) {
    $h = [regex]::Match($ln, '^={3,4}\s*([^=]+?)\s*={3,4}\s*$')
    if ($h.Success) { $cur = [ordered]@{ team = $h.Groups[1].Value; titles = @() }; [void]$teams.Add($cur); continue }
    if (-not $cur) { continue }
    if ($ln -match '(?i)^\s*\{\{\s*(nat fs g player|national football squad player|nat fs player)') {
      $nm = [regex]::Match($ln, '\|\s*name\s*=\s*(?:\{\{[^}]*\}\}\s*)?\[\[([^\]|#]+)')
      if ($nm.Success) { $cur.titles += $nm.Groups[1].Value.Trim() }
      else {
        # name={{sortname|Vorname|Nachname|Zusatz}} (EM 2016 u. a.): Zusatz = Artikeltitel oder dab=...
        $sn = [regex]::Match($ln, '\|\s*name\s*=\s*\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?')
        if ($sn.Success) {
          $base = ("$($sn.Groups[1].Value.Trim()) $($sn.Groups[2].Value.Trim())").Trim()
          $x3 = $sn.Groups[3].Value.Trim()
          $cur.titles += $(if ($x3 -match '^dab\s*=\s*(.+)$') { "$base ($($Matches[1]))" } elseif ($x3 -and $x3 -notmatch '^(nolink|sort|nodab)') { $x3 } else { $base })
        }
      }
    }
  }
  $n = 0
  foreach ($tm in $teams) {
    if ($tm.titles.Count -lt 15) { continue }
    [void]$out.Add([ordered]@{ comp = $tn.comp; year = $tn.year; team = $tm.team; titles = @($tm.titles); ids = @() }); $n++
  }
  Write-Host "$($tn.title): $n Kader"
  if ($n -lt 8) { $problems += "$($tn.title): nur $n Kader erkannt" }
}

# ---------- Wikidata-IDs der Spieler ----------
$titles = @($out | ForEach-Object { $_.titles } | Sort-Object -Unique)
$qid = @{}
for ($i = 0; $i -lt $titles.Count; $i += 50) {
  $batch = ($titles[$i..([Math]::Min($i + 49, $titles.Count - 1))] | ForEach-Object { [uri]::EscapeDataString($_) }) -join '|'
  $r = Invoke-Api "https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&format=json&formatversion=2&titles=$batch"
  $back = @{}; foreach ($x in @($r.query.normalized) + @($r.query.redirects)) { if ($x) { $back[$x.to] = $x.from } }
  foreach ($pg in $r.query.pages) {
    $q = $pg.pageprops.wikibase_item; if (-not $q) { continue }
    $tt = $pg.title; $qid[$tt] = $q; $g = 0
    while ($back.ContainsKey($tt) -and $g++ -lt 5) { $tt = $back[$tt]; $qid[$tt] = $q }
  }
}
foreach ($sq in $out) {
  $sq.ids = @($sq.titles | ForEach-Object { $qid[$_] } | Where-Object { $_ } | Select-Object -Unique)
  $sq.Remove('titles')
}

New-Item -ItemType Directory -Force (Split-Path $OutFile) | Out-Null
[IO.File]::WriteAllText($OutFile, (ConvertTo-Json @($out) -Depth 5 -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Kader gesamt: $($out.Count)"
if ($problems) { Write-Host "Probleme:"; $problems | ForEach-Object { Write-Host "  $_" } }
