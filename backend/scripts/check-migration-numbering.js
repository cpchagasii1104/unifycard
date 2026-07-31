// backend/scripts/check-migration-numbering.js
// GATE 3 — INTEGRIDADE DE MIGRAÇÕES
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (reescrito 2026-07-31, GO Clayton)
// ║ NORMA:   docs/01_normative/07_NOMENCLATURA_CANONICA.md §15.1 (divergente — ver cartório)
// ║ NÃO:     validar contra o `.up.sql`/`.down.sql` que §15.1 documenta (nunca usado, Lei 2 é forward-only)
// ║ EM VEZ:  YYYYMMDDHHMMSS_descricao_snake.sql — formato vivo real, 417/551 hoje
// ╚════════════════════════════════════════════════════════════════
//
// Até 2026-07-31 este guard validava SÓ o esquema legado de 4 dígitos e
// PULAVA (`return` antecipado) qualquer arquivo de 14 ou 8 dígitos — ficava
// verde sem checar 420 dos 551 arquivos vivos (417 de 14 dígitos + 3 de 8),
// incluindo TODA migration criada desde que o projeto adotou timestamp.
// Achado por varredura de dívida técnica (parecer 2026-07-31), confirmado
// por Clayton de 1ª mão (417/3/131, npm run). Reescrito para cobrir os 551.
//
// Três formatos reconhecidos hoje, cada um com seu próprio contrato:
//   1. CANÔNICO — YYYYMMDDHHMMSS_descricao.sql (14 dígitos). É o formato
//      vivo para QUALQUER migration nova daqui pra frente. Checado por
//      REGEX + colisão de timestamp exato (duas migrations não podem
//      nascer no mesmo segundo).
//   2. LEGADO-8 — YYYYMMDD_descricao.sql (8 dígitos). Janela curta de
//      transição (abr/2026), 3 arquivos. CONGELADO por allowlist exata —
//      Lei 2 (forward-only) proíbe editar/renomear; e um formato abandonado
//      não deve GANHAR arquivo novo, então a allowlist também impede adição.
//   3. LEGADO-4 — NNNN[a]_descricao.sql (4 dígitos + sufixo de letra
//      opcional). Esquema da gênese do projeto, 131 arquivos. Mesma
//      congelação por allowlist exata, MAIS a validação histórica de
//      número único / sufixo único / sufixos sequenciais (a, b, c...) que
//      este guard já fazia — preservada, só re-escopada para o conjunto
//      certo.
// Qualquer arquivo fora dos três formatos, ou um LEGADO fora da allowlist
// (novo OU faltando), é erro. Nenhum arquivo escapa mais sem checagem.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '../migrations');
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let hasError = false;
const errors = [];

// ============================================================================
// FORMATOS RECONHECIDOS
// ============================================================================
const CANONICAL_14 = /^(\d{14})_([a-z][a-z0-9_]*)\.sql$/;
const LEGACY_8 = /^(\d{8})_([a-z][a-z0-9_]*)\.sql$/;
const LEGACY_4 = /^(\d{4})([a-z]?)_([a-z][a-z0-9_]*)\.sql$/;

// Allowlist CONGELADA dos dois formatos legados. Gerada em 2026-07-31 a
// partir do disco vivo (551 arquivos, fatia desta reescrita). Lei 2:
// migration existente nunca é editada/renomeada/removida — logo esta lista
// só encolhe se alguém violar Lei 2 (o guard acusa), e só cresce se alguém
// tentar reintroduzir um formato abandonado (o guard também acusa).
const FROZEN_LEGACY_4 = new Set([
  "0001_extensions.sql", "0002_identity.sql", "0003_bank_core.sql",
  "0004_marketplace.sql", "0005_events.sql", "0006_forward_only_lock.sql",
  "0007_system_functions.sql", "0008_profiles.sql", "0009_create_identities.sql",
  "0010_migrate_identity_from_actors.sql", "0011_add_financial_idempotency.sql", "0012_unify_actor_and_kyc_ontology.sql",
  "0013_economic_identity.sql", "0014_regional_fund.sql", "0015_regional_impact_snapshots.sql",
  "0016_regional_activation_rules.sql", "0017_regional_activation_events.sql", "0018_regional_fund_allocations_status.sql",
  "0019_marketplace_plugins.sql", "0020_products_and_store_product_activations.sql", "0021_ledger_append_only.sql",
  "0022_split_invariant.sql", "0023_negative_balance_guard.sql", "0024_account_type_constraint.sql",
  "0025_reference_idempotency.sql", "0026_reconciliation_discrepancies.sql", "0027_bank_ledger_immutable.sql",
  "0028_financial_audit_trail.sql", "0029_gateway_webhook_events.sql", "0030_payment_intents.sql",
  "0031_payout_requests.sql", "0032_bank_settlements.sql", "0033_financial_alerts.sql",
  "0034_financial_metrics.sql", "0035_financial_rate_limits.sql", "0036_financial_disputes.sql",
  "0037_financial_freezes.sql", "0038_financial_risk_events.sql", "0039_financial_circuit_breakers.sql",
  "0040_financial_sla_events.sql", "0041_ledger_snapshots.sql", "0042_governance_proposals.sql",
  "0043_governance_financial_actions.sql", "0044_treasury_accounts.sql", "0045_treasury_distributions.sql",
  "0046_treasury_split_config.sql", "0047_governance_funding.sql", "0048_governance_funding_commitments.sql",
  "0049_placeholder.sql", "0050_placeholder.sql", "0051_reversal_engine.sql",
  "0052_reversal_engine_hardening.sql", "0053_reconciliation_engine.sql", "0054_reconciliation_balance_column.sql",
  "0055_reconciliation_discrepancies_legacy_marker.sql", "0056_actor_risk_identity_engine.sql", "0057_risk_enforcement_hardening.sql",
  "0058_users_global_users_profiles_app.sql", "0059_tenant_contexts.sql", "0060_rbac_roles.sql",
  "0061_categories.sql", "0062_feature_flags.sql", "0063_event_log.sql",
  "0064_add_user_id_to_actors.sql", "0065_create_companies_minimal.sql", "0066_profile_support_tables.sql",
  "0067_global_users_metadata.sql", "0068_category_relations.sql", "0069_concepts.sql",
  "0070_tenant_semantic_policy.sql", "0071_tenant_semantic_metrics.sql", "0072_tenant_concept_offerings.sql",
  "0073_domains_n0.sql", "0074_concepts_domain_n0_only.sql", "0075_concept_governance_trigger.sql",
  "0076_concept_relations.sql", "0077_graph_relation_governance_trigger.sql", "0078_n1_navigation.sql",
  "0079_n2_navigation.sql", "0080_n2_governance_hardening.sql", "0081_deprecate_context_nutricao.sql",
  "0082_remove_legacy_n2_materiais_manutencao_slugs.sql", "0083_realign_bebidas_n2_varejo_bar.sql", "0084_intent_idempotency_keys.sql",
  "0085_cleanup_idempotency_keys_function.sql", "0086_payment_execution_lock.sql", "0087_add_metadata_to_reconciliation_discrepancies.sql",
  "0088_reconciliation_disputes.sql", "0089_reconciliation_dispute_events.sql", "0090_tenants_city_id.sql",
  "0091_tenant_contexts_default_authority.sql", "0092_global_semantic_graph.sql", "0093_add_n1_pessoas_identidades.sql",
  "0094_seed_professional_bootstrap.sql", "0095_repair_professional_bootstrap.sql", "0096_fix_professional_category_paths.sql",
  "0097_core_invariant_category_write_prereqs.sql", "0098_seed_professional_n1_catalog.sql", "0099_seed_professional_n1_beleza_estetica.sql",
  "0100_seed_professional_n1_expansion.sql", "0101_product_variants.sql", "0102_inventory_movements.sql",
  "0103_inventory_balances.sql", "0104_inventory_lots.sql", "0105_inventory_movements_lot_fk.sql",
  "0106_inventory_reservations.sql", "0107_fulfillment_orders.sql", "0108_fulfillment_items.sql",
  "0109_categories_unique_concept_professional.sql", "0110_create_category_from_concept_tenant_and_lock.sql", "0111_create_catalog_products.sql",
  "0112_create_tenant_products.sql", "0113_create_company_types.sql", "0114_company_type_allowed_concepts.sql",
  "0115_add_company_type_to_tenants.sql", "0116_seed_catalog_products.sql", "0117_evolve_orders.sql",
  "0118_evolve_payment_intents.sql", "0119_order_items.sql", "0120_order_status_history.sql",
  "0121_pdv_sessions.sql", "0122_product_offers.sql", "0123_snake_case_marketplace.sql",
  "0124_snake_case_inventory_fulfillment.sql", "0125_snake_case_products_variants.sql", "0126_snake_case_identity_contexts.sql",
  "0127_snake_case_inventory_lots.sql", "0128_suppliers.sql", "0129_stock_transfers.sql",
  "0130_stock_transfer_receipts.sql", "0131_purchase_orders.sql",
]);

const FROZEN_LEGACY_8 = new Set([
  "20260407_b2b_payment_intents_unique.sql", "20260408_bank_transactions.sql", "20260410_uidx_inventory_movements_reference.sql",
]);

// Anomalias PRÉ-EXISTENTES achadas por ESTA reescrita (2026-07-31), pinadas
// por nome exato — NÃO renomeáveis (schema_migrations.filename é a chave de
// aplicação; renomear um arquivo já aplicado quebra o mapeamento e reaplica
// ou perde rastro — pior que o defeito de nomenclatura em si). Cartório tem
// o registro completo. Qualquer anomalia NOVA (não esta, nomeada) falha.
const PINNED_FORMAT_ANOMALY = new Set([
  "20260331120000_event_idempotency_tracking.up.sql", // único ".up.sql" do repo; nunca teve ".down.sql" par — tentativa isolada do formato §15.1, abandonada
]);
const PINNED_TIMESTAMP_COLLISION = new Set([
  "20260427120000_product_concept_resolution_queue.sql",
  "20260427120000_unified_availability_base.sql",
]);

// ============================================================================
// PASSO 1 — classificar TODO arquivo em um dos 3 formatos, ou erro
// ============================================================================
const canonicalFiles = []; // { file, timestamp }
const seenLegacy4 = new Set();
const seenLegacy8 = new Set();

migrationFiles.forEach((file) => {
  if (CANONICAL_14.test(file)) {
    const [, timestamp] = file.match(CANONICAL_14);
    canonicalFiles.push({ file, timestamp });
    return;
  }
  if (LEGACY_8.test(file)) {
    if (!FROZEN_LEGACY_8.has(file)) {
      errors.push(`❌ Formato LEGADO-8 (YYYYMMDD_nome.sql) não é mais aceito para arquivo novo: ${file} — use YYYYMMDDHHMMSS_nome.sql (14 dígitos).`);
      hasError = true;
    }
    seenLegacy8.add(file);
    return;
  }
  if (LEGACY_4.test(file)) {
    if (!FROZEN_LEGACY_4.has(file)) {
      errors.push(`❌ Formato LEGADO-4 (NNNN[a]_nome.sql) não é mais aceito para arquivo novo: ${file} — use YYYYMMDDHHMMSS_nome.sql (14 dígitos).`);
      hasError = true;
    }
    seenLegacy4.add(file);
    return;
  }
  if (PINNED_FORMAT_ANOMALY.has(file)) {
    // Pinado: anomalia histórica conhecida, não renomeável (ver comentário na declaração).
    return;
  }
  errors.push(`❌ Formato desconhecido (esperado YYYYMMDDHHMMSS_nome.sql; NNNN_nome.sql e YYYYMMDD_nome.sql só valem para os arquivos congelados da gênese): ${file}`);
  hasError = true;
});

// ============================================================================
// PASSO 2 — Lei 2: nenhum arquivo congelado pode ter sumido/mudado de nome
// ============================================================================
for (const expected of FROZEN_LEGACY_4) {
  if (!seenLegacy4.has(expected)) {
    errors.push(`❌ Migration legada CONGELADA ausente do disco (Lei 2 — forward-only proíbe remover/renomear migration existente): ${expected}`);
    hasError = true;
  }
}
for (const expected of FROZEN_LEGACY_8) {
  if (!seenLegacy8.has(expected)) {
    errors.push(`❌ Migration legada CONGELADA ausente do disco (Lei 2 — forward-only proíbe remover/renomear migration existente): ${expected}`);
    hasError = true;
  }
}

// ============================================================================
// PASSO 3 — colisão de timestamp exato no formato canônico (duplicidade)
// ============================================================================
const canonicalByTimestamp = new Map();
canonicalFiles.forEach(({ file, timestamp }) => {
  if (!canonicalByTimestamp.has(timestamp)) {
    canonicalByTimestamp.set(timestamp, []);
  }
  canonicalByTimestamp.get(timestamp).push(file);
});
for (const [timestamp, files] of canonicalByTimestamp) {
  if (files.length <= 1) continue;
  const allPinned = files.length === PINNED_TIMESTAMP_COLLISION.size
    && files.every((f) => PINNED_TIMESTAMP_COLLISION.has(f));
  if (allPinned) continue; // colisão histórica conhecida e pinada — ver declaração acima
  errors.push(`❌ Timestamp duplicado ${timestamp}: ${files.join(', ')} — duas migrations não podem nascer no mesmo segundo.`);
  hasError = true;
}

// ============================================================================
// PASSO 4 — validação histórica do LEGADO-4 (preservada do guard original):
// número único, sufixo único por número, sufixos sequenciais (a, b, c...)
// ============================================================================
const baseFilesByNumber = new Map(); // number -> [file, ...] entre os sem sufixo
const suffixMap = new Map(); // "NNNNs" -> file
const legacy4Files = migrationFiles.filter((f) => LEGACY_4.test(f) && FROZEN_LEGACY_4.has(f));

legacy4Files.forEach((file) => {
  const match = file.match(LEGACY_4);
  const number = parseInt(match[1], 10);
  const suffix = match[2] || '';

  if (!suffix) {
    if (!baseFilesByNumber.has(number)) baseFilesByNumber.set(number, []);
    baseFilesByNumber.get(number).push(file);
  } else {
    const key = `${number}${suffix}`;
    if (suffixMap.has(key)) {
      errors.push(`❌ Sufixo duplicado: ${key} (${suffixMap.get(key)}, ${file})`);
      hasError = true;
    } else {
      suffixMap.set(key, file);
    }
  }
});

for (const [number, files] of baseFilesByNumber) {
  if (files.length > 1) {
    errors.push(`❌ Numeração duplicada: ${number} (${files.join(', ')})`);
    hasError = true;
  }
}

const numbersWithSuffixes = new Set();
legacy4Files.forEach((file) => {
  const match = file.match(LEGACY_4);
  const number = match[1];
  const files = legacy4Files.filter((f) => f.startsWith(number));
  if (files.length > 1) numbersWithSuffixes.add(number);
});

numbersWithSuffixes.forEach((num) => {
  const files = legacy4Files.filter((f) => f.startsWith(num));
  const suffixes = files
    .map((f) => {
      const match = f.match(/^\d{4}([a-z]?)_/);
      return match ? match[1] : '';
    })
    .filter((s) => s);

  if (suffixes.length > 1) {
    const expected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const sorted = [...suffixes].sort();
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i] !== expected[i]) {
        errors.push(`❌ Sufixos não sequenciais para ${num}: ${sorted.join(', ')}`);
        hasError = true;
        break;
      }
    }
  }
});

// ============================================================================
// Output
// ============================================================================
if (hasError) {
  console.error('='.repeat(80));
  console.error('❌ GATE 3 — INTEGRIDADE DE MIGRAÇÕES: FALHOU');
  console.error('='.repeat(80));
  errors.forEach((err) => console.error(err));
  console.error('');
  process.exit(1);
} else {
  console.log('='.repeat(80));
  console.log('✅ GATE 3 — INTEGRIDADE DE MIGRAÇÕES: PASSOU');
  console.log('='.repeat(80));
  console.log(`📋 Total de migrations: ${migrationFiles.length}`);
  console.log(`✅ Formato canônico (14 dígitos): ${canonicalFiles.length} · sem timestamp duplicado`);
  console.log(`✅ Legado-8 (congelado): ${seenLegacy8.size}/${FROZEN_LEGACY_8.size}`);
  console.log(`✅ Legado-4 (congelado): ${seenLegacy4.size}/${FROZEN_LEGACY_4.size} · numeração/sufixos OK`);
  console.log('');
  process.exit(0);
}
