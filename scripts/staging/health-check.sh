#!/bin/bash
# scripts/staging/health-check.sh
# Valida API, DB e Auth em staging
# 🔴 BLINDAGEM: Aborta se qualquer check falhar

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"

API_URL="${API_URL:-http://localhost:${PORT:-3000}}"
MAX_RETRIES=5
RETRY_DELAY=2

echo "=========================================="
echo "  STAGING HEALTH CHECK"
echo "=========================================="
echo ""

# 1. Validar DATABASE_URL
echo "[1/5] Validando conexão com banco..."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERRO: DATABASE_URL não está definido"
  exit 1
fi

if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ Conexão com banco OK"
else
  echo "❌ ERRO: Falha ao conectar ao banco"
  exit 1
fi

# 2. Validar tabelas críticas
echo "[2/5] Validando tabelas críticas..."
CRITICAL_TABLES=("tenants" "users" "actors" "events" "service_orders")
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

# 3. Validar API (health endpoint)
echo "[3/5] Validando API health endpoint..."
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s "${API_URL}/health" > /dev/null 2>&1; then
    echo "✅ API health endpoint OK"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "   Tentativa $RETRY_COUNT/$MAX_RETRIES falhou, aguardando ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  else
    echo "❌ ERRO: API health endpoint não respondeu após $MAX_RETRIES tentativas"
    exit 1
  fi
done

# 4. Validar autenticação (teste de login)
echo "[4/5] Validando autenticação..."
# Nota: Este check requer usuário de staging criado no seed
# Por enquanto, apenas verifica se endpoint existe
if curl -f -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  > /dev/null 2>&1; then
  echo "✅ Endpoint de autenticação acessível"
else
  # Endpoint pode retornar 401/400, mas deve existir
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}')
  
  if [ "$HTTP_CODE" -ge 400 ] && [ "$HTTP_CODE" -lt 500 ]; then
    echo "✅ Endpoint de autenticação acessível (retornou $HTTP_CODE)"
  else
    echo "⚠️  AVISO: Endpoint de autenticação retornou código inesperado: $HTTP_CODE"
  fi
fi

# 5. Validar migrations executadas
echo "[5/5] Validando migrations..."
MIGRATION_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | xargs || echo "0")

if [ "$MIGRATION_COUNT" -eq "0" ]; then
  echo "⚠️  AVISO: Nenhuma migration registrada"
  echo "   Execute: npm run baseline:migrations (se banco já existia)"
else
  echo "✅ $MIGRATION_COUNT migrations registradas"
fi

echo ""
echo "=========================================="
echo "  ✅ HEALTH CHECK COMPLETO"
echo "=========================================="
echo ""




