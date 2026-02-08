# 🔧 CORREÇÃO: CÓDIGO DE INDICAÇÃO — UnifiCard

**Data:** 02/01/2026  
**Status:** Arquitetura existe, mas não fecha o ciclo

---

## 📊 DIAGNÓSTICO

### O que já existe (e está correto)

```
users.referral_code → Campo onde o código é salvo
referral.service.ts → getOrCreateReferralCode(), applyReferralCode()
auth.service.ts     → Gera código no signup (linhas 265-271)
core.service.ts     → Busca código para o perfil (linhas 121-136)
Profile.tsx         → Exibe código (linhas 1823-1850)
```

### Por que não aparece

**3 possíveis causas:**

1. **Geração falha silenciosamente no signup**
   - Try/catch engole erro
   - Código nunca é salvo

2. **Query usa tenant errado** (relacionado ao TENANT_MISMATCH)
   - `runQueryWithTenant` falha
   - Retorna null

3. **Usuários antigos não têm código**
   - Criados antes da feature
   - Nunca tiveram código gerado

---

## ✅ CORREÇÕES NECESSÁRIAS

### CORREÇÃO 1: Garantir geração no signup (não silenciar erro)

**Arquivo:** `backend/src/core/auth/auth.service.ts`

**Localizar linhas 265-271:**

```typescript
    // Gerar código de indicação automaticamente
    try {
      const { referralService } = await import('@core/referral/referral.service');
      await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
    } catch (err) {
      // Log mas não falha o registro
      console.warn('Erro ao gerar código de indicação (não crítico):', err);
    }
```

**Problema:** Se falhar, o usuário fica sem código.

**ALTERAR PARA:**

```typescript
    // Gerar código de indicação automaticamente
    // 🔴 CRÍTICO: Código de indicação é chave financeira, DEVE ser gerado
    try {
      const { referralService } = await import('@core/referral/referral.service');
      const generatedCode = await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
      console.log('[AuthService] ✅ Código de indicação gerado:', {
        userId: user.userId,
        referralCode: generatedCode,
      });
    } catch (err) {
      // 🔴 Log como ERROR, não WARN - código é importante
      console.error('[AuthService] ❌ ERRO ao gerar código de indicação:', {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Não falha o registro, mas o código ficará vazio
      // Será gerado na primeira vez que o usuário acessar o perfil
    }
```

---

### CORREÇÃO 2: Garantir que core.service busque corretamente

**Arquivo:** `backend/src/core/core.service.ts`

**Localizar linhas 121-136** (busca de referral_code).

**PROBLEMA:** A query usa `runQueryWithTenant` que pode sofrer com TENANT_MISMATCH.

**ALTERAR DE:**

```typescript
      let referralCode: string | null = null;
      try {
        const referralResult = await runQueryWithTenant<{ referral_code: string | null }>(
          tenantId,
          `
          SELECT referral_code
          FROM users
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        referralCode = referralResult?.referral_code || null;
      } catch (err) {
        console.warn('Erro ao buscar código de indicação (não crítico):', err);
      }
```

**PARA (usando pool diretamente para evitar problemas com RLS):**

```typescript
      // Buscar código de indicação da tabela users
      // 🔴 Usar pool diretamente para evitar problemas com RLS/tenant
      let referralCode: string | null = null;
      try {
        const { pool } = await import('@core/database/pool');
        const referralResult = await pool.query<{ referral_code: string | null }>(
          `
          SELECT referral_code
          FROM users
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        referralCode = referralResult.rows[0]?.referral_code || null;
        
        // 🔴 Se usuário existe mas não tem código, gerar agora (migração lazy)
        if (!referralCode) {
          console.log('[CoreService] ⚠️ Usuário sem código de indicação, gerando agora:', { userId });
          const { referralService } = await import('@core/referral/referral.service');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
          console.log('[CoreService] ✅ Código gerado:', { userId, referralCode });
        }
      } catch (err) {
        console.error('[CoreService] ❌ Erro ao buscar/gerar código de indicação:', err);
      }
```

---

### CORREÇÃO 3: Endpoint dedicado como fallback

O endpoint `/referral/code` já existe, mas o frontend não o usa diretamente.

**Arquivo:** `frontend/src/components/Profile.tsx`

**Após linha 563** (onde seta referralCode do personalProfile), adicionar fallback:

```typescript
      // Setar código de indicação
      let code = personalProfile?.referralCode ?? null;
      
      // 🔴 FALLBACK: Se não veio no profile, buscar diretamente
      if (!code) {
        try {
          const { getReferralCode } = await import('../api/referral');
          const referralData = await getReferralCode();
          code = referralData.referralCode;
          console.log('[Profile] ✅ Código de indicação obtido via fallback:', code);
        } catch (err) {
          console.warn('[Profile] ⚠️ Não foi possível obter código de indicação:', err);
        }
      }
      
      setReferralCode(code);
```

---

### CORREÇÃO 4: Criar tabela user_referral_links (para split futuro)

**IMPORTANTE:** Isso é para o FUTURO, não precisa agora para o código aparecer.

Mas para fechar a arquitetura de split, criar migration:

**Arquivo:** `backend/migrations/106_create_user_referral_links.sql`

```sql
-- Migration 106: Criar tabela de vínculos de indicação para split
-- Data: 2025-01-02

-- Tabela que vincula quem indicou quem
-- Usada para calcular split de pagamento
CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referral_code VARCHAR(20) NOT NULL,  -- Código usado no momento do cadastro
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Garantir unicidade: cada usuário só pode ser indicado uma vez
  UNIQUE(referred_user_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx ON user_referral_links(referrer_user_id);
CREATE INDEX IF NOT EXISTS user_referral_links_referred_idx ON user_referral_links(referred_user_id);

-- Comentário para documentação
COMMENT ON TABLE user_referral_links IS 'Vínculos de indicação entre usuários. Usado para calcular split de pagamento.';
COMMENT ON COLUMN user_referral_links.referrer_user_id IS 'Usuário que indicou (recebe % do split)';
COMMENT ON COLUMN user_referral_links.referred_user_id IS 'Usuário que foi indicado';
COMMENT ON COLUMN user_referral_links.referral_code IS 'Código usado no momento do cadastro (auditoria)';
```

**E atualizar o applyReferralCode() para usar essa tabela:**

**Arquivo:** `backend/src/core/referral/referral.service.ts`

**Método applyReferralCode, adicionar após salvar em metadata:**

```typescript
    // Registrar relação de indicação em tabela dedicada (para split)
    try {
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO user_referral_links (referrer_user_id, referred_user_id, referral_code)
        VALUES ($1, $2, $3)
        ON CONFLICT (referred_user_id) DO NOTHING
        `,
        [referrer.user_id, newUserId, referralCode]
      );
    } catch (err) {
      console.warn('Erro ao registrar vínculo de indicação (não crítico):', err);
    }
```

---

## 🎯 PROMPT PARA O CURSOR

```
Você está no monorepo Unificard.

PROBLEMA:
Código de indicação não aparece no perfil.
Código é chave financeira (split de pagamento), precisa funcionar.

TAREFAS (EXECUTAR EM ORDEM):

### 1. Melhorar log de geração no signup

Arquivo: backend/src/core/auth/auth.service.ts

Localizar linhas 265-271 (try/catch do referralService).
SUBSTITUIR por:

    // Gerar código de indicação automaticamente
    try {
      const { referralService } = await import('@core/referral/referral.service');
      const generatedCode = await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
      console.log('[AuthService] ✅ Código de indicação gerado:', {
        userId: user.userId,
        referralCode: generatedCode,
      });
    } catch (err) {
      console.error('[AuthService] ❌ ERRO ao gerar código de indicação:', {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }


### 2. Gerar código lazy se não existir

Arquivo: backend/src/core/core.service.ts

SUBSTITUIR linhas 121-136 (busca de referralCode) por:

      // Buscar código de indicação
      let referralCode: string | null = null;
      try {
        const { pool } = await import('@core/database/pool');
        const referralResult = await pool.query<{ referral_code: string | null }>(
          `SELECT referral_code FROM users WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        referralCode = referralResult.rows[0]?.referral_code || null;
        
        // Se não tem código, gerar agora (migração lazy)
        if (!referralCode) {
          console.log('[CoreService] Usuário sem código, gerando:', { userId });
          const { referralService } = await import('@core/referral/referral.service');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
        }
      } catch (err) {
        console.error('[CoreService] Erro ao buscar/gerar código:', err);
      }


### 3. Frontend: fallback para buscar código

Arquivo: frontend/src/components/Profile.tsx

Localizar linha 563 (setReferralCode).
SUBSTITUIR por:

      // Código de indicação com fallback
      let code = personalProfile?.referralCode ?? null;
      
      if (!code) {
        try {
          const { getReferralCode } = await import('../api/referral');
          const referralData = await getReferralCode();
          code = referralData.referralCode;
          console.log('[Profile] Código obtido via fallback:', code);
        } catch (err) {
          console.warn('[Profile] Não obteve código:', err);
        }
      }
      
      setReferralCode(code);


### 4. Reiniciar backend e testar

VALIDAÇÃO:
1. Acessar /profile
2. Código de indicação deve aparecer
3. Botão "Copiar" deve funcionar

Se não aparecer, verificar logs do backend por erros.
```

---

## 📊 GOVERNANÇA DO CÓDIGO DE INDICAÇÃO

### Regras Imutáveis

| Regra | Descrição |
|-------|-----------|
| **Único por usuário** | 1 usuário = 1 código, sempre |
| **Imutável** | Nunca pode ser alterado após geração |
| **Permanente** | Nunca expira |
| **Auditável** | Sempre registrado com timestamp |
| **Financeiro** | Define % de split em transações futuras |

### Fluxo de Split (Futuro)

```
Usuário A (código: UNI-ABC123)
        ↓
Usuário B cadastra com UNI-ABC123
        ↓
user_referral_links:
  referrer_user_id = A
  referred_user_id = B
        ↓
B faz transação de R$ 100
        ↓
Split Engine consulta user_referral_links
        ↓
A recebe X% como comissão de indicação
```

---

## ⚠️ POR QUE NÃO CRIAR NOVA TABELA AGORA?

O código já está em `users.referral_code`. Criar `user_referrals` seria:
- Migração de dados desnecessária agora
- Mais complexidade para resolver problema simples
- Pode ser feito depois se necessário

**Decisão pragmática:** Corrigir o fluxo existente primeiro. Se precisar de tabela separada para auditoria futura, criar `user_referral_links` (não `user_referrals`).

---

*Documento gerado em 02/01/2026*
