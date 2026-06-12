# negative-proofs-canonical.ps1 — provas negativas do gate canônico (GO §14).
# Para cada regressão: injeta → gate DEVE FALHAR → restaura byte-a-byte (sha256
# verificado) → gate volta a passar. Working tree termina limpo.
# NUNCA commitar este estado intermediário. Uso: pwsh -File scripts/negative-proofs-canonical.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Get-Sha($path) { (Get-FileHash $path -Algorithm SHA256).Hash.ToLower() }

$proofs = @(
    @{ Name = 'P1 price_cents no canonico';
       File = 'src/core/catalog/canonical/canonical-variant.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("export { insertCatalogEvent };"), "export { insertCatalogEvent };`nconst __negProbe = `"UPDATE canonical_products SET price_cents = 1`";" } },
    @{ Name = 'P2 oferta sem readiness de variante canonica';
       File = 'src/modules/marketplace/product-offering.service.ts';
       Inject = { param($c) $c -replace "CANONICAL_NOT_READY", "CANONICAL_WEAKENED" } },
    @{ Name = 'P3 soma tenant-wide de estoque reintroduzida';
       File = 'src/modules/marketplace/product-visibility.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("AND im.actor_id           = po.merchant_id"), "" } },
    @{ Name = 'P4 menu hardcoded divergente do registry';
       File = '../frontend/src/components/layout/GlobalSidebar.tsx';
       Inject = { param($c) $c + "`ninterface NavGroup { t: string }`nconst NAV_GROUPS: NavGroup[] = [];`nconst PILOT_HIDDEN_ROUTES = new Set<string>(['/marketplace']);`nvoid NAV_GROUPS; void PILOT_HIDDEN_ROUTES;`n" } },
    @{ Name = 'P5 servico empresarial sem canonical_service';
       File = 'src/modules/services/services.service.ts';
       Inject = { param($c) $c -replace "requireActiveForTenant", "weakenedLookup" } },
    @{ Name = 'P6 ensureUserActor em writer comercial';
       File = 'src/modules/marketplace/product-offering.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("export const productOfferingService = {"), "const __cureProbe = `"ensureUserActor`";`nvoid __cureProbe;`nexport const productOfferingService = {" } },
    @{ Name = 'P7 discovery ignora KYB';
       File = 'src/modules/marketplace/product-visibility.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("mfi.kyb_status = 'approved'"), "1=1" } },
    @{ Name = 'P8 dedup de media hash removido';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("let blob = await this.findBlobByHash(contentHash);"), "let blob = null as MediaBlob | null;" } }
)

$allOk = $true
foreach ($p in $proofs) {
    $path = Resolve-Path $p.File
    $shaBefore = Get-Sha $path
    $original = [System.IO.File]::ReadAllText($path)
    $mutated = & $p.Inject $original
    if ($mutated -eq $original) { Write-Host "[$($p.Name)] INJECAO NAO ALTEROU O ARQUIVO — prova invalida" -ForegroundColor Red; $allOk = $false; continue }
    [System.IO.File]::WriteAllText($path, $mutated)

    node scripts/audit-canonical-catalog-closure.mjs *> $null
    $gateFailed = ($LASTEXITCODE -ne 0)

    [System.IO.File]::WriteAllText($path, $original)
    $shaAfter = Get-Sha $path
    $restored = ($shaAfter -eq $shaBefore)

    node scripts/audit-canonical-catalog-closure.mjs *> $null
    $gateOkAgain = ($LASTEXITCODE -eq 0)

    $ok = $gateFailed -and $restored -and $gateOkAgain
    if (-not $ok) { $allOk = $false }
    $status = if ($ok) { 'OK' } else { 'FALHOU' }
    Write-Host "[$($p.Name)] gateFail=$gateFailed restoredSha=$restored($shaAfter) gateOk=$gateOkAgain => $status"
}

if (-not $allOk) { Write-Host 'PROVAS NEGATIVAS: FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'PROVAS NEGATIVAS: 8/8 — gate derruba cada regressao; restauracao byte-identica.' -ForegroundColor Green
exit 0
