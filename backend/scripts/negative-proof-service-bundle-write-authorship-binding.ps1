# negative-proof-service-bundle-write-authorship-binding.ps1
# Prova que o guard audit-service-bundle-write-authorship-binding.mjs MORDE cada regressão do
# write-authorship-spoof e que a restauração é byte-idêntica (SHA256). Várias mordidas sobre o
# arquivo REAL service-bundle.routes.ts; cada uma: muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-service-bundle-write-authorship-binding.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = Join-Path (Get-Location) 'src\modules\services\service-bundle.routes.ts'
$origText = Get-Content $routes -Raw
$origHash = (Get-FileHash $routes -Algorithm SHA256).Hash

function Invoke-Guard {
    node scripts/audit-service-bundle-write-authorship-binding.mjs *> $null
    return $LASTEXITCODE
}
function Restore-Original {
    Set-Content -Path $routes -Value $origText -NoNewline -Encoding UTF8
}

$baseOk = ((Invoke-Guard) -eq 0)

# Cada mordida: (rótulo, regex a substituir, substituição que reintroduz a regressão).
$bites = @(
    @{ name = 'spoof-confirm';      find = 'confirmedByActorId: bound\.actorId';                         repl = 'confirmedByActorId: actionContext.actorId' },
    @{ name = 'spoof-confirm-user'; find = 'confirmedByUserId: bound\.userId';                           repl = 'confirmedByUserId: actionContext.actorId' },
    @{ name = 'book-conflate-user'; find = 'createBundleBookings\(\s*\r?\n\s*tenantId,\s*\r?\n\s*bound\.userId'; repl = "createBundleBookings(`r`n          tenantId,`r`n          actionContext.actorId" },
    @{ name = 'book-raw-requester'; find = 'requesterActorId: bound\.actorId';                           repl = 'requesterActorId: body.requesterActorId' },
    @{ name = 'drop-helper';        find = 'const bindWriteActor = async';                               repl = 'const bindWriteActorDISABLED = async' },
    @{ name = 'drop-canrepresent';  find = 'canRepresentActor\(tenantId, userId, declaredActorId\)';     repl = 'Promise.resolve(true)' },
    @{ name = 'drop-one-bind';      find = 'const bound = await bindWriteActor\(req, reply, tenantId, body\?\.requesterActorId\);'; repl = 'const bound = { userId: req.user.userId, actorId: body.requesterActorId };'; once = $true }
)

$allBitesOk = $true
$details = @()
foreach ($b in $bites) {
    if ($b.once) {
        $rx = [regex]::new($b.find)
        $mutated = $rx.Replace($origText, $b.repl, 1)
    } else {
        $mutated = [regex]::Replace($origText, $b.find, $b.repl)
    }
    if ($mutated -eq $origText) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
    Set-Content -Path $routes -Value $mutated -NoNewline -Encoding UTF8
    $bit = ((Invoke-Guard) -ne 0)
    Restore-Original
    $restoredOk = ((Invoke-Guard) -eq 0)
    $hashOk = ((Get-FileHash $routes -Algorithm SHA256).Hash -eq $origHash)
    if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
    $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
}

Restore-Original
$finalHashOk = ((Get-FileHash $routes -Algorithm SHA256).Hash -eq $origHash)

$ok = $baseOk -and $allBitesOk -and $finalHashOk
Write-Host "[neg-proof service-bundle-write-authorship-binding] baseOk=$baseOk finalHashOk=$finalHashOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão do write-authorship-spoof; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
