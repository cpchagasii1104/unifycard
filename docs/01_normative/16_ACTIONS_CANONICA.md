# 16 — ACTIONS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **AÇÃO (ACTION)** no sistema UnifiCard.

Seu objetivo é eliminar:
- ações implícitas
- efeitos colaterais não rastreáveis
- confusão entre ação, comando, evento e mutação
- execuções fora de contexto canônico

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Ação é a execução efetiva e concreta
> de uma intenção validada, dentro de um Action Context válido.**

Ação:
- É o que **realmente acontece**
- É executável
- Produz efeitos reais

Ação **não é intenção**,  
ação **não é decisão**,  
ação **não é registro**.

---

## 3. ACTION ≠ COMANDO

- **Comando**: pedido para executar
- **Ação**: execução de fato

Um comando:
- pode ser rejeitado

Uma ação:
- só existe se foi executada

Registrar comando **não significa** que houve ação.

---

## 4. ACTION ≠ EVENTO

- **Evento**: registro de que algo aconteceu
- **Ação**: o ato que causou o evento

Uma ação:
- pode gerar zero, um ou vários eventos

Evento **nunca substitui** ação.

---

## 5. ACTION ≠ MUTAÇÃO

- **Ação**: execução operacional
- **Mutação**: alteração explícita de estado

Uma ação:
- pode não mutar estado
- pode causar múltiplas mutações

Mutação **não é** a ação em si.

---

## 6. PRÉ-REQUISITOS OBRIGATÓRIOS DE UMA AÇÃO

Nenhuma ação pode ocorrer sem:

- **Actor válido**
- **Action Context completo**
- **Autoridade previamente delegada**
- **Permissões avaliadas**
- **Policies avaliadas**
- **Escopo explícito**

Ação sem qualquer um desses elementos é inválida.

---

## 7. ACTION E AUTORIDADE

Toda ação:
- DEVE ser permitida pelo eixo **AUTORIDADE**
- NÃO cria autoridade
- NÃO amplia poder

Ação **consome** autoridade, não a gera.

---

## 8. ACTION E PERMISSÕES / POLICIES

Antes de executar uma ação:

1. Permissões são verificadas
2. Policies são avaliadas
3. A decisão é tomada
4. A ação é executada (ou não)

Ação **não decide** se pode ocorrer.

---

## 9. ACTION E ACTION CONTEXT

Regra canônica:

> **Toda ação existe dentro de um Action Context.**

Action Context:
- explica por que a ação foi permitida
- garante determinismo
- viabiliza auditoria

Ação fora de Action Context é violação estrutural.

---

## 10. ACTION E TRANSAÇÕES

Uma ação:
- pode iniciar uma transação
- pode fazer parte de uma transação
- pode falhar dentro de uma transação

Mas:
- transação **nunca** ocorre sem ação
- ação **nunca** burla a transação

---

## 11. ACTION E EFEITOS COLATERAIS

É proibido:
- ação com efeito colateral silencioso
- ação que muta estado fora de mutação explícita
- ação que “resolve tudo sozinha”

Todos os efeitos devem ser:
- explícitos
- rastreáveis
- auditáveis

---

## 12. ACTIONS GLOBAIS VS CONTEXTUAIS

### 12.1 Ações Globais
- independem de tenant
- ex.: `block_person`

### 12.2 Ações Contextuais
- dependem de tenant ou domínio
- ex.: `validate_company`, `transfer_funds`

O escopo da ação DEVE ser explícito.

---

## 13. HISTÓRICO DE AÇÕES

Toda ação DEVE gerar histórico mínimo:

- qual ação foi executada
- por qual Actor
- em qual Action Context
- com qual resultado (sucesso / falha)
- quando ocorreu

Ação sem histórico é inválida.

---

## 14. PROIBIÇÕES ABSOLUTAS

É proibido:

- ação implícita
- ação sem Action Context
- ação sem Actor
- ação sem autoridade
- ação sem permissão avaliada
- ação que cria poder
- ação sem histórico

---

## 15. RELAÇÃO COM OUTROS EIXOS

- **Autoridade**: valida poder
- **Permissões**: autorizam execução
- **Policies**: avaliam contexto
- **Action Context**: contextualiza decisão
- **Transações**: garantem coerência
- **Mutações**: alteram estado
- **Eventos**: registram ocorrido
- **Estados**: refletem resultado

---

## 16. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- nenhuma ação ocorre fora de Action Context
- toda ação é autorizada
- toda ação é auditável
- não existem efeitos colaterais invisíveis

---

## 17. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define permissões
- NÃO define policies
- NÃO define autoridade
- NÃO define regras de negócio

Ele apenas **define o que é executar algo de verdade**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 18. REGRA FINAL

Se alguém perguntar:

> “Isso foi realmente executado?”

A resposta correta DEVE vir de:
- uma ação explícita
- registrada
- autorizada
- contextualizada
- auditável

Se não for possível responder assim,
**a execução é inválida por definição**.

---

FIM DO DOCUMENTO
