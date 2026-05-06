# PLANO_REFATOR_ARQUITETURAL.md
**Sistema:** UnifiCard Backend  
**Auditado contra:** SRC_FULL.txt + MIGRATIONS_FULL.txt + 01_NORMATIVE_FULL.txt em 14/04/2026  
**Executor:** Cursor  
**Status — veredito do plano:** **PASS** (escopo `PLANO_REFATOR_ARQUITETURAL.md` — FASE S + Fases T→7 + **BLOCO 2** concluídos no repo; evidência em `docs/03_execution_log/REFATOR-ARQUITETURAL-20260414.md`, *Sessões 2–3*).  
**FASE S** (`DATABASE_URL` local usado na verificação): **OK** — `public.events` + `public.event_financial_execution`; colunas de `events` conferidas (hash parcial da connection string no log). **Lembrete:** repetir FASE S **por ambiente** (CI/staging/prod após migrações).  
**Gates:** `pnpm exec tsc --noEmit`, `pnpm run build`, `pnpm run validate:regression-guards`, `pnpm run guard:app-builder` — **PASS** na sessão de fecho BLOCO 2.

---

## REGISTO DE EXECUÇÃO — 2026-04-14

| Item | Resultado |
|------|-----------|
| Artefacto | `docs/03_execution_log/REFATOR-ARQUITETURAL-20260414.md` |
| Gates globais 1–5 | **PASS** (sessão 1 no artefacto; reexecutados na sessão 2 — ver *Sessão 2*) |
| FASE S (`public.events` + `event_financial_execution`) | **OK** (sessão 2 — presença de tabelas; **sessão 3** — verificação global de colunas + hash `DATABASE_URL`) |
| Fases T, 0, 1, 2, 3, 4, 5, 6, 7 | **SUCCESS** (sessão 2 — detalhe e outputs no artefacto) |
| **BLOCO 2** (leitores / resolver `events` canónicos) | **SUCCESS** (sessão 3 — ver secção *BLOCO 2* no artefacto e tabela abaixo neste plano) |
| **Revalidação FASE S** (snapshot histórico 22:08) | Ver artefacto — estado **obsoleto** antes de `pnpm migrate` local; substituído pela sessão 2. |

---

## REFERÊNCIA PÓS-EXECUÇÃO (T→7 + BLOCO 2 no repo — 2026-04-14)

Resumo do que ficou **no código** após as sessões documentadas em `docs/03_execution_log/REFATOR-ARQUITETURAL-20260414.md` (*Sessão 2* — T→7; *Sessão 3* — BLOCO 2 e FASE S global).

| Tema | Estado |
|------|--------|
| Builder Fastify | `backend/src/app.builder.ts` — `export async function buildApp()` |
| BOOT | `backend/BOOT.ts` — `validateEnv`, `startServer()`, workers, `listen`; `export { buildApp } from './src/app.builder'` |
| `server.ts` | `export { buildApp } from './app.builder'` (testes / devtools) |
| Removidos | `src/server-TESTE.ts`, `src/server-TESTE2.ts`, `src/teste-entrypoint.ts`, `modules/events/events-multi-actor.service.ts` |
| Checkout legado (Fase 4) | `modules/events/checkout-ticket.service.ts`, `checkout-consumption.service.ts`, `CheckoutTicketService.ts`, `CheckoutConsumptionService.ts` |
| Lifecycle | `modules/events/event-lifecycle.routes.ts` |
| Gate string `services/events/` | **Zero** ocorrências em `backend/src/**/*.ts` |
| Settlement (Fase 2) | `modules/gateway/payment-event-resolver.ts` delega `markExternallySettledByReference` em `modules/bank/bank-transaction.service.ts` |
| `devLog` (Fase 6) | Ficheiros `src/utils/devLog.ts` e `src/utils/dev-log.ts` removidos; callers migrados para `console.*` |
| DDL `events` em migrations ativas | `backend/migrations/20260525100000_events_domain_and_financial_execution.sql` |
| **CI Guard — builder** | **`pnpm run guard:app-builder`** (pós-`build`): valida `dist/app.builder.js` + export `buildApp` sem executar o grafo (Node puro não resolve imports sem `.js` no emit do `tsc`). Encadeado em CI: **`pnpm run validate:build-and-builder-guard`**. `import()` direto do `dist` continua **frágil** até `moduleResolution`/bundler alinhados. |
| **BLOCO 2** (sessão 3) | Leitores alinhados ao DDL: `core/checkout/event-organizer-resolver.ts`; `core/feed/feed.routes.ts`; `modules/social/social.routes.ts`; `modules/events/events-closure.routes.ts`; `modules/events/events-economy.routes.ts`; `modules/social/event-feed.handlers.ts`. RFQ: `event-rfq.service.ts` já em `metadata.rfqs` — sem alteração estrutural. |

---

## ATUALIZAÇÃO — Domínio `events` (execução no repositório) — 2026-04-14

Esta secção **não** substitui a FASE S em runtime: continua obrigatório reexecutar a verificação contra o PostgreSQL do ambiente-alvo **depois** de aplicar as migrações indicadas.

### DDL canónico + execução financeira

| Artefacto | Conteúdo |
|-----------|----------|
| `backend/migrations/20260525100000_events_domain_and_financial_execution.sql` | `public.events` (agregado actor-centric, sem `split_processed` / `completed_at` na tabela) + `event_financial_execution` (`UNIQUE (tenant_id, event_id)`, `status` pending/processing/completed/failed). |
| `backend/src/jobs/event-scheduler.ts` | Fila pós-evento via `event_financial_execution` + `events.status = 'ended'`. |
| `backend/src/jobs/post-event-split.job.ts` | Claim `pending`→`processing`, conclusão em `event_financial_execution`; condição de negócio `ended` + `datetime_end`. |

### Normativo e registry (lei ↔ evidência)

| Artefacto | Alteração |
|-----------|-----------|
| `docs/01_normative/07_NOMENCLATURA_CANONICA.md` | §4.38 — valores operacionais `group` e `channel`; regra DDL ↔ 07; versão **3.3.6**. |
| `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` | Subsecção `actor_type` sob Identidade Global de Ator (referência ao §4.38 e à migração `0064`; sem duplicar enum completo). |
| `docs/ssot/FALSIFICATION_LOG.md` | Entrada **#3** — encerramento de ambiguidade enum `actor_type`. |

### Núcleo `core/events`

- `event.service.ts` — remoção de `completed_at` na leitura; `validateStatus` / edição alinhados ao ciclo canónico; compatível com colunas novas na `RETURNING`.
- `core/reputation/trust.service.ts` — métricas de organizador: sucesso = `status = 'ended'`.

### BLOCO 1 — `modules/events` (estabilização progressiva — **concluído**)

| Ficheiro | Estado |
|----------|--------|
| `backend/src/modules/events/events.types.ts` | `EventRow` canónico; `CreateEventInput` único com `metadata?`, `eventType?`, `timezone?`. |
| `backend/src/modules/events/event.repository.ts` | `INSERT`/`SELECT` só colunas do DDL; `event_type` default **`general`** (não confundir com `visibility`); `timezone` default **`UTC`**; campos legados → `metadata`; merge explícito (campos de auditoria após spread). |
| `backend/src/modules/events/events.service.ts` | Criação resolve `actor_id`/`actor_type` via `actors`; regional validado → `metadata.regional` só com `city_id` / `state_id` / `country_id` **preenchidos**; `created_by_global_user_id` **sempre** gravado; `event_type` / `timezone` parametrizados (`general` / `UTC` default). |

**Regra de merge `metadata` (BLOCO 1):** `...(input.metadata)` primeiro; em seguida `regional` derivado do servidor (quando existir); depois `created_by_global_user_id`, `location_name`, `capacity` — estes últimos prevalecem sobre chaves homónimas vindas do cliente.

### BLOCO 2 — leitores / resolver (`events` canónico) — **concluído** (2026-04-14, sessão 3)

| Ficheiro | Nota |
|----------|------|
| `backend/src/core/checkout/event-organizer-resolver.ts` | Resolve conta via `actor_id` + `actors` / `users`; fallback `metadata.created_by_global_user_id` (sem colunas removidas). |
| `backend/src/core/feed/feed.routes.ts` | Contagem de eventos: `datetime_start`, `status IN ('published','active')`. |
| `backend/src/modules/social/social.routes.ts` | Idem (heurística unread-counts). |
| `backend/src/modules/events/events-closure.routes.ts` | `datetime_start` / `datetime_end`. |
| `backend/src/modules/events/events-economy.routes.ts` | `max_attendees` + `ticket_price_cents` (read-only; kill switch mantido). |
| `backend/src/modules/social/event-feed.handlers.ts` | `SELECT` canónico; `global_user_id` via payload, `metadata` ou join `actors`↔`users`. |
| `backend/src/modules/events/event-rfq.service.ts` | Já canónico (RFQs em `metadata.rfqs`) — nenhuma mudança necessária nesta sessão. |

### Backlog residual (opcional — **fora** do veredito PASS deste plano)

| Âmbito | Ficheiros / notas |
|--------|---------------------|
| **Autorização / lifecycle** | `modules/events/event-lifecycle.routes.ts` (e espelho em `services/events/`) — ainda referem colunas legadas no `SELECT`; alinhar a `actor_id` / `metadata` num trilho dedicado. |
| **Checkout HTTP legado** | `checkout-ticket.service.ts`, `checkout-consumption.service.ts` — colunas antigas (`starts_at`, `city_id`, …); Sprint 76 / desativação controlada. |
| **Métricas / perfil / feed legacy** | `event-metrics-dashboard.service.ts`, `event-organizer-metrics.service.ts`, `commitments.routes.ts`, `pending-responsibilities.routes.ts`, `services/feed/*` — grep de resíduo estrutural. |
| **Testes / fixtures** | `event-checkout-hardening.test.ts`, `debt-blocking.test.ts` — DDL de teste alinhado ao canónico. |

### FASE S — quando reabrir

Após `pnpm`/`migrate` (ou equivalente) aplicar `20260525100000_events_domain_and_financial_execution.sql` no ambiente cuja `DATABASE_URL` é usada na auditoria:

1. Confirmar existência de `public.events` e `public.event_financial_execution`.
2. Reexecutar matriz de writers vs colunas (grep + amostra `\d`).

**Repo (pós-2026-04-14):** o DDL acima está **ficheiro-migrado**; o alvo físico continua a exigir `pnpm migrate` (ou equivalente) **por ambiente**. Novos clones/CI/staging/prod: repetir FASE S antes de assumir schema.

---

## 🔧 CORREÇÕES DE AUDITORIA (PRÉ-EXECUÇÃO)

Complemento obrigatório ao plano original (14/04/2026). **Não remove** nenhuma fase existente; **condiciona** a execução a evidência real no disco e no schema.

| Lacuna | Correção no plano |
|--------|-------------------|
| Gate 3 só contava ficheiros com `INSERT INTO events` | Nova **FASE S** — contrato de dados `events` (DDL + `\d` / `information_schema` + matriz colunas por writer). |
| Fase T assumia `BOOT.ts` vazio (0 bytes) | Gate 2 e Fase T passam a ser **condicionais**: entrypoint preenchido ⇒ **refatoração controlada**, não substituição cega. |
| Fase 4 — `mv` para `modules/events/ticket.service.ts` | **Colisão comprovada** com `ticket.service.ts` (Sprint 76 — bilheteria). Fase 4 alterada: **renomear para ficheiros sem colisão** (nunca sobrescrever). |
| Fase 0 — exemplo de log com `organizerActorId` | O `event.service.ts` (singular) usa **`actorId` / `actorType` / `eventType`** — exemplo de log corrigido na Fase 0. |

**Evidência registada (repositório — atualizada pós-execução T→7):**

- `backend/BOOT.ts` — entrypoint **enxuto** (~400+ linhas): reexporta `buildApp` desde `src/app.builder.ts`; `buildApp` completo vive em **`backend/src/app.builder.ts`** (~640 linhas). Gate 2: refatoração controlada **feita**.
- `backend/migrations/` — **`20260525100000_events_domain_and_financial_execution.sql`** define `public.events` (canónico) + `event_financial_execution`. Arquivo histórico: `migrations_archive/0770_events_core.sql`, etc.
- `INSERT INTO events` em `backend/src/` (não-teste): **três** writers — `core/events/event.service.ts`, `modules/events/event.repository.ts`, `modules/events/events.service.ts`. ~~`events-multi-actor.service.ts`~~ **removido** (Fase 1).
- Alinhamento writer × DDL **no alvo** continua a exigir FASE S (`information_schema` / `\d events`) **por `DATABASE_URL`**.

---

## BOOTSTRAP OBRIGATÓRIO DO AGENTE

Antes de qualquer ação, ler **na sequência exata**:

1. `docs/01_normative/00_AGENT_PROTOCOL.md` — protocolo de operação do agente
2. `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — lei fundamental
3. `docs/01_normative/CORE_IMUTAVEL.md` — estruturas que não podem ser duplicadas
4. `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — lei de nomenclatura (todo campo novo deve estar aqui)
5. `docs/01_normative/EVENT_OUTBOX_E_ENTREGA_CANONICO.md` — lei do outbox transacional
6. `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` — leis operacionais (Lei 5: SSOT absoluto)
7. `docs/01_normative/INVARIANTES_OPERACIONAIS_LEDGER.md` — invariantes financeiras

Após cada leitura: confirmar internamente "li e compreendi".  
Se qualquer arquivo não existir ou estiver ilegível → **ABORTAR IMEDIATAMENTE**.

---

## SSOT DECLARADOS (imutáveis — não alterar em nenhuma fase)

| Pilar | Autoridade canônica | Proibição absoluta |
|---|---|---|
| Financeiro — dinheiro | `bank_ledger`, `bank_transactions`, `bank_splits` | Escrita fora de `modules/bank/` exceto exceção documentada abaixo |
| Financeiro — estoque | `inventory_movements` (append-only) | Ledger paralelo de quantidade |
| Identidade | `actors` via `actor-writer.service` | INSERT direto em `actors` fora do writer |
| Semântico | `concepts` | Criar conceito em runtime fora de seeds |
| Temporal | Agenda Universal / `schedule_slots` | Estrutura temporal paralela |
| Estado de evento | `events.status` via `core/events/event.service.ts` | Qualquer outro service alterar `events.status` diretamente |

**Exceção documentada e pré-existente:**
`modules/gateway/payment-event-resolver.ts` escreve `external_settled_at` em `bank_transactions` — único ponto externo autorizado, apenas nesse campo, dentro de transação explícita com `FOR UPDATE`. Esta exceção será encapsulada na Fase 2.

---

## GATES GLOBAIS (executar ANTES de qualquer fase)

```bash
# Gate 1 — TypeScript compila
cd backend && pnpm exec tsc --noEmit
# Esperado: exit 0. Se não: ABORTAR.

# Gate 2 — Confirmar estado real de BOOT.ts no disco (NÃO assumir vazio)
# Linux/macOS:
find backend -name "BOOT.ts" -exec wc -c {} \;
# Windows (PowerShell), a partir da raiz do repo:
# (Get-Item backend/BOOT.ts).Length
# Get-Content backend/BOOT.ts | Measure-Object -Line
#
# Interpretação:
# - 0 bytes → Fase T pode seguir o caminho "entrypoint novo" (snippet BOOT minimalista), com revisão humana.
# - > 0 bytes → Fase T = REFATORAÇÃO CONTROLADA: extrair buildApp a partir do BOOT existente; PROIBIDO sobrescrever BOOT.ts com o snippet do plano sem diff aprovado.

# Gate 3 — Confirmar writers não-teste em events (contagem de ficheiros apenas)
grep -rn "INSERT INTO events" backend/src/ --include="*.ts" \
  | grep -v "\.spec\.\|\.test\.\|node_modules"
# Anotar cada arquivo encontrado
# O Gate 3 NÃO substitui a FASE S — validar contrato de colunas com DDL real (\d events / information_schema).

# Gate 4 — Confirmar violação financeira existente
grep -n "UPDATE bank_transactions" \
  backend/src/modules/gateway/payment-event-resolver.ts
# Esperado: pelo menos 1 linha (será encapsulada na Fase 2)

# Gate 5 — Confirmar domainEventBus contido no marketplace
grep -rn "domainEventBus\|marketplaceEventBus" backend/src/ --include="*.ts" \
  | grep -v "marketplace\|node_modules\|\.md"
# Esperado: 0 linhas. Se > 0: REPORTAR a Clayton antes de prosseguir.
```

---

## FASE S — AUDITORIA DE SCHEMA `events` (OBRIGATÓRIA ANTES DA FASE 1)

**Objetivo:** fechar o contrato de dados da tabela `public.events` **antes** de remover writers ou mover ficheiros. O Gate 3 (grep) **não** substitui este passo.

**Pilar afetado:** integridade de dados — não altera SSOT até decisão documentada  
**Pré-condição:** Gates 1–5 executados e anotados  
**Bloqueio:** se a matriz S.4 resultar **INCONSISTENTE** e não houver RFC/decisão de Clayton → **ABORTAR** Fases 1+ até correção de schema ou de código.

### S.1 — Localizar DDL de referência no repositório

```bash
# Procurar definições de tabela events (nome exato)
grep -rn "CREATE TABLE.*events" backend/ --include="*.sql"

# Referências canónicas conhecidas no tree (arquivo; pode não coincidir com BD aplicada):
# - backend/migrations_archive/0770_events_core.sql — CREATE TABLE IF NOT EXISTS events (...)
# - backend/scripts/create-events-table-basic.sql — variante "básica" / comentário sobre baseline 026
```

**Nota:** existe migração ativa **`20260525100000_events_domain_and_financial_execution.sql`** com `CREATE TABLE` / contrato canónico de `events`. A **fonte de verdade em runtime** continua a ser o **PostgreSQL** do ambiente após `migrate` aplicado.

### S.2 — Obter schema real no banco alvo

Executar no ambiente-alvo (staging/prod clone/dev com migrations aplicadas):

```sql
-- psql: \d events
-- ou:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'events'
ORDER BY ordinal_position;
```

Guardar o output no artefato de execução (`docs/03_execution_log/`).

### S.3 — Listar colunas usadas por cada `INSERT INTO events` (código)

Extrair manualmente (ou com script) as colunas do `INSERT` em:

| Writer (ficheiro) | Colunas no `INSERT` (evidência no repo — alinhado DDL canónico) |
|-------------------|----------------------------------------|
| `core/events/event.service.ts` | `tenant_id`, `actor_id`, `actor_type`, `event_type`, `event_subtype`, `title`, `description`, `datetime_start`, `datetime_end`, `status`, `visibility`, `ticket_price_cents`, `max_attendees`, `metadata` |
| `modules/events/event.repository.ts` | `tenant_id`, `actor_id`, `actor_type`, `event_type`, `event_subtype`, `title`, `description`, `datetime_start`, `datetime_end`, `timezone`, `status`, `visibility`, `metadata` (legado Sprint76 em `metadata`: `location_actor_id`, `created_by_*`) |
| `modules/events/events.service.ts` | `tenant_id`, `actor_id`, `actor_type`, `event_type`, `event_subtype`, `title`, `description`, `datetime_start`, `datetime_end`, `timezone`, `status`, `visibility`, `max_attendees`, `ticket_price_cents`, `currency`, `metadata` (regional / auditoria em `metadata`) |

### S.4 — Matriz de decisão (writer × schema real)

Para **cada** coluna do `INSERT`, marcar:

- **OK** — coluna existe no DDL real e `NOT NULL`/default são satisfeitos pelo writer (ou há default na tabela).
- **INCONSISTENTE** — coluna inexistente, `NOT NULL` sem valor, ou tipo incompatível.

**Baseline documental (arquivo `0770_events_core.sql`, trecho inicial):** inclui entre outras `title`, `start_time`, `end_time`, `created_by_global_user_id` **NOT NULL**, etc. **Não** inclui, nesse trecho, `actor_id`, `organizer_actor_id`, `metadata` jsonb estendido, etc. **Conclusão:** se o BD em produção ainda corresponder só a esse baseline, os INSERTs atuais do core/repository **exigem** migrações posteriores ou outro DDL — **só S.2 confirma**.

### S.5 — Veredito obrigatório (preencher na execução)

```text
Veredito FASE S (events): OK | INCONSISTENTE
Responsável: _______________ Data: _______________
Anexo: (caminho do export \d events / information_schema)
```

Se **INCONSISTENTE** → parar Fase 1 até migração + norma ou ajuste de writers documentado.

---

## FASE T — CRIAR ENTRYPOINT DE PRODUÇÃO

**Por que é crítica:**
O snapshot de 14/04/2026 assumia `BOOT.ts` vazio. **Isso pode estar desatualizado.** Revalidar sempre com o Gate 2. Se `server.ts` / ficheiros `server-TESTE*` ainda existirem como stubs de diagnóstico, o objetivo estrutural mantém-se: **separar** builder puro (testável, zero side effects) de bootstrap (listen, workers, `process.exit`). Se `BOOT.ts` **já** for um entrypoint completo, esta fase é **refatoração incremental** — extrair `buildApp` para `app.builder.ts` **a partir do código real**, sem apagar comportamento não mapeado.

**Objetivo:** separar builder puro (testável, zero side effects) de bootstrap (entrypoint com listen e workers), **sem** regressão de rotas ou de prefixos.

**Pilar afetado:** infraestrutura — não altera nenhum SSOT  
**Pré-condição:** Gate 1 PASS **e** Fase S concluída com veredito **OK** (ou decisão escrita de Clayton se INCONSISTENTE apenas em campos não usados pelos writers em scope)

### T.1 — Criar `backend/src/app.builder.ts`

**Estado no repo (2026-04-14):** ficheiro **criado** com o corpo real extraído de `BOOT.ts` (registo de plugins/rotas completo). O bloco TypeScript abaixo é **referência didática** do plano original (subconjunto de módulos); **não** substitui o ficheiro real — qualquer evolução deve partir de `app.builder.ts` no disco.

```typescript
// backend/src/app.builder.ts
//
// BUILDER PURO — zero side effects em qualquer contexto de import.
//
// PROIBIDO neste arquivo:
//   - process.exit
//   - app.listen / app.close
//   - setInterval / setTimeout com side effect externo
//   - startWorkers() ou qualquer worker
//   - dotenv.config() / validação de env
//   - conexões abertas fora de lifecycle hooks do Fastify
//
// Plugins de BD usam lifecycle hooks (onReady/onClose) — seguro importar.

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

// Plugins internos
import { tenantPlugin } from './plugins/tenant.plugin';
import authPlugin from '@core/auth/auth.plugin';
import { errorHandlerPlugin } from './plugins/error-handler.plugin';
import { rbacPlugin } from './plugins/rbac.plugin';

// Módulos públicos
import { authModule } from './core/auth/auth.module';
import { healthModule } from './core/health/health.module';

// Módulos core autenticados
import economyModule from './core/economy/economy.module';
import rbacModule from './core/rbac/rbac.module';
import configModule from './core/config/config.module';
import notifyModule from './core/notify/notify.module';
import reviewModule from './core/reviews/review.module';
import reputationModule from './core/reputation/reputation.module';
import { coreModule } from './core/core.module';
import dashboardModule from './core/dashboard/dashboard.module';
import categoriesModule from './core/categories/categories.module';
import profileModule from './core/profile/profile.module';
import { companiesModule } from './core/companies/companies.module';
import referralModule from './core/referral/referral.module';
import planModule from './core/plan/plan.module';

// Módulos de negócio
import assistantModule from './modules/assistant/assistant.module';
import socialActionsModule from './modules/social-actions/social-actions.module';
import workModule from './modules/work/work.module';
import ridesModule from './modules/rides/rides.module';
import socialModule from './modules/social/social.module';
import mediaModule from './modules/media/media.module';
import culturalModule from './modules/cultural/cultural.module';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    requestIdHeader: 'x-request-id',
  });

  // Plugins de infraestrutura
  await app.register(sensible);
  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? '*' });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  // Plugins internos
  await app.register(tenantPlugin);
  await app.register(authPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(rbacPlugin);

  // Rotas públicas (sem autenticação)
  await app.register(authModule, { prefix: '/auth' });
  await app.register(healthModule, { prefix: '/health' });

  // Rotas autenticadas
  await app.register(async (protectedScope) => {
    await protectedScope.register(economyModule, { prefix: '/economy' });
    await protectedScope.register(rbacModule, { prefix: '/rbac' });
    await protectedScope.register(configModule, { prefix: '/config' });
    await protectedScope.register(notifyModule, { prefix: '/notify' });
    await protectedScope.register(reviewModule, { prefix: '/reviews' });
    await protectedScope.register(reputationModule, { prefix: '/reputation' });
    await protectedScope.register(coreModule, { prefix: '/core' });
    await protectedScope.register(dashboardModule, { prefix: '/dashboard' });
    await protectedScope.register(categoriesModule, { prefix: '/categories' });
    await protectedScope.register(profileModule, { prefix: '/profile' });
    await protectedScope.register(companiesModule, { prefix: '/companies' });
    await protectedScope.register(referralModule, { prefix: '/referral' });
    await protectedScope.register(planModule, { prefix: '/plan' });
    await protectedScope.register(assistantModule, { prefix: '/assistant' });
    await protectedScope.register(socialActionsModule, { prefix: '/social-actions' });
    await protectedScope.register(workModule, { prefix: '/work' });
    await protectedScope.register(ridesModule, { prefix: '/rides' });
    await protectedScope.register(socialModule, { prefix: '/social' });
    await protectedScope.register(mediaModule, { prefix: '/media' });
    await protectedScope.register(culturalModule, { prefix: '/cultural' });
  });

  return app;
}
```

**AVISO CRÍTICO SOBRE PREFIXOS:** Os prefixos acima são baseados nos nomes dos módulos. O Cursor DEVE verificar os prefixos reais consultando cada arquivo `.module.ts` antes de usar. Se qualquer módulo já registra suas rotas com prefixo interno, duplicar o prefixo aqui causará rotas erradas. Estratégia segura:

```bash
# Para cada módulo, verificar se ele já inclui o prefixo internamente
grep -n "prefix" backend/src/core/auth/auth.module.ts
grep -n "prefix" backend/src/core/economy/economy.module.ts
# etc.
```

### T.2 — Criar `backend/BOOT.ts` (ou substituir onde estiver vazio)

**Estado no repo:** `BOOT.ts` **não** foi substituído pelo snippet minimalista abaixo: mantém `validateEnv`, `PORT`/`HOST`, `startServer`, workers e `listen`. Apenas a função `buildApp` foi **movida** para `src/app.builder.ts`.

```bash
# Localizar BOOT.ts
find backend -name "BOOT.ts"
# Usar o path encontrado no comando abaixo
```

Substituir o conteúdo do arquivo encontrado por:

```typescript
// BOOT.ts — ENTRYPOINT ÚNICO DE PRODUÇÃO
//
// Tudo com side effect fica aqui: dotenv, listen, workers, exit.
// NÃO importar este arquivo em testes ou devtools.

import dotenv from 'dotenv';
dotenv.config();

// Ajustar path relativo conforme localização real de BOOT.ts
import { buildApp } from './src/app.builder';

function validateEnv(): void {
  const required = ['DATABASE_URL', 'PORT', 'JWT_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[BOOT] Variáveis de ambiente ausentes: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function startWorkers(): Promise<void> {
  // Cursor: se existiam chamadas de workers no arquivo original (ex: startEventOutboxWorker),
  // mover para cá. Se não existiam, deixar vazio.
}

async function start(): Promise<void> {
  validateEnv();

  const app = await buildApp();

  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen({ port, host });
  app.log.info(`[BOOT] Servidor em http://${host}:${port}`);

  await startWorkers();
}

start().catch((err) => {
  console.error('[BOOT] Erro fatal:', err);
  process.exit(1);
});
```

### T.3 — Atualizar `backend/src/server.ts`

Substituir conteúdo atual por:

```typescript
// backend/src/server.ts
// Re-export para compatibilidade com testes e devtools.
// Entrypoint de produção: BOOT.ts
export { buildApp } from './app.builder';
```

### T.4 — Remover arquivos de diagnóstico temporário

```bash
# Confirmar zero imports de produção
grep -rn "server-TESTE\|teste-entrypoint" backend/src/ --include="*.ts" \
  | grep "import" \
  | grep -v "server-TESTE\.ts\|server-TESTE2\.ts\|teste-entrypoint\.ts\|node_modules"
# DEVE retornar 0. Se > 0: PARAR.

rm backend/src/server-TESTE.ts
rm backend/src/server-TESTE2.ts
rm backend/src/teste-entrypoint.ts
```

### T.5 — Validação da Fase T

```bash
# 1. TypeScript compila
pnpm exec tsc --noEmit && echo "TS_OK"
# Esperado: "TS_OK"

# 2. Importar builder não executa nada (zero output de log/conexão)
node -e "require('./dist/src/app.builder')" 2>&1 | grep -c "."
# Esperado: 0 (nenhum output)

# 3. Arquivos de diagnóstico removidos
ls backend/src/server-TESTE* backend/src/teste-entrypoint.ts 2>/dev/null | wc -l
# Esperado: 0
```

**Gate Fase T:** todos os 3 checks PASS **e** Fase S concluída (veredito documentado) → prosseguir para Fase 0.

---

## FASE 0 — OBSERVABILIDADE PRÉ-MUDANÇA

**Objetivo:** criar visibilidade antes de qualquer mudança de domínio.

**Pilar afetado:** observabilidade — não altera nenhum SSOT  
**Pré-condição:** Fase S PASS (veredito OK ou decisão escrita) **e** Fase T PASS (ou Fase T N/A se apenas documentação de entrypoint já válido — anotar no log de execução)

### O.1 — Adicionar logs em transições de estado de evento

Em `backend/src/core/events/event.service.ts`, no início de `createEvent`, `publishEvent` e `cancelEvent`, adicionar antes de qualquer lógica:

```typescript
// Usar fastify.log quando disponível no contexto do handler.
// Em service direto sem fastify, usar console.log como fallback.
// NÃO criar novo sistema de logging — fastify.log é o padrão (108 arquivos).
// Campos reais do CreateEventInput (singular): actorId, actorType, eventType — NÃO usar organizerActorId (é do repositório Sprint 76 / outro fluxo).
console.log('[core/event.service] createEvent', {
  tenantId,
  actorId: input.actorId,
  actorType: input.actorType,
  eventType: input.eventType,
});
```

### O.2 — Validação

```bash
pnpm exec tsc --noEmit && echo "OK"
```

---

## FASE 1 — CONSOLIDAR AUTORIDADE DE ESCRITA EM `events`

**Pré-condição:** Fase S com veredito **OK** para os três writers em scope (ou plano de correção já aplicado e revalidado).

**Contexto verificado — 4 writers não-teste identificados:**

| Arquivo | Callers ativos | Decisão |
|---|---|---|
| `core/events/event.service.ts` | 6, todos em `core/events/` | ✅ Autoridade canônica — manter |
| `modules/events/event.repository.ts` | `checkin.service.ts`, `event-rfq.service.ts`, `events-sprint76.routes.ts`, `ticket.service.ts`, `my-orders.service.ts`, `service-bundle.service.ts` | ✅ Repository do módulo — manter |
| `modules/events/events.service.ts` | `commitments.routes.ts`, `seed-dev-groups.ts` | ✅ Domínio distinto (sessões, staff, occupancy) — manter, não unificar |
| ~~`modules/events/events-multi-actor.service.ts`~~ | — | **Removido** (Fase 1 executada) |

**Regra normativa aplicada:** `events.service.ts` (plural) NÃO é duplicata de `event.service.ts` (singular). É domínio diferente. `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §3 reconhece espaço próprio por módulo. Não unificar.

### 1.1 — Remover `events-multi-actor.service.ts` — **CONCLUÍDO**

```bash
# Grep ampliado — nomes alternativos incluídos
grep -rn \
  "events-multi-actor\|EventsMultiActorService\|eventsMultiActorService\|multiActorService" \
  backend/src/ --include="*.ts" \
  | grep -v "events-multi-actor\.service\.ts\|node_modules"
# DEVE retornar 0. Se > 0: PARAR e reportar cada caller a Clayton.

rm backend/src/modules/events/events-multi-actor.service.ts
```

### 1.2 — Adicionar comentário normativo em `core/events/event.service.ts`

Inserir após os imports, antes da declaração da classe:

```typescript
/**
 * SSOT DE ESTADO DE EVENTO
 * Ref: LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md §3 + CORE_IMUTAVEL.md §3
 *
 * Este service é a ÚNICA autoridade para transições de events.status.
 * State machine: draft → declared → published → active → ended → cancelled
 * Definida em: event.aggregate.ts (assertTransitionAllowed)
 *
 * PROIBIDO: outro service alterar events.status diretamente.
 * PERMITIDO: event.repository.ts (repository do módulo modules/events — domínio distinto).
 */
```

### 1.3 — Validação da Fase 1

```bash
# Remoção confirmada
grep -rn "events-multi-actor" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: 0

# Writers restantes — exatamente 3
grep -rn "INSERT INTO events" backend/src/ --include="*.ts" \
  | grep -v "\.spec\.\|\.test\.\|node_modules"
# Esperado: 3 linhas (event.service.ts, event.repository.ts, events.service.ts)

pnpm exec tsc --noEmit
# Esperado: exit 0
```

**Gate Fase 1:** `tsc` exit 0 + zero refs `events-multi-actor` + exatamente 3 writers.

---

## FASE 2 — ENCAPSULAR SETTLEMENT NO MÓDULO BANK

**Contexto verificado:**

`payment-event-resolver.ts` executa `UPDATE bank_transactions SET external_settled_at = NOW()` diretamente via `PoolClient`, buscando por `referenceId` com `FOR UPDATE`. Este é o único `UPDATE bank_transactions` fora de `modules/bank/`.

`bankTransactionService.markExternallySettled()` já existe mas usa assinatura diferente (busca por `transactionId`, chama stored procedure). Precisa de novo método que aceite `referenceId` e `PoolClient` ativo.

**Pilar afetado:** SSOT financeiro (Lei 5)  
**Pré-condição:** Fase 1 PASS

### 2.1 — Adicionar `markExternallySettledByReference` em `bank-transaction.service.ts`

Localizar a linha `export const bankTransactionService = new BankTransactionService();`.  
Inserir o método abaixo **imediatamente antes** do `}` que fecha a classe (linha anterior ao export):

```typescript
  /**
   * Marca external_settled_at em bank_transactions pela referência do payment intent.
   *
   * Uso exclusivo: settlement de gateway via payment-event-resolver.ts.
   * Requer PoolClient com transação ativa — FOR UPDATE garante idempotência.
   * Não cria escrita financeira nova; apenas sela o timestamp de liquidação externa.
   *
   * @param client PoolClient com BEGIN já executado (obrigatório)
   * @returns true se marcado com sucesso, false se referência não encontrada ou já settled
   *
   * Ref: LEIS_OPERACIONAIS_UNIFICARD.md Lei 5 (SSOT financeiro)
   */
  async markExternallySettledByReference(
    tenantId: string,
    referenceId: string,
    client: PoolClient
  ): Promise<boolean> {
    const result = await client.query<{ id: string }>(
      `UPDATE bank_transactions
       SET external_settled_at = NOW()
       WHERE id = (
         SELECT id
         FROM bank_transactions
         WHERE tenant_id = $1
           AND reference_id = $2
           AND external_settled_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE
       )
       RETURNING id`,
      [tenantId, referenceId]
    );
    return (result.rowCount ?? 0) > 0;
  }
```

**`PoolClient` já está importado** em `bank-transaction.service.ts` (`import type { PoolClient } from 'pg'`). Confirmar antes de adicionar import redundante.

### 2.2 — Substituir corpo de `markReferenceExternallySettled` em `payment-event-resolver.ts`

Localizar a função `async function markReferenceExternallySettled` e substituir **apenas o corpo** (manter a assinatura externa intacta para não quebrar callers internos):

```typescript
// ANTES — SQL direto em bank_transactions fora do módulo Bank
async function markReferenceExternallySettled(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  if (!client) { return; }
  const updated = await client.query<{ id: string }>(
    `UPDATE bank_transactions
     SET external_settled_at = NOW()
     WHERE id = (
       SELECT id FROM bank_transactions
       WHERE tenant_id = $1 AND reference_id = $2
         AND (external_settled_at IS NULL)
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE
     ) RETURNING id`,
    [tenantId, intent.referenceId]
  );
  if (!updated.rows[0]?.id) {
    throw new Error('SETTLEMENT_REFERENCE_NOT_FOUND');
  }
}

// DEPOIS — delega para SSOT do módulo Bank
async function markReferenceExternallySettled(
  tenantId: string,
  intent: PaymentIntent,
  client?: PoolClient
): Promise<void> {
  if (!client) { return; }
  const settled = await bankTransactionService.markExternallySettledByReference(
    tenantId,
    intent.referenceId,
    client
  );
  if (!settled) {
    throw new Error('SETTLEMENT_REFERENCE_NOT_FOUND');
  }
}
```

`bankTransactionService` já está importado no topo de `payment-event-resolver.ts`.

### 2.3 — Validação da Fase 2

```bash
# Zero UPDATE bank_transactions fora do módulo Bank
grep -rn "UPDATE bank_transactions" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: apenas modules/bank/bank-transaction.service.ts

pnpm exec tsc --noEmit
# Esperado: exit 0
```

**Gate Fase 2:** zero `UPDATE bank_transactions` fora de `modules/bank/` + `tsc` exit 0.

---

## FASE 3 — COMENTÁRIO NORMATIVO NO EVENT BUS DO MARKETPLACE

**Decisão baseada em auditoria e `EVENT_OUTBOX_E_ENTREGA_CANONICO.md`:**

`marketplaceEventBus` (`domainEventBus`) é in-memory, síncrono e **interno ao módulo marketplace**. Roteia `ServiceCompletedEvent` para 3 handlers dentro da mesma transação de negócio. A norma exige outbox apenas para **efeitos ao exterior** (cross-domain). Handlers síncronos intra-módulo são permitidos.

**Ação:** nenhuma mudança funcional. Adicionar comentário normativo.

Em `backend/src/modules/marketplace/application/events/marketplace-event-bus.ts`, inserir após o import de `EventBus`:

```typescript
// EVENT BUS INTERNO DO MARKETPLACE — comunicação síncrona intra-módulo.
//
// NÃO é o event bus canônico do sistema (core/events/event-bus.ts).
// NÃO exportar para fora do módulo marketplace.
// NÃO usar para eventos cross-domain ou que exijam garantia transacional.
//
// Para eventos cross-domain ou com garantia de entrega:
// usar event_outbox conforme EVENT_OUTBOX_E_ENTREGA_CANONICO.md §2.
```

---

## FASE 4 — MOVER `services/events/` PARA LOCALIZAÇÃO CORRETA

**Estado no repo (pós-execução):** ficheiros de checkout legado migrados para `modules/events/checkout-*.service.ts` + barrels; **`event-lifecycle.routes.ts`** em `modules/events/`; sem string `services/events/` em `src/**/*.ts`.

**Contexto histórico — callers (antes da migração):**

| Arquivo | Caller | Uso |
|---|---|---|
| ~~`services/events/ticket-service.ts`~~ | `checkout.routes.ts` | → `CheckoutTicketService` em `modules/events/` |
| ~~`services/events/TicketService.ts`~~ | `checkout.routes.ts` | → barrel `CheckoutTicketService.ts` |
| ~~`services/events/consumption-service.ts`~~ | `checkout.routes.ts` | → `CheckoutConsumptionService` |
| ~~`services/events/ConsumptionService.ts`~~ | `checkout.routes.ts` | → barrel `CheckoutConsumptionService.ts` |
| `services/events/EventService.ts` | **Zero** | N/A / removido em trilhos anteriores |

Estes serviços pertencem ao domínio de operação de eventos, não à raiz de `services/`. Mover para `modules/events/`.

**BLOQUEIO — colisão de nomes (evidência no repo):** já existe `backend/src/modules/events/ticket.service.ts` (**Sprint 76 — bilheteria canónica**, classe `TicketService` distinta). **É PROIBIDO** `mv` para o mesmo path (overwrite silencioso ou conflito de export).

### 4.1 — Localizar `checkout.routes.ts` para calcular path relativo

```bash
find backend/src -name "checkout.routes.ts"
# Anotar path exato — necessário para calcular import relativo correto
```

### 4.1b — Confirmar ausência de colisão antes de mover

```bash
ls backend/src/modules/events/ticket.service.ts
# Se existir: NÃO usar esse nome para o legado de checkout.
```

### 4.2 — Mover arquivos para nomes **sem colisão** (renomear, não sobrescrever)

Usar nomes dedicados ao fluxo **checkout legado** (ingresso/consumo), preservando `ticket.service.ts` do módulo events:

```bash
# Implementações (renomear no destino — NÃO sobrescrever ticket.service.ts)
mv backend/src/services/events/ticket-service.ts \
   backend/src/modules/events/checkout-ticket.service.ts

mv backend/src/services/events/consumption-service.ts \
   backend/src/modules/events/checkout-consumption.service.ts

mv backend/src/services/events/TicketService.ts \
   backend/src/modules/events/CheckoutTicketService.ts

mv backend/src/services/events/ConsumptionService.ts \
   backend/src/modules/events/CheckoutConsumptionService.ts
```

### 4.2b — Ajustar conteúdo após `mv` (obrigatório)

Os ficheiros `CheckoutTicketService.ts` e `CheckoutConsumptionService.ts` movidos ainda reexportam paths antigos (`./ticket-service`, `./consumption-service`). **Substituir** o conteúdo de cada um por **uma** linha conforme secção 4.3.

**Instrução ao executor:** em `checkout-ticket.service.ts` e `checkout-consumption.service.ts`, renomear a classe exportada para `CheckoutTicketService` / `CheckoutConsumptionService` (ou `export { TicketService as CheckoutTicketService }`) de modo que **não** colida com a classe `TicketService` de `ticket.service.ts` (Sprint 76).

### 4.3 — Atualizar paths nos re-exports movidos

Em `backend/src/modules/events/CheckoutTicketService.ts`:
```typescript
export { CheckoutTicketService } from './checkout-ticket.service';
```

Em `backend/src/modules/events/CheckoutConsumptionService.ts`:
```typescript
export { CheckoutConsumptionService } from './checkout-consumption.service';
```

### 4.4 — Atualizar imports em `checkout.routes.ts`

Calcular path relativo a partir do resultado do passo 4.1.

Exemplo se `checkout.routes.ts` está em `backend/src/core/checkout/`:
```typescript
// ANTES
import { TicketService } from '../../services/events/TicketService';
import { ConsumptionService } from '../../services/events/ConsumptionService';

// DEPOIS (símbolos alinhados ao rename — ajustar nomes de classe/variável conforme 4.2)
import { CheckoutTicketService } from '../../modules/events/CheckoutTicketService';
import { CheckoutConsumptionService } from '../../modules/events/CheckoutConsumptionService';
```

Ajustar `../../` conforme localização real.

### 4.5 — Remover `services/events/EventService.ts` (zero callers)

```bash
grep -rn "services/events/EventService" backend/src/ --include="*.ts" \
  | grep -v "EventService\.ts\|node_modules"
# DEVE retornar 0. Se > 0: PARAR.

rm backend/src/services/events/EventService.ts
```

### 4.6 — Remover diretório se vazio

```bash
# Confirmar zero refs ao path antigo
grep -rn "services/events/" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: 0

ls backend/src/services/events/
# Se vazio: remover
rmdir backend/src/services/events/ 2>/dev/null || rm -rf backend/src/services/events/
```

### 4.7 — Validação da Fase 4

```bash
pnpm exec tsc --noEmit
# Esperado: exit 0

grep -rn "services/events/" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: 0
```

**Gate Fase 4:** `tsc` exit 0 + zero refs a `services/events/`.

---

## FASE 5 — MARKETPLACE (APENAS AUDITORIA — SEM CÓDIGO)

O plano original propunha simplificar MarketplaceOrdersModule vs MarketplaceOrdersService sem evidência de duplicação funcional. Executar apenas mapeamento.

```bash
grep -rn "MarketplaceOrdersModule\|MarketplaceOrdersService\|new MarketplaceOrders" \
  backend/src/ --include="*.ts" | grep -v node_modules

grep -n "class MarketplaceOrders" backend/src/modules/marketplace/*.ts 2>/dev/null
```

Reportar resultado a Clayton. Aguardar decisão documentada antes de qualquer ação de código.

---

## FASE 6 — REMOVER `devLog`

**Contexto verificado:**

| Sistema | Arquivos | Decisão |
|---|---|---|
| `fastify.log` | 108 | ✅ Padrão — manter |
| `canonicalLogger` | 22 | ✅ Auditoria canônica — manter, não substituir |
| `devLog` | 8 callers | 🔴 Remover — debug temporário sem valor em produção |
| `StructuredLogger` | 2 | ⚠️ Não remover sem mapear uso |

`devLog` está definido em dois arquivos: `utils/dev-log.ts` e `utils/devLog.ts`.

**Callers identificados:** `core.service.ts` (4 imports dinâmicos), `groups-activity.executors.ts`, `referral.service.ts`, `groups.service.ts`, `fix-groups-without-accounts.ts`.

### 6.1 — Substituir `devLog` em cada caller

Para cada arquivo, substituir a chamada conforme o contexto:

```typescript
// ANTES
import { devLog } from '@utils/devLog';
devLog.log('mensagem', dados);
devLog.error('mensagem de erro', err);

// DEPOIS — fastify.log se disponível no handler; console.log em services/scripts
console.log('[nome-do-modulo] mensagem', dados);
console.error('[nome-do-modulo] erro', err);
```

Para `core.service.ts` (usa import dinâmico):
```typescript
// Substituir cada bloco:
// const { devLog } = await import('@utils/devLog');
// devLog.log(...);
// Por:
console.log('[core.service] ...', dados);
```

### 6.2 — Remover arquivos `devLog`

```bash
# Confirmar zero callers
grep -rn "devLog\|dev-log" backend/src/ --include="*.ts" \
  | grep "import" | grep -v "dev-log\.ts\|devLog\.ts\|node_modules"
# Esperado: 0

rm backend/src/utils/devLog.ts
rm backend/src/utils/dev-log.ts
```

### 6.3 — Adicionar comentário em `canonical-logger.ts`

```typescript
// canonicalLogger — sistema de log de AUDITORIA CANÔNICA.
//
// Usar para: decisões de domínio com contexto estruturado (permissões, resolução semântica).
// NÃO usar para: logs operacionais de handlers HTTP (usar fastify.log).
// NÃO substituir por console.log — destino e semântica de auditoria são diferentes.
```

### 6.4 — Validação da Fase 6

```bash
grep -rn "devLog\|from.*dev-log" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: 0

pnpm exec tsc --noEmit
# Esperado: exit 0
```

**Gate Fase 6:** zero refs `devLog` + `tsc` exit 0.

---

## FASE 7 — VALIDAÇÃO SISTÊMICA FINAL

```bash
# 1. TypeScript compila
pnpm exec tsc --noEmit && echo "TS_OK"

# 2. Artefacto app.builder após build (guard real no repo)
pnpm run validate:build-and-builder-guard
# (equivale a: pnpm build && node scripts/guard-app-builder-artifact.mjs)
# Nota: import Node puro de dist/app.builder.js falha com emit tsc (imports sem .js).

# 3. SSOT de estado de evento preservado
grep -rn "UPDATE events" backend/src/ --include="*.ts" \
  | grep "status" \
  | grep -v "core/events/event\.service\|node_modules\|\.spec\|\.test"
# Esperado: 0

# 4. SSOT financeiro preservado
grep -rn "UPDATE bank_transactions" backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: apenas modules/bank/bank-transaction.service.ts

# 5. Código morto removido
grep -rn \
  "events-multi-actor\|services/events/\|server-TESTE\|teste-entrypoint\|devLog\|dev-log" \
  backend/src/ --include="*.ts" | grep -v node_modules
# Esperado: 0

# 6. domainEventBus contido no marketplace
grep -rn "domainEventBus\|marketplaceEventBus" backend/src/ --include="*.ts" \
  | grep -v "marketplace\|node_modules\|\.md"
# Esperado: 0

# 7. Registrar execução
# Criar: docs/03_execution_log/REFATOR-ARQUITETURAL-$(date +%Y%m%d).md
# Conteúdo: fases executadas, timestamp, resultado de cada gate
```

---

## REGRAS DE ABORT

| Condição | Ação |
|---|---|
| `tsc --noEmit` retorna erro em qualquer fase | ABORTAR. Corrigir erro antes de continuar. |
| grep de callers retorna resultado inesperado antes de remoção | ABORTAR. Reportar a Clayton com os callers encontrados. |
| Qualquer mudança escreve em `bank_ledger`, `bank_transactions` ou `bank_splits` fora de `modules/bank/` | ABORTAR. Violação da Lei 5 (SSOT financeiro). |
| Campo novo não consta em `07_NOMENCLATURA_CANONICA.md` | ABORTAR. Solicitar decisão normativa. |
| Fase 5 executada com modificação de código sem decisão de Clayton | ABORTAR. Fase 5 é mapeamento apenas. |
| Prefixos de rota em `app.builder.ts` divergem dos módulos existentes | VERIFICAR e corrigir antes de testar boot. |
| Fase S — veredito **INCONSISTENTE** na tabela `events` (writer vs DDL) sem RFC/decisão de Clayton | ABORTAR Fases 1+ até correção de schema/migrations ou alinhamento de código. |
| Tentativa de mover legado `services/events` para um path que já exista em `modules/events/` | ABORTAR. Renomear conforme Fase 4 (checkout-*). |

---

## ORDEM DE EXECUÇÃO

```
Gates Globais
  → Fase S (auditoria schema events — OK escrito)
  → Fase T (entrypoint — refatoração controlada se BOOT não vazio)
  → Fase 0 (observabilidade)
  → Fase 1 (consolidar events)
  → Fase 2 (encapsular settlement)
  → Fase 3 (comentário event bus)
  → Fase 4 (mover services/events)
  → Fase 5 (auditoria marketplace — sem código)
  → Fase 6 (remover devLog)
  → Fase 7 (validação final)
```

Não avançar de fase sem gate PASS.

---

## CI GUARDS (adicionar após execução completa)

```bash
# Guard 1: status de evento exclusivo do core
grep -rn "UPDATE events" backend/src/ --include="*.ts" \
  | grep "status" | grep -v "core/events/event\.service\|node_modules\|\.spec"
# Deve retornar 0

# Guard 2: bank_transactions intocado fora do Bank
grep -rn "UPDATE bank_transactions\|INSERT INTO bank_transactions" \
  backend/src/ --include="*.ts" | grep -v "modules/bank/\|node_modules"
# Deve retornar 0

# Guard 3: artefacto builder (pós-build)
# pnpm run guard:app-builder

# Guard 4: devLog ausente
grep -rn "devLog\|from.*dev-log" backend/src/ --include="*.ts" | grep -v node_modules
# Deve retornar 0
```
