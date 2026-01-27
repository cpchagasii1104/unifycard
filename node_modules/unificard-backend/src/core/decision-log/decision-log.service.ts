// src/core/decision-log/decision-log.service.ts
// Serviço de log de decisões estratégicas

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import type { DecisionLog, DecisionLogFilters, DecisionDomain } from './decision-log.types';

/**
 * Serviço de log de decisões
 * Registra observações, sugestões e contextos
 * Read-only mode - não executa decisões
 */
class DecisionLogService {
  private readonly logsDir = path.join(process.cwd(), 'logs', 'decisions');
  private inMemoryLogs: DecisionLog[] = []; // Cache em memória

  constructor() {
    // Garantir que o diretório existe
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Carregar logs existentes em memória (read-only)
    this.loadLogsFromDisk();
  }

  /**
   * Carrega logs do disco para memória (read-only)
   */
  private loadLogsFromDisk(): void {
    try {
      const files = fs.readdirSync(this.logsDir);
      const logFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of logFiles) {
        try {
          const filePath = path.join(this.logsDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const logs: DecisionLog[] = JSON.parse(content);
          this.inMemoryLogs.push(...logs);
        } catch (error) {
          console.warn(`[DecisionLog] Erro ao carregar log ${file}:`, error);
        }
      }

      // Ordenar por data de criação (mais recente primeiro)
      this.inMemoryLogs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.warn('[DecisionLog] Erro ao carregar logs do disco:', error);
    }
  }

  /**
   * Cria uma observação (não executa decisão)
   */
  async createObservation(
    domain: DecisionDomain,
    policyKey: string,
    context: DecisionLog['context'],
    currentPolicyValue: number,
    options?: {
      suggestedValue?: number;
      insightsUsed?: DecisionLog['insightsUsed'];
      metadata?: Record<string, unknown>;
    }
  ): Promise<DecisionLog> {
    const decisionLog: DecisionLog = {
      decisionId: uuidv4(),
      domain,
      policyKey,
      context,
      currentPolicyValue,
      suggestedValue: options?.suggestedValue,
      insightsUsed: options?.insightsUsed || [],
      decision: null, // Por enquanto sempre null
      status: 'observed',
      createdAt: new Date().toISOString(),
      metadata: options?.metadata,
    };

    // Adicionar à memória
    this.inMemoryLogs.unshift(decisionLog); // Adicionar no início

    // Persistir em arquivo JSON (append)
    await this.persistLog(decisionLog);

    return decisionLog;
  }

  /**
   * Persiste log em arquivo JSON
   */
  private async persistLog(log: DecisionLog): Promise<void> {
    try {
      const date = new Date(log.createdAt);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `decisions-${dateStr}.json`;
      const filepath = path.join(this.logsDir, filename);

      // Ler logs existentes do arquivo ou criar novo array
      let logs: DecisionLog[] = [];
      if (fs.existsSync(filepath)) {
        try {
          const content = await fs.promises.readFile(filepath, 'utf8');
          logs = JSON.parse(content);
        } catch {
          logs = [];
        }
      }

      // Adicionar novo log
      logs.push(log);

      // Salvar de volta
      await fs.promises.writeFile(
        filepath,
        JSON.stringify(logs, null, 2),
        'utf8'
      );
    } catch (error) {
      console.warn('[DecisionLog] Erro ao persistir log:', error);
      // Continuar mesmo se falhar (modo read-only)
    }
  }

  /**
   * Lista observações com filtros
   */
  listObservations(filters: DecisionLogFilters = {}): DecisionLog[] {
    let filtered = [...this.inMemoryLogs];

    // Filtrar por domínio
    if (filters.domain) {
      filtered = filtered.filter((log) => log.domain === filters.domain);
    }

    // Filtrar por policyKey
    if (filters.policyKey) {
      filtered = filtered.filter((log) => log.policyKey === filters.policyKey);
    }

    // Filtrar por status
    if (filters.status) {
      filtered = filtered.filter((log) => log.status === filters.status);
    }

    // Filtrar por regionId
    if (filters.regionId) {
      filtered = filtered.filter(
        (log) => log.context.regionId === filters.regionId
      );
    }

    // Filtrar por data de início
    if (filters.startDate) {
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) >= filters.startDate!
      );
    }

    // Filtrar por data de fim
    if (filters.endDate) {
      filtered = filtered.filter(
        (log) => new Date(log.createdAt) <= filters.endDate!
      );
    }

    // Aplicar paginação
    const offset = filters.offset || 0;
    const limit = filters.limit || 100;

    return filtered.slice(offset, offset + limit);
  }

  /**
   * Busca uma observação específica por ID
   */
  getObservationById(decisionId: string): DecisionLog | null {
    return this.inMemoryLogs.find((log) => log.decisionId === decisionId) || null;
  }
}

export const decisionLogService = new DecisionLogService();


