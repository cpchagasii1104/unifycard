# Sistema de Invariantes Canônicos — SSOT Arquitetural

**Status:** `CORE`  
**Governing Contract:** `CORE_IMUTAVEL.md`  
**Data de Criação:** 2025-01-22  
**Última Atualização:** 2024-12-19 (Observabilidade congelada como invariante canônico)

---

## Declaração de SSOT

Este documento é a **Single Source of Truth (SSOT)** arquitetural para todos os invariantes canônicos do sistema Unificard. 

**REGRA INQUEBRÁVEL:** Qualquer alteração que viole um invariante listado aqui **DEVE** ser rejeitada, independentemente de quem a propõe (humano ou IA).

**REGRA DE EVOLUÇÃO:** Novos invariantes podem ser adicionados apenas através de processo formal de governança, nunca por extrapolação ou "melhoria" não autorizada.

---

## 1. Invariantes de Autenticação (Auth)

### 1.1 JWT e Token Version

**INVARIANTE:** `tokenVersion` é obrigatório em todos os JWTs (access e refresh).

**GARANTIAS:**
- ✅ `verifyAccessToken()` valida presença de `tokenVersion` (fail-fast)
- ✅ `refreshToken()` valida presença de `tokenVersion` (fail-fast)
- ✅ `generateTokens()` sempre inclui `tokenVersion` do banco no payload
- ✅ `tokenVersion` do JWT deve corresponder ao `users.token_version` do banco
- ✅ Qualquer discrepância resulta em erro HTTP 401 imediato

**LOCALIZAÇÃO:**
- `backend/src/core/auth/auth.service.ts` (linhas 99-105, 128-132, 650-692)

**LOGS CANÔNICOS:**
- Log de warn quando `tokenVersion` não corresponde (access token)
- Log de warn quando `tokenVersion` não corresponde (refresh token)
- Log de erro quando `tokenVersion` ausente no JWT

---

### 1.2 TenantId no JWT

**INVARIANTE:** `tenantId` é obrigatório em todos os JWTs (access e refresh).

**GARANTIAS:**
- ✅ `verifyAccessToken()` valida presença de `tenantId` (fail-fast)
- ✅ `refreshToken()` valida presença de `tenantId` (fail-fast)
- ✅ `generateTokens()` sempre inclui `tenantId` no payload
- ✅ Qualquer ausência resulta em erro HTTP 401 imediato

**LOCALIZAÇÃO:**
- `backend/src/core/auth/auth.service.ts` (linhas 91-97, 629-633)

**LOGS CANÔNICOS:**
- Log de erro quando `tenantId` ausente no JWT

---

### 1.3 Fronteira Auth × Tenant

**INVARIANTE:** Rotas `/auth/*` nunca dependem de escopo protegido.

**GARANTIAS:**
- ✅ `authModule` registrado **fora** do escopo protegido
- ✅ `tenantPlugin` **não** roda em `/auth/*` (early return explícito)
- ✅ `authPlugin` **não** roda em `/auth/*` (registrado apenas no escopo protegido)
- ✅ Rotas `/auth/*` não acessam `req.tenant` ou `req.user`
- ✅ Login e register funcionam **sem** `x-tenant-id`
- ✅ Refresh e logout **exigem** `x-tenant-id`

**LOCALIZAÇÃO:**
- `backend/src/plugins/tenant.plugin.ts` (early return em `/auth/*`)
- `backend/src/core/auth/auth.routes.ts` (rotas públicas)
- `backend/src/core/auth/auth.plugin.ts` (validação JWT)

**LOGS CANÔNICOS:**
- Log de warn quando `tenantPlugin` detecta rota `/auth/*`

---

## 2. Invariantes de Tenant

### 2.1 Isolamento de Tenant

**INVARIANTE:** Dados de um tenant **NUNCA** vazam para outro tenant.

**GARANTIAS:**
- ✅ Todas as queries críticas filtram explicitamente por `tenant_id`
- ✅ Nenhuma query usa apenas `actor_id`, `company_id`, `account_id` isolado
- ✅ `runQueryWithTenant()` sempre aplica contexto de tenant (RLS + filtro explícito)
- ✅ Queries diretas com `pool.query` são proibidas (exceto casos documentados)

**LOCALIZAÇÃO:**
- `backend/src/modules/social/actor.repository.ts` (linha 33: `WHERE tenant_id = $1 AND actor_id = $2`)
- `backend/src/core/companies/companies.service.ts` (linha 644: `WHERE tenant_id = $1 AND company_id = $2`)
- `backend/src/modules/bank/bank-account.repository.ts` (linha 57: `WHERE tenant_id = $1 AND account_id = $2`)
- `backend/src/modules/bank/bank-ledger.repository.ts` (múltiplas queries com filtro `tenant_id`)

**LOGS CANÔNICOS:**
- Log de erro quando query não filtra por `tenant_id` (auditoria)

---

### 2.2 TenantId Obrigatório

**INVARIANTE:** `tenantId` é obrigatório em todas as operações críticas.

**GARANTIAS:**
- ✅ `getCompanyById()` valida `tenantId` obrigatório (linha 603-606)
- ✅ `runQueryWithTenant()` exige `tenantId` como primeiro parâmetro
- ✅ Qualquer ausência resulta em erro explícito

**LOCALIZAÇÃO:**
- `backend/src/core/companies/companies.service.ts` (linha 603-606)
- `backend/src/core/database/pool.ts` (linha 166-209)

**LOGS CANÔNICOS:**
- Log de erro quando `tenantId` ausente em operação crítica

---

## 3. Invariantes de Bootstrap

### 3.1 Session Bootstrap

**INVARIANTE:** `sessionReady` só é `true` quando `tenantId` é válido e extraído do JWT.

**GARANTIAS:**
- ✅ `SessionProvider` extrai `tenantId` exclusivamente do JWT (accessToken)
- ✅ `SessionProvider` nunca marca `sessionReady = true` sem `tenantId` válido
- ✅ `SessionProvider` nunca depende de `activeActor` para validar sessão
- ✅ Erro 401 de `/social/actors/available` durante bootstrap é crítico (invalida sessão)
- ✅ Bootstrap roda apenas uma vez por evento (guards contra cascata)

**LOCALIZAÇÃO:**
- `frontend/src/contexts/SessionProvider.tsx`

**LOGS CANÔNICOS:**
- Log de erro quando extração de `tenantId` falha
- Log de erro quando 401 durante bootstrap
- Log de warn quando fallback de actor ocorre

---

### 3.2 TenantId no Frontend

**INVARIANTE:** `tenantId` no frontend vem exclusivamente do JWT decodificado.

**GARANTIAS:**
- ✅ `apiFetch` extrai `tenantId` do JWT se ausente no storage
- ✅ `apiFetch` nunca usa `activeActor`, profile data, ou API responses como fonte de `tenantId`
- ✅ `apiFetch` lança erro explícito se `tenantId` não puder ser extraído
- ✅ `apiFetch` sempre envia `x-tenant-id` após autenticação

**LOCALIZAÇÃO:**
- `frontend/src/api/client.ts` (função `apiFetch`)

**LOGS CANÔNICOS:**
- Log de erro quando extração de `tenantId` falha
- Log de erro quando `tenantId` ausente em chamada API

---

## 4. Invariantes de Actor

### 4.1 Coerência Actor × Tenant

**INVARIANTE:** Actor sempre pertence ao tenant da requisição.

**GARANTIAS:**
- ✅ `action-context.middleware` valida coerência `actor × tenant`
- ✅ `x-acting-actor-id` só enviado após `tenantId` validado
- ✅ Erro HTTP 403 se actor não pertence ao tenant
- ✅ Nenhum fallback silencioso

**LOCALIZAÇÃO:**
- `backend/src/core/action-context/action-context.middleware.ts`
- `frontend/src/api/client.ts` (envio de `x-acting-actor-id`)

**LOGS CANÔNICOS:**
- Log de erro quando actor não pertence ao tenant
- Log de warn quando `x-acting-actor-id` enviado sem `tenantId` validado

---

## 5. Invariantes de RBAC

### 5.1 Contexto Completo para Autorização

**INVARIANTE:** RBAC nunca executa sem contexto completo (tenant + user + actor).

**GARANTIAS:**
- ✅ `validateRBACContext()` valida presença de `req.tenant.id`, `req.user.id`, `req.actionContext.actingActorId`
- ✅ `requirePermission`, `requireAnyPermission`, `requireRole` chamam `validateRBACContext()` antes de autorizar
- ✅ Erro explícito `RBAC_INVARIANT_VIOLATION` se contexto incompleto
- ✅ Ordem obrigatória: auth → tenant → action-context → rbac

**LOCALIZAÇÃO:**
- `backend/src/plugins/rbac.plugin.ts` (função `validateRBACContext`)

**LOGS CANÔNICOS:**
- Log de erro quando contexto RBAC incompleto
- Log de warn quando permissão negada
- Log de debug quando permissão concedida

---

### 5.2 RBAC em Escopo Protegido

**INVARIANTE:** RBAC nunca roda em escopo público.

**GARANTIAS:**
- ✅ `rbacPlugin` registrado apenas no escopo protegido
- ✅ `rbacPlugin` depende de `tenant-plugin`, `auth-plugin`, `action-context-plugin`
- ✅ Nenhuma autorização ocorre sem autenticação prévia

**LOCALIZAÇÃO:**
- `backend/src/server.ts` (registro de `rbacPlugin` no escopo protegido)

---

## 6. Invariantes de Permissions

### 6.1 Permission Resolution

**INVARIANTE:** Resolução de permissão nunca ocorre sem contexto completo.

**GARANTIAS:**
- ✅ `authorizationService.canActAs()` valida `tenantId`, `userId`, `actorId`, `permissionKey` (fail-fast)
- ✅ `validateInputs()` valida todos os inputs críticos antes de qualquer resolução
- ✅ `permissionKey` deve existir no mapa canônico (`isValidPermissionKey()`)
- ✅ Erro explícito `PERMISSION_RESOLUTION_ERROR` se input ausente

**LOCALIZAÇÃO:**
- `backend/src/core/authorization/authorization.service.ts` (função `validateInputs`, linha 27-55)

**LOGS CANÔNICOS:**
- Log de início da resolução (com contexto completo)
- Log de allow (ownership, delegation, capability)
- Log de warn quando permissão negada (com motivo)

---

### 6.2 Determinismo de Permissions

**INVARIANTE:** Resolução de permissão é determinística (mesmos inputs = mesmo resultado).

**GARANTIAS:**
- ✅ Sem cache de permissões (sempre consulta banco)
- ✅ Ordem de verificação fixa: ownership → delegation → capabilities
- ✅ Sem estado mutável na resolução

**LOCALIZAÇÃO:**
- `backend/src/core/authorization/authorization.service.ts` (método `canActAs`, linha 73-242)

---

## 7. Invariantes de Sessão

### 7.1 Invalidação de Sessão

**INVARIANTE:** `token_version` invalida todas as sessões imediatamente.

**GARANTIAS:**
- ✅ `logout()` incrementa `token_version` no banco
- ✅ `verifyAccessToken()` valida `tokenVersion` contra banco
- ✅ `refreshToken()` valida `tokenVersion` contra banco
- ✅ Tokens antigos são rejeitados imediatamente após incremento
- ✅ Nenhuma sessão zombie possível

**LOCALIZAÇÃO:**
- `backend/src/core/auth/auth.service.ts` (método `logout`, linha 744-799)
- `backend/src/core/auth/auth.service.ts` (método `verifyAccessToken`, linha 128-132)
- `backend/src/core/auth/auth.service.ts` (método `refreshToken`, linha 680-692)

**LOGS CANÔNICOS:**
- Log de início da invalidação (com `previousTokenVersion`)
- Log de conclusão da invalidação (com `newTokenVersion`)
- Log de warn quando token invalidado (com `tokenVersionFromToken` vs `tokenVersionFromDB`)

---

### 7.2 Pontos de Invalidação

**INVARIANTE:** `token_version` é incrementado em todos os pontos críticos.

**GARANTIAS:**
- ✅ `logout()` incrementa `token_version`
- ⚠️ **FUTURO:** Troca de senha deve incrementar `token_version` (não implementado)
- ⚠️ **FUTURO:** Revogação manual deve incrementar `token_version` (não implementado)

**LOCALIZAÇÃO:**
- `backend/src/core/auth/auth.service.ts` (método `logout`, linha 771)

---

## 8. Invariantes de Eventos e Contexto Assíncrono

### 8.1 TenantId em Eventos

**INVARIANTE:** Nenhum evento executa sem `tenantId` válido.

**GARANTIAS:**
- ✅ `EventBus.publish()` valida `tenantId` antes de processar (fail-fast)
- ✅ Todos os handlers críticos validam `tenantId` antes de processar
- ✅ Erro explícito `EVENT_CONTEXT_SAFETY_VIOLATION` se `tenantId` ausente
- ✅ Eventos sem `tenantId` são rejeitados imediatamente

**LOCALIZAÇÃO:**
- `backend/src/core/events/event-bus.ts` (método `publish`, linha 60-102)
- Todos os handlers em `backend/src/core/events/register-handlers.ts`

**LOGS CANÔNICOS:**
- Log de evento publicado (com `tenantId` válido)
- Log de erro quando evento rejeitado (com contexto completo)

---

### 8.2 Handlers Validam Contexto

**INVARIANTE:** Todos os handlers críticos validam `tenantId` antes de processar.

**GARANTIAS:**
- ✅ Handlers de reputation validam `tenantId`
- ✅ Handlers de work validam `tenantId`
- ✅ Handlers de groups validam `tenantId`
- ✅ Handlers de notify validam `tenantId`
- ✅ Handlers de event-feed validam `tenantId`
- ✅ Handlers de adapters validam `tenantId`

**LOCALIZAÇÃO:**
- `backend/src/core/reputation/reputation.events.ts`
- `backend/src/core/orchestrator/executors/work.executors.ts`
- `backend/src/core/orchestrator/executors/groups.executors.ts`
- `backend/src/core/orchestrator/executors/groups-activity.executors.ts`
- `backend/src/core/notify/handlers/work-notify.handlers.ts`
- `backend/src/core/notify/handlers/rides-notify.handlers.ts`
- `backend/src/modules/social/event-feed.handlers.ts`
- `backend/src/core/orchestrator/adapters/work.adapter.ts`

**LOGS CANÔNICOS:**
- Log de erro quando handler rejeita evento (com contexto completo)

---

## 9. Invariantes de Cross-Tenant Leakage Prevention

### 9.1 Filtros Explícitos por Tenant

**INVARIANTE:** Todas as queries críticas filtram explicitamente por `tenant_id`.

**GARANTIAS:**
- ✅ `ActorRepository.findById()` filtra por `tenant_id` (linha 33)
- ✅ `CompaniesService.getCompanyById()` filtra por `tenant_id` (linha 644)
- ✅ `BankAccountRepository.getAccountById()` filtra por `tenant_id` (linha 57)
- ✅ `BankLedgerRepository` todas as queries filtram por `tenant_id`
- ✅ Nenhuma query usa apenas `actor_id`, `company_id`, `account_id` isolado

**LOCALIZAÇÃO:**
- `backend/src/modules/social/actor.repository.ts`
- `backend/src/core/companies/companies.service.ts`
- `backend/src/modules/bank/bank-account.repository.ts`
- `backend/src/modules/bank/bank-ledger.repository.ts`

**LOGS CANÔNICOS:**
- Log de erro quando query não filtra por `tenant_id` (auditoria)

---

### 9.2 Uso de runQueryWithTenant

**INVARIANTE:** Queries críticas usam `runQueryWithTenant()` para garantir isolamento.

**GARANTIAS:**
- ✅ `runQueryWithTenant()` aplica contexto de tenant (RLS + filtro explícito)
- ✅ Queries diretas com `pool.query` são proibidas (exceto casos documentados)
- ✅ `getCompanyById()` migrado de `pool.query` para `runQueryWithTenant`

**LOCALIZAÇÃO:**
- `backend/src/core/database/pool.ts` (função `runQueryWithTenant`, linha 166-209)
- `backend/src/core/companies/companies.service.ts` (método `getCompanyById`)

---

## 10. Invariantes de Observabilidade & Forensics

### 10.1 Logs Canônicos Obrigatórios

**INVARIANTE:** Todos os eventos críticos de segurança **DEVEM** ter logs canônicos com correlação completa.

**GARANTIAS:**
- ✅ `canonicalLogger` é o único logger permitido para eventos críticos
- ✅ Logs críticos incluem `requestId`, `correlationId`, `tenantId`, `userId`, `actorId`
- ✅ Logs de segurança incluem `securitySignal: true`, `signalType`, `severity`
- ✅ Proibido uso direto de `console.log/error` ou `fastify.log.*` em código de domínio
- ✅ Métodos semânticos (`abuse`, `invalidation`, `authzAllow`, `authzDeny`) sempre marcam como security signal

**LOCALIZAÇÃO:**
- `backend/src/core/logging/canonical-logger.ts` - Implementação do logger canônico
- Todos os módulos críticos (auth, tenant, rbac, permissions, events, bank)

**LOGS CANÔNICOS:**
- Log de login success/failure (com `securitySignal: true`, `signalType: AUTH`)
- Log de refresh success/failure (com `securitySignal: true`, `signalType: AUTH`)
- Log de logout (com `securitySignal: true`, `signalType: SESSION`)
- Log de permission allow/deny (com `securitySignal: true`, `signalType: RBAC`)
- Log de cross-tenant violation (com `securitySignal: true`, `signalType: TENANT`)
- Log de token invalidation (com `securitySignal: true`, `signalType: SESSION`)
- Log de event rejected (com `securitySignal: true`, `signalType: EVENT`)
- Log de abuse/rate limit (com `securitySignal: true`, `signalType: ABUSE`)

---

### 10.2 Classificação Semântica de Logs

**INVARIANTE:** Logs críticos usam classificação semântica obrigatória.

**GARANTIAS:**
- ✅ `info`: Fluxo normal (ex: login success)
- ✅ `warn`: Tentativa inválida/suspeita (ex: login failure, token invalidado)
- ✅ `error`: Falha sistêmica (ex: evento rejeitado, erro de auth)
- ✅ `abuse`: Comportamento malicioso (ex: rate limit excedido, replay detectado)
- ✅ `invalidation`: Invalidação de sessão/token (ex: logout, token invalidation)
- ✅ `authzDeny`: Negação de autorização esperada (ex: permission denied)
- ✅ `authzAllow`: Autorização concedida (ex: permission granted)
- ✅ `debug`: Informações de debug (apenas em desenvolvimento)

**LOCALIZAÇÃO:**
- `backend/src/core/logging/canonical-logger.ts` - Métodos semânticos
- `docs/audit/LOG-LEVEL-CLASSIFICATION.md` - Documentação de classificação

**LOGS CANÔNICOS:**
- Logs seguem classificação semântica obrigatória
- Nenhum erro logado como `info`
- Nenhuma violação logada como `debug`

---

### 10.3 Completude de Logs

**INVARIANTE:** Todo evento crítico **DEVE** ter log canônico obrigatório.

**GARANTIAS:**
- ✅ Login success/failure sempre logado
- ✅ Refresh success/failure sempre logado
- ✅ Logout sempre logado
- ✅ Permission allow/deny sempre logado
- ✅ Cross-tenant violation sempre logado
- ✅ Token invalidation sempre logado
- ✅ Event rejected sempre logado
- ✅ Rate limit excedido sempre logado

**LOCALIZAÇÃO:**
- `backend/src/core/auth/auth.service.ts` - Logs de auth
- `backend/src/core/auth/auth.routes.ts` - Logs de rotas
- `backend/src/core/authorization/authorization.service.ts` - Logs de permissions
- `backend/src/core/events/event-bus.ts` - Logs de eventos
- `backend/src/core/rate-limiting/auth-rate-limit.service.ts` - Logs de rate limit

**LOGS CANÔNICOS:**
- Logs canônicos para todos os eventos críticos listados acima

---

### 10.4 Correlação e Rastreabilidade

**INVARIANTE:** Todos os logs críticos incluem correlação completa para forensics.

**GARANTIAS:**
- ✅ `requestId`: ID único da requisição (obrigatório)
- ✅ `correlationId`: ID para correlacionar requisições relacionadas (quando aplicável)
- ✅ `tenantId`: ID do tenant (obrigatório quando disponível)
- ✅ `userId`: ID do usuário (obrigatório quando disponível)
- ✅ `actorId`: ID do actor (obrigatório quando disponível)
- ✅ `timestamp`: Timestamp ISO 8601 (obrigatório)

**LOCALIZAÇÃO:**
- `backend/src/core/logging/canonical-logger.ts` - Extração automática de contexto
- `docs/audit/INCIDENT-FORENSICS-GUIDE.md` - Guia de forensics

**LOGS CANÔNICOS:**
- Logs incluem correlação completa para reconstrução de incidentes

---

### 10.5 Security Signals para SIEM/SOC

**INVARIANTE:** Logs críticos de segurança incluem metadados para integração com SIEM/SOC.

**GARANTIAS:**
- ✅ Logs críticos incluem `securitySignal: true`
- ✅ Logs críticos incluem `signalType: AUTH | RBAC | TENANT | ABUSE | SESSION | EVENT`
- ✅ Logs críticos incluem `severity: low | medium | high | critical`
- ✅ Payload padronizado para exportação (JSON estruturado)
- ✅ Detecção automática de signalType baseada em mensagem

**LOCALIZAÇÃO:**
- `backend/src/core/logging/canonical-logger.ts` - Metadados de segurança
- `docs/audit/SECURITY-SIGNAL-PIPELINE.md` - Pipeline de exportação

**LOGS CANÔNICOS:**
- Logs prontos para integração com SIEM/SOC

---

## 11. Regras de Governança

### 10.1 Processo de Adição de Invariantes

**REGRA:** Novos invariantes só podem ser adicionados através de processo formal de governança.

**PROCESSO:**
1. Proposta documentada em ADR (Architecture Decision Record)
2. Revisão por comitê de governança
3. Aprovação formal
4. Atualização deste documento
5. Implementação com validações e logs canônicos

---

### 10.2 Processo de Violação de Invariantes

**REGRA:** Qualquer violação de invariante **DEVE** ser rejeitada imediatamente.

**PROCESSO:**
1. Detecção de violação (validação automática ou revisão)
2. Rejeição imediata da alteração
3. Log canônico da tentativa de violação
4. Notificação ao autor (humano ou IA)
5. Correção obrigatória antes de prosseguir

---

### 10.3 Processo de Evolução de Invariantes

**REGRA:** Invariantes podem ser relaxados apenas através de processo formal.

**PROCESSO:**
1. Justificativa documentada (ADR)
2. Análise de impacto (todos os módulos afetados)
3. Plano de migração (se aplicável)
4. Aprovação formal
5. Atualização deste documento
6. Implementação com validações e logs canônicos

---

## 12. Referências Obrigatórias

### 12.1 Documentos Relacionados

- `docs/01_normative/CORE_IMUTAVEL.md` - Contrato governante
- `docs/architecture/adr/ADR-001-SSOT-READING.md` - SSOT para leitura
- `docs/architecture/adr/ADR-002-CORE-FROZEN.md` - Core congelado
- `docs/architecture/principles/CORE-PRINCIPLES.md` - Princípios canônicos
- `docs/audit/SYSTEM-HARDENING-FINAL-AUDIT.md` - Auditoria de hardening

---

### 12.2 Documentos de Observabilidade

- `docs/audit/INCIDENT-FORENSICS-GUIDE.md` - Guia de forensics e reconstrução de incidentes
- `docs/audit/EXTERNAL-AUDIT-READINESS.md` - Preparação para auditorias externas
- `docs/audit/SECURITY-SIGNAL-PIPELINE.md` - Pipeline de exportação de sinais de segurança
- `docs/audit/SECURITY-SIGNAL-EXPORT-PASS.md` - Pass de exportação de sinais
- `docs/audit/LOG-LEVEL-CLASSIFICATION.md` - Classificação semântica de logs
- `docs/audit/LOG-COMPLETENESS-ASSERTION-PASS.md` - Assertion de completude de logs
- `docs/audit/FORENSICS-DRY-RUN-PASS.md` - Validação de forensics via dry-run

---

### 12.3 Código de Referência

- `backend/src/core/auth/auth.service.ts` - Implementação de auth invariants
- `backend/src/core/authorization/authorization.service.ts` - Implementação de permission invariants
- `backend/src/plugins/rbac.plugin.ts` - Implementação de RBAC invariants
- `backend/src/core/events/event-bus.ts` - Implementação de event invariants
- `backend/src/core/logging/canonical-logger.ts` - Implementação de observability invariants
- `frontend/src/contexts/SessionProvider.tsx` - Implementação de bootstrap invariants

---

## 13. Checklist de Validação

Antes de qualquer alteração que toque em invariantes, validar:

- [ ] Alteração não viola nenhum invariante listado
- [ ] Validações explícitas estão presentes
- [ ] Logs canônicos estão implementados
- [ ] Fail-fast está implementado
- [ ] Documentação está atualizada
- [ ] Testes cobrem os invariantes

---

## 14. Declaração Final

**Este documento é SSOT arquitetural para invariantes canônicos.**

Qualquer alteração que viole um invariante listado aqui **DEVE** ser rejeitada, independentemente de quem a propõe.

**Status:** ✅ CONGELADO COMO CONTRATO INSTITUCIONAL

---

**Última Revisão:** 2024-12-19 (Observabilidade congelada como invariante canônico)  
**Próxima Revisão:** Conforme processo de governança


