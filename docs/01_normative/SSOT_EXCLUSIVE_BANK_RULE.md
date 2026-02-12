# SSOT EXCLUSIVE BANK RULE

## STATUS: CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. DECLARAÇÃO CONSTITUCIONAL

O **UnifyBank** é a **ÚNICA fonte de verdade financeira (SSOT)** de todo o sistema UnifiCard.

Nenhum outro módulo, serviço, tabela ou processo pode:
- manter saldo próprio
- registrar transações financeiras
- executar splits financeiros
- decidir estado financeiro final

Toda verdade financeira **emerge exclusivamente** do UnifyBank.

---

## 2. PROIBIÇÕES ABSOLUTAS

É **explicitamente proibido**, em qualquer circunstância:

1. Criar novas tabelas financeiras fora do UnifyBank, incluindo:
   - `*_ledger`
   - `*_transactions`
   - `*_splits`
   - `*_balances`

2. Manter campo `balance`, `saldo`, `credit`, `amount` fora das estruturas do UnifyBank.

3. Executar `INSERT`, `UPDATE` ou `DELETE` em estruturas financeiras fora de:
   - `bank_accounts`
   - `bank_ledger`
   - `bank_transactions`
   - `bank_splits`

4. Definir liquidação financeira com:
settledAt = NOW()

sem confirmação explícita de parceiro externo.

5. Calcular ou inferir saldo fora do UnifyBank.

---

## 3. REGRA DE SETTLEMENT

O sistema **NÃO paga**.  
O sistema **GOVERNA**.

Regras obrigatórias:

- Conclusão interna → `internal_completed_at`
- Liquidação externa → `external_settled_at`
- Liquidação externa só pode ocorrer:
- após callback confirmado
- com referência do parceiro
- registrada explicitamente

Liquidação implícita por timestamp é **inválida**.

---

## 4. ESTRUTURAS LEGADAS (REGIME DE EXTINÇÃO)

As seguintes estruturas são consideradas **LEGADO EM EXTINÇÃO**:

- `backend/src/core/economy/`
- `backend/src/modules/ledger/`
- `backend/src/modules/social/social-ledger.service.ts`
- `backend/src/modules/social/impact.service.ts`
- `backend/src/modules/loyalty/loyalty.repository.ts`
- `backend/src/modules/cultural/cultural-event.service.ts`
- `backend/src/modules/services/service-payment-execution.repository.ts`
- `backend/src/modules/escrow/escrow.repository.ts`

Regras para essas estruturas:

- ❌ NÃO podem receber novas features
- ❌ NÃO podem ser usadas por novos módulos
- ✅ Apenas manutenção temporária até migração completa
- 🗑️ Serão removidas após fechamento do BLOCO 4

---

## 5. CONSEQUÊNCIA DE VIOLAÇÃO

Qualquer violação desta regra implica automaticamente:

- Bloqueio da operação
- Registro de métrica `ssot.violation`
- Registro em log institucional
- Necessidade de revisão explícita de autoridade

Em modo estrito (`SSOT_STRICT_MODE=true`):

- A violação resulta em **FAIL imediato**

---

## 6. ENFORCEMENT AUTOMÁTICO

Esta regra é aplicada por:

- Migrations e constraints de banco
- Triggers de proteção financeira
- Middlewares de backend
- CI anti-regressão
- Auditoria contínua

---

## 7. REFERÊNCIAS NORMATIVAS

Este documento é **obrigatoriamente referenciado** em:

- `docs/01_normative/01_SSOT.md`
- `docs/01_normative/AUTHORITY_LAW.md`
- `docs/01_normative/SSOT_CONTRACT.md`
- `docs/01_normative/PROHIBITED_STRUCTURES.md`
- `docs/01_normative/00_AGENT_PROTOCOL.md`

---

## 8. DISPOSIÇÃO FINAL

Esta regra tem **força constitucional** dentro do sistema UnifiCard.

Nenhum código, feature, refatoração ou otimização pode se sobrepor a ela.

**SSOT não é convenção.  
SSOT é lei.**