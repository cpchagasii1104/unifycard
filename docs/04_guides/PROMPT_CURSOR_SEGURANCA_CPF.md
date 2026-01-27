# 🔐 PROMPT PARA CURSOR — CORREÇÕES DE SEGURANÇA DO CPF

Você está no monorepo **UnifiCard**.

---

## ⚠️ CONTEXTO CRÍTICO

Auditoria de segurança identificou 3 vulnerabilidades no tratamento de CPF:

1. **CRÍTICO:** ON DELETE CASCADE apaga CPF quando conta é deletada
2. **ALTA:** Backend não valida CPF algoritmicamente
3. **ALTA:** CPF pode ser reutilizado após exclusão de conta

---

## TAREFA 1: CRIAR VALIDADOR DE CPF

### Criar arquivo:
`backend/src/utils/cpf.validator.ts`

```typescript
// backend/src/utils/cpf.validator.ts
// Validador de CPF para backend

export function validateCPF(cpf: string): boolean {
  const numbers = cpf.replace(/\D/g, '');
  
  if (numbers.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(numbers)) return false;
  
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

export function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function maskCPFForLog(cpf: string): string {
  const numbers = normalizeCPF(cpf);
  if (numbers.length < 3) return '***';
  return `${numbers.substring(0, 3)}***`;
}
```

### Adicionar alias em tsconfig.json (se não existir):

```json
{
  "compilerOptions": {
    "paths": {
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

---

## TAREFA 2: INTEGRAR VALIDAÇÃO NO AUTH.SERVICE.TS

### Localização: `backend/src/core/auth/auth.service.ts`

### ADICIONAR import no topo:

```typescript
import { validateCPF, normalizeCPF, maskCPFForLog } from '@utils/cpf.validator';
```

### MODIFICAR método register (aproximadamente linha 222):

**ANTES:**
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

**DEPOIS:**
```typescript
// Salvar CPF na tabela user_profiles (se fornecido)
if (cpf) {
  // 🔴 VALIDAÇÃO OBRIGATÓRIA: CPF deve ser válido algoritmicamente
  const cpfNormalized = normalizeCPF(cpf);
  
  if (!validateCPF(cpfNormalized)) {
    const error = new Error('CPF inválido') as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  
  const { pool } = await import('@core/database/pool');
  
  try {
    await pool.query(
      `
      INSERT INTO user_profiles (user_id, cpf)
      VALUES ($1, $2)
      `,
      [user.userId, cpfNormalized]
    );
    
    console.log('[AuthService] ✅ CPF salvo:', {
      userId: user.userId,
      cpfPreview: maskCPFForLog(cpfNormalized),
    });
  } catch (err: any) {
    // Verificar se é erro de unicidade (CPF já existe)
    if (err.code === '23505') {
      const error = new Error('CPF já está em uso por outra conta') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
    
    // Verificar se é erro do trigger de reutilização
    if (err.message?.includes('já foi utilizado anteriormente')) {
      const error = new Error(err.message) as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }
    
    throw err;
  }
}
```

---

## TAREFA 3: INTEGRAR VALIDAÇÃO NO PROFILE.SERVICE.TS

### Localização: `backend/src/core/profile/profile.service.ts`

### ADICIONAR import no topo:

```typescript
import { validateCPF, normalizeCPF, maskCPFForLog } from '@utils/cpf.validator';
```

### MODIFICAR extração de CPF (aproximadamente linha 197-206):

**ANTES:**
```typescript
let cpfToSave: string | null = null;
if (input.metadata) {
  const cpfValue = (input.metadata as any).cpf || (input.metadata as any).personal_profile?.cpf;
  if (cpfValue && typeof cpfValue === 'string') {
    const cpfClean = cpfValue.replace(/\D/g, '');
    if (cpfClean.length === 11) {
      cpfToSave = cpfClean;
    }
  }
}
```

**DEPOIS:**
```typescript
let cpfToSave: string | null = null;
if (input.metadata) {
  const cpfValue = (input.metadata as any).cpf || (input.metadata as any).personal_profile?.cpf;
  if (cpfValue && typeof cpfValue === 'string') {
    const cpfNormalized = normalizeCPF(cpfValue);
    
    // 🔴 VALIDAÇÃO OBRIGATÓRIA: CPF deve ser válido algoritmicamente
    if (cpfNormalized.length === 11) {
      if (!validateCPF(cpfNormalized)) {
        throw new BadRequestError('CPF inválido');
      }
      cpfToSave = cpfNormalized;
    }
  }
}
```

### Adicionar import de BadRequestError se não existir:

```typescript
import { BadRequestError } from '@core/errors';
```

---

## TAREFA 4: CRIAR MIGRATION 112

### Criar arquivo:
`backend/migrations/112_fix_cpf_security_vulnerabilities.sql`

### Conteúdo:

(Usar o arquivo 112_fix_cpf_security_vulnerabilities.sql fornecido)

---

## TAREFA 5: APLICAR MIGRATION

```bash
cd backend && npm run migrate
```

---

## VALIDAÇÃO

### Teste 1: CPF inválido deve ser rejeitado

```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "123456", "cpf": "11111111111"}'
```
**Esperado:** Status 400, mensagem "CPF inválido"

### Teste 2: CPF válido deve ser aceito

```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "123456", "cpf": "52998224725"}'
```
**Esperado:** Status 200/201, conta criada

### Teste 3: CPF duplicado deve ser rejeitado

```bash
# Segunda tentativa com mesmo CPF
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test2@test.com", "password": "123456", "cpf": "52998224725"}'
```
**Esperado:** Status 409, mensagem "CPF já está em uso"

### Teste 4: Verificar trigger de proteção

```sql
-- Simular exclusão de conta
DELETE FROM users WHERE email = 'test@test.com';

-- Verificar que CPF foi preservado
SELECT * FROM user_profiles WHERE cpf = '52998224725';
-- Esperado: Registro existe com user_id = NULL, status = 'deleted'

-- Tentar criar nova conta com mesmo CPF
INSERT INTO user_profiles (user_id, cpf) VALUES ('novo-uuid', '52998224725');
-- Esperado: ERRO "CPF já foi utilizado anteriormente"
```

---

## 🚨 NÃO FAZER

- ❌ Remover a migration 105 (apenas adicionar 112)
- ❌ Alterar a estrutura de user_profiles sem rodar migration
- ❌ Usar console.log (usar devLog quando disponível)
- ❌ Pular validação de CPF em qualquer ponto de entrada

---

## CRITÉRIO DE ACEITE

- [ ] `cpf.validator.ts` criado
- [ ] `auth.service.ts` validando CPF
- [ ] `profile.service.ts` validando CPF
- [ ] Migration 112 criada e aplicada
- [ ] Testes de validação passando
- [ ] CPF sobrevive à exclusão de conta
- [ ] CPF órfão não pode ser reutilizado

---

*Prompt de Segurança CPF — Claude — 03/01/2026*
