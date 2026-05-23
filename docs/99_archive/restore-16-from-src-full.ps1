$ErrorActionPreference = 'Stop'

$sourcePath = 'C:/unificard/SRC_FULL.txt'
if (-not (Test-Path $sourcePath)) {
  throw "Arquivo não encontrado: $sourcePath"
}

$targets = @(
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

$lines = [System.IO.File]::ReadAllLines($sourcePath)
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)

$created = 0
$updated = 0
$unchanged = 0

foreach ($rel in $targets) {
  $relTrimmed = $rel.Trim()
  $relWin = [Regex]::Escape(($relTrimmed -replace '/', '\\'))
  $headerPattern = "^=+\s+C:\\unificard\\$relWin\s+=+$"

  $startHeader = -1
  for ($i = 0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i].TrimStart([char]0xFEFF)
    if ($line -match $headerPattern) {
      $startHeader = $i
      break
    }
  }
  if ($startHeader -lt 0) {
    throw "Header não encontrado para: $relTrimmed"
  }

  $nextHeader = $lines.Length
  for ($j = $startHeader + 1; $j -lt $lines.Length; $j++) {
    if ($lines[$j] -match '^=+\s+C:\\unificard\\.+\s+=+$') {
      $nextHeader = $j
      break
    }
  }

  if ($nextHeader -le ($startHeader + 1)) {
    $content = ''
  } else {
    $contentLines = $lines[($startHeader + 1)..($nextHeader - 1)]
    $content = [string]::Join("`r`n", $contentLines)
  }
  $dest = "C:/unificard/$relTrimmed"
  $dir = [System.IO.Path]::GetDirectoryName($dest)
  if (-not [System.IO.Directory]::Exists($dir)) {
    [System.IO.Directory]::CreateDirectory($dir) | Out-Null
  }

  if ([System.IO.File]::Exists($dest)) {
    $old = [System.IO.File]::ReadAllText($dest)
    if ($old -ceq $content) {
      $unchanged++
      Write-Output "UNCHANGED $relTrimmed"
    } else {
      [System.IO.File]::WriteAllText($dest, $content, $utf8NoBom)
      $updated++
      Write-Output "UPDATED $relTrimmed"
    }
  } else {
    [System.IO.File]::WriteAllText($dest, $content, $utf8NoBom)
    $created++
    Write-Output "CREATED $relTrimmed"
  }
}

Write-Output "SUMMARY created=$created updated=$updated unchanged=$unchanged total=$($targets.Count)"
