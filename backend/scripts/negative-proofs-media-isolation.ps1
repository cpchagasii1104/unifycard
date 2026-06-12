# negative-proofs-media-isolation.ps1 — provas negativas do isolamento de mídia
# (F-CANONICAL-MEDIA-BLOB-ASSET-TENANT-ISOLATION-CLOSURE §15).
# Para cada regressão: injeta → gate canônico DEVE FALHAR → restaura byte-a-byte
# (sha256 verificado) → gate volta a passar. Working tree termina limpo.
# NUNCA commitar este estado intermediário. Uso: pwsh -File scripts/negative-proofs-media-isolation.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Get-Sha($path) { (Get-FileHash $path -Algorithm SHA256).Hash.ToLower() }

$proofs = @(
    @{ Name = 'P1 predicate de tenant/visibility removido do metadata reader';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("asset.originTenantId === ctx.tenantId"), "true" } },
    @{ Name = 'P2 authorization removida do file reader';
       File = 'src/core/media-assets/media-assets.routes.ts';
       Inject = { param($c) $c -replace [regex]::Escape("readContentAuthorized("), "readContentUnsafe(" } },
    @{ Name = 'P3 attach/business aceita asset logico cross-tenant';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("MEDIA_ASSET_FOREIGN"), "MEDIA_ASSET_ALLOWED" } },
    @{ Name = 'P4 moderation_status movida para media_blobs';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c + "`nconst __negBlobModerationProbe = `"UPDATE media_blobs SET moderation_status = 'approved'`";`nvoid __negBlobModerationProbe;`n" } },
    @{ Name = 'P5 colisao de hash devolve o asset do primeiro uploader';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("this.findAssetByBlobAndContext(blob.id, input.tenantId"), "this.findAssetByBlobAnyContext(blob.id" } },
    @{ Name = 'P6 compensacao apaga blob compartilhado';
       File = 'src/core/media-assets/media-asset.service.ts';
       Inject = { param($c) $c -replace [regex]::Escape("deleteBlobIfUnreferenced"), "deleteBlobAlways" } }
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

if (-not $allOk) { Write-Host 'PROVAS NEGATIVAS (media isolation): FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'PROVAS NEGATIVAS (media isolation): 6/6 — gate derruba cada regressao; restauracao byte-identica.' -ForegroundColor Green
exit 0
