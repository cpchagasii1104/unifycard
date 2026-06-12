# 2026-06-12 — F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE

GO corretivo OPERACIONAL final da IA Diretora após o re-reseal Yala:
**mídia V2 PASS MATERIAL · temporal D2 PASS MATERIAL** · único bloqueador
`MIGRATION-STOP-BEFORE-PRODUCTION-TRUNCATION`.

## Âncora

- Parent: `5d6f8a7a` · branch `rescue-structural` · dev `unificard_dev` 376/376 (intocado).
- Commit único corretivo (sem migration nova, sem DECISION nova).

## Causa-raiz provada (Yala, sob NODE_ENV=production)

O guard `MIGRATION_STOP_BEFORE` (criado como test-tooling do e2e de backfill na frente V2)
vivia no runner PRODUTIVO `core/db/migrate.ts`:
- variável apontando para migration existente ⇒ runner parava ANTES dela, **exit 0**,
  mensagem "todas as migrations executadas";
- variável com filename inexistente ⇒ podia aplicar ZERO migrations, **exit 0**, "nada a fazer".
Schema INCOMPLETO tratável como deploy bem-sucedido.

## Correção (decisão diretorial §1: mecanismo NÃO existe no runner produtivo)

1. **`core/db/migrate.ts` purificado** — `MIGRATION_STOP_BEFORE` removido integralmente
   (símbolo + interpretação). Semântica operacional ÚNICA: descobrir todas as pendentes →
   validar sequência → aplicar TODAS em ordem → falhar em qualquer erro → **VERIFICAÇÃO FINAL
   FAIL-CLOSED** (pendentes recalculadas do DISCO + schema_migrations DEPOIS da execução;
   `pending > 0 ⇒ exit 1` com lista) → mensagem de sucesso total ÚNICA e somente após
   pending = 0. Variáveis desconhecidas não influenciam o comportamento. (Não é um
   `if NODE_ENV !== production` — o mecanismo deixou de existir.)
2. **`core/db/migration-runner-core.ts` (NOVO)** — primitivas compartilhadas
   (enumeração/sort, profile, forward-only/schema_version, transação+checksum,
   ensure/executed) extraídas como FONTE ÚNICA entre runner e tooling — sem duplicar o
   migrador e sem truncamento em nenhum entrypoint.
3. **`src/scripts/test-support/apply-migrations-before-for-test.ts` (NOVO, test-only)** —
   prepara DB efêmera no estado anterior a uma migration. Exige SIMULTANEAMENTE:
   `NODE_ENV=test` · `EXPECTED_DATABASE_NAME` (≠ `unificard_dev`; nome materialmente
   efêmero test|e2e|ephemeral|backfill) · `current_database() == EXPECTED` · target por
   **FILENAME EXATO** (igualdade estrita; ocorrência única; pendente; nenhuma posterior
   aplicada — proibido prefixo/substring/localeCompare). Recusas fail-closed ANTES de aplicar
   qualquer migration: TEST_ENV_REQUIRED · EXPECTED_DB_REQUIRED · DEV_DB_REFUSED ·
   EPHEMERAL_NAME_REQUIRED · DB_NAME_MISMATCH · TARGET_REQUIRED · TARGET_MALFORMED ·
   TARGET_NOT_FOUND · TARGET_AMBIGUOUS · TARGET_NOT_IN_PROFILE · TARGET_ALREADY_APPLIED ·
   POSTERIOR_ALREADY_APPLIED. Saída inequívoca: `TEST DATABASE PREPARED BEFORE <migration>`
   + banco alvo + aplicadas + parada + intencionalmente pendentes — NUNCA a mensagem de
   sucesso total produtiva.
4. **E2E de backfill adaptado** — preparação via tooling test-only; etapa final via runner
   PRODUTIVO REAL (prova preparação histórica E atualização produtiva na mesma jornada).

## Provas

| Prova | Resultado |
| --- | --- |
| e2e NOVO `validate-pipeline-e2e-migration-runner-isolation.ts` | **13/13** — P1 variável antiga sob NODE_ENV=production É IGNORADA (376 aplicada; pending final 0; exit 0 só com schema completo) · P2 aplica todas normalmente · P3 target válido (anteriores aplicadas; target+posteriores pendentes; mensagem test-only; exit 0) · P4 target inexistente (exit≠0; zero sucesso; banco inalterado) · P5 vazio/malformado/ausente (exit≠0 ×3) · P6 NODE_ENV=production recusado antes de aplicar · P7 unificard_dev recusado ANTES de qualquer conexão · P8 EXPECTED divergente fail-closed · P9 target já aplicado = erro observável · P10 migration quebrada transiente ⇒ exit≠0 SEM mensagem de conclusão total + arquivo removido |
| backfill legado (fluxo novo) | **20/20** — prepare test-only + runner produtivo real |
| Regressões mídia | contextual **35/35** · isolation **25/25** · CP2 **26/26** · canônico integrado **21/21** · integrado **10/10** |
| Temporal preservado | owner-authority **24/24** · gate **23/0** |
| Negativas contextual+temporal | **16/16** (re-executadas) |
| Gate NOVO `audit-migration-runner-isolation.mjs` | **11/0** — no validate:regression-guards + validate:canonical-catalog + alias validate:migration-runner-isolation |
| Negativas do runner | **N1–N6 = 6/6** sha-verificadas (N1 STOP_BEFORE reintroduzido · N2 NODE_ENV=test removido · N3 proteção dev removida · N4 igualdade exata→localeCompare · N5 TARGET_NOT_FOUND não falha · N6 mensagem de sucesso antecipada) |
| Gates obrigatórios | actor-writer OK · bank-ledger OK · regression-guards OK (… canonical 76 · temporal 23 · runner 11) · system-state PASS · arch --strict critical_new=0 (4 warnings pré-existentes) · diff-check 0 · checksums íntegros |
| tsc | backend **VERMELHO — 25 pré-existentes (arco 0113)**, ZERO novo · frontend **0** |

## Cleanup

dev 376/376 (nenhuma migration reaplicada/editada) · media 0/0 · availability=32 ·
service_offerings=0 · bank 0/0 · storage 0 · DBs efêmeras=0 (4 criadas/dropadas) ·
arquivo transiente da P10 removido (verificado no próprio e2e) · tree = frente + drift protegido.

## Cartório

DT-MIGRATION-RUNNER-TEST-HOOK-PRODUCTION-TRUNCATION: OPEN (achado Yala) → **CLOSED**.
Sem DECISION nova; DECISION-0118 inalterada (o e2e de backfill referencia o tooling test-only).

## Estados

- F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE: **tecnicamente concluída — aguardando
  reseal Yala**.
- IDENTIDADE DE MÍDIA V2: **PASS material preservado**.
- TEMPORAL D2: **PASS material preservado**.
- MACROFRENTE CANÔNICA: **NÃO CLOSED**.
