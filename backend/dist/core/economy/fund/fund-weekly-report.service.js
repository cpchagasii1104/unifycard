"use strict";
// src/core/economy/fund/fund-weekly-report.service.ts
// Serviço para gerar relatório semanal do fundo regional
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fundWeeklyReportService = void 0;
const fund_admin_service_1 = require("./fund-admin.service");
const pool_1 = require("@core/database/pool");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FundWeeklyReportService {
    reportsDir = path.join(process.cwd(), 'reports', 'fund-weekly');
    constructor() {
        // Garantir que o diretório existe
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
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
     * Calcula início e fim da semana (segunda a domingo)
     */
    getWeekRange(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para segunda-feira
        const start = new Date(d.setDate(diff));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }
    /**
     * Gera relatório semanal do fundo regional
     */
    async generateWeeklyReport(tenantId) {
        const now = new Date();
        const week = this.getWeekNumber(now);
        const { start: weekStart, end: weekEnd } = this.getWeekRange(now);
        // Buscar dados de todas as regiões
        const allRegions = await fund_admin_service_1.fundAdminService.listAllRegions(tenantId);
        // Buscar transações da semana para cada região
        const client = await (0, pool_1.getClientWithTenant)(tenantId);
        const regionsWeeklyData = [];
        try {
            for (const region of allRegions) {
                // Buscar transações da semana atual
                const weekTransactionsResult = await client.query(`
          SELECT 
            COALESCE(SUM(amount), 0) as week_amount,
            COUNT(*) as week_count
          FROM transactions
          WHERE tenant_id = $1
            AND to_account = $2
            AND metadata->>'module' = 'work'
            AND metadata->>'splitTargetType' = 'REGION'
            AND created_at >= $3
            AND created_at <= $4
          `, [tenantId, region.accountId, weekStart, weekEnd]);
                const weekRow = weekTransactionsResult.rows[0];
                const weekGrowth = parseFloat(weekRow.week_amount || '0');
                const weekTransactions = parseInt(weekRow.week_count || '0', 10);
                regionsWeeklyData.push({
                    regionId: region.regionId,
                    regionName: region.regionName,
                    totalAccumulated: region.totalAccumulated,
                    weekGrowth,
                    weekTransactions,
                    balance: region.balance,
                });
            }
            // Encontrar região que mais cresceu
            let topRegion = null;
            let maxGrowth = -Infinity;
            for (const region of regionsWeeklyData) {
                if (region.weekGrowth > maxGrowth) {
                    maxGrowth = region.weekGrowth;
                    topRegion = region.regionId;
                }
            }
            // Encontrar região que menos cresceu (ou não cresceu)
            let bottomRegion = null;
            let minGrowth = Infinity;
            for (const region of regionsWeeklyData) {
                if (region.weekGrowth < minGrowth) {
                    minGrowth = region.weekGrowth;
                    bottomRegion = region.regionId;
                }
            }
            // Calcular totais
            const totalAccumulated = regionsWeeklyData.reduce((sum, r) => sum + r.totalAccumulated, 0);
            const totalGrowth = regionsWeeklyData.reduce((sum, r) => sum + r.weekGrowth, 0);
            const totalTransactions = regionsWeeklyData.reduce((sum, r) => sum + r.weekTransactions, 0);
            const report = {
                week,
                weekStart: weekStart.toISOString(),
                weekEnd: weekEnd.toISOString(),
                regions: regionsWeeklyData,
                topRegion,
                bottomRegion,
                summary: {
                    totalRegions: regionsWeeklyData.length,
                    totalAccumulated,
                    totalGrowth,
                    totalTransactions,
                },
                generatedAt: now.toISOString(),
            };
            // Persistir relatório em arquivo
            await this.saveReport(tenantId, report);
            return report;
        }
        finally {
            client.release();
        }
    }
    /**
     * Salva relatório em arquivo JSON
     */
    async saveReport(tenantId, report) {
        const filename = `fund-weekly-${tenantId}-${report.week}.json`;
        const filepath = path.join(this.reportsDir, filename);
        await fs.promises.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');
    }
    /**
     * Busca relatório mais recente
     */
    async getLatestReport(tenantId) {
        try {
            const files = await fs.promises.readdir(this.reportsDir);
            const tenantFiles = files
                .filter((f) => f.startsWith(`fund-weekly-${tenantId}-`) && f.endsWith('.json'))
                .sort()
                .reverse();
            if (tenantFiles.length === 0) {
                return null;
            }
            const latestFile = tenantFiles[0];
            const filepath = path.join(this.reportsDir, latestFile);
            const content = await fs.promises.readFile(filepath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            console.error('Erro ao buscar relatório:', error);
            return null;
        }
    }
    /**
     * Lista todos os relatórios disponíveis
     */
    async listReports(tenantId) {
        try {
            const files = await fs.promises.readdir(this.reportsDir);
            return files
                .filter((f) => f.startsWith(`fund-weekly-${tenantId}-`) && f.endsWith('.json'))
                .map((f) => f.replace(`fund-weekly-${tenantId}-`, '').replace('.json', ''))
                .sort()
                .reverse();
        }
        catch {
            return [];
        }
    }
}
exports.fundWeeklyReportService = new FundWeeklyReportService();
