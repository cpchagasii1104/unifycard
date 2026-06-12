# negative-proofs-contextual-temporal.ps1 — provas negativas da macrofrente
# F-CANONICAL-CONTEXTUAL-MEDIA-AND-TEMPORAL-AUTHORITY-CLOSURE (GO §17).
# Para cada regressão: injeta → gates (canonico+temporal) DEVEM FALHAR → restaura
# byte-a-byte (sha256 verificado) → gates voltam a passar. Tree termina limpo.
# Uso: pwsh -File scripts/negative-proofs-contextual-temporal.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Get-Sha($path) { (Get-FileHash $path -Algorithm SHA256).Hash.ToLower() }
function Invoke-Gates {
    node scripts/audit-canonical-catalog-closure.mjs *> $null
    if ($LASTEXITCODE -ne 0) { return 1 }
    node scripts/audit-availability-owner-authority.mjs *> $null
    return $LASTEXITCODE
}

$proofs = @(
    @{ Name = 'P-M1 context_owner removido da identidade';
       File = 'src/core/media-assets/media-context-identity.ts';
       Inject = { param($c) $c -replace [regex]::Escape("decl.contextOwnerId ?? ''"), "''" } },
    @{ Name = 'P-M2 licenca divergente descartada da identidade';
       File = 'src/core/media-assets/media-context-identity.ts';
       Inject = { param($c) $c -replace [regex]::Escape("normalizeContextDimension(decl.license)"), "''" } },
    @{ Name = 'P-M3 E2 anexa declaracao privada de E1 (match de contexto removido)';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("asset.contextOwnerId === targetCompanyId"), "true" } },
    @{ Name = 'P-M4 aprovacao publica sem relacao canonica (isAttachedToCanonical removido)';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("(await this.isAttachedToCanonical(asset.id))"), "true" } },
    @{ Name = 'P-M5 idempotency-key divergente devolve sucesso';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("MEDIA_IDEMPOTENCY_CONFLICT"), "MEDIA_IDEMPOTENCY_OK" } },
    @{ Name = 'P-T1 canRepresentActor(availability.ownerId) reintroduzido';
       File = 'src/core/availability/unified-availability.routes.ts';
       Inject = { param($c) $c + "`nconst __negT1 = `"canRepresentActor(req.tenant.id, userId, availability.ownerId)`";`nvoid __negT1;`n" } },
    @{ Name = 'P-T2 service_offering removido do enum com writer vivo';
       File = 'src/core/availability/unified-availability.types.ts';
       Inject = { param($c) $c -replace "SERVICE_OFFERING = 'service_offering',[^\r\n]*", "" } },
    @{ Name = 'P-T3 `as never` reintroduzido na familia temporal';
       File = 'src/modules/services/service-offering.service.ts';
       Inject = { param($c) $c + "`nconst __negT3 = null as never;`nvoid __negT3;`n" } },
    @{ Name = 'P-T4 policy de service_offering removida do resolver';
       File = 'src/core/availability/availability-owner-authority.ts';
       Inject = { param($c) $c -replace [regex]::Escape("[AvailabilityOwnerType.SERVICE_OFFERING]:"), "__policyRemoved:" } },
    @{ Name = 'P-T5 actionContext.actorId comparado com ownerId cru';
       File = 'src/core/availability/unified-availability.routes.ts';
       Inject = { param($c) $c + "`nconst __negT5 = `"req.actionContext.actorId !== availability.ownerId`";`nvoid __negT5;`n" } },
    @{ Name = 'P-T6 owner_type novo sem policy/CHECK (driver)';
       File = 'src/core/availability/unified-availability.types.ts';
       Inject = { param($c) $c -replace [regex]::Escape("SERVICE_OFFERING = 'service_offering',"), "SERVICE_OFFERING = 'service_offering',`n  DRIVER = 'driver'," } }
)

$allOk = $true
foreach ($p in $proofs) {
    $path = Resolve-Path $p.File
    $shaBefore = Get-Sha $path
    $original = [System.IO.File]::ReadAllText($path)
    $mutated = & $p.Inject $original
    if ($mutated -eq $original) { Write-Host "[$($p.Name)] INJECAO NAO ALTEROU O ARQUIVO — prova invalida" -ForegroundColor Red; $allOk = $false; continue }
    [System.IO.File]::WriteAllText($path, $mutated)

    $gateFailed = ((Invoke-Gates) -ne 0)

    [System.IO.File]::WriteAllText($path, $original)
    $shaAfter = Get-Sha $path
    $restored = ($shaAfter -eq $shaBefore)

    $gateOkAgain = ((Invoke-Gates) -eq 0)

    $ok = $gateFailed -and $restored -and $gateOkAgain
    if (-not $ok) { $allOk = $false }
    $status = if ($ok) { 'OK' } else { 'FALHOU' }
    Write-Host "[$($p.Name)] gateFail=$gateFailed restoredSha=$restored($shaAfter) gateOk=$gateOkAgain => $status"
}

if (-not $allOk) { Write-Host 'PROVAS NEGATIVAS (contextual+temporal): FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'PROVAS NEGATIVAS (contextual+temporal): 11/11 — gates derrubam cada regressao; restauracao byte-identica.' -ForegroundColor Green
exit 0
