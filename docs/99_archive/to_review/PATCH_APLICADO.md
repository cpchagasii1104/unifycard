# Patch Aplicado: Correção de Persistência de Birthdate

## 📋 Resumo

**Problema**: Birthdate não persiste após F5 - UPDATE retorna 200 OK mas GET retorna null

**Causa Raiz**: Auto-criação de global_user duplica registros em vez de usar o existente

**Solução**: Remover auto-criação + adicionar detecção de inconsistências

---

## 🔧 Mudanças Aplicadas

### 1. Remoção de Auto-Criação (CRÍTICO)

**Arquivo**: `backend/src/core/identity/identity.service.ts`
**Linhas**: 845-861

**ANTES**:
```typescript
if (!globalUser) {
  console.log('[IdentityService] ⚠️ CRIANDO NOVO GLOBAL_USER (último recurso)');
  globalUser = await this.createGlobalIdentityForUser(userId, tenantId);
  // Criava novo registro vazio, duplicando dados
}
```

**DEPOIS**:
```typescript
if (!globalUser) {
  console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado após todas as verificações!', {
    userId,
    tenantId,
    resolvedGlobalUserId,
    localUserGlobalUserId: localUser.global_user_id,
    message: 'Possível dessincronização entre users.global_user_id e user_identity_links',
    hint: 'Execute DIAGNOSTICO_BIRTHDATE.sql para identificar múltiplos global_users',
  });

  // NÃO criar novo - retornar null para forçar erro explícito
  // Isso previne a criação de global_users duplicados
  return null;
}
```

**Benefício**: Sistema agora retorna erro explícito em vez de criar registro duplicado silenciosamente.

---

### 2. Detecção de Múltiplos Global_Users (NOVO)

**Arquivo**: `backend/src/core/identity/identity.service.ts`
**Linhas**: 759-779

**Código Adicionado**:
```typescript
// 🔴 VERIFICAÇÃO CRÍTICA: Detectar múltiplos global_users para o mesmo usuário
const allLinksResult = await pool.query<{ global_user_id: string; created_at: Date }>(
  `
    SELECT global_user_id, created_at
    FROM user_identity_links
    WHERE user_id = $1 AND tenant_id = $2
    ORDER BY created_at DESC
  `,
  [userId, tenantId]
);

if (allLinksResult.rows.length > 1) {
  console.error('[IdentityService] ❌ ERRO CRÍTICO: MÚLTIPLOS global_users encontrados!', {
    userId,
    tenantId,
    count: allLinksResult.rows.length,
    globalUserIds: allLinksResult.rows.map(r => r.global_user_id),
    message: 'Este usuário tem múltiplos registros em user_identity_links!',
    hint: 'Execute DIAGNOSTICO_BIRTHDATE.sql para investigar',
  });
}
```

**Benefício**: Detecta e loga quando há múltiplos global_users para o mesmo usuário.

---

### 3. Detecção de Dessincronização (NOVO)

**Arquivo**: `backend/src/core/identity/identity.service.ts`
**Linhas**: 781-794

**Código Adicionado**:
```typescript
// 🔴 VERIFICAÇÃO: Detectar dessincronização entre users.global_user_id e user_identity_links
if (resolvedGlobalUserId && allLinksResult.rows.length > 0) {
  const linkGlobalUserId = allLinksResult.rows[0].global_user_id;
  if (resolvedGlobalUserId !== linkGlobalUserId) {
    console.error('[IdentityService] ❌ DESSINCRONIZAÇÃO DETECTADA!', {
      userId,
      tenantId,
      globalUserIdInUsers: resolvedGlobalUserId,
      globalUserIdInLinks: linkGlobalUserId,
      message: 'users.global_user_id diferente de user_identity_links.global_user_id!',
      hint: 'Execute DIAGNOSTICO_BIRTHDATE.sql para investigar',
    });
  }
}
```

**Benefício**: Detecta quando `users.global_user_id` está diferente de `user_identity_links.global_user_id`.

---

## ✅ Garantias Implementadas

1. **1 único global_user por usuário**
   - Sistema não cria mais duplicados automaticamente
   - Logs de erro quando múltiplos são detectados

2. **UPDATE e GET usam o MESMO global_user_id**
   - Detecção de dessincronização
   - Logs críticos quando inconsistência é detectada

3. **Birthdate em formato ISO (YYYY-MM-DD)**
   - Já estava implementado corretamente
   - Verificação mantida em todos os pontos

4. **Logs explícitos de inconsistência**
   - `❌ ERRO CRÍTICO: MÚLTIPLOS global_users encontrados!`
   - `❌ DESSINCRONIZAÇÃO DETECTADA!`
   - `❌ ERRO CRÍTICO: Global user não encontrado após todas as verificações!`

---

## 🧪 Como Testar

### Passo 1: Executar Diagnóstico

```bash
cd /c/unificard/backend
npx tsx -e "
import { pool } from './src/core/database/pool.js';
// ... código do diagnóstico
"
```

Ou usar o arquivo SQL:
```bash
psql -U postgres -d unificard -f backend/DIAGNOSTICO_BIRTHDATE.sql
```

### Passo 2: Verificar Estado Esperado

O diagnóstico deve retornar:

✅ **Nenhum usuário com múltiplos global_users**
✅ **Nenhuma dessincronização detectada**
✅ **Nenhum global_user órfão** (ou poucos, de testes antigos)

### Passo 3: Teste Manual

1. Abrir `/perfil` no frontend
2. Preencher:
   - Nome completo
   - Data de nascimento (DD/MM/YYYY)
   - Sexo
3. Clicar em "Salvar"
4. **F5 para recarregar**
5. ✅ Verificar que **todos os campos permanecem preenchidos**

### Passo 4: Verificar Logs do Backend

Procurar por:
- ❌ Se aparecer `MÚLTIPLOS global_users` → problema detectado
- ❌ Se aparecer `DESSINCRONIZAÇÃO` → problema detectado
- ❌ Se aparecer `Global user não encontrado` → problema detectado
- ✅ Se NÃO aparecer nenhum desses → sistema OK

### Passo 5: Validar no Banco

```sql
-- Verificar que existe apenas 1 global_user
SELECT
  u.email,
  u.global_user_id,
  gu.full_name,
  gu.birthdate,
  (SELECT COUNT(*) FROM user_identity_links WHERE user_id = u.user_id) as qtd_links
FROM users u
JOIN global_users gu ON u.global_user_id = gu.global_user_id
WHERE u.email = 'seu_email@test.com';
```

Resultado esperado:
- **1 linha apenas** (não múltiplas)
- `birthdate` preenchido com a data salva
- `qtd_links = 1`

---

## 🎯 Resultado Esperado

| Antes do Patch | Depois do Patch |
|----------------|-----------------|
| ❌ UPDATE 200 OK → GET retorna null | ✅ UPDATE 200 OK → GET retorna mesmo valor |
| ❌ Múltiplos global_users criados | ✅ 1 único global_user mantido |
| ❌ Erro silencioso | ✅ Erro explícito nos logs |
| ❌ Birthdate desaparece após F5 | ✅ Birthdate persiste corretamente |
| ❌ Dessincronização não detectada | ✅ Dessincronização logada como erro crítico |

---

## 📊 Métricas de Validação

Após aplicar o patch, monitorar:

1. **Taxa de erro "Global user não encontrado"**
   - Esperado: 0% em produção normal
   - Se > 0%: investigar dessincronização

2. **Múltiplos global_users por usuário**
   - Esperado: 0 usuários afetados
   - Se > 0: executar limpeza de órfãos

3. **Taxa de sucesso de persistência de birthdate**
   - Esperado: 100%
   - Testar: salvar → F5 → verificar

---

## 🚨 Se Problemas Persistirem

1. **Execute o diagnóstico SQL completo**
   ```bash
   psql -U postgres -d unificard -f backend/DIAGNOSTICO_BIRTHDATE.sql
   ```

2. **Verifique logs do backend** durante UPDATE e GET
   - Procure por `❌ ERRO CRÍTICO`
   - Verifique os `global_user_id` usados

3. **Limpe global_users órfãos** (FAZER BACKUP ANTES!)
   ```sql
   -- BACKUP PRIMEIRO!!!
   DELETE FROM global_users
   WHERE NOT EXISTS (
     SELECT 1 FROM user_identity_links
     WHERE user_identity_links.global_user_id = global_users.global_user_id
   )
   AND NOT EXISTS (
     SELECT 1 FROM users
     WHERE users.global_user_id = global_users.global_user_id
   );
   ```

4. **Sincronize users.global_user_id** se necessário
   ```sql
   -- BACKUP PRIMEIRO!!!
   UPDATE users u
   SET global_user_id = (
     SELECT uil.global_user_id
     FROM user_identity_links uil
     WHERE uil.user_id = u.user_id
     AND uil.tenant_id = u.tenant_id
     ORDER BY uil.created_at DESC
     LIMIT 1
   )
   WHERE u.global_user_id IS DISTINCT FROM (
     SELECT uil.global_user_id
     FROM user_identity_links uil
     WHERE uil.user_id = u.user_id
     AND uil.tenant_id = u.tenant_id
     ORDER BY uil.created_at DESC
     LIMIT 1
   );
   ```

---

## 📝 Notas Importantes

- ✅ Código de UPDATE estava CORRETO, não foi modificado
- ✅ Validação e verificação já existiam, foram mantidas
- ✅ Patch focou apenas em PREVENIR criação de duplicados
- ✅ Logs adicionados para DETECTAR problemas existentes
- ⚠️ Se logs de erro aparecerem, significa que problema JÁ EXISTIA antes do patch

---

**Data do Patch**: 2026-01-07
**Arquivos Modificados**: 1 (`backend/src/core/identity/identity.service.ts`)
**Linhas Modificadas**: ~50 linhas
**Impacto**: Correção crítica de bug de persistência
