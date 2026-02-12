#!/usr/bin/env bash

echo "Verificando imports Core -> Modules..."

# Navigate to backend directory if running from repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Procurar imports de @modules dentro de src/core
violations=$(grep -r "from ['\"]@modules/" "$BACKEND_DIR/src/core/" 2>/dev/null | grep -v node_modules || true)

if [ -n "$violations" ]; then
  echo ""
  echo "VIOLACAO ARQUITETURAL DETECTADA"
  echo ""
  echo "Core esta importando Modules (proibido):"
  echo ""
  echo "$violations"
  echo ""
  count=$(echo "$violations" | wc -l)
  echo "Total: $count violacoes"
  echo ""
  echo "Regra: Core NUNCA importa Modules"
  echo "Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md"
  echo ""
  exit 1
else
  echo "Nenhum import Core -> Modules detectado"
  exit 0
fi
