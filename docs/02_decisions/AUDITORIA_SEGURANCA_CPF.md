# 🔐 AUDITORIA DE SEGURANÇA — CPF COMO NÚCLEO DE IDENTIDADE

**Data:** 03/01/2026  
**Auditor:** Claude (Arquiteta Técnica Sênior)  
**Escopo:** Backend, Frontend, Migrations (Banco de Dados)  
**Criticidade:** 🔴 ALTA

---

## 📊 RESUMO EXECUTIVO

| Área | Status | Criticidade |
|------|--------|-------------|
| Unicidade de CPF | ✅ OK | - |
| Imutabilidade (Frontend) | ✅ OK | - |
| Imutabilidade (Backend) | ✅ OK | - |
| Validação Algorítmica (Frontend) | ✅ OK | - |
| Validação Algorítmica (Backend) | 🔴 FALHA | ALTA |
| Proteção contra Exclusão | 🔴 FALHA CRÍTICA | CRÍTICA |
| Vínculo com Histórico | 🔴 FALHA | ALTA |
| Trigger anti-CPF em metadata | ✅ OK | - |

**Veredito:** Sistema tem 3 vulnerabilidades críticas que precisam ser corrigidas ANTES de ir para produção.

---

## ✅ O QUE ESTÁ CORRETO

### 1. Unicidade de CPF no Banco
```sql
-- Migration 105
cpf VARCHAR(11) NOT NULL UNIQUE
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_cpf_unique ON user_profiles(cpf);
```
**Status:** ✅ CPF é único no sistema.

### 2. Imutabilidade no Frontend
```tsx
// Profile.tsx - linha 1541-1550
{hasCpf ? (
  <LockedField
    value={cpf}
    label="CPF"
    tooltipMessage="Este dado é protegido. Para corrigir, entre em contato com o administrador."
  />
) : (
  // Campo editável apenas se CPF não existe
)}
```
**Status:** ✅ Frontend bloqueia edição após cadastro.

### 3. Imutabilidade no Backend
```typescript
// profile.service.ts - linha 324-327
if (existingCpf && existingCpf !== cpfToSave) {
  throw new ConflictError('CPF não pode ser alterado após o cadastro');
}
```
**Status:** ✅ Backend bloqueia alteração de CPF.

### 4. Proteção contra CPF em Metadata
```sql
-- Migration 111
CREATE TRIGGER no_cpf_in_metadata
BEFORE INSERT OR UPDATE ON profiles
WHEN (NEW.metadata ? 'cpf' OR (NEW.metadata->'personal_profile' ? 'cpf'))
EXECUTE FUNCTION prevent_cpf_in_metadata();
```
**Status:** ✅ Trigger remove CPF automaticamente de metadata.

### 5. Validação Algorítmica no Frontend
```typescript
// utils/cpf.ts
export function validateCPF(cpf: string): boolean {
  // Algoritmo oficial de validação de CPF
}
```
**Status:** ✅ Frontend valida CPF com algoritmo oficial.

---

## 🔴 VULNERABILIDADES CRÍTICAS

### VULNERABILIDADE 1: ON DELETE CASCADE APAGA CPF

**Localização:** `migrations/105_create_user_profiles.sql` linha 7

```sql
user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
```

**Problema:**
Se um registro em `users` for deletado, o CPF em `user_profiles` é automaticamente apagado.

**Cenário de Fraude:**
1. Fraudador cria conta com CPF roubado
2. Comete fraudes no sistema
3. Solicita exclusão de conta
4. CPF é apagado (ON DELETE CASCADE)
5. Fraudador cria nova conta com mesmo CPF
6. **Histórico de fraudes é perdido**

**Solução:**
```sql
-- Nova migration para corrigir
ALTER TABLE user_profiles 
DROP CONSTRAINT user_profiles_user_id_fkey;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) 
ON DELETE SET NULL;

-- Permitir user_id NULL (conta excluída, CPF preservado)
ALTER TABLE user_profiles 
ALTER COLUMN user_id DROP NOT NULL;

-- Adicionar flag de status
ALTER TABLE user_profiles 
ADD COLUMN status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'suspended', 'deleted'));

-- Adicionar deleted_at para soft delete
ALTER TABLE user_profiles 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
```

---

### VULNERABILIDADE 2: FALTA VALIDAÇÃO DE CPF NO BACKEND

**Localização:** `auth.service.ts` linha 229

```typescript
[user.userId, cpf.replace(/\D/g, '')]
```

**Problema:**
Backend apenas remove caracteres não-numéricos, mas não valida se é um CPF válido algoritmicamente.

**Risco:**
Atacante pode inserir CPF inválido (ex: 11111111111) via API direta, bypassando frontend.

**Solução:**
```typescript
// backend/src/utils/cpf.validator.ts

export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  
  // Rejeitar CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
  // Validar dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  if (secondDigit !== parseInt(numbers[10])) return false;
  
  return true;
}

// Usar em auth.service.ts e profile.service.ts
import { validateCPF } from '@utils/cpf.validator';

if (cpf && !validateCPF(cpf)) {
  throw new BadRequestError('CPF inválido');
}
```

---

### VULNERABILIDADE 3: CPF NÃO VINCULADO A GLOBAL_USERS

**Problema Arquitetural:**

```
ARQUITETURA ATUAL (ERRADA):
users (por tenant) ──────┬───> user_profiles (CPF)
                         │
global_users ────────────┘ (sem vínculo direto)

ARQUITETURA CORRETA:
global_users ────────────┬───> cpf_registry (CPF permanente)
                         │
users (por tenant) ──────┘
```

**Problema:**
- CPF está vinculado a `users` (entidade por tenant)
- Deveria estar vinculado a `global_users` (identidade permanente)
- Se usuário tem conta em múltiplos tenants, CPF pode ter inconsistência

**Solução de Longo Prazo:**
```sql
-- Criar tabela de registro permanente de CPF
CREATE TABLE cpf_registry (
  cpf_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf VARCHAR(11) NOT NULL UNIQUE,
  global_user_id UUID REFERENCES global_users(global_user_id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  blocked_reason TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- CPF NUNCA é deletado, apenas marcado
-- Histórico é preservado SEMPRE
```

---

## 📋 PLANO DE CORREÇÃO (ORDEM OBRIGATÓRIA)

### Fase 1: Correções Imediatas (CRÍTICO)

```
[ ] 1. Criar backend/src/utils/cpf.validator.ts
[ ] 2. Adicionar validação em auth.service.ts
[ ] 3. Adicionar validação em profile.service.ts
[ ] 4. Criar migration para corrigir ON DELETE CASCADE
```

### Fase 2: Proteção contra Exclusão

```
[ ] 5. Implementar soft delete em users
[ ] 6. Garantir que CPF sobrevive à "exclusão" de conta
[ ] 7. Criar endpoint de desativação (não exclusão)
```

### Fase 3: Arquitetura Definitiva

```
[ ] 8. Criar cpf_registry vinculado a global_users
[ ] 9. Migrar dados existentes
[ ] 10. Atualizar consultas para usar nova estrutura
```

---

## 🎯 MIGRATION IMEDIATA (EXECUTAR AGORA)

```sql
-- Migration 112: Corrigir vulnerabilidades de CPF
-- CRÍTICO: Executar ANTES de ir para produção

-- 1. Adicionar colunas de auditoria
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- 2. Adicionar constraint de status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_status_check'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_status_check 
    CHECK (status IN ('active', 'suspended', 'blocked', 'deleted'));
  END IF;
END $$;

-- 3. Permitir user_id NULL (para preservar CPF após exclusão de conta)
ALTER TABLE user_profiles 
ALTER COLUMN user_id DROP NOT NULL;

-- 4. Recriar FK sem CASCADE
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) 
ON DELETE SET NULL;

-- 5. Criar índice para buscar CPFs órfãos
CREATE INDEX IF NOT EXISTS idx_user_profiles_orphan 
ON user_profiles (cpf) 
WHERE user_id IS NULL;

-- 6. Criar índice para buscar por status
CREATE INDEX IF NOT EXISTS idx_user_profiles_status 
ON user_profiles (status);

-- 7. Trigger para impedir reutilização de CPF
CREATE OR REPLACE FUNCTION prevent_cpf_reuse()
RETURNS TRIGGER AS $$
DECLARE
  existing_cpf RECORD;
BEGIN
  -- Verificar se CPF já existe (mesmo que órfão)
  SELECT cpf, user_id, status INTO existing_cpf
  FROM user_profiles
  WHERE cpf = NEW.cpf
  LIMIT 1;
  
  IF existing_cpf.cpf IS NOT NULL THEN
    -- Se CPF existe mas está órfão ou bloqueado, bloquear criação
    IF existing_cpf.user_id IS NULL OR existing_cpf.status IN ('blocked', 'suspended') THEN
      RAISE EXCEPTION 'CPF % já foi utilizado anteriormente e não pode ser reutilizado', NEW.cpf;
    END IF;
    
    -- Se CPF existe e pertence a outro usuário, bloquear
    IF existing_cpf.user_id IS NOT NULL AND existing_cpf.user_id != NEW.user_id THEN
      RAISE EXCEPTION 'CPF % já está em uso por outra conta', NEW.cpf;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_cpf_reuse ON user_profiles;
CREATE TRIGGER trg_prevent_cpf_reuse
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION prevent_cpf_reuse();

-- Comentários
COMMENT ON COLUMN user_profiles.status IS 
  'Status do CPF: active, suspended (investigação), blocked (fraude), deleted (conta excluída)';

COMMENT ON COLUMN user_profiles.deleted_at IS 
  'Timestamp de quando a conta foi excluída (soft delete). CPF permanece para histórico.';

COMMENT ON FUNCTION prevent_cpf_reuse() IS 
  'Impede reutilização de CPF que já foi usado, mesmo após exclusão de conta.';
```

---

## 🔍 VALIDADOR DE CPF PARA BACKEND

```typescript
// backend/src/utils/cpf.validator.ts

/**
 * Valida CPF usando algoritmo oficial da Receita Federal
 * Deve ser usado em TODA entrada de CPF no sistema
 */
export function validateCPF(cpf: string): boolean {
  // Remover caracteres não-numéricos
  const numbers = cpf.replace(/\D/g, '');
  
  // Deve ter 11 dígitos
  if (numbers.length !== 11) return false;
  
  // Rejeitar CPFs com todos os dígitos iguais
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== parseInt(numbers[9])) return false;
  
  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  if (secondDigit !== parseInt(numbers[10])) return false;
  
  return true;
}

/**
 * Normaliza CPF para formato padrão (apenas números)
 */
export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Formata CPF para exibição (000.000.000-00)
 */
export function formatCPF(cpf: string): string {
  const numbers = normalizeCPF(cpf);
  if (numbers.length !== 11) return cpf;
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Mascara CPF para exibição segura (***.***.***-XX)
 */
export function maskCPF(cpf: string): string {
  const numbers = normalizeCPF(cpf);
  if (numbers.length !== 11) return cpf;
  return `***.***.***.${numbers.slice(-2)}`;
}
```

---

## 📈 CHECKLIST DE VALIDAÇÃO

### Antes de ir para Produção:

```
[ ] Migration 112 aplicada
[ ] cpf.validator.ts criado
[ ] auth.service.ts validando CPF
[ ] profile.service.ts validando CPF
[ ] Teste: CPF inválido é rejeitado
[ ] Teste: CPF duplicado é rejeitado
[ ] Teste: CPF não é apagado quando conta é "excluída"
[ ] Teste: CPF órfão não pode ser reutilizado
```

### Testes de Segurança:

```sql
-- Teste 1: Inserir CPF inválido deve falhar
INSERT INTO user_profiles (user_id, cpf) VALUES ('...', '11111111111');
-- Esperado: ERRO

-- Teste 2: CPF após exclusão de conta deve permanecer
DELETE FROM users WHERE user_id = 'xxx';
SELECT * FROM user_profiles WHERE cpf = 'yyy';
-- Esperado: Registro existe com user_id = NULL

-- Teste 3: Tentar criar conta com CPF órfão deve falhar
INSERT INTO user_profiles (user_id, cpf) VALUES ('novo_user', 'cpf_orfao');
-- Esperado: ERRO "CPF já foi utilizado anteriormente"
```

---

## 🏁 VEREDITO FINAL

**O sistema NÃO está pronto para produção com dados reais de CPF.**

### Prioridades:

1. 🔴 **CRÍTICO:** Corrigir ON DELETE CASCADE (Migration 112)
2. 🔴 **ALTA:** Adicionar validação de CPF no backend
3. 🟡 **MÉDIA:** Implementar cpf_registry com global_users

### Tempo Estimado:

- Fase 1 (Correções Imediatas): 2 horas
- Fase 2 (Soft Delete): 3 horas
- Fase 3 (Arquitetura): 1 dia

---

*Auditoria de Segurança — CPF como Núcleo de Identidade*  
*Claude — 03/01/2026*
