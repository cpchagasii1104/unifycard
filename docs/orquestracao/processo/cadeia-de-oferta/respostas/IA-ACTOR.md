# IA-ACTOR — respostas (append-only)

> Especialista READ-ONLY do eixo identidade/representação do actor. Escreve só aqui + a própria memória.
> Carimbo obrigatório por resposta. Disco vence narrativa.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS · IA-ACTOR

**(1) HEAD no momento:** `9f5e9c5e` (branch `rescue-structural`).
⚠️ O gatilho citou `dd270f41`; o **HEAD vivo é `9f5e9c5e`** (avançou). Revalidei contra o vivo — **disco venceu**.
**(2) Revalidou no disco/banco:** **PARCIAL** — código/migrations lidos de 1ª mão (disco); **existência/rowcount/RLS no banco vivo = INCONCLUSIVE → IA-BANCO** (sou read-only de código, não tenho prova-viva de `to_regclass`/contagem).
**(3) Arquivos/migrations lidos 1ª mão:**
- `backend/src/core/profile/professional-c1/professional-c1.routes.ts` (completo) · `.service.ts` (completo)
- `backend/migrations/20260530579000_create_actor_professional_substrate.sql` (FKs)
- `backend/src/modules/social/actor.utils.ts:1-111` (`resolveActiveActorFromRequest`)
- `backend/migrations/20260611150000_canonical_variants_services_units_foundation.sql` (`canonical_services.concept_id`)
- `backend/migrations/20260611180000_offerings_variant_sku_service.sql` (`service_offerings`)
- `backend/migrations/20260418120000_services_table_core.sql` (`services.actor_id`)
- `backend/src/core/profile/profile-professional.routes.ts` (legado 501)
- `backend/src/core/categories/categories.service.ts:1259-1280` + `categories.routes.ts:770-816` (assign-skill VIVO)
- `backend/src/core/actor-registry/actor-registry.service.ts` (`capabilities_json`)
- Grep: `actor_capabilities` (tabela pura) = **inexistente**; só `actor_capability_grants`.

---

### (4) MATRIZ — superfícies onde o actor declara "eu faço isso" (eixo IA-ACTOR)

| SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT ou READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO |
|---|---|---|---|---|---|---|---|---|---|
| `POST /profile/professional/c1/concepts` | "tenho competência no concept X" (skill_level, years) | `professionalC1Service.declareConcept` → `actor_professional_concepts` | **SSOT declarativo** (não-comercial) | **actor_id** (FK `actors`); 1:N por actor | **SIM** — `concept_id` FK `concepts(concept_id)` NOT NULL (Lei 7) | `canRepresentActor(tenant,userId,actorId)` server-side (service:66-76) fail-closed 403 | n/a (PROIBIÇÕES §5: zero availability) | baixo — canônico, actor-first, sem preço | **É o SSOT correto de "eu faço isso" actor-first.** Manter como âncora. |
| `PUT /profile/professional/c1/bio` | bio profissional (texto livre) | `upsertBio` → `actor_professional_profiles` | SSOT (apresentacional) | actor_id; 1:1 | não (texto) | mesmo gate canRepresentActor | n/a | baixo | OK — bio ≠ capability; não é descoberta. |
| `GET /profile/professional/c1` | leitura das competências+bio | read-only (`listActiveConcepts`/`getProfile`) | read | actor_id | — | canRepresentActor antes de ler | — | **nenhum** — "leitura NUNCA cria" (service:91) | OK — GET não cria actor/capacidade. |
| 🔴 `POST /categories/assign-skill` | "tenho skill na categoria Y" + **hourly_rate + pricing_type** | `categoriesService.assignSkillToUser` → **`user_skills_categories`** (categories.service:1271) | **VERDADE PARALELA** (substrato legado) | **global_user_id** (NÃO actor_id — bypassa a camada actor) | **NÃO direto** — `category_id` (concept é breadcrumb da category) | **sem `canRepresentActor`** — escreve por `globalUserId` do req (não actor-gated) | n/a | **ALTO** — (a) 2º substrato de "eu faço isso"; (b) **preço no lugar errado** (`hourly_rate` na skill, não em `service_offerings`); (c) global_user_id-keyed fura o actor-first; (d) category, não concept | **BLOQUEAR p/ F-OFFER** — não ler discovery daqui; conter/convergir antes. Prova-viva tabela viva? → IA-BANCO |
| `GET/POST /profile/professional` (legado) | — | — | **501 contido** (`PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED`) | — | — | — | — | nenhum (morto-por-rota) | Verdade paralela **neutralizada na borda**; C1 é o substituto. OK. |
| `POST /authority/grants` | "concedo capability operacional (calendar:block, services:create…) a outro actor" | `actorCapabilityGrantService.grant` → `actor_capability_grants` | SSOT (autoridade, **dormant**) | grantee_actor_id / scope_actor_id | não (capability_key `domain:action`) | concedente exige `canRepresentActor(scope_actor_id)` | valid_until | médio (eixo vizinho) | **NÃO é "eu faço isso"** — é "posso operar". **Eixo IA-AUTORIDADE.** Não confundir com capacidade de serviço. |
| `actor_registry.capabilities_json` (`getDefaultCapabilities`) | capability **de módulo** (ex.: `can_manage_marketplace` p/ toda company) | `actorRegistryService` (seed por tipo) | read-model/seed | actor_id (entity) | não | — | — | **armadilha** — default amplo ≠ autoridade sobre alvo ≠ "faz serviço X" | Não usar como prova de "faz concept X" nem de autoridade. |
| `resolveActiveActorFromRequest` / `getActiveActor` | resolve **qual actor age** (não declara capacidade) | — (leitura via `findById`); fallback `ensureUserActor` | resolver | actor ativo | — | header/query `x-actor-id`/`actor_id` → `assertActorRepresentable`→`canRepresentActor` (utils:18-33,77,93); fallback **self-only** deriva de `req.user` | — | baixo — único create-path é `ensureUserActor` **self/idempotente** (utils:102-104), só se `allowUserFallback:true` | OK; vigiar que GETs não passem `allowUserFallback:true` (cria o user-actor do próprio caller — não IDOR, mas write-in-read). |
| `services` / `service_offerings` (ponte oferta) | "sou descobrível"/"vendo este pacote" | IA-OFERTA | SSOT descoberta/contratação | `services.actor_id` / `service_offerings.provider_actor_id` | **SIM via `canonical_services.concept_id`** (NOT NULL, 0117 D) | `canRepresentActor(provider_actor_id)` | `unified_availability owner_type='service_offering'` | — (eixo IA-OFERTA) | **Fronteira:** ancorado em concept_id — convergente. Detalhe = IA-OFERTA. |

---

### (5) VEREDITO: **PARTIAL** (com 1 bloqueador de convergência nomeado)

**Por quê PARTIAL e não PASS:**
1. ✅ **A cadeia canônica actor-first existe e é correta:** "eu faço isso" → `actor_professional_concepts.concept_id` → `concepts` (actor-keyed, canRepresentActor-gated, **sem preço**, GET não cria). A espinha semântica `concept_id` é **compartilhada** com a oferta (`canonical_services.concept_id` NOT NULL → `service_offerings`). Não há freeform de profissão na cadeia canônica; o legado de string foi para 501.
2. 🔴 **Mas há verdade paralela VIVA** (`user_skills_categories` via `POST /categories/assign-skill`) que responde à MESMA pergunta ("este humano faz skill Y") por **global_user_id** (fura o actor), com **preço embutido** (`hourly_rate`), keyed por **category** (não concept), **sem `canRepresentActor`**. Enquanto viva, F-OFFER teria DOIS SSOTs de capacidade.
3. ⚠️ **Falta decisão de ponte (não é bug, é vácuo de produto):** declarar competência profissional (`actor_professional_concepts`) **NÃO** cria automaticamente `services`/`service_offering` — são atos separados (por desenho: professional-c1 §5 proíbe oferta). Antes de F-OFFER, Clayton/DIRETORA precisa decidir **se** e **como** "declarei concept X" vira "sou descobrível em X" — sem auto-criar travessia entre substratos por acidente.

**INCONCLUSIVE** sobre existência/rowcount/RLS no banco vivo (não alcanço read-only) → IA-BANCO.

---

### (6) VERDADES PARALELAS (lista)

1. 🔴 **CAPACIDADE/SKILL:** `actor_professional_concepts` (C1, actor_id, concept_id, sem preço, gated) **×** `user_skills_categories` (legado VIVO via `/categories/assign-skill`, global_user_id, category_id, **com hourly_rate/pricing_type**, sem gate de actor). Duas respostas para "este humano faz isso". **A pior:** a legada carrega preço + fura o actor.
   - Consumidores vivos da legada: `categories.service.ts:1271` (write), `profile-professional.service.ts` (read/update/delete — mas rota 501 → dead-via-route), `human-mvp-matching.service.ts:61` (read — human-mvp é SCHEMA-GHOST/contido R8N). → confirmar liveness da tabela: **IA-BANCO**.
2. ⚠️ **PREÇO:** `user_skills_categories.hourly_rate` (preço na skill) **×** `service_offerings.price_cents` BIGINT (preço faturável canônico). Preço pertence só à oferta.
3. ⚠️ **VOCABULÁRIO DE "O QUE FAZ":** `concept_id` (C1/canonical_services) **×** `category_id` (assign-skill). Lei 7: identidade vem de concept, não de category (category = breadcrumb).
4. ℹ️ **EIXOS VIZINHOS (não são "eu faço isso", não confundir):** `actor_capability_grants` (capability operacional, IA-AUTORIDADE) e `actor_registry.capabilities_json` (capability de módulo) — ortogonais à capacidade de serviço.

---

### (7) STOPs para F-OFFER

- **NÃO** ler descoberta/oferta de `user_skills_categories` — é legado global_user_id-keyed com preço no lugar errado. O SSOT actor-first de "eu faço isso" é `actor_professional_concepts.concept_id`.
- **NÃO** tratar `category_id` como identidade de capacidade — usar `concept_id` (Lei 7; category é breadcrumb).
- **PREÇO só em `service_offerings.price_cents` (BIGINT)** — nunca na camada de skill/capability.
- **NÃO auto-criar** `services`/`service_offering` a partir do perfil profissional (travessia entre substratos sem decisão = verdade paralela nova + side-effect). A ponte "declarei → sou descobrível" é **decisão de produto pendente** (DIRETORA/Clayton).
- **NÃO** usar `actor_capability_grants`/`capabilities_json`/`can_manage_marketplace` como prova de "faz concept X" — são autoridade/módulo, não capacidade de serviço.
- **Todo write que declara capacidade de um actor passa por `canRepresentActor`** — `assign-skill` (global_user_id, sem gate de actor) viola isso; conter/convergir antes de F-OFFER.
- **GET não cria actor/capacidade** — manter; auditar que rotas de leitura de F-OFFER não passem `allowUserFallback:true` em `resolveActiveActorFromRequest`.
- **Manter separação actor_type** — `userActor`/`pageActor`/`groupActor` nascem só pelo writer único (`ensureUserActor`/`ensurePageActor`/`ensureGroupActor`); `ActiveActor` é unificado e discriminado por `actor_type`, não colapsado. F-OFFER não deve inferir company-actor a partir de user-actor sem `canManageCompany`.

---

### Prova-viva pendente → IA-BANCO (encaminho, não alcanço read-only)

1. `to_regclass('user_skills_categories')` existe no banco vivo? rowcount? (O SELO_A3_2 diz substrato legado AUSENTE, mas `/categories/assign-skill` ainda escreve — se ausente, a rota 500a 42P01; se viva, é verdade paralela ativa.)
2. `to_regclass('actor_professional_concepts')` / `actor_professional_profiles` + rowcount + RLS.
3. `canonical_services`/`services`/`service_offerings` vivos + força da FK `concept_id`/`canonical_service_id` (RESTRICT confirmado no disco; confirmar aplicado).
4. `POST /categories/assign-skill` é alcançável (rota montada) hoje? (montagem do plugin `categories.routes`).

**Fronteira:** IA-OFERTA (services/offerings/publications) · IA-AUTORIDADE (grants/capabilities/canManageCompany) · IA-SEMANTICA (concept/category, Lei 7) · IA-TEMPO (availability owner_type) · IA-BANCO (prova-viva). **IA-DINHEIRO fora** (preço aqui é só localização de SSOT, não liquidação).

**Status: RESPONDIDO** — VEREDITO PARTIAL; banco-vivo INCONCLUSIVE → IA-BANCO. Insumo READ-ONLY, não GO. Nenhuma edição de código/schema/cartório.

*Carimbo: HEAD `9f5e9c5e` · branch `rescue-structural` · 2026-06-20 · revalidação de 1ª mão (disco). Fonte soberana: DECISION-0113 (canRepresentActor/5 canais), DECISION-0117 (canonical_services concept_id), Lei 7 (identidade=concept), SELO_A3_2_PROFISSIONAL_C1, professional-c1 Contrato A1.*

---

## F-OFFER-2 — READ-FIRST curto: ponte declaração→service · IA-ACTOR

**Carimbo:** HEAD vivo **`4431b8fc`** (branch `rescue-structural`) · 2026-06-21 · revalidou no disco: **SIM (1ª mão)**; banco vivo (rowcount/FK aplicada/RLS): **INCONCLUSIVE → IA-BANCO**.
**Lidos 1ª mão:** `company-publications.service.ts` (completo) · `migrations/20260604140000_create_company_concept_publications.sql` (FKs) · `professional-c1.routes.ts`/`.service.ts` (RODADA 7) · `services.service.ts:35-60` (`createService`) · `services.routes.ts:5-45` (POST gate) · CONSOLIDADO F-OFFER §D2/D3 + F-OFFER-1 CLOSED.
**Nota de re-baseline:** minha verdade-paralela viva da RODADA 7 (`POST /categories/assign-skill`) **já foi CONTIDA** por F-OFFER-1 (commit `d9dcb1ef` → 501 `ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING`). Não reabre aqui.

**PERGUNTA:** como PF e PJ declaram "eu faço isso" hoje, e o que falta para a declaração ser ELEGÍVEL a virar `service` descobrível.

### (1) Superfície de declaração PF + gate
- **Superfície:** `POST /profile/professional/c1/concepts` → `professionalC1Service.declareConcept` → **`actor_professional_concepts`** (actor_id + **concept_id** FK `concepts`; skill_level/years; soft-delete).
- **Gate:** `canRepresentActor(tenant, userId, actorId)` server-side, fail-closed 403 (service:66-76) + invariante actor_id==id. `actionContext.actorId` é HINT.
- **Subject/Owner:** subject = `req.user.userId` (autenticado) · owner = `actorId` (o actor PF declarado, representável pelo subject).
- **Onde PARA:** PROIBIÇÕES explícitas (service:5) — "zero preço/oferta/availability/capability". A declaração **NÃO projeta** para `services` nem `tenant_concept_offerings`. Fim de linha no substrato declarativo.

### (2) Superfície de declaração PJ + gate
- **Superfície:** `publishCompanyConcept` (companies.routes → `companyPublicationsService`) → **`company_concept_publications`** (company_id + page_actor_id + **concept_id** FK `concepts`; status active/retired).
- **Gate (4 camadas server-side, DECISION-0099/0100/0101):** (a) **`canManageCompany`** via company_users (service:41); (b) empresa operacional `primary_company_type_id`+`primary_concept_id` NOT NULL (174); (c) **concept === `primary_concept_id`** (MVP D4, 179); (d) **KYB approved** `evaluatePageActorKybApproved(pageActorId)` (185). + page-actor deve existir (não cria, 184) + actor humano de auditoria deve existir (não cria/cura, 192).
- **Subject/Owner:** subject = `responsibleUserId`+`globalUserId` (req.user) · owner = **page-actor da empresa** (DECISION-0097 D7) · created_by = actor humano (auditoria).
- **Onde PARA:** publish **JÁ projeta** em `tenant_concept_offerings` (read-model derivado, D10, service:77/230) — mas isso é **tenant×concept**, NÃO um `services` (actor×capacidade descobrível). Não cria `services`. Fim de linha no substrato de publicação + sua projeção read-model.

### (3) GAP exato declaração→service
**O que EXISTE:** criar `service` (`createService`, services.service:55 / route:35) exige hoje **só**: actorId HINT + **`canRepresentActor`** fail-closed 403 + identidade canônica (DECISION-0117). **Zero referência** a `actor_professional_concepts` ou `company_concept_publications` no gate.
**O que FALTA (= a ponte D3):** o gate de criação de `service` **NÃO verifica declaração/capacidade anterior**. D3 exige `concept_id canônico + autoridade server-side + declaração prévia`; os dois primeiros existem, **o terceiro está AUSENTE**. Faltam, concretamente:
- **(a) Gate de elegibilidade** em `createService`: provar que o `actorId` (PF) tem `actor_professional_concepts` **active** para o concept — OU que a empresa (PJ) tem `company_concept_publications` **active** para o concept — antes de permitir o `service`.
- **(b) Regra de mapeamento concept↔service:** a declaração é keyed por **`concept_id` direto**; `services`/oferta são keyed por **`canonical_service_id`→concept_id**. A ponte precisa da regra "o concept declarado ⊇ o concept por trás do canonical_service do service". Esse mapeamento/eligibilidade **não existe**.
- **(c) Assimetria PF×PJ a decidir (produto, não meu):** PJ carrega **KYB approved**; PF carrega só representação+declaração. Se "ter service descobrível" exige análogo de verificação para PF é **decisão de Clayton** — não infiro.

### (4) Subject/Owner por caso (resumo)
| Caso | Subject (autentica) | Owner (dono) | Gate vivo hoje | Projeta p/ discovery? |
|---|---|---|---|---|
| Declaração PF | `req.user.userId` | actor PF (`actorId`) | `canRepresentActor` | **NÃO** (para no substrato) |
| Declaração PJ | `req.user` (globalUserId) | page-actor da empresa | `canManageCompany` + KYB + operacional + concept==primary | parcial: `tenant_concept_offerings` (read-model tenant×concept), **NÃO `services`** |
| Criar `service` | `req.user.userId` | actor (`actorId`) | `canRepresentActor` **apenas** | é o `services` (descoberta) — mas **sem checar declaração** |

### VEREDITO: **FALTA_X**
- **Substratos de declaração = PRONTO_P/_PONTE:** PF (`actor_professional_concepts`, concept-keyed, `canRepresentActor`) e PJ (`company_concept_publications`, concept-keyed, `canManageCompany`+KYB) existem, são gateados corretamente e carregam o `concept_id` necessário para a elegibilidade. São fonte confiável para a ponte.
- **X (o que falta) = a ponte em si:** o gate de elegibilidade em `createService` (verificar declaração active do mesmo concept) **+** a regra de mapeamento `concept_id`(declaração) ↔ `canonical_service.concept_id`(service). Hoje `createService` só prova representação — não capacidade declarada. É exatamente o escopo do F-OFFER-2; ainda não materializado.

**Prova-viva → IA-BANCO (3º elo):** rowcount vivo de `actor_professional_concepts` / `company_concept_publications` / `services` (CONSOLIDADO reporta 1/0/0 — confirmar); FK `actor_professional_concepts.concept_id→concepts` está **NO ACTION** (disco) — confirmar aplicado e se há plano de RESTRICT; RLS dos dois substratos.

**Fronteira:** IA-OFERTA (services/service_offerings/tenant_concept_offerings — o destino da ponte) · IA-AUTORIDADE (canManageCompany/KYB são dela; eu trato canRepresentActor) · IA-SEMANTICA (concept↔canonical_service, Lei 7) · IA-BANCO (prova-viva). **IA-DINHEIRO fora.**

**Status: RESPONDIDO** — VEREDITO FALTA_X (substratos prontos; ponte ausente). READ-ONLY, zero edição de código/schema/cartório. Insumo, não GO.

*Carimbo: HEAD `4431b8fc` · branch `rescue-structural` · 2026-06-21 · 1ª mão. Fontes: DECISION-0099/0100/0101 (publicação PJ/KYB), DECISION-0097 D7 (page-actor owner), DECISION-0113 (canRepresentActor), DECISION-0117 (canonical_services), DECISION-0143/F-OFFER §D2/D3, Lei 7.*
