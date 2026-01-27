#!/bin/bash
# scripts/production/start-production.sh
# Inicia backend em modo produção com build seguro
# 🔴 BLINDAGEM: Valida ambiente e build antes de iniciar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STARTING PRODUCTION SERVER"
echo "=========================================="
echo ""

# Validar ambiente
if [ "${NODE_ENV:-}" != "production" ]; then
  echo "❌ ERRO CRÍTICO: NODE_ENV deve ser 'production'"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL não está definido"
  exit 1
fi

if [ -z "${JWT_SECRET:-}" ]; then
  echo "❌ ERRO CRÍTICO: JWT_SECRET não está definido"
  exit 1
fi

cd "$BACKEND_DIR"

# Verificar se build existe
if [ ! -d "dist" ]; then
  echo "[1/2] Build não encontrado, compilando..."
  npm run build || {
    echo "❌ ERRO CRÍTICO: Falha ao compilar"
    exit 1
  }
  echo "✅ Build criado"
else
  echo "[1/2] Build encontrado"
  
  # Verificar se build está atualizado (comparar timestamps)
  BUILD_AGE=$(find dist -type f -name "*.js" -printf '%T@\n' 2>/dev/null | sort -n | tail -1 || echo "0")
  SOURCE_AGE=$(find src -type f -name "*.ts" -printf '%T@\n' 2>/dev/null | sort -n | tail -1 || echo "0")
  
  if (( $(echo "$SOURCE_AGE > $BUILD_AGE" | bc -l 2>/dev/null || echo "0") )); then
    echo "⚠️  AVISO: Código fonte mais recente que build"
    echo "   Recompilando..."
    npm run build || {
      echo "❌ ERRO CRÍTICO: Falha ao recompilar"
      exit 1
    }
    echo "✅ Build atualizado"
  fi
fi

echo ""
echo "[2/2] Iniciando servidor em modo produção..."
echo "  PORT: ${PORT:-3000}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  Database: ${DATABASE_URL%%@*}"
echo ""

# Verificar se porta está em uso
if command -v lsof > /dev/null 2>&1; then
  if lsof -Pi :${PORT:-3000} -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ ERRO CRÍTICO: Porta ${PORT:-3000} já está em uso"
    exit 1
  fi
fi

# Iniciar servidor
npm run start || {
  echo "❌ ERRO CRÍTICO: Falha ao iniciar servidor"
  exit 1
}




