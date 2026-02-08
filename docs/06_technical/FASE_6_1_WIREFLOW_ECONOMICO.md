# FASE 6.1 — WIREFLOW ECONÔMICO CANÔNICO
## Fluxo de Telas — Economia Real (UX Segura)

Este documento descreve o WIREFLOW CANÔNICO do frontend econômico do UnifiCard.
Ele define a ordem das telas, estados visuais e ações permitidas.

VINCULANTE.

---

## VISÃO GERAL DO FLUXO

Entrada:
Evento já passou pelo handoff da Fase 5.0

Saída:
Economia executada, revertida ou encerrada

Nenhuma tela executa mais de uma ação econômica.

---

## TELA 1 — VISÃO GERAL ECONÔMICA

### Mostra:
- Status do evento (Fase 6.0)
- Indicador de custódia
- Indicador de split
- Indicador de autorização
- Indicador de execução

### NÃO mostra:
- Botão de pagar direto
- Valores finais absolutos sem contexto

### Ações permitidas:
- Criar custódia (se inexistente)

---

## TELA 2 — CUSTÓDIA

### Mostra:
- Valor em custódia
- Finalidade
- Dono econômico
- Status (ativa / revertida)

### Ações:
- Criar custódia
- Reverter custódia (se permitido)

Nenhuma execução ocorre aqui.

---

## TELA 3 — SPLIT

### Mostra:
- Papéis econômicos
- Percentuais / valores-alvo
- Versão da regra

### Ações:
- Calcular split
- Invalidar split

Split é sempre declarativo.

---

## TELA 4 — AUTORIZAÇÃO DE PAGAMENTO

### Mostra:
- Valor autorizado
- Aviso claro:
  “Autorizar não executa pagamento”

### Ações:
- Autorizar pagamento
- Revogar autorização

Confirmação obrigatória.

---

## TELA 5 — EXECUÇÃO DE PAGAMENTO

### Mostra:
- Valor a executar
- Aviso:
  “Execução move dinheiro real”

### Ações:
- Executar pagamento

Botão com confirmação dupla.

---

## TELA 6 — ESTORNO / CHARGEBACK

### Mostra:
- Histórico de execução
- Opções de estorno
- Status de chargeback

### Ações:
- Solicitar estorno
- Iniciar chargeback

---

## REGRA DE NAVEGAÇÃO

- Não pular telas
- Não executar fora de ordem
- Estados bloqueiam telas seguintes

---

## REGRA DE QA FINAL

Pergunta obrigatória:

“Em qual tela o usuário pode achar que já pagou?”

Resposta correta:
Somente na TELA 5, após execução.

---

## ENCERRAMENTO

Este wireflow garante que:
- o usuário entende o que está fazendo
- o sistema não cria expectativa falsa
- a economia é transparente e segura
