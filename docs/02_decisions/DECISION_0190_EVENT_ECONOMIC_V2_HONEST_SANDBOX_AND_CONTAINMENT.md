# DECISION-0190 — EVENT ECONOMIC/V2 · HONEST SANDBOX & CONTAINMENT (supersessão estreita do PASSO 4 da FASE_6_2)

**Data:** 2026-07-20 · **Status:** REDIGIDA — AGUARDANDO AUDITORIA INDEPENDENTE (Opus 4.8) E SELO SOBERANO. **NÃO-SELADA. SELF-SEAL NÃO PERMITIDO.**
**Base:** HEAD `368eb72cd` (branch `rescue-structural`). Denominador auditado NÃO-STALE.
**Modo:** DOCS-ONLY · ZERO CÓDIGO · PORTA-1 FECHADA · EXECUÇÃO MATERIAL NÃO AUTORIZADA.
**Origem probatória:** AUDIT-001 (Anexo C §C.11), sua falsificação independente (§C.13), e o GO de decisão docs-only (§C.14) — todos em `PLANO_RECUPERACAO.md`.
**Autorização:** GO institucional de Clayton (2026-07-20) — supersessão **ESTREITA** do PASSO 4 da `FASE_6_2_PAGAMENTO_SANDBOX.md`, sem revogar o restante nem apagar histórico.

---

## 0. NATUREZA E LIMITE DESTA DECISÃO

Esta decisão é **docs-only**. Ela NÃO altera código, rota, Bank, firewall, runner, migration; NÃO abre a PORTA-1; NÃO inicia frente material; NÃO declara o próprio selo. Ela reconcilia a norma histórica com os fatos provados e define o estado institucional da família `economic/v2` até que exista substrato sandbox real e provado.

Esta decisão **NÃO supersede a FASE_6_2 inteira.** Supersede **exclusivamente o PASSO 4** como método operacional vigente. O histórico da FASE_6_2 permanece intocado; a reconciliação é feita por **errata append-only** (`FASE_6_2_PAGAMENTO_SANDBOX.ERRATA.md`).

---

## 1. CAUSA-RAIZ CANÔNICA

```
SANDBOX FINANCIAL SUBSTRATE ASSUMED BUT NOT MATERIALIZED
```

A `FASE_6_2_PAGAMENTO_SANDBOX.md` é correta quanto ao **objetivo** — nenhum dinheiro real movimentado; experiência identificada como sandbox; operação não apresentada como execução produtiva. Porém o **PASSO 4** ("EXECUTAR PAGAMENTO (SANDBOX)") pressupôs a existência de um **substrato financeiro sandbox** (contas de teste, provedor de teste, isolamento financeiro de teste) que **nunca foi materializado**.

Na ausência desse substrato, executar "o mesmo fluxo da produção" (princípio de FASE_6_2) alcança o **writer real do Bank** (`bankTransactionService.createSimpleTransaction`, escrow→owner, `bank_ledger` real). Isso foi provado pelo AUDIT-001 e confirmado sob falsificação adversarial independente. Hoje esse efeito é contido **exclusivamente** pelo `BANK_TRANSACTION_SINK_FIREWALL` (default-off, fail-closed), com a PORTA-1 fechada.

Registro explícito: a causa-raiz **NÃO** é "`sandbox_mode` mente". É a ausência de substrato pressuposto. O rótulo `sandbox_mode` é fiel à intenção de FASE_6_2; o que falta é o substrato que tornaria essa intenção verdadeira.

---

## 2. PRINCÍPIO PRESERVADO (FASE_6_2 permanece vigente aqui)

`sandbox_mode` permanece **reservado** para uma operação com:
- zero chamada a writer financeiro real;
- zero `bank_transaction`;
- zero `bank_ledger`;
- zero alteração de saldo;
- zero conta financeira real tocada;
- zero efeito financeiro reutilizável posteriormente.

Nenhuma superfície pode usar o termo `sandbox` para uma operação que viole qualquer um destes pontos. O princípio de FASE_6_2 ("sem risco real", "nenhum dinheiro real movimentado", UI "não executado") é **confirmado e mantido**.

---

## 3. SUPERSESSÃO ESTREITA DO PASSO 4 (PROPOSTA · PENDENTE DE SELO)

**PASSO 4 SUPERSESSION PROPOSED · PENDING INDEPENDENT AUDIT AND SEAL.** A supersessão estreita do PASSO 4 está **proposta** e permanece **pendente de auditoria independente e selo** — não é fato consumado enquanto esta decisão estiver REDIGIDA/NÃO-SELADA.

O **PASSO 4 da FASE_6_2** ("EXECUTAR PAGAMENTO (SANDBOX)" — `POST /events/:eventId/economic/v2/payment/execute` rodando o fluxo em sandbox) **é proposto para deixar de ser método operacional vigente.** Após auditoria independente favorável e registro do selo, o PASSO 4 **deixará de ser** o método operacional vigente.

- Mesmo após o selo, ele **não poderá ser retomado automaticamente** caso o firewall ou a PORTA-1 sejam alterados.
- Remoção do firewall, mudança de env var, ou remoção da contenção 501 **não** reativarão o PASSO 4.
- Sua eventual retomada, mesmo após o selo, exigirá, cumulativamente: **novo GO institucional** + **substrato sandbox físico e isolado** + **banco efêmero ou ambiente equivalente** + **contas sandbox** + **separação comprovada do ledger real** + **auditoria** + **provas de atomicidade, idempotência, concorrência e reversão** + **novo selo independente**.

O restante da FASE_6_2 (princípio, PASSOS 1-3, pré-requisitos, roteiro de UX) **permanece vigente** no que não depende do PASSO 4 como execução real.

---

## 4. CONTENÇÃO ATUAL (estado institucional da família)

Enquanto o substrato sandbox não existir, **toda a família HTTP `economic/v2`** é considerada **institucionalmente não implementada e contida**:
`custody` · `split` · `payment/authorize` · `payment/execute` · `payment/revoke` · `refund` · `chargeback` · `chargeback/resolve`.

**Código de resposta canônico na borda:**
```
501  EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED
```

A contenção deve ocorrer **antes** de criar novos estados dessa família ou chamar seus services. (A materialização desta contenção é a frente material futura §8 — esta decisão NÃO a implementa.)

---

## 5. ESTADOS EXISTENTES

Qualquer estado `economic/v2` já existente no banco deve ser: **preservado · não apagado · não executado · não convertido · não usado para abrir a PORTA-1**, permanecendo disponível **somente para auditoria e futura decisão governada**.

---

## 6. DEFESA EM PROFUNDIDADE

O `BANK_TRANSACTION_SINK_FIREWALL` permanece **default-off · fail-closed · soberano no sink · obrigatório mesmo após a contenção HTTP**.

- A resposta **501 na borda NÃO substitui o firewall.**
- O **403 do firewall** continua reservado para tentativas que, por regressão ou caller alternativo, alcancem o sink financeiro.
- A contenção HTTP não substitui o firewall; o firewall não substitui a contenção HTTP. As duas camadas coexistem por desenho.

---

## 7. FRONTEIRA DE DOMÍNIO (Eventos ↔ Bank)

**Eventos** continua responsável por: lifecycle do evento, intenção econômica, vínculo evento↔operação, estado de domínio, eventos de domínio.
**Bank** continua **único soberano** sobre: contas, transações, ledger, saldo, locks, cobertura, reversão monetária.

Esta decisão **não move** o workflow de Eventos para dentro do Bank e **não autoriza** SQL financeiro cru em Eventos. A fronteira de escrita já vigente (Eventos delega ao Bank, nunca toca `bank_*` em SQL cru) é **confirmada correta** — nada muda aí.

---

## 8. RECONCILIAÇÃO COM A POLÍTICA DE ATIVAÇÃO ECONÔMICA

Reconciliação expressa com `POLITICA_ATIVACAO_ECONOMICA_UNIFICARD.md`:
- variável de ambiente **não é autorização**;
- feature flag **não é autorização**;
- remoção do 501 **não é autorização**;
- remoção do firewall **não é autorização**;
- ativação exige **evento institucional explícito** + as **autorizações humanas** previstas (dupla autorização, papéis autorizados);
- **PORTA-1 permanece fechada.**

---

## 9. FRENTE MATERIAL FUTURA (única autorizável após auditoria + selo)

Nome canônico: **`F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT`**. Esta decisão **NÃO a inicia.**

**Escopo POSITIVO futuro:**
- contenção `501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED` de toda a família na borda HTTP;
- zero chamada aos services contidos;
- preservação dos estados existentes;
- preservação do firewall;
- guard anti-revival da contenção;
- reconciliação do guard `audit-bank-transaction-sink-firewall.mjs` com o runner canônico, **condicionada** à confirmação final do AUDIT-002 (Anexo C §C.12).

**Escopo NEGATIVO futuro:**
- zero ativação financeira;
- zero implementação de sandbox;
- zero abertura da PORTA-1;
- zero migration financeira;
- zero conta; zero seed; zero saldo;
- zero caller frontend;
- zero alteração de cálculo;
- zero refund ou chargeback real.

**Provas obrigatórias da frente:** negative-proofs de que cada endpoint da família retorna a contenção 501 **antes** de qualquer writer/criação de estado; guard da contenção no runner canônico.

---

## 10. PRÉ-CONDIÇÕES PARA QUALQUER ATIVAÇÃO FUTURA (gate, não autorização)

Nenhuma ativação pode ser considerada antes de provar, cumulativamente:
(a) **Autoridade econômica** = representação do Actor **+** titularidade/autoridade específica sobre `economic_owner_id`/custody/evento;
(b) **Lifecycle** = autorização transiciona **atomicamente** de `authorized` para `executed`;
(c) **Idempotência** = claim **antes** do efeito; chave física única; retry idêntico retorna o mesmo resultado; payload divergente falha;
(d) **Concorrência** = execução dupla impossível; execute/refund/chargeback não concorrem de modo inconsistente;
(e) **Conservação** = partida dobrada fecha exatamente;
(f) **Cobertura** = contas que não admitem saldo negativo rejeitam débito sem saldo suficiente (hoje o sink NÃO rejeita overdraft — §C.13);
(g) **Reversão** = vínculo imutável com a operação original; zero recomputação por regra atual; zero dupla reversão;
(h) **Provas** = banco efêmero isolado; rollback; concorrência; mutations; negative-proofs; guards no runner canônico.

---

## 11. TEXTO EXATO DA SUPERSESSÃO (para a errata da FASE_6_2)

> **ERRATA / SUPERSESSÃO ESTREITA (DECISION-0190, PROPOSTA EM 2026-07-20 · NÃO-SELADA):** **PASSO 4 SUPERSESSION PROPOSED · PENDING INDEPENDENT AUDIT AND SEAL.** É proposto que o PASSO 4 deste documento ("EXECUTAR PAGAMENTO (SANDBOX)") deixe de ser método operacional vigente, por ausência do substrato financeiro sandbox que ele pressupôs (causa-raiz canônica: `SANDBOX FINANCIAL SUBSTRATE ASSUMED BUT NOT MATERIALIZED`). Após auditoria independente favorável e registro do selo, o PASSO 4 deixará de ser o método operacional vigente. O princípio de sandbox sem dinheiro real (PASSOS 1-3, pré-requisitos e UX) permanece vigente. Mesmo após o selo, o PASSO 4 não poderá ser retomado automaticamente por mudança de env var, feature flag, remoção da contenção 501 ou remoção do firewall; sua retomada exigirá novo GO institucional + substrato sandbox físico isolado + auditoria + provas (atomicidade/idempotência/concorrência/reversão) + novo selo independente. Este texto é append-only e não reescreve o histórico acima.

---

## 12. VEREDITO INTERNO SOBRE A SUFICIÊNCIA DA REDAÇÃO

**A — a redação é suficiente e compatível.** Fecha, sem ambiguidade: significado estrito de sandbox (§2); estado contido da família (§4) com código canônico (§4); supersessão estreita e não-automática do PASSO 4 (§3, §11); preservação de estados (§5); defesa em profundidade firewall+501 (§6); fronteira Eventos↔Bank (§7); reconciliação com a política de ativação (§8); PORTA-1 fechada (§0, §8); pré-condições de futura ativação (§10); escopo exato da futura frente material (§9). Preserva o princípio de FASE_6_2 e usa errata append-only (§11), sem apagar histórico. Não mistura contenção atual com ativação futura (separadas em §4 vs §9-10). Não autoriza código implicitamente (§0). **Ressalva não-bloqueante:** a suficiência final depende da auditoria independente (Opus 4.8) e do selo soberano — esta decisão é REDIGIDA, não selada.

---

## 13. CONFIRMAÇÃO

```
ZERO CODE CHANGE
ZERO MIGRATION
ZERO BANK WRITE
ZERO RUNNER CHANGE
PORTA-1 CLOSED
PASSO 4 SUPERSESSION PROPOSED (estreito, não-automático)
PENDING INDEPENDENT AUDIT AND SEAL
FASE_6_2 PRINCIPLE PRESERVED
MATERIAL EXECUTION NOT AUTHORIZED
SELF-SEAL NOT PERMITTED
```

**Encaminhamento:** esta decisão segue para **auditoria independente (Opus 4.8, instância separada)** antes de qualquer selo. Não selar aqui.
