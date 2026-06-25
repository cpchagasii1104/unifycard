# negative-proof-event-rfq-declarative-quarantine-gate.ps1
# Prova que o guard audit-event-rfq-declarative-quarantine-gate.mjs MORDE cada regressão.
# Cada bite: muta -> guard FALHA -> restaura -> guard PASSA + SHA256. Restore garantido (snapshot + try/finally).
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
Set-Location $PSScriptRoot\..

$svc = Join-Path (Get-Location) 'src\modules\events\event-rfq.service.ts'
$authz = Join-Path (Get-Location) 'src\core\authorization\authorization.service.ts'

function Invoke-Guard {
    node scripts/audit-event-rfq-declarative-quarantine-gate.mjs *> $null
    return $LASTEXITCODE
}
$baseOk = ((Invoke-Guard) -eq 0)

$bites = @(
    # 1) remover gate do createRFQ -> guard FAIL
    @{ name = 'createrfq-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, organizerActorId\);";
       repl = "/* sem gate */" },
    # 2) mover gate do createRFQ para DEPOIS do UPDATE metadata -> guard FAIL
    @{ name = 'createrfq-gate-after-write'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, organizerActorId\);\s*\n\s*\n\s*// 4\. Criar RFQ";
       repl = "// 4. Criar RFQ (gate movido p/ depois)`n    /* GATE_MOVED */" },
    # 3) remover gate do closeRFQ -> guard FAIL
    @{ name = 'closerfq-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, closedByActorId\);";
       repl = "/* sem gate */" },
    # 4) remover gate do createQuote -> guard FAIL
    @{ name = 'createquote-gate-removed'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, providerActorId\);";
       repl = "/* sem gate */" },
    # 5) gate com actionContext cru -> guard FAIL
    @{ name = 'gate-raw-actioncontext'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, organizerActorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, actionContext.actorId);" },
    # 6) gate com userId cru -> guard FAIL
    @{ name = 'gate-raw-userid'; file = $svc;
       find = "await this\.assertActorNotQuarantined\(tenantId, providerActorId\);";
       repl = "await this.assertActorNotQuarantined(tenantId, userId);" },
    # 7) enfiar gate de quarentena DENTRO do acceptQuote (money-adjacent, fora desta fatia) -> guard FAIL
    @{ name = 'acceptquote-gated-here'; file = $svc;
       find = "\): Promise<\{ quote: QuoteResponse; bookingId: string; paymentRequestId: string \}> \{";
       repl = "): Promise<{ quote: QuoteResponse; bookingId: string; paymentRequestId: string }> {`n    await this.assertActorNotQuarantined(tenantId, '');" },
    # 8) enfiar quarentena em canRepresentActor -> guard FAIL
    @{ name = 'quarantine-in-canrepresent'; file = $authz;
       find = "  async canRepresentActor\(";
       repl = "  async canRepresentActor(__q = await import('@modules/risk-identity/actor-effective-block').then(m => m.isActorEffectivelyBlocked)," }
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
Write-Host "[neg-proof event-rfq-declarative-quarantine-gate] baseOk=$baseOk"
$details | ForEach-Object { Write-Host "  - $_" }
if (-not $ok) { Write-Host 'NEGATIVE PROOF: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'NEGATIVE PROOF: OK - guard morde cada regressao; restauracao byte-identica (SHA256).' -ForegroundColor Green
exit 0
