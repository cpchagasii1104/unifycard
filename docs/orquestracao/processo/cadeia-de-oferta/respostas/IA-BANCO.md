# respostas/IA-BANCO.md — prova-viva de schema/migrations/integridade/runtime do banco

> Instância **IA-BANCO** (ex-IA-BANCO-DE-DADOS). READ-ONLY estrito. Terminus da prova-viva.
> Memória soberana: `docs/memorias/MINHA_MEMORIA_BANCO_DE_DADOS.md`. Escrevo só este arquivo + minha memória.
> Probes READ-ONLY (`to_regclass`/`\d`/`information_schema`/`pg_get_functiondef`/rowcount); nunca muto o banco; sem suíte; scripts de probe descartados ao fim.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS (prova-viva IA-BANCO)

**HEAD no momento:** `9f5e9c5e` · branch `rescue-structural` (verificado de 1ª mão por `git rev-parse`; **NÃO** confiei no `dd270f41` citado no INBOX — estava stale; o INBOX de referência também diz `dd270f41`, mas o disco vivo é `9f5e9c5e`).
**Revalidou no vivo:** SIM — probe psql READ-ONLY em `unificard_dev` (catálogo `pg_class`/`pg_policy`/`pg_constraint`/`pg_proc`/`pg_trigger`/`information_schema`/`schema_migrations`) + `to_regclass`/rowcount/`pg_get_functiondef` + grep de código. Nada mutado; probes descartados.
**Fontes lidas:** banco vivo (catálogo + 16 rowcounts); `src/core/categories/categories.routes.ts:770-805`; `src/core/categories/categories.service.ts:1259-1278`; `src/app.builder.ts:558-560`; `src/modules/human-mvp/*`; `migrations/` (count 398).
**Caveat permanente:** conexão `postgres` = superuser/bypassrls ⇒ RLS **inerte** em runtime; porém `relrowsecurity`/`relforcerowsecurity` (flags de catálogo) são verdade definitiva e é isso que reporto.

### 1. TABELA DE PROVA-VIVA (item · existe? · rowcount · RLS/FK/tipo · JANELA)

| # | Objeto | Existe? | Rowcount | RLS / FK / tipo (catálogo vivo) | JANELA |
|---|---|---|---|---|---|
| A1 | `user_skills_categories` | **NÃO** (to_regclass NULL) | n/a (sem tabela) | — | **GRÁTIS** (ghost; 0 escrita possível) |
| A1 | `human_mvp_service_offers` | **NÃO** | n/a | — | **GRÁTIS** (ghost) |
| A2 | rota `POST /categories/assign-skill` | **MONTADA** (`categories.routes.ts:779`) | — | `assignSkillToUser` faz `INSERT INTO user_skills_categories` (`categories.service.ts:1271`) → tabela AUSENTE ⇒ **42P01 em runtime** | **GRÁTIS conter** (ghost reachable) |
| A2 | rota `/human-mvp` | **MONTADA** (`app.builder.ts:558-560`, prefix `/human-mvp`) | — | módulo lê `human_mvp_*`; `human_mvp_service_offers` AUSENTE; há guard `audit-automation-human-mvp-ghost-containment` | **GRÁTIS conter** (ghost contido) |
| B3 | `actor_professional_concepts` | SIM | **1** | rls=f/forced=f/0pol; `concept_id→concepts(concept_id)` **NO ACTION**; `actor_id→actors` NO ACTION | **CUIDADO** (1 linha viva) |
| B3 | `actor_professional_profiles` | SIM | 0 | rls=f/0pol | **GRÁTIS** |
| B3 | `canonical_services` | SIM | **1** | rls=f/0pol | **CUIDADO-leve** (1 linha) |
| B3 | `services` | SIM | 0 | rls=f/0pol; `canonical_service_id→canonical_services` **RESTRICT** | **GRÁTIS** |
| B3 | `service_offerings` | SIM | 0 | rls=f/0pol; `service_id→services` **SET NULL** (fraco/legado) + `canonical_service_id→canonical_services` **RESTRICT** (forte) | **GRÁTIS** |
| B3 | `company_concept_publications` | SIM | 0 | rls=f/0pol | **GRÁTIS** |
| B3 | `tenant_concept_offerings` | SIM | 0 | rls=f/0pol | **GRÁTIS** |
| B4 | `services` com `canonical_service_id` NULL | — | 0 de 0 (tabela vazia) | — | **GRÁTIS** |
| B5 | força FK concept/canonical_service | — | — | `services.canonical_service_id`=RESTRICT(`r`) · `service_offerings.canonical_service_id`=RESTRICT(`r`) · `actor_professional_concepts.concept_id`=NO ACTION(`a`) | — |
| C6 | `detect_availability_conflicts()` | SIM (existe) | — | **STUB**: corpo `BEGIN RETURN; END;` → NÃO detecta conflito | risco (não-tabela) |
| C7 | CHECK `chk_availability_owner_type` | SIM | — | **6 tipos** incl. `service_offering` (user·service·event·group·page·service_offering); `purpose_concept_id` (uuid, 0132) VIVO | ok |
| C8 | `availability` por owner_type | SIM | **48** (todas `owner_type='user'`; **0** `service`/`service_offering`) | rls não verificado neste item | **CUIDADO** (48 agendas user) · offer-availability **vazio=GRÁTIS** |
| D9 | `products` | SIM | 0 | — | **GRÁTIS** |
| D9 | `catalog_products` | **NÃO** | n/a | — | n/a |
| D9 | `canonical_products` | SIM | **35** | — | **CUIDADO** (35 linhas seed) |
| D9 | `product_offers` | SIM | 0 | — | **GRÁTIS** |
| D9 | `tenant_products` | **NÃO** (to_regclass NULL apesar da migration `0112`) | n/a | — | investigar (renomeada/dropada?) |
| D9 | `canonical_variants` | SIM | 0 | — | **GRÁTIS** |
| D9 | `product_concepts` | **NÃO** | n/a | — | n/a |
| D9 | `product_variants` | SIM | 0 | — | **GRÁTIS** |
| D10 | tipo de `product_offers.price` | — | — | **`price_cents` BIGINT** (NÃO existe coluna `price` NUMERIC — já migrado p/ cents) | ok |
| D10 | `tenant_products` price | **NÃO** (tabela ausente) | — | n/a | n/a |
| D11 | `product_concept_id` | **coluna AUSENTE** (0 tabelas) | — | não existe em nenhuma tabela | — |
| D11 | `canonical_variant_id` | presente em 4 tabelas | 0 non-null em todas | `product_offers`/`product_variants`/`canonical_variant_media`/`store_product_activations` (todas 0 linhas) | **GRÁTIS** |
| D12 | `inventory_movements` append-only | SIM | 0 (movements) / 0 (balances) | 4 triggers `tgenabled='O'` (prevent_update·prevent_delete·validate_lot_variant·actor_tenant) → append-only ATIVO; sem drift | **GRÁTIS** |
| E13 | `actor_capability_grants` | SIM | **0** | dormant confirmado | **GRÁTIS** |
| E14 | drift `schema_migrations` × disco | — | 398 = 398 | **DRIFT=0** (último: `20260620150000_seed_concept_relations_wedding_pilot`; `db_role_rls_hardening` agora APLICADO — o drift=1 da Rodada 2 fechou) | ok |

### 2. MATRIZ (recorte do meu eixo — "onde o actor declara capacidade", prova estrutural)

| SUPERFÍCIE | SSOT/READ-MODEL | CONCEPT_ID? | FK (força) | ESTADO VIVO | RISCO |
|---|---|---|---|---|---|
| `actor_professional_concepts` | candidato a SSOT "actor faz CONCEPT" | **SIM** (`concept_id→concepts`) | NO ACTION (média) | **1 linha** | caminho canônico vivo; FK não-forte |
| `services` | índice de descoberta | via `canonical_service_id` | RESTRICT (forte) | 0 | vazio = convergência grátis |
| `service_offerings` | contratação/pacote | `canonical_service_id` (forte) + `service_id→services` SET NULL (legado) | RESTRICT + SET NULL | 0 | duplo vínculo: âncora forte=canonical; service_id é legado/projeção |
| `company_concept_publications` | SSOT publicação PJ | (não verifiquei coluna concept_id neste probe) | — | 0 | vazio |
| `user_skills_categories` (ghost) | **paralelo** "skill por categoria" | NÃO (category_id, não concept) | tabela ausente | inexistente | **VERDADE PARALELA legada** (rota viva→42P01) |
| `human_mvp_service_offers` (ghost) | **paralelo** "oferta humana" | — | tabela ausente | inexistente | **VERDADE PARALELA legada** (módulo montado) |

### 3. VEREDITO: **PASS_TO_CONVERGENCE** (com 2 STOPs de ghost + 1 risco de tempo)

A espinha canônica `CONCEPT → SERVICE → SERVICE_OFFERING → AVAILABILITY(service_offering)` **existe estruturalmente** no banco vivo, com FKs **fortes (RESTRICT)** ao `canonical_services` e o `owner_type` da agenda já suportando `service_offering`. Está **quase toda vazia** (services/offerings/publications/tco/products/product_offers/variants/capability_grants = 0) ⇒ **JANELA VIRGEM ABERTA: convergência é GRÁTIS agora** (0 backfill, 0 ruptura). **Não é BLOCKER** do ponto de vista estrutural. As decisões de POLÍTICA (qual é o SSOT de "eu faço isso", conter ou matar os ghosts) **não são minhas** — são de IA-OFERTA/IA-ACTOR/IA-SEMANTICA/Clayton; eu provo que o custo é ~0.

### 4. VERDADES PARALELAS (fato de banco; semântica = donos de eixo)

1. **`user_skills_categories`** — rota `POST /categories/assign-skill` MONTADA + `assignSkillToUser` faz `INSERT` nela, mas **tabela AUSENTE** ⇒ caminho de "declarar skill" fantasma (42P01). Paralelo ao canônico `actor_professional_concepts`/`services`. (cruza IA-ACTOR/IA-OFERTA)
2. **`human_mvp_service_offers`** — módulo `/human-mvp` MONTADO, tabela AUSENTE; já há guard de contenção `audit-automation-human-mvp-ghost-containment`. Paralelo a `service_offerings`. (cruza IA-OFERTA/IA-COMERCIO)
3. **`service_offerings.service_id → services` (SET NULL)** × **`canonical_service_id → canonical_services` (RESTRICT)** — dois vínculos de serviço na mesma oferta; o forte é o canonical, o `service_id` é legado/projeção (confirma §4.7 do plano). Não é dado paralelo hoje (0 linhas), mas é **superfície** dupla a normar na convergência.
4. **`detect_availability_conflicts()` = STUB** — a camada TEMPO não detecta conflito hoje (retorna vazio). Não cria verdade paralela, mas é **fundação incompleta** para "agenda filtra quem pode no tempo". (dono: IA-TEMPO)

### 5. JANELA VIRGEM — grátis (vazio) × cuidado (com dados)

- **GRÁTIS (rowcount 0 — cirurgia estrutural ~0 agora):** `services`, `service_offerings`, `company_concept_publications`, `tenant_concept_offerings`, `actor_professional_profiles`, `products`, `product_offers`, `canonical_variants`, `product_variants`, `actor_capability_grants`, `inventory_movements`/`inventory_balances`. **Conter/remover os ghosts** (`user_skills_categories`, `human_mvp_service_offers`) também é GRÁTIS (tabelas inexistentes; 0 escrita).
- **CUIDADO (tem dado — sem usuário real, mas não vazio):** `actor_professional_concepts` (**1**), `canonical_services` (**1**), `canonical_products` (**35** seed), `availability` (**48** agendas `owner_type='user'`). Nenhuma com usuário/dinheiro real; backfill trivial se necessário, mas **não tratar como vazio**.
- **AUSENTES a decidir (não-grátis nem cuidado — decisão de existência):** `tenant_products` (apesar da migration `0112`), `product_concepts`, `catalog_products`, `unified_availability` (a tabela viva é **`availability`** — nome do plano diverge). Renomeadas/dropadas/nunca-aplicadas → investigar antes de assumir.

### 6. STOPs para F-OFFER (do meu eixo)

1. **Antes de abrir F-OFFER, decidir o destino dos 2 ghosts** (`user_skills_categories`/`assign-skill` e `human_mvp_service_offers`/`/human-mvp`): conter (501)/remover rota. Enquanto montados+tableless são vetor de verdade paralela e 42P01. **Grátis agora.**
2. **Reconciliar o nome `unified_availability` (plano/§) × `availability` (tabela viva)** — doc/código apontando p/ nome inexistente. (IA-TEMPO)
3. **`detect_availability_conflicts` é STUB** — a camada TEMPO não sustenta "agenda filtra no tempo" até virar real; F-OFFER pode abrir a oferta, mas a interseção oferta×tempo é inerte hoje. (IA-TEMPO)
4. **FK `actor_professional_concepts.concept_id` é NO ACTION** (não RESTRICT) — se concept_id é identidade da capacidade, a FK fraca permite órfão; avaliar fortalecer **agora** (1 linha, grátis). (estrutura minha; política IA-SEMANTICA/IA-ACTOR)
5. **`service_offerings` tem duplo vínculo de serviço** (`service_id` SET NULL legado × `canonical_service_id` RESTRICT) — a convergência deve declarar o canônico e depreciar o legado **com a janela aberta** (0 linhas). (IA-OFERTA)
6. **NÃO sou eu quem decide** SSOT/semântica/política — provo existência/contagem/FK/tipo/flag. Aplicar qualquer correção = EXECUTORA sob GO → ChatGPT → IA-YALA → Clayton.

**STOPs honrados:** READ-ONLY estrito — só catálogo/SELECT count/`pg_get_functiondef`/grep + git; nenhum INSERT/UPDATE/DDL; nenhuma suíte; probes descartados; nada commitado. Editei só este arquivo + minha memória. **Análise = INSUMO, não GO.**

**Status: RESPONDIDO** (14/14 itens provados de 1ª mão no HEAD `9f5e9c5e`; 0 INCONCLUSIVO de banco).

---

## F-OFFER-2 (3º elo) — PROVA-VIVA da ponte declaração→service · IA-BANCO

**HEAD no momento:** `4431b8fc` · branch `rescue-structural` · 2026-06-21 (verificado de 1ª mão por `git rev-parse`; **NÃO** confiei no `9f5e9c5e` do CONSOLIDADO — stale).
**Revalidou no vivo:** SIM — probe psql READ-ONLY em `unificard_dev` (pg_class/pg_policy/pg_constraint/pg_index/information_schema + rowcount); probes descartados; nada mutado.
**Insumo cruzado lido:** `respostas/IA-ACTOR.md` §F-OFFER-2 (VEREDITO FALTA_X — substratos prontos, ponte ausente) · `respostas/IA-AUTORIDADE.md` §F-OFFER-2 (VEREDITO FALTA_DECISAO + resíduo ramo-4 → me delegado) · `CONSOLIDADO.md` §D2/D3/roadmap.
**Caveat:** conexão `postgres` (bypassrls) ⇒ RLS inerte em runtime; reporto os flags de catálogo (verdade definitiva).

### 1. TABELA DE PROVA-VIVA (item · existe · rowcount · RLS/FK/tipo · JANELA)

| Objeto | Existe? | Rowcount | RLS (on/forced/pol) | FK / tipo (catálogo vivo) | JANELA |
|---|---|---|---|---|---|
| `actor_professional_concepts` | SIM | **1** | f / f / 0 | `concept_id→concepts(concept_id)` **NO ACTION** (fraca); `actor_id→actors` NO ACTION | **CUIDADO** (1 linha) |
| `company_concept_publications` | SIM | 0 | f / f / 0 | `concept_id→concepts(concept_id)` **NO ACTION** (fraca); `company_id→companies` NO ACTION | **GRÁTIS** |
| `tenant_concept_offerings` | SIM | 0 | f / f / 0 | (read-model derivado, D10) | **GRÁTIS** |
| `services` | SIM | 0 | f / f / 0 | `canonical_service_id→canonical_services(id)` **RESTRICT** (forte); **`canonical_service_id` NULLABLE** (concept OPCIONAL!); `service_id` NOT NULL | **GRÁTIS** |
| `service_offerings` | SIM | 0 | f / f / 0 | `canonical_service_id→canonical_services(id)` **RESTRICT** (forte) | **GRÁTIS** |
| `canonical_services` | SIM | **1** | f / f / 0 | — | **CUIDADO-leve** (1 linha) |
| `actor_capability_grants` | SIM | **0** | f / f / 0 | dormant confirmado (alinha IA-AUTORIDADE) | **GRÁTIS** |

### 2. FK + ON DELETE (confdeltype: a=NO ACTION · r=RESTRICT · n=SET NULL)
- `services.canonical_service_id → canonical_services(id)` = **RESTRICT** (`r`) — forte ✓
- `service_offerings.canonical_service_id → canonical_services(id)` = **RESTRICT** (`r`) — forte ✓
- `actor_professional_concepts.concept_id → concepts(concept_id)` = **NO ACTION** (`a`) — fraca ⚠️
- `company_concept_publications.concept_id → concepts(concept_id)` = **NO ACTION** (`a`) — fraca ⚠️
- (todas as demais FKs dos 2 substratos de declaração = NO ACTION.)

### 3. Colunas/constraints da ponte
- **`services.canonical_service_id` = NULLABLE (`is_nullable=YES`).** ⇒ o schema HOJE permite um `service` **concept-less** (sem âncora canônica). É o ponto estrutural que a ponte D3 precisa endereçar: "service concept-keyed" é hoje **OPCIONAL no banco**, não imposto. `service_id` é NOT NULL (a oferta tem id próprio sempre).
- **UNIQUE de declaração PF:** `uq_actor_professional_concepts_actor_concept` = **UNIQUE(tenant_id, actor_id, concept_id)** ✓ (1 declaração por actor+concept+tenant).
- **UNIQUE de publicação PJ:** `uq_ccp_active_company_concept` = **UNIQUE(company_id, concept_id) WHERE status='active'** ✓ (partial — 1 publicação ATIVA por company+concept; permite histórico retired).

### 4. RESÍDUO RAMO-4 (autoridade — delegado por IA-AUTORIDADE)
**Achado:** `company_users` total = **2 linhas**, **ambas** `role='owner'` + `can_manage_company=true` (1 com `is_primary=t`, 1 com `f`; ambas `is_active=t`).
Contagem do resíduo `(role='admin' OR is_primary) AND can_manage_company IS DISTINCT FROM TRUE` = **0**.
⇒ **O resíduo do ramo-4 é TEÓRICO.** O caminho legado `checkOwnership('companies')` (`is_primary`/`role='admin'`) **existe no código** (authorization.service:463-490) e *poderia* representar company-actor além de `canManageCompany`, **mas NENHUMA linha de membership hoje o explora** (0 admins/primary sem can_manage_company). Conter/fechar esse ramo na ponte = **JANELA GRÁTIS** (0 dados a migrar). Não é BLOCKER; é higiene barata agora.

### 5. RLS dos substratos (item explícito)
`actor_professional_concepts` · `company_concept_publications` · `services` = **rls_on=f / forced=f / 0 policies** (idem todos os 7). Isolamento só app-level (WHERE tenant_id). Fato de banco; política = IA-AUTORIDADE.

### VEREDITO: **PASS_PARA_GO_DE_DECISAO**

Os substratos de declaração estão **estruturalmente prontos para a ponte** e o custo de promulgá-la é ~0:
- PF (`actor_professional_concepts`, concept-keyed, UNIQUE actor+concept) e PJ (`company_concept_publications`, concept-keyed, UNIQUE active company+concept) existem, são gateados (cross-input IA-ACTOR/IA-AUTORIDADE) e carregam o `concept_id` que a régua D3 precisa.
- A espinha de destino (`services`/`service_offerings`) existe, está **VAZIA** (0 linhas) e tem FK **forte (RESTRICT)** ao `canonical_services` ⇒ **janela virgem aberta: criar a ponte é grátis agora**.
- O resíduo ramo-4 = **0** (teórico) ⇒ não bloqueia; contê-lo é grátis.

**Não é BLOCKER. É decisão (régua D3) a promulgar** — convergente com IA-ACTOR (FALTA_X) e IA-AUTORIDADE (FALTA_DECISAO).

**Inputs estruturais que a DECISÃO deve absorver (provados, não decididos por mim):**
1. **`services.canonical_service_id` é NULLABLE** → a régua precisa escolher: impor NOT NULL (schema) **ou** exigir concept no gate de app. Hoje um `service` concept-less é permitido pelo banco — fura "discovery só por concept_id" (0142) se não fechado. **Grátis fechar agora (0 linhas).**
2. **FK `concept_id→concepts` é NO ACTION** nos DOIS substratos de declaração → se concept_id é identidade da capacidade, considerar **RESTRICT** junto (alinha ao padrão de `canonical_services`). 1 linha em apc, 0 em ccp → grátis.
3. **Sem RLS** nos substratos (app-level só) — fato; decisão de hardening é de IA-AUTORIDADE/ops, não da ponte.

**STOPs (meu eixo):** READ-ONLY honrado — só catálogo/rowcount/grep; nenhum INSERT/UPDATE/DDL; nenhuma suíte; probes descartados; nada commitado. NÃO auditei oferta/discovery/availability/material/dinheiro (fora de escopo). NÃO proponho implementação. Aplicar qualquer coisa = EXECUTORA sob GO → ChatGPT → IA-YALA → Clayton. **Eu provo existência/contagem/FK/tipo/nullable/UNIQUE; a régua D3 é decisão de Clayton/donos de eixo.**

**Status: RESPONDIDO** — VEREDITO **PASS_PARA_GO_DE_DECISAO** (substratos prontos+vazios; FK destino forte; ramo-4 resíduo=0 teórico; 3 inputs estruturais para a régua). HEAD `4431b8fc`, 1ª mão.

---

## F-OFFER-3 — PROVA-VIVA do schema de `service_offerings` · IA-BANCO

**HEAD no momento:** `74a04819` · branch `rescue-structural` · 2026-06-21 (1ª mão `git rev-parse`; F-OFFER-2 promulgada = **DECISION-0144**, que pôs `service_offerings` FORA da régua 2B — F-OFFER-3 é a régua análoga da oferta).
**Revalidou no vivo:** SIM — probe psql READ-ONLY em `unificard_dev` (pg_class/pg_policy/pg_constraint/pg_index/information_schema + rowcount); probes descartados; nada mutado.
**Insumo cruzado:** `IA-OFERTA.md` §F-OFFER-3 (FALTA_DECISAO; bypass service_id; status hardcoded 'active') · `IA-AUTORIDADE.md` §F-OFFER-3 (FALTA_DECISAO; buraco company_id/professional_actor_id proveniência livre; Opção A recomendada).

### 1. TABELA DE PROVA-VIVA (item · existe · rowcount · FK/tipo/CHECK · JANELA)

| Item | Objeto | Existe? | Rowcount | FK / tipo / CHECK (catálogo vivo) | JANELA |
|---|---|---|---|---|---|
| 1 | `service_offerings` | SIM | **0** | rls=f/forced=f/0pol | **GRÁTIS** |
| 1 | `services` | SIM | **0** | rls=f/forced=f/0pol | **GRÁTIS** |
| 2 | `service_offerings.service_id` | SIM | NULL=**0** (de 0) | **is_nullable=YES**; FK→`services(service_id)` **SET NULL** (`n`) — fraca/legado, nunca populado | **GRÁTIS** tornar mandatório |
| 3 | `canonical_service_id` | — | — | →`canonical_services(id)` **RESTRICT** (`r`) — forte; NOT NULL implícito (identidade da oferta) | ok |
| 3 | `provider_actor_id` | — | — | →`actors(id)` **RESTRICT** (`r`) — forte; **NOT NULL** (âncora real do dono) | ok |
| 3 | `company_id` | — | — | →`companies(company_id)` **SET NULL** (`n`); **NULLABLE**; **sem constraint p/ provider** | confirma buraco |
| 3 | `professional_actor_id` | — | — | →`actors(id)` **SET NULL** (`n`); **NULLABLE**; sem gate | confirma buraco |
| 3 | `tenant_id` | — | — | →`tenants(id)` **CASCADE** (`c`) | ok |
| 4 | `price_cents` | — | — | **bigint NOT NULL** + CHECK **`price_cents >= 0`** | ok |
| 4 | `duration_minutes` | — | — | integer NOT NULL + CHECK **`> 0`** | ok |
| 4 | `status` | — | — | text NOT NULL + CHECK **IN (draft, active, suspended)** | ok |
| 4 | `modality` | — | — | text NOT NULL + CHECK **IN (in_person, remote, home)** | ok |
| 4 | UNIQUE | — | — | **UNIQUE(provider_actor_id, canonical_service_id)** (constraint + índice) | ok (idempotência por provider+canonical) |

### 2. `service_id` (bypass do elo 2B — prova estrutural)
- `service_offerings.service_id` **EXISTE**, **NULLABLE**, FK→`services(service_id)` **ON DELETE SET NULL** (fraca). Confirma IA-OFERTA §2: `createOffering` liga direto ao `canonical_service_id` (RESTRICT) e **nunca popula `service_id`**.
- **Custo de torná-lo mandatório:** `service_id NULL` = **0 de 0 linhas** ⇒ **GRÁTIS agora** (NOT NULL + match provider/concept = schema+writer, 0 backfill). Janela virgem aberta.

### 3. CONFIRMAÇÃO DO BURACO `company_id` (item 5)
**NÃO existe NENHUMA constraint (FK/CHECK/UNIQUE/trigger) que ligue `company_id` ao `provider_actor_id`.** O único vínculo de `company_id` é FK→`companies` **SET NULL** — atributo/proveniência, **não autoridade nem integridade-de-coerência**. ⇒ **buraco CONFIRMADO estruturalmente:** o schema permite carimbar a oferta com um `company_id` (e `professional_actor_id`) **arbitrário**, sem prova de que pertencem ao provider. Idem `professional_actor_id` (FK→actors SET NULL, nullable, sem gate). A autoridade real está **só** em `provider_actor_id` (RESTRICT, NOT NULL) + `canRepresentActor` no writer (IA-AUTORIDADE). Corrobora IA-OFERTA + IA-AUTORIDADE: **proveniência livre** → F-OFFER-3 deve **derivar `companyId` do provider server-side** e re-gatear/remover `professional_actor_id`.

### VEREDITO: **PASS_PARA_GO_DE_DECISAO**

A espinha de **preço/duração/status/modality** está **correta e constrangida no banco** (price_cents BIGINT NOT NULL CHECK≥0 · duration>0 · status enum · modality enum · UNIQUE provider+canonical) — nada a corrigir aqui. A oferta está **VAZIA (0 linhas)** ⇒ janela virgem: as duas mudanças que a régua exige são **grátis agora**:
1. **`service_id` mandatório + match provider/concept** (Opção A da IA-AUTORIDADE — herda elegibilidade 2B/0144 single-chain): hoje nullable+SET NULL+0 linhas → NOT NULL trivial (0 backfill).
2. **Fechar o buraco de proveniência** `company_id`/`professional_actor_id` (derivar/re-gatear server-side): não há constraint a remover; é régua de writer + (opcional) integridade.

**Não é BLOCKER. É régua a promulgar** (análoga à DECISION-0144), convergente com IA-OFERTA e IA-AUTORIDADE (ambas FALTA_DECISAO).

**Inputs estruturais p/ a decisão (provados, não decididos por mim):**
1. `service_id` NULLABLE + SET NULL + nunca populado → Opção A (mandatório) = grátis; eu provo o custo 0.
2. `company_id`/`professional_actor_id` = SET NULL, nullable, **sem constraint p/ provider** → buraco de proveniência confirmado; fechar server-side (schema não expressa "company do provider" via FK simples — precisa gate de app ou derivação).
3. `status` enum schema default = `draft`, mas o writer crava `active` (IA-OFERTA §1) → decisão produto active-vs-draft é de Clayton; o schema **suporta ambos**.
4. `provider_actor_id` RESTRICT+NOT NULL = âncora forte e correta — manter.

**STOPs (meu eixo):** READ-ONLY honrado — só catálogo/rowcount/grep; nenhum INSERT/UPDATE/DDL; nenhuma suíte; probes descartados; nada commitado. NÃO auditei availability/discovery/dinheiro/payout/presence (fora de escopo). NÃO proponho implementação. Aplicar = EXECUTORA sob GO → ChatGPT → IA-YALA → Clayton.

**Status: RESPONDIDO** — VEREDITO **PASS_PARA_GO_DE_DECISAO** (espinha preço/duração/status já constrangida; `service_id`-mandatório e fecho-de-proveniência grátis na janela virgem; buraco company_id confirmado). HEAD `74a04819`, 1ª mão.

---

## F-OFFER-4 — READ-FIRST BANCO (prova-viva do re-key por concept_id)

### 1. Carimbo
- **HEAD:** `f6c07742` · branch `rescue-structural` (verificado de 1ª mão por `git rev-parse`; o prompt citou `4431b8fc`, stale).
- **Banco:** `unificard_dev` (`current_database()`).
- **schema_migrations:** **400** · **disco = 400 → DRIFT=0**.
- **READ-ONLY confirmado:** só SELECT/catálogo/EXPLAIN(não-EXECUTE)/grep; nenhum INSERT/UPDATE/DDL; probes descartados; nada commitado. (Apoio paralelo via workflow READ-ONLY; **os achados que contrariavam meu estado anterior foram reconfirmados por mim de 1ª mão** antes de publicar.)
- ⚙️ **EVOLUÇÃO DE ESTADO (disco vence narrativa):** desde F-OFFER-2/3 (HEAD 4431b8fc/74a04819) duas migrations foram **EXECUTADAS** — `20260621100000_f_offer_2a_service_concept_mandatory_fk_restrict.sql` e `20260621120000_f_offer_3_service_offering_service_id_mandatory.sql`. Logo as réguas que eu havia marcado PASS_PARA_GO_DE_DECISAO **foram promulgadas e materializadas**. Minha prova de F-OFFER-2 ("`services.canonical_service_id` NULLABLE") era o **pré-estado**; hoje é **NOT NULL** (corrigido abaixo).

### 2. Tabela prova-viva

| item | rowcount/estado | prova SQL resumida | janela | observação |
|---|---|---|---|---|
| `services` | **0** | `count(*)=0` | grátis | base table única em `public` (sem homônima/view) |
| `canonical_services` | **1** | `count(*)=1` | cuidado-leve | 1 linha seed; concept_id preenchido |
| `service_offerings` | **0** | `count(*)=0` | grátis | — |
| `categories` | **147** | `count(*)=147` | cuidado | 70 com `concept_id` NULL (branches level 0/1, by design) |
| `tenant_concept_offerings` | **0** | `count(*)=0` | grátis | read-model concept-keyed vazio |
| `services.canonical_service_id` | **NOT NULL**, NULL=0/0 | `is_nullable=NO`; FK→`canonical_services(id)` **RESTRICT** (`r`); índice parcial `idx_services_canonical_service` | grátis | ⬆️ **mudou** vs F-OFFER-2 (era NULLABLE) — F-OFFER-2A tornou mandatório. 0 services invisíveis no re-key |
| `canonical_services.concept_id` | **NOT NULL**, NULL=0, órfãos=0 | FK→`concepts(concept_id)` **RESTRICT** (`r`); índice `idx_canonical_services_concept` | grátis | resolve concept_id **materialmente sem slug/category/domain** |
| `categories.concept_id` | nullable; 147 total, **70 NULL**, órfãos=0 | índice `idx_categories_concept_id` + UNIQUE parcial `ux_category_concept_scope (concept_id,scope) WHERE level=2` | cuidado | hop de LEITURA só rende em **folha (level=2)**; serviços-raiz NULL |
| FK/índices (4 colunas-chave) | **TODAS indexadas** | services.canonical_service_id ✓ · canonical_services.concept_id ✓ · categories.concept_id ✓ · tco.concept_id ✓ | grátis | nenhuma coluna do re-key sem índice |
| join `services→canonical_services→concept_id` | joinável=0/não-joinável=0 (services vazia) | EXPLAIN = Nested Loop **index-only** (idx_canonical_services_concept ▸ idx_services_canonical_service), **sem seq scan** | grátis | filtro `WHERE cs.concept_id=:resolved` viável e eficiente; **não precisa índice novo** |

### 3. Resolução da discrepância `services ~200 vs 0`
**CLASSIFICAÇÃO: erro do 1º elo** (contagem sem objeto correspondente). Evidência independente: varredura por `count(*)` exato de TODAS as tabelas `public` → **nenhuma tabela na faixa 180–220**. `services`=**0** confirmado (2 probes independentes + minha reconfirmação). Candidatos mais próximos do domínio: `concepts`=**150**, `categories`=**147** (soma=297, não ~200); `canonical_products`=35; `canonical_services`=1. **Nenhuma migration faz `INSERT INTO services`** (grep 0 matches); só scripts e2e/seed-dev (transientes). O literal "200" no `seed-dev-companies-services.ts:62` é **"capacidade para até 200 pessoas"** (descrição de salão), não contagem. **Alerta de método:** `pg_stat_user_tables.n_live_tup` está **STALE** neste banco (mostrava concepts=6/categories=0) — auditorias devem usar `count(*)` exato, nunca `n_live_tup`.

### 4. Viabilidade do re-key
- **concept_id material disponível?** **SIM.** `canonical_services.concept_id` = NOT NULL + FK→concepts RESTRICT + índice + 0 órfãos → resolve identidade canônica **sem** slug/category/domain.
- **Join é suficiente?** **SIM.** `services.canonical_service_id` NOT NULL+FK RESTRICT+índice ⇒ todo service é concept-ancorado por construção; `services JOIN canonical_services ON canonical_service_id=id` é total (0 órfãos possíveis). O EXPLAIN do filtro `WHERE cs.concept_id=:resolvedConceptId` é **index-only, sem seq scan**.
- **Precisa schema antes?** **NÃO.** O encadeamento NOT NULL+RESTRICT já foi materializado por F-OFFER-2A/3.
- **Precisa índice antes?** **NÃO.** As 4 colunas-chave já têm índice; o plano do filtro por concept_id já é index-only.
- **Há blocker?** **NÃO** no banco. A violação viva (`assertServicosCategory` filtrando por `metadata->>'domain'='servicos'`, `services-discovery.service.ts:305-322`) é **CÓDIGO** (eixo IA-DESCOBERTA-FRONT/IA-SEMANTICA) — o banco oferece a alternativa correta (`canonical_services.concept_id`).
- **`categories.concept_id` resolve filtro de leitura sem virar persistência?** **SIM, com limite:** é hop de leitura efêmero viável **apenas para categorias-folha (level=2)**; 70/147 categorias (branches level 0/1) têm `concept_id` NULL **por design**, e as categorias de serviço-raiz estão **todas NULL** (só 3 folhas `medico-*` preenchidas). ⇒ o hop navegação→concept_id cobre só a camada folha; é filtro, **NUNCA** fonte de `concept_ref` persistido (que vem só de `canonical_services.concept_id`). Cobertura esparsa = input para IA-DESCOBERTA-FRONT (resolução da entrada de navegação), **não** blocker de schema.

### 5. VEREDITO FINAL: **PASS_PARA_GO**
O schema suporta o re-key por `concept_id` **sem blocker e sem índice novo**: a cadeia `services.canonical_service_id (NOT NULL, FK RESTRICT, idx) → canonical_services.id → canonical_services.concept_id (NOT NULL, FK→concepts RESTRICT, idx) = :resolvedConceptId` é materialmente sólida, index-only no plano, e independe de slug/category/domain. `tco` é read-model concept-keyed vazio. As janelas `cuidado` (services vazia = prova por vacuidade; categories.concept_id esparso em folhas) **não são blockers de schema** — são, respectivamente, ausência-de-dado (grátis) e concern de **navegação/leitura** (eixo FRONT). Não é PASS_COM_CUIDADO_INDICE porque **nenhum índice falta**.

### 6. Próxima recomendação: **GO_DIRETO_MODO_B_SEM_DECISION_NOVA**
Do meu eixo (schema): o banco já sustenta o re-key e a régua semântica já está aprovada (IA-SEMANTICA: "nenhuma emenda normativa exigida"); **não há DECISION nova necessária por razão de schema**. A execução do re-key é **CÓDIGO** (trocar o filtro `domain='servicos'` de `assertServicosCategory` + as 3 superfícies de discovery por join em `canonical_services.concept_id`) e segue o ciclo normal **GO → ChatGPT → IA-YALA → Clayton** — não é meu ato. **Caveat para a FRONT (não-blocker):** a resolução da ENTRADA de navegação via `categories.concept_id` só funciona para folhas (level=2); serviços-raiz são NULL → a FRONT precisa de uma estratégia de resolução de entrada para não-folhas (o matching em si permanece por `canonical_services.concept_id`, intacto).

---

### CARIMBO FINAL
- **HEAD:** `f6c07742`
- **Revalidou código/schema vivo:** SIM (1ª mão — catálogo/rowcount/EXPLAIN; reconfirmei pessoalmente o NOT NULL de `services.canonical_service_id` e as 2 migrations novas, por contrariarem meu estado anterior)
- **Banco:** `unificard_dev` · schema_migrations=400 · drift=0
- **Status:** RESPONDIDO
- **Arquivos lidos:** METODO.md · IA-DESCOBERTA-FRONT.md · IA-SEMANTICA.md §F-OFFER-4 · CONSOLIDADO cadeia-de-oferta · migrations 20260621100000/20260621120000 · `services-discovery.service.ts:305-322` (via apoio)
- **SQL/probes usados:** `count(*)` exato (services/canonical_services/service_offerings/categories/tco/concepts/products/canonical_products); `information_schema.columns` (nullable); `pg_constraint` (FK+confdeltype); `pg_index`/`pg_get_indexdef`; `EXPLAIN` (não-EXECUTE) do join+filtro; `query_to_xml` varredura de counts; grep de seed. **Probes descartados; READ-ONLY estrito.**
- **Veredito:** **PASS_PARA_GO** · próxima recomendação **GO_DIRETO_MODO_B_SEM_DECISION_NOVA** (execução = código sob ciclo; caveat de navegação não-folha → IA-DESCOBERTA-FRONT).

---

## F-OFFER-5 — READ-FIRST BANCO (prova-viva do substrato temporal)

**HEAD:** `bca473fa` · branch `rescue-structural` · **banco** `unificard_dev` · 2026-06-21 · **READ-ONLY** (catálogo/`count(*)` exato/`pg_get_functiondef`; probes descartados; nada mutado). Insumo cruzado: `IA-TEMPO.md` (eixo TEMPO / §F-OFFER-5 = PARTIAL: substrato único e são; gap = garantia temporal).

### Tabela prova-viva

| # | item | estado (prova SQL) | janela |
|---|---|---|---|
| 1 | CHECK `owner_type` aplicado | `chk_availability_owner_type` VIVO = **6 tipos** (`user, service, event, group, page, service_offering`); migration `20260612110000_availability_owner_type_check.sql` em `schema_migrations`. **Fail-closed** (INSERT fora dos 6 = rejeitado por enumeração) | grátis |
| 2 | `owner_id` tem FK? | **NÃO.** Única FK de `availability` = `fk_availability_purpose_concept` (purpose_concept_id→concepts RESTRICT). `owner_id` = uuid **NOT NULL, SEM FK** → polimórfico, **0 integridade referencial**, **sem ON DELETE por tipo** (service_offering deletado deixa availability órfã) | cuidado (estrutural) |
| 3 | triggers de overlap em `availability` | **ZERO triggers** na tabela (pg_trigger não-interno = 0 linhas). **Overlap fantasma CONFIRMADO** | — |
| 3b | EXCLUDE constraint (tstzrange) | **NENHUMA** (contype='x' = 0) | — |
| 3c | índice gist/range | **NENHUM** | — |
| 4 | `detect_availability_conflicts` | **STUB** vivo: corpo `BEGIN RETURN; END;` → não detecta nada. (Call site `service.ts:184` só `owner_type='user'` = código, IA-TEMPO) | — |
| 5 | rowcount `availability` por owner_type | **`user`=48** · `page`=0 · `service`=0 · `service_offering`=0 · `event`=0 · `group`=0 · **total=48** | grátis (offer-time vazio) |
| 6 | `service` vs `service_offering` como owner | **0 × 0** linhas (nenhum dos dois owners tem dado) → ambiguidade legado×canônico é **0 em dados** | grátis |

### Achado central (garantia temporal)
**O substrato temporal NÃO tem NENHUMA garantia de overlap no nível de banco:** não há trigger, não há `EXCLUDE` constraint (tstzrange), não há índice gist/range, e o detector (`detect_availability_conflicts`) é **STUB que retorna vazio**. Logo o "fotógrafo em 2 ofertas no mesmo horário" **não é prevenido em lugar nenhum do banco** — confirma IA-TEMPO. Não é corrupção (a tabela tem só 48 agendas de `user` e **0** linhas de `service`/`service_offering`); é **ausência de mecanismo**, totalmente **grátis de endereçar na janela virgem**.

`owner_id` é **polimórfico sem FK** por design (suporta 6 tipos de owner numa coluna) — o preço é zero integridade referencial e zero `ON DELETE`; com 0 linhas de offer-owner, fortalecer/rollup é grátis agora.

### VEREDITO: **PASS_PARA_DECISAO**
O substrato temporal é **único (uma tabela SSOT `availability`)**, com `owner_type='service_offering'` **estruturalmente suportado e fail-closed** (CHECK 6 tipos aplicado), e **virgem** no que toca oferta (`service`=0, `service_offering`=0; só 48 agendas `user`). **Não é BLOCKER** para abrir F-OFFER-5. **Não é PASS limpo:** a **garantia temporal** que a oferta precisa (prevenção/alerta de overlap, rollup cross-oferta por `provider_actor_id`, integridade de `owner_id`) **não existe no banco hoje** — é régua/desenho a **DECIDIR**, tudo grátis na janela virgem (0 dados). Por isso **PASS_PARA_DECISAO**, não PASS_PARA_GO: há decisões materiais antes de executar, não só código mecânico.

**Inputs estruturais para a decisão (provados; semântica = IA-TEMPO/Clayton):**
1. **Mecanismo de overlap a escolher** — `EXCLUDE` constraint (tstzrange+GiST) **HARD-BLOQUEIA** no write, o que **colide com a Constituição Art. II** (conflito = fato→alerta→humano, NUNCA auto-bloquear/resolver — IA-TEMPO). ⇒ o caminho provável é **detector real (reativar `detect_availability_conflicts`) + emissão de FATO/alerta**, não constraint que barra. **Eu sinalizo o trade-off DB; a escolha é de IA-TEMPO/Clayton.**
2. **Rollup cross-oferta por `provider_actor_id`** — hoje cada oferta tem `owner_id` próprio e **nenhuma query/estrutura agrega o tempo das ofertas do mesmo provider**; o link offering→provider vive só na policy de autoridade. Desenhar o rollup = grátis (0 linhas).
3. **`owner_id` sem FK** — polimórfico; decidir se ganha integridade (ex.: FK condicional/validação por tipo no writer) ou permanece app-level. Grátis (0 offer-rows).
4. **Convergir owner `service`(legado)×`service_offering`(canônico)** — 0×0 em dados ⇒ conter/migrar o reader legado (`service-feed.plugin`) é grátis; nenhum dado compete.

**STOPs (meu eixo):** READ-ONLY honrado — só catálogo/`count(*)`/`pg_get_functiondef`/git; nenhum INSERT/UPDATE/DDL; probes descartados; nada commitado. NÃO auditei dinheiro/payout/ranking; NÃO proponho implementação; NÃO decido o mecanismo (Art. II = IA-TEMPO). Aplicar = EXECUTORA sob GO → ChatGPT → IA-YALA → Clayton.

### CARIMBO FINAL
- **HEAD:** `bca473fa` · **Revalidou schema vivo:** SIM (1ª mão) · **Banco:** `unificard_dev` · **Status:** RESPONDIDO
- **Arquivos lidos:** METODO.md · IA-TEMPO.md (eixo TEMPO/§F-OFFER-5) · migration `20260612110000`
- **SQL/probes:** `pg_constraint` (CHECK/FK/EXCLUDE + confdeltype) · `pg_trigger` (não-interno) · `pg_index` (gist/range) · `pg_get_functiondef` (detect_availability_conflicts) · `count(*)` exato por owner_type · `schema_migrations`. Probes descartados.
- **Veredito:** **PASS_PARA_DECISAO** (substrato único+virgem+owner=service_offering fail-closed; garantia temporal de overlap **ausente no banco** = régua a decidir, grátis na janela virgem; mecanismo constrangido por Art. II → IA-TEMPO).
