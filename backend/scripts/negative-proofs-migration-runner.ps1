# negative-proofs-migration-runner.ps1 — provas negativas
# F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE (GO secao 10, N1-N6).
# Para cada regressao: injeta -> gate audit-migration-runner-isolation DEVE
# FALHAR -> restaura byte-a-byte (sha256 verificado) -> gate volta a passar.
# Uso: pwsh -File scripts/negative-proofs-migration-runner.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..

function Get-Sha($path) { (Get-FileHash $path -Algorithm SHA256).Hash.ToLower() }
function Invoke-Gate {
    node scripts/audit-migration-runner-isolation.mjs *> $null
    return $LASTEXITCODE
}

$proofs = @(
    @{ Name = 'N1 MIGRATION_STOP_BEFORE reintroduzido no runner produtivo';
       File = 'src/core/db/migrate.ts';
       Inject = { param($c) $c + "`nconst __negN1 = process.env.MIGRATION_STOP_BEFORE;`nvoid __negN1;`n" } },
    @{ Name = 'N2 NODE_ENV=test removido do helper test-only';
       File = 'src/scripts/test-support/apply-migrations-before-for-test.ts';
       Inject = { param($c) $c -replace [regex]::Escape("if (process.env.NODE_ENV !== 'test') {"), "if (false) {" } },
    @{ Name = 'N3 protecao contra unificard_dev removida do helper';
       File = 'src/scripts/test-support/apply-migrations-before-for-test.ts';
       Inject = { param($c) $c -replace [regex]::Escape("if (expected === 'unificard_dev') {"), "if (false) {" } },
    @{ Name = 'N4 igualdade exata do target trocada por localeCompare frouxo';
       File = 'src/scripts/test-support/apply-migrations-before-for-test.ts';
       Inject = { param($c) $c -replace [regex]::Escape("m.filename === target"), "m.filename.localeCompare(target) >= 0" } },
    @{ Name = 'N5 target inexistente deixa de falhar (recusa removida)';
       File = 'src/scripts/test-support/apply-migrations-before-for-test.ts';
       Inject = { param($c) $c -replace [regex]::Escape("refuse('TARGET_NOT_FOUND'"), "console.log('ignored'" } },
    @{ Name = 'N6 mensagem "todas executadas" antecipada (pending > 0 viraria sucesso)';
       File = 'src/core/db/migrate.ts';
       Inject = { param($c) $c -replace [regex]::Escape("    // VERIFICAÇÃO FINAL FAIL-CLOSED"), "    console.log('✨ Todas as migrações pendentes foram EXECUTADAS com sucesso!');`n    // VERIFICAÇÃO FINAL FAIL-CLOSED" } }
)

$allOk = $true
foreach ($p in $proofs) {
    $path = Resolve-Path $p.File
    $shaBefore = Get-Sha $path
    $original = [System.IO.File]::ReadAllText($path)
    $mutated = & $p.Inject $original
    if ($mutated -eq $original) { Write-Host "[$($p.Name)] INJECAO NAO ALTEROU O ARQUIVO — prova invalida" -ForegroundColor Red; $allOk = $false; continue }
    [System.IO.File]::WriteAllText($path, $mutated)

    $gateFailed = ((Invoke-Gate) -ne 0)

    [System.IO.File]::WriteAllText($path, $original)
    $shaAfter = Get-Sha $path
    $restored = ($shaAfter -eq $shaBefore)

    $gateOkAgain = ((Invoke-Gate) -eq 0)

    $ok = $gateFailed -and $restored -and $gateOkAgain
    if (-not $ok) { $allOk = $false }
    $status = if ($ok) { 'OK' } else { 'FALHOU' }
    Write-Host "[$($p.Name)] gateFail=$gateFailed restoredSha=$restored($shaAfter) gateOk=$gateOkAgain => $status"
}

if (-not $allOk) { Write-Host 'PROVAS NEGATIVAS (migration-runner): FALHA' -ForegroundColor Red; exit 1 }
Write-Host 'PROVAS NEGATIVAS (migration-runner): 6/6 — gate derruba cada regressao; restauracao byte-identica.' -ForegroundColor Green
exit 0
