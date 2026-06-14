# 2026-06-14 — DECISION-0131 (MODO: EXECUTOR / DOCS-ONLY CARTÓRIO) — gramática de autoridade

Redige a **DECISION-0131** (DECISION-índice de **gramática de autoridade**) com base nos rulings de Clayton + 3 emendas
obrigatórias. **Docs-only:** zero código/migration/seed/RLS/cargo_templates/mapper/delegação/financial-seed/platform/
cartão. Parent `20fe30cc` · branch `rescue-structural` · dev **385/385** (inalterado).

## Contexto

Antes da redação, a Opus leu `PLANO-DEFINITIVO-0131-EXECUTORA.md`, `F-AUTHORITY-MAP-0131-v2.md` e
`DECISION-0131-INSTRUMENTO-DECISAO.md`, verificou de 1ª mão os fatos load-bearing no dev 385 (financial_approval_*=0/0/0;
3 chaves de identidade divergentes; 3 vocabulários temporais; RLS=0 nos 6 planos) e concordou com o slate recomendado,
adicionando 3 emendas. **Clayton assumiu a direção, aprovou o slate + as 3 emendas, e concedeu GO SÓ para a redação
docs-only.**

## Numeração (confirmada antes de criar)

- Maior DECISION em `docs/02_decisions/`: **0130**. **0131 livre** (sem arquivo `*0131*`; sem entrada `0131` no
  `REMEDIATION_DECISIONS_LOG.md`). Contínua, sem colisão.

## Decisão registrada (DECISION-0131)

DECISION-índice: **CITA** 0021/0042/0113/0114/0116/0119/0120/0121/0124/0125/0126/0127/0128/0129/0130 + textos soberanos
(AUTHORITY_LAW Art.1.3/11/17 · AUTHORITY_ENFORCEMENT_MODEL · 08_AUTORIDADE §10/§11 · SSOT_REGISTRY §5.16 ·
AUTHORITY_PRECEDENCE) e **PROMULGA só os 7 itens novos**:

- **B1 (=B)** cargo-template materializa grants operacionais reais (não SSOT; runtime lê só grant material ativo;
  `grant_origin` imutável; revogar cargo cascateia; alterar template não retroage; opção C indireção-viva PROIBIDA).
  **EMENDA 1:** cargo **NÃO** materializa `financial_approval_authorities` (Core-only; seed soberano PORTA-1).
- **B2 (=A)** vocabulário temporal comum por substrato (valid_from/valid_until/revoked_at/suspended_at/reason/created_by/
  revoked_by); tempo-de-autoridade≠agenda; agenda não autoriza dinheiro; `financial_approval_authorities` mantém lifecycle
  no Core; `tenant_operator_grants` ganha migration aditiva + guard de drift.
- **B3 (=A)** `actor_id` canônico na composição + mapper explícito user_id↔global_user_id↔actor_id. **EMENDA 2:** mapper é
  resolvedor de COMPOSIÇÃO; **NÃO** re-keyar o Core financeiro; `financial_approval_authorities` permanece **user_id-bound**
  (segregação requester≠approver = user-level, 0130 D3); migration de normalização de FK **exclui** o Core financeiro.
- **B4 (=confirmar)** member_status=SSOT · is_active=projeção/tombstone · role='owner'≠supergrant eterno; sequência
  obrigatória medir→backfill `can_manage_company`→flip V2→guard.
- **B5 (=A)** RLS forçada nos 6 planos de autoridade = **direção promulgada, execução FUTURA**. **EMENDA 3:** pre-flight
  **BLOQUEANTE** (validar BYPASSRLS infra + smoke worker/seed/migration sob RLS); manter guards app-level mesmo com RLS.
- **B6 (=deferir)** platform/cross-tenant deferido; sem `platform_operator_grants`; tenant-scope 0126.
- **B7 (=confirmar)** 5 estados (CANÔNICO/ADAPTADOR_TRANSITÓRIO/CONTIDO_FAIL_CLOSED/TOMBSTONE/DIVERGENTE) + hard-rule de
  jure (actorId client-declared — 5 canais 0113 + variante body — nunca autoridade; binding canRepresentActor obrigatório;
  assertActorRepresentable não-removível; swap do stub `actor_has_permission` travado por guard; seed de 1ª authority/
  delegation/RBAC = ato soberano).

## Cartório atualizado

- `docs/02_decisions/DECISION_0131_AUTHORITY_GRAMMAR.md` (NOVO).
- `REMEDIATION_DECISIONS_LOG.md` (+entrada append-only DECISION-0131).
- `STATUS_EXECUCAO_GLOBAL.md` (+seção docs-only no topo).
- `docs/03_execution_log/20260614_DECISION_0131_AUTHORITY_GRAMMAR.md` (este arquivo).

## Hard stops (docs-only)

Zero código/migration/seed/RLS aplicada/cargo_templates/mapper/delegação viva/financial seed/platform authority/cartão.
Nenhum `.ts/.mjs/.sql/.json/package` alterado; `git diff --check` limpo; **dev migrations 385/385 inalterado**. As âncoras
0013→0130 são **citadas, não reescritas**.

## Ressalvas

Execução de cada item §B = frente futura própria (sob GO + tripé guard/negative-proof/e2e). Seed (PORTA-1/2/3) e cartão
(≥0132) = atos soberanos próprios. A higiene cartorial A1 (header LOG "0116" stale, citação §10.2, backfill index
0128–0130 em DECISOES.md) **não** entrou neste GO (frente independente própria).

## Estado

DECISION-0131 **PROMULGADA / NORMATIVA — HOLD PARA RESEAL**. Gramática de autoridade definida; execução dos itens §B =
frentes futuras gated. Sem runtime nesta frente. Próxima: Yala reseal.
