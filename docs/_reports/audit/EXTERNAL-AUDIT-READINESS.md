# External Audit Readiness

**Data:** 2024-12-19  
**Status:** ✅ COMPLETO  
**Padrões:** SOC2 Type II, ISO 27001, LGPD

## Objetivo

Garantir que o sistema está **pronto para auditoria externa**, com controles mapeados, testados e documentados. O auditor não deve encontrar "unknown unknowns" — todos os controles devem ser rastreáveis de requisito a código, teste e documentação.

## Estrutura de Rastreabilidade

Cada controle segue a estrutura:

```
REQUISITO (SOC2/ISO/LGPD)
  ↓
CONTROLE (Implementação)
  ↓
CÓDIGO (Localização)
  ↓
TESTE (Validação)
  ↓
DOCUMENTAÇÃO (Evidência)
```

## Matriz de Controles

### 1. Autenticação (Authentication)

#### 1.1 CC6.1 - Identity Management (SOC2)
**Requisito:** Sistema deve gerenciar identidades de usuários de forma segura.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **JWT com tenantId obrigatório** | `backend/src/core/auth/auth.service.ts:51-77` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.2` |
| **JWT com tokenVersion obrigatório** | `backend/src/core/auth/auth.service.ts:51-77` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |
| **Validação de token em todas as requisições** | `backend/src/core/auth/auth.plugin.ts:10-118` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |
| **Logout invalida todas as sessões** | `backend/src/core/auth/auth.service.ts:744-799` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |

**Evidências:**
- ✅ Código: JWT sempre inclui `tenantId` e `tokenVersion`
- ✅ Teste: `auth-invariants.test.ts` valida presença obrigatória
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md` documenta invariante

#### 1.2 CC6.2 - Credential Management (SOC2)
**Requisito:** Sistema deve proteger credenciais de usuários.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Senhas hasheadas com bcrypt** | `backend/src/core/auth/auth.service.ts:287` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |
| **Rate limiting em login/register** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |
| **Validação de CPF** | `backend/src/core/auth/auth.routes.ts:359-408` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |

**Evidências:**
- ✅ Código: Senhas sempre hasheadas com bcrypt (salt rounds: 10)
- ✅ Teste: `auth-invariants.test.ts` valida hashing
- ✅ Documentação: `RATE-LIMIT-ABUSE-HARDENING-PASS.md` documenta proteção

#### 1.3 A.9.2.1 - User Registration and De-registration (ISO 27001)
**Requisito:** Sistema deve registrar e desregistrar usuários de forma controlada.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Registro com validação de CPF** | `backend/src/core/auth/auth.service.ts:181-538` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |
| **Logout invalida sessões** | `backend/src/core/auth/auth.service.ts:744-799` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |

**Evidências:**
- ✅ Código: Registro valida CPF, email, senha
- ✅ Teste: `auth-invariants.test.ts` valida registro
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md` documenta processo

---

### 2. Controle de Acesso (Access Control)

#### 2.1 CC6.3 - Access Control (SOC2)
**Requisito:** Sistema deve controlar acesso a recursos baseado em permissões.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **RBAC com contexto completo** | `backend/src/plugins/rbac.plugin.ts:37-89` | `backend/tests/invariants/rbac-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#5` |
| **Validação de tenant obrigatória** | `backend/src/plugins/rbac.plugin.ts:38-47` | `backend/tests/invariants/rbac-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#5.1` |
| **Validação de user obrigatória** | `backend/src/plugins/rbac.plugin.ts:49-59` | `backend/tests/invariants/rbac-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#5.1` |
| **Validação de actor obrigatória** | `backend/src/plugins/rbac.plugin.ts:61-73` | `backend/tests/invariants/rbac-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#5.1` |
| **Resolução de permissões determinística** | `backend/src/core/authorization/authorization.service.ts:73-402` | `backend/tests/invariants/permission-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#6` |

**Evidências:**
- ✅ Código: RBAC valida tenant + user + actor antes de qualquer autorização
- ✅ Teste: `rbac-invariants.test.ts` valida contexto completo
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md#5` documenta RBAC

#### 2.2 A.9.1.2 - Access to Networks and Network Services (ISO 27001)
**Requisito:** Sistema deve controlar acesso a serviços de rede.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Rotas protegidas exigem autenticação** | `backend/src/server.ts:292-300` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.3` |
| **Rotas públicas não exigem autenticação** | `backend/src/server.ts:203` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.3` |

**Evidências:**
- ✅ Código: Escopo protegido registrado após rotas públicas
- ✅ Teste: `auth-invariants.test.ts` valida fronteira
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md#1.3` documenta fronteira

#### 2.3 A.9.4.2 - Secure Log-on Procedures (ISO 27001)
**Requisito:** Sistema deve implementar procedimentos seguros de login.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Rate limiting em login** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |
| **Validação de token em cada requisição** | `backend/src/core/auth/auth.plugin.ts:10-118` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |

**Evidências:**
- ✅ Código: Rate limiting multi-camada (IP, tenant, user, email)
- ✅ Teste: `auth-invariants.test.ts` valida rate limiting
- ✅ Documentação: `RATE-LIMIT-ABUSE-HARDENING-PASS.md` documenta proteção

---

### 3. Isolamento de Dados (Data Isolation)

#### 3.1 CC6.6 - Logical and Physical Access Controls (SOC2)
**Requisito:** Sistema deve isolar dados de diferentes tenants.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Filtro tenant_id em todas as queries críticas** | `backend/src/modules/social/actor.repository.ts:33` | `backend/tests/invariants/tenant-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#2.1` |
| **runQueryWithTenant aplica RLS** | `backend/src/core/database/pool.ts` | `backend/tests/invariants/tenant-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#2.1` |
| **Queries nunca usam apenas actor_id/user_id isolado** | `backend/src/core/companies/companies.service.ts` | `backend/tests/invariants/tenant-invariants.test.ts` | `docs/audit/GLOBAL-USER-ID-TENANT-SAFETY-PASS.md` |
| **Schema reforça isolamento (NOT NULL, FKs)** | `backend/migrations/313_schema_invariant_hardening.sql` | `backend/scripts/validate-schema-invariants.ts` | `docs/audit/SCHEMA-INVARIANT-HARDENING.md` |

**Evidências:**
- ✅ Código: Todas as queries críticas filtram por `tenant_id`
- ✅ Teste: `tenant-invariants.test.ts` valida isolamento
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md#2.1` documenta isolamento

#### 3.2 A.9.4.5 - Access Control to Program Source Code (ISO 27001)
**Requisito:** Sistema deve proteger código fonte e dados.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **RLS habilitado em tabelas críticas** | `backend/migrations/313_schema_invariant_hardening.sql` | `backend/scripts/validate-schema-invariants.ts` | `docs/audit/SCHEMA-INVARIANT-HARDENING.md` |
| **Índices compostos (tenant_id, id)** | `backend/migrations/313_schema_invariant_hardening.sql` | `backend/scripts/validate-schema-invariants.ts` | `docs/audit/TENANT-AWARE-INDEX-QUERY-PLAN-PASS.md` |

**Evidências:**
- ✅ Código: RLS habilitado em `actors`, `companies`, `bank_accounts`, `bank_ledger`, `event_log`
- ✅ Teste: `validate-schema-invariants.ts` valida RLS
- ✅ Documentação: `SCHEMA-INVARIANT-HARDENING.md` documenta RLS

#### 3.3 Art. 46 - Segurança de Dados (LGPD)
**Requisito:** Sistema deve garantir segurança dos dados pessoais.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Isolamento multi-tenant** | `backend/src/plugins/tenant.plugin.ts` | `backend/tests/invariants/tenant-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#2.1` |
| **Criptografia de senhas** | `backend/src/core/auth/auth.service.ts:287` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#1.1` |

**Evidências:**
- ✅ Código: Isolamento garantido por `tenant_id` em todas as queries
- ✅ Teste: `tenant-invariants.test.ts` valida isolamento
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md#2.1` documenta isolamento

---

### 4. Logging e Auditoria (Logging & Audit)

#### 4.1 CC7.2 - System Operations (SOC2)
**Requisito:** Sistema deve registrar operações para auditoria.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Logs canônicos com correlação completa** | `backend/src/core/logging/canonical-logger.ts` | `backend/tests/invariants/*.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |
| **requestId em todas as requisições** | `backend/src/plugins/request-id.plugin.ts` | `backend/tests/invariants/*.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |
| **correlationId para eventos assíncronos** | `backend/src/plugins/request-id.plugin.ts` | `backend/tests/invariants/event-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |
| **Logs de autorização (allow/deny)** | `backend/src/core/authorization/authorization.service.ts` | `backend/tests/invariants/permission-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |
| **Logs de abuso detectado** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |

**Evidências:**
- ✅ Código: Logger canônico extrai contexto automaticamente
- ✅ Teste: Testes validam logs estruturados
- ✅ Documentação: `INCIDENT-FORENSICS-GUIDE.md` documenta logging

#### 4.2 A.12.4.1 - Event Logging (ISO 27001)
**Requisito:** Sistema deve registrar eventos de segurança.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Logs de autenticação** | `backend/src/core/auth/auth.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md#1` |
| **Logs de autorização** | `backend/src/core/authorization/authorization.service.ts` | `backend/tests/invariants/permission-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md#2` |
| **Logs de invalidação de sessão** | `backend/src/core/auth/auth.service.ts:744-799` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md#1` |
| **Logs de abuso** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |

**Evidências:**
- ✅ Código: Logs estruturados com contexto completo
- ✅ Teste: Testes validam logs
- ✅ Documentação: `INCIDENT-FORENSICS-GUIDE.md` documenta eventos

#### 4.3 Art. 50 - Registro de Acesso (LGPD)
**Requisito:** Sistema deve registrar acessos a dados pessoais.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Logs de acesso com userId e tenantId** | `backend/src/core/logging/canonical-logger.ts` | `backend/tests/invariants/*.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |
| **Logs de operações críticas** | `backend/src/core/authorization/authorization.service.ts` | `backend/tests/invariants/permission-invariants.test.ts` | `docs/audit/INCIDENT-FORENSICS-GUIDE.md` |

**Evidências:**
- ✅ Código: Logs incluem `userId`, `tenantId`, `actorId`
- ✅ Teste: Testes validam logs
- ✅ Documentação: `INCIDENT-FORENSICS-GUIDE.md` documenta rastreabilidade

---

### 5. Gestão de Sessão (Session Management)

#### 5.1 CC6.4 - Session Management (SOC2)
**Requisito:** Sistema deve gerenciar sessões de forma segura.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **tokenVersion invalida todas as sessões** | `backend/src/core/auth/auth.service.ts:744-799` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#7` |
| **Validação de tokenVersion em refresh** | `backend/src/core/auth/auth.service.ts:625-733` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#7.1` |
| **Validação de tokenVersion em access token** | `backend/src/core/auth/auth.service.ts:80-154` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md#7.1` |

**Evidências:**
- ✅ Código: `tokenVersion` incrementado em logout invalida todas as sessões
- ✅ Teste: `auth-invariants.test.ts` valida invalidação
- ✅ Documentação: `SYSTEM-CANONICAL-INVARIANTS.md#7` documenta sessões

---

### 6. Proteção contra Abuso (Abuse Prevention)

#### 6.1 CC7.4 - System Monitoring (SOC2)
**Requisito:** Sistema deve monitorar e detectar atividades suspeitas.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Rate limiting multi-camada** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |
| **Logs de abuso detectado** | `backend/src/core/rate-limiting/auth-rate-limit.service.ts` | `backend/tests/invariants/auth-invariants.test.ts` | `docs/audit/RATE-LIMIT-ABUSE-HARDENING-PASS.md` |
| **Proteção contra replay de eventos** | `backend/src/core/events/idempotency-tracker.ts` | `backend/tests/invariants/event-invariants.test.ts` | `docs/audit/EVENT-REPLAY-IDEMPOTENCY-PASS.md` |

**Evidências:**
- ✅ Código: Rate limiting por IP, tenant, user, email
- ✅ Teste: Testes validam rate limiting
- ✅ Documentação: `RATE-LIMIT-ABUSE-HARDENING-PASS.md` documenta proteção

---

### 7. Integridade de Dados (Data Integrity)

#### 7.1 CC7.3 - System Changes (SOC2)
**Requisito:** Sistema deve garantir integridade de dados.

| Componente | Localização | Teste | Documentação |
|------------|-------------|-------|---------------|
| **Idempotência de eventos críticos** | `backend/src/core/events/idempotency-tracker.ts` | `backend/tests/invariants/event-invariants.test.ts` | `docs/audit/EVENT-REPLAY-IDEMPOTENCY-PASS.md` |
| **Schema reforça integridade (NOT NULL, FKs, CHECK)** | `backend/migrations/313_schema_invariant_hardening.sql` | `backend/scripts/validate-schema-invariants.ts` | `docs/audit/SCHEMA-INVARIANT-HARDENING.md` |
| **Transações atômicas** | `backend/src/core/database/pool.ts` | `backend/tests/invariants/*.test.ts` | `docs/audit/CONCURRENCY-RACE-CONDITION-STRESS-PASS.md` |

**Evidências:**
- ✅ Código: Idempotency tracker previne replay
- ✅ Teste: `event-invariants.test.ts` valida idempotência
- ✅ Documentação: `EVENT-REPLAY-IDEMPOTENCY-PASS.md` documenta idempotência

---

## Checklist de Preparação

### ✅ Controles Mapeados

- [x] Autenticação mapeada para SOC2 CC6.1, CC6.2, ISO A.9.2.1
- [x] Controle de acesso mapeado para SOC2 CC6.3, ISO A.9.1.2, A.9.4.2
- [x] Isolamento de dados mapeado para SOC2 CC6.6, ISO A.9.4.5, LGPD Art. 46
- [x] Logging mapeado para SOC2 CC7.2, ISO A.12.4.1, LGPD Art. 50
- [x] Gestão de sessão mapeada para SOC2 CC6.4
- [x] Proteção contra abuso mapeada para SOC2 CC7.4
- [x] Integridade de dados mapeada para SOC2 CC7.3

### ✅ Rastreabilidade Completa

- [x] Cada controle tem código correspondente
- [x] Cada controle tem teste correspondente
- [x] Cada controle tem documentação correspondente
- [x] Matriz CONTROL → CODE → TEST → DOC completa

### ✅ Evidências Disponíveis

- [x] Código fonte versionado (Git)
- [x] Testes automatizados (Jest)
- [x] Documentação técnica (Markdown)
- [x] Logs estruturados (JSON)
- [x] Migrations versionadas (SQL)

---

## Como Apresentar ao Auditor

### 1. Visão Geral

Apresentar:
- **Documento SSOT:** `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`
- **Matriz de Controles:** Este documento
- **Testes Institucionais:** `backend/tests/invariants/`

### 2. Demonstração de Controles

Para cada controle, demonstrar:
1. **Código:** Mostrar implementação no código fonte
2. **Teste:** Executar teste correspondente
3. **Documentação:** Apontar para documentação
4. **Logs:** Mostrar logs estruturados

### 3. Rastreabilidade

Demonstrar que:
- Requisito → Controle → Código → Teste → Documentação
- Nenhum controle é "black box"
- Todos os controles são testáveis e auditáveis

### 4. Evidências

Fornecer:
- **Código:** Acesso ao repositório Git
- **Testes:** Execução de testes com cobertura
- **Documentação:** Acesso a documentação técnica
- **Logs:** Exemplos de logs estruturados

---

## Gaps Identificados

### ⚠️ Gaps Potenciais

1. **Retenção de Logs**
   - **Status:** Documentado em `INCIDENT-FORENSICS-GUIDE.md`
   - **Ação:** Implementar política de retenção automatizada

2. **Backup e Recuperação**
   - **Status:** Não mapeado neste documento
   - **Ação:** Criar documento de backup e disaster recovery

3. **Criptografia em Trânsito**
   - **Status:** Assumido (HTTPS)
   - **Ação:** Documentar configuração de TLS

4. **Criptografia em Repouso**
   - **Status:** Assumido (PostgreSQL)
   - **Ação:** Documentar configuração de criptografia

---

## Próximos Passos

1. **Implementar política de retenção de logs**
2. **Criar documento de backup e disaster recovery**
3. **Documentar configuração de TLS/HTTPS**
4. **Documentar configuração de criptografia em repouso**
5. **Criar runbook de resposta a incidentes**

---

## Referências

- **SOC2:** Trust Services Criteria
- **ISO 27001:** Information Security Management
- **LGPD:** Lei Geral de Proteção de Dados (Lei 13.709/2018)
- **Invariantes:** `docs/audit/SYSTEM-CANONICAL-INVARIANTS.md`
- **Forensics:** `docs/audit/INCIDENT-FORENSICS-GUIDE.md`
- **Testes:** `backend/tests/invariants/README.md`

