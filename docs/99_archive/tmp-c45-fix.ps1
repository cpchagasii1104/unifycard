$file = 'C:/unificard/backend/src/modules/groups/groups.service.ts'
$lines = Get-Content $file

# PARTE 1: Adicionar import de ensureUserActor após o último import existente
# O último import é: import type { Group, ... } from './groups.types';
$lines = $lines -replace "^(import type \{ Group,.*groups\.types';)$", "`$1`nimport { ensureUserActor } from '@modules/identity/actor-writer.service';"

# PARTE 2: Inserir chamada a ensureUserActor antes do create() e corrigir o argumento
$lines = $lines -replace "    // Criar grupo`r?`n    const group = await groupsRepository\.create\(tenantId, ownerUserId, input\);", @"
    // Resolver actor canônico antes de criar grupo (§4.8.1)
    const ownerActor = await ensureUserActor(tenantId, ownerUserId);

    // Criar grupo
    const group = await groupsRepository.create(tenantId, ownerActor.actor_id, input);
"@

# PARTE 3: Substituir dynamic import de actorRepository por uso de ownerActor (já no escopo)
$lines = $lines -replace "        const \{ actorRepository \} = await import\('@modules/social/actor\.repository'\);", "        // actorRepository removido: ownerActor já resolvido antes do create (§4.8.1)"
$lines = $lines -replace "        const actor = await actorRepository\.findOrCreateUserActor\(tenantId, ownerUserId\);", "        const actor = ownerActor; // reutiliza actor resolvido antes do create"

$lines | Set-Content $file

# Validação
$check = Get-Content $file -Raw
$fail = $false

if (-not ($check -match "import \{ ensureUserActor \}")) {
  Write-Error "FAIL: import ensureUserActor não encontrado"
  $fail = $true
}
if (-not ($check -match "ensureUserActor\(tenantId, ownerUserId\)")) {
  Write-Error "FAIL: chamada a ensureUserActor não encontrada"
  $fail = $true
}
if (-not ($check -match "groupsRepository\.create\(tenantId, ownerActor\.actor_id")) {
  Write-Error "FAIL: create() não usa ownerActor.actor_id"
  $fail = $true
}
if ($check -match "actorRepository\.findOrCreateUserActor") {
  Write-Error "FAIL: findOrCreateUserActor direto ainda existe"
  $fail = $true
}
if ($check -match "await import\('@modules/social/actor\.repository'\)") {
  Write-Error "FAIL: dynamic import de actorRepository ainda existe"
  $fail = $true
}
if ($fail) { exit 1 }

Write-Output "OK: C45 aplicado"
Write-Output "ensureUserActor: $(([regex]::Matches($check, 'ensureUserActor')).Count) ocorrências"
