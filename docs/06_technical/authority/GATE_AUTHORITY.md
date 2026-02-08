# GATE — AUTORIDADE
Eixo: AUTORIDADE / IDENTIDADE / PERMISSÃO  
Status: ATIVO  
Tipo: GATE DE BLOQUEIO ESTRUTURAL  
Última atualização: 2026-02-06

---

## 1. FINALIDADE DO GATE

Este gate existe para **impedir qualquer execução, refactor ou evolução**
que viole o **AUTHORITY_CONTRACT.md**.

Ele é um **bloqueio técnico**, não uma recomendação.

---

## 2. CONDIÇÃO DE PASS

O sistema só pode avançar para execução mecânica se **TODAS**
as condições abaixo forem verdadeiras.

### 2.1 Ator explícito

- Toda ação de negócio possui **ator explícito**
- O ator é identificado por `actorId`
- Não há inferência por `req.user` ou contexto implícito

---

### 2.2 ActionContext obrigatório

- Toda ação de negócio opera sobre um `ActionContext`
- `ActionContext` contém:
  - `actorId`
  - `scope`
  - `source`
- Não existem caminhos de execução sem `ActionContext`

---

### 2.3 Proibição de fallback

- Não existe uso de:
  - `A || B` para identidade
  - alias de identidade
  - substituição silenciosa de ator
- Qualquer fallback resulta em **FAIL automático**

---

### 2.4 Separação User ≠ Actor

- `User` é tratado apenas como identidade técnica
- `User` **NÃO** é usado como ator de negócio
- `req.user.id` **NUNCA** é usado para autorização final

---

### 2.5 RBAC conforme contrato

- RBAC opera apenas sobre:
  - ator válido
  - ActionContext válido
- RBAC não corrige, não escolhe e não infere ator

---

## 3. CONDIÇÃO DE FAIL (QUALQUER UMA)

O gate **DEVE FALHAR** se for encontrado:

- uso de `req.user.id` como ator
- fallback de identidade
- autorização baseada em presença de rota
- autorização sem ator explícito
- ação não rastreável
- divergência entre código e AUTHORITY_CONTRACT.md

FAIL **bloqueia execução**.

---

## 4. ESCOPO DE APLICAÇÃO

Este gate se aplica a:

- backend core
- modules
- middlewares
- handlers
- serviços de negócio
- fluxos do EV2

---

## 5. RELAÇÃO COM DOCUMENTOS CANÔNICOS

Este gate deriva diretamente de:

- `docs/04_audit/autoridade/autoridade_core_audit.md`
- `docs/06_technical/authority/AUTHORITY_CONTRACT.md`

Se qualquer um destes documentos mudar,
o gate **DEVE** ser reavaliado.

---

## 6. AUTORIDADE DO GATE

Este gate tem **força de bloqueio absoluto**.

- Não pode ser ignorado
- Não pode ser flexibilizado
- Não pode ser “interpretado”

PASS libera execução.  
FAIL bloqueia o sistema.

---

FIM DO GATE
