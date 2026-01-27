#!/bin/bash
# scripts/production/rollback.sh
# Rollback plan executável para produção
# 🔴 BLINDAGEM: Procedimento claro e seguro

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  PRODUCTION ROLLBACK"
echo "=========================================="
echo ""
echo "⚠️  ATENÇÃO: Este script executa rollback em PRODUÇÃO"
echo ""

# Confirmar ação
read -p "⚠️  Digite 'ROLLBACK' para confirmar: " confirm
if [ "$confirm" != "ROLLBACK" ]; then
  echo "Rollback cancelado"
  exit 0
fi

# 1. Desligar backend
echo "[1/5] Desligando backend..."
if pgrep -f "node.*backend.*dist.*server" > /dev/null; then
  echo "   Encontrado processo do backend, encerrando..."
  pkill -f "node.*backend.*dist.*server" || true
  sleep 3
  
  # Verificar se ainda está rodando
  if pgrep -f "node.*backend.*dist.*server" > /dev/null; then
    echo "   ⚠️  Processo ainda rodando, forçando encerramento..."
    pkill -9 -f "node.*backend.*dist.*server" || true
    sleep 2
  fi
  echo "✅ Backend desligado"
else
  echo "✅ Backend não está rodando"
fi

# 2. Desabilitar features via flags
echo "[2/5] Desabilitando features via flags..."
echo ""
echo "⚠️  AÇÃO MANUAL NECESSÁRIA:"
echo "   Para desabilitar features, ajuste variáveis de ambiente:"
echo ""
echo "   export FEATURE_RFQ_ENABLED=false"
echo "   export FEATURE_BUNDLES_ENABLED=false"
echo "   export FEATURE_FINANCIAL_ENABLED=false"
echo "   export FEATURE_MESSAGING_ENABLED=false"
echo ""
echo "   Ou edite arquivo .env.production"
echo ""
read -p "   Features desabilitadas? (yes/no): " features_disabled
if [ "$features_disabled" != "yes" ]; then
  echo "   ⚠️  AVISO: Features não foram desabilitadas"
fi

# 3. Voltar tag anterior (se usando git)
echo "[3/5] Verificando versão anterior..."
if [ -d "$PROJECT_ROOT/.git" ]; then
  PREVIOUS_TAG=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "")
  CURRENT_TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || echo "")
  
  if [ -n "$CURRENT_TAG" ]; then
    echo "   Tag atual: $CURRENT_TAG"
  fi
  
  if [ -n "$PREVIOUS_TAG" ]; then
    echo "   Tag anterior encontrada: $PREVIOUS_TAG"
    read -p "   Voltar para tag $PREVIOUS_TAG? (yes/no): " checkout_tag
    if [ "$checkout_tag" == "yes" ]; then
      git checkout "$PREVIOUS_TAG" || {
        echo "   ❌ ERRO: Falha ao voltar para tag $PREVIOUS_TAG"
        exit 1
      }
      echo "   ✅ Voltado para tag $PREVIOUS_TAG"
      
      # Recompilar se necessário
      echo "   Recompilando..."
      cd "$BACKEND_DIR"
      npm run build || {
        echo "   ❌ ERRO: Falha ao recompilar"
        exit 1
      }
      cd "$PROJECT_ROOT"
    fi
  else
    echo "   ⚠️  Nenhuma tag anterior encontrada"
  fi
else
  echo "   ⚠️  Não é um repositório git"
fi

# 4. Restaurar snapshot do banco (documentado)
echo "[4/5] Restaurar snapshot do banco..."
echo ""
echo "⚠️  AÇÃO MANUAL NECESSÁRIA:"
echo "   Para restaurar snapshot do banco, execute:"
echo ""
echo "   # Opção 1: Restaurar de backup PostgreSQL"
echo "   pg_restore -d \$DATABASE_URL backup_production_YYYYMMDD.dump"
echo ""
echo "   # Opção 2: Restaurar de SQL dump"
echo "   psql \$DATABASE_URL < backup_production_YYYYMMDD.sql"
echo ""
echo "   # Opção 3: Reverter migrations específicas (se aplicável)"
echo "   # Verificar documentação de migrations reversíveis"
echo ""
read -p "   Snapshot restaurado? (yes/no): " snapshot_restored
if [ "$snapshot_restored" != "yes" ]; then
  echo "   ⚠️  AVISO: Snapshot não foi restaurado"
  echo "   ⚠️  ATENÇÃO: Banco pode estar em estado inconsistente"
fi

# 5. Verificar estado antes de reiniciar
echo "[5/5] Verificando estado antes de reiniciar..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "   ⚠️  AVISO: DATABASE_URL não está definido"
else
  if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "   ✅ Conexão com banco OK"
  else
    echo "   ❌ ERRO: Falha ao conectar ao banco"
    echo "   Não reinicie o backend até resolver"
  fi
fi

echo ""
echo "=========================================="
echo "  ✅ ROLLBACK COMPLETO"
echo "=========================================="
echo ""
echo "Próximos passos:"
echo "  1. Verificar estado do banco"
echo "  2. Verificar variáveis de ambiente"
echo "  3. Reiniciar backend: ./scripts/production/start-production.sh"
echo "  4. Executar health check: ./scripts/production/health-check.sh"
echo "  5. Executar smoke test: ./scripts/production/smoke-production.ts"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   - Verifique logs do backend após reiniciar"
echo "   - Monitore métricas de erro"
echo "   - Valide funcionalidades críticas manualmente"
echo ""




