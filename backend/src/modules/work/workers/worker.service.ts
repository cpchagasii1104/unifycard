// backend/src/modules/work/workers/worker.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { reputationService } from '@core/reputation/reputation.service'; // ⭐ IMPORTAÇÃO NOVA

import type {
  WorkerRow,
  Worker,
  CreateWorkerInput,
  UpdateWorkerInput,
} from '../work.types';

export interface ListWorkersOptions {
  skillId?: string;
  isActive?: boolean;
  minReputation?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  limit?: number;
  offset?: number;
}

export interface WorkersSearchResult {
  workers: Worker[];
  total: number;
}

class WorkerService {
  private toWorker(row: WorkerRow): Worker {
    return {
      workerId: row.worker_id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      bio: row.bio ?? undefined,
      hourlyRate: row.hourly_rate ? Number(row.hourly_rate) : undefined,
      availability: row.availability ?? {},
      reputationScore: row.reputation_score
        ? Number(row.reputation_score)
        : 0,
      totalJobsCompleted: row.total_jobs_completed,
      totalJobsCancelled: row.total_jobs_cancelled,
      noShowCount: row.no_show_count,
      totalEarnings: row.total_earnings ? Number(row.total_earnings) : 0,
      responseTimeAvgMinutes: row.response_time_avg_minutes ?? undefined,
      isActive: row.is_active,
      isVerified: row.is_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================
  // 🔥 GET WORKER BY ID + REPUTAÇÃO
  // ============================================================
  async getById(tenantId: string, workerId: string): Promise<Worker | null> {
    const row = await runQueryWithTenant<WorkerRow>(
      tenantId,
      `
      SELECT
        worker_id,
        tenant_id,
        user_id,
        bio,
        hourly_rate,
        location,
        availability,
        reputation_score,
        total_jobs_completed,
        total_jobs_cancelled,
        no_show_count,
        total_earnings,
        response_time_avg_minutes,
        is_active,
        is_verified,
        created_at,
        updated_at
      FROM workers
      WHERE worker_id = $1
      `,
      [workerId],
    );

    if (!row) return null;

    const worker = this.toWorker(row);

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
    worker.reputation = await reputationService.getScore(
      tenantId,
      'worker',
      workerId,
    );

    return worker;
  }

  // ============================================================
  // 🔥 GET WORKER BY USER + REPUTAÇÃO
  // ============================================================
  async getByUserId(
    tenantId: string,
    userId: string,
  ): Promise<Worker | null> {
    const row = await runQueryWithTenant<WorkerRow>(
      tenantId,
      `
      SELECT
        worker_id,
        tenant_id,
        user_id,
        bio,
        hourly_rate,
        location,
        availability,
        reputation_score,
        total_jobs_completed,
        total_jobs_cancelled,
        no_show_count,
        total_earnings,
        response_time_avg_minutes,
        is_active,
        is_verified,
        created_at,
        updated_at
      FROM workers
      WHERE user_id = $1
      `,
      [userId],
    );

    if (!row) return null;

    const worker = this.toWorker(row);

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
    worker.reputation = await reputationService.getScore(
      tenantId,
      'worker',
      worker.workerId,
    );

    return worker;
  }

  async createWorker(
    tenantId: string,
    userId: string,
    input: CreateWorkerInput,
  ): Promise<Worker> {
    const hasLocation = !!input.location;

    const params: any[] = [
      tenantId,
      userId,
      input.bio ?? null,
      input.hourlyRate ?? null,
      input.availability ?? {},
    ];

    let locationExpression = 'NULL';

    if (hasLocation && input.location) {
      params.push(input.location.longitude, input.location.latitude);
      locationExpression =
        'ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography';
    }

    const row = await runQueryWithTenant<WorkerRow>(
      tenantId,
      `
      INSERT INTO workers (
        tenant_id,
        user_id,
        bio,
        hourly_rate,
        availability,
        location
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        ${locationExpression}
      )
      RETURNING
        worker_id,
        tenant_id,
        user_id,
        bio,
        hourly_rate,
        location,
        availability,
        reputation_score,
        total_jobs_completed,
        total_jobs_cancelled,
        no_show_count,
        total_earnings,
        response_time_avg_minutes,
        is_active,
        is_verified,
        created_at,
        updated_at
      `,
      params,
    );

    if (!row) {
      throw new Error('Failed to create worker');
    }

    const worker = this.toWorker(row);

    await eventBus.publish({
      tenantId,
      type: 'work.worker.created',
      payload: {
        workerId: worker.workerId,
        userId: worker.userId,
      },
    });

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
    worker.reputation = await reputationService.getScore(
      tenantId,
      'worker',
      worker.workerId,
    );

    return worker;
  }

  async updateWorker(
    tenantId: string,
    workerId: string,
    input: UpdateWorkerInput,
  ): Promise<Worker> {
    const hasLocation = !!input.location;

    const params: any[] = [
      tenantId,
      workerId,
      input.bio ?? null,
      input.hourlyRate ?? null,
      input.availability ?? null,
      hasLocation && input.location ? input.location.longitude : null,
      hasLocation && input.location ? input.location.latitude : null,
      input.isActive ?? null,
    ];

    const row = await runQueryWithTenant<WorkerRow>(
      tenantId,
      `
      UPDATE workers
      SET
        bio = COALESCE($3, bio),
        hourly_rate = COALESCE($4, hourly_rate),
        availability = COALESCE($5, availability),
        location = CASE
          WHEN $6 IS NOT NULL AND $7 IS NOT NULL
            THEN ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography
          ELSE location
        END,
        is_active = COALESCE($8, is_active),
        updated_at = now()
      WHERE tenant_id = $1
        AND worker_id = $2
      RETURNING
        worker_id,
        tenant_id,
        user_id,
        bio,
        hourly_rate,
        location,
        availability,
        reputation_score,
        total_jobs_completed,
        total_jobs_cancelled,
        no_show_count,
        total_earnings,
        response_time_avg_minutes,
        is_active,
        is_verified,
        created_at,
        updated_at
      `,
      params,
    );

    if (!row) {
      const error = new Error('Worker not found');
      (error as any).statusCode = 404;
      throw error;
    }

    const worker = this.toWorker(row);

    await eventBus.publish({
      tenantId,
      type: 'work.worker.updated',
      payload: {
        workerId: worker.workerId,
      },
    });

    // ⭐ ADICIONA REPUTAÇÃO UNIVERSAL
    worker.reputation = await reputationService.getScore(
      tenantId,
      'worker',
      worker.workerId,
    );

    return worker;
  }

  // ============================================================
  // 🔥 LIST WORKERS + REPUTAÇÃO EM MASSA
  // ============================================================
  async listWorkers(
    tenantId: string,
    options: ListWorkersOptions = {},
  ): Promise<WorkersSearchResult> {
    const {
      skillId,
      isActive,
      minReputation,
      lat,
      lng,
      radiusKm,
      limit = 20,
      offset = 0,
    } = options;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    let baseQuery = `
      FROM workers w
    `;

    const whereClauses: string[] = ['w.tenant_id = $1'];

    if (isActive !== undefined) {
      whereClauses.push(`w.is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex += 1;
    }

    if (minReputation !== undefined) {
      whereClauses.push(`w.reputation_score >= $${paramIndex}`);
      params.push(minReputation);
      paramIndex += 1;
    }

    if (skillId) {
      baseQuery += `
        JOIN worker_skills ws
          ON ws.worker_id = w.worker_id
         AND ws.tenant_id = w.tenant_id
      `;
      whereClauses.push(`ws.skill_id = $${paramIndex}`);
      params.push(skillId);
      paramIndex += 1;
    }

    if (lat !== undefined && lng !== undefined && radiusKm !== undefined) {
      whereClauses.push(`
        w.location IS NOT NULL
        AND ST_DWithin(
          w.location,
          ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
          $${paramIndex + 2} * 1000
        )
      `);
      params.push(lng, lat, radiusKm);
      paramIndex += 3;
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const rows = await runQueriesWithTenant<WorkerRow>(
      tenantId,
      `
      SELECT
        w.worker_id,
        w.tenant_id,
        w.user_id,
        w.bio,
        w.hourly_rate,
        w.location,
        w.availability,
        w.reputation_score,
        w.total_jobs_completed,
        w.total_jobs_cancelled,
        w.no_show_count,
        w.total_earnings,
        w.response_time_avg_minutes,
        w.is_active,
        w.is_verified,
        w.created_at,
        w.updated_at
      ${baseQuery}
      ${whereSql}
      ORDER BY w.reputation_score DESC, w.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset],
    );

    const countRow = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `
      SELECT COUNT(*) AS total
      ${baseQuery}
      ${whereSql}
      `,
      params,
    );

    const total = countRow ? Number(countRow.total) : 0;

    const workers = rows.map((row) => this.toWorker(row));

    // ⭐ CARREGAR REPUTAÇÃO PARA CADA WORKER
    for (const w of workers) {
      w.reputation = await reputationService.getScore(
        tenantId,
        'worker',
        w.workerId,
      );
    }

    return { workers, total };
  }
}

export const workerService = new WorkerService();
