$file = 'C:/unificard/backend/src/modules/groups/groups.repository.ts'
$content = Get-Content $file -Raw

# 1. Interface GroupRow: is_active: boolean → status: string
$content = [regex]::Replace($content, '\bis_active:\s*boolean;', 'status: string;')

# 2. toGroup(): isActive: row.is_active → isActive: row.status === 'active'
$content = [regex]::Replace($content, "isActive:\s*row\.is_active,", "isActive: row.status === 'active',")

# 3. SELECTs coluna simples: ", is_active, " → ", status, "
$content = [regex]::Replace($content, ',\s*is_active,\s*profit_percentage', ', status, profit_percentage')
$content = [regex]::Replace($content, 'g\.is_active,\s*g\.profit_percentage', 'g.status, g.profit_percentage')

# 4. Filtro WHERE AND is_active = $N → AND status = $N
$content = [regex]::Replace($content, 'AND is_active = \$', 'AND status = $')

# 5. Update dinâmico: is_active = $N++ → status = $N++
$content = [regex]::Replace($content, '`is_active = \$\$\{paramIndex\+\+\}`', '`status = ${paramIndex++}`')

# 6. SET is_active = false → SET status = 'inactive'
$content = [regex]::Replace($content, "SET is_active = false", "SET status = 'inactive'")

# 7. WHERE g.is_active = true → WHERE g.status = 'active'
$content = [regex]::Replace($content, "g\.is_active = true", "g.status = 'active'")

Set-Content $file $content -NoNewline

# Validação: não deve restar is_active no arquivo
$check = Get-Content $file -Raw
$fail = $false

# Verificar residuais (excluindo parâmetros de API que são corretos manter)
$residuals = [regex]::Matches($check, '\bis_active\b') | ForEach-Object { $_.Value }
if ($residuals.Count -gt 0) {
  Write-Error "FAIL: ainda existe is_active no arquivo ($($residuals.Count) ocorrências)"
  [regex]::Matches($check, '.{40}\bis_active\b.{40}') | ForEach-Object { Write-Host "  contexto: $($_.Value)" }
  $fail = $true
}
if ($fail) { exit 1 }

Write-Output "OK: is_active substituído"
Write-Output "Contagem 'status' SQL: $(([regex]::Matches($check, '\bstatus\b')).Count)"
Write-Output "Contagem 'row.status': $(([regex]::Matches($check, 'row\.status')).Count)"