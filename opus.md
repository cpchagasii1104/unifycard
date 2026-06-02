# opus.md — memória operacional

**Para:** próxima instância de Claude Opus operando no projeto UnifiCard com Clayton.
**De:** Claude Opus, sessão 2026-05-08.
**Status:** privado, gitignored. Não é documento institucional. Atualizo no início e fim de cada sessão.

---

## Sessão 2026-06-02 — F-PJ-BIRTH-AND-COMMERCIAL-SSOT-READONLY: DECISION-0075 (freeze, docs-only)

Frente PJ: diagnóstico read-only + registro docs-only. **PJ BLOQUEADA para implementação** — duas filosofias de nascimento pendentes de Clayton (A: inerte sem page-actor no Momento 1 · B: full-birth mas transacional). NÃO escolher A/B sem Clayton.

**Evidência fechada (HEAD origem `335a5eaf`):**
- `companies.service.ts:createCompany` cria page-actor (`actor_type='page'`) no **Momento 1** (`:654-655`) — drift vs `DESENHO_FASE_3B §2` (Momento 1 sem page-actor) e `EMPRESA_NASCIMENTO §4`. Fluxo **sem transação DB** (`pool.query` statement a statement); rollback = `DELETE`s compensatórios (`:676-697`); `address` (`:499-518`) órfão possível.
- Preço: **sem NUMERIC vivo** (refutou leitura inicial do ChatGPT baseada em migrations 0020/0122). Vivo = `price_cents` BIGINT em `product_prices`/`product_offers`/`products`(nullable legado). `tenant_products`/`catalog_products` inexistentes no runtime; `_deprecated_tenant_products` só `price_cents`. Risco real = **federação de `price_cents`** sem precedência canônica.
- Numeração: 0074 OCUPADA (profile/residence, committada por instância externa durante a sessão) → DECISION-**0075**. REMEDIATION_DECISIONS_LOG é série paralela (até ~0059) — **não** injetar 0075 lá.

**Entregue (docs-only, 1 commit):** `docs/02_decisions/DECISION_0075_COMPANY_BIRTH_PAGE_ACTOR_DRIFT.md` + 3 DTs OPEN (`DT-COMPANY-BIRTH-PAGE-ACTOR-DRIFT`, `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP`, `DT-COMMERCIAL-PRICE-FEDERATED-SSOT`) + STATUS_EXECUCAO_GLOBAL. Zero código/migration/banco.

**Próximo:** (1) Clayton decide A/B; (2) frente read-only de preço (precedência `price_cents`); (3) não implementar PJ antes disso. Nota: `00_AGENT_PROTOCOL.md` referenciado por vários docs mas **ausente** no repo (só existe o bridge `00_AGENT.md`) — verificar antes de citá-lo como autoridade.

---

## Sessão 2026-05-28 — C7 FECHADO (commits `6a167d77` + `f8a0c59e`)

`finalizeRecoveryCase(tenantId, obligationId, existingClient?)` em `recovery-finalization.service.ts`.
Quando obligation `recovered` + intent `released_to_actor_wallet`: atualiza `payment_status → 'refunded_via_recovery'` + evento `PAYMENT_INTENT_REFUNDED_VIA_RECOVERY` (idempotente por event_id SHA256).
Quando obligation `recovered` + intent em qualquer outro status (income withholding não-D-money): finaliza silenciosamente, sem alterar intent.
Quando obligation `cancelled`: apenas evento `ACTOR_WALLET_RECOVERY_CANCELLED` — intent permanece `released_to_actor_wallet`, sem alteração.
**`refunded_via_recovery` NÃO libera reversal tradicional** — guard permanece ativo para ambos os status pós-D-money.
Migration `20260530571000` estende CHECK constraint de `payment_intents.payment_status`.
Integração C3.1: `drainRecoveryObligationsForCredit` chama `finalizeRecoveryCase` no mesmo client TX após `recovered`.
E2E C7 14/14. DT-DMONEY-FINALIZATION-FLOW-MISSING CLOSED. DT-ACTOR-WALLET-DEBIT-MISSING CLOSED.
**C7 não move dinheiro. Não toca bank_ledger/bank_transactions/bank_splits.**

---

## Sessão 2026-05-27 — C3.1 FECHADO (commit `c3d2e569`) — Income Withholding Síncrono

`drainRecoveryObligationsForCredit(tenantId, debtorActorId, creditedAmountCents, client)` em
`financial-recovery/actor-wallet-recovery-obligation.service.ts`. Seleciona obligations ativas
com FOR UPDATE FIFO, drena cada uma até `creditedAmountCents`. Integrado em
`releaseFundsToActorWalletForOrder` após cada split D-money — mesmo client → atomicidade total.
`debitActorWalletForRecovery` adaptado: `existingClient?`, `maxAmountCents?`, `calculateBalance(client)`.
E2E 13/13. Regressão zero: C3 18/18, D-money 28/28.
**DT-RECOVERY-PAYOUT-GATE parcialmente fechada. Saque externo ainda pendente.**

---

## Sessão 2026-05-27 — C3 FECHADO (commit `61979374`)

`debitActorWalletForRecovery` implementado em `src/modules/wallet/actor-wallet-debit.service.ts`.
Valida status + approval, calcula `Math.min(remaining, balance)`, atômico BEGIN/COMMIT:
transfer(existingClient) → INSERT obligation_entries → UPDATE obligations. Short-circuit no_funds_available.
E2E 18/18 após 4 fixes nos cenários de balanço dinâmico (T2/T4/T9/T10). Gates verdes.
**C3 = cobrador operacional. Próxima frente C7 (orquestração pós-D-money) requer autorização Clayton.**

---

## Sessão 2026-05-27 — C4b-2 FECHADO (commit `d3ab14f3`)

Lazy creation inserida em `createExecution` (service-payment-execution) após guard `user_id`.
Backfill: 2 payers cobertos, 0 erros, idempotente. E2E 12/12. Resolver C4 E2E fixado para
pegar actor sem wallet pré-existente (backfill deixava wallets no DB); 8/8.
**Próxima frente: C3 — `debitActorWalletForRecovery`** em `modules/wallet/actor-wallet-debit.service.ts`.

---

## Sessão 2026-05-27 — C4b-1 FECHADO (commit `13ee5d8a`)

`ensureUserWalletForActor(tenantId, actorId)` implementado em `bank-account.service.ts`:
resolve `user_id` via actors, lança `USER_WALLET_REQUIRES_USER_ID` se ausente, delega para
`ensureLifecycleAccountsForOwner` com userId canônico. E2E 9/9 verde.
Bug `payment-event-resolver.ts` corrigido: substituídas chamadas com actorId por `ensureUserWalletForActor`.
DTs fechadas: `DT-USER-WALLET-PROVISIONING-FOR-RECOVERY` + `DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG`.
**Próxima frente: C4b-2** (backfill + lazy em `createPaymentIntentWithClient`) **ou C3** (`debitActorWalletForRecovery`).

---

## Sessão 2026-05-27 — C4 IMPLEMENTADO + READ-FIRST C4b + DECISION-0057

C4 implementado (commit `13db36d8`): `recovery-creditor-resolver.service.ts` READ-ONLY,
fail-closed, E2E 8/8. DT-USER-WALLET-PROVISIONING-FOR-RECOVERY registrada.

READ-FIRST C4b encontrou bug material: `payment-event-resolver.ts` passa `event.actor_id`
onde `ensureLifecycleAccountsForOwner` espera `userId`. Convenção real = `userId:user_wallet`.

**DECISION-0057 aprovada:**
- owner_id canônico: `${userId}:user_wallet` (userId de `users`, nunca actorId)
- Helper futuro: `ensureUserWalletForActor(actorId)` → resolve userId → delega para `ensureLifecycleAccountsForOwner`
- Backfill: actors humanos com `user_id NOT NULL` em `payment_intents` (todo status)
- Sem `user_id` → `USER_WALLET_REQUIRES_USER_ID` (sem composite alternativo)
- Bug `payment-event-resolver.ts` → DT-USER-WALLET-PAYMENT-EVENT-RESOLVER-BUG (corrigir ANTES do backfill)

**PRÓXIMA FRENTE C4b:** corrigir bug resolver → `ensureUserWalletForActor` → backfill → lazy em `createPaymentIntentWithClient`.

---

## Sessão 2026-05-27 — READ-FIRST C4 + DECISION-0056

READ-FIRST C4 confirmou:
- `bank_transactions.account_id` em D-money = `escrow_payments` (sistema; não é conta do payer).
- `bank_transactions.counterpart_account_id` = conta do devedor (quem recebeu) — não serve para resolver credor.
- `payment_intents.actor_id` = payer direto; caminho determinístico para `creditor_actor_id`.
- Resolver com SELECT em `payment_intents` + `bank_accounts` não pode morar em `core/` — core não recebe query direta.

**DECISION-0056 aprovada:**
- `creditor_actor_id` = `payment_intents.actor_id`
- `creditor_account_id` = `bank_accounts WHERE owner_type='actor' AND actor_id=payer AND account_type='user_wallet'`
- `actor_wallet` vetada como destino (invariante revenue_share preservada — DECISION-0046/0055)
- Lista fechada vetada: `escrow_*`, `clearing`, `risk_reserve`, `platform_fees`, `regional_fund`
- Ambiguidade = erro: `CREDITOR_ACCOUNT_NOT_FOUND` / `CREDITOR_ACCOUNT_AMBIGUOUS`; sem `LIMIT 1`
- Placement: `src/modules/financial-recovery/recovery-creditor-resolver.service.ts`

**DECISION-0053 C4:** semanticamente decidido (DECISION-0056). Próxima frente = implementação do resolver.

---

## Sessão 2026-05-27 — C6 / ACTOR_WALLET_RECOVERY_OBLIGATIONS_SUBSTRATE

Migration `20260530570000` aplicada:
- `actor_wallet_recovery_obligations`: UNIQUE total sem WHERE, 7 FKs, 3 CHECKs.
- `actor_wallet_recovery_obligation_entries`: append-only, 2 FKs.
- Concept `actor-wallet-recovery` em `financeiro-reversal` semeado.
- Alerta: concept governance trigger exige `set_config('app.concept_governance','true',true)`
  em qualquer migration que insira em `concepts`.

Tipos TS em `src/core/financial-recovery/financial-recovery.types.ts`.
E2E: 12/12 verde. Gates: tsc=0, actor-writer=OK, bank-ledger=OK, regression=OK, arch critical_new=0.

DECISION-0053 C6: **DONE**. C3 implementação desbloqueada (falta C4 creditor resolver).

---

## Sessão 2026-05-27 — READ-FIRST F-ACTOR-WALLET-DEBIT + DECISION-0055

READ-FIRST confirmou: `actor_wallet` é CRÉDITO-ONLY (nenhum débito existe). Bloqueio de
design identificado no risk gate do `bankTransactionService.transfer`.

**DECISION-0055 aprovada — Semântica e Autoridade do débito de recovery:**

- **D1 — Risk gate Opção 3:** clearance `financial_recovery` — trilho próprio, não bypass
  total, não mesmo gate de transferência voluntária. Mais autoridade, não menos controle.
- **D2 — Partial recovery:** saldo insuficiente → debita disponível + `partially_recovered`;
  saldo suficiente → debita tudo + `recovered`. Sem saldo negativo.
- **D3 — Income withholding:** futuras entradas em `actor_wallet` do devedor drenadas
  contra obrigações pendentes antes de liberar saldo para saque.
- **D4 — Caminho A (MVP):** payer aguarda recovery; sem adiantamento da plataforma.
- **D5-D8:** placement `modules/wallet/actor-wallet-debit.service.ts`, nome
  `debitActorWalletForRecovery`, `reference_type='actor_wallet_recovery'`,
  concept `actor-wallet-recovery` em `financeiro-reversal`, `creditorAccountId` via C4.

**DECISION-0053 C3:** semântica definida; implementação aguarda migration C6.

---

## Sessão 2026-05-27 — F-APROVACAO-FINANCEIRA-SUBSTRATE (DECISION-0054)

- **READ-FIRST confirmou**: `approval_requests`/`approval_votes` inexistentes em DB e migrations.
  `core/ai/approval` = in-memory/IA, domínio diferente — não adaptar.
- **Migration `20260530569000`**: materializou `approval_requests` + `approval_votes` conforme
  `CORE_APROVACAO_FINANCEIRA_CANONICO §7.2`. `operation_type` inclui `actor_wallet_recovery`
  (D1 Clayton). Sem `bank_account_policies` nesta frente (D2).
- **E2E 10/10 verde**: T1–T10 cobrem todos os CHECKs, FKs e UNIQUE. T10 prova zero escrita
  em `bank_ledger`/`bank_transactions`/`bank_splits`.
- **DECISION-0053 C2 satisfeito**. C3 (DT-ACTOR-WALLET-DEBIT-MISSING) é o próximo bloqueio.
- **DT-CORE-APPROVAL-REQUESTS-MISSING: CLOSED.**

---

## Sessão 2026-05-27 — F-REFUND-POST-DMONEY Parte A + READ-FIRST + DECISION-0053

- **Parte A fechada** (commit `4c04e8d7`): guard `checkPostDmoneyBlock` bloqueia os 3 entry points
  do reversal quando `payment_intent.payment_status = 'released_to_actor_wallet'`. Lança
  `REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW`. Protege escrow de terceiros. E2E 7/7 verde.
- **Falso positivo GATE 4** corrigido: comentário continha literal `bank_ledger` e disparava regex
  de `NO_DIRECT_BANK_TABLE_ACCESS`. Fix: reescrita do comentário sem o literal.
- **READ-FIRST**: nenhum substrato existente serve para recovery pós-D-money.
  `financial_freezes` = fantasma. `actor_debts` = domínio errado + schema drift.
  `approval_requests`/`approval_votes` = não existem no banco.
- **DECISION-0053 aprovada**: duas tabelas (`actor_wallet_recovery_obligations` +
  `actor_wallet_recovery_obligation_entries`). Axioma crítico: reversal tradicional
  permanece bloqueado MESMO após `recovered`/`cancelled` — recovery é fluxo próprio,
  não desbloqueio do caminho antigo. Unique index total sem filtro WHERE.
- **Próximo passo**: materializar `approval_requests` (DT-CORE-APPROVAL-REQUESTS-MISSING)
  antes de qualquer código de recovery. Não implementar DECISION-0053 sem C2–C7.

---

## Sessão 2026-05-27 — F-REFUND-SPLIT-AWARE-HARDENING (DECISION-0052)

- Auditei o motor de estorno (`reversal.service.ts` + `reversal.repository.ts`). Achado material: **JÁ É split-aware desde o Prompt 51** — `loadSplitLegsForReversal` lê splits originais e cada um vira uma transferência reversa. PE-5 não criou bomba. Faltava só etiqueta, assinatura e câmera.
- Aprovado pelo Clayton: A (taxonomia) + B (autoria) + D (E2E) + E (linkage). Bloco C adiado (raio-x do Core de Aprovação pendente — DT-CORE-APROVACAO-FINANCEIRA-RAIOX-PENDENTE). Bloco F fora de escopo (DT-PE5-REFUND-POST-DMONEY-CHAIN).
- Achado durante implementação: `bankTransactionService.transfer` **não propaga metadata para `bank_transactions`** e `bank_ledger` não tem coluna metadata. Fix cirúrgico: UPDATE `bank_transactions.metadata` explícito após cada `transfer` no `executeReversal`. Documentado no comentário ali.
- Achado durante E2E: `evaluateActorRisk` lê `actor_events` (peso 18 por `reversal_executed` → 5 estornos = 90 = blocked). E2E com múltiplos estornos no mesmo worker dispara `ACTOR_RISK_BLOCKED` por colateral. Mitigação: helper `resetRiskProfiles()` limpa `actor_events` + `actor_risk_profile` entre fases. **NÃO usar isso em produção** — é mecanismo só de teste para isolar o que se mede.
- T9 (estorno pós-D-money) removido do E2E por não-determinismo. Limite material (escrow_payments é pool, estorno drena saldo de outros pagamentos) está em DT-PE5-REFUND-POST-DMONEY-CHAIN com as 3 opções de resolução possíveis.
- Migration `20260530568000_reversals_taxonomy_and_authorship.sql` é aditiva pura — 3 ADD COLUMN + 4 CHECK + 1 FK. Pode ser revertida.
- E2E `validate-pipeline-e2e-refund-split-aware.ts` rodou verde (9 cenários). Outbox worker tenta Redis local e falha mas não afeta o teste.

---

## §-3. Missão real

**Objetivo único da operação atual: backend buildando, banco aplicado, frontend rodando, smoke test funcionando.**

Tudo o mais é distração. O sistema já tem:
- Constituição, Lei de Coerência, SSOT Registry, Nomenclatura Canônica
- 289+ migrations, 199+ tabelas, 1685+ arquivos `.ts`
- Authority Layer com runtime real (auditado), CORE_IMUTAVEL com triggers DB-level
- 4 gates CI verdes, CORE_PURITY estável
- Location Core materializado (countries/states/cities/neighborhoods + addresses + assignments)

**O que falta não é mais documentação. É sistema rodando na mão do Clayton.** Pré-lançamento. Sem usuários. Backups são responsabilidade dele, não minha.

Os 4 passos canônicos:

1. `pnpm install && pnpm build && pnpm start` no backend → sem crash
2. Migrations aplicadas em `unificard_dev`
3. `pnpm dev` no frontend → conecta no backend
4. Smoke test mínimo: criar usuário → login → 1 transação → ler em `bank_ledger`

Se algum erro aparecer no caminho, corrigir. Não auditar prevenção. Não abrir frente nova. Não criar processo paralelo.

---

## §-2. Runtime descobre arquitetura, não cria

Você não está criando uma arquitetura. Está descobrindo qual parte da arquitetura já é a verdadeira.

O runtime não mente. Quem recebe rota HTTP, quem grava em qual tabela, quem publica/consome evento, quem é importado, quem está no schema — esse é o sistema real. O resto é arqueologia.

**Bias central de LLM a evitar:**
```
Padrão percebido → Coerência narrativa → Completude inferida   ← errado
Evidência material → Afirmação localizada → "Resto não auditado" ← correto
```

**Não posso dizer:**
- "O sistema garante X"
- "Todos os módulos fazem Y"
- "Existe enforcement Z" (sem prova material)

**Posso dizer:**
- "Tabela X tem trigger BEFORE UPDATE em migration L:25"
- "Função Y chama Z em service.ts:123"
- "Query executa com tenant_id em WHERE (linha 45)"

Documentação serve como mapa, não como labirinto. Se a documentação diz uma coisa e o runtime diz outra, o runtime está certo até prova em contrário.

---

## §-1. Função desta IA

A IA NÃO é guardiã de risco operacional de produção. É executor técnico que ajuda Clayton a ver o sistema funcionando.

**Prioridades, em ordem:**
1. Funcionar > perfeição
2. Iteração curta > sessão longa
3. Resposta direta > cerimônia justificada

**Cerimônia institucional só se aplica quando:**
- Há corrupção de ledger em runtime (não há, sistema sem usuários)
- Há contrato externo com consumidores (não há, ainda)
- Há decisão arquitetural irreversível em curso (raro)

Em qualquer outro caso: faz, valida, segue. Se quebrar, corrige.

**Anti-padrão central:** cuidado em excesso. Cerimônia virou gargalo na Sessão 3 (30+ turnos para deletar função morta). Reverter quando isso voltar a acontecer.

**Sinais de fadiga / paralisia:**
- Sessão passa de 5 turnos numa operação cujo blast radius é "reversível por git restore"
- Múltiplas auditorias do mesmo achado
- DTs novas surgindo a cada turno
- Codex / Claude Code invocados para validar coisa simples
- Working tree dirty pré-existente tratado como ameaça (é estado-base, não regressão)

Quando isso acontecer: pausar, perguntar a Clayton se vale continuar ou suspender.

---

## §-1.5. Filtro de classificação (Clayton)

**Antes de qualquer ação propositiva, classificar pelas 3 perguntas:**

1. Bloqueia o sistema rodar e ser testado por Clayton agora?
2. Degrada diagnóstico/observabilidade quando ele for testar?
3. Toca causalidade financeira em runtime (ledger, autoridade, identidade)?

| Cenário | Ação |
|---|---|
| 1 = sim | Resolver agora. Cerimônia mínima. |
| 3 = sim | Resolver agora. Cerimônia mínima com cuidado. |
| 2 = sim | Backlog ativo, próximas sessões. |
| Nenhuma | Backlog leve. **Não abrir sessão dedicada.** |

**Anti-padrão:** abrir sessão de "limpeza" / "auditoria" / "organização" para algo que falhou nas 3 perguntas. Sintoma de IA aplicando perfeccionismo onde Clayton precisa de movimento.

**Pergunta 1 reformulada (porque "produção" hoje é vazia):** "bloqueia rodar/testar" = não compila, gate falha hard, banco não aceita query. NÃO é "tem coisa feia no working tree" ou "ainda tem TODO no código".

**Pergunta 3 é a única que justifica cerimônia em pré-lançamento.** Concept_id semântico errado contamina ledger no primeiro teste real. Tudo o mais é "ajustamos depois".

**Caso especial — drift schema-vs-código:** se a Pergunta 1 ou 2 disparou por erro `coluna/relação não existe`, **antes de propor edição aplicar §4-B** (auditoria de feature ponta-a-ponta). Não é cerimônia adicional — é hipótese-padrão diferente: presumir regressão de genesis, não código morto.

---

## §0. As 7 perguntas — quando aplicar

As 7 perguntas existiam como cerimônia obrigatória. **Hoje viram filtro condicional.**

Aplicar quando §-1.5 detecta que a operação merece cerimônia (pergunta 3 = sim, ou decisão arquitetural irreversível). Em delete morto, rename simples, refactor mecânico — viram peso desnecessário.

**Quando aplicáveis:**

1. Qual problema MACRO esta alteração resolve?
2. Qual SSOT governa este comportamento?
3. Existe DT, decisão formal ou plano mestre relacionado?
4. Essa mudança cria realidade paralela?
5. Existe outro módulo, migration, gate, contrato HTTP, worker ou fluxo financeiro afetado?
6. A mudança é evolução institucional ou apenas correção local?
7. O sistema inteiro continuará coerente daqui a 3 sessões?

**Resposta ambígua quando aplicáveis = parar. Auditar antes de editar.**

**Distinção crítica:**
- **Direção normativa correta** ≠ **custódia institucional do ato**
- Norma prescreve resultado (Nomenclatura prescreve `amountCents`)
- Em pré-lançamento, custódia formal só importa para mudanças que tocam causalidade financeira ou contrato externo

---

## 1. Como operar com Clayton

Clayton é orquestrador. Não programa o sistema, mas conhece o estado normativo melhor que eu. Quando ele corrige uma assunção minha, ele tem razão até prova em contrário.

**O que funciona:**
- Comando PowerShell direto, sem prólogo. Ele cola o output, eu interpreto, próximo comando.
- Decisões pequenas eu tomo e anuncio. Ele só objeta se discordar.
- Bloco de código tem que rodar **sem editar**. Erros de aspas, escape, encoding são meus.
- Quando ele diz "vai", vou. Sem "tem certeza?".
- **Quando ele diz que algo não importa, é porque não importa.** Não inventar processo paralelo.
- Quando ele diz "backups são meus", são dele. Não criar processo de proteção redundante.

**O que NÃO funciona (já provado):**
- Cerimônia repetida ("Modo: GUARDIÃO", "Aguardando autorização"). Cortado.
- Pedir confirmação para coisas óbvias.
- Explicação longa antes de mostrar resultado.
- 4 versões defensivas de um comando "para garantir". Uma versão que funciona basta.
- Trocar de canal por ansiedade.
- Concluir sem aplicar §-1.5. Se proponho trabalho que falha nas 3 perguntas, parar.
- **Tratar tudo como ato de alta consequência.** Sistema sem usuários tem espaço para errar e corrigir.

---

## 2. Roteamento de canais

Três canais. Roteamento é decisão técnica baseada na natureza da operação.

### Mental model

- **PowerShell direto via Clayton** = bisturi manual. Cada comando validado. Decisão a cada passo.
- **Codex** = braço mecânico. Filesystem direto. Não decide arquitetura.
- **Claude Code** = engenheiro rápido sem memória institucional. Acesso real ao filesystem. Improvisa se entrar sem briefing rigoroso.

### Critérios

**PowerShell quando:**
- ≤5 comandos com decisão visual a cada passo
- Operações git em commit/branch/index (Codex tem `Permission denied` em `.git/index.lock`)
- Validação de gates, build, CORE_PURITY (Codex não tem `pnpm` no PATH)
- Discovery curto onde decisão depende do output

**Codex quando:**
- Escrita determinística e mecânica (sem decisão durante execução)
- Bloco de escrita longa em arquivo único
- Varredura ampla read-only
- **Auditoria antagonista**: validar plano contra estado real do disco/git/runtime
- PowerShell externo está fechando ou travando

**Claude Code quando:**
- Discovery exploratório paralelo em escopo fechado previamente
- Auditoria material com evidência de runtime/banco
- Trabalho em loop iterativo (rodar → ler → ajustar)
- **Autonomia total quando padrão repetido e risco baixo (§4-D)**
- Sempre com briefing rigoroso e escopo fechado quando risco alto

**Critério decisivo:** "exige interpretação arquitetural durante execução?" Sim → PowerShell. Não → Codex/Claude Code. Tamanho não é critério.

### Tipos de briefing

- **Antagonista**: "audite o estado real, questione meu plano". Codex acessa estado externo independente.
- **Colaborativa**: "execute exatamente este escopo mecânico".
- **Exploratória**: "descubra o que existe sobre X sem assumir nada".
- **Eco (proibido)**: "valide meu plano". Vira reformatação sem valor.

**Princípio decisivo:**

> **Briefing antagonista bom é estreito.** Quanto mais amplo o pedido, mais a IA auxiliar abandona custódia e tenta "melhorar o sistema". Codex responde "isso existe / isso não existe / isso conflita". Claude Code com briefing amplo responde "se eu redesenhasse, faria assim". Diferença não é capacidade — é tamanho de briefing.

**IA auxiliar só agrega valor quando audita estado externo real (disco, git, runtime, banco).** Se receber só meu raciocínio, vira espelho estilizado.

### Coordenação

- **Não existe mente coletiva.** Cada IA roda isolada.
- Clayton é o único orquestrador. **Eu não brieffo Codex/Claude Code diretamente.** Entrego briefing pronto, ele coordena.
- **Eu (web) não tenho acesso ao disco.** Claude Code tem. Não freá-la quando padrão é claro (§4-D).

### Construção de âncoras com acentos

Ambiente entre Claude e Codex pode reinterpretar caracteres acentuados. Construir âncora em runtime usando codepoints:

```
$crlf = [char]0x0D + [char]0x0A
$ancora = "// LEGACY: m" + [char]0x00F3 + "dulo em extin" + [char]0x00E7 + [char]0x00E3 + "o"
```

Codepoints são determinísticos onde texto literal pode falhar.

---

## 3. Padrões de execução

**Antes de edição em arquivo:**
1. `git diff -- <arquivo>` confirma working copy limpa. Match.Count == 1 valida contra disco (potencialmente dirty), não contra HEAD.
2. `git status --short -- <arquivo>` para tracked/untracked
3. Caminho exato com `Get-ChildItem -Recurse -Filter "<nome>"`. Existem múltiplos arquivos com mesmo nome.

**Edição via PowerShell:**
1. `[System.IO.File]::ReadAllText($path)` (default UTF-8 sem BOM)
2. **Verificar EOL real do arquivo** (`\r\n` vs `\n`)
3. Construir `$old`/`$new` com EOL **do arquivo**, não normalizado
4. `([regex]::Matches($content, [regex]::Escape($old))).Count -eq 1` antes de Replace
5. Se não bate, ABORT. Não regex frouxa.
6. `[System.IO.File]::WriteAllText($path, $content)` (default UTF-8 sem BOM)

**Atomicidade de commits:**
- Um commit = uma unidade lógica
- Antes de cada commit: build verde, gates passam
- Se grande, separar em commits menores

**Migration corretiva pós-aplicação (padrão F3-S4b/S6b):**
- Migration original aplicada e commitada NUNCA é reescrita
- Correções vão em migration nova com sufixo `b` (`F3-S4b`, `F3-S6b`)
- Migration ainda não aplicada PODE ser editada antes do apply (não é histórico ainda)
- "Migration aplicada ≠ migration editável; migration não aplicada = ainda faz parte do presente"

**Vivo > morto exige varredura:**
1. `Select-String` para callers diretos em `backend/src`
2. Grep de imports
3. Mapear rotas/registry/builder
4. Comentário "LEGACY", import comentado **não são evidência**
5. **Contrato HTTP/API é soberano até auditoria de consumers.** Função morta dentro de módulo com rota viva: módulo fica.

**Salvaguarda terminal:**
- Bloco PowerShell único, sem pausas interativas
- `$env:GIT_PAGER = 'cat'` no topo + `--no-pager` em comandos pontuais
- Output >300 linhas → capturar em arquivo
- Ao colar output em chat, **não colar histórico junto** — paste-bug do PowerShell gera cascata de erros

---

## 4. Armadilhas conhecidas

- **CRLF vs LF heterogêneo**: arquivos do mesmo módulo podem ter EOL diferentes. `git stash` aciona `core.autocrlf` no Windows e converte LF→CRLF silenciosamente. Sempre verificar EOL real antes de editar.

- **Encoding default vs Latin-1**: `ReadAllText` default lê byte `F3` como U+00F3 (ó) por fallback Latin-1. Para edição cirúrgica funciona; para mudanças amplas de encoding, validar antes.

- **Encoding em `psql -c` no Windows**: caracteres acentuados em strings via `-c` falham com "sequência de bytes inválida UTF-8". Usar arquivo SQL temporário (`-f`) em vez de `-c` quando string tem acento.

- **Arquivos canônicos untracked**: `PLANO_MESTRE_*.md` etc. podem estar untracked apesar de referenciados. Verificar com `git status --short <path>`.

- **Git dirty pré-existente**: working tree do projeto tem ~1100 itens dirty pré-existentes. **Estado-base, não introduzido pela sessão.** Filtrar diff para o escopo da sessão (`git diff --stat -- <pasta>`).

- **Ambiguidade de nomes de arquivo**: 6 `distribution.service.ts` no projeto (achado em auditoria). PLANO_MESTRE pode mencionar nome sem qualificar caminho. Confirmar caminho exato antes de operar.

- **IAs alucinam conteúdo de arquivo sob pressão de opinar**: outra Opus inventou conteúdo de `bank-transaction.port.ts` sem ter rodado `view`. ChatGPT propagou. Apenas Codex (com acesso real) detectou. **Não absorver conclusões de IA auxiliar sem cruzar contra evidência colada na sessão atual.**

- **IAs confundem direção normativa com custódia institucional**: "Norma autoriza" ≠ "ato é autorizado". Em pré-lançamento, relevante só para causalidade financeira em runtime.

- **Briefing amplo a Claude Code = redesign**: ela sai do papel "auditar estado" e vira "redesenhar visão". Estreitar.

- **Drift schema-vs-código (regressão de genesis)**: query referencia coluna/tabela que o banco não tem **NÃO significa código morto**. Aplicar §4-B antes de propor delete ou quarentena.

- **Inferência por naming pattern em PKs é não-confiável**: o sistema NÃO tem padrão único. `tenants.id`, `events.id`, `groups.id` usam genérico; `companies.company_id`, `profiles.profile_id`, `services.service_id` usam `{tabela}_id`. Sempre verificar via `information_schema.key_column_usage`. Aplicar §4-C.

- **Norma pode estar aspiracional**: `07_NOMENCLATURA_CANONICA.md §4.4` diz PK = `id`, mas banco real usa `{tabela}_id` na maioria. Norma escrita não é runtime. Aplicar §4-C.

- **`sed` regex pode pegar declarações mas deixar referências em WHERE**: ao renomear coluna em SQL, verificar todas as ocorrências (declaração + WHERE + JOIN + comentário). Auditoria explícita pré-apply é obrigatória.

- **Auditoria externa (ChatGPT, Codex) pega bugs que passam em revisão interna**: F3-S5 teve achado de subqueries sem `country_id`; F3-S6 teve achado de PK real `tenants.id` (não `tenant_id`). Vale o custo da rodada extra antes de aplicar.

- **CORE_PURITY baseline**: `1278/68/319/891`. Drift = parar e investigar. Mover código (não relaxar baseline) é quase sempre a resposta. Drift para baixo continua sendo drift.

- **`git status` enorme não é bug**: `node_modules/` historicamente tracked. Filtrar para escopo da sessão.

- **Output truncado pelo PowerShell**: `Select-Object -Last N` ou `-First N` sempre.

- **`return` em script PowerShell não interrompe pipeline**. Para abortar: `exit 1`.

- **`Select-String` não tem `-Recurse`**. Usar `Get-ChildItem -Recurse | Select-String`.

- **Memória do Codex e PowerShell são separadas.** Estado vive no disco e no git.

- **Paste-bug do PowerShell**: colar output anterior + bloco novo gera cascata. Limpar terminal antes de cada paste novo.

- **Prompts longos com aspas/heredocs cortam no terminal de IA**: comandos com `cat << EOF` ou `$msg = @"..."@` longos podem ser truncados durante paste. Usar arquivo temporário (`/tmp/cf.txt`) e `git commit -F` em vez de mensagem inline.

---

## 4-A. `_orphans/` — preservação técnica, não lixeira

**Pasta gitignored na raiz do repo.** Preserva conhecimento técnico fora do runtime/build/gates. Não é codebase paralela, não é backup oficial.

**Por que existe:** o projeto passou por refatoração estrutural pesada, reorganização core/modules, gênese de banco, migração semântica. Alguns arquivos perderam acoplamento ao runtime atual mas **não perderam valor técnico ou histórico**.

**Classificação tripla obrigatória antes de propor delete:**
1. **Morto e inútil** → delete definitivo
2. **Morto mas potencialmente útil** → `_orphans/`
3. **Vivo** → manter e corrigir

**Default: suspeitar de categoria 2 antes de assumir categoria 1.**

Critérios para categoria 2 (preservar):
- Tem lógica de domínio (orquestração, regra de negócio, concept_id, decisão financeira)
- Tem heurística reaproveitável (algoritmo, política de distribuição, validação custom)
- Tem contexto histórico (escrito em fase anterior do sistema, registra decisão prévia)
- Existe chance > zero de virar útil em refactor futuro

**Convenção:**
- **Padrão principal: `.ts.txt`** com header de quarentena
- `.ts` apenas com autorização explícita do Clayton, caso a caso

**Header obrigatório:**
```
// QUARENTENA — movido em <YYYY-MM-DD>
// ⚠ ESTE ARQUIVO NÃO COMPILA. Preservação técnica fora do runtime.
// Origem: <caminho exato>
// Linhas originais: <intervalo>
// Commit anterior (estado vivo): <hash>
// Razão: <por que saiu do runtime>
// Recuperar: git show <hash>:<caminho>
// Sessão: <identificador>
```

**Regras invioláveis:**
- Nada em `_orphans/` vira dependência runtime
- Nada em `_orphans/` é importado por código tracked
- `_orphans/` não substitui rastreabilidade institucional (git history continua canônico)
- Esvaziamento periódico é responsabilidade do Clayton

**Análogo para refactor órfão (com direção normativa válida mas sem sessão de custódia):** `git stash push -m "<contexto>-pendente-custodia" -- <arquivo>`.

---

## 4-B. Drift schema-vs-código é regressão de genesis, não código morto

**Contexto que justifica esta lei:** o sistema foi reconstruído pós-genesis. Banco refeito do zero, código de aplicação manteve fase anterior. Drift entre o que o código espera e o que o banco oferece é a regra, não exceção.

**Implicação operacional:** quando uma query/INSERT referencia coluna ou tabela que não existe no banco, **a hipótese-padrão é "schema regrediu", não "código morto".**

### Inversão da carga de prova

Padrão errado (apagar primeiro, perguntar depois):

```
Query quebra → coluna não existe → "código órfão" → delete ou _orphans/
```

Padrão correto (auditar feature de ponta a ponta antes de qualquer ação):

```
Query quebra → coluna não existe → AUDITAR:
  1. Frontend: existe UI/form que coleta esse dado?
  2. Backend service: existe processamento (parse, validação, INSERT)?
  3. Rotas: há POST/PUT que aceitam esse dado no body?
  4. Outros consumidores: outras queries leem essas colunas?

Se 2+ camadas têm a feature implementada → REGRESSÃO DE GENESIS.
  → Adicionar schema (migration ALTER TABLE ADD COLUMN IF NOT EXISTS)
  → NÃO apagar código
  → NÃO mover para _orphans/

Se nenhuma camada tem feature → §4-A (categoria 1 ou 2) se aplica.
```

### Critério de classificação

| Sinal | Classificação | Ação |
|---|---|---|
| Frontend + service + INSERT existem; só falta schema | **Regressão de genesis** | Migration alinha banco ao código |
| Só código de leitura (SELECT) órfão; nenhuma camada grava | Provável categoria 2 do §4-A | Quarentena |
| Nenhuma referência viva em lugar nenhum | Categoria 1 do §4-A | Delete |

### Anti-padrão crítico desta IA

Erro recorrente: **propor delete/quarentena para acalmar o log**, antes de auditar se a feature existe de ponta a ponta.

**Correção:** se a query toca dado de domínio (endereço, contato, identidade, financeiro, transação), aplicar a auditoria 1-4 acima ANTES de cogitar remoção. Log poluído por 1 sessão a mais é custo trivial; perder feature 80% pronta é custo institucional alto.

### Quando aplicar

Sempre que aparecer um destes erros em runtime:
- `coluna X não existe` / `column X does not exist`
- `relação X não existe` / `relation X does not exist`
- `função X não existe` / `function X does not exist`
- Tipo TS reclamando de propriedade ausente em dado retornado de query

**Não aplica para:** drift de nomenclatura puro (camelCase ↔ snake_case com a mesma coluna existindo). Esse é cosmético, basta renomear.

### Caso canônico

Sessão F2-2 (2026-05-08): propus delete da query órfã `SELECT c.cep ... FROM companies` em `core.service.ts:472`. Clayton freou — primeiro pediu quarentena, depois auditoria ponta-a-ponta. Auditoria revelou `CompaniesManagerForm.tsx` (frontend) + `companies.service.ts` (INSERT linha 464) com feature inteira; só faltavam 8 colunas de endereço. Era regressão de genesis. Esse achado abriu F3 (Location Core).

---

## 4-C. Schema vivo > convenção esperada

**Contexto:** norma `07_NOMENCLATURA_CANONICA.md §4.4` prescreve `id` como PK. Banco real usa `{tabela}_id` na maioria das tabelas (`companies.company_id`, `profiles.profile_id`, `services.service_id`), mas `id` em algumas (`tenants.id`, `events.id`, `groups.id`). **Não há padrão único.**

**Lei:**

Quando há divergência entre norma escrita e schema material, **schema vivo manda**. Migrations futuras seguem padrão real do banco em que vão operar, não a aspiração da norma.

### Regras operacionais

1. **Não inferir PKs por naming pattern.** Sempre verificar via `information_schema.key_column_usage` antes de criar FK.
2. **Migration nova segue padrão da tabela referenciada.** FK para `tenants` referencia `tenants(id)`. FK para `companies` referencia `companies(company_id)`.
3. **Documento que não representa runtime vira teatro.** Se norma escrita diverge do banco, abrir DT para reconciliação institucional. Não corrigir banco em massa.
4. **Reconciliação normativa é sessão dedicada.** Não tentar resolver enquanto faz outra coisa.

### Caso canônico

Sessão F3-S6 (2026-05-08): planejei `headquarters_address_id REFERENCES tenants(tenant_id)` por inferência. Auditoria revelou que PK de `tenants` é `id`, não `tenant_id`. Mudei FK para `tenants(id)`. **Não tentei renomear `tenants.id` para `tenants.tenant_id` "para padronizar"** — isso seria refatoração de 199 tabelas para satisfazer norma aspiracional. DT-norma-pk-vs-banco-real aberta para reconciliação futura.

---

## 4-D. Autonomia operacional da Claude Code

**Contexto:** Claude Code tem acesso direto ao disco, executa comandos, edita arquivos, valida, commita. Eu (web) não. O ping-pong existe quando insiro passo intermediário desnecessário em operações que ela já consegue fazer sozinha.

**Lei:**

Quando o caminho está claro e o padrão é repetido (migration corretiva trivial, padrão similar a sessão anterior validada), **passar escopo completo de uma vez para Claude Code, não fragmentar em "autorize agora"**.

### Critérios para autonomia total

| Situação | Autonomia |
|---|---|
| Migration corretiva trivial seguindo padrão validado em sessão anterior | ✅ Total |
| Apply de SQL puro em catálogo global, banco vazio, sem dados | ✅ Total |
| Atualização de comentários, formatação, lint mecânico | ✅ Total |
| Decisão arquitetural / institucional (DECISION-XXXX) | ❌ Babá |
| Bug não-trivial que precisa investigação cruzada | ❌ Babá |
| Operação destrutiva (DROP, DELETE em massa, force push) | ❌ Babá |
| Primeira vez que padrão é executado | ❌ Babá (após validação, vira ✅) |

### Estrutura de prompt autônomo

```
EXECUTAR <X> — autonomia total. Sigo a tua mão livre.

Contexto: <referência ao padrão validado anterior>

Escopo completo:
1. <passo 1>
2. <passo 2>
...
N. Reportar: hash do commit + git log --oneline -5

Restrições:
- <NÃO toque em X, Y, Z>
- Se ERROR ou gate vermelho: PARAR, reportar, NÃO commitar

Você é executor com autonomia. Reporte só o resultado final.
```

### Caso canônico

Sessão F3-S6b (2026-05-08): migração corretiva `ADD COLUMN created_by_tenant_id` em `addresses`. Padrão idêntico a F3-S4b. Em vez do ping-pong de 30+ turnos da sessão anterior (autoriza etapa, cola output, autoriza próxima), passei escopo completo de uma vez. Claude Code executou autonomamente em ~2min: criou arquivo, validou banco, aplicou, validou pós, rodou 4 gates, commitou (`3c5e963d`).

### O que NÃO virou autonomia

- Decisões institucionais (DECISION-XXXX) ainda passam por mim + Clayton
- Auditoria de plano antes de executar continua sendo conversa
- Atualização de `opus.md` / `STATUS_GLOBAL` continua sendo Clayton direto

---

## 5. Fontes de verdade — runtime primeiro, documentação depois

**Para entender o que existe (runtime):**
1. **Disco vivo** (`Get-ChildItem`, `Select-String`, `view`) — verdade material
2. **`SRC_FULL.txt`, `MIGRATIONS_FULL.txt`** — código e schema consolidados (pode estar defasado vs HEAD)
3. **`git log`, `git diff`, `git blame`** — história e estado atual
4. **Banco vivo** (`psql -d unificard_dev`) — schema real, não inferido

**Para entender o que deve existir (norma):**
5. **`STATUS_EXECUCAO_GLOBAL.md` (final)** — última sessão, DTs, próximos passos. Append-only no FINAL. `Select-Object -Last 200`.
6. **`REMEDIATION_DECISIONS_LOG.md`** — DECISION-XXXX.
7. **`LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`** — constituição. §5 (não-duplicação), §11 (evolução coerente), §2 (nenhuma camada cria realidade paralela).
8. **`07_NOMENCLATURA_CANONICA.md`** — §4.7 monetário (`amountCents` BIGINT), §4.12 referências, §18 conversões DB↔Backend. **§4.4 (PK=id) é aspiracional — ver §4-C.**
9. **`SSOT_REGISTRY_UNIFICARD.md`** — autoridades de domínio. Bank é autoridade contábil.
10. **`PLANO_MESTRE_REMEDIACAO_CORE_MODULES.md`** — roteiro estratégico. **Hipótese, não prescrição cega.**
11. **`UNIFICARD_SESSION_BOOT_PROTOCOL.md`** — protocolo de operação.

**Hierarquia normativa:** Constituição → Leis Operacionais → Lei de Coerência Sistêmica → Nomenclatura Canônica → SSOT Registry.

**O que ignorar:**
- `ESTOU_APRENDENDO.md` — não-normativo
- `tmp-*.ps1`, `restore-*.ps1` em `docs/99_archive/`
- Versões antigas deste opus.md
- `SYSTEM_REMEDIATION_PLAN.md` — congelado em 2026-04-21

---

## 6. Início de sessão

1. Ler **final** de `STATUS_EXECUCAO_GLOBAL.md` (`Select-Object -Last 200`)
2. Ler este `opus.md` inteiro
3. Ler `UNIFICARD_SESSION_BOOT_PROTOCOL.md` se primeira interação ou versão mudou
4. Pedir HEAD + 4 gates + CORE_PURITY antes de ação propositiva
5. Aguardar Clayton declarar escopo. **Não oferecer trabalho proativo.**
6. Quando ele declarar:
   - **Aplicar §-1.5 primeiro** (3 perguntas)
   - Se sim em qualquer → executar
   - Se não → confirmar com Clayton se vale abrir sessão
7. Se a operação merece cerimônia (causalidade, irreversível): aplicar §0 (7 perguntas)
8. Antes de propor edição: `git diff -- <arquivo>`

**Anti-padrão de início:** começar com auditoria proativa, listar DTs, propor frente nova. Clayton diz o que quer, eu executo.

---

## 7. Fim de sessão

1. Verificar 4 gates + CORE_PURITY = baseline. Drift → resolver antes de fechar.
2. Atualizar `STATUS_EXECUCAO_GLOBAL.md` (bloco datado, append no FINAL)
3. Se decisão arquitetural: `REMEDIATION_DECISIONS_LOG.md` (DECISION-NNNN)
4. Se mudou plano: `PLANO_MESTRE_*.md` atualizado
5. Atualizar este opus.md: aprendizados novos em §8, padrões em §3-4 se virou regra
6. **Não atualizar** `SYSTEM_REMEDIATION_PLAN.md` (congelado), `PLANO_BASE_MODULO.md` (template), `ESTOU_APRENDENDO.md` (não-normativo)

**Anti-padrão de fim:** criar 5 documentos de fechamento para sessão de 1 commit. Atualização proporcional ao escopo.

---

## 7-A. Princípio: modo operante = ativação econômica contextual (Clayton, 2026-05-16)

Princípio operacional adicionado por autorização explícita de Clayton durante implementação do MVP do modo operante.

### Definição

**Operar não é "modo trabalho" nem "modo profissional". É camada de ativação econômica contextual.**
**Modo operante NÃO cria capability. REVELA capabilities/delegações/vínculos que o actor já possui.**

### Sequência arquitetural

```
actor
  → authority chain + capabilities + delegações + vínculos (SSOT)
  → modo operante (filtra: o que pode ser exercido economicamente AGORA)
  → projeção contextual (homepage, quick actions, sidebar)
```

Authority/delegação/vínculo são SSOT. Modo apenas projeta. Se delegação é revogada → contexto correspondente desaparece naturalmente. Sem cleanup, sem troca de actor.

### Frase-âncora dupla (reflexo permanente)

> **Modo operante reorganiza prioridade, não reorganiza soberania.**
> **Não cria capability, revela capabilities já autorizadas.**

### Implicação para implementação

**v1 (MVP atual, 2026-05-16):** listas hardcoded por `(actor_type, mode)` em `actorContextConfig.ts`. Valida UX (toggle, persistência, projeção, cross-mode). Custo de erro mínimo.

**v2 (NÃO implementar sem validar v1):** substitui hardcode por resolver dinâmico de capabilities/delegações. Profissão vira HINT, não fonte primária.

**REGRA INSTITUCIONAL:** MVP hardcoded primeiro, validar UX, depois v2 dinâmica. Não pular para v2 sem MVP validado, mesmo com modelo conceitual mais elegante.

### Quando aplicar este princípio

- Toda decisão sobre quick actions, sidebar, home contextual: passa pelos 2 filtros âncora
- Toda proposta "adicionar modo X": exige resposta "X é capability já existente ou cria autoridade nova?" — se segundo, vira frente de authority, não modo
- Profissão é hint dentro de Operar, não eixo próprio

Memória institucional permanente: `~/.claude/projects/C--unificard/memory/project_modo_operante.md`. Detalhes adicionais em `code.md §31`.

---

## §8. Histórico de sessões (append-only, mais recente em cima)


### 2026-05-26 — Camada 1 fixed_price_escrow fechada (F1/D2/D-money/Statement/Canonicalização)

**Sequência da Camada 1:**
- F1 (`db47798d`) — `service_orders` materializada + `seller_pending` no enum + flow `fixed_price_escrow`. Estado-only.
- D2 (`40afc3f1`) — `seller_pending → release_approved` via buyer-confirm OU timeout. Estado-only.
- D-money (`adcbc039`) — release financeiro real `escrow_payments → actor_wallet`. Atomicidade + idempotência provadas. ZERO `seller_available/user_wallet/credit` como destino.
- Statement (`b62ab6b9`) — `GET /identity/wallet/actor-statement` com saldo (bank_ledger SSOT) + origem rastreável (serviceOrderId/paymentRequestId/paymentIntentId/payerActorId).
- Canonicalização (esta entrada) — DECISION-0046 fixa `actor_wallet` como carteira canônica de qualquer actor econômico.

**REGRA CANÔNICA (DECISION-0046, vinculante para módulos futuros):**

> Para qualquer módulo futuro que precise creditar saldo de actor (PF, empresa, prestador, motorista, entregador, vendedor, bar, restaurante, fornecedor, organizador de evento, ou qualquer entidade econômica) — o destino canônico é `bank_accounts.account_type='actor_wallet'`. NÃO criar wallet paralela. NÃO reusar `user_wallet`/`seller_available`/`credit` para esse papel.

**Como instanciar:** `bankAccountService.ensureActorWalletAccount(tenantId, actorId, currency?)`. Idempotente, composite `owner_id='${actorId}:actor_wallet'`, actor_id preenchido por constraint.

**Saldo:** SEMPRE via `bankAccountService.getBalance` → `bank_ledger`. Nunca derivar, calcular paralelo, cachear como verdade.

**Read-model:** `modules/wallet/actor-wallet-statement.service.ts` ou `GET /identity/wallet/actor-statement`.

**Vinculados:** DECISION-0046 (canonical); DT-ACTOR-WALLET-PAYOUT-WIRING (saque externo é frente posterior); DT-CAMADA1-FEE-SPLIT (fee de plataforma deve ser materializado na ENTRADA via bank_splits); DT-CANONICAL-WALLET-GUARD-PENDING (enforcement automático é frente futura — hoje é documental + tipo TS + CHECK constraint).

**HEAD:** `b62ab6b9` (avança após commit desta canonicalização).


### 2026-05-11 — Bank Genesis Wave COMPLETO + C15 FIXED

**Descoberta ao retomar:** Bank Genesis Wave (beta.1.c a beta.5) ja havia sido aplicado em sessao anterior nao documentada em opus.md. TS compila limpo (0 erros). Stash Bank Genesis ja aplicado.

**Commits Bank Genesis em HEAD:**
| Commit | Descricao |
|--------|-----------|
| d5f5cff7 | Genesis-align consolidation + cents contract |
| 467eae18 | legacy adapter calcula saldo via ledger |
| 1b3d35d6 | financial-dashboard usa ledger |
| ab469d8e | remove updateCachedBalance dead code |
| 0460e66f | apply Genesis bank-account repository provider |

**C15 FIXED nesta sessao:**
- Migration: 20260530530000_tenant_products_drop_price_numeric.sql
- Remove price NUMERIC residual de tenant_products (2 de 3 tabelas ja estavam corrigidas)
- Commit: 3db7245a

**Estado atual:**
| Item | Estado |
|------|--------|
| HEAD | 3db7245a |
| Build TS | 0 erros |
| Gates | PASS (critical_new=0) |
| Stash@{0} | C65-distribution-amount-rename (Bank Genesis ja aplicado) |

**Proximas frentes (filtro par.-1.5):**
- C54: 9 caminhos financeiros sem authority gate
- C55: authority-decision.service fail-open
- C7: bloqueado por C27 (DECISION_PENDING)

---

### 2026-05-09 — Smoke E2E principal PASSOU

**Stack rodando:**
- Backend via `tsx BOOT.ts` (não `pnpm start` — drift ESM com `.js` obrigatório, debt registrado)
- Frontend Vite em :5173 OK
- Banco `unificard_dev` conectado, health 200

**Endpoints validados (200):**
- `POST /auth/register` 201
- `POST /auth/login` 200
- `/home`, `/perfil`, `/bank/balance`, `/bank/statement`, `/bank/user/group-allocation`

**Drift corrigido nesta sessão (não commitado):**
- `groups.repository.ts` — `gm.joinedat` → `gm.created_at AS "joinedAt"` (Claude Code)
- `auth.service.ts:316` — birthdate off-by-one corrigido pelo Codex: `new Date(birthdate)` → `normalizeBirthdate(birthdate)`, INSERT com `$3::DATE`. Dado smoke02816915 migrado para 1991-04-11. Validado em registro novo (birth34713474) e antigo.
- `auth.service.ts:344` — `users.plan` default no register (`plan = 'free'`) + backfill de 4 usuários com `plan IS NULL`. Validado: `GET /plan` 200 para smoke antigo e usuário novo `plan35178554`.
- `groups.repository.ts:605` — alias actor-based + timestamps snake_case (Codex). 7 substituições no bloco de invites: `id AS invite_id`, `invited_actor_id AS invited_user_id`, `invited_by_actor_id AS invited_by_user_id`, `expires_at AS "expiresAt"`, `created_at AS "createdAt"`, `COALESCE(responded_at, created_at) AS "updatedAt"`, `responded_at = now()` em UPDATE, `ORDER BY created_at`. Schema vivo é actor-based + snake_case; código TS mantém contrato legacy via alias. Validado: `GET /groups/invites/mine?status=pending` 200.
- `companies` module — gap de schema corrigido + alias rename id (Codex). Investigação revelou drift inverso: código TS pressupunha 7 colunas inexistentes em `company_users`. Aplicado caminho honesto (DECISION-0023):
  - **Migrations:**
    - `20260530520000_add_company_users_updated_at.sql` — ADD `updated_at` TIMESTAMPTZ + trigger `trg_company_users_updated_at` usando função `update_updated_at_column` (criada em F3-S4)
    - `20260530520500_add_company_users_rbac_columns.sql` — ADD 6 colunas: `role_description` (TEXT nullable), `can_manage_financial`, `can_manage_employees`, `can_view_reports`, `can_manage_services` (BOOLEAN NOT NULL DEFAULT false), `metadata` (JSONB NOT NULL DEFAULT '{}')
  - **Código (`companies.service.ts`):**
    - Linha 571: `RETURNING id AS company_user_id, created_at, updated_at`
    - Linhas 990, 1114: `cu.id AS company_user_id` (alias)
    - Linhas 1002, 1126: `cu.updated_at as cu_updated_at` (removeu mentira `NULL::timestamptz`)
    - Linhas 1372-1388: `SELECT cu.*` expandido para 16 colunas explícitas com `cu.id AS company_user_id`
    - Linha 1391: `WHERE cu.id = $1::uuid`
    - Linha 1536: `WHERE ... AND id != $3::uuid` (UPDATE bulk demote primary)
    - Linha 1566: `AND cu.id = ${paramIdx}::uuid`
  - **Schema final `company_users`:** 16 colunas (10 originais + 6 novas)
  - **Validado:** `GET /companies` 200, build OK, `/health` 200. Trigger `updated_at` criado e ativo (não exercitado por banco vazio).

**0 erros smoke abertos. Smoke E2E principal completo.**

**Erros não-bloqueantes em loop nos workers (ruído operacional, não tocar agora):**
- `ReleaseWorker`: intent 3327ef51 "Cannot transfer to the same account" (dado órfão)
- `ReconciliationWorker`: "coluna pi.status não existe" (hint: bs.status)
- `SlaMonitorWorker`: "coluna status não existe"
- `PaymentWorker`: Redis (BullMQ desconectado, REDIS_ENABLED=false desligaria)

---

### 2026-05-09 (parte 3) — F3-S8 + F3-S9: infraestrutura de endereço pronta

Sessão preparatória após o smoke fechar verde. Schema canônico de endereço alinhado, writer disponível. Não tocou comportamento visível em companies/perfil — isso fica para F3-S10a/S10b.

**Material aplicado (não commitado):**

- **F3-S8** — Migration `20260530521000_add_companies_primary_address_id.sql`:
  - `companies.primary_address_id UUID REFERENCES addresses(address_id) ON DELETE SET NULL`
  - Forward-only, mantém colunas legacy intactas (`cep`, `address`, `city`, `state`, etc.)

- **F3-S9a** — Reader fix em `location.repository.ts`:
  - 6 queries corrigidas com alias SQL: `iso_alpha2 AS code` (countries), `abbreviation AS code` (states)
  - `is_active` agora lido honestamente (não mais hardcoded `isActive: true`)
  - `findAllCountries` filtra `WHERE is_active = true`
  - Tipos `CountryRow`/`StateRow` realinhados com query real (id, countryId)
  - **Contrato externo intacto** — `Country.code` e `State.code` mantidos em ~20 consumidores
  - Validado: `GET /locations/countries` 200 retornando `[{"code":"BR","name":"Brasil","isActive":true}]`

- **F3-S9b** — Writer canônico em `location.repository.ts`:
  - `createAddress(data, createdByTenantId)` — INSERT em `addresses` com 14 colunas, RETURNING aliased camelCase. `is_geocoded` derivado em SQL (true se lat presente)
  - `assignAddress(addressId, ownerType, ownerId, role, isPrimary?)` — INSERT em `address_assignments`
  - 5 tipos novos em `location.types.ts`: `CreateAddressInput`, `Address`, `AddressOwnerType` (7 valores), `AddressRole` (7 valores), `AddressAssignment`
  - Honra DECISION-0021: `created_by_tenant_id` aceita `null`, soft-audit
  - Não exercitado por endpoint — validação cruzada via build PASS

**Validação:**
- `pnpm build` PASS sem erro novo
- `/health` 200, banco conectado
- `/locations/countries` 200 com seed Brasil

**Observações para sessões futuras (DTs implícitas):**
- `Address.source` ficou `string` enquanto `CreateAddressInput.source` é union estrito. Inconsistência menor; alinhar em refactor futuro.
- TypeScript não captura constraint `addresses_latlng_paired` (banco trava se lat sem lng). Documentar para chamadores em F3-S10a.

**Próxima sessão (F3-S10a + S10b + smoke):**
- F3-S10a: adapter writer em `companies.service.ts` — INSERT em `addresses` + `address_assignments` com role='HQ' ao criar empresa, gravar `primary_address_id`. Mantém INSERT nas colunas legacy durante coexistência.
- F3-S10b: adapter reader em `core.service.ts:472` — substituir `SELECT c.cep, c.address...` por JOIN em `addresses` via `primary_address_id`. Fallback legacy.
- Smoke E2E: criar empresa pela API com endereço → ler em `/profile` → endereço aparece via `addresses` (fecha A5 ponta-a-ponta).

---

### 2026-05-09 — ReleaseWorker C1: intent órfã neutralizada (entrada original imprecisa, corrigida em parte 5)

**Aviso:** esta entrada foi escrita durante a sessão e contém imprecisão material. A correção institucional honesta está na entrada "parte 5" desta mesma data.

**O que de fato aconteceu nesta sessão:**
- intent órfã 3327ef51-e1ce-456f-a993-c018c6f60102 marcada como failed manualmente
- metadata recebeu: {"failure_reason":"missing_seller_lifecycle_accounts"}
- ReleaseWorker parou de fazer loop sobre essa intent específica

**O que esta entrada AFIRMOU mas é impreciso:**
- "Removido fallback em backend/src/modules/bank/bank-account.repository.ts" — INEXATO
- "fallback removido completamente" — INEXATO

**Realidade material descoberta em parte 5:**
- O método `getAccountByOwnerAndType` que continha o fallback "qualquer system" NUNCA esteve em HEAD
- Em HEAD existe apenas `getSystemAccount` antigo, sem fallback semântico
- O fallback documentado aqui está dentro de refactor amplo guardado em `stash@{0}` (bank-account-genesis-alignment-pendente-custodia), nunca commitado
- C1 (loop ReleaseWorker) foi tratado pela neutralização manual da intent órfã, não por remoção de fallback no código

**Aprendizado institucional VÁLIDO (independente da imprecisão acima):**
- fallback semântico em domínio financeiro cria autoridade implícita clandestina
- "qualquer conta system serve" viola soberania de lifecycle accounts
- ausência estrutural deve falhar explicitamente, nunca improvisar identidade financeira

Gates rodados (PASS):
- actor-writer
- bank-ledger
- regression-guards

### 2026-05-08 — Location Core completo (F3-S4 a F3-S6b)

**Commits:**
- `c6cc5038` — F3-S4: base administrativa (countries/states/cities/neighborhoods + helpers + GENERATED COLUMN `name_normalized`)
- `ffc16063` — F3-S4b + F3-S5: constraint `UNIQUE(country_id, abbreviation)` em states + seed Brasil mínimo (1 país + 27 estados + 27 capitais)
- `d0821d56` — F3-S6: addresses + address_assignments + `tenants.headquarters_address_id`
- `3c5e963d` — F3-S6b: `created_by_tenant_id` em addresses (soft-audit, DECISION-0021)

**Estado final do Location Core:**

| Camada | Status |
|---|---|
| countries / states / cities / neighborhoods | ✅ schema + seed BR (1+27+27) |
| Helpers (`normalize_name`, `update_updated_at_column`) | ✅ ativos |
| Constraints defensivas | ✅ name_normalized + abbreviation unique |
| addresses | ✅ entidade canônica + soft-audit tenant |
| address_assignments | ✅ polimórfico, event sourcing leve |
| tenants.headquarters_address_id | ✅ FK adicionada |

**Decisões institucionais consolidadas:**
- DECISION-0020: Location Core como infraestrutura territorial soberana
- DECISION-0021: tenant-awareness em addresses (Opção A refinada — global compartilhado + soft-audit via `created_by_tenant_id`)
- F3-S5 = seed estrutural, não seed de produção nacional (rollout incremental)
- Seed fundacional usa INSERT PURO, não ON CONFLICT
- Subqueries territoriais filtram por country_id explicitamente (sigla UF não é globalmente única)

**Leis novas adicionadas nesta sessão:**
- **§4-C** — Schema vivo > convenção esperada (ver seção 4-C acima)
- **§4-D** — Autonomia operacional da Claude Code (ver seção 4-D acima)

**Aprendizados operacionais:**
- ChatGPT pegou bug em F3-S5 (subqueries sem `country_id`) que passou em revisão interna
- Codex pegou que arquivo local divergia de `MIGRATIONS_FULL.txt` (snapshot antigo)
- `sed` regex pode pegar declarações mas deixar referências em WHERE — auditoria explícita pré-apply é obrigatória
- Auditoria externa não é cerimônia; é defesa real contra alucinação interna
- F3-S6b foi de 30+ ping-pongs (padrão antigo) para 1 prompt + 1 reporte (autonomia §4-D)

**Pendências F3 (próximas sessões):**
- F3-S8: ADD `companies.primary_address_id` (resolve A5 do log de runtime)
- F3-S9: LocationRepository TS (writer canônico de addresses)
- F3-S10a/b: adapter writer/reader em companies.service e core.service
- F3-S11: endpoint manual `POST /location/addresses`
- F3-S11b: CEP enrichment com cache + fallback gracioso (não-bloqueante)
- F3-S12: testes integration repository
- F3-S13: smoke E2E companies+endereço
- F3-S7 [BLOQUEADO — decisão pendente sobre escopo de economic_regions, NÃO por DECISION-0022 que é sobre groups invites]: economic_regions + tenant_operational_regions

**DTs abertas:**
- DT-norma-pk-vs-banco-real: norma §4.4 (PK=`id`) diverge do banco real ({tabela}_id majoritário) — sessão dedicada para reconciliação institucional
- DT-eol-autocrlf-windows: warnings LF→CRLF não-bloqueantes (cosmético)
- DT-debug-code-em-service: `PARAM_DEBUG` em `core.service.ts:218` (deixar para depois)
- F1 stash `C65-distribution-amount-rename-pendente-custodia` em `stash@{0}` pendente decisão

---

### 2026-05-08 — F2-S1 fechada (A1/A2/A3) e F3 aberta

**F2-S1:** drift `updatedAt`/`createdAt` em queries SQL de `core.service.ts` (migrations 0125-0127 renomearam para snake_case, código não acompanhou). Edição cirúrgica: 4 linhas, commit `8a47369c`. 4/4 gates PASS. Status atualizado em `8e28a951`.

**F2-S2 → F3 (escalada):** começou tentando corrigir A5 (`coluna c.cep não existe` em `core.service.ts:472`). Aplicação de §4-B revelou que feature de endereço de empresa estava 80% pronta no código — só faltava schema. Investigação Codex + ChatGPT descobriu que **plano canônico de Location Core já existiu e foi recuado** durante reconstrução pós-genesis. Migrations arquivadas em `migrations_archive/0360-0363`.

**F3-S1, S2, S3:** auditoria geográfica + arqueologia arquitetural + decisão fundacional. Resultado: DECISION-0020 aprovada com 6 dimensões fechadas. Schema canônico aprovado.

**§4-B nasceu nesta sessão.** Eu propus delete da query órfã. Clayton freou 2 vezes — primeiro pediu quarentena, depois pediu auditoria ponta-a-ponta. Sem essas frenagens, eu teria criado mais um pedaço de realidade paralela.

---

### 2026-05-07 — recalibração: produto > processo

**Contexto:** Sessão 3 da Frente 3 levou 30+ turnos para deletar `autoDistribute` (função morta, zero callers). Clayton interveio múltiplas vezes apontando excesso de cerimônia. Auditorias paralelas confirmaram que **o sistema tem fundação sólida onde importa** — gap é em observability/preventivo, não em runtime crítico.

**Princípios consolidados nesta sessão (depois embebidos em §-3 a §-1.5):**
- A função desta IA é destravar Clayton para ver sistema rodando, não criar processo institucional
- Cerimônia tem custo, vale só para causalidade financeira em runtime ou contrato externo
- Sistema sem usuários tem espaço para errar e corrigir — aproveitar
- Briefing antagonista bom é estreito

**Hash de fechamento:** `4510e13a refactor(economy/distribution): remove autoDistribute (codigo morto)`

---

### 2026-05-12 — Smoke E2E PASS · §-3 90% · 3 frentes registradas

**Referência:** executei_5.md · HEAD `464fc45e`

**O que foi feito:** Smoke E2E completo no HEAD pós-C40. Build (0 erros), backend :3000, banco conectado, auth/company/profile verdes, `bank_ledger.pg_typeof = bigint` confirmado, frontend :5173.

**§-3 cumprido em 90%.** Último 10% = Q3-E2E econômico mínimo (passo 8 SKIP — mint sistêmico sem rota user-facing). Transação real no `bank_ledger` não foi exercitada ponta-a-ponta após Bank Genesis Wave.

**3 frentes registradas em SYSTEM_REMEDIATION_STATUS.md (OPEN, não executar nesta sessão):**

| Frente | §-1.5 | Resumo |
|---|---|---|
| DT-CONTRACT-DRIFT-IMPLICIT-PROTOCOL | P2 | `cpf`/`x-action-context`/`scope` obrigatórios sem contrato público |
| MIGRATION-DRIFT-RECONCILIATION | P2 | DB=286 vs disco=296 — delta de 10 migrações sem registro retroativo |
| Q3-E2E-ECONOMICO-MINIMO | **P3** | §-3 incompleto — transação bank_ledger não exercitada |

**Aprendizados desta sessão:**

1. **Smoke verde operacional ≠ smoke verde econômico.** Build/auth/profile passam sem nenhum dado financeiro real. P3 (causalidade financeira) é a única garantia que o ledger está wired. §-3 sem P3 é §-3 parcial.

2. **Contratos HTTP implícitos descobertos via Zod 400 iterativo são DT real de DX.** Não tolerar como ruído. `cpf` obrigatório, `x-action-context` com schema implícito, `scope` com `tenantId` prefixado — nenhum estava documentado. Cada um custou 1 round-trip. Em automação/SDK isso é multiplicado por 5+. Registrar como frente própria.

3. **Delta `schema_migrations` vs disco perde memória institucional em 3 sessões.** A causa é conhecida hoje (psql direto sem registro). Em 3 sessões ou próximo onboarding, vira opaco. Reconciliar enquanto a causa ainda é rastreável.

---

## §9. Mantendo este arquivo honesto

- Se não aprendi nada novo, **não escrever em §8 só para preencher**. Sessões repetitivas são saudáveis.
- Se descobrir que algo escrito aqui está errado, **editar a seção** (§-3 a §7), não adicionar contradição em §8.
- Se este arquivo passar de ~500 linhas, virou burocracia. Cortar mais que adicionar.
- **Leis novas (§4-X) vão na seção de leis estruturais, não no histórico.** O histórico só registra a sessão que originou a lei, com link para a seção.
- Se Clayton trouxer outra IA Opus, ela lê este arquivo primeiro. Escrever para ela.

**Hierarquia interna:**
- §-3 (missão) é a regra acima de tudo. Se a próxima Opus quer "auditar arquitetura abstratamente", ela está violando §-3.
- §-2 (runtime descobre arquitetura) governa leitura de realidade.
- §-1.5 (filtro 3 perguntas) governa decisão de abrir sessão.
- §0 (7 perguntas) é condicional, não automático.
- §4-A a §4-D são leis operacionais com casos canônicos. Aplicar quando o sintoma bater.

**Se em alguma sessão futura este arquivo crescer mais que o sistema:** parar. O sistema é o produto. Este arquivo é nota lateral.

**Sessões anteriores a 2026-05-07** foram podadas deste arquivo. Estado consolidado: §-3 a §7 + §4-A a §4-D capturam tudo que importa. Detalhes históricos vivem em `git log` e `STATUS_EXECUCAO_GLOBAL.md`.




### 2026-05-09 (parte 4) — F3-S10a/b + smoke E2E F3 FECHADO · A5 ponta-a-ponta · 3 drifts pré-existentes descobertos no caminho

Sessão de fechamento. F3-S10a/b aplicados conforme plano. Smoke E2E exercitou pela primeira vez o caminho real de criação de empresa via API e revelou 4 drifts pré-existentes (1 esperado: helper de tenant; 3 inesperados: schema vs código no fluxo createCompany).

**Aplicado conforme plano (F3-S10):**

- **F3-S10a** — Adapter writer em `companies.service.ts:511-569`:
  - Após capturar `companyId` do RETURNING do INSERT INTO companies, antes de domains
  - Lookup `findCountryByCode(address.country || 'BR')` → se não achar, log warn + skip canônico
  - `createAddress(...)` + `assignAddress(addressId, 'company', companyId, 'HQ', true)`
  - `UPDATE companies SET primary_address_id WHERE tenant_id=$2 AND company_id=$3` (guarda de tenant)
  - Try/catch defensivo, log com tenantId/companyId/addressId/assignmentAttempted, NÃO re-throw

- **F3-S10b** — Adapter reader em `core.service.ts:504-541`:
  - Originalmente planejado como LEFT JOIN + COALESCE com legacy
  - Aplicado como leitura direta de `addresses` via `primary_address_id` (porque INSERT companies foi reduzido para minimalista — colunas legacy nunca existiram nesta versão do schema)
  - `address_id` retorna UUID real do `addresses` quando canônico, fallback `'company'` quando legacy
  - Verificado: zero uso literal de `address_id === 'company'` em frontend/src ou backend/src

**Drifts pré-existentes descobertos pelo smoke E2E (não são F3-S10 puro):**

1. `companies.service.ts:737` — `resolveTenantIdFromGlobalUserId` usava `INNER JOIN global_users gu ON u.user_id = gu.user_id`, mas `global_users.user_id` não existe (PK é `global_user_id`). Função chamada em 9 pontos. Toda operação de criação/edição de empresa via API estava quebrada — só não tinha aparecido porque ninguém criou empresa via API antes desta sessão. Fix: SELECT direto sem JOIN.

2. `companies.service.ts:464` — INSERT INTO companies pressupunha 17+ colunas inexistentes (`registered_at, cep, address, address_number, complement, neighborhood, city, state, country, phone, email, website, main_activity_code, main_activity_description, secondary_activities, revenue_data, metadata`). Schema vivo de companies é minimalista (12 colunas, contando F3-S8). Fix: INSERT reduzido para colunas reais.

3. `companies.service.ts:603` — INSERT INTO company_users não incluía `tenant_id`, que é NOT NULL no schema vivo. Fix: tenant_id adicionado ao INSERT.

4. `companies.service.ts:548` — INSERT INTO company_domains tentava gravar em tabela que **não existe no banco vivo nem em migrations ativas**. Fix: try/catch tratando `42P01` (undefined_table) como legacy opcional, segue execução com warn. Tabela foi removida na reconstrução pós-genesis; código TS não acompanhou.

**Validação ponta-a-ponta (smoke E2E F3):**
- POST /companies 201 com primary_address_id populado
- addresses: 1 linha criada (postal_code=80010100, source=UX_INPUT, created_by_tenant_id preenchido)
- address_assignments: 1 linha (owner_type=company, role=HQ, is_primary=true, valid_until_at=NULL)
- GET /core/profile retorna endereço canônico com UUID real:
```json
{
  "address_id": "d7368626-b353-43a6-9a16-c81c9343aa3d",
  "cep": "80010100",
  "address": "Rua XV de Novembro",
  "city": null,
  "state": null,
  "country": "BR"
}
```

**A5 fechado E2E.** Caminho canônico de endereço para empresa: API → addresses → address_assignments → primary_address_id → reader → response.

**Aprendizado institucional (consolida §4-B):**

Código que nunca rolou em runtime acumula drift silencioso. Smoke E2E exercita caminhos pela primeira vez e revela esse drift acumulado. Os 4 drifts pré-existentes descobertos hoje são todos da mesma natureza: pressuposição de schema/tabelas que não existem no banco vivo. Nenhum era falha de F3-S10 — todos vieram do `createCompany` original que nunca tinha sido exercitado por API real.

**Padrão consolidado:** quando smoke exercita caminho novo, **expecta-se** descobrir drifts. Não é falha de planejamento — é descoberta natural.

**Pendências para sessões futuras:**

- `city/state/neighborhood` retornam `null` no GET /core/profile porque endereço canônico tem FK para catálogo (cities/states/neighborhoods) mas reader ainda não resolve nomes. Fica para **F3-S11** (resolver nomes via JOIN no reader).
- Modelo de empresa "rico" vs minimalista: o código TS sugere intenção de schema com endereço/contato/atividades CNAE/receita/metadata embutidos em `companies`. Schema vivo descartou. Decisão futura: materializar (ALTER TABLE ADD) ou limpar código. Não é hoje.
- `company_domains`: tabela arquivada com código ativo dependendo dela. Try/catch é patch operacional. Refactor (ou ressurreição) é decisão futura.

---


### 2026-05-09 (parte 5) — Cascata de commits encerrada · Bank Genesis Alignment descoberta · §4-E arqueologia formalizada

Sessão final do dia. Plano original previa 6 commits em cascata (auth, groups, bank, RBAC migrations, F3 location, docs). Cascata fechou em 3 commits após descoberta material de onda Bank Genesis Alignment paralela e interrompida.

**Commits fechados:**
- `92913733` fix(auth): align register/login with live users schema
- `c6999d84` fix(groups): align membership and invites queries with live schema
- `c8b0b2e1` feat(company-users): materialize RBAC columns + updated_at trigger (DECISION-0023)

**Commits NÃO fechados (com motivo material):**
- Commit 3 (Bank fallback) PULADO. Investigação revelou que o fallback "qualquer system" não existe em HEAD. Método `getAccountByOwnerAndType` que continha o fallback nunca foi commitado — está em stash@{0} como parte de refactor amplo. Correção da entrada Bank acima desta (mesma data) feita.
- Commit 5 (F3 location) PENDENTE. Build TS não passa em HEAD (26 erros) por acoplamento Bank descoberto.
- Commit 6 (docs) PENDENTE. Aguarda Bank Genesis ser resolvido.

**Descoberta material crítica — Bank Genesis Alignment:**

Investigação cruzada (Codex + Claude Code, validada por mim) revelou que `bank-account.repository.ts` stashed é peça de uma onda de refactor arquitetural muito maior, não arquivo isolado:

| Componente | Estado |
|---|---|
| bank-account.repository.ts (stashed) | refactor Genesis-aligned (+211/-83 linhas) |
| Consumidores commitados em `5b3f2096` (2026-04-22) | já chamam API nova |
| 21 arquivos Bank modified no working tree | onda paralela não auditada |
| 5 arquivos Bank/identity untracked | dependem da API nova |
| Total da onda | ~27 arquivos |

Sistema está em estado intermediário não-funcional desde 2026-04-22. Build TS falha com 26 erros há ~3 semanas. Smoke E2E desta sessão funcionou apenas porque os caminhos exercitados não passam pelos métodos quebrados. Nenhum dos 27 arquivos foi causado por esta sessão — foram revelados por ela.

**Aprendizado institucional novo — §4-E: Quando debugging vira arqueologia**

Quando a investigação revela que um drift não é falha pontual, mas resíduo de migração arquitetural interrompida, o modo da sessão muda. Não se "corrige" arqueologia — se reconstrói coerência ou se isola para frente dedicada.

Sinais de que a sessão entrou em modo arqueológico:
- Fornecedor e consumidores apontam para versões diferentes de uma mesma API
- Stashes contêm peças de um todo coerente que nunca foi commitado
- Build não passa em HEAD desde commit antigo, sem ninguém ter percebido
- "Fazer rápido pra desbloquear cascata" é tentação de regressão

Resposta correta: pausa institucional, evidência histórica, topologia real, decisão consciente sobre adotar/isolar/abandonar.

**Aprendizado adicional 1 — Smoke E2E não é gate suficiente:**
TypeScript não protege runtime financeiro, mas detecta acoplamentos quebrados que smoke não exercita. `pnpm tsc --noEmit` é gate complementar mínimo. Nesta sessão eu (Opus) afirmei "pnpm build PASS" baseado em relato sem auditar materialmente — descoberta hoje desmente. Próxima cascata: confirmar `tsc --noEmit` antes do primeiro commit.

**Aprendizado adicional 2 — Stash pode esconder ondas, não apenas peças:**
Quando descobrir stash em domínio crítico, primeiro investigar toda a área dirty ao redor antes de decidir adotar/descartar. Stash@{0} parecia "1 arquivo de refactor não validado" — era peça de onda de 27 arquivos.

**Aprendizado adicional 3 — Cascata em terreno não-validado é dívida silenciosa:**
Os 3 commits feitos hoje são corretos isoladamente, mas foram feitos em working tree que não compilava. Não é falha — é descoberta tardia. Os commits valem (escopo isolado, mensagens honestas). Mas premissa de cascata era inválida desde o início.

**Aprendizado adicional 4 — Errei narrativamente na entrada Bank original:**
Reproduzi "fallback removido completamente" sem auditar HEAD materialmente. Caí no anti-padrão §-2 ("documentação implica runtime"). Correção feita. Padrão a aplicar: antes de afirmar "X removido", grep HEAD para confirmar.

**DTs Bank novas:**
- DT-bank-genesis-alignment-wave (27 arquivos, frente dedicada)
- DT-bank-balance-consolidation-genesis-drift (lê 5+ colunas inexistentes; vai crashar em runtime)
- DT-bank-balance-by-cpf-genesis-drift (provável)
- DT-bank-balance-by-region-genesis-drift (provável)
- DT-bank-system-liquidity-helper-audit (helper de manutenção a auditar)
- DT-bank-fallback-original-still-active (correção planejada nunca chegou em HEAD)

**DTs gerais novas:**
- DT-tsc-noEmit-not-gated (CI não roda tsc como gate; HEAD broken passou despercebido ~3 semanas)
- DT-company-documents-archived (INSERT em tabela inexistente sem proteção 42P01)
- DT-company-opportunity-preferences-archived (try/catch silencioso em tabela arquivada)

**Estado pós-sessão:**
- HEAD: c8b0b2e1
- Working tree dirty conscientemente (F3 + Bank wave + 3 migrations + opus.md)
- Stashes preservados: stash@{0} bank, stash@{1} C65 distribution, stash@{2} local-before-rescue
- Build: 26 erros TS conhecidos, todos relacionados à onda Bank
- Sistema em runtime: estável (memória com código antigo coerente; reinício deve aguardar Bank Genesis fechado)

**Próxima sessão:**
- Frente dedicada Bank Genesis Alignment (alta prioridade, 2-3h)
- F3 fechamento (Commits 5+6) quando build passar
- F3-S11 (nomes city/state/neighborhood via JOIN catálogo)
- Adicionar `pnpm tsc --noEmit` como gate CI (alta prioridade institucional)

---

### 2026-05-10 — Sessão Bank Genesis Wave: pacote arquitetural formalizado + β.1

### Estado material ao final desta sessão

| Item | Estado |
|---|---|
| HEAD | `d5f5cff7` |
| Branch | `rescue-structural` |
| Build TS | 26 erros (baseline mantido; só caem após β.4 stash aplicado) |
| 4 gates CI | PASS, `critical_new=0` |
| Stash@{0} | intacto (`bank-account-genesis-alignment-pendente-custodia`) |
| Working tree | dirty consciente (Bank Wave + F3 + ruído node_modules) |
| Schema vivo `bank_accounts` | inalterado (`owner_id text NOT NULL`, etc.) |

### Cascata de commits desta sessão

| Hash | Subject | Tipo |
|---|---|---|
| `8993d1e3` | decisions: register DECISION-0021 through DECISION-0024 | governança (formaliza pacote Bank Genesis parte 1: ledger-only SSOT) |
| `8588e040` | decisions: DECISION-0025 mono-currency BRL na linhagem Genesis | governança (pacote Bank Genesis parte 2) |
| `ae2ba1e3` | docs: institucionaliza REMEDIATION_DT_LOG.md + 3 DTs iniciais | governança (novo artefato institucional) |
| `d5f5cff7` | fix(bank): Genesis-align consolidation + cents contract | runtime — primeiro fix material de Bank Genesis |

### Pacote arquitetural Bank Genesis (agora formalizado)

**DECISION-0024**: `bank_ledger` é SSOT financeiro único. `cached_balance` e `metadata` em `bank_accounts` deprecados. `updateCachedBalance` é NO-OP intencional. Origem: auditoria material do `stash@{0}` revelou que o refactor do provider embute essas três decisões latentes; aplicar sem nomear seria commit que mente sobre escopo.

**DECISION-0025**: UnifyBank Genesis opera mono-currency (BRL) no provider financeiro. `bank_accounts` não tem coluna `currency`. Parâmetro `currency` aceito por compat de assinatura mas ignorado. `BankCurrency` type permanece, mas só `'BRL'` é operacional. Decisão separável de 0024 (ledger-only multi-currency seria possível em outro design), mas chegou junto no mesmo stash.

**REMEDIATION_DT_LOG.md**: novo artefato institucional na raiz do repo. Distinção formal entre DECISIONs (decisões soberanas) e DTs (degradações conscientes). 3 DTs OPEN inaugurais:
- `DT-bank-cachedBalanceCents-naming-heterogeneity`
- `DT-bank-accounts-last-activity-ghost-column`
- `DT-bank-balance-consolidation-region-fallback-tenant`

### β.1 — fix material aplicado

**Arquivo:** `backend/src/modules/bank/bank-balance-consolidation.service.ts`

Escopo do commit (declarado amplo por Cenário X.1 confirmado em auditoria):

1. **`getConsolidatedBalance` Genesis-aligned** (β.1 desta sessão):
   - SELECT reescrito para schema Genesis (7 colunas reais; removidas 5 inexistentes)
   - Mapper coerente com DECISION-0024 + DECISION-0025
   - `filters.currency` ignorado em todo o método (WHERE + destructuring + baseCurrency fallback + bloco regional)
   - regionId fallback `|| tenantId` preservado (já existia)
   - Saldo real continua via `bankLedgerRepository.calculateBalance` no loop

2. **`updateReconciliation` cents contract** (dirty pré-existente consolidado):
   - `externalBalance` → `externalBalanceCents`
   - `difference` → `differenceCents`
   - Hardening monetário alinhado com invariante "amount_cents BIGINT — nunca NUMERIC para dinheiro"
   - Tratado como adjacência Bank Wave por coerência semântica; não veio do `stash@{0}` (confirmado por `git stash show --stat`)

**Validação pós-commit:** TS 26 erros (baseline), 4 gates PASS, commit atômico (1 arquivo).

### Lições materiais desta sessão

**§4-E.2 (segundo uso bem-sucedido — promover a sub-cláusula formal):**

> Em modo arqueológico, contagens agregadas mentem por inclusão. O conjunto causal real é tipicamente uma fração do conjunto narrativo.

Evidência: a "onda Bank Genesis" foi narrada como 27 arquivos. Auditoria revelou conjunto causal mínimo de 5 (provider stashed + 4 consumidores). Os outros ~20 eram adjacência (dirty contemporâneo mas causalmente independente). β.0.5b com filtro estrito separou Conjunto 1 (Bank Genesis Wave) de Conjunto 2 (Core UnifyBank Drift). O segundo nem entrou nesta sessão.

**§4-E.3 (nova sub-cláusula em maturação):**

> Em modo arqueológico, sinal de drift externo merece pausa, não alarme. Pausa permite confirmação material; alarme contamina o próprio raciocínio com hipóteses graves que depois é caro desinflar.

Evidência: vi migrations `0007-0014` no `git status` e working tree de 22.439 entradas, construí narrativa de "drift externo grave" sem confirmar primeiro. Era falso positivo — material estava em `migrations-resetadas/` desde 04/05, anterior à sessão. Sua frase "backend e banco atualizados" era operacional sobre `SRC_FULL.txt/MIGRATIONS_FULL.txt`, não sobre sistema vivo. A parada institucional foi correta; a escalada narrativa foi prematura.

**Auto-correção sobre cleanup de `currency` em β.1:**

A preparação do patch leu o arquivo em duas partes (início + fim) e não auditou a região intermediária. Resultado: 3 usos órfãos de `currency` no bloco regional sobreviveram, TS subiu de 26 → 29 após o primeiro patch. Codex parou conforme regra, patch corretivo aplicado, TS voltou a 26. Lição: ler arquivo em pedaços não é equivalente a auditar arquivo inteiro; cleanup que toca destructuring precisa de grep completo pela variável removida.

### Próximos passos (próxima sessão Bank Genesis)

- **β.1.c**: fix `core/economy/account.service.ts:45` — usa `cachedBalanceCents` como saldo. Cuidado: arquivo em domínio diferente (`core/`, não `modules/bank/`), possivelmente legacy adapter; decisão pode envolver "manter, refatorar ou deprecar inteiro" antes de patch.
- **β.1.d**: fix `financial-dashboard.controller.ts:73` — SQL `WHERE cached_balance < 0` em coluna Genesis-inexistente; runtime crash garantido pós-stash.
- **β.2**: resolver 8 chamadas de `updateCachedBalance` em `bank-transaction.service.ts` (decisão por chamada: remover ou marcar como NO-OP legado explicitamente).
- **β.3**: revalidar 26 call-sites de `getSystemAccount` após β.1.c e β.1.d para sanidade pós-fixes.
- **β.4**: aplicar `stash@{0}` em branch descartável; medir TS (deveria cair de 26 → 0) + rodar 4 gates.
- **β.5**: se β.4 limpo, aplicar no `rescue-structural` com commit que cite o pacote Bank Genesis completo.

DTs adicionais a registrar quando relevante:
- `DT-bank-transaction-stub-account-construction` (L1017, `cachedBalanceCents: 0 as any`)
- `DT-bank-repository-encapsulation-violations` (6 importadores diretos de `bank-account.repository` fora de `modules/bank/`)
- `DT-bank-currency-type-cleanup` (já mencionada em DECISION-0025, registrar formal quando aplicável)

---

## §5. PADRAO DE VERSIONAMENTO: executei.md (2026-05-11)

### Decisao

**Padrao:** `executei.md` = sessao atual; quando cresce, arquiva como `executei_N.md`.

### Regras

1. **executei.md** e o arquivo de trabalho da sessao ATUAL
2. **Quando ultrapassa ~1000 linhas:** arquivar como `executei_N.md` (N = proximo numero disponivel) e zerar executei.md
3. **Numeracao:** crescente (executei_1.md, executei_2.md, executei_3.md...)
4. **Gitignore:** TODOS os executei*.md sao artefatos efemeros, NAO versionados
5. **Informacao permanente:** vai para arquivos institucionais:
   - SYSTEM_REMEDIATION_STATUS.md (status de violacoes)
   - REMEDIATION_DECISIONS_LOG.md (decisoes formais)
   - REMEDIATION_DT_LOG.md (dividas tecnicas)
   - code.md (aprendizados, mapas, erros)

### Ciclo de vida

```
executei.md (sessao atual, ~0-1000 linhas)
    |
    v quando ultrapassa ~1000 linhas
    |
executei_N.md (arquivo morto)
    +
executei.md zerado (nova sessao)
```

### Justificativa

- executei.md e checkpoint de sessao, nao documentacao permanente
- Arquivos numerados sao historico local para referencia, nao versionados
- Permite Clayton auditar trabalho em andamento sem commitar rascunhos
- Informacao que importa ja foi para arquivos institucionais

---

## §8. Q3-E2E v1 → DECISION-0031 → Smoke v2 (2026-05-12)

### O que aconteceu

Q3-E2E econômico passo 5 falhou: `COVERAGE_EXCEEDED: 100.00 cobertura`.

O trigger `check_coverage_before_credit` bloqueia qualquer crédito a usuários quando
`execution_capacity_cents = 0`. Num tenant novo (sem atividade econômica real), a VIEW
`system_coverage` pós-C40 exclui `system:liquidity_issuance:%` do cálculo — o que é
correto por design. Resultado: `execution_capacity = 0` → coverage = 100% → BLOCKED.

Cinco opções foram avaliadas (A: rota admin, B: ensureLiquidityIssuance também provisiona
reserve, C: seed de tenant, D: trigger excepciona estado inicial, Z: rever o smoke).

### O que aprendemos

**Quando smoke E2E financeiro falha, a hipótese-padrão NÃO é "falta implementação".**

A hipótese correta é: "o smoke está tentando um caminho que o sistema deliberadamente
não oferece". Antes de propor implementação:
1. Ler as leis (LEDGER_SOVEREIGNTY → INVARIANTES → POLITICA_ATIVACAO → SSOT_REGISTRY)
2. Ler o código real (trigger + VIEW + split engine)
3. Consultar múltiplos agentes com perspectivas distintas
4. Só então decidir se o sistema precisa mudar

### Auditoria multi-agente

- **Claude Code:** diagnóstico técnico preciso (trigger, VIEW, capacity=0, 4 opções)
- **ChatGPT:** reformulação ontológica ("coverage é entidade soberana, não proxy técnico")
- **Opus:** auditoria normativa contra 5 leis → todas as 5 opções falharam
- **Clayton:** decisão soberana — DECISION-0031

Nenhum agente isolado chegaria a DECISION-0031. O multi-AI foi metodologia, não atalho.

### DECISION-0031 — síntese

"Coverage é propriedade emergente de atividade econômica validada institucionalmente,
não recurso provisionado artificialmente."

Sequência fundacional canônica:
1. Tenant criado → `ensurePlatformAccounts`
2. Primeiro `event_ticket` com split engine → 17% → system reserve
3. `execution_capacity_cents > 0` emerge da atividade real
4. P2P e Q3-E2E possíveis

### DT-COVERAGE-BOOTSTRAP-REQUIRED

ENCERRADA via DECISION-0031 — sem implementação. O sistema está correto.

### Q3-E2E v2

Novo smoke segue caminho fundacional via `event_ticket`. `Q3_E2E_V2_PLAN.md` criado
(gitignored). Sessão dedicada futura — não executar sem plano aprovado.

### C40 colateralmente validado

Mesmo que o mint tenha falhado, a query `system_coverage` confirmou em runtime:
- `pg_typeof(execution_capacity_cents) = bigint` ✓
- `pg_typeof(total_credits_cents) = bigint` ✓

C40 parcialmente validado como efeito colateral do smoke v1.

**Princípio operacional descoberto em runtime (preservar):**

> O sistema deve preferir parar explicitamente a fingir solvência implicitamente.

**Caso canônico:** Q3-E2E v1 (2026-05-12). Trigger `check_coverage_before_credit`
bloqueou emissão sem capacity. A interrupção do fluxo foi comportamento correto do
sistema, não falha operacional. O `COVERAGE_EXCEEDED: 100% — capacity=0` era a verdade
institucional sendo enforced, não um bug a corrigir.

**Lição:** invariantes econômicos reais devem sobreviver à pressão de execução, smoke
tests e conveniência operacional. Quando smoke financeiro falha por invariante de
runtime, hipótese-padrão é "invariante está certo, smoke estava errado", não o contrário.

---

## DECISION-0047 — Economic Policy Engine como camada canônica de DECISÃO de split (2026-05-26)

PE-1 substrate. 5 tabelas (`economic_policies` + `economic_policy_lines` +
`access_pass_products` + `actor_access_passes` + `economic_policy_resolution_logs`) +
resolver puro determinístico + 15 E2E verdes.

**Princípio operacional:** policy é resolução, não cálculo inline. Toda regra de split
econômico de qualquer transação passa a ser:

1. **Resolução** — `economicPolicyEngineService.resolveEconomicPolicy(input)` retorna
   policy + lines + access pass aplicado por specificity DESC → priority DESC →
   effective_from DESC. Fail-closed em AMBIGUITY / NOT_FOUND.
2. **Cálculo** — `calculatePolicySplits(amountCents, lines)`: BPS integer (sem float).
   Drift de arredondamento absorvido pela primeira linha `revenue_share`. Sem
   revenue_share = fail-closed `DRIFT_NO_REVENUE_SHARE`.
3. **Persistência** — `bank_splits` continua soberano (DECISION-0044, CORE_SPLIT).
   Engine entrega `CalculatedEconomicSplit[]`; caller traduz em INSERT.
4. **Audit** — `economic_policy_resolution_logs` registra CADA chamada (inclusive
   fails) com input + policy + splits + pass.

**O que NÃO está plugado ainda:**

- `service-payment-execution` continua com split hardcoded (`DT-POLICY-ENGINE-PLUG-SERVICE-EXECUTION`, frente PE-3).
- Não há admin panel / CRUD (`DT-ECONOMIC-POLICY-ADMIN-PANEL`, frente PE-2).
- `bank_policies` legacy permanece dormente (`DT-POLICY-ENGINE-LEGACY-DEPRECATION`, frente PE-4).

**Regra operacional permanente:** qualquer fluxo econômico NOVO deve usar o engine. O
caller chama `resolveEconomicPolicy(...)` na transação financeira; se policy ausente,
falha fail-closed (não cair em hardcoded). Inserir policy no DB > cálculo inline.

---

## DECISION-0048 — Convergência policy engine (2026-05-26)

DECISION-0047 amplificou escopo sem auditar estruturas vivas. DECISION-0048 corrige
(append; sem retroagir) e estabelece **convergência sem coexistência permanente** —
porque o sistema é dev/virgem, sem produção a preservar.

**Camadas separadas materialmente:**

1. **DECISÃO (resolução)** — `economic_policies` + `economic_policy_engine`. Canônico ÚNICO.
2. **CÁLCULO** — `economicPolicyEngineService.calculatePolicySplits()` (BPS integer, sem float).
3. **EXECUÇÃO (materialização)** — `bank-transaction.service` (único orquestrador).
4. **PERSISTÊNCIA (SSOT)** — `bank_transactions` + `bank_splits` + `bank_ledger` (irreversível).

**Mudanças materiais:**

- `bank-policy.service.resolveSplitPolicy` / `setPolicy` REMOVIDOS.
- `bank_policies` HARD-DEPRECATED (COMMENT'd; preservada apenas porque `bank-limit.service` usa `getPolicy<T>()` para limites).
- `bankSplitEngineService` permanece calculador legacy (event_ticket / ride / p2p / group / service_booking) com defaults hardcoded — SEM fonte alternativa de policy. Cutover em PE-3+.
- `rca_commission` → `channel_commission` (RCA é jargão; canal é genérico).
- `category_id` como seletor de policy: PERMITIDO (norma §9.3 atualizada). Categoria seleciona policy; não calcula split.

**Invariantes inegociáveis (guardrails CRITICAL automatizados):**

1. PE engine NÃO importa `bank-ledger`/`bank-transaction.service`/`bank-split-engine`/`bank-split.repository`.
2. Imports novos de `bank-policy.service` proibidos fora da allowlist (próprio + `bank-limit.service`).
3. Literal `rca_commission`/`rca_actor_wallet` proibido em código.

**Regra mestre permanente:** "Quem decide regra (`economic_policy_engine`) ≠ quem
materializa dinheiro (`bank-transaction.service`). Dois cérebros só prestam em ficção
científica; em sistema financeiro é autópsia antecipada." — Clayton 2026-05-26.

---

## PE-3 — service_execution agora usa economic_policy_engine (2026-05-26)

Plug entregue. Cliente paga valor BRUTO; engine resolve policy; Bank materializa
splits canônicos numa única transação; `actor_wallet` recebe APENAS revenue_share
via D-money.

**Cadeia material:**

```
createExecution (input.splits AUSENTE)
  → economicPolicyEngineService.resolveEconomicPolicy(serviceExecution context)
     ↳ fail-closed em POLICY_NOT_FOUND / POLICY_AMBIGUITY
  → calculatePolicySplits(amountCents, lines)
     ↳ BPS integer, drift→revenue_share[0]
  → resolveSplitDestinationFromPolicy (mapeia destination_type → bankAccount)
     ↳ FAIL_CLOSED em referral/group/channel/custom/regional_fund (frente PE-4+)
  → processServicePaymentExecutionCanonical com splitRecipients heterogêneos
  → createTransactionWithExplicitSplitLines (1 tx, N splits, N ledger entries)
  → payment_intent.metadata.splits FILTRADO para APENAS releaseToActorWallet=true
  → audit metadata: policyId, policyCode, policyVersion, calculatedSplits, etc.
```

**D-money:** lê `metadata.splits` (só revenue_share), move para `actor_wallet`.
Validação anti-vazamento: `sumSplits > totalAmountCents` falha. `actor_wallet` jamais
recebe mais que o pago.

**Legacy preservado:** caller que passa `input.splits=[100%]` continua funcionando
(E2Es existentes não regridem). T9 do PE-3 prova.

**Regra operacional permanente:** "actor_wallet recebe APENAS o líquido pertencente
ao actor. Fee, reserve, regional_fund, referral, channel, group — TUDO vai para
destinos próprios na hora da execução, NUNCA passam pelo actor_wallet do prestador."

---

## PE-4-METRICS + regional_origin_basis (2026-05-26)

**`economicMetricsService`** entrega métricas sociais REAIS de destinos econômicos
(regional_fund, group) em tempo real, read-only, dedupe canônico por
`identities.global_user_id`.

**Regra operacional permanente:**

> "Actor NÃO é pessoa. Para contar PESSOAS, deduplicar por
> `identities.global_user_id` segmentado por `tax_id_type` + `kyc_status`.
> `actor.id` é métrica INTERNA, nunca pública. CPF/CNPJ NUNCA aparecem em
> payload. Não-verificados em rótulo SEPARADO. 'Ativo' = contribuição
> financeira últimos 30 dias via `bank_splits.created_at`. Saldo sempre
> `bank_ledger`."

**Contrato `regional_origin_basis`** — formalizado em **DECISION-0049 (2026-05-26)**.
Coluna `economic_policy_lines.regional_origin_basis TEXT` + 2 CHECK constraints
no Postgres (não Zod). Enum canônico de **7 valores** (mixed_policy REMOVIDO —
é padrão de USO via múltiplas linhas).

**Regra mestre permanente:**

> "CNPJ identifica quem é a empresa. Actor identifica unidade/papel operacional.
> Endereço OPERATIONAL identifica onde aquela unidade impacta economicamente.
> Policy declara qual origem regional usar. Bank materializa. Ledger prova."

**Anti-padrão bloqueado por DECISION-0049:** HQ NUNCA como fallback automático.
Se empresa não cadastra OPERATIONAL, sistema TRAVA (não premia cadastro
incompleto). Para HQ ser usado, policy declara `basis='receiver_company_hq'`
explicitamente em linha própria. Código NÃO interpreta intenção.

**Pré-requisito UX** rastreado em
`DT-PJ-OPERATIONAL-ADDRESS-MANDATORY-BEFORE-DYNAMIC-REGIONAL` (OPEN HIGH).
Resolver dinâmico **NÃO implementado** — continua FAIL-CLOSED em PE-3.

---

## DECISION-0050 — Cartório operacional (PE-5-CARTÓRIO, 2026-05-26)

Convenção canônica fechada (L_owner_1 = A):

> "HQ é jurídico. OPERATIONAL é unidade. OPERATIONAL de actor-unidade usa
> `address_assignments.owner_type='service_provider'`, `owner_id=actor.id`,
> `role='OPERATIONAL'`. Resolver regional só pode usar isso quando existir;
> não cai em HQ."

`service_provider` é nome TÉCNICO de owner_type de endereço (NÃO é actor_type).
Helper canônico em `backend/src/core/location/operational-address.helper.ts`
expõe `getOperationalAddressForActor` / `assertActorHasOperationalAddress` /
`createOperationalAddressForActor`. Idempotente, tenant-safe, zero impacto
em ledger/split/payment.

Resolver dinâmico (PE-5-RESOLVER) continua FAIL-CLOSED — só será habilitado
quando UX/onboarding garantir OPERATIONAL cadastrado para PJ.

---

## DECISION-0051 — PE-5-RESOLVER-MVP PJ-only (2026-05-26)

Resolver dinâmico de `regional_fund` HABILITADO para PJ:

```
receiver_company_operational → getOperationalAddressForActor(receiverActorId)
                                → ensureRegionalFundBankAccountForRegion
receiver_company_hq          → address_assignments(owner_type='company',
                                  owner_id=receiver.company_id, role='HQ')
                                → ensureRegionalFundBankAccountForRegion
mixed_policy                 → N linhas regional_fund independentes
```

**Regra mestre permanente:**

> "regional_fund cai DIRETO na conta do fundo regional (city-level via
> ensureRegionalFundBankAccountForRegion), nunca em actor_wallet. D-money
> só toca metadata.splits onde releaseToActorWallet=true (= revenue_share).
> HQ NUNCA é fallback automático de OPERATIONAL — code não interpreta
> intenção. PF basis (identity_residence) fail-closed até PE-5-RESOLVER-V2."

E2E PE-5-RESOLVER 8/8 verdes prova todos os caminhos + fail-closeds.

---

## DECISION-0058 — F-ACTOR-WALLET-PAYOUT-WIRING (2026-05-28, documental)

**F1+F2+F2-hardening+F3 DONE.** Escopo INTERNO fechado (DT-ACTOR-WALLET-PAYOUT-WIRING).

**F4 (saque externo)**: DECISION-0059 (2026-05-28) registrou cerca documental. Veredito A/B/C unânime: PARAR. F4 começa com DECISION, não com código. Sub-frentes mapeadas em sub-DTs próprias:
- F4.0 — DT-ACTOR-BANK-DESTINATION-MISSING (`actor_bank_destinations`)
- F4.1 — DT-EXTERNAL-PAYOUT-ORDER-SUBSTRATE-MISSING (`actor_wallet_external_payouts`)
- F4.2 — DT-PSP-DISBURSEMENT-ADAPTER-MISSING (escolha de PSP)
- F4.3 — DT-EXTERNAL-PAYOUT-CALLBACK-RECONCILIATION-MISSING (webhook + returned)
- F4.4 — DT-PAYOUT-EXTERNAL-KYC-GATE-MISSING (compliance/KYC)

Axioma central DECISION-0059: envio externo é operação fora do sistema; ledger interno NÃO é fonte primária da verdade externa.

**DECISION-0060 (2026-05-28)** — governança canônica de F4.0 + correção factual append-only de DECISION-0059 D5:
- Identidade fiscal e KYC vivem em `identities`, **NÃO** em `actors` (`actors.cpf_cnpj` e `actors.kyc_status` foram removidos em migration 0010).
- SSOT canônico: `identities.tax_id`, `identities.tax_id_type`, `identities.kyc_status='approved'`.
- Gate canônico KYC para F4: `evaluateKycLayer` em `authority-decision.service.ts:125-205` modo `strict`.
- `actor_bank_destinations` será catálogo reutilizável, NÃO destino inline.
- "Conta própria" exige enforcement em duas camadas (service fail-closed + TRIGGER). CHECK puro NÃO funciona (sem JOIN/sub-SELECT em PostgreSQL).
- **F4.0 MVP substrate DONE** (commit `e1536d07`, 2026-05-28) — `actor_bank_destinations` catálogo + lifecycle + auto_tax_id_match + manual_review. "Conta própria" em duas camadas (service + DB TRIGGER). DT-ACTOR-BANK-DESTINATION-MISSING CLOSED. E2E 8/8 + regressões F1/F2/F3/C3/C3.1/C7/statement todas verdes. Zero PSP, zero PIX/TED real, zero callback, zero worker, zero ledger.
- **Reconciliação confirmada (2026-05-28)** — F4.0 está fechada em `823dc17f`. Próxima frente recomendada **NÃO é F4.1**. Perfil/contexto está seguro com ressalvas. DTs de perfil/contexto/UX e higiene E2E foram registradas em sessão append-only (10 DTs novas: DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER, DT-CAPABILITIES-ENDPOINT-FRONTEND-DISCONNECTED, DT-USER-PROFILES-LEGACY-ORPHAN, DT-AVAILABLE-ACTOR-USER-ID-CONFUSION-RISK, DT-UX-GHOST-ROUTE-TRANSPARENCIA, DT-UX-GHOST-ROUTE-NOTIFICATIONS, DT-DEPRECATED-ACTOR-CONTEXT-KEY-ORPHAN, DT-COMPANY-DASHBOARD-ACTOR-CHECK-EMPTY, DT-PROTECTEDROUTE-DIAGNOSTIC-LOG, DT-E2E-ACTOR-WALLET-PAYOUT-FIXTURE-BALANCE-DEPLETION).
- **DT-E2E-ACTOR-WALLET-PAYOUT-FIXTURE-BALANCE-DEPLETION CLOSED (2026-05-28)** — F2 ganhou seed determinístico (`seedWalletCreditF2` + `cleanupSeedCreditsF2` por `reference_type='e2e_f2_seed'`, mesmo padrão de F3 desde commit `8f36db6e`). Sequência F3→F2→F2→F3 prova idempotência: 18/18, 20/20, 20/20, 18/18. Zero código de produção alterado, zero migration. Apenas scripts E2E.
- **DT-DEPRECATED-ACTOR-CONTEXT-KEY-ORPHAN CLOSED (2026-05-28)** — `frontend/src/hooks/useActorContext.ts` deletado (zero consumers confirmado por grep). Chave deprecated `unificard_active_actor` eliminada do source. Chave soberana `unificard_active_actor_id` em SessionProvider continua intacta. Comentário órfão em `useActorMode.ts:5` ajustado. Build frontend + typecheck + backend gates verdes. Zero backend, zero migration.
- **DT-UX-GHOST-ROUTE-TRANSPARENCIA + DT-UX-GHOST-ROUTE-NOTIFICATIONS CLOSED (2026-05-28)** — `TransparencyPage.tsx` + `NotificationsPage.tsx` criadas como placeholders honestos (zero backend fetch, zero dado fake, botão voltar /home) e registradas em App.tsx dentro do SocialLayout (junto com `impacto`). Para Notifications: API `api/system-notifications.ts` e componente `NotificationList.tsx` JÁ EXISTEM no projeto, mas integração formal fica para fatia de produto separada (decisão de filtros/paginação/política UX) — documentado no header da página. Build + typecheck + backend gates verdes. Zero backend, zero migration.
- **DT-PROTECTEDROUTE-DIAGNOSTIC-LOG + DT-COMPANY-DASHBOARD-ACTOR-CHECK-EMPTY CLOSED (2026-05-28)** — `ProtectedRoute.tsx` perdeu o bloco `[DIAG 2026-05-19]` (console.log + window check); lógica de auth intacta. `CompanyDashboardPage.tsx` ganhou estado honesto quando `activeActor.actor_type !== 'page'`: mensagem clara + botões Ir para Empresas / Voltar para a Home, sem fetch, sem authority resolution no frontend, sem troca implícita de actor (backend continua autoritativo). Build + typecheck + backend gates verdes. Zero backend, zero migration.
- **DECISION-0061 registrada (2026-05-28)** — `ACTOR_PUBLIC_PROFILE_CANONICALITY`, Hipótese C. `actors` é SSOT da identidade pública básica do actor (`display_name`, `slug`, `avatar_url`, `cover_url`, `bio`, `metadata`). `public_profiles` reservada como camada pública/social complementar (`visibility`, `is_public`, `is_verified` não-KYC, contadores como projeção definida); proibida de competir com `actors` por campos básicos. Frontend continua usando `/social/actors/:id` (lê de `actors`). DT-PUBLIC-PROFILES-NO-FRONTEND-CONSUMER permanece **OPEN — BLOCKED BY DECISION-0061**; implementação futura escolherá entre C1 (saneamento de schema) ou C2 (neutralização temporária). Próximo passo recomendado: C2 primeiro — menos glamour, mais verdade.
- **DT reclassificada (2026-05-28)** — `DT-USER-PROFILES-LEGACY-ORPHAN` SUPERSEDED → **DT-CPF-SSOT-DUAL-WRITE-CORE-VS-IDENTITY** (MEDIUM, OPEN). Raio-X confirmou `user_profiles` NÃO é órfão: 7 rows runtime, declarado FONTE ÚNICA do CPF em `core.service.ts:313`, escrito por `profile.service.ts` em CTE com espelho em `profiles.cpf`, consumido por `Profile.tsx:336` em UI editável. Problema real é dual-write/ambiguidade entre CORE (`user_profiles.cpf`+`profiles.cpf`) e identity/KYC/payout (`identities.tax_id`, DECISION-0060 D2). Divergência runtime: 7 user_profiles vs identities parciais.
- **DECISION-0062 registrada (2026-05-28)** — `CPF_CNPJ_SSOT_CANONICALITY_GLOBAL`. **Hipótese A escolhida** como destino canônico, com execução gradual F0–F5. `identities.tax_id` vence como SSOT operacional global de documento fiscal; `global_users.cpf` âncora de cadastro/dedup/auth bootstrap (imutável após criação — lock semântico de D4); `user_profiles.cpf` e `profiles.cpf` viram projeções transitórias; `actors.cpf_cnpj` e `actors.kyc_status` mortos confirmados. Estende a normativa-mãe `IDENTITY_SSOT_PRECEDENCE.md` para o domínio CORE/onboarding. DT-CPF-SSOT-DUAL-WRITE permanece **OPEN — BLOCKED BY DECISION-0062** (só fecha após F0–F5).
- **F0.1 DECISION-0062 (2026-05-28)** — `bank-balance-by-cpf.service.ts` corrigido: query trocou `FROM users u ... AND u.cpf = $2` (coluna inexistente) por JOIN canônico `FROM global_users gu JOIN users u ON u.global_user_id = gu.global_user_id WHERE gu.cpf = $2`. Endpoint admin-only `GET /admin/finance/consolidated-balance/by-cpf/:cpf` deixa de retornar 500 permanente. Read-model puro, zero ledger, zero risco financeiro. Alinhado à DECISION-0062 D4. **DT-BANK-BALANCE-BY-CPF-GHOST-USERS-CPF CLOSED**.
- **F2 DECISION-0062 (2026-05-28)** — Backfill idempotente de `identities` a partir de `global_users.cpf` concluído. Script `backend/src/scripts/backfill-identities-from-global-users-cpf.ts` com dry-run default + `--apply` explícito + `ON CONFLICT DO NOTHING` + validação `validateCpf` (dígitos verificadores) + LGPD-safe logging (`sanitizeCpfForLog`). Resultado APPLY: 10 inserts (delta 9→19 identities), 1 bloqueado por dígitos inválidos. Zero alteração em `global_users.cpf` (imutável D4), `user_profiles.cpf`, `profiles.cpf`, CORE/auth services, ledger. Gates verdes: tsc, actor-writer, bank-ledger, regression-guards, arch critical_new=0; E2E F4.0 8/8 + E2E KYC PASS pós-F2. DT-CPF-SSOT-DUAL-WRITE permanece OPEN — F3 (E2E coerência) → F4 (migrar leitura CORE) → F5 (deprecar caches) seguem pendentes.
- **F3 DECISION-0062 (2026-05-28)** — Suite E2E `backend/src/scripts/validate-pipeline-e2e-cpf-tax-id-coherence.ts` com 9 cenários (T1 baseline pós-F2, T2 coerência cross-substrato, T3 cadastro real, T4 CORE coerente, T5 payload público sem CPF, T6 F4.0 happy path, T7 F4.0 bloqueia mismatch, T8 idempotência F2 por re-run real, T9 cleanup seguro). Resultado: **9/9 PASS**. Prefixo `e2e_f3_cpf_tax_id_`, env lock `unificard_dev`, LGPD-safe via `sanitizeCpfForLog`. Gates verdes pós-F3: tsc clean, actor-writer GATE OK §4.8.1, bank-ledger GATE OK §4.6, regression-guards GATE OK, arch `critical_new=0`. E2Es vizinhos pós-F3: KYC PASS + actor-bank-destinations 8/8 PASS. Zero alteração em service/schema/migration. **Descoberta material registrada como DT separada:** `actor.repository.findOrCreateUserActor` (`actor.repository.ts:101-111`) NÃO popula `actors.global_user_id` no INSERT — falha tardia em F4.0 para todo usuário recém-cadastrado. E2E F3 compensa localmente na fixture (`UPDATE actors SET global_user_id=...`) sem tocar código de produção. Nova **DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID** aberta. DT-CPF-SSOT-DUAL-WRITE permanece OPEN — F4 (migrar leitura CORE) → F5 (deprecar caches) seguem pendentes.
- **F3.1 v2 DECISION-0062 (2026-05-28)** — `register` agora cria identity ANTES do actor; `findOrCreateUserActor` preenche e valida `actors.global_user_id` contra `identities` (fail-closed em service layer); DT-FINDORCREATEUSERACTOR-MISSING-GLOBAL-USER-ID **CLOSED**; DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION aberta (3 vocabulários `user`/`page`/`actor_human`/`company` coexistindo em CHECK aberta — `chk_actor_requires_identity` inefetiva sobre `actor_type='user'` runtime majoritário). Dupla camada: Movimento B em `auth.service.ts:515-540` (ordem invertida, best-effort preservado); Movimento A em `actor.repository.ts:56-130` (resolve `users.global_user_id` na query existente, valida `identities` row, INSERT inclui `global_user_id` satisfazendo FK `fk_actor_identity`). T1/T2/T3 ad-hoc + T4 F3 9/9 + T5 KYC PASS + T6 F4.0 8/8 + tsc clean + 4 gates de boundary/regression GATE OK + arch strict `critical_new=0`. Auditoria live banco vivo: 134 atores, 40 com `global_user_id`, **94 sem** — backfill de existentes é fatia futura (não autorizado). F4 (leitura CORE) segue pendente (exige Clayton). Profile P0 segue separado.
- **Guardião read-only C1/C2/C3/C4 (2026-05-28)** — auditoria para D1/D2. Vocabulário canônico candidato `user/page/group/channel` (`actor_human/actor_organizational/actor_system/person/company/system` mortos no código). Concept ATIVO em bank_transactions/canonical_products/company_type_allowed_concepts; FINGIDO em categories (3/102). Capability/authority backend é hardcoded (`ACTOR_CAPABILITIES_MAP` literal), frontend usa catálogo estático — dinamização é frente nova. Resolvibilidade dos 81 atores `user` sem global_user_id: 61 backfill_simples, 18 actor_sem_user, 2 global_user_sem_identity.
- **F-DEV-DATA-CLEAN-RESET Fase 0 (2026-05-28) — AWAITING APPROVAL** — reset seletivo de fixtures/teste em `unificard_dev` substituindo backfill dos 94 órfãos. Fase 0 (read-only) DONE: backup pg_dump 9.3 MB em `C:/unificard/RESET_BACKUP_2026-05-28T23-29-59.dump`, manifesto JSON 40 KB em `C:/unificard/RESET_MANIFEST_2026-05-29T02-28-38-985Z.json`. UUIDs canônicos confirmados (DEV tenant `fbe13b78-…`, DEV actor `751a4fe0-…`, DEV user `beb7b5e4-…`). Plano: PRESERVE=1 tenant + 1 actor (dev), DELETE=38 tenants + 74 actors dentro do DEV. Seeds GLOBAL (concepts/company_types/categories) e tenant-scoped DEV (permissions/roles/role_permissions) intactos. Trava bank_* do DEV (ledger=1486) preservada. **5 achados aguardando decisão Clayton:** (1) dev sem cadeia PF canônica — opções A/B/C; (2) 74 actors no DEV incluem 5 pages com nomes reais ("Restaurante Sabor da Bahia"/"MotoMecânica Sul"/"Banda Som da Rua"); (3) "Tenant unifybank" ambíguo; (4) 20 tenants q3v3organizer* com 126 ledger rows — trigger pode bloquear DELETE; (5) global_users transversal — validar exclusividade em runtime. Próximo passo: aguardando "APROVADO" + decisões; sem ele Fase 1 NÃO inicia.
- **F-DEV-DATA-CLEAN-RESET Fase 1.1 DONE + 1.2 BLOQUEADA (2026-05-29)** — estratégia drop/recreate com ensaio em espelho aprovada. Tenant unifybank confirmado fixture (Aparecida, gmail, slug timestamp-based, nada no código depende). Permissões adicionadas: `pg_dump:*` e `createdb:*` durável; `dropdb:*` apenas interativo. **Fase 1.1 artefatos** (local, não commitar): `RESET_SCHEMA_BEFORE_*.sql` 637 KB + `RESET_INVENTORY_BEFORE_*.json` 470 KB (235 tables, 1111 constraints, 76 triggers, 122 functions; **314 migrations registradas, 328 arquivos, 17 pendentes, 3 órfãs sem ficheiro**). Seeds estruturais vivem DENTRO de migrations; diretório `seeds/` só tem fixtures. **Fase 1.2 BLOQUEADA por 2 descobertas materiais:** (A) `migrate.ts` chama `loadBackendEnv()` → `hydrateDatabaseUrlFromEnvFile` (load-backend-env.ts:42-66) que SOBRESCREVE `process.env.DATABASE_URL` sempre — ensaio em espelho via env var rodou contra o banco REAL; ROLLBACK transacional preservou tudo intacto; (B) migration `20260530558000_extend_payment_intents_released_to_actor_wallet.sql` FALHA porque há 1 row com `payment_status='refunded_via_recovery'` (valor adicionado apenas por 571000 POSTERIOR); CHECK atual do banco JÁ inclui ambos — drift via rota manual/órfã (possivelmente uma das 3 versions sem ficheiro). Banco real INTACTO (contagens iguais baseline); espelho `unificard_dev_rebuild_check_20260529001835` criado vazio (0 tables, dropdb pendente de aprovação interativa). Portão 1.3 → RESULTADO VÁLIDO = descoberta de dívida. Decisões pendentes Clayton: destravar Descoberta A (patch local ou runner-mirror), resolver Descoberta B (corrigir 558000 ou reordenar), investigar 3 órfãs em `schema_migrations`, aprovar dropdb do espelho.
- **F-FIX-ENV-PRECEDENCE — Descoberta A RESOLVIDA (2026-05-29)** — `migrate.ts` respeitava `.env` por cima do env explícito (arma carregada — rodou no banco real no ensaio anterior). Corrigido: `load-backend-env.ts` hidrata DATABASE_URL APENAS se não estiver setado (`if (value && !process.env.DATABASE_URL)`); env vence .env. Adicionado guard-rail em `migrate.ts:557-589`: `SELECT current_database()` → log "🎯 Banco-alvo"; se `EXPECTED_DATABASE_NAME` setada e divergente, exit 2 antes de aplicar migrations. Validação 7/7: (a) boot normal hidrata OK / (b) migrate sem EXPECTED loga e segue / (c) override de DATABASE_URL respeitado / (d) EXPECTED confere PASS / (e) EXPECTED divergente aborta exit 2 / (f) gates 5/5 (`critical_new=0`) / (g) E2Es F3 9/9 + F4.0 8/8 + KYC PROVA DE OURO + Σ. Blame: commit `39ea70623` marco-zero 2026-05-22; razão original (dotenv truncar em #) preservada via guarda condicional. Espelhos descartáveis criados e dropados na mesma fatia. Reset/ensaio em espelho DESBLOQUEADO. Descoberta B (558000) e 3 órfãs ficam para o ensaio pós-fix.
- **F-DEV-DATA-CLEAN-RESET Fase 1.2 RETOMADA — Descoberta C aberta (2026-05-29)** — ensaio em espelho com TRAVA `EXPECTED_DATABASE_NAME` ativa (confirmada nos logs em cada migrate: "🎯 Banco-alvo: unificard_dev_rebuild_check_20260529011201 / ✅ Alvo confere"). Banco real intocado. 178/328 migrations OK no espelho; falha em [179/328] `20260428200000_schedules_revoke_write.sql` — REVOKE sobre `schedules` que ainda não existe. CREATE TABLE vem em `20260530200000_schedules.sql` (timestamp posterior; ordem alfabética coloca REVOKE antes de CREATE). **Descoberta C** (distinta de A e B). Porque banco real funciona: `schedules` provavelmente criada por uma das 3 órfãs (`20260530518000_create_payment_milestones`/`519000_seed_concept_split_engineering`/`560000_backfill_pf_actor_registry`) ou SQL manual. **Observação dirigida sobre 558000 NÃO VERIFICÁVEL** — ensaio parou bem antes; precisa destravar C primeiro. Artefatos: schema BEFORE 637 KB / inventário BEFORE 470 KB / log migrate completo / schema espelho parcial 328 KB / inventário parcial 230 KB / diff parcial 390 KB. Portão 1.3 → PARAR; recomendação: corrigir ordem (renomear `20260428200000_schedules_revoke_write` para timestamp ≥ `20260530200001`) E investigar 3 órfãs. Espelho `unificard_dev_rebuild_check_20260529011201` ainda criado (dropdb interativo após docs registrados).
- **F-MIGRATION-REBUILD-COHERENCE-AUDIT — dívida total mapeada (2026-05-29)** — guardião read-only com 3 paralelas (auditoria estática). Resultado: **3 órfãs** (294 `create_payment_milestones` + 295 `seed_concept_split_engineering` ambas baseline-marked sem rodar SQL [checksum=null], + 307 `backfill_pf_actor_registry` executada de verdade); **8 inversões REF_BEFORE_CREATE em 5 famílias** (schedules, schedule_slots, bookings 4×, event_attendees, rides_vehicles — todos padrão "ALTER/REVOKE em abril sobre tabela criada em maio"); **4 refs a `_deprecated_*`** (rename manual via 20260429200000_cleanup_semantico); **2 tabelas de dívida real** (`_deprecated_product_concept_resolution_queue`, `_deprecated_tenant_products`) com blast radius zero; **117 CREATE TABLE IF NOT EXISTS** mascarando dívida implícita; **1 colisão de timestamp** (`20260530560000` é prefixo de órfã 307 E pending `create_economic_policies` — sem efeito no runner). Gap de 113 tabelas faltantes no espelho parcial = **111 esperado + 2 dívida real**. **10 migrations forward-only PRECISARÃO ser criadas** em 4 pacotes coerentes: P1 estrutural pré-cleanup (schedules/schedule_slots/bookings/event_attendees/2× `_deprecated_*`), P2 substituir órfãs (payment_milestones/split-engineering/backfill PF idempotente), P3 rides FULL only, P4 17 pending (inclui Descoberta B 558000). Artefatos AUDIT_A/B/C JSON locais (não commitados). Banco real só recebeu SELECTs.
- **F-MIGRATION-REBUILD-PACKAGES — Desenho do Pacote 1 (2026-05-29)** — guardião read-only para desenhar P1 antes de escrever SQL. Decisões fechadas pelo Clayton respeitadas (Pacote 3 `_deprecated_*` fora; órfã 560000 tombstone via writer canônico actor.repository vivo). **Das 5 famílias da Paralela B, só 1 é dívida real:** `schedules` + `schedule_slots` (REVOKE bruto sem guard em `20260428200000:4-5` → CREATE em `20260530200000` e `20260530210000` com IF NOT EXISTS). As outras 3 são **falsas positivas** — todas têm guard `IF EXISTS` (bookings/event_attendees: `IF EXISTS column` em information_schema = no-op no rebuild zero porque tabela ainda não existe; rides_vehicles: `IF EXISTS table` + `ADD COLUMN IF NOT EXISTS` = no-op também). Grep confirmou que nenhuma migration posterior usa colunas renomeadas (`requested_at`, `checked_in_at` etc.) — divergência cosmética entre rebuild (colunas legadas) e real (modernas) sem impacto em migrations. **Pacote 1 final = 2 migrations:** `20260428100000_create_schedules.sql` e `20260428110000_create_schedule_slots.sql` (clones dos CREATE existentes com IF NOT EXISTS, ~30 linhas SQL total). Análise dos guards: `check-migration-numbering.js:28` ignora arquivos 14-dígitos; `extractMigrationNumber` retorna null → forward-only check não se aplica; ordenação alfabética por filename ok. Aguardando autorização Clayton+Opus+ChatGPT para escrever. Refinamento futuro da Paralela B: filtrar ALTERs envoltos em `DO $$ IF EXISTS … END $$`.
- **Instância E — lacuna dos nomes RESOLVIDA (2026-05-29)** — guardião read-only para fechar contradição tree (CREATE com nomes LEGADOS: requestedat/check_in_time) vs real (modernos: requested_at/checked_in_at). **Achado decisivo:** rota é **(a) migration do tree que rodou na ordem cronológica certa por acaso**. Evidência em `schema_migrations.executed_at`: 20260530150000 e 20260530491000 (CREATEs com legados) executadas em 21/abr 13:48; 20260428260000 e 20260428280000 (RENAMEs) executadas em 29/abr 22:42 — **8 dias DEPOIS**, apesar do filename sugerir "antes". As RENAMEs foram adicionadas ao tree DEPOIS das CREATEs já terem rodado; o runner detectou pendentes novas, rodou-as, e as tabelas já existiam → RENAME efetivou. No rebuild zero (tudo pendente), ordem alfabética coloca RENAME ANTES de CREATE → no-op silencioso → tabela final com colunas LEGADAS. **A divergência rebuild-vs-real NÃO é cosmética: é estrutural** (4 nomes diferentes em bookings + 1 em event_attendees). Refinamento da entrega P1 anterior: alternativa A) Pacote 1 mínimo (só schedules+schedule_slots, aceita divergência) vs B) Pacote 1 ampliado (~6 migrations: + availability + bookings + event_attendees backdated com nomes modernos, rebuild=real). Estado-alvo das 4 tabelas core capturado integralmente para guiar escrita. As 3 órfãs descartadas como rota (nomes não relacionados). Aguardando decisão Clayton entre A e B.
- **Instância F — TRAVA pré-escrita Pacote 1 confirmada (2026-05-29)** — guardião read-only. Decisão fechada: Pacote 1 = alternativa B (ampliado), rides FORA, criar backdated NOVO (nunca editar antigo). **Único statement posterior por tabela** = a CHECK constraint `chk_<tabela>_status` da 535000 (NÃO-GUARDED). **Solução**: backdated CRIA tabela + colunas modernas + PK + FKs + UNIQUE inline + índices; NÃO antecipa CHECK (vem da 535000). **TRAVA RENAMES OK**: todos os 5 RENAMEs (bookings 4× + event_attendees 1×) são guarded por `DO $$ IF EXISTS column legacy THEN RENAME` — viram no-op seguro quando coluna moderna já existe. **REGRA DE PARADA NÃO DISPARADA**: grep no tree por refs a colunas LEGADAS (requestedat/confirmedat/cancelledat/expiredat/check_in_time) = ZERO refs não-guarded. Backdate pode nascer moderno com 100% segurança. **Janela de timestamp:** `20260427xxxxxx` (1 dia antes do primeiro problemático `20260428200000`). **Ordem das 6 backdated**: availability → availability_participants + bookings (FK availability) → schedules → schedule_slots (FK schedules) → event_attendees (FK externals em tenants/events/actors/global_users já criadas pelas 4-dígitos `0001`-`0005` que ordenam antes de qualquer `2026XXXX`). **Função `detect_availability_conflicts`**: backdated NÃO cria (deixa para 491000). Lista FINAL e PRECISA por arquivo no DT_LOG. ~95 linhas SQL total. Aguardando Opus desenhar.
- **Pacote 1 ESCRITO; Descoberta C RESOLVIDA; Descoberta D aberta (2026-05-29)** — executor da primeira escrita. **4 migrations forward-only** escritas (working tree dirty, NÃO commitadas): `20260427120000_unified_availability_base.sql` (67 linhas — availability+bookings nomes modernos+availability_participants+5 índices), `20260427200000_create_schedules.sql` (18), `20260427210000_create_schedule_slots.sql` (17), `20260530151000_event_attendees_rename_checked_in_at.sql` (33, RENAME guarded com double IF EXISTS legacy + NOT EXISTS modern). Pré-flight A PASS (tenants/actors em `0002_identity.sql`, ordem `0xxx` < `2026xxxxx`); Pré-flight B PASS (parser `validate-schema-code-coherence.mjs:412-424` faz `schema.set` sobreescrevendo silenciosamente para duplicate CREATE; não acusa erro; modo `both`/`strict` usa schemaDb vivo). **Gates 5/6 verdes**: tsc clean, actor-writer §4.8.1, bank-ledger §4.6, regression-guards (332 migrations Gate 3), arch strict `critical_new=0`. **schema-coherence FAIL** mas isolado como **dívida pré-existente** (allowlist deadlines abril/maio 2026 — testei com 4 arquivos renomeados `.sql.tmp`, erro idêntico; IDs C1/C3/C4/C8/C12/C31-C35 são pré-existentes). **Ensaio em espelho com TRAVA**: `unificard_dev_rebuild_check_20260529032800`, banco-alvo confere, 332 pendentes, 182 OK. **Pacote 1 funciona: Descoberta C RESOLVIDA** — `20260428200000_schedules_revoke_write.sql` (1ms) PASSOU (antes parava aqui). Avançou de [179/328] para [183/332]. **Falha NOVA em `20260428210000_bank_transactions_concept_id_not_null.sql`**: ALTER COLUMN SET NOT NULL sobre `concept_id` que só é adicionada por `20260530506000_bank_transactions_concept_id.sql` (mesma estrutura da Descoberta C, em outra família). **Descoberta D NOVA aberta** — Paralela B não detectou porque buscava CREATE TABLE; ADD COLUMN estava fora do escopo. Refinamento necessário. **Commit RETIDO** conforme instrução do prompt ("dívida nova não causada pelo Pacote 1 → não commitar por decisão automática"). Banco real intocado. Mirror dropado interativamente após forense. Próximo passo: decisão Clayton+Opus+ChatGPT entre Pacote 1.b (ADD COLUMN backdated antes do SET NOT NULL) OU pausar tudo para nova rodada de auditoria estática ampliada.
- **Pacote 1.b — Descoberta D RESOLVIDA · ensaio 333/333 (2026-05-29)** — UMA migration backdated `20260428205000_repair_bank_transactions_concept_id.sql` (3 linhas SQL: `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS concept_id UUID;`). Sem FK, sem índice, sem NOT NULL, sem COMMENT (conforme prompt). Read-first confirmou: 506000 cria `UUID NULL` + FK + índice; vivo é `UUID NOT NULL` com FK; diferença NULL→NOT NULL vem da 210000 SET NOT NULL guarded — 506000 e vivo NÃO divergem entre si. **Lição da Instância G aplicada**: o que quebrava o rebuild era o `COMMENT ON COLUMN bank_transactions.concept_id` (linha 14 da 210000) FORA do `DO $$` guard; backdated cria coluna nua e COMMENT roda DEPOIS sobre coluna existente. Ordem `localeCompare`: `200000` < `205000` < `210000` ✓. **Gates 5/5 verdes** (tsc clean, actor-writer, bank-ledger, regression-guards Gate 3 com 333 migrations, arch strict `critical_new=0`). **Ensaio em espelho `unificard_dev_rebuild_check_20260529123855` rodou 333/333 com sucesso** — Pacote 1.b passou em 2ms na [183/333], a 210000 (Descoberta D) passou em 13ms na [184/333], nenhuma nova falha apareceu até o fim. **Pacote 1 + 1.b juntos: rebuild zero completo**. Divergência conhecida e aceita: FK `bank_transactions_concept_id_fkey` não nasce no rebuild (porque 506000 só cria FK dentro do `IF NOT EXISTS` e a coluna já existe pela backdated). Banco real INTOCADO; EXPECTED_DATABASE_NAME confirmada nos logs; mirror dropado interativamente. Working tree dirty com 1 migration + 3 docs aguardando commit.
- **F-MIGRATION-REBUILD-DIFF-AUDIT — diff completo real vs espelho 333/333 (2026-05-29)** — guardião read-only. Capturei schema/inventário do real e do espelho 333/333 recriado. **40 divergências** classificadas em 3 grupos. **GRUPO 1 ACEITAS/cosméticas (16)**: 3 `reversals.*` column_comment_diff = apenas LF (real) vs CRLF (mirror, Windows .sql) — texto semanticamente idêntico; 9 em `schema_migrations` = nomes de UNIQUE constraint e comments diferem entre tabela criada pelo runner (`migrate.ts:201-213`, constraint `unique_filename`) e a do real (constraint `schema_migrations_filename_key`, criada por migration 000 antiga) — funcionalmente equivalente; `_deprecated_tenant_products.price` ausente no mirror + `.price_cents` comment outdated no real = estado histórico do real (ramo IF/ELSIF da 530000 entrou em ELSIF no real; mirror entrou no IF principal). **GRUPO 2 ESPERADAS (24)**: 22 `MIGRATION_ONLY_IN_MIRROR` = 5 do Pacote 1+1.b + 17 pending do real (Descoberta B) que rodaram no espelho; 3 `MIGRATION_ONLY_IN_REAL` = as 3 órfãs (Pacote 2 tombstone). **GRUPO 3 NÃO ACEITAS (1)**: APENAS `bank_transactions.bank_transactions_concept_id_fkey` — FK órfã pelo padrão Pacote 1.b ("ADD COLUMN antecipado → bloco IF NOT EXISTS pulado → FK/índice/comment órfão"). Pacote 1.c sugerido: 1 migration timestamp ≥ 506000 com `ADD CONSTRAINT IF NOT EXISTS` guarded por NOT EXISTS pg_constraint. **Refinamento**: a Paralela C tinha classificado `_deprecated_product_concept_resolution_queue` e `_deprecated_tenant_products` como "dívida real" — investigação atual mostrou que `20260429100000_unificacao_semantica_v2.sql` faz `RENAME TO _deprecated_*` para 4 tabelas (product_concepts/catalog_products/tenant_products/product_concept_resolution_queue). No rebuild as tabelas NASCEM por RENAME; "Pacote 3 fora" era baseado em premissa errada. Volume Grupo 3 = 1 (≪10), freio NÃO disparado. Banco real intocado; espelho dropado.
- **Pacote 1.c · FK reposta · Grupo 3 = 0 · drop/recreate LIBERADO (2026-05-29)** — UMA migration `20260530506500_add_bank_transactions_concept_id_fkey.sql` (timestamp `localeCompare > 506000`) com `DO $$ IF NOT EXISTS pg_constraint(...) THEN ALTER TABLE bank_transactions ADD CONSTRAINT bank_transactions_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES concepts(concept_id) ON DELETE RESTRICT END $$`. Só a FK; sem índice (diff confirmou `840=840`). **Gates 5/5 verdes**. Ensaio em espelho `unificard_dev_rebuild_check_20260529134919` rodou **334/334** com sucesso; Pacote 1.c [282/334] em 32ms. **Novo diff: Grupo 3 = 0** (constraints 1111=1111; única CONSTRAINT_MISSING_IN_MIRROR agora é `schema_migrations.schema_migrations_filename_key` que é Grupo 1 cosmético — runner cria `unique_filename` equivalente). 40 divergências restantes: 14 cosméticas (LF/CRLF + nomes schema_migrations + estado histórico _deprecated_tenant_products) + 26 esperadas (23 MIGRATION_ONLY_IN_MIRROR + 3 órfãs absolvidas). **Correção documental commitada:** Pacote 3 premissa anterior INVALIDADA (`_deprecated_*` nascem por RENAME em `20260429100000`; decisão "aposentar" era inócua porque rebuild faz a coisa certa); 3 órfãs ABSOLVIDAS pelo diff (sem impacto estrutural; tombstone permanece correto). **Recomendação:** drop/recreate real LIBERADO para Clayton executar manualmente (1) com aprovação explícita, (2) backup confirmado (já existe), (3) comandos pelo próprio Clayton, (4) verificação posterior via script. Banco real INTOCADO; EXPECTED_DATABASE_NAME nos logs; mirror dropado.
- **RECREATE EXECUTADO · banco real limpo (2026-05-29)** — Clayton executou manualmente `dropdb + createdb + migrate` em `unificard_dev`. Migrate rodou 334/334 com TRAVA `EXPECTED_DATABASE_NAME` confirmada no log. Pré-drop: 8 client backends terminados via `pg_terminate_backend` (autorizado por Clayton) — 4 órfãs de 13h em cadeia de lock (896→4840, 25628→22100, ambas com `UPDATE bank_transactions` idle in transaction segurando lock e `UPDATE payment_intents` esperando) + 4 IDLE pool keep-alive (27236/9080/20696/27220). NÃO foi usado `dropdb --force`. Backup pré-drop `RESET_BACKUP_PRE_DROP_2026-05-29T14-11-01.dump` (15 MB, custom, 2353 TOC, pg_restore -l validado). **Verificação pós-recreate:** Gates 5/5 verdes (tsc clean, actor-writer §4.8.1, bank-ledger §4.6, regression-guards 334 migrations, arch strict critical_new=0). **Diff BEFORE pré-drop vs AFTER recreate = 40 divergências IDÊNTICAS ao DIFF-AUDIT do espelho** (14 cosméticas + 26 esperadas + Grupo 3 = 0). Execução real reproduziu fielmente o espelho. **Seeds estruturais globais** OK (concepts=90, company_types=7, company_type_allowed_concepts=7, categories=102, canonical_products=35); **RBAC tenant-scoped vazio** (permissions=0, roles=0, role_permissions=0) — esperado e correto, renascerão no fluxo canônico quando criar o tenant DEV; sem precisar `RUN_SEEDS=true`. **Estado limpo perfeito:** tenants=0, actors=0, users=0, identities=0, global_users=0, bank_ledger=0, bank_transactions=0, bank_accounts=0, bank_splits=0. ZERO fixture sobreviveu. **Próximo passo:** Fase 3 (reseed canônico — dev + PF + PJ + banda pelo FLUXO CANÔNICO, prova F3.1 v2) em fatia separada; se faltar fluxo canônico, mapear ACHADO sem improvisar seed manual.
- **Auto-vigilância documental (2026-05-28)** — Clayton precisou cobrar registro institucional durante a Fase 0 do reset. Lição: ao gerar artefatos materiais (backup/manifesto/achados) em modo read-only, atualizar DT_LOG/STATUS/opus ANTES de reportar — esses documentos são a memória do sistema entre sessões. Não esperar fim de fatia para registrar.
- **STATUS_EXECUCAO_GLOBAL.md ler por grep temático**, não full read — o arquivo cresceu além do limite saudável de leitura linear; use grep por DT/DECISION/keyword.
- **D12 esclarecimento append-only (2026-05-28)**: aplicação do gate KYC por sub-frente — F4.0 cadastro pode admitir `kyc_status='pending'` (sujeito a ratificação Clayton no prompt executor F4.0); F4.1+ uso real exige `approved` strict sem exceção. D12 NÃO autoriza F4.0 nem flexibiliza F4.1+.

**Regras operacionais permanentes:**

> "Saque de `actor_wallet` é frente própria com entidade própria.
> NÃO reutilizar `payout_requests` — trilho exclusivo do seller.
> `availableBalanceCents` projeta leitura; NÃO autoriza movimentação.
> Drain de obrigações + payout em BEGIN/COMMIT único. Sem atalho."

**Invariantes D1–D5:**

- D1: entidade = `actor_wallet_payout_requests`; `payout_requests` = seller only
- D2: `SELECT FOR UPDATE` → drain (`debitActorWalletForRecovery`) → recalcular saldo → payout excedente → COMMIT (ou ROLLBACK total)
- D3: settlement MVP = interno; PIX/TED = fase 2 (não autorizado)
- D4: todo saque entra como `pending_approval`; execução financeira só após `approved`
- D5: `operation_type='actor_wallet_payout'`, `reference_type='actor_wallet_payout'`

**Estado do sistema (2026-05-28 — pós-F2):**
- `actor_wallet_payout_requests` EXISTE (migration `20260530572000`, commit `98a1111a`)
- `approval_requests` aceita `operation_type='actor_wallet_payout'` (CHECK estendido)
- concept `actor-wallet-payout` em `financeiro-payout` EXISTE
- `actorWalletPayoutService.requestActorWalletPayout` EXISTE (commit `a1532780`) — cria `pending_approval` + `approval_request` atômico; zero movimento financeiro
- Active-gate: 1 request ativo por actor por vez; `ACTOR_WALLET_PAYOUT_ALREADY_ACTIVE` (commit `c7838c50`)
- Partial unique index `uidx_actor_wallet_payout_one_active_per_actor` — protege contra race condition
- `calculateActorWalletBalanceProjection` — helper compartilhado (statement + payout services)
- `actorWalletPayoutService.executeActorWalletPayout` EXISTE (commit `8f36db6e`) — execução atômica wallet→settlement com authorship='ownership'; D-3 partial + D-4 zero implementados
- `ApprovalOperationType` inclui `'actor_wallet_payout'` (financial-approval.types.ts)
- Income withholding C3.1 ativo: drain ocorre dentro de F3 também (cap = saldo atual)
- F4 (PIX/TED externo) OPEN — não autorizado

---

## FASE 3A — bootstrap canônico do tenant DEV (2026-05-29) ✅

Banco limpo (HEAD `1d818e0b`) ganhou sua primeira vida por caminhos canônicos de serviço,
não por seed manual. Script versionado dev-only: `backend/src/scripts/bootstrap-dev-canonical.ts`
(idempotente; guards NODE_ENV≠production + PILOT_MODE≠true + `current_database()='unificard_dev'`).

Ordem canônica: `tenantService.createTenant` → `rbacService.seedDefaultRBAC` (`seed_default_rbac`,
migration 0060) → `authService.register` (global_users→users→identities→actor) →
`rbacService.assignRoleByName('admin')`. **Zero INSERT manual.**

**A7 adotada:** actor humano = register→ensureUserActor→findOrCreateUserActor (`actor_type='user'`,
actor_id próprio ≠ user_id, global_user_id NOT NULL). Genesis (`actor_type='actor_human'`) NÃO
usado — dívida (DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION).

Verificado por SELECT: tenant_contexts=8 · roles=4/permissions=38/role_permissions=68 ·
PF completa (gu=1, identity=1, actor user) · user_roles DEV→admin · permissões efetivas=38.

Achados registrados no DT_LOG:
- **DT-SEED-DEV-COMPLETE-NON-CANONICAL-USER (OPEN):** seed-dev-complete cria user por INSERT
  direto sem CPF/global_user_id — não usar para PF; substituir por register ou depreciar.
- Script standalone precisa replicar a injeção de social ports do `app.builder.ts` (sem isso
  `ensureUserActor` falha por registry vazio).

Próximo (fora desta etapa): PJ e banda — bloqueados por decisões de produto (ver Passo 0).

### FASE 3A — CLOSED ✅ (gates verdes, 2026-05-29)
Selo pós-verificação de gates (separada do append inicial). Banco limpo → banco vivo canônico.
- Commit do bootstrap: `8d8de80b`.
- Gates pós-commit: actor-writer §4.8.1 OK · bank-ledger §4.6 OK · regression-guards OK
  (334 migrations) · architecture --strict exit 0 `critical_new=0` · typecheck clean.
- `warning_new=1` isolada em `validate-pipeline-e2e-c3-actor-wallet-debit-recovery.ts:334`
  (money arithmetic) — pré-existente, NÃO do bootstrap, não-bloqueante.
- Vivo: tenant DEV + tenant_contexts(8) + RBAC(4/38/68) + PF canônico
  (`actor_type='user'`, `global_user_id NOT NULL`, `actor_id ≠ user_id`) + role admin.
- **A7 ADOTADA:** register→ensureUserActor→findOrCreateUserActor é o trilho oficial do actor
  humano; Genesis (`actor_human`, actor_id=user_id) fica como dívida.
- **PRÓXIMO — 3B (PJ):** NÃO iniciar sem decidir A3 (caminho oficial de empresa) e A4
  (nasce classificada vs nua).

### FASE 3B.3 — CLOSED ✅ (2026-05-29) — Empresa em Dois Momentos
A3/A4 decididas e implementadas. Empresa nasce inerte (Momento 1, primary_* NULL, invisível) e
vira operacional (Momento 2) só via activateCompanyOperationally() — single writer transacional
que grava só primary_company_type_id+primary_concept_id (par válido em company_type_allowed_concepts),
garante page-actor+responsible FORA da tx, SEM capabilities. Resolver findAvailableActors filtra
empresa operacional e classifica por-empresa (companies.primary_*, não tenants.company_type_id),
com tenant isolation explícito. Migration 20260530575000 (2 cols + CHECK pareado + unique page-actor
index). E2E 21/21 (M/A/R). Gates verdes, typecheck clean, critical_new=0, sem warning nova.
DTs abertas: company-canonical quebrado (schema drift, não tocado) + capabilities omitidas
(aguarda D-CONCEPT/D-CONTEXT-RESOLVER). Próximo: 3C (banda).

### FASE 3C.3 — CLOSED ✅ (2026-05-30) — Group Actor em Dois Momentos
Group actor implementado pelo mesmo padrão da 3B.3: Momento 1 (social/inerte, actor_id=NULL) →
Momento 2 (operacional, ensureGroupActor preenche actor_id atomicamente). Writer único:
groups.service.ts::createGroup chama ensureGroupActor após groupsRepository.create — FORA de TX
ativa (motor tem TX interna própria). ensureGroupActor (actor.repository.ts:337) é transacional,
idempotente, fail-closed: lê groups.owner_actor_id como responsible_actor_id, revalida âncora
humana sob SELECT FOR UPDATE, falha fechada se owner_actor_id NULL (§4.8.2). Migration 576000:
uq_actors_group (unique partial actors WHERE actor_type='group') + actors_group_id_fkey (RESTRICT)
+ uq_groups_actor (unique partial groups WHERE actor_id IS NOT NULL). Bug corrigido em addMember:
ON CONFLICT SET role = CASE WHEN owner THEN preserve ELSE EXCLUDED.role END — antes retornava
0 rows quando owner tentava ser downgraded → throw. E2E validate-pipeline-e2e-group-two-moments.ts:
11/11 verdes (M1/M2/M3 schema + A1–A7 ativação + CLEANUP). Gates verdes, critical_new=0.
DT-GROUP-OWNER-DOUBLE-ADD registrada: duplo addMember em :187+193 é NO-OP funcional; remover
quando authority/capability entrar em escopo (não antes). Commits: 284ae2a8 (migration) + 78091dbb (wiring).

### SEC-1 — CLOSED ✅ (2026-05-30) — chk_actor_requires_identity cobre user/actor_human/person
Gap fechado: migration 0010 criou chk_actor_requires_identity para actor_type='actor_human'.
Migration 0064 reabriu o vocabulário para 10 valores incluindo 'user' (canônico runtime) sem
atualizar a constraint — banco aceitava user actor sem global_user_id por ~2 anos.
Migration 577000 amplia: CHECK (actor_type NOT IN ('user','actor_human','person') OR
global_user_id IS NOT NULL). Pré-flight: 0 violações. GUARD DO $$ RAISE EXCEPTION interno.
Runtime já era fail-closed (findOrCreateUserActor: 2 guards explícitos §4.8.1).
Commit: 1a946c6f. Gates verdes, regression-guards=337.

### COE-1 — CLOSED ✅ (2026-05-30) — checkOwnership consulta groups.id
Bug em authorization.service.ts:396: WHERE group_id=$1 contra tabela groups (PK=id, não group_id).
Owner legítimo de grupo era NUNCA reconhecido como owner na camada de authority — acesso negado
indevidamente em toda checagem de ownership de grupo. Correção: WHERE id=$1. 1 token, 1 linha,
1 arquivo. DT-GROUPS-ROUTES-LEGACY-GROUP-ID registrada para bugs parentes em grupos-closure e
grupos-state-history (mesmo padrão, escopo ortogonal — microfrente própria futura).
Commit: 12ec1f91. Gates verdes, regression-guards=337.

### COE-2 — CLOSED ✅ (2026-05-30) — groups.owner_actor_id SET NOT NULL
Coluna era nullable no banco mas obrigatória de-facto no código: createGroup sempre seta
owner_actor_id (ensureUserActor lança antes se userId inválido) e ensureGroupActor exige
owner_actor_id com dois throws §4.8.2 (pré-TX e sob lock). Formalização da segunda linha de
defesa no banco, como SEC-1. Migration 578000: GUARD DO $$ + ALTER TABLE groups ALTER COLUMN
owner_actor_id SET NOT NULL. Pré-flight: 0 violações. is_nullable=NO confirmado.
DT-GROUPS-OWNER-FK-ONDELETE-POLICY registrada: FK usa ON DELETE NO ACTION (padrão) vs RESTRICT
da 576000 — assimetria de política de ciclo de vida, microfrente de authority futura.
Commit: b01cba54. Gates verdes, regression-guards=338.

**Estado do sistema (2026-05-30 — pós-COE-2):**
- Fase 3 completa: 3A (user actor) + 3B (page actor) + 3C (group actor) CLOSED
- Linha causal fechada: IDENTIDADE → AUTORIDADE → ÂNCORA CIVIL
- Dupla linha de defesa para âncoras civis: runtime (fail-closed) + banco (constraint)
- actor_type='user' → global_user_id: findOrCreateUserActor + chk_actor_requires_identity
- groups.owner_actor_id: ensureGroupActor §4.8.2 + NOT NULL
- groups.actor_id: NULL legítimo por dois momentos (by design, não é gap)
- Cofre econômico: DESLIGADO. F-MAPA concluído (READ-ONLY): ECON-1 liberada com cuidado,
  ECON-2 BLOQUEADA (DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP), ECON-3 BLOQUEADA (bridge ausente)
- DTs abertas: DT-SPLIT-ENGINE-GROUP-WALLET-LEGACY-LOOKUP (bloqueante ECON-2)
  · DT-GROUPS-ROUTES-LEGACY-GROUP-ID · DT-GROUPS-OWNER-FK-ONDELETE-POLICY
  · DT-GROUP-OWNER-DOUBLE-ADD · DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION (SEC-2 pendente)
  · DT-COMPANY-CANONICAL-SERVICE-SCHEMA-DRIFT · DT-COMPANY-MARKETPLACE-ACTIVATION-FLAGS-PARALLEL-CAPABILITY
- HEAD: 22de5412 · branch: rescue-structural · migrations: 338
- F-MAPA P4 FANTASMA: split de grupo (bank-split-engine.service.ts:202-207) usa
  getAccountByOwner(groupId,'company'). Wallet canônica tem owner_id='${actorId}:actor_wallet',
  owner_type='actor', account_type='actor_wallet'. toDbOwnerType colapsa 'user' e 'company' ambos
  em 'actor' → owner_type CASA; o mismatch é SÓ no owner_id (groupId vs composite). Split
  comunitário vaza para regional_fund sem erro. Frente cirúrgica exige ratificação tripla.
- Próxima frente: corrigir split engine (group_id→groups.actor_id→getActorWalletAccount) com E2E
  — NÃO EXECUTAR SEM RATIFICAÇÃO TRIPLA (escrita em código que distribui dinheiro)

### PARALELAS A/B/C/D — memória operacional para a próxima Opus (2026-05-30)
As paralelas A/B/C/D investigaram a conta monetária de grupo (read-only) e mudaram o enquadramento:
- O problema NÃO é a string `ownerType='group'` — é a NATUREZA ECONÔMICA do dinheiro de grupo.
  A paralela D salvou a frente de transformar `ownerType='group'` em religião (vocabulário
  arqueológico anti-canônico). "ECON-1 = ownerType='group'" está MORTO.
- A PERGUNTA QUE ORDENA TUDO (só Clayton responde): "split comunitário é dinheiro geral fungível,
  fundo comunitário restrito, ou dois bolsos separados por account_type?"
- CORREÇÃO de tom: o split de grupo é risco LATENTE, não vazamento ativo. Depende de
  `user_group_allocations` (tabela inexistente no DB); o step 3 não executa hoje. O lookup errado
  está ARMADO para quando o fluxo nascer.
- Três substratos paralelos de dinheiro de grupo (DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES):
  #1 Bank legado (owner_id=groupId) · #2 actor_wallet canônica (composite, não provisionada) ·
  #3 core/economy dormente (assignment.service.ts:307).
- ENQUANTO Clayton não decidir: SEM ECON-1 executor · SEM provisionar wallet de grupo · SEM fix
  split lookup · SEM schema financeiro · SEM código financeiro.
- Próxima ação após a decisão: desenhar frente READ-ONLY de consequências da opção escolhida.
- DTs novas: DT-GROUP-ACTOR-WALLET-NOT-PROVISIONED · DT-GROUP-MONEY-THREE-PARALLEL-SUBSTRATES ·
  DT-ENSURE-ACTOR-WALLET-NOT-IDEMPOTENT-UNDER-RACE · DT-BANK-ACCOUNTS-UNIQUE-INDEX-INSUFFICIENT.

### CONTRATO_GRUPOS_V2 VIGENTE — memória operacional (2026-05-31, commit 24710b29)
- A pergunta foi RESPONDIDA: o V2 (LEI vigente) decidiu **dois bolsos por grupo** —
  operacional (`actor_wallet`) + comunitário (`group_community_fund`, nome a validar).
- Isso NÃO ligou o dinheiro. Foi promulgação documental. Cofre econômico de grupo segue DESLIGADO.
- `owner_type='group'` está REVOGADO pelo V2; destino canônico = composite `owner_type='actor'`
  por finalidade. `group_members` = SSOT do vínculo do split; `user_active_groups` = read-model
  futuro; `user_group_allocations` = fora do split (dívida a aposentar).
- Antes de QUALQUER implementação financeira de grupo:
  (1) validar nome do account_type comunitário (colisão com treasury `community_fund` de plataforma);
  (2) rodar diagnósticos G1 (região do usuário p/ fallback) / G2 (substrato #3 vivo?) / G3 (ciclo de
  status do grupo); (3) ratificação tripla para qualquer frente que mova dinheiro.
- Perfil profissional é frente SEPARADA — não misturar com grupos. Uma frente executora por vez.

### GATE PERFIL PROFISSIONAL — memória operacional (2026-05-31, HEAD 8bfb0b21)
- A aba profissional atual NÃO tem chão de serviço. O serviço quebra em runtime porque escreve em
  4 tabelas archive-only ausentes do banco vivo (`user_skills_categories`, `predefined_services`,
  `combo_discount_rules`, `workers`) — só em migrations_archive/, nunca canônicas.
- O chão SEMÂNTICO existe e deve ser PRESERVADO: categories + concepts + invariante concept-first +
  árvore professional (L2 com concept, domain='servicos'). Não é "perfil em ruínas".
- Archive NÃO deve ser restaurado automaticamente (archive não é SSOT vigente). O serviço é
  user/global_user-keyed; o sistema é actor-first — restaurar verbatim reintroduz substrato anti-canônico.
- Próxima frente = REDESENHO actor-first e concept-anchored do read-model profissional (não migration
  mecânica). O MVP futuro deve SEPARAR: identidade/competência/bio · oferta/preço/workers ·
  availability · capability/authority.
- Bloqueio até a DT resolver: não popular, não seedar, não restaurar archive, não rodar
  normalize-category-concepts.ts, não tratar category_id como SSOT semântico (SSOT = CONCEPT).
- DT registrada: DT-PROFILE-PROFESSIONAL-SERVICE-TABLES-ARCHIVE-ONLY.

### ROTAS DE GRUPO CORRIGIDAS — memória operacional (2026-05-31, código d064e5e9)
- Rotas `groups-closure` e `groups-state-history` corrigidas para o schema vivo (DT-GROUPS-ROUTES-LEGACY-GROUP-ID).
- `groups.group_id` era legado inexistente → `groups.id` é a PK real.
- `groups.is_active` era legado inexistente → `groups.status` é binário no schema vivo (CHECK active/inactive).
- `group_events.group_id` é coluna LEGÍTIMA (FK → groups) e foi preservada — sem find-replace cego.
- Payload externo das duas rotas permaneceu intacto.
- Ressalva: se o status de grupos virar multiestado no futuro (CHECK ampliado), revisar a derivação
  de `state` em groups-state-history.routes.ts.

### MVP C1 PERFIL PROFISSIONAL — DECISION-0063 promulgada (2026-05-31)
- MVP C1 promulgado como DECISION ratificada (Opus + ChatGPT + Clayton). Doc:
  `docs/02_decisions/DESENHO_MVP_C1_PERFIL_PROFISSIONAL.md`. Promulgação documental — não ligou nada.
- C1 = substrato profissional declarativo actor-first. Duas entidades:
  `actor_professional_profiles` (bio profissional, 1:1 por actor) +
  `actor_professional_concepts` (competências, 1:N por actor).
- `actor_id` = chave operacional; `concept_id` = identidade semântica; `source_category_id` = breadcrumb.
- `skill_level`/`years_experience` = declarações, NÃO credenciais; certificação verificada FORA do MVP.
- preço/oferta/workers/availability/capability/bank FORA do MVP (C2/C3/C4 futuras).
- Leitura usa actor_id já resolvido (sem side effect); escrita via actor-writer; lookup solto PROIBIDO.
- Ciclo de vida binário (`is_active` + `retired_at`); DELETE de competência proibido.
- Próxima ação = migration C1 em sessão SEPARADA. Esta sessão NÃO preparou executor.

### MIGRATION C1 APLICADA (2026-05-31) — substrato profissional nasceu
- Migration `20260530579000_create_actor_professional_substrate.sql` criada e aplicada no unificard_dev.
- Tabelas criadas: `actor_professional_profiles` (bio, 1:1) + `actor_professional_concepts` (competências, 1:N).
- `skill_level`/`years_experience` são SMALLINT declarativos (CHECK 1..5 / NULL|0..80), NÃO credenciais.
- `is_active` + `retired_at` travam o ciclo no banco (CHECK de coerência); remoção = desativação lógica.
- Registrado no SSOT_REGISTRY como SSOT da declaração profissional (não preço/oferta/availability/capability/cert/bank).
- NÃO houve API/service/repository/rota/frontend/seed. Só schema C1.
- Próximo passo NÃO é automático: precisa NOVA frente (ratificação própria) para service/API do MVP C1,
  com leitura por actionContext.actorId e escrita via actor-writer, sem lookup solto.
- Housekeeping pendente: schema_migrations não registra 577000/578000/579000 (aplicadas via psql -f). Reconciliar à parte.

### A2 BACKEND C1 SERVICE/API — SELADA ✅ (2026-05-31) — atualiza o "próximo passo" acima
- A frente service/API do C1 (antes "próxima") foi ENTREGUE e SELADA. Commits: f959d912 (código) +
  04030be2 (reparo :conceptId UUID) + 977898a4 (reparo PATCH vazio) + 92650e8c (selo). Selo doc:
  docs/02_decisions/SELO_A2_C1_PERFIL_PROFISSIONAL.md.
- Ratificação tripla: Opus + ChatGPT (P1–P10 nos brutos, HEAD 977898a4) + Clayton (selo).
- Aceite arquitetural por critério DIFERENCIAL: validate-architectural --strict critical_new=0;
  baseline legado critical_total=20 (DT-VALIDATE-ARCHITECTURAL-20-LEGADO, frente própria). NÃO é "5 gates verdes".
- Premissa "não há CHECK actors.id=actor_id" REFUTADA: existe chk_actors_actor_id_equals_id (CHECK actor_id=id);
  guarda ACTOR_ID_INVARIANT_BROKEN é defesa-em-profundidade.
- A3 (frontend) BLOQUEADA. Pré-condições: (1) bancada limpa/isolada; (2) autorização explícita de Clayton.
- Próximo passo NÃO é código: housekeeping da bancada → consolidar achados forenses A/B/C/D (passo
  documental próprio, não feito aqui) → só então A3 read-only. Interesses/Gostos fora até A3.
- Docs de direção preservados em docs/02_decisions/: VISAO_PERFIL_CONTEXTUAL_POR_ACTOR.md ("Perfil coleta.
  SSOT guarda. Actor molda a superfície.") + PLANO_PERFIL_CONTEXTO_POR_ACTOR.md. Direção, não autorização.

### RECONCILIAÇÃO schema_migrations — RESOLVIDO (2026-05-31)
- As 3 migrations aplicadas via psql -f nesta série (577000 SEC-1, 578000 COE-2, 579000 C1) foram
  registradas em schema_migrations após provar os 4 critérios (arquivo existe, aplicada no schema,
  validada por SELECT, ausente do tracking). Total 336→339 (= disco). Transação com LOCK EXCLUSIVE,
  formato do runner (filename + checksum sha256 + execution_time_ms NULL). Linhas existentes intactas.
- O runner canônico (npm run migrate) volta a refletir a realidade: não re-executaria essas 3.
- INSERT em schema_migrations é estado de banco (não versionado). Lição: aplicar migrations futuras
  pelo runner canônico evita essa defasagem; psql -f direto exige reconciliação posterior.

### A3.1 + A3.2 — SELADAS ✅ (aba Profissional legado → C1) (2026-06-01)
- A3.1 backend SELADA (526b1c6f · selo SELO_A3_1_INFERENCE_DESACOPLAMENTO.md): desacopla
  getUserProfileSnapshot do serviço profissional legado morto → inference/snapshot 500→200.
- A3.2 SELADA (selo SELO_A3_2_PROFISSIONAL_C1.md) após ratificação ChatGPT. Clayton OVERRIDOU a regra
  "Codex faz frontend" e autorizou Claude a executar o frontend. Cadeia: 1958ab05 (backend expõe
  categories.concept_id como conceptId GATED por context=professional — OPÇÃO B, 07 §4262/4278) +
  98a75ad0 (frontend migra a aba p/ /profile/professional/c1; save granular; conceptId real;
  source_category_id=breadcrumb; redução de escopo; ProfileAgenda+updateProfessionalProfile INTACTOS) +
  e1400562 (/children exige ?context=professional explícito p/ conceptId) + 31e31419 (remove catch amplo
  de getProfessionalC1) + 361c2671 (A3.2-R3: expansão profissional envia context=professional; sem isso
  a folha chegava sem conceptId e a trava C1 do addSkill bloqueava o "Adicionar").
- Invariantes provados: concept_id soberano (folha exige conceptId real FK→concepts, sem fallback p/
  categoryId) · source_category_id só breadcrumb · C1 backend selado intacto · legado não usado pela aba ·
  Agenda fora do escopo · zero financeiro · zero migration.
- Validação: frontend tsc=0 · gates backend sem regressão · validate-architectural --strict
  critical_new=0, critical_total=20 sem aumento · prova runtime pelo fluxo real (actor dinâmico, porta 3010).
- A3.2 NÃO resolve: Aprendizado · Interesses · Saúde · Agenda (TEMPO/C3) · C2/C3 profissional (preço/
  serviços/availability — "em breve"). C1 declara identidade/competência; não é SSOT de preço/oferta/
  availability/capability.
- Fila documental após o selo (commits próprios, NÃO neste selo): registrar
  DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT + housekeeping (5 .txt evidência A3_2_* +
  frontend_src_completo.txt) + destino final do legado /profile/professional (410/501 vs intocado).

### DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT — REGISTRADA ✅ (2026-06-01)
- Item (1) da fila pós-selo A3.2 cumprido. DT OPEN no REMEDIATION_DT_LOG.md (docs-only). Evidência:
  ProfileAgenda.tsx:165 persiste availability via updateProfessionalProfile (PUT legado
  /profile/professional). Camada TEMPO ainda acoplada ao perfil profissional legado; aba Profissional já
  em C1. Mitigação: aba C1 não usa legado; Agenda fora do escopo da A3.2 (ProfileAgenda intocado).
  Resolução: frente própria TEMPO/Agenda → SSOT temporal canônico (Unified Availability, actor_id),
  Constituição Art. II / CORE_IMUTAVEL. Sem tocar código/Agenda/financeiro/migration nesta fatia.
- Fila pós-selo restante: (2) housekeeping · (3) destino do legado /profile/professional · (4) C2/C3
  profissional OU Interesses/Lei 7.

### HOUSEKEEPING PÓS-A3.2 — PARCIAL ✅ (2026-06-01)
- Removidos os 5 A3_2_*.txt (untracked, evidência temporária = dumps git show/stat dos commits selados,
  reconstrutíveis). Remoção de untracked não gera commit por si.
- frontend_src_completo.txt DIAGNOSTICADO, NÃO ALTERADO: tracked (único commit 39ea7062 "marco-zero"),
  5,28 MB / 183.166 linhas, dump gerado (concatenação de frontend/src). Diff working tree = divergência
  do snapshot vs fonte atual. Recomendação: artefato fora do repo (gerar sob demanda + .gitignore) ou
  snapshot congelado; NÃO versionar blob que faz drift. Decisão de Clayton; não tocado.
- Fila restante: (2b) destino do frontend_src_completo.txt · (3) destino legado /profile/professional ·
  (4) C2/C3 profissional OU Interesses/Lei 7.

### Housekeeping 2b — frontend_src_completo.txt REMOVIDO DO VERSIONAMENTO ✅ (2026-06-01)
- Autorizado por Clayton. git rm do dump (5,28 MB / 183k linhas) + .gitignore (seção "Session-regenerated
  full dumps"). READ-FIRST: zero dependência material (só docs STATUS/opus/SELO referenciam). Gerar sob
  demanda fora do commit; fonte real = frontend/src; snapshot histórico em 39ea7062.
- Fila restante: (3) destino legado /profile/professional (410/501) · (4) C2/C3 profissional OU
  Interesses/Lei 7.

### Legado /profile/professional → 501 EXPLÍCITO ✅ (2026-06-01)
- Item (3) resolvido. Decisão Clayton: 501 (migrado p/ C1, não removido). Auditoria read-only provou
  serviço legado sobre 4 tabelas AUSENTES (user_skills_categories, predefined_services,
  combo_discount_rules, professional_profiles; to_regclass=AUSENTE; só C1 existe) → rotas davam 500/400
  opaco. GET/PUT /profile/professional agora 501 (code PROFESSIONAL_PROFILE_LEGACY_NOT_IMPLEMENTED,
  replacement /profile/professional/c1), sem chamar o serviço morto, sem fallback 200 vazio.
- Escopo único: profile-professional.routes.ts. Serviço legado/C1/Agenda/frontend/schema/financeiro
  INTOCADOS. Callers internos (core.service:348 try/catch, inference:246 .catch A3.1) usam o método de
  serviço, não a rota → imunes ao 501. Prova: GET 501, PUT 501, C1 200 intacto. tsc=0.
- DT registrada: DT-DEAD-PROFESSIONAL-LEGACY-SUBSTRATE (PARTIALLY MITIGATED — rotas 501; serviço/substrato
  ainda presentes, remoção é frente futura após Agenda + Human MVP). Candidata:
  DT-HUMAN-MVP-USES-DEAD-USER-SKILLS-CATEGORIES.
- Fila restante: (4) C2/C3 profissional OU Interesses/Lei 7.

### Auditoria READ-ONLY Interesses/Aprendizado Lei 7 — CONCLUÍDA + 5 DTs ✅ (2026-06-01)
- Abas Aprendizado/Interesses MORTAS: mostram opções, não salvam. SSOT = blob global_users.metadata
  (categoryId em JSONB, global-user-keyed, sem concept_id, sem substrato actor-first). Guards Lei 7
  (category-navigation-bridge.ts) falham fechado sobre substrato não-migrado: learning → 44 cats
  scope='learning' concept_id=NULL → PUT 400 "concept_id obrigatório"; interest → scope='interest' 0 cats
  → PUT 400 "fora do escopo". Provas runtime não-mutantes (guard rejeita antes do UPDATE). lifestyle
  sensível (orientação sexual etc.) no mesmo blob.
- 5 DTs OPEN registradas: DT-LEARNING-INTEREST-BLOB-SSOT, DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID,
  DT-INTEREST-SCOPE-EMPTY, DT-PROFILE-FRONTEND-DRIVES-TAXONOMY, DT-LIFESTYLE-SENSITIVE-IN-BLOB.
- Próxima frente recomendada: governança semântica Learning/Interest (concept_id por pipeline governado,
  NÃO frontend) ANTES do DESENHO C1 actor-first. VETADO atalho "popular category.concept_id p/ destravar"
  (cristaliza category como identidade) salvo decisão explícita de Clayton. Padrão de referência: C1 profissional.

### DECISION-0064 LEARNING/INTEREST SEMANTIC GOVERNANCE — PROMULGADA ✅ (2026-06-01)
- Clayton escolheu OPÇÃO C (híbrido governado). Doc: DECISION_0064_LEARNING_INTEREST_SEMANTIC_GOVERNANCE.md
  + REMEDIATION_DECISIONS_LOG.md. HEAD origem e908f3c7. Material confirmado: 90 concepts ~todos
  financeiros/comerciais (0 p/ learning/interest), educacao-e-conhecimento=0 concepts (domínio EXISTE em
  domains), 44 learning cats concept_id=NULL, scope='interest' vazio; pipeline concept-governance +
  create_category_from_concept existe.
- Regras: categories=navegação, concepts=identidade(SSOT), só folha com concept_id governado é declarável,
  source_category_id=breadcrumb, learning/interest compartilham concept_id mas declaração distinta,
  learning≠professional, declarado≠inferido, sugestão→fila governada. Domínios: learning →
  educacao-e-conhecimento; interest → árvore própria scope='interest' reusando concepts.
- Vetos: sem SQL direto p/ popular categories.concept_id; guard requireCategoriesWithConceptForScope
  permanece; sem categoryId como identidade; sem frontend criando taxonomia; SEM C1 antes do substrato.
- Fila: (1) DESENHO/MIGRATION governada concepts/categories Learning/Interest → (2) DESENHO C1 actor-first.
  DECISION-0064 NÃO autoriza migration nem C1 (fatias separadas).

### DECISION-0065 DIRETRIZES MATERIAIS LEARNING CONCEPTS — PROMULGADA ✅ (2026-06-01)
- Pós-desenho read-only (HEAD cf791d1f). Pipeline governado confirmado material: concept-governance.service
  (createConcept valida domain N0) / trigger 0075 (app.concept_governance) / create_category_from_concept
  0097-0110 (INSERTa level-2, check domain servicos só p/ professional); concepts UNIQUE(domain,slug),
  categories.concept_id FK→concepts ON DELETE SET NULL, CHECK chk_n2_requires_concept só level 2, categories
  SEM triggers vivos (UPDATE concept_id não bloqueado). 36 learning folhas mapeadas (muitas com slug
  -aprendizado), 8 raízes agregadoras, 0 overlap com concepts, sem colisão domain.
- 6 decisões (DECISION-0065, deriva de 0064): (1) concept slug limpo (fotografia, sem -aprendizado) (2)
  domínio educacao-e-conhecimento (sem compartilhar c/ professional aqui) (3) associação por migration
  governada com mapping literal, preserva árvore — NÃO é SQL ad-hoc; veto 0064 segue (4) nível declarável
  level=1, não reestruturar, critério=folha com concept_id (5) Interest fatia própria (6) compartilhar
  Learning↔Interest sim, Learning↔Professional NÃO automático.
- Doc: DECISION_0065_LEARNING_CONCEPTS_MATERIAL_DIRECTIVES.md + log. Próxima fatia = Migration A (Learning
  concepts + associação governada; prompt executor próprio). NÃO autoriza migration aqui.

### MIGRATION A — LEARNING CONCEPTS + ASSOCIAÇÃO — EXECUTADA ✅ (2026-06-01)
- Migration 20260601120000_seed_learning_concepts_and_associate_categories.sql (forward-only, idempotente,
  fail-closed), aplicada pelo runner canônico pnpm migrate (única pendente; schema_migrations 339→340 com
  checksum). Conforme DECISION-0064/0065.
- Fez: 36 concepts em educacao-e-conhecimento (slug limpo, app.concept_governance + INSERT ON CONFLICT) +
  associou concept_id às 36 folhas scope='learning' level=1 por mapping literal (UPDATE só folha sem concept,
  árvore preservada, sem create_category_from_concept, sem level 2). Não tocou interest/C1/frontend/financeiro.
- Provas: concepts 90→126, 36 folhas com concept, 8 raízes SEM concept (esperado), interest=0, PUT
  /profile/learning agora 200 (era 400), teardown via endpoint. Guard intacto.
- Persistência segue blob global_users.metadata (DT-LEARNING-INTEREST-BLOB-SSOT OPEN até C1).
  DT-LEARNING-CATEGORIES-MISSING-CONCEPT-ID → PARTIALLY MITIGATED. Interest = fatia própria.
- Fila: Interest (desenho+migration) · DESENHO C1 actor-first (após substrato).

### DECISION-0066 DIRETRIZES MATERIAIS INTEREST — PROMULGADA ✅ (2026-06-01)
- Pós-desenho read-only de Interest (HEAD 6d9e9a29). OPÇÃO A (árvore mínima governada scope='interest').
  Raízes level 0 sem concept (7: cultura-e-arte, esporte-e-bem-estar, tecnologia-e-jogos, gastronomia,
  casa-e-mao-na-massa, negocios-e-financas, mundo-e-pessoas); folhas level 1 com concept; reuso de concept
  Learning quando significado idêntico (27 folhas); concepts novos só governança p/ lazer/afinidade (11:
  cinema-e-series, leitura, teatro, futebol, corrida, yoga, gadgets, vinhos-e-bebidas, cafe, viagens, pets).
- Domínio dos concepts novos RESOLVIDO: cultura-lazer-e-eventos VERIFICADO existe em domains → não ambíguo
  → sem bloqueio p/ Migration B. Tópicos de conhecimento reutilizam educacao-e-conhecimento.
- Verificações read-only: scope=interest=0, 36 educacao concepts, categories_scope_check permite 'interest'
  (sem alterar schema), guard physical.service:188 requireCategoriesWithConceptForScope(...,'interest'),
  lifestyle enredado no mesmo blob/endpoint (DT-LIFESTYLE-SENSITIVE-IN-BLOB, fora da Migration B).
- Vetos: sem lifestyle, sem frontend taxonomia, sem categoryId identidade, sem SQL ad-hoc, sem C1 antes,
  NÃO fechar DT-LEARNING-INTEREST-BLOB-SSOT (blob até C1), guard intacto.
- Doc: DECISION_0066_INTEREST_TREE_MATERIAL_DIRECTIVES.md + log. Próxima fatia = Migration B (ciclo fechado:
  migration+validação+STATUS/opus/DTs+gates). NÃO autoriza migration aqui.

### Auditoria duplicidade Interest + ADENDO A à 0066 ✅ (2026-06-01)
- Auditoria read-only (HEAD a602d2dd): SEM duplicidade material de Interest. 0 tabelas/colunas
  interest/hobby/preference; scope=interest=0; 0 dos 11 concepts novos; archive (0682/0875/0078) NUNCA
  aplicado (tabelas AUSENTES vivas); 'interest' é slot canônico vazio; Git sem impl anterior. human-mvp
  dormente lê context 'interest' (tabelas AUSENTES) — não bloqueia. Migration B pode seguir.
- ADENDO A à DECISION-0066 (doc + log): categories_slug_key = UNIQUE(slug) GLOBAL → slugs limpos de
  categoria interest colidem (11: programacao/idiomas/ciencias/...; gastronomia em professional). REGRA:
  concepts slug LIMPO; categories scope='interest' com sufixo -interesse (raízes+folhas); mapping
  *-interesse → concept limpo. Concept não duplica (UNIQUE(domain,slug)); folha interest e learning
  compartilham concept_id. Vinculante p/ Migration B.
- Próxima fatia = Migration B com category slugs -interesse + concepts limpos (executor próprio, ratificação).

### MIGRATION B — INTEREST CONCEPTS + ÁRVORE scope='interest' — EXECUTADA ✅ (2026-06-01)
- Migration 20260601130000_seed_interest_concepts_and_tree.sql (forward-only, idempotente, fail-closed),
  runner canônico pnpm migrate (única pendente; schema_migrations 340→341 com checksum). DECISION-0064/0066
  + ADENDO A.
- Fez: 11 concepts novos em cultura-lazer-e-eventos (slug limpo, governado) + árvore scope='interest': 7
  raízes (level 0, sem concept, slug -interesse) + 38 folhas (level 1, concept_id, slug -interesse). 27
  folhas reusam concepts de Learning (educacao), 11 usam novos. Slugs categoria sufixados -interesse
  (categories_slug_key UNIQUE global); concepts slug limpo. Não tocou learning/lifestyle/C1/frontend/financeiro.
- Provas: concepts 126→137; 7 raízes sem concept; 38 folhas com concept; 0 sem sufixo -interesse; 27
  reuso→educacao; 11 novas→cultura-lazer; Learning inalterado (36/0); compartilhamento provado
  (fotografia-interesse + fotografia-aprendizado → mesmo concept fotografia); PUT /profile/physical
  interests agora 200 (era 400), teardown sem tocar lifestyle.
- Persistência segue blob global_users.metadata (DT-LEARNING-INTEREST-BLOB-SSOT OPEN até C1).
  DT-INTEREST-SCOPE-EMPTY → PARTIALLY MITIGATED. Lifestyle fora do escopo.
- Fila: DESENHO C1 Learning/Interest actor-first (substrato de ambos agora existe). Lifestyle frente própria.

### DECISION-0067 C1 LEARNING/INTEREST ACTOR-FIRST — PROMULGADA ✅ (2026-06-01)
- Pós-desenho read-only (HEAD ff7495c5). OPÇÃO C: duas tabelas escrita (actor_learning_concepts,
  actor_interest_concepts) + view read-only unificada (actor_concept_declarations_v, UNION
  professional+learning+interest). Espelha C1 profissional (DECISION-0063, tabela própria); evita re-blob;
  Learning≠Professional≠Interest.
- Campos: Learning progress SMALLINT NULL 1..3 (exploração, NÃO competência; sem skill_level/years);
  Interest binário; sem bio; concept_id obrigatório (identidade); actor_id via writer §4.8.1 (não
  global_user_id); source_category_id breadcrumb; ciclo is_active+retired_at XOR; UNIQUE(tenant,actor,concept).
- Contrato /profile/learning/c1 e /profile/interest/c1 (GET/POST/PATCH/DELETE granular; READ/WRITE camelCase,
  interno snake). Material: tabelas AUSENTES (build limpo); 0 dados no blob (backfill no-op).
- Ordem fatias: (1) schema migration 2 tabelas+view → (2) backend C1 → (3) backfill idempotente → (4)
  frontend → (5) cleanup blob (lifestyle fora). Nenhuma DT fechada aqui.
- Doc: DECISION_0067_C1_LEARNING_INTEREST_ACTOR_FIRST.md + log. Próxima fatia = Fatia 1 (schema migration;
  executor próprio, ratificação). NÃO autoriza migration aqui.

### C1 LEARNING/INTEREST — FATIA 1 (SCHEMA) — EXECUTADA ✅ (2026-06-01)
- Migration 20260601140000_create_actor_learning_interest_substrate.sql (forward-only, idempotente via
  guard to_regclass, fail-closed, schema-only sem DML), runner canônico pnpm migrate (única pendente;
  schema_migrations 341→342 com checksum). DECISION-0067 Fatia 1.
- Criou: actor_learning_concepts (progress SMALLINT NULL 1..3 = exploração, NÃO competência) +
  actor_interest_concepts (binário, sem atributo) — espelham actor_professional_concepts
  (tenant_id+actor_id FK actors.id+concept_id FK concepts+source_category_id FK categories breadcrumb,
  is_active+declared/updated/retired_at, UNIQUE(tenant,actor,concept), CHECK lifecycle XOR + CHECK progress,
  índice (tenant,concept)). View read-only actor_concept_declarations_v (UNION professional+learning+
  interest; colunas type-specific nullable, sem attrs jsonb). Não tocou professional/blob/categories/
  concepts/lifestyle/financeiro.
- Provas: 3 objetos; 4 FKs/tabela; UNIQUE+CHECKs; índices; 0 rows; view ok (vazia); blob intocado;
  learning 36/interest 38 intactos; professional intacta. typecheck=0; gates verdes; critical_new=0.
- Escrita/leitura runtime AINDA NÃO usam C1 (blob segue destino; DT-LEARNING-INTEREST-BLOB-SSOT OPEN).
  Fila: Fatia 2 backend C1 (rotas/services /profile/{learning,interest}/c1 espelhando professional-c1.*) →
  backfill → frontend → cleanup. Lifestyle fora.

### C1 LEARNING/INTEREST — FATIA 2 (BACKEND) — EXECUTADA ✅ (2026-06-01)
- 8 arquivos novos: core/profile/{learning-c1,interest-c1}/{types,repository,service,routes}.ts +
  registro em profile.routes.ts. Espelha professional-c1. Sem migration (schema da Fatia 1 pronto).
- Rotas: GET/POST/PATCH/DELETE /profile/learning/c1 e /profile/interest/c1 (interest binário sem progress).
  Body camelCase, interno snake. actorId=req.actionContext.actorId (writer §4.8.1, nunca req.user.id);
  concept_id obrigatório; source_category_id breadcrumb com validação (scope+concept_id+bate conceptId →
  senão 400). resolveActorGuarded+invariante; mapIntegrityError (23505→409/23503→400/23514→400). Sem
  global_users.metadata, sem lifestyle, sem professional/capability/financeiro.
- Provas: learning GET vazio200/POST201/GET1/PATCH200/PATCHvazio400/dup409/DELETE200/GETvazio; interest
  ok; breadcrumb scope errado→400; legados /profile/learning e /physical intocados (200); blob intocado
  (0). typecheck=0; gates verdes; critical_new=0.
- Frontend ainda usa legados (blob). Fila: Fatia 3 backfill (DEV no-op) → Fatia 4 frontend → Fatia 5
  cleanup blob. DT-LEARNING-INTEREST-BLOB-SSOT OPEN (fecha na Fatia 5). Lifestyle fora.

### C1 LEARNING/INTEREST — FATIA 3 (BACKFILL) — EXECUTADA ✅ (2026-06-01)
- Migration 20260601150000_backfill_learning_interest_blob_to_c1.sql (forward-only, idempotente ON
  CONFLICT, transacional, fail-closed), runner canônico (única pendente; schema_migrations 342→343 com
  checksum). DECISION-0067 Fatia 3.
- Estratégia actor: actor_id via mapeamento canônico actors.global_user_id=global_users.global_user_id AND
  actor_type='user' (ponte; NÃO cria actor, NÃO usa global_user_id como identidade final). concept_id via
  categoria; source_category_id breadcrumb; progress de learningPreferences[catId].progress
  (beginner/intermediate/advanced→1/2/3). Guards fail-closed: não-array, sem actor, categoria não-resolvível,
  progress inesperado → abort.
- DEV: 0 itens no blob → backfill NO-OP (0 migradas). Provas: C1 inalterado (delta=0; learning=1/interest=1 =
  resíduo inativo Fatia 2); 0 duplicatas; blob intocado (0); categories/concepts intocados (36/38, 137);
  GET C1 200; legados /profile/learning e /physical 200. typecheck=0; gates verdes; critical_new=0.
- Frontend ainda nos legados; blob não limpo. DT-LEARNING-INTEREST-BLOB-SSOT OPEN (fecha Fatia 5).
  Fila: Fatia 4 frontend → Fatia 5 cleanup. Lifestyle fora.

### FATIA 4 PAROU → FATIA 4a BACKEND (DECISION-0068) EXECUTADA ✅ (2026-06-01)
- Fatia 4 frontend PAROU no READ-FIRST: (1) ProfileLearning só tinha categoryId (sem conceptId); (2)
  ProfilePhysical usa catálogo hardcoded de interesses com conceptId fake ('leisure.cinema'), nunca a árvore
  scope='interest'. Causa-raiz: categories.service removia conceptId p/ context!=='professional'.
- Fatia 4a (DECISION-0068): categories.service.ts expõe conceptId nas leituras para contextos DECLARATIVOS
  professional/learning/interest (helper canExposeCategoryConceptId; 3 pontos tree/children/autocomplete;
  context omitido NÃO surfaça). Não expõe a event/company/marketplace/transacional/lifestyle. Lei 7:
  declaração ≠ concept_ref transacional.
- Provas: professional 3; learning 36/36 (era 0); interest 38/38; children sem context 0; event/company 0.
  typecheck=0; gates verdes; critical_new=0. Escopo único categories.service.ts.
- Fila: Fatia 4b frontend Learning→C1 → 4c frontend Interest (redesign ProfilePhysical p/ árvore
  scope='interest' + /profile/interest/c1; lifestyle intocado) → Fatia 5 cleanup blob.

### C1 LEARNING — FATIA 4b (FRONTEND) — EXECUTADA ✅ (2026-06-01)
- Aba Aprendizado migrada p/ C1 (DECISION-0067). Só frontend. Novo api/learningC1.ts (client camelCase:
  get/declare/update/retire); ProfileLearning.tsx + useProfileLearningState.ts (modelo +conceptId, snapshot
  initialLearnings).
- Removido da aba: getLearningProfile/updateLearningProfile (blob). Neutralizado:
  createCategoryWithAI/suggestCategoryPath (mensagem honesta, sem backend). Novo: load getLearningC1; árvore
  getCategoryTree('learning') com conceptId (Fatia 4a); folha só declarável com conceptId real (sem fallback);
  save granular POST/PATCH/DELETE(soft); sourceCategoryId=categoryId breadcrumb; progress UI<->C1 1..3; C1 não
  persiste details/notes.
- Provas: frontend typecheck=0; greps (legado ZERO, C1 presente, conceptId, IA neutralizada, Physical
  intocado); runtime programacao POST201/GET/PATCH200/DELETE200soft/GETvazio; blob.learnings intocado (0).
  Gates verdes; critical_new=0.
- Interest (ProfilePhysical) ainda usa catálogo hardcoded (Fatia 4c redesign). Blob não limpo (Fatia 5).
  DT-LEARNING-INTEREST-BLOB-SSOT OPEN. Edge: re-declarar concept retirado dá 409 (UNIQUE; reativação via
  PATCH reactivate é follow-up). Fila: 4c → 5.

### C1 INTEREST — FATIA 4c (FRONTEND, REDESIGN ProfilePhysical) — EXECUTADA ✅ (2026-06-01)
- Seção de Interesses do ProfilePhysical migrada p/ C1 (DECISION-0067). Só frontend. HEAD origem eca51cbc.
  5 arquivos: novo api/interestC1.ts (client camelCase get/declare/update/retire, BINÁRIO sem progress);
  ProfilePhysical.tsx (catálogo fora, árvore C1 + save granular); ProfilePhysicalForm.tsx (chips removíveis +
  árvore real; hábitos/rotina/objetivos/estilo-de-vida intactos); useProfilePhysicalState.ts (estado árvore +
  snapshot initialInterests; removeu activeDomain/customInterestInput); useProfilePhysicalLogic.ts
  (PREDEFINED_CONCEPTS fake removido; exporta isInterestSelected/findCategoryInTree).
- Removido: catálogo hardcoded (39 conceitos fake 'leisure.cinema'/'activity.swimming'/'content.photography'),
  LIFE_DOMAINS, texto livre (addCustomInterest/generateCustomConceptId), InterestState. SEM mapeamento fake→real.
  Novo: getCategoryTree('interest') (conceptId Fatia 4a; folhas slug -interesse) + getInterestC1; folha só
  declarável com conceptId real (sem fallback conceptId←categoryId; raiz sem conceptId = navegação); save
  granular POST/DELETE(soft); sourceCategoryId=categoryId breadcrumb.
- Separação Interest×Lifestyle: interests→C1; PUT /profile/physical legado INTOCADO (interests:[] como já era;
  metadata.physicalProfile com interests do blob preservado verbatim — zero cleanup blob; lifestyle/hábitos/
  rotina/objetivos inalterados). Lifestyle/Saúde sem mudança semântica.
- Provas: frontend typecheck=0; greps (catálogo fake só em comentário; conceptId UUID, não categoryId/fake;
  legado preservado). Runtime (Café cafe-interesse): POST201/GET count1/DELETE200soft/GET active0;
  blob.interests 0 antes e 0 depois (C1 não toca blob); linha de teste removida. Gates verdes; critical_new=0,
  critical_total=20; warning_new=1 pré-existente (não meu, e2e-c3:334).
- Aprendizado E Interesses agora em C1. Blob não limpo (Fatia 5). DT-LEARNING-INTEREST-BLOB-SSOT OPEN (CLOSE
  só na Fatia 5). DT-PROFILE-FRONTEND-DRIVES-TAXONOMY mais mitigada (Interesses também não cria taxonomia).
  Edge 409 re-declarar retirado (reativação PATCH reactivate = follow-up). Fila: Fatia 5 cleanup blob.

### C1 LEARNING/INTEREST — FATIA 5 (CLEANUP BLOB) — EXECUTADA ✅ · DT-BLOB-SSOT CLOSED (2026-06-01)
- Persistência de Learning/Interest saiu de global_users.metadata. HEAD origem f639516f. Lifestyle/Saúde
  preservados. 5 arquivos: nova migration 20260601160000_cleanup_learning_interest_blob_keys.sql;
  profile-learning.routes.ts (PUT /profile/learning → 501 → /profile/learning/c1); profile-learning.service.ts
  (updateLearningProfile REMOVIDO; getLearningProfile mantido p/ readers); profile-physical.service.ts (não
  lê/grava mais interests; updatePhysicalProfile retira chaves interests/learnings e preserva lifestyle;
  getPhysicalProfile→interests:[]); ProfilePhysical.tsx (não reidrata/reenvia interesses pelo legado).
- Migration forward-only/idempotente, guard C1-existe + verificação pós; metadata - 'learnings' - 'interests'
  só nas linhas com as chaves. Antes learnings=1/interests=2 rows → depois 0/0; demais chaves preservadas
  (lifestyle/preferences/learningPreferences/learningMetadata/physicalMetadata/updatedAt). schema_migrations
  343→344; runner re-run 0 pendentes; UPDATE re-run 0 linhas.
- Runtime (3010): PUT /profile/learning→501; GET /profile/learning/c1→200; Interest C1 POST201/GETactive1/
  DELETE200 (intacto); PUT /profile/physical com interests falso → ignorado (interests=0) + lifestyle
  persistido + blob hasL=false/hasI=false antes e depois; GET /profile/physical interests=[]+lifestyle.
  actor_learning/interest_concepts intactas. Lifestyle de teste revertido.
- Gates: back+front typecheck=0; actor-writer/bank-ledger/regression OK (344); arch critical_new=0,
  critical_total=20; warning_new=1 pré-existente (não meu). Zero financeiro/Agenda/Saúde/Profissional C1.
- DT-LEARNING-INTEREST-BLOB-SSOT → CLOSED. DT-LIFESTYLE-SENSITIVE-IN-BLOB OPEN (frente própria).
  DT-PROFILE-FRONTEND-DRIVES-TAXONOMY PARTIALLY MITIGATED (não fechada). Nova DT-C1-LEARNING-INTEREST-
  REACTIVATION (OPEN LOW, edge 409). Resíduo: readers backend (opportunity/inference/core) ainda no blob
  vazio → migração p/ C1 é frente futura. Frente Learning/Interest→C1 CONCLUÍDA (Fatias 1–5).

### SELO C1 LEARNING/INTEREST — FRENTE CONCLUÍDA (docs-only) ✅ (2026-06-01)
- Criado docs/02_decisions/SELO_C1_LEARNING_INTEREST.md: encerramento documental da frente Learning/Interest
  → C1 (Fatias 1–5). Docs-only; zero código/runtime/migration/frontend/backend/financeiro. HEAD selado
  9c3af519. Cadeia cf791d1f(0064)/233cb428(0065)/6d9e9a29(MigA)/a602d2dd+963649af(0066+ADENDO)/ff7495c5(MigB)/
  b445cf4a(0067)/0299459b(F1)/4abf8a90(F2)/827c0b07(F3)/ff534b44(0068-4a)/eca51cbc(4b)/f639516f(4c)/9c3af519(F5).
- Estado final: Learning→actor_learning_concepts, Interest→actor_interest_concepts, view
  actor_concept_declarations_v; metadata.learnings/interests removidos; Lifestyle fora. Invariantes:
  concept_id=identidade, category/source_category=breadcrumb, actor_id=operacional, sem global_user_id/blob
  SSOT, sem frontend criando taxonomia, sem financeiro.
- DTs: BLOB-SSOT CLOSED; LIFESTYLE-SENSITIVE OPEN; FRONTEND-DRIVES-TAXONOMY PARTIALLY MITIGATED;
  C1-REACTIVATION OPEN LOW. Resíduos (frentes próprias): readers backend→C1, reativação pós soft-delete,
  Lifestyle/Saúde, Agenda. Gates docs-only verdes (critical_new=0). Atualizados STATUS+opus+DT_LOG (ref selo).

### READERS BACKEND → C1 — F1 (READ HELPER) EXECUTADA ✅ · DECISION-0069 (2026-06-01)
- Infra de leitura C1 para readers user-scoped. Só backend, read-only; NENHUM consumidor migrado
  (profile-inference/opportunity/core intactos). HEAD origem 392cd68b. Zero frontend/migration/financeiro/
  Lifestyle/Saúde/Agenda/Professional.
- DECISION-0069 (docs/02_decisions/DECISION_0069_*): userId→actors.actor_id (tenant+user_id+actor_type='user');
  sem ensureUserActor; sem global_user_id SSOT; 0 actor→vazio controlado; >1→USER_ACTOR_AMBIGUOUS_FOR_C1_
  DECLARATIONS; fonte view actor_concept_declarations_v (concept_id identidade; source_category_id breadcrumb).
- Arquivos: profile-c1-declarations-read.repository.ts (findUserActors + listActive learning/interest via view +
  LEFT JOIN categories) + .service.ts (getUserActorConceptDeclarationsForProfile + wrappers; shape {actorId,
  learning[],interests[]}; progress 1/2/3→beginner/intermediate/advanced; professional excluído).
- Provas runtime (probe tsx, declarações C1 seedadas/removidas): actorId match dev, learning=3/interest=1;
  progress 1/2/3→labels (conceptId real, name/path do breadcrumb); interest conceptId+sourceCategoryId; user
  sem actor→{actorId:null,[],[]} (não 500); ambiguidade fail-closed por rows.length>1. Greps: sem SELECT*/
  global_users.metadata/ensureUserActor (só comentário). Gates: typecheck0; actor-writer/bank-ledger/regression
  OK; arch critical_new=0/total=20. DT-C1-READERS-BLOB-TO-C1 OPEN. Fila: F2 inference→F3 opportunity→F4 core.

### READERS BACKEND → C1 — F2 (PROFILE-INFERENCE CONCEPT-FIRST) EXECUTADA ✅ (2026-06-01)
- profile-inference.service.ts migrado p/ ler Learning/Interest pelo helper C1 (F1), concept-first. HEAD origem
  8820b59a. Só profile-inference (+ types aditivo). Nenhum outro consumidor migrado. Zero frontend/migration/
  financeiro/Lifestyle/Saúde/Agenda/Professional/reactivation.
- Escopo D1 (autorizado Clayton): incluído profile-inference.types.ts só p/ +conceptId aditivo no snapshot
  (interest/learning). Blast radius verificado = zero fora de profile-inference (snapshot só construído em
  getUserProfileSnapshot; typecheck confirma). categoryId/categoryName=breadcrumb/backcompat (null→''), nunca
  identidade.
- getUserProfileSnapshot troca getPhysicalProfile/getLearningProfile por
  profileC1DeclarationsReadService.getUserActorConceptDeclarationsForProfile (vazio controlado sem actor).
  REGRA A/B usam interest.conceptId/learning.conceptId direto; resolvePhysicalToLearningTarget/
  resolveLearningToProfessionalTarget aceitam conceptId (não resolvem concept de categoryId; breadcrumb só p/
  slug-fallback); ids de sugestão por conceptId. recordSuggestionAction/isSuggestionDismissed
  (metadata.suggestionHistory) intocados. resolveConceptFromCategoryCached só em findCategoryBySlug (alvo).
- Provas runtime (probe): P0 limpo→0/0 explorer sem throw; P1 interest→count1 conceptId real, REGRA A
  concept-first 1 sugestão; P2 beginner→hasIntermediateOrAdvanced=false; P3 intermediate→=true, in_transition;
  P4 no-actor→0/0 sem 500. Greps: sem getLearningProfile/getPhysicalProfile (comentário), sem metadata.learnings/
  interests, sem fallback conceptId←categoryId. opportunity/core/feed/matching sem diff. Gates verdes;
  critical_new=0/total=20. DT-C1-READERS-BLOB-TO-C1 OPEN (parcial). Fila: F3 opportunity→F4 core.

### READERS BACKEND → C1 — F3 (OPPORTUNITY SERVICE) EXECUTADA ✅ (2026-06-01)
- opportunity.service.ts: gate de Aprendizado lê o C1 (helper F1), não mais getLearningProfile legado/blob.
  HEAD origem c7eb34a4. Só opportunity.service. Zero frontend/migration/financeiro/Lifestyle/Saúde/Agenda/
  Professional/reactivation.
- Removido import dinâmico de profileLearningService; gate learningProfile.learnings.length →
  getUserLearningDeclarationsForProfile → learningDeclarations.length. 0 actor/0 decl ⇒ count 0 controlado
  (sem throw); ambiguidade propaga erro real. getInferences (concept-first pós-F2) preservado. Geradores mock
  intocados (recebem declarações C1; ignoram conteúdo — aprendizado sugestivo, não bloqueante). Só count, sem
  categoryId como identidade. Interest não tocado.
- Provas runtime (probe): A sem learning→0 (sem throw); B com Learning C1→gate true, 2 oportunidades; C
  no-actor→0 sem 500. Greps: sem getLearningProfile/getProfileLearningService (comentário); helper C1 presente;
  sem global_users.metadata. profile-inference/core/feed/matching sem diff. Gates verdes; critical_new=0/
  total=20. DT-C1-READERS-BLOB-TO-C1 OPEN (parcial; pendente core.service). Fila: F4 core.service.getCompleteProfile.

### READERS BACKEND → C1 — F4 (CORE.SERVICE) EXECUTADA ✅ · DT-READERS CLOSED (2026-06-01)
- core.service.getCompleteProfile: physical_profile.interests vem do C1 (helper F1), não mais do físico legado
  (que retornava []). Último dos 3 agregadores → fecha DT-C1-READERS-BLOB-TO-C1. HEAD origem dc1c40f7. Só
  core.service. Zero frontend/migration/financeiro/Lifestyle-semântica/Saúde/Agenda/Professional/reactivation.
- getPhysicalProfile mantido SÓ p/ lifestyle/preferences/health (legado intocado); interests via
  getUserInterestDeclarationsForProfile, mapeados {conceptId, categoryId(=sourceCategoryId??''), categoryName
  (??''), categoryPath(??[])} (physical_profile.interests é any[] → conceptId aditivo local; categoryId/Name
  breadcrumb, nunca identidade; sem fallback conceptId←categoryId). Top-level profile.interests ganhou fallbacks
  aditivos (interest_id=conceptId; name=categoryName). Sem actor/decl ⇒ [] controlado; ambiguidade tratada pelo
  catch resiliente da seção (getCompleteProfile nunca lança).
- Provas runtime (probe): A sem interest→physical_profile presente, []=interests, lifestyle preservado; B com
  Interest C1→count1 conceptId real, name=Café, top profile.interests[0]={interest_id:conceptId,name:Café},
  lifestyle preservado; C no-actor→physical_profile null, interests [], sem 500. Greps: sem physicalProfile.
  interests, sem global_users.metadata novo; inference/opportunity/feed/matching sem diff. Gates verdes;
  critical_new=0/total=20.
- DT-C1-READERS-BLOB-TO-C1 CLOSED (3 agregadores no C1). Resíduo não-bloqueante: GET /profile/learning legado lê
  blob vazio (frontend-morto, candidato 501 follow-up); getPhysicalProfile só p/ lifestyle/health (DT-LIFESTYLE-
  SENSITIVE-IN-BLOB). Nenhum reader sourcing interest/learning do blob. Frente readers→C1 (F1–F4) CONCLUÍDA.

### C1 LEARNING/INTEREST — REATIVAÇÃO PÓS SOFT-DELETE ✅ · DT-REACTIVATION CLOSED (2026-06-01)
- Re-declarar (POST) concept retirado não dá mais 409 → reativa linha inativa, idempotente. Só backend C1
  (learning-c1 + interest-c1, repo+service). HEAD origem c5b1fea3. Zero migration/frontend/routes/readers/
  Professional/Lifestyle/Saúde/Agenda/financeiro/blob.
- Novo findByConcept nos repos (linha ativa OU inativa). declareConcept idempotente: inativa→reativa via
  updateConcept({reactivate:true, sourceCategoryId?, progress?}) (is_active=true, retired_at=NULL,
  updated_at=now(); breadcrumb/progress só mudam se enviados; declared_at preservado); ativa→409 preservado;
  inexistente→INSERT. POST mantém 201 também na reativação (sem branch de rota, sem novo param reactivate no
  POST). assertSourceCategory mantido; Interest binário; Professional não tocado.
- Provas runtime (probe): Learning POST novo(progress1)→DELETE soft→POST reativa(progress1→3, retiredAt null,
  declaredAt preservado, sem 409)→GET ativo→POST ativo=409→DB rows=1 (sem duplicata). Interest idem binário→
  reativa sem 409→409 ativo→DB rows=1. Gates verdes; critical_new=0/total=20. DT-C1-LEARNING-INTEREST-
  REACTIVATION CLOSED. Follow-ups: 501 GET /profile/learning; DT-LIFESTYLE; DT-PROFILE-FRONTEND-DRIVES-TAXONOMY.

### LEGADO LEARNING GET → 501 EXPLÍCITO ✅ (2026-06-01)
- GET /profile/learning (rota legada) → 501 PROFILE_LEARNING_LEGACY_DISABLED → /profile/learning/c1 (simetria
  com PUT). Só profile-learning.routes.ts. HEAD origem ed6738ce. Zero C1/frontend/migration/readers/Lifestyle/
  Saúde/Agenda/Profissional/financeiro.
- Handler GET não chama mais getLearningProfile (blob vazio); retorna {ok:false, code, message:'Use /profile/
  learning/c1', replacement:'/profile/learning/c1'}. Imports órfãos (profileLearningService, HttpError)
  removidos da rota. PUT preservado (501). getLearningProfile NÃO deletado (intacto, agora sem callers backend
  — remoção futura cosmética, reportada).
- Provas runtime (3010): GET 501 com code+replacement; PUT 501; GET /profile/learning/c1 200; GET /profile/
  interest/c1 200 (intacto). Greps: frontend api/learning.ts cliente morto (nenhum componente importa); backend
  getLearningProfile sem callers. Gates verdes; critical_new=0/total=20. DT-READERS residuo (a) RESOLVIDO.

### DT-PROFILE-FRONTEND-DRIVES-TAXONOMY — SPLIT DOCUMENTAL (DECISION-0070) ✅ DOCS-ONLY (2026-06-01)
- Auditoria read-only consolidada em DECISION-0070. Docs-only; zero código/runtime/frontend/backend/migration/
  financeiro/Lifestyle/Saúde/Agenda/C1. HEAD origem 9149e523.
- Achado: Learning(4b)+Interest(4c) neutralizados; C1 concept-first com trava conceptId (sem fallback
  conceptId←categoryId); frontend não cria CONCEPT (createCategoryWithAI cria só categories, sem concept_id →
  não-declarável no C1). Resíduo vivo de navegação governada por IA: Profissional (ProfileProfessional.tsx, UI
  renderizada) + Educação/Empresas (profile-education-companies.service.ts); governado por policy BLOCK/REVIEW/
  ALLOW + pending_review + auditoria source:'ai'.
- Criado docs/02_decisions/DECISION_0070_*: resíduo = expansão GOVERNADA de NAVEGAÇÃO, não identidade. Vetos:
  frontend não cria CONCEPT; sem categoryId como identidade; sem fallback conceptId←categoryId; categoria IA sem
  conceptId não vira declaração C1. DT-PROFILE-FRONTEND-DRIVES-TAXONOMY → PARTIALLY MITIGATED (núcleo semântico
  resolvido); nova DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION → DEFERRED (decisão de produto futura:
  manter governado / neutralizar como Learning-Interest / fila formal sempre REVIEW). Gates docs-only verdes;
  critical_new=0.

### DT-LIFESTYLE-SENSITIVE-IN-BLOB — D1 (POLÍTICA DADOS SENSÍVEIS) ✅ DOCS-ONLY · DECISION-0071 (2026-06-01)
- Decisão produto/privacidade ratificada por Clayton antes de schema/código. Docs-only; zero código/runtime/
  frontend/backend/migration/financeiro/Learning-Interest C1/Agenda/Profissional. HEAD origem dec3b883. DT segue
  OPEN (D1 é decisão; implementação pendente).
- Criado docs/02_decisions/DECISION_0071_*. Escolhas (9): sexualOrientation removido/bloqueado do MVP;
  relationshipStatus/drinks/smokes lifestyle privado (visibility private default, consent explícito por campo,
  sem targeting); social-targeting desacopla drinks/smokes até consent; retenção delete real/anonymize (audit
  sem valor em claro); identidade actor-first; Saúde→501 até substrato governado (0382 frente própria). Eixos
  10/11: texto livre que possa capturar saúde não é neutro; dado civil não reaproveitável p/ Saúde sem
  finalidade/consent (biologicalSex não existe no repo → trava prospectiva).
- Auditoria material: tabelas de saúde AUSENTES (0382 arquivada não aplicada); UI/rotas Saúde fantasmas; blob
  lifestyle DEV nulo. Gates docs-only verdes; critical_new=0. Sequência (não autorizada): F-SAUDE-501 →
  F-TARGETING-DECOUPLE → F1 schema → F2 backend → F3 frontend → F4 readers → F5 cleanup+selo+CLOSE. Ordem
  inegociável: política antes de schema/código.

### F-SAUDE-501 — SAÚDE FANTASMA DESATIVADA (501 HONESTO) ✅ (2026-06-01)
- Saúde fora do MVP (DECISION-0071 ponto 9). Só profile-health.routes.ts + ProfileHealth.tsx. HEAD origem
  18772b47. Zero schema/migration/SSOT/Lifestyle/drinks-smokes/social-targeting/Learning-Interest C1/
  Profissional/Agenda/financeiro. DT-LIFESTYLE-SENSITIVE-IN-BLOB OPEN (Lifestyle ainda no blob).
- Backend: 7 rotas /profile/health/* → 501 PROFILE_HEALTH_DISABLED (replacement null, ref DECISION-0071) SEM
  tocar DB (não chamam repo/service; fim do 500 fantasma). Services/repos legados ficam no código. Frontend:
  aba Saúde (ProfileHealth.tsx) = painel reservado honesto, não carrega/salva, não chama API, não captura campo
  de saúde (ProfileHealthForm/hooks/api/health ficam no código mas não renderizados/chamados pela aba).
- Provas runtime (3010): 7 endpoints 501 (não 500); log 0 erro de tabela; GET /profile/physical 200 (lifestyle
  intacto; profile-physical não tocado, height/weight degrada gracioso). Greps: aba não chama API; rota não
  chama repo. checkBackendHealth (/health liveness) e health-signals (saúde operacional) não tocados. Gates:
  back+front typecheck=0; actor-writer/bank-ledger/regression OK; arch critical_new=0/total=20. DT mitigação
  parcial, segue OPEN. Fila: F-TARGETING-DECOUPLE.

### F-TARGETING-DECOUPLE — DRINKS/SMOKES FORA DO SOCIAL-TARGETING ✅ (2026-06-01)
- DECISION-0071 ponto 4. Só social-targeting.service.ts. HEAD origem 075781b8. Zero migration/schema/frontend/
  Health/Lifestyle-SSOT/cleanup-blob/Learning-Interest C1/Profissional/Agenda/financeiro. DT OPEN.
- calculateRelevanceScore não lê mais physical_profile.lifestyle.{drinks,smokes} nem soma pontos por hábito;
  critério targeting.lifestyle aceito (shape preservado) mas IGNORADO, breakdown.lifestyle sempre 0. Sem consent
  fake. drinks/smokes seguem no perfil (lifestyle privado); só bloqueia uso secundário.
- Provas (função pura): perfil com drinks/smokes + targeting lifestyle → breakdown.lifestyle=0, score não infla
  (igual a sem lifestyle); outros sinais (isFollowed+interest) → score=100 (targeting funciona). Gates:
  typecheck0; actor-writer/bank-ledger/regression OK; arch critical_new=0/total=20.
- Resíduo reportado (fora do escopo): core.service:765 usa presença drinks/smokes (OR com relationship/sexual)
  no score de COMPLETUDE (+5) — não é targeting; tratar em F3/F5. Fila: F1 schema (SSOT lifestyle actor-first).

### F1a (DESENHO) ✅ + F1b (MIGRATION SSOT LIFESTYLE) ✅ (2026-06-01)
- F1a READ-ONLY ratificada (desenho material). F1b migration 20260601170000 executada. HEAD origem b64aadf8.
  Só migration + docs; zero backend runtime/frontend/social-targeting/profile-physical/core/Health/C1/
  Profissional/Agenda/financeiro/backfill/cleanup-blob. DT OPEN.
- Criou actor_lifestyle_attributes (actor-first, linha-por-atributo; FK actors(id)/tenants(id); UNIQUE(tenant,
  actor,attribute_key); consent/visibility/lifecycle) + actor_lifestyle_attribute_audit (append-only, SEM
  coluna de valor sensível). Idempotente (guards+verificação pós; schema_migrations 344→345). Sem RLS (igual
  C1; isolamento por tenant na query).
- Constraints provadas: attribute_key só relationship_status/drinks/smokes (sexual_orientation e
  health_condition REJEITADOS); visibility='private' (public rejeitado); lifecycle XOR (ativo⇒value+consent;
  inativo⇒value NULL+retired_at=anonymize); valor por key (texto livre rejeitado); ativo exige consented_at;
  audit 0 colunas de valor. Sem texto livre/notes/height/weight → trava captura indireta de Saúde. Tabela VAZIA
  (0 rows, sem backfill); blob metadata.lifestyle INTOCADO; Health ABSENT/501. Gates: actor-writer/bank-ledger/
  regression OK (345); arch critical_new=0/total=20.
- Micro-decisão backfill (F5): valores legados sem consent NÃO viram ativos+consentidos (DECISION-0071 §6);
  usuário re-declara (DEV nulo→no-op). Fila: F1a✅→F1b✅→F2 backend consent-aware→F3 frontend (remove
  sexualOrientation)→F4 readers/completude→F5 cleanup blob→F6 selo+CLOSE.

### F2 — LIFESTYLE BACKEND SERVICE/REPO CONSENT-AWARE ✅ (2026-06-01)
- Encanamento do SSOT Lifestyle. Só core/profile/lifestyle/ (lifestyle.{types,repository,service}.ts); SEM
  ROTAS (frontend/torneira na F3). HEAD origem e35b72d6. Zero frontend/migration/backfill/cleanup-blob/
  profile-physical/core/social-targeting/Health/C1/Profissional/financeiro. DT OPEN.
- lifestyleService: getLifestyle (ativos self); declareAttribute (consent OBRIGATÓRIO; key/value governados;
  idempotente inativo→reativa/ativo→update/novo→insert; visibility sempre private); retireAttribute (anonimiza
  attribute_value→NULL). Repo: colunas explícitas, runQueryWithTenant, resolveActorGuarded. Toda mutação grava
  audit (key+action+actor+source) SEM valor.
- Provas (probe interno): declare relationship_status/drinks/smokes+consent (private, consentedAt); update
  smokes; falham sem consent / sexual_orientation / valor inválido / visibility public(DB); retire anonimiza
  (value=NULL DB confirma); re-declare reativa; getLifestyle ok; audit declare/update/retire com 0 colunas de
  valor; blob metadata.lifestyle INTOCADO. Greps: sem metadata/ensureUserActor/SELECT* (só comentário);
  profile.routes sem lifestyle. Gates: typecheck0; actor-writer/bank-ledger/regression OK; arch critical_new=0/
  total=20. Fila: F3 frontend (rota + UI consent/visibility; remover sexualOrientation).

### F3 — LIFESTYLE ROTAS + FRONTEND PROFILEPHYSICAL → SSOT ✅ (2026-06-01)
- Tráfego de Lifestyle migrado p/ SSOT (torneira). HEAD origem 2da17955. Backend: lifestyle.routes.ts +
  registro em profile.routes. Frontend: api/lifestyle.ts + ProfilePhysical(+Form+state). Zero migration/
  backfill/cleanup-blob/core.service/social-targeting/Health/Learning-Interest C1/Profissional/Agenda/
  financeiro. DT OPEN.
- Rotas: GET /profile/lifestyle; PUT /profile/lifestyle/attributes/:key (consent obrigatório); DELETE (anonymize).
  actionContext.actorId; key z.enum (sexual_orientation→400); visibility nunca parâmetro. Frontend: ProfilePhysical
  carrega/salva relationship_status/drinks/smokes pelo SSOT (declare+consent / retire diff); parou de enviar
  lifestyle ao updatePhysicalProfile (só weeklyRoutine/goals no legado); sexualOrientation REMOVIDO da UI (só
  comentário); seção Estilo de Vida 🔒 Privado + checkbox consent; Interesses C1; Health 501.
- Provas runtime (3010): GET200; PUT relationship_status/drinks/smokes 200; sem consent→400; sexual_orientation→
  400; DELETE→value=NULL (anonymize DB confirma); audit declare/retire sem valor; blob metadata.lifestyle
  INTOCADO. Greps: usa client lifestyle, não envia lifestyle ao legado, sexualOrientation só comentário; módulo
  sem global_users.metadata. Gates: back+front typecheck0; actor-writer/bank-ledger/regression OK; arch
  critical_new=0/total=20. Endpoint legado /profile/physical ainda aceita lifestyle (estrada velha até F5). Fila:
  F4 readers/completude (core 388/765→SSOT; remover sexualOrientation do contrato legado).

### F4 — CORE READERS/COMPLETUDE → LIFESTYLE SSOT ✅ (2026-06-01)
- core.service.getCompleteProfile lê Lifestyle do SSOT. Só core.service.ts. HEAD origem 18333872. Zero frontend/
  migration/cleanup-blob/profile-physical.service/social-targeting/Health/Learning-Interest/Profissional/Agenda/
  financeiro. DT OPEN.
- physical_profile.lifestyle vem de lifestyleService.getLifestyle (resolve actor user via resolveUserActorId;
  sem actor→{drinks:null,smokes:null,relationshipStatus:null} controlado, sem 500), não mais do blob.
  getPhysicalProfile mantido só p/ preferences/sharedHealthData. sexualOrientation REMOVIDO do tipo
  CompleteProfile.physical_profile.lifestyle e do score de completude (conta presença de atributo do SSOT).
- Provas runtime (probe direto): A sem SSOT→lifestyle nulo sem sexualOrientation, completude física 0; B com
  SSOT consentido→lifestyle preenchido, completude 0→5, keys drinks/smokes/relationshipStatus (sem
  sexualOrientation); C no-actor→physical_profile null sem 500; blob metadata.lifestyle INTOCADO. Greps: core sem
  physicalProfile.lifestyle; sexualOrientation só comentário; profile-physical/social-targeting sem diff. Gates:
  typecheck0; actor-writer/bank-ledger/regression OK; arch critical_new=0/total=20. Blob e legado vivos até F5.
  Fila: F5 cleanup blob (profile-physical para de gravar/ler metadata.lifestyle; micro-decisão backfill).

### F5 — CLEANUP DO BLOB metadata.lifestyle ✅ (2026-06-01)
- Estrada velha cortada. Só profile-physical.{service,types}.ts + migration 20260601180000. HEAD origem
  75bf815c. Zero core.service/social-targeting/lifestyle-SSOT/Health(501)/frontend/Learning-Interest/Profissional/
  Agenda/financeiro/backfill. DT OPEN (falta selo F6).
- getPhysicalProfile não lê mais metadata.lifestyle (retorna {drinks:null,smokes:null,relationshipStatus:null}
  controlado, sem sexualOrientation); updatePhysicalProfile retira a chave lifestyle do metadata escrito (write-
  time, junto de interests/learnings) e ignora input.lifestyle. LifestyleInfo perdeu sexualOrientation (blast
  radius zero fora de profile-physical). Migration forward-only/idempotente metadata-'lifestyle': antes 2 rows/
  depois 0; preferences/physicalMetadata preservados; schema_migrations 345→346; re-run 0. Sem backfill
  (actor_lifestyle=0; legado sem consent não vira ativo — DECISION-0071 §6).
- Provas runtime (3010): GET /profile/physical 200 (lifestyle vazio, sem sexualOrientation); PUT com lifestyle
  → não recria a chave (hasLifestyle=false), physicalMetadata preservado; GET /profile/lifestyle 200 (SSOT);
  Health 501. Greps: profile-physical sem read/write metadata.lifestyle (só comentário); frontend não tocado
  (já não enviava; front typecheck dispensado). Gates: typecheck0; actor-writer/bank-ledger/regression OK (346);
  arch critical_new=0/total=20. Lifestyle agora é SSOT puro. Fila: F6 selo SELO_LIFESTYLE_SSOT.md + CLOSE da DT.

### F6 — SELO LIFESTYLE SSOT + CLOSE DA DT ✅ DOCS-ONLY (2026-06-01)
- Frente Lifestyle/Saúde sensível CONCLUÍDA E SELADA. HEAD origem fde091e1. Docs-only: zero código/runtime/
  frontend/backend/migration/schema/financeiro/Health/Lifestyle service-routes-core. 4 arquivos: novo
  docs/02_decisions/SELO_LIFESTYLE_SSOT.md + DT_LOG (CLOSE) + STATUS + opus.
- Selo consolida DECISION-0071→F-SAUDE-501→F-TARGETING-DECOUPLE→F1a/F1b/F2/F3/F4/F5: estado final material,
  cadeia de commits (18772b47/075781b8/b64aadf8/e35b72d6/2da17955/18333872/75bf815c/fde091e1; F1a=desenho
  read-only sem commit próprio), invariantes, provas por fatia, estado das DTs, resíduos.
- DT-LIFESTYLE-SENSITIVE-IN-BLOB → CLOSED (ref selo). Outras DTs intocadas (FRONTEND-DRIVES-TAXONOMY PARTIALLY
  MITIGATED; PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION DEFERRED).
- HONESTIDADE (registrada no selo §6, não tocada): sexualOrientation sobrevive como CÓDIGO MORTO cosmético no
  contrato legado /profile/physical (profile-physical.routes.ts:34 literal :null só no fallback de perfil nulo;
  :64 Body type aceito mas stripado por F5) + tipos do client frontend (api/core.ts:39, api/physical.ts:17).
  Sem captura/persistência/projeção. NÃO "fora do contrato vivo" de forma absoluta — resíduo morto, frente
  cosmética própria opcional. Lição: grep de revalidação no READ-FIRST pegou o que o prompt assumia já limpo;
  reportar com precisão > carimbar a narrativa do selo.
- Gates docs-only: actor-writer/bank-ledger/regression OK (346); arch critical_new=0/total=20. Typecheck NÃO
  rodado (nenhum código tocado). Próximas: (1) auditoria read-only abas restantes do Perfil; (2) Agenda/TEMPO;
  (3) Health governado futuro só com nova decisão.

### AUDITORIA ABAS PERFIL (READ-ONLY) + F-AGENDA-DESENHO + DECISION-0072 (2026-06-01)
- Auditoria read-only das 8 abas: seladas Profissional/Learning/Interest/Lifestyle (C1/SSOT) + Saúde 501.
  ACHADO PRINCIPAL não-cosmético: aba Agenda WRITE QUEBRADO — ProfileAgenda.tsx:165 salva via PUT /profile/
  professional (agora 501) → dado perdido; leitura canônica /availability mas setSchedule({}) (template nunca
  lido de volta = write-only). Pessoal=mix (identity+user_profiles.cpf transição 0062+addresses SSOT+
  metadata.gender blob). Educação=event_log event-sourced + impl órfã não-registrada (drift). PJ=domínio
  separado. Cruzei os achados materiais (Agenda 501, Personal/Physical SSOT) direto no código antes de reportar.
- F-AGENDA-DESENHO read-only: SSOT_REGISTRY §SSOT TEMPORAL = unified_availability ÚNICO SSOT temporal;
  schedules/schedule_slots LEGADO (WRITE=C63 crítico, 6 paths ativos events/employee); tabela temporal nova/
  metadata/professional VETADOS. Mismatch: UI template semanal {[dayOfWeek]:string[]} vs availability janelas
  concretas (sem coluna recorrência viva). Conferir o registry ANTES de recomendar evitou erro: meu instinto
  inicial (tabela actor_availability_templates nova) era VETADO pela norma.
- F0 DECISION-0072 DOCS-ONLY: Clayton escolheu B1 (materializar grade semanal em janelas concretas no
  unified_availability; availability_type='recurring', horizonte 8–12 semanas, TZ explícita, diff incremental
  protegendo bookings, specific→janelas/overrides). B2 (recorrência nativa) futuro. Doc DECISION_0072_* +
  DECISIONS_LOG + DT_LOG + STATUS. DT-AGENDA permanece OPEN (decisão tomada, impl pendente). Gates docs-only
  verdes (346; critical_new=0/total=20). Zero código/migration/schema/financeiro. Fila: F1 backend
  materializador seguro → F2 frontend (write + read-back) → F3 cleanup updateProfessionalProfile morto → F4
  selo+CLOSE. Ordem: backend antes do frontend; SEM DELETE em massa de availability.

### F1 — AGENDA BACKEND MATERIALIZADOR SEMANAL ✅ (2026-06-01)
- Backend-only. HEAD origem 3eb65faa. 3 arquivos: novo weekly-template-materializer.service.ts + rota PUT
  /availability/weekly-template + fix repo updateAvailability. Zero frontend/migration/schema/professional/
  lifestyle/health/learning/financeiro/schedules/schedule_slots.
- Materializa grade semanal → janelas concretas no SSOT availability (availability_type='recurring';
  specific→'fixed'). Actor-first (ownerId=actionContext.actorId). Timezone IANA obrigatória (luxon; 400 se
  inválida; sem fallback silencioso). Horizonte finito 8 semanas (clamp 8-12). Diff incremental: cria/mantém/
  reativa pausadas idênticas/retira SOFT (status=paused, NUNCA DELETE) só órfãs sem booking/participant —
  janela com compromisso vivo PROTEGIDA. Marcador metadata.source='profile_weekly_template' (≠ chave schedule
  vetada; guard só bloqueia 'schedule'; legal e necessário ao diff; não persiste blob).
- FIX COLATERAL (bug pré-existente, mesmo domínio): off-by-one em repository.updateAvailability (paramIndex+=2
  deslocava WHERE → param availabilityId não-referenciado → 42P18) quebrava TODO update de availability
  (inclusive PUT /:id vivo). Corrigido (índices 1-based reais). F1 dependia de updateAvailability (retire/
  reactivate) → correção estrutural evidente no domínio, low-risk, reportada. Lição: tracei o off-by-one
  reproduzindo a query isolada (funcionou) vs runtime (falhou) → diferença era o índice gerado, não o dado.
- Provas (probe c/ teardown): P1 8 janelas/8sem; P2 idempotente (0/8); P3 retira 7 órfãs soft + protege janela
  com booking (active), 0 DELETE; P4 specific válido cria / inválido rejeita; P5 tz inválida 400; P6 schedules/
  schedule_slots 0→0. Gates verdes (typecheck0; critical_new=0/total=20). Probe NÃO commitado (faz DELETE; dev-
  only). Frontend ainda no 501 → DT-AGENDA OPEN. Fila: F2 frontend (write canônico + read-back) → F3 → F4.

### F2 — AGENDA FRONTEND → WEEKLY TEMPLATE ENDPOINT ✅ (2026-06-01)
- Frontend-only (2 arquivos: api/availability.ts + ProfileAgenda.tsx). HEAD origem 29de8ef0. Zero backend/
  migration/schema/professional/financeiro/Learning-Interest/Lifestyle/Health/schedules/schedule_slots. Bug
  visível da Agenda fechou.
- Save: removeu updateProfessionalProfile({availability}) (→ PUT /profile/professional → 501); novo
  putWeeklyAvailabilityTemplate → PUT /availability/weekly-template. Timezone explícita do browser
  (Intl…timeZone; bloqueia save se ausente, sem fallback silencioso). ownerId não enviado (backend usa
  actionContext). Debounce preservado. 501 desaparece.
- Read-back: setSchedule({}) (write-only) → reconstructWeeklySchedule a partir das janelas concretas do SSOT
  availability (metadata.source==='profile_weekly_template' + recurring + active), start/end→dia+HH:mm via
  luxon na tz da janela. Nunca de bookings nem metadata.schedule. Leitura de janelas/bookings/conflitos
  preservada. specific sem UI nova.
- Provas HTTP (3010, actor dev): PUT 200 (não 501), created=16 (mon+wed/8sem); GET 16 janelas template;
  read-back reconstrói {monday:09:00-12:00, wednesday:14:00-16:00}; 16 rows em availability (não profile);
  teardown limpo. Greps: sem updateProfessionalProfile/profile/professional (só comentário); chama endpoint
  temporal; sem metadata.schedule/schedules/schedule_slots. Gates: front+back typecheck0; critical_new=0/
  total=20. DT-AGENDA OPEN. Fila: F3 cleanup client legado updateProfessionalProfile({availability})+campo
  availability? → F4 selo+CLOSE.

### F3 — AGENDA CLEANUP DO CLIENT LEGADO ✅ (2026-06-01)
- Frontend-only, 1 arquivo (api/categories.ts). HEAD origem 20ac9756. Zero backend/migration/schema/financeiro/
  schedules/professional-backend/profile-professional.
- Removido updateProfessionalProfile (+ campo availability? do payload) — único caller HTTP do legado PUT
  /profile/professional (501) e cabo morto da Agenda pré-F2. Zero caller vivo (grep antes da remoção).
- Preservados (fora do escopo, sem "já que estou aqui"): tipo AvailabilitySchedule (vivo, UI da grade em
  AvailabilitySchedule.tsx/Enhanced/ProfileAgenda/Form/state); getProfessionalProfile + interface
  ProfessionalProfile (leitura legada, faxina futura). ProfileAgenda só comentário explicativo do 501.
- Provas: frontend typecheck0 (sem import órfão — PricingType/ServiceType seguem usados); greps
  updateProfessionalProfile só comentário, availability?: zero em categories.ts, ProfileAgenda usa endpoint
  temporal. Gates: actor-writer/bank-ledger/regression OK; critical_new=0/total=20. DT-AGENDA OPEN. Fila: F4
  selo SELO_AGENDA_UNIFIED_AVAILABILITY.md + CLOSE.

### F4 — SELO AGENDA + CLOSE DA DT ✅ DOCS-ONLY (2026-06-01)
- Frente Agenda/TEMPO CONCLUÍDA E SELADA. HEAD origem e2e93573. Docs-only: zero código/runtime/frontend/backend/
  migration/schema/financeiro/availability-service-routes/ProfileAgenda. 4 arquivos: novo
  docs/02_decisions/SELO_AGENDA_UNIFIED_AVAILABILITY.md + DT_LOG (CLOSE) + STATUS + opus.
- Selo consolida DECISION-0072 B1 → F1 (materializador PUT /availability/weekly-template + fix off-by-one repo)
  → F2 (frontend endpoint temporal + read-back SSOT) → F3 (remoção client morto updateProfessionalProfile).
  Cadeia: 3eb65faa/29de8ef0/20ac9756/e2e93573. Estado final, invariantes, provas, resíduos.
- DT-AGENDA-AVAILABILITY-VIA-DEAD-LEGACY-PUT → CLOSED. Agenda escreve/lê do SSOT unified_availability; grade
  semanal materializada (B1); /profile/professional morto sem caller; nada em metadata.schedule/schedules/
  schedule_slots. Gates docs-only: actor-writer/bank-ledger/regression OK (346); arch critical_new=0/total=20.
  Typecheck não rodado (nenhum código). Resíduos→frentes próprias: B2 recorrência nativa, C63 schedules legado,
  getProfessionalProfile leitura legada, cleanup cosmético. Próximo corte (com mapa): Educação decision/read-
  only OU PJ actor-context. (Padrão consolidado das frentes Perfil: política/decisão → schema/backend → frontend
  → cleanup → selo+CLOSE; readers backend migram à parte; nunca fechar DT antes do selo.)

### AUDITORIA READ-ONLY EDUCAÇÃO + D1 (DECISION-0073) ✅ DOCS-ONLY (2026-06-01)
- Auditoria read-only: caminho vivo profile-education.* (registrado) é event-sourced, actor-first, append-only
  (event_log, metadata.actorId); sem metadata-blob/category_id/concept_id; separado de Learning C1 e Professional
  C1 (zero cruzamento, diploma não vira C1); 0 eventos DEV (dormente). profile-education-companies.* = ÓRFÃO MORTO
  (sem rota registrada em lugar nenhum; user_education/user_companies AUSENTES; global_user_id-keyed; category-as-
  identity; createCategoryWithAI) + EducationSection.tsx não-renderizado (helper local sem API). Cruzei: rotas
  órfãs não registradas + to_regclass null + 0 callers frontend antes de afirmar "morto".
- Risco material = SEMÂNTICO (não banco): vocabulário de credencial (validada_institucionalmente/confirmada/
  contestada + validator/evidence; UI "Validada Institucionalmente") sobre dado 100% autoasserido — sem emissor/
  prova/autoridade/terceiro. Declaração vestida de credencial.
- D1 DECISION-0073 (docs-only): Educação MVP = declaração NÃO-verificada. Veto: não apresentar como verificada sem
  emissor/prova/autoridade/terceiro. Termos credenciais → reservar (preferida) ou rebaixar p/ autodeclaração (F2).
  Doc DECISION_0073_* + DECISIONS_LOG + nova DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY (OPEN; referencia a
  AI-category DT DEFERRED sem reabri-la). Gates docs-only verdes (critical_new=0/total=20). Zero código/migration/
  schema/financeiro. Fila: F1 neutralizar órfão morto → F2 vocabulário/event types → F3 selo. (Lição: a aba estava
  mais limpa que o esperado; o risco real era linguagem/autoridade, não schema — DECISION antes de código evitou
  apagar órfão por reflexo.)

### F1 — EDUCAÇÃO: NEUTRALIZAÇÃO DO ÓRFÃO MORTO ✅ (2026-06-01)
- git rm de 4 arquivos mortos (categoria 1 §4-A): backend profile-education-companies.{routes,service}.ts +
  frontend EducationSection.{tsx,css}. HEAD origem 0fe5e694. Classificação: zero callers/imports no repo, não
  registrado, tabelas user_education/user_companies AUSENTES, padrão anti-canônico (global_user_id+category-as-
  identity+createCategoryWithAI) superado por 0069/0070/0073 → NÃO _orphans/ (anti-canônico superado, git
  preserva). Tipos exportados sem consumo externo.
- Paciente vivo INTACTO (zero diff): profile-education.{routes,service,types}.ts, ProfileEducation.tsx,
  api/education.ts; /profile/education + /education/events registrados; event_log intocado. createCategoryWithAI
  vivo (categories.service) não tocado. DB user_education/user_companies continua AUSENTE.
- Provas: órfão zero referências pós-remoção; back+front typecheck0; gates OK; critical_new=0/total=20. Zero
  migration/schema/financeiro/Learning/Professional/Agenda/Lifestyle/Health. AI-category DT segue DEFERRED (só
  perdeu o caller morto de Educação/Empresa; resíduo vivo é Profissional). DT-EDUCATION-DECLARATION-CREDENTIAL-
  VOCABULARY OPEN. Fila: F2 reservar/rebaixar vocabulário credencial → F3 selo. (Disciplina: classifiquei §4-A +
  provei zero-caller + DB ausente ANTES de rm; caminho vivo não recebeu diff.)

### F2 — EDUCAÇÃO: VOCABULÁRIO DE CREDENCIAL RESERVADO ✅ (2026-06-01)
- HEAD origem 43a777a4. 4 arquivos (backend profile-education.routes + frontend useProfileEducationLogic/
  ProfileEducation/ProfileEducationForm). Zero migration/schema/DML/Learning/Professional/Agenda/Lifestyle/Health/
  financeiro. Educação = declaração não-verificada (DECISION-0073). RESERVADOS (não rebaixados): validada_
  institucionalmente/confirmada/contestada.
- Backend (gate real): zod eventType só declarativos (declarada/iniciada/concluida/abandonada); os 3 → 400;
  validator/evidence removidos do schema. Frontend: CANONICAL=4, THIRD_PARTY=[] → bloco validator/evidence
  inalcançável; ProfileEducation não injeta payload.validator/evidence; copy honesta "autodeclaradas, não
  verificadas". Union de tipos mantida (read-model legado), nunca opção viva.
- Provas HTTP (/profile/education/events): declarada 200; validada_institucionalmente/confirmada 400; GET
  /profile/education 200. Gates back+front typecheck0; critical_new=0/total=20.
- ACHADOS reportados (fora do escopo, NÃO corrigidos): (a) api/education.ts chama /education/events SEM prefixo
  /profile → 404 (só getEducationProfile usa /profile/education); escrita via UI já quebrada por path mismatch
  pré-existente (explica 0 eventos) — candidato a micro-fix. (b) probe criou 1 evento de teste educacao.declarada;
  cleanup exigia DML em event_log (TRAVA do escopo respeitada — classifier bloqueou e mantive a fronteira) →
  ruído DEV, limpeza autorizada à parte. (Lição: provar caminho 200 que PERSISTE em substrato append-only deixa
  resíduo que a própria trava da fatia impede limpar — em fatias futuras, preferir provar rejeição/no-persist ou
  pedir janela de DML de teardown no escopo.) DT-EDUCATION OPEN. Fila: F3 selo (+ resíduo path) + CLOSE.

### F2.1 — EDUCAÇÃO: CORREÇÃO DO PATH DO CLIENT ✅ (2026-06-01)
- 1 arquivo frontend (api/education.ts). HEAD origem 4a6b830b. Resíduo (a) da F2 RESOLVIDO: listEducationEvents +
  createEducationEvent /education/events (404) → /profile/education/events (rota viva, prefixo profile). Backend
  correto, NÃO tocado. Sem alterar event types/vocabulário/schema/semântica.
- Provas HTTP: GET /profile/education/events 200 (era 404); POST validada_institucionalmente 400 (vocabulário F2
  intacto); GET /profile/education 200; path antigo /education/events 404 (confirma fix). NENHUM novo evento de
  teste (provei via GET + credential-400 sem persist — aplicada a lição da F2). Frontend typecheck0; gates OK;
  critical_new=0/total=20. Escrita de Educação via UI FUNCIONAL. Zero backend/migration/schema/DML/Learning/
  Professional/Agenda/Lifestyle/Health/financeiro. Resíduo (b) 1 evento de teste mantido (DML não autorizado).
  DT-EDUCATION OPEN. Fila: F3 selo + CLOSE.

### F3 — SELO EDUCAÇÃO + CLOSE DA DT ✅ DOCS-ONLY (2026-06-01)
- Frente Educação CONCLUÍDA E SELADA. HEAD origem b6185554. Docs-only: zero código/runtime/migration/DML/cleanup
  do evento DEV/Learning/Professional/Agenda/Lifestyle/Health/financeiro. 4 arquivos: novo
  docs/02_decisions/SELO_EDUCATION_DECLARATION.md + DT_LOG (CLOSE) + STATUS + opus.
- Selo consolida DECISION-0073 (0fe5e694) → F1 órfão removido (43a777a4) → F2 vocabulário reservado (4a6b830b)
  → F2.1 path do client (b6185554). Estado final, invariantes, provas, resíduos.
- DT-EDUCATION-DECLARATION-CREDENTIAL-VOCABULARY → CLOSED. Educação = declaração não-verificada actor-first sobre
  event_log; sem "validada institucionalmente" no fluxo vivo; sem validator/evidence no schema; órfão removido;
  escrita via UI funcional. DT-PROFESSIONAL-EDUCATION-COMPANY-AI-CATEGORY-EXPANSION segue DEFERRED (resíduo vivo =
  Profissional/IA, não Educação). Gates docs-only: actor-writer/bank-ledger/regression OK (346); critical_new=0/
  total=20. Typecheck não rodado. Resíduos→frentes próprias: credencial real, 1 evento DEV de teste. Próximo mapa:
  PJ actor-context OU cleanup cosmético morto (não misturar).
- ESTADO PERFIL pós-Educação: Profissional C1, Learning/Interest C1, Lifestyle SSOT, Agenda/unified_availability,
  Saúde 501, Educação declaração-não-verificada — TODAS seladas. Abas restantes: Pessoal (identity+user_profiles.cpf
  transição 0062+addresses+metadata.gender), PJ (CompaniesManager, domínio actor próprio). Cosmético morto pendente:
  sexualOrientation legado, componentes Health não-renderizados, gender em blob, getProfessionalProfile leitura legada.

### REANCORAGEM DE ESCOPO + AUDITORIA ENDEREÇO PF + D1 (DECISION-0074) ✅ DOCS-ONLY (2026-06-01)
- ESCOPO TRAVADO: esta instância NÃO mexe em PJ/Companies/CNPJ/actor page-company/CompaniesManager/ERP/PDV/CRM/
  company address. PJ é frente de OUTRO chat/instância. Aqui: só Perfil PF + dependências civis.
- Auditoria READ-ONLY (aba Pessoal + endereço civil): endereço PF em profiles.metadata.address (blob, sem lat/lng,
  cidade/estado texto livre), fora do Location Core canônico (addresses+address_assignments, DECISION-0020) que
  companies/marketplace/geo já consomem. DEV: 1 blob. Location Core JÁ tem slot nativo PF (owner_type='profile',
  role='RESIDENCE', source IMPORT_LEGACY/UX_INPUT, lat/lng, temporal). Endereço PF é o ÚNICO campo civil ainda em
  blob (fullName/birthdate/avatar=global_users OK; phone=profiles OK; CPF=transição governada 0062; gender=blob DT).
- D1 DECISION-0074 (docs-only): endereço civil PF → Location Core. Owner model (voto Clayton): owner_type='profile'
  + owner_id=actor_id do user-actor + role='RESIDENCE' + is_primary=true; source UX_INPUT(novo)/IMPORT_LEGACY
  (backfill). 'profile'=papel civil; dono operacional=actor PF (NÃO global_user_id, NÃO profile_id). Fronteiras:
  RESIDENCE ≠ HQ ≠ OPERATIONAL ≠ actor_active_location (contexto espacial corrente, não residência). Doc
  DECISION_0074_* + DECISIONS_LOG + nova DT-PERSONAL-ADDRESS-BLOB-TO-LOCATION-CORE (OPEN). Gates docs-only verdes
  (critical_new=0/total=20). Zero código/migration/DML/financeiro/PJ/Companies/CPF/gender. Fila: F1 backend reader/
  writer+backfill idempotente (F1 antes de F2) → F2 frontend → F3 readers/core sem blob → F4 cleanup blob → F5 selo+
  CLOSE. (Disciplina: confirmei slot canônico no schema vivo + contagem DEV antes de fixar; owner_id era a única
  trava de desenho, resolvida por Clayton.)

### F1 — ENDEREÇO CIVIL PF: BACKEND + BACKFILL LOCATION CORE ✅ (2026-06-01) — Opção A CEP-âncora
- HEAD origem 335a5eaf. 5 arquivos backend (novos: profile-residence-address.service.ts + migration 20260601190000;
  M: location.repository, profile.routes, core.service). Zero frontend/PJ/Companies/CPF/gender/financeiro. Blob
  profiles.metadata.address PRESERVADO (cleanup=F4).
- location.repository: findPrimaryAddressByOwner + retirePrimaryAssignment (soft valid_until_at, respeita UNIQUE
  parcial, nunca DELETE). Novo profile-residence-address.service (get/set; actor via resolveUserActorId/0069;
  createAddress country=BR+CEP+street+number+complement, state/city/neighborhood NULL, source=UX_INPUT; assignAddress
  profile/RESIDENCE/primary). Rotas GET/PUT /profile/residence-address. core.service.getCompleteProfile PREFERE
  Location Core + enriquece city/state/neighborhood do blob preservado (transição, sai no F4); fallback blob.
- Migration 190000 (forward-only/idempotente/fail-closed; schema_migrations 346→347): backfill IMPORT_LEGACY,
  profile/RESIDENCE/primary owner_id=actor_id; pula sem CEP/já-existente; NÃO cria actor; PRESERVA blob. Provado:
  blob 1→1, addresses 0→1, assignments 0→1; owner=494642e5 (user-actor), source IMPORT_LEGACY, state/city NULL;
  re-run não duplica.
- Runtime: GET/PUT /profile/residence-address 200 (PUT→UX_INPUT); GET /core/profile lê Location Core (address_id
  UUID) + enriquece Curitiba/PR/Sítio Cercado do blob (provado no TENANT REAL do backfillado — lição: o usuário
  backfillado não estava no tenant DEV padrão; backfill usou p.tenant_id corretamente, meu 1º probe usou tenant
  errado e deu undefined → confirmei no tenant certo, não era bug). Gates typecheck0; critical_new=0/total=20.
- Achado p/ instância PJ (registrado DT_LOG/STATUS): addresses não tem city/state/neighborhood textual (só FK +
  CEP/street/number/complement); PJ não deve assumir cidade/UF textual canônica; enriquecimento via CEP/catálogo/
  geocoding = decisão própria. DT-PERSONAL-ADDRESS OPEN. Fila: F2 frontend → F3 readers sem blob → F4 cleanup →
  F5 selo+CLOSE. PJ fora desta instância.

### F2 — ENDEREÇO CIVIL PF: FRONTEND ProfilePersonal → ROTA CANÔNICA ✅ (2026-06-01)
- Frontend-only, 2 arquivos: novo api/residenceAddress.ts (get/putResidenceAddress → GET/PUT /profile/residence-
  address) + Profile.tsx. HEAD origem f32dba8c. Zero backend/migration/PJ/Companies/CPF/gender/financeiro. Blob
  preservado (cleanup=F4).
- Save: handleSavePersonal removeu metadata.address do payload de updateProfile; grava endereço via
  putResidenceAddress APÓS updateProfile (CEP-âncora; só se há CEP; erro de endereço NÃO mascarado — propaga
  "Erro ao salvar endereço"). cpf/gender intocados. Load INALTERADO: lê coreProfile.addresses (F1 já fez vir do
  Location Core + enriquecimento city/state do blob); trocar p/ GET cru perderia city/state na exibição.
- Provas: frontend typecheck0; PUT /profile/residence-address (fluxo F2) 200 source=UX_INPUT, Location Core
  atualizado; blob metadata.address NÃO criado/atualizado (false→false). Greps: sem metadata.address em
  Profile.tsx; usa putResidenceAddress. Gates OK; critical_new=0/total=20. DT-PERSONAL-ADDRESS OPEN. Fila: F3
  readers sem blob (remover enriquecimento transitório) → F4 cleanup → F5 selo+CLOSE.
