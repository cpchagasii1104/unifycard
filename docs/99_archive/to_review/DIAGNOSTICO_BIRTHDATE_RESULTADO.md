# Diagnóstico: Birthdate não persiste (200 OK mas GET retorna null)

## 🔍 Causa Raiz Identificada

**Localização**: `backend/src/core/identity/identity.service.ts:808-851`

### Problema

O método `getIdentityProfile()` tem lógica de **auto-criação** que cria um NOVO `global_user` vazio se não encontrar o registro existente.

```typescript
// Linha 808
if (!globalUser) {
  console.log('[IdentityService] ⚠️⚠️⚠️ ATENÇÃO: Global user não encontrado, criando novo');
  // ...
  // CRIA NOVO global_user SEM birthdate
}
```

### Cenário de Falha

1. **UPDATE (POST /identity/update)**:
   - Usuário salva `birthdate = "1990-01-15"`
   - Sistema atualiza `global_user A` corretamente
   - Retorna **200 OK** ✅

2. **PROBLEMA OCULTO**:
   - Por algum motivo, o `global_user_id` em `users.global_user_id` fica NULL ou dessincronizado
   - OU o link em `user_identity_links` não existe/está errado

3. **GET (GET /identity/me)** após F5:
   - Busca `users.global_user_id` → encontra NULL (linha 757)
   - Tenta buscar via `user_identity_links` → não encontra (linha 763-777)
   - **NÃO encontra `global_user A`** (que TEM birthdate)
   - **Cria NOVO `global_user B`** SEM birthdate (linha 808)
   - Retorna registro vazio com `birthdate = null`

4. **Resultado**:
   - Usuário vê que birthdate "desapareceu"
   - Na verdade, há DOIS `global_user` no banco:
     - `global_user A` (antigo, COM birthdate) → **órfão**
     - `global_user B` (novo, SEM birthdate) → **ativo mas vazio**

## 📊 Como Verificar

Execute o arquivo `DIAGNOSTICO_BIRTHDATE.sql`:

```bash
psql -U postgres -d unificard -f backend/DIAGNOSTICO_BIRTHDATE.sql
```

Procure por:
1. **MÚLTIPLOS GLOBAL_USERS**: Usuário com mais de 1 `global_user_id` diferente
2. **DESSINCRONIZAÇÃO**: `users.global_user_id` diferente de `user_identity_links.global_user_id`
3. **GLOBAL_USERS ÓRFÃOS**: Registros com birthdate mas sem nenhum link

## 🐛 Onde o Dado Se Perde

**Arquivo**: `backend/src/core/identity/identity.service.ts`
**Linha**: **808-851** (método `getIdentityProfile`)
**Lógica problemática**: Auto-criação de global_user quando deveria retornar erro

## 🔧 Patch Definitivo

### Opção 1: REMOVER Auto-Criação (Recomendado)

```typescript
// backend/src/core/identity/identity.service.ts:808-851

// ANTES (ERRADO):
if (!globalUser) {
  console.log('[IdentityService] ⚠️⚠️⚠️ ATENÇÃO: Global user não encontrado, criando novo');
  // ... cria novo global_user
}

// DEPOIS (CORRETO):
if (!globalUser) {
  console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado!', {
    userId,
    tenantId,
    resolvedGlobalUserId,
    localUserGlobalUserId: localUser.global_user_id,
  });
  // NÃO criar novo - retornar null para forçar erro explícito
  // Isso garante que o frontend saiba que algo está errado
  return null;
}
```

**Benefício**: Se o link estiver quebrado, o sistema retorna erro claro em vez de criar registro duplicado.

### Opção 2: Sincronizar Antes de Criar

Se quiser manter auto-criação (não recomendado):

```typescript
if (!globalUser) {
  // ANTES de criar novo, verificar se há global_user órfão
  const orphanCheck = await pool.query(
    `SELECT gu.*
     FROM global_users gu
     LEFT JOIN user_identity_links uil ON gu.global_user_id = uil.global_user_id
     WHERE uil.global_user_id IS NULL
       AND gu.full_name IS NOT NULL
     ORDER BY gu.updated_at DESC
     LIMIT 1`
  );

  if (orphanCheck.rows[0]) {
    // Reutilizar órfão em vez de criar novo
    globalUser = this.toGlobalUser(orphanCheck.rows[0]);
    await this.linkLocalUserToGlobal(userId, globalUser.globalUserId, tenantId);
  } else {
    // Criar novo apenas se não houver órfão
    // ... lógica existente
  }
}
```

## ✅ Como Validar que Salvou

Após aplicar o patch, para validar que birthdate foi salvo corretamente:

```sql
-- 1. Verificar que existe apenas 1 global_user para o usuário
SELECT
  u.email,
  u.global_user_id,
  gu.birthdate,
  (SELECT COUNT(*) FROM user_identity_links WHERE user_id = u.user_id) as qtd_links
FROM users u
JOIN global_users gu ON u.global_user_id = gu.global_user_id
WHERE u.email = 'seu_email@example.com';

-- 2. Verificar que users.global_user_id está sincronizado com links
SELECT
  u.global_user_id as id_na_users,
  uil.global_user_id as id_na_links,
  u.global_user_id = uil.global_user_id as sincronizado
FROM users u
JOIN user_identity_links uil ON u.user_id = uil.user_id
WHERE u.email = 'seu_email@example.com';
```

## 🎯 Resumo Executivo

| Item | Valor |
|------|-------|
| **Arquivo** | `backend/src/core/identity/identity.service.ts` |
| **Linha** | 808-851 |
| **Método** | `getIdentityProfile()` |
| **Problema** | Auto-criação de global_user duplica registros |
| **Sintoma** | 200 OK no UPDATE, mas GET retorna birthdate = null |
| **Causa** | Sistema cria NOVO global_user vazio em vez de usar existente |
| **Fix** | Remover auto-criação ou sincronizar órfãos antes de criar |
| **Validação** | Query SQL para verificar 1 único global_user por usuário |

## 📋 Checklist de Correção

- [ ] Execute `DIAGNOSTICO_BIRTHDATE.sql` para confirmar múltiplos global_users
- [ ] Aplique patch na linha 808 de `identity.service.ts`
- [ ] Limpe global_users órfãos (BACKUP ANTES!)
- [ ] Teste UPDATE + F5 + GET para garantir que birthdate persiste
- [ ] Verifique logs do backend para ver `⚠️⚠️⚠️ ATENÇÃO: Global user não encontrado, criando novo`
- [ ] Se vir essa mensagem, confirma o problema

## 🚨 Nota Crítica

O código de UPDATE (linhas 195-676) está CORRETO e tem validação extensa. O problema NÃO é no UPDATE, mas no GET que cria registro duplicado.
