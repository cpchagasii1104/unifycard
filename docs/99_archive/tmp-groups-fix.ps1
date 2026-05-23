$svcFile = 'C:/unificard/backend/src/modules/groups/groups.service.ts'
$typFile = 'C:/unificard/backend/src/modules/groups/groups.types.ts'

# ── groups.types.ts ──────────────────────────────────────────
# BUG 2 fix: ownerUserId → ownerActorId no tipo Group
$content = Get-Content $typFile -Raw
$content = $content.Replace('ownerUserId: string;', 'ownerActorId: string;')
[System.IO.File]::WriteAllText($typFile, $content, [System.Text.UTF8Encoding]::new($false))

# ── groups.service.ts ─────────────────────────────────────────
# BUG 1 + BUG 2 fix: todas referências ownerUserId → ownerActorId
$content = Get-Content $svcFile -Raw
$content = $content.Replace('ownerUserId', 'ownerActorId')
[System.IO.File]::WriteAllText($svcFile, $content, [System.Text.UTF8Encoding]::new($false))

# Validação
$checkSvc = Get-Content $svcFile -Raw
$checkTyp = Get-Content $typFile -Raw
$fail = $false

if ($checkSvc -match '\bownerUserId\b') {
  Write-Error "FAIL: ownerUserId ainda existe em groups.service.ts"
  $fail = $true
}
if ($checkTyp -match '\bownerUserId\b') {
  Write-Error "FAIL: ownerUserId ainda existe em groups.types.ts"
  $fail = $true
}
if (-not ($checkSvc -match '\bownerActorId\b')) {
  Write-Error "FAIL: ownerActorId não encontrado em groups.service.ts"
  $fail = $true
}
if ($fail) { exit 1 }

Write-Output "OK: ownerUserId → ownerActorId aplicado"
Write-Output "Contagem ownerActorId no service: $(([regex]::Matches($checkSvc, 'ownerActorId')).Count)"
Write-Output "Contagem ownerActorId no types: $(([regex]::Matches($checkTyp, 'ownerActorId')).Count)"