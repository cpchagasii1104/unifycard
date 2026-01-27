# FASE 6.0 — CHECKLIST CANÔNICO DE QA
## Execução Econômica Controlada

Este documento define os TESTES OBRIGATÓRIOS da Fase 6.0.
Ele é a última barreira antes de dinheiro real.

VINCULANTE para QA, backend, produto e auditoria.

---

## 1. TESTES DE PRÉ-CONDICÃO (HANDOFF)

- [ ] Evento NÃO entra na Fase 6.0 sem handoff explícito
- [ ] Evento `event.advance_to_economic_phase` existe e é auditável
- [ ] Tentativa de executar economia sem handoff falha explicitamente

---

## 2. TESTES DE CUSTÓDIA

- [ ] Custódia só pode ser criada via `event.custody.created`
- [ ] Custódia NÃO:
  - transfere valores
  - executa pagamento
- [ ] Custódia identifica corretamente:
  - valor
  - dono econômico
  - finalidade
- [ ] Custódia pode ser revertida

---

## 3. TESTES DE SPLIT

- [ ] Split só pode ser calculado se custódia existir
- [ ] Split é declarativo (nenhum dinheiro se move)
- [ ] Split pode ser invalidado antes da execução
- [ ] Split inválido não pode ser executado

---

## 4. TESTES DE AUTORIZAÇÃO DE PAGAMENTO

- [ ] Pagamento NÃO executa sem autorização explícita
- [ ] Autorização gera evento `event.payment.authorized`
- [ ] Revogação funciona antes da execução
- [ ] Nenhuma autorização executa automaticamente

---

## 5. TESTES DE EXECUÇÃO DE PAGAMENTO

- [ ] Execução só ocorre após autorização explícita
- [ ] Execução gera evento próprio
- [ ] Execução respeita split declarado
- [ ] Execução libera custódia corretamente

---

## 6. TESTES DE ESTORNO

- [ ] Estorno pode ocorrer antes da execução
- [ ] Estorno pode ocorrer após a execução
- [ ] Estorno parcial funciona (quando aplicável)
- [ ] Estorno gera eventos auditáveis
- [ ] Custódia é revertida corretamente

---

## 7. TESTES DE CHARGEBACK

- [ ] Chargeback congela novas execuções
- [ ] Chargeback preserva histórico econômico
- [ ] Chargeback permite reconciliação posterior
- [ ] Nenhum dado é apagado

---

## 8. TESTES DE USUÁRIO MALICIOSO

Simular usuário que tenta:

- executar pagamento sem autorização
- burlar custódia
- forçar split implícito
- apagar histórico

Sistema DEVE:
- rejeitar
- logar
- nunca executar

---

## 9. TESTES PROIBIDOS (NÃO DEVEM EXISTIR)

Se qualquer teste abaixo existir, a fase está ERRADA:

- pagamento automático
- split automático
- custódia silenciosa
- correção manual de saldo
- execução sem evento

---

## CRITÉRIO FINAL DE APROVAÇÃO

A Fase 6.0 só é considerada estável se:

- Todos os testes acima PASSAM
- Nenhum teste proibido existe
- Nenhuma execução implícita ocorre

---

## ENCERRAMENTO

Este checklist protege dinheiro real,
reputação institucional e continuidade do sistema.

Ignorar este documento
é assumir risco consciente.
