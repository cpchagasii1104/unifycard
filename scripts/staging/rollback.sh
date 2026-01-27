#!/bin/bash
# scripts/staging/rollback.sh
# Rollback plan executável para staging
# 🔴 BLINDAGEM: Documenta e executa rollback seguro

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STAGING ROLLBACK"
echo "=========================================="
echo ""

# Confirmar ação
read -p "⚠️  ATENÇÃO: Isso vai desligar o backend de staging. Continuar? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Rollback cancelado"
  exit 0
fi

# 1. Desligar backend
echo "[1/4] Desligando backend..."
if pgrep -f "node.*backend.*dist.*server" > /dev/null; then
  echo "   Encontrado processo do backend, encerrando..."
  pkill -f "node.*backend.*dist.*server" || true
  sleep 2
  
  # Verificar se ainda está rodando
  if pgrep -f "node.*backend.*dist.*server" > /dev/null; then
    echo "   ⚠️  Processo ainda rodando, forçando encerramento..."
    pkill -9 -f "node.*backend.*dist.*server" || true
  fi
  echo "✅ Backend desligado"
else
  echo "✅ Backend não está rodando"
fi

# 2. Restaurar snapshot (documentado)
echo "[2/4] Restaurar snapshot do banco..."
echo ""
echo "⚠️  AÇÃO MANUAL NECESSÁRIA:"
echo "   Para restaurar snapshot do banco, execute:"
echo ""
echo "   # Opção 1: Restaurar de backup PostgreSQL"
echo "   pg_restore -d \$DATABASE_URL backup_staging_YYYYMMDD.dump"
echo ""
echo "   # Opção 2: Restaurar de SQL dump"
echo "   psql \$DATABASE_URL < backup_staging_YYYYMMDD.sql"
echo ""
echo "   # Opção 3: Recriar banco do zero"
echo "   dropdb staging_db && createdb staging_db"
echo "   ./scripts/staging/migrate-staging.sh"
echo ""
read -p "   Snapshot restaurado? (yes/no): " snapshot_restored
if [ "$snapshot_restored" != "yes" ]; then
  echo "   ⚠️  AVISO: Snapshot não foi restaurado"
fi

# 3. Voltar tag anterior (se usando git)
echo "[3/4] Verificando versão anterior..."
if [ -d "$PROJECT_ROOT/.git" ]; then
  PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")
  if [ -n "$PREVIOUS_TAG" ]; then
    echo "   Tag anterior encontrada: $PREVIOUS_TAG"
    read -p "   Voltar para tag $PREVIOUS_TAG? (yes/no): " checkout_tag
    if [ "$checkout_tag" == "yes" ]; then
      git checkout "$PREVIOUS_TAG" || {
        echo "   ❌ ERRO: Falha ao voltar para tag $PREVIOUS_TAG"
        exit 1
      }
      echo "   ✅ Voltado para tag $PREVIOUS_TAG"
    fi
  else
    echo "   ⚠️  Nenhuma tag anterior encontrada"
  fi
else
  echo "   ⚠️  Não é um repositório git"
fi

# 4. Desabilitar features via env
echo "[4/4] Desabilitar features via env..."
echo ""
echo "⚠️  AÇÃO MANUAL NECESSÁRIA:"
echo "   Para desabilitar features, ajuste variáveis de ambiente:"
echo ""
echo "   export FEATURE_NEW_FEATURE=false"
echo "   export RATE_LIMIT_ENABLED=false"
echo ""
echo "   Ou edite arquivo .env.staging"
echo ""

echo ""
echo "=========================================="
echo "  ✅ ROLLBACK COMPLETO"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "  1. Verificar estado do banco"
echo "  2. Reexecutar migrations se necessário"
echo "  3. Reiniciar backend: ./scripts/staging/start-staging.sh"
echo "  4. Executar health check: ./scripts/staging/health-check.sh"
echo ""




