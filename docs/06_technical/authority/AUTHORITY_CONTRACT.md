# AUTHORITY CONTRACT
Eixo: AUTORIDADE / IDENTIDADE / PERMISSÃO  
Status: ATIVO (LEI DO SISTEMA)  
Escopo: Backend  
Última atualização: 2026-02-06

---

## 1. FINALIDADE

Este documento define **as regras canônicas e obrigatórias**
sobre **autoridade**, **ator**, **identidade** e **permissão**
no sistema UnifiCard.

Este contrato **governa**:
- decisões de autorização
- rastreabilidade de ações
- validade de contexto
- uso correto de RBAC

⚠️ Qualquer violação deste contrato é considerada **ERRO ESTRUTURAL**.

---

## 2. DEFINIÇÕES CANÔNICAS

### 2.1 Usuário (User)

Representa:
- identidade técnica
- autenticação
- sessão

❌ Usuário **NÃO É** ator de negócio por definição.

---

### 2.2 Ator (Actor)

Representa:
- quem executa a ação
- em nome de quem a ação ocorre
- entidade responsável pelo efeito econômico ou lógico

✅ **Toda ação válida possui exatamente um ator explícito.**

---

### 2.3 Identidade

Identidade é um **identificador tipado e contextualizado**.

❌ Identidade **NÃO PODE** ser inferida por:
- estrutura de objeto
- fallback
- presença em contexto

---

### 2.4 Autoridade

Autoridade é a **capacidade válida de executar uma ação**,
derivada exclusivamente de:

- ator explícito
- permissão associada
- escopo declarado

---

## 3. FONTE CANÔNICA DE AUTORIDADE

### 3.1 ActionContext (OBRIGATÓRIO)

Toda ação de negócio **DEVE** operar sobre um `ActionContext`
que contenha explicitamente:

- actorId
- scope
- source (origem da ação)

❌ Ações sem `ActionContext` válido são inválidas.

---

### 3.2 Proibição de contexto implícito

É **PROIBIDO** decidir autorização com base em:

- `req.user`
- `req.user.id`
- `req.user.userId`
- `req.user.globalUserId`
- presença em rota
- middleware anterior

---

## 4. PROIBIÇÕES ABSOLUTAS

São **explicitamente proibidos**:

- fallback de identidade (`A || B`)
- alias de identidade para compatibilidade
- uso de `req.user.id` como ator
- autorização baseada em “se chegou aqui, pode”
- inferência de ator por estrutura (`user.id`, `actor.id`)

Qualquer ocorrência acima **quebra o contrato**.

---

## 5. REGRAS DE PERMISSÃO (RBAC)

- RBAC **SÓ** pode operar sobre:
  - ator válido
  - ActionContext válido
- RBAC **NÃO** valida identidade
- RBAC **NÃO** corrige ator
- RBAC **NÃO** escolhe fallback

RBAC assume **contrato cumprido**.

---

## 6. RASTREABILIDADE (INVARIANTE)

Toda ação persistida ou auditável **DEVE** permitir responder:

- quem executou
- em nome de quem
- com qual permissão
- sob qual escopo

Se não for possível responder qualquer item acima,
a ação é considerada **inválida por design**.

---

## 7. RELAÇÃO COM AUDITORIA

Este contrato deriva diretamente de:

docs/04_audit/autoridade/autoridade_core_audit.md


Qualquer divergência entre código e este contrato
**exige nova auditoria ou correção estrutural**.

---

## 8. REGRA DE EXECUÇÃO

Nenhuma execução mecânica (Cursor / refactor / EV2)
é permitida se este contrato não for respeitado integralmente.

---

## 9. AUTORIDADE DESTE DOCUMENTO

Este documento tem **força normativa técnica**.

Ele:
- não sugere
- não recomenda
- não debate

Ele **define**.

---

FIM DO CONTRATO