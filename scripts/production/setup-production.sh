#!/bin/bash
# scripts/production/setup-production.sh
# Setup de ambiente de PRODUÇÃO com validações fail-fast rigorosas
# 🔴 BLINDAGEM: Aborta se qualquer validação falhar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  PRODUCTION ENVIRONMENT SETUP"
echo "=========================================="
echo ""

# 1. Validar NODE_ENV
echo "[1/8] Validando NODE_ENV..."
if [ "${NODE_ENV:-}" != "production" ]; then
  echo "❌ ERRO CRÍTICO: NODE_ENV deve ser 'production'"
  echo "   Atual: ${NODE_ENV:-<não definido>}"
  echo "   Execute: export NODE_ENV=production"
  exit 1
fi
echo "✅ NODE_ENV=${NODE_ENV}"

# 2. Validar DATABASE_URL
echo "[2/8] Validando DATABASE_URL..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL não está definido"
  exit 1
fi

# Validar que NÃO é staging/dev
if [[ "$DATABASE_URL" == *"staging"* ]] || [[ "$DATABASE_URL" == *"dev"* ]] || [[ "$DATABASE_URL" == *"test"* ]]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL parece ser de staging/dev/test"
  echo "   Produção deve usar banco exclusivo de produção"
  exit 1
fi

# Validar formato PostgreSQL
if [[ ! "$DATABASE_URL" =~ ^postgresql:// ]] && [[ ! "$DATABASE_URL" =~ ^postgresql\+ssl:// ]]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL deve ser uma URL PostgreSQL"
  exit 1
fi

# Validar que usa SSL em produção (recomendado)
if [[ ! "$DATABASE_URL" =~ sslmode= ]] && [[ ! "$DATABASE_URL" =~ postgresql\+ssl:// ]]; then
  echo "⚠️  AVISO: DATABASE_URL não especifica SSL (recomendado para produção)"
  echo "   Considere adicionar ?sslmode=require"
fi
echo "✅ DATABASE_URL configurado (não é staging/dev)"

# 3. Validar JWT_SECRET
echo "[3/8] Validando JWT_SECRET..."
if [ -z "${JWT_SECRET:-}" ]; then
  echo "❌ ERRO CRÍTICO: JWT_SECRET não está definido"
  exit 1
fi

if [ ${#JWT_SECRET} -lt 64 ]; then
  echo "❌ ERRO CRÍTICO: JWT_SECRET deve ter pelo menos 64 caracteres em produção"
  echo "   Atual: ${#JWT_SECRET} caracteres"
  exit 1
fi
echo "✅ JWT_SECRET válido (${#JWT_SECRET} caracteres)"

# 4. Validar TENANT_SECRET (se usado)
echo "[4/8] Validando TENANT_SECRET..."
if [ -n "${TENANT_SECRET:-}" ]; then
  if [ ${#TENANT_SECRET} -lt 32 ]; then
    echo "❌ ERRO CRÍTICO: TENANT_SECRET deve ter pelo menos 32 caracteres"
    exit 1
  fi
  echo "✅ TENANT_SECRET válido"
else
  echo "⚠️  TENANT_SECRET não definido (pode ser opcional)"
fi

# 5. Validar PORT
echo "[5/8] Validando PORT..."
if [ -z "${PORT:-}" ]; then
  echo "⚠️  PORT não definido, usando padrão 3000"
  export PORT=3000
else
  if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
    echo "❌ ERRO CRÍTICO: PORT deve ser um número"
    exit 1
  fi
  
  # Validar que não é porta de desenvolvimento
  if [ "$PORT" -lt 1024 ] || [ "$PORT" -eq 3000 ]; then
    echo "⚠️  AVISO: PORT=${PORT} pode não ser adequado para produção"
  fi
fi
echo "✅ PORT=${PORT}"

# 6. Validar TLS/HTTPS (se API_URL definido)
echo "[6/8] Validando TLS/HTTPS..."
if [ -n "${API_URL:-}" ]; then
  if [[ ! "$API_URL" =~ ^https:// ]]; then
    echo "❌ ERRO CRÍTICO: API_URL deve usar HTTPS em produção"
    echo "   Atual: ${API_URL}"
    exit 1
  fi
  echo "✅ API_URL usa HTTPS"
else
  echo "⚠️  API_URL não definido (pode ser opcional)"
fi

# 7. Validar rate limits configurados
echo "[7/8] Validando rate limits..."
RATE_LIMIT_VARS=(
  "RATE_LIMIT_RFQ_CREATE"
  "RATE_LIMIT_BOOKING_CREATE"
  "RATE_LIMIT_MESSAGE_SEND"
  "RATE_LIMIT_QUOTE_SUBMIT"
)

MISSING_RATE_LIMITS=()
for var in "${RATE_LIMIT_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_RATE_LIMITS+=("$var")
  fi
done

if [ ${#MISSING_RATE_LIMITS[@]} -gt 0 ]; then
  echo "⚠️  AVISO: Alguns rate limits não estão configurados:"
  for var in "${MISSING_RATE_LIMITS[@]}"; do
    echo "   - $var (usará padrão)"
  done
else
  echo "✅ Rate limits configurados"
fi

# 8. Validar dependências e estrutura
echo "[8/8] Validando dependências e estrutura..."
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "❌ ERRO CRÍTICO: node_modules não encontrado"
  echo "   Execute: npm install"
  exit 1
fi

if [ ! -d "migrations" ]; then
  echo "❌ ERRO CRÍTICO: Diretório migrations não encontrado"
  exit 1
fi

MIGRATION_COUNT=$(find "$BACKEND_DIR/migrations" -name "*.sql" | wc -l)
if [ "$MIGRATION_COUNT" -eq 0 ]; then
  echo "❌ ERRO CRÍTICO: Nenhuma migration encontrada"
  exit 1
fi
echo "✅ $MIGRATION_COUNT migrations encontradas"

# Verificar se build existe ou pode ser criado
if [ ! -d "dist" ]; then
  echo "⚠️  Build não encontrado, será criado no start-production.sh"
else
  echo "✅ Build encontrado"
fi

echo ""
echo "=========================================="
echo "  ✅ SETUP COMPLETO"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "  1. ./scripts/production/migrate-production.sh [--dry-run]"
echo "  2. ./scripts/production/start-production.sh"
echo "  3. ./scripts/production/health-check.sh"
echo "  4. ./scripts/production/smoke-production.ts"
echo ""




