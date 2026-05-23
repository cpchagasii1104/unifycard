$file = 'C:/unificard/backend/src/modules/core/core.service.ts'

# Verificar se o arquivo existe com esse nome
if (-not (Test-Path $file)) {
  # Tentar outros paths
  $candidates = @(
    'C:/unificard/backend/src/core/core.service.ts',
    'C:/unificard/backend/src/core/profile/core.service.ts'
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) { $file = $c; break }
  }
}
Write-Output "Arquivo: $file"

$content = Get-Content $file -Raw

# Substituir o catch simples por um que loga o erro completo
$old = "      } catch (err) {`r`n        console.error('Erro ao buscar perfil pessoal:', err);"
$new = "      } catch (err) {`r`n        console.error('DIAGNÓSTICO PERFIL PESSOAL - ERRO COMPLETO:', JSON.stringify({ message: err instanceof Error ? err.message : String(err), code: (err as any)?.code, stack: err instanceof Error ? err.stack?.substring(0,500) : undefined }));"

if ($content.Contains($old)) {
  $content = $content.Replace($old, $new)
  [System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Output "OK: log de diagnóstico adicionado"
} else {
  Write-Error "FAIL: bloco não encontrado — colar path correto do arquivo"
  exit 1
}
