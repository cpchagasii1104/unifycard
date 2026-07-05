# negative-proof-service-money-07-nomenclature.ps1
# Fecha DT-SERVICE-MONEY-07-NEGATIVE-PROOF-REPRODUCIBILITY (warning W1 do reseal Yala de
# F-NOMENCLATURE-SERVICE-MONEY-07-CLOSURE, 2026-06-16): o guard audit-service-money-07-
# nomenclature.mjs foi provado na hora (narrado no execution log), mas sem script reproduzível
# versionado. Este script fecha isso — mesmo padrão de negative-proof-*.ps1 já usado no projeto
# (snapshot + mutacao + guard + restore + SHA256), cobrindo os vetores de RUNTIME (4) e um
# representante do vetor de MIGRATION (a migration nova precisa existir; simulado via arquivo
# temporario descartavel, nunca commitado).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

function Invoke-Guard {
    node scripts/audit-service-money-07-nomenclature.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$sprTypes = Join-Path (Get-Location) 'src\modules\services\service-payment-request.types.ts'
$sprRepo = Join-Path (Get-Location) 'src\modules\services\service-payment-request.repository.ts'
$sprService = Join-Path (Get-Location) 'src\modules\services\service-payment-request.service.ts'
$servicesRepo = Join-Path (Get-Location) 'src\modules\services\services.repository.ts'

# ── Vetores de RUNTIME (4, um por arquivo canônico do guard) ────────────────────────────────────
$bites = @(
    # 1) types perde o campo canônico paymentRequestStatus (07 §3.4) — substituição TOTAL da
    #    substring (não sufixo) pra garantir que /paymentRequestStatus/ pare de casar de verdade.
    @{ name = 'types-loses-paymentRequestStatus'; file = $sprTypes;
       find = 'paymentRequestStatus'; repl = 'renamedAwayField'; all = $true }
    # 2) repository volta a ler a coluna antiga `status AS "paymentRequestStatus"`
    @{ name = 'repository-reverts-to-bare-status-alias'; file = $sprRepo;
       find = 'payment_request_status\s+AS\s+"paymentRequestStatus"';
       repl = 'status AS "paymentRequestStatus"' }
    # 3) literal 'FIC' reintroduzido no caminho service_payment (FIC nao e moeda canonica, 07 §4.10)
    @{ name = 'fic-literal-reintroduced'; file = $sprService;
       find = "const FIC_PROOF_MARKER = 'BRL';"; repl = "const FIC_PROOF_MARKER = 'FIC';"; insertIfMissing = $true }
    # 4) services.repository.ts perde a coercao Number(row.price_cents) (BIGINT volta como string no pg)
    @{ name = 'services-repo-loses-bigint-coercion'; file = $servicesRepo;
       find = 'Number\(row\.price_cents\)'; repl = 'row.price_cents' }
)

$targets = @($bites | ForEach-Object { $_.file } | Select-Object -Unique)
$snapshot = @{}
foreach ($f in $targets) { $snapshot[$f] = @{ content = (Get-Content $f -Raw); hash = (Get-FileHash $f -Algorithm SHA256).Hash } }
function Restore-FromSnapshot([string]$file) { Set-Content -Path $file -Value $snapshot[$file].content -NoNewline -Encoding UTF8 }

$allBitesOk = $true
$details = @()
try {
    foreach ($b in $bites) {
        $origHash = $snapshot[$b.file].hash
        $bit = $false
        try {
            $orig = $snapshot[$b.file].content
            $working = $orig
            # bite 3 exige um marcador proprio (FIC_PROOF_MARKER) pra nao depender de FIC ja existir
            # em lugar nenhum do arquivo — prependa direto no topo, sem depender de casar `import`.
            if ($b.insertIfMissing -and ($working -notmatch [regex]::Escape("FIC_PROOF_MARKER"))) {
                $working = "const FIC_PROOF_MARKER = 'BRL';`n" + $working
            }
            $rx = [regex]::new($b.find)
            $mutated = if ($b.all) { $rx.Replace($working, $b.repl) } else { $rx.Replace($working, $b.repl, 1) }
            if ($mutated -eq $orig) { $allBitesOk = $false; $details += "$($b.name)=NAO_MUTOU"; continue }
            Set-Content -Path $b.file -Value $mutated -NoNewline -Encoding UTF8
            $bit = ((Invoke-Guard) -ne 0)
        }
        finally { Restore-FromSnapshot $b.file }
        $restoredOk = ((Invoke-Guard) -eq 0)
        $hashOk = ((Get-FileHash $b.file -Algorithm SHA256).Hash -eq $origHash)
        if (-not ($bit -and $restoredOk -and $hashOk)) { $allBitesOk = $false }
        $details += "$($b.name)=morde:$bit,restaura:$restoredOk,sha256:$hashOk"
    }

    # ── Vetor de MIGRATION (representante dos 7): migration nova com FIC default reintroduzido ────
    $migDir = Join-Path (Get-Location) 'migrations'
    $decoyMig = Join-Path $migDir '99999999999999_negative_proof_decoy_fic_default.sql'
    $migBit = $false
    try {
        Set-Content -Path $decoyMig -Value "ALTER TABLE service_payment_requests ALTER COLUMN currency SET DEFAULT 'FIC';" -NoNewline -Encoding UTF8
        $migBit = ((Invoke-Guard) -ne 0)
    }
    finally {
        if (Test-Path $decoyMig) { Remove-Item $decoyMig -Force }
    }
    $migRestoredOk = ((Invoke-Guard) -eq 0)
    if (-not ($migBit -and $migRestoredOk)) { $allBitesOk = $false }
    $details += "migration-fic-default-decoy=morde:$migBit,restaura:$migRestoredOk"
}
finally {
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot" -ForegroundColor Yellow
        }
    }
    $decoyMig = Join-Path (Get-Location) 'migrations\99999999999999_negative_proof_decoy_fic_default.sql'
    if (Test-Path $decoyMig) { Remove-Item $decoyMig -Force; Write-Host "  [restore-backstop] migration decoy removida" -ForegroundColor Yellow }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof service-money-07-nomenclature] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde os 4 vetores de runtime + 1 representante de migration (FIC default); restauracao byte-identica (SHA256), migration decoy nunca commitada.' -ForegroundColor Green
exit 0
