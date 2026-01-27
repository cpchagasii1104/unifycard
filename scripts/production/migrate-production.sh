#!/bin/bash
# scripts/production/migrate-production.sh
# Executa migrations em produção com segurança máxima
# 🔴 BLINDAGEM: Dry-run opcional, verificação de tabelas críticas

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

DRY_RUN=false

# Verificar flag --dry-run
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "⚠️  MODO DRY-RUN: Nenhuma migration será executada"
fi

echo "=========================================="
echo "  PRODUCTION MIGRATIONS"
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

# Confirmar ação em produção (se não for dry-run)
if [ "$DRY_RUN" = false ]; then
  echo "⚠️  ATENÇÃO: Você está prestes a executar migrations em PRODUÇÃO"
  echo "   Database: ${DATABASE_URL%%@*}"
  read -p "   Continuar? (digite 'yes' para confirmar): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Migrations canceladas"
    exit 0
  fi
fi

cd "$BACKEND_DIR"

# Verificar se migrator existe
if [ ! -f "src/core/db/migrate.ts" ]; then
  echo "❌ ERRO CRÍTICO: Script de migration não encontrado"
  exit 1
fi

echo "[1/4] Verificando estado atual do banco..."

# Verificar tabelas críticas existentes
CRITICAL_TABLES=("tenants" "users" "actors" "events" "service_orders" "business_audit_logs")
MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
  if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null | grep -q 1; then
    MISSING_TABLES+=("$table")
  fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
  echo "⚠️  AVISO: Algumas tabelas críticas não existem:"
  for table in "${MISSING_TABLES[@]}"; do
    echo "   - $table"
  done
  echo "   Isso pode indicar que o banco está vazio ou migrations não foram executadas"
fi

# Verificar migrations já executadas
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$MIGRATION_COUNT" -eq "0" ]; then
  echo "⚠️  AVISO: Nenhuma migration registrada em schema_migrations"
  echo "   Se o banco já existia antes do sistema de baseline, execute:"
  echo "   npm run baseline:migrations"
  
  if [ "$DRY_RUN" = false ]; then
    read -p "   Continuar mesmo assim? (yes/no): " continue_anyway
    if [ "$continue_anyway" != "yes" ]; then
      echo "Migrations canceladas"
      exit 0
    fi
  fi
else
  echo "✅ $MIGRATION_COUNT migrations já registradas"
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "[2/4] DRY-RUN: Simulando execução de migrations..."
  echo "   (Nenhuma migration será executada)"
  echo ""
  echo "✅ DRY-RUN completo"
  exit 0
fi

echo ""
echo "[2/4] Executando migrations..."
npm run migrate || {
  echo "❌ ERRO CRÍTICO: Falha ao executar migrations"
  echo "   ⚠️  ATENÇÃO: O banco pode estar em estado inconsistente"
  echo "   Considere executar rollback se necessário"
  exit 1
}

echo ""
echo "[3/4] Validando migrations executadas..."

# Verificar novamente migrations registradas
NEW_MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$NEW_MIGRATION_COUNT" -le "$MIGRATION_COUNT" ]; then
  echo "⚠️  AVISO: Nenhuma nova migration foi executada"
  echo "   Isso pode indicar que todas já estavam aplicadas"
else
  echo "✅ $((NEW_MIGRATION_COUNT - MIGRATION_COUNT)) novas migrations executadas"
fi

echo ""
echo "[4/4] Verificando integridade do banco..."

# Verificar tabelas críticas novamente
MISSING_TABLES_AFTER=()

for table in "${CRITICAL_TABLES[@]}"; do
  if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null | grep -q 1; then
    MISSING_TABLES_AFTER+=("$table")
  fi
done

if [ ${#MISSING_TABLES_AFTER[@]} -gt 0 ]; then
  echo "❌ ERRO CRÍTICO: Tabelas críticas ainda não existem após migrations:"
  for table in "${MISSING_TABLES_AFTER[@]}"; do
    echo "   - $table"
  done
  exit 1
fi

echo "✅ Todas as tabelas críticas existem"

echo ""
echo "=========================================="
echo "  ✅ MIGRATIONS COMPLETAS"
echo "=========================================="
echo ""




