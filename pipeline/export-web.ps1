# Wandelt die Pipeline-Ausgabe in die Datei um, die das Spiel laedt (web/data/players.js).
# Als .js statt .json, damit index.html auch lokal per Doppelklick (file://) funktioniert.
param(
  [string]$InFile = "$PSScriptRoot\..\data\players.json",
  [string]$OutFile = "$PSScriptRoot\..\web\data\players.js"
)
$ErrorActionPreference = 'Stop'

# Deutsche Vereinsnamen (Wikipedia liefert englische). Nicht gelistete bleiben unveraendert.
$CLUB_DE = @{
  'Bayern Munich' = 'FC Bayern München'; 'Inter Milan' = 'Inter Mailand'; 'Roma' = 'AS Rom'
  'Porto' = 'FC Porto'; 'Club Brugge' = 'FC Brügge'; 'Lille' = 'OSC Lille'; 'Napoli' = 'SSC Neapel'
  'Shakhtar Donetsk' = 'Schachtar Donezk'; 'Slavia Prague' = 'Slavia Prag'; 'AEK Athens' = 'AEK Athen'
  'Lens' = 'RC Lens'; 'Viking' = 'Viking FK'; 'Sabah' = 'Sabah FK'; 'Barcelona' = 'FC Barcelona'
  'Liverpool' = 'FC Liverpool'; 'Arsenal' = 'FC Arsenal'; 'Feyenoord' = 'Feyenoord Rotterdam'
  'Bodø/Glimt' = 'FK Bodø/Glimt'; 'Villarreal' = 'FC Villarreal'; 'Como' = 'Como 1907'
  'Sporting CP' = 'Sporting Lissabon'
}

$players = [IO.File]::ReadAllText((Resolve-Path $InFile), [Text.Encoding]::UTF8) | ConvertFrom-Json
# Zusaetzliche bekannte Spieler ausserhalb der CL (build-extras.ps1), falls vorhanden
$extrasFile = Join-Path (Split-Path (Resolve-Path $InFile)) 'extras.json'
if (Test-Path $extrasFile) {
  $have = @{}; foreach ($p in $players) { $have[$p.id] = $true }
  $arr = [IO.File]::ReadAllText($extrasFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
  $extra = @(foreach ($x in $arr) { if (-not $have[$x.id]) { $x } })   # foreach: PS 5.1 entpackt das Array aus ConvertFrom-Json nicht per Pipeline
  $players = @($players) + $extra
  Write-Host "Extras angehaengt: $($extra.Count)"
}
$slim = foreach ($p in $players) {
  [ordered]@{
    id = $p.id; name = $p.name
    club = $(if ($CLUB_DE[$p.club]) { $CLUB_DE[$p.club] } else { $p.club })
    league = $p.league; leagueCountry = $p.leagueCountry
    nationality = $p.nationality; positions = @($p.positions)
    birthDate = $p.birthDate; heightCm = $p.heightCm; foot = $p.foot; number = $p.number
    subPosition = $p.subPosition; pageviews = $p.pageviews
  }
}
$json = ConvertTo-Json @($slim) -Depth 4 -Compress
$stamp = (Get-Date).ToString('yyyy-MM-dd')
$js = "// Automatisch erzeugt von pipeline/export-web.ps1 am $stamp - nicht von Hand bearbeiten`nwindow.SOCCERDLE_DATA = { updated: '$stamp', players: $json };`n"
New-Item -ItemType Directory -Force (Split-Path $OutFile) | Out-Null
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), $js, (New-Object Text.UTF8Encoding $false))
Write-Host "web/data/players.js geschrieben: $(@($slim).Count) Spieler"
