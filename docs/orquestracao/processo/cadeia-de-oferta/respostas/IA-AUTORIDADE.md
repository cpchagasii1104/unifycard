# IA-AUTORIDADE — respostas (append-only)

> Especialista READ-ONLY do eixo "o que o actor PODE" (grant/capability/permissão/aprovação).
> Escreve só neste arquivo + a própria memória. Carimbo obrigatório. Disco vence narrativa.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS · IA-AUTORIDADE

**(1) HEAD no momento:** `9f5e9c5e` · branch `rescue-structural`.
⚠️ O gatilho citou `dd270f41`; o **HEAD vivo é `9f5e9c5e`** (avançou, U1b/0142 já no disco). Revalidei via `git rev-parse` — **disco venceu o hash citado**.
**(2) Revalidou no disco/banco:** **PARCIAL** — rotas/serviços/gates lidos de 1ª mão (disco); **liveness/rowcount/RLS das tabelas no banco vivo = INCONCLUSIVE → IA-BANCO** (read-only de código, sem prova-viva de `to_regclass`/contagem).
**(3) Arquivos lidos de 1ª mão (gates de autoridade):**
- `backend/src/core/categories/categories.routes.ts:769-821` (`POST /assign-skill`) + `categories.service.ts:1259-1283` (`assignSkillToUser`).
- `backend/src/core/profile/professional-c1/professional-c1.service.ts:61-96` (`resolveActorGuarded` / `canRepresentActor`).
- `backend/src/core/companies/company-publications.service.ts:36-49,144-189` (`loadCompanyForAuthority`/publish) + `companies.service.ts:982-993` (`canManageCompany`).
- `backend/src/modules/services/service-offering.service.ts:9,95-118,146-180` + `service-offerings.routes.ts:12,38-51,70,93` (`userId` server-side).
- `backend/src/modules/services/services.service.ts:32-79,170-182` (`services` legado, `canRepresentActor`).
- `backend/src/modules/human-mvp/human-mvp-service-offer.service.ts:6,38-84` (`hasWriteAccess` tenant-level).
- `backend/migrations/20260616210000_create_actor_capability_grants.sql` + grep de readers vivos (enforcement) de `actor_capability_grants`.

---

### (4) MATRIZ — eixo AUTORIDADE (quem pode declarar/ofertar, e o gate é canônico ou BURACO)

| SUPERFÍCIE | O QUE DECLARA | QUEM ESCREVE | SSOT/READ-MODEL | ACTOR/OWNER | CONCEPT_ID? | AUTORIDADE (verificada 1ª mão) | TEMPO | RISCO | RECOMENDAÇÃO |
|---|---|---|---|---|---|---|---|---|---|
| `POST /profile/professional/c1/concepts` | "este actor FAZ concept X" | `professional-c1.service.declareConcept` → `actor_professional_concepts` | SSOT capacidade PF | **actor_id** | SIM (NOT NULL) | ✅ **CANÔNICO** — `canRepresentActor(tenant,userId,actorId)` fail-closed 403 (service:66-76); incerteza de substrato = deny | n/a | baixo | gate-âncora de capacidade PF |
| `POST /companies/.../publications` (publish) | "esta PJ FAZ concept Z" | `company-publications.service` → `company_concept_publications` | SSOT publicação PJ | company_id / page_actor_id | SIM (NOT NULL) | ✅ **CANÔNICO** — `canManageCompany` (`can_manage_company OR role='owner'`, membership ativa, `companies.service:982`) **+ KYB approved** (:185) + concept===primary + operacional | n/a | baixo | gate-âncora de capacidade PJ (satisfaz 0118) |
| `POST /services/offerings` (create/update/disable) | "este actor VENDE este pacote" | `service-offering.service` → `service_offerings` | SSOT contratável | **provider_actor_id** | SIM (via `canonical_service_id` NOT NULL) | ✅ **CANÔNICO p/ representação** — `canRepresentActor(provider)` (service:97/148/178); `userId` server-side (route:38); `providerActorId` = hint gateado. 🔴 **MAS sem binding à capacidade declarada** (não consulta `actor_professional_concepts`/`publications`) | `unified_availability` owner=`service_offering` | médio | F-OFFER: exigir prova de capacidade declarada ANTES de ofertar (re-gate na ponte) |
| `services` (legado, create) | "actor publica serviço p/ descoberta" | `services.service` → `services` | índice descoberta | actor_id | OPCIONAL | ✅ **CANÔNICO (autoridade)** — `actorId` obrigatório + `canRepresentActor(actorId)` fail-closed (service:42,55) | city/category | baixo (autoridade) | autoridade OK; concept-opcional é eixo IA-OFERTA, não autoridade |
| 🔴 `POST /categories/assign-skill` | "tenho skill Y + hourly_rate" | `categories.service.assignSkillToUser` → `user_skills_categories` | **VERDADE PARALELA** | **global_user_id** (fura o actor) | NÃO (`category_id`) | 🔴 **BURACO** — só `req.user`/`globalUserId` (route:792-805); guarda apenas de categoria (`assertCategoryWritableForUserSkillsStrict`), **ZERO `canRepresentActor`** | n/a | **ALTO** — autoridade não prova actor; preço embutido; category-keyed | **BLOQUEAR p/ F-OFFER** — conter/convergir; não ler discovery daqui |
| 🔴 `human_mvp` create offer (LIVE `/human-mvp`) | "person oferece skill" | `human-mvp-service-offer.service` → `human_mvp_service_offers` | **VERDADE PARALELA** | **person_id = global_user_id** | NÃO (`category_id`) | 🔴 **BURACO** — só `tenantContextPermissionService.hasWriteAccess(tenant,context)` (service:66), **tenant-level**; único check de dono = `skill.global_user_id===person_id` (consistência, NÃO "caller representa person") | n/a | **ALTO** — confused-deputy: qualquer caller com tenant-write cria oferta por **qualquer** person_id | **BLOQUEAR/quarentenar p/ F-OFFER** — decisão de convergência de Clayton |
| `POST /authority/grants` | "concedo capability operacional a outro actor" | `actor-capability-grant.service` → `actor_capability_grants` | SSOT autoridade **DORMANT** | grantee/scope actor | não (`capability_key`) | concedente `canRepresentActor(scope)` — **MAS sem reader vivo de enforcement** (só CRUD próprio + registry + teste) | valid_until | médio (latente) | **substrato pronto p/ a ponte do funcionário**, mas inerte; ativar = migration + decisão + reseal |

---

### Respostas às 6 perguntas focais (cruzando IA-ACTOR + IA-OFERTA)

**1. Por SSOT, quem escreve e se o gate é canônico ou BURACO (verificado 1ª mão):**
- `actor_professional_concepts` → **CANÔNICO** (`canRepresentActor`, fail-closed).
- `company_concept_publications` → **CANÔNICO** (`canManageCompany` + KYB approved + concept===primary).
- `service_offerings` → **CANÔNICO para representação** (`canRepresentActor(provider)`), **mas sem capability-binding** ao concept declarado (lacuna de autoridade material: representar o provider ≠ provar que o provider tem a capacidade que está ofertando).
- `services` (legado) → **CANÔNICO em autoridade** (`canRepresentActor(actorId)`); o problema dele é concept-opcional (eixo OFERTA).
- `user_skills_categories` → 🔴 **BURACO** (`global_user_id`, sem `canRepresentActor`).
- `human_mvp_service_offers` → 🔴 **BURACO** (`hasWriteAccess` tenant-level, não actor).

**2. As 2 paralelas são "PRODUTO PERMITE e AUTORIDADE NÃO PROVA"? CONFIRMO de 1ª mão — SIM, as duas:**
- `assign-skill`: a rota só exige autenticação e resolve `globalUserId` do próprio `req.user`; escreve skill+`hourly_rate`+`pricing_type` **sem nenhuma prova de que aquele humano é um actor representável**. É auto-declaração global_user_id-keyed que pula a camada actor. *(categories.routes.ts:792-805 + categories.service.ts:1269-1282.)*
- `human_mvp`: o gate é **tenant-level** (`hasWriteAccess(tenant,context)`); o subject é `person_id`; o único vínculo de dono é `skill.global_user_id===person_id` (consistência skill↔person), **não** "o caller pode representar a person". Logo qualquer caller com write-access do tenant cria oferta em nome de **qualquer** person_id = **confused-deputy**. *(human-mvp-service-offer.service.ts:57-84.)*

**3. `canManageCompany` é o gate certo p/ PJ — SIM, e satisfaz DECISION-0118.** `canManageCompany` (`companies.service:982-993`) = `can_manage_company OR role='owner'` com membership ATIVA, keyed por `global_user_id`, fail-closed, **sem** actorId client-declared / capability default / FASE 6. É **company-scoped**, não representação genérica — exatamente o que 0118 exige ("representação genérica não basta p/ dono de empresa": `canRepresentActor` genérico **não** autorizaria a publicar pela PJ). **Modelo canônico de "quem pode declarar que um actor faz X":**
- **PF declara por si** → `canRepresentActor(self actor)`.
- **Representante de PJ** → `canManageCompany` (+ KYB no publish), NÃO representação genérica.
- **Funcionário/operador não-dono** → **delegação** (`actor_delegations`) ou **capability grant** (`actor_capability_grants`, escopo company-actor) — modelo correto, mas **hoje não plugado** nos writers de declaração/oferta.

**4. `actor_capability_grants` está REALMENTE dormant — CONFIRMADO.** Grep de readers vivos retorna só `permission-keys.ts` (registry), o próprio `actor-capability-grant.service.ts` (CRUD) e o pipeline de teste — **nenhum writer de negócio o consulta como gate**. Detalhe relevante: a allowlist da migration **já inclui `services:create`/`services:edit`/`services:disable`** (além de `calendar:block/unblock`) — ou seja, o substrato **antecipa** a ponte do operador, mas **nada enforça**. **Deveria participar da ponte** no caso "funcionário oferta em nome da company via grant" — é o lugar canônico, melhor que sobrecarregar `canManageCompany` (que é dono/gerente). Mas ativar = nova migration + decisão + reseal (allowlist hoje é NÃO-financeira e sem enforcement); nunca por carona.

**5. Autoridade que deve gatear a futura PONTE declaração→oferta:**
- Declarar/ofertar **para si** → `canRepresentActor(self)`.
- Ofertar **pela company** → `canManageCompany` + KYB (PJ).
- Ofertar **por delegação/funcionário** → `actor_capability_grants` (`services:create`, scope=company-actor) ou `actor_delegations` — substrato a ativar.
- 🔴 **HERANÇA PERIGOSA a barrar:** (a) declarar concept **não** autoriza terceiro a ofertar em nome do actor — a travessia entre substratos **re-gateia autoridade**, não herda; (b) `canRepresentActor` genérico vazando para operação de dono de PJ (0118 barra); (c) capability default (`can_manage_marketplace`) ou `grant_origin`/cargo como autoridade; (d) grant de tenant A valendo no tenant B; (e) auto-criar `services`/offering a partir do perfil (side-effect cross-substrato sem re-gate).

**6. `actionContext.actorId` como autoridade? NÃO em nenhuma dessas rotas.** Os dois BURACOS são keyed por `global_user_id` (assign-skill) e por permissão **tenant-level** (human_mvp) — não por actorId-spoofing. Positivo: `service_offerings`/`services`/`professional-c1` tratam o `actorId` declarado como **hint**, sempre com `userId` server-side e `canRepresentActor` como gate real (padrão canônico DECISION-0113). **Nenhuma das superfícies usa actorId de cliente como autoridade.**

---

### (5) VEREDITO (eixo AUTORIDADE): **PARTIAL** (contribui para o BLOCKER de F-OFFER)

A espinha de autoridade **existe e é correta** onde é canônica: `canRepresentActor` (PF/serviço/oferta, fail-closed) · `canManageCompany`+KYB (PJ, company-scoped, satisfaz 0118) · `actorId`=hint nunca autoridade. **Porém F-OFFER não abre como convergência limpa** porque: (a) **2 writers LIVE furam a autoridade do actor** (`assign-skill` global_user_id; `human_mvp` tenant-permission confused-deputy) = "produto permite, autoridade não prova"; (b) **`service_offerings` representa o provider mas não prova capacidade declarada** (binding ausente); (c) **a autoridade da ponte declaração→oferta é decisão de produto pendente** (self/company/delegação). (a) e (c) são **decisões de Clayton** (convergir vs quarentenar) → **PARTIAL, com bloqueadores nomeados** — alinhado ao BLOCKER da IA-OFERTA e ao PARTIAL da IA-ACTOR.

### (6) VERDADES PARALELAS (no eixo autoridade)
1. 🔴 **Modelo de autoridade de "declara/oferta capacidade":** `canRepresentActor` (professional-c1/services/offerings) **×** auto-claim `global_user_id` (assign-skill) **×** permissão `tenant-level` (human_mvp). **TRÊS** autoridades para o mesmo fato "este actor faz/oferta X".
2. 🔴 **Subject de identidade:** `actor_id` (canônico) **×** `global_user_id` (assign-skill / human_mvp `person_id`) — a camada actor é contornada nos dois buracos.
3. ⚠️ **Binding de autoridade da oferta:** `canRepresentActor(provider)` em `service_offerings` **sem** vínculo à autoridade de capacidade declarada — provider pode ofertar concept que nunca declarou.
4. ℹ️ **Substrato latente vs ativo:** `actor_capability_grants` define keys de oferta (`services:*`) mas **nenhum reader enforça** — autoridade desenhada, não viva.

### (7) STOPs para F-OFFER (eixo autoridade)
- **Todo writer que declara capacidade/oferta passa por `canRepresentActor` (PF) / `canManageCompany`+KYB (PJ) / grant ou delegação explícita (funcionário).** `assign-skill` e `human_mvp` violam — conter/quarentenar ANTES de F-OFFER.
- **NÃO** aceitar permissão **tenant-level** (`hasWriteAccess`) como substituta de autoridade de actor (confused-deputy do human_mvp).
- **NÃO** keyar autoridade/subject por `global_user_id` furando o actor (assign-skill).
- **A ponte declaração→oferta RE-GATEIA autoridade na travessia** — declarar concept NÃO autoriza terceiro a ofertar; sem herança de permissão entre substratos.
- **`canManageCompany` (não `canRepresentActor` genérico) para publish de PJ** — DECISION-0118.
- **`actor_capability_grants` é o lar canônico do "funcionário oferta pela company"**, mas está dormant + allowlist NÃO-financeira + sem reader de enforcement → ativar = migration + decisão + reseal, **nunca por carona**.
- **NÃO** usar capability default (`can_manage_marketplace`), `grant_origin`/cargo, FASE 6 (`actor_has_permission`=stub deny-all) ou `actionContext.actorId` como autoridade.

### Prova-viva pendente → INCONCLUSIVE → IA-BANCO
- `to_regclass`/rowcount/RLS de `user_skills_categories` e `human_mvp_service_offers` (vivas com dados? RLS por tenant ativa?).
- Confirmar que as rotas `/categories/assign-skill` e `/human-mvp` estão **montadas e alcançáveis** no app vivo (IA-OFERTA cita `app.builder.ts:520-560` LIVE — confirmar).
- `actor_capability_grants` rowcount (esperado 0/dormant) — corrobora "sem enforcement".

**FRONTEIRA:** cruza com **IA-ACTOR** (subject actor/`canRepresentActor`/global_user_id), **IA-OFERTA** (services/offerings/publications/concept-binding), **IA-SEMANTICA** (concept × category, Lei 7), **IA-BANCO** (prova-viva). **IA-DINHEIRO fora** (preço aqui é localização de SSOT, não liquidação — mas registro que `hourly_rate` na skill é preço fora do lugar, sinal p/ IA-DINHEIRO quando F-OFFER materializar).

**Status: RESPONDIDO** — VEREDITO PARTIAL (2 buracos de autoridade LIVE + binding ausente + ponte sem decisão); banco-vivo INCONCLUSIVE → IA-BANCO. Insumo READ-ONLY, não GO. Nenhuma edição de código/schema/cartório.

*Carimbo: HEAD `9f5e9c5e` · branch `rescue-structural` · 2026-06-20 · revalidação de 1ª mão (disco/rotas/serviços). Fonte soberana: DECISION-0113 (canRepresentActor/5 canais), DECISION-0118 (representação genérica não basta p/ dono de PJ), DECISION-0100/0101 (canManageCompany+KYB nas publicações), DECISION-0126/0136 (grants), AUTHORITY_LAW Art.17 (role≠autoridade). — IA-AUTORIDADE, sob coordenação da IA-DIRETORA.*

---

## F-OFFER-2 — READ-FIRST curto: AUTORIDADE da ponte declaração→service · IA-AUTORIDADE

**Carimbo:** HEAD vivo **`4431b8fc`** · branch `rescue-structural` · 2026-06-21 · revalidou no disco: **SIM (1ª mão)**; banco vivo (rowcount/FK aplicada/RLS): **INCONCLUSIVE → IA-BANCO (3º elo)**.
**Lidos 1ª mão:** `modules/services/services.service.ts:35-99` (`createService`) · `core/authorization/authorization.service.ts:333-384` (`canRepresentActor` — ramos ownership/company/grupo/registry) + `:445-490` (`checkOwnership('companies')`) · `core/companies/companies.service.ts:982-993` (`canManageCompany`) · `core/companies/company-publications.service.ts:36-189` (gate de publish) · grep readers vivos de `actor_capability_grants` (vazio) · grep `createService` × declaração/KYB (vazio). CONSOLIDADO §D2/D3 + F-OFFER-1 CLOSED (assign-skill→501).
**Re-baseline:** os 2 buracos da RODADA 7 mudaram de estado — `assign-skill` **CONTIDO** por F-OFFER-1 (501 `ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING`); `human_mvp` idem. Não reabro; F-OFFER-2 é só a **ponte de autoridade**.

### (1) Autoridade VIVA de `createService` hoje — por caso
`createService` (services.service:55) gateia por **`canRepresentActor(userId, input.actorId)`** fail-closed 403 + actor existe + intent + `assertServiceCategoryAllowedForCompany` (0109) + canonical ativo (0117). **Não consulta** declaração nem KYB (grep vazio).
- **PF self:** `input.actorId` = actor humano do próprio user → `canRepresentActor` ramo 1 (ownership direto, `actor.user_id===userId`, authorization.service:346-352) = **basta `canRepresentActor`. PRONTO.**
- **Company (owner = page-actor):** `input.actorId` = page-actor (`actor.company_id` setado) → `canRepresentActor` ramo 2 (authorization.service:359-366) resolve via **`canManageCompany`** (`can_manage_company OR role='owner'`, membership ativa). **NÃO vaza representação genérica** — 0118 já está estruturalmente atendido DENTRO de `canRepresentActor`. ✅ **Logo NÃO há o gap "criar service de empresa sem canManageCompany".**
- 🔴 **MAS há gap de simetria com o publish:** criar `service` de company exige só `canManageCompany`; **NÃO exige KYB approved, NÃO exige publicação prévia do concept, NÃO exige concept==primary** — tudo que `company_concept_publications` exige (company-publications.service:174-188, DECISION-0100/0101). Ou seja, um gestor (`canManageCompany`) cria um `service` **descobrível** para um concept que a empresa **não publicou** e para o qual **não tem KYB**. O `service` (superfície de descoberta) tem gate de autoridade **mais fraco** que o publish.
- ⚠️ **Resíduo a verificar (ramo 4 registry):** se `canManageCompany` falha, `canRepresentActor` ainda tenta o **registry-bônus** (authorization.service:376-383) via `checkOwnership('companies')`, que aceita também caminhos legados `is_primary` e `role='admin'` (:463-490) — potencialmente **mais amplo** que `canManageCompany`. Não é o caminho principal, mas pode alargar a representação de company-actor além de `can_manage_company OR owner`. Sinalizo para verificação (não afirmo exploração).

### (2) Autoridade que DEVE gatear a ponte (F-OFFER-2 · D3)
A ponte não herda — **re-gateia na travessia** (declarar ≠ permitir ≠ elegível):
- **PF:** `canRepresentActor(self)` **+** existência de `actor_professional_concepts` **active** para o concept do canonical_service. (declarar(self) + criar(self) **compõem** — mas hoje só o "criar(self)" tem gate; falta o "declarou".)
- **PJ/company:** `canManageCompany` **+** publicação **active** em `company_concept_publications` para esse concept (que já carrega KYB+operacional+concept==primary). Assim o KYB que o publish exige passa a **proteger transitivamente** o `service` — fechando o gap (1).
- **Funcionário/operador não-dono:** **`actor_capability_grants`** (`services:create`, scope = company-actor) **OU** `actor_delegations` — substrato existe, mas **inerte** (ver 4). Sem isso, hoje "operador cria service" só funciona se ele for `can_manage_company`/owner (sobrecarrega o gate de dono).

### (3) Papel do `actor_capability_grants` (`services:create/edit/disable`, dormant)
**É o lar canônico** do "operador cria/opera service **pela** company" — distinto de `canManageCompany`, que é o gate do **dono/gestor**. A allowlist da migration já inclui `services:create/edit/disable` (antecipa exatamente esta ponte). **CONFIRMADO de 1ª mão: continua DORMANT no HEAD `4431b8fc`** — grep de readers vivos fora do próprio módulo/registry/teste = **vazio**; nenhum writer de negócio (incl. `createService`) o consulta. **Recomendação:** a ponte F-OFFER-2 **deve** usá-lo para o caso operador, em vez de sobrecarregar `canManageCompany`. Mas ativar = **migration + DECISION + reseal** (allowlist é NÃO-financeira e sem enforcement; ligar enforcement é ato gated) — **nunca por carona** do F-OFFER-2. Decisão de Clayton se F-OFFER-2 já inclui o caso operador ou só PF/PJ-dono primeiro.

### (4) Herança perigosa a BARRAR na ponte
- **Declaração NÃO autoriza criar service público:** ter `actor_professional_concepts`/`company_concept_publications` é **insumo de elegibilidade**, não autoridade de ação — o gate de `createService` (`canRepresentActor`/`canManageCompany`) permanece obrigatório E somado à elegibilidade, nunca substituído por ela.
- **`canRepresentActor` genérico vazando p/ operação de PJ:** já barrado no ramo 2 (canManageCompany); **manter** — não introduzir caminho que represente company-actor sem canManageCompany (vigiar o ramo 4 registry/`role='admin'`).
- **capability default / role como autoridade:** `can_manage_marketplace` (capabilities_json), `grant_origin`/cargo, `role` textual — nunca autoridade (AUTHORITY_LAW Art.17).
- **grant cross-tenant:** `actor_capability_grants` é por `tenant_id`; grant em tenant A não vale em B (se/quando ligado).
- **`actionContext.actorId` como autoridade:** é HINT; `userId` é server-side; gate real é `canRepresentActor`. **Confirmado: nenhuma dessas rotas usa actorId de cliente como autoridade.**
- **FASE 6 / `actor_has_permission`:** stub deny-all; não plugar na ponte.

### (5) Assimetria PF×PJ — o modelo é coerente?
**Parcialmente — e a incoerência é exatamente o gap (1).** Coerente: PJ = `canManageCompany` + KYB + publicação; PF = `canRepresentActor`(self) + declaração. A assimetria é **legítima na origem** (PJ é entidade fiscal → KYB; PF declara por si). **Mas hoje o `service` quebra a simetria por baixo:** o publish PJ é KYB-gated, porém o `createService` de company **não** herda esse rigor — então a proteção fiscal do publish é contornável pela porta do `service`. A ponte deve **re-amarrar**: `service` de company só com publicação active (KYB transitivo). **PF "service descobrível" precisa de análogo de permissão-para-operar?** É **decisão de Clayton** (produto), não verdade de autoridade: hoje PF compõe `canRepresentActor`+declaração sem verificação fiscal; se descoberta pública de PF exigir um análogo (trust/verificação), é política — eu **sinalizo a assimetria**, não a preencho.

### VEREDITO: **FALTA_DECISAO** (com 1 gap de autoridade nomeado + 1 resíduo a verificar)
- **Autoridade de origem = sólida:** `createService` é fail-closed por `canRepresentActor`, que para company **já é** `canManageCompany` (0118 atendido). Não há buraco "criar service de empresa sem canManageCompany".
- **O que falta é DECISÃO de produto (a ponte D3):** (a) `createService` deve passar a **exigir declaração/publicação active** do concept (PF: `actor_professional_concepts`; PJ: `company_concept_publications` — fechando o gap KYB-transitivo); (b) decidir se o caso **operador** entra agora via `actor_capability_grants` (ativar substrato dormant = migration+DECISION+reseal) ou fica para depois; (c) decidir se PF descobrível precisa de análogo de verificação. Nada disso é bug a corrigir sozinha — é régua de autoridade a promulgar. → **FALTA_DECISAO**, não FALTA_AUTORIDADE.
- **Resíduo INCONCLUSIVE (verificação, não decisão):** o ramo 4 registry/`checkOwnership('companies')` legado (`is_primary`/`role='admin'`) pode representar company-actor além de `canManageCompany` — confirmar se é alcançável e se amplia o gate. **→ IA-BANCO/IA-ACTOR** (substrato de membership) na sequência.

**Prova-viva → IA-BANCO (3º elo):** rowcount de `actor_capability_grants` (esperado 0/dormant), `actor_professional_concepts`/`company_concept_publications`/`services` (CONSOLIDADO reporta 1/0/0 — confirmar); existência de membership com `role='admin'` sem `can_manage_company` (alimenta o resíduo do ramo 4); RLS dos substratos.

**FRONTEIRA:** IA-ACTOR (canRepresentActor/membership/page-actor — o ramo 4 é dela+minha) · IA-OFERTA (o `service` é o destino da ponte; binding concept↔canonical_service) · IA-SEMANTICA (concept↔canonical_service, Lei 7) · IA-BANCO (prova-viva). **IA-DINHEIRO fora** (capacidade operacional, não liquidação).

**Status: RESPONDIDO** — VEREDITO FALTA_DECISAO (autoridade de origem sólida; ponte = régua a decidir; gap KYB-transitivo nomeado; resíduo ramo-4 → IA-BANCO/IA-ACTOR). READ-ONLY, zero edição de código/schema/migration/cartório/commit. Insumo, não GO.

*Carimbo: HEAD `4431b8fc` · branch `rescue-structural` · 2026-06-21 · 1ª mão (disco/rotas/serviços). Fontes: DECISION-0113 (canRepresentActor), DECISION-0118 (representação genérica ≠ dono de PJ), DECISION-0100/0101 (publish PJ = canManageCompany+KYB+operacional+concept==primary), DECISION-0109 (categoria do service por company_type), DECISION-0117 (canonical_services), DECISION-0136/0126 (actor_capability_grants/grants), DECISION-0143/F-OFFER §D3 (ponte exige declaração prévia), AUTHORITY_LAW Art.17 (role≠autoridade). — IA-AUTORIDADE, sob coordenação da IA-DIRETORA.*
