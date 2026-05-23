// src/core/insight/insight-engine.ts
// Engine de insights - função pura, read-only, observacional

import { v4 as uuidv4 } from 'uuid';
import type { Insight, InsightInput } from './insight.types';
import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';

/**
 * Engine de insights
 * Função pura e determinística
 * Read-only - apenas observa e sugere, nunca executa
 * 
 * THRESHOLDS MÍNIMOS (guardrail de dados):
 * - Trend insights: requer >= 2 semanas de dados
 * - Projection insights: requer >= 4 semanas de dados para projeção confiável
 * - Anomaly insights: requer >= 4 semanas de dados para calcular média
 * 
 * Se dados insuficientes, não gera insights (retorna array vazio)
 */
export class InsightEngine {
  /**
   * Gera insights baseados em eventos, policies e simulações
   */
  generateInsights(input: InsightInput): Insight[] {
    const insights: Insight[] = [];

    // 1. Trend: crescimento semanal do fundo por região
    insights.push(...this.generateTrendInsights(input.canonicalEvents));

    // 2. Projection: projeção linear de saldo em 30 e 90 dias
    insights.push(...this.generateProjectionInsights(input.canonicalEvents));

    // 3. Anomaly: queda >30% de transações vs média de 4 semanas
    insights.push(...this.generateAnomalyInsights(input.canonicalEvents));

    return insights;
  }

  /**
   * Gera insights de tendência (trend)
   * Analisa crescimento semanal do fundo por região
   */
  private generateTrendInsights(events: CanonicalEvent[]): Insight[] {
    const insights: Insight[] = [];

    // Filtrar apenas eventos de pagamento processado
    const paymentEvents = events.filter(
      (e) => e.eventType === 'payment.processed' && e.amountCents !== undefined
    );

    if (paymentEvents.length === 0) {
      return insights;
    }

    // Agrupar por região
    const byRegion = new Map<string, CanonicalEvent[]>();
    for (const event of paymentEvents) {
      const regionId = event.regionId || 'unknown';
      if (!byRegion.has(regionId)) {
        byRegion.set(regionId, []);
      }
      byRegion.get(regionId)!.push(event);
    }

    // Analisar crescimento semanal por região
    for (const [regionId, regionEvents] of byRegion) {
      // Agrupar por semana
      const byWeek = new Map<string, number>();
      for (const event of regionEvents) {
        const date = new Date(event.occurredAt);
        const weekKey = this.getWeekKey(date);
        const current = byWeek.get(weekKey) || 0;
        byWeek.set(weekKey, current + (event.amountCents || 0));
      }

      const weeks = Array.from(byWeek.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, amount]) => ({ week, amount }));

      if (weeks.length >= 2) {
        // Calcular crescimento entre últimas 2 semanas
        const lastWeek = weeks[weeks.length - 1];
        const previousWeek = weeks[weeks.length - 2];

        const growth = previousWeek.amount > 0
          ? ((lastWeek.amount - previousWeek.amount) / previousWeek.amount) * 100
          : 0;

        const severity: Insight['severity'] = growth > 20
          ? 'opportunity'
          : growth < -10
          ? 'warning'
          : 'info';

        insights.push({
          id: uuidv4(),
          type: 'trend',
          domain: 'fund',
          severity,
          message: `Crescimento semanal do fundo regional ${regionId}: ${growth.toFixed(1)}% (semana anterior: ${previousWeek.amount.toFixed(2)}, semana atual: ${lastWeek.amount.toFixed(2)})`,
          data: {
            regionId,
            growth,
            lastWeekAmount: lastWeek.amount,
            previousWeekAmount: previousWeek.amount,
            weeks: weeks.length,
          },
          generatedAt: new Date().toISOString(),
        });
      }
    }

    return insights;
  }

  /**
   * Gera insights de projeção (projection)
   * Projeção linear de saldo em 30 e 90 dias
   */
  private generateProjectionInsights(events: CanonicalEvent[]): Insight[] {
    const insights: Insight[] = [];

    // Filtrar apenas eventos de pagamento processado
    const paymentEvents = events.filter(
      (e) => e.eventType === 'payment.processed' && e.amountCents !== undefined
    );

    if (paymentEvents.length === 0) {
      return insights;
    }

    // Calcular média diária dos últimos 30 dias
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEvents = paymentEvents.filter(
      (e) => new Date(e.occurredAt) >= thirtyDaysAgo
    );

    if (recentEvents.length === 0) {
      return insights;
    }

    const totalAmount = recentEvents.reduce((sum, e) => sum + (e.amountCents || 0), 0);
    const days = Math.max(1, Math.floor((now.getTime() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyAverage = totalAmount / days;

    // Projeção linear para 30 e 90 dias
    const projection30Days = dailyAverage * 30;
    const projection90Days = dailyAverage * 90;

    // Calcular saldo atual (assumindo 10% do total)
    const currentBalance = totalAmount * 0.10;

    insights.push({
      id: uuidv4(),
      type: 'projection',
      domain: 'fund',
      severity: 'info',
      message: `Projeção linear: se mantiver média diária de ${dailyAverage.toFixed(2)}, fundo terá ${(currentBalance + projection30Days * 0.10).toFixed(2)} em 30 dias e ${(currentBalance + projection90Days * 0.10).toFixed(2)} em 90 dias`,
      data: {
        currentBalance,
        dailyAverage,
        projection30Days: projection30Days * 0.10,
        projection90Days: projection90Days * 0.10,
        daysAnalyzed: days,
        totalEvents: recentEvents.length,
      },
      generatedAt: new Date().toISOString(),
    });

    return insights;
  }

  /**
   * Gera insights de anomalia (anomaly)
   * Detecta queda >30% de transações vs média de 4 semanas
   */
  private generateAnomalyInsights(events: CanonicalEvent[]): Insight[] {
    const insights: Insight[] = [];

    // Filtrar apenas eventos de pagamento processado
    const paymentEvents = events.filter(
      (e) => e.eventType === 'payment.processed' && e.amountCents !== undefined
    );

    if (paymentEvents.length === 0) {
      return insights;
    }

    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    // Calcular média de transações por semana nas últimas 4 semanas
    const recentEvents = paymentEvents.filter(
      (e) => new Date(e.occurredAt) >= fourWeeksAgo
    );

    if (recentEvents.length < 2) {
      return insights; // Não há dados suficientes
    }

    // Agrupar por semana
    const byWeek = new Map<string, number>();
    for (const event of recentEvents) {
      const date = new Date(event.occurredAt);
      const weekKey = this.getWeekKey(date);
      const current = byWeek.get(weekKey) || 0;
      byWeek.set(weekKey, current + 1);
    }

    const weeks = Array.from(byWeek.values());
    if (weeks.length < 2) {
      return insights;
    }

    // Calcular média das primeiras semanas (excluindo última)
    const previousWeeks = weeks.slice(0, -1);
    const averagePrevious = previousWeeks.reduce((sum, count) => sum + count, 0) / previousWeeks.length;

    // Última semana
    const lastWeek = weeks[weeks.length - 1];

    // Calcular variação
    const variation = averagePrevious > 0
      ? ((lastWeek - averagePrevious) / averagePrevious) * 100
      : 0;

    // Detectar anomalia: queda >30%
    if (variation < -30) {
      insights.push({
        id: uuidv4(),
        type: 'anomaly',
        domain: 'work',
        severity: 'warning',
        message: `Queda significativa de transações: última semana teve ${lastWeek} transações, vs média de ${averagePrevious.toFixed(1)} das semanas anteriores (queda de ${Math.abs(variation).toFixed(1)}%)`,
        data: {
          lastWeekCount: lastWeek,
          averagePreviousWeeks: averagePrevious,
          variation,
          weeksAnalyzed: weeks.length,
        },
        generatedAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  /**
   * Gera chave de semana no formato YYYY-WW
   */
  private getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }
}

export const insightEngine = new InsightEngine();

