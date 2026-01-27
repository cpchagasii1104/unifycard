# 🎯 PROMPT PARA CURSOR — UNIFICARD (VERSÃO AUDITADA CLAUDE + CHATGPT)

Você está no monorepo Unificard.

## CONTEXTO GERAL

O Unificard é um sistema multi-tenant orientado a actors, com identidade de usuários,
empresas e grupos, e um modelo econômico baseado em split de pagamento.

O sistema já passou por correções de login, tenant mismatch e LGPD (CPF fora de users).
Agora precisamos FECHAR DEFINITIVAMENTE três gaps estruturais:

- **A)** Código de indicação (referral) não determinístico no perfil
- **B)** Código de indicação não conectado ao motor de split/ledger
- **C)** CPF isolado, sem correlação canônica com identidade/actors

---

## ⚠️ REGRAS INVIOLÁVEIS

- JWT é a ÚNICA fonte de tenant (não confiar em headers do frontend)
- Referral code é identidade ECONÔMICA, não marketing
- CPF é dado sensível e vive FORA de users (em user_profiles)
- Actor herda identidade do usuário
- Usuário novo e antigo devem ter comportamento IDÊNTICO

---

## TAREFAS (EXECUTAR EM ORDEM EXATA)

---

### TAREFA 1: VERIFICAR E CRIAR MIGRATIONS

```bash
# Verificar última migration existente
ls -la backend/migrations/ | tail -10

# Verificar se as migrations já existem
ls backend/migrations/ | grep -E "107|108|109"
```

Se NÃO existirem, criar os arquivos:

#### Arquivo: `backend/migrations/107_add_referral_code_to_users.sql`

```sql
-- Migration 107: Adicionar referral_code a users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_unique 
ON users(tenant_id, referral_code) WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_referral_code_lookup_idx 
ON users(referral_code) WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN users.referral_code IS 'Código de indicação único. Imutável após geração.';
```

#### Arquivo: `backend/migrations/108_create_user_referral_links.sql`

```sql
-- Migration 108: Vínculos de indicação
CREATE TABLE IF NOT EXISTS user_referral_links (
  link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  referrer_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  referral_code_used VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS user_referral_links_referrer_idx ON user_referral_links(referrer_user_id);
CREATE INDEX IF NOT EXISTS user_referral_links_tenant_idx ON user_referral_links(tenant_id);

ALTER TABLE user_referral_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_referral_links' AND policyname = 'user_referral_links_rls') THEN
    CREATE POLICY user_referral_links_rls ON user_referral_links USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
```

#### Arquivo: `backend/migrations/109_create_ledger_referral_splits.sql`

```sql
-- Migration 109: Ledger de splits
CREATE TABLE IF NOT EXISTS ledger_referral_splits (
  split_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
  profit_event_id UUID NOT NULL,
  original_transaction_id UUID NOT NULL,
  source_user_id UUID NOT NULL REFERENCES users(user_id),
  beneficiary_user_id UUID NOT NULL REFERENCES users(user_id),
  referral_link_id UUID,
  original_amount_cents INTEGER NOT NULL,
  percentage_bps INTEGER NOT NULL DEFAULT 500,
  split_amount_cents INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','credited','failed','reversed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  credited_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ledger_referral_splits_beneficiary_idx ON ledger_referral_splits(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS ledger_referral_splits_status_idx ON ledger_referral_splits(status);
CREATE INDEX IF NOT EXISTS ledger_referral_splits_tenant_idx ON ledger_referral_splits(tenant_id);

ALTER TABLE ledger_referral_splits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ledger_referral_splits' AND policyname = 'ledger_referral_splits_rls') THEN
    CREATE POLICY ledger_referral_splits_rls ON ledger_referral_splits USING (tenant_id::text = current_setting('app.current_tenant', true));
  END IF;
END $$;
```

**Executar migrations:**
```bash
cd backend && npm run migrate
```

---

### TAREFA 2: ATUALIZAR core.service.ts

**Arquivo:** `backend/src/core/core.service.ts`

**LOCALIZAR** linhas ~117-165 (busca de referralCode e CPF separadamente).

**SUBSTITUIR** por este código exato:

```typescript
      // 2. Perfil pessoal - Query única com JOIN + geração garantida
      let referralCode: string | null = null;
      let cpf: string | null = null;
      
      try {
        const { pool } = await import('@core/database/pool');
        
        // Query única que busca referral_code e CPF de uma vez
        const identityResult = await pool.query<{
          referral_code: string | null;
          cpf: string | null;
        }>(
          `
          SELECT u.referral_code, up.cpf
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.user_id
          WHERE u.user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        
        const row = identityResult.rows[0];
        if (row) {
          cpf = row.cpf || null;
          referralCode = row.referral_code || null;
          
          // 🔴 GERAÇÃO GARANTIDA: Se não tem código, gerar AGORA
          if (!referralCode) {
            console.log('[CoreService] 🔄 Gerando código de indicação:', { userId });
            const { referralService } = await import('@core/referral/referral.service');
            referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
            console.log('[CoreService] ✅ Código gerado:', { userId, referralCode });
          }
        }
      } catch (err) {
        console.error('[CoreService] ❌ Erro ao buscar identidade:', {
          userId,
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        
        // Fallback: tentar gerar código mesmo em caso de erro na query
        try {
          const { referralService } = await import('@core/referral/referral.service');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
        } catch (genErr) {
          console.error('[CoreService] ❌ Falha também na geração:', genErr);
        }
      }
```

---

### TAREFA 3: ATUALIZAR referral.service.ts

**Arquivo:** `backend/src/core/referral/referral.service.ts`

**LOCALIZAR** método `applyReferralCode`, linha ~140 (onde faz o UPDATE em users.metadata).

**ADICIONAR** este código ANTES do `return { referrerUserId: referrer.user_id };`:

```typescript
    // Registrar vínculo na tabela user_referral_links (para split)
    try {
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (referred_user_id) DO NOTHING
        `,
        [tenantId, referrer.user_id, newUserId, referralCode]
      );
      console.log('[ReferralService] ✅ Vínculo de indicação registrado:', {
        referrerUserId: referrer.user_id,
        referredUserId: newUserId,
      });
    } catch (err) {
      console.warn('[ReferralService] ⚠️ Erro ao registrar vínculo (não crítico):', err);
    }
```

---

### TAREFA 4: CRIAR DIRETÓRIO E SERVIÇO DE SPLIT

```bash
mkdir -p backend/src/core/economy
```

**Arquivo:** `backend/src/core/economy/referral-split.service.ts`

Copiar o conteúdo do arquivo `referral-split.service.ts` fornecido na documentação.

**Arquivo:** `backend/src/core/economy/index.ts`

```typescript
export { referralSplitService } from './referral-split.service';
```

---

### TAREFA 5: VERIFICAR FRONTEND Profile.tsx

**Arquivo:** `frontend/src/components/Profile.tsx`

**VERIFICAR** se o bloco de referralCode está sendo exibido (linhas ~1838-1870).

Se não estiver exibindo corretamente, garantir que:

1. **Estado existe:** 
```typescript
const [referralCode, setReferralCode] = useState<string | null>(null);
```

2. **Estado é populado (em loadData):**
```typescript
setReferralCode(personalProfile?.referralCode ?? null);
```

3. **UI existe (dentro do formulário pessoal):**
```tsx
{referralCode && (
  <div className="form-group referral-code-group">
    <label htmlFor="referralCode">Seu Código de Indicação</label>
    <div className="referral-code-container" style={{ display: 'flex', gap: '8px' }}>
      <input
        id="referralCode"
        type="text"
        value={referralCode}
        readOnly
        style={{ 
          flex: 1, 
          fontFamily: 'monospace', 
          fontSize: '1.1em',
          letterSpacing: '2px',
          fontWeight: 'bold'
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (referralCode) {
            navigator.clipboard.writeText(referralCode);
            alert('Código copiado!');
          }
        }}
        style={{ padding: '8px 16px' }}
      >
        📋 Copiar
      </button>
    </div>
    <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
      Compartilhe este código e ganhe comissões quando seus indicados usarem o Unificard!
    </small>
  </div>
)}
```

---

### TAREFA 6: INTEGRAR SPLIT ENGINE NOS PAGAMENTOS

**Locais de integração:**

1. `backend/src/core/unifywork/payment.service.ts` — Após confirmação de pagamento de serviço
2. `backend/src/core/events/event-economy.service.ts` — Após compra de ingresso

**Código a adicionar em cada local (após pagamento confirmado):**

```typescript
import { referralSplitService } from '@core/economy/referral-split.service';

// Após pagamento confirmado com sucesso:
try {
  await referralSplitService.processReferralSplit({
    tenantId,
    transactionId: transaction.transaction_id,
    sourceUserId: payerUserId, // Quem pagou (pode gerar comissão para quem indicou)
    amountCents: amountCents,
    percentageBps: 500, // 5% de comissão para indicador
    metadata: {
      type: 'service_payment', // ou 'ticket_purchase', etc
    },
  });
} catch (err) {
  // Não falha o pagamento se split falhar
  console.warn('[Payment] Erro ao processar split de referral:', err);
}
```

---

### TAREFA 7: REINICIAR E TESTAR

```bash
# Backend
cd backend && npm run dev

# Frontend (outro terminal)
cd frontend && npm run dev
```

---

## VALIDAÇÃO FINAL (CHECKLIST)

### Teste 1: Usuário novo
1. Criar conta nova
2. Acessar /profile
3. ✅ CPF aparece (se informado no cadastro)
4. ✅ Código de indicação aparece
5. ✅ Botão copiar funciona

### Teste 2: Usuário antigo sem código
1. Fazer login com usuário antigo
2. Acessar /profile
3. ✅ Código é gerado automaticamente
4. ✅ Código aparece no perfil

### Teste 3: Banco de dados
```sql
-- Verificar se código foi gerado
SELECT user_id, email, referral_code FROM users WHERE email = 'teste@exemplo.com';

-- Verificar se vínculo foi criado (se usou código de indicação)
SELECT * FROM user_referral_links ORDER BY created_at DESC LIMIT 5;

-- Verificar se tabela de splits existe
SELECT COUNT(*) FROM ledger_referral_splits;
```

### Teste 4: Transação com split
1. Executar um pagamento de serviço
2. Verificar se split foi registrado:
```sql
SELECT * FROM ledger_referral_splits ORDER BY created_at DESC LIMIT 5;
```

---

## ❌ SE ALGO FALHAR

1. **Código não aparece:**
   - Verificar logs do backend por erros
   - Verificar se migration 107 foi executada: `SELECT referral_code FROM users LIMIT 1;`
   - Verificar se `users.referral_code` existe no banco

2. **Erro de RLS:**
   - Usar `pool.query` diretamente (sem RLS) para queries de identidade
   - Verificar se tenant está sendo passado corretamente

3. **Frontend não atualiza:**
   - Verificar console do browser por erros
   - Verificar response de `GET /core/profile` — deve ter `personal_profile.referralCode`

4. **Split não é registrado:**
   - Verificar se `user_referral_links` tem o vínculo
   - Verificar se `referralSplitService.processReferralSplit` está sendo chamado

---

*Prompt auditado e aprovado — Colaboração Claude + ChatGPT — 02/01/2026*
