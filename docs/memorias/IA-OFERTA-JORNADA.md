# IA-07 — Oferta/Jornada

> RAIO X READ-FIRST do eixo OFERTA/JORNADA (CONCEPT → SERVICE → SERVICE_OFFERING → DISCOVERY → OFFERING SELECTION → AVAILABILITY → BOOKING REQUESTED → BOOKING CONFIRMED → CONFLICT GUARD). Auditoria READ-ONLY — nenhum código/migration/cartório editado. Insumo, não GO.

## 1. Carimbo

* **HEAD:** `aaeb50b5182120888a72418775a9d211e33bff4d` (`aaeb50b5`) · branch `rescue-structural` · último commit `docs(orchestration): add systemic x-ray consolidation` (2026-06-21 21:00). **O hash citado no contexto recente não foi assumido — revalidei de 1ª mão via `git rev-parse`.**
* **Data/hora:** 2026-06-21 (~23:15 -03).
* **Git status:** sem alteração de código de produção. Modificados: memórias `docs/memorias/MINHA_MEMORIA_*.md` + `opus.md`; vários untracked (docs/relatórios/pngs). Nenhuma migration/backend/frontend tocada por mim.
* **READ-ONLY confirmado:** SIM — só leitura/grep/git read-only + workflow de auditoria; zero escrita fora deste arquivo.
* **Arquivo criado/atualizado:** `docs/memorias/IA-07-OFERTA-JORNADA.md` (criado).
* **Docs/memórias lidos:** `docs/orquestracao/processo/cadeia-de-oferta/CONSOLIDADO.md` ✓ · `docs/orquestracao/sistema/RAIO-X-SISTEMICO-2026-06-21.md` ✓ · `docs/memorias/IA-10-MARKETPLACE-JORNADA.md` ✓ · `docs/memorias/IA-06-SEMANTICA.md` ✓ · DECISION-0142/0143/0144/0145/0146 ✓ · `e2e-offer-journey-pre-money.ts` ✓ · `package.json` (backend) ✓. **Ausentes:** `docs/memorias/IA-04-AUTORIDADE.md`, `docs/memorias/IA-05-EMPRESA-PJ.md` (não existem; segui com código/schema vivo — existem `MINHA_MEMORIA_AUTORIDADE.md` e `IA-05`-equivalentes não no caminho citado).
* **Banco/schema consultado:** schema via migrations no disco (1ª mão). **Rowcounts vivos NÃO obtidos** (auditoria de disco) → roteados a IA-BANCO (§8).
* **Comandos/probes usados:** `git rev-parse HEAD`, `git log --oneline`, `git status --short`, Read/Grep sobre `backend/src`, `backend/migrations`, `frontend/src`, `docs`; workflow read-only de 13 agentes (9 lanes de investigação + 4 verificações adversariais), todos revalidando HEAD `aaeb50b5` de 1ª mão.

## 2. Escopo

**Auditado (no eixo):** `services`/`createService`/elegibilidade declaração-publicação; `service_offerings`/`createOffering`/binding+draft; ativação draft→active (escopo oferta); discovery/search por concept_id; seleção por by-canonical; availability owner=`service_offering`; createBooking→confirm; conflito de provider; Caminho B1 e2e; gap de wiring B2 frontend; resíduos conhecidos; se a jornada chama dinheiro.

**Fora (registrado como handoff quando tocado):** cadastro/auth, perfil/SSOT, actor model completo, autoridade global, empresa/PJ completa, semântica global, marketplace inteiro, produtos/locação/assinatura, dinheiro/ledger/split/payout (profundidade), logística/presença, frontend inteiro.

## 3. Estado F-OFFER-0→6 vs estado vivo

> O cartório (CONSOLIDADO masthead) ainda carimba HEAD `9f5e9c5e`, mas o **corpo do ledger cita os commits posteriores e TODOS existem no `git log`**; o substrato é atual, só o masthead atrasou (OFFER-DOC-02). Confirmei cada frente contra código+migration vivos.

| Frente | Classificação | Prova viva |
|---|---|---|
| **F-OFFER-0** (DECISION-0143 vocabulário) | **CONFIRMADA** | norma docs-only `DECISION_0143...md`; cadeia materializada a jusante |
| **F-OFFER-1** (contém ghost assign-skill 501) | **CONFIRMADA** | commit `d9dcb1ef`; `categories.routes.ts:22` code `ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING`; guard `audit-assign-skill-ghost-containment.mjs` |
| **F-OFFER-2** (DECISION-0144 + 2A schema + 2B runtime) | **CONFIRMADA** | mig `20260621100000:45` (`services.canonical_service_id` SET NOT NULL + FK apc/ccp RESTRICT, preflight fail-closed); `services.service.ts:40-83` exige declaração(PF `is_active`)/publicação(PJ `status='active'`) do mesmo concept |
| **F-OFFER-3** (DECISION-0145 + material) | **CONFIRMADA** | mig `20260621120000:23,35-36` (`service_offerings.service_id` NOT NULL + FK RESTRICT); `service-offering.service.ts:115-150` exige service do mesmo provider+concept (403/409), nasce draft, company server-side |
| **F-OFFER-4 V1** (discovery re-key por concept_id) | **CONFIRMADA** | `services.repository.ts:213-220` JOIN `canonical_services.concept_id`; `services-discovery.service.ts:378-388` resolve categoria→concept (leaf-only, 403 non-leaf). _Marketplace `/search` re-key = V2 residual (consistente c/ IA-06)._ |
| **F-OFFER-5/6** (DECISION-0146 + material) | **CONFIRMADA** | `unified-availability.repository.ts:360-410` `confirmBookingWithProviderLock` (advisory lock + rollup por `provider_actor_id` + intervalo meio-aberto + atômico); guard `audit-booking-provider-conflict.mjs` |
| **Caminho B1** (e2e pré-dinheiro) | **CONFIRMADA (com ressalva)** | commit `3cee7d1c`; `e2e-offer-journey-pre-money.ts` caminha a cadeia com funções reais; cartório 9/9 PASS / YALA. Ressalva: trava de dinheiro é `console.log`, não assert (§6 B1E2E-01) |
| **Caminho A** (ativação segura) | **NÃO_FECHA (HOLD correto)** | `CONSOLIDADO.md:110` HOLD; ativação hoje é self-serve-insegura (§6 ACTIVATION-01) |
| **B2** (frontend wiring) | **NÃO_FECHA (frente própria aberta)** | frontend descobre por `category_id` texto-livre; sem `canonicalServiceId`/`ServiceOfferingSelector`/`by-canonical`; booka por service, não offering (§6 B2-01) |

**Reconciliação com IA-10:** não há contradição. IA-10 conclui `FECHA_COM_RISCO` com único blocker de MTP = B2 frontend, mantendo Caminho A e dinheiro em HOLD explícito — coerente com `CONSOLIDADO.md:110` e com o código. Nuance: prontidão para **público/dinheiro** carrega HOLDs além de B2 (Caminho A + status DTO de produto), que a própria IA-10 enumera.

**Nota cartorial (cosmética, não-material):** DECISION-0143/0144/0145 têm cabeçalho "DOCS-ONLY / não toca runtime", mas as fatias F-OFFER-2A/2B/3 (ratificadas à parte) materializaram a régra em schema+runtime — leitor que confiar só no cabeçalho da DECISION subestima o estado real (OFFER-DOC-01; IA-06 marcou PARCIAL).

## 4. Mapa macro da jornada

```
CONCEPT ──────────────► FECHA        (concept = identidade; 0142 folha-SSOT)
  └► SERVICE ─────────► FECHA        createService: canonical NOT NULL + declaração/publicação ACTIVE + canRepresentActor
       └► SERVICE_OFFERING ► FECHA   createOffering: exige service(provider+concept), service_id NOT NULL, nasce DRAFT, company server-side
            └► DISCOVERY ──► FECHA   casa por concept_id (categoria→concept leaf-only); canonicalServiceId viaja no DTO
                 └► OFFERING SELECTION (by-canonical) ► FECHA   active-only provado (draft não vaza)
                      └► AVAILABILITY ► FECHA_COM_RISCO   owner_type='service_offering' (writer server-side); owner_id polimórfico SEM FK
                           └► BOOKING REQUESTED ► FECHA   nasce 'requested', sem dinheiro, requester representado
                                └► BOOKING CONFIRMED ► FECHA   confirmBookingWithProviderLock (advisory lock, atômico)
                                     └► CONFLICT GUARD ► FECHA   overlap mesmo provider→409; back-to-back e provider-distinto liberados
```
**Backend pré-dinheiro: a cadeia inteira CONECTA e está provada (Caminho B1).** Os únicos elos abertos são fora do backend causal: **B2 frontend (tangibilidade)** e **Caminho A (ativação pública segura)**.

## 5. Matriz do eixo

| item | fecha/não-fecha | evidência viva | blocker | risco | próxima frente | modo |
|---|---|---|---|---|---|---|
| service | FECHA | `migr 20260621100000:45` canonical NOT NULL | não | baixo | — | FAST-PATH |
| createService | FECHA | `services.service.ts:143-160`+`40-83` | não | baixo (só `service_type='service'`) | — | FAST-PATH |
| service.canonical_service_id | FECHA | NOT NULL+FK RESTRICT `20260621100000:45` / `...foundation.sql:186-188` | não | baixo | — | FAST-PATH |
| declarations/publications | FECHA | `actor_professional_concepts.is_active`/`company_concept_publications.status='active'` exato por concept | não | baixo | — | FAST-PATH |
| service_offering | FECHA | `migr 20260611180000:66-84` (price BIGINT, status CHECK, UNIQUE) | não | baixo | — | FAST-PATH |
| createOffering | FECHA | `service-offering.service.ts:115-150` exige service+concept, 403/409 | não | baixo | — | FAST-PATH |
| service_offerings.service_id | FECHA | NOT NULL+FK RESTRICT `migr 20260621120000:23,35-36` | não | baixo (rowcount vivo→IA-BANCO) | — | FAST-PATH |
| offering status draft/active | FECHA | nasce 'draft' `service-offering.service.ts:150` + schema default | não | baixo | — | FAST-PATH |
| **draft→active (ativação)** | **NÃO_FECHA (inseguro)** | `updateOwnOffering` flip status só por `canRepresentActor`; sem KYB/trust; sem re-check de elegibilidade | **público+dinheiro** | **alto** | Caminho A | **DECISION** |
| discovery | FECHA | `services.repository.ts:213-220` por concept_id; non-leaf→403 | não | baixo | — | FAST-PATH |
| canonicalServiceId (DTO) | FECHA (backend) / NÃO (frontend) | `services.repository.ts:25,251` viaja; frontend não transporta | público (via B2) | médio | B2 | MODO B |
| by-canonical | FECHA | `service-offering.service.ts:222-230` route `:116-122` | não | baixo | — | FAST-PATH |
| active-only | FECHA | `WHERE status='active'` `:225` (verificado adversarial) | não | baixo | — | FAST-PATH |
| draft oculto | FECHA | e2e `:82-83`; verificação adversarial CONFIRMED | não | baixo | — | FAST-PATH |
| offering→availability | FECHA_COM_RISCO | `availability-owner-authority.ts:72-80`; CHECK 6 tipos; **owner_id sem FK** | não | médio | conter legado | MODO B |
| availability→booking requested | FECHA | `unified-availability.repository.ts:317-329` nasce 'requested', sem pagamento | não | baixo | — | FAST-PATH |
| requested→confirmed | FECHA | `unified-availability.service.ts:308-327` | não | baixo | — | FAST-PATH |
| conflict guard | FECHA | `repository.ts:360-410` advisory lock + meio-aberto + atômico (CONFIRMED adversarial) | não | baixo | — | FAST-PATH |
| B1 e2e | FECHA_COM_RISCO | `e2e-offer-journey-pre-money.ts` funções reais 9/9; trava $ é log | não | médio | endurecer e2e | MODO B |
| **B2 frontend gap** | **NÃO_FECHA** | sem concept_id/`ServiceOfferingSelector`/by-canonical; booka por service | **MTP tangível + público** | **alto** | B2 wiring | **MODO B** |
| **Caminho A activation gap** | **NÃO_FECHA** | self-serve sem KYB/trust; revogação não bloqueia | **público + dinheiro** | **alto** | ativação pública | **DECISION** |
| dinheiro fora | FECHA | grep $ zero em booking/offering; firewall 0110 default-OFF | não | baixo | — | FAST-PATH/HOLD |
| testes/guards | FECHA | guards `audit-*` por fatia; e2e B1; verificações adversariais | não | baixo (cobertura $ no e2e fraca) | — | FAST-PATH |

## 6. Achados críticos

**ACTIVATION-01 — Ativação draft→active é self-serve-insegura (ATIVACAO_SELF_SERVE_INSEGURA).**
A oferta nasce draft, mas o único caminho draft→active é o `PUT /offerings/:id` genérico → `updateOwnOffering`, gateado **só** por `canRepresentActor(provider)`. PF (`authorization.service.ts:346-353`) e PJ (`:359-363` canManageCompany) **auto-ativam** a própria oferta. **Sem KYB/trust** e **sem re-validar a elegibilidade DECISION-0144 no momento da ativação** — a elegibilidade é checada só no CREATE do service (herdada no create da offering), nunca re-checada no flip; revogação posterior da declaração/publicação **não** bloqueia (KYB-revoke→retract é explicitamente fora de escopo, `CONSOLIDADO.md:102`). Discovery é active-only, então uma oferta auto-ativada fica publicamente descobrível.
Evidência: `service-offering.service.ts:164-188`; `service-offerings.routes.ts:69-90`; `authorization.service.ts:346-363`; `CONSOLIDADO.md:101-102,110`.
Bloqueia MTP? **não** · Bloqueia público? **sim** · Bloqueia dinheiro? **sim** · DECISION? **sim (Caminho A)** · YALA? não · Modo: **DECISION** · Handoff: NONE.

**B2-01 — Frontend pula a camada offering e descobre por `category_id` texto-livre, não por `concept_id`; `ServiceOfferingSelector` inexistente.**
`discoverServices()` só envia `category_id`/local/datas (`frontend/src/api/service-discovery.ts:80-91`); a UI expõe `category_id` como input de texto livre (`ServiceDiscoveryPage.tsx:106-113`); `concept_id`/`canonicalServiceId` nunca trafegam (0 hits). A rota `/discover` também não plumba concept_id (`services.routes.ts:419-463`), embora o repo já suporte o JOIN canônico. Não existe `ServiceOfferingSelector` (0 hits); o detalhe usa `ServiceSetupSelector` (metadata blob). A rota `by-canonical` (active-only, keyed por concept) **não tem consumidor frontend**. Os CTAs são reais (navegam para rotas existentes) mas keyam por `serviceId`; booking via `POST /services/:serviceId/bookings`, pulando a offering.
Evidência: `frontend/src/api/service-discovery.ts:80-91`; `ServiceDiscoveryPage.tsx:106-113`; `ServiceDiscoveryDetailPage.tsx:9,159,287`; `service-bookings.ts:46-47`; `services.routes.ts:419-463`; `service-offering.service.ts:222-229`.
Bloqueia MTP? **sim (tangibilidade)** · Bloqueia público? **sim** · Bloqueia dinheiro? não · DECISION? não · YALA? não · Modo: **MODO B** · Handoff: **IA-FRONTEND-UX-CONTRATOS**.

**AVAIL-01 — `availability.owner_id` é polimórfico SEM foreign key.**
`(owner_type, owner_id)` sem FK em `owner_id`; integridade só pelo writer (`resolveAvailabilityOwner` fail-closed). DECISION-0146 §6 reconhece e aceita ("0 integridade referencial"). O guard de confirmação re-resolve o provider por JOIN a `service_offerings`, então owner_id pendurado simplesmente não casa provider — mas há risco estrutural de linha órfã se o recurso for deletado out-of-band.
Evidência: `migr 20260530491000:5-7`; `availability-owner-authority.ts:110-131`; `DECISION_0146...md:32`.
Bloqueia MTP? não · público? não · dinheiro? não · DECISION? não · YALA? não · Modo: **MODO B** · Handoff: NONE.

**AVAIL-03 — Reader legado `owner_type='service'` ainda vivo em service-feed (contido).**
`service-feed.plugin.ts:204-216` lê o eixo temporal legado `owner_type='service'`. O guard de conflito só engata para `owner_type='service_offering'` (`unified-availability.service.ts:313-314`) — booking sobre availability legada `service` confirma **sem** o guard cross-oferta de provider. Contido por DECISION-0146 §A.5; caminho canônico (service_offering) é guardado.
Evidência: `service-feed.plugin.ts:204-216`; `unified-availability.service.ts:313-314`.
Bloqueia MTP? não · público? não · dinheiro? não · DECISION? não · YALA? **sim** · Modo: **MODO B** · Handoff: NONE.

**AVAIL-02 / B2-02 — `detect_availability_conflicts` é STUB (no-op).**
Corpo `BEGIN RETURN; END;` — sempre vazio. Chamado só no caminho de **alerta não-bloqueante** `owner_type='user'` (Art. II detect→alerta→humano). **Não** afeta o guard econômico de double-booking (que é o `confirmBookingWithProviderLock`, independente e real). Já sinalizado por DECISION-0146.
Evidência: `migr 20260530491000:61-78`; `unified-availability.repository.ts:769-793`.
Bloqueia? nada · DECISION? não · YALA? não · Modo: **MODO C** · Handoff: NONE.

**B1E2E-01 — Trava de dinheiro do passo 10 é log, não assertiva; `payment_intent` nunca checado.**
`e2e-offer-journey-pre-money.ts:116-117` faz `SELECT count(*) FROM bank_ledger` e só `console.log` — sem `ok(...)` de delta/igualdade e sem checar `payment_intent`. A separação de dinheiro é **estrutural** (a jornada não chama função financeira), mas **não asseverada** pelo teste; uma regressão futura que escrevesse no ledger durante booking passaria silenciosa neste script.
Evidência: `e2e-offer-journey-pre-money.ts:116-117`.
Bloqueia? não · Modo: **MODO B** · Handoff: NONE.

**B1E2E-02 — Fixture reusa atores via `LIMIT 2` — degrada se tenant tiver 1 ator.**
`SELECT id FROM actors WHERE tenant_id=$1 LIMIT 2`; `R = rows[1]?.id || rows[0].id`. Com 1 ator, `P===R` e a dupla inserção OFF(P)/OFF_DRAFT(R) colide com `UNIQUE(provider,canonical)`, e o teste de draft-leak perde sentido. Dependente de seed; não hermético.
Evidência: `e2e-offer-journey-pre-money.ts:58-65`.
Bloqueia? não · Modo: **MODO B** · Handoff: NONE.

**SERVICE-01 — `createOffer` da rota discovery passa `serviceType=SERVICE` sem `canonicalServiceId` → sempre 400.**
`services-discovery.service.ts:348-364` (rota `services-discovery.routes.ts:115`) chama `createService` com `serviceType=SERVICE`, status ACTIVE, **sem** `canonicalServiceId`. Pós F-OFFER-2A/2B, `createService` exige canonical para `service_type='service'` → **400 sempre**. **Não é bypass** (gate fail-closed segura); é caller quebrado/não-migrado — superfície de discovery-offer morta para criação de serviço.
Evidência: `services-discovery.service.ts:348-364`; `services.service.ts:146-150`; `services-discovery.routes.ts:115`.
Bloqueia MTP? não · público? **sim (essa rota)** · dinheiro? não · DECISION? não · Modo: **MODO B** · Handoff: NONE.

**SERVICE-02 — Régua de elegibilidade só cobre `service_type='service'`.**
`assertDeclarationEligibility` + exigência de canonical só disparam quando `effectiveServiceType===SERVICE` (`services.service.ts:145`). `rental/event/job` nascem sem canonical/declaração. Coerente com DECISION-0144 §A.2 (régua é sobre 'service'), registrado para o eixo: a invariante "service nasce de declaração válida" só está provada para o tipo canônico 'service'.
Bloqueia? não · DECISION? não · Modo: **FAST-PATH** · Handoff: NONE.

**DISCOVERY-02 — Filtro residual `s.category_id` em `discoverServices` (não usado como identidade no service-search).**
`services.repository.ts:222-227` ainda suporta filtro por `category_id`, preservado para callers de marketplace tree-navigation; a superfície service-search passa `conceptId` (não categoria). Sem vazamento de identidade-por-categoria no caminho vivo; sinalizado só para não ser confundido com concept-bypass.
Modo: **FAST-PATH** · Handoff: NONE.

**OFFER-DOC-01/02/03 — Resíduos cartoriais cosméticos (não-material).** DECISIONs 0143/0144/0145 com cabeçalho "DOCS-ONLY" mas materializadas em schema+runtime; masthead do `CONSOLIDADO.md:3` carimba HEAD `9f5e9c5e` (atrasado vs `aaeb50b5`); labels de error-code/migration-id abreviados no cartório vs disco. Comportamento material confere; só leitura/higiene. Modo: **FAST-PATH** (parte → IA-BANCO p/ drift de `schema_migrations`).

## 7. Gaps de conexão

* **service_offering ↔ frontend:** camada offering invisível na UI; sem `ServiceOfferingSelector`, sem `by-canonical`, booking por `serviceId` (B2-01).
* **discovery(concept_id) ↔ rota `/discover` ↔ frontend:** repo casa por concept, mas a rota `/discover` e o cliente frontend não transportam `concept_id`/`canonicalServiceId` (B2-01); discovery por concept existe no dado, inalcançável pela superfície.
* **create(service) ↔ rota discovery `createOffer`:** caller legado quebrado (400 sempre) — gap de migração de superfície (SERVICE-01).
* **availability.owner_id ↔ recurso:** sem FK; integridade só no writer (AVAIL-01).
* **eixo legado `owner_type='service'` ↔ guard de conflito:** bookings no eixo legado escapam do guard de provider (AVAIL-03).
* **e2e ↔ invariante de dinheiro:** separação não asseverada por trava executável (B1E2E-01).
* **ativação ↔ confiança/KYB:** flip draft→active sem gate de confiança nem re-check de elegibilidade (ACTIVATION-01 / Caminho A).

## 8. Handoffs para outras IAs

* **IA-FRONTEND-UX-CONTRATOS:** B2-01 — cabear `concept_id`/`canonicalServiceId` na discovery; criar `ServiceOfferingSelector`; consumir `by-canonical`; booking por **offering**, não por service. Backend pronto; falta transporte/superfície.
* **IA-BANCO:** rowcounts/applied-state vivos (unificard_dev, READ-ONLY): (1) `services`/`service_offerings`/`company_concept_publications`/`tenant_concept_offerings` counts (premissa "janela virgem"); (2) `service_offerings` com `service_id` NULL/órfão = 0 + `is_nullable='NO'` + FK `confdeltype='r'`; (3) `services.canonical_service_id` NULL = 0; (4) `availability` por `owner_type` (`service` legado vs `service_offering`) + órfãos de owner_id; (5) `schema_migrations` contém `20260621100000`/`20260621120000` + drift=0; (6) `detect_availability_conflicts` no catálogo vivo ainda = stub; (7) delta de `bank_ledger`/`payment_intent` numa execução do B1.
* **IA-DINHEIRO:** MONEY-OUT-01 — eixo DINHEIRO_FORA confirmado; a cadeia financeira canônica (pré-pago/escrow/release com KYB) é frente própria futura, fora deste eixo. Firewall DECISION-0110 default-OFF.
* **IA-TEMPO:** AVAIL-02/B2-02 — `detect_availability_conflicts` stub (alerta de agenda pessoal `owner_type='user'` nunca dispara); AVAIL-01 owner_id sem FK; conflito = FATO→ALERTA→HUMANO (não auto-resolver).
* **IA-AUTORIDADE:** ACTIVATION-01 — definir o gate de ativação pública (Caminho A): que autoridade/KYB/trust além de `canRepresentActor`; re-check de elegibilidade no flip; tratamento de revogação.
* **IA-SEMANTICA (IA-06):** F-OFFER-4 V2 (re-key de marketplace `/search` por concept) e cabeçalhos DOCS-ONLY×materializado (OFFER-DOC-01) — alinhar narrativa.
* **IA-DECISOES-DT:** OFFER-DOC-01/02/03 — higiene cartorial (cabeçalho docs-only vs materializado; masthead HEAD; labels); AVAIL-03 (contenção do eixo legado) candidata a DT com critério de convergência.
* **IA-EMPRESA-PJ:** confirmação de que ativação PJ (canManageCompany) deve exigir KYB no flip público (cruza ACTIVATION-01).

## 9. Riscos para MTP

* **Bloqueia MTP:** **B2 frontend wiring (B2-01)** — único blocker real de tangibilidade: sem ele o usuário não vê/seleciona offering nem alcança a identidade canônica. O backend causal está fechado e provado (B1).
* **Não bloqueia MTP, mas corrigir:** SERVICE-01 (rota discovery `createOffer` morta, 400); endurecer e2e (B1E2E-01/02); conter eixo legado `service` (AVAIL-03).
* **V2:** re-key de marketplace `/search` por concept (F-OFFER-4 V2); FK/owner-resolver mais forte para availability (AVAIL-01).
* **Cleanup:** `detect_availability_conflicts` stub (AVAIL-02); resíduos cartoriais (OFFER-DOC-01/02/03); filtro `category_id` residual (DISCOVERY-02).
* **Exige decisão de produto/arquitetura:** Caminho A (ativação pública segura, ACTIVATION-01) — antes de público/dinheiro.

## 10. Riscos para público e dinheiro

* **Blockers antes de público:** Caminho A (ativação self-serve-insegura, ACTIVATION-01); B2 frontend (B2-01); SERVICE-01 (superfície discovery-offer morta).
* **Blockers antes de dinheiro:** Caminho A (gate de confiança/KYB na ativação) **e** desenho da cadeia financeira canônica (frente própria IA-DINHEIRO) — money está estruturalmente FORA e em HOLD (firewall 0110).
* **Blockers de frontend:** B2-01 (concept_id no transporte, ServiceOfferingSelector, by-canonical, booking por offering).
* **Blockers de ativação:** ACTIVATION-01 (sem KYB/trust; sem re-check de elegibilidade; revogação não bloqueia).
* **Exigem DECISION:** Caminho A (ativação pública).
* **Devem permanecer HOLD:** dinheiro/payout/split/recovery; ativação pública até Caminho A; re-key marketplace `/search` (V2).

## 11. Veredito final

**FECHA_COM_RISCO.**

A cadeia de oferta backend pré-dinheiro está **materialmente fechada e provada** no HEAD `aaeb50b5`: CONCEPT→SERVICE→SERVICE_OFFERING→DISCOVERY→by-canonical→AVAILABILITY→BOOKING REQUESTED→CONFIRMED→CONFLICT GUARD, cada elo com gate server-side, identidade por `concept_id`, dinheiro fora, e o Caminho B1 e2e exercitando funções reais. As **4 verificações adversariais** confirmaram: oferta nasce draft + não vaza (**CONFIRMED**), service_id NOT NULL + binding por provider/concept (**CONFIRMED**), conflict guard real/atômico/meio-aberto (**CONFIRMED**), e dinheiro-fora estruturalmente verdadeiro (**PARTIAL** — só porque a trava no e2e é log, não assert; a separação no código é total). Os riscos que impedem "público/tangível/dinheiro" são **fora do backend causal**: B2 frontend não cabeado (MTP tangível), Caminho A ativação self-serve-insegura (público/dinheiro), e resíduos contidos (eixo legado `service`, e2e money-assert, rota discovery morta).

## 12. Próxima frente recomendada

**MODO B — `MODO_B_B2_FRONTEND_WIRING`** (com `HANDOFF_FRONTEND` para IA-FRONTEND-UX-CONTRATOS).

Justificativa: o único blocker de **MTP tangível** é o frontend B2 — o backend já conecta e está provado pré-dinheiro, então o maior valor incremental é tornar a cadeia visível/operável ao humano (transportar `concept_id`/`canonicalServiceId`, `ServiceOfferingSelector`, consumir `by-canonical`, bookar por offering). 

**Gate paralelo, antes de público/dinheiro (não antes de MTP):** **`DECISION_ACTIVATION_PUBLICA`** (Caminho A) — define o gate de ativação segura (KYB/trust + re-check de elegibilidade + revogação). MTP pode avançar com ofertas em escopo controlado; público/dinheiro exigem Caminho A primeiro. Dinheiro permanece **HOLD_FINANCEIRO** (handoff IA-DINHEIRO).

## 13. Resumo executivo

* HEAD vivo `aaeb50b5` (revalidado 1ª mão; cartório masthead atrasado em `9f5e9c5e`, corpo correto).
* Cadeia de oferta backend pré-dinheiro **FECHA e está provada** ponta-a-ponta (Caminho B1, funções reais) — F-OFFER-0→6 todas CONFIRMADAS no código/schema vivo.
* `createOffering` exige service válido (mesmo provider+concept), `service_id` NOT NULL+FK RESTRICT, nasce **draft**, company server-side, professional do body anulado — **gap que eu reportei em HEAD anterior está fechado**.
* Discovery casa por `concept_id` (categoria→concept leaf-only); `by-canonical` é active-only; **draft não vaza** (verificado adversarialmente).
* Conflict guard de provider é **real e atômico** (advisory lock, intervalo meio-aberto): overlap mesmo provider bloqueia, back-to-back e provider-distinto liberam.
* **Dinheiro FORA** do eixo (DINHEIRO_FORA): nenhuma chamada a ledger/payment/payout/split; firewall 0110 default-OFF. Ressalva: o e2e só *loga* o ledger, não asservera (B1E2E-01).
* **Blocker de MTP = B2 frontend** (descobre por category texto-livre, sem concept_id, sem ServiceOfferingSelector, booka por service) → IA-FRONTEND-UX-CONTRATOS.
* **Ativação draft→active = self-serve-insegura** (ACTIVATION-01): sem KYB/trust, sem re-check; bloqueia público/dinheiro → Caminho A é DECISION.
* Resíduos contidos: rota discovery `createOffer` morta (400, fail-closed); eixo legado `owner_type='service'` sem guard; `detect_availability_conflicts` stub; availability.owner_id sem FK.
* **Veredito: FECHA_COM_RISCO** · Próxima frente: **MODO_B_B2_FRONTEND_WIRING** + (antes de público/dinheiro) **DECISION_ACTIVATION_PUBLICA**; dinheiro HOLD.
* Prova-viva de rowcounts/applied-state/drift → **IA-BANCO** (§8); não obtida em auditoria de disco READ-ONLY.

---
*Auditoria READ-ONLY. Nenhum código/migration/cartório/runtime alterado. Insumo para IA-DIRETORA/Clayton — não é GO. Carimbo HEAD `aaeb50b5`, 2026-06-21.*
