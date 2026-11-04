# Soccerdle - Aufstellungen legendaerer Spiele (fuer "Wer fehlt")
# Quelle: Wikipedia-Artikel der Finalspiele (Abschnitt "Details": Football box + Aufstellungstabellen)
param(
  [string]$OutFile = "$PSScriptRoot\..\data\lineups.json"
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

# ---------- Spiele ----------
$games = @()
foreach ($y in 1993..2026) { $games += @{ title = "$y UEFA Champions League final"; comp = 'Champions-League-Finale'; year = $y } }
foreach ($y in 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022) { $games += @{ title = "$y FIFA World Cup final"; comp = 'WM-Finale'; year = $y } }
foreach ($y in 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2024) { $games += @{ title = "UEFA Euro $y final"; comp = 'EM-Finale'; year = $y } }
$games += @{ title = 'Brazil v Germany (2014 FIFA World Cup)'; comp = 'WM-Halbfinale'; year = 2014 }

$ROW_RX = '^\|\s*([A-Z]{2,3})\s*\|\|\s*''''''(\d+)\s*''''''\s*\|\|(.*)$'
$out = New-Object System.Collections.ArrayList
$problems = @()
foreach ($m in $games) {
  $t = [uri]::EscapeDataString(($m.title -replace ' ', '_'))
  try { $w = (Invoke-Api "https://en.wikipedia.org/w/api.php?action=parse&page=$t&prop=wikitext&format=json&formatversion=2&redirects=1").parse.wikitext }
  catch { $problems += "$($m.title): Artikel nicht gefunden"; continue }

  # Football box: Teams, Ergebnis, Datum, Stadion
  # (falls keine Football box: Infobox football match)
  $box = [regex]::Match($w, '(?is)\{\{\s*Football ?box(.*?)\n\}\}').Groups[1].Value
  if (-not $box) { $box = [regex]::Match($w, '(?is)\{\{\s*Infobox football match(.*?)\n\}\}').Groups[1].Value }
  # Felder im ganzen Artikel suchen (Infobox und Football box haben teils unterschiedliche Felder)
  function FieldAll($name) { @([regex]::Matches($w, "(?m)^\s*\|\s*$name\s*=\s*(.*)$") | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ }) }
  function Field($name) { $v = [regex]::Match($box, "\|\s*$name\s*=\s*(.*)").Groups[1].Value.Trim(); if ($v) { $v } else { @(FieldAll $name)[0] } }
  function LinkText($s) { $l = [regex]::Match($s, '\[\[([^\]|]+)(?:\|([^\]]+))?\]\]'); if ($l.Groups[2].Success) { $l.Groups[2].Value } else { $l.Groups[1].Value } }
  # Team: Nationalteam (Flaggen-Vorlage oder "... national football team") -> "@CODE", sonst Vereinsname
  function TeamName($name) {
    $vals = @(FieldAll $name)
    foreach ($s in $vals) {
      $fb = [regex]::Match($s, '\{\{\s*fb(?:-rt)?\|([A-Z]{3})')                       # {{fb|ARG}}, {{fb-rt|GER|1990}}
      if (-not $fb.Success) { $fb = [regex]::Match($s, '\bfb(?:-rt)?\|(?:[^}]*\|)?([A-Z]{3})\s*\}\}') }  # {{#invoke:flag|fb-rt|ESP}}, avar=fb|ARG
      if ($fb.Success) { return '@' + $fb.Groups[1].Value }
    }
    foreach ($s in $vals) { if ($s -match '\[\[' -and $s -notmatch 'national football team') { return LinkText $s } }
    return $null
  }
  $team1 = TeamName 'team1'; $team2 = TeamName 'team2'
  $rawScore = Field 'score'
  $sl = [regex]::Match($rawScore, '\{\{\s*score link\|[^|]*\|([^|}]+)')
  if ($sl.Success) { $rawScore = $sl.Groups[1].Value }
  $score = $rawScore -replace '\[\[[^\]|]*\|([^\]]*)\]\]', '$1' -replace '\[\[([^\]]*)\]\]', '$1' -replace '<[^>]+>', '' -replace '\{\{[^}]*\}\}', ''
  if ((Field 'aet') -match 'yes') { $score += ' n. V.' }
  $stadium = LinkText (Field 'stadium')
  $penalties = (Field 'penaltyscore') -replace '<[^>]+>', ''

  # Aufstellungen: Startelf je Team, bis "Substitutes"; "Manager" beendet ein Team
  $teams = @(@(), @()); $ti = 0; $starting = $true
  $start = [regex]::Match($w, '(?i)\{\{\s*football ?box').Index
  foreach ($line in ($w.Substring([Math]::Max(0, $start)) -split "`n")) {
    if ($ti -gt 1) { break }
    if ($line -match "(?i)'''\s*substitut") { $starting = $false; continue }
    if ($line -match "(?i)'''\s*(manager|head coach|coach)") { if (-not $starting -or $teams[$ti].Count -ge 11) { $ti++; $starting = $true }; continue }
    if (-not $starting) { continue }
    $line = $line -replace '\{\{abbr\|([A-Z]{2,3})\|[^}]*\}\}', '$1'   # {{abbr|RB|Right-back}} -> RB
    $r = [regex]::Match($line, $ROW_RX)
    if (-not $r.Success) { continue }
    $link = [regex]::Match($r.Groups[3].Value, '\[\[([^\]|]+)(?:\|([^\]]+))?\]\]')
    if (-not $link.Success) { continue }
    $flag = [regex]::Match($r.Groups[3].Value, '\{\{flagicon\|([A-Z]{3})').Groups[1].Value
    $teams[$ti] += , ([ordered]@{
      pos = $r.Groups[1].Value; no = [int]$r.Groups[2].Value
      title = $link.Groups[1].Value
      name = $(if ($link.Groups[2].Success) { $link.Groups[2].Value } else { $link.Groups[1].Value })
      nat = $flag
    })
  }
  if ($teams[0].Count -ne 11 -or $teams[1].Count -ne 11) { $problems += "$($m.title): Startelf $($teams[0].Count)/$($teams[1].Count)"; continue }
  [void]$out.Add([ordered]@{
    id = ($m.title -replace '[^A-Za-z0-9]+', '-').ToLower().Trim('-')
    comp = $m.comp; year = $m.year; title = $m.title
    team1 = $team1; team2 = $team2; score = $score.Trim(); penalties = $penalties.Trim(); stadium = $stadium
    lineup1 = $teams[0]; lineup2 = $teams[1]
  })
}

# ---------- Wikidata-IDs der Spieler (fuer Abgleich mit der Spieler-Datenbank) ----------
$titles = @($out | ForEach-Object { $_.lineup1 + $_.lineup2 } | ForEach-Object { $_.title } | Sort-Object -Unique)
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
foreach ($mm in $out) { foreach ($p in $mm.lineup1 + $mm.lineup2) { $p.id = $qid[$p.title] } }

New-Item -ItemType Directory -Force (Split-Path $OutFile) | Out-Null
[IO.File]::WriteAllText($OutFile, (ConvertTo-Json @($out) -Depth 6 -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Spiele mit vollstaendiger Aufstellung: $($out.Count) von $($games.Count)"
Write-Host "Spieler ohne Wikidata-ID: $(@($out | ForEach-Object { $_.lineup1 + $_.lineup2 } | Where-Object { -not $_.id }).Count)"
if ($problems) { Write-Host "Probleme:"; $problems | ForEach-Object { Write-Host "  $_" } }
