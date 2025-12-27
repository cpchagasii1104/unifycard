// src/core/logging/split-logger.service.ts
// Serviço de logs estruturados para splits e transações

import type { FastifyBaseLogger } from 'fastify';

interface SplitLogData {
  timestamp: string;
  module: string;
  regionId?: string;
  amount: number;
  transactionId: string;
  tenantId: string;
  splitTargetType?: string;
  splitPercentage?: number;
}

interface WorkTransactionLogData {
  timestamp: string;
  module: 'work';
  regionId?: string;
  amount: number;
  transactionId: string;
  tenantId: string;
  assignmentId?: string;
  jobId?: string;
  workerId?: string;
}

class SplitLoggerService {
  private logger?: FastifyBaseLogger;

  constructor(logger?: FastifyBaseLogger) {
    this.logger = logger;
  }

  /**
   * Injeta logger do Fastify (chamado no startup do servidor)
   */
  setLogger(logger: FastifyBaseLogger): void {
    this.logger = logger;
  }

  /**
   * Log estruturado para split executado
   */
  logSplit(data: SplitLogData): void {
    const logEntry = {
      timestamp: data.timestamp || new Date().toISOString(),
      module: data.module,
      regionId: data.regionId || null,
      amount: data.amount,
      transactionId: data.transactionId,
      tenantId: data.tenantId,
      splitTargetType: data.splitTargetType || null,
      splitPercentage: data.splitPercentage || null,
      logType: 'split_executed',
    };

    if (this.logger) {
      this.logger.info(logEntry, `Split executed: ${data.splitTargetType} - ${data.amount}`);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log estruturado para crédito em conta REGION
   */
  logRegionCredit(data: SplitLogData): void {
    const logEntry = {
      timestamp: data.timestamp || new Date().toISOString(),
      module: data.module,
      regionId: data.regionId || null,
      amount: data.amount,
      transactionId: data.transactionId,
      tenantId: data.tenantId,
      logType: 'region_credit',
    };

    if (this.logger) {
      this.logger.info(logEntry, `Region credit: ${data.amount} to region ${data.regionId}`);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log estruturado para transação de WORK criada
   */
  logWorkTransaction(data: WorkTransactionLogData): void {
    const logEntry = {
      timestamp: data.timestamp || new Date().toISOString(),
      module: data.module,
      regionId: data.regionId || null,
      amount: data.amount,
      transactionId: data.transactionId,
      tenantId: data.tenantId,
      assignmentId: data.assignmentId || null,
      jobId: data.jobId || null,
      workerId: data.workerId || null,
      logType: 'work_transaction_created',
    };

    if (this.logger) {
      this.logger.info(logEntry, `Work transaction created: ${data.transactionId}`);
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }
}

// Singleton instance (será injetado com logger do Fastify quando disponível)
export const splitLoggerService = new SplitLoggerService();

