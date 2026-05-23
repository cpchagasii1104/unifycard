$files = Get-ChildItem -Path 'backend/migrations_archive' -File -Filter '*.sql' | Sort-Object Name
$manifest = @"
# MANIFEST DE ARQUIVAMENTO

Data: $(Get-Date -Format 'yyyy-MM-dd')
Total de arquivos: $($files.Count)
Localização: backend/migrations_archive/

## Lista Completa

| # | Arquivo | Hash SHA256 |
|---|---------|-------------|
"@

$num = 1
foreach ($file in $files) {
    $hash = (Get-FileHash $file.FullName -Algorithm SHA256).Hash
    $manifest += "`n| $($num.ToString().PadLeft(3, '0')) | $($file.Name) | $hash |"
    $num++
}

$manifest += @"

## Motivo
Rebase Constitucional - histórico preservado, não será executado.
"@

$manifest | Out-File -FilePath 'docs/04_audit/MIGRATIONS_ARCHIVE_MANIFEST.md' -Encoding UTF8
Write-Host "Manifest criado com $($files.Count) arquivos"
