// backend/src/modules/work/assignments/assignment.service.ts

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { reviewService } from '@core/reviews/review.service';
import { insertWorkEventOutbox } from '../work-event-outbox.helper';

import type {
  JobAssignmentRow,
  JobAssignment,
  CreateAssignmentInput,
  UpdateAssignmentInput,
} from '../work.types';

class AssignmentService {
  private toAssignment(row: JobAssignmentRow): JobAssignment {
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
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async getById(tenantId: string, assignmentId: string) {
    const row = await runQueryWithTenant<JobAssignmentRow>(
      tenantId,
      `SELECT * FROM job_assignments WHERE assignment_id = $1`,
      [assignmentId],
    );
    return row ? this.toAssignment(row) : null;
  }

  // ============================================================
  // 🔥 CREATE
  // ============================================================
  async createAssignment(
    tenantId: string,
    jobId: string,
    clientUserId: string,
    input: CreateAssignmentInput,
  ): Promise<JobAssignment> {
    const row = await runQueryWithTenant<JobAssignmentRow>(
      tenantId,
      `
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
      `,
      [
        tenantId,
        jobId,
        input.workerId,
        clientUserId,
        input.agreedRate,
        input.paymentType,
      ],
    );

    if (!row) {
      throw new Error('Failed to create assignment');
    }

    const assignment = this.toAssignment(row);

    await insertWorkEventOutbox(
      tenantId,
      'work.assignment.created',
      assignment.assignmentId,
      'assignment.service',
      { assignmentId: assignment.assignmentId, jobId }
    );

    return assignment;
  }

  // ============================================================
  // 🔥 UPDATE
  // ============================================================
  async updateAssignment(
    tenantId: string,
    assignmentId: string,
    input: UpdateAssignmentInput,
  ): Promise<JobAssignment> {
    const row = await runQueryWithTenant<JobAssignmentRow>(
      tenantId,
      `
      UPDATE job_assignments
      SET
        status = COALESCE($3, status),
        updated_at = now()
      WHERE assignment_id = $2 AND tenant_id = $1
      RETURNING *
      `,
      [tenantId, assignmentId, input.status ?? null],
    );

    if (!row) {
      const e = new Error('Assignment not found');
      (e as any).statusCode = 404;
      throw e;
    }

    const assignment = this.toAssignment(row);

    await insertWorkEventOutbox(
      tenantId,
      'work.assignment.updated',
      assignmentId,
      `assignment.service:${assignment.updatedAt}`,
      { assignmentId }
    );

    return assignment;
  }

  // ============================================================
  // 🔥 LIST
  // ============================================================
  async listAssignments(
    tenantId: string,
    filters: any,
  ): Promise<{ assignments: JobAssignment[]; totalCents: number }> {
    const { jobId, workerId, status, limit = 50, offset = 0 } = filters;

    const params: any[] = [tenantId];
    let idx = 2;
    const where: string[] = ['tenant_id = $1'];

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

    const rows = await runQueriesWithTenant<JobAssignmentRow>(
      tenantId,
      `
      SELECT *
      FROM job_assignments
      WHERE ${whereSQL}
      ORDER BY created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...params, limit, offset],
    );

    const countRow = await runQueryWithTenant<{ total: string }>(
      tenantId,
      `SELECT COUNT(*) AS total FROM job_assignments WHERE ${whereSQL}`,
      params,
    );

    return {
      assignments: rows.map(r => this.toAssignment(r)),
      totalCents: countRow ? Number(countRow.total) : 0,
    };
  }

  // ============================================================
  // 🔥 MARK AS COMPLETED + PAGAMENTO + REVIEW UNIVERSAL
  // ============================================================
  async markAsCompleted(
    tenantId: string,
    assignmentId: string,
    reviewerUserId: string,
    reviewInput: {
      rating?: number;
      comment?: string;
      qualityRating?: number;
      punctualityRating?: number;
      professionalismRating?: number;
    },
    options?: {
      source?: string; // 'work' | 'work_instant'
      metadata?: Record<string, any>;
    },
  ): Promise<JobAssignment> {
    // ========================================================
    // 🔴 GATE FINANCEIRO FAIL-CLOSED — ANTES DE QUALQUER MUTAÇÃO (F-BANK-SPLIT Fase 1A-R)
    //    DECISION-0165 D5/D8 (sistema virgem): assignment COM valor não pode ser concluído —
    //    pagamento de trabalho está FORA do MVP; o caminho antigo usava splitEngineService
    //    (TRUE-PARALLEL, movia via transfer SEM gravar bank_splits, split 70/15/10/5 fora do Bank).
    //    O gate roda ANTES do UPDATE de status / review / outbox: NENHUM meio-estado persistido.
    //    (markAsCompleted não é transacional — runQueryWithTenant é autocommit por query — logo o
    //    gate DEVE preceder a 1ª escrita, não vir depois.) Reabrir = pipeline canônico, com GO.
    // ========================================================
    // 0) Carregar sem mutar (SELECT), para validar existência e aplicar o gate ANTES de escrever.
    const existingRow = await runQueryWithTenant<JobAssignmentRow>(
      tenantId,
      `SELECT * FROM job_assignments WHERE assignment_id = $2 AND tenant_id = $1 LIMIT 1`,
      [tenantId, assignmentId],
    );

    if (!existingRow) {
      const e = new Error('Assignment not found');
      (e as any).statusCode = 404;
      throw e;
    }

    if (this.toAssignment(existingRow).agreedRate > 0) {
      const e = new Error(
        'WORK_ASSIGNMENT_PAYMENT_RETIRED: pagamento de assignment fora do MVP (DECISION-0165). ' +
          'Trabalho-com-dinheiro só reabre pelo pipeline canônico; complete apenas assignments sem valor.',
      );
      (e as any).statusCode = 501;
      throw e;
    }

    // 1) Marca como completed (só assignments SEM valor chegam aqui — o gate acima já barrou os pagos)
    const row = await runQueryWithTenant<JobAssignmentRow>(
      tenantId,
      `
      UPDATE job_assignments
      SET status = 'completed', updated_at = now()
      WHERE assignment_id = $2 AND tenant_id = $1
      RETURNING *
      `,
      [tenantId, assignmentId],
    );

    if (!row) {
      const e = new Error('Assignment not found');
      (e as any).statusCode = 404;
      throw e;
    }

    let assignment = this.toAssignment(row);

    // ========================================================
    // 3) REVIEW UNIVERSAL VIA CORE/REVIEWS
    // ========================================================
    await reviewService.createReview(tenantId, reviewerUserId, 'work', {
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
    await insertWorkEventOutbox(
      tenantId,
      'work.assignment.completed',
      assignmentId,
      `completed:${assignment.updatedAt}`,
      { assignmentId }
    );

    return assignment;
  }
}

export const assignmentService = new AssignmentService();



