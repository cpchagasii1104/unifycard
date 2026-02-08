# =========================================================
# GATE: NOMENCLATURA CANÔNICA
# MODO: DRY-RUN (NÃO ALTERA ARQUIVOS)
# ESCOPO: backend/src (allowlist V2)
# LOCAL: docs/03_execution_log
# =========================================================

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------
# RESOLUÇÃO DE CAMINHOS
# ---------------------------------------------------------
$ExecutionLogDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot     = Resolve-Path (Join-Path $ExecutionLogDir "..\..")
Set-Location $ProjectRoot

$TargetRoot = Join-Path $ProjectRoot "backend\src"

# ---------------------------------------------------------
# LOG
# ---------------------------------------------------------
$LogDir  = Join-Path $ProjectRoot "docs\03_execution_log"
$LogFile = Join-Path $LogDir "nomenclatura_dry_run_v2.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
"=== NOMENCLATURA DRY-RUN V2 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" |
  Out-File -FilePath $LogFile -Encoding UTF8

function Log {
  param([string]$Message)
  $Message | Tee-Object -FilePath $LogFile -Append
}

# ---------------------------------------------------------
# ALLOWLIST — PASTAS (V2)
# ÚNICA ALTERAÇÃO EM RELAÇÃO AO V1
# ---------------------------------------------------------
$AllowedFolders = @(
  "\types\",
  "\dto\",
  "\dtos\",
  "\mappers\"
)

# ---------------------------------------------------------
# ALLOWLIST — ARQUIVOS
# ---------------------------------------------------------
$AllowedFilePatterns = @(
  "*.types.ts",
  "*.dto.ts",
  "*.interface.ts",
  "*.enum.ts",
  "*Enum.ts",
  "*Mapper.ts",
  "*.map.ts"
)

function Normalize-PathString {
  param([string]$Path)
  return ($Path -replace '/', '\').ToLowerInvariant()
}

function IsAllowedFolder {
  param([string]$FullPath)
  $p = Normalize-PathString $FullPath
  foreach ($folder in $AllowedFolders) {
    if ($p.Contains((Normalize-PathString $folder))) { return $true }
  }
  return $false
}

function IsAllowedFileName {
  param([string]$FileName)
  foreach ($pattern in $AllowedFilePatterns) {
    if ($FileName -like $pattern) { return $true }
  }
  return $false
}

# ---------------------------------------------------------
# SUBSTITUIÇÕES MECÂNICAS (1 → 1)
# ---------------------------------------------------------
$Replacements = @(
  @{ Pattern = "([a-z0-9])_id\b";     Replace = '$1Id'     },
  @{ Pattern = "([a-z0-9])_at\b";     Replace = '$1At'     },
  @{ Pattern = "([a-z0-9])_cents\b";  Replace = '$1Cents'  },
  @{ Pattern = "([a-z0-9])_bps\b";    Replace = '$1Bps'    },
  @{ Pattern = "([a-z0-9])_score\b";  Replace = '$1Score'  },
  @{ Pattern = "([a-z0-9])_rating\b"; Replace = '$1Rating' },
  @{ Pattern = "([a-z0-9])_count\b";  Replace = '$1Count'  }
)

# ---------------------------------------------------------
# COLETA DE ARQUIVOS (ESCOPO FECHADO)
# ---------------------------------------------------------
$Files = Get-ChildItem -Path $TargetRoot -Recurse -File | Where-Object {
  (IsAllowedFileName $_.Name) -and (IsAllowedFolder $_.FullName)
}

Log "TargetRoot: $TargetRoot"
Log "Arquivos analisados (allowlist V2): $($Files.Count)"

# ---------------------------------------------------------
# DRY-RUN (NÃO ESCREVE)
# ---------------------------------------------------------
foreach ($file in $Files) {
  $Original = Get-Content -Path $file.FullName -Raw
  $Modified = $Original

  foreach ($rule in $Replacements) {
    $Modified = [regex]::Replace($Modified, $rule.Pattern, $rule.Replace)
  }

  if ($Modified -ne $Original) {
    Log "----------------------------------------"
    Log "ARQUIVO: $($file.FullName)"
    Log "ALTERACOES DETECTADAS (DRY-RUN V2)"
  }
}

Log "=== FIM DO DRY-RUN V2 ==="
Write-Host "Dry-run V2 concluído com sucesso." -ForegroundColor Cyan
Write-Host "Ver log em: $LogFile" -ForegroundColor Cyan
