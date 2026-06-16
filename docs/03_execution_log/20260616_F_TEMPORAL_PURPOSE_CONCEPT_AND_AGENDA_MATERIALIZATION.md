# 2026-06-16 — F-TEMPORAL-PURPOSE-CONCEPT-DECISION + F-AGENDA-PURPOSE-CONCEPT-MATERIALIZATION

Finalidade temporal da agenda pessoal ("para que serve este tempo do actor") materializada como **CONCEPT** em
`availability.purpose_concept_id`. Macrofrente em **2 fatias / 2 commits** (ordem causal: DECISION docs-only ANTES
de qualquer alteração material). Parent `c2301b24` · branch `rescue-structural` · dev **387 → 389** (2 migrations).

## Pré-flight

HEAD `c2301b24` · branch `rescue-structural` · dev 387 · superfícies da frente (DECISIONS_LOG/DT_LOG/STATUS/
normativos/`core/availability`/frontend agenda/migrations) **LIMPAS**. Dirt = baseline conhecido (memorias +
`backend/tmpschema.ts` untracked, fora da frente). Reportado; git add específico isola.

## STOP normativo (READ-FIRST) — por que NÃO um domínio N0 `tempo-e-finalidade`

O desenho inicial (e a ratificação anterior) propunha um domínio N0 `tempo-e-finalidade`. O READ-FIRST de
`18_DOMAIN_ONTOLOGY_UNIFICARD.md` provou que isso **viola norma CONGELADA**: §7 "lista **fechada** de 12 domínios";
§11 "N0 core — ESTÁVEL, exige RFC excepcional"; §3 finalidade falha o critério de domínio (é classificador, não
entidade/ciclo); §8.2 precedente `causas-sociais` resolve "finalidade" como **dimensão transversal + atributo**, não
domínio. ⇒ **PAREI** e reportei a IA Diretora com 3 opções. Clayton **ratificou (ADENDO) a Opção 1**: os 4 concepts
moram em domínios N0 **naturais** existentes; o domínio do concept **não é limite de matching**; finalidade é
coarse-grained ≠ categoria comercial. (Mediu-se divergência contra a norma, não preferência.)

## FATIA 1 — COMMIT 1 (`db8829ec`, docs-only)

**DECISION-0132** PROMULGADA: `docs/02_decisions/DECISION_0132_TEMPORAL_PURPOSE_CONCEPT.md` + entrada em
`REMEDIATION_DECISIONS_LOG.md`. Define: finalidade = CONCEPT em `availability.purpose_concept_id`; 4 concepts
coarse-grained; SEM novo domínio N0 (concepts em domínios naturais); booking inicial (trabalho/NULL bookáveis,
estudo/cuidados/lazer protegidos); validação backend (slug=declaração → concept_id server-side); finalidade ≠
categoria comercial; matching deferido; proibição de metadata/enum solto/estado visual. Zero migration/runtime/seed.

## FATIA 2 — COMMIT 2 (materialização)

- **M1** `20260616120000_seed_concepts_temporal_purpose.sql`: seed governado (`set_config('app.concept_governance')`,
  `ON CONFLICT DO NOTHING`) dos 4 concepts em domínios naturais (trabalho→`servicos`, estudo→`educacao-e-conhecimento`,
  cuidados-pessoais→`saude-e-bem-estar`, lazer→`cultura-lazer-e-eventos`). Sem `INSERT INTO domains`.
- **M2** `20260616120100_availability_purpose_concept_id.sql`: `ADD COLUMN purpose_concept_id UUID NULL REFERENCES
  concepts(concept_id) ON DELETE RESTRICT` + índice `(tenant_id, purpose_concept_id)`. Sem `is_bookable`, sem backfill.
- **Resolver/política** (`temporal-purpose.ts`): pares canônicos `(slug, domain)` + bookability (só `trabalho`) +
  resolvers slug↔concept_id (cache só quando completo) + `getProtectedPurposeConceptIds` + `listTemporalPurposes`.
- **R1** (materializer + routes + repo + types): payload `purposes` por faixa; zod `z.enum` dos 4 (slug inválido →
  400); materializer resolve slug→concept_id server-side e grava `purpose_concept_id` por janela (+ **atualiza no
  mesmo horário quando a finalidade muda** — não dá recibo falso); read-back via `GET /availability` (+ campo
  `purposeConceptId`) e `GET /availability/temporal-purposes`.
- **R2** gate em `createBooking`: se `purpose_concept_id` ∈ protegidos → 400 `AVAILABILITY_PERSONAL_PROTECTED`;
  trabalho/NULL permitidos. Bookability DERIVADA da finalidade (sem coluna `is_bookable`); availability segue blindada.
- **F1** (frontend): seletor de 4 finalidades (resolvido do backend, `fetchTemporalPurposes`) por faixa; envia
  `purposes` no save (contrato `onSave` honesto da frente anterior preservado, agora `(schedule, purposes)`);
  read-back reconstrói finalidade por faixa; blocos protegidos marcados "🔒 não-bookável".

## Provas

| Prova | Resultado |
| --- | --- |
| backend typecheck (build) | **25** (baseline, 0 atribuível) |
| frontend typecheck | **0** |
| e2e efêmero `validate-pipeline-e2e-temporal-purpose.ts` | **15/15** |
| guard `audit-temporal-purpose.mjs` (no chain) | GATE OK |
| negative-proof | **6 mordidas** byte-idêntico (coluna/FK/seed/gate/materializer/zod/is_bookable) |
| validate:regression-guards | rc=0 (+1 guard; availability-family reclassificada) |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |
| migrations | dev 387 → 389 (idempotentes, forward-only) |

e2e cobre: governança bloqueia INSERT cru em `concepts`; 4 concepts em domínios naturais; persiste finalidade por
janela; read-back por faixa via GET; booking trabalho/NULL = 201; estudo/cuidados-pessoais/lazer = 400 protegido;
slug fora dos 4 = 400; FK RESTRICT bloqueia delete de concept em uso; mudança de finalidade no mesmo horário persiste.

## DT / NÃO TOCADO

- **DT-AGENDA-CONTEXT-WORK-LEISURE-STUDY-NOT-PERSISTED → CLOSED/materializada.**
- **NÃO tocado:** matching/social/promo · preço/desconto/estoque/serviço · Bank/ledger/payout/split/recovery ·
  schedules/schedule_slots/calendar_events · E1/E2/B1f · ontologia N0 §7 (zero emenda à seção CONGELADA).

## Estado

**IMPLEMENTED / HOLD PARA RESEAL.** Fecha SÓ como **F-TEMPORAL-PURPOSE-CONCEPT-DECISION +
F-AGENDA-PURPOSE-CONCEPT-MATERIALIZATION**: finalidade temporal é CONCEPT em `availability.purpose_concept_id`
(FK RESTRICT, sem is_bookable, sem metadata); 4 concepts governados em domínios N0 naturais (sem novo domínio N0);
estudo/cuidados/lazer não-bookáveis por padrão; trabalho/NULL bookáveis; SSOT temporal segue `unified_availability`;
CONCEPT governa a semântica; matching/social/promo fora. dev 389.
