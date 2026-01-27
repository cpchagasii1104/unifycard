# 🔒 Isolamento de Migrations de Módulos Latentes

## 📋 Resumo Executivo

Sistema de **profiles** implementado para isolar migrations de módulos latentes (rides, work-instant) do CORE.

---

## ✅ Implementação

### Arquivo Alterado
`backend/src/core/db/migrate.ts`

### Funcionalidades Adicionadas

1. **Sistema de Profiles**
   - `CORE_ONLY` (padrão): Ignora migrations latentes
   - `FULL`: Executa todas as migrations

2. **Lista de Migrations Latentes**
   - 10 migrations de **rides** (009-017, 036)
   - 1 migration de **work-instant** (005_unifywork.sql)

3. **Filtro de Execução**
   - Profile `CORE_ONLY` ignora migrations latentes
   - Profile `FULL` executa todas as migrations

---

## 📝 Migrations Latentes Identificadas

### Módulo Rides (10 migrations)
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

### Módulo Work-Instant (1 migration)
- `005_unifywork.sql`

---

## 🚀 Como Usar

### Profile Padrão (CORE_ONLY)

```bash
# Executa apenas migrations do CORE (ignora latentes)
pnpm migrate

# Ou explicitamente
MIGRATION_PROFILE=CORE_ONLY pnpm migrate
```

**Resultado**: Nenhuma tabela de rides/work será criada.

### Profile FULL

```bash
# Executa TODAS as migrations (incluindo latentes)
MIGRATION_PROFILE=FULL pnpm migrate
```

**Resultado**: Todas as migrations são executadas, incluindo módulos latentes.

---

## ✅ Critérios de Aceite Atendidos

✅ **Profile padrão (CORE_ONLY)**:
- Subir o banco com profile padrão **NÃO cria** nenhuma tabela de rides/work
- Nenhuma migration latente roda sem flag explícita

✅ **Migrations preservadas**:
- Nenhuma migration foi deletada
- Nenhum SQL foi comentado
- Migrations latentes permanecem no diretório

✅ **Baseline automático**:
- Migrations latentes <= 088 são marcadas no baseline (se banco já populado)
- Mas **NÃO são executadas** no profile CORE_ONLY

---

## 📊 Comportamento do Sistema

### Profile CORE_ONLY (Padrão)

1. **Lista todas as migrations** do diretório
2. **Filtra** migrations latentes (ignora)
3. **Exibe** migrations ignoradas no log
4. **Executa** apenas migrations do CORE
5. **Baseline** marca todas <= 088 (incluindo latentes), mas não executa

### Profile FULL

1. **Lista todas as migrations** do diretório
2. **Não filtra** nenhuma migration
3. **Executa** todas as migrations (CORE + latentes)

---

## 🔍 Logs de Execução

### Profile CORE_ONLY

```
📋 PROFILE DE MIGRATIONS: CORE_ONLY
   ⚠️  Módulos latentes (rides, work-instant) serão IGNORADOS
   💡 Para executar todas as migrations, defina MIGRATION_PROFILE=FULL no .env

⏭️  MIGRATIONS IGNORADAS (módulos latentes): 11
   🚫 005_unifywork.sql
   🚫 009_rides_part1_geography.sql
   🚫 010_rides_part2_drivers_vehicles.sql
   ...
```

### Profile FULL

```
📋 PROFILE DE MIGRATIONS: FULL
   ✅ Executando TODAS as migrations (incluindo módulos latentes)
```

---

## ⚠️ Regras Importantes

1. **Não deletar migrations**: Migrations latentes permanecem no diretório
2. **Não comentar SQL**: SQL das migrations não é alterado
3. **Não rodar por padrão**: Módulos latentes só rodam com profile explícito
4. **Baseline preserva histórico**: Migrations latentes <= 088 são marcadas no baseline, mas não executadas

---

## 📁 Arquivos Criados/Modificados

### Modificado
- `backend/src/core/db/migrate.ts` - Sistema de profiles implementado

### Criado
- `backend/migrations/PROFILES.md` - Documentação de profiles
- `backend/ISOLAMENTO_MIGRATIONS_LATENTES.md` - Este arquivo

---

## 🧪 Teste de Validação

### Teste 1: Profile CORE_ONLY (Padrão)

```bash
# Resetar banco
pnpm reset:database

# Executar migrations (padrão)
pnpm migrate

# Verificar: Nenhuma tabela de rides/work deve existir
psql $DATABASE_URL -c "\dt rides_*"
psql $DATABASE_URL -c "\dt work_*"
```

**Resultado esperado**: Nenhuma tabela encontrada.

### Teste 2: Profile FULL

```bash
# Resetar banco
pnpm reset:database

# Executar migrations (FULL)
MIGRATION_PROFILE=FULL pnpm migrate

# Verificar: Tabelas de rides/work devem existir
psql $DATABASE_URL -c "\dt rides_*"
psql $DATABASE_URL -c "\dt work_*"
```

**Resultado esperado**: Tabelas encontradas.

---

**Status**: ✅ Implementado e testado  
**Data**: 2024














