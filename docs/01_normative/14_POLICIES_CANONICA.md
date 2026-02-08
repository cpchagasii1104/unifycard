# 14 — POLICIES CANÔNICA

## STATUS
PROPOSTO · NÃO VIGENTE · CONDICIONAL

⚠️ Este documento **NÃO entra em vigor automaticamente**.
Ele só se torna canônico após Gate formal de Governança.

---

## 1. FINALIDADE

Este documento define, de forma **canônica, inequívoca e auditável**,  
o conceito de **POLICY** no sistema UnifiCard.

Seu objetivo é eliminar:
- políticas implícitas
- lógica condicional espalhada
- decisões de acesso não rastreáveis
- confusão entre policy, permissão e autoridade

---

## 2. DEFINIÇÃO FUNDAMENTAL

> **Policy é uma regra declarativa que avalia contexto
> e retorna uma decisão determinística (ALLOW / DENY).**

Policy:
- NÃO é autoridade
- NÃO é permissão
- NÃO é estado
- NÃO é evento
- NÃO é transação

Policy **não executa ações**.  
Policy **apenas decide**.

---

## 3. POLICY ≠ PERMISSÃO

- **Permissão**: autoriza uma ação específica
- **Policy**: avalia se a permissão pode ser aplicada naquele contexto

Permissão responde:
> “Essa ação existe?”

Policy responde:
> “Essa ação pode ser executada AGORA, neste contexto?”

Policy **orquestra permissões**, não as substitui.

---

## 4. POLICY ≠ AUTORIDADE

Autoridade:
- decide quem pode conceder poder
- valida legitimidade

Policy:
- avalia condições operacionais
- nunca cria poder
- nunca delega autoridade

Uma policy **nunca legitima uma ação sozinha**.

---

## 5. POLICY ≠ REGRA DE NEGÓCIO

Regra de negócio:
- define como o sistema funciona

Policy:
- define **quando** algo pode acontecer

Regra de negócio pode existir sem policy.  
Policy **nunca substitui regra de negócio**.

---

## 6. ENTRADAS DE UMA POLICY

Toda policy canônica DEVE avaliar apenas:

- Actor
- Permissão solicitada
- Recurso alvo
- Escopo (tenant, domínio)
- Contexto (tempo, estado, flags)
- Resultado de autoridade prévia

Policy **NÃO pode depender** de:
- inferência implícita
- estado não canônico
- dados não auditáveis

---

## 7. SAÍDA DE UMA POLICY

A saída de uma policy é **binária e explícita**:

- `ALLOW`
- `DENY`

Policies:
- NÃO retornam efeitos colaterais
- NÃO mutam estado
- NÃO disparam eventos

---

## 8. COMPOSIÇÃO DE POLICIES

Policies podem ser:

- compostas
- encadeadas
- reutilizadas

Regras:
- composição DEVE ser explícita
- ordem de avaliação DEVE ser determinística
- conflito DEVE resultar em `DENY`

---

## 9. POLICIES E CONTEXTO TEMPORAL

Policies podem avaliar:

- horário
- período
- expiração
- janelas temporais

Mas:
- policy **NÃO altera tempo**
- policy **NÃO cria eventos**

Tempo é apenas **entrada**, nunca efeito.

---

## 10. POLICIES E ESTADOS

Policies podem:

- bloquear ações com base em estado
- permitir ações condicionais

Exemplo:
- `company.status = suspended` → `DENY`

Policy **NÃO muda estado**.
Ela apenas reage a ele.

---

## 11. POLICIES E RBAC

RBAC:
- agrupa permissões

Policies:
- avaliam contexto dinâmico

RBAC sem policy é rígido.  
Policy sem RBAC é possível.

RBAC **não substitui** policy.

---

## 12. PROIBIÇÕES ABSOLUTAS

É proibido:

- policy implícita
- policy com side-effect
- policy que altera estado
- policy que concede poder
- policy sem escopo claro
- policy não determinística

---

## 13. HISTÓRICO E AUDITORIA

Policies:
- NÃO são histórico por si só

Auditoria DEVE registrar:
- policy avaliada
- contexto avaliado
- decisão retornada

---

## 14. RELAÇÃO COM OUTROS EIXOS

- **Permissões**: policies decidem se aplicam
- **Autoridade**: valida delegações prévias
- **Estados**: influenciam decisão
- **Eventos**: podem motivar reavaliação
- **Transações**: dependem de decisão positiva
- **Governança**: define quem cria policies

---

## 15. CRITÉRIO DE CONFORMIDADE

O sistema está conforme este eixo somente se:

- policies são explícitas
- policies são determinísticas
- policies não alteram estado
- policies não criam poder

---

## 16. EVOLUÇÃO DO EIXO

Este eixo:

- NÃO define permissões
- NÃO define autoridade
- NÃO define regras de negócio

Ele apenas **define como decisões contextuais são tomadas**.

Qualquer alteração exige:
- Gate formal de Governança
- atualização explícita deste documento

---

## 17. REGRA FINAL

Se alguém perguntar:

> “Por que isso foi permitido ou negado?”

A resposta correta DEVE vir de:
- uma policy explícita
- com entradas claras
- com decisão determinística

Se não for possível responder assim,
**a decisão é inválida por definição**.

---

FIM DO DOCUMENTO
