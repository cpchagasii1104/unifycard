# SSOT REGISTRY — UnifiCard

Este documento declara, de forma **explícita, normativa e vinculante**, as **Fontes Únicas de Verdade (SSOT)**
do sistema UnifiCard, conforme definido pela auditoria técnica e pelo plano de correção.

Nenhum código pode:
- decidir estado fora das SSOT aqui declaradas
- persistir verdade concorrente
- introduzir nova autoridade sem Gate formal

Código que viola este documento está **automaticamente errado**, mesmo que funcione.

---

## PRINCÍPIOS CANÔNICOS

1. **SSOT é declarada, não inferida**
2. **Saldo é verdade contábil, não campo isolado**
3. **Ledger é append-only e decide o estado**
4. **Qualquer saldo fora do ledger é derivado (cache)**
5. **Split final é bancário, não declarativo**
6. **Refund e chargeback são eventos bancários, não semânticos**
7. **Ambiguidade é tratada como violação**
8. **Leitura que gera decisão é autoridade implícita (proibida)**

Regra global:
- Qualquer leitura usada para decidir estado financeiro
  é tratada como autoridade implícita e é proibida.

---

## SSOT — IDENTIDADE

### Identidade Global de Ator

| Item | Valor |
|----|----|
| **SSOT** | `actors` |
| **Conceito** | Identidade canônica de qualquer participante do sistema |
| **Decide estado final?** | Sim |
| **Writer único** | Actor Registry |
| **Leitores** | Todos os módulos |
| **Proibidos** | `users`, `companies`, `profiles` como verdade final |

Regras:
- Toda entidade relevante referencia `actor_id`
- Nenhuma identidade paralela é permitida

---

## SSOT — CONTA BANCÁRIA (ESTRUTURA)

### Conta Financeira

| Item | Valor |
|----|----|
| **SSOT** | `bank_accounts` |
| **Conceito** | Estrutura da conta (existência, owner, status) |
| **Decide saldo?** | **Não** |
| **Writer único** | UnifyBank |
| **Leitores** | Sistema |
| **Observação** | `cached_balance` é **derivado**, nunca SSOT |

Regras:
- Conta **não decide saldo**
- Campo de saldo só pode existir como cache derivado do ledger

---

## SSOT — MOVIMENTAÇÃO FINANCEIRA

### Transações Bancárias

| Item | Valor |
|----|----|
| **SSOT** | `bank_transactions` |
| **Conceito** | Movimentos financeiros efetivos |
| **Decide estado final?** | Não isoladamente |
| **Writer único** | UnifyBank |
| **Leitores** | Auditoria, relatórios |

Regras:
- Transação não substitui ledger
- Não existe saldo implícito por transação
- Toda transação financeira relevante deve referenciar `bank_transaction_id`

---

## SSOT — LEDGER BANCÁRIO (VERDADE CONTÁBIL)

### Ledger Financeiro

| Item | Valor |
|----|----|
| **SSOT** | `bank_ledger` |
| **Conceito** | Verdade contábil e saldo final |
| **Decide estado final?** | **Sim** |
| **Writer único** | UnifyBank |
| **Leitores** | Sistema (leitura) |

Regras:
- Ledger é **append-only**
- Saldo é **derivado exclusivamente do ledger**
- Qualquer saldo persistido fora dele é proibido (exceto cache explicitamente marcado)

---

## SSOT — SPLIT FINANCEIRO FINAL

### Split Bancário

| Item | Valor |
|----|----|
| **SSOT** | `bank_splits` |
| **Conceito** | Distribuição final de valores |
| **Decide estado final?** | Sim |
| **Writer único** | UnifyBank |
| **Leitores** | Auditoria, relatórios |

Regras:
- Split final ocorre **exclusivamente no banco**
- Nenhum módulo externo pode decidir “quanto vai para quem”
- Estruturas declarativas ou de evento não têm autoridade financeira

---

## SSOT — REFUND E CHARGEBACK

### Reversões Financeiras

| Item | Valor |
|----|----|
| **SSOT** | `bank_ledger` + `bank_transactions` |
| **Conceito** | Reversão financeira efetiva |
| **Decide estado final?** | **Sim (via ledger)** |
| **Writer único** | UnifyBank |
| **Leitores** | Sistema, auditoria |

Regras:
- **Não existe refund ou chargeback sem `bank_transaction_id`**
- Refund/chargeback **não são SSOT em eventos**
- Eventos apenas solicitam, refletem ou notificam
- Qualquer refund/chargeback fora do ledger é inválido

---

## DOMÍNIO NÃO-SSOT — PAYMENT INTENT (PRÉ-FINANCEIRO)

### Intenção de Pagamento

| Item | Valor |
|----|----|
| **SSOT** | ❌ NÃO É SSOT |
| **Estrutura** | `payment_intents` (ou equivalente) |
| **Conceito** | Intenção pré-financeira |
| **Decide dinheiro?** | **NÃO** |
| **Writer** | Services / Marketplace |
| **Autoridade financeira** | Exclusivamente UnifyBank |

Regras:
- Payment intent **não movimenta dinheiro**
- Payment intent **não decide saldo**
- Nenhum estado “paid/settled” é válido sem Bank

---

## DOMÍNIO OPERACIONAL — UNIFYCARD

### Recebimento via Cartão

| Item | Valor |
|----|----|
| **SSOT** | ❌ NÃO |
| **Conceito** | Captura / autorização |
| **Decide dinheiro?** | **NÃO** |
| **Autoridade final** | Bank (ledger) |

Regras:
- UnifyCard **não decide SETTLED**
- UnifyCard **não decide saldo**
- Status operacionais não são verdade financeira

---

## ESTRUTURAS EXPLICITAMENTE NÃO-SSOT

Estas estruturas **NUNCA** podem decidir estado financeiro:

- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `payment_transactions`
- `payment_splits`
- `payment_intent_splits`
- `event_split_declarative`
- `region_accounts`
- `unifycard_transactions`
- `settlements`
- `event_refund`
- `event_chargeback`

Uso permitido:
- histórico
- visualização
- projeção
- debug
- log

Uso proibido:
- decisão
- cálculo de saldo
- autoridade final
- criação de verdade financeira

---

## GOVERNANÇA

- Alterações neste registry exigem **obrigatoriamente**:
  1. Registro no `FALSIFICATION_LOG.md`
  2. Gate explícito aprovado
  3. Evidência técnica verificável

Mudança silenciosa é **violação grave de SSOT**.

---

## STATUS

- **Gate 0:** FECHADO
- **Gate 1:** CONTEÚDO DEFINIDO / NÃO FORMALIZADO
- **Gate 2+:** A EXECUTAR

---

FIM DO SSOT REGISTRY
