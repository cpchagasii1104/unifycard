# FASE 6.2 — PAGAMENTO SANDBOX GUIADO
## Execução Econômica End-to-End (Ambiente de Teste)

Este documento define o ROTEIRO CANÔNICO para realizar
o PRIMEIRO PAGAMENTO SANDBOX no UnifiCard.

Objetivo: testar tudo em conjunto, sem risco real.

VINCULANTE.

---

## PRINCÍPIO CENTRAL

Sandbox não é atalho.
Sandbox segue o MESMO fluxo da produção,
apenas com provedores e valores de teste.

---

## PRÉ-REQUISITOS OBRIGATÓRIOS

Antes de iniciar:

- [ ] Evento passou pela Fase 5.0
- [ ] Evento está na Fase 6.0
- [ ] Endpoints Econômicos V2 estão ativos
- [ ] UX Econômica segue o Contrato de UX
- [ ] Ambiente configurado como SANDBOX

Sem isso, NÃO iniciar.

---

## PASSO 1 — CRIAR CUSTÓDIA (SANDBOX)

Endpoint:
POST /events/:eventId/economic/v2/custody

Validar:
- evento gerado: event.custody.created
- valor em custódia visível na UI
- nenhum dinheiro real movimentado

---

## PASSO 2 — CALCULAR SPLIT

Endpoint:
POST /events/:eventId/economic/v2/split

Validar:
- event.split.calculated emitido
- split visível (papéis, percentuais)
- nenhum valor transferido

---

## PASSO 3 — AUTORIZAR PAGAMENTO

Endpoint:
POST /events/:eventId/economic/v2/payment/authorize

Validar:
- event.payment.authorized emitido
- UI deixa claro: “não executado”
- autorização pode ser revogada

---

## PASSO 4 — EXECUTAR PAGAMENTO (SANDBOX)

Endpoint:
POST /events/:eventId/economic/v2/payment/execute

Validar:
- event.payment.executed emitido
- custódia liberada corretamente
- split respeitado
- provedor sandbox usado

---

## PASSO 5 — ESTORNO (SANDBOX)

Endpoint:
POST /events/:eventId/economic/v2/refund

Validar:
- refund.requested → approved → executed
- histórico preservado
- compensação correta

---

## PASSO 6 — CHARGEBACK (SANDBOX)

Endpoint:
POST /events/:eventId/economic/v2/chargeback

Validar:
- chargeback.initiated emitido
- novas execuções bloqueadas
- resolução funciona

---

## CRITÉRIO DE SUCESSO FINAL

Sandbox é considerado aprovado se:

- Todos os eventos foram emitidos corretamente
- Nenhuma execução implícita ocorreu
- UX nunca deu sensação falsa
- Estorno e chargeback funcionaram

---

## ENCERRAMENTO

Somente após este roteiro passar,
o UnifiCard está autorizado a:
→ habilitar produção real.

Sandbox bem feito
é produção sem trauma.
