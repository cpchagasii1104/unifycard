# FASE 6.0 — CHECKLIST CANÔNICO DE PR
## Execução Econômica Controlada

Este checklist é OBRIGATÓRIO para qualquer PR da Fase 6.0.
PR que não passa aqui NÃO SOBE.

VINCULANTE.

---

## 1. PREMISSAS GERAIS

- [ ] Evento já passou pelo handoff da Fase 5.0
- [ ] Evento está explicitamente na Fase 6.0
- [ ] Existe evento institucional que justifica a execução
- [ ] Existe autorização explícita do usuário

Sem isso, qualquer execução é inválida.

---

## 2. CUSTÓDIA

- [ ] Custódia só é criada via `event.custody.created`
- [ ] Custódia identifica:
  - valor
  - dono econômico
  - condições de liberação
- [ ] Custódia não executa pagamento
- [ ] Custódia permite reversão

❌ PROIBIDO:
- custódia silenciosa
- saldo travado sem evento

---

## 3. SPLIT

- [ ] Split só é calculado após custódia existir
- [ ] Split é declarativo (não transfere)
- [ ] Split é auditável
- [ ] Split pode ser invalidado antes da execução

❌ PROIBIDO:
- split implícito
- split que paga automaticamente

---

## 4. PAGAMENTO

- [ ] Pagamento só ocorre após autorização explícita
- [ ] Pagamento gera evento próprio
- [ ] Pagamento é rastreável
- [ ] Pagamento pode ser revertido

❌ PROIBIDO:
- pagamento automático
- execução sem aceite

---

## 5. ESTORNO / CHARGEBACK

- [ ] Estorno é suportado em todos os estados possíveis
- [ ] Chargeback congela novas execuções
- [ ] Histórico econômico nunca é apagado
- [ ] Ajustes são sempre por evento

❌ PROIBIDO:
- correção manual sem log
- apagar histórico

---

## 6. SEMÂNTICA E API

- [ ] Nenhum endpoint executa sem evento
- [ ] Nenhuma resposta cria promessa implícita
- [ ] Verbos usados são precisos (autorizar, executar, reverter)

---

## 7. KILL SWITCH

Bloquear PR se existir:

- execução automática
- efeito econômico implícito
- valor movido sem custódia
- ausência de auditoria

---

## ENCERRAMENTO

Este checklist protege dinheiro real.

Quebrar este checklist
é quebrar o UnifiCard.
