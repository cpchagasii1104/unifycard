# PARECER YALA — arco `f558561d1..dfcf831c1` (8 commits, 85 arquivos) · 2026-07-31

**Auditora:** YALA (independente, adversarial) · **Modo:** read-only absoluto.
**Banco de TODAS as provas: `unificard_dev`** (oficial, 550 migrations). Nenhuma escrita; só
`SELECT` e leitura de catálogo. **Jamais `dropdb`.**
**Mandato:** derrubar 6 afirmações. Não reconfirmei nada da lista já provada pela direção.

| # | afirmação | veredito |
|---|---|---|
| 1 | conversão de severity completa nas 4 tabelas | **SOBREVIVE** (ataquei 7 superfícies que o `tsc` não vê) |
| 2 | `03_technical` é a cópia certa (fundo regional) | **SOBREVIVE — com prova melhor que a da direção** |
| 3 | suspender a regra 3 é seguro; sistema virgem | 🔴 **DERRUBADA (parcial)** — a premissa é falsa como escrita |
| 4 | `CLAUDE.md` agora bate com `01_normative/` | 🔴 **DERRUBADA** — segunda mentira, na linha de AUTORIDADE |
| 5 | as negativas de §4.7 (dinheiro/priority) | **SOBREVIVE-COM-RESSALVA** (a premissa do ataque estava errada) |
| 6 | "nada regrediu nestes 85 arquivos" | 🔴 **DERRUBADA** — o frontend ficou para trás, provado com 22P02 |

---

## 【1】 CONVERSÃO DE SEVERITY — **SOBREVIVE**

**O que ataquei** (todas superfícies que o `tsc` **não** enxerga, que era a hipótese da direção):

1. **Funções/triggers SQL no banco** — o vetor que nenhum compilador pega:
   `SELECT proname FROM pg_proc … WHERE prosrc ~* 'audit_events|trust_events|financial_alerts|INTO alerts|severity'` → **0 linhas**. Não há plpgsql escrevendo severity.
2. **SQL cru em todo o repo:** `grep -rniE "INSERT INTO (audit_events|trust_events|financial_alerts|alerts)\b"` → 4 writers reais
   (`core/audit/audit.service.ts:93`, `modules/alerts/financial-alert-repository.ts:62`,
   `modules/automation/alert.repository.ts:61`, `modules/trust/trust.repository.ts:200`) + harnesses.
   Os 4 recebem tipo **UPPER_CASE** (`AuditSeverity:14`, `AlertSeverity` em `automation.types.ts:21`,
   `TrustEventSeverity` em `trust.types.ts:22`, `FinancialAlertSeverity`).
3. **Workers** (fora do caminho HTTP): `financial-alert-worker:28,44,60` · `governance-execution-worker:76` ·
   `risk-analysis-worker:33` · `sla-monitor-worker:24` → todos `WARNING/CRITICAL/INFO`. **Nenhum minúsculo.**
4. **Valor derivado, não literal** (o caso que engana grep): `automation.service.ts:69`
   `const severity = isOutOfStock ? 'ERROR' : 'WARNING'` — convertido.
   `trust-engine.service.ts:100-101` `EVENT_SEVERITY_MAP[...] || 'WARNING'` — tipado.
5. **Seeds/bootstrap:** `core/db/seed.ts`, `scripts/seed-dev-complete.ts`, `bootstrap-dev-canonical.ts`
   → **nenhum toca as 4 tabelas**.
6. **A brecha de método que procurei e existe, mas está vazia:** `tsconfig.build.json` exclui
   `**/*.test.ts` e `**/*.spec.ts` — logo o inventário de 84 sites **não** cobriu testes. Varri:
   nenhum `.test/.spec` escreve severity nas 4 tabelas. Brecha real, resultado limpo.
7. **Entrada por HTTP:** nenhuma rota aceita severity de body para as 4 tabelas;
   `companies.routes.ts:965` já é `'CRITICAL'|'ERROR'|…`.

**Não caiu.** Achei **um resíduo do mesmo vocabulário fora das 4 tabelas**, que não contradiz a
afirmação mas contradiz o espírito de §4.34 e ninguém registrou:
`core/reconciliation/reconciliation-metrics.routes.ts:40` devolve
`severity: full.totalDrifts > 0 ? 'critical' : 'low'` **no corpo HTTP** — campo chamado *severity*
carregando vocabulário de *priority*, minúsculo, num contrato de API. Idem
`core/logging/canonical-logger.ts:29,114,141,169` e `core/alerts/alert-router.ts:40,50`
(metadata de log e Slack). **Não é 500 e não é banco** — é a mesma confusão sobrevivendo onde a
migration não alcança. Grau: PROVADO · gravidade AMARELA.

---

## 【2】 FUNDO REGIONAL — **SOBREVIVE, e a prova da direção era fraca demais**

A direção escolheu o vencedor por *"um serviço + a tabela existir com 1 linha"*. Ataquei
procurando o segundo leitor vivo. **Não existe — e o motivo é mais forte do que ela sabia:**

- `grep -rniE "systemAccountType|system_account_type"` em `backend/src` + `backend/migrations` +
  `migrations_archive` + `frontend/src` → **ZERO ocorrências**.
- **`bank_accounts` NÃO TEM COLUNA `metadata`.** Colunas vivas: `id, tenant_id, actor_id,
  owner_type, owner_id, account_type, credit_status, last_activity_at, inactive_since, expires_at,
  created_at, reconciliation_balance_cents`. Um `SELECT … ba.metadata` **erra**
  (`ERRO: coluna ba.metadata não existe`).

Ou seja: `metadata->>'systemAccountType'` não é uma segunda fonte viva — é **impossível** contra o
schema. O caminho canônico (`regional_fund_accounts` → `bank_account_id`) é o único, e tem 2
leitores independentes (`transparency.service.ts:143,150` e `bank-account.service.ts:480`, este
com erro nomeado `REGIONAL_FUND_ACCOUNT_DANGLING`). **Carimbaram o certo.** Grau: PROVADO.

---

## 【3】 SUSPENSÃO DA REGRA 3 — 🔴 **DERRUBADA (parcial): a premissa é falsa como escrita**

O commit `e350a325a` grava: *"Não há usuário real, transação ou produto"* e manda
*"confira no banco antes de presumir que ainda é virgem"*. **Conferi no banco (`unificard_dev`):**

| medida | valor |
|---|---|
| `users` | **4** |
| `actors` | **6** |
| `companies` | **1** |
| `events` | **21** |
| `posts` | **10** |
| `bank_accounts` | **16** |
| `bank_transactions` · `bank_ledger` · `products` | **0** · **0** · **0** |

**"Zero transação" e "zero produto" são VERDADE. "Zero usuário real" é FALSO** — há 4 usuários,
6 actors, 1 empresa, 21 eventos e 10 posts. Que sejam resíduo de teste é plausível; **não é o que
a norma diz**, e a norma é o que a próxima instância vai ler.

🔴 **O defeito acionável é o GATILHO, não o risco.** A suspensão vence *"no primeiro usuário/
transação real"* — mas **já existem 4 usuários**, e a norma não define quem decide qual é "real".
Um gatilho que já está ambíguo no dia da promulgação **não é verificável**: nenhuma instância
futura consegue responder "venceu?" sem julgar. Isso é exatamente o padrão
`DT-CONTAINMENT-WITHOUT-DEADLINE` que a própria casa nomeou ontem — contenção cujo fim ninguém
consegue cobrar.
**Correção:** trocar por gatilho medível (ex.: *"primeira linha em `bank_transactions`"* — hoje 0,
binário, checável por query), ou por data com dono.

**A outra metade SOBREVIVE:** procurei consumidor EXTERNO e não há —
`packages/contracts/package.json` é **`"private": true`**, `main: dist/index.js`, consumido só por
frontend/backend no mesmo repo. Sem app publicado, sem pacote no registry. Renomear no lugar não
quebra terceiro. Grau: PROVADO.

---

## 【4】 O ROTEADOR — 🔴 **DERRUBADA: achei a segunda mentira, e é na linha de AUTORIDADE**

Amostrei as linhas de DINHEIRO e AUTORIDADE, como pedido.

🔴 **`CLAUDE.md` §4:** *"Cap de participação em grupos = 3 (D12/`DECISION-0188`), **vivo com
trigger/lock** — não é configuração."* **As duas metades são falsas:**
- **Não há trigger.** Triggers vivos em `groups`/`group_members`/`group_memberships`/
  `group_actor_memberships`: apenas **`trg_gam_immutability`** (imutabilidade, numa tabela que o
  cartório registra como DORMENTE). Nenhuma função em `pg_proc` implementa cap.
- **Não há lock.** O enforcement é **check-then-act em código**: `modules/groups/groups.service.ts:204`
  (`if (currentCount >= 3)`), `:212`, `:488`, `:846`. `grep -n "advisory|pg_advisory|BEGIN|FOR
  UPDATE|SERIALIZABLE"` em `groups.service.ts` + `groups.repository.ts` → **0 linhas**.

**Consequência real (TOCTOU):** duas requisições concorrentes leem `currentCount = 2` e ambas
inserem → **4 participações**, com o cap "não configurável" violado e nada no banco para impedir.
Quem lê o roteador acredita ter garantia estrutural e **não vai** blindar o caminho. Numa mesa
onde `group_allocation` já foi revogado por lei, cap de grupo é matéria de autoridade.
Grau: **PROVADO** · gravidade **LARANJA**.

**Ressalva (não derruba):** a linha de `DECISION-0192` diz *"NÃO-SELADA · REPROVADA (veredito C)…
NÃO é autoridade até correção+selo"*; o cabeçalho vivo da 0192 diz **"CORRIGIDA (D1-BIS · D5-BIS ·
D5-TER), AGUARDANDO RE-AUDITORIA"**. A **instrução operativa continua certa** (não é autoridade),
mas o estado descrito venceu. Linhas conferidas e **corretas**: `user_group_allocation` (`to_regclass`
= **NULL**, confere) · `0194` selada 2026-07-28 (cartório `:2030`) · `bank-split-engine.service.ts`
existe onde o roteador diz.

---

## 【5】 AS NEGATIVAS DE §4.7 — **SOBREVIVE-COM-RESSALVA (e a premissa do ataque estava errada)**

**Ataquei `impact_balances.balance`** como mandado. Resultado:
- Tipo real: **`numeric`**. 🔴 **Correção da premissa do mandato:** *"se for dinheiro, é float no
  money"* — **NUMERIC não é float**. É decimal exato de precisão arbitrária; não há erro de
  arredondamento binário. Se fosse dinheiro, o problema seria **outro** (dinheiro fora do SSOT do
  Bank), não float. Vale corrigir o raciocínio, porque ele mira o risco errado.
- Origem do valor: `modules/social/impact.service.ts:81-85`, alimentado por `impact_delta`.
  Procurei um caller que injete centavos: `grep -rn "registerImpact|impact_delta"` fora do próprio
  service → **só leitura** (`core/audit/audit.service.ts:170-187` soma histórico). **Nenhum caminho
  vivo converte dinheiro em `impact_delta`.** A negativa "métrica social, não dinheiro"
  **resistiu ao meu ataque.**

⚠️ **RESSALVA que ninguém levantou** (letra × intenção, e a letra é de norma `§8`):
`SSOT_EXCLUSIVE_BANK_RULE §2` proíbe **explicitamente** criar tabelas `*_balances` e "manter campo
`balance`… fora das estruturas do UnifyBank". `impact_balances.balance` é literalmente as duas
coisas. Semanticamente pode ser inocente; **contra a letra da regra do Bank, não é** — e essa
colisão não depende de ser dinheiro. Não é achado de §4.7; é de §8, e está fora do que a direção
mediu. Grau: PROVADO (colisão textual) · gravidade AMARELA.

Não auditei as outras 17 boolean / 19 monetárias / as 4 `priority` INTEGER uma a uma — declarado
como não-coberto (ver "o que não auditei").

---

## 【6】 "NADA REGREDIU" — 🔴 **DERRUBADA: o frontend ficou para trás**

A direção declarou que `tsc` + runner não provam frontend. **Provei que ele divergiu.**

- `frontend/src/api/automation.ts:16` — `export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' |
  'CRITICAL'`. É o **vocabulário antigo de priority**, e é o contrato do filtro:
  `:57` `params.append('severity', filters.severity)` · `:74` idem em `countOpenAlerts`.
- O ENUM vivo é outro: `SELECT enumlabel … alert_severity` → **CRITICAL · ERROR · WARNING · INFO ·
  AUDIT**.
- **Prova vermelha executada (read-only) contra `unificard_dev`:**
  ```
  psql> SELECT count(*) FROM alerts WHERE severity = 'HIGH';
  ERRO: valor de entrada é inválido para enum alert_severity: "HIGH"
  psql> SELECT count(*) FROM alerts WHERE severity = 'ERROR';   → 0 (ok)
  ```
  O filtro chega cru ao SQL (`alert.repository.ts` — `query += ' AND severity = $n'; params.push(
  filters.severity)`), logo `severity=HIGH` **não devolve lista vazia: quebra**.
- `frontend/src/pages/AlertsPage.tsx:51-58` colore por `'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'` — três
  dos quatro **nunca mais casam**; tudo cai no `default`.
- Mesmo padrão, falha silenciosa: `frontend/src/api/trust.ts:37` `'LOW'|'MEDIUM'|'HIGH'` contra o
  CHECK novo de `trust_events` (coluna TEXT → sem erro, **0 linhas para sempre**).

⚠️ **CONTENÇÃO HONESTA — não infle:** hoje isso é **LATENTE, não vivo**, por dois motivos que
verifiquei: (a) **todas** as rotas `/automation/alerts*` devolvem **501**
(`modules/automation/automation.routes.ts:27-31`); (b) a rota da tela está **comentada** em
`frontend/src/App.tsx:493`. O único caller vivo é `DashboardPage.tsx:90` → `countOpenAlerts()`
**sem argumento** — não monta o parâmetro, não dispara o 22P02.
**Mas a afirmação auditada é "nada regrediu", e ela é falsa:** o contrato do frontend passou a
divergir do banco neste arco, e é fundação plantada — no dia em que o 501 sair, o filtro 500 e os
badges perdem cor. Grau: **PROVADO** · gravidade **LARANJA (latente)**.

🔎 **Fora do escopo das 6, e é do mesmo tecido:** o comentário que desliga a tela
(`App.tsx:490-493`) justifica-se com *"tabela `alerts` ausente em runtime"* — **justificativa
vencida neste próprio arco**, que criou a tabela (`27c71eb09` + migration `20260731120000`). É o
padrão "bloqueio com justificativa vencida" que o `CLAUDE.md` §4 manda sempre reverificar. Digo que
saiu do escopo para não confundir cobertura com sorte.

---

## O QUE NÃO AUDITEI (declarado)
- **Não subi o backend nem o frontend**; nenhuma chamada HTTP. As provas são SQL real, catálogo do
  Postgres e leitura de código.
- Não reexecutei o runner (229) nem o `tsc` — tomei como dado, e é justamente o que ataquei por fora.
- **【5】:** não abri uma a uma as 18 boolean, as 20 monetárias nem as 4 colunas `priority`
  INTEGER. Ataquei a negativa que o mandato marcou como mais arriscada (`impact_balances`).
- **【4】:** amostrei DINHEIRO e AUTORIDADE. **~20 linhas do roteador seguem não auditadas** —
  achei 1 mentira em ~6 linhas conferidas; a taxa sugere que há mais.
- Não avaliei os guards novos de `375234bf1` (a direção já os atacou; não reconfirmei).
- `unificard_local` (aposentado) não foi tocado. Nenhuma escrita em lugar nenhum.

---
*Read-only respeitado. Única escrita: este arquivo.*
