# Genaue Positionen fuer den Draft (TW, IV, LV, RV, ZDM, ZM, ZOM, LM, RM, LA, RA, ST)
#   1. transfermarkt-datasets "sub_position" (ueber Transfermarkt-ID aus Wikidata P2446)
#   2. sonst Wikidata P413 (Position) mit genauer Bezeichnung
#   3. sonst grobe Position (ABW -> IV, MF -> ZM ...)
param(
  [string]$CacheDir = "$PSScriptRoot\..\.cache",
  [string]$OutFile  = "$PSScriptRoot\..\data\positions.json"
)
$ErrorActionPreference = 'Stop'
$CacheDir = [IO.Path]::GetFullPath($CacheDir)
$contactFile = Join-Path $PSScriptRoot 'contact.local.txt'
$UA = @{ 'User-Agent' = "soccerdle-prototype/0.3 ($((Get-Content $contactFile -TotalCount 1).Trim()))" }

$TM_MAP = @{
  'Goalkeeper' = 'TW'; 'Centre-Back' = 'IV'; 'Sweeper' = 'IV'; 'Left-Back' = 'LV'; 'Right-Back' = 'RV'
  'Defensive Midfield' = 'ZDM'; 'Central Midfield' = 'ZM'; 'Attacking Midfield' = 'ZOM'
  'Left Midfield' = 'LM'; 'Right Midfield' = 'RM'; 'Left Winger' = 'LA'; 'Right Winger' = 'RA'
  'Second Striker' = 'ST'; 'Centre-Forward' = 'ST'
}
# englische Wikidata-Bezeichnungen -> Draft-Position (Reihenfolge = Prioritaet)
$WD_RULES = @(
  @('goalkeeper', 'TW'), @('sweeper|libero|centre-back|center back|central defender|stopper', 'IV'),
  @('left[- ]back|left wing-back', 'LV'), @('right[- ]back|right wing-back', 'RV'), @('full-back|fullback|wing-back', 'RV'),
  @('defensive midfield|holding midfield|deep-lying', 'ZDM'), @('attacking midfield|playmaker|trequartista|number 10', 'ZOM'),
  @('left midfield', 'LM'), @('right midfield', 'RM'), @('central midfield|box-to-box|centre midfield', 'ZM'),
  @('left wing', 'LA'), @('right wing', 'RA'), @('winger|wide', 'LA'),
  @('centre-forward|center forward|striker|second striker|forward|false nine|target man', 'ST'),
  @('defender', 'IV'), @('midfielder', 'ZM')
)
$COARSE = @{ TW = 'TW'; ABW = 'IV'; MF = 'ZM'; ST = 'ST' }

# Transfermarkt sub_position nach TM-ID
$tmPos = @{}
Get-Content (Join-Path $CacheDir 'tm\players.csv') -Encoding UTF8 | ConvertFrom-Csv | ForEach-Object { if ($TM_MAP[$_.sub_position]) { $tmPos[$_.player_id] = $TM_MAP[$_.sub_position] } }

# Wikidata-Cache: TM-ID (P2446) + Positionen (P413) je Spieler
$perPlayer = @{}; $posQ = New-Object System.Collections.Generic.HashSet[string]
foreach ($file in Get-ChildItem (Join-Path $CacheDir 'wd') -Filter 'p-*.json') {
  $r = [IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
  foreach ($e in $r.entities.PSObject.Properties) {
    $c = $e.Value.claims
    $tm = @($c.P2446 | ForEach-Object { $_.mainsnak.datavalue.value })[0]
    $qs = @($c.P413 | Where-Object { $_.mainsnak.datavalue } | ForEach-Object { $_.mainsnak.datavalue.value.id })
    foreach ($q in $qs) { [void]$posQ.Add($q) }
    $perPlayer[$e.Name] = @{ tm = $tm; qs = $qs }
  }
}
# Bezeichnungen der Wikidata-Positionen
$label = @{}; $ids = @($posQ)
for ($i = 0; $i -lt $ids.Count; $i += 50) {
  $batch = $ids[$i..([Math]::Min($i + 49, $ids.Count - 1))] -join '|'
  $r = Invoke-RestMethod -Headers $UA "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=$batch&props=labels&languages=en&format=json"
  foreach ($e in $r.entities.PSObject.Properties) { if ($e.Value.labels.en) { $label[$e.Name] = $e.Value.labels.en.value } }
}
function Map-WD($lbl) { foreach ($rule in $WD_RULES) { if ($lbl -match "(?i)$($rule[0])") { return $rule[1] } }; return $null }

$h = [IO.File]::ReadAllText((Join-Path (Split-Path $OutFile) 'history.json'), [Text.Encoding]::UTF8) | ConvertFrom-Json
$out = [ordered]@{}; $src = @{ tm = 0; wd = 0; grob = 0; keine = 0 }
foreach ($p in $h.players) {
  $pp = $perPlayer[$p.id]; $pos = $null
  if ($pp -and $pp.tm -and $tmPos[$pp.tm]) { $pos = $tmPos[$pp.tm]; $src.tm++ }
  if (-not $pos -and $pp) {
    # spezifischste Wikidata-Position (generische wie "midfielder" zuletzt)
    $cands = @($pp.qs | ForEach-Object { Map-WD $label[$_] } | Where-Object { $_ })
    $specific = @($pp.qs | Where-Object { $label[$_] -and $label[$_] -notmatch '^(?i)(defender|midfielder|forward|goalkeeper)$' } | ForEach-Object { Map-WD $label[$_] } | Where-Object { $_ })
    if ($specific.Count) { $pos = $specific[0]; $src.wd++ } elseif ($cands.Count) { $pos = $cands[0]; $src.wd++ }
  }
  if (-not $pos -and @($p.pos).Count) { $pos = $COARSE[@($p.pos)[0]]; $src.grob++ }
  if (-not $pos) { $src.keine++; continue }
  $out[$p.id] = $pos
}
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), ($out | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
Write-Host "Positionen: Transfermarkt $($src.tm), Wikidata $($src.wd), grob $($src.grob), keine $($src.keine)"
Write-Host "Verteilung: $((@($out.Values) | Group-Object | Sort-Object Count -Desc | ForEach-Object { "$($_.Name)=$($_.Count)" }) -join ' ')"
