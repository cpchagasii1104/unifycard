# HANDOFF CANÔNICO — FASE 5.0 → FASE ECONÔMICA
## Contrato de Transição Institucional

Este documento define QUANDO e COMO um evento
sai da Fase 5.0 (declaração/simulação)
e entra na Fase Econômica (execução real).

Ele é VINCULANTE.

---

## PRINCÍPIO CENTRAL

Nada da Fase Econômica pode acontecer
enquanto o evento estiver na Fase 5.0.

A transição é EXPLÍCITA, nunca implícita.

---

## PRÉ-REQUISITOS PARA SAIR DA FASE 5.0

Todos DEVEM ser verdadeiros:

- [ ] Evento está em estado RASCUNHO COMPLETO
- [ ] Usuário visualizou resumo completo
- [ ] Usuário executou CTA explícito:
      “Avançar para fase econômica”
- [ ] Nenhum pagamento foi iniciado
- [ ] Nenhuma agenda foi reservada
- [ ] Nenhum fornecedor foi contratado

---

## EVENTO DE TRANSIÇÃO (OBRIGATÓRIO)

A entrada na Fase Econômica só ocorre via:

EVENTO INSTITUCIONAL:
`event.advance_to_economic_phase`

Este evento:
- é auditável
- é explícito
- exige autorização do usuário
- NÃO executa economia por si só

---

## O QUE MUDA APÓS O HANDOFF

Somente após o handoff:

- contratos passam a existir
- políticas econômicas se aplicam
- custódia pode ser criada
- split pode ser calculado
- pagamentos podem ser preparados

Nada disso ocorre automaticamente.

---

## O QUE CONTINUA PROIBIDO (ATÉ EXECUÇÃO)

Mesmo após o handoff:

- pagamento automático
- split sem aprovação
- execução sem aceite explícito

A Fase Econômica também é controlada.

---

## RESPONSABILIDADES

### Fase 5.0
- declarar
- simular
- consolidar

### Fase Econômica
- contratar
- custodiar
- pagar
- executar

Misturar responsabilidades é quebra institucional.

---

## ENCERRAMENTO

Este documento é a fronteira formal
entre “pensar o evento”
e “assumir obrigações reais”.

Qualquer execução sem este handoff
é INVALIDAÇÃO INSTITUCIONAL.
