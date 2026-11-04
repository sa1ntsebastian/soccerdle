# Soccerdle - England/Schottland/Wales/Nordirland statt "Vereinigtes Koenigreich"
# Wikidata fuehrt viele britische Spieler nur mit Staatsbuergerschaft UK (-> FIFA-Code GBR). Hier wird ueber die
# Mitgliedschaft (P54) in den A-Nationalteams ENG/SCO/WAL/NIR aufgeloest. Ergebnis: data/uk-nations.json { "Q-ID": "ENG" }
# export-modes.ps1 wendet das auf Spieler mit nat = GBR an.
param(
  [string]$HistoryFile = "$PSScriptRoot\..\data\history.json",
  [string]$OutFile = "$PSScriptRoot\..\data\uk-nations.json"
)
$ErrorActionPreference = 'Stop'
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$contact = if ($env:SOCCERDLE_CONTACT) { $env:SOCCERDLE_CONTACT } elseif (Test-Path $contactFile) { (Get-Content $contactFile -TotalCount 1).Trim() } else { 'contact not set' }
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($contact)" }
function Invoke-Api($url) {
  for ($try = 1; $try -le 6; $try++) {
    Start-Sleep -Milliseconds 400
    try { return Invoke-RestMethod -Headers $UA -TimeoutSec 120 $url }
    catch { Start-Sleep -Seconds (5 * $try) }
  }
  throw "Abbruch: $url"
}

# Wikidata-IDs der vier A-Nationalteams ueber die englischen Wikipedia-Titel
$teamTitles = [ordered]@{ ENG = 'England national football team'; SCO = 'Scotland national football team'; WAL = 'Wales national football team'; NIR = 'Northern Ireland national football team' }
$t = ($teamTitles.Values | ForEach-Object { [uri]::EscapeDataString($_) }) -join '|'
$r = Invoke-Api "https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=$t&props=sitelinks&sitefilter=enwiki&format=json"
$teamQ = @{}
foreach ($kv in $r.entities.PSObject.Properties) {
  $e = $kv.Value; if (-not $e.id) { continue }
  foreach ($code in $teamTitles.Keys) { if ($teamTitles[$code] -eq $e.sitelinks.enwiki.title) { $teamQ[$e.id] = $code } }
}
Write-Host ("Nationalteams: " + (($teamQ.GetEnumerator() | ForEach-Object { "$($_.Value)=$($_.Key)" }) -join ', '))
if ($teamQ.Count -ne 4) { throw 'Nicht alle vier Nationalteams gefunden' }

$h = [IO.File]::ReadAllText([IO.Path]::GetFullPath($HistoryFile), [Text.Encoding]::UTF8) | ConvertFrom-Json
$gbr = @($h.players | Where-Object { $_.nat -eq 'GBR' } | ForEach-Object { $_.id })
Write-Host "Spieler mit GBR: $($gbr.Count)"
$out = [ordered]@{}
for ($i = 0; $i -lt $gbr.Count; $i += 40) {
  $batch = $gbr[$i..([Math]::Min($i + 39, $gbr.Count - 1))] -join '|'
  $r = Invoke-Api "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$batch&props=claims&format=json"
  foreach ($kv in $r.entities.PSObject.Properties) {
    $p54 = $kv.Value.claims.P54
    if (-not $p54) { continue }
    foreach ($c in $p54) {
      $q = $c.mainsnak.datavalue.value.id
      if ($q -and $teamQ.ContainsKey($q)) { $out[$kv.Name] = $teamQ[$q]; break }
    }
  }
}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), (ConvertTo-Json $out -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Aufgeloest: $($out.Count) von $($gbr.Count)"
