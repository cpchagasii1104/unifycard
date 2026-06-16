# negative-proof-service-order-write-authorship-binding.ps1
# Prova que o guard audit-service-order-write-authorship-binding.mjs MORDE cada regressão do
# write-authorship-spoof e que a restauração é byte-idêntica (SHA256). Várias mordidas sobre o
# arquivo REAL service-order.routes.ts; cada uma: muta -> guard FALHA -> restaura -> guard PASSA + SHA256 igual.
# Uso: pwsh -File scripts/negative-proof-service-order-write-authorship-binding.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

$routes = Join-Path (Get-Location) 'src\modules\services\service-order.routes.ts'
$origText = Get-Content $routes -Raw
$origHash = (Get-FileHash $routes -Algorithm SHA256).Hash

function Invoke-Guard {
    node scripts/audit-service-order-write-authorship-binding.mjs *> $null
    return $LASTEXITCODE
}
function Restore-Original {
    Set-Content -Path $routes -Value $origText -NoNewline -Encoding UTF8
}

$baseOk = ((Invoke-Guard) -eq 0)

# Cada mordida: (rótulo, regex a substituir, substituição que reintroduz a regressão).
$bites = @(
    @{ name = 'spoof-start';       find = 'startedByActorId: bound\.actorId';                                          repl = 'startedByActorId: actionContext.actorId' },
    @{ name = 'spoof-buyer-user';  find = 'buyerUserId: bound\.userId';                                                repl = 'buyerUserId: actionContext.actorId' },
    @{ name = 'drop-helper';       find = 'const bindOrderWriteActor = async';                                         repl = 'const bindOrderWriteActorDISABLED = async' },
    @{ name = 'drop-canrepresent'; find = 'canRepresentActor\(tenantId, userId, actorId\)';                           repl = 'Promise.resolve(true)' },
    @{ name = 'drop-one-bind';     find = 'const bound = await bindOrderWriteActor\(req, reply, tenantId, existing\);'; repl = 'const bound = { userId: req.user.userId, actorId: req.actionContext.actorId };'; once = $true }
)

$allBitesOk = $true
$details = @()
foreach ($b in $bites) {
    $opts = [System.Text.RegularExpressions.RegexOptions]::None
    if ($b.once) {
        $rx = [regex]::new($b.find, $opts)
        $mutated = $rx.Replace($origText, $b.repl, 1)  # só a 1ª ocorrência
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

# Garantia final: arquivo idêntico ao original.
Restore-Original
$finalHashOk = ((Get-FileHash $routes -Algorithm SHA256).Hash -eq $origHash)

$ok = $baseOk -and $allBitesOk -and $finalHashOk
Write-Host "[neg-proof service-order-write-authorship-binding] baseOk=$baseOk finalHashOk=$finalHashOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão do write-authorship-spoof; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
