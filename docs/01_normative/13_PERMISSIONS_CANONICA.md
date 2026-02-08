# 13 — PERMISSIONS CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **PERMISSÃO** no sistema UnifiCard.

Seu objetivo é eliminar:
- confusão entre permissão e autoridade
- permissões implícitas
- RBAC acoplado à identidade
- decisões de acesso sem lastro formal

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Permissão é a autorização operacional
> para executar uma ação específica,
> dentro de um escopo e contexto definidos.**

Permissão:
- NÃO é identidade
- NÃO é autoridade
- NÃO é delegação de poder
- NÃO é estado
- NÃO é evento

Permissão **apenas permite executar uma ação**.

---

## 3. PERMISSÃO ≠ AUTORIDADE

Separação canônica e obrigatória:

- **Autoridade**:
  - decide quem pode delegar poder
  - define legitimidade
  - ancora responsabilidade (CPF)

- **Permissão**:
  - decide se uma ação pode ser executada agora
  - opera em runtime
  - nunca cria poder

Permissão **NUNCA substitui autoridade**.

---

## 4. PERMISSÃO ≠ IDENTIDADE

Identidade:
- define quem é a pessoa

Permissão:
- define o que pode ser feito

É proibido:
- conceder permissão diretamente à identidade
- usar `global_user_id` como critério de permissão

---

## 5. PERMISSÃO ≠ ACTOR

Actor:
- é quem executa ações

Permissão:
- limita o que o Actor pode fazer

Um Actor:
- pode existir sem permissão para uma ação
- nunca “possui” permissão por natureza

Permissões são **atribuídas**, não inerentes.

---

## 6. ESCOPO DAS PERMISSÕES

Toda permissão DEVE ter escopo explícito:

- tenant
- domínio
- recurso
- ação

Permissão sem escopo é inválida.

---

## 7. MODELO CANÔNICO DE PERMISSÕES

O modelo recomendado é:

Actor  
→ Permissão  
→ Ação  
→ Recurso  
→ Escopo

Permissões:
- são avaliadas em runtime
- não alteram estado
- não criam histórico por si só

---

## 8. PERMISSÕES E RBAC

RBAC é uma **implementação possível**, não a norma em si.

RBAC:
- agrupa permissões
- simplifica atribuição
- NÃO define autoridade

Roles:
- NÃO são identidade
- NÃO são poder
- NÃO são autoridade

Roles são apenas **atalhos operacionais**.

---

## 9. PERMISSÕES E POLICY

Policies:
- podem combinar múltiplas permissões
- podem usar contexto (tempo, estado, escopo)
- NÃO criam autoridade

Policy:
- avalia regras
- retorna ALLOW / DENY
- não altera dados

---

## 10. DECISÃO DE PERMISSÃO

Regra canônica:

> **Permissão é avaliada no momento da ação.**

A decisão:
- é contextual
- é transitória
- não altera estado
- não gera evento automaticamente

---

## 11. PROIBIÇÕES ABSOLUTAS

É proibido:

- permissão implícita
- permissão inferida
- permissão sem escopo
- permissão baseada em identidade
- permissão baseada em tabelas auxiliares não canônicas
- permissão que concede poder

---

## 12. RELAÇÃO COM OUTROS EIXOS

- **Autoridade**: valida se alguém pode conceder permissões
- **Identidade**: ancora responsabilidade histórica
- **Actors**: executam ações sob permissões
- **Estados**: podem bloquear permissões
- **Eventos**: podem disparar reavaliação
- **Transações**: nunca dependem só de permissões

---

## 13. HISTÓRICO E AUDITORIA

Permissões:
- NÃO são histórico por si só
- NÃO substituem eventos
- NÃO substituem transações

Auditoria deve registrar:
- qual permissão foi avaliada
- em qual contexto
- com qual resultado

---

## 14. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- nenhuma permissão cria poder
- nenhuma permissão substitui autoridade
- toda permissão tem escopo explícito
- decisões de permissão são determinísticas

---

## 15. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define autoridade
- NÃO define eventos
- NÃO define estados
- NÃO define transações

Ele apenas **define como ações são autorizadas em runtime**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 16. REGRA FINAL

Se alguém perguntar:

> “Por que essa ação foi permitida?”

A resposta correta DEVE vir de:
- uma permissão explícita
- avaliada em runtime
- dentro de um escopo claro
- sob autoridade previamente delegada

Se não for possível responder assim,
**o sistema está inseguro por definição**.

---

FIM DO DOCUMENTO
