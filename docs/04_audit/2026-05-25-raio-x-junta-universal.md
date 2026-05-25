# Raio-X — Junta Universal (Actor / Ramo / Formalização / Tenant / Authority / Módulos)

**Status:** LEVANTAMENTO
**Data:** 2026-05-25
**Natureza:** diagnóstico material read-only — **sem força normativa**. Mede correspondência entre uma hipótese arquitetural (camadas separáveis na "junta" do sistema) e o estado material do disco.
**Branch no momento da auditoria:** `rescue-structural` · HEADs `33c49a46` (Fatia A1 RBAC) e `ebd6054d` (Fatia 1 IDENTIDADE).
**Método:** read-only. `git`/`psql`/grep/leitura. Evidência por arquivo:linha / tabela / migration. Onde não houve evidência: "não encontrado" (nunca inferir presença).

Este documento existe para que futuros auditores não precisem refazer a medição. Não é norma; é fotografia. Frentes futuras que tocarem as camadas aqui mapeadas devem reauditar (DTs/decisões mudam o disco; este raio-x congela 2026-05-25).

---

## 1. As 6 camadas (tabela material)

| Camada | Estado material | Evidência | Risco | Próxima pergunta |
|---|---|---|---|---|
| **C1 — Actor (tipos estruturais)** | EXISTE_FUNCIONA com drift permissivo | CHECK `actors_actor_type_check` aceita 10 valores misturando estruturais e legado: `user, page, group, channel, actor_human, actor_organizational, actor_system, person, company, system`. Em uso (banco vivo): `user=65, page=11, actor_human=2, company=1` (zero ramos no actor_type). 30+ callsites bifurcam por tipo estrutural — exemplos: `bank-integration.service.ts:99/114/433/436/439`; `actor-capabilities.service.ts:138/157/165/229/234`; `authorization.service.ts:128-130`; `transparency.service.ts:267-271`. | BAIXO para usar; MÉDIO para limpar CHECK (10→5 quebraria callers que aceitam `actor_human\|person\|user` como família) | A CHECK permite 10 valores mas o uso real é 4 — convergir ou ratificar a permissividade como tolerância intencional? |
| **C2 — Ramo / Ontologia** | EXISTE_FUNCIONA mas LIMITADO ao marketplace | `company_types` (7 rows: `restaurante, supermercado, açougue, padaria, salão, farmácia, hortifruti`); colunas `id, name, slug, default_department_slugs[], default_branch_slugs[]`. **TODOS slugs prefixados `marketplace-*`** (alimentação, hortifruti, serviços-pessoais, saúde-beleza). `company_type_allowed_concepts` (7 rows, FK para `concepts`). Leitores reais: 9 arquivos — 7 em `marketplace/*` (`store-onboarding.{routes,service,types}`, `product-concept-guard`, `application/services/company-application`, `application/services/regional-capacity-application`, `domain/company/marketplace-company.service`, `services/marketplace-company.service`), 1 em `social/actor.repository.ts:336-365` (LEFT JOIN só para expor slug — comentário literal: "bootstrap contextual"), 1 script `run-category-integrity-checks.ts`. | BAIXO p/ ler; MÉDIO p/ expandir ramos não-marketplace | Para "banda/advogado/escola/coletivo informal" — onde vivem? Não existem como `company_types` hoje. |
| **C3 — Formalização jurídica** | **NÃO_EXISTE como camada autônoma** | Schema `actors`: tem `kyc_limit_cents`, `kyc_verified_at` (carimbo). Schema `companies`: tem `cnpj`, `company_status`, `is_verified` (binário). **NÃO HÁ:** campo `legal_status` / `is_formalized` / `legal_level` em actors. NÃO HÁ distinção schema-level entre "coletivo informal" e "actor formalizado". Grep `promote\|formalize\|upgrade.*actor\|evol.*actor`: **zero matches**. `companies.service.createCompany` cria actor `page` NOVO via `ensurePageActor` (não evolui actor existente). | ALTO para implementar; baixo para reconhecer a ausência | Coletivo informal (banda sem CNPJ) pode existir como `actor_type='group'` — sim no schema, mas sem campo de status jurídico próprio. Frente nova se quiser materializar a camada. |
| **C4 — Tenant** | EXISTE_FUNCIONA, **com acoplamento ao ramo** | `tenants` colunas: `id, name, slug, city_id, company_type_id, headquarters_address_id, created_at, updated_at`. **FK `tenants_company_type_id_fkey → company_types(id)`** (1:1). Também `tenants_headquarters_address_id` (DECISION-0020) e `tenants_city_id` (geo). Tenant_id é filtro de virtualmente toda tabela do schema (RLS implícito via `WHERE tenant_id`). | MÉDIO p/ desacoplar tenant↔ramo (impactaria `store-onboarding.default_*_slugs`) | Pode 1 tenant ter MAIS DE UM ramo? Schema atual diz NÃO. |
| **C5 — Authority / Capability** | EXISTE_FUNCIONA (pós-Fatia A1); `actor_has_permission` em fail-closed por decisão (C47) | `pg_proc` vivo: `actor_has_any_role` (restaurado em Fatia A1 — `20260530551000_restore_actor_has_any_role.sql`, prescrita por `RBAC_V2_CONTRACT.md §6.2`); `actor_has_permission` (fail-closed `RETURN FALSE`, ratificado C47/DECISION-0013 / `AUTHORITY_PRECEDENCE §4.4`); `user_has_permission` (legado). `actor-capabilities.service.ts:138-234` resolve por `actor_type` (estrutural) + `user_id`/`company_id` ownership; **NÃO consulta `company_type`/ramo**. `authorization.service.ts:128-130` agrupa user-like (`user\|actor_human\|person`). Grep `company_type.*can_\|permission\|authoriz\|role`: **zero matches**. Grep `actor_type === 'supermercado'`: **zero matches**. | BAIXO (estado canônico em uso) | Quando FASE 6 chegar e `actor_has_permission` deixar fail-closed, vai ler ramo ou só roles? Norma não decide ainda. |
| **C6 — Módulos plugando no ramo** | EXISTE_FUNCIONA **só no marketplace**; outros módulos NÃO leem ramo | 9 arquivos referenciam `company_types`/`company_type_id`/`company_type_allowed_concepts` (acima). **ZERO ocorrências** em `modules/orders/`, `modules/crm/`, `modules/organization/`, `modules/services/`, `modules/pdv/`, `modules/inventory*/`, `modules/payouts/`, `modules/work*/`, `modules/rides/`. Marketplace usa ramo via `store-onboarding.service.ts:146-276` (resolve categorias) e `product-concept-guard.ts:34` (valida produto contra concepts permitidos). | BAIXO para módulos NÃO-marketplace tocarem ramo; ALTO para forçar outros módulos a depender (mudança de contrato) | A norma decide que ramo é APENAS classificação de catálogo (marketplace), ou pode evoluir para guardar outros módulos? Hoje só guarda marketplace. |

---

## 2. Fusões detectadas

### F1 — `tenants` ⟷ `ramo` (1:1)

- **Evidência:** `tenants.company_type_id UUID FK → company_types(id)` (schema vivo, confirmado via `\d tenants` em 2026-05-25). Cardinalidade 1:1 — cada tenant carrega exatamente um ramo. `tenants_company_type_id_fkey` é a única ponte de leitura do ramo no schema.
- **Implicação:** múltiplas empresas no mesmo tenant DEVEM ser do mesmo ramo (não há `companies.company_type_id` separado). Tenant que vira "padaria que também é restaurante" não cabe no schema atual — teria que mudar `company_type_id` do tenant inteiro, afetando todos os products/concepts permitidos.
- **Não-fusão paralela:** `companies` NÃO tem `company_type_id` separado. O ramo vive no tenant.

### F2 — Onboarding state vs registro institucional (em `companies`)

- **Evidência:** `companies.service.ts:444-455` constrói `metadata.businessCategory`/`serviceCategories` em memória; tenta gravar em `companies.metadata` que **não existe**. INSERT em `createCompany` grava só 8 colunas; o `metadata` é **descartado silenciosamente**. Em `adminOverrideToVerified` o UPDATE em `metadata` quebra runtime (`coluna "metadata" não existe`, descoberto na Prova 2 da Fatia A1).
- **DT existente:** `DT-COMPANIES-METADATA-COLUMN-MISSING` → renomeada `DT-ONBOARDING-METADATA-STORAGE-DECISION` (DT_LOG L2104). 4 opções arquiteturais mapeadas; substrato canônico alternativo existe (`actors.metadata`, `company_users.metadata`, `tenants.company_type_id`+`company_types`).
- **Implicação:** código tenta empurrar estado operacional para dentro de `companies` (violação `EMPRESA_NASCIMENTO_CANONICO §1+§4+§7+§8`). Frente A2 separada.

### F3 — `actor_type` carrega LEGADO + estruturais misturados (drift permissivo, não fusão semântica)

- **Evidência:** CHECK admite 10 valores. Em uso real: 4 (`user, page, company, actor_human`). `authorization.service.ts:128-130` reconhece a família com `actor.actor_type === 'user' \|\| === 'actor_human' \|\| === 'person'` — código convive com a permissividade.
- **Implicação:** NÃO é fusão actor↔ramo (zero `actor_type='supermercado'` no código). É drift de NOMENCLATURA estrutural — várias famílias semanticamente equivalentes. Drift vs `02_ACTORS_SSOT §4` (exemplos não exaustivos, mas vocabulário menor).

### Fusões NÃO encontradas (validações negativas)

- ❌ `actor_type` NÃO carrega ramo (zero ocorrências de `actor_type === 'supermercado\|farmacia\|restaurante'` no código).
- ❌ Ramo NÃO concede capability (grep `company_type.*can_\|permission\|authoriz\|role` → zero matches).
- ❌ Capability ≠ módulo (camada RBAC v2 separada via `actor_has_any_role` + `actor_has_permission`).
- ❌ `company_type` e `actor_type` NÃO são redundantes (vivem em tabelas e cardinalidades diferentes: actor_type por actor, company_type por tenant).

---

## 3. Contradições com a norma

### Contradição 1 — `createCompany` cria actor `page` atomicamente

- **Vs `EMPRESA_NASCIMENTO_CANONICO §4`:** "A criação de Empresa **NÃO** implica: criação de Actor / criação de Page / criação de Service / criação de Availability / indexação. Cada um desses passos exige **ato soberano próprio**."
- **Evidência:** `companies.service.ts:654` chama `await ensurePageActor(finalTenantId, companyId, creatorActor.actor_id);` no fluxo de `createCompany`. Atômico, com rollback.
- **Severidade:** alta na letra da norma; tolerada na prática (norma §49 reconhece "Empresa sem Actor é institucionalmente inerte"). Mas a *criação* deveria ser ato separado, não atômico.

### Contradição 2 — Service tenta escrever em `companies.metadata` (onboarding state)

- **Vs `EMPRESA_NASCIMENTO_CANONICO §1+§7`:** "Empresa é registro institucional de lastro jurídico… origem de legitimidade, não origem de comportamento." e "São violações explícitas: … inferir capacidade operacional a partir da Empresa."
- **Evidência:** `companies.service.ts:444-455` (memória) + `adminOverrideToVerified` (UPDATE quebra runtime). Documentado em `DT-ONBOARDING-METADATA-STORAGE-DECISION`.
- **Severidade:** institucional. Bug 2 a corrigir respeitando a norma — Fatia A2 separada.

### Contradição 3 — `actor_type` schema permissivo (10 valores)

- **Vs `02_ACTORS_SSOT §10`:** "É proibido: tratar usuário como sinônimo de Actor; criar Actors sem CPF responsável; inferir Actor a partir de sessão, token ou request."
- **Evidência:** schema admite `user` como `actor_type` — na letra do §10 "tratar usuário como sinônimo de Actor" seria violação. Em uso, `actor_type='user'` é a actor-persona-do-humano (não a sessão), mas viola a letra. 65 rows em uso. Documentado parcialmente em `07_NOMENCLATURA_CANONICA §4.38`.
- **Severidade:** nomenclatura vs operação. Drift conviva.

### Contradição 4 — Coletivo informal (banda sem CNPJ) não tem categoria nativa

- **Vs `EMPRESA_NASCIMENTO_CANONICO §6 (D17)`:** "Empresa **não é obrigatória** para prestação de serviços. PF pode operar diretamente como Actor."
- **Evidência:** schema permite `actor_type='group'` (zero rows em uso), mas `company_types` só comporta marketplace varejo/serviço-pessoal. Coletivo informal "banda" NÃO encontra categoria — schema não impede, mas vocabulário do ramo não cobre.
- **Severidade:** gap entre norma (D17 permite informal) e substrato (ramo só conhece marketplace). Não é contradição constitucional direta.

**SEM contradição** com `03_IDENTITY_CANONICA §8` (resolvida pela Fatia 1): `(global_user_id, tenant_id) → user_id` é resolução canônica; raio-x não viola.
**SEM contradição** com `AUTHORITY_PRECEDENCE §4.5` (produto não cria autoridade): `company_type`/ramo NÃO concede capability no código atual; produto/marketplace usa ramo só como classificação de catálogo.

---

## 4. Veredito da auditoria de evolução do actor

Auditoria complementar ao raio-x das 6 camadas: o runtime suporta "Actor contínuo + capacidades progressivas + formalização incremental"?

### M1 — KYC: carimbo rico, sem fluxo

- **Schema dividido:** `actors.kyc_limit_cents` + `actors.kyc_verified_at` (carimbo). `identities.kyc_status` CHECK `pending\|approved\|rejected` (3 estados) + `identities.kyc_level` CHECK `none\|basic\|complete` (3 níveis). Matriz potencial 3×3.
- **Em uso:** 4 rows em `identities` (2× `pending\|none`, 2× `approved\|complete`). KYC quase virgem.
- **Sem fluxo de submissão/análise:** zero tabelas `kyc%`. `identities` é write-once (INSERT em `identity.service.ts:255`); `auth.register` NÃO toca `identities` (caminho não exercitado por signup).
- **Gate operacional EXISTE em UM lugar:** `core/compliance/authority-decision.service.ts:184-194` bloqueia operações financeiras se `kyc_status='rejected'\|'pending'` (literal: `KYC_PENDING_BLOCKS_FINANCIAL`). NÃO destrava outras capacidades (publicar, criar grupo, vender, etc.).
- **Vocabulário paralelo:** `marketplace/contact.repository.ts` tem outro `kyc_status` com valor `UNVERIFIED` (sprint 84) — não converge com `identities`.

**Veredito M1:** padrão EXISTE PARCIAL. Estado granular só em `identities`; gate só em finanças; sem fluxo de submissão. KYC é **carimbo rico (3×3) com um único uso (bloqueio financeiro)** — não é protótipo Uber-like de "validar destrava nova capacidade".

### M2 — Formalização: cria actor NOVO por limitação, com vínculo histórico preservado

- **`responsible_actor_id` populado 100% em page actors:** 11/11 page actors têm `responsible_actor_id` apontando para o actor humano criador. (user: 65/0, actor_human: 2/0, company: 1/1, page: 11/11).
- **Onde é gravado:** `companies.service.ts:654` → `ensurePageActor(tenantId, companyId, creatorActor.actor_id)`. Comentário literal de `actor-writer.service.ts:25`: "responsibleActorId: actor_id do humano (CPF) que criou a empresa. **OBRIGATÓRIO — nenhuma empresa existe sem âncora humana (§4.8.2).**"
- **Mecanismo de evolução do mesmo actor:** **NÃO EXISTE.** Grep `promote\|formalize\|upgrade.*actor\|evol.*actor`: zero matches.
- **Causa da fragmentação:** **LIMITAÇÃO técnica** (sem mecanismo de evolução) + convenção tácita (sempre criar `page` separado para empresa). Não há DECISION arbitrando "humano evolui vs cria actor novo".

**Veredito M2:** page actor NÃO nasce órfão — 11/11 ligados via FK `responsible_actor_id` ao humano criador. **Vínculo histórico/autoria preservado.** MAS é criação de entidade NOVA, não evolução do mesmo actor. **Toda capacidade nova = nova entidade.** Vínculo via FK preserva histórico; identidade operacional contínua não existe.

### M3 — Estados intermediários: vocabulário existe, fluxo é por-domínio

- **CHECKs ricos em vários campos:** `kyc_status` (3), `kyc_level` (3), `companies.status` (4 — `active\|inactive\|suspended\|closed`, só `active` em uso), `actor_delegations.status` (3 — `active\|revoked\|expired`), `company_users.member_status` (3 — `active\|invited\|suspended`, DECISION-0042).
- **`companies.company_status`:** `VERIFIED(3), PROVISIONAL(9)` em uso, sem CHECK confirmado.
- **`company_validations`:** existe como tabela mas é carimbo (sem `submitted_at`, `reviewed_at`, `reviewer_id`, `decision_reason`).
- **Fluxos de estado vivos em domínios específicos** (26 arquivos com vocabulário `in_review\|under_review\|submitted\|approval_status\|review_status`): orders/marketplace, disputes/reconciliation, subscriptions, payments, pdv, rides/vehicle-compliance, events, venue, SLA. **Padrão de "submeter→analisar→aprovar/rejeitar" é vivo nesses domínios.**
- **Mas o padrão "fluxo de validação que destrava capacidade" NÃO é generalizado:** KYC tem estados sem fluxo; companies tem PROVISIONAL/VERIFIED sem rasto; delegations tem active/revoked sem approval. Padrão é **por-domínio, não infraestrutura universal**.

**Veredito M3:** vocabulário de estado existe; fluxos de estado vivem em domínios específicos; mas **não há infraestrutura universal de "validação destrava capacidade"** — só o caso particular do KYC bloqueando finanças (1 sítio).

### Veredito consolidado da auditoria de evolução

**Terceiro estado:** o runtime NEM "suporta evolução contínua" NEM "força fragmentação total". É **substrato parcial + mecanismo evolutivo ausente**.

- **JÁ APONTA para evolução contínua (convergir):** matriz `kyc_status × kyc_level` (3×3), `responsible_actor_id` populado preservando vínculo histórico humano↔persona, padrões de fluxo vivos em orders/disputes/subscriptions/vehicle-compliance, KYC já é gate operacional (em 1 sítio).
- **NÃO EXISTE (construir):** mecanismo de evolução do MESMO actor ganhar capacidade sem criar nova entidade; tabela de submissão→análise para KYC humano; generalização do gate "validação destrava capacidade" além de finanças; vocabulário de capacidades evolutivas (`actor_capabilities`/`actor_grants` — não encontrado); distinção schema-level entre "actor informal" e "actor formalizado".

**Não-fragmentação parcial confirmada:** o page actor NÃO nasce órfão — nasce ligado via `responsible_actor_id`. A "fragmentação" é PARCIAL: identidade operacional fragmentada (humano e page são entidades distintas), histórico/autoria preservado. Se a visão evolutiva exige "MESMA entidade que ganha capacidades", isso não existe; se aceita "entidades distintas com vínculo histórico", isso EXISTE materialmente.

---

## 5. Frentes mapeadas (NÃO autorizadas, sem pressão material em 2026-05-25)

As cinco frentes abaixo emergem do raio-x + auditoria de evolução. **Nenhuma é decisão de produto neste levantamento.** Todas são candidatas a serem abertas SE/QUANDO houver dor material humana específica. Registradas para que sessões futuras saibam (a) que foram diagnosticadas, (b) que dependem de pressão real para virar fatia, (c) que cada uma é construção incremental sobre base parcial — não greenfield.

### (a) Mecanismo de evolução do mesmo actor (capacidade progressiva)

Construir caminho onde um actor existente GANHA capacidade adicional sem criar nova entidade. Hoje toda nova capacidade = nova entidade (page para empresa; group para coletivo). Base parcial: `responsible_actor_id` (vínculo) + matriz `kyc_status × kyc_level` (estado).

**Critério de abertura:** humano querer "evoluir conta sem trocar identidade" (Uber-like passageiro→motorista) com dor material que recuse "fazer outra conta".

### (b) Fluxo de submissão→análise→decisão para formalização

Tabelas/serviço para "documento submetido → em análise → aprovado/rejeitado" (KYC humano, validação de empresa, qualificação de capability). Hoje `company_validations` é carimbo (sem rastreamento); `identities` é write-once. Padrão existe em orders/disputes/subscriptions mas é por-domínio.

**Critério de abertura:** primeira operação que precise auditar **quem aprovou o quê quando** em formalização (compliance, KYC operacional, qualificação profissional).

### (c) Generalização do gate "validação destrava capacidade" além de finanças

KYC já bloqueia finanças (`authority-decision.service.ts:189` — `KYC_PENDING_BLOCKS_FINANCIAL`). Generalizar: capability X exige nível Y de validação Z. Hoje 1 sítio, escopo finanças.

**Critério de abertura:** segunda capability além de "transferir dinheiro" que precise gate de validação (publicar conteúdo profissional regulado, criar empresa em ramo regulado, etc.).

### (d) Ramos não-marketplace

Hoje `company_types` (7 rows: `restaurante, supermercado, açougue, padaria, salão, farmácia, hortifruti`) só cobre varejo/serviço-pessoal de marketplace — todos slugs prefixados `marketplace-*`. NÃO há vocabulário para: banda informal, escritório de advocacia, escola, clínica, ONG, coletivo cultural, casa noturna, etc.

**Critério de abertura:** primeiro actor não-marketplace (banda/advogado/etc.) querer criar entidade que precise classificação institucional. Sem isso, vira "vou ser uma padaria" forçado.

### (e) Multi-ramo no mesmo tenant

`tenants.company_type_id` é FK 1:1 — tenant carrega exatamente um ramo. Restaurante que também é mercearia (caso real em varejo brasileiro) não cabe no schema atual sem trocar `company_type_id` do tenant inteiro (afeta concepts permitidos).

**Critério de abertura:** humano que precisa operar 2 ramos no mesmo tenant e reportar que mudar `company_type_id` regride o outro ramo.

---

## Auto-vigilância (para futuras frentes que tocarem estas camadas)

1. **Reauditar antes de mexer.** Este raio-x congela 2026-05-25; DTs/decisões posteriores mudam o disco. Confirmar materialmente antes de propor solução baseada nesta foto.
2. **Norma vence inferência.** Toda mexida em C2/C3/C4 deve passar por `03_IDENTITY_CANONICA`, `02_ACTORS_SSOT`, `EMPRESA_NASCIMENTO_CANONICO`, `AUTHORITY_PRECEDENCE`. Se norma já decide, executar; se não decide, parar e consultar.
3. **Substrato parcial não é frente nova obrigatória.** As 5 frentes da seção 5 são candidatas, não roadmap. Cada uma só nasce com pressão material humana. "Visão correta ≠ autorização de implementação."
4. **Vínculo histórico já existe.** `responsible_actor_id` populado 100% em page actors elimina a leitura de "fragmentação total". Qualquer frente futura tem que partir daí — não inventar mecanismo novo de vínculo.
5. **Ramo NÃO é authority.** Confirmado materialmente: `company_type` no código atual é classificação de catálogo do marketplace, não gate de capability. Qualquer frente que tente usar ramo para conceder permissão viola `AUTHORITY_PRECEDENCE §4.5`.
