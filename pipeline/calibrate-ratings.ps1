# Soccerdle-Rating kalibrieren
# Die FIFA-Daten (FIFA 15-23) werden NUR hier lokal genutzt, um die Gewichte unserer eigenen Formel zu bestimmen.
# Veroeffentlicht werden ausschliesslich die Gewichte (data/rating-model.json) - keine einzelnen FIFA-Werte.
#
# Formel:  rating = b0 + b1*ln(Bekanntheit) + b2*Vereinsstaerke(Saison) + b3*jung^2 + b4*alt^2 + b5*Torwart
#   Bekanntheit     = Anzahl Wikipedia-Sprachversionen (Wikidata-Sitelinks)
#   Vereinsstaerke  = mittlere ln(Bekanntheit) der 11 bekanntesten Spieler des Vereins in dieser Saison
#   jung / alt      = Jahre unter 26 bzw. ueber 30 in dieser Saison
param(
  [string]$HistoryFile = "$PSScriptRoot\..\data\history.json",
  [string]$FifaFile    = "$PSScriptRoot\..\.cache\fifa\fifa_slim.tsv",
  [string]$OutFile     = "$PSScriptRoot\..\data\rating-model.json"
)
$ErrorActionPreference = 'Stop'
function Norm($s) { ($s.Normalize([Text.NormalizationForm]::FormD) -replace '\p{Mn}', '' -replace 'ß', 'ss' -replace 'ø', 'o' -replace 'ł', 'l' -replace 'ı', 'i').ToLower() }

# ---------- Historie laden ----------
$h = [IO.File]::ReadAllText([IO.Path]::GetFullPath($HistoryFile), [Text.Encoding]::UTF8) | ConvertFrom-Json
$players = $h.players
$thisYear = (Get-Date).Year

# Vereinsstaerke je Verein+Jahr
$clubYear = @{}
foreach ($p in $players) {
  $ls = [Math]::Log([double]$p.sl)
  foreach ($s in @($p.career)) {
    if (-not $s.f) { continue }
    $to = if ($s.t) { [int]$s.t } else { [Math]::Min($thisYear, [int]$s.f + 3) }
    for ($y = [int]$s.f; $y -le $to; $y++) {
      $k = "$($s.c)|$y"
      if (-not $clubYear.ContainsKey($k)) { $clubYear[$k] = New-Object System.Collections.Generic.List[double] }
      $clubYear[$k].Add($ls)
    }
  }
}
$strength = @{}
function Get-Strength($club, $year) {
  $k = "$club|$year"
  if ($strength.ContainsKey($k)) { return $strength[$k] }
  $v = 0.0
  if ($clubYear.ContainsKey($k)) {
    $top = @($clubYear[$k] | Sort-Object -Descending | Select-Object -First 11)
    $v = ($top | Measure-Object -Average).Average
  }
  $strength[$k] = $v
  return $v
}

# ---------- FIFA laden, nach Geburtsdatum indizieren ----------
$byDob = @{}
$lines = [IO.File]::ReadAllLines([IO.Path]::GetFullPath($FifaFile), [Text.Encoding]::UTF8)
$cols = $lines[0] -split "`t"; $ci = @{}; for ($i = 0; $i -lt $cols.Count; $i++) { $ci[$cols[$i]] = $i }
for ($i = 1; $i -lt $lines.Count; $i++) {
  $f = $lines[$i] -split "`t"
  $dob = $f[$ci['dob']]; if (-not $dob) { continue }
  if (-not $byDob.ContainsKey($dob)) { $byDob[$dob] = New-Object System.Collections.ArrayList }
  [void]$byDob[$dob].Add(@{ v = [int]$f[$ci['fifa_version']]; o = [int]$f[$ci['overall']]; n = (Norm ($f[$ci['long_name']] + ' ' + $f[$ci['short_name']])); pos = $f[$ci['player_positions']] })
}
Write-Host "FIFA-Zeilen: $($lines.Count - 1), Geburtsdaten: $($byDob.Count)"

# ---------- Abgleich + Trainingsdaten ----------
$rows = New-Object System.Collections.ArrayList
$matched = 0
foreach ($p in $players) {
  if (-not $p.dob -or -not $byDob.ContainsKey($p.dob)) { continue }
  $tokens = @((Norm $p.name) -split '[\s\-]+' | Where-Object { $_.Length -ge 3 })
  if (-not $tokens.Count) { continue }
  $last = $tokens[-1]
  $cands = @($byDob[$p.dob] | Where-Object { $_.n -match "\b$([regex]::Escape($last))\b" })
  if (-not $cands.Count) { continue }
  $matched++
  $birthYear = [int]$p.dob.Substring(0, 4)
  $isGK = @($p.pos) -contains 'TW'
  foreach ($r in ($cands | Group-Object { $_.v } | ForEach-Object { $_.Group[0] })) {
    $year = 2000 + $r.v - 1                     # FIFA 15 -> Saison 2014/15
    $clubs = @($p.career | Where-Object { $_.f -and $_.f -le $year -and (-not $_.t -or $_.t -ge $year) })
    if (-not $clubs.Count) { continue }
    $st = ($clubs | ForEach-Object { Get-Strength $_.c $year } | Measure-Object -Maximum).Maximum
    $age = $year - $birthYear
    [void]$rows.Add(@{ y = $r.o; x = @(1.0, [Math]::Log([double]$p.sl), $st, [Math]::Pow([Math]::Max(0, 26 - $age), 2), [Math]::Pow([Math]::Max(0, $age - 30), 2), $(if ($isGK) { 1.0 } else { 0.0 })); name = $p.name; v = $r.v })
  }
}
Write-Host "Abgeglichene Spieler: $matched, Trainingszeilen (Spieler x Saison): $($rows.Count)"

# ---------- Lineare Regression (Normalgleichungen) ----------
$k = 6
$A = New-Object 'double[,]' $k, ($k + 1)
foreach ($r in $rows) { for ($i = 0; $i -lt $k; $i++) { for ($j = 0; $j -lt $k; $j++) { $A[$i, $j] += $r.x[$i] * $r.x[$j] }; $A[$i, $k] += $r.x[$i] * $r.y } }
for ($i = 0; $i -lt $k; $i++) { # Gauss-Elimination
  $piv = $A[$i, $i]
  for ($j = $i; $j -le $k; $j++) { $A[$i, $j] /= $piv }
  for ($r2 = 0; $r2 -lt $k; $r2++) { if ($r2 -ne $i) { $fac = $A[$r2, $i]; for ($j = $i; $j -le $k; $j++) { $A[$r2, $j] -= $fac * $A[$i, $j] } } }
}
$b = @(0..($k - 1) | ForEach-Object { $A[$_, $k] })
$names = 'konstante', 'ln_bekanntheit', 'vereinsstaerke', 'jung2', 'alt2', 'torwart'

# Guete
$mean = ($rows | ForEach-Object { $_.y } | Measure-Object -Average).Average
$ssTot = 0; $ssRes = 0; $abs = 0
foreach ($r in $rows) { $pred = 0; for ($i = 0; $i -lt $k; $i++) { $pred += $b[$i] * $r.x[$i] }; $ssRes += ($r.y - $pred) * ($r.y - $pred); $ssTot += ($r.y - $mean) * ($r.y - $mean); $abs += [Math]::Abs($r.y - $pred) }
Write-Host "`nGewichte:"; for ($i = 0; $i -lt $k; $i++) { Write-Host ("  {0,-16} {1,8:N3}" -f $names[$i], $b[$i]) }
Write-Host ("R^2 = {0:N3}   mittlere Abweichung = {1:N1} Punkte" -f (1 - $ssRes / $ssTot), ($abs / $rows.Count))

$model = [ordered]@{ formula = 'b0 + b1*ln(sitelinks) + b2*clubStrength + b3*max(0,26-age)^2 + b4*max(0,age-30)^2 + b5*isGK'; weights = [ordered]@{} ; trainedOn = "$($rows.Count) Spieler-Saisons"; r2 = [Math]::Round(1 - $ssRes / $ssTot, 3) }
for ($i = 0; $i -lt $k; $i++) { $model.weights[$names[$i]] = [Math]::Round($b[$i], 4) }
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutFile), ($model | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding $false))
Write-Host "Modell gespeichert: $OutFile"
