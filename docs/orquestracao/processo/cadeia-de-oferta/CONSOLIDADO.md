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
- **Próximo elo:** F-OFFER-2 (ponte declaração→service) — **HOLD** até novo GO. F-OFFER amplo = HOLD. Achados destilados em `../../sistema/<etapa>/`.
- **Pendência cartorial (commit próprio):** `REMEDIATION_DT_LOG.md` carry-over (DT-A1-CARTORIO-0119-0120 + DT-DRIFT1-RLS-HARDENING) + entrada STATUS de F-OFFER-1 — commit cartorial separado quando Clayton autorizar.

## STOPs vivos
DT-mãe 0113 OPEN · money não pega carona · oferta não nasce sem capacidade declarada · discovery só por concept_id · preço só `service_offerings.price_cents` BIGINT · nada de auto-resolver conflito de agenda · re-acoplar ≠ amputar (diretriz Clayton).
