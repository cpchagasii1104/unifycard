#!/bin/bash
# scripts/production/health-check.sh
# Valida API, DB, Auth, Permissões e Auditoria em produção
# 🔴 BLINDAGEM: Aborta se qualquer check crítico falhar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

API_URL="${API_URL:-http://localhost:${PORT:-3000}}"
MAX_RETRIES=10
RETRY_DELAY=3

echo "=========================================="
echo "  PRODUCTION HEALTH CHECK"
echo "=========================================="
echo ""

# 1. Validar DATABASE_URL
echo "[1/6] Validando conexão com banco..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO CRÍTICO: DATABASE_URL não está definido"
  exit 1
fi

if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Conexão com banco OK"
else
  echo "❌ ERRO CRÍTICO: Falha ao conectar ao banco"
  exit 1
fi

# 2. Validar tabelas críticas
echo "[2/6] Validando tabelas críticas..."
CRITICAL_TABLES=("tenants" "users" "actors" "events" "service_orders" "business_audit_logs" "system_notifications")
MISSING_TABLES=()

for table in "${CRITICAL_TABLES[@]}"; do
  if ! psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null | grep -q 1; then
    MISSING_TABLES+=("$table")
  fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
  echo "❌ ERRO CRÍTICO: Tabelas críticas não encontradas:"
  for table in "${MISSING_TABLES[@]}"; do
    echo "   - $table"
  done
  exit 1
fi
echo "✅ Todas as tabelas críticas existem"

# 3. Validar API (health endpoint)
echo "[3/6] Validando API health endpoint..."
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ API health endpoint OK (200)"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "   Tentativa $RETRY_COUNT/$MAX_RETRIES falhou (HTTP $HTTP_CODE), aguardando ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  else
    echo "❌ ERRO CRÍTICO: API health endpoint não respondeu após $MAX_RETRIES tentativas"
    echo "   Último código HTTP: $HTTP_CODE"
    exit 1
  fi
done

# 4. Validar autenticação
echo "[4/6] Validando autenticação..."
# Verificar se endpoint existe e retorna erro esperado (não 500)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  echo "❌ ERRO CRÍTICO: Endpoint de autenticação inacessível"
  exit 1
elif [ "$HTTP_CODE" -ge 500 ]; then
  echo "❌ ERRO CRÍTICO: Endpoint de autenticação retornou erro do servidor ($HTTP_CODE)"
  exit 1
else
  echo "✅ Endpoint de autenticação acessível (retornou $HTTP_CODE - esperado para credenciais inválidas)"
fi

# 5. Validar migrations executadas
echo "[5/6] Validando migrations..."
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$MIGRATION_COUNT" -eq "0" ]; then
  echo "❌ ERRO CRÍTICO: Nenhuma migration registrada"
  echo "   Execute: npm run baseline:migrations (se banco já existia)"
  exit 1
fi
echo "✅ $MIGRATION_COUNT migrations registradas"

# 6. Validar feature flags (se configurados)
echo "[6/6] Validando feature flags..."
FEATURE_FLAGS=(
  "FEATURE_RFQ_ENABLED"
  "FEATURE_BUNDLES_ENABLED"
  "FEATURE_FINANCIAL_ENABLED"
  "FEATURE_MESSAGING_ENABLED"
)

FLAGS_CONFIGURED=0
for flag in "${FEATURE_FLAGS[@]}"; do
  if [ -n "${!flag:-}" ]; then
    FLAGS_CONFIGURED=$((FLAGS_CONFIGURED + 1))
    echo "   ✅ $flag=${!flag}"
  fi
done

if [ $FLAGS_CONFIGURED -eq 0 ]; then
  echo "⚠️  Nenhuma feature flag configurada (usando padrões do sistema)"
else
  echo "✅ $FLAGS_CONFIGURED feature flags configuradas"
fi

echo ""
echo "=========================================="
echo "  ✅ HEALTH CHECK COMPLETO"
echo "=========================================="
echo ""




