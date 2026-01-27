# FASE 6.0 — CONTRATO CANÔNICO DE CUSTÓDIA
## Custódia Econômica Institucional

Este documento define o CONTRATO CANÔNICO de custódia do UnifiCard.
Ele regula como valores são mantidos, protegidos e liberados.

VINCULANTE.

---

## PRINCÍPIO CENTRAL

Custódia NÃO é pagamento.
Custódia é retenção controlada de valor com finalidade explícita.

Nenhum valor entra em custódia sem:
- evento explícito
- autorização explícita
- finalidade explícita

---

## QUANDO A CUSTÓDIA PODE EXISTIR

A custódia só pode ser criada se:

- Evento está na Fase 6.0
- Contrato econômico foi criado
- Split ainda NÃO foi executado
- Pagamento ainda NÃO foi liberado

Custódia antecede execução.

---

## EVENTO CANÔNICO DE CRIAÇÃO

A criação de custódia ocorre SOMENTE via:

`event.custody.created`

Este evento:
- identifica o valor
- identifica o dono econômico
- identifica as condições de liberação
- é auditável

---

## O QUE A CUSTÓDIA GARANTE

- valor não pode ser gasto
- valor não pode ser redistribuído
- valor não pode ser perdido
- valor pode ser revertido

Custódia é estado seguro, não final.

---

## O QUE A CUSTÓDIA NÃO É

❌ Não é pagamento
❌ Não é receita
❌ Não é split
❌ Não é confirmação de serviço

Qualquer confusão aqui é erro grave.

---

## LIBERAÇÃO DE CUSTÓDIA

A custódia só pode ser liberada por:

- execução autorizada de pagamento
- estorno integral
- cancelamento institucional

Cada liberação gera evento auditável.

---

## REVERSIBILIDADE

Toda custódia DEVE permitir:

- estorno total
- estorno parcial (quando aplicável)
- chargeback

Sem reversão, não é custódia válida.

---

## RESPONSABILIDADES

### Sistema
- proteger o valor
- respeitar condições

### Usuário / Instituição
- decidir liberação
- autorizar execução

---

## ENCERRAMENTO

Custódia é o coração da confiança econômica.
Sem este contrato, não existe economia segura no UnifiCard.
