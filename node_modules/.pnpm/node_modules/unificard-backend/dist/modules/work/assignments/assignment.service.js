"use strict";
// backend/src/modules/work/assignments/assignment.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentService = void 0;
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
const review_service_1 = require("@core/reviews/review.service");
// Serviços de economia já existentes
const account_service_1 = require("@core/economy/accounts/account.service");
const split_service_1 = require("@core/economy/split.service");
const region_account_service_1 = require("@core/economy/region-account.service");
const group_account_service_1 = require("@core/economy/group-account.service");
const split_logger_service_1 = require("@core/logging/split-logger.service");
class AssignmentService {
    toAssignment(row) {
        return {
            assignmentId: row.assignment_id,
            tenantId: row.tenant_id,
            jobId: row.job_id,
            workerId: row.worker_id,
            clientUserId: row.client_user_id,
            agreedRate: row.agreed_rate ? Number(row.agreed_rate) : 0,
            paymentType: row.payment_type,
            status: row.status,
            paymentTransactionId: row.payment_transaction_id ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    async getById(tenantId, assignmentId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT * FROM job_assignments WHERE assignment_id = $1`, [assignmentId]);
        return row ? this.toAssignment(row) : null;
    }
    // ============================================================
    // 🔥 CREATE
    // ============================================================
    async createAssignment(tenantId, jobId, clientUserId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO job_assignments (
        tenant_id,
        job_id,
        worker_id,
        client_user_id,
        agreed_rate,
        payment_type
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `, [
            tenantId,
            jobId,
            input.workerId,
            clientUserId,
            input.agreedRate,
            input.paymentType,
        ]);
        if (!row) {
            throw new Error('Failed to create assignment');
        }
        const assignment = this.toAssignment(row);
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.assignment.created',
            payload: { assignmentId: assignment.assignmentId, jobId },
        });
        return assignment;
    }
    // ============================================================
    // 🔥 UPDATE
    // ============================================================
    async updateAssignment(tenantId, assignmentId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE job_assignments
      SET
        status = COALESCE($3, status),
        updated_at = now()
      WHERE assignment_id = $2 AND tenant_id = $1
      RETURNING *
      `, [tenantId, assignmentId, input.status ?? null]);
        if (!row) {
            const e = new Error('Assignment not found');
            e.statusCode = 404;
            throw e;
        }
        const assignment = this.toAssignment(row);
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.assignment.updated',
            payload: { assignmentId },
        });
        return assignment;
    }
    // ============================================================
    // 🔥 LIST
    // ============================================================
    async listAssignments(tenantId, filters) {
        const { jobId, workerId, status, limit = 50, offset = 0 } = filters;
        const params = [tenantId];
        let idx = 2;
        const where = ['tenant_id = $1'];
        if (jobId) {
            where.push(`job_id = $${idx}`);
            params.push(jobId);
            idx++;
        }
        if (workerId) {
            where.push(`worker_id = $${idx}`);
            params.push(workerId);
            idx++;
        }
        if (status) {
            where.push(`status = $${idx}`);
            params.push(status);
            idx++;
        }
        const whereSQL = where.join(' AND ');
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT *
      FROM job_assignments
      WHERE ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limit, offset]);
        const count = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT COUNT(*) AS total FROM job_assignments WHERE ${whereSQL}`, params);
        return {
            assignments: rows.map(r => this.toAssignment(r)),
            total: count ? Number(count.total) : 0,
        };
    }
    // ============================================================
    // 🔥 MARK AS COMPLETED + PAGAMENTO + REVIEW UNIVERSAL
    // ============================================================
    async markAsCompleted(tenantId, assignmentId, reviewerUserId, reviewInput, options) {
        // 1) Marca como completed
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE job_assignments
      SET status = 'completed', updated_at = now()
      WHERE assignment_id = $2 AND tenant_id = $1
      RETURNING *
      `, [tenantId, assignmentId]);
        if (!row) {
            const e = new Error('Assignment not found');
            e.statusCode = 404;
            throw e;
        }
        let assignment = this.toAssignment(row);
        // ========================================================
        // 2) PAGAMENTO AUTOMÁTICO VIA ECONOMY (se houver valor)
        //    → usando accountService / transactionService EXISTENTES
        // ========================================================
        if (assignment.agreedRate > 0) {
            // 2.1) Descobre o userId do worker a partir do worker_id
            const workerRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT user_id
        FROM workers
        WHERE tenant_id = $1 AND worker_id = $2
        LIMIT 1
        `, [tenantId, assignment.workerId]);
            if (!workerRow) {
                const e = new Error('Worker not found for assignment');
                e.statusCode = 500;
                throw e;
            }
            const workerUserId = workerRow.user_id;
            const clientUserId = assignment.clientUserId;
            // 2.2) Conta do cliente (ownerType = 'user')
            const clientAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, clientUserId, 'user');
            const clientAccount = clientAccounts[0] ??
                (await account_service_1.accountService.createAccount(tenantId, {
                    ownerId: clientUserId,
                    ownerType: 'user',
                    currency: 'BRL',
                }));
            // 2.3) Conta do worker (ownerType = 'user', usando userId do worker)
            const workerAccounts = await account_service_1.accountService.getAccountsByOwner(tenantId, workerUserId, 'user');
            const workerAccount = workerAccounts[0] ??
                (await account_service_1.accountService.createAccount(tenantId, {
                    ownerId: workerUserId,
                    ownerType: 'user',
                    currency: 'BRL',
                }));
            // 2.4) Buscar ou criar conta do tenant (para splits)
            const tenantAccount = await account_service_1.accountService.getOrCreateSystemAccount(tenantId, 'platform_ops', 'BRL');
            // 2.5) Usar SplitEngine para dividir o pagamento
            // Determinar source baseado em options ou metadata do assignment
            const source = options?.source || assignment.metadata?.source || 'work';
            // Resolver regionAccountId e groupAccountIds
            const regionAccountId = await region_account_service_1.regionAccountService.resolveRegionAccountId({
                tenantId,
                userId: workerUserId, // Usar workerUserId como referência
                jobId: assignment.jobId,
            });
            const groupAccountIds = await group_account_service_1.groupAccountService.resolveGroupAccountIds({
                tenantId,
                userId: workerUserId, // Usar workerUserId (worker recebe o split de grupos)
            });
            // Log contexto de splits preparado
            console.log({
                tenantId,
                assignmentId: assignment.assignmentId,
                amount: assignment.agreedRate,
                hasRegionAccount: !!regionAccountId,
                groupAccountsCount: groupAccountIds.length,
                source: options?.source || 'work',
                'economy.action': 'prepare-split-context',
            }, 'Prepared split context for assignment completion');
            const splitContext = {
                tenantId,
                amount: assignment.agreedRate,
                currency: 'BRL',
                source,
                customerAccountId: clientAccount.accountId,
                workerAccountId: workerAccount.accountId,
                tenantAccountId: tenantAccount.accountId,
                regionAccountId,
                groupAccountIds,
                metadata: {
                    ...options?.metadata,
                    module: 'work',
                    type: 'work_assignment_payment',
                    assignmentId: assignment.assignmentId,
                    jobId: assignment.jobId,
                    workerId: assignment.workerId,
                    workerUserId,
                    clientUserId,
                    source,
                },
            };
            // Aplicar splits
            const splitResult = await split_service_1.splitEngineService.applySplits(splitContext);
            // 2.5.1) Log estruturado para transação WORK criada
            const regionSplit = splitResult.splits.find((s) => s.rule.targetType === 'REGION');
            let regionId;
            if (splitContext.regionAccountId) {
                try {
                    // Tentar obter regionId do tenant
                    const tenant = await (0, pool_1.runQueryWithTenant)(tenantId, 'SELECT city_id FROM tenants WHERE tenant_id = $1', [tenantId]);
                    // Por enquanto, usar 'unknown' - pode ser melhorado para buscar stateId
                    regionId = 'unknown';
                }
                catch {
                    regionId = 'unknown';
                }
            }
            if (regionSplit?.transactionId) {
                split_logger_service_1.splitLoggerService.logWorkTransaction({
                    timestamp: new Date().toISOString(),
                    module: 'work',
                    regionId,
                    amount: assignment.agreedRate,
                    transactionId: regionSplit.transactionId,
                    tenantId,
                    assignmentId: assignment.assignmentId,
                    jobId: assignment.jobId,
                    workerId: assignment.workerId,
                });
            }
            // 2.6) Atualizar assignment com payment_transaction_id do worker (split principal)
            // Buscar transactionId do split WORKER
            const workerSplit = splitResult.splits.find((s) => s.rule.targetType === 'WORKER');
            const mainTransactionId = workerSplit?.transactionId || null;
            if (mainTransactionId) {
                const updatedRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
          UPDATE job_assignments
          SET payment_transaction_id = $3, updated_at = now()
          WHERE tenant_id = $1 AND assignment_id = $2
          RETURNING *
          `, [tenantId, assignmentId, mainTransactionId]);
                if (updatedRow) {
                    assignment = this.toAssignment(updatedRow);
                }
            }
            // 2.7) Evento de pagamento concluído (com splits)
            await event_bus_1.eventBus.publish({
                tenantId,
                type: 'work.assignment.paid',
                payload: {
                    assignmentId: assignment.assignmentId,
                    jobId: assignment.jobId,
                    workerId: assignment.workerId,
                    workerUserId,
                    clientUserId,
                    paymentTransactionId: mainTransactionId,
                    amount: assignment.agreedRate,
                    splitResult: {
                        totalAmount: splitResult.totalAmount,
                        splits: splitResult.splits.map((s) => ({
                            targetType: s.rule.targetType,
                            amount: s.amount,
                            transactionId: s.transactionId || null,
                        })),
                    },
                },
            });
        }
        // ========================================================
        // 3) REVIEW UNIVERSAL VIA CORE/REVIEWS
        // ========================================================
        await review_service_1.reviewService.createReview(tenantId, reviewerUserId, 'work', {
            entityType: 'worker',
            entityId: assignment.workerId,
            rating: reviewInput.rating,
            comment: reviewInput.comment,
            qualityRating: reviewInput.qualityRating,
            punctualityRating: reviewInput.punctualityRating,
            professionalismRating: reviewInput.professionalismRating,
            context: {
                assignmentId: assignment.assignmentId,
                jobId: assignment.jobId,
                module: 'work',
            },
        });
        // core/reviews automaticamente:
        // - grava review
        // - emite core.review.created
        // - core/reputation recalcula score universal
        // ========================================================
        // 4) Evento Work: assignment completed
        // ========================================================
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.assignment.completed',
            payload: { assignmentId },
        });
        return assignment;
    }
}
exports.assignmentService = new AssignmentService();
