/**
 * Espelho operacional da taxonomia em docs/01_normative/SSOT_REGISTRY_UNIFICARD.md (secção V).
 * Não substitui COMMENT em DDL nem o registry; uso em tooling futuro (lint, relatórios).
 */
export const TABLE_CLASS = {
  /** Log pré-financeiro / operacional — não SSOT de liquidação */
  LOG: new Set<string>(['unifycard_transactions']),
} as const;