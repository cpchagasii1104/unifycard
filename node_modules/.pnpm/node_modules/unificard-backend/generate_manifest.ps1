$files = Get-ChildItem -Path ".\migrations_archive\*.sql" -File | Sort-Object Name
$manifest = "# MANIFEST DE ARQUIVAMENTO`n`n"
$manifest += "Data: $(Get-Date -Format 'yyyy-MM-dd')`n"
$manifest += "Total de arquivos: $($files.Count)`n"
$manifest += "Localização: backend/migrations_archive/`n`n"
$manifest += "## Lista Completa`n`n"
$manifest += "| # | Arquivo | Hash SHA256 |`n"
$manifest += "|---|---------|-------------|`n"

$counter = 1
foreach ($file in $files) {
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
    $num = $counter.ToString().PadLeft(3, '0')
    $manifest += "| $num | $($file.Name) | $hash |`n"
    $counter++
}

$manifest += "`n## Motivo`n"
$manifest += "Rebase Constitucional - histórico preservado, não será executado.`n"

$manifest | Out-File -FilePath "..\docs\04_audit\MIGRATIONS_ARCHIVE_MANIFEST.md" -Encoding UTF8

Write-Host "Manifest criado com $($files.Count) arquivos"

