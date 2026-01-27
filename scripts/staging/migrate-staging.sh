#!/bin/bash
# scripts/staging/migrate-staging.sh
# Executa migrations com segurança em staging
# 🔴 BLINDAGEM: Aborta se qualquer migration falhar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

echo "=========================================="
echo "  STAGING MIGRATIONS"
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

cd "$BACKEND_DIR"

# Verificar se migrator existe
if [ ! -f "src/core/db/migrate.ts" ]; then
  echo "❌ ERRO: Script de migration não encontrado"
  exit 1
fi

echo "[1/3] Executando migrations..."
npm run migrate || {
  echo "❌ ERRO: Falha ao executar migrations"
  exit 1
}

echo ""
echo "[2/3] Validando migrations executadas..."

# Verificar se schema_migrations existe e tem registros
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$MIGRATION_COUNT" -eq "0" ]; then
  echo "⚠️  AVISO: Nenhuma migration registrada em schema_migrations"
  echo "   Isso pode indicar que o banco já existia antes do sistema de baseline"
  echo "   Execute: npm run baseline:migrations"
else
  echo "✅ $MIGRATION_COUNT migrations registradas"
fi

echo ""
echo "[3/3] Verificando integridade do banco..."

# Verificar tabelas críticas
CRITICAL_TABLES=("tenants" "users" "actors" "events" "service_orders" "business_audit_logs")
MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
  if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" | grep -q 1; then
    MISSING_TABLES+=("$table")
  fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
  echo "❌ ERRO: Tabelas críticas não encontradas:"
  for table in "${MISSING_TABLES[@]}"; do
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




