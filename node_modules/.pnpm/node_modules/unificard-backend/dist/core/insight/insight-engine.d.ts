import type { Insight, InsightInput } from './insight.types';
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
export declare class InsightEngine {
    /**
     * Gera insights baseados em eventos, policies e simulações
     */
    generateInsights(input: InsightInput): Insight[];
    /**
     * Gera insights de tendência (trend)
     * Analisa crescimento semanal do fundo por região
     */
    private generateTrendInsights;
    /**
     * Gera insights de projeção (projection)
     * Projeção linear de saldo em 30 e 90 dias
     */
    private generateProjectionInsights;
    /**
     * Gera insights de anomalia (anomaly)
     * Detecta queda >30% de transações vs média de 4 semanas
     */
    private generateAnomalyInsights;
    /**
     * Gera chave de semana no formato YYYY-WW
     */
    private getWeekKey;
}
export declare const insightEngine: InsightEngine;
//# sourceMappingURL=insight-engine.d.ts.map