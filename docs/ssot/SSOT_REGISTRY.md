# SSOT REGISTRY — UnifiCard

Este documento declara, de forma **explícita e normativa**, as **Fontes Únicas de Verdade (SSOT)**
do sistema UnifiCard, conforme definido pela auditoria e pelo plano de correção.

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
6. **Ambiguidade é tratada como violação**

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
- Saldo é **derivado do ledger**
- Qualquer saldo persistido fora dele é proibido (exceto cache)

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
- Split final ocorre **no banco**
- Estruturas declarativas não decidem dinheiro

---

## ESTRUTURAS EXPLICITAMENTE NÃO-SSOT

Estas estruturas **NUNCA** podem decidir estado financeiro:

- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `payment_transactions`
- `payment_splits`
- `event_split_declarative`
- `region_accounts`
- `unifycard_transactions`
- `settlements`

Uso permitido:
- histórico
- visualização
- debug
- log

Uso proibido:
- decisão
- cálculo de saldo
- autoridade final

---

## GOVERNANÇA

- Alterações neste registry exigem:
  1. Registro no `FALSIFICATION_LOG.md`
  2. Gate explícito
  3. Evidência técnica
- Mudança silenciosa é violação grave de SSOT

---

## STATUS

- **Gate 0:** FECHADO
- **Gate 1:** SSOT REGISTRY DEFINIDO (versão corrigida)
- **Gate 2+:** A EXECUTAR

---

FIM DO SSOT REGISTRY
