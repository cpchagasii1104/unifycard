# FASE 6.0 — ENDPOINTS ECONÔMICOS V2
## Exposição Controlada da Economia

Este documento define os ENDPOINTS ECONÔMICOS V2 do UnifiCard.
Eles expõem ações econômicas de forma explícita, auditável e controlada.

VINCULANTE.

---

## PRINCÍPIO CENTRAL

Nenhum endpoint executa economia implicitamente.
Todo endpoint:
- exige evento explícito
- exige autorização explícita
- gera auditoria

---

## BASE PATH

Todos os endpoints econômicos usam:

/events/:eventId/economic/v2

---

## 1. HANDOFF PARA FASE ECONÔMICA

POST /events/:eventId/economic/v2/advance

Função:
- Executar handoff da Fase 5.0 → Fase 6.0

Requisitos:
- Evento em RASCUNHO COMPLETO
- Aceite explícito do usuário

Evento emitido:
- event.advance_to_economic_phase

---

## 2. CUSTÓDIA

POST /events/:eventId/economic/v2/custody

Função:
- Criar custódia

Requisitos:
- Evento na Fase 6.0
- Valor e finalidade explícitos

Evento emitido:
- event.custody.created

GET /events/:eventId/economic/v2/custody
- Retorna estado atual da custódia (read-only)

---

## 3. SPLIT DECLARATIVO

POST /events/:eventId/economic/v2/split

Função:
- Calcular split declarativo

Requisitos:
- Custódia ativa
- Regras aprovadas

Evento emitido:
- event.split.calculated

GET /events/:eventId/economic/v2/split
- Retorna split atual (read-only)

---

## 4. AUTORIZAÇÃO DE PAGAMENTO

POST /events/:eventId/economic/v2/payment/authorize

Função:
- Autorizar pagamento

Requisitos:
- Custódia ativa
- Split calculado
- Autorização explícita do usuário

Evento emitido:
- event.payment.authorized

POST /events/:eventId/economic/v2/payment/revoke
- Revoga autorização antes da execução

---

## 5. EXECUÇÃO DE PAGAMENTO

POST /events/:eventId/economic/v2/payment/execute

Função:
- Executar pagamento real

Requisitos:
- Autorização existente
- Nenhum bloqueio ativo
- Confirmação explícita

Evento emitido:
- event.payment.executed

---

## 6. ESTORNO

POST /events/:eventId/economic/v2/refund

Função:
- Solicitar estorno

Eventos possíveis:
- event.refund.requested
- event.refund.approved
- event.refund.executed

---

## 7. CHARGEBACK

POST /events/:eventId/economic/v2/chargeback

Função:
- Iniciar chargeback externo

Evento emitido:
- event.chargeback.initiated

POST /events/:eventId/economic/v2/chargeback/resolve
- Resolver chargeback

Evento emitido:
- event.chargeback.resolved

---

## O QUE É PROIBIDO

❌ Endpoint que execute sem evento
❌ Endpoint que pule custódia
❌ Endpoint que combine autorização + execução
❌ Endpoint que oculte efeito econômico

---

## ENCERRAMENTO

Estes endpoints são a ÚNICA porta de entrada
para economia real no UnifiCard.

Qualquer execução fora deles
é violação institucional.
