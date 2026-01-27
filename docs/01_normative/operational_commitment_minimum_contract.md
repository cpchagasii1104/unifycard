Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# OPERATIONAL COMMITMENT — CONTRATO CANÔNICO MÍNIMO (FASE 4)

## 1. Propósito

OperationalCommitment representa **um compromisso operacional factual**, associado a um Evento, **sem qualquer efeito econômico**. Ele registra apenas fatos observáveis de execução (presença, ausência, início, término), sem inferência, sem punição e sem consequência automática.

Este contrato existe para separar definitivamente:
- **execução operacional**
- **decisão econômica (futuras fases)**

---

## 2. Natureza Institucional

- OperationalCommitment é **operacional**, não financeiro
- É **factual**, não avaliativo
- É **declarado explicitamente**, nunca inferido
- É **imutável quanto à intenção**, mutável apenas quanto aos fatos

---

## 3. Entidade Canônica

### Campos obrigatórios

- `id`
- `event_id`
- `responsible_actor_id`
- `responsible_actor_type`
- `role`
- `status`
- `time_window_ref?`
- `checked_in_at?`
- `checked_out_at?`
- `failure_reason?`

### Campos explicitamente proibidos

❌ valor
❌ preço
❌ moeda
❌ condição de pagamento
❌ score
❌ penalidade
❌ reputação

---

## 4. Estados Canônicos

Estados mínimos e obrigatórios:

1. `expected` — compromisso criado, aguardando execução
2. `checked_in` — check-in realizado (fato observado)
3. `checked_out` — check-out realizado (fato observado)
4. `failed` — falha operacional (no-show ou falha durante execução)

---

## 5. Transições Permitidas

- `expected` → `checked_in`
- `checked_in` → `checked_out`
- `expected` → `failed`
- `checked_in` → `failed`

Transições fora dessa lista são **invalidas por contrato**.

---

## 6. Check-in / Check-out

- São **fatos observados**, não decisões
- Não geram consequência automática
- Não alteram economia
- Não alteram reputação

O sistema **registra**, não interpreta.

---

## 7. Relação com Evento

- Evento **não cria automaticamente** commitments
- Evento **não executa** commitments
- Evento **apenas referencia** commitments existentes

OperationalCommitment tem lifecycle próprio.

---

## 8. Relação com Agenda Universal

- Commitment pode **referenciar** uma janela temporal
- Commitment **não cria slot**
- Commitment **não bloqueia agenda**
- Commitment **não reserva horário**

Integração é **read-only e informacional**.

---

## 9. Anti-responsabilidades (Explícitas)

OperationalCommitment **NUNCA PODE**:

- Executar pagamentos
- Decidir penalidades
- Alterar reputação
- Criar ou bloquear agenda
- Inferir consequências
- Coordenar economia
- Executar lógica de mérito

---

## 10. Relação com Estruturas Existentes

- `event_staff` (legado): assignment simples, sem lifecycle
- `event_participants`: contém economia (fora do escopo)
- `event_checkins`: dependente de ticket pago (fora do escopo)

OperationalCommitment é a **única entidade canônica puramente operacional**.

---

## 11. Garantia Institucional

Qualquer tentativa de:
- adicionar campos financeiros
- acoplar economia
- aplicar penalidade automática

➡️ **VIOLA ESTE CONTRATO** e bloqueia evolução do sistema.

---

## 12. Escopo desta Fase

Esta fase **termina aqui**.

Economia, punição, reputação ou pagamento **só podem existir em fases futuras**, sobre fatos já registrados.

