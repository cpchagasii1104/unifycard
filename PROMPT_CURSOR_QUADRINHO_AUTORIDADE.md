# PROMPT PARA CLAUDE CODE — SESSÃO FASE 4 / QUADRINHO DE AUTORIDADE

**v5 (final) — 2026-04-22**

**NÃO ABREVIAR. NÃO PULAR ETAPAS. NÃO IMPROVISAR. NÃO RECONSTRUIR ARQUIVOS A PARTIR DE `dist/`. NÃO REFATORAR NADA FORA DO ESCOPO LISTADO.**

Ao final de cada PASSO: **pare**, rode os 4 gates CI, mostre o output completo para Clayton e **aguarde "go"** antes do próximo PASSO.

---

## 🛑 KILL SWITCH GLOBAL (topo absoluto — leia antes de tudo)

Parar a sessão inteira, **não continuar nenhum PASSO seguinte**, se ocorrer qualquer um:

1. **Gate CI falhar 2 vezes seguidas** no mesmo PASSO (após tentativa de correção cirúrgica mínima). Uma falha = parar e reportar; duas = sessão encerrada.
2. **Alteração ultrapassar 200 linhas acumuladas** somando todos os PASSOs da sessão (excluindo migrations SQL novas).
3. **Mais de 2 arquivos fora do escopo listado** forem tocados (qualquer edit, mesmo trivial).
4. **Qualquer ambiguidade** (rota HTTP duvidosa, caller não localizado, símbolo não encontrado, função com mais de uma assinatura candidata) que exija "chutar" a decisão.
5. **Qualquer tentativa de resolver um problema novo** que apareça durante a sessão e não esteja listado no escopo dos 4 Cs (C47, C54, C55, C57).
6. **Detecção de conflito entre invariantes** (ex.: fechar C54 num caller exige violar INV-ID).

**Ao disparar o kill switch:** commit do estado parcial (se já houver), reportar qual gatilho disparou, devolver controle a Clayton. **Não improvisar recuperação.**

---

## CONTEXTO (leia integralmente antes de qualquer edição)

Você está em `C:\unificard\backend`. Branch: `rescue-structural`. HEAD atual: `890f18d9`.

**HEAD atualizado em 2026-04-23.** Commits desta fase: `0272141c` → `2fd1a5ac`. Ver `passo5.md` para lista completa.

**O sistema não tem usuários reais cadastrados.** Nenhum dado em `users`, `companies`, `actors`, `authority_roots`, `authority_trust_levels`. Este é o único momento em que correções estruturais de autoridade têm custo zero.

Auditoria forense 2026-04-22 (**DECISION-0012 e DECISION-0013**) identificou que o sistema de autoridade está estruturalmente inoperante em estado vazio. `AUTHORITY_PRECEDENCE.md` é violado por 4 problemas interdependentes que formam uma única unidade de correção ("quadrinho de autoridade"):

- **C47** — SQL stub `actor_has_permission` retorna `TRUE` incondicionalmente
- **C54** — (briefing original) 9 caminhos de produto sem `requireFinancialRiskClearance` — **FECHADO na fase 2026-04-23**; `transaction.service.ts` @system-context validado; ver `passo5.md`
- **C55** — `authority-decision.service.ts` é fail-open em ATL/KYC/GUARDA (ausência de dados = pass)
- **C57** — `authority_roots` sem FK para `actors` (permite linha órfã)

**Esta sessão fecha os 4 como unidade.** Não fechar qualquer um invalida a correção dos outros três.

---

## INVARIANTES DURAS (verificar em toda ação desta sessão)

### Invariante de Identidade (INV-ID)

- `userId` **nunca** pode ser usado como `actorId`. São domínios diferentes.
- **Origem do `actorId` permitida:**
  1. **Se o fluxo parte de `userId` (HTTP request, sessão de usuário):** DEVE usar `ensureUserActor(tenantId, userId)` do writer canônico `@modules/identity/actor-writer.service` **antes** de qualquer resolução. `ensureUserActor` retorna actor materializado (cria se necessário, idempotente).
  2. **Se o fluxo parte de um `ownerId` já resolvido para wallet:** `resolveActorIdForWalletOwner(tenantId, ownerId)` em `@modules/risk-identity/risk-permissions`.
  3. **Se o actor já foi materializado upstream** (já passou por `ensureUserActor` ou `ensurePageActor` em outra camada): usar a referência já existente.

- **`resolveActorIdForWalletOwner` NÃO substitui `ensureUserActor`.** Se você está num caller HTTP onde o usuário está ordenando a ação, a primeira operação é `ensureUserActor`. Só depois (se necessário para o fluxo) você resolve actor da wallet.
- **Proibido** usar `actorRepository.findOrCreate*` diretamente.
- **Proibido** resolver actor a partir de `global_user_id`, `slug`, `metadata`, ou qualquer outro canal.
- Violação de INV-ID → **PARAR** e reportar. Corrigir C3 de novo é fora de escopo desta sessão.

**ORDEM DE EXECUÇÃO OBRIGATÓRIA (não negociável):**

```
1. Resolver identidade    → const actor = await ensureUserActor(tenantId, userId)
                             (ou equivalente declarado no padrão canônico)
2. Obter actorId          → const actorId = actor.id
3. Executar gate          → await requireFinancialRiskClearance(tenantId, { actorId, ... })
4. Executar operação      → await bankTransactionService.transfer(..., actorId, ...)
```

Essa ordem é **obrigatória e unidirecional**. **Nunca** inverter:
- Gate **antes** de ter actorId resolvido → inválido (actor que passou pelo gate não é o que executa).
- `transfer` **antes** do gate → viola INV-FIN, mesmo se o gate aparecer depois no código.
- `ensureUserActor` **depois** do gate/transfer → o actor no gate é outro (ou inexistente).

Se a ordem natural do fluxo do código já faz isso corretamente, apenas confirme. Se não faz, **reorganize linearmente** seguindo os 4 passos — sem desvios, sem ramificações. Ambiguidade de ordem → **PARAR**.

### Invariante Financeira (INV-FIN)

- `bank_ledger` é a **única** fonte de verdade financeira. `bank_transactions` e `bank_accounts` são SSOTs auxiliares do domínio Bank.
- **Toda** movimentação de dinheiro em código de produto deve passar por `requireFinancialRiskClearance` **antes** de chamar `bankTransactionService.transfer/capture/reverse`.
- Exceção única: workers/processors rodando em `@system-context` (ver INV-SYS).
- **Proibido** calcular saldo, reconstruir posição financeira ou decidir movimentação a partir de `metadata->>`, `payload.X`, `events`, ou qualquer fonte não-canônica.
- Violação de INV-FIN → **PARAR** e reportar.

### Invariante System-Context (INV-SYS)

`@system-context` é um marcador que isenta um caller do gate `requireFinancialRiskClearance`. **Só é permitido** quando **todas** as 3 condições são verdadeiras:

1. **Não há actor humano** iniciando a ação (nenhum `userId`/`actorId` vem de request HTTP ou sessão de usuário).
2. **Execução vem de worker/processor/scheduler identificado** cujo nome está declarado no comentário.
3. **Fluxo não pode ser iniciado por rota HTTP** — isto é, não há caminho em `backend/src/**/*.routes.ts` que leve até este call.

Se qualquer uma das 3 falhar → **não é** `@system-context`. Adicionar o gate.

Se houver **qualquer dúvida** → **PARAR** e reportar. Não marcar por inércia.

### Invariante Anti-Refactor (INV-NO-REFACTOR)

**Proibido nesta sessão:**

- Mover funções entre arquivos
- Renomear símbolos que não estejam diretamente sendo alterados
- Reorganizar imports além do mínimo necessário
- "Limpar" código adjacente ("já que estou aqui...")
- Alterar código fora do escopo explícito de cada PASSO
- Criar arquivos que não sejam migrations ou logs listados neste prompt
- Editar `docs/01_normative/*`, `SYSTEM_REMEDIATION_PLAN.md`, `REMEDIATION_SNAPSHOTS.md`

Cada PASSO toca apenas os arquivos listados. **Não ampliar** o escopo sob nenhum pretexto.

### Invariante Anti-Invenção (INV-NO-GUESS)

Se você não **encontrar com certeza** um símbolo, função, arquivo, rota, ou caller:

- **Não inferir** a partir de nomes similares
- **Não deduzir** por convenção
- **Não criar** o que está faltando
- **PARAR** e reportar exatamente o que procurou e não achou

### Invariante Anti-Fallback-de-Origem (INV-NO-FALLBACK)

Se o código que você está editando **não tem `userId` no escopo** quando precisaria para chamar `ensureUserActor`:

- **NÃO inferir** origem de `userId`
- **NÃO derivar** de `metadata`, `payload`, `ctx`, `request.headers`, ou qualquer canal indireto
- **NÃO criar fallback** (ex.: `userId ?? tenantId`, `userId ?? 'system'`)
- **NÃO buscar** em outra tabela para "descobrir" quem seria o usuário
- **PARAR** e reportar a ausência de `userId`. Clayton decide se:
  (a) o caller deveria ter recebido `userId` como parâmetro desde o início (propagar pela cadeia), OU
  (b) esse caller é na verdade `@system-context` (não é ação de usuário)

### Invariante de Consistência de Actor (INV-ACTOR-CONSISTENCY)

O `actorId` usado em `requireFinancialRiskClearance` **DEVE ser exatamente o mesmo** `actorId` que aparece na operação financeira subsequente (`bankTransactionService.transfer/capture/reverse`, ou qualquer contexto de assinatura da operação).

**Proibido:**
- Resolver o actor duas vezes por caminhos diferentes e usar um no gate e outro no transfer.
- Passar `actorA` para o gate e `actorB` para o transfer, mesmo que `actorA === actorB` no contexto atual — usar a **mesma variável**.
- Gate validado sobre `fromActorId`, transfer executado com `beneficiaryActorId` (ou vice-versa) sem que haja **declaração explícita** de que dois actors distintos participam legitimamente da operação (quando for o caso, cada um precisa do seu próprio `requireFinancialRiskClearance` com seu action correspondente).

**Padrão canônico (single-actor flow):**
```typescript
const fromActor = await ensureUserActor(tenantId, fromUserId);
await requireFinancialRiskClearance(tenantId, {
  actorId: fromActor.id,
  action: 'financial_transfer',
  amountCents,
});
await bankTransactionService.transfer(tenantId, {
  fromActorId: fromActor.id,  // MESMA variável
  ...
});
```

**Se houver mais de um actor no escopo** (ex.: sender + receiver, comprador + vendedor, etc.):
- O actor **que ordena** a operação (originator) é o que passa pelo gate.
- Se múltiplos actors ordenam partes distintas da operação, **cada um precisa do seu próprio gate** com action correspondente.
- **Ambiguidade sobre quem é o originator → PARAR e reportar.** Não escolher sozinho.

**Proibição específica:**
```typescript
// ❌ ERRADO — gate valida A mas transfer usa B
const actorA = await ensureUserActor(tenantId, userId);
const actorB = await resolveActorIdForWalletOwner(tenantId, ownerId);
await requireFinancialRiskClearance(tenantId, { actorId: actorA.id, ... });
await bankTransactionService.transfer(..., actorB, ...);  // QUEBRADO
```

Violação de INV-ACTOR-CONSISTENCY → **PARAR** e reportar.

---

## PROTOCOLO DESTA SESSÃO (vinculante)

1. **Leia primeiro:**
   - `docs/01_normative/AUTHORITY_PRECEDENCE.md`
   - `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.6, §4.7, §4.8, §4.9, §7
   - `docs/01_normative/00_AGENT_PROTOCOL.md` §2.3.2
   - `SYSTEM_REMEDIATION_STATUS.md` (top + entradas C47/C54/C55/C57)
   - `REMEDIATION_DECISIONS_LOG.md` DECISION-0012 e DECISION-0013

   Confirme explicitamente no output que leu cada um.

2. **Modo:** EXECUTOR (conforme `00_AGENT_PROTOCOL.md` §4). Declare no início do output.

3. **Limite de 50 linhas:** alteração > 50 linhas em um único arquivo **exige parar e pedir autorização humana antes do write** (DECISION-0012 decisão 4).

4. **Um commit por PASSO.** Um PASSO = uma unidade lógica reversível (P2 do plano). Mensagens no formato:
   ```
   fix(authority): <C##> <resumo> [FASE 4]
   ```

5. **Gates obrigatórios após cada commit:**
   ```powershell
   pnpm --dir C:/unificard/backend run validate:actor-writer-boundaries 2>&1 | Select-Object -Last 5
   pnpm --dir C:/unificard/backend run validate:bank-ledger-boundaries 2>&1 | Select-Object -Last 5
   pnpm --dir C:/unificard/backend run validate:regression-guards 2>&1 | Select-Object -Last 5
   node C:/unificard/scripts/validate-architectural-patterns.mjs --strict 2>&1 | Select-Object -Last 10
   ```
   Os 4 precisam passar. Se qualquer falhar → **parar**, reportar output completo, aguardar decisão. **Não tentar "ajeitar" autonomamente.**
   **Se falhar 2 vezes seguidas → KILL SWITCH.**

6. **Se descobrir violação nova** durante a execução: registrar em `docs/03_execution_log/2026-04-22-quadrinho-novos-achados.md`. **Não tentar fechar.** Próxima auditoria cuida. **Tentativa de fechar = KILL SWITCH.**

---

## PASSO 0 — PRECHECK

Objetivo: confirmar que o estado do repo bate com o documentado.

Ações:

1. `git status` — repo limpo.
2. `git log -1 --oneline` — confirmar HEAD `890f18d9` ou descendente (HEAD de referência antiga; ramo evoluiu até `2fd1a5ac` — ver `passo5.md`).
3. Verificar que o banco `unificard_dev` está vazio:
   ```powershell
   psql -U postgres -d unificard_dev -P pager=off -c "
   SELECT 'users' AS tabela, COUNT(*) AS n FROM users
   UNION ALL SELECT 'actors', COUNT(*) FROM actors
   UNION ALL SELECT 'authority_roots', COUNT(*) FROM authority_roots
   UNION ALL SELECT 'companies', COUNT(*) FROM companies;"
   ```
   Esperado: todas 0. Se qualquer for > 0, **PARAR**.

4. Rodar os 4 gates CI para registrar baseline. Salvar output em `docs/03_execution_log/2026-04-22-quadrinho-autoridade-baseline.md`.

5. Contar linhas do arquivo alvo do PASSO 3 antes de tocar nele (tamanho do `authority-decision.service.ts`):
   ```powershell
   (Get-Content backend/src/core/compliance/authority-decision.service.ts).Count
   ```

**PARE. Reporte o baseline. Aguarde "go" antes de PASSO 1.**

---

## PASSO 1 — FECHAR C57 (FK authority_roots → actors)

Esta é a correção mais simples. Fazer primeiro para não permitir que linhas órfãs sejam criadas durante as próximas correções.

### Contexto

Schema atual de `authority_roots` tem `actor_id UUID PRIMARY KEY` sem `REFERENCES actors(id)`. Sistema vazio = backfill zero = custo zero.

### Ações

1. Criar migration forward-only em `backend/migrations/20260422000000_authority_roots_fk_actors.sql`:

```sql
-- Migration: Adiciona FK authority_roots.actor_id → actors.id
-- Remediação: C57 (DECISION-0013)
-- Contexto: sistema vazio, backfill zero
-- Rollback: ALTER TABLE authority_roots DROP CONSTRAINT fk_authority_roots_actor;

BEGIN;

-- Guard: garantir que não há linhas órfãs (sistema vazio esperado)
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM authority_roots ar
  LEFT JOIN actors a ON a.id = ar.actor_id
  WHERE a.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'C57: encontrados % actor_ids órfãos em authority_roots. Abortar.', orphan_count;
  END IF;
END $$;

-- Adicionar FK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_authority_roots_actor'
      AND table_name = 'authority_roots'
  ) THEN
    ALTER TABLE authority_roots
      ADD CONSTRAINT fk_authority_roots_actor
      FOREIGN KEY (actor_id) REFERENCES actors(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
```

2. Aplicar:
   ```powershell
   pnpm --dir C:/unificard/backend run migrate
   ```

3. Confirmar no banco:
   ```powershell
   psql -U postgres -d unificard_dev -P pager=off -c "
   SELECT conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid = 'authority_roots'::regclass
     AND conname = 'fk_authority_roots_actor';"
   ```
   Esperado: 1 linha com a FK.

4. Rodar os 4 gates. Todos verdes.

5. Commit:
   ```
   fix(authority): C57 — FK authority_roots.actor_id → actors(id) [FASE 4]
   ```

6. Atualizar `SYSTEM_REMEDIATION_STATUS.md`: C57 de OPEN → FIXED com commit hash.

**PARE. Mostre o output. Aguarde "go" antes de PASSO 2.**

---

## PASSO 2 — FECHAR C47 (actor_has_permission stub)

### Contexto

`migrations/20260421010000_actor_has_permission_stub.sql` cria função SQL que retorna `TRUE` para qualquer combinação. Único caller em produção: `core/rbac/rbac.service.ts` (linha ~95479 no SRC consolidado; no repo é `backend/src/core/rbac/rbac.service.ts`).

Clayton escolheu: **substituir por fail-closed** (retorna `FALSE`). Assim:
- Sistema vazio = tudo bloqueado (correto — ninguém deveria ter permissão sem ATL configurado)
- Implementação real virá em FASE 6

### Ações

1. Criar migration `backend/migrations/20260422000100_actor_has_permission_fail_closed.sql`:

```sql
-- Migration: substitui stub fail-open por fail-closed
-- Remediação: C47 (DECISION-0013)
-- Ref: AUTHORITY_PRECEDENCE.md §4.4 — IA não cria autoridade; ausência de política = bloqueio
-- Rollback: re-aplicar 20260421010000_actor_has_permission_stub.sql

BEGIN;

CREATE OR REPLACE FUNCTION actor_has_permission(
  p_tenant_id UUID,
  p_actor_id UUID,
  p_resource TEXT,
  p_action TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- FAIL-CLOSED: sem implementação real de permissões, nenhuma permissão é concedida.
  -- AUTHORITY_PRECEDENCE.md §4.4: "IA nunca pode aliviar restrição superior."
  -- FASE 6 substituirá esta função pela implementação real (RBAC + policy engine).
  -- Até lá, callers que dependem desta função devem:
  --   (a) usar requireFinancialRiskClearance (risk-financial-gate) ou
  --   (b) estabelecer gate próprio documentado
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION actor_has_permission IS
  'Stub fail-closed (C47). Retorna FALSE até FASE 6. Ver DECISION-0013.';

COMMIT;
```

2. Aplicar migration.

3. **Varredura anti-assumption (AFTER-effect):** a função mudou de sempre-TRUE para sempre-FALSE. Algum código pode assumir implicitamente que ela retorna TRUE.
   ```powershell
   Select-String -Path backend/src -Recurse -Pattern "actor_has_permission"
   ```
   Analisar cada ocorrência. Procurar especificamente:
   - Código que assume `has_permission === true` como happy path sem fallback
   - Código que tem lógica "otimista" (espera TRUE)
   - Código que **não tem** fallback explícito para FALSE

   **Se encontrar qualquer um desses padrões:**
   - **NÃO corrigir nesta sessão** — fora de escopo
   - Registrar em `docs/03_execution_log/2026-04-22-quadrinho-novos-achados.md`
   - Seguir com o PASSO (a mudança para fail-closed está correta, independente de callers assumirem TRUE)

   Único caller conhecido é `core/rbac/rbac.service.ts:L95479`:
   ```
   hasPermission: result?.has_permission ?? false
   ```
   Este já é fail-closed no fallback (`?? false`). Documentar que está OK.

4. Rodar os 4 gates. Se `validate:regression-guards` reclamar (possível — função mudou comportamento), **parar e reportar**. Não silenciar.

5. Commit:
   ```
   fix(authority): C47 — actor_has_permission fail-closed (was always TRUE) [FASE 4]
   ```

6. Atualizar STATUS: C47 OPEN → FIXED.

**PARE. Mostre o output. Aguarde "go" antes de PASSO 3.**

---

## PASSO 3 — FECHAR C55 (authority-decision.service fail-open)

### Contexto

`core/compliance/authority-decision.service.ts` tem padrão **"estado ausente = skip"** em 3 camadas (ATL, KYC, GUARDA). Sistema vazio = todos os skips disparam = autoridade inoperante.

Solução: inverter semântica via configuração de modo **com guard anti-vazamento para produção**.

### ⚠️ Guard crítico anti-vazamento

Modo `permissive` é **exclusivamente de desenvolvimento**. Se `NODE_ENV !== 'development'` e alguém tentar usar `permissive`, o serviço **deve falhar ao inicializar** com erro crítico. Permissive em produção = autoridade inoperante em produção.

### Ações

1. **Contar linhas antes de começar:**
   ```powershell
   (Get-Content backend/src/core/compliance/authority-decision.service.ts).Count
   ```
   Se você prever > 50 linhas de alteração, **pare agora** e reporte. Peça autorização.

2. Abrir `backend/src/core/compliance/authority-decision.service.ts`. Ler integralmente primeiro. **Não reconstruir.**

3. Adicionar **no topo do arquivo** (após imports existentes):

```typescript
/**
 * Modo de resolução de autoridade.
 * Controla o comportamento quando dados de ATL/KYC/GUARDA estão ausentes.
 *
 * - 'strict': ausência de dados = BLOQUEIO (fail-closed). Produção e primeiros usuários reais.
 * - 'permissive': ausência de dados = SKIP com log. EXCLUSIVAMENTE desenvolvimento em sistema vazio.
 *
 * Ref: AUTHORITY_PRECEDENCE.md §2 (mais restritiva vence), §4.1 (ATL soberano).
 * Remediação: C55 (DECISION-0013).
 */
export type AuthorityResolutionMode = 'strict' | 'permissive';

/**
 * GUARD ANTI-VAZAMENTO: permissive é PROIBIDO fora de NODE_ENV=development.
 * Se alguém tentar, lança erro crítico no boot do serviço.
 */
function getAuthorityMode(): AuthorityResolutionMode {
  const raw = process.env.AUTHORITY_MODE?.toLowerCase();
  const nodeEnv = process.env.NODE_ENV;

  if (raw === 'permissive') {
    if (nodeEnv !== 'development') {
      const msg =
        `[authority-decision] CRITICAL: AUTHORITY_MODE=permissive é proibido fora de ` +
        `NODE_ENV=development. Ambiente atual: NODE_ENV=${nodeEnv ?? '<undefined>'}. ` +
        `Abortando para evitar fail-open em produção.`;
      console.error(msg);
      throw new Error('AUTHORITY_MODE_PERMISSIVE_LEAKED_OUTSIDE_DEV');
    }
    return 'permissive';
  }
  return 'strict';
}
```

4. Localizar função `evaluateAtlLayer`. Substituir cada `skip` por **ausência de dados** (não por regra semântica legítima) pelo padrão:

```typescript
// ANTES (exemplo):
if (!root) {
  layers.push({
    layer: 'ATL',
    outcome: 'skip',
    reason: 'AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR',
  });
  return null;
}

// DEPOIS:
if (!root) {
  const mode = getAuthorityMode();
  if (mode === 'strict') {
    layers.push({
      layer: 'ATL',
      outcome: 'block',
      reason: 'AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR',
    });
    return { block: true, reason: 'AUTHORITY_ROOT_MISSING', source: 'rule' };
  }
  console.warn(
    `[authority-decision] ATL skip (permissive mode): actor=${actorId} tenant=${tenantId} reason=AUTHORITY_ROOT_NOT_CONFIGURED`
  );
  layers.push({
    layer: 'ATL',
    outcome: 'skip',
    reason: 'AUTHORITY_ROOT_NOT_CONFIGURED_FOR_ACTOR_PERMISSIVE',
  });
  return null;
}
```

Aplicar o mesmo padrão em:
- **ATL:** pontos que fazem `outcome: 'skip'` por ausência de dados
- **KYC:** `IDENTITY_NOT_LINKED`, `ACTOR_NOT_FOUND` (mantém o `KYC_NOT_APPLICABLE_ACTOR_TYPE` como skip legítimo — é regra semântica, não ausência de dados)
- **GUARDA:** mesmo padrão

**Distinção crítica:** `skip` legítimo por regra semântica (ex.: `KYC_NOT_APPLICABLE_ACTOR_TYPE` para actor que não é user/person) **continua sendo skip**. Só muda skip **por ausência de dados**.

5. Localizar o `catch (e) { if (isMissingRelation(e)) { ... skip ... } }` em cada camada. Substituir por:

```typescript
} catch (e) {
  if (isMissingRelation(e)) {
    const mode = getAuthorityMode();
    if (mode === 'strict') {
      layers.push({
        layer: 'ATL',  // ou 'KYC' ou 'GUARDA' conforme a camada
        outcome: 'block',
        reason: 'AUTHORITY_SCHEMA_ABSENT_STRICT',
      });
      return { block: true, reason: 'AUTHORITY_SCHEMA_ABSENT', source: 'rule' };
    }
    console.error(
      `[authority-decision] schema absent (permissive mode): layer=ATL code=42P01`
    );
    layers.push({ layer: 'ATL', outcome: 'skip', reason: 'AUTHORITY_SCHEMA_ABSENT_PERMISSIVE' });
    return null;
  }
  throw e;
}
```

6. **Contar linhas novamente** após edição:
   ```powershell
   (Get-Content backend/src/core/compliance/authority-decision.service.ts).Count
   ```
   Se a diferença passar de 50, **pare e reporte**.

7. Configurar `.env` do dev:
   ```
   AUTHORITY_MODE=permissive
   NODE_ENV=development
   ```
   Documentar em `docs/03_execution_log/2026-04-22-quadrinho-autoridade-C55.md`:
   - Por que permissive está ativo
   - Que o guard impede vazamento para produção
   - Que migração para strict é obrigatória antes de primeiro usuário real

8. Rodar 4 gates. Todos verdes.

9. Commit:
   ```
   fix(authority): C55 — authority-decision strict por default, permissive guarded [FASE 4]
   ```

10. Atualizar STATUS: C55 OPEN → FIXED. Notas:
    - Default `strict`
    - `permissive` travado a `NODE_ENV=development` por guard em runtime
    - Dev atual usa `AUTHORITY_MODE=permissive` via `.env`

**PARE. Mostre output. Aguarde "go" antes de PASSO 4.**

---

## PASSO 4 — FECHAR C54 (9 caminhos sem requireFinancialRiskClearance)

### Contexto

9 caminhos de produto chamam `bankTransactionService.transfer/capture/reverse` sem passar por `requireFinancialRiskClearance`. Categorização pré-feita pela auditoria forense:

**TIER A (3 arquivos) — gate diretamente no service (rota chama direto):**
- `core/economy/transaction.service.ts` (linha aprox. 44563 no SRC; procurar `bankTransactionService.transfer` no arquivo)
- `modules/escrow/escrow.service.ts` (linhas aprox. 138622, 138702)
- `modules/marketplace/payout.service.ts` (linha aprox. 189162)

**TIER B (4 arquivos) — gate a montante na rota HTTP:**
- `modules/marketplace/regional-fund.service.ts`
- `modules/marketplace/application/services/capacity-application.service.ts`
- `modules/marketplace/application/services/marketplace-orchestration.service.ts`
- `modules/marketplace/domain/orders/marketplace-orders.service.ts`

**TIER C (2 arquivos) — `@system-context` (worker/processor only, sem gate):**
- `modules/gateway/payment-event-resolver.ts` (linhas aprox. 150543, 150611)
- `modules/treasury-split/treasury-split.service.ts` (linhas aprox. 271999, 272025, 272051)

**Nota 2026-04-23 (pós-execução):** a tabela TIER acima é o **briefing original** do PASSO 4. Estado consolidado: `payment-event-resolver.ts` recebeu **gate** no fluxo PIX (deixou de ser “TIER C puro”); `treasury-split.service.ts` permanece motor interno com `@system-context`; `regional-fund.service.ts` enquadrou-se em `@system-context`; rota HTTP `POST /economy/distribution/auto` removida (`b72e35d2`); `split.service.ts` com gates a montante em `assignment.routes` + `status.routes` (`90b44784`). **`marketplace-orders.service.ts`** (listado em TIER B) **não** foi objecto dos commits desta sub-sessão — confirmar no código se ainda está pendente antes de executar PASSO 4 literalmente neste ficheiro.

### Padrão canônico

Referência viva: `core/unifybank/bank-p2p-transfer.service.ts:L107141-L107155`. **Adaptar (não copiar cegamente)** para o padrão abaixo que aplica ORDEM OBRIGATÓRIA (INV-ID) + CONSISTÊNCIA DE ACTOR (INV-ACTOR-CONSISTENCY):

```typescript
// AUTORIDADE: fail-closed — qualquer erro ou ausência de actor bloqueia.
// Ref: AUTHORITY_PRECEDENCE.md §2, LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md §4.9.5
// ORDEM OBRIGATÓRIA: (1) resolver actor → (2) gate → (3) operação financeira

// PASSO 1: Resolver identidade canônica (writer único)
const { ensureUserActor } = await import('@modules/identity/actor-writer.service');
const fromActor = await ensureUserActor(tenantId, fromUserId);
if (!fromActor?.id) {
  throw Object.assign(new Error('ACTOR_ID_NOT_RESOLVED'), { statusCode: 400 });
}
const originatorActorId = fromActor.id;  // ← única variável de actor para gate E transfer

// PASSO 2: Executar gate usando EXATAMENTE o mesmo actorId
const { requireFinancialRiskClearance } = await import('@modules/risk-identity/risk-financial-gate');
await requireFinancialRiskClearance(tenantId, {
  actorId: originatorActorId,
  action: 'financial_transfer', // ou 'financial_payout', 'financial_payment', 'financial_reversal_request'
  amountCents,
});

// PASSO 3: Executar operação financeira usando a MESMA variável originatorActorId
await bankTransactionService.transfer(tenantId, {
  fromActorId: originatorActorId,  // ← mesma variável do gate
  ...
});
```

**Regras do padrão:**

- A variável `originatorActorId` (ou nome equivalente) é declarada **uma vez** e usada **tanto no gate quanto na operação**.
- **Proibido** resolver duas vezes (`actorA` para gate, `actorB` para transfer).
- Se o fluxo já tem actor materializado upstream (parâmetro da função, não vindo de `userId` HTTP direto), o mesmo princípio vale: uma única referência para gate + transfer.
- A ordem **1 → 2 → 3** é rígida. Código com gate antes do actor resolvido ou transfer antes do gate → inválido.

**Nota sobre `resolveActorIdForWalletOwner`:** é útil quando o fluxo tem apenas `ownerId` de wallet e o actor já foi materializado em outro ponto do sistema. **Não substitui `ensureUserActor`** quando o fluxo parte de `userId` HTTP.

### Ações — TIER A

Para cada arquivo TIER A:

1. Abrir e ler integralmente.
2. Localizar a chamada ao `bankTransactionService.transfer/capture/reverse`.
3. **Identificar o `userId` no escopo.** Se não houver:
   - Aplicar INV-NO-FALLBACK: **NÃO inferir de metadata, payload, ctx ou qualquer canal indireto**
   - Se for possível propagar `userId` por parâmetro desde a rota: documentar a cadeia completa (rota → service → este call) e adicionar parâmetro
   - Se a propagação implicar alteração em mais de 2 arquivos ou > 50 linhas: **PARAR e reportar**. Clayton decide.
4. **Aplicar o padrão canônico respeitando ORDEM OBRIGATÓRIA e CONSISTÊNCIA DE ACTOR:**
   - **Ordem (INV-ID):** resolver identidade (1) → executar gate (2) → executar operação (3). Nessa ordem, no mesmo bloco linear.
   - **Consistência (INV-ACTOR-CONSISTENCY):** declarar **uma única variável** `originatorActorId` (ou nome equivalente e descritivo). Passar essa mesma variável para o gate E para o transfer. Proibido resolver duas vezes.
   - Se o fluxo já recebe `actorId` materializado upstream (parâmetro): confirmar que é exatamente o actor do originator e usar a mesma referência em gate + transfer.
5. **Action type:** escolher com cuidado:
   - `financial_transfer` — transferência direta entre contas
   - `financial_payout` — payout para terceiros
   - `financial_payment` — pagamento de produto/serviço
   - `financial_reversal_request` — estorno
   Se dúvida → **PARAR** e perguntar.
6. **Verificação local antes do commit (obrigatória):**
   Reler o trecho final. Confirmar que:
   - [ ] A variável do actor é declarada **antes** do gate e **antes** do transfer
   - [ ] O gate usa essa variável
   - [ ] O transfer usa **a mesma variável** (grep no trecho: o identificador aparece no gate e no transfer; não existem dois identificadores distintos de actor no mesmo fluxo)
   - [ ] Não há chamada a `bankTransactionService.transfer/capture/reverse` **antes** do gate no mesmo fluxo de execução
   Se qualquer checkbox falhar → **não commitar**. Corrigir ou reportar.
7. **Prova obrigatória de execução (anti-gate-decorativo):**
   Antes de commitar, copiar no output da sessão — **sem parafrasear, sem resumir**:
   - As 10 linhas imediatamente acima do gate
   - O bloco completo do gate (`requireFinancialRiskClearance`)
   - A chamada ao transfer/capture/reverse
   - As 10 linhas imediatamente abaixo

   E completar a frase obrigatória:
   > "Este gate executa no mesmo fluxo que o transfer porque: ___"

   Se não conseguir completar a frase com evidência do código colado → **NÃO commitar** → **PARAR** e reportar.
   Se o código colado mostrar gate em bloco diferente, em `try` separado, em branch que não o do transfer, ou após o transfer → gate é decorativo → **PARAR**.

8. Commit separado por arquivo:
   ```
   fix(authority): C54/TIER-A — requireFinancialRiskClearance em <file> [FASE 4]
   ```
9. Rodar 4 gates após cada commit.

### Ações — TIER B

Para cada arquivo TIER B:

1. Esses services são chamados por outros services. Gate fica na **rota HTTP de entrada (entrypoint real do fluxo)**.

2. **Rastreamento da rota HTTP — regra anti-intermediária:**
   A rota HTTP identificada deve ser:
   - A **PRIMEIRA entrada** do fluxo (entrypoint HTTP real)
   - **Não** uma rota intermediária, indireta, ou que apenas orquestra outra
   
   **Procedimento obrigatório:**
   ```powershell
   # Identificar todos os arquivos *.routes.ts que importam o service (direta ou indiretamente)
   git grep -l "regionalFundService" backend/src/**/*.routes.ts
   # Repetir para cada service TIER B com o nome do export correspondente
   ```
   
3. **Se houver múltiplas rotas candidatas:**
   - **PARAR**
   - Listar todas no output
   - Para cada rota, documentar: endpoint HTTP, método, arquivo, linha
   - **NÃO escolher sozinho**. Clayton decide qual é a entrada real.
   
4. **Se a rota existe mas o caller não é direto** (rota → serviceA → serviceB_alvo):
   - O gate vai em serviceA (ou na rota, se serviceA é transparente)
   - Documentar cadeia completa no commit

5. Adicionar o gate **na entrada real**, antes de chamar a cadeia que leva ao transfer.

6. Adicionar comentário no service TIER B alvo:
   ```typescript
   // AUTORIDADE: gate validado a montante em <caminho-exato-da-rota-ou-caller>.
   // Callers internos (service-to-service) DEVEM ter gate na rota HTTP de entrada.
   // Workers usam @system-context (ver INV-SYS).
   // Este service NÃO pode ser chamado diretamente por worker sem marcação @system-context.
   ```

7. Commit separado por arquivo:
   ```
   fix(authority): C54/TIER-B — gate a montante para <service> [FASE 4]
   ```

### Ações — TIER C

Para cada arquivo TIER C:

1. **Verificar as 3 condições de INV-SYS** antes de marcar:
   - Não há `userId`/`actorId` vindo de HTTP
   - Chamador é worker identificado por nome
   - Nenhuma rota HTTP leva a este call

2. **Rastrear callers:**
   ```powershell
   git grep -l "payment-event-resolver" backend/src
   git grep -l "treasurySplitService" backend/src
   ```
   Confirmar que só workers/processors aparecem. Se aparecer uma `.routes.ts` → **NÃO é TIER C**. É TIER A ou B. Reclassificar e aplicar o padrão correspondente.

3. Adicionar comentário imediatamente antes da chamada ao transfer:
   ```typescript
   // @system-context — executado por worker/processor (não por ação de usuário).
   // Callers identificados: <lista de workers>
   // Confirmado em <data>: nenhuma rota HTTP leva a este call.
   // Autoridade não aplicável: contexto de sistema, não de actor.
   // Ref: LEI §4.9.5; INV-SYS deste prompt.
   await bankTransactionService.transfer(...);
   ```

4. Commit único cobrindo TIER C:
   ```
   fix(authority): C54/TIER-C — @system-context documentado em workers [FASE 4]
   ```

### Fechamento de C54

Depois de todos os commits de TIER A+B+C:

1. Rodar os 4 gates uma última vez.
2. Atualizar STATUS: C54 OPEN → FIXED.
3. Registrar em `docs/03_execution_log/2026-04-22-quadrinho-autoridade.md`:
   - Lista dos commits
   - Tier de cada arquivo
   - Rotas HTTP identificadas em TIER B (caminho completo)
   - Workers documentados em TIER C

**PARE. Mostre resumo completo. Aguarde "go" antes do PASSO 5.**

---

## PASSO 5 — VALIDAÇÃO GLOBAL PÓS-QUADRINHO

Antes de declarar o quadrinho fechado, executar sweeps finais.

### Sweep 1 — Caminhos financeiros cobertos **em execução real**

```powershell
# Listar TODOS os callers de transfer/capture/reverse em produto (não-test, não-bank, não-script)
Get-ChildItem backend/src -Recurse -Include *.ts `
  | Where-Object { $_.FullName -notmatch '\\__tests__\\|\.spec\.|\.test\.|modules\\bank\\' } `
  | Select-String -Pattern 'bankTransactionService\.(transfer|capture|reverse)'
```

**Para cada arquivo listado, verificar 4 critérios (não só presença):**

1. **Presença do gate:** tem `requireFinancialRiskClearance` OU marcador `@system-context`.
2. **Mesmo fluxo de execução:** o gate está no mesmo caminho lógico que leva ao transfer (não em função diferente, não em classe diferente).
3. **Não em branch não-executada:** o gate **não** está dentro de um `if` que na prática nunca dispara (ex.: `if (false)`, branch de feature flag desabilitada, código morto).
4. **Precedência temporal:** o gate aparece **antes** da chamada ao transfer no fluxo de execução (não depois, não em `finally` após).

**Procedimento de verificação de cada arquivo:**
- Abrir o arquivo
- Localizar cada chamada ao `transfer`/`capture`/`reverse`
- Subir no código, dentro da mesma função, verificando que `requireFinancialRiskClearance` ou `@system-context` aparece **antes** e **no mesmo caminho de execução**
- Se estiver em `try` e o transfer estiver em `catch`: **não conta** — gate não é executado no caminho do transfer
- Se estiver em outro branch `if/else` que não o do transfer: **não conta**

**Se houver dúvida em QUALQUER arquivo:**
- Listar o arquivo no output
- Documentar exatamente qual chamada ao transfer não pôde ser validada e por quê
- **NÃO marcar como OK**. Aguardar decisão de Clayton.

**REGRA DE VALIDAÇÃO FORÇADA — proibido marcar OK sem evidência:**

Para **cada ocorrência** que você classificar como OK (seja gate real ou `@system-context`), o output da sessão **deve conter obrigatoriamente**:

```
Arquivo: <caminho>
Linha do gate (ou @system-context): <N>
Linha do transfer/capture/reverse: <N>
Trecho colado:
---
<código do gate>
...
<código do transfer>
---
Classificação: GATE_REAL | SYSTEM_CONTEXT
```

**Marcar como OK sem colar o trecho = inválido.** Clayton vai rejeitar qualquer PASS não acompanhado de evidência de código.

Se o trecho colado mostrar qualquer uma destas situações → reclassificar para FALHA:
- Gate e transfer em funções diferentes
- Gate em `catch`/`finally` separado do `try` onde está o transfer
- Gate em branch `if` que o transfer não percorre
- `@system-context` sem os 3 campos (condição 1, condição 2, condição 3 de INV-SYS) explicitados

### Sweep 2 — `@system-context` audit

Listar todos os `@system-context` do repo:
```powershell
Select-String -Path backend/src -Recurse -Pattern '@system-context'
```

Para cada ocorrência, verificar **as 3 condições de INV-SYS**:
1. Não há `userId`/`actorId` de HTTP no caller
2. Worker/processor identificado por nome no comentário
3. Confirmado que nenhuma rota HTTP leva ao call

Se qualquer uma falhar → reclassificar como TIER A ou B → gate obrigatório → **PARAR** e reportar. Este é um falso TIER C.

### Sweep 3 — Guard anti-vazamento de AUTHORITY_MODE

Verificar que o guard anti-vazamento funciona:

```powershell
# Simular vazamento: setar permissive em ambiente não-dev
$env:AUTHORITY_MODE="permissive"
$env:NODE_ENV="production"
node -e "
  require('./backend/dist/core/compliance/authority-decision.service.js');
  console.log('ERRO: deveria ter lançado');
" 2>&1
```

Esperado: lança `Error: AUTHORITY_MODE_PERMISSIVE_LEAKED_OUTSIDE_DEV`. Se não lançar → guard quebrado → **PARAR**.

Restaurar ambiente:
```powershell
$env:NODE_ENV="development"
```

### Sweep 4 — Verificar que `ensureUserActor` foi usado onde deveria

Em cada TIER A com `userId` no escopo, confirmar que `ensureUserActor` é chamado **antes** de qualquer uso de `actorId`:

```powershell
# Para cada arquivo TIER A, buscar a sequência correta
Select-String -Path backend/src/core/economy/transaction.service.ts -Pattern 'ensureUserActor|actorId|resolveActorIdForWalletOwner' -Context 0,2
```

Se `actorId` for usado antes de `ensureUserActor` no mesmo fluxo **e o fluxo parte de `userId` HTTP** → violação de INV-ID → **PARAR** e reportar.

### Sweep 5 — Tabela `authority_roots` não tem linhas órfãs

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT COUNT(*) AS orphans
FROM authority_roots ar
LEFT JOIN actors a ON a.id = ar.actor_id
WHERE a.id IS NULL;"
```

Esperado: 0. Se > 0 → FK do PASSO 1 não está aplicada → **PARAR**.

### Sweep 6 — Ordem de execução (INV-ID: identidade → gate → transfer)

Em **cada arquivo TIER A** modificado no PASSO 4, confirmar que a ordem no código é:

```
ensureUserActor (ou referência a actor já materializado)
  ↓
requireFinancialRiskClearance
  ↓
bankTransactionService.transfer/capture/reverse
```

Procedimento:

```powershell
# Para cada TIER A, extrair as 3 chamadas em ordem de aparição
$files = @(
  'backend/src/core/economy/transaction.service.ts',
  'backend/src/modules/escrow/escrow.service.ts',
  'backend/src/modules/marketplace/payout.service.ts'
)
foreach ($f in $files) {
  Write-Host "`n=== $f ==="
  Select-String -Path $f -Pattern 'ensureUserActor|resolveActorIdForWalletOwner|requireFinancialRiskClearance|bankTransactionService\.(transfer|capture|reverse)' `
    | ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim().Substring(0, [Math]::Min(100, $_.Line.Trim().Length)))" }
}
```

**Verificação visual:** a sequência de linhas deve mostrar:
1. Resolução de actor (primeiro)
2. Gate (depois)
3. Transfer/capture/reverse (por último)

Se a ordem estiver invertida em qualquer fluxo → **PARAR** e reportar. Não "ajeitar" reordenando sem autorização — pode quebrar lógica dependente.

**Excluir do sweep:** ocorrências que claramente pertencem a fluxos distintos (ex.: múltiplas funções no mesmo arquivo, com seus próprios actors). Neste caso, analisar cada função individualmente.

### Sweep 7 — Consistência de actor (INV-ACTOR-CONSISTENCY)

Em cada arquivo TIER A e TIER B, confirmar que o `actorId` passado ao gate é **a mesma variável** passada à operação financeira.

Procedimento:

```powershell
# Para cada arquivo, isolar o bloco autoridade+transfer e verificar consistência
$files = @(
  'backend/src/core/economy/transaction.service.ts',
  'backend/src/modules/escrow/escrow.service.ts',
  'backend/src/modules/marketplace/payout.service.ts',
  'backend/src/modules/marketplace/regional-fund.service.ts',
  'backend/src/modules/marketplace/application/services/capacity-application.service.ts',
  'backend/src/modules/marketplace/application/services/marketplace-orchestration.service.ts',
  'backend/src/modules/marketplace/domain/orders/marketplace-orders.service.ts'
)
foreach ($f in $files) {
  Write-Host "`n=== $f ==="
  # Capturar contexto amplo: gate + transfer
  Select-String -Path $f -Pattern 'requireFinancialRiskClearance|bankTransactionService\.(transfer|capture|reverse)' -Context 3,3
}
```

**Verificação manual obrigatória.** Para cada ocorrência:

1. Identificar a variável passada como `actorId` no `requireFinancialRiskClearance`.
2. Identificar a variável passada como `fromActorId` / `actorId` / `originatorActorId` no `bankTransactionService.transfer`.
3. **Comparar nome e origem das duas variáveis.**
4. Se forem nomes diferentes:
   - Se apontam para a mesma referência resolvida uma única vez (ex.: `const x = ...; foo({actorId: x}); bar({fromActorId: x})`) → OK
   - Se resolvem actor duas vezes por caminhos diferentes → **QUEBRADO** → reportar, não commitar
5. Se estão em funções diferentes do mesmo arquivo e são fluxos independentes (cada um com seu próprio actor) → OK, documentar no relatório

Se houver **qualquer dúvida** sobre se a consistência está preservada → **PARAR** e reportar o bloco completo. Não marcar sweep como OK.

### Sweep 8 — Rodar os 4 gates no estado final

```powershell
pnpm --dir C:/unificard/backend run validate:actor-writer-boundaries
pnpm --dir C:/unificard/backend run validate:bank-ledger-boundaries
pnpm --dir C:/unificard/backend run validate:regression-guards
node C:/unificard/scripts/validate-architectural-patterns.mjs --strict
```

Todos devem passar. Qualquer falha → **PARAR** e reportar.

### Relatório final

Criar `docs/03_execution_log/2026-04-22-quadrinho-autoridade.md` com:

- Commits de PASSO 1 ao PASSO 4
- Output completo dos 4 gates em cada PASSO
- Output dos 8 Sweeps do PASSO 5
- Lista de arquivos tocados com linhas alteradas (por PASSO)
- Tier final de cada arquivo de C54
- Rotas HTTP identificadas em TIER B (caminho exato)
- Workers declarados em TIER C
- Estado final do STATUS (C47, C54, C55, C57 → FIXED)
- Desvios encontrados (se houver) + como foram tratados ou reportados
- Total de linhas alteradas na sessão (soma geral)

**Não declarar FASE 4 concluída.** Ainda faltam C52, C56, e 4 novos gates. **C44** fechado em 2026-04-23 (`2fd1a5ac`). O quadrinho de autoridade fechando é pré-requisito, não fechamento da fase.

---

## REGRAS DE ENCERRAMENTO

1. Não auto-declarar sucesso. Clayton valida o relatório final.
2. Se qualquer Sweep do PASSO 5 falhar: **não** marcar C47/C54/C55/C57 como FIXED. Sessão termina com estado parcial documentado.
3. Se o kill switch disparou em qualquer momento: sessão termina naquele ponto, estado reportado, sem tentativa de recuperação autônoma.
4. Commit final da sessão (após PASSO 5 completo) atualiza STATUS e registra decisão de execução referenciando DECISION-0013.

## Status pós-execução (2026-04-23)

Quadrinho de autoridade (C47, C54, C55, C57): FECHADO  
C44: FECHADO (sessão 2026-04-23)  
C52: RFC em `docs/02_decisions/RFC_C52_payment_intents_dual_writer.md` — DECISION_PENDING (criar ficheiro na aprovação)  
C53: FIXED (commit 85976e65)  
C56: FIXED — bank_ledger como SSOT (commits 5c93766b, 17ac88ac, 02266c4b). Purpose a confirmar no primeiro E2E.  
4 gates novos da auditoria forense: PENDENTE
marketplace-orders.service.ts: AUDITADO LIMPO 2026-04-23 — zero chamadas ativas a transfer/capture/reverse. C54 fechado sem asterisco.

Commits finais da fase:

- 6ac66653 — C54 gates social-work-payment + test-currency  
- 55c1e212 — docs: relatório PASSO 5 validação global  
- 90b44784 — C54 gates assignment.complete + work-instant.complete  
- b72e35d2 — C54 remover POST /auto distribution.routes  
- 2fd1a5ac — C44 group.service bloquear campos fantasmas  
- 760cc768 — docs: passo5 + quadrinho + RFC C52
- 85976e65 — C53 strict/permissive catches 42P01
- 882742a1 — docs: RFC C56 aprovado + status C53 FIXED

---

## CHECKLIST POR PASSO (verificar antes de marcar "done")

- [ ] Li o arquivo alvo integralmente antes de editar (não parcialmente)
- [ ] Não reconstruí arquivo a partir de `dist/`
- [ ] Alteração < 50 linhas OU tenho autorização humana explícita
- [ ] Commit = uma unidade lógica (P2)
- [ ] 4 gates CI verdes após o commit
- [ ] STATUS atualizado na mesma sessão do commit
- [ ] Nenhum doc normativo tocado
- [ ] INV-ID preservado (userId ≠ actorId; ensureUserActor antes de resolver)
- [ ] **Ordem obrigatória (INV-ID):** identidade → gate → transfer, nessa ordem, no mesmo fluxo
- [ ] **Consistência (INV-ACTOR-CONSISTENCY):** uma única variável de actor, usada no gate E no transfer
- [ ] INV-FIN preservado (gate antes de transfer; sem derivação de metadata)
- [ ] INV-SYS preservado (3 condições para @system-context)
- [ ] INV-NO-REFACTOR respeitado (nenhum "já que estou aqui")
- [ ] INV-NO-GUESS respeitado (parei em dúvida)
- [ ] INV-NO-FALLBACK respeitado (não inventei origem de userId)
- [ ] KILL SWITCH não disparou (ou disparou e sessão parou)

---

**FIM DO PROMPT v5**

Ao receber este prompt, responder com:

1. Confirmação de leitura integral de todos os docs listados no item 1 do PROTOCOLO
2. Declaração de MODO: EXECUTOR
3. Confirmação de compreensão das **7 invariantes duras** (INV-ID, INV-FIN, INV-SYS, INV-NO-REFACTOR, INV-NO-GUESS, INV-NO-FALLBACK, INV-ACTOR-CONSISTENCY)
4. Confirmação de compreensão da **ORDEM OBRIGATÓRIA**: identidade → gate → transfer
5. Confirmação de compreensão do **KILL SWITCH GLOBAL**
6. Resumo em 5 linhas do que será feito
7. **Aguardar "go"** antes de PASSO 0. **Não executar PASSO 0 ainda.**
