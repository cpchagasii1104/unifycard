# GATE 2 — BLOCKERS DE SSOT

Este documento ativa formalmente o **Gate 2 — Bloqueio Estrutural**.

A partir deste ponto, o sistema entra em **modo de contenção**:
- Nenhuma nova violação de SSOT é permitida
- Nenhum código novo pode escrever ou decidir estado fora do Bank
- Qualquer exceção é tratada como FALHA de Gate

Este arquivo é **normativo**.

---

## ESTADO DO GATE

- **Gate:** 2
- **Status:** ATIVO
- **Objetivo:** Impedir novas violações enquanto o legado é corrigido
- **Escopo:** Backend inteiro

---

## BLOQUEIOS ATIVOS (OBRIGATÓRIOS)

Enquanto o Gate 2 estiver ativo, é **explicitamente proibido**:

### 1. Novas escritas em estruturas proibidas

Não pode ser introduzido **nenhum código novo** que:
- escreva em tabelas legacy
- atualize saldo fora do `bank_ledger`
- persista estado financeiro fora do Bank

Lista mínima (não exaustiva):
- `accounts`
- `ledger` (legacy)
- `transactions` (legacy)
- `payment_*`
- `event_*` financeiros
- `settlements`
- `region_accounts`
- `unifycard_transactions`

---

### 2. Novas leituras decisórias de legado

É proibido adicionar código que:
- use estruturas legacy para decisão
- calcule saldo, reputação ou liberação a partir de legado
- trate cache como verdade

Leitura **somente informativa** é permitida, desde que:
- não influencie decisão
- não desbloqueie fluxo
- não altere estado

---

### 3. Criação de novos atalhos “temporários”

Proibido:
- “só por enquanto”
- “depois a gente refatora”
- duplicar estado para ganhar velocidade

Gate 2 existe **exatamente** para impedir isso.

---

## EXCEÇÕES

Exceções **não são permitidas** durante o Gate 2.

Qualquer necessidade de exceção implica:
- FALHA imediata do Gate
- Registro obrigatório no `FALSIFICATION_LOG.md`
- Revisão do plano antes de continuar

---

## FISCALIZAÇÃO

Durante o Gate 2:
- Revisão manual é obrigatória
- Nenhum PR / commit funcional deve:
  - tocar dinheiro
  - alterar fluxo financeiro
  - criar novo writer

---

## CRITÉRIO DE SAÍDA DO GATE 2

O Gate 2 só é considerado cumprido quando:
- Nenhuma nova violação é possível
- O sistema permanece estável
- O próximo Gate (3) pode iniciar sem risco de regressão

---

## STATUS

- **Gate 2:** ATIVO
- **Gate 3:** BLOQUEADO até conclusão do Gate 2

---

FIM DO GATE 2 — BLOCKERS
