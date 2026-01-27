# DECISION SAFETY & CONTAINMENT CONTRACT
Status: CANONICAL · BINDING · CORE

Este documento define as regras supremas de contenção decisória,
arquitetural e comportamental do sistema UnifiCard.

Ele substitui qualquer guideline, guardrail ou instrução paralela.
Em caso de conflito, ESTE DOCUMENTO PREVALECE.

---

## PRINCÍPIO FUNDAMENTAL

> **If it changes behavior, it is a decision.**

Nenhuma mudança de comportamento do sistema pode existir
sem uma decisão explícita, versionada e auditável.

---

## DEFINIÇÃO DE DECISÃO

Uma **decisão** ocorre quando o sistema:

- altera comportamento,
- restringe ou libera ações,
- prioriza, filtra ou ordena resultados,
- escolhe caminhos,
- executa algo sem intervenção humana direta.

Se algo **muda o que acontece**, é uma decisão — sem exceções.

---

## REQUISITOS OBRIGATÓRIOS PARA QUALQUER DECISÃO

Toda decisão DEVE possuir:

1. **Domínio explícito**
   - Onde a decisão se aplica
   - Quem é afetado

2. **Evento imutável**
   - A decisão deve gerar um registro imutável (event)
   - Nunca apenas estado mutável

3. **Versão da regra**
   - Toda decisão precisa apontar qual regra a originou
   - Regras nunca são implícitas

4. **Trilha de auditoria**
   - Quem decidiu
   - Quando decidiu
   - Por qual regra decidiu

Sem esses quatro elementos, a decisão é **inválida**.

---

## O QUE É ESTRITAMENTE PROIBIDO

É terminantemente proibido ao sistema:

- Decidir por **estado mutável**
- Decidir por **score**
- Decidir por **categoria**
- Decidir por **heurística implícita**
- Decidir por **aprendizado automático não auditável**
- Inferir intenção humana
- Tomar decisões silenciosas ou invisíveis
- “Otimizar” fora de contrato
- “Dar um jeito” arquitetural

Se não pode ser auditado, **não pode existir**.

---

## CONTENÇÃO ARQUITETURAL

- Engines podem **avaliar**, **simular**, **sugerir**
- Engines **NÃO DECIDEM**
- IA **NÃO EXECUTA**
- IA **NÃO ESCOLHE**
- IA **NÃO PRIORITIZA**

O sistema:
- sugere
- explica
- expõe opções

O humano:
- decide
- confirma
- executa

---

## FERRAMENTAS, AGENTES E IAs

Qualquer IA, agente ou ferramenta:

- Está subordinada a este contrato
- Não possui autonomia decisória
- Deve sempre apontar:
  - qual regra autoriza a ação
  - qual documento canônico sustenta a proposta

Ferramentas (ex: Cursor, copilots, scripts):
- NÃO criam exceções
- NÃO flexibilizam regras
- NÃO substituem contratos

---

## REGRA DE OURO

> **Na dúvida, NÃO DECIDA.**

Explique o conflito.
Aponte o risco.
Solicite validação humana.

Silêncio ou inferência são violações graves.

---

## STATUS

Este documento é:
- CANÔNICO
- IMUTÁVEL (exceto por versionamento formal)
- OBRIGATÓRIO

Qualquer violação a este contrato invalida a implementação.
