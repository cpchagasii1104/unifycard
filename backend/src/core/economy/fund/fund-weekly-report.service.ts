// src/core/economy/fund/fund-weekly-report.service.ts
// Serviço para gerar relatório semanal do fundo regional

import { fundAdminService, type RegionFundData } from './fund-admin.service';
import { getClientWithTenant } from '@core/database/pool';
import * as fs from 'fs';
import * as path from 'path';

export interface WeeklyReport {
  week: string; // formato: YYYY-WW
  weekStart: string; // ISO date
  weekEnd: string; // ISO date
  regions: RegionWeeklyData[];
  topRegion: string | null;
  bottomRegion: string | null;
  summary: {
    totalRegions: number;
    totalAccumulated: number;
    totalGrowth: number;
    totalTransactions: number;
  };
  generatedAt: string; // ISO date
}

export interface RegionWeeklyData {
  regionId: string;
  regionName?: string;
  totalAccumulated: number;
  weekGrowth: number;
  weekTransactions: number;
  balance: number;
}

class FundWeeklyReportService {
  private readonly reportsDir = path.join(process.cwd(), 'reports', 'fund-weekly');

  constructor() {
    // Garantir que o diretório existe
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Calcula número da semana ISO (YYYY-WW)
   */
  private getWeekNumber(date: Date): string {
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
  private getWeekRange(date: Date): { start: Date; end: Date } {
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
  async generateWeeklyReport(tenantId: string): Promise<WeeklyReport> {
    const now = new Date();
    const week = this.getWeekNumber(now);
    const { start: weekStart, end: weekEnd } = this.getWeekRange(now);

    // Buscar dados de todas as regiões
    const allRegions = await fundAdminService.listAllRegions(tenantId);

    // Buscar transações da semana para cada região
    const client = await getClientWithTenant(tenantId);
    const regionsWeeklyData: RegionWeeklyData[] = [];

    try {
      for (const region of allRegions) {
        // Buscar transações da semana atual
        const weekTransactionsResult = await client.query<{
          week_amount: string;
          week_count: string;
        }>(
          `
          SELECT 
            COALESCE(SUM(amount), 0) as week_amount,
            COUNT(*) as week_count
          FROM transactions
          WHERE tenant_id = $1
            AND to_account = $2
            AND metadata->>'module' = 'work'
            AND metadata->>'splitTargetType' = 'REGION'
            AND createdAt >= $3
            AND createdAt <= $4
          `,
          [tenantId, region.accountId, weekStart, weekEnd]
        );

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
      let topRegion: string | null = null;
      let maxGrowth = -Infinity;
      for (const region of regionsWeeklyData) {
        if (region.weekGrowth > maxGrowth) {
          maxGrowth = region.weekGrowth;
          topRegion = region.regionId;
        }
      }

      // Encontrar região que menos cresceu (ou não cresceu)
      let bottomRegion: string | null = null;
      let minGrowth = Infinity;
      for (const region of regionsWeeklyData) {
        if (region.weekGrowth < minGrowth) {
          minGrowth = region.weekGrowth;
          bottomRegion = region.regionId;
        }
      }

      // Calcular totais
      const totalAccumulated = regionsWeeklyData.reduce(
        (sum, r) => sum + r.totalAccumulated,
        0
      );
      const totalGrowth = regionsWeeklyData.reduce((sum, r) => sum + r.weekGrowth, 0);
      const totalTransactions = regionsWeeklyData.reduce(
        (sum, r) => sum + r.weekTransactions,
        0
      );

      const report: WeeklyReport = {
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
    } finally {
      client.release();
    }
  }

  /**
   * Salva relatório em arquivo JSON
   */
  private async saveReport(tenantId: string, report: WeeklyReport): Promise<void> {
    const filename = `fund-weekly-${tenantId}-${report.week}.json`;
    const filepath = path.join(this.reportsDir, filename);

    await fs.promises.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');
  }

  /**
   * Busca relatório mais recente
   */
  async getLatestReport(tenantId: string): Promise<WeeklyReport | null> {
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
      return JSON.parse(content) as WeeklyReport;
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
      return null;
    }
  }

  /**
   * Lista todos os relatórios disponíveis
   */
  async listReports(tenantId: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.reportsDir);
      return files
        .filter((f) => f.startsWith(`fund-weekly-${tenantId}-`) && f.endsWith('.json'))
        .map((f) => f.replace(`fund-weekly-${tenantId}-`, '').replace('.json', ''))
        .sort()
        .reverse();
    } catch {
      return [];
    }
  }
}

export const fundWeeklyReportService = new FundWeeklyReportService();












