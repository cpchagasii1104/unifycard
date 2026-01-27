# PROHIBITED STRUCTURES — SSOT UnifiCard

Este documento lista **estruturas, tabelas e padrões explicitamente PROIBIDOS**
como fonte de verdade, autoridade de decisão ou cálculo de estado no sistema UnifiCard.

Qualquer uso fora do permitido aqui é considerado **violação grave de SSOT**.

Este documento complementa o `SSOT_REGISTRY.md` e é **normativo e vinculante**.

---

## PRINCÍPIO FUNDAMENTAL

> Estrutura proibida **pode existir**,  
> mas **nunca pode decidir estado**.

Uso permitido ≠ uso como verdade.

---

## ESTRUTURAS FINANCEIRAS PROIBIDAS (LEGACY)

As estruturas abaixo **NUNCA** podem:
- decidir saldo
- calcular estado financeiro
- ser tratadas como autoridade final
- reconstruir verdade contábil

### Tabelas proibidas

- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `region_accounts`
- `wallets` (se existir)
- qualquer tabela de saldo fora de `bank_ledger`
- `cached_balances` fora de `bank_accounts`

Uso permitido:
- histórico
- visualização
- debug
- migração assistida **temporária e documentada**

Uso proibido:
- decisão
- cálculo
- consolidação
- autoridade implícita

---

## ESTRUTURAS DE PAGAMENTO NÃO-CANÔNICAS

Estas estruturas **NÃO** são SSOT e **NÃO** podem decidir pagamento ou dinheiro:

- `payment_transactions`
- `payment_splits`
- `payment_intent_splits`
- `settlements`
- `payout_transactions`
- `escrow_transactions`
- `unifycard_transactions`

Uso permitido:
- logs operacionais
- integração com adquirente
- rastreabilidade técnica
- conciliação informativa

Uso proibido:
- cálculo de saldo
- split final
- decisão financeira
- marcação de estado final (`PAID`, `SETTLED`, etc.)

---

## ESTRUTURAS DECLARATIVAS / INTERMEDIÁRIAS (NÃO-SSOT)

Estas estruturas **NUNCA** decidem dinheiro:

- `event_split_declarative`
- `event_refund`
- `event_chargeback`
- `service_payment_requests`
- `service_payment_executions`
- `payment_intents` (pré-financeiro)

Uso permitido:
- intenção
- orquestração
- workflow
- pré-financeiro
- notificação

Uso proibido:
- autoridade financeira
- substituição de ledger
- persistência de verdade contábil
- inferência de saldo ou quitação

---

## PADRÕES DE CÓDIGO PROIBIDOS

Os seguintes padrões são **explicitamente proibidos**:

- Atualizar saldo fora do `bank_ledger`
- Calcular saldo a partir de:
  - `transactions`
  - `payment_transactions`
  - `event_*`
  - `settlements`
- Tratar `cached_balance` como verdade
- Usar JOIN em tabelas proibidas para **decisão**
- Persistir “estado final” em repositório de negócio
- Recalcular split fora do banco
- Aritmética financeira fora do Bank (ex.: JS)

---

## LEITURA DECISÓRIA PROIBIDA

É proibido:
- Tomar decisão com base em estruturas proibidas
- Usar dados legacy para:
  - liberar pagamento
  - bloquear conta
  - concluir evento financeiro
  - computar reputação financeira
  - decidir acesso ou benefício financeiro

Regra dura:
> **Leitura que influencia decisão é autoridade implícita — e é proibida.**

---

## EXCEÇÕES CONTROLADAS

Exceções **só existem** se **TODOS** os critérios forem atendidos:
1. Documentadas no `FALSIFICATION_LOG.md`
2. Aprovadas por Gate explícito
3. Com **prazo de expiração definido**
4. Sem impacto em decisão financeira final

Exceção sem prazo = **violação**.

---

## FISCALIZAÇÃO

- Qualquer novo uso de estrutura proibida:
  - é **FAIL automático** de Gate
  - exige correção imediata
- Refactors **não podem** reintroduzir uso proibido
- Testes **também** obedecem estas regras
- Ambiguidade é tratada como violação

---

## STATUS

- **Gate 1:** PROIBIÇÕES DECLARADAS (CONTEÚDO DEFINIDO)
- **Gate 2:** BLOQUEIO EM CÓDIGO — A EXECUTAR
- **Gate 3:** REMOÇÃO DE USO — A EXECUTAR

---

FIM DO PROHIBITED STRUCTURES
