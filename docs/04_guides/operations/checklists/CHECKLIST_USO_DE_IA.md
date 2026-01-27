# CHECKLIST — USO DE IA

## Status
ATIVO • OBRIGATÓRIO • PREVENÇÃO DE FALHA HUMANA E DE IA

Este checklist deve ser utilizado
ANTES de qualquer uso de IA no projeto UnifiCard
(ChatGPT, Cursor, Copilot, ou qualquer outra).

Se qualquer item falhar → **NÃO PROSSIGA**.

---

## 1. INTENÇÃO CLARA

- [ ] Sei exatamente o que quero que a IA faça?
- [ ] A tarefa é EXECUÇÃO, AUDITORIA ou HARDENING?
- [ ] Não estou pedindo opinião, estratégia ou decisão?

IA sem intenção clara inventa.

---

## 2. MODO CORRETO

- [ ] Estou usando o PROMPT CANÔNICO correto?
  - Execução → `PROMPT_CANONICO_EXECUCAO_CURSOR.md`
  - Auditoria → `PROMPT_CANONICO_AUDITORIA.md`
  - Hardening → `PROMPT_CANONICO_HARDENING.md`
- [ ] O prompt declara explicitamente o modo?

IA sem modo definido sai do trilho.

---

## 3. AUTONOMIA ZERO

- [ ] Deixei explícito que a IA NÃO tem autonomia?
- [ ] Proibi decisões, criatividade e expansão de escopo?
- [ ] Dei instruções de parada em caso de ambiguidade?

IA sem limite decide sozinha.

---

## 4. ESCOPO EXPLÍCITO

- [ ] Declarei quais arquivos PODE tocar?
- [ ] Declarei quais arquivos NÃO PODE tocar?
- [ ] Declarei se pode ou não criar arquivos/pastas?

Escopo implícito é armadilha clássica.

---

## 5. CONTEXT E DOMAIN

- [ ] IA foi instruída a NÃO inferir `context`?
- [ ] IA foi instruída a NÃO inferir `domain`?
- [ ] IA sabe que deve PARAR se isso estiver ambíguo?

Context/domain inferidos = bug silencioso.

---

## 6. SSOT E GOVERNANÇA

- [ ] IA sabe qual é o SSOT relevante?
- [ ] IA foi instruída a NÃO criar fontes paralelas?
- [ ] IA foi instruída a NÃO “corrigir” divergências sozinha?

IA não reconcilia verdades.

---

## 7. PROIBIÇÕES CRÍTICAS

- [ ] IA foi proibida de:
  - criar context
  - criar domain
  - refatorar arquitetura
  - “melhorar” código fora do pedido
  - criar decisões implícitas

Se não foi proibido explicitamente, a IA tenta.

---

## 8. DOCUMENTAÇÃO E RASTRO

- [ ] Está claro se a IA deve atualizar documentação?
- [ ] Sei qual documento deve ser atualizado?
- [ ] Sei qual documento NÃO deve ser tocado?

Ação sem rastro é falha grave.

---

## 9. VERIFICAÇÃO PÓS-IA

Após a resposta da IA:

- [ ] Revisei se ela saiu do escopo?
- [ ] Revisei se ela criou conceitos novos?
- [ ] Revisei se ela tomou decisões?
- [ ] Revisei se ela inferiu algo proibido?

IA obedece melhor na segunda leitura.

---

## 10. CONFIRMAÇÃO FINAL

- [ ] Todos os itens acima foram verificados
- [ ] Nenhum “só dessa vez” foi aceito
- [ ] Nenhuma exceção informal foi criada

Se tudo estiver marcado → **PODE USAR A IA**.

---

## REGRA FINAL

> IA acelera execução.
> IA não substitui julgamento.
> IA sem controle cria dívida invisível.

Fim.
