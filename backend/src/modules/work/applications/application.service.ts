// backend/src/modules/work/applications/application.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { reputationService } from '@core/reputation/reputation.service'; // ⭐ NOVO

import type {
  JobApplication,
  JobApplicationRow,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '../work.types';

class ApplicationService {
  private toApplication(row: JobApplicationRow): JobApplication {
    return {
      applicationId: row.application_id,
      tenantId: row.tenant_id,
      jobId: row.job_id,
      workerId: row.worker_id,
      proposedRate: row.proposed_rate ? Number(row.proposed_rate) : 0,
      message: row.message ?? undefined,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ============================================================
  // 🔥 GET BY ID + REPUTAÇÃO
  // ============================================================
  async getById(tenantId: string, applicationId: string) {
    const row = await runQueryWithTenant<JobApplicationRow>(
      tenantId,
      `SELECT * FROM job_applications WHERE application_id = $1`,
      [applicationId],
    );

    if (!row) return null;

    const app = this.toApplication(row);

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL DO WORKER
    app.workerReputation = await reputationService.getScore(
      tenantId,
      'worker',
      app.workerId,
    );

    return app;
  }

  // ============================================================
  // 🔥 CREATE + REPUTAÇÃO
  // ============================================================
  async createApplication(
    tenantId: string,
    workerId: string,
    jobId: string,
    input: CreateApplicationInput,
  ): Promise<JobApplication> {
    const row = await runQueryWithTenant<JobApplicationRow>(
      tenantId,
      `
      INSERT INTO job_applications (
        tenant_id,
        job_id,
        worker_id,
        proposed_rate,
        message
      )
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [
        tenantId,
        jobId,
        workerId,
        input.proposedRate,
        input.message ?? null,
      ],
    );

    if (!row) {
      throw new Error('Failed to create application');
    }

    const application = this.toApplication(row);

    await eventBus.publish({
      tenantId,
      type: 'work.application.created',
      payload: { applicationId: application.applicationId, jobId, workerId },
    });

    // ⭐ REPUTAÇÃO DO WORKER QUE APLICOU
    application.workerReputation = await reputationService.getScore(
      tenantId,
      'worker',
      workerId,
    );

    return application;
  }

  // ============================================================
  // 🔥 UPDATE + REPUTAÇÃO
  // ============================================================
  async updateApplication(
    tenantId: string,
    applicationId: string,
    input: UpdateApplicationInput,
  ): Promise<JobApplication> {
    const row = await runQueryWithTenant<JobApplicationRow>(
      tenantId,
      `
      UPDATE job_applications
      SET
        status = COALESCE($3, status),
        updatedAt = now()
      WHERE application_id = $2 AND tenant_id = $1
      RETURNING *
      `,
      [tenantId, applicationId, input.status ?? null],
    );

    if (!row) {
      const err = new Error('Application not found');
      (err as any).statusCode = 404;
      throw err;
    }

    const application = this.toApplication(row);

    await eventBus.publish({
      tenantId,
      type: 'work.application.updated',
      payload: { applicationId },
    });

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
    application.workerReputation = await reputationService.getScore(
      tenantId,
      'worker',
      application.workerId,
    );

    return application;
  }

  // ============================================================
  // 🔥 LIST + REPUTAÇÃO EM MASSA
  // ============================================================
  async listApplications(
    tenantId: string,
    filters: any,
  ): Promise<{ applications: JobApplication[]; totalCents: number }> {
    const { jobId, workerId, status, limit = 50, offset = 0 } = filters;

    const params: any[] = [tenantId];
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

    const rows = await runQueriesWithTenant<JobApplicationRow>(
      tenantId,
      `
      SELECT *
      FROM job_applications
      WHERE ${whereSQL}
      ORDER BY createdAt DESC
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...params, limit, offset],
    );

    const count = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      `SELECT COUNT(*) AS total FROM job_applications WHERE ${whereSQL}`,
      params,
    );

    const applications = rows.map(r => this.toApplication(r));

    // ⭐ Adiciona reputação a cada aplicação
    for (const app of applications) {
      app.workerReputation = await reputationService.getScore(
        tenantId,
        'worker',
        app.workerId,
      );
    }

    return {
      applications,
      totalCents: count ? Number(count.total) : 0,
    };
  }
}

export const applicationService = new ApplicationService();



