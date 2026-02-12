# Script de Auditoria de Ownership Financeiro - FASE 1

## Objetivo

Este script executa a **FASE 1 — AUDITORIA E PREPARAÇÃO** da migração canônica de ownership financeiro.

**IMPORTANTE:** Este script é **SOMENTE LEITURA**. Não altera dados ou schema.

## Uso

```bash
# Opção 1: Via variável de ambiente
TENANT_ID=<uuid> ts-node -r tsconfig-paths/register scripts/audit-ownership-financial-phase1.ts

# Opção 2: Via argumento
ts-node -r tsconfig-paths/register scripts/audit-ownership-financial-phase1.ts <tenant_id>
```

## O que o script faz

1. **Auditoria de bank_accounts**
   - Conta total de contas
   - Agrupa por owner_type, currency, tenant_id
   - Identifica duplicatas
   - Identifica contas com owner_id NULL

2. **Mapeamento owner → actor**
   - Para cada bank_account, verifica se existe Actor correspondente
   - Classifica como: OK, BLOQUEIO, ou AMBÍGUO

3. **Auditoria de contas de sistema**
   - Identifica contas com owner_type='system'
   - Classifica por tipo: fee, regional_fund, reserve, escrow, outro
   - Verifica se há Actor de sistema correspondente

4. **Auditoria de escrows**
   - Lista escrows existentes
   - Verifica se possuem bank_account
   - Classifica ownership como explícito ou inferido

5. **Auditoria de group_balance**
   - Verifica se group_balance representa dinheiro real
   - Verifica se passa pelo bank_ledger
   - Classifica como READ-MODEL ou VIOLAÇÃO DE CORE

## Output

O script gera um relatório em Markdown salvo em:
```
backend/audit-reports/ownership-financial-phase1-<tenant_id>-<timestamp>.md
```

O relatório contém:
- Tabela resumo de bank_accounts por owner_type
- Lista de contas SEM Actor correspondente
- Lista de fundos SEM Actor de sistema
- Lista de escrows com ownership inferido
- Lista de BLOQUEIOS para a FASE 2
- Conclusão: FASE 2 PODE PROSSEGUIR? (SIM / NÃO)

## Requisitos

- Node.js com TypeScript
- Acesso ao banco de dados (DATABASE_URL configurada)
- Tenant ID válido

## Exemplo de Execução

```bash
cd backend
TENANT_ID=123e4567-e89b-12d3-a456-426614174000 ts-node -r tsconfig-paths/register scripts/audit-ownership-financial-phase1.ts
```

## Notas

- O script não altera dados
- O script não cria Actors
- O script não cria contas
- O script apenas mapeia e reporta o estado atual


