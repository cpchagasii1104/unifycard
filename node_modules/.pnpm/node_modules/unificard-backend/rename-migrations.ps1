param (
    [switch]$Apply
)

$planFile     = "migrations_plan.txt"
$migrationsDir = "migrations"

# ============================================================
# Função: Normalização de nomes LEGADOS (filesystem apenas)
# ============================================================
# ATENÇÃO:
# - O PLANO é explícito e NÃO é normalizado
# - A normalização serve APENAS para lidar com histórico legado
# - NÃO remove versionamento (_v2, _v3, etc.)
# - NÃO remove semântica
function Normalize-MigrationName {
    param ([string]$fileName)

    # Remove extensão
    $nameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($fileName)

    # Remove prefixos numéricos históricos (ex: 123_, 123_456_)
    $normalized = $nameWithoutExt -replace '^(\d+_)+', ''

    # Remove prefixos históricos tolerados
    $normalized = $normalized -replace '^create_', ''
    $normalized = $normalized -replace '^extend_', ''

    return $normalized
}

# ============================================================
# Validações iniciais
# ============================================================

if (!(Test-Path $planFile)) {
    Write-Error "Plano não encontrado: $planFile"
    exit 1
}

if (!(Test-Path $migrationsDir)) {
    Write-Error "Diretório não encontrado: $migrationsDir"
    exit 1
}

$plan = Get-Content $planFile | Where-Object { $_ -and $_ -notmatch '^\s*#' }

Write-Host "=== MIGRATIONS RENAME ==="
Write-Host "Modo:" ($Apply ? "APPLY (REAL)" : "DRY-RUN")
Write-Host ""

$hasErrors  = $false
$operations = @()

# ============================================================
# Fase 1 — Auditoria / Planejamento
# ============================================================

foreach ($line in $plan) {

    if ($line -match '^\d+_(.+)$') {

        $targetName   = $line
        $targetSuffix = $Matches[1]
        $targetBase   = [System.IO.Path]::GetFileNameWithoutExtension($targetSuffix)

        # Busca todos os arquivos existentes
        $allFiles = Get-ChildItem $migrationsDir -File

        # Matching SOMENTE no filesystem (normalizado)
        $existing = $allFiles | Where-Object {
            (Normalize-MigrationName $_.Name) -eq $targetBase
        }

        if ($existing.Count -eq 0) {
            Write-Host "⚠️  NÃO ENCONTRADO: *_$targetSuffix"
            $hasErrors = $true
            continue
        }

        if ($existing.Count -gt 1) {
            Write-Host "❌ AMBÍGUO (mais de um): *_$targetSuffix"
            $existing | ForEach-Object { Write-Host "   - $($_.Name)" }
            $hasErrors = $true
            continue
        }

        $sourcePath = $existing[0].FullName
        $sourceName = $existing[0].Name
        $targetPath = Join-Path $migrationsDir $targetName

        # Se já estiver correto, pular
        if ($sourceName -eq $targetName) {
            Write-Host "⏭️  JÁ CORRETO: $sourceName"
            continue
        }

        # Se destino já existir com outro arquivo → erro
        if (Test-Path $targetPath) {
            $existingTarget = Get-Item $targetPath
            if ($existingTarget.Name -ne $sourceName) {
                Write-Host "❌ DESTINO JÁ EXISTE (diferente): $targetName"
                Write-Host "   Source: $sourceName"
                Write-Host "   Target existente: $($existingTarget.Name)"
                $hasErrors = $true
                continue
            }
        }

        $operations += [pscustomobject]@{
            SourceName = $sourceName
            SourcePath = $sourcePath
            TargetName = $targetName
            TargetPath = $targetPath
        }

        Write-Host "DRY:" $sourceName "→" $targetName
    }
}

# ============================================================
# Fase 2 — Abort se APPLY com erros
# ============================================================

if ($Apply -and $hasErrors) {
    Write-Error "❌ Execução abortada: erros detectados no plano. Corrija antes de aplicar."
    exit 1
}

# ============================================================
# Fase 3 — Aplicação real
# ============================================================

if ($Apply) {

    Write-Host ""
    Write-Host "=== APLICANDO RENOMEAÇÕES ==="

    # Proteção contra renomeações cruzadas (A→B, B→C)
    $operations = $operations | Sort-Object { $_.SourceName.Length } -Descending

    foreach ($op in $operations) {
        Rename-Item $op.SourcePath $op.TargetPath
        Write-Host "✔️  RENOMEADO:" $op.SourceName "→" $op.TargetName
    }
}

# ============================================================
# Finalização
# ============================================================

Write-Host ""
Write-Host "=== FIM ==="

if (-not $Apply) {
    Write-Host "Nenhum arquivo foi alterado (dry-run)."
} else {
    Write-Host "Renomeações aplicadas com sucesso."
}
