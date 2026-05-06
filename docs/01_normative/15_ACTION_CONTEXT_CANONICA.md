# 15 — ACTION CONTEXT CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **ACTION CONTEXT** no sistema UnifiCard.

Seu objetivo é eliminar:
- decisões de ação sem contexto explícito
- permissões avaliadas “no vácuo”
- auditorias incompletas
- execuções sem lastro operacional

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Action Context é a descrição completa, explícita e imutável
> do contexto no qual uma ação é avaliada e executada.**

Action Context:
- NÃO é identidade
- NÃO é autoridade
- NÃO é permissão
- NÃO é policy
- NÃO é ação em si

Action Context **explica o “agora”** da decisão.

---

## 3. POR QUE ACTION CONTEXT EXISTE

Sem Action Context:
- permissões não são reproduzíveis
- decisões não são auditáveis
- erros não são explicáveis
- segurança vira suposição

Action Context existe para garantir:
- determinismo
- rastreabilidade
- reexecução lógica
- auditoria confiável

---

## 4. ELEMENTOS OBRIGATÓRIOS DO ACTION CONTEXT

Todo Action Context canônico DEVE conter:

- **Actor** (quem está agindo)
- **Ação solicitada**
- **Recurso alvo**
- **Escopo** (tenant, domínio)
- **Timestamp**
- **Resultado da autoridade prévia**
- **Permissões avaliadas**
- **Policies avaliadas**

Contexto incompleto é inválido.

---

## 5. ACTION CONTEXT ≠ IDENTIDADE

Identidade:
- responde quem é a pessoa

Action Context:
- responde **quem está agindo agora**

Action Context SEM Actor é proibido.

---

## 6. ACTION CONTEXT ≠ AUTORIDADE

Autoridade:
- define legitimidade estrutural

Action Context:
- consome autoridade já delegada

Action Context **não cria poder**.

---

## 7. ACTION CONTEXT ≠ PERMISSÃO / POLICY

- Permissão: “essa ação existe?”
- Policy: “essa ação pode agora?”
- Action Context: “essas foram as condições completas da decisão”

Action Context **registra**, não decide.

---

## 8. ACTION CONTEXT ≠ EVENTO

Evento:
- registra o que aconteceu

Action Context:
- registra **por que foi permitido acontecer**

Evento pode existir sem Action Context explícito.
Ação **não pode**.

---

## 9. ACTION CONTEXT E DETERMINISMO

Regra canônica:

> **Dado o mesmo Action Context,
> a decisão DEVE ser a mesma.**

Se a decisão muda sem mudança de contexto:
→ o sistema é inconsistente.

---

## 10. ACTION CONTEXT E AUDITORIA

Auditoria DEVE conseguir responder:

- quem executou
- o que tentou executar
- em qual escopo
- com quais permissões
- sob quais policies
- por que foi permitido ou negado

Se não for possível:
→ Action Context é inválido.

---

## 11. ACTION CONTEXT E SEGURANÇA

Action Context é **barreira de segurança**, não conveniência.

É proibido:
- executar ação sem Action Context
- inferir contexto implicitamente
- reutilizar contexto parcialmente

---

## 12. ACTION CONTEXT E TRANSAÇÕES

Toda transação DEVE:

- ser iniciada sob um Action Context válido
- referenciar esse contexto
- herdar escopo e ator

Transação sem Action Context é inválida.

---

## 13. ACTION CONTEXT E HISTÓRICO

Action Context:
- NÃO é mutável
- NÃO é corrigido
- NÃO é apagado

Se algo foi avaliado errado:
- novo Action Context
- nova tentativa
- histórico preservado

---

## 14. PROIBIÇÕES ABSOLUTAS

É proibido:

- Action Context implícito
- Action Context parcial
- Action Context sem Actor
- Action Context sem escopo
- Action Context reconstruído por inferência
- Action Context mutável

---

## 15. RELAÇÃO COM OUTROS EIXOS

- **Autoridade**: valida delegação
- **Permissões**: são avaliadas no contexto
- **Policies**: decidem no contexto
- **Eventos**: registram resultado
- **Transações**: executam sob contexto
- **Governança**: define quem pode exigir contexto

---

## 16. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- nenhuma ação ocorre sem Action Context
- decisões são reproduzíveis
- auditoria consegue explicar cada decisão
- não existe execução “mágica”

---

## 17. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define permissões
- NÃO define policies
- NÃO define autoridade
- NÃO define regras de negócio

Ele apenas **define o contexto obrigatório da decisão**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 18. REGRA FINAL

Se alguém perguntar:

> “Por que essa ação aconteceu?”

A resposta correta DEVE vir de:
- um Action Context explícito
- com Actor, escopo e regras avaliadas
- que torne a decisão explicável e reproduzível

Se não for possível responder assim,
**a ação é inválida por definição**.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->