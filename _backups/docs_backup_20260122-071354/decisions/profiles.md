# 📋 Migration Profiles

## Visão Geral

O sistema de migrations suporta **profiles** para controlar quais migrations são executadas.

Isso permite isolar módulos **LATENTES** (rides, work-instant) que não devem ser ativados automaticamente.

---

## Profiles Disponíveis

### `CORE_ONLY` (Padrão)

**Comportamento**: Executa apenas migrations do **CORE**, ignorando módulos latentes.

**Migrations ignoradas**:
- ✅ Todas as migrations de **rides** (009-017, 036)
- ✅ Migration de **work-instant** (005_unifywork.sql)

**Como usar**:
```bash
# Padrão (não precisa definir)
pnpm migrate

# Ou explicitamente
MIGRATION_PROFILE=CORE_ONLY pnpm migrate
```

### `FULL`

**Comportamento**: Executa **TODAS** as migrations, incluindo módulos latentes.

**Migrations executadas**:
- ✅ Todas as migrations do CORE
- ✅ Todas as migrations de rides
- ✅ Migration de work-instant

**Como usar**:
```bash
MIGRATION_PROFILE=FULL pnpm migrate
```

---

## Módulos Latentes

### Rides

Migrations relacionadas ao módulo de corridas (latente):

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

### Work-Instant

Migrations relacionadas ao marketplace de serviços (latente):

- `005_unifywork.sql`

---

## Critérios de Aceite

✅ **Profile padrão (CORE_ONLY)**:
- Subir o banco com profile padrão **NÃO cria** nenhuma tabela de rides/work
- Nenhuma migration latente roda sem flag explícita

✅ **Profile FULL**:
- Executa todas as migrations, incluindo latentes
- Útil para ambientes de desenvolvimento/teste completo

---

## Configuração

### Variável de Ambiente

Defina no arquivo `.env`:

```env
# Profile padrão (CORE_ONLY)
# MIGRATION_PROFILE=CORE_ONLY

# Ou para executar tudo (FULL)
MIGRATION_PROFILE=FULL
```

### Comando

```bash
# CORE_ONLY (padrão)
pnpm migrate

# FULL (todas as migrations)
MIGRATION_PROFILE=FULL pnpm migrate
```

---

## Regras Importantes

1. **Não deletar migrations**: Migrations latentes permanecem no diretório
2. **Não comentar SQL**: SQL das migrations não é alterado
3. **Não rodar por padrão**: Módulos latentes só rodam com profile explícito
4. **Baseline automático**: Migrations latentes <= 088 são marcadas no baseline, mas não executadas

---

**Status**: Implementado  
**Última atualização**: 2024


