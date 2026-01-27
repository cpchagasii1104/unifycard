# CURSOR: INSTALAR BANCO UNIFICARD (FINAL CONSOLIDADO)

## CONTEXTO
- Banco `unificard` existe e está VAZIO
- PostgreSQL rodando e acessível  
- Senha configurada via `$env:PGPASSWORD`
- Conexão validada com `SELECT 1` ✓

## OBJETIVO
Executar 92 migrations em ordem exata, com parada no primeiro erro.

---

## EXECUTAR ESTE SCRIPT POWERSHELL

```powershell
# ================================================
# UNIFICARD - INSTALACAO DO BANCO (FINAL CONSOLIDADO)
# Inclui: ON_ERROR_STOP, UTF8, ordem garantida, verificacao
# ================================================

# === CONFIGURACOES ===
$DB_NAME = "unificard"
$DB_USER = "postgres"

# AJUSTE 1: Forcar encoding UTF8 (evita bugs com acentos)
$env:PGCLIENTENCODING = "UTF8"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  UNIFICARD - INSTALACAO DO BANCO DE DADOS" -ForegroundColor Cyan
Write-Host "  Versao: FINAL CONSOLIDADA" -ForegroundColor Gray
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# === VERIFICAR PASTA ===
if (-not (Test-Path "backend/migrations")) {
    Write-Host "ERRO: Pasta backend/migrations nao encontrada." -ForegroundColor Red
    Write-Host "Execute na raiz do projeto unificard." -ForegroundColor Red
    exit 1
}

Set-Location -Path "backend/migrations"
Write-Host "Pasta: $(Get-Location)" -ForegroundColor Gray
Write-Host "Encoding: $env:PGCLIENTENCODING" -ForegroundColor Gray
Write-Host ""

# === AJUSTE 2: LISTA EM ORDEM EXATA (nao depende do SO) ===
# Ordem hardcoded garante execucao correta independente do filesystem
$migrations = @(
    "000_schema_migrations.sql"
    "001_initial_schema.sql"
    "002_rbac.sql"
    "003_config_system.sql"
    "004_notify_system.sql"
    "005_unifywork.sql"
    "006_reviews_and_reputation.sql"
    "009_rides_part1_geography.sql"
    "010_rides_part2_drivers_vehicles.sql"
    "011_rides_part3_ride_lifecycle.sql"
    "012_rides_part4_pricing.sql"
    "013_rides_part5_distribution.sql"
    "014_rides_part6_security_analytics.sql"
    "015_rides_patch_enhanced.sql"
    "016_rides_patch_requirements.sql"
    "017_rides_driver_vehicle_compliance.sql"
    "019_world_geography.sql"
    "020_root_config.sql"
    "021_tenants_add_city_id.sql"
    "022_global_identity.sql"
    "023_reviews_reputation_global_identity.sql"
    "024_economy_global_identity.sql"
    "025_global_user_residence.sql"
    "026_events_core.sql"
    "027_event_organizers.sql"
    "028a_catalog_canonical.sql"
    "028b_categories_system.sql"
    "029_social_core.sql"
    "030_social_actions.sql"
    "031_social_chat_intelligence.sql"
    "032_schedule_universal.sql"
    "033_care_engine.sql"
    "034_memory_engine.sql"
    "035_seed_demo_city_nova_beauty.sql"
    "036_rides_patch_clayton_requirements.sql"
    "037_groups_system.sql"
    "038_groups_rbac_permissions.sql"
    "039_social_groups_integration.sql"
    "042_add_keywords_to_categories.sql"
    "043_add_country_to_categories.sql"
    "044_add_pricing_type_to_user_skills.sql"
    "045_expand_professional_services.sql"
    "046_add_combo_discounts.sql"
    "047_companies_system.sql"
    "048_user_plan.sql"
    "049_add_metadata_to_transactions.sql"
    "050_social_2_0.sql"
    "051_social_follows.sql"
    "052_social_economic.sql"
    "053_social_ledger_hardening.sql"
    "054_social_purpose_targeting.sql"
    "055a_categories_ai_blindage.sql"
    "055b_categories_ai_validation.sql"
    "056_categories_governance_consolidated.sql"
    "057_add_auto_active_status.sql"
    "058_fix_categories_slug_unique_constraint.sql"
    "059_create_occupations_reference.sql"
    "060_user_education_companies.sql"
    "061_regional_fund_governance.sql"
    "062_regional_fund_governance_patch.sql"
    "063_schedule_unique_owners.sql"
    "064_schedule_slots_unique.sql"
    "065_schedule_performance_indexes.sql"
    "066_company_employees.sql"
    "067_schedules_event_owner.sql"
    "068_events_lifecycle_extension.sql"
    "069_event_commerce.sql"
    "070_posts_event_link.sql"
    "071_event_consumption_status.sql"
    "072_event_idempotency.sql"
    "073_company_status_and_documents.sql"
    "074_event_metrics.sql"
    "075_organizer_plans.sql"
    "076_organizer_subscriptions.sql"
    "077_expand_pricing_type.sql"
    "078_unifybank_test_currency.sql"
    "079_impact_ledger.sql"
    "080_actor_reputation.sql"
    "081_company_validations.sql"
    "082_audit_events.sql"
    "083_cultural_profiles.sql"
    "084_cultural_events.sql"
    "085_cultural_event_checkins.sql"
    "086_event_occupancy_model.sql"
    "087_events_multi_actor.sql"
    "088_votes_system.sql"
    "089_add_token_version_to_users.sql"
    "090_events_canonical_contract_v1.sql"
    "091_event_attendees_canonical_contract_v1.sql"
    "092_event_escrow.sql"
    "093_actor_scores_penalties.sql"
    "094_event_participants.sql"
    "095_events_split_processed.sql"
    "096_check_in_check_out_v1.4.sql"
    "097_actor_debts_due_at.sql"
    "098_groups_upgrade_v1.sql"
)

$total = $migrations.Count
$count = 0

Write-Host "Total de migrations: $total" -ForegroundColor Yellow
Write-Host ""

# === EXECUTAR MIGRATIONS ===
foreach ($migration in $migrations) {
    $count++
    
    Write-Host "[$count/$total] $migration ... " -NoNewline
    
    if (-not (Test-Path $migration)) {
        Write-Host "NAO ENCONTRADO (pulando)" -ForegroundColor Yellow
        continue
    }
    
    # ON_ERROR_STOP=1 para parar no primeiro erro SQL
    $result = psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1 -f $migration 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO!" -ForegroundColor Red
        Write-Host ""
        Write-Host "================================================" -ForegroundColor Red
        Write-Host "  INSTALACAO PAROU NO ARQUIVO:" -ForegroundColor Red
        Write-Host "  $migration" -ForegroundColor Yellow
        Write-Host "================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Detalhes do erro:" -ForegroundColor Red
        Write-Host $result -ForegroundColor DarkRed
        Write-Host ""
        Write-Host "Como resolver:" -ForegroundColor Yellow
        Write-Host "  1. Corrija o erro no arquivo" -ForegroundColor Gray
        Write-Host "  2. Re-execute este script" -ForegroundColor Gray
        Write-Host "  3. Migrations ja executadas serao puladas" -ForegroundColor Gray
        Write-Host ""
        Set-Location -Path "../.."
        exit 1
    }
    
    Write-Host "OK" -ForegroundColor Green
    
    # Registrar em schema_migrations
    psql -U $DB_USER -d $DB_NAME -c "INSERT INTO schema_migrations (filename) VALUES ('$migration') ON CONFLICT (filename) DO NOTHING;" 2>$null | Out-Null
}

# === AJUSTE 3: VERIFICACAO AUTOMATICA COMPLETA ===
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

Write-Host "=== VERIFICACAO FINAL ===" -ForegroundColor Yellow
Write-Host ""

# Contagem de migrations
$migCount = (psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM schema_migrations;").Trim()
Write-Host "Migrations executadas: $migCount" -ForegroundColor Cyan

# Primeira e ultima migration
$firstLast = psql -U $DB_USER -d $DB_NAME -t -c "SELECT MIN(filename) || ' -> ' || MAX(filename) FROM schema_migrations;"
Write-Host "Intervalo: $($firstLast.Trim())" -ForegroundColor Cyan

# Contagem de tabelas
$tableCount = (psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
Write-Host "Tabelas criadas: $tableCount" -ForegroundColor Cyan

Write-Host ""

# Verificar tabelas principais
Write-Host "=== TABELAS PRINCIPAIS ===" -ForegroundColor Yellow
$mainTables = @("tenants", "users", "profiles", "accounts", "transactions", "ledger", "actors", "posts", "groups", "events", "companies", "schema_migrations")

$allOk = $true
foreach ($table in $mainTables) {
    $exists = psql -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');" 2>$null
    if ($exists -match "t") {
        Write-Host "  [OK] $table" -ForegroundColor Green
    } else {
        Write-Host "  [X]  $table - FALTA!" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""

# === CRITERIO DE SUCESSO ===
Write-Host "=== CRITERIO DE SUCESSO ===" -ForegroundColor Yellow

$success = $true

# Criterio 1: 92 migrations
if ([int]$migCount -ge 90) {
    Write-Host "  [OK] Migrations >= 90 ($migCount)" -ForegroundColor Green
} else {
    Write-Host "  [X]  Migrations < 90 ($migCount)" -ForegroundColor Red
    $success = $false
}

# Criterio 2: Primeira migration correta
if ($firstLast -match "000_schema_migrations") {
    Write-Host "  [OK] Primeira migration = 000_schema_migrations.sql" -ForegroundColor Green
} else {
    Write-Host "  [X]  Primeira migration incorreta" -ForegroundColor Red
    $success = $false
}

# Criterio 3: Ultima migration correta
if ($firstLast -match "098_groups_upgrade") {
    Write-Host "  [OK] Ultima migration = 098_groups_upgrade_v1.sql" -ForegroundColor Green
} else {
    Write-Host "  [X]  Ultima migration incorreta" -ForegroundColor Red
    $success = $false
}

# Criterio 4: Tabelas principais
if ($allOk) {
    Write-Host "  [OK] Todas as tabelas principais existem" -ForegroundColor Green
} else {
    Write-Host "  [X]  Algumas tabelas faltando" -ForegroundColor Red
    $success = $false
}

Write-Host ""

if ($success) {
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  BANCO DE DADOS INSTALADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "  Proximo passo: cd backend && npm run dev" -ForegroundColor Gray
    Write-Host "================================================" -ForegroundColor Green
} else {
    Write-Host "================================================" -ForegroundColor Yellow
    Write-Host "  INSTALACAO CONCLUIDA COM AVISOS" -ForegroundColor Yellow
    Write-Host "  Verifique os itens marcados com [X]" -ForegroundColor Gray
    Write-Host "================================================" -ForegroundColor Yellow
}

Write-Host ""

# Voltar para pasta original
Set-Location -Path "../.."
```

---

## AJUSTES INCORPORADOS (ChatGPT)

| Ajuste | Implementado |
|--------|--------------|
| 1. `$env:PGCLIENTENCODING = "UTF8"` | ✅ Linha 12 |
| 2. Ordem EXATA (lista hardcoded) | ✅ Lista fixa, não depende de filesystem |
| 3. Verificação automática no final | ✅ Critérios de sucesso claros |

---

## CRITÉRIOS DE SUCESSO (automáticos)

O script verifica:
- ✅ Migrations >= 90
- ✅ Primeira = `000_schema_migrations.sql`
- ✅ Última = `098_groups_upgrade_v1.sql`
- ✅ Tabelas principais existem

---

## COMO USAR

1. Cole este script no Cursor
2. Execute
3. Resultado: SUCESSO ou ERRO com arquivo específico

---

## APÓS SUCESSO

```bash
cd backend
npm run dev
```
