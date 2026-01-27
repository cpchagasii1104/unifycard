// backend/src/core/observability/bank-metrics.service.ts
// CONTINUOUS PRODUCTION: Observabilidade mínima para Unify Bank
// Contadores simples em memória (sem infra externa)

interface MetricCounter {
  count: number;
  lastReset: Date;
}

interface TransactionMetrics {
  byContext: Record<string, number>;
  byMinute: Array<{ minute: string; count: number }>;
}

class BankMetricsService {
  private transactionCounts: Map<string, MetricCounter> = new Map();
  private validationFailures: number = 0;
  private lastReset: Date = new Date();

  /**
   * Incrementa contador de transações por contexto
   */
  incrementTransaction(context: string): void {
    const key = `transaction.${context}`;
    const counter = this.transactionCounts.get(key) || { count: 0, lastReset: new Date() };
    counter.count++;
    this.transactionCounts.set(key, counter);
  }

  /**
   * Incrementa contador de falhas de validação
   */
  incrementValidationFailure(): void {
    this.validationFailures++;
  }

  /**
   * Obtém resumo de métricas
   */
  getSummary(): {
    transactions: TransactionMetrics;
    validationFailures: number;
    lastReset: Date;
  } {
    const byContext: Record<string, number> = {};
    const byMinute: Array<{ minute: string; count: number }> = [];

    // Agregar por contexto
    for (const [key, counter] of this.transactionCounts.entries()) {
      if (key.startsWith('transaction.')) {
        const context = key.replace('transaction.', '');
        byContext[context] = (byContext[context] || 0) + counter.count;
      }
    }

    // Agregar por minuto (últimos 60 minutos)
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const minute = new Date(now);
      minute.setMinutes(minute.getMinutes() - i);
      const minuteKey = `${minute.getFullYear()}-${String(minute.getMonth() + 1).padStart(2, '0')}-${String(minute.getDate()).padStart(2, '0')} ${String(minute.getHours()).padStart(2, '0')}:${String(minute.getMinutes()).padStart(2, '0')}`;
      
      // Contar transações neste minuto (simplificado - conta todas)
      const totalCount = Array.from(this.transactionCounts.values())
        .reduce((sum, c) => sum + c.count, 0);
      
      byMinute.push({
        minute: minuteKey,
        count: Math.floor(totalCount / 60), // Distribuição aproximada
      });
    }

    return {
      transactions: {
        byContext,
        byMinute: byMinute.reverse(), // Mais recente primeiro
      },
      validationFailures: this.validationFailures,
      lastReset: this.lastReset,
    };
  }

  /**
   * Reseta métricas (chamado periodicamente ou manualmente)
   */
  reset(): void {
    this.transactionCounts.clear();
    this.validationFailures = 0;
    this.lastReset = new Date();
  }
}

export const bankMetricsService = new BankMetricsService();







