# IA-OFERTA — respostas (append-only)

> Especialista READ-ONLY do eixo descoberta/oferta. Escrevo só neste arquivo + minha memória.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS (auditoria READ-ONLY)

**(1) HEAD vivo:** `9f5e9c5e` · branch `rescue-structural` · último commit `feat(semantic): seed needs-graph pilot 'festa-de-casamento' + folha-SSOT invariant (U1b / DECISION-0142)`.
**⚠️ O hash citado no INBOX (`dd270f41`) está STALE** — revalidei de 1ª mão via `git rev-parse`; o vivo é `9f5e9c5e` (5 commits à frente; U1b/0142 já no disco).

**(2) Revalidou no disco/banco:** **parcial** — disco de 1ª mão SIM (migrations + services/código de writer/discovery, de 1ª mão); **banco vivo NÃO alcanço read-only** (rowcounts, `to_regclass`, FK efetiva, se as tabelas paralelas têm dados) → **INCONCLUSIVE → IA-BANCO** (probe da Rodada 2 item 6 ainda aberto).

**(3) Arquivos/tabelas lidos (1ª mão):**
- `backend/migrations/20260611150000_canonical_variants_services_units_foundation.sql:116-138` (`canonical_services`, `concept_id` NOT NULL) + `:186-188` (`ALTER services ADD canonical_service_id` nullable).
- `backend/migrations/20260611180000_offerings_variant_sku_service.sql:66-84` (`service_offerings`).
- `backend/migrations/20260616230000_align_service_money_nomenclature_07.sql:112` (`ALTER services price_cents INTEGER→BIGINT`).
- `backend/migrations/20260418120000_services_table_core.sql` (`services` core; sem `concept_id`).
- `backend/migrations/20260604140000_create_company_concept_publications.sql` · `backend/migrations/0072_tenant_concept_offerings.sql`.
- `backend/migrations/20260530579000_create_actor_professional_substrate.sql:53-78` (`actor_professional_concepts`, `concept_id` NOT NULL).
- `backend/src/modules/services/service-offering.service.ts` (writer canônico) · `services.repository.ts` (legado, `discoverServices` by category) · `services-discovery.service.ts:305-322` (gate por `metadata->>'domain'='servicos'`).
- `backend/src/core/companies/company-publications.service.ts` (writer PJ gated + projeção read-model in-tx).
- `backend/src/modules/human-mvp/human-mvp-service-offer.service.ts` · `human-mvp-matching.service.ts:45-95` (parallel offer/match by `category_id`).
- `backend/src/app.builder.ts:520-560` (mounting: `/services` offerings + `/services` legado + `/marketplace` canonical + `/human-mvp` todos LIVE).
- DECISION-0142 (folha-SSOT; discovery casa por concept_id, nunca domain).

---

### (4) MATRIZ

| SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT / READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE | TEMPO | RISCO | RECOMENDAÇÃO |
|---|---|---|---|---|---|---|---|---|---|
| **`actor_professional_concepts`** | "este actor FAZ este concept" (PF/prestador) | `professional-c1.repository` | **SSOT** (capacidade actor-first) | `actor_id` | **SIM** NOT NULL → `concepts` | gated (achado IA-ACTOR; sem preço) | — | offer writer NÃO o consulta | **vira o gate de capacidade do F-OFFER** |
| **`company_concept_publications`** | "esta PJ FAZ concept Z" | `company-publications.service` | **SSOT** publicação PJ | `company_id`/`page_actor_id` | **SIM** NOT NULL | `canManageCompany`+KYB approved+`concept===primary_concept_id` | — | baixo | manter SSOT de capacidade PJ |
| **`tenant_concept_offerings`** | "tenant oferece concept" (discovery) | `company-publications.service` (projeção in-tx) | **READ-MODEL** derivado | `tenant_id` | SIM (derivado) | herdada do writer | — | baixo (já read-model; reconcilia) | nunca escrever direto; permanece projeção |
| **`canonical_services`** | identidade material do serviço | curadoria (`canonical-service.service`) | **SSOT** identidade | global/tenant | **SIM** NOT NULL → `concepts` | curadoria humana (status `active`) | — | baixo | espinha concept→oferta |
| **`service_offerings`** | "este actor VENDE este pacote" | `service-offering.service.createOffering` | **SSOT** contratável | `provider_actor_id` (+`company_id?`) | **SIM** via `canonical_service_id` NOT NULL | `canRepresentActor` ✓ | `unified_availability` owner=`service_offering` ✓ | **NÃO verifica se o provider DECLAROU o concept** (sem FK/check p/ `actor_professional_concepts`/publications) | F-OFFER: exigir declaração de capacidade antes de ofertar |
| **`services`** (legado) | "actor publica serviço p/ descoberta" | `services.repository.create` | índice de descoberta (SSOT-ish, concept-OPCIONAL) | `actor_id` | **OPCIONAL** (`canonical_service_id` nullable; `discoverServices` filtra por `category_id`) | blindagem `actorId` obrigatório; gate de autoridade na camada service | `city/state/category`, sem tempo canônico | **descoberta concept-blind por `category_id`**; `price_cents` próprio (BIGINT após `20260616230000`) | tornar `canonical_service_id` obrigatório OU rebaixar a read-model do offering |
| **`human_mvp_service_offers`** | "person oferece skill" | `human-mvp-service-offer.service` | **SSOT PARALELO** (oferta) | `person_id` = `global_user_id` | **NÃO** (`category_id`) | `tenantContextPermission.hasWriteAccess` (tenant-level, **NÃO** `canRepresentActor`) | — | **ALTO**: verdade paralela, sem actor/concept/autoridade-actor, LIVE em `/human-mvp` | congelar/quarentenar; decisão de convergência de Clayton |
| **`user_skills_categories`** | "person tem skill + `hourly_rate`" | `categories`/`profile-professional` (`assign-skill`) | **SSOT PARALELO** (capacidade) | `global_user_id` | **NÃO** (`category_id`) | sem `canRepresentActor` (achado IA-ACTOR) | — | **ALTO**: preço (`hourly_rate`) em lugar errado; capacidade paralela | convergir p/ `actor_professional_concepts` |
| **`services-discovery.service`** (createOffer/discovery + RFQ) | descoberta/oferta por categoria | `services-discovery.service` | superfície de descoberta | `actor_id`/actionActor | **NÃO** (`category_id` + `metadata->>'domain'='servicos'`) | gate na camada service | request/RFQ | **viola invariante 0142** (filtra por domain/category) | re-chavear descoberta por `concept_id` |

---

### Respostas às 5 perguntas focais (+ costura IA-ACTOR)

**1. Cadeia de oferta confirmada — parcialmente.** `services` é keyed por `actor_id` (+`tenant_id`), tem `canonical_service_id` **nullable** (liga a concept só opcionalmente, via `canonical_services.concept_id`), e sua descoberta (`discoverServices`) filtra por `category_id` — é "índice de descoberta legado", concept-opcional. `service_offerings` (`provider_actor_id`, `price_cents` BIGINT) é o "pacote concreto contratável", ligado ao concept **obrigatoriamente** via `canonical_service_id` NOT NULL → `canonical_services.concept_id` NOT NULL. **Mas são DOIS caminhos**: a oferta canônica NÃO popula `services.service_id` (DECISION-0122) e não depende de `services`.

**2. PONTE — AUSENTE (costura crítica não existe).** `service-offering.service.createOffering` (`:97-117`) exige `canRepresentActor(provider)` + `canonicalServiceService.requireActiveForTenant(canonicalServiceId)`. **Não há NENHUMA verificação de que o provider DECLAROU o concept** em `actor_professional_concepts` (nem em `company_concept_publications`). Não há writer que crie `services`/offering a partir da declaração profissional — são **100% separados**, unidos só por `actor_id` coincidente e pelo `concept_id` que ambos referenciam por caminhos distintos. **A costura "declarei → sou descobrível/vendo" NÃO existe materialmente.** É exatamente o gap que o F-OFFER tem que fechar.

**3. `company_concept_publications` + `tenant_concept_offerings` — reconciliam (NÃO criam verdade paralela).** A publicação PJ é **SSOT** (concept_id, KYB-gated, `canManageCompany`); `tenant_concept_offerings` é **read-model** projetado **dentro da transação** do writer (`projectOfferingActive`/`refreshOfferingAfterRetire`, `company-publications.service:77-103`) — atomicidade SSOT↔projeção. **Não inverteram.** São o eixo PJ da mesma verdade concept-keyed, paralelo (não conflitante) ao eixo PF (`actor_professional_concepts`). As verdades paralelas REAIS estão no eixo `human_mvp_*`/`user_skills_categories`, não aqui.

**4. SIM — oferta/serviço sem `concept_id`, e categoria substituindo concept, e preço em lugar errado.** (a) `services` pode existir com `canonical_service_id` NULL (concept-less). (b) `human_mvp_service_offers` e `user_skills_categories` usam `category_id`, **nunca** `concept_id`. (c) **Preço fora de `service_offerings.price_cents`**: `services.price_cents` (BIGINT, indicativo) **e** `user_skills_categories.hourly_rate` (preço de capacidade no lugar errado). Faturável canônico continua sendo só `service_offerings.price_cents`.

**5. Discovery NÃO casa por `concept_id` nas superfícies em uso — viola DECISION-0142.** `services.repository.discoverServices` filtra por `category_id`; `services-discovery.service:314` exige `metadata->>'domain'='servicos'`; `human-mvp-matching:68,94` casa por `category_id`. O único caminho concept-bound (`service-offering.service.listActiveBycanonicalService`, por `canonical_service_id`) é "listar ofertas de um canônico já conhecido", **não** um entrypoint de busca por capacidade. **Não há discovery vivo que case provider por `concept_id`.**

---

### (5) VEREDITO: **BLOCKER** (para F-OFFER-como-convergência)

A espinha canônica concept-keyed existe e está limpa e gateada (`actor_professional_concepts.concept_id` NOT NULL · `canonical_services.concept_id` NOT NULL · `service_offerings` via `canonical_service_id` NOT NULL + `canRepresentActor` + tempo só em `unified_availability`). **Porém F-OFFER não pode abrir como convergência limpa** porque: (a) **2 SSOTs paralelos LIVE-mounted** (`human_mvp_service_offers` + `user_skills_categories`), category-keyed, global_user_id-keyed, sem autoridade-actor; (b) **costura "declarei → vendo" ausente** (offer writer não consulta capacidade declarada); (c) **discovery viola o invariante 0142** (category/domain). Resolver (a) e (c) são **decisões de Clayton** (convergir vs quarentenar), não execução mecânica → **BLOCKER até a decisão**.

### (6) Verdades paralelas (capacidade/oferta do mesmo fato)
1. `human_mvp_service_offers` (oferta paralela; person/skill/category; tenant-permission; **LIVE** `/human-mvp`).
2. `user_skills_categories` (capacidade paralela; global_user_id/category/`hourly_rate`; sem canRepresentActor) — **mesma família** apontada pela IA-ACTOR.
3. `services` legado (descoberta concept-opcional por `category_id`) coexistindo com `service_offerings` (concept-obrigatório) — **dois eixos de "vende"** sob a MESMA rota `/services` (`app.builder:522-556`).
4. `services-discovery.service` (oferta/descoberta por domain/category) — 4º eixo de descoberta concept-blind.
- _(Não-paralelo, reconciliado: `tenant_concept_offerings` = read-model de `company_concept_publications`.)_

### (7) STOPs para F-OFFER
- **NÃO** abrir F-OFFER como "convergência limpa" sem decisão de Clayton sobre `human_mvp_*` e `user_skills_categories` (congelar/migrar/quarentenar) — risco RISCO Nº1 do MÉTODO (verdade paralela).
- **NÃO** deixar `service_offerings` ofertar concept que o provider não declarou — a costura tem que passar por `actor_professional_concepts` (PF) / `company_concept_publications` (PJ).
- **NÃO** chavear discovery por `domain`/`category_id` (`services-discovery:314`, `discoverServices`, `human-mvp-matching`) — DECISION-0142 exige `concept_id`. Re-key é fatia própria.
- **NÃO** introduzir 3º lugar de preço — faturável só `service_offerings.price_cents` (BIGINT); `services.price_cents`/`hourly_rate` são indicativos/legados, nunca liquidam.
- **NÃO** tornar `tenant_concept_offerings` escrevível fora do projetor; permanece read-model.
- BLINDAGEM: nenhuma superfície crava fornecedor — discovery filtra/ordena/propõe; quem casa é o humano.

### Prova-viva pendente → INCONCLUSIVE → IA-BANCO
`to_regclass`/rowcount de `services`/`service_offerings`/`company_concept_publications`/`tenant_concept_offerings`/`human_mvp_service_offers`/`user_skills_categories`; quantas linhas de `services` têm `canonical_service_id` NULL; FK efetiva (forte/SET NULL); drift `schema_migrations`×disco. (Rodada 2 item 6 ainda aberto.)

### Correção à minha §14.12 (re-baseline)
Em §14.12 declarei `services.price_cents = INTEGER`. **STALE** — a migration `20260616230000_align_service_money_nomenclature_07.sql:112` alterou para **BIGINT** (alinhamento 07 §4.7). O STOP "faturável SEMPRE `service_offerings.price_cents`" permanece — `services.price_cents` segue indicativo de descoberta, não liquida.

**Carimbo:** HEAD `9f5e9c5e` · revalidou no vivo: parcial (disco 1ª mão / banco→IA-BANCO) · fonte: `arquivo:linha` acima + DECISION-0117/0122/0142/0099/0100 · **Status: RESPONDIDO** (VEREDITO BLOCKER; prova-viva de banco INCONCLUSIVE encaminhada à IA-BANCO).

— **IA-OFERTA**, sob coordenação da IA-DIRETORA.

---

## F-OFFER-3 — READ-FIRST curto (service → service_offering)

**HEAD vivo:** `74a04819` · branch `rescue-structural` · último commit `docs(orchestration): version IA-DIRETORA doc-system`. ⚠️ O HEAD `dd270f41` do gatilho e o `9f5e9c5e` do CONSOLIDADO estão STALE — revalidei `74a04819` de 1ª mão (`git rev-parse`).
**Revalidou no vivo:** parcial (disco/código de 1ª mão SIM; banco vivo → IA-BANCO). **READ-ONLY, zero edição.**
**Fontes:** `service-offering.service.ts:83-135` · `service-offerings.routes.ts:11-67` · migration `20260611180000_offerings_variant_sku_service.sql:66-90` · DECISION-0143 §A/§C/§D · DECISION-0144 §A/§C · CONSOLIDADO F-OFFER-2 (`d2cf007c`).

### (1) Como `createOffering` nasce + gate + campos (vivo)
- **Entry:** `POST /services/offerings` (`service-offerings.routes.ts:37`). `userId` = `req.user.userId` **server-side** (401 se ausente).
- **Gate ÚNICO:** `canRepresentActor(tenantId, userId, providerActorId)` (`service.ts:97`). **NÃO** chama `canManageCompany`; **NÃO** checa declaração/publicação; **NÃO** reusa a elegibilidade do F-OFFER-2B.
- **Identidade:** `canonicalServiceService.requireActiveForTenant(canonicalServiceId)` (`:110`) — exige canonical **ATIVO/curado**, fail-closed, resolve redirect de duplicata.
- **Campos obrigatórios:** `providerActorId`(uuid) · `canonicalServiceId`(uuid) · `priceCents`(int ≥0) · `durationMinutes`(int >0). Opcionais: `companyId` · `professionalActorId` · `modality`(in_person/remote/home) · location/serviceArea/conditions(jsonb).
- **status:** **hardcoded `'active'`** no INSERT (`:124`) — não há caminho draft na criação (schema default é `draft`; `updateOwnOffering` aceita draft/active/suspended).
- **Idempotente:** UNIQUE `(provider_actor_id, canonical_service_id)` → 2ª chamada devolve a existente (`created:false`).

### (2) Liga a `service` ou bypassa? → **BYPASSA (GAP central)**
- O INSERT (`:120-124`) **NÃO popula `service_id`**; liga direto a `canonical_service_id` (DECISION-0122: `service_id` nunca populado na criação). **A oferta NÃO exige um `services.service_id`.**
- Consequência material: **a elegibilidade do F-OFFER-2B (declaração PF / publicação PJ ACTIVE + KYB-transitivo) NÃO protege a oferta** — ela vive em `createService`, e `createOffering` não passa por `services`. Um provider pode criar `service_offering` para qualquer canonical ATIVO **sem ter declarado o concept**, bastando `canRepresentActor`. **O rigor 2B é contornável pela camada de oferta.** (= o GAP que F-OFFER-3 tem que fechar; já é o ALVO declarado em DECISION-0143 §C/§D.)

### (3) O que falta p/ F-OFFER-3
- **Binding service (FALTA + decisão de forma):** a oferta deve exigir um `services.service_id` válido do **mesmo provider + mesmo concept** (herda a elegibilidade 2B) **OU** re-checar elegibilidade própria (declaração/publicação ACTIVE do concept do canonical). Hoje `service_offerings.service_id` é **nullable + SET NULL + nunca populado** → tornar **mandatório + match provider/concept** = schema + writer (fatia 3A/3B). DECISION-0143 declara o ALVO; **falta a régua de execução análoga à 0144** (a 0144 fechou `createService`, não `createOffering`).
- **Preço/duração/status — constraints VIVAS hoje (OK):** `price_cents` **BIGINT NOT NULL CHECK ≥0** (+ zod int≥0 + JS `Number.isInteger`) · `duration_minutes` **integer NOT NULL CHECK >0** · `status` **CHECK in (draft,active,suspended)** default draft · `modality` CHECK in_person/remote/home · UNIQUE(provider,canonical). **Faltam:** binding obrigatório a service (acima) e **decisão**: oferta nasce `active` direto (sem rascunho/curadoria) — está hardcoded `active`; é correto ou deve nascer `draft`? (decisão de produto, não bug). Nota menor: `Number.isInteger` limita a 2^53 (over-strict vs BIGINT pleno) — não é gap de segurança.

### (4) Subject/owner
- **Provider = `providerActorId`** (body = **HINT**), validado por `canRepresentActor(userId server-side)`. ✓ DECISION-0113/0144-G2: body/`actionContext.actorId` nunca é autoridade; gate real é server-side. **Conforme.**
- `userId` server-side de `req.user.userId`. ✓
- **Ponto de atenção:** `companyId` e `professionalActorId` vêm do body e **não têm gate próprio** (companyId **não** passa por `canManageCompany`; professional não é re-gated). Para PJ, a autoridade é só via `canRepresentActor` sobre o `providerActorId` (que deveria ser o page-actor); `companyId` solto é FK SET NULL/metadata e não confere autoridade. F-OFFER-3 deve fixar que o provider PJ é o page-actor representável (não confiar em `companyId` do body).

### (5) Riscos
- **ALTO — bypass de elegibilidade:** oferta pula `service` → rigor 2B (declaração/KYB-transitivo) não alcança a contratável; possível ofertar concept não declarado (verdade-paralela de capacidade na camada que VENDE).
- **MÉDIO/decisão — status nasce `active`:** sem rascunho/curadoria; oferta pública imediata no INSERT.
- **MÉDIO — owner PJ frouxo:** `companyId`/`professionalActorId` sem gate próprio; autoridade só sobre o provider.
- **BAIXO — price JS `Number.isInteger`:** over-strict, não under (não aceita inválido); cosmético.
- **BLINDAGEM mantida:** `createOffering` não escolhe fornecedor — é o próprio provider declarando a oferta dele.

### (6) VEREDITO: **FALTA_DECISAO**
A espinha de preço/duração/status já está **correta e gateada** no schema; o gate de autoridade (`canRepresentActor` server-side) está conforme. O que falta para F-OFFER-3 é **régua a promulgar** (análoga à DECISION-0144): a oferta exige um `service` válido herdando a elegibilidade 2B **vs** re-check próprio (forma a decidir), **+** decisão "status nasce active ou draft". São decisões de Clayton, não bugs — só depois delas vira FALTA_X executável (schema `service_offerings.service_id` mandatório + match provider/concept no writer). **Prova-viva** (rowcounts service/service_offerings, quantos `service_id` NULL, FK efetiva, drift) → **INCONCLUSIVE → IA-BANCO**.

**Carimbo:** HEAD `74a04819` · revalidou parcial (disco 1ª mão / banco→IA-BANCO) · fontes `arquivo:linha` acima + DECISION-0143/0144/0122/0117/0113 · **Status: RESPONDIDO** (VEREDITO FALTA_DECISAO).

— **IA-OFERTA**, sob coordenação da IA-DIRETORA.
