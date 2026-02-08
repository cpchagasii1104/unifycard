# ACTIONCONTEXT MIDDLEWARE SPEC
Eixo: AUTORIDADE / CONTEXTO / DECISÃO
Status: ATIVO (LEI DE DESENHO)
Tipo: ESPECIFICAÇÃO DE MIDDLEWARE
Última atualização: 2026-02-06

---

## 1. FINALIDADE

Este documento define o comportamento obrigatório do **ActionContext Middleware**.

O middleware existe para:
- **construir** um ActionContext válido (quando permitido)
- **validar** que o ActionContext recebido é completo
- **falhar** explicitamente quando o ActionContext é inválido ou ausente

O middleware **não decide poder**. Ele apenas **propaga contexto**.

---

## 2. PRINCÍPIO-MÃE

> Middleware propaga contexto.
> Middleware NÃO infere autoridade.

Se não for possível declarar um ActionContext válido:
- a requisição **falha**
- nenhuma ação de negócio é executada

---

## 3. ENTRADAS ACEITAS (INPUTS)

O middleware pode receber dados SOMENTE destas fontes:

### 3.1 Token / Claims (apenas como evidência)
- O token pode conter identificadores e metadados
- O middleware pode ler claims para **validar** e **preencher** campos permitidos

⚠️ Importante:
- token **não é** ActionContext
- token **não autoriza** nada por si só

### 3.2 Headers
- headers podem transportar metadados de origem e rastreio
- headers podem transportar um ActionContext serializado, se o sistema adotar esse padrão

### 3.3 Body / Query
- permitido apenas para campos explicitamente declarados como “inputs operacionais”
- nunca para inferir `actorId` por conveniência

---

## 4. SAÍDAS (OUTPUT)

O middleware deve produzir exatamente UMA saída:

### 4.1 req.actionContext (obrigatório)
- `req.actionContext` deve existir e ser válido antes de qualquer handler rodar
- se não existir ou estiver inválido → falha

O middleware NÃO cria:
- `userContext`
- `currentUser`
- aliases de identidade
- fallbacks

---

## 5. CAMPOS OBRIGATÓRIOS (MÍNIMO)

O middleware deve garantir a presença dos campos mínimos do contrato:

- `actorId`
- `intent`
- `source`
- `scope`

Se qualquer um faltar → falha.

---

## 6. PROIBIÇÕES ABSOLUTAS (LEI)

É proibido o middleware:

1) Inferir `actorId` a partir de:
- `req.user`
- sessão
- tenant
- “usuário atual”
- qualquer contexto implícito

2) Aplicar fallback (`A || B`) para:
- `actorId`, `intent`, `source`, `scope`
- ou qualquer campo que participe de autoridade

3) “Completar” ActionContext faltante
4) Assumir `intent`
5) Decidir permissão
6) Permitir execução de ação de negócio sem ActionContext válido

Qualquer item acima é violação estrutural.

---

## 7. FLUXO OBRIGATÓRIO (BINÁRIO)

O middleware deve seguir este fluxo, SEM atalhos:

1) Receber inputs (token/headers/body/query)
2) Validar formato (estrutura, tipos, presença de campos)
3) Construir ActionContext (somente declarando, nunca inferindo)
4) Validar ActionContext final contra o contrato mínimo
5) Se válido → anexar em `req.actionContext` e seguir
6) Se inválido/ausente → falhar (erro duro)

---

## 8. FALHAS OBRIGATÓRIAS (HARD FAIL)

O middleware DEVE falhar quando:

- ActionContext está ausente
- qualquer campo obrigatório está ausente
- qualquer campo obrigatório está vazio
- ActionContext contém fallback explícito (padrões detectáveis)
- `actorId` não é declarativo (origem implícita)
- `intent` não está presente
- `source` não está presente
- `scope` não está presente

Falha significa:
- request interrompida
- handler não executa
- RBAC não executa

---

## 9. RESPONSABILIDADES NEGATIVAS (O QUE NÃO É PAPEL DO MIDDLEWARE)

O middleware NÃO é responsável por:

- autorizar ações (isso é RBAC)
- decidir escopo (apenas validar o fornecido)
- reconciliar identidades (isso é Authority Core)
- “consertar legado”
- manter compatibilidade via aliases

---

## 10. RELAÇÃO COM RBAC

RBAC só pode operar após este middleware garantir:

- `req.actionContext` válido
- campos mínimos presentes

RBAC recebe exclusivamente:
- `actorId`
- `intent`
- `scope`

Se ActionContext não existir → RBAC não roda.

---

## 11. CRITÉRIO DE CONFORMIDADE

Este middleware é considerado “conforme” somente se:

- nunca usa `req.user.*` para construir autoridade
- nunca usa fallback para qualquer campo de autoridade
- falha sempre que ActionContext estiver incompleto
- garante SSOT: todo handler recebe ActionContext válido

---

FIM DA ESPECIFICAÇÃO
