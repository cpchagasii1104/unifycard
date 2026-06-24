# negative-proof-economic-activity-suggestion-readonly.ps1
# Prova que o guard audit-economic-activity-suggestion-readonly.mjs MORDE cada regressão dos invariantes do
# elo B1 (sugestão company-scoped read-only). Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256.
# Restore GARANTIDO (snapshot + try/finally + backstop); exit!=0 do guard (a mordida) não aborta o harness.
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc    = Join-Path (Get-Location) 'src\core\companies\companies.service.ts'
$routes = Join-Path (Get-Location) 'src\core\companies\companies.routes.ts'

function Invoke-Guard {
    node scripts/audit-economic-activity-suggestion-readonly.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    @{ name = 'write-introduced';    file = $svc;    find = 'const fid = co\.rows';                          repl = "await pool.query('INSERT INTO eas_neg VALUES (1)');`r`n    const fid = co.rows" },
    @{ name = 'autoactivate';        file = $svc;    find = 'const acts = await pool\.query';                repl = "this.activateCompanyOperationally();`r`n    const acts = await pool.query" },
    @{ name = 'approved-filter-gone';file = $svc;    find = "review_status = 'approved'";                     repl = "review_status = 'proposed'"; all = $true },
    @{ name = 'route-canmanage-gone';file = $routes; find = 'const canManage = await companiesService\.canManageCompany'; repl = 'const canManage = await companiesService.canManageCompanyX' }
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
Write-Host "[neg-proof economic-activity-suggestion-readonly] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressão; restauração byte-idêntica (SHA256).' -ForegroundColor Green
exit 0
