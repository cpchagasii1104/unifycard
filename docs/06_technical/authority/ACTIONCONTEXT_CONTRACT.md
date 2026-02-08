# ACTIONCONTEXT CONTRACT
Eixo: AUTORIDADE / CONTEXTO / DECISÃO
Status: ATIVO (LEI DO SISTEMA)
Tipo: CONTRATO TÉCNICO
Última atualização: 2026-02-06

---

## 1. FINALIDADE

Este documento define o **ActionContext** como a
**ÚNICA FONTE DE VERDADE (SSOT)** para decisões de autoridade
no sistema UnifiCard.

Nenhuma ação de negócio pode ser executada
sem um ActionContext válido e explícito.

Este contrato governa:
- execução de ações
- autorização (RBAC)
- rastreabilidade
- auditoria
- governança de poder

---

## 2. DEFINIÇÃO CANÔNICA

**ActionContext** é um objeto obrigatório que descreve,
de forma explícita e não inferida, o contexto completo
de uma ação de negócio.

O ActionContext **declara**.
Ele nunca adivinha.

---

## 3. CONTRATO MÍNIMO OBRIGATÓRIO

Todo ActionContext **DEVE** conter, no mínimo:

### 3.1 actorId (CANÔNICO)

- `actorId` é o identificador canônico de quem executa a ação.
- `actorId` é obrigatório.
- `actorId` **NÃO PODE** ser inferido.

Sem `actorId`, a ação é inválida.

---

### 3.2 intent

- Descreve o tipo da ação sendo executada.
- Exemplo: `create_order`, `approve_payment`, `publish_event`
- É obrigatório.

---

### 3.3 source

- Indica a origem da ação.
- Exemplos:
  - `user-request`
  - `system-job`
  - `automation`
  - `webhook`
- É obrigatório.

---

### 3.4 scope

- Define o escopo de validade da autoridade.
- Exemplos:
  - `accountId`
  - `organizationId`
  - `tenantId`
- É obrigatório.

---

## 4. PROIBIÇÕES ABSOLUTAS

É **explicitamente proibido**:

- inferir `actorId` a partir de:
  - `req.user`
  - sessão
  - token
  - tenant
  - contexto implícito
- usar fallback (`A || B`) para qualquer campo do ActionContext
- criar ActionContext parcial
- completar ActionContext faltante
- executar ação de negócio sem ActionContext

Qualquer violação acima **quebra o contrato**.

---

## 5. REGRA BINÁRIA DE EXECUÇÃO

> **Sem ActionContext válido, nenhuma ação de negócio é executada.**

Isso não é warning.
Isso não é log.
Isso é **erro estrutural**.

---

## 6. RESPONSABILIDADES POR CAMADA

### 6.1 Middleware

O middleware **PODE**:
- receber dados de entrada
- validar formato
- construir o ActionContext
- falhar explicitamente se algo faltar
- anexar o ActionContext à request

O middleware **NÃO PODE**:
- inferir `actorId`
- assumir intenção
- criar fallback
- decidir permissão
- completar contexto ausente

---

### 6.2 Handlers / Serviços

- **DEVEM** receber ActionContext válido
- **NÃO DEVEM** acessar `req.user` para decisão
- **NÃO DEVEM** executar lógica sem ActionContext

---

### 6.3 RBAC

- RBAC **SÓ** pode operar sobre ActionContext
- RBAC recebe exclusivamente:
  - `actorId`
  - `intent`
  - `scope`
- RBAC **NÃO** referencia `req.user`
- RBAC **NÃO** valida identidade técnica

Sem ActionContext válido, RBAC não executa.

---

## 7. RELAÇÃO COM OUTROS CONTRATOS

Este contrato é superior a:
- qualquer uso de `req.user`
- qualquer inferência de autoridade
- qualquer lógica legada de coerência

Este contrato é pré-requisito para:
- RBAC 2.0
- Redesign do Authority Core
- EV2
- Automations seguras

---

## 8. AUTORIDADE DO DOCUMENTO

Este documento tem **força normativa técnica**.

Ele:
- não sugere
- não recomenda
- não negocia

Ele **define**.

---

FIM DO CONTRATO