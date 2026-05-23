// USE_BANK_REGIONAL_FUND — migração incremental marketplace → Bank como SSOT.
// Default false (fail-closed): não ativa até env explícita.

/**
 * Quando true: saldo regional e incentivos usam contas/ledger Bank;
 * `regional_funds.total_balance_cents` deixa de ser fonte de decisão.
 */
export function isUseBankRegionalFundEnabled(): boolean {
  const v = process.env.USE_BANK_REGIONAL_FUND;
  if (v == null || String(v).trim() === '') {
    return false;
  }
  return String(v).toLowerCase() === 'true';
}