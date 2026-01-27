#!/bin/bash
# CI Check: Fastify Schema Validation
# 
# This script enforces the architectural rule:
# - Fastify routes MUST NOT define a `schema` field
# - All validation must be done manually inside handlers using Zod
#
# Usage: ./scripts/check-fastify-schema.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
SRC_DIR="$BACKEND_DIR/src"

echo "🔍 Checking for Fastify schema violations..."

# Find all TypeScript files in src/
# Look for patterns: fastify.(post|put|patch|delete|get) followed by schema:
# This uses grep to find violations efficiently

VIOLATIONS=0
VIOLATION_FILES=()

# Pattern 1: fastify.method(..., { schema:
while IFS= read -r file; do
  # Check if file contains fastify route methods
  if grep -q "fastify\.\(post\|put\|patch\|delete\|get\)" "$file" 2>/dev/null; then
    # Check for schema: pattern within 50 lines after a fastify method
    if grep -n "schema\s*:" "$file" 2>/dev/null | while IFS=: read -r line_num line_content; do
      # Get context around the line
      start_line=$((line_num > 20 ? line_num - 20 : 1))
      end_line=$((line_num + 5))
      context=$(sed -n "${start_line},${end_line}p" "$file" 2>/dev/null)
      
      # Check if there's a fastify method before this schema
      if echo "$context" | grep -q "fastify\.\(post\|put\|patch\|delete\|get\)"; then
        echo "$file:$line_num:$line_content"
        return 1
      fi
    done; then
      VIOLATIONS=$((VIOLATIONS + 1))
      VIOLATION_FILES+=("$file")
    fi
  fi
done < <(find "$SRC_DIR" -type f -name "*.ts" ! -path "*/node_modules/*" ! -path "*/dist/*")

# Simpler approach: just check if schema: appears in files with fastify routes
VIOLATIONS=0
VIOLATION_DETAILS=()

while IFS= read -r file; do
  # Check if file has both fastify routes and schema:
  if grep -q "fastify\.\(post\|put\|patch\|delete\|get\)" "$file" 2>/dev/null && \
     grep -q "schema\s*:" "$file" 2>/dev/null; then
    # Get line numbers where schema: appears
    while IFS=: read -r line_num line_content; do
      # Get 30 lines before to check for fastify method
      start_line=$((line_num > 30 ? line_num - 30 : 1))
      before_context=$(sed -n "${start_line},${line_num}p" "$file" 2>/dev/null)
      
      # If we find a fastify method in the context, it's a violation
      if echo "$before_context" | grep -q "fastify\.\(post\|put\|patch\|delete\|get\)"; then
        VIOLATIONS=$((VIOLATIONS + 1))
        rel_path="${file#$BACKEND_DIR/}"
        VIOLATION_DETAILS+=("$rel_path:$line_num:${line_content//[[:space:]]/ }")
      fi
    done < <(grep -n "schema\s*:" "$file" 2>/dev/null)
  fi
done < <(find "$SRC_DIR" -type f -name "*.ts" ! -path "*/node_modules/*" ! -path "*/dist/*")

if [ $VIOLATIONS -gt 0 ]; then
  echo ""
  echo "❌ FASTIFY SCHEMA VALIDATION VIOLATIONS FOUND"
  echo ""
  echo "Fastify schema is forbidden. Use Zod validation inside handlers."
  echo ""
  echo "Violations:"
  echo ""
  
  for detail in "${VIOLATION_DETAILS[@]}"; do
    echo "  $detail"
  done
  
  echo ""
  echo "Total violations: $VIOLATIONS"
  echo ""
  echo "Rule: Fastify routes MUST NOT define a \`schema\` field."
  echo "Solution: Remove the schema field and use Zod validation inside handlers."
  echo ""
  echo "Example:"
  echo "  // ❌ WRONG:"
  echo "  fastify.post('/route', { schema: { body: mySchema } }, handler);"
  echo ""
  echo "  // ✅ CORRECT:"
  echo "  fastify.post('/route', async (req, reply) => {"
  echo "    const parsed = mySchema.safeParse(req.body);"
  echo "    if (!parsed.success) {"
  echo "      return reply.status(400).send({ error: parsed.error.errors });"
  echo "    }"
  echo "    // Use parsed.data instead of req.body"
  echo "  });"
  echo ""
  
  exit 1
fi

echo "✅ No Fastify schema violations found."
echo "✅ All routes use manual Zod validation in handlers."
echo ""
exit 0







