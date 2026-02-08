# 🔐 PROMPT CURSOR: BLINDAGEM CPF — CORE DE IDENTIDADE

## CONTEXTO

O CPF é o núcleo de identidade do UnifiCard. Todas as entidades (contas, empresas, grupos) estão atreladas ao CPF.

**Requisito de negócio:**
> "O mesmo CPF que for inserido não pode ser editado. Mesmo excluindo a conta, ao tentar criar outra com o mesmo CPF o sistema puxa o histórico."

**Vulnerabilidades identificadas:**
1. ON DELETE CASCADE apaga CPF quando user é deletado
2. Registro com CPF duplicado dá erro 500 (sem tratamento)
3. Backend não valida CPF algoritmicamente
4. Não existe soft delete em users
5. Logs vazam stack trace

---

## FASE 1: MIGRATION — REMOVER CASCADE E ADICIONAR SOFT DELETE (20 min)

### Arquivo: `backend/migrations/115_cpf_security_hardening.sql`

```sql
-- Migration 115: Blindagem de segurança do CPF
-- Data: 2025-01-03
-- Objetivo: CPF como núcleo de identidade imutável e persistente

-- ============================================================
-- FASE 1: REMOVER ON DELETE CASCADE
-- ============================================================
-- Problema: Se users for deletado, user_profiles.cpf some junto
-- Solução: RESTRICT impede delete de user se tiver CPF

ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_user_id_fkey
  FOREIGN KEY (user_id) 
  REFERENCES users(user_id) 
  ON DELETE RESTRICT;

COMMENT ON CONSTRAINT user_profiles_user_id_fkey ON user_profiles IS
  'RESTRICT: Impede exclusão de usuário sem primeiro tratar o CPF (segurança de identidade)';

-- ============================================================
-- FASE 2: SOFT DELETE EM USERS
-- ============================================================
-- Problema: Não há como "excluir conta" sem perder dados
-- Solução: deleted_at + status para exclusão lógica

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

-- Adicionar CHECK constraint apenas se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_account_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_account_status_check
      CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'DELETED'));
  END IF;
END $$;

-- Índice para queries de usuários ativos
CREATE INDEX IF NOT EXISTS idx_users_active 
  ON users(tenant_id) 
  WHERE deleted_at IS NULL AND account_status = 'ACTIVE';

COMMENT ON COLUMN users.deleted_at IS 
  'Data de exclusão lógica. NULL = conta ativa. CPF permanece intacto.';

COMMENT ON COLUMN users.account_status IS
  'Status da conta: ACTIVE (normal), SUSPENDED (temporário), DELETED (excluída mas CPF preservado)';

-- ============================================================
-- FASE 3: TRIGGER DE IMUTABILIDADE DO CPF
-- ============================================================
-- Problema: Possível alterar CPF via SQL direto
-- Solução: Trigger que impede UPDATE de CPF

CREATE OR REPLACE FUNCTION prevent_cpf_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.cpf IS NOT NULL AND OLD.cpf <> NEW.cpf THEN
    RAISE EXCEPTION 'CPF é imutável e não pode ser alterado após cadastro. Contate o suporte.';
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

COMMENT ON FUNCTION prevent_cpf_update() IS
  'Impede alteração de CPF em nível de banco. CPF é dado de identidade imutável.';

-- ============================================================
-- FASE 4: ADICIONAR STATUS EM USER_PROFILES
-- ============================================================
-- Para suportar "CPF órfão" quando conta é excluída

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_status_check'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_status_check
      CHECK (status IN ('ACTIVE', 'ORPHAN', 'RECOVERED'));
  END IF;
END $$;

COMMENT ON COLUMN user_profiles.status IS
  'ACTIVE = vinculado a conta ativa. ORPHAN = conta excluída mas CPF preservado. RECOVERED = CPF reconectado a nova conta.';

-- ============================================================
-- VALIDAÇÃO FINAL
-- ============================================================
DO $$
DECLARE
  cascade_exists BOOLEAN;
BEGIN
  -- Verificar se CASCADE foi removido
  SELECT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'user_profiles'
    AND tc.constraint_name = 'user_profiles_user_id_fkey'
    AND rc.delete_rule = 'CASCADE'
  ) INTO cascade_exists;
  
  IF cascade_exists THEN
    RAISE EXCEPTION 'ERRO: ON DELETE CASCADE ainda existe em user_profiles!';
  ELSE
    RAISE NOTICE '✅ CASCADE removido com sucesso de user_profiles';
  END IF;
  
  -- Verificar deleted_at em users
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'deleted_at'
  ) THEN
    RAISE NOTICE '✅ Soft delete (deleted_at) adicionado em users';
  ELSE
    RAISE EXCEPTION 'ERRO: deleted_at não foi adicionado em users!';
  END IF;
  
  RAISE NOTICE '✅ Migration 115 concluída: CPF blindado como núcleo de identidade';
END $$;
```

---

## FASE 2: VALIDADOR CPF NO BACKEND (15 min)

### Criar arquivo: `backend/src/core/validators/cpf.validator.ts`

```typescript
/**
 * cpf.validator.ts
 * Validação algorítmica de CPF (algoritmo oficial da Receita Federal)
 * 
 * REGRA: Backend DEVE validar CPF independente do frontend
 * Frontend pode ser bypassado via API direta
 */

/**
 * Valida CPF usando algoritmo oficial
 * @param cpf CPF com ou sem máscara
 * @returns true se válido, false se inválido
 */
export function validateCPF(cpf: string): boolean {
  // Limpar não-dígitos
  const numbers = cpf.replace(/\D/g, '');
  
  // Deve ter 11 dígitos
  if (numbers.length !== 11) {
    return false;
  }
  
  // Rejeitar CPFs com todos dígitos iguais
  if (/^(\d)\1{10}$/.test(numbers)) {
    return false;
  }
  
  // Calcular primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  
  if (digit !== parseInt(numbers.charAt(9))) {
    return false;
  }
  
  // Calcular segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  
  if (digit !== parseInt(numbers.charAt(10))) {
    return false;
  }
  
  return true;
}

/**
 * Limpa CPF removendo máscara
 * @param cpf CPF com ou sem máscara
 * @returns Apenas os 11 dígitos
 */
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida e limpa CPF em uma única operação
 * @throws Error se CPF for inválido
 */
export function validateAndCleanCPF(cpf: string): string {
  const clean = cleanCPF(cpf);
  
  if (!validateCPF(clean)) {
    throw new Error('CPF inválido');
  }
  
  return clean;
}
```

---

## FASE 3: CORRIGIR AUTH.SERVICE.TS (20 min)

### Editar: `backend/src/core/auth/auth.service.ts`

**Localização:** Linhas ~220-231 (bloco de salvamento de CPF)

**DE:**
```typescript
// Salvar CPF na tabela user_profiles (se fornecido)
if (cpf) {
  const { pool } = await import('@core/database/pool');
  await pool.query(
    `
    INSERT INTO user_profiles (user_id, cpf)
    VALUES ($1, $2)
    `,
    [user.userId, cpf.replace(/\D/g, '')]
  );
}
```

**PARA:**
```typescript
// Salvar CPF na tabela user_profiles (se fornecido)
if (cpf) {
  const { pool } = await import('@core/database/pool');
  const { validateCPF, cleanCPF } = await import('@core/validators/cpf.validator');
  const { devLog } = await import('@core/utils/logger');
  
  const cleanedCpf = cleanCPF(cpf);
  
  // 🔴 VALIDAÇÃO ALGORÍTMICA (backend não confia no frontend)
  if (!validateCPF(cleanedCpf)) {
    devLog.warn('auth.register.cpf', 'CPF inválido rejeitado', {
      cpfPreview: cleanedCpf.substring(0, 3) + '***',
    });
    const error = new Error('CPF inválido') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  
  try {
    await pool.query(
      `INSERT INTO user_profiles (user_id, cpf) VALUES ($1, $2)`,
      [user.userId, cleanedCpf]
    );
    
    devLog.success('auth.register.cpf', 'CPF salvo com sucesso', {
      userId: user.userId,
      cpfPreview: cleanedCpf.substring(0, 3) + '***',
    });
  } catch (err: any) {
    // 🔴 TRATAMENTO DE CPF DUPLICADO
    if (err.code === '23505') {
      devLog.warn('auth.register.cpf', 'CPF já cadastrado (possível recovery)', {
        cpfPreview: cleanedCpf.substring(0, 3) + '***',
      });
      
      const error = new Error('CPF já cadastrado. Se você já teve uma conta, utilize a opção de recuperar conta.') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
    
    devLog.error('auth.register.cpf', 'Erro ao salvar CPF', {
      error: err.message,
    });
    throw err;
  }
}
```

---

## FASE 4: CORRIGIR PROFILE.SERVICE.TS (10 min)

### Editar: `backend/src/core/profile/profile.service.ts`

**Localização:** Linhas ~199-210 (extração de CPF do metadata)

**ADICIONAR** após a linha que extrai o CPF:
```typescript
// 🔴 VALIDAÇÃO ALGORÍTMICA (backend não confia no frontend)
if (cpfToSave) {
  const { validateCPF } = await import('@core/validators/cpf.validator');
  if (!validateCPF(cpfToSave)) {
    throw new ValidationError('CPF inválido');
  }
}
```

**SUBSTITUIR** console.log/error por devLog:
```typescript
// DE:
console.log('[ProfileService] ✅ CPF salvo em user_profiles:', {...});
console.error('[ProfileService] ❌ Erro ao salvar CPF em user_profiles:', {...});

// PARA:
devLog.success('profile.upsert.cpf', 'CPF salvo em user_profiles', {...});
devLog.error('profile.upsert.cpf', 'Erro ao salvar CPF', {...});
```

---

## FASE 5: SUBSTITUIR CONSOLE.LOG POR DEVLOG (15 min)

### Arquivos a editar:
1. `backend/src/core/auth/auth.service.ts`
2. `backend/src/core/profile/profile.service.ts`

**Padrão de substituição:**
```typescript
// DE:
console.log('[AuthService] ✅ Código de indicação gerado:', {...});
console.warn('Erro ao aplicar código de indicação (não crítico):', err);
console.error('[AuthService] ❌ ERRO ao gerar código de indicação:', {...});

// PARA:
devLog.success('auth.register.referral', 'Código de indicação gerado', {...});
devLog.warn('auth.register.referral', 'Erro ao aplicar código (não crítico)', { error: err.message });
devLog.error('auth.register.referral', 'ERRO ao gerar código de indicação', { error: err.message });
```

**NUNCA** logar:
- Stack traces
- CPF completo (apenas preview: `cpf.substring(0, 3) + '***'`)
- Senhas ou tokens

---

## VALIDAÇÃO FINAL

### Testes a executar:

```bash
# 1. Testar CPF inválido
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","cpf":"11111111111"}'
# Esperado: 400 "CPF inválido"

# 2. Testar CPF duplicado
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@test.com","password":"123456","cpf":"03132549908"}'
# Esperado: 409 "CPF já cadastrado..."

# 3. Testar DELETE em user com CPF
psql -c "DELETE FROM users WHERE user_id = '...';"
# Esperado: ERROR - foreign key constraint (RESTRICT)

# 4. Testar UPDATE de CPF
psql -c "UPDATE user_profiles SET cpf = '12345678901' WHERE user_id = '...';"
# Esperado: ERROR - CPF é imutável
```

### Checklist:

- [ ] Migration 115 executada sem erros
- [ ] CASCADE removido de user_profiles
- [ ] deleted_at adicionado em users
- [ ] Trigger de imutabilidade ativo
- [ ] cpf.validator.ts criado
- [ ] auth.service.ts corrigido
- [ ] profile.service.ts corrigido
- [ ] console.log substituído por devLog
- [ ] Testes passando

---

## TEMPO ESTIMADO

| Fase | Tempo |
|------|-------|
| Migration SQL | 20 min |
| Validador CPF | 15 min |
| Corrigir auth.service | 20 min |
| Corrigir profile.service | 10 min |
| Substituir console.log | 15 min |
| **TOTAL** | **1h20** |

---

## RESULTADO ESPERADO

Após aplicar todas as correções:

1. ✅ CPF não pode ser deletado via CASCADE
2. ✅ CPF não pode ser alterado (trigger de banco)
3. ✅ CPF inválido é rejeitado (algoritmo oficial)
4. ✅ CPF duplicado retorna 409 (não 500)
5. ✅ Conta pode ser "excluída" via soft delete
6. ✅ Histórico preservado via CPF
7. ✅ Logs não vazam informação sensível

**O CPF se torna o núcleo imutável de identidade do sistema.**
