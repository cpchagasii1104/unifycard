# 12 — MUTATIONS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **MUTAÇÃO** no sistema UnifiCard.

Seu objetivo é eliminar:
- mudanças implícitas de dados
- efeitos colaterais silenciosos
- lógica de “atualização espalhada”
- inconsistência entre estado, evento e transação

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Mutação é a alteração explícita e autorizada
> de um estado canônico, como resultado de uma transação válida.**

Mutação:
- NÃO é evento
- NÃO é transação
- NÃO é comando
- NÃO é side-effect

Mutação **é o ato de mudar o estado** — nada mais.

---

## 3. RELAÇÃO ENTRE OS CONCEITOS

Relação canônica e obrigatória:

Evento(s)  
→ Transação  
→ **Mutação**  
→ Novo Estado

Se não existe mutação explícita:
- o estado **não mudou**
- qualquer efeito é inválido

---

## 4. PROPRIEDADES OBRIGATÓRIAS DE UMA MUTAÇÃO

Toda mutação canônica DEVE:

- ser **explícita**
- ocorrer **uma única vez**
- estar vinculada a **uma transação**
- ser **autorizada**
- ser **auditável**
- resultar em **novo estado válido**

Mutação implícita é violação estrutural.

---

## 5. MUTAÇÃO ≠ EVENTO

- Evento registra **o que aconteceu**
- Mutação registra **o que mudou**

Exemplo:
- Evento: `company_validated`
- Mutação: `company.status = validated`

Evento pode existir sem mutação.  
Mutação **NUNCA** existe sem evento/transação.

---

## 6. MUTAÇÃO ≠ TRANSAÇÃO

- Transação garante coerência global
- Mutação executa a mudança pontual de estado

Uma transação pode conter:
- zero mutações (ex.: falhou)
- uma mutação
- múltiplas mutações coordenadas

Mas cada mutação:
- altera exatamente um estado canônico

---

## 7. MUTAÇÃO ≠ AÇÃO IMPERATIVA

Chamar:
```ts
updateStatus(...)
❌ não é mutação canônica por si só.

Só é mutação se:

existir transação válida

existir autorização explícita

existir registro auditável

existir estado final declarado

8. AUTORIZAÇÃO DE MUTAÇÕES
Toda mutação DEVE:

ser validada pelo eixo AUTORIDADE

respeitar escopo (tenant, domínio)

respeitar delegações ativas

Mutação sem autorização explícita é inválida,
mesmo que tecnicamente executável.

9. ATOMICIDADE DAS MUTAÇÕES
Regra canônica:

Ou todas as mutações de uma transação ocorrem,
ou nenhuma ocorre.

É proibido:

aplicar mutações parciais

deixar estado intermediário

persistir mutação se a transação falhou

10. MUTAÇÃO E HISTÓRICO
Toda mutação DEVE gerar histórico com:

estado anterior

estado posterior

transação associada

evento(s) causadores

responsável (CPF / Actor)

timestamp

Histórico de mutação é imutável.

11. MUTAÇÕES GLOBAIS VS CONTEXTUAIS
11.1 Mutações Globais
independem de tenant

ex.: person.status = blocked

11.2 Mutações Contextuais
válidas em um tenant específico

ex.: company.status = suspended em um tenant

O escopo da mutação DEVE ser explícito.

12. PROIBIÇÕES ABSOLUTAS
É proibido:

mutação implícita

mutação sem transação

mutação sem autorização

mutação parcial

mutação silenciosa

mutação sem histórico

mutação reversível sem nova transação

13. RELAÇÃO COM OUTROS EIXOS
Autoridade: valida se a mutação pode ocorrer

Transações: garantem coerência e atomicidade

Eventos: registram o que ocorreu

Estados: são o alvo da mutação

Tempo: registra quando ocorreu

Governança: define quem pode criar novos tipos de mutação

14. CRITÉRIO DE CONFORMIDADE
O sistema está conforme este eixo somente se:

toda mudança de estado for mutação explícita

toda mutação estiver ligada a uma transação

não existir estado alterado sem histórico

não existir side-effect silencioso

15. EVOLUÇÃO DO EIXO
Este eixo:

NÃO define estados

NÃO define eventos

NÃO define transações

NÃO define regras de negócio

Ele apenas define como estados podem mudar.

Qualquer alteração exige:

Gate formal de Governança

atualização explícita deste documento

16. REGRA FINAL
Se alguém perguntar:

“Por que isso mudou?”

A resposta correta DEVE vir de:

uma mutação explícita

ligada a uma transação

causada por evento(s)

autorizada por alguém rastreável

Se não for possível responder assim,
a mudança é inválida por definição.

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->