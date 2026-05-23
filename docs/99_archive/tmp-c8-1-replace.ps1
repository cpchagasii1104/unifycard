git -C C:/unificard restore -- backend/src/modules/groups/groups.repository.ts

$file = 'C:/unificard/backend/src/modules/groups/groups.repository.ts'
$content = Get-Content $file -Raw

$oldLines = @(
  '    // 🔴 CORREÇÃO: Gerar slug explicitamente para evitar ambiguidade de tipo  '
  '    let finalSlug = input.slug || null;'
  '    if (!finalSlug) {'
  '      try {'
  '        const slugResult = await runQueryWithTenant<{ slug: string }>('
  '          tenantId,'
  '          `SELECT generate_group_slug($1::text, $2::uuid) as slug`,'
  '          [input.name, tenantId]'
  '        );'
  '        finalSlug = slugResult?.slug || null;'
  '      } catch (err) {'
  '        // Se função falhar, slug será NULL (aceitável)'
  '        console.warn(''Erro ao gerar slug, usando NULL:'', err);'
  '        finalSlug = null;'
  '      }'
  '    }'
)
$oldPattern = '(?ms)^    // 🔴 CORREÇÃO: Gerar slug explicitamente para evitar ambiguidade de tipo\s*\r?\n    let finalSlug = input\.slug \|\| null;\s*\r?\n    if \(!finalSlug\) \{\s*\r?\n      try \{\s*\r?\n        const slugResult = await runQueryWithTenant<\{ slug: string \}>\(\s*\r?\n          tenantId,\s*\r?\n          `SELECT generate_group_slug\(\$1::text, \$2::uuid\) as slug`,\s*\r?\n          \[input\.name, tenantId\]\s*\r?\n        \);\s*\r?\n        finalSlug = slugResult\?\.slug \|\| null;\s*\r?\n      \} catch \(err\) \{\s*\r?\n        // Se função falhar, slug será NULL \(aceitável\)\s*\r?\n        console\.warn\(''Erro ao gerar slug, usando NULL:'', err\);\s*\r?\n        finalSlug = null;\s*\r?\n      \}\s*\r?\n    \}'

$newLines = @(
  '    // Gerar slug em TypeScript (generate_group_slug não existe no schema Gênesis)'
  '    let finalSlug = input.slug || null;'
  '    if (!finalSlug) {'
  '      const baseSlug = input.name'
  '        .toLowerCase()'
  '        .normalize(''NFD'')'
  '        .replace(/[\u0300-\u036f]/g, '''')'
  '        .replace(/[^a-z0-9]+/g, ''-'')'
  '        .replace(/^-+|-+$/g, '''')'
  '        .replace(/-+/g, ''-'')'
  '        .substring(0, 60) || ''grupo'';'
  ''
  '      finalSlug = baseSlug;'
  '    }'
)
$new = [string]::Join("`r`n", $newLines)

if ($content -match $oldPattern) {
  $content = [regex]::Replace(
    $content,
    $oldPattern,
    [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $new },
    1
  )
  Set-Content $file $content -NoNewline
  Write-Output 'OK: bloco substituído'
} else {
  Write-Error 'FAIL: bloco alvo não encontrado — abortando'
  exit 1
}

$checkContent = Get-Content $file -Raw
if ($checkContent -match 'SELECT generate_group_slug|generate_group_slug\(') {
  Write-Error 'FAIL: ainda existe generate_group_slug no arquivo'
  exit 1
}
Write-Output 'OK: nenhuma referência a generate_group_slug restante'

git -C C:/unificard diff -- backend/src/modules/groups/groups.repository.ts
