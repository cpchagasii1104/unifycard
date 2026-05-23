$ErrorActionPreference='Stop'
$source='C:/unificard/SRC_FULL.txt'
$targets=@(
'backend/src/app.builder.ts',
'backend/src/core/sagas/order-saga.service.ts',
'backend/src/core/events/register-handlers.ts',
'backend/src/modules/orders/order-saga.repository.ts',
'backend/src/modules/marketplace/inventory-unit-actor.ts',
'backend/src/modules/marketplace/accounts-payable.routes.ts',
'backend/src/modules/marketplace/accounts-receivable.routes.ts',
'backend/src/modules/marketplace/payment-method.routes.ts',
'backend/src/modules/marketplace/settlement.routes.ts',
'backend/src/modules/marketplace/tax-profile.routes.ts',
'backend/src/modules/marketplace/business-segment.routes.ts',
'backend/src/modules/marketplace/financial-agenda.routes.ts',
'backend/src/modules/marketplace/fiscal-kyc.routes.ts',
'backend/src/modules/marketplace/regional-fee.routes.ts',
'backend/src/modules/marketplace/event-settlement.routes.ts',
'backend/src/modules/marketplace/contact.routes.ts'
)
$lines=[System.IO.File]::ReadAllLines($source)
$utf8NoBom=[System.Text.UTF8Encoding]::new($false)
$headers=New-Object System.Collections.Generic.List[object]
for($i=0;$i -lt $lines.Length;$i++){
  $line=$lines[$i].TrimStart([char]0xFEFF)
  if($line -match '^=+\s+C:\\unificard\\(?<p>backend\\src\\.+?)\s+=+$'){
    $p=$Matches['p'] -replace '\\','/'
    $headers.Add([PSCustomObject]@{Index=$i; Rel=$p}) | Out-Null
  }
}
if($headers.Count -eq 0){ throw 'Nenhum header detectado em SRC_FULL.txt' }
$created=0; $updated=0; $unchanged=0
foreach($t in $targets){
  $h=$headers | Where-Object { $_.Rel -eq $t } | Select-Object -First 1
  if(-not $h){ throw "Header não encontrado para: $t" }
  $next=($headers | Where-Object { $_.Index -gt $h.Index } | Sort-Object Index | Select-Object -First 1)
  $endIdx= if($next){ $next.Index-1 } else { $lines.Length-1 }
  $content = if($endIdx -le $h.Index){ '' } else { [string]::Join("`r`n", $lines[($h.Index+1)..$endIdx]) }
  $dest = "C:/unificard/$t"
  $dir=[System.IO.Path]::GetDirectoryName($dest)
  if(-not [System.IO.Directory]::Exists($dir)){ [System.IO.Directory]::CreateDirectory($dir) | Out-Null }
  if([System.IO.File]::Exists($dest)){
    $old=[System.IO.File]::ReadAllText($dest)
    if($old -ceq $content){ $unchanged++; Write-Output "UNCHANGED $t" }
    else { [System.IO.File]::WriteAllText($dest,$content,$utf8NoBom); $updated++; Write-Output "UPDATED $t" }
  } else {
    [System.IO.File]::WriteAllText($dest,$content,$utf8NoBom); $created++; Write-Output "CREATED $t" }
}
Write-Output "SUMMARY created=$created updated=$updated unchanged=$unchanged total=$($targets.Count)"
