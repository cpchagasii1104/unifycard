# Scripts de Produção

Scripts automatizados para deploy e validação de ambiente de **PRODUÇÃO**.

## ⚠️ AVISOS CRÍTICOS

- **NUNCA** execute estes scripts em ambiente que não seja produção
- **SEMPRE** valide `NODE_ENV=production` antes de executar
- **SEMPRE** faça backup do banco antes de migrations
- **SEMPRE** teste em staging antes de produção

## Estrutura

```
scripts/production/
├── setup-production.sh        # Setup + validações rigorosas
├── migrate-production.sh      # Migrations com dry-run
├── start-production.sh       # Build + start seguro
├── health-check.sh           # Validações completas
├── smoke-production.ts       # Sanity checks (SEM seed)
├── rollback.sh               # Rollback plan executável
└── README.md                 # Este arquivo
```

## Uso

### Setup

```bash
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export JWT_SECRET=...
./scripts/production/setup-production.sh
```

### Migrations

**Dry-run (recomendado primeiro):**
```bash
./scripts/production/migrate-production.sh --dry-run
```

**Execução real:**
```bash
./scripts/production/migrate-production.sh
```

### Iniciar Backend

```bash
./scripts/production/start-production.sh
```

### Health Check

```bash
./scripts/production/health-check.sh
```

### Smoke Test

```bash
cd backend
npx ts-node scripts/production/smoke-production.ts
```

**Com debug:**
```bash
cd backend
DEBUG=true npx ts-node scripts/production/smoke-production.ts
```

### Rollback

```bash
./scripts/production/rollback.sh
# Seguir instruções interativas
```

## Feature Flags

Desabilitar features sem redeploy:

```bash
export FEATURE_RFQ_ENABLED=false
export FEATURE_BUNDLES_ENABLED=false
export FEATURE_FINANCIAL_ENABLED=false
export FEATURE_MESSAGING_ENABLED=false
```

Reiniciar backend após alterar flags.

## Dependências

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm ou pnpm
- curl (para health checks)
- psql (para validações de banco)
- lsof (opcional, para verificar porta)

## Documentação Completa

Veja [docs/PRODUCTION_DEPLOY.md](../../docs/PRODUCTION_DEPLOY.md) para documentação completa.




