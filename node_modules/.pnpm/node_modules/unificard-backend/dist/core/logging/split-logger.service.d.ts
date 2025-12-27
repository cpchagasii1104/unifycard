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
declare class SplitLoggerService {
    private logger?;
    constructor(logger?: FastifyBaseLogger);
    /**
     * Injeta logger do Fastify (chamado no startup do servidor)
     */
    setLogger(logger: FastifyBaseLogger): void;
    /**
     * Log estruturado para split executado
     */
    logSplit(data: SplitLogData): void;
    /**
     * Log estruturado para crédito em conta REGION
     */
    logRegionCredit(data: SplitLogData): void;
    /**
     * Log estruturado para transação de WORK criada
     */
    logWorkTransaction(data: WorkTransactionLogData): void;
}
export declare const splitLoggerService: SplitLoggerService;
export {};
//# sourceMappingURL=split-logger.service.d.ts.map