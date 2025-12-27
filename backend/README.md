UNIFICARD — Backend Oficial
Multi-tenant • Banking-grade security • Plugin-based architecture


📘 Sumário

Arquitetura

Principais Tecnologias

Estrutura de Pastas

Segurança (RLS, JWT, RBAC)

Economia (Accounts, Transactions, Ledger, Distribution)

Plugins

Instalação

Variáveis de Ambiente

Migrations

Execução

API Overview

RBAC Overview

Health Check

Integração via Plugins

Roadmap

🧠 1. Arquitetura

O backend do Unificard implementa uma arquitetura Kernel + Plugins, dividida em três camadas:

core/     → Tudo obrigatório (auth, tenants, database, economy, rbac)
plugins/  → Funcionalidades opcionais e desacopladas
shared/   → Utilitários comuns


O sistema é multi-tenant, com Row Level Security (RLS) aplicado em todas as entidades de negócio.

Cada request carrega o header:

x-tenant-id: <uuid>


E o servidor injeta o tenant no PostgreSQL:

SET app.current_tenant = '<tenant>'

⚙️ 2. Principais Tecnologias
Categoria	Tecnologia
Linguagem	TypeScript 5.x
Runtime	Node.js 20+
Framework	Express 5
Banco	PostgreSQL com RLS
Cache	Redis
Infra	Docker / Docker Compose
Auth	JWT (access + refresh), bcrypt
Segurança	CORS, Helmet, Rate Limit
Validação	Zod
Event System	EventBus V5 (persist-first + idempotência)
🗂️ 3. Estrutura de Pastas
backend/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_rbac.sql
│
├── src/
│   ├── server.ts
│   │
│   ├── core/
│   │   ├── auth/
│   │   ├── tenants/
│   │   ├── database/
│   │   ├── events/
│   │   ├── plugins/
│   │   ├── rbac/
│   │   └── economy/
│   │       ├── accounts/
│   │       ├── transactions/
│   │       ├── ledger/
│   │       └── distribution/
│   │
│   ├── shared/
│   │   ├── errors/
│   │   ├── middleware/
│   │   └── utils/
│   │
│   └── plugins/
│       └── logistics/
│
├── package.json
├── tsconfig.json
└── docker-compose.yml

🔐 4. Segurança
🔸 Authentication

JWT Access Tokens (curta duração)

JWT Refresh Tokens

Bcrypt (10 rounds)

Nenhuma rota crítica funciona sem JWT

🔸 Authorization (RBAC)

Rodada 5 implementada com:

roles

permissions

user_roles

role_permissions

Formato das permissions:

resource:action
ex: accounts:create


Middleware:

requirePermission(['accounts:create']);
requireRole(['admin']);

🔸 Multitenancy + RLS

Todas tabelas sensíveis possuem:

ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... USING (tenant_id = current_setting('app.current_tenant'));

🔸 Rate Limiting

Ativado globalmente.

🔸 Helmet + CORS

Proteção de headers e domínio.

🏦 5. Economia (Módulo Financeiro)
Inclui:
Módulo	Descrição
Accounts	Contas com saldo e owner (user, merchant, group, etc.)
Transactions	Transferências com idempotência
Ledger	Escrituração contábil imutável
Distribution	Distribuições automáticas com fees
🏛 Ledger (Double-Entry)

Cada transação gera:

1 lançamento de débito

1 lançamento de crédito
(saldo_before → saldo_after)

🔁 Idempotência

Via event_id único.

🔌 6. Plugins

O backend permite extensões usando:

core/plugins/plugin-registry.ts


Plugins são carregados no startup:

pluginRegistry.initAll()
pluginRegistry.startAll()

🛠️ 7. Instalação
git clone https://github.com/seu-org/unificard.git
cd unificard/backend
npm install

🌱 8. Variáveis de Ambiente

Arquivo .env.example:

DATABASE_URL=postgres://postgres:postgres@localhost:5432/unificard
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-key
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

🧬 9. Migrations

Aplicar migrations:

psql -f migrations/001_initial_schema.sql
psql -f migrations/002_rbac.sql


Inicializar RBAC para um tenant:

SELECT seed_default_rbac('<tenant-id>');

🚀 10. Execução
npm run dev


Saída esperada:

🚀 Unificard API rodando na porta 3000
🔓 Rotas públicas: /api/auth/*
🔒 Rotas protegidas: /api/accounts, /api/transactions, /api/ledger, /api/distribution

📡 11. API Overview
🔓 Rotas Públicas
Registrar
POST /api/auth/register

Login
POST /api/auth/login

Refresh
POST /api/auth/refresh

🔒 Rotas Protegidas + Permissões
Accounts
POST /api/accounts                 [accounts:create]
GET  /api/accounts/:id             [accounts:read]
GET  /api/accounts/owner/:id       [accounts:read or accounts:list]

Transactions
POST /api/transactions/transfer    [transactions:create]
GET  /api/transactions/:id         [transactions:read]

Ledger
GET /api/ledger/account/:id        [ledger:read or ledger:list]
GET /api/ledger/audit/:id          [ledger:audit]

Distribution
POST /api/distribution/auto        [distribution:execute]
POST /api/distribution/config      [distribution:create]

Roles (RBAC)
POST /api/roles                    [roles:create]
GET  /api/roles                    [roles:read]
POST /api/roles/:r/users/:u        [roles:assign]

🧩 12. RBAC Overview

Roles criadas automaticamente:

Role	Description
admin	Total access
user	Usuário padrão
merchant	Recepção de pagamentos
manager	Gerenciamento avançado

Permissions seguem o formato:

accounts:create
transactions:list
ledger:audit
distribution:execute
roles:assign

💓 13. Health Check
GET /health


Resposta:

{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z"
}


Não exige tenant nem auth.

🧱 14. Plugins

Cada plugin deve exportar:

export const plugin = {
  name: "logistics",
  async init(logger) { ... }
  async start(logger) { ... }
  async stop(logger) { ... }
};

🛣️ 15. Roadmap
Versão	Feature
1.1	Webhooks
1.2	Audit logs
1.3	Workers (BullMQ)
1.4	API Docs (Swagger)
1.5	Frontend PWA
2.0	Plugin Marketplace
🏁 Final

Este é o README oficial, completo, profissional do backend Unificard.