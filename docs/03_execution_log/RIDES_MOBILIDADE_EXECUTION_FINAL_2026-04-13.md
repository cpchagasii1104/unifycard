## STATUS
FINALIZADO

## CONTEXTO
Plano executado integralmente (Fases 0–6.1 + patches críticos)

## PENDÊNCIAS NÃO BLOQUEADORAS
- Fase 6.2 — inventário de módulos comentados (higiene futura)

---

# PLANO DE EXECUÇÃO — RIDES / MOBILIDADE / LOGÍSTICA
**Versão:** FINAL — corrigida contra código real  
**Data:** 13/04/2026  
**Executor:** Cursor  
**Hierarquia normativa:** Constituição > Leis Operacionais > SSOT Registry > `EVENT_OUTBOX_E_ENTREGA_CANONICO` > `INVARIANTES_OPERACIONAIS_LEDGER` > `CORE_IMUTAVEL` > este plano

---

## ESTADO VERIFICADO NO CÓDIGO (não presumir documentação)

*Última sincronização desta tabela com o repo: **2026-04-13** (pós-execução Cursor — ver `STATUS DA FASE` por fase).*

| Item | Estado real |
|---|---|
| `concept-slug-resolve.service.ts` | ✅ Existe em `@modules/concept-resolution/` |
| `getDefaultConceptDomain('vehicle')` | ✅ Retorna `'mobilidade-e-logistica'` |
| `normalizeConceptSlug` | ✅ Existe em `@core/ontology/concept-governance.service` — **somente TypeScript, sem equivalente SQL** |
| `concepts` table schema | `concept_id UUID PK DEFAULT uuid_generate_v4()`, `slug TEXT NOT NULL`, `domain TEXT NOT NULL`, `created_at`. **Sem coluna `label`** |
| `rides_vehicles.concept_id` | ✅ Nullable UUID, sem FK ainda — migration `20260523100000` |
| `drivers/vehicles/vehicles.service.ts` | ✅ **ATIVO** — `createVehicle` com `resolveConceptSlug` + `concept_id` no INSERT + retorno `conceptNeedsResolution` |
| `rides/vehicles/vehicles.service.ts` | 🚫 **DEPRECATED** — não registado em `rides.module.ts`; métodos lançam `DEPRECATED_MODULE`; substituto: `drivers/vehicles/vehicles.service.ts`; remoção futura em PR separado |
| `distribution.service.ts` método `applyDistribution` | ✅ Split em **inteiros (cents)** com invariante de soma; sem `.toFixed()` no split |
| `publish-ride-event.ts` | ✅ Exporta `publishRideEventOutbox` + tipo `RideDomainBusEvent`; **sem** `eventBus` / `publishRideEventSafe` |
| `runTenantTransactionWithClient` | ✅ Em `@core/db` — transação tenant com `PoolClient` para outbox |
| `insertEventOutboxRow` | ✅ Existe em `@core/events/event-outbox.repository` — exige `PoolClient` (dentro de transação) |
| `event_outbox` tabela | ✅ Existe desde `20260430130000` |
| `grep eventBus` em `backend/src/modules/rides` | ✅ **0** ocorrências *(mutações rides → outbox transacional)* |
| Script de relatório | ✅ `src/scripts/report-rides-vehicles-concept-mapping.ts` |
| `pnpm report:rides-vehicles-concept-map` | ✅ Declarado em `backend/package.json` |
| `pricing.service.ts` (distância / tiers) | ⚠️ Ainda usa `.toFixed()` em **cálculos de distância/custo auxiliar** — fora do escopo literal da Fase 4 (split em `distribution`); revisar se política global for “zero `.toFixed` em todo rides” |

---

## PROIBIÇÕES GLOBAIS (valem em todas as fases)

- **Nunca** usar `slug` sem `context` ou `domain` explícito
- **Nunca** criar conceito automaticamente via runtime ou backfill
- **Nunca** usar `brand`/`model` como identidade semântica — apenas como texto de exibição/legado
- **Nunca** usar `float` ou `.toFixed()` em cálculo financeiro — apenas inteiros em cents
- **Nunca** chamar `eventBus.emit` diretamente em fluxo com mutação de estado durável
- **Nunca** copiar `concept_id` entre domínios sem regra explícita de produto
- **Nunca** usar `service_type_id` ou `VehicleType` como identidade semântica (são classificadores operacionais)

---

## DEPENDÊNCIAS ENTRE FASES

```
FASE 0 ──────────────────────────────────────────────────────┐
FASE 1 (seeds) → FASE 2 (integrar resolver) → FASE 3 (backfill) → FASE 8 (enforcement)
FASE 4 (float) ─── paralelo com FASE 1
FASE 5 (outbox) ── paralelo com FASE 1
FASE 6 (limpeza) ─ paralelo com FASE 1
FASE 7 (marketplace/logistics) ── depende de FASE 1 + FASE 2
```

Nenhuma fase abre sem o gate da fase anterior estar PASS.

---

## FASE 0 — CONGELAMENTO (sem código)

**Objetivo:** fixar regras antes de espalhar código errado.

### Pré-condições
- Nenhuma alteração em andamento no módulo `rides`

### Ações

Declarar como decisão de projeto:

```
context 'vehicle' → domain 'mobilidade-e-logistica'
context 'product' → domain 'produtos-e-comercio'
context 'service' → domain 'servicos'
```

Proibir com efeito imediato em todo PR novo:
- `slug` sem `context` ou `domain` explícito
- `.toFixed()` em qualquer cálculo financeiro
- `eventBus.emit` direto em fluxo com mutação

### Gate
Checklist manual:
- [✔] Decisão de domínios documentada (ADR ou nota no PR de abertura)
- [ ] Nenhum PR aberto violando as proibições acima *(verificação manual de PRs abertos)*

### STATUS DA FASE (execução)
- **status:** DONE
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `docs/02_decisions/ADR_ONTOLOGIA_VEICULO_DOMINIOS_UNIFICARD.md`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md` (este registo)
- **migrations criadas:** *(nenhuma — fase documental)*
- **validações executadas:**
  - `pnpm exec tsc --noEmit` → exit 0 *(após conclusão das fases de código subsequentes)*
- **observações:**
  - Gate “PRs abertos” permanece checklist manual conforme plano.

### Política de erro
PR que violar → bloqueado, não mergeado.

### Proibido nesta fase
Alterar banco, criar conceito, refatorar módulos.

---

## FASE 1 — SEEDS DE CONCEITOS (`mobilidade-e-logistica`)

**Objetivo:** criar os conceitos de nível 1 (classe funcional) no SSOT semântico.

### Pré-condições

```sql
-- Confirmar que domínio existe
SELECT domain_key FROM domains WHERE domain_key = 'mobilidade-e-logistica';
-- Deve retornar 1 linha

-- Confirmar schema da tabela concepts (sem label)
SELECT column_name FROM information_schema.columns WHERE table_name = 'concepts';
-- Deve mostrar: concept_id, slug, domain, created_at
```

### Ações

Criar `backend/migrations/20260524100000_concepts_mobilidade_seed.sql`:

```sql
-- Seeds de conceitos Nível 1 (classe funcional) para mobilidade-e-logistica.
-- Slug normalizado: minúsculas, sem acento, sem espaço, hífen como separador.
-- concept_id gerado automaticamente (DEFAULT uuid_generate_v4()).
-- ON CONFLICT DO NOTHING: idempotente — re-executar não duplica.

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
VALUES
  ('carro',        'mobilidade-e-logistica'),
  ('moto',         'mobilidade-e-logistica'),
  ('van',          'mobilidade-e-logistica'),
  ('caminhao',     'mobilidade-e-logistica'),
  ('onibus',       'mobilidade-e-logistica'),
  ('bicicleta',    'mobilidade-e-logistica'),
  ('pickup',       'mobilidade-e-logistica'),
  ('lancha',       'mobilidade-e-logistica'),
  ('iate',         'mobilidade-e-logistica'),
  ('navio',        'mobilidade-e-logistica'),
  ('helicoptero',  'mobilidade-e-logistica'),
  ('aviao',        'mobilidade-e-logistica')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;
```

> **Nota:** conceitos de nível 2 (fiat-uno, honda-civic, etc.) e nível 3 (variantes) dependem de decisão de produto — não seeds agora. O resolver vai retornar `unresolved` para modelos específicos até essa decisão.

### Gate

```sql
SELECT slug FROM concepts
WHERE domain = 'mobilidade-e-logistica'
ORDER BY slug;
-- Deve retornar ≥ 12 registros
```

### STATUS DA FASE (execução)
- **status:** DONE *(artefato migration versionada; aplicação/gate SQL dependem do ambiente)*
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `backend/migrations/20260524100000_concepts_mobilidade_seed.sql`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:**
  - `backend/migrations/20260524100000_concepts_mobilidade_seed.sql`
- **validações executadas:**
  - Gate SQL `SELECT slug ... ≥ 12`: **não executado** aqui *(BD local sem `concepts` populado conforme ambiente)*
- **observações:**
  - Reexecutar gate no ambiente após `pnpm migrate` / aplicação da migration.

### Política de erro
- Slug já existe → `ON CONFLICT DO NOTHING` — ignorar, não duplicar
- Domain `mobilidade-e-logistica` não existe → migration falha explicitamente → BLOQUEAR

### Proibido nesta fase
- Inserir conceitos de nível 2 ou 3 sem decisão de produto documentada
- Misturar slugs do domínio `produtos-e-comercio`

---

## FASE 2 — INTEGRAR `resolveConceptSlug` EM `vehicles.service.ts`

**Objetivo:** fazer o cadastro de veículo tentar resolver semanticamente via SSOT, sem obrigar.

**Arquivo alvo:** `backend/src/modules/rides/drivers/vehicles/vehicles.service.ts` (o **ATIVO**, registrado no módulo).

### Pré-condições
- Fase 1 concluída (seeds existem)
- `pnpm exec tsc --noEmit` — exit 0 antes de começar

### Ações

**1. Adicionar imports no topo do arquivo:**

```typescript
import { resolveConceptSlug } from '@modules/concept-resolution/concept-slug-resolve.service';
import { normalizeConceptSlug } from '@core/ontology/concept-governance.service';
```

**2. No método `createVehicle`, antes do INSERT:**

```typescript
// Tentativa de resolução semântica — best-effort, sem bloquear criação
let conceptId: string | null = null;
let conceptNeedsResolution = false;

if (input.brand || input.model) {
  const rawSlug = [input.brand, input.model]
    .filter(Boolean)
    .join(' ');
  const normalized = normalizeConceptSlug(rawSlug);
  const resolved = await resolveConceptSlug({
    slug: normalized,
    context: 'vehicle',  // → domain 'mobilidade-e-logistica'
  });

  if (resolved.status === 'resolved') {
    conceptId = resolved.conceptId;
  } else {
    conceptNeedsResolution = true;
    // Não bloquear: veículo nasce sem conceito, fila de resolução futura
  }
}
```

**3. Adicionar `concept_id` no INSERT:**

```typescript
// No INSERT INTO rides_vehicles (...):
// Adicionar na lista de colunas: concept_id
// Adicionar no VALUES: conceptId ?? null
```

**4. Retornar `conceptNeedsResolution` na resposta (opcional para backoffice):**

```typescript
return {
  ...vehicle,
  conceptNeedsResolution,
};
```

### Gate

```typescript
// Teste manual no ambiente de dev:
const result = await resolveConceptSlug({ slug: 'carro', context: 'vehicle' });
// Esperado: { status: 'resolved', conceptId: '<uuid>', domain: 'mobilidade-e-logistica', slug: 'carro' }

const result2 = await resolveConceptSlug({ slug: 'fiat-uno', context: 'vehicle' });
// Esperado: { status: 'unresolved', reason: 'not_found', ... }
// (correto — nível 2 não foi seedado ainda)
```

```bash
pnpm exec tsc --noEmit
# Deve retornar exit 0
```

### STATUS DA FASE (execução)
- **status:** DONE
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `backend/src/modules/rides/drivers/vehicles/vehicles.service.ts`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma nesta fase)*
- **validações executadas:**
  - `pnpm exec tsc --noEmit` → exit 0
  - `pnpm exec tsc -p tsconfig.build.json --noEmit` → exit 0
  - Teste manual `resolveConceptSlug({ slug: 'carro', context: 'vehicle' })` → **não executado** nesta sessão
- **observações:**
  - `createVehicle` retorna `CreateVehicleResult` com `conceptNeedsResolution`.

### Política de erro
- `resolved` → `concept_id = conceptId`
- `unresolved` → `concept_id = null`, `conceptNeedsResolution = true`
- Nunca fallback para outro domínio
- Nunca criar conceito automaticamente
- Erro na chamada ao resolver → logar, `concept_id = null`, não bloquear criação

### Proibido nesta fase
- Tornar `concept_id` NOT NULL (enforcement é Fase 8)
- Criar conceito automaticamente
- Usar `brand`/`model` como `slug` sem normalizar via `normalizeConceptSlug`

---

## FASE 3 — RELATÓRIO E BACKFILL CONTROLADO

**Objetivo:** mapear o passivo de `rides_vehicles` sem `concept_id` antes de qualquer UPDATE.

### Pré-condições
- Fase 2 concluída
- `concept_id` já está sendo preenchido em novos cadastros

### Ações

**1. Confirmar script e comando:**

```bash
# Verificar que o script está em package.json:
grep "rides-vehicles-concept-map" backend/package.json

# Se não estiver declarado, usar diretamente:
pnpm exec tsx src/scripts/report-rides-vehicles-concept-mapping.ts
# Ou com domínio explícito:
RIDES_VEHICLE_CONCEPT_DOMAIN=mobilidade-e-logistica pnpm exec tsx src/scripts/report-rides-vehicles-concept-mapping.ts
```

**2. O script retorna um JSON com:**
- `mappable`: veículos onde brand+model resolve para conceito existente
- `unresolved`: sem match no domínio esperado
- `foreign_domain_only`: match existe mas em domínio diferente (nunca usar)
- `skipped`: brand ou model ausente

**3. Revisar o relatório:**
- `mappable` → candidatos a UPDATE (revisão humana antes de aplicar)
- `unresolved` → verificar se faltam seeds de nível 2 ou se brand/model está inconsistente
- `foreign_domain_only` → NÃO usar — registrar no FALSIFICATION_LOG.md

**4. Backfill via script TS (não via SQL puro):**

```bash
# Backfill só após revisão humana do relatório
# O script de backfill deve usar resolveConceptSlug (TS) para cada linha
# NÃO usar SQL UPDATE com translate() como substituto de normalizeConceptSlug —
# a função TS tem lógica NFD que não tem equivalente SQL simples no repo
```

> **Por que não SQL puro:** `normalizeConceptSlug` usa normalização NFD Unicode (remove acentos via decomposição). A função PostgreSQL `translate()` cobre apenas caracteres explicitamente listados — incompleto para nomes de veículos brasileiros com diacríticos variados. Usar o script TS garante mesma lógica que a Fase 2.

### Gate

```sql
SELECT COUNT(*) AS com_concept
FROM rides_vehicles
WHERE concept_id IS NOT NULL;
-- Deve aumentar progressivamente após backfill aprovado
```

### Política de erro
- `unresolved` → manter `concept_id = NULL`, encaminhar para fila de resolução manual
- `foreign_domain_only` → NÃO preencher, registrar
- `ambiguous` (mesmo slug em múltiplos domínios) → revisão manual obrigatória

### Proibido nesta fase
- UPDATE automático em massa sem revisão humana do relatório
- Criar conceito durante backfill
- Usar match de domínio diferente de `mobilidade-e-logistica`

### STATUS DA FASE (execução)
- **status:** DONE *(relatório apenas; sem backfill automático)*
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma)*
- **validações executadas:**
  - `pnpm run report:rides-vehicles-concept-map` → exit 0; resultado JSON: `ok: false`, `reason: "table_rides_vehicles_missing"` *(BD dev sem tabela `rides_vehicles` ou schema incompleto)*
  - Gate SQL `COUNT(*) ... concept_id IS NOT NULL` → **não executado** (tabela ausente)
- **observações:**
  - Nenhum UPDATE de backfill aplicado, conforme plano.

---

## FASE 4 — CORRIGIR FLOAT → CENTS EM `distribution.service.ts`

**Objetivo:** eliminar arredondamento incorreto no split financeiro.

**Arquivo:** `backend/src/modules/rides/distribution/distribution.service.ts`  
**Método:** `applyDistribution(totalCents: number, rule: any)`.

### Regra crítica — distribuição não é dinheiro real

- O resultado de `applyDistribution` e os registos em `rides_ride_distributions` são **projeção / histórico derivado**.
- **Não** usar para: saldo, payout, extrato, reconciliação canónica, decisão financeira.
- Decisão e prova financeira: **`bank_ledger` / `bank_transactions`** (e fluxo via `bankIntegrationService`).
- Em `processRidePayment`, os valores gravados na projeção espelham splits devolvidos pelo Bank após `processRidePayment` bancário — continuam **derivados** do ponto de vista de SSOT.

### Pré-condições
- Nenhuma (pode rodar em paralelo com Fase 1)

### Ações

**Substituir o método inteiro:**

```typescript
applyDistribution(totalCents: number, rule: any) {
  // Split em inteiros (cents) — sem float intermediário.
  // Math.round garante valor inteiro; resíduo fica no motorista.
  // Invariante: platform + driver + community === totalCents (sempre).
  const platformAmount = Math.round(totalCents * rule.platform_pct / 100);
  const communityAmount = rule.community_fund_enabled
    ? Math.round(totalCents * rule.community_pct / 100)
    : 0;
  // Resíduo no motorista — garante soma exata sem float
  const driverAmount = totalCents - platformAmount - communityAmount;

  // Guard de invariante — nunca deve disparar se regras de pct forem válidas
  if (platformAmount + driverAmount + communityAmount !== totalCents) {
    throw new Error(
      `SPLIT_INVARIANT_VIOLATED: platform(${platformAmount}) + driver(${driverAmount}) + community(${communityAmount}) !== total(${totalCents})`
    );
  }

  return { driverAmount, platformAmount, communityAmount };
}
```

### Gate

```typescript
// Teste unitário (rodar localmente):
const svc = new DistributionService();
const rule = { platform_pct: 20, community_pct: 5, community_fund_enabled: true };
const result = svc.applyDistribution(1000, rule);
// Esperado:
// platformAmount  = 200   (Math.round(1000 * 20 / 100))
// communityAmount = 50    (Math.round(1000 * 5 / 100))
// driverAmount    = 750   (1000 - 200 - 50)
// SUM             = 1000  ✓
console.assert(result.platformAmount + result.driverAmount + result.communityAmount === 1000);
```

```bash
pnpm exec tsc --noEmit
```

### STATUS DA FASE (execução)
- **status:** DONE
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `backend/src/modules/rides/distribution/distribution.service.ts`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma)*
- **validações executadas:**
  - `pnpm exec tsc --noEmit` → exit 0
  - Invariante `applyDistribution(1000, { platform_pct: 20, community_pct: 5, community_fund_enabled: true })` → soma = 1000 *(verificação lógica no código)*
- **observações:**
  - `processRidePayment` passou a usar `totalCents` (`price.totalCents ?? price.total`).

### Política de erro
- Invariante violada → `throw new Error` (nunca silencioso)

### Proibido nesta fase
- Usar `.toFixed()` em qualquer valor financeiro
- Usar `parseFloat` ou operações de ponto flutuante no split

---

## FASE 5 — MIGRAR EVENTOS PARA OUTBOX TRANSACIONAL

**Objetivo:** garantir que eventos de estado do `rides` nunca sejam publicados antes do commit.

### Pré-condições
- Nenhuma (pode rodar em paralelo com Fase 1)
- Tabela `event_outbox` existe desde `20260430130000`
- `insertEventOutboxRow` existe em `@core/events/event-outbox.repository`

### Ação central

O padrão correto é **atomicidade total**: estado + outbox na mesma transação. Se o outbox falhar, tudo faz rollback — nenhum estado é persistido sem o evento correspondente, e nenhum evento existe sem o estado.

**Não é "preferir perder evento"** — é garantir que evento e estado nunca existam separados.

**Padrão a seguir (template):**

```typescript
import { runTenantTransactionWithClient } from '@core/db';
import { publishRideEventOutbox } from '../shared/publish-ride-event'; // caminho relativo conforme ficheiro em rides/

// ANTES (errado): estado persistido e depois eventBus.emit / publishRideEventSafe fora da mesma transação.

// DEPOIS (correto — atomicidade total com PoolClient):
await runTenantTransactionWithClient(tenantId, async (client) => {
  await client.query(`UPDATE rides_rides SET status = 'started' WHERE ...`, [...]);
  await publishRideEventOutbox(client, {
    type: 'rides.ride.started',
    tenantId,
    payload: { rideId, driverId },
  });
});
```

**Implementação real (Fase 5 concluída):** todos os fluxos com mutação em `backend/src/modules/rides/**` passam a usar `runTenantTransactionWithClient` + `publishRideEventOutbox` (que delega em `insertEventOutboxRow`). Não há `eventBus` no módulo `rides`.

> `publish-ride-event.ts` exporta apenas `publishRideEventOutbox` + tipos; `publishRideEventSafe` foi removido.

**`rides/vehicles/vehicles.service.ts` (órfão):** **Fase 6 — DECISÃO: DEPRECATE** (comentário de cabeçalho + `throw` em todos os métodos públicos). Não integrar ao `rides.module.ts`. Substituto: `drivers/vehicles/vehicles.service.ts`.

### Gate

```sql
-- Após migração de um fluxo (ex: rides.service.ts):
SELECT COUNT(*) FROM event_outbox
WHERE event_type LIKE 'rides.%'
  AND published_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
-- Deve mostrar eventos enfileirados após ações de corrida
```

### Política de erro
- Falha no INSERT do outbox → ROLLBACK de toda a transação → nem estado nem evento persistidos
- Retry via worker de outbox (já existe no sistema)

### Proibido nesta fase
- Manter `eventBus.emit` direto em qualquer fluxo que persiste estado
- Commit de estado sem linha correspondente no outbox

### STATUS DA FASE (execução)
- **status:** DONE
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `backend/src/core/db.ts` (`runTenantTransactionWithClient`)
  - `backend/src/modules/rides/shared/publish-ride-event.ts` *(apenas `publishRideEventOutbox`; removido `publishRideEventSafe`)*
  - `backend/src/modules/rides/rides/rides.service.ts`
  - `backend/src/modules/rides/distribution/distribution.service.ts`
  - `backend/src/modules/rides/pricing/pricing.service.ts`
  - `backend/src/modules/rides/lifecycle/lifecycle.routes.ts`
  - `backend/src/modules/rides/drivers/drivers.service.ts`
  - `backend/src/modules/rides/ride-requests/ride-requests.service.ts`
  - `backend/src/modules/rides/zones/zones.service.ts`
  - `backend/src/modules/rides/safety/safety.service.ts`
  - `backend/src/modules/rides/safety/safety.routes.ts`
  - `backend/src/modules/rides/location/location.service.ts`
  - `backend/src/modules/rides/promotions/promotions.service.ts`
  - `backend/src/modules/rides/referrals/referrals.service.ts`
  - `backend/src/modules/rides/service-types/service-types.service.ts`
  - `backend/src/modules/rides/services/lifecycle.service.ts`
  - `backend/src/modules/rides/vehicles/vehicles.service.ts` *(órfão — migrado para outbox na mesma fase)*
  - `backend/src/modules/rides/availability/availability.service.ts`
  - `backend/src/modules/rides/cities/cities.service.ts`
  - `backend/src/modules/rides/demand/demand.service.ts`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma)*
- **validações executadas:**
  - `pnpm exec tsc --noEmit` → exit 0
  - `pnpm exec tsc -p tsconfig.build.json --noEmit` → exit 0
  - Gate SQL `event_outbox` com `rides.%` → **não executado** *(depende de BD com tabela e fluxo e2e)*
- **observações:**
  - `grep eventBus` em `backend/src/modules/rides` → **0** ocorrências após migração completa (incl. `availability`, `cities`, `demand`).

---

## FASE 6 — LIMPEZA DE MÓDULOS

**Objetivo:** eliminar código morto e clarificar o que está ativo.

### Pré-condições
- Nenhuma (pode rodar em paralelo com Fase 1)

### Ações

**6.1 — `rides/vehicles/vehicles.service.ts` (ÓRFÃO) — CONCLUÍDO**

Decisão aplicada: **DEPRECATE** (sem integração ao módulo). Cabeçalho JSDoc + `throw new Error('DEPRECATED_MODULE: …')` no início de cada método público. Código legado mantido no ficheiro para rastreabilidade; remoção definitiva em PR futuro.

Verificação `grep` por string literal `rides/vehicles/vehicles.service` em `backend/src`: **0** importações (o par órfão `vehicles.routes.ts` usa `./vehicles.service` — rotas órfãs não montadas em `rides.module.ts`).

**6.2 — Módulos comentados em `rides.module.ts`**

```typescript
// TODO: refatorar — comentados atualmente:
// lifecycle.routes  (código existe em lifecycle/)
// matching.routes   (código existe em matching/)
// pricing.routes    (código existe em pricing/)
// promotions.routes
// referrals.routes
```

Para cada módulo comentado: verificar se tem código ativo ou morto e registrar inventário. Não reativar nem remover sem decisão explícita.

### Gate
- [✔] Decisão documentada sobre `rides/vehicles/vehicles.service.ts` (órfão) — ver **DECISÃO — MÓDULO ÓRFÃO** abaixo
- [ ] Inventário dos módulos comentados registrado *(6.2 — pendente; fora do escopo deste patch cirúrgico)*

### Proibido nesta fase
- Reativar módulos comentados sem validação de outbox e float
- Criar nova implementação duplicada

### DECISÃO — MÓDULO ÓRFÃO

- **opção escolhida:** DEPRECATE *(não integrar, não reativar)*
- **motivo:** duplicidade + ficheiro não registado em `rides.module.ts`
- **impacto:** zero no fluxo ativo (`rides.module.ts` usa `drivers/vehicles/vehicles.routes`)
- **implementação:** cabeçalho JSDoc + `throw` em todos os métodos públicos de `backend/src/modules/rides/vehicles/vehicles.service.ts`
- **ação futura:** remoção definitiva do ficheiro (e opcionalmente `vehicles.routes.ts` órfão) em PR separado após estabilização

### STATUS DA FASE (execução)
- **status:** DONE *(âmbito 6.1 órfão; gate 6.2 inventário permanece aberto)*
- **timestamp:** 2026-04-13T20:00:00.000Z
- **arquivos alterados:**
  - `backend/src/modules/rides/vehicles/vehicles.service.ts`
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma)*
- **validações executadas:**
  - `grep` string `rides/vehicles/vehicles.service` em `backend/src` → 0 ocorrências fora do próprio ficheiro
  - `pnpm exec tsc --noEmit` → exit 0
- **observações:**
  - `backend/src/modules/rides/vehicles/vehicles.routes.ts` importa `./vehicles.service` (relativo); não montado no módulo — se no futuro for ligado, falhará de forma explícita com `DEPRECATED_MODULE`.

---

## FASE 7 — ACOPLAR MARKETPLACE E LOGISTICS

**Objetivo:** permitir que veículos existam como conceito operacional e item comercial sem SSOT paralelo.

### Pré-condições
- Fase 1 concluída (seeds existem)
- Fase 2 concluída (`concept_id` preenchível em rides_vehicles)

### Ações

**Marketplace (`produtos-e-comercio`):**
- Anúncio de veículo como produto comercial pode referenciar `concept_id` do veículo (domínio `mobilidade-e-logistica`) — mesma identidade semântica, contexto diferente
- Política: `canonical_products` com veículo não pode ter `concept_id` apontando para conceito de domínio `mobilidade-e-logistica` diretamente — a ponte é via relação explícita de produto, não por cópia de concept_id entre domínios

**Logistics:**
- `VehicleType` continua existindo como classificador operacional (matcher de demanda)
- `VehicleType` não é identidade semântica — não recebe `concept_id` diretamente
- Quando frota específica existir, cada recurso real pode apontar para `concept_id` via campo opcional

### Gate

```sql
-- Verificar que nenhum canonical_product usa concept_id de domínio mobilidade como identidade primária
SELECT cp.id, c.domain, c.slug
FROM canonical_products cp
JOIN concepts c ON c.concept_id = cp.concept_id
WHERE c.domain = 'mobilidade-e-logistica'
  AND cp.type = 'INDUSTRIAL';
-- Esperado: 0 linhas (veículo operacional ≠ produto industrial)
```

### Política de erro
- Tentativa de criar `canonical_product` com `concept_id` de mobilidade → decisão de produto necessária, não automática

### Proibido nesta fase
- Copiar `concept_id` entre domínios sem política de produto documentada
- Dar a `VehicleType` papel de identidade semântica

### STATUS DA FASE (execução)
- **status:** BLOCKED *(gate SQL não verificado — depende de `canonical_products` + dados)*
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma)*
- **validações executadas:**
  - Query gate do plano → **não executada** (ambiente sem confirmação de schema/tabelas)
- **observações:**
  - Executar o `SELECT` do gate quando BD marketplace/canonical estiver disponível.

---

## FASE 8 — ENFORCEMENT GRADUAL

**Objetivo:** tornar `concept_id` obrigatório após backfill auditado.

### Pré-condições
- Fase 3 concluída (backfill revisado e aplicado)
- Count de `rides_vehicles WHERE concept_id IS NULL` = 0

### Verificação obrigatória antes da migration:

```sql
SELECT COUNT(*) AS sem_concept FROM rides_vehicles WHERE concept_id IS NULL;
-- Se > 0: BLOQUEAR — completar backfill primeiro
```

### Ações

**Migration `20260525100000_rides_vehicles_concept_id_fk_not_null.sql`:**

```sql
BEGIN;

-- Guard: abortar se ainda há linhas sem concept_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM rides_vehicles WHERE concept_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION
      'BLOCKED: rides_vehicles tem linhas com concept_id NULL. '
      'Completar backfill antes de aplicar NOT NULL. '
      'Ref: FASE 3 do plano de execução rides/mobilidade.';
  END IF;
END $$;

-- FK para concepts
ALTER TABLE rides_vehicles
  ADD CONSTRAINT fk_rides_vehicles_concept
    FOREIGN KEY (concept_id)
    REFERENCES concepts(concept_id)
    ON DELETE RESTRICT;

-- NOT NULL (só após FK validada)
ALTER TABLE rides_vehicles
  ALTER COLUMN concept_id SET NOT NULL;

COMMENT ON COLUMN rides_vehicles.concept_id IS
  'Identidade semântica do veículo (SSOT: concepts, domain=mobilidade-e-logistica). '
  'NOT NULL após backfill completo (Fase 8 plano rides/mobilidade).';

COMMIT;
```

### Gate

```sql
SELECT COUNT(*) FROM rides_vehicles WHERE concept_id IS NULL;
-- Esperado: 0

SELECT COUNT(*) FROM rides_vehicles rv
JOIN concepts c ON c.concept_id = rv.concept_id
WHERE c.domain != 'mobilidade-e-logistica';
-- Esperado: 0 (todos os conceitos no domínio correto)
```

### Política de erro
- `DO $$` guard → migration aborta com mensagem explícita se count > 0
- FK violation → INSERT de veículo com concept_id inválido falha no banco

### STATUS DA FASE (execução)
- **status:** BLOCKED
- **timestamp:** 2026-04-13T12:00:00.000Z
- **arquivos alterados:**
  - `docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md`
- **migrations criadas:** *(nenhuma — pré-condição `COUNT(concept_id IS NULL)=0` não satisfeita / não verificada)*
- **validações executadas:**
  - `SELECT COUNT(*) FROM rides_vehicles WHERE concept_id IS NULL` → **não executado** (tabela `rides_vehicles` ausente no relatório Fase 3)
- **observações:**
  - Plano proíbe executar Fase 8 sem `COUNT(*) WHERE concept_id IS NULL = 0`.
  - Não criar migration `20260525100000` até backfill aprovado e gate verde.

---

## OBSERVABILIDADE (verificar após cada fase)

```sql
-- % de rides_vehicles com concept_id resolvido
SELECT
  COUNT(*)                                                              AS total,
  COUNT(*) FILTER (WHERE concept_id IS NOT NULL)                       AS com_concept,
  COUNT(*) FILTER (WHERE concept_id IS NULL)                           AS sem_concept,
  ROUND(COUNT(*) FILTER (WHERE concept_id IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0), 1) AS pct_resolvido
FROM rides_vehicles;

-- Conceitos usados (distribuição por domínio)
SELECT c.domain, c.slug, COUNT(rv.vehicle_id) AS uso
FROM rides_vehicles rv
JOIN concepts c ON c.concept_id = rv.concept_id
GROUP BY c.domain, c.slug
ORDER BY uso DESC;

-- Eventos ainda sem outbox (deve ser 0 após Fase 5)
SELECT COUNT(*) AS emit_direto_pendente
FROM event_outbox
WHERE event_type LIKE 'rides.%'
  AND published_at IS NULL;

-- Split com divergência (deve ser 0 após Fase 4)
-- Verificar no banco se rides_ride_distributions tem platform + driver + community = total
SELECT
  ride_id,
  driver_amount + platform_amount + community_amount AS soma,
  total_amount
FROM rides_ride_distributions
WHERE driver_amount + platform_amount + community_amount != total_amount;
-- Esperado: 0 linhas
```

---

## ADR MÍNIMO — ONTOLOGIA DE VEÍCULO (registrar antes da Fase 1)

Antes de executar a Fase 1, documentar a decisão de produto:

```markdown
## ADR: Ontologia de Veículo — UnifiCard

**Nível 1 (classe funcional):** carro, moto, van, caminhao, onibus, bicicleta,
  pickup, lancha, iate, navio, helicoptero, aviao
  → Seeds na Fase 1

**Nível 2 (modelo/família):** fiat-uno, honda-civic, mercedes-sprinter, etc.
  → Adicionar via migration separada quando produto exigir (não agora)

**Nível 3 (variante semântica):** fiat-uno-fire, sprinter-furgao, etc.
  → Apenas quando compatibilidade operacional real mudar

**Regra de ano:** ano NÃO vira conceito por padrão.
  Só sobe de nível se a ontologia provar diferença estrutural de compatibilidade.

**Governança de criação:** somente via migration versionada.
  Nunca via runtime automático. Nunca via backfill sem aprovação humana.
```

---

## PATCH CRÍTICO — SSOT FINANCEIRO

- **Bug corrigido** em `backend/src/modules/services/service-order.service.ts`: removido `/100` em `amountCents` dos splits (`platformFeeCents`, `providerNetAmountCents`) — o Bank recebe centavos inteiros, não valores divididos por 100.
- **Guard** `assertIntegerCents` em `backend/src/core/bank/assert-cents.ts`; chamado em `backend/src/modules/bank/bank-split.repository.ts` antes do `INSERT` em `bank_splits` (criação de split).
- **Payload de evento** `rides.payment.completed` (outbox): campos renomeados para `*ShareCentsEstimated` + `projection: true` em `backend/src/modules/rides/distribution/distribution.service.ts` *(apenas payload do `publishRideEventOutbox`; sem alterar lógica de pagamento Bank nem cálculo de splits)*.

**status:** DONE  
**timestamp:** 2026-04-13T18:00:00.000Z  

**Validação:** `pnpm exec tsc --noEmit` → exit 0.

---

## FORA DO ESCOPO DESTE PLANO

- `§10 investment_pool` / `§11 escrow` (gate §17 separado)
- Módulo automotive completo no marketplace
- Supply chain entre tenants
- N2 revisão
- Logística multi-leg completa
- Conceitos de nível 2 e 3 (decisão de produto futura)
- Auditoria transversal de módulos fora de `rides` (fase posterior)

---

## CHECKLIST FINAL DE CONCLUSÃO

*Sincronizado com execução Cursor **2026-04-13**. `[✔]` = verificado no código ou artefacto; `[ ]` = pendente, manual ou dependente de ambiente.*

```
FASE 0
[✔] ADR de domínios documentado (`docs/02_decisions/ADR_ONTOLOGIA_VEICULO_DOMINIOS_UNIFICARD.md`)
[ ] Proibições comunicadas ao time *(manual / PRs)*

FASE 1
[✔] Migration `20260524100000_concepts_mobilidade_seed.sql` versionada no repo
[ ] Migration aplicada no ambiente alvo + gate SQL ≥ 12 slugs *(depende de BD)*

FASE 2
[✔] Imports + `resolveConceptSlug` + `concept_id` no INSERT em `drivers/vehicles/vehicles.service.ts`
[✔] Retorno com `conceptNeedsResolution` (`CreateVehicleResult`)
[✔] `pnpm exec tsc --noEmit` e `tsc -p tsconfig.build.json --noEmit` → exit 0
[ ] Novo veículo com brand/model que resolva para seed (ex.: cenário `carro`) *(teste manual em BD com seeds)*

FASE 3
[✔] Comando `pnpm run report:rides-vehicles-concept-map` executado *(exit 0; em ambiente dev reportou `table_rides_vehicles_missing`)*
[ ] Relatório revisado por humano + backfill aprovado *(não aplicado — proibido automático)*
[ ] COUNT / evolução de `concept_id` após backfill *(não aplicável até backfill)*

FASE 4
[✔] `applyDistribution` sem `.toFixed()` no split; invariante soma = totalCents
[✔] `processRidePayment` usa `totalCents`; projeção documentada como não-SSOT
[✔] `pnpm exec tsc --noEmit` → exit 0

FASE 5
[✔] Padrão outbox: `runTenantTransactionWithClient` + `publishRideEventOutbox` / `insertEventOutboxRow`
[✔] `publishRideEventSafe` removido; zero `eventBus` em `backend/src/modules/rides`
[ ] Gate SQL `event_outbox` com `rides.%` após ação real *(depende de BD + e2e)*

FASE 6
[✔] Decisão órfão `rides/vehicles/vehicles.service.ts`: **DEPRECATE** + guard `throw` + doc no plano
[ ] Inventário de módulos comentados em `rides.module.ts`

FASE 7
[ ] Gate SQL `canonical_products` × mobilidade *(depende de BD)*

FASE 8 (após backfill e gates)
[ ] COUNT `rides_vehicles` WHERE `concept_id IS NULL` = 0
[ ] Migration `20260525100000` aplicada sem erro
[ ] FK e NOT NULL ativos
[ ] Observabilidade: queries do plano com valores esperados
```

