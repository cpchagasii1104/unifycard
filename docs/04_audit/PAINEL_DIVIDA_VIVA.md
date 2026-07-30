# PAINEL ÚNICO DE DÍVIDA VIVA — **O PLACAR**

> ## 🔴 ESTE É O PLACAR ÚNICO. LEIA ISTO PRIMEIRO, ATUALIZE ISTO SEMPRE.
>
> **Decisão de Clayton, 2026-07-30.** Existiam **nove** arquivos rastreando dívida, e eles
> divergiam. O que se declarava obrigatório (`dividatecnica.md`) tinha placar de **06/07**
> dizendo *163 guards* quando já eram **227** — e três sessões seguidas fecharam dívida sem
> atualizá-lo, inclusive a direção, quatro vezes num único dia.
>
> **Um arquivo por papel, sem sobreposição:**
>
> | papel | arquivo |
> |---|---|
> | **PLACAR** — o que está vivo HOJE, cabe na cabeça | 🔴 **este arquivo** |
> | **CARTÓRIO** — história append-only, causa-raiz, provas | `REMEDIATION_DT_LOG.md` (topo = recente) |
> | **HISTÓRICO** — evidência antiga, não é placar | `dividatecnica.md`, `PLANO_ZERAGEM_DT.md` |
> | **PLANO** — estratégia das 6 fases | `PLANO_RECUPERACAO.md` |
>
> **Nome sem data, de propósito.** A versão anterior chamava-se `..._2026-07-29.md`, e nome
> datado em documento vivo é convite para a próxima instância criar um segundo. **Nunca
> versione este arquivo por nome — atualize-o.**
>
> **Toda fatia que fechar dívida atualiza o PLACAR abaixo e o REGISTRO DE SESSÕES.** Não é
> burocracia: é o que impede que a próxima instância meça o sistema por um número de 24 dias
> atrás.

## 📊 PLACAR — última medição **2026-07-30**, toda ela de 1ª mão pela direção

| métrica | valor | como foi medido |
|---|---|---|
| `validate:regression-guards` | ✅ **227 COMMANDS OK** · drift **0** | `npm run`, banco `unificard_dev` |
| `typecheck` backend | ✅ **0 erros** | `tsc -p tsconfig.build.json --noEmit` |
| Gate `schema-coherence` | ❌ **FAIL 1794** (376 BLOCKER · 1418 CORRUPTOR · 53 DEBT) | **fora do runner e do CI** — ver decomposição |
| `schema_migrations` (`unificard_dev`) | **548** aplicadas · 549 arquivos · 1 skip governado | query direta |
| Banco oficial | **`unificard_dev`** · trava fail-closed viva | `6414b3404` |
| `unificard_local` | **aposentado**, ainda vivo só pelo catálogo de veículos (16 marcas) | 334 tabelas · 547 migrations |

⚠️ **Números que NÃO foram remedidos nesta sessão** (não confie sem reconferir): contagem de
DTs abertas · `bank_ledger`/`transactions`/`splits` = 0 · estado da PORTA-01.

## 🗓️ REGISTRO DE SESSÕES — o que cada fatia mudou no placar

**2026-07-30 · 6 commits, 3 DTs fechadas, nenhuma selada.**

| commit | o que era | efeito no placar |
|---|---|---|
| `6414b3404` | ausência de `EXPECTED_DATABASE_NAME` valia como **permissão** para migrar qualquer banco | runner 225 → **226** |
| `090711185` | **proteção de força bruta não existia desde a gênese** — `auth_rate_limit_logs` nunca criada, `catch` devolvia 0 | runner 226 → **227** · migrations 547 → **548** |
| `01c54f53e` | gate escondia a própria lista (`slice(0,5)`); 165 acusações eram bugs dele | gate 1928 → **1802** |
| `c245b6112` | decomposição: as 1928 são **um commit de fevereiro**, não 136 problemas | — |
| `25aa17223` | +6 classes de bug do gate; a correção ingênua teria **cegado 220 escritas** | gate 1802 → **1794** |
| `d1e74cc62` | nove rastreadores → um placar | — |
| `3496f57d4`+4 | `DECISION-0195` — canal unificado de denúncia (17 cláusulas, **não-selada**) | — |
| (este) | balde "sem definição em lugar nenhum" **fechado**: 47/47 adjudicados | — |

**🔴 Categoria nova, e é a que a direção mais quer vigiar: `SUBSTRATO SUBSTITUÍDO`.** Não é
código morto — **é função viva chamando o nome errado**. Achados hoje: `accounts`/`transactions`
(o vivo é `bank_accounts`/`bank_transactions`) · `payout_transactions`/`payment_intent_splits`
(o vivo é `payment_transactions`/`bank_splits`) · `reputation_scores`/`actor_scores`/`reviews`
(o vivo é `actor_reputation`/`trust_score_snapshots`). **Parece fantasma e não é.** Quem
"limpa" apagando o código apaga funcionalidade; quem religa sem trocar o nome liga no vazio.

**Padrão das três dívidas fechadas hoje, que vale mais que os números:** nenhuma gritava.
Ausência de env var passava calada · `catch` devolvia zero calado · `slice(0,5)` cortava
calado. **O sistema não estava mentindo — estava mudo.** É por isso que *"guard que nunca
falha é decoração"* é lei aqui, e por que cada guard desta sessão foi atacado por ângulo
independente antes de ser aceito.

---

## Origem deste documento

**Produzido pela instância especialista DÍVIDAS TÉCNICAS.** Verificação de 1ª mão da direção: `DT-RBAC-V2-…-STRUCTURALLY-DEAD` reconfirmado (cadeia até `RETURN FALSE` na migration, 59 arquivos de rota usando `requirePermission` hoje).

> **POR QUE ESTE PAINEL EXISTE:** o `PLANO_RECUPERACAO.md` abre com o diagnóstico *"o cartório virou memória, não painel executivo"* — sendo append-only, a mesma frente aparece várias vezes com estados diferentes. Este arquivo é o corte transversal que faltava. **É índice, não fonte:** a verdade de cada item continua no cartório e nas normas.

---

## 🔴 VIVA E DEMONSTRADA — alguém provou que quebra hoje

| ID | O que é | Tipo | Prova |
|---|---|---|---|
| **Gate `schema-coherence` nunca verde** | 🔄 **remedido 2026-07-30: 1928**, não 1978. `scripts/validate-schema-code-coherence.mjs`, cabeado em `backend/package.json:146`, **fora do runner e do CI**. 🔴 **O gate ESCONDE a própria lista** (`slice(0,5)` + *"e mais N"*, linhas 853-874) — não há flag, env nem modo que mostre tudo; auditá-lo exige reescrever o script. 🔴 `CORRUPTOR` reprova igual a `BLOCKER` (`:903-905`), o nome engana. Composição: **1241 (64%) em `backend/src/scripts/`** (harnesses, não superfície viva) · ~80 são **bugs do próprio parser** (`information_schema`, CTE) · ~600 candidatos reais. **"Religar custa ~zero — só wiring" é FALSO** | **CAUSA-RAIZ** de C3/C13 seguirem vivas sem ninguém notar | medido pela direção 2026-07-30 |
| ~~**`DT-RBAC-V2-REQUIRE-PERMISSION-DECORATOR-STRUCTURALLY-DEAD`**~~ | 🔄 **RECLASSIFICADO 2026-07-30 → DESENHO, NÃO DÍVIDA.** Ver seção dedicada abaixo | — | — |
| **`DT-SOCIAL-IMPACT-BALANCE-UPSERT-42P10`** | `ON CONFLICT` com 3 colunas contra UNIQUE de 2 → **erra sempre desde a gênese**, erro engolido, tabela permanentemente vazia | CAUSA | cartório `:1025-1026` |
| **`event_custody` sem tabela** | Service faz `INSERT` em tabela inexistente → 500 garantido em qualquer caminho vivo de custódia | CAUSA | cartório `:114` |
| **Painel econômico A-1** | Indicador **verde** com policy só de valor fixo — FE e BE pulam a soma quando `!hasBpsLine`. Policy que paga mais que o total publica em silêncio | CAUSA | cartório `:193-221` |
| **`C3-actors-insert-fora-writer`** | `identity.service.ts:313` faz `INSERT INTO actors` fora do writer canônico. Alcance hoje **baixo** | CAUSA | `allowlist:8-16` |
| **`C13-bank-reads-fora-modulo`** | ~15 arquivos leem `bank_*` fora de `modules/bank`. Escopo **CRESCEU** em 28/07 | CAUSA | `allowlist:18-26` |
| **`F-EVENT-CREATION-CONTRACT-SWEEP`** | Rota `/events/:id/economic` **não existe**; `event_type` é órfão de escrita | SINTOMA | cartório `:99-118` |
| 🆕 **`DT-REPORTS-PREFIX-COLLISION`** | **`/reports` registrado 2×**: `core/reporting` (denúncia) em escopo **PÚBLICO** (`app.builder.ts:257`) e `modules/reports` (financeiro) em **protectedScope** (`:716`). Não quebra o boot hoje, mas `GET /reports/:id` público casa com qualquer segmento | CAUSA | medido 2026-07-30 |
| 🆕 **`DT-REPORTING-CHANNEL-DEAD-PUBLIC-SCOPE`** | Canal de denúncia **100% morto**: fora do `protectedScope`, `preHandler` exige `req.user`/`req.tenant` que só existem lá → **401 sempre**. Atrás dele, 3 tabelas que nunca existiram | CAUSA | `DECISION-0195` (não-selada) |

## 🧨 A CONTENÇÃO QUE SUSTENTA O PESO — `actor_has_permission` e a FASE 6

**Verificado de 1ª mão pela direção em 2026-07-30, contra o `unificard_dev` e o código vivo.**

A função SQL `actor_has_permission` no banco oficial faz **`RETURN FALSE` incondicional**.
Cadeia completa, cada elo lido:

```
fastify.requirePermission([...])        plugins/rbac.plugin.ts:145
  → rbacService.actorHasAllPermissions  core/rbac/rbac.service.ts:165
    → actorHasPermission                core/rbac/rbac.service.ts:173
      → SELECT actor_has_permission()   core/rbac/rbac.service.ts:124
        → RETURN FALSE  (incondicional) unificard_dev, função viva
          → throw forbidden             plugins/rbac.plugin.ts:181
```

**Alcance medido: 176 chamadas em 44 arquivos de rota** (fora de `scripts/`).

🔄 **ISTO É DESENHO, NÃO DÍVIDA.** A própria função documenta: *"FAIL-CLOSED: sem
implementação real de permissões, nenhuma permissão é concedida"*, citando
`AUTHORITY_PRECEDENCE.md §4.4` e nomeando a **FASE 6** como quem substitui. Pela regra do
vocabulário de dívida (*dormente por decisão não é dívida — procure a decisão antes*), a
classificação anterior como CAUSA/dívida viva estava **errada**. Corrigido aqui.

🧨 **MAS É CONTENÇÃO QUE SUSTENTA O PESO, E ISSO É O QUE IMPORTA.** Enquanto ela nega tudo,
qualquer defeito atrás daquelas 44 rotas fica **mascarado**. Caso concreto e provado:
`modules/bank/bank-reconciliation-history.repository.ts:87` faz `INSERT INTO
bank_reconciliation_history` — **tabela que não existe** (0 em `pg_class`, zero
`CREATE TABLE` nas migrations) — alcançável por
`core/unifybank/bank-balance-consolidation.routes.ts:167`, registrada em
`unifybank.module.ts:62` sob `/finance`, exigindo `admin:view_consolidated_balance`, que
**NÃO está** em `PORTA_HOLD_KEYS`. Hoje dá 403 antes do 500. **No dia em que a FASE 6
entregar o RBAC real, isso vira 500 vivo** — junto com o que mais estiver atrás das outras
43 rotas, que ninguém inventariou.

⚠️ Agravante: três harnesses e2e substituem `requirePermission` por um no-op que **libera
tudo** (`validate-pipeline-e2e-events-reputation-locations-ghost-containment.ts:141`,
`...-social-work-payment-ownership.ts:76`, `...-reports-transfers-sla-representation.ts:54`).
É o **fixture que exclui o problema por construção** — a suíte é estruturalmente incapaz de
pegar defeito de autorização nessas rotas.

🔴 **REGRA OPERACIONAL:** **ninguém encosta na FASE 6 do RBAC antes do
`F-SCHEMA-GHOST-REACHABILITY-SWEEP`.** Implementar o RBAC real sem saber o que está atrás
daquelas 44 rotas acende tudo de uma vez, em produção, sem inventário.

## 🟠 VIVA MAS CONTIDA — e **por quê** está contida

**Cluster PORTA-1** — contido por **ledger vazio + firewall default-OFF**, *não* por desenho à prova de semeadura. Dentro: sink `executePayment` sem firewall interno (4 callers) · **Core de Aprovação Financeira** com MODEL vivo e EXECUTION HOLD, embora `DECISION-0128` o exija para todo movimento · split-engine stub · **≥8 callers do sink sem firewall** · e o vão `DECISION-0194` selada × código (sem trava de base única, motor ignora `applies_to`, allowlist vazia, agrupador multi-base vivo).

**`DT-BANK-SPLIT-ENGINE-LEGACY-NATIONAL-FUND-LANDMINE`** — 70/3/10/17 num fundo nacional único, sem território. Contido por **tripwire guard**, não por decisão.
**`DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — ⚠️ **é o MESMO defeito que `C13`**, rastreado em dois sistemas.
**`H3` regional-fund-governance** — motor de voto lê fundo nacional legado, não os territoriais. **O comentário MENTE:** alega filtrar por região e a query não filtra.
**`neighborhood` como base de fundo** — HOLD 501 com justificativa **parcialmente vencida** (N3 selou os 75 bairros), mas o resolver nunca foi religado.
Mais: `DT-ACTOR-EFFECT-INBOX-PROJECTOR-UNSUBSCRIBED` · `DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST` · `DT-GROUP-EVENTS-BINDING-DRIFT-SILENT-FAILURE` · `DT-EVENTS-SPRINT76-TICKET-SALE-REPOSITORY-SCHEMA-DRIFT` · `DT-EVENT-ENGINE-NAMING-CONVERGENCE-RESIDUAL`.

## ⚪ DORMENTE POR DECISÃO — **não é dívida**

Migration N1 `20260713140000` (`IGNORED_MIGRATIONS`) · `group_actor_memberships`/`group_institutional_bindings` (D9.2-A selada; cutover = D9.2-B) · **4e** `tax_reserve` (firewall OFF, caller 0) · `economic/v2` 501 (`DECISION-0190` selada) · **B-CITY-2** (aguarda GATE registrado) · `/cta` + `social_ledger` (hard-block por desenho) · semear saldo (Clayton: *"só mecanismo por ora"*) · L2.4 (adiada por Clayton) · `DECISION-0192/0193` (não-seladas — doutrina pendente, não dívida de código).

## ✅ JÁ RESOLVIDAS — não reabra

**2026-07-30 · `DT-AUTH-RATE-LIMIT-FAIL-OPEN-SUBSTRATE-AUSENTE`** — `auth_rate_limit_logs`
**nunca existiu**; o `catch` de `countByKey` engolia o 42P01 e devolvia 0 → `allowed:true`
sempre. Login, registro, check-cpf, check-referral, webauthn e refresh estavam **sem
proteção de força bruta**, em rota **pública** (não passa por `requirePermission`, nada os
continha). Migration `20260729160000`, colunas em `attempted_at` (o código usava
`attemptedAt` não-quotado, que Postgres dobra), `catch` agora **loga alto** mantendo
fail-open, guard `audit-auth-rate-limit-substrate.mjs` no runner. **Prova comportamental
verificada de 1ª mão pela direção: HTTP 429 na 6ª tentativa**, 5 linhas gravadas, harness
efêmero PASS 6/6, zero resíduo. ⚠️ Tabela **sem RLS de propósito** — com RLS a contagem
voltaria 0 sob `pool` cru e o fail-open continuaria invisível; razão gravada no
`COMMENT ON TABLE`.

**2026-07-29 · `DT-OFFICIAL-DATABASE-LOCK-FAIL-CLOSED`** (commit `6414b3404`) — ausência de
`EXPECTED_DATABASE_NAME` era tratada como permissão. Agora recai em `unificard_dev` e
aborta. Fechou também a porta deliberada (`setup-local-demo-db.mjs` recusa) e o convite por
escrito (`RODAR_LOCAL.md`).

`DT-EPHEMERAL-MIGRATION-PROFILE-UNGOVERNED` **(a)+(b)** — ⚠️ **(c) segue OPEN e é o que permite (a)/(b) reincidirem** · **`C4`** paga (⚠️ data real **28/07**, não 29/07 — a instância corrigiu o mandato da direção) · **selo falso nº1** re-fechado de verdade (`3ca1df864`) · **selo falso nº2** fechado via `K_pe_7` — ⚠️ **sub-caso (b) `bps=10000` + linha fixa SEGUE aberto**, atrás do motor byte-pinado · `DT-EVENT-PUBLISHED-UPDATE-ALLOWLIST-CASE-MISMATCH` · `DT-EVENT-CREATE-TIMEZONE-DEFAULTS-UTC` · `DT-EVENT-GUARDS-UNWIRED-FROM-RUNNER`.

## ⏰ PRAZO

**Nenhum item ativo vencido hoje.** `C3`/`C13` com prazo fresco (2026-09-30, owner Clayton).
🔴 **PADRÃO DE RISCO A VIGIAR:** o gate que cobraria esse prazo **não está no runner nem no CI**. Nada cobra automaticamente — é o mesmo mecanismo que deixou 10 entradas vencerem 57–89 dias sem ninguém notar.

## 🔗 MESMA CAUSA, NOMES DIFERENTES

1. **`C13` ≡ `DT-UNIFYBANK-CORE-DIRECT-BANK-LEDGER-SQL`** — mesmo defeito, dois sistemas de rastreio (JSON × cartório). **Fundir ou linkar.**
2. **`C4` ≡ `DT-BANK-BALANCE-BY-REGION-READMODEL-METADATA-DESALINHADO`** — mesma coisa, duas etiquetas. Confirmar se o header da segunda foi re-carimbado.
3. `AUDIT-004` **é** a 6ª ocorrência que `ROOT-004` previa — agrupamento por causa-raiz funcionando (`§B.10`), não duplicata.
4. **Processo, não código:** os dois selos falsos compartilham a mesma causa — selo sem reprodução adversarial independente e sem entrada cartorial da correção.

---

## ⚠️ NÃO CLASSIFICADO (declarado, não inferido)

`REMEDIATION_DT_LOG.md` linhas **~1460–21654** (~20 mil) não lidas narrativamente. Três clusters densos de `DT-*` nomeados: **(a)** RLS/tenant-isolation · **(b)** ERP/CRM/marketplace · **(c)** payout E2E (aparentam CLOSED pelos cabeçalhos, não confirmado). A memória sugere que (a) e (b) já têm frentes fechadas — **NÃO reverificado**. Painel 100% completo exige passada dedicada a partir da linha 1461.

Também fora: `dividatecnica.md` linhas 300–2534.
