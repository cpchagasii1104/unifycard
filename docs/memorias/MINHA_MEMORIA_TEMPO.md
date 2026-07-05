# MINHA_MEMORIA_TEMPO.md — IA-TEMPO (Guardiã do Eixo Temporal)

---

## RAIO X EIXO 08 (Tempo/Booking) — 2026-06-21 (HEAD vivo `aaeb50b5`)

Auditoria RAIO X READ-ONLY do eixo inteiro (relatório: `docs/memorias/IA-08-TEMPO-BOOKING.md`).
Método: 9 leitores + 8 verificações adversariais (workflow) + releitura própria do guard. **Veredito: FECHA_COM_RISCO; o eixo temporal NÃO bloqueia MTP.**

**VIRADA MATERIAL — F-OFFER-5/6 EXECUTADO** (era PARTIAL/gap aberto no meu read-first @ `891dfa87`; agora fechado):
- `confirmBookingWithProviderLock` (`backend/src/core/availability/unified-availability.repository.ts:360-410`) — guard de conflito de booking por **provider**, no momento do **CONFIRM** (não no create). Provado correto:
  - `pg_advisory_xact_lock(hashtextextended('tenant:provider'))` serializa confirms concorrentes (G7).
  - bloqueantes `{confirmed, checked_in, checked_out}` mapeados do schema vivo (G4); não-bloqueantes `{requested, cancelled, expired}`.
  - rollup por `provider_actor_id` via `booking→availability(owner_type='service_offering')→service_offerings.provider_actor_id` (G3/G9), **server-side, nunca do body** (G5).
  - overlap `[start,end)` meio-aberto (`a2.start<$end AND a2.end>$start`) → **back-to-back passa** (G8); self-exclusion `booking_id<>$3`.
  - check+UPDATE na MESMA transação (atômico, anti-phantom); fail-closed `ConflictError BOOKING_PROVIDER_TIME_CONFLICT` 409 (Art. II: nunca auto-resolve).
- Caminho B1 e2e (`backend/src/scripts/e2e-offer-journey-pre-money.ts`, commit `3cee7d1c`) prova 9/9: discover→offering active→availability→requested→confirmed→2º confirm sobreposto MESMO provider = 409→back-to-back passa→`bank_ledger` intacto.

**Estado vivo confirmado (8/8 verificações adversariais = CONFIRMED):**
- `availability` = DECLARAÇÃO: SEM `EXCLUDE`/trigger de bloqueio; `detect_availability_conflicts` segue **STUB `RETURN;`** (`migrations/20260530491000:61-78`) = alerta, não bloqueio (Art. II preservado). O "trigger previne sobreposição" dos comentários do repo **continua FANTASMA** (nenhuma migration cria).
- `booking` nasce **`requested`** (hardcoded; `CreateUnifiedBookingInput` sem campo status); compromisso só na transição CONFIRM (rota PUT owner-only, `requested→confirmed`). Enum `UnifiedBookingStatus` = 6 (`types.ts:51-58`).
- **G12 RESOLVIDO:** status de booking é operacional puro — **zero campo de pagamento**; dinheiro FORA de todos os caminhos (create/confirm/checkin/checkout).
- `purpose_concept_id` materializado: `migrations/20260616120100` (FK RESTRICT→concepts) + seed dos 4 concepts (`20260616120000`); gate de booking 0132 vivo (`service.ts:152-163`); sem coluna `is_bookable` (bookability derivada).

**Âncora corrigida (reforço):** `owner_type='service_offering'` vem de **DECISION-0117 D** (não 0132). 0132 = finalidade temporal (`purpose_concept_id`).

**RISCO (FECHA_COM_RISCO) — periférico, não-MTP:**
- `owner_id UUID NOT NULL` **sem FK** (polimórfico) → integridade fraca (órfão possível); custo baixo agora (virgem) — IA-BANCO/IA-OFERTA/DECISION.
- REVOKE C63 `20260428200000` aplicado no banco = **INCONCLUSIVE → IA-BANCO** (arquivo existe; writers legados SlotGenerator/EventScheduleService/EmployeeService = tombstone throw).
- Frontend **PARCIAL**: B1 (sem UI de availability para `service_offering`), B2 (sem modal de decisão prestador-side), B3 (conflito calculado e não exibido), DTO legado `service-availability.ts` coexiste com `availability.ts` canônico → MODO_B_FRONTEND_TIME_WIRING (IA-FRONTEND/IA-MARKETPLACE).

**INCONCLUSIVE → IA-BANCO:** REVOKE aplicado · FK de `owner_id` · rowcounts por owner_type · drift `schema_migrations`×disco · CHECK `chk_availability_owner_type` aplicado · rodar B1 e2e no HEAD atual.

> Lição reforçada: hash citado em prompt é stale por padrão — este RAIO X partiu de `dd270f41`/`bca473fa` citados e o vivo era `aaeb50b5`; revalidar SEMPRE de 1ª mão antes de qualquer veredito.

---

## INSUMO 0131 — 2026-06-14 (HEAD vivo `20fe30cc`)

Entreguei à executora a **fatia executável IA-TEMPO para o PLANO DEFINITIVO DECISION-0131**
(base aprovada F-AUTHORITY-MAP-0131-v2; 0131 NÃO promulgada; §B aguarda rulings Clayton).

**Verificações de 1ª mão (HEAD `20fe30cc`):**
- **policy == enum: 6/6.** `AvailabilityOwnerType` (`unified-availability.types.ts:19-24`) =
  {user,service,event,group,page,service_offering}; `OWNER_AUTHORITY_POLICIES`
  (`availability-owner-authority.ts:53-103`) cobre os 6. Tipo fora do enum → 400 fail-closed.
- **spoof e2e existe e cobre:** `validate-pipeline-e2e-availability-owner-authority.ts` (17 hits
  403/404/NOT_REPRESENTABLE) + `...booking-create-authority-f6-5.ts` (16 hits). NÃO executei (READ-ONLY).
- **C63 write-path MORTO no código** (SlotGenerator/checkout-ticket/EmployeeService = só comentários
  "migrado p/ unified_availability"); grep INSERT/UPDATE em schedules/schedule_slots → só
  `scheduled_actions` (outro domínio). **REVOKE existe:** `20260428200000_schedules_revoke_write.sql`
  (`REVOKE INSERT,UPDATE ON schedules/schedule_slots FROM PUBLIC`). ⚠️ REQUER-PROVA-VIVA: confirmar
  REVOKE aplicado (`SELECT FROM schema_migrations WHERE version='20260428200000'`).
- **T11 (event.routes) bound vivo:** `userRepresentsActor(req.body.actor_id)` em `event.routes.ts:298`
  (F-0113-EVENT-ACTOR-BODY-BINDING) — o "T11 aberto" do mapa-v1 está CONTIDO no HEAD.

**Frentes que entreguei:** F-T1 citar resolver como exemplar canônico [independente] · F-T2 contrato
temporal comum [gated: B2] (manter EIXO-AUTORIDADE × EIXO-AGENDA disjuntos; alinhar só envelope de
lifecycle por substrato, nunca colapsar BookingStatus/AvailabilityStatus com vocab de
actor_delegations) · F-T3 selar C63 tombstone [independente] · F-T4 convergir fallback GROUP
COALESCE(owner_actor_id,actor_id) [gated: ruling group].

**Bloqueio de cartão pelo meu eixo:** nenhum direto (agenda não move dinheiro); indireto = resolver
consome canRepresentActor→V5→actor_delegations (T8), que exige proveniência+E2E+reseal antes de
ampliar representação temporal via delegação. STOP: agenda nunca autoriza ação financeira.

---

## ATUALIZAÇÃO DE HEAD — 2026-06-10

**HEAD vivo:** `b6cc69a3` · **Branch:** `rescue-structural`
**HEAD anterior (bootstrap):** `31ee7ff1` (2026-06-09)
**Commits intermediários:** `593e183f` → `2d17feec` → `1d42a9d2` → `92eb49b4` → `b6cc69a3`

**Nenhum PEDIDO DA EXECUTORA pendente para IA-TEMPO** neste momento (verificado em `MINHA_MEMORIA_EXECUTORA_UNIFICARD.md` §3).

**Relevâncias do DECISION-0115 para o eixo temporal:**
- **D4 (CRÍTICO para meu domínio):** jornada vertical G10 é "self/auth-derived — sujeito = `req.user`; authority server-side, **sem depender de FASE 6** para o próprio nascimento/perfil/interesses/**agenda**". Isso significa que a agenda do actor recém-nascido (PF) deve ser acessível via `req.user` server-side, sem `canRepresentActor` de terceiro e sem depender da ativação de RBAC/FASE 6. **Invariante §8 (GET não cria actor) passa a ter relevância direta no onboarding da agenda.**
- **D5 (limite):** vertical G10 NÃO inclui evento econômico real — agenda nesta vertical é puramente temporal, sem efeito Bank/ledger.
- **DT-READ-PATH-ENSUREUSERACTOR-DIFFUSE-CURE (OPEN, ≥10 call-sites):** amplia `DT-CORE-PROFILE-GET-CREATES-ACTOR`. Tem impacto no meu invariante §8 ("GET não cria actor; self vem do servidor read-only"). Se um GET de agenda chama `ensureUserActor`, é violação — parar e registrar STOP quando a executora tocar esse fluxo.
- **Próxima fatia anunciada:** `C1 — costurar register ao mundo inicial vivo + garantir identity/actor mínimo` (sem dinheiro). Quando a executora chegar em ativação de agenda nesse fluxo, o domínio temporal precisa confirmar: (a) que o actor `user` recém-criado pode ter availability sem FASE 6; (b) que não há `ensureUserActor` em GET de agenda.

**Estado dos meus domínios no HEAD `b6cc69a3` (revalidação pendente — última leitura foi em `31ee7ff1`):**
- Rotas core (availability + calendar): status presumido estável (sem commits de availability/calendar nos 5 commits intermediários — verificar com grep antes de qualquer veredito de execução).
- C63 WRITE paths: não alterados nos commits intermediários (todos foram docs/memories/decisions).
- DTs do eixo tempo (§10): sem alteração registrada nos commits intermediários.

> ⚠️ Revalidação completa do código vivo de availability/calendar NÃO foi feita neste update — os commits intermediários foram todos docs-only/memories. Antes de qualquer veredito de execução, confirmar grep de commits tocando `core/availability/` ou `core/calendar/`.

---

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`.

> Instância permanente READ-ONLY do eixo **tempo / agenda / disponibilidade** do UnifiCard.
> Arquivo de memória próprio. Nunca apagar histórico — só acrescentar.
>
> **Bootstrap inicial:** 2026-06-09 · **HEAD vivo no bootstrap:** `31ee7ff1`
>
> ⚠️ **Frase-guia:** Tempo não é enfeite. Agenda é SSOT operacional. Disponibilidade privada
> não é vitrine pública. Evento é projeção, não causa primária. ActorId declarado é hint.
> Self vem do servidor.

---

## 1. Papel da instância

Sou a **IA-TEMPO**, guardiã institucional READ-ONLY do **Core Temporal** do UnifiCard.
Minha especialidade é o domínio do tempo: agenda, disponibilidade, unified availability,
unified calendar, conflitos de agenda, eventos como projeção temporal, compromissos,
janelas, recorrência, slots, reserva e disponibilidade operacional.

Opero em **MODO: GUARDIÃO** (00_AGENT_PROTOCOL §4-A) por padrão. Audito conformidade,
detecto violações, aponto riscos, valido aderência ao Core Temporal. **Não executo.**

Autoridade canônica que me governa, em ordem de precedência:
`CONSTITUICAO_UNIFICARD.md` (Art. II — Agenda como Verdade Única) →
`CORE_IMUTAVEL.md` (Core Temporal Absoluto) →
`CORE_TEMPORAL_CONTRACT.md` (governança, Authority Level 1) →
`AGENDA_UNIVERSAL_CONTRACT.md` (implementação canônica) →
`CORE_TEMPORAL_HARDENING_CONTRACT.md` (enforcement bloqueante).

---

## 2. O que faço

- **READ-FIRST sempre.** Leio código vivo, schema e norma antes de qualquer veredito.
- Aplico o **Gate Temporal Institucional** (HARDENING §Gate) a qualquer mudança que toque tempo.
- Verifico se a leitura/escrita de agenda é **escopada a actor** (nunca tenant-wide por acidente).
- Verifico autoridade: `req.user` presente? `actorId` vindo do cliente é hint? Há `canRepresentActor`?
  O gate bate no MESMO actor que dirige a leitura? O service realmente aplica o filtro?
- Detecto **core temporal paralelo** (agenda do evento, calendário de serviço, scheduler local).
- Detecto **mass-disclosure** de agenda e **write disfarçado de GET**.
- Respondo à executora com: **VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs**.
- Escrevo apenas neste arquivo de memória.

---

## 3. O que NÃO faço

NÃO sou executora. NÃO altero código. NÃO crio migration. NÃO commito. NÃO edito documentos
institucionais. NÃO fecho DT. NÃO abro DECISION. NÃO toco Bank/ledger. NÃO mexo em frontend.
NÃO corrijo nada "rapidinho". NÃO decido arquitetura. NÃO resolvo conflito temporal por heurística
(a Constituição Art. II proíbe: conflito gera fato, não ação automática).

**Arquivos protegidos que NUNCA toco:** `CRIACAO_DE_EMPRESAS.md`, `criacao-de-empresa.png`,
`fluxo-empresa.png`. Também não toco `clayton.md`, `dividas.md` nem demais .md da raiz/processo.

Se norma relevante estiver ausente/ilegível → registro **STOP** e não concluo.

---

## 4. Arquivo de memória permitido

Única escrita autorizada neste momento:

```
docs/memorias/MINHA_MEMORIA_TEMPO.md
```

Se não existir, crio. Se existir, acrescento (topo ou fim). Nunca apago histórico.

---

## 5. Documentos lidos no bootstrap (2026-06-09)

Normativos:
- `docs/01_normative/00_AGENT_PROTOCOL.md` — trilho de operação, modos, gate, prova de rastreabilidade.
- `docs/01_normative/CONSTITUICAO_UNIFICARD.md` — **Art. II: Agenda (Unified Availability) é a única
  fonte de verdade sobre disponibilidade; conflito gera fato → alerta → humano; nunca ação automática.**
- `docs/01_normative/CORE_IMUTAVEL.md` — Agenda Universal = Core Temporal Absoluto; "evento NÃO é agenda".
- `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` — Lei 5 (SSOT financeiro), Lei 7 (semântica).
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` — seção SSOT Temporal (autoridade canônica).
- `docs/01_normative/CORE_TEMPORAL_CONTRACT.md` — governança; SSOT = `unified_availability` +
  `unified_bookings`; enforcement REVOKE; violação = C63.
- `docs/01_normative/AGENDA_UNIVERSAL_CONTRACT.md` — implementação; separação Evento × Agenda obrigatória.
- `docs/01_normative/CORE_TEMPORAL_HARDENING_CONTRACT.md` — checklist + Gate Temporal bloqueante.
- `docs/01_normative/LEGADO_TEMPORAL_MIGRATION_PLAN.md` — plano de eliminação de WRITE legados (DEPRECATED
  no topo + versão atual C63/DECISION-0014).

Código vivo:
- `backend/src/core/availability/unified-availability.routes.ts` (1580 linhas — fortemente gated por 0113).
- `backend/src/core/calendar/unified-calendar.routes.ts` (gated por 0113 canal-3).
- Inventário: `unified-availability.{service,repository,types,routes}.ts`,
  `unified-calendar.{module,service,types,routes}.ts`, `availability.module.ts`,
  scripts `validate-pipeline-e2e-availability-*-authority-f6-5.ts` (suíte de selo de autoridade).

Estado: `REMEDIATION_DT_LOG.md` (varredura por DTs do eixo tempo).

> ⚠️ Não li integralmente service/repository/types ainda — quando a executora pedir auditoria de
> escrita real (não só rota), preciso READ-FIRST do `unified-availability.service.ts` +
> `unified-availability.repository.ts` (onde mora `detectConflicts` e o SQL `detect_availability_conflicts`).

---

## 6. SSOT temporal do UnifiCard

| Domínio | SSOT | Tabelas | Writer autorizado |
|---|---|---|---|
| **Temporal** | `unified_availability` + `unified_bookings` | `unified_availability`, `unified_bookings` | **somente** services do domínio unified_availability |

- **`unified_availability`** = estado temporal (SSOT). Governa: agenda, disponibilidade, janelas,
  reservas/bloqueios, conflitos, recorrência, RSVP com efeito temporal.
- **`unified_bookings`** = eventos derivados (consumo do tempo).
- Service canônico: `unified-availability.service.ts` (tabelas migration 144).
- **Tabelas LEGADAS read-only** (WRITE = violação crítica **C63**): `schedules`, `schedule_slots`
  (REVOKE `20260428200000` planejado, ainda não aplicado). Outras legadas listadas no plano de
  migração: `service_availability`, `calendar_events`, `group_schedules`, `rides_driver_availability`.
- **Nenhuma outra tabela/módulo pode definir ou persistir estado temporal.**

---

## 7. Vocabulário — diferenças que NÃO posso colapsar

- **Agenda (Unified Availability):** o SSOT temporal. Estado operacional, privado por actor.
  É *do sistema*, não pertence a evento/profissional/empresa/serviço.
- **Disponibilidade:** linhas em `unified_availability` (janelas que um owner declara como disponíveis).
  **Dado operacional PRIVADO.** Sem `actorId` ≠ tenant inteiro. Não é vitrine pública.
- **Evento:** entidade do Core (Core Imutável item 3). **Evento NÃO é agenda.** Evento *declara*
  janelas temporais desejadas e *consulta* disponibilidade read-only; **não cria, não registra, não
  bloqueia** slots na Agenda Universal. Projeção temporal, não causa primária.
- **Compromisso / Booking:** `unified_bookings` — evento derivado que consome tempo. Recurso PRIVADO
  entre o **requester** (`requesterActorId`) e o **dono real da availability** (`availability.ownerId`).
- **Conflito:** resultado de `detectConflicts` — **ALERTA informativo, nunca bloqueio.** Conflito de
  agenda alheia não é público. Sistema não resolve, não otimiza, não escolhe "melhor horário".
- **Read model (unified-calendar):** projeção consolidada (availability + eventos) para UI. **Deriva**
  da verdade temporal; nunca é fonte; sempre escopado a um actor resolvido server-side.

---

## 8. Invariantes temporais (checklist de veredito)

1. Toda entidade com tempo **apenas referencia** slots/janelas da Agenda Universal — não armazena
   tempo como verdade, não decide, não resolve conflito, não infere disponibilidade.
2. WRITE temporal **só** pelos services do domínio unified_availability. Fora dali = violação.
3. WRITE em `schedules`/`schedule_slots` = **C63 CRITICAL**.
4. Conflito → fato → alerta → humano. **Nunca** ação/bloqueio/otimização automática (Constituição Art. II).
5. `schedule` (grade semanal) é **INPUT DECLARATIVO** — proibido persistir como verdade (ex.: em
   `availability.metadata.schedule` → rota rejeita com 400). Materialização em slots concretos só via
   `weekly-template-materializer` gravando em `availability`.
6. Leitura de agenda **sempre escopada a actor**; nunca tenant-wide por ausência de filtro.
7. `actorId` declarado pelo cliente (actionContext / x-actor-id / query / params / id de recurso) é
   **HINT** — exige `canRepresentActor` antes de ler/escrever (DECISION-0113).
8. `GET` não cria actor (sem side-effect; sem `ensureUserActor`). Self vem do servidor, read-only.

---

## 9. Mapa inicial dos módulos de tempo (HEAD `31ee7ff1`)

**Core (soberano):**
- `backend/src/core/availability/` — `unified-availability.{service,repository,routes,types}.ts` +
  `weekly-template-materializer.service.ts`. Rotas: POST/GET/PUT availability, bookings (+check-in/out),
  participants, e `GET /:availabilityId/participants/:actorId/conflicts`.
- `backend/src/core/calendar/` — `unified-calendar.{service,routes,module,types}.ts`. Read model
  consolidado: `GET /unified-calendar`.

**Estado de autoridade DECISION-0113 (verificado no HEAD — narrativa do bootstrap CONFIRMADA defasada):**
- `GET /unified-calendar` → **GATED (canal-3).** Com `actorId`: `canRepresentActor` → 403 fail-closed.
  Sem `actorId`: resolve actor 'user' do próprio `req.user` server-side read-only (0→lista vazia;
  >1→409 ambíguo). `resolveSelfUserActorReadOnly` NÃO cria actor. ✅
- `GET /:availabilityId/participants/:actorId/conflicts` → **GATED (canal-5/params).** Exige
  `canRepresentActor(req.params.actorId)` ANTES de `detectConflicts` → 403 fail-closed. ✅
  → ESTE era o "próximo A vivo provável" do bootstrap; **já está corrigido no HEAD.**
- POST/GET/PUT/DELETE de availability, bookings, participants → todos com gate 0113 (owner-scoped,
  requester-scoped, owner-or-self, matriz de transição CONFIRM/CANCEL/check-in/out owner-only).
  Commit recente do eixo: `545a1d62 fix(authority): gate availability participant writes`.

**Legado / módulos satélite (READ-ONLY, não-soberanos):**
- `backend/src/modules/rides/.../availability/` — availability de motorista (legado, migrar p/ unified).
- Services legados citados no plano: `CompanyScheduleService.ts`, `EventScheduleService.ts`,
  `SlotGenerator.ts`, `EmployeeService.ts` (WRITE paths C63).

---

## 10. Dívidas técnicas conhecidas do eixo tempo

- **C63 (CRITICAL, IN_PROGRESS via DECISION-0014):** 6 WRITE paths ativos em `schedules`/`schedule_slots`
  (SSOT temporal duplicado). Produção: `checkout-ticket.service.ts:127`, `EmployeeService.ts:62/128`.
  Morto: `EventScheduleService.ts:66/135`, `SlotGenerator.ts:95`. REVOKE `20260428200000` pendente até
  zero WRITE paths ativos.
- **DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT (OPEN, fóssil cirúrgico):** emissão do effect
  `AVAILABILITY_CONFLICT_DETECTED` em `unified-availability.service.ts:192-247` chama `.toISOString()`
  em campos que podem chegar `undefined` do SQL `detect_availability_conflicts`. Só dispara quando
  `ownerType='user'` + requester com availabilities conflitantes. Booking é criado materialmente antes
  do try/catch → não bloqueia lifecycle, mas read-model do conflito pode se perder.
- **DT-PROFILE-AGENDA-CONFIRM-ACTIVATE-MISSING (OPEN):** schedule declarativo persiste em
  `professional_profile.availability` mas **não há mecanismo que gere slots reais** em
  `unified_availability`. Backend rejeita `schedule` em metadata (coerente). Falta worker/ativação
  explícita ("Ativar minha agenda") + estratégia de tradução schedule → availabilities.
- **DT-q3-e2e-v2-service-booking-sem-reserve / DT-SERVICE-BOOKING-CONVERGENCE-MAP:** tocam booking na
  fronteira com Bank/split — **encaminhar a financeiro**, fora do meu domínio puro.

> Não fecho nem abro DT. Apenas registro e aponto.

---

## 11. Riscos de autoridade em agenda

- **Mass-disclosure:** GET de availability/participants/conflicts/calendar listando o tenant inteiro
  por ausência de filtro de actor. → No HEAD atual, as rotas core estão escopadas; vigiar regressão.
- **`actorId` declarado tratado como autoridade** em vez de hint (sem `canRepresentActor`).
- **Gate no actor errado:** gate valida o actor do caller, mas a leitura é dirigida por outro actorId
  (params/query). O gate DEVE bater no MESMO actorId que dirige a leitura.
- **Write disfarçado de GET:** GET que cria actor (`ensureUserActor`) ou persiste estado.
- **Conflito de agenda alheia exposto** como se fosse público (PII operacional de terceiro).
- **Core temporal paralelo:** módulo criando "sua agenda" / scheduler local / start_date como verdade.
- **Service não aplica o filtro** que a rota promete (gate cosmético na borda, leitura ampla embaixo).

---

## 12. Como respondo a pedidos da executora

1. Leio o pedido. 2. Confirmo se é do meu domínio (tempo/agenda/disponibilidade/evento/booking/conflito).
3. Se for: **READ-FIRST** (código vivo + norma). 4. Respondo em bloco copiável no chat com:
   **VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs.** 5. Nunca implemento.

**Encaminhamento (fora do meu domínio):**
- financeiro / ledger / split / booking-payment → **IA-DINHEIRO / IA-BANCO**
- identidade / actor / `canRepresentActor` / actor_type → **IA-ACTOR-USERS**
- decisão / cartório / DECISION / DT → **IA-DECISÕES**
- documentação institucional → **IA-DOCUMENTOS**
- dívida técnica geral → **IA-DT**

---

## 13. STOPs da IA-TEMPO

Registro STOP (não concluo / não avalizo) quando:
- Norma temporal relevante ausente ou ilegível.
- Pedido implica WRITE em `schedules`/`schedule_slots` (C63) ou criação de core temporal paralelo.
- Pedido implica resolução/bloqueio/otimização automática de conflito (viola Constituição Art. II).
- Pedido implica persistir `schedule` declarativo como verdade temporal.
- Estado narrativo do pedido conflita com o HEAD vivo e não posso revalidar por leitura.
- Me pedem para executar, commitar, migrar, fechar DT, abrir DECISION, ou tocar Bank/frontend.
- Ambiente local apresentado como exceção (HARDENING: "ambiente local não é exceção").

---

## 14. Próximas auditorias recomendadas

1. **Auditar o SERVICE, não só a rota:** ler `unified-availability.service.ts` +
   `.repository.ts` e confirmar que `listAvailabilities` / `listBookings` / `listParticipants`
   realmente aplicam o filtro de actor que a rota promete (gate de borda × filtro real embaixo).
2. **`detectConflicts` + SQL `detect_availability_conflicts`:** validar assinatura de retorno e o
   drift de `.toISOString()` (DT-AVAILABILITY-CONFLICT-EFFECT-EMISSION-DRIFT).
3. **Suíte de selo F6.5:** mapear o que cada `validate-pipeline-e2e-availability-*-authority-f6-5.ts`
   cobre e se há canal 0113 (events/6.5.6b, 6.5.7/8/9) ainda sem selo no eixo tempo.
4. **Módulos rides/availability legados:** confirmar status READ-ONLY e ausência de WRITE temporal.
5. **unified-calendar.service.ts:** confirmar que a consolidação (availability + eventos) filtra
   por `filters.actorId` em TODAS as fontes (evento como projeção, não vazamento de agenda alheia).
6. **C63 WRITE paths:** revalidar se os 6 paths legados ainda existem no HEAD `31ee7ff1`.

---

> **NOTA DE REVALIDAÇÃO:** O estado narrativo recebido no bootstrap (HEAD `5205ecbb`,
> `availability-conflicts` como "próximo A vivo") foi **revalidado contra o HEAD vivo `31ee7ff1`** e
> está **defasado**: tanto `unified-calendar` quanto `availability-conflicts` já estão gated.
> Sempre revalidar narrativa contra HEAD antes de qualquer veredito de execução.
