# REAUDITORIA DE AUTORIDADE — GUARDIÃ

## STATUS
REAUDITORIA COMPLETA · CONCLUÍDA  
Data: 2026-02-05  
Modo: GUARDIÃ (somente leitura)

## DOCUMENTOS DE REFERÊNCIA
- docs/06_technical/authority/AUTHORITY_CONTRACT.md
- docs/06_technical/authority/GATE_AUTHORITY.md
- docs/04_audit/autoridade/autoridade_core_audit.md
- docs/03_execution_log/authority_execution_log.md

## ESCOPO
TODO o backend (core + modules)

---

## RESUMO EXECUTIVO

Esta reauditoria verifica o estado do código **após execução parcial**
da IA EXECUTORA, conforme registrado no log de execução.

**Status geral: FAIL**

- Violações originais identificadas: 89  
- Violações corrigidas: 10  
- Violações remanescentes: 78  
- Novas violações introduzidas: 0  

O Gate de Autoridade **NÃO pode ser fechado**.

---

## VIOLAÇÕES CORRIGIDAS (CONFIRMADO)

### 1. backend/src/modules/profile/commitments.routes.ts:33–34  
**Status:** CORRIGIDO  
**Correção:** Fallback de identidade removido; ActionContext obrigatório  
**Verificação:** Uso exclusivo de `req.actionContext.actingUserId`

---

### 2. backend/src/modules/social/social-2.0.routes.ts:180–181  
**Status:** CORRIGIDO  
**Correção:** Fallback de ActionContext removido  
**Verificação:** Validação explícita de ActionContext antes do uso

---

### 3. backend/src/modules/events/organizers/organizers.routes.ts:404, 530, 544  
**Status:** PARCIALMENTE CORRIGIDO  
**Correção:** Validações adicionadas em alguns pontos  
**Violação remanescente:** Linha 552 ainda contém fallback (`|| ''`)

---

### 4. backend/src/modules/human-mvp/human-mvp.routes.ts:68  
**Status:** CORRIGIDO  
**Correção:** Fallback removido; ActionContext obrigatório

---

### 5. backend/src/core/profile/pending-responsibilities.routes.ts:29–30  
**Status:** CORRIGIDO  
**Correção:** Fallback removido; ActionContext obrigatório

---

### 6. backend/src/core/profile/impact-overview.routes.ts:30–31  
**Status:** CORRIGIDO  
**Correção:** Fallback removido; ActionContext obrigatório

---

### 7. backend/src/modules/reports/reports.routes.ts:60–61  
**Status:** CORRIGIDO  
**Correção:** Fallback de ActionContext removido

---

### 8. backend/src/modules/dashboard/dashboard.routes.ts:60–61  
**Status:** PARCIALMENTE CORRIGIDO  
**Violação remanescente:** Linha 23 ainda contém fallback de identidade

---

## VIOLAÇÕES REMANESCENTES

### CATEGORIA: FALLBACK DE IDENTIDADE

1. backend/src/modules/groups/groups.routes.ts:79  
2. backend/src/modules/groups/groups.routes.ts:147  
3. backend/src/modules/groups/groups.routes.ts:192, 337, 458, 552, 614, 663, 708, 781, 830, 873, 1060, 1151, 1202, 1245, 1288, 1329, 1359, 1396, 1438  
4. backend/src/modules/groups/groups.routes.ts:97–99  
5. backend/src/modules/dashboard/dashboard.routes.ts:23  
6. backend/src/modules/pdv/pdv.routes.ts:46  
7. backend/src/modules/system-notifications/system-notification.routes.ts:29, 69, 148  
8. backend/src/modules/marketplace/marketplace.routes.ts:642, 686  
9. backend/src/modules/events/organizers/organizers.routes.ts:552  

---

### CATEGORIA: USO DE `req.user.*` COMO ATOR

Ocorrências extensivas nos seguintes arquivos:

- backend/src/core/events/event.routes.ts  
- backend/src/modules/services/service-payment-request.routes.ts  
- backend/src/modules/inbox/social-inbox.routes.ts  
- backend/src/core/companies/company-members.routes.ts  
- backend/src/core/feed/feed-plugin.routes.ts  
- backend/src/core/availability/unified-availability.routes.ts  
- backend/src/modules/social/social-2.0.routes.ts  
- backend/src/modules/events/organizers/organizers.routes.ts  
- backend/src/modules/votes/votes.routes.ts  
- backend/src/modules/social/social.routes.ts  
- backend/src/core/identity/identity.routes.ts  
- backend/src/core/feed/feed.routes.ts  

Todas as ocorrências acima violam explicitamente o contrato de autoridade.

---

### CATEGORIA: ACTIONCONTEXT OPCIONAL

- backend/src/modules/marketplace/marketplace.routes.ts  
- backend/src/modules/social/social-marketplace-ref.routes.ts  
- backend/src/modules/automation/automation.routes.ts  

ActionContext tratado como opcional ou com fallback para `null`.

---

### CATEGORIA: INFERÊNCIA DE AUTORIDADE POR CONTEXTO

- backend/src/core/action-context/action-context.middleware.ts  
- backend/src/plugins/rbac.plugin.ts  

Inferência automática de ator a partir de `req.user` detectada.

---

## RESUMO FINAL

- Gate de Autoridade: **FAIL**
- Execução permitida: **NÃO**
- Próxima ação válida: **nova execução mecânica com escopo TOTAL**
  sobre todas as violações remanescentes listadas neste documento.

Este arquivo é o **registro institucional definitivo**
da reauditoria de autoridade.

Nenhum código foi alterado durante esta reauditoria.

---

FIM DO DOCUMENTO
