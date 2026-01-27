param (
    [switch]$DryRun
)

# -------------------------------------------------------------------
# PATHS ROBUSTOS (baseados no local do script, não no pwd)
# -------------------------------------------------------------------
$BasePath      = Split-Path -Parent $MyInvocation.MyCommand.Path
$NormativePath = Join-Path $BasePath "01_normative"
$GuidesPath    = Join-Path $BasePath "04_guides"
$LogFile       = Join-Path $BasePath "normative_fix.log"

# -------------------------------------------------------------------
# SANITY CHECK
# -------------------------------------------------------------------
if (!(Test-Path $NormativePath)) {
    Write-Error "Normative path not found: $NormativePath"
    exit 1
}

if (!(Test-Path $GuidesPath)) {
    Write-Host "Creating $GuidesPath"
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $GuidesPath | Out-Null
    }
}

# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------
function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$timestamp | $msg"
    Write-Host $line
    if (-not $DryRun) {
        Add-Content -Path $LogFile -Value $line
    }
}

function HasHeader($content) {
    return ($content -match "(?m)^Status:\s")
}

Log "Starting normalization (DryRun=$DryRun)"

# -------------------------------------------------------------------
# MAIN LOOP
# -------------------------------------------------------------------
Get-ChildItem -Path $NormativePath -Recurse -Filter "*.md" | ForEach-Object {

    $file = $_
    $content = Get-Content $file.FullName -Raw

    # ---------------------------------------------------------------
    # RULE 1 — NON-NORMATIVE FILES
    # ---------------------------------------------------------------
    if (
        $file.Name -match "_RESUMO\.md$" -or
        $file.Name -match "_GUIDE\.md$" -or
        $file.Name -eq "CANONICAL_CONTEXT_FOR_AI.md"
    ) {

        Log "NON-NORMATIVE detected: $($file.Name)"

        $header = @"
Status: NON-NORMATIVE
Purpose: Explanation only
Authority: None

"@

        if (-not (HasHeader $content)) {
            Log "  -> Adding NON-NORMATIVE header"
            if (-not $DryRun) {
                Set-Content -Path $file.FullName -Value ($header + $content)
            }
        }

        $target = Join-Path $GuidesPath $file.Name
        Log "  -> Moving to 04_guides"

        if (-not $DryRun) {
            Move-Item -Path $file.FullName -Destination $target -Force
        }

        return
    }

    # ---------------------------------------------------------------
    # RULE 2 — CORE / SUBORDINATED WITHOUT HEADER
    # ---------------------------------------------------------------
    if (-not (HasHeader $content)) {

        Log "Missing header: $($file.Name)"

        $status = "SUBORDINATED"
        if ($file.Name -match "^CORE_") {
            $status = "CORE"
        }

        $domain = "UNKNOWN"
        if ($file.Name -match "CATEGORY")   { $domain = "Categories" }
        elseif ($file.Name -match "FINANC") { $domain = "Financial" }
        elseif ($file.Name -match "OBSERV") { $domain = "Observability" }
        elseif ($file.Name -match "IDENT")  { $domain = "Identity" }

        $governing = "CORE_IMUTAVEL.md"
        if ($status -eq "SUBORDINATED") {
            if ($domain -eq "Categories")       { $governing = "CORE_CATEGORY_CONTRACT.md" }
            elseif ($domain -eq "Financial")    { $governing = "CORE_FINANCIAL_CONTRACT.md" }
            elseif ($domain -eq "Observability"){ $governing = "CORE_OBSERVABILITY_CONTRACT.md" }
            elseif ($domain -eq "Identity")     { $governing = "CORE_IDENTITY_AND_ACTORS_CONTRACT.md" }
        }

        $header = @"
Status: $status
Domain: $domain
Governing Contract: $governing

"@

        Log "  -> Inserting header: Status=$status Domain=$domain Governing=$governing"

        if (-not $DryRun) {
            Set-Content -Path $file.FullName -Value ($header + $content)
        }
    }
}

Log "Normalization completed."
