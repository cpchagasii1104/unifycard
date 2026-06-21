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
