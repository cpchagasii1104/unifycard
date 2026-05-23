// Financial Metrics — métricas em memória para observabilidade

export const financialMetrics = {
  duplicate_reference_attempt: 0,
  insufficient_funds_attempt: 0,
  overflow_attempt: 0,
  transactions_created: 0,
  idempotent_returns: 0,
};

export function incrementMetric(metric: keyof typeof financialMetrics) {
  financialMetrics[metric]++;
}

export function getFinancialMetrics() {
  return financialMetrics;
}