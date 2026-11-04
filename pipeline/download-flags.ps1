# Laedt Flaggen (flag-icons, MIT-Lizenz) einmalig nach web/flags/ - werden selbst gehostet (DSGVO: keine Fremd-CDN).
# FIFA-Code -> ISO-Code wie in flag-icons
$ErrorActionPreference = 'Stop'
$map = @{
  ALB='al'; ALG='dz'; ANG='ao'; ARG='ar'; ARM='am'; AUS='au'; AUT='at'; AZE='az'; BEL='be'; BEN='bj'; BFA='bf'; BIH='ba'
  BLR='by'; BOL='bo'; BRA='br'; BUL='bg'; CAN='ca'; CGO='cg'; CHI='cl'; CHN='cn'; CIV='ci'; CMR='cm'; COD='cd'; COL='co'
  CPV='cv'; CRC='cr'; CRO='hr'; CUW='cw'; CYP='cy'; CZE='cz'; DEN='dk'; DOM='do'; ECU='ec'; EGY='eg'; ENG='gb-eng'; EQG='gq'
  ESP='es'; EST='ee'; FIN='fi'; FRA='fr'; GAB='ga'; GAM='gm'; GEO='ge'; GER='de'; GHA='gh'; GLP='gp'; GNB='gw'; GRE='gr'
  GUI='gn'; HAI='ht'; HON='hn'; HUN='hu'; IDN='id'; IRL='ie'; IRN='ir'; IRQ='iq'; ISL='is'; ISR='il'; ITA='it'; JAM='jm'
  JOR='jo'; JPN='jp'; KAZ='kz'; KEN='ke'; KOR='kr'; KSA='sa'; KVX='xk'; LBY='ly'; LTU='lt'; LUX='lu'; LVA='lv'; MAD='mg'
  MAR='ma'; MDA='md'; MEX='mx'; MKD='mk'; MLI='ml'; MNE='me'; MOZ='mz'; MTN='mr'; NED='nl'; NGA='ng'; NIR='gb-nir'; NOR='no'
  NZL='nz'; PAN='pa'; PAR='py'; PER='pe'; PHI='ph'; POL='pl'; POR='pt'; QAT='qa'; ROU='ro'; RSA='za'; RUS='ru'; RWA='rw'
  SCO='gb-sct'; SEN='sn'; SRB='rs'; SUI='ch'; SUR='sr'; SVK='sk'; SVN='si'; SWE='se'; SYR='sy'; TOG='tg'; TUN='tn'; TUR='tr'
  UAE='ae'; UKR='ua'; URU='uy'; USA='us'; UZB='uz'; VEN='ve'; WAL='gb-wls'; ZAM='zm'; ZIM='zw'
}
$dir = "$PSScriptRoot\..\web\flags"
New-Item -ItemType Directory -Force $dir | Out-Null
$ok = 0
foreach ($k in $map.Keys) {
  $file = Join-Path $dir "$k.svg"
  if (Test-Path $file) { $ok++; continue }
  try { Invoke-WebRequest "https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/flags/4x3/$($map[$k]).svg" -OutFile $file; $ok++ }
  catch { Write-Host "Fehlt: $k ($($map[$k]))" }
}
Write-Host "$ok Flaggen in web/flags/"
