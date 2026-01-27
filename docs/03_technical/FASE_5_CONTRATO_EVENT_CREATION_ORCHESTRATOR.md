# FASE 5.0 — CONTRATO TÉCNICO
## Event Creation Orchestrator

Este documento define o CONTRATO TÉCNICO obrigatório do
Event Creation Orchestrator da Fase 5.0.

Ele é VINCULANTE para backend e revisão de PR.

---

## OBJETIVO DO ORQUESTRADOR

O Event Creation Orchestrator existe para:
- Encadear chamadas já existentes
- Consolidar estados declarativos
- Não criar regras
- Não executar efeitos

Ele é COLA, não cérebro.

---

## O QUE ELE PODE FAZER

- Chamar services já existentes de:
  - criação de rascunho
  - declaração de evento
  - definição de janelas
  - definição de papéis operacionais
  - preview econômico (TEST)
- Agregar respostas
- Normalizar payload de saída

---

## O QUE ELE NÃO PODE FAZER

❌ Proibido:

- Criar regra de negócio
- Validar domínio
- Criar pagamento
- Criar split
- Criar custódia
- Reservar agenda
- Persistir ledger

Se fizer qualquer um desses pontos, está errado.

---

## DEPENDÊNCIAS PERMITIDAS

- event.service
- availability.service
- commitment.service
- test-currency.service (somente leitura / simulação)
- read-models declarativos

---

## DEPENDÊNCIAS PROIBIDAS

- payment.service
- split.service
- custody.service
- ledger.service
- qualquer serviço com side-effect econômico

---

## INPUT ESPERADO

- event_draft_id
- payload declarativo da etapa atual
- contexto do usuário (auth)

Nenhum input financeiro real.

---

## OUTPUT GARANTIDO

- estado atual do rascunho
- dados declarativos consolidados
- preview econômico em TEST (quando aplicável)

Nenhuma confirmação.
Nenhum efeito.

---

## TRATAMENTO DE ERROS

- erro de validação → retorna erro declarativo
- erro de dependência → falha explícita
- erro econômico → NÃO DEVE EXISTIR

---

## REGRA DE OURO

Se o orquestrador começar a:
“decidir”,
“otimizar”,
“facilitar”

Ele violou este contrato.

---

## ENCERRAMENTO

Este contrato existe para impedir:
- mega-services
- lógica escondida
- execução prematura

Qualquer PR que viole este documento
DEVE SER BLOQUEADO.
