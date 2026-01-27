#!/usr/bin/env bash

echo "Verificando imports relativos cruzando camadas..."

# Navigate to backend directory if running from repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

# Procurar ../ cruzando de core para modules ou vice-versa
violations=$(grep -r "from ['\"]\.\..*modules/" "$BACKEND_DIR/src/core/" 2>/dev/null | grep -v node_modules || true)
violations2=$(grep -r "from ['\"]\.\..*core/" "$BACKEND_DIR/src/modules/" 2>/dev/null | grep -v node_modules | grep "\.\./\.\./\.\." || true)

all_violations="$violations$violations2"

if [ -n "$all_violations" ]; then
  echo ""
  echo "IMPORTS RELATIVOS CRUZANDO CAMADAS"
  echo ""
  echo "$all_violations"
  echo ""
  echo "Regra: Use @core/* ou @modules/* sempre"
  echo "Ver: ARCHITECTURAL_SOURCE_OF_TRUTH.md secao 5"
  echo ""
  exit 1
else
  echo "Nenhum import relativo cruzado detectado"
  exit 0
fi
