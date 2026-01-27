# FASE 6.0 — FLUXO CANÔNICO DE ESTORNO E CHARGEBACK
## Estorno e Reversão como CORE

Este documento define o FLUXO CANÔNICO de estorno e chargeback do UnifiCard.
Ele é CORE do sistema econômico, não exceção.

VINCULANTE.

---

## PRINCÍPIO CENTRAL

Toda execução econômica DEVE ser reversível.

Se não pode ser estornado:
→ não pode ser executado.

---

## TIPOS DE REVERSÃO

O sistema deve suportar explicitamente:

- Estorno antes da execução
- Estorno após execução
- Estorno parcial
- Chargeback externo (ex: adquirente)
- Cancelamento institucional

Cada tipo é tratado como EVENTO.

---

## EVENTOS CANÔNICOS

Exemplos obrigatórios:

- event.refund.requested
- event.refund.approved
- event.refund.executed
- event.chargeback.initiated
- event.chargeback.resolved
- event.custody.reverted

Todos:
- auditáveis
- com autor
- com motivo

---

## ORDEM CORRETA DE REVERSÃO

### Caso padrão

1. Suspender novas execuções
2. Avaliar estado da custódia
3. Reverter custódia (se possível)
4. Ajustar split (se aplicável)
5. Executar estorno
6. Registrar eventos

Nunca o contrário.

---

## RELAÇÃO COM CUSTÓDIA

- Se custódia ainda existe:
  - estorno é direto
- Se custódia já foi liberada:
  - estorno gera compensação futura
  - nunca “apaga” histórico

---

## RELAÇÃO COM SPLIT

- Split calculado pode ser:
  - invalidado
  - recalculado
- Split executado:
  - gera eventos de compensação
  - nunca é silencioso

---

## CHARGEBACK

Chargeback é:
- evento externo
- prioridade máxima
- sempre auditável

Sistema deve:
- congelar execuções
- preservar rastreabilidade
- permitir reconciliação

---

## O QUE É PROIBIDO

❌ Estorno automático sem evento
❌ Ajuste manual sem log
❌ Apagar histórico econômico
❌ “Corrigir saldo” silenciosamente

---

## ENCERRAMENTO

Estorno não é falha.
É prova de sistema sério.

Economia sem reversão
é economia irresponsável.
