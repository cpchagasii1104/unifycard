#!/bin/bash
# backend/scripts/validate-ssot.sh
# Script de validação SSOT para leitura de categorias
# Garante que nenhuma violação de SSOT ocorre

set -e  # Exit on error

echo "🔍 VALIDAÇÃO SSOT - Single Source of Truth para Leitura de Categorias"
echo "======================================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variáveis
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=${PORT:-3000}
BASE_URL="http://localhost:${PORT}"

# Função para verificar se servidor está rodando
check_server() {
  if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Servidor não está rodando em ${BASE_URL}${NC}"
    echo "   Inicie o servidor antes de executar este script:"
    echo "   cd backend && npm run dev"
    exit 1
  fi
}

# Função para executar testes Jest
run_tests() {
  echo "📊 Executando testes SSOT..."
  echo ""
  
  cd "${BACKEND_DIR}"
  
  if ! npm run test:ssot 2>&1; then
    echo -e "${RED}❌ Testes SSOT falharam${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Testes SSOT passaram${NC}"
  echo ""
}

# Função para testar endpoint sem context
test_endpoint_no_context() {
  echo "🌐 Testando endpoint sem context..."
  
  response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/categories/tree" \
    -H "X-Tenant-ID: test-tenant" \
    -H "Content-Type: application/json" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" != "400" ]; then
    echo -e "${RED}❌ FALHA: Esperado HTTP 400, recebido ${http_code}${NC}"
    echo "   Response: $body"
    exit 1
  fi
  
  if ! echo "$body" | grep -q "CONTEXT_REQUIRED"; then
    echo -e "${RED}❌ FALHA: Response não contém 'CONTEXT_REQUIRED'${NC}"
    echo "   Response: $body"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Endpoint rejeitou requisição sem context (HTTP 400)${NC}"
  echo ""
}

# Função para testar endpoint sem tenant
test_endpoint_no_tenant() {
  echo "🌐 Testando endpoint sem tenant..."
  
  response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/categories/tree?context=professional" \
    -H "Content-Type: application/json" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  if [ "$http_code" != "401" ]; then
    echo -e "${RED}❌ FALHA: Esperado HTTP 401, recebido ${http_code}${NC}"
    echo "   Response: $body"
    exit 1
  fi
  
  if ! echo "$body" | grep -q "TENANT_REQUIRED"; then
    echo -e "${RED}❌ FALHA: Response não contém 'TENANT_REQUIRED'${NC}"
    echo "   Response: $body"
    exit 1
  fi
  
  echo -e "${GREEN}✅ Endpoint rejeitou requisição sem tenant (HTTP 401)${NC}"
  echo ""
}

# Executar validações
echo "1️⃣  Verificando se servidor está rodando..."
check_server
echo ""

echo "2️⃣  Executando testes unitários SSOT..."
run_tests

echo "3️⃣  Testando endpoint HTTP sem context..."
test_endpoint_no_context

echo "4️⃣  Testando endpoint HTTP sem tenant..."
test_endpoint_no_tenant

echo ""
echo "======================================================================"
echo -e "${GREEN}✅ VALIDAÇÃO SSOT COMPLETA: Nenhuma violação detectada${NC}"
echo "======================================================================"
echo ""

exit 0

