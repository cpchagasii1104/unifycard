"use strict";
// src/modules/work/work-insights.service.ts
//
// Serviço de insights do módulo Work
// Implementa lógica de análise e performance
Object.defineProperty(exports, "__esModule", { value: true });
exports.workInsightsService = void 0;
const work_insights_1 = require("./work.insights");
class WorkInsightsService {
    /**
     * Retorna resumo das últimas sessões de trabalho
     */
    async getSummary(tenantId, userId, limit = 5) {
        return await (0, work_insights_1.getLatestSummaries)(userId, limit);
    }
    /**
     * Retorna histórico de jobs do usuário
     */
    async getHistory(tenantId, userId, limit = 20) {
        return await (0, work_insights_1.getJobHistory)(userId, limit);
    }
    /**
     * Calcula e retorna score de performance
     */
    async getPerformance(tenantId, userId) {
        return await (0, work_insights_1.getPerformanceScore)(userId);
    }
    /**
     * Detecta e retorna padrões de trabalho
     */
    async getPatterns(tenantId, userId) {
        return await (0, work_insights_1.getWorkPatterns)(userId);
    }
}
exports.workInsightsService = new WorkInsightsService();
//# sourceMappingURL=work-insights.service.js.map