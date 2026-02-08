# 05 — CONTRATOS CANÔNICOS

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. PRINCÍPIO FUNDAMENTAL

Contrato é a **unidade mínima de legitimidade operacional** no sistema UnifiCard.

Nenhuma ação relevante ocorre sem:
- um contrato explícito
- uma autoridade definida
- um escopo claro

Sem contrato, **não existe permissão para agir**.

---

## 2. DEFINIÇÃO DE CONTRATO

Contrato é uma **declaração normativa** que define:

- quem pode agir
- sobre o quê pode agir
- em quais condições
- com quais efeitos permitidos

Contrato **não é implementação**, **não é fluxo**, **não é tutorial**.

---

## 3. FUNÇÃO DOS CONTRATOS

Contratos existem para:

- limitar ações
- tornar decisões auditáveis
- impedir inferência implícita
- eliminar ambiguidade operacional

Tudo que não está autorizado por contrato:
→ é proibido por padrão.

---

## 4. RELAÇÃO COM SSOTs

Contratos:
- **não criam ontologia**
- **não redefinem identidade**
- **não alteram categorias**

Eles **operam sobre**:
- Actors definidos
- Identidades ancoradas
- Categorias existentes
- Estados válidos

Qualquer contrato que viole um SSOT é inválido.

---

## 5. AUTORIDADE CONTRATUAL

Este documento é a **fonte única de verdade** para:

- o que constitui um contrato
- quais propriedades um contrato deve conter
- como contratos se relacionam com Actors e Domínios

Nenhum contrato individual pode:
- redefinir estas regras
- criar exceções implícitas
- enfraquecer limites normativos

---

## 6. ESTRUTURA OBRIGATÓRIA DE UM CONTRATO

Todo contrato DEVE declarar explicitamente:

- Actor(s) autorizados
- Domínio de aplicação
- Ação permitida
- Condições de validade
- Efeitos autorizados
- Limites e proibições

Ausência de qualquer item invalida o contrato.

---

## 7. CONTRATOS TÉCNICOS VS CONTRATOS NORMATIVOS

- Contratos normativos: definem autoridade
- Contratos técnicos: implementam a autoridade

Contratos técnicos:
- são subordinados
- não podem expandir escopo
- não podem criar poder novo

---

## 8. PROIBIÇÕES EXPLÍCITAS

É proibido:

- agir sem contrato
- inferir contrato por conveniência
- duplicar contratos por domínio
- criar contratos temporários
- manter contratos “históricos” ativos

Contrato é **vigente ou inexistente**.

---

## 9. EVOLUÇÃO CONTRATUAL

Criação, alteração ou remoção de contrato:

- exige Gate formal
- exige atualização explícita
- exige rastreabilidade

Se não passou por Gate:
→ o contrato não existe.

---

## 10. REGRA FINAL

Se uma ação ocorreu e não existe contrato que a autorize:
→ a ação é inválida, mesmo que tenha sido executada.

O sistema deve ser corrigido **no contrato**, nunca no efeito.

---

FIM DO DOCUMENTO