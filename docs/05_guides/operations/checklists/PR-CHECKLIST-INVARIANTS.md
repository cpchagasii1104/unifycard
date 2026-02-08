# PR Checklist — Invariantes Canônicos

## Aviso Inicial

⚠️ **Este checklist é OBRIGATÓRIO para TODOS os PRs**  
⚠️ **Violação de invariantes resulta em rejeição automática do PR**  
⚠️ **Nenhuma exceção é permitida**

---

## Referência

**SSOT de Invariantes:** [`docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`](../../audit/SYSTEM-CANONICAL-INVARIANTS.md)

---

## Checklist por Área

### 1. Auth & Session Invariants

#### 1.1 JWT e Token Version
- [ ] `tokenVersion` sempre validado em `verifyAccessToken()`
- [ ] `tokenVersion` sempre validado em `refreshToken()`
- [ ] `generateTokens()` sempre inclui `tokenVersion` do banco
- [ ] Discrepância de `tokenVersion` resulta em 401 imediato
- [ ] Logs canônicos adicionados para invalidação de token

#### 1.2 TenantId no JWT
- [ ] `tenantId` sempre validado em `verifyAccessToken()`
- [ ] `tenantId` sempre validado em `refreshToken()`
- [ ] `generateTokens()` sempre inclui `tenantId`
- [ ] Ausência de `tenantId` resulta em 401 imediato

#### 1.3 Fronteira Auth × Tenant
- [ ] Rotas `/auth/*` não dependem de escopo protegido
- [ ] `tenantPlugin` não roda em `/auth/*` (early return)
- [ ] `authPlugin` não roda em `/auth/*`
- [ ] Login/register funcionam sem `x-tenant-id`
- [ ] Refresh/logout exigem `x-tenant-id`

---

### 2. Tenant & Isolation Invariants

#### 2.1 Isolamento de Tenant
- [ ] Todas as queries críticas filtram por `tenant_id`
- [ ] Nenhuma query usa apenas `actor_id`, `company_id`, `account_id` isolado
- [ ] `runQueryWithTenant()` usado para queries críticas
- [ ] Queries diretas com `pool.query` evitadas (exceto casos documentados)

#### 2.2 Queries Críticas Auditadas
- [ ] `ActorRepository.findById()` filtra por `tenant_id`
- [ ] `CompaniesService.getCompanyById()` filtra por `tenant_id`
- [ ] `BankAccountRepository.getAccountById()` filtra por `tenant_id`
- [ ] `BankLedgerRepository` queries filtram por `tenant_id`
- [ ] Marketplace queries filtram por `tenant_id`

---

### 3. RBAC & Permissions Invariants

#### 3.1 RBAC Bootstrap
- [ ] RBAC nunca roda sem `tenantId` válido
- [ ] RBAC nunca roda sem `userId` válido
- [ ] RBAC nunca roda sem `actorId` válido
- [ ] RBAC nunca roda em escopo público
- [ ] `validateRBACContext()` chamado antes de qualquer decisão

#### 3.2 Permission Resolution
- [ ] `tenantId` obrigatório em `canActAs()`
- [ ] `userId` obrigatório em `canActAs()`
- [ ] `actorId` obrigatório em `canActAs()`
- [ ] `permissionKey` validado contra mapa canônico
- [ ] Logs canônicos para decisões de allow/deny

---

### 4. Session Invalidation Invariants

#### 4.1 Invalidação Hard Guarantee
- [ ] `logout()` incrementa `token_version`
- [ ] `refreshToken()` valida `token_version` antes de gerar novos tokens
- [ ] `verifyAccessToken()` valida `token_version` antes de permitir acesso
- [ ] Troca de senha incrementa `token_version`
- [ ] Revogação manual incrementa `token_version`
- [ ] Logs canônicos de invalidação adicionados

---

### 5. Events & Async Context Invariants

#### 5.1 Event Context Safety
- [ ] `EventBus.publish()` valida `tenantId` antes de publicar
- [ ] Todos os event handlers validam `tenantId` no início
- [ ] Handlers falham rápido se `tenantId` ausente
- [ ] Nenhum handler executa fora de contexto de tenant válido

#### 5.2 Handlers Auditados
- [ ] `reputation.events.ts` valida `tenantId`
- [ ] `work.executors.ts` valida `tenantId`
- [ ] `groups.executors.ts` valida `tenantId`
- [ ] `event-feed.handlers.ts` valida `tenantId`
- [ ] `work-notify.handlers.ts` valida `tenantId`
- [ ] `rides-notify.handlers.ts` valida `tenantId`

---

### 6. Database & Schema Invariants

#### 6.1 Schema Hardening
- [ ] `tenant_id NOT NULL` mantido em tabelas críticas
- [ ] Índices compostos `(tenant_id, id)` mantidos
- [ ] RLS policies mantidas em tabelas críticas
- [ ] CHECK constraints mantidas (ex: `token_version >= 0`)
- [ ] Nenhuma migration remove proteções existentes

#### 6.2 Tabelas Críticas
- [ ] `actors`: `tenant_id NOT NULL`, índice composto, RLS
- [ ] `companies`: `tenant_id NOT NULL`, índice composto, RLS
- [ ] `bank_accounts`: `tenant_id NOT NULL`, índice composto, RLS
- [ ] `bank_ledger`: `tenant_id NOT NULL`, RLS
- [ ] `event_log`: `tenant_id NOT NULL`, RLS
- [ ] `users`: `token_version >= 0` CHECK constraint

---

### 7. Logs & Observability Invariants

#### 7.1 Logs Canônicos Obrigatórios
- [ ] **Logs canônicos adicionados?** (OBRIGATÓRIO para eventos críticos)
- [ ] `canonicalLogger` usado em vez de `console.log/error` ou `fastify.log.*`
- [ ] Logs críticos incluem `requestId`, `correlationId`, `tenantId`, `userId`, `actorId`
- [ ] Logs de segurança incluem `securitySignal: true`, `signalType`, `severity`
- [ ] Métodos semânticos usados (`abuse`, `invalidation`, `authzAllow`, `authzDeny`)

#### 7.2 Classificação Semântica
- [ ] Logs seguem classificação semântica obrigatória (`info`, `warn`, `error`, `abuse`, `invalidation`, `authzDeny`, `authzAllow`)
- [ ] Nenhum erro logado como `info`
- [ ] Nenhuma violação logada como `debug`

#### 7.3 Completude de Logs
- [ ] Login success/failure sempre logado
- [ ] Refresh success/failure sempre logado
- [ ] Logout sempre logado
- [ ] Permission allow/deny sempre logado
- [ ] Cross-tenant violation sempre logado
- [ ] Token invalidation sempre logado
- [ ] Event rejected sempre logado
- [ ] Rate limit excedido sempre logado

#### 7.4 Correlação e Rastreabilidade
- [ ] Logs incluem `requestId` (obrigatório)
- [ ] Logs incluem `correlationId` (quando aplicável)
- [ ] Logs incluem `tenantId` (obrigatório quando disponível)
- [ ] Logs incluem `userId` (obrigatório quando disponível)
- [ ] Logs incluem `actorId` (obrigatório quando disponível)
- [ ] Logs incluem `timestamp` ISO 8601 (obrigatório)

#### 7.5 Security Signals para SIEM/SOC
- [ ] Logs críticos incluem `securitySignal: true`
- [ ] Logs críticos incluem `signalType` apropriado (AUTH, RBAC, TENANT, ABUSE, SESSION, EVENT)
- [ ] Logs críticos incluem `severity` apropriado (low, medium, high, critical)

---

## Rejeição Automática Se

- ❌ Remover validação de `tenantId` em qualquer query crítica
- ❌ Remover validação de `tokenVersion` em auth
- ❌ Permitir RBAC sem contexto completo
- ❌ Permitir eventos sem `tenantId`
- ❌ Remover `NOT NULL` de `tenant_id` em migrations
- ❌ Remover índices compostos `(tenant_id, id)`
- ❌ Remover RLS policies
- ❌ Adicionar fallback silencioso para invariantes
- ❌ Usar `console.log/error` ou `fastify.log.*` em código de domínio (deve usar `canonicalLogger`)
- ❌ Remover logs canônicos de eventos críticos
- ❌ Logs críticos sem correlação completa (`requestId`, `tenantId`, `userId`, `actorId`)
- ❌ Logs críticos sem `securitySignal: true` quando aplicável

---

## Aprovação

- [ ] Review de CODEOWNER obrigatório (para mudanças em `core/`)
- [ ] Todos os checkboxes marcados
- [ ] Testes de invariantes passam: `npm run test:invariants`
- [ ] Nenhuma violação detectada

---

## Notas

- Este checklist deve ser preenchido **antes** de abrir o PR
- Violações detectadas durante review resultam em rejeição imediata
- Exceções só são permitidas através de processo formal de governança

