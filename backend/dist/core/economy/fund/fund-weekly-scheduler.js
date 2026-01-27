"use strict";
// src/core/economy/fund/fund-weekly-scheduler.ts
// Scheduler para gerar relatório semanal automaticamente
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundWeeklyScheduler = void 0;
const fund_weekly_report_service_1 = require("./fund-weekly-report.service");
const pool_1 = require("@core/database/pool");
class FundWeeklyScheduler {
    intervalId = null;
    isRunning = false;
    lastRunWeek = null;
    /**
     * Inicia o scheduler semanal
     * Verifica a cada 24 horas se precisa gerar novo relatório
     */
    start() {
        if (this.intervalId) {
            console.log('[FundWeeklyScheduler] Já está rodando');
            return;
        }
        console.log('[FundWeeklyScheduler] Iniciando scheduler semanal');
        // Verificar imediatamente na inicialização
        this.checkAndGenerate();
        // Verificar a cada 24 horas
        this.intervalId = setInterval(() => {
            this.checkAndGenerate();
        }, 24 * 60 * 60 * 1000); // 24 horas
    }
    /**
     * Para o scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[FundWeeklyScheduler] Scheduler parado');
        }
    }
    /**
     * Verifica se precisa gerar novo relatório e gera se necessário
     */
    async checkAndGenerate() {
        if (this.isRunning) {
            return; // Já está gerando
        }
        try {
            this.isRunning = true;
            // Obter semana atual
            const now = new Date();
            const currentWeek = this.getWeekNumber(now);
            // Se já gerou para esta semana, não gerar novamente
            if (this.lastRunWeek === currentWeek) {
                return;
            }
            console.log(`[FundWeeklyScheduler] Verificando geração de relatório para semana ${currentWeek}`);
            // Buscar todos os tenants
            // Nota: A tabela tenants não tem coluna is_active, então buscamos todos
            const tenantsResult = await pool_1.pool.query(`
        SELECT tenant_id
        FROM tenants
        `);
            const tenants = tenantsResult.rows.map((r) => r.tenant_id);
            // Gerar relatório para cada tenant
            for (const tenantId of tenants) {
                try {
                    const report = await fund_weekly_report_service_1.fundWeeklyReportService.generateWeeklyReport(tenantId);
                    // Log estruturado do relatório gerado
                    console.log(JSON.stringify({
                        timestamp: new Date().toISOString(),
                        module: 'fund',
                        eventType: 'weekly_report_generated',
                        tenantId,
                        week: report.week,
                        totalRegions: report.summary.totalRegions,
                        totalGrowth: report.summary.totalGrowth,
                        totalTransactions: report.summary.totalTransactions,
                        topRegion: report.topRegion,
                        bottomRegion: report.bottomRegion,
                    }));
                    console.log(`[FundWeeklyScheduler] Relatório gerado para tenant ${tenantId}, semana ${currentWeek}`);
                }
                catch (error) {
                    console.error(`[FundWeeklyScheduler] Erro ao gerar relatório para tenant ${tenantId}:`, error);
                }
            }
            this.lastRunWeek = currentWeek;
        }
        catch (error) {
            console.error('[FundWeeklyScheduler] Erro ao verificar geração de relatório:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    /**
     * Calcula número da semana ISO (YYYY-WW)
     */
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    }
    /**
     * Força geração de relatório (útil para testes)
     */
    async forceGenerate(tenantId) {
        this.lastRunWeek = null; // Reset para forçar geração
        await this.checkAndGenerate();
    }
}
exports.fundWeeklyScheduler = new FundWeeklyScheduler();
