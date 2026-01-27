#!/bin/bash
# scripts/staging/start-staging.sh
# Inicia backend em modo staging
# 🔴 BLINDAGEM: Valida ambiente antes de iniciar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STARTING STAGING SERVER"
echo "=========================================="
echo ""

# Validar ambiente
if [ "${NODE_ENV:-}" != "staging" ]; then
  echo "❌ ERRO: NODE_ENV deve ser 'staging'"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO: DATABASE_URL não está definido"
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "❌ ERRO: JWT_SECRET não está definido"
  exit 1
fi

cd "$BACKEND_DIR"

# Verificar se build existe
if [ ! -d "dist" ]; then
  echo "⚠️  Build não encontrado, compilando..."
  npm run build || {
    echo "❌ ERRO: Falha ao compilar"
    exit 1
  }
fi

echo "✅ Build encontrado"
echo ""
echo "Iniciando servidor em modo staging..."
echo "  PORT: ${PORT:-3000}"
echo "  NODE_ENV: ${NODE_ENV}"
echo ""

# Iniciar servidor
npm run start || {
  echo "❌ ERRO: Falha ao iniciar servidor"
  exit 1
}




