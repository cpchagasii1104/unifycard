# Scripts de Staging

Scripts automatizados para deploy e validação de ambiente de staging.

## Estrutura

```
scripts/staging/
├── setup-staging.sh        # Setup de ambiente + validações
├── migrate-staging.sh      # Executa migrations
├── seed-staging.ts         # Seed mínimo obrigatório
├── start-staging.sh        # Inicia backend
├── health-check.sh         # Valida API, DB, Auth
├── smoke-test.ts           # Smoke test automatizado
├── rollback.sh             # Rollback plan executável
└── README.md               # Este arquivo
```

## Uso Rápido

### Opção A: Comando Único (Recomendado)

```bash
# 1. Configurar variáveis de ambiente
export NODE_ENV=staging
export DATABASE_URL=postgresql://...
export JWT_SECRET=...

# 2. Executar tudo
./scripts/staging/staging-up.sh
```

### Opção B: Passo a Passo

```bash
# 1. Configurar variáveis de ambiente
export NODE_ENV=staging
export DATABASE_URL=postgresql://...
export JWT_SECRET=...

# 2. Setup
./scripts/staging/setup-staging.sh

# 3. Migrations
./scripts/staging/migrate-staging.sh

# 4. Seed
cd backend && npx ts-node ../scripts/staging/seed-staging.ts

# 5. Iniciar
./scripts/staging/start-staging.sh

# 6. Health check (em outro terminal)
./scripts/staging/health-check.sh

# 7. Smoke test (em outro terminal)
cd backend && npx ts-node ../scripts/staging/smoke-test.ts
```

### Smoke Test - Modos

**Normal (Non-Strict):**
```bash
cd backend
npx ts-node scripts/staging/smoke-test.ts
```

**Strict (CI-Ready):**
```bash
cd backend
STRICT=true npx ts-node scripts/staging/smoke-test.ts
```

**Debug:**
```bash
cd backend
DEBUG=true STRICT=true npx ts-node scripts/staging/smoke-test.ts
```

## Dependências

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm ou pnpm
- curl (para health checks)
- psql (para validações de banco)

## Notas

- Scripts são **não-interativos** por padrão (CI-friendly)
- Todos os scripts **abortam** se validação falhar (fail-fast)
- Smoke test pode **pular** testes se endpoints não existirem
- Rollback requer **confirmação manual** para segurança

## Documentação Completa

Veja [docs/STAGING_DEPLOY.md](../../docs/STAGING_DEPLOY.md) para documentação completa.

