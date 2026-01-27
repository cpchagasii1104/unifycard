"use strict";
// src/core/logging/split-logger.service.ts
// Serviço de logs estruturados para splits e transações
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitLoggerService = void 0;
class SplitLoggerService {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * Injeta logger do Fastify (chamado no startup do servidor)
     */
    setLogger(logger) {
        this.logger = logger;
    }
    /**
     * Log estruturado para split executado
     */
    logSplit(data) {
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
        }
        else {
            console.log(JSON.stringify(logEntry));
        }
    }
    /**
     * Log estruturado para crédito em conta REGION
     */
    logRegionCredit(data) {
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
        }
        else {
            console.log(JSON.stringify(logEntry));
        }
    }
    /**
     * Log estruturado para transação de WORK criada
     */
    logWorkTransaction(data) {
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
        }
        else {
            console.log(JSON.stringify(logEntry));
        }
    }
}
// Singleton instance (será injetado com logger do Fastify quando disponível)
exports.splitLoggerService = new SplitLoggerService();
