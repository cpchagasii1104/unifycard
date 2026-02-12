// backend/src/modules/work/jobs/job.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { reputationService } from '@core/reputation/reputation.service'; // ⭐ NOVO

import type {
  Job,
  JobRow,
  CreateJobInput,
  UpdateJobInput,
} from '../work.types';

class JobService {
  private toJob(row: JobRow): Job {
    return {
      jobId: row.job_id,
      tenantId: row.tenant_id,
      clientUserId: row.client_user_id,
      title: row.title,
      description: row.description ?? undefined,
      requiredSkills: row.required_skills ?? [],
      budgetMin: row.budget_min ? Number(row.budget_min) : undefined,
      budgetMax: row.budget_max ? Number(row.budget_max) : undefined,
      scheduledAt: row.scheduledAt ?? undefined,
      location: row.location ?? null,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ============================================================
  // 🔥 GET JOB BY ID + REPUTAÇÃO DO CLIENTE (opcional)
  // ============================================================
  async getById(tenantId: string, jobId: string) {
    const row = await runQueryWithTenant<JobRow>(
      tenantId,
      `SELECT * FROM jobs WHERE job_id = $1`,
      [jobId],
    );

    if (!row) return null;

    const job = this.toJob(row);

    // ⭐ REPUTAÇÃO DO CLIENTE (opcional, mas extremamente útil)
    job.clientReputation = await reputationService.getScore(
      tenantId,
      'user',
      job.clientUserId,
    );

    return job;
  }

  // ============================================================
  // 🔥 CREATE JOB + REPUTAÇÃO DO CLIENTE
  // ============================================================
  async createJob(
    tenantId: string,
    clientUserId: string,
    input: CreateJobInput,
  ): Promise<Job> {
    const params: any[] = [
      tenantId,
      clientUserId,
      input.title,
      input.description,
      input.requiredSkills,
      input.budgetMin ?? null,
      input.budgetMax ?? null,
      input.scheduledAt ?? null,
    ];

    let locationExpr = 'NULL';

    if (input.location) {
      params.push(input.location.longitude, input.location.latitude);
      locationExpr = `ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography`;
    }

    const row = await runQueryWithTenant<JobRow>(
      tenantId,
      `
      INSERT INTO jobs (
        tenant_id,
        client_user_id,
        title,
        description,
        required_skills,
        budget_min,
        budget_max,
        scheduledAt,
        location
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,${locationExpr})
      RETURNING *
      `,
      params,
    );

    if (!row) {
      throw new Error('Failed to create job');
    }

    const job = this.toJob(row);

    await eventBus.publish({
      tenantId,
      type: 'work.job.created',
      payload: { jobId: job.jobId },
    });

    // ⭐ REPUTAÇÃO DO CLIENTE
    job.clientReputation = await reputationService.getScore(
      tenantId,
      'user',
      clientUserId,
    );

    return job;
  }

  // ============================================================
  // 🔥 UPDATE JOB + REPUTAÇÃO DO CLIENTE
  // ============================================================
  async updateJob(
    tenantId: string,
    jobId: string,
    input: UpdateJobInput,
  ): Promise<Job> {
    const row = await runQueryWithTenant<JobRow>(
      tenantId,
      `
      UPDATE jobs
      SET
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        budget_min = COALESCE($5, budget_min),
        budget_max = COALESCE($6, budget_max),
        scheduledAt = COALESCE($7, scheduledAt),
        status = COALESCE($8, status),
        updatedAt = now()
      WHERE job_id = $2 AND tenant_id = $1
      RETURNING *
      `,
      [
        tenantId,
        jobId,
        input.title ?? null,
        input.description ?? null,
        input.budgetMin ?? null,
        input.budgetMax ?? null,
        input.scheduledAt ?? null,
        input.status ?? null,
      ],
    );

    if (!row) {
      const error = new Error('Job not found');
      (error as any).statusCode = 404;
      throw error;
    }

    const job = this.toJob(row);

    await eventBus.publish({
      tenantId,
      type: 'work.job.updated',
      payload: { jobId },
    });

    // ⭐ REPUTAÇÃO DO CLIENTE
    job.clientReputation = await reputationService.getScore(
      tenantId,
      'user',
      job.clientUserId,
    );

    return job;
  }

  // ============================================================
  // 🔥 LIST JOBS + REPUTAÇÃO
  // ============================================================
  async listJobs(
    tenantId: string,
    filters: any,
  ): Promise<{ jobs: Job[]; totalCents: number }> {
    const {
      search,
      status,
      requiredSkill,
      minBudget,
      maxBudget,
      lat,
      lng,
      radiusKm,
      limit = 20,
      offset = 0,
    } = filters;

    const params: any[] = [tenantId];
    let i = 2;

    const where: string[] = ['tenant_id = $1'];

    if (status) {
      where.push(`status = $${i}`);
      params.push(status);
      i++;
    }

    if (search) {
      where.push(`(title ILIKE $${i} OR description ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    if (requiredSkill) {
      where.push(`$${i} = ANY(required_skills)`);
      params.push(requiredSkill);
      i++;
    }

    if (minBudget !== undefined) {
      where.push(`budget_min >= $${i}`);
      params.push(minBudget);
      i++;
    }

    if (maxBudget !== undefined) {
      where.push(`budget_max <= $${i}`);
      params.push(maxBudget);
      i++;
    }

    if (lat && lng && radiusKm) {
      params.push(lng, lat, radiusKm);
      where.push(
        `ST_DWithin(location, ST_SetSRID(ST_MakePoint($${i},$${i+1}),4326)::geography, $${i+2} * 1000)`
      );
      i += 3;
    }

    const whereSQL = where.join(' AND ');

    const rows = await runQueriesWithTenant<JobRow>(
      tenantId,
      `
      SELECT * FROM jobs
      WHERE ${whereSQL}
      ORDER BY createdAt DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...params, limit, offset],
    );

    const totalRow = await runQueryWithTenant<{ totalCents: string }>(
      tenantId,
      `
      SELECT COUNT(*) AS total
      FROM jobs
      WHERE ${whereSQL}
      `,
      params,
    );

    const jobs = rows.map(r => this.toJob(r));

    // ⭐ CARREGAR REPUTAÇÃO DO CLIENTE PARA CADA JOB
    for (const job of jobs) {
      job.clientReputation = await reputationService.getScore(
        tenantId,
        'user',
        job.clientUserId,
      );
    }

    return {
      jobs,
      totalCents: totalRow ? Number(totalRow.total) : 0,
    };
  }
}

export const jobService = new JobService();



