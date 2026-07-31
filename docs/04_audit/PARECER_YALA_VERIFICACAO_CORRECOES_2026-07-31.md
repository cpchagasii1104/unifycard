# PARECER YALA — verificação das correções (`4c9966793`) + varredura da família enum×TS · 2026-07-31

**Auditora:** YALA (independente) · **Modo:** read-only absoluto.
**Banco de TODAS as provas: `unificard_dev`** (oficial). Só `SELECT` e catálogo. Zero escrita.
**Objeto:** as 3 correções que a direção aplicou após o parecer anterior, atacadas como trabalho
novo — esta casa tem padrão documentado de **plantar defeito ao corrigir**. Mais a varredura da
família que a direção abriu com `alert_status`.

---

## PARTE A — AS CORREÇÕES DE `4c9966793` RESISTEM? (2 de 3 limpas)

### A1 · `CLAUDE.md`, cap de grupos — ✅ **CORREÇÃO SÓLIDA, e a afirmação NOVA também é verdadeira**
A correção não se limitou a apagar a mentira: ela **introduziu uma afirmação nova** (*"o único
UNIQUE de `group_members` é `(tenant_id, group_id, user_id)`"*). Afirmação nova em commit de
correção é exatamente onde esta casa erra, então **remedi de forma independente**:

```
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='group_members'::regclass;
 group_members_pkey                            | PRIMARY KEY (id)
 group_members_tenant_id_group_id_user_id_key  | UNIQUE (tenant_id, group_id, user_id)
SELECT indexname FROM pg_indexes WHERE tablename='group_members';   → apenas esses dois
```
**Confere exatamente.** Não há terceiro índice, não há constraint escondida. A linha agora diz o
oposto do que dizia, nomeia o TOCTOU e termina em instrução acionável (*"a garantia não existe —
não presuma"*). Nada a corrigir.

### A2 · Gatilho da regra 3 — ✅ **agora é medível**, mas 🔴 **A PREMISSA FALSA SOBREVIVEU NO CORPO**
O gatilho novo (`SELECT count(*) FROM bank_transactions` → hoje **0**, binário, checável) resolve
o defeito que apontei. **Mas a correção foi feita por NOTA, e o corpo normativo não foi tocado:**

`docs/01_normative/PLANO_CORRECAO_NOMENCLATURA.md:47` — texto vivo, hoje, uma linha ACIMA da nota:
> *"🔴 **SUSPENSA ENQUANTO O SISTEMA ESTIVER VIRGEM** (Clayton, 2026-07-31). **Não há usuário
> real**, transação real nem produto cadastrado…"*

**`users = 4`, `actors = 6`, `companies = 1`, `events = 21`, `posts = 10`** — a frase segue falsa,
em `01_normative/`, e é a primeira coisa que o leitor encontra. A retificação está **abaixo**, num
bloco `>`, e só é lida por quem continua.

Isto é **literalmente a armadilha da `DECISION-0191`** que o índice desta casa já cataloga —
*"o arquivo mente sobre o próprio status para quem o abre direto"* — reproduzida no mesmo dia em
que a auditoria a apontou. **Correção exigida:** riscar a frase no corpo (`~~Não há usuário
real~~ → não há transação nem produto; há 4 usuários de teste`), não só anotar embaixo.
Grau: **PROVADO** · gravidade **AMARELA** (documento, não runtime — mas é norma).

### A3 · Registro do parecer anterior — ✅ commitado íntegro (212 linhas), sem edição do conteúdo.

---

## PARTE B — A FAMÍLIA ENUM(minúsculo) × TS(MAIÚSCULO): varri as 5, e a terceira é a pior

Varredura completa dos enums do banco oficial com labels minúsculos:

```
SELECT t.typname, string_agg(e.enumlabel, ', ') … HAVING … ~ '[a-z]'
 alert_status         | open, ack, resolved
 credit_status        | active, inactive, expired, orphan
 evasion_pattern_type | fragmentation, persona_rotation, …
 service_order_status | draft, confirmed, in_progress, completed, seller_pending, release_approved, funds_released, cancelled
 transfer_purpose     | donation, reallocation, refund, split, …
```
Cruzei os 5 com os tipos TS de front e back. **`credit_status`, `evasion_pattern_type` e
`transfer_purpose` (este é o de dinheiro) não têm união TS em MAIÚSCULO — estão alinhados.**
Divergem **dois**: o que a direção achou, e um terceiro que ninguém viu.

### B1 · `alert_status` (achado da direção) — ✅ **CONFIRMO, com prova vermelha**
```
psql> SELECT count(*) FROM alerts WHERE status = 'OPEN';
ERRO: valor de entrada é inválido para enum alert_status: "OPEN"
```
`frontend/src/api/automation.ts:18` = `'OPEN'|'ACK'|'RESOLVED'`. **LATENTE**, pelos mesmos dois
motivos do severity: rotas `/automation/alerts*` em 501 e a tela comentada em `App.tsx:493`.

### B2 · 🔴 `service_order_status` — **O TERCEIRO, E ESTE ESTÁ VIVO NUMA TELA MONTADA**
Não é latente, não está atrás de 501, e a cadeia inteira está fechada:

| elo | evidência |
|---|---|
| tela montada | `frontend/src/App.tsx:362` → `<Route path="service-orders" element={<ServiceOrdersPage />} />` |
| contrato do FE | `frontend/src/api/service-orders.ts:15` = `'DRAFT'\|'CONFIRMED'\|'IN_PROGRESS'\|'COMPLETED'\|'CANCELLED'` |
| o seletor da tela | `ServiceOrdersPage.tsx:235-239` — **as 5 opções são MAIÚSCULAS**, todas inválidas |
| envio | `ServiceOrdersPage.tsx:66` `filters.status = statusFilter` → `api/service-orders.ts:101` `queryParams.append('status', …)` |
| backend sem validação | `service-order.routes.ts:210` `filters.status = query.status **as any**` |
| SQL cru | `service-order.repository.ts:242-243` `conditions.push('status = $n'); params.push(filters.status)` |
| rota viva | `services.module.ts:29` registra; `GET /service-orders` **sem 501/403 estrutural** |
| **prova vermelha** | `SELECT count(*) FROM service_orders WHERE status = 'DRAFT';` → **ERRO: valor de entrada é inválido para enum service_order_status: "DRAFT"** · controle `status='draft'` → 0, ok |

**Sintoma para o usuário:** abrir `/service-orders` e escolher **qualquer** filtro que não seja
"Todas" → 500 → `setError` + toast *"Não foi possível carregar as ordens"* (`:70-74`). **Falha
visível, não silenciosa.**
**E há um segundo sintoma, este mudo:** `ServiceOrdersPage.tsx:110` monta
`{ workerActorId, status: 'DRAFT' }` para o contador de pendentes; o `catch` engole o erro e
`setPendingCount(0)` (`:113-116`). Para todo actor do tipo `page`, **o contador de ordens
pendentes é permanentemente zero** — o padrão *"o sistema não estava mentindo, estava mudo"* que
esta casa nomeou ontem.

⚠️ **NÃO É REGRESSÃO DESTE ARCO — e digo isso para você não me creditar o que não é meu.**
`git diff --name-only f558561d1..HEAD` **não toca** `frontend/src/api/service-orders.ts` nem
`ServiceOrdersPage.tsx`; ambos foram vistos pela última vez em **`f121bd1e7`, 2026-06-28** — mais
de um mês antes. O arco tocou `service-order.service.ts` (backend) e nada disso. **É defeito
pré-existente, encontrado por estender o padrão que a direção acabou de descobrir.**

### B3 · 🟠 Achado adjacente no mesmo arquivo — o contrato do FE **omite os 3 estados de dinheiro**
`service_order_status` tem 8 valores; o FE declara **5**. Faltam **`seller_pending`,
`release_approved`, `funds_released`** — exatamente os estados do ciclo de liberação de escrow
(`service-order.types.ts:23-37` documenta `funds_released` como *"estado terminal APÓS D-money
mover dinheiro de `escrow_payments` → `actor_wallet`"*). Corrigir só o case **não** resolve:
uma ordem em estado de dinheiro cai no `default` de `getStatusBadgeClass` (`:119-120`) e fica
invisível/indefinida para quem opera. Grau: PROVADO · gravidade LARANJA.

---

## VEREDITO
- **A1** correção sólida, afirmação nova reverificada e verdadeira.
- **A2** gatilho corrigido, **mas a premissa falsa segue no corpo normativo** → 1 correção exigida.
- **B1** achado da direção **confirmado** (latente).
- **B2** 🔴 **terceiro membro da família, VIVO, em tela montada, com prova vermelha** — pior que
  tudo que este arco produziu, e **anterior a ele**.
- **B3** contrato do FE incompleto nos 3 estados de dinheiro.

**Correções exigidas:** (1) riscar *"Não há usuário real"* no corpo do
`PLANO_CORRECAO_NOMENCLATURA:47`; (2) alinhar `api/service-orders.ts` + `ServiceOrdersPage`
ao enum vivo (minúsculo) **e** incluir os 3 estados faltantes; (3) validar `status` na rota
(`service-order.routes.ts:210` é `as any`) para que valor inválido vire **400**, não 500 —
sem isso, o próximo contrato desalinhado repete a mesma falha; (4) `api/automation.ts:16,18`
quando o 501 sair.

## O QUE NÃO AUDITEI
- Não subi backend/frontend; nenhuma requisição HTTP. Provas = SQL real no banco oficial,
  catálogo do Postgres, registro de rotas e leitura de código.
- Varri os **enums**; **não** varri `CHECK constraints` textuais (ex.: colunas TEXT com
  `CHECK (x IN (...))` minúsculo × união TS maiúscula) — essa classe falha **em silêncio**
  (0 linhas, sem erro) e continua não medida. É onde eu procuraria o quarto.
- Não reverifiquei os demais itens do parecer anterior.
- `unificard_local` (aposentado) intocado.

---
*Read-only respeitado. Única escrita: este arquivo.*
