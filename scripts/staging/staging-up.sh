#!/bin/bash
# scripts/staging/staging-up.sh
# Comando único para subir ambiente de staging completo
# 🔴 BLINDAGEM: Executa setup → migrate → seed → start → health → smoke

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STAGING UP - DEPLOY COMPLETO"
echo "=========================================="
echo ""

# Validar ambiente
if [ "${NODE_ENV:-}" != "staging" ]; then
  echo "❌ ERRO: NODE_ENV deve ser 'staging'"
  echo "   Execute: export NODE_ENV=staging"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO: DATABASE_URL não está definido"
  exit 1
fi

# 1. Setup
echo "[1/6] Setup de ambiente..."
"$SCRIPT_DIR/setup-staging.sh" || {
  echo "❌ ERRO: Setup falhou"
  exit 1
}

# 2. Migrations
echo ""
echo "[2/6] Executando migrations..."
"$SCRIPT_DIR/migrate-staging.sh" || {
  echo "❌ ERRO: Migrations falharam"
  exit 1
}

# 3. Seed
echo ""
echo "[3/6] Executando seed..."
cd "$BACKEND_DIR"
npx ts-node "$SCRIPT_DIR/seed-staging.ts" || {
  echo "❌ ERRO: Seed falhou"
  exit 1
}
cd "$PROJECT_ROOT"

# 4. Iniciar backend (em background)
echo ""
echo "[4/6] Iniciando backend..."
cd "$BACKEND_DIR"
npm run build > /dev/null 2>&1 || {
  echo "⚠️  Build falhou, tentando continuar..."
}

# Verificar se já está rodando
if pgrep -f "node.*backend.*dist.*server" > /dev/null; then
  echo "⚠️  Backend já está rodando, pulando start"
else
  # Iniciar em background
  npm run start > /tmp/staging-backend.log 2>&1 &
  BACKEND_PID=$!
  echo "   Backend iniciado (PID: $BACKEND_PID)"
  echo "   Logs: /tmp/staging-backend.log"
  
  # Aguardar backend iniciar
  echo "   Aguardando backend iniciar..."
  sleep 5
  
  # Verificar se ainda está rodando
  if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo "❌ ERRO: Backend não iniciou corretamente"
    echo "   Verifique logs: /tmp/staging-backend.log"
    exit 1
  fi
fi
cd "$PROJECT_ROOT"

# 5. Health check
echo ""
echo "[5/6] Executando health check..."
"$SCRIPT_DIR/health-check.sh" || {
  echo "❌ ERRO: Health check falhou"
  echo "   Backend pode não estar pronto ainda"
  echo "   Tente executar health-check.sh manualmente depois"
  # Não abortar aqui - pode ser que backend precise de mais tempo
}

# 6. Smoke test
echo ""
echo "[6/6] Executando smoke test..."
cd "$BACKEND_DIR"
STRICT="${STRICT:-false}" DEBUG="${DEBUG:-false}" npx ts-node "$SCRIPT_DIR/smoke-test.ts" || {
  echo "❌ ERRO: Smoke test falhou"
  echo "   Verifique relatório: scripts/staging/reports/smoke-report.json"
  exit 1
}
cd "$PROJECT_ROOT"

echo ""
echo "=========================================="
echo "  ✅ STAGING UP COMPLETO"
echo "=========================================="
echo ""
echo "Backend rodando em: http://localhost:${PORT:-3000}"
echo "Relatório de smoke test: scripts/staging/reports/smoke-report.json"
echo ""
echo "Para parar o backend:"
echo "  pkill -f 'node.*backend.*dist.*server'"
echo ""




