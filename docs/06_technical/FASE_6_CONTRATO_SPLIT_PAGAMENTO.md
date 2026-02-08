# FASE 6.0 — CONTRATO CANÔNICO DE SPLIT
## Split de Pagamento Institucional

Este documento define o CONTRATO CANÔNICO de split de pagamento do UnifiCard.
Ele regula como valores custodiados são distribuídos entre partes.

VINCULANTE.

---

## PRINCÍPIO CENTRAL

Split NÃO é pagamento.
Split é cálculo declarativo de distribuição futura.

Nenhum valor é transferido no split.
Nenhum dinheiro se move aqui.

---

## PRÉ-REQUISITOS PARA EXISTIR SPLIT

Split só pode ser calculado se:

- Evento está na Fase 6.0
- Custódia foi criada
- Papéis econômicos estão definidos
- Regras de distribuição foram aprovadas

Sem custódia, não existe split.

---

## EVENTO CANÔNICO DE CÁLCULO

O cálculo de split ocorre SOMENTE via:

`event.split.calculated`

Este evento:
- NÃO transfere valores
- NÃO executa pagamento
- Define percentuais, valores-alvo e partes

---

## O QUE O SPLIT DEFINE

- Quem receberá
- Quanto receberá
- Sob quais condições
- Em qual ordem (se aplicável)

Tudo permanece DECLARATIVO até execução.

---

## O QUE O SPLIT NÃO FAZ

❌ Não paga
❌ Não transfere
❌ Não libera custódia
❌ Não cria receita

Confundir split com pagamento é erro institucional.

---

## ALTERAÇÃO DE SPLIT

Split pode ser:

- recalculado
- revisado
- invalidado

Desde que:
- custódia ainda não tenha sido liberada
- alterações sejam auditáveis

---

## EXECUÇÃO POSTERIOR

O split só é usado quando:

- pagamento é explicitamente autorizado
- execução é iniciada

Mesmo assim:
- execução gera eventos próprios
- split não “se autoexecuta”

---

## REVERSIBILIDADE

Split DEVE permitir:

- cancelamento antes da execução
- reprocessamento após estorno
- rastreabilidade completa

---

## ENCERRAMENTO

Split é mapa.
Pagamento é movimento.

Confundir os dois destrói confiança econômica.
