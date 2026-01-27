# 🔍 AUDITORIA DEFINITIVA — CPF NÃO SALVA VIA DASHBOARD

**Data:** 02/01/2026  
**Colaboração:** Claude + ChatGPT

---

## 📊 DIAGNÓSTICO

### O que o ChatGPT disse:
> "Frontend envia CPF em `personal_profile.cpf`, backend só olha para `metadata.cpf`"

### O que eu encontrei:

**PARCIALMENTE CORRETO, MAS COM NUANCE:**

| Componente | O que acontece |
|------------|----------------|
| Frontend | Envia CPF em `metadata.cpf` ✅ |
| Backend | Procura em `input.metadata.cpf` ✅ |
| Fluxo | Deveria funcionar... |

---

## 🔴 PROBLEMA REAL IDENTIFICADO

O fluxo de extração está **correto**, mas há **3 gaps** que impedem o salvamento:

### Gap 1: Log insuficiente

O código não loga o valor de `cpfToSave` ANTES de verificar `if (cpfToSave)`. Isso esconde se a extração funcionou.

**Linha 279 atual:**
```typescript
if (cpfToSave) {
```

**Faltando log:** O que é `cpfToSave` nesse ponto?

### Gap 2: Constraint pode não existir

A migration 110 adiciona `UNIQUE(user_id)` em `user_profiles`, mas:
- Se a migration não rodou, o `ON CONFLICT (user_id)` falha silenciosamente
- O erro é engolido pelo `catch`

### Gap 3: CPF NOT NULL mas nullable no código

A tabela tem `cpf VARCHAR(11) NOT NULL`, mas o código tenta INSERT sem garantir que CPF não é null:

```typescript
if (cpfToSave) {  // Se cpfToSave é null, nunca entra aqui
  // UPSERT só acontece se cpfToSave não é null
}
```

Se `cpfToSave` é null (extração falhou), o UPSERT nunca executa e o CPF nunca é criado.

---

## 🔧 SOLUÇÃO DEFINITIVA

### PASSO 1: Adicionar log de diagnóstico ANTES do if

**Arquivo:** `backend/src/core/profile/profile.service.ts`

**LOCALIZAR** linha ~277 (antes do `if (cpfToSave)`).

**ADICIONAR** antes da linha `if (cpfToSave) {`:

```typescript
    // 🔴 DIAGNÓSTICO: Log do cpfToSave ANTES de verificar
    console.log('[ProfileService] 🔍 CPF extraído do input:', {
      userId,
      cpfToSave,
      cpfToSaveLength: cpfToSave?.length,
      inputHasMetadata: !!input.metadata,
      inputMetadataKeys: input.metadata ? Object.keys(input.metadata) : [],
      inputMetadataCpf: (input.metadata as any)?.cpf,
      inputMetadataCpfType: typeof (input.metadata as any)?.cpf,
    });
```

### PASSO 2: Corrigir extração para aceitar CPF em múltiplos locais

O código atual (linhas 184-195) procura em:
- `input.metadata.cpf`
- `input.metadata.personal_profile?.cpf`

**SUBSTITUIR** linhas 184-195 por:

```typescript
    // 🔴 LGPD: Extrair CPF de TODOS os locais possíveis
    // CPF pode vir de: input.cpf, input.metadata.cpf, input.personal_profile.cpf
    let cpfToSave: string | null = null;
    
    // Ordem de prioridade para encontrar CPF:
    const possibleCpfSources = [
      (input as any).cpf,                           // input.cpf (direto)
      (input.metadata as any)?.cpf,                 // input.metadata.cpf
      (input.metadata as any)?.personal_profile?.cpf, // input.metadata.personal_profile.cpf
      (input as any).personal_profile?.cpf,         // input.personal_profile.cpf
    ];
    
    console.log('[ProfileService] 🔍 Buscando CPF em múltiplas fontes:', {
      userId,
      sources: possibleCpfSources.map((s, i) => ({ index: i, value: s, type: typeof s })),
    });
    
    for (const cpfSource of possibleCpfSources) {
      if (cpfSource && typeof cpfSource === 'string') {
        const cpfClean = cpfSource.replace(/\D/g, '');
        if (cpfClean.length === 11) {
          cpfToSave = cpfClean;
          console.log('[ProfileService] ✅ CPF encontrado:', {
            userId,
            sourceIndex: possibleCpfSources.indexOf(cpfSource),
            cpfPreview: cpfClean.substring(0, 3) + '***',
          });
          break;
        }
      }
    }
    
    if (!cpfToSave) {
      console.log('[ProfileService] ⚠️ CPF não encontrado em nenhuma fonte:', {
        userId,
        inputKeys: Object.keys(input),
        metadataKeys: input.metadata ? Object.keys(input.metadata) : [],
      });
    }
```

### PASSO 3: Verificar constraint no banco

**Executar no PostgreSQL:**

```sql
-- Verificar se constraint existe
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass;

-- Se não existir, criar:
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);

-- Verificar se coluna updated_at existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles';

-- Se não existir, criar:
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
```

### PASSO 4: Melhorar UPSERT para não falhar silenciosamente

**SUBSTITUIR** o código do UPSERT (linhas 279-318) por:

```typescript
    // 🔴 DIAGNÓSTICO: Log ANTES de verificar cpfToSave
    console.log('[ProfileService] 🔍 CPF para salvar:', {
      userId,
      cpfToSave,
      cpfToSaveLength: cpfToSave?.length,
      willAttemptUpsert: !!cpfToSave,
    });

    // 🔴 LGPD: Salvar CPF em user_profiles
    if (cpfToSave) {
      try {
        const { pool } = await import('@core/database/pool');
        console.log('[ProfileService] 🔄 Tentando UPSERT em user_profiles:', {
          userId,
          cpfPreview: cpfToSave.substring(0, 3) + '***',
        });
        
        // Primeiro, verificar se constraint existe
        const constraintCheck = await pool.query(`
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'user_profiles_user_id_unique'
        `);
        
        if (constraintCheck.rows.length === 0) {
          console.warn('[ProfileService] ⚠️ Constraint user_profiles_user_id_unique NÃO EXISTE!');
          console.warn('[ProfileService] ⚠️ Executando migration para criar constraint...');
          
          // Tentar criar constraint on-the-fly
          await pool.query(`
            ALTER TABLE user_profiles
            ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id)
          `).catch(e => {
            console.warn('[ProfileService] ⚠️ Erro ao criar constraint (pode já existir):', e.message);
          });
        }
        
        // UPSERT com log detalhado
        const cpfResult = await pool.query<{ profile_id: string }>(
          `
          INSERT INTO user_profiles (user_id, cpf)
          VALUES ($1, $2)
          ON CONFLICT (user_id)
          DO UPDATE SET
            cpf = EXCLUDED.cpf,
            updated_at = now()
          RETURNING profile_id
          `,
          [userId, cpfToSave]
        );
        
        if (cpfResult.rows.length === 0) {
          console.error('[ProfileService] ❌ UPSERT retornou 0 linhas - possível problema de constraint');
        } else {
          console.log('[ProfileService] ✅ CPF salvo em user_profiles:', {
            userId,
            profileId: cpfResult.rows[0].profile_id,
            cpfPreview: cpfToSave.substring(0, 3) + '***',
          });
        }
      } catch (err) {
        console.error('[ProfileService] ❌ Erro ao salvar CPF em user_profiles:', {
          userId,
          error: err instanceof Error ? err.message : String(err),
          code: (err as any).code, // Código do erro PostgreSQL
          constraint: (err as any).constraint, // Nome da constraint violada
        });
      }
    } else {
      console.log('[ProfileService] ℹ️ CPF não fornecido, não salvando em user_profiles');
    }
```

---

## 📋 PROMPT PARA CURSOR

```
Você está no monorepo Unificard.

PROBLEMA:
CPF digitado pelo usuário no dashboard NÃO é salvo em user_profiles.
O backend retorna sucesso mas CPF não persiste.

CAUSA RAIZ:
1. Extração de CPF pode estar falhando silenciosamente
2. Log insuficiente esconde o problema
3. Constraint UNIQUE pode não existir

TAREFAS:

### 1. ATUALIZAR profile.service.ts

Arquivo: backend/src/core/profile/profile.service.ts

SUBSTITUIR linhas 184-195 (extração de CPF) por:

    // 🔴 LGPD: Extrair CPF de TODOS os locais possíveis
    let cpfToSave: string | null = null;
    
    const possibleCpfSources = [
      (input as any).cpf,
      (input.metadata as any)?.cpf,
      (input.metadata as any)?.personal_profile?.cpf,
      (input as any).personal_profile?.cpf,
    ];
    
    console.log('[ProfileService] 🔍 Buscando CPF em múltiplas fontes:', {
      userId,
      sources: possibleCpfSources.map((s, i) => ({ index: i, value: s ? '***' : null, type: typeof s })),
    });
    
    for (const cpfSource of possibleCpfSources) {
      if (cpfSource && typeof cpfSource === 'string') {
        const cpfClean = cpfSource.replace(/\D/g, '');
        if (cpfClean.length === 11) {
          cpfToSave = cpfClean;
          console.log('[ProfileService] ✅ CPF encontrado na fonte:', {
            userId,
            sourceIndex: possibleCpfSources.indexOf(cpfSource),
          });
          break;
        }
      }
    }
    
    if (!cpfToSave) {
      console.log('[ProfileService] ⚠️ CPF não encontrado:', {
        userId,
        inputKeys: Object.keys(input),
        metadataKeys: input.metadata ? Object.keys(input.metadata) : [],
      });
    }


### 2. ADICIONAR LOG ANTES DO IF (cpfToSave)

LOCALIZAR linha ~277 (antes do if (cpfToSave)).

ADICIONAR:

    console.log('[ProfileService] 🔍 CPF extraído:', {
      userId,
      cpfToSave: cpfToSave ? cpfToSave.substring(0, 3) + '***' : null,
      willSave: !!cpfToSave,
    });


### 3. VERIFICAR CONSTRAINT NO BANCO

Executar SQL:

SELECT conname FROM pg_constraint WHERE conrelid = 'user_profiles'::regclass;

Se 'user_profiles_user_id_unique' não existir:

ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();


### 4. TESTAR

1. Reiniciar backend
2. Abrir /profile
3. Digitar CPF válido (ex: 123.456.789-09)
4. Clicar Salvar
5. Verificar logs do backend - deve mostrar:
   - "🔍 Buscando CPF em múltiplas fontes"
   - "✅ CPF encontrado"
   - "✅ CPF salvo em user_profiles"
6. Verificar no banco:
   SELECT * FROM user_profiles WHERE user_id = 'xxx';
```

---

## 🧪 VALIDAÇÃO

### Teste 1: Log de extração

Após a correção, o log deve mostrar:
```
[ProfileService] 🔍 Buscando CPF em múltiplas fontes: { userId: 'xxx', sources: [...] }
[ProfileService] ✅ CPF encontrado na fonte: { userId: 'xxx', sourceIndex: 1 }
```

### Teste 2: Log de UPSERT

```
[ProfileService] 🔍 CPF extraído: { userId: 'xxx', cpfToSave: '123***', willSave: true }
[ProfileService] 🔄 Tentando UPSERT em user_profiles: { userId: 'xxx' }
[ProfileService] ✅ CPF salvo em user_profiles: { userId: 'xxx', profileId: 'yyy' }
```

### Teste 3: Verificação no banco

```sql
SELECT u.email, up.cpf, up.created_at, up.updated_at
FROM users u
LEFT JOIN user_profiles up ON up.user_id = u.user_id
WHERE u.email = 'dev@unificard.local';
```

Deve retornar CPF preenchido.

---

## ⚠️ SE AINDA NÃO FUNCIONAR

Se após as correções o CPF ainda não salvar:

1. **Verificar se migration 110 rodou:**
```sql
SELECT * FROM schema_migrations WHERE filename LIKE '%110%';
```

2. **Verificar se coluna updated_at existe:**
```sql
\d user_profiles
```

3. **Verificar logs do backend** - procurar por:
- "❌ Erro ao salvar CPF"
- "⚠️ Constraint não existe"

4. **Testar UPSERT diretamente:**
```sql
INSERT INTO user_profiles (user_id, cpf)
VALUES ('user-id-aqui', '12345678900')
ON CONFLICT (user_id)
DO UPDATE SET cpf = EXCLUDED.cpf, updated_at = now()
RETURNING *;
```

---

*Documento de auditoria — Claude + ChatGPT — 02/01/2026*
