# 🔐 AUDITORIA CPF — NÚCLEO DE IDENTIDADE UNIFICARD

> **Data:** 03/01/2026
> **Objetivo:** Identificar todas as vulnerabilidades relacionadas ao CPF como core de identidade
> **Prioridade:** CRÍTICA

---

## 📊 RESUMO EXECUTIVO

| Categoria | Status | Severidade |
|-----------|--------|------------|
| **Unicidade CPF** | ✅ OK | - |
| **Imutabilidade (frontend)** | ✅ OK | - |
| **Imutabilidade (backend)** | ✅ OK | - |
| **ON DELETE CASCADE** | 🔴 CRÍTICO | ALTA |
| **Tratamento erro 23505 (register)** | 🔴 FALHA | ALTA |
| **Validação algorítmica (backend)** | 🔴 AUSENTE | ALTA |
| **Soft Delete em users** | 🔴 AUSENTE | ALTA |
| **Recovery por CPF** | 🔴 AUSENTE | MÉDIA |
| **Logs vazando info** | 🟡 PARCIAL | MÉDIA |

---

## ✅ O QUE JÁ ESTÁ CORRETO

### 1. Unicidade de CPF no Banco
```sql
-- Migration 105
CREATE TABLE user_profiles (
  ...
  cpf VARCHAR(11) NOT NULL UNIQUE,
  ...
);
CREATE UNIQUE INDEX user_profiles_cpf_unique ON user_profiles(cpf);
```
**Veredicto:** ✅ CPF não pode duplicar no banco.

---

### 2. Imutabilidade no Frontend
```typescript
// Profile.tsx linhas 1541-1553
{hasCpf ? (
  <LockedField
    value={cpf.replace(/\D/g, '')}
    label="CPF"
    ...
  />
) : (
  // Campo editável
)}
```
**Veredicto:** ✅ CPF vira campo travado após cadastro.

---

### 3. Imutabilidade no Backend
```typescript
// profile.service.ts linhas 324-326
if (existingCpf && existingCpf !== cpfToSave) {
  throw new ConflictError('CPF não pode ser alterado após o cadastro');
}
```
**Veredicto:** ✅ Backend bloqueia alteração de CPF.

---

### 4. Proteção contra CPF em Metadata
```sql
-- Migration 111
CREATE TRIGGER no_cpf_in_metadata
  BEFORE INSERT OR UPDATE ON profiles
  ...
  EXECUTE FUNCTION prevent_cpf_in_metadata();
```
**Veredicto:** ✅ CPF não vazará para metadata (LGPD).

---

### 5. Validação Algorítmica no Frontend
```typescript
// utils/cpf.ts
export function validateCPF(cpf: string): boolean {
  // Algoritmo oficial completo
  // Valida dígitos verificadores
}
```
**Veredicto:** ✅ Frontend valida CPF corretamente.

---

## 🔴 VULNERABILIDADES CRÍTICAS

### VULN-01: ON DELETE CASCADE em user_profiles

**Localização:** `migrations/105_create_user_profiles.sql` linha 7

```sql
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
```

**Problema:**
Se alguém executar `DELETE FROM users WHERE user_id = '...'`:
- O CPF é deletado junto (CASCADE)
- O histórico fica órfão
- O CPF fica "livre" para reuso
- **Viola requisito:** "mesmo excluindo a conta, CPF puxa histórico"

**Impacto:** CRÍTICO — Abre fraude de reset de identidade

---

### VULN-02: Erro 500 no Registro com CPF Duplicado

**Localização:** `core/auth/auth.service.ts` linhas 222-231

```typescript
if (cpf) {
  const { pool } = await import('@core/database/pool');
  await pool.query(
    `INSERT INTO user_profiles (user_id, cpf) VALUES ($1, $2)`,
    [user.userId, cpf.replace(/\D/g, '')]
  );
  // ❌ SEM try/catch!
  // ❌ SEM tratamento de 23505!
}
```

**Problema:**
- CPF duplicado causa erro PostgreSQL 23505
- Erro não tratado vira HTTP 500
- Usuário vê mensagem genérica de erro
- Não sabe que o CPF já está em uso

**Impacto:** ALTO — UX quebrada e comportamento inconsistente

---

### VULN-03: Backend Não Valida CPF Algoritmicamente

**Localização:** `core/auth/auth.service.ts` linha 229

```typescript
cpf.replace(/\D/g, '')  // Apenas remove não-dígitos
// ❌ Não valida se é CPF válido!
// ❌ CPF "11111111111" passa!
```

**Problema:**
- Frontend pode ser bypassado (Postman, curl)
- CPF inválido pode ser salvo no banco
- Viola integridade do core de identidade

**Impacto:** ALTO — Dados sujos no sistema

---

### VULN-04: Ausência de Soft Delete em Users

**Localização:** `migrations/001_initial_schema.sql`

```sql
CREATE TABLE users (
  user_id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
  -- ❌ SEM deleted_at!
  -- ❌ SEM status!
);
```

**Problema:**
- Não há como "excluir conta" sem perder dados
- Se implementar "excluir conta", será hard delete
- CASCADE apaga CPF junto

**Impacto:** ALTO — Arquitetura incompatível com requisito de persistência

---

### VULN-05: Ausência de Recovery por CPF

**Localização:** Não existe

**Problema:**
Não há fluxo que faça:
1. Detectar CPF já cadastrado
2. Reconectar ao global_user_id existente
3. Preservar histórico

Se alguém tentar cadastrar com CPF existente:
- Hoje: erro 500 ou 409 genérico
- Deveria: "CPF já cadastrado, deseja recuperar sua conta?"

**Impacto:** MÉDIO — Viola requisito de reconexão de histórico

---

## 🟡 PROBLEMAS SECUNDÁRIOS

### SEC-01: Logs com console.log no auth.service.ts

```typescript
// auth.service.ts linhas 240, 251, 269, 275, 346
console.warn('Erro ao aplicar código de indicação (não crítico):', err);
console.error('Erro ao criar identidade global:', error);
console.log('[AuthService] ✅ Código de indicação gerado:', {...});
```

**Problema:** Viola GOLDEN_PATH (devLog obrigatório)

---

### SEC-02: Stack Trace em Logs no profile.service.ts

```typescript
// profile.service.ts linhas 366-369
console.error('[ProfileService] ❌ Erro ao salvar CPF em user_profiles:', {
  ...
  stack: err instanceof Error ? err.stack : undefined,
});
```

**Problema:** Vazamento de informação interna

---

## 🏗️ ARQUITETURA RECOMENDADA

### Modelo Atual (VULNERÁVEL)

```
users (tenant-specific)
  ↓ ON DELETE CASCADE
user_profiles (cpf)
  ↓ (sem ligação)
global_users
```

### Modelo Correto (SEGURO)

```
global_users
  ↓ (1:1, permanente)
cpf_registry (cpf UNIQUE, imutável)
  ↓ (histórico)
user_identity_links
  ↓ (N:1)
users (tenant-specific, soft delete)
```

---

## 📋 PLANO DE CORREÇÃO

### FASE 0: Correções Urgentes (30 min)

1. **Remover CASCADE de user_profiles**
2. **Adicionar try/catch em auth.service.ts para CPF**
3. **Criar cpf.validator.ts no backend**

### FASE 1: Soft Delete (1h)

1. **Adicionar deleted_at e status em users**
2. **Alterar FK de user_profiles para ON DELETE RESTRICT**
3. **Criar índice parcial para users ativos**

### FASE 2: Recovery Flow (2h)

1. **Criar endpoint de verificação de CPF**
2. **Criar fluxo de reconexão de identidade**
3. **Ajustar registro para detectar CPF existente**

### FASE 3: CPF Registry Global (4h) — OPCIONAL

1. **Criar tabela cpf_registry ligada a global_users**
2. **Migrar dados de user_profiles para cpf_registry**
3. **Ajustar todos os serviços**

---

## 📝 CORREÇÕES DETALHADAS

### Correção 1: Remover CASCADE

```sql
-- Migration 115_fix_cpf_cascade.sql
ALTER TABLE user_profiles
  DROP CONSTRAINT user_profiles_user_id_fkey;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_user_id_fkey
  FOREIGN KEY (user_id) 
  REFERENCES users(user_id) 
  ON DELETE RESTRICT;
```

---

### Correção 2: Validador CPF no Backend

```typescript
// core/validators/cpf.validator.ts
export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(9))) return false;
  
  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(numbers.charAt(10))) return false;
  
  return true;
}
```

---

### Correção 3: Tratamento de CPF no Register

```typescript
// auth.service.ts - CORRIGIDO
if (cpf) {
  const cleanCpf = cpf.replace(/\D/g, '');
  
  // Validar algoritmicamente
  if (!validateCPF(cleanCpf)) {
    throw new ValidationError('CPF inválido');
  }
  
  try {
    const { pool } = await import('@core/database/pool');
    await pool.query(
      `INSERT INTO user_profiles (user_id, cpf) VALUES ($1, $2)`,
      [user.userId, cleanCpf]
    );
  } catch (err: any) {
    if (err.code === '23505') {
      // CPF já existe - em vez de erro, iniciar recovery
      throw new ConflictError('CPF já cadastrado. Utilize a opção de recuperar conta.');
    }
    throw err;
  }
}
```

---

### Correção 4: Soft Delete em Users

```sql
-- Migration 116_users_soft_delete.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'));

CREATE INDEX idx_users_status ON users(status) WHERE status = 'ACTIVE';

COMMENT ON COLUMN users.deleted_at IS 
  'Data de exclusão lógica. NULL = conta ativa.';
```

---

### Correção 5: Trigger de Imutabilidade em Banco

```sql
-- Migration 117_cpf_immutability_trigger.sql
CREATE OR REPLACE FUNCTION prevent_cpf_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.cpf IS NOT NULL AND OLD.cpf <> NEW.cpf THEN
    RAISE EXCEPTION 'CPF é imutável e não pode ser alterado após cadastro';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_cpf_update ON user_profiles;
CREATE TRIGGER trg_prevent_cpf_update
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (OLD.cpf IS DISTINCT FROM NEW.cpf)
  EXECUTE FUNCTION prevent_cpf_update();
```

---

## ✅ CHECKLIST DE VALIDAÇÃO

Após aplicar correções, validar:

- [ ] CPF duplicado no registro retorna 409 (não 500)
- [ ] CPF inválido (11111111111) é rejeitado
- [ ] DELETE em users falha (RESTRICT, não CASCADE)
- [ ] UPDATE de CPF em user_profiles falha
- [ ] Logs usam devLog, não console.log
- [ ] Nenhum stack trace em produção
- [ ] Soft delete funciona (deleted_at)

---

## 🎯 VEREDITO FINAL

O sistema tem **4 vulnerabilidades críticas** que precisam ser corrigidas antes de produção:

1. **ON DELETE CASCADE** — permite fraude de reset de identidade
2. **Erro 500 em CPF duplicado** — UX quebrada
3. **Sem validação algorítmica** — dados sujos
4. **Sem soft delete** — impossível preservar histórico

A arquitetura correta seria um **CPF Registry global** ligado a `global_users`, mas isso pode ser implementado depois. As correções acima são suficientes para produção segura.

---

*Documento gerado por auditoria automatizada*
*Próximo passo: PROMPT_CURSOR_CPF_BLINDAGEM.md*
