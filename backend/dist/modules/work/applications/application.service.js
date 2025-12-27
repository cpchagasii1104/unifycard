"use strict";
// backend/src/modules/work/applications/application.service.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationService = void 0;
const pool_1 = require("@core/database/pool");
const event_bus_1 = require("@core/events/event-bus");
const reputation_service_1 = require("@core/reputation/reputation.service"); // ⭐ NOVO
class ApplicationService {
    toApplication(row) {
        return {
            applicationId: row.application_id,
            tenantId: row.tenant_id,
            jobId: row.job_id,
            workerId: row.worker_id,
            proposedRate: row.proposed_rate ? Number(row.proposed_rate) : 0,
            message: row.message ?? undefined,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    // ============================================================
    // 🔥 GET BY ID + REPUTAÇÃO
    // ============================================================
    async getById(tenantId, applicationId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT * FROM job_applications WHERE application_id = $1`, [applicationId]);
        if (!row)
            return null;
        const app = this.toApplication(row);
        // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL DO WORKER
        app.workerReputation = await reputation_service_1.reputationService.getScore(tenantId, 'worker', app.workerId);
        return app;
    }
    // ============================================================
    // 🔥 CREATE + REPUTAÇÃO
    // ============================================================
    async createApplication(tenantId, workerId, jobId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO job_applications (
        tenant_id,
        job_id,
        worker_id,
        proposed_rate,
        message
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `, [
            tenantId,
            jobId,
            workerId,
            input.proposedRate,
            input.message ?? null,
        ]);
        if (!row) {
            throw new Error('Failed to create application');
        }
        const application = this.toApplication(row);
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.application.created',
            payload: { applicationId: application.applicationId, jobId, workerId },
        });
        // ⭐ REPUTAÇÃO DO WORKER QUE APLICOU
        application.workerReputation = await reputation_service_1.reputationService.getScore(tenantId, 'worker', workerId);
        return application;
    }
    // ============================================================
    // 🔥 UPDATE + REPUTAÇÃO
    // ============================================================
    async updateApplication(tenantId, applicationId, input) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE job_applications
      SET
        status = COALESCE($3, status),
        updated_at = now()
      WHERE application_id = $2 AND tenant_id = $1
      RETURNING *
      `, [tenantId, applicationId, input.status ?? null]);
        if (!row) {
            const err = new Error('Application not found');
            err.statusCode = 404;
            throw err;
        }
        const application = this.toApplication(row);
        await event_bus_1.eventBus.publish({
            tenantId,
            type: 'work.application.updated',
            payload: { applicationId },
        });
        // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
        application.workerReputation = await reputation_service_1.reputationService.getScore(tenantId, 'worker', application.workerId);
        return application;
    }
    // ============================================================
    // 🔥 LIST + REPUTAÇÃO EM MASSA
    // ============================================================
    async listApplications(tenantId, filters) {
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
      FROM job_applications
      WHERE ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
      `, [...params, limit, offset]);
        const count = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT COUNT(*) AS total FROM job_applications WHERE ${whereSQL}`, params);
        const applications = rows.map(r => this.toApplication(r));
        // ⭐ Adiciona reputação a cada aplicação
        for (const app of applications) {
            app.workerReputation = await reputation_service_1.reputationService.getScore(tenantId, 'worker', app.workerId);
        }
        return {
            applications,
            total: count ? Number(count.total) : 0,
        };
    }
}
exports.applicationService = new ApplicationService();
//# sourceMappingURL=application.service.js.map