# 🚀 Staging Deploy Plan - Executável

**Data**: 2025-01-XX  
**Objetivo**: Deploy repetível e seguro para ambiente de staging

---

## 📋 Visão Geral

Este documento descreve o processo completo de deploy para staging, incluindo:
- Scripts automatizados
- Validações fail-fast
- Smoke tests
- Rollback plan

---

## 🎯 Pré-requisitos

### Variáveis de Ambiente Obrigatórias

```bash
export NODE_ENV=staging
export DATABASE_URL=postgresql://user:pass@host:5432/staging_db
export JWT_SECRET=<secret-com-pelo-menos-32-caracteres>
export PORT=3000  # Opcional, padrão: 3000
export API_URL=http://localhost:3000  # Para smoke tests
```

### Dependências

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm ou pnpm
- curl (para health checks)

---

## 📝 Ordem de Execução

### Opção A: Comando Único (Recomendado)

```bash
cd /path/to/unificard
export NODE_ENV=staging
export DATABASE_URL=postgresql://...
export JWT_SECRET=...
chmod +x scripts/staging/*.sh
./scripts/staging/staging-up.sh
```

**O que faz:**
1. Setup de ambiente
2. Executa migrations
3. Executa seed
4. Inicia backend
5. Health check
6. Smoke test

**Critérios de Sucesso:**
- ✅ Todos os passos completam sem erro
- ✅ Backend inicia e responde
- ✅ Smoke test passa

---

### Opção B: Passo a Passo Manual

### 1. Setup de Ambiente

```bash
cd /path/to/unificard
export NODE_ENV=staging
export DATABASE_URL=postgresql://...
export JWT_SECRET=...
chmod +x scripts/staging/*.sh
./scripts/staging/setup-staging.sh
```

**Critérios de Sucesso:**
- ✅ NODE_ENV=staging
- ✅ DATABASE_URL configurado e não é produção
- ✅ JWT_SECRET com pelo menos 32 caracteres
- ✅ Dependências instaladas
- ✅ Migrations encontradas

**Critérios de Abortar:**
- ❌ NODE_ENV != staging
- ❌ DATABASE_URL não definido ou é produção
- ❌ JWT_SECRET fraco (< 32 caracteres)
- ❌ Dependências não instaladas

---

### 2. Executar Migrations

```bash
./scripts/staging/migrate-staging.sh
```

**Critérios de Sucesso:**
- ✅ Todas as migrations executadas sem erro
- ✅ Tabelas críticas criadas (tenants, users, actors, events, service_orders, business_audit_logs)
- ✅ schema_migrations registrado

**Critérios de Abortar:**
- ❌ Qualquer migration falhar
- ❌ Tabelas críticas não existirem após migrations
- ❌ Erro de conexão com banco

---

### 3. Seed Mínimo

```bash
cd backend
npx ts-node scripts/staging/seed-staging.ts
```

**Critérios de Sucesso:**
- ✅ Tenant de staging criado ou já existe
- ✅ Usuário de staging criado ou já existe
- ✅ Credenciais disponíveis

**Critérios de Abortar:**
- ❌ Falha ao conectar ao banco
- ❌ Falha ao criar tenant
- ❌ Falha ao criar usuário

---

### 4. Iniciar Backend

```bash
./scripts/staging/start-staging.sh
```

**Critérios de Sucesso:**
- ✅ Servidor inicia sem erro
- ✅ Porta configurada corretamente
- ✅ Build compilado (se necessário)

**Critérios de Abortar:**
- ❌ Falha ao compilar
- ❌ Falha ao iniciar servidor
- ❌ Porta já em uso

---

### 5. Health Check

```bash
./scripts/staging/health-check.sh
```

**Critérios de Sucesso:**
- ✅ Conexão com banco OK
- ✅ Todas as tabelas críticas existem
- ✅ API health endpoint responde (200 OK)
- ✅ Endpoint de autenticação acessível
- ✅ Migrations registradas

**Critérios de Abortar:**
- ❌ Falha ao conectar ao banco
- ❌ Tabelas críticas faltando
- ❌ API não responde após 5 tentativas
- ❌ Endpoint de autenticação inacessível

---

### 6. Smoke Test

#### Modo Normal (Non-Strict)

```bash
cd backend
npx ts-node scripts/staging/smoke-test.ts
```

**Comportamento:**
- Testes críticos devem passar
- Testes semi-críticos podem falhar (não aborta)
- Testes opcionais podem ser pulados

#### Modo Strict (CI-Ready)

```bash
cd backend
STRICT=true npx ts-node scripts/staging/smoke-test.ts
```

**Comportamento:**
- **TODOS** os testes devem passar
- Endpoints ausentes → FAIL
- Steps pulados → FAIL
- Zero tolerância a falhas

#### Modo Debug

```bash
cd backend
DEBUG=true STRICT=true npx ts-node scripts/staging/smoke-test.ts
```

**Comportamento:**
- Inclui stack traces nos erros
- Mais detalhes no relatório JSON

**Critérios de Sucesso:**
- ✅ Todos os testes críticos passam
- ✅ Fluxo completo executado:
  - Login (CRÍTICO)
  - Criar empresa (CRÍTICO)
  - Onboarding (OPCIONAL)
  - Criar evento (CRÍTICO)
  - Criar RFQ (CRÍTICO)
  - Responder RFQ (SEMI-CRÍTICO)
  - Converter RFQ → Booking (SEMI-CRÍTICO)
  - Aceitar booking (SEMI-CRÍTICO)
  - Confirmar booking (CRÍTICO)
  - Confirmar termos financeiros (OPCIONAL)
  - Verificar auditoria (OPCIONAL)

**Critérios de Abortar:**
- ❌ Qualquer teste crítico falhar
- ❌ Em modo STRICT: qualquer teste falhar
- ❌ Login falhar
- ❌ Criar empresa falhar
- ❌ Criar evento falhar
- ❌ Criar RFQ falhar

**Relatório JSON:**
- Salvo em: `scripts/staging/reports/smoke-report.json`
- Contém: status, duração, steps, erros, requestId/correlationId

---

## 🔄 Rollback Plan

### Executar Rollback

```bash
./scripts/staging/rollback.sh
```

**Passos do Rollback:**
1. Desligar backend
2. Restaurar snapshot do banco (manual)
3. Voltar tag anterior (se usando git)
4. Desabilitar features via env (manual)

**Critérios de Sucesso:**
- ✅ Backend desligado
- ✅ Snapshot restaurado (confirmado manualmente)
- ✅ Versão anterior restaurada (se aplicável)

---

## 🚨 Troubleshooting

### Erro: "NODE_ENV deve ser 'staging'"
**Solução:** `export NODE_ENV=staging`

### Erro: "DATABASE_URL parece ser de produção"
**Solução:** Use banco exclusivo para staging, não reutilize banco de produção

### Erro: "JWT_SECRET deve ter pelo menos 32 caracteres"
**Solução:** Gere secret mais longo: `openssl rand -hex 32`

### Erro: "Migrations falharam"
**Solução:** 
1. Verificar logs de erro
2. Verificar se banco já existe e precisa de baseline: `npm run baseline:migrations`
3. Verificar conexão com banco

### Erro: "API não responde"
**Solução:**
1. Verificar se backend está rodando: `ps aux | grep node`
2. Verificar logs do backend
3. Verificar porta: `lsof -i :3000`
4. Verificar firewall

### Erro: "Smoke test falhou"
**Solução:**
1. Verificar logs detalhados do teste
2. Verificar se seed foi executado
3. Verificar se backend está rodando
4. Verificar credenciais de staging

---

## 📊 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Setup executado com sucesso
- [ ] Migrations executadas
- [ ] Seed executado
- [ ] Backend iniciado
- [ ] Health check passou
- [ ] Smoke test passou
- [ ] Logs verificados
- [ ] Documentação atualizada

---

## 🔐 Segurança

### Regras Absolutas

1. **NUNCA** usar banco de produção para staging
2. **NUNCA** usar JWT_SECRET de produção
3. **SEMPRE** validar NODE_ENV antes de executar scripts
4. **SEMPRE** verificar DATABASE_URL antes de executar migrations

### Variáveis Sensíveis

- `JWT_SECRET`: Deve ser único para staging
- `DATABASE_URL`: Deve apontar para banco exclusivo
- `TENANT_SECRET`: Se usado, deve ser único

---

## 📝 Notas

- Scripts são **não-interativos** por padrão (CI-friendly)
- Todos os scripts **abortam** se validação falhar (fail-fast)
- Smoke test pode **pular** testes se endpoints não existirem
- Rollback requer **confirmação manual** para segurança

---

## 📊 Relatório de Smoke Test

O smoke test gera um relatório JSON estruturado em `scripts/staging/reports/smoke-report.json`.

### Exemplo de Relatório

```json
{
  "status": "PASS",
  "timestamp": "2025-01-XXT10:00:00.000Z",
  "totalDuration": 12345,
  "strictMode": false,
  "steps": [
    {
      "name": "Login",
      "category": "critical",
      "status": "PASS",
      "duration": 234,
      "requestId": "req-123",
      "correlationId": "corr-456"
    },
    {
      "name": "Criar empresa",
      "category": "critical",
      "status": "PASS",
      "duration": 456
    },
    {
      "name": "Onboarding",
      "category": "optional",
      "status": "SKIP",
      "duration": 12,
      "skippedReason": "Endpoint de onboarding não disponível"
    }
  ],
  "summary": {
    "total": 11,
    "passed": 9,
    "failed": 0,
    "skipped": 2,
    "criticalFailed": 0,
    "semiCriticalFailed": 0,
    "optionalFailed": 0
  }
}
```

### Matriz de Steps

**Críticos (não podem falhar):**
- Login
- Criar empresa
- Criar evento
- Criar RFQ
- Confirmar booking

**Semi-Críticos (podem falhar em modo non-strict):**
- Responder RFQ
- Converter RFQ → Booking
- Aceitar booking

**Opcionais (podem ser pulados):**
- Onboarding
- Confirmar termos financeiros
- Verificar auditoria

---

## 🎯 Regras de Negócio: Eventos XL/XXL e Produção Assistida

### Regra: Eventos XL/XXL Requerem Produção Assistida

**Definição:**
- Eventos com `capacityClass` = `XL` (801-3000 pessoas) ou `XXL` (>3000 pessoas) **NÃO permitem booking direto**.
- Estes eventos **exigem RFQ (Request for Quotation)** para contratar serviços.

### Comportamento do Sistema

1. **Backend (Bloqueio Automático):**
   - `POST /services/:id/bookings` → Retorna erro `EVENT_REQUIRES_ASSISTED_PRODUCTION` se `eventId` vinculado e `capacityClass` = `XL` ou `XXL`.
   - `POST /service-bundles/book` → Retorna erro `EVENT_REQUIRES_ASSISTED_PRODUCTION` se `eventId` vinculado e `capacityClass` = `XL` ou `XXL`.
   - Registra audit log: `production_assisted_required`.

2. **Frontend (UX):**
   - `EventPage` exibe banner fixo: "Este evento exige produção assistida. Use RFQ para contratar serviços."
   - Botões de ação direcionam para criação/visualização de RFQ.
   - Modal de compatibilidade bloqueia booking se `requiresProductionAssistance = true`.

### Como Testar

1. **Criar evento XL/XXL:**
   ```bash
   # Criar evento com capacidade XL (ex: 1500 pessoas)
   POST /events
   {
     "metadata": {
       "capacity": {
         "expectedAttendance": 1500,
         "capacityClass": "XL"
       }
     }
   }
   ```

2. **Tentar booking direto (deve falhar):**
   ```bash
   POST /services/:serviceId/bookings
   {
     "metadata": {
       "eventId": "<evento-xl-id>"
     }
   }
   # Esperado: 400 Bad Request
   # Código: EVENT_REQUIRES_ASSISTED_PRODUCTION
   ```

3. **Criar RFQ (deve funcionar):**
   ```bash
   POST /events/:eventId/rfqs
   {
     "items": [{"type": "need", "id": "catering"}],
     "criteria": {"expectedPriceCents": 100000}
   }
   # Esperado: 200 OK
   ```

4. **Verificar audit log:**
   ```bash
   GET /business-audit-logs?action=production_assisted_required
   # Deve retornar log da tentativa de booking bloqueada
   ```

### Endpoints Afetados

- `POST /services/:id/bookings` - Bloqueado para XL/XXL
- `POST /service-bundles/book` - Bloqueado para XL/XXL
- `POST /events/:eventId/rfqs` - **Recomendado** para XL/XXL
- `GET /business-audit-logs` - Registra tentativas bloqueadas

---

## 🔗 Referências

- [Production Checklist](../backend/docs/PRODUCTION_CHECKLIST.md)
- [Migration Guide](../backend/GUIA_BASELINE_MIGRATIONS.md)
- [Error Codes](../backend/src/core/errors/error-codes.ts)

---

**Última atualização**: 2025-01-XX  
**Próxima revisão**: Após primeiro deploy em staging

