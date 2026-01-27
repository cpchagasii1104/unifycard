#!/bin/bash
# scripts/staging/setup-staging.sh
# Setup de ambiente de staging com validações fail-fast
# 🔴 BLINDAGEM: Aborta se qualquer validação falhar

set -euo pipefail  # Exit on error, undefined vars, pipe failures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STAGING ENVIRONMENT SETUP"
echo "=========================================="
echo ""

# 1. Validar NODE_ENV
echo "[1/6] Validando NODE_ENV..."
if [ "${NODE_ENV:-}" != "staging" ]; then
  echo "❌ ERRO: NODE_ENV deve ser 'staging'"
  echo "   Atual: ${NODE_ENV:-<não definido>}"
  echo "   Execute: export NODE_ENV=staging"
  exit 1
fi
echo "✅ NODE_ENV=${NODE_ENV}"

# 2. Validar DATABASE_URL
echo "[2/6] Validando DATABASE_URL..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO: DATABASE_URL não está definido"
  exit 1
fi

# Validar que não é produção
if [[ "$DATABASE_URL" == *"production"* ]] || [[ "$DATABASE_URL" == *"prod"* ]]; then
  echo "❌ ERRO: DATABASE_URL parece ser de produção"
  echo "   Staging deve usar banco exclusivo"
  exit 1
fi

# Validar formato PostgreSQL
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]]; then
  echo "❌ ERRO: DATABASE_URL deve ser uma URL PostgreSQL"
  exit 1
fi
echo "✅ DATABASE_URL configurado (não é produção)"

# 3. Validar JWT_SECRET
echo "[3/6] Validando JWT_SECRET..."
if [ -z "${JWT_SECRET:-}" ]; then
  echo "❌ ERRO: JWT_SECRET não está definido"
  exit 1
fi

if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "❌ ERRO: JWT_SECRET deve ter pelo menos 32 caracteres"
  echo "   Atual: ${#JWT_SECRET} caracteres"
  exit 1
fi
echo "✅ JWT_SECRET válido (${#JWT_SECRET} caracteres)"

# 4. Validar PORT
echo "[4/6] Validando PORT..."
if [ -z "${PORT:-}" ]; then
  echo "⚠️  PORT não definido, usando padrão 3000"
  export PORT=3000
else
  if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "❌ ERRO: PORT deve ser um número"
    exit 1
  fi
fi
echo "✅ PORT=${PORT}"

# 5. Validar dependências
echo "[5/6] Validando dependências..."
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules não encontrado, instalando..."
  npm install || {
    echo "❌ ERRO: Falha ao instalar dependências"
    exit 1
  }
fi
echo "✅ Dependências instaladas"

# 6. Validar estrutura de migrations
echo "[6/6] Validando estrutura de migrations..."
if [ ! -d "$BACKEND_DIR/migrations" ]; then
  echo "❌ ERRO: Diretório migrations não encontrado"
  exit 1
fi

MIGRATION_COUNT=$(find "$BACKEND_DIR/migrations" -name "*.sql" | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
  echo "❌ ERRO: Nenhuma migration encontrada"
  exit 1
fi
echo "✅ $MIGRATION_COUNT migrations encontradas"

echo ""
echo "=========================================="
echo "  ✅ SETUP COMPLETO"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "  1. ./scripts/staging/migrate-staging.sh"
echo "  2. ./scripts/staging/seed-staging.sh"
echo "  3. ./scripts/staging/start-staging.sh"
echo ""




