# FASE 5.0 — CHECKLIST DE QA E TESTES CANÔNICOS
## Event Creation Orchestration

Este documento define os TESTES OBRIGATÓRIOS da Fase 5.0.
Ele existe para impedir regressão semântica, econômica e institucional.

VINCULANTE para QA, backend e frontend.

---

## 1. TESTES DE FLUXO FELIZ (DECLARATIVO)

- [ ] Usuário cria rascunho de evento sem data, local ou custo
- [ ] Usuário declara evento (aniversário) sem executar nada
- [ ] Usuário define janelas possíveis de tempo
- [ ] Usuário define requisitos de espaço
- [ ] Usuário define papéis operacionais
- [ ] Usuário acessa preview econômico (TEST)
- [ ] Usuário visualiza resumo completo

❗ Em nenhum ponto ocorre:
- pagamento
- reserva
- confirmação

---

## 2. TESTES DE REGRESSÃO SEMÂNTICA (UX / API)

Falhar se aparecer:

- “Evento criado”
- “Confirmado”
- “Data definida”
- “Fornecedor escolhido”
- “Valor total”

Passar somente se:

- “Rascunho”
- “Possível”
- “Simulado”
- “Intervalo”

---

## 3. TESTES DE USUÁRIO CONFUSO

Simular usuário que:

- tenta “confirmar” algo inexistente
- pergunta “já está pago?”
- acredita que data está marcada

Sistema DEVE responder:
- com textos corretivos
- sem executar nada
- sem erro silencioso

---

## 4. TESTES DE USUÁRIO MALICIOSO

Simular:

- tentativa de chamar endpoint econômico
- tentativa de forçar split
- tentativa de fixar valor

Sistema DEVE:
- ignorar
- rejeitar
- nunca executar

---

## 5. TESTES PROIBIDOS (NÃO DEVEM EXISTIR)

Se qualquer teste abaixo existir, está errado:

- teste de pagamento
- teste de split
- teste de custódia
- teste de confirmação de data
- teste de contratação

Esses pertencem à Fase Econômica.

---

## 6. CRITÉRIO DE APROVAÇÃO FINAL

A Fase 5.0 só é considerada estável se:

- Todos os testes acima PASSAM
- Nenhum teste proibido existe
- Nenhuma execução econômica ocorre

---

## ENCERRAMENTO

Este checklist é a última linha de defesa da Fase 5.0.
Ignorar este documento é regressão institucional.
