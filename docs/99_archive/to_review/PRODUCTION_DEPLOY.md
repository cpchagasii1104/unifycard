# 🚀 Production Deploy Plan - Executável

**Data**: 2025-01-XX  
**Objetivo**: Deploy repetível e seguro para ambiente de **PRODUÇÃO**

---

## ⚠️ AVISOS CRÍTICOS

- **NUNCA** execute estes scripts em ambiente que não seja produção
- **SEMPRE** valide `NODE_ENV=production` antes de executar
- **SEMPRE** faça backup do banco antes de migrations
- **SEMPRE** teste em staging antes de produção
- **SEMPRE** tenha plano de rollback pronto

---

## 📋 Pré-requisitos

### Variáveis de Ambiente Obrigatórias

```bash
export NODE_ENV=production
export DATABASE_URL=postgresql://user:pass@host:5432/production_db
export JWT_SECRET=<secret-com-pelo-menos-64-caracteres>
export PORT=3000  # Opcional, padrão: 3000
export API_URL=https://api.production.com  # Deve usar HTTPS
```

### Variáveis Recomendadas

```bash
export TENANT_SECRET=<secret-com-pelo-menos-32-caracteres>
export CORS_ORIGIN=https://app.production.com
export HELMET_ENABLED=true
```

### Rate Limits (Configuráveis)

```bash
export RATE_LIMIT_RFQ_CREATE=10
export RATE_LIMIT_BOOKING_CREATE=20
export RATE_LIMIT_MESSAGE_SEND=30
export RATE_LIMIT_QUOTE_SUBMIT=15
export RATE_LIMIT_BUNDLE_CREATE=5
export RATE_LIMIT_SERVICE_ORDER_CREATE=20
```

### Feature Flags

```bash
# Desabilitar features sem redeploy
export FEATURE_RFQ_ENABLED=true          # Padrão: true
export FEATURE_BUNDLES_ENABLED=true      # Padrão: true
export FEATURE_FINANCIAL_ENABLED=true    # Padrão: true
export FEATURE_MESSAGING_ENABLED=true    # Padrão: true
```

### Dependências

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm ou pnpm
- curl (para health checks)
- psql (para validações de banco)
- lsof (opcional, para verificar porta)

---

## 📝 Ordem de Execução

### 1. Setup de Ambiente

```bash
cd /path/to/unificard
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export JWT_SECRET=...
chmod +x scripts/production/*.sh
./scripts/production/setup-production.sh
```

**Critérios de Sucesso:**
- ✅ NODE_ENV=production
- ✅ DATABASE_URL configurado e não é staging/dev
- ✅ JWT_SECRET com pelo menos 64 caracteres
- ✅ API_URL usa HTTPS (se definido)
- ✅ Dependências instaladas
- ✅ Migrations encontradas

**Critérios de Abortar:**
- ❌ NODE_ENV != production
- ❌ DATABASE_URL é staging/dev/test
- ❌ JWT_SECRET fraco (< 64 caracteres)
- ❌ API_URL não usa HTTPS
- ❌ Dependências não instaladas

---

### 2. Backup do Banco (OBRIGATÓRIO)

```bash
# Criar backup antes de migrations
pg_dump "$DATABASE_URL" > backup_production_$(date +%Y%m%d_%H%M%S).sql
```

**Critérios de Sucesso:**
- ✅ Backup criado com sucesso
- ✅ Backup testado (pode ser restaurado)

**Critérios de Abortar:**
- ❌ Backup não foi criado
- ❌ Backup não pode ser restaurado

---

### 3. Executar Migrations

**Dry-run primeiro (RECOMENDADO):**
```bash
./scripts/production/migrate-production.sh --dry-run
```

**Execução real:**
```bash
./scripts/production/migrate-production.sh
```

**Critérios de Sucesso:**
- ✅ Todas as migrations executadas sem erro
- ✅ Tabelas críticas criadas/atualizadas
- ✅ schema_migrations registrado

**Critérios de Abortar:**
- ❌ Qualquer migration falhar
- ❌ Tabelas críticas faltando após migrations
- ❌ Erro de conexão com banco

---

### 4. Iniciar Backend

```bash
./scripts/production/start-production.sh
```

**Critérios de Sucesso:**
- ✅ Servidor inicia sem erro
- ✅ Porta configurada corretamente
- ✅ Build compilado e atualizado

**Critérios de Abortar:**
- ❌ Falha ao compilar
- ❌ Falha ao iniciar servidor
- ❌ Porta já em uso

---

### 5. Health Check

```bash
./scripts/production/health-check.sh
```

**Critérios de Sucesso:**
- ✅ Conexão com banco OK
- ✅ Todas as tabelas críticas existem
- ✅ API health endpoint responde (200 OK)
- ✅ Endpoint de autenticação acessível
- ✅ Migrations registradas
- ✅ Feature flags configuradas (se aplicável)

**Critérios de Abortar:**
- ❌ Falha ao conectar ao banco
- ❌ Tabelas críticas faltando
- ❌ API não responde após 10 tentativas
- ❌ Endpoint de autenticação retorna 500

---

### 6. Smoke Test (Sanity)

```bash
cd backend
npx ts-node scripts/production/smoke-production.ts
```

**Critérios de Sucesso:**
- ✅ Todos os testes passam
- ✅ Health endpoint OK
- ✅ Autenticação endpoint OK
- ✅ Permissões endpoint OK
- ✅ Auditoria endpoint OK

**Critérios de Abortar:**
- ❌ Qualquer teste crítico falhar
- ❌ Health endpoint falhar
- ❌ Autenticação endpoint retornar 500

**Nota:** Smoke de produção é **sanity check**, não E2E completo. Não cria dados de teste.

---

## 🔄 Rollback Plan

### Executar Rollback

```bash
./scripts/production/rollback.sh
```

**Passos do Rollback:**
1. Desligar backend
2. Desabilitar features via flags (manual)
3. Voltar tag anterior (se usando git)
4. Restaurar snapshot do banco (manual)
5. Verificar estado antes de reiniciar

**Critérios de Sucesso:**
- ✅ Backend desligado
- ✅ Features desabilitadas (confirmado manualmente)
- ✅ Versão anterior restaurada (se aplicável)
- ✅ Snapshot restaurado (confirmado manualmente)

---

## 🚨 Troubleshooting

### Erro: "NODE_ENV deve ser 'production'"
**Solução:** `export NODE_ENV=production`

### Erro: "DATABASE_URL parece ser de staging/dev"
**Solução:** Use banco exclusivo de produção, não reutilize banco de staging

### Erro: "JWT_SECRET deve ter pelo menos 64 caracteres"
**Solução:** Gere secret mais longo: `openssl rand -hex 32`

### Erro: "API_URL deve usar HTTPS"
**Solução:** Configure API_URL com HTTPS: `https://api.production.com`

### Erro: "Migrations falharam"
**Solução:** 
1. Verificar logs de erro
2. Verificar se backup foi criado
3. Considerar rollback se necessário
4. Verificar se banco precisa de baseline

### Erro: "API não responde"
**Solução:**
1. Verificar se backend está rodando: `ps aux | grep node`
2. Verificar logs do backend
3. Verificar porta: `lsof -i :3000`
4. Verificar firewall/load balancer

### Erro: "Smoke test falhou"
**Solução:**
1. Verificar logs detalhados do teste
2. Verificar se backend está rodando
3. Verificar relatório JSON: `scripts/production/reports/smoke-report.json`
4. Verificar se endpoints estão acessíveis

---

## 🎛️ Feature Flags

### Desabilitar Features sem Redeploy

```bash
# Desabilitar RFQ
export FEATURE_RFQ_ENABLED=false

# Desabilitar Bundles
export FEATURE_BUNDLES_ENABLED=false

# Desabilitar Financeiro
export FEATURE_FINANCIAL_ENABLED=false

# Desabilitar Mensageria
export FEATURE_MESSAGING_ENABLED=false

# Reiniciar backend
./scripts/production/start-production.sh
```

### Como Funciona

- Flags são lidas via `process.env`
- Backend verifica flags antes de registrar rotas
- Fail-closed para permissões (sempre valida)
- Fail-open apenas onde documentado (rate limit, audit log)

### Documentação de Flags

**FEATURE_RFQ_ENABLED:**
- `true`: RFQ habilitado (padrão)
- `false`: Desabilita criação/visualização de RFQs

**FEATURE_BUNDLES_ENABLED:**
- `true`: Bundles habilitados (padrão)
- `false`: Desabilita criação/confirmação de bundles

**FEATURE_FINANCIAL_ENABLED:**
- `true`: Termos financeiros habilitados (padrão)
- `false`: Desabilita confirmação de termos financeiros

**FEATURE_MESSAGING_ENABLED:**
- `true`: Mensageria contextual habilitada (padrão)
- `false`: Desabilita criação/envio de mensagens

---

## 📊 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Backup do banco criado e testado
- [ ] Setup executado com sucesso
- [ ] Migrations executadas (dry-run primeiro)
- [ ] Backend iniciado
- [ ] Health check passou
- [ ] Smoke test passou
- [ ] Logs verificados
- [ ] Métricas monitoradas
- [ ] Funcionalidades críticas validadas manualmente
- [ ] Documentação atualizada

---

## 🔐 Segurança

### Regras Absolutas

1. **NUNCA** usar banco de staging/dev para produção
2. **NUNCA** usar JWT_SECRET de staging/dev
3. **SEMPRE** validar NODE_ENV antes de executar scripts
4. **SEMPRE** verificar DATABASE_URL antes de executar migrations
5. **SEMPRE** usar HTTPS em produção
6. **SEMPRE** fazer backup antes de migrations

### Variáveis Sensíveis

- `JWT_SECRET`: Deve ser único para produção, mínimo 64 caracteres
- `DATABASE_URL`: Deve apontar para banco exclusivo de produção
- `TENANT_SECRET`: Se usado, deve ser único e seguro
- `API_URL`: Deve usar HTTPS

---

## 📝 Notas

- Scripts são **não-interativos** por padrão (CI-friendly)
- Migrations requerem **confirmação manual** em produção
- Rollback requer **confirmação explícita** ("ROLLBACK")
- Smoke test é **sanity check**, não E2E completo
- **SEM seed** em produção (não cria dados de teste)

---

## 🔗 Referências

- [Staging Deploy Plan](./STAGING_DEPLOY.md)
- [Production Checklist](../backend/docs/PRODUCTION_CHECKLIST.md)
- [Migration Guide](../backend/GUIA_BASELINE_MIGRATIONS.md)
- [Error Codes](../backend/src/core/errors/error-codes.ts)

---

**Última atualização**: 2025-01-XX  
**Próxima revisão**: Após primeiro deploy em produção




