# CONSOLIDADO — frente CADEIA-DE-OFERTA (IA-DIRETORA)

**HEAD vivo:** `9f5e9c5e` · branch `rescue-structural` · **Atualizado:** 2026-06-20 (pós-Rodada 7 / 6 instâncias)
**Local:** `docs/orquestracao/processo/cadeia-de-oferta/` (migrado da raiz no fecho da Rodada 7). Globais: `../../README.md` + `../../METODO.md`. Conhecimento destilado: `../../sistema/<etapa>/`.
> Só a IA-DIRETORA escreve. Snapshot do estado VIVO + ledger de fatias fechadas. Não é log.

## LEDGER — MACRO 1 (cabeça da orquestração · CLOSED/PROMULGADA)
- **U1** `2a0d3c21` — `concept_relations.relation_type` 3→6 (CHECK vivo). YALA PASS.
- **A1** `6c93c648` — reindex `DECISOES.md` 0112→0141. YALA+DOCS+DT PASS.
- **U1b** `9f5e9c5e` — seed árvore-piloto `festa-de-casamento` (reuso) + **DECISION-0142** (folha-SSOT-global: casar por `concept_id`, nunca por `domain`). YALA PASS. Próximo nº DECISION livre = **0143**.

---

## RODADA 7 — F-PROFILE-PJ-OFFER-CONFIGURATION-READINESS · CONSOLIDADA (6/6 responderam)

**Pergunta central:** onde o actor declara "eu faço isso", e isso converge para `CONCEPT→SERVICE→SERVICE_OFFERING→AVAILABILITY` sem verdade paralela?
**Resposta:** **CONVERGE — e fechar é de BAIXO CUSTO agora** (janela virgem; "defeitos de planta-baixa, sem vítimas" — registrado no G10). A espinha canônica existe, é concept-keyed, é gated e está **VAZIA (virgem)**. Os "paralelos" são em grande parte **schema-ghosts** (código órfão do banco pós-genesis) ou substrato **dormant**. ⇒ veredito de prontidão = **PASS_TO_CONVERGENCE** (IA-BANCO). **Barato ≠ executar tudo junto** (guard ChatGPT 2026-06-21).

### Veredito por eixo
| Instância | Veredito | Essência |
|---|---|---|
| IA-ACTOR | PARTIAL | espinha PF limpa (`actor_professional_concepts.concept_id`, gated, sem preço); ponte declaração→oferta ausente |
| IA-OFERTA | BLOCKER→(reavaliado) | espinha concept-keyed limpa; ponte ausente; discovery viola 0142; publications PJ reconciliam |
| IA-AUTORIDADE | PARTIAL | gates canônicos certos (canRepresentActor / canManageCompany+KYB); 2 rotas "produto permite, autoridade não prova"; oferta não prova capacidade declarada; `actor_capability_grants` dormant (allowlist já tem `services:create/edit/disable`) |
| IA-TEMPO | PARTIAL | tempo = SSOT único (`availability`); conflito cross-oferta do MESMO provider = GAP; `detect_availability_conflicts` = STUB; `professional_profile.availability` declarativo nunca materializado |
| IA-COMERCIO | PARTIAL | estoque sólido (append-only); catálogo/oferta-produto = 3 SSOTs + `product_concepts` paralelo + não-concept-keyed; service×material = greenfield; **SLOT** = gancho concept-keyed no service_offering |
| IA-BANCO | **PASS_TO_CONVERGENCE** | provou tudo no vivo; espinha existe+vazia+FK forte ⇒ convergência grátis; corrigiu premissas (abaixo) |

### Correções de premissa pela prova-viva (DISCO VENCE NARRATIVA — IA-BANCO)
1. **`user_skills_categories` e `human_mvp_service_offers` = TABELAS AUSENTES.** Não são "paralelos vivos com dados" — são **SCHEMA-GHOSTS**: as rotas `POST /categories/assign-skill` (faz `INSERT`→42P01) e `/human-mvp` estão **MONTADAS**, mas as tabelas não existem (genesis dropou). ⇒ conter/re-acoplar = **grátis**.
2. **Espinha canônica EXISTE e VAZIA:** services/service_offerings/company_concept_publications/tenant_concept_offerings = **0 linhas**; `canonical_services`=1; `actor_professional_concepts`=1. ⇒ convergência = janela virgem **aberta**.
3. **FK:** `→canonical_services` = RESTRICT (forte) ✓; `service_offerings.service_id→services` = SET NULL (legado); `actor_professional_concepts.concept_id→concepts` = **NO ACTION (fraca)** ← fortalecer.
4. **Tempo:** tabela viva = **`availability`** (não `unified_availability`); 48 linhas TODAS `owner_type='user'` (zero `service_offering`); `detect_availability_conflicts` = STUB. ⇒ ambiguidade owner `service`×`service_offering` é **0×0 em dados** = grátis convergir.
5. **Material:** `product_offers.price_cents` JÁ é **BIGINT** (o "NUMERIC/RFC-003" era stale); `product_concept_id` não existe; `tenant_products`/`product_concepts`/`catalog_products` AUSENTES; `canonical_products`=35. ⇒ o "drift monetário" do produto está **resolvido**; os "3 SSOTs" são em grande parte ghosts.
6. **Higiene:** `actor_capability_grants`=0 (dormant); **drift migration=0** (398=398; `db_role_rls_hardening` aplicada).

### Leitura FORWARD + REVERSE (`4<3<2<1`)
**Forward (o que é):** SEMÂNTICA (concepts + 0142 ✓) → ACTOR (`actor_professional_concepts.concept_id` gated ✓) → AUTORIDADE (canRepresentActor/canManageCompany ✓; 2 ghost-holes) → TEMPO (`availability` owner=`service_offering` canônico, mas 0 rows + detector stub + gap cross-oferta) → ESTADO/oferta (`service_offerings` concept-keyed, vazio, **ponte ausente**) → FINANCEIRO/EVENTO (fora desta frente).
**Reverse (a fundação que sustenta):** para um serviço **contratado+pago confiável (4)** existir, precisa de ESTADO real (3) ← AUTORIDADE que prove representação **E capacidade declarada** (2, = a PONTE) ← concept existe + actor declarou (1). **As rachaduras estão embaixo (camadas 1-2-3):** ponte ausente, ghost-holes, discovery por category, conflito cross-oferta, detector stub. **Todas baratas agora (virgem).**

### BLUEPRINT — F-OFFER-SSOT-CONVERGENCE (cirurgia macro na janela virgem)
_Escopo deliberado, ratificável; cada peça = fatia provada+ratificada+resealada. Custo ~0 (tabelas vazias/ausentes)._
1. **Re-acoplar os 2 ghosts (NÃO amputar — diretriz Clayton):** o intento de `assign-skill` ("eu faço skill") e de `human-mvp` (matching person↔serviço) flui para a espinha canônica (`actor_professional_concepts` PF / `service_offerings`+concept), não para tabela própria. O código carrega lógica pensada → **re-acoplar à verdade única**, não deletar.
2. **PONTE declaração→oferta:** criar `service_offering` exige prova de capacidade declarada (`actor_professional_concepts` PF / `company_concept_publications` PJ). Gate novo; barato (vazio).
3. **Discovery re-key por `concept_id`** (0142): `discoverServices`/`services-discovery`/`human-mvp-matching` param de casar por `category/domain`. Sem dados de discovery vivos.
4. **Owner único da oferta-tempo = `service_offering`;** conter reader legado `owner_type='service'` (service-feed). 0×0 rows = grátis.
5. **Conflito cross-oferta do provider:** desenhar rollup por `provider_actor_id` + reativar `detect_availability_conflicts` como **FATO→ALERTA→HUMANO** (Const. Art. II), **proibido auto-resolver**. (stub→real, escopado.)
6. **Fortalecer FK** `actor_professional_concepts.concept_id→concepts` NO ACTION→RESTRICT (alinhar ao padrão canônico).
7. **SLOT de previsão (IA-COMERCIO):** reservar no contrato do `service_offering` um gancho **nullable/aditivo/concept-keyed** (FK→`concepts`) de "material exigido". **Só desenho**; resolve quando o material convergir para `concepts` (frente própria).

### DECISÕES D1–D4 — RATIFICADAS (Clayton + ChatGPT APPROVED_WITH_GUARDS · 2026-06-21)
- **D1 — Destino dos ghosts = RE-ACOPLAR.** assign-skill/human-mvp não são amputados (carregam intenção de produto válida), MAS: ghost vira **canal de entrada** para a espinha canônica **OU** fica **501 explícito com plano de re-acoplamento**. NUNCA tabela fantasma · NUNCA INSERT em tabela ausente · NUNCA verdade paralela.
- **D2 — NÃO é um SSOT único** ("eu faço isso" mistura camadas). Separação ratificada (cadeia `CONCEPT→SERVICE→SERVICE_OFFERING→AVAILABILITY`):
  1. **Declaração de capacidade (declara/qualifica):** PF→`actor_professional_concepts` · PJ→`company_concept_publications`.
  2. **Capacidade operacional descobrível:** `services`.
  3. **Oferta contratável (vende):** `service_offerings` (preço/duração/status).
  4. **Disponibilidade real (prova tempo):** `availability` owner=`service_offering`.
- **D3 — Ponte = oferta EXIGE declaração prévia (híbrido).** Declaração pode **sugerir** oferta na UX; backend só permite service/offering se houver **concept_id canônico + autoridade server-side + declaração/capacidade anterior**. Produto ajuda, não manda (camada mais fraca; não suaviza restrição superior). `actionContext.actorId` nunca é autoridade.
- **D4 — NÃO executar os 7 juntos.** Fatiar (abaixo).

### ROADMAP F-OFFER (fatiado · ratificado D4)
- **F-OFFER-0** — contrato de vocabulário/decisão curta (declaração · service · service_offering · publication · availability) = candidata a **DECISION-0143** (só norma, sem código).
- **F-OFFER-1** — re-acoplar/conter ghosts: assign-skill e human-mvp **sem 42P01 e sem tabela fantasma** (canal de entrada OU 501 explícito + plano).
- **F-OFFER-2** — ponte declaração→service: criar `service` exige `concept_id` + autoridade + declaração/capacidade.
- **F-OFFER-3** — `service_offering`: oferta concreta exige service canônico + preço/duração/status corretos.
- **F-OFFER-4** — discovery re-key: busca por `concept_id`, nunca por category/domain.
- **F-OFFER-5** — availability owner: agenda da oferta converge para `service_offering`.
- **F-OFFER-6** — conflito cross-oferta: provider não aparece livre em 2 ofertas no mesmo horário se a execução física conflitar.
- **FORA da 1ª macro:** slot material concept-keyed · produto/estoque/óleo/peça · presença · dinheiro/payout · RFQ complexo · engine universal · obra multi-etapa. → **F-MATERIAL-CONVERGENCE = frente própria futura.**

### GUARDS obrigatórios (ChatGPT)
não criar verdade paralela · não filtrar matching por `concept.domain` · não usar category como identidade semântica · `actionContext.actorId` nunca é autoridade · não inferir disponibilidade fora do SSOT temporal · não tocar dinheiro · não abrir payout · não abrir presença.

### FORA de escopo (frentes próprias — não pegam carona)
- **F-MATERIAL-CONVERGENCE** (3 tabelas de produto + `product_concepts`→`concepts`) — F-OFFER só reserva o slot.
- **F-PRESENCE-SSOT-DECISION-PACK** · **DINHEIRO/payout** (três paralelas) · **DT-mãe 0113 / R2 / FASE 6** (congelados) · **DRIFT-1/RLS ops** (ato operacional de Clayton).

## STATUS DA FRENTE
**Rodada 7 = FECHADA.** ChatGPT+Clayton: **APPROVED_WITH_GUARDS** · **PASS_TO_CONVERGENCE = SIM** · **PASS_TO_EXECUTION amplo = NÃO**. D1–D4 ratificadas (acima).
- **F-OFFER-0 = CLOSED / PROMULGADA** · commit **`8259dfee`** · DECISION-0143 (docs-only; não tocou runtime/migration/backend/frontend/01_normative). Pacote = 4 arquivos de cartório.
- **F-OFFER-1 = CLOSED / PROMULGADA** · commit **`d9dcb1ef`** (3 arquivos: categories.routes.ts + audit-assign-skill-ghost-containment.mjs + package.json; `REMEDIATION_DT_LOG.md` excluído). Só `assign-skill` era ghost vivo (human-mvp já contido R8N). POST /categories/assign-skill → 501 `ASSIGN_SKILL_LEGACY_RECOUPLE_PENDING` antes do sink (conter ≠ matar; replacement `/profile/professional/c1/concepts`; service intocado). Guard `audit-assign-skill-ghost-containment.mjs` (negative-proof morde). Ciclo: EXECUTADO → YALA FAIL (literal token +3 architectural) → REMEDIADO (Opção A) → **YALA re-reseal PASS** → promulgado. Gates: typecheck 34 · regression-guards EXIT 0 · architectural critical_new=0.
### F-OFFER-2 — READ-FIRST curto CONSOLIDADO (3 elos · 2026-06-21 · HEAD `4431b8fc`)
Sequencial-dependente: IA-ACTOR **FALTA_X** · IA-AUTORIDADE **FALTA_DECISAO** · IA-BANCO **PASS_PARA_GO_DE_DECISAO**. Convergência: substratos de declaração prontos+concept-keyed+gated; espinha de destino vazia + FK forte ⇒ **ponte barata agora**; o que falta é **régua (D3) a promulgar**, não bug.
**GAP central:** `createService` gateia só por `canRepresentActor` (=`canManageCompany` p/ company) — **não exige declaração/publicação nem KYB** → bypass KYB-transitivo (service de company é descobrível sem o rigor do publish).

**DECISÃO PENDENTE — régua D3 (Clayton → ChatGPT):**
- **D3-1 (núcleo, a ponte):** `createService` passa a EXIGIR declaração/publicação **active** do concept — PF: `actor_professional_concepts`; PJ: `company_concept_publications` (fecha o bypass KYB-transitivo). Declaração = INSUMO **somado** ao gate vivo, nunca substitui.
- **D3-2:** fechar `services.canonical_service_id` NULLABLE → service **concept-mandatory** (alinha 0142). Grátis (0 linhas).
- **D3-3:** regra de mapeamento "concept declarado ⊇ concept do `canonical_service`".
- **D3-4 (escopo):** caso **operador** entra agora via `actor_capability_grants` (`services:create`; ativar dormant = migration+DECISION+reseal) OU só PF + PJ-dono primeiro?
- **D3-5 (produto):** PF "service descobrível" exige análogo de verificação/permissão-para-operar além de declaração, ou `canRepresentActor`+declaração basta?
- **D3-6 (higiene barata):** FK `concept_id→concepts` NO ACTION→RESTRICT (2 substratos) + conter ramo-4 legado (is_primary/role='admin', 0 linhas) → company-actor = exatamente `canManageCompany`. Ride-along ou fatia própria de autoridade?
**Recomendação:** 1ª fatia mínima = D3-1 (PF + PJ-dono, fechando bypass) + D3-2 + D3-3. Operador (D3-4) e análogo-PF (D3-5) = decisões/fatias próprias. Higiene (D3-6) = barata, ride-along OU fatia de autoridade.
**EXECUÇÃO:** **DECISION-0144 PROMULGADA** (`eded4c05`, docs-only, régua D3). **F-OFFER-2A CLOSED/PROMULGADA** (`740be591`): `services.canonical_service_id` **NOT NULL** + FK `concept_id→concepts` **RESTRICT** (apc/ccp) + guard `audit-service-concept-mandatory-fk-restrict.mjs` (migration id 402; schema_migrations=399; drift 0). Migration paranoica (preflight fail-closed, sem DROP CASCADE, idempotente); NPs mordem; **IA-YALA reseal PASS**. **F-OFFER-2B CLOSED/PROMULGADA** (`d2cf007c`, MODO B + promulgação condicional): `createService` exige declaração/publicação ACTIVE do mesmo `concept_id` (PF `actor_professional_concepts.is_active` / PJ `company_concept_publications.status='active'`), SOMADO ao `canRepresentActor`; 403 controlado (DECLARATION/PUBLICATION/SUBJECT); guard `audit-createservice-eligibility.mjs`. **IA-YALA PASS 8/8** (end-to-end na função-gate real). **F-OFFER-2 COMPLETA** (0144 + 2A + 2B).

### F-OFFER-3 — READ-FIRST curto CONSOLIDADO (3 elos · 2026-06-21 · HEAD `74a04819`)
IA-OFERTA **FALTA_DECISAO** · IA-AUTORIDADE **FALTA_DECISAO** · IA-BANCO **PASS_PARA_GO_DE_DECISAO**. Convergência: preço/duração/status já constrangidos no banco; autoridade de origem sólida (`canRepresentActor`=`canManageCompany` p/ PJ; edição own-only); espinha vazia (service_offerings=0) ⇒ régua barata. **GAP central:** `createOffering` BYPASSA `services` (liga direto ao canonical; `service_id` nunca populado) → a elegibilidade do 2B NÃO protege a oferta (provider oferta concept não declarado só com `canRepresentActor`). **Buraco de proveniência:** `company_id`/`professional_actor_id` do body, SET NULL, sem constraint p/ provider → mis-attribution.
**DECISÃO PENDENTE — régua D (Clayton → ChatGPT; análoga à 0144):**
- **D-F3-1 (binding · núcleo):** oferta exige `services.service_id` válido do **MESMO provider + MESMO concept** (**Opção A**, recomendada pelas 3 — herda elegibilidade 2B single-chain) **vs** Opção B (re-check próprio). `service_id` → NOT NULL + match (grátis, 0 linhas). `canRepresentActor(provider)` SEMPRE permanece.
- **D-F3-2 (proveniência):** **derivar `company_id` do provider server-side** (não do body) + re-gatear ou remover `professional_actor_id` (fecha buraco G2).
- **D-F3-3 (produto):** oferta nasce `active` (hardcode atual) **vs** `draft`?
- **FORA:** operador via grants · cascata KYB-revoga→retira-oferta (sinalizada) · availability · discovery · dinheiro · presença.
**Recomendação:** régua = **DECISION-0145**; 1ª fatia = D-F3-1 (Opção A) + D-F3-2 (proveniência), MODO B (3A schema `service_id` NOT NULL + 3B runtime: createOffering exige service válido match provider/concept + deriva company_id server-side). D-F3-3 = decisão de produto na mesma régua.
**F-OFFER-3 CLOSED/PROMULGADA** (DECISION-0145 `d100186c` + material `49f54491`, MODO B + promulgação condicional): `createOffering` exige/resolve um `service` válido do mesmo provider+canonical (0→403 REQUIRES_SERVICE · >1→409 AMBIGUOUS), popula `service_id`, deriva `company_id` server-side (body não autoriza), professional do body ignorado, nasce `draft`; herda a elegibilidade 2B do service (single-chain); `canRepresentActor` permanece. Schema: `service_offerings.service_id` NOT NULL + FK→services RESTRICT. Guard `audit-service-offering-binding.mjs`. **IA-YALA PASS 8/8** (createOffering end-to-end na função real). **CADEIA CONCEPT→SERVICE→SERVICE_OFFERING COMPLETA** (0143/0144/0145).

**F-OFFER-4 V1 CLOSED/PROMULGADA** (`c0cbec5f`, MODO B + promulgação condicional, sem DECISION nova): as 2 superfícies READ de discovery de serviços (`services-discovery.service.search` + `services.service.discoverServices`→`/services/discover`) casam por **concept_id** (JOIN `canonical_services`); resolvem `category→concept` (hop de leitura efêmero; V1 exige folha; não-folha→403 `CATEGORY_REQUIRES_LEAF_CONCEPT`); nunca category/domain como identidade; nunca persistem concept_ref. **Reuso cross-domain provado** (invariante 0142). `marketplace-search` (category-tree) + `assertServicosCategory` (write-path) **INTOCADOS** (frentes próprias). Guard `audit-discovery-concept-rekey.mjs`. **IA-YALA PASS 6/6** (search/wrapper end-to-end na função real). **Resíduos não-bloqueantes (V2/futuro):** `/services/discover` sem `category` faz listagem ampla geo (não fere régua — category não é identidade); guard do wrapper sem checagem positiva "passa conceptId" (hardening). **Próximo: F-OFFER-5** (availability owner=`service_offering`) = **HOLD**. F-OFFER-6 = HOLD. Achados destilados em `../../sistema/<etapa>/`.

**F-OFFER-5/6 CLOSED/PROMULGADA** (DECISION-0146 `af1d4291` + material `28175ae1`, MODO C / promulgação manual): integridade temporal da oferta. `availability`=DECLARAÇÃO (overlap=alerta/Art. II, sem hard-block); `booking` confirmado=COMPROMISSO → `confirmBookingWithProviderLock` recusa (409 `BOOKING_PROVIDER_TIME_CONFLICT`) 2º booking do mesmo `provider_actor_id` em status {confirmed,checked_in,checked_out} com intervalo `[start,end)` sobreposto (back-to-back livre; self excluído; rollup cross-oferta por provider); `pg_advisory_xact_lock(tenant:provider)` + checagem+gravação na mesma transação. Provider/intervalo derivados server-side (nunca body). `service-feed` contido (G6). Guard `audit-booking-provider-conflict.mjs`. **IA-YALA PASS 6/6 · corrida 8/8 exactly-one.** Resíduo: índice parcial opcional em `bookings` (perf, virgem). **CADEIA DE OFERTA FECHADA ATÉ O PONTO TEMPORAL** (CONCEPT→SERVICE→SERVICE_OFFERING→DISCOVERY→AVAILABILITY/BOOKING-INTEGRITY).
- **Pendência cartorial (commit próprio):** `REMEDIATION_DT_LOG.md` carry-over (DT-A1-CARTORIO-0119-0120 + DT-DRIFT1-RLS-HARDENING) + entrada STATUS de F-OFFER-1 — commit cartorial separado quando Clayton autorizar.

## STOPs vivos
DT-mãe 0113 OPEN · money não pega carona · oferta não nasce sem capacidade declarada · discovery só por concept_id · preço só `service_offerings.price_cents` BIGINT · nada de auto-resolver conflito de agenda · re-acoplar ≠ amputar (diretriz Clayton).
