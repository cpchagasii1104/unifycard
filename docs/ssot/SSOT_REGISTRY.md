---

# DOCUMENTO TÉCNICO / HISTÓRICO

⚠️ Este documento NÃO é norma.
⚠️ Não possui autoridade hierárquica.
⚠️ Se houver conflito, prevalece exclusivamente:
docs/01_normative/
------------------

# SSOT REGISTRY — UnifiCard

Este documento declara, de forma **explícita e técnica**,
as **Fontes Únicas de Verdade (SSOT)** do sistema UnifiCard.

Ele **referencia**:
- `AUTHORITY_LAW.md`
- `08_AUTORIDADE_CANONICA.md`

Diretriz operacional:
- código deve respeitar as SSOT aqui declaradas
- evitar persistir verdade concorrente
- seguir processo formal para nova autoridade

Código que viola este documento deve ser revisado,
mesmo que funcione.

---

## PRINCÍPIOS TÉCNICOS

1. **SSOT é declarada, não inferida**
2. **Autoridade nasce da Lei, não da estrutura**
3. **Saldo é verdade contábil, não campo isolado**
4. **Ledger é append-only e decide o estado**
5. **Qualquer saldo fora do ledger é derivado**
6. **Split final é bancário, não declarativo**
7. **Refund e chargeback são eventos bancários**
8. **Ambiguidade é tratada como violação**
9. **Leitura que gera decisão é autoridade implícita (proibida)**

Regra global:
> Qualquer leitura usada para decidir estado financeiro  
> ou autoridade é tratada como violação de SSOT.

---

## SSOT — AUTORIDADE (CONSTITUCIONAL)

### Autoridade Humana Raiz

| Item | Valor |
|----|----|
| **SSOT** | `authority_roots` |
| **Conceito** | Raiz humana de autoridade (CPF) |
| **Decide autoridade?** | **Sim** |
| **Writer único** | Authority Registry |
| **Leitores** | Todos os domínios |

Regras:
- Toda autoridade deriva de um CPF
- Nenhuma entidade é soberana
- CPF pode estar sujeito a ATL, quarentena ou banimento

**Schema mínimo técnico**
- `actor_id` (UUID, PK) — ator humano raiz
- `cpf_hash` (TEXT, UNIQUE) — CPF normalizado (hash)
- `status` (TEXT) — active | suspended | banned
- `created_at` (TIMESTAMPTZ)

Nenhum outro campo é permitido.

---

### Authority Trust Level (ATL)

| Item | Valor |
|----|----|
| **SSOT** | `authority_trust_levels` |
| **Conceito** | Classificação constitucional de confiança |
| **Decide poder?** | **Sim** |
| **Writer único** | Risk Authority |
| **Leitores** | Sistema |

Regras:
- ATL **precede qualquer permissão**
- ATL não é configurável por produto
- ATL bloqueia criação, delegação e ações irreversíveis conforme nível

**Schema mínimo técnico**
- `actor_id` (UUID, PK)
- `atl_level` (INTEGER)
- `reason` (TEXT)
- `effective_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ, opcional)

---

### Guarda (Responsabilidade Econômica)

| Item | Valor |
|----|----|
| **SSOT** | `economic_guardianship` |
| **Conceito** | Responsável econômico único |
| **Decide responsabilidade?** | **Sim** |
| **Writer único** | Authority Registry |
| **Leitores** | Bank, Auditoria |

Regras:
- Não existe guarda em cadeia
- Toda guarda possui teto, prazo e escopo
- Violação gera incidente e possível ATL

**Schema mínimo técnico**
- `subject_actor_id` (UUID, PK)
- `guardian_actor_id` (UUID)
- `scope` (TEXT)
- `limit_amount` (NUMERIC)
- `effective_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)

---

### Delegação de Autoridade (Operacional)

| Item | Valor |
|----|----|
| **SSOT** | `authority_delegations` |
| **Conceito** | Delegações explícitas de poder |
| **Decide permissão?** | **Sim (operacional)** |
| **Writer único** | Authority Registry |
| **Leitores** | RBAC, ActionContext |

Regras:
- Delegação nunca cria autoridade
- Delegação é temporária
- Delegação sem CPF é inválida
- Delegação transitiva é proibida

**Schema mínimo técnico**
- `delegator_actor_id` (UUID)
- `delegate_actor_id` (UUID)
- `scope` (TEXT)
- `issued_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)
- `revoked_at` (TIMESTAMPTZ, opcional)

Chave primária composta:
`(delegator_actor_id, delegate_actor_id, scope)`

---

## SSOT — IDENTIDADE OPERACIONAL

### Identidade Global de Ator

| Item | Valor |
|----|----|
| **SSOT** | `actors` |
| **Conceito** | Identidade canônica de execução |
| **Decide estado final?** | Sim |
| **Writer único** | Actor Registry |
| **Leitores** | Todos os módulos |

Regras:
- Todo Actor referencia um CPF
- Actor não é soberano
- Actor só existe enquanto a delegação existir

---

## SSOT — CONTA BANCÁRIA (ESTRUTURA)

### Conta Financeira

| Item | Valor |
|----|----|
| **SSOT** | `bank_accounts` |
| **Conceito** | Estrutura da conta |
| **Decide saldo?** | **Não** |
| **Writer único** | UnifyBank |
| **Leitores** | Sistema |

Regras:
- Conta não decide saldo
- `cached_balance` é sempre derivado

---

## SSOT — MOVIMENTAÇÃO FINANCEIRA

### Transações Bancárias

| Item | Valor |
|----|----|
| **SSOT** | `bank_transactions` |
| **Conceito** | Movimentos financeiros |
| **Decide saldo?** | Não isoladamente |
| **Writer único** | UnifyBank |
| **Leitores** | Auditoria |

---

## SSOT — LEDGER BANCÁRIO (VERDADE CONTÁBIL)

### Ledger Financeiro

| Item | Valor |
|----|----|
| **SSOT** | `bank_ledger` |
| **Conceito** | Verdade contábil |
| **Decide estado final?** | **Sim** |
| **Writer único** | UnifyBank |
| **Leitores** | Sistema |

Regras:
- Append-only
- Saldo deriva exclusivamente do ledger

---

## SSOT — SPLIT FINANCEIRO FINAL

### Split Bancário

| Item | Valor |
|----|----|
| **SSOT** | `bank_splits` |
| **Conceito** | Distribuição final |
| **Decide estado final?** | Sim |
| **Writer único** | UnifyBank |
| **Leitores** | Auditoria |

---

## SSOT — REFUND E CHARGEBACK

### Reversões Financeiras

| Item | Valor |
|----|----|
| **SSOT** | `bank_ledger` + `bank_transactions` |
| **Decide estado final?** | **Sim** |
| **Writer único** | UnifyBank |

---

## DOMÍNIOS NÃO-SSOT (DECLARADOS)

- `payment_intents`
- `unifycard_transactions`
- `event_*`
- `settlements`
- `payment_splits`

Uso permitido:
- intenção
- workflow
- log
- projeção

Proibido:
- decisão
- autoridade
- verdade financeira

---

## GOVERNANÇA

- Alterações exigem:
  1. `FALSIFICATION_LOG.md`
  2. Gate aprovado
  3. Evidência técnica

Mudança silenciosa = **violação grave**.

---

## STATUS

- **Gate A:** CONTEÚDO DEFINIDO
- **Gate 0:** FECHADO
- **Gate 1:** FECHADO (SSOT DECLARADO + ESTRUTURADO)
- **Gate 2+:** A EXECUTAR

---

FIM DO SSOT REGISTRY
