# DOSSIÊ YALA #3 — completude da CONTENÇÃO DO DINHEIRO (pré-PORTA-1) + honestidade do baseline-ratchet

> **Papel (YALA):** auditor adversarial independente. A executora fez um read-first do cluster de
> dinheiro (`READINESS_PORTA1.md`) e construiu o baseline de um gate novo — e **NÃO pode auto-certificar
> nem uma coisa nem outra**. Pense como ATACANTE. **Disco vence narrativa.** As afirmações abaixo estão
> aqui para você REFUTAR.
>
> **Contexto:** UnifiCard, branch `rescue-structural`, HEAD `d0649ce51`. Cofre = `bank_ledger` (+ `bank_*`),
> RLS-live. Doutrina: "tabela vazia NÃO é prova de segurança" (`financial-worker-gate.ts:24`). A campanha
> de autoridade está esgotada e blindada (dossiês #1/#2 já auditados). O que resta é o DINHEIRO (PORTA-1),
> ainda NÃO aberto. Este dossiê NÃO pede execução — pede VERIFICAÇÃO read-only de duas afirmações da executora.

═══════════════════════════════════════════════════════════════
## PARTE A — A CONTENÇÃO DO DINHEIRO É COMPLETA? (a pergunta que mais importa)

**Afirmação da executora (REFUTE):** "Hoje, com o ledger vazio, NENHUM caminho move dinheiro real;
todo write de `bank_ledger` está contido por (a) ledger vazio, (b) stub bloqueado, (c) fail-closed,
ou (d) schema-ghost." Ver `READINESS_PORTA1.md`.

**O que peço você VERIFICAR/ATACAR:**

1. **Existe ALGUM caminho vivo que escreva `bank_ledger`/`bank_transactions`/`bank_splits` com efeito
   real HOJE, sem depender do ledger estar vazio?** Varra TODOS os writers de `bank_ledger` (grep
   `INSERT INTO bank_ledger`, `bank_transaction`, transfer/credit/debit) e classifique cada um:
   contido por quê? Se achar UM não-contido = CRÍTICO (a faca que a executora não viu).

2. **V3 — `payment-execution.service.ts:96` `executePayment`:** confirme que NÃO tem firewall interno
   e que os 4 callers não-PDV (event / automation `scheduled-action.service.ts` / subscription
   `subscription.service.ts` / **venue `venue.routes.ts`** = rota PÚBLICA por QR token) chegam ao sink
   sem contenção própria. A contenção é SÓ ledger-vazio? Há algum default-off/flag que a executora
   não mapeou (a favor ou contra)?

3. **Core de Aprovação Financeira:** a executora diz `financial_approval_authorities/policies/
   policy_events` = LIVE mas `financial_approval_requests/approvals` = live=0 (motor não existe).
   Confirme. Algum writer JÁ escreve nas tabelas vivas de policy de um jeito que materializaria
   autoridade financeira sem os 4-olhos?

4. **`/cta/:cta_id/confirm` (social ledger):** a executora REFINOU o OBS do dossiê #2 dizendo que
   `social-ledger.service.ts:58` lança `DERIVA_FINANCEIRA_BLOQUEADA` INCONDICIONALMENTE e que
   `social_ledger*` é schema-ghost (live=0) → escrita hard-blocked. **Refute:** o throw é mesmo
   incondicional? Há OUTRO método em `social-ledger.service` (ou outro serviço) que escreva o ledger
   social sem o block? O caminho de cálculo de `amountCents` chega a algum sink real?

5. **Resíduos 0113 (bank-http / payout):** bank-http = REQUEST-ONLY (sem bank_transaction)? payout =
   FAIL-CLOSED (403, sem executor)? Confirme que seguem contidos e que a contenção é por DESIGN
   (não por vazio). Algum reader vaza saldo cross-tenant sob RLS?

6. **Workers financeiros:** os workers de money/settlement/split/distribution estão default-OFF? Algum
   dispara escrita de ledger por scheduler sem gate? (`audit-financial-workers-dormancy` cobre — mas
   ele tem furo?)

**Entrega A:** para cada write de dinheiro, a natureza da contenção (vazio / stub / fail-closed /
ghost / default-off) OU o furo. Se a contenção for completa, diga-o com a lista exaustiva de writers
verificados. Se houver UMA faca viva, é o achado mais importante do projeto agora.

═══════════════════════════════════════════════════════════════
## PARTE B — O BASELINE-RATCHET É HONESTO? (a executora rotulou algum bug real como "falso-positivo")

**Afirmação da executora (REFUTE):** os 39 handlers no `BASELINE_UNCOVERED` de
`scripts/measure-handler-authority-gap.mjs` são TODOS falso-positivo da heurística de segmento —
cada um tem binding cross-file / preHandler / guard dedicado / subject server-side. (Razões por
arquivo no bloco de comentário do próprio script.)

**O que peço você VERIFICAR/ATACAR:** pegue os 39, e para cada um confirme no disco a razão alegada.
**Procure o que eu possa ter rotulado errado** — um handler que EU disse ser "coberto por
canManageCompany/preHandler/self" mas que na verdade age sob actor client-declared sem prova (um
BOLA/impersonação escondido dentro do meu próprio allowlist). Foco nos mais sensíveis:
- `company-members` POST/PUT/DELETE (conceder/mudar membership = conceder autoridade) — o
  `canManageCompany` cobre os 3? é fail-closed?
- `identity` KYB admin (requireRole['admin']) — o requireRole está mesmo em TODOS os 6? algum sem?
- `groups` PUT/DELETE/members (preHandler `requireGroupOwnerOrPermission`) — cobre os 5?
- `services`/`service-order`/`service-bundle`/`purchase-order`/`events-sprint76` (guards dedicados) —
  o guard existe e morde?
- `social` follow/unfollow/switch/vote/cta — self/safe mesmo?

**Entrega B:** confirme quantos dos 39 são genuinamente falso-positivo e denuncie qualquer um que
seja bug real mal-rotulado (= o guard estaria cego a ele por construção — mesmo risco do G1/F5).

═══════════════════════════════════════════════════════════════
## FORMATO

Por achado: severidade · arquivo:linha · vetor concreto (inputs→efeito) · CONFIRMED (reproduzido no
disco) ou PLAUSIBLE. Liste o que verificou e considerou SÓLIDO (calibração — se a contenção for
completa e o baseline honesto, dizê-lo com a lista é um resultado valioso). FP por leitura de
doc/narrativa em vez de código → diga. **Read-only; nenhuma escrita no banco.**

*Duas afirmações que a executora fez e não pode verificar sozinha: "o dinheiro está todo contido" e
"meu allowlist só tem falso-positivo". Se qualquer uma tiver um buraco, achá-lo antes de PORTA-1 é
exatamente o que protege o sistema.*
