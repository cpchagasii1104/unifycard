# EXECUTION LOG — F-1 / F-3 / O-1 + Runner canônico (STOP, não 191/191) — 2026-07-18

> **MODO: EXECUTOR.** Envelope de fechamento F-1/F-3/O-1 + runner 191/191 + selos. **RESULTADO: STOP — o runner NÃO atingiu 191/191; NENHUM selo foi registrado.** As Fatias A/C/D permanecem **AGUARDANDO YALA**.

**HEAD inicial:** `dcbcb03bb` · **HEAD final:** (após F-1/F-3/O-1) — ver commits abaixo.
**Âncora:** `docs/04_audit/YALA_FINAL_REGULARIZACAO_R1_R10_2026-07-18.md`.

## Trabalho executado e commitado (autorizado)

### F-1 — reconciliar `audit-c1-human-journey-closure.mjs` × DashboardHome — commit `edbfef3d3`
- O runner estava VERMELHO: o guard exigia o marcador literal antigo `regionalFundCents === null ? '—'`, removido pela convergência territorial (Fatia D). Reconciliado **sem afrouxar**: o check `home:fe-null-honesto` agora prova semanticamente (padrão novo, mais forte) — projeta `resourceState`; default `'—'` (ausência nunca vira 0); saldo só em `fund_available`; erro técnico/residência/cidade/fundo-não-provisionado com estado próprio; `currentBalanceCents` null/undefined nunca é 0; frontend não decide região. Checks de "Meu saldo" e "Extrato" inalterados.
- **Prova negativa:** remover a projeção de `resourceState` → guard morde (`FORBIDDEN_REGRESSION`); restauração byte-exata (git status limpo).
- Guard-only; DashboardHome intocado.

### F-3 — `audit-regional-fund-contract.mjs` repo-wide — commit `65b07da73`
- Substituída a allowlist fechada de 3 consumidores + `continue` silencioso por **descoberta repo-wide** (varredura de `frontend/src` fora de `src/api/` por chamadas a `getUserRegionalFund`). Prova explícita de que **MFIBankSummary** (4º consumidor) é descoberto. Regra precisa: INSEGURO = colapsar `currentBalanceCents` null/undefined em 0 (`?? 0`/`|| 0`) SEM ramificar por `fund_available`, OU enviar city/region ao endpoint. HONESTO = colapso dentro de `fund_available` (DashboardHome/RegionalFundCard/RegionalFundUser) OU sem colapso via nulidade (MFIBankSummary).
- **Provas negativas:** (1) MFIBankSummary com `?? 0` sem gate → morde; (2) DashboardHome enviando `cityId` → morde. Restaurações byte-exatas.
- Os 4 consumidores atuais confirmados honestos. Guard-only.

### O-1 — versionar os dois relatórios YALA — commit `146cf6f6c`
- `git add` explícito e SOMENTE de `YALA_RELATORIO_INDEPENDENTE_CAMPANHA_ACD_2026-07-18.md` e `YALA_FINAL_REGULARIZACAO_R1_R10_2026-07-18.md`. **Byte-exato** (sha256 pré-add == pós-commit). Sem glob/`git add .`. `YALA1_AUDITORIA...` e `02_decisions_FULL.txt` permanecem untracked/intocados.

## Runner canônico — RESULTADO: STOP (NÃO 191/191)
- **Comando:** `node scripts/run-regression-guards.mjs` (com `PATH="$PWD/node_modules/.bin:$PATH"` para os guards `tsx`).
- **Diretório:** `C:\unificard\backend` · **Runtime:** node v22.16.0 · **Commit testado:** `146cf6f6c` · **Duração:** ~104s · **Contagem CMDS:** 191.
- **Código de saída:** **1 (FALHA).**
- **Guard que falhou:** `audit-actor-territorial-assignment-foundation.mjs` (posição 178 no CMDS).
- **Motivo (D2):** `escrita actor-scoped em address_assignments fora do resolver — writer aberto antes da Fase C: src/scripts/validate-pipeline-e2e-regional-fund-residence-reader.ts (INSERT actor_id)`.
- **Warnings observados (não são a causa da falha):** `fiscal-tax-catalog` 1 warning honesto (hardcode ausente + DT OPEN — esperado, DT reaberta em R-1); `governed-vocabulary-manifest` 4 warnings pré-existentes.

### Análise do bloqueador (novo, não previsto pela YALA FINAL)
- A YALA FINAL identificou **apenas F-1** como bloqueador do runner, porque o runner **para na primeira falha** e, no HEAD `dcbcb03bb`, parava em `audit-c1-human-journey-closure` (posição 13). Com F-1 corrigido, o runner avançou e encontrou um **segundo bloqueador latente na posição 178**.
- **Causa-raiz:** o E2E `validate-pipeline-e2e-regional-fund-residence-reader.ts` (introduzido pela **Fatia D**, commit `8170db60f` — NÃO existia no baseline `c06b6f32e`) semeia uma residência actor-scoped via `INSERT INTO address_assignments (... actor_id ...)` como **fixture de teste**. O guard D2 barra qualquer escrita actor-scoped fora do resolver/writer selado da Fase C e varre `src/` inteiro (inclui `src/scripts/`). O guard já EXCLUI, por CAMINHO EXATO, harnesses legítimos análogos (ex.: `test-actor-onboarding-address-db.ts`); este E2E **não está** nessa allowlist.
- **Classificação:** defeito **real** em HEAD, imputável à **Fatia D** (fixture do E2E), mascarado até agora pela falha anterior do C1. Reforça o veredito da YALA de que **Fatia D permanece CONDICIONAL**.

### Por que STOP (não corrigido nesta execução)
- Este envelope autoriza **exclusivamente** F-1, F-3, O-1 e a execução do runner. A correção deste terceiro bloqueador exigiria **ou** alterar o guard `audit-actor-territorial-assignment-foundation.mjs` (adicionar o E2E à allowlist de CAMINHO EXATO — não autorizado) **ou** alterar o E2E da Fatia D para semear via o writer canônico da Fase C (material de Fatia D — vedado: "Não alterar material das Fatias A/C/D além dos guards autorizados"). A missão determina: "Se o resultado não for exatamente o exigido: STOP. Não registrar nenhum selo. Informar qual guard falhou e deixar A/C/D como AGUARDANDO YALA." **STOP aplicado.**
- Observação: o runner para na 1ª falha — **não é possível saber se há falhas adicionais a jusante** da posição 178 sem antes resolver esta. Nenhuma tentativa de bypass/pré-marcação foi feita.

## Estado final (sem selo)
- **Selos autorizados NÃO registrados** (condicionados a 191/191): (A) Regularização processual; (B) Fatia C contenção fail-closed.
- **Fatia A** = AGUARDANDO YALA (CONDICIONAL por R-7). **Fatia C** = AGUARDANDO YALA (contenção fail-closed apta, mas registro do selo condicionado ao runner verde). **Fatia D** = AGUARDANDO YALA (CONDICIONAL; agora com bloqueador de guard adicional no E2E). **DT-INVOICING** = OPEN · PARCIALMENTE REMEDIADA.
- `unificard_dev` intocado; migrations=0; Δbank=0; PORTA 01 fechada; N0/N1/N2/ontologia intactos; `02_decisions_FULL.txt` intocado.

## Próximo passo recomendado (novo envelope, não executado aqui)
Autorizar a correção do bloqueador de `audit-actor-territorial-assignment-foundation` por **uma** das vias: (i) adicionar `validate-pipeline-e2e-regional-fund-residence-reader.ts` à allowlist de CAMINHO EXATO do guard (precedente de `test-actor-onboarding-address-db.ts`, sem afrouxar a varredura), **ou** (ii) refazer o fixture do E2E para semear via o writer canônico da Fase C. Depois: re-executar o runner e, se 191/191, registrar os dois selos autorizados.
