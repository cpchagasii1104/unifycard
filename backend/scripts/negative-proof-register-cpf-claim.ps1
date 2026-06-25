# negative-proof-register-cpf-claim.ps1
# Prova que o guard audit-register-cpf-claim.mjs MORDE cada regressão do dedup de CPF no register.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\..\core\auth\auth.service.ts'
$svc = Join-Path (Get-Location) 'src\core\auth\auth.service.ts'

function Invoke-Guard {
    node scripts/audit-register-cpf-claim.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover o claim-check (SELECT 1 FROM users WHERE global_user_id) -> guard FAIL
    @{ name = 'claim-check-removed'; file = $svc;
       find = "SELECT 1 FROM users WHERE global_user_id = \`$1 LIMIT 1";
       repl = "SELECT 0 WHERE false" },
    # 2) remover o code estável CPF_ALREADY_REGISTERED -> guard FAIL
    @{ name = 'error-code-removed'; file = $svc;
       find = "error\.code = 'CPF_ALREADY_REGISTERED';";
       repl = "error.code = 'GENERIC';" },
    # 3) vazar PII na mensagem do erro -> guard FAIL
    @{ name = 'pii-leak-in-error'; file = $svc;
       find = "const error = new Error\('CPF já cadastrado'\) as Error & \{ statusCode\?: number; code\?: string \};";
       repl = "const error = new Error(``CPF já cadastrado para `${globalUserId}``) as Error & { statusCode?: number; code?: string };" }
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
            $rx = [regex]::new($b.find)
            $mutated = if ($b.all) { $rx.Replace($orig, $b.repl) } else { $rx.Replace($orig, $b.repl, 1) }
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
}
finally {
    foreach ($f in $targets) {
        if ((Get-FileHash $f -Algorithm SHA256).Hash -ne $snapshot[$f].hash) {
            Restore-FromSnapshot $f
            Write-Host "  [restore-backstop] $f restaurado ao snapshot" -ForegroundColor Yellow
        }
    }
}

$ok = $baseOk -and $allBitesOk
Write-Host "[neg-proof register-cpf-claim] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao do dedup de CPF; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
