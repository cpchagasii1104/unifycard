# ✅ Validação: Subida Limpa do Banco com CORE_ONLY

## 📋 Resumo Executivo

Script de validação criado para garantir que o banco sobe limpo e previsível com profile `CORE_ONLY`.

---

## 🚀 Como Executar

### Validação Completa

```bash
cd backend

# 1. Resetar banco (opcional - apenas se quiser começar do zero)
pnpm reset:database

# 2. Executar migrations com CORE_ONLY (se não resetou)
MIGRATION_PROFILE=CORE_ONLY pnpm migrate

# 3. Executar validação
pnpm validate:core-only
```

### Pipeline Completo (Reset + Migrate + Validate)

```bash
cd backend

# Reset + Migrate + Validate
pnpm reset:database && MIGRATION_PROFILE=CORE_ONLY pnpm migrate && pnpm validate:core-only
```

---

## ✅ Validações Realizadas

### 1. Tabelas de Módulos Latentes

**Verifica**: Nenhuma tabela de rides/work foi criada

**Tabelas verificadas**:
- `rides_*` (qualquer tabela que comece com `rides_`)
- `work_*` (qualquer tabela que comece com `work_`)
- `workers`, `jobs`, `applications`

**Resultado esperado**: 0 tabelas encontradas

### 2. Dados Demo

**Verifica**: Nenhum dado demo foi criado

**Verificações**:
- Tenants com slug contendo `demo` ou `test`
- Users com email contendo `demo`, `test` ou `@cidadenova.demo`

**Resultado esperado**: 0 tenants demo, 0 users demo

### 3. Migrations Executadas

**Verifica**: Nenhuma migration latente foi executada

**Migrations latentes verificadas**:
- `005_unifywork.sql`
- `009_rides_part1_geography.sql`
- `010_rides_part2_drivers_vehicles.sql`
- `011_rides_part3_ride_lifecycle.sql`
- `012_rides_part4_pricing.sql`
- `013_rides_part5_distribution.sql`
- `014_rides_part6_security_analytics.sql`
- `015_rides_patch_enhanced.sql`
- `016_rides_patch_requirements.sql`
- `017_rides_driver_vehicle_compliance.sql`
- `036_rides_patch_requirements.sql`

**Resultado esperado**: Nenhuma migration latente executada

### 4. Idempotência

**Verifica**: Reexecução de migrations não gera erro

**Teste**: Executa migrations duas vezes seguidas

**Resultado esperado**: Segunda execução não gera erro (todas já executadas)

---

## 📊 Critérios de Aceite

✅ **Banco sobe sem warnings**:
- Migrations executam sem erro
- Nenhum warning relacionado a módulos latentes

✅ **Reexecução não gera erro**:
- Segunda execução de migrations não gera erro
- Todas as migrations são idempotentes

✅ **Nenhuma tabela de rides/work existe**:
- Verificação explícita de tabelas latentes
- Falha se qualquer tabela for encontrada

✅ **Nenhum dado demo foi criado**:
- Verificação de tenants e users demo
- Falha se dados demo forem encontrados

---

## 🔍 Exemplo de Saída

```
═══════════════════════════════════════════════════════════════
  VALIDAÇÃO: Subida Limpa do Banco com CORE_ONLY
═══════════════════════════════════════════════════════════════

✔ Conexão com banco de dados estabelecida

═══════════════════════════════════════════════════════════════
  PASSO 1: Executar Migrations (CORE_ONLY)
═══════════════════════════════════════════════════════════════

📦 Executando migrations com profile CORE_ONLY...

📋 PROFILE DE MIGRATIONS: CORE_ONLY
   ⚠️  Módulos latentes (rides, work-instant) serão IGNORADOS

⏭️  MIGRATIONS IGNORADAS (módulos latentes): 11
   🚫 005_unifywork.sql
   🚫 009_rides_part1_geography.sql
   ...

✅ Migrations executadas com sucesso

═══════════════════════════════════════════════════════════════
  PASSO 2: Verificar Tabelas de Módulos Latentes
═══════════════════════════════════════════════════════════════

✅ Nenhuma tabela de módulos latentes encontrada
   Rides: 0 tabelas
   Work: 0 tabelas

═══════════════════════════════════════════════════════════════
  PASSO 3: Verificar Dados Demo
═══════════════════════════════════════════════════════════════

✅ Nenhum dado demo encontrado
   Tenants demo: 0
   Users demo: 0

═══════════════════════════════════════════════════════════════
  PASSO 4: Verificar Migrations Executadas
═══════════════════════════════════════════════════════════════

✅ Total de migrations executadas: 87
✅ Nenhuma migration latente executada

═══════════════════════════════════════════════════════════════
  PASSO 5: Reexecutar Migrations (Teste de Idempotência)
═══════════════════════════════════════════════════════════════

✅ Reexecução concluída sem erros (idempotência validada)

═══════════════════════════════════════════════════════════════
  RELATÓRIO FINAL
═══════════════════════════════════════════════════════════════

✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO

✅ Banco sobe limpo com profile CORE_ONLY
✅ Nenhuma tabela de módulos latentes criada
✅ Nenhum dado demo criado
✅ Migrations são idempotentes
✅ Reexecução não gera erro
```

---

## ⚠️ Em Caso de Falha

### Tabelas Latentes Encontradas

Se o script encontrar tabelas de rides/work:

1. Verificar se `MIGRATION_PROFILE=CORE_ONLY` está definido
2. Verificar se migrations latentes foram executadas manualmente
3. Resetar banco e executar novamente

### Dados Demo Encontrados

Se o script encontrar dados demo:

1. Verificar se `RUN_SEEDS=true` não está definido
2. Verificar se seeds foram executados manualmente
3. Limpar dados demo ou resetar banco

### Migrations Latentes Executadas

Se o script encontrar migrations latentes executadas:

1. Verificar histórico em `schema_migrations`
2. Remover registros de migrations latentes (se necessário)
3. Resetar banco e executar novamente

---

## 📁 Arquivos Criados

1. **`backend/src/scripts/validate-core-only.ts`**
   - Script de validação completo
   - Verifica tabelas, dados e migrations

2. **`backend/VALIDACAO_CORE_ONLY.md`**
   - Este arquivo (documentação)

---

## 🔧 Integração com CI/CD

O script pode ser integrado em pipelines de CI/CD:

```yaml
# Exemplo: GitHub Actions
- name: Validate CORE_ONLY
  run: |
    cd backend
    pnpm reset:database
    MIGRATION_PROFILE=CORE_ONLY pnpm migrate
    pnpm validate:core-only
```

---

**Status**: ✅ Implementado e pronto para uso  
**Data**: 2024














