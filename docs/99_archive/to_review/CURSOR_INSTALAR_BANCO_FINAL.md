# CURSOR: INSTALAR BANCO DE DADOS UNIFICARD (VERSÃO FINAL)

## CONTEXTO
- Banco `unificard` existe e está VAZIO
- PostgreSQL rodando e acessível
- Senha já configurada via `$env:PGPASSWORD`
- Conexão testada com `SELECT 1` ✓

## OBJETIVO
Executar as 92 migrations em ordem, parando no primeiro erro para diagnóstico.

---

## EXECUTAR ESTE SCRIPT POWERSHELL

```powershell
# ================================================
# UNIFICARD - INSTALAÇÃO DO BANCO (VERSÃO FINAL)
# Para no primeiro erro e mostra qual arquivo falhou
# ================================================

# Configuração
$DB_NAME = "unificard"
$DB_USER = "postgres"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  UNIFICARD - INSTALACAO DO BANCO DE DADOS" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está na pasta correta
if (-not (Test-Path "backend/migrations")) {
    Write-Host "ERRO: Pasta backend/migrations nao encontrada." -ForegroundColor Red
    Write-Host "Execute este script na raiz do projeto unificard." -ForegroundColor Red
    exit 1
}

Set-Location -Path "backend/migrations"
Write-Host "Pasta: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Lista ORDENADA de migrations
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

foreach ($migration in $migrations) {
    $count++
    
    Write-Host "[$count/$total] $migration ... " -NoNewline
    
    # Verificar se arquivo existe
    if (-not (Test-Path $migration)) {
        Write-Host "ARQUIVO NAO ENCONTRADO (pulando)" -ForegroundColor Yellow
        continue
    }
    
    # Executar com ON_ERROR_STOP para parar no primeiro erro SQL
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
        Write-Host "O que fazer:" -ForegroundColor Yellow
        Write-Host "1. Corrija o erro no arquivo acima" -ForegroundColor Gray
        Write-Host "2. Ou comente a linha problematica" -ForegroundColor Gray
        Write-Host "3. Re-execute este script (ele pula os que ja rodaram)" -ForegroundColor Gray
        Write-Host ""
        
        # Voltar para pasta original
        Set-Location -Path "../.."
        exit 1
    }
    
    Write-Host "OK" -ForegroundColor Green
    
    # Registrar na tabela schema_migrations
    psql -U $DB_USER -d $DB_NAME -c "INSERT INTO schema_migrations (filename) VALUES ('$migration') ON CONFLICT (filename) DO NOTHING;" 2>$null | Out-Null
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  INSTALACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Verificacao final
Write-Host "Verificacao final:" -ForegroundColor Yellow

$tableCount = (psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
Write-Host "  Tabelas criadas: $tableCount"

$migrationCount = (psql -U $DB_USER -d $DB_NAME -t -c "SELECT COUNT(*) FROM schema_migrations;" 2>$null).Trim()
Write-Host "  Migrations registradas: $migrationCount"

# Verificar tabelas principais
Write-Host ""
Write-Host "Tabelas principais:" -ForegroundColor Yellow
$mainTables = @("tenants", "users", "profiles", "accounts", "actors", "posts", "groups", "events", "companies")
foreach ($table in $mainTables) {
    $exists = psql -U $DB_USER -d $DB_NAME -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table');" 2>$null
    if ($exists -match "t") {
        Write-Host "  $table ... OK" -ForegroundColor Green
    } else {
        Write-Host "  $table ... FALTA" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Banco de dados pronto!" -ForegroundColor Green
Write-Host ""

# Voltar para pasta original
Set-Location -Path "../.."
```

---

## O QUE ESTE SCRIPT FAZ

1. **Verifica** se está na pasta correta
2. **Executa** cada migration com `ON_ERROR_STOP=1`
3. **Para imediatamente** se houver erro
4. **Mostra** qual arquivo falhou e o erro exato
5. **Registra** cada migration executada em `schema_migrations`
6. **Verifica** tabelas principais no final

---

## RESULTADO ESPERADO (SUCESSO)

```
================================================
  UNIFICARD - INSTALACAO DO BANCO DE DADOS
================================================

Total de migrations: 92

[1/92] 000_schema_migrations.sql ... OK
[2/92] 001_initial_schema.sql ... OK
[3/92] 002_rbac.sql ... OK
...
[92/92] 098_groups_upgrade_v1.sql ... OK

================================================
  INSTALACAO CONCLUIDA COM SUCESSO!
================================================

Verificacao final:
  Tabelas criadas: ~100
  Migrations registradas: 92

Tabelas principais:
  tenants ... OK
  users ... OK
  profiles ... OK
  accounts ... OK
  actors ... OK
  posts ... OK
  groups ... OK
  events ... OK
  companies ... OK

Banco de dados pronto!
```

---

## SE DER ERRO

O script vai parar e mostrar:
- Qual arquivo falhou
- O erro SQL exato
- Como corrigir

Exemplo:
```
[15/92] 015_rides_patch_enhanced.sql ... ERRO!

================================================
  INSTALACAO PAROU NO ARQUIVO:
  015_rides_patch_enhanced.sql
================================================

Detalhes do erro:
ERROR: function "xyz" already exists
```

---

## APÓS SUCESSO

Testar backend:
```bash
cd backend
npm run dev
```

Se subir sem erros, instalação está completa.
