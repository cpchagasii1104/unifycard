# ------------------------------------------------------------
# FIX CORE INFLATION — UnifiCard
# Corrige Status: CORE indevido
# NÃO move arquivos
# NÃO apaga conteúdo
# Cria backup .bak
# ------------------------------------------------------------

param (
    [switch]$DryRun
)

# Base do script (não depende de cd)
$BasePath      = Split-Path -Parent $MyInvocation.MyCommand.Path
$NormativePath = Join-Path $BasePath "01_normative"

if (-not (Test-Path $NormativePath)) {
    Write-Error "01_normative não encontrado em $NormativePath"
    exit 1
}

# COREs FUNDACIONAIS (únicos que podem ser CORE Level 1)
$AllowedCoreContracts = @(
    "CORE_IMUTAVEL.md",
    "CORE_CATEGORY_CONTRACT.md",
    "CORE_FINANCIAL_CONTRACT.md",
    "CORE_TEMPORAL_CONTRACT.md",
    "CORE_IDENTITY_AND_ACTORS_CONTRACT.md",
    "CORE_OBSERVABILITY_CONTRACT.md"
)

Write-Host "Starting CORE inflation fix (DryRun=$DryRun)"
Write-Host "Normative path: $NormativePath"
Write-Host ""

Get-ChildItem $NormativePath -Recurse -Filter "*.md" | ForEach-Object {

    $file = $_
    $content = Get-Content $file.FullName -Raw

    # Só age se estiver marcado como CORE e não for CORE fundacional
    if ($content -match "(?m)^Status:\s*CORE" -and -not ($AllowedCoreContracts -contains $file.Name)) {

        Write-Host "Fixing CORE inflation in $($file.Name)"

        if (-not $DryRun) {
            # Backup de segurança
            Copy-Item $file.FullName "$($file.FullName).bak" -Force
        }

        # Rebaixar Status
        $content = $content -replace "(?m)^Status:\s*CORE", "Status: SUBORDINATED"

        # Ajustar Governing Contract por domínio (heurística segura)
        if ($file.Name -match "FINANC") {
            $content = $content -replace "(?m)^Governing Contract:.*", "Governing Contract: CORE_FINANCIAL_CONTRACT.md"
        }
        elseif ($file.Name -match "TEMPORAL") {
            $content = $content -replace "(?m)^Governing Contract:.*", "Governing Contract: CORE_TEMPORAL_CONTRACT.md"
        }
        elseif ($file.Name -match "IDENT") {
            $content = $content -replace "(?m)^Governing Contract:.*", "Governing Contract: CORE_IDENTITY_AND_ACTORS_CONTRACT.md"
        }
        elseif ($file.Name -match "OBSERV") {
            $content = $content -replace "(?m)^Governing Contract:.*", "Governing Contract: CORE_OBSERVABILITY_CONTRACT.md"
        }
        else {
            $content = $content -replace "(?m)^Governing Contract:.*", "Governing Contract: CORE_IMUTAVEL.md"
        }

        if (-not $DryRun) {
            Set-Content -Path $file.FullName -Value $content -NoNewline
        }
    }
}

Write-Host ""
Write-Host "CORE inflation fix completed."
