# RBAC V2 CONTRACT
Eixo: AUTORIDADE / PERMISSÃO / GOVERNANÇA
Status: ATIVO (LEI DO SISTEMA)
Tipo: CONTRATO TÉCNICO
Última atualização: 2026-02-06

---

## 1. FINALIDADE

Este documento define o **RBAC V2** como o mecanismo
exclusivo de decisão de permissão no sistema UnifiCard.

O RBAC V2 opera **exclusivamente** sobre o
**ActionContext (SSOT)** e **nunca** sobre identidade técnica,
sessão ou contexto implícito.

---

## 2. PRINCÍPIO-MÃE

> Permissão é decidida a partir de:
> **actorId + intent + scope**
>  
> Nada mais participa da decisão.

Qualquer lógica fora desse tripé é inválida.

---

## 3. PRÉ-REQUISITO ABSOLUTO

RBAC **SÓ PODE** executar se:

- `req.actionContext` existir
- ActionContext for válido
- campos mínimos estiverem presentes:
  - `actorId`
  - `intent`
  - `scope`

Sem ActionContext válido → RBAC **NÃO RODA**.

---

## 4. ENTRADAS DO RBAC (CONTRATO FECHADO)

O RBAC V2 recebe **exclusivamente**:

- `actorId`  
- `intent`  
- `scope`  

É proibido receber ou consultar:

- `req.user`
- sessão
- token
- headers
- tenant implícito
- contexto de rota
- estado global

---

## 5. MODELO DE DECISÃO

A decisão de permissão responde apenas:

> **O actorId pode executar o intent neste scope?**

Resultado possível:
- **ALLOW**
- **DENY**

Não existe:
- “talvez”
- “depende”
- fallback
- coerência comparativa

---

## 6. REGRAS DE PERMISSÃO

### 6.1 Estrutura conceitual

Uma regra de permissão associa:

- `actorId` (ou tipo de ator)
- `intent`
- `scope`

RBAC não entende:
- usuário técnico
- papel implícito
- contexto histórico

---

### 6.2 Papéis (roles)

Papéis são **derivações estáticas** de permissão,
não fontes de identidade.

- Papéis são avaliados **dentro do RBAC**
- Papéis **NÃO** são inferidos
- Papéis **NÃO** substituem `actorId`

---

## 7. PROIBIÇÕES ABSOLUTAS (LEI)

É proibido o RBAC V2:

1) Referenciar `req.user.*`
2) Comparar identidade técnica com `actorId`
3) Inferir permissão por:
   - presença de rota
   - middleware anterior
   - tipo de request
4) Criar fallback de decisão
5) “Consertar” ActionContext inválido
6) Executar sem ActionContext

Qualquer item acima **quebra o contrato**.

---

## 8. RELAÇÃO COM ACTIONCONTEXT

RBAC **NÃO valida** ActionContext.
RBAC **ASSUME** ActionContext válido.

Responsabilidades:
- Middleware → construir e validar ActionContext
- RBAC → decidir permissão

Misturar essas camadas é violação estrutural.

---

## 9. AUDITORIA (CONSEQUÊNCIA NATURAL)

Toda decisão de RBAC deve ser auditável com:

- `actorId`
- `intent`
- `scope`
- decisão (ALLOW / DENY)

Auditoria **não é feature**.
Ela emerge automaticamente do modelo correto.

---

## 10. APLICAÇÃO UNIVERSAL

RBAC V2 se aplica igualmente a:

- requisições de usuário
- jobs de sistema
- automations
- webhooks
- processos assíncronos

Não existem exceções.

---

## 11. CRITÉRIO DE CONFORMIDADE

RBAC V2 é considerado conforme somente se:

- nunca acessa `req.user`
- nunca decide sem ActionContext
- decide apenas com `actorId + intent + scope`
- não contém fallback
- não contém inferência

---

## 12. RELAÇÃO COM OUTROS CONTRATOS

Este contrato depende de:
- ACTIONCONTEXT_CONTRACT.md
- ACTIONCONTEXT_MIDDLEWARE_SPEC.md

Este contrato é pré-requisito para:
- fechamento do Gate de Autoridade
- execução mecânica
- EV2
- M2

---

## 13. AUTORIDADE DO DOCUMENTO

Este documento tem **força normativa técnica**.

Ele:
- não sugere
- não recomenda
- não flexibiliza

Ele **define**.

---

FIM DO CONTRATO
