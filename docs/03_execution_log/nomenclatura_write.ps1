# =========================================================
# GATE: NOMENCLATURA CANÔNICA
# MODO: WRITE (EXECUÇÃO REAL)
# ESCOPO: backend/src (allowlist estrita)
# BACKUP + LOG OBRIGATÓRIOS
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
# LOG E BACKUP
# ---------------------------------------------------------
$LogDir    = Join-Path $ProjectRoot "docs\03_execution_log"
$LogFile   = Join-Path $LogDir "nomenclatura_write.log"
$BackupDir = Join-Path $LogDir "backup_nomenclatura_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

New-Item -ItemType Directory -Force -Path $LogDir, $BackupDir | Out-Null

"=== NOMENCLATURA WRITE $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" |
  Out-File -FilePath $LogFile -Encoding UTF8

function Log {
  param([string]$Message)
  $Message | Tee-Object -FilePath $LogFile -Append
}

# ---------------------------------------------------------
# ALLOWLIST — PASTAS
# ---------------------------------------------------------
$AllowedFolders = @(
  "\dto\",
  "\dtos\",
  "\types\",
  "\interfaces\",
  "\enums\",
  "\mappers\"
)

# ---------------------------------------------------------
# ALLOWLIST — ARQUIVOS
# ---------------------------------------------------------
$AllowedFilePatterns = @(
  "*.dto.ts",
  "*.types.ts",
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
# SUBSTITUIÇÕES MECÂNICAS
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
Log "Arquivos elegíveis: $($Files.Count)"

# ---------------------------------------------------------
# EXECUÇÃO REAL
# ---------------------------------------------------------
foreach ($file in $Files) {

  $Original = Get-Content -Path $file.FullName -Raw
  $Modified = $Original

  foreach ($rule in $Replacements) {
    $Modified = [regex]::Replace($Modified, $rule.Pattern, $rule.Replace)
  }

  if ($Modified -ne $Original) {

    # Backup
    $BackupPath = Join-Path $BackupDir ($file.FullName.Replace($ProjectRoot.Path, "").TrimStart("\"))
    $BackupFolder = Split-Path $BackupPath -Parent
    New-Item -ItemType Directory -Force -Path $BackupFolder | Out-Null
    Copy-Item -Path $file.FullName -Destination $BackupPath -Force

    # Write
    Set-Content -Path $file.FullName -Value $Modified -Encoding UTF8

    Log "MODIFIED: $($file.FullName)"
  }
}

Log "=== FIM DA EXECUÇÃO ==="
Write-Host "Execução concluída com sucesso." -ForegroundColor Green
Write-Host "Backup em: $BackupDir" -ForegroundColor Yellow
Write-Host "Log em: $LogFile" -ForegroundColor Cyan
