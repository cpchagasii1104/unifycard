// backend/src/core/financial-approval/payout-approval-policy.service.ts
// F-PAYOUT-APPROVAL-POLICY-MATERIALIZATION — resolvedor MATERIAL de aprovação de payout (DECISION-0130).
//
// 🔒 CORE FINANCEIRO. Decide (não executa). Roda numa transação com advisory lock por (tenant, actor),
// resolve POLÍTICA + AUTORIDADE do operador financeiro institucional, aplica a faixa MVP (D4), as travas
// D7 (KYC/ATL/recovery/risco/destino) e o limite diário por actor, e — quando aprovado — grava o evento
// append-only (D9, também ledger do uso diário). NÃO move dinheiro, NÃO toca bank_*, NÃO chama executor/
// worker/bridge (o bridge é chamado pelo orquestrador do módulo payout, fora do Core). NÃO importa @modules.
//
// Autoridade (D1/D11): financial_approval_authorities.user_id (operador) — NUNCA company_users/
// tenant_operator_grants/organization_members/role/financial:execute_payout. availableBalanceCents (D8)
// NÃO entra aqui. Tudo server-side (tenantId/approverUserId vêm da rota, nunca do body).

import { getClientWithTenant } from '@core/database/pool';
import type { PoolClient } from 'pg';
import {
  PAYOUT_APPROVAL_SCOPE,
  PAYOUT_MVP_MAX_AMOUNT_CENTS,
  PAYOUT_MVP_DAILY_LIMIT_CENTS,
  type PayoutApprovalBlockCode,
} from './payout-approval-policy.constants';

export interface PayoutApprovalDecisionInput {
  tenantId: string;          // server-side
  approverUserId: string;    // req.user.id (server-side)
  payoutRequestId: string;
  approvalRequestId: string;
  actorId: string;
  requestedByUserId: string; // approval.requested_by_user_id (server-side)
  requestedAmountCents: number;
  destinationType: string;   // payout.destination_type (MVP: internal_settlement)
}

// `kind` é o discriminante string-literal (narrowing estável sob tsconfig.build `strict:false`).
export type PayoutApprovalDecision =
  | {
      kind: 'approved';
      approved: true;
      policyId: string;
      authorityId: string;
      eventId: string;
      dailyUsedCents: number;
      idempotent: boolean;
    }
  | { kind: 'blocked'; approved: false; httpStatus: number; code: PayoutApprovalBlockCode; reason: string };

interface Snapshots {
  kyc: { kyc_status: string | null; kyc_level: string | null };
  risk: { risk_level: string; risk_score: number } | null;
  recovery: { active_count: number; outstanding_cents: number };
}

async function recordEvent(
  client: PoolClient,
  p: {
    tenantId: string;
    policyId: string | null;
    authorityId: string | null;
    approvalRequestId: string;
    payoutRequestId: string;
    actorId: string;
    decision: 'approved' | 'blocked';
    approvedByUserId: string;
    requestedByUserId: string;
    amountCents: number;
    reason: string;
    snapshots: Snapshots;
    idempotencyKey: string | null;
  }
): Promise<string> {
  const r = await client.query<{ id: string }>(
    `INSERT INTO financial_approval_policy_events
       (tenant_id, policy_id, authority_id, approval_request_id, payout_request_id, actor_id,
        decision, approved_by_user_id, requested_by_user_id, amount_cents, reason,
        risk_snapshot, kyc_status_snapshot, recovery_snapshot, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15)
     RETURNING id`,
    [
      p.tenantId,
      p.policyId,
      p.authorityId,
      p.approvalRequestId,
      p.payoutRequestId,
      p.actorId,
      p.decision,
      p.approvedByUserId,
      p.requestedByUserId,
      p.amountCents,
      p.reason,
      JSON.stringify(p.snapshots.risk),
      JSON.stringify(p.snapshots.kyc),
      JSON.stringify(p.snapshots.recovery),
      p.idempotencyKey,
    ]
  );
  return r.rows[0]!.id;
}

class PayoutApprovalPolicyService {
  /**
   * Decide a aprovação material de um payout (DECISION-0130). NÃO move dinheiro, NÃO chama o bridge.
   * Em transação com advisory lock por (tenant, actor): idempotente; resolve policy+authority; aplica
   * faixa MVP + travas D7 + limite diário; grava evento append-only quando aprovado.
   */
  async decidePayoutApproval(input: PayoutApprovalDecisionInput): Promise<PayoutApprovalDecision> {
    const {
      tenantId,
      approverUserId,
      payoutRequestId,
      approvalRequestId,
      actorId,
      requestedByUserId,
      requestedAmountCents,
      destinationType,
    } = input;

    const block = (
      httpStatus: number,
      code: PayoutApprovalBlockCode,
      reason: string
    ): PayoutApprovalDecision => ({ kind: 'blocked', approved: false, httpStatus, code, reason });

    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      // Serializa o cômputo do limite diário por (tenant, actor) contra corrida.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [tenantId, actorId]);

      // Idempotência: já existe evento APROVADO para este payout? Retorna sem novo cômputo/duplo débito.
      const existing = await client.query<{ id: string; policy_id: string; authority_id: string }>(
        `SELECT id, policy_id, authority_id FROM financial_approval_policy_events
          WHERE tenant_id=$1 AND payout_request_id=$2 AND decision='approved' LIMIT 1`,
        [tenantId, payoutRequestId]
      );
      if (existing.rows[0]) {
        await client.query('COMMIT');
        return {
          kind: 'approved',
          approved: true,
          policyId: existing.rows[0].policy_id,
          authorityId: existing.rows[0].authority_id,
          eventId: existing.rows[0].id,
          dailyUsedCents: -1,
          idempotent: true,
        };
      }

      // D3 — segregação (defesa-em-profundidade; a rota já barra antes).
      if (requestedByUserId === approverUserId) {
        await client.query('ROLLBACK');
        return block(403, 'PAYOUT_APPROVER_CANNOT_BE_REQUESTER', 'requester cannot approve own payout (D3).');
      }

      // Política ativa (tenant, scope).
      const pol = await client.query<{
        id: string; max_amount_cents: string; daily_limit_cents: string; requires_second_approval: boolean;
      }>(
        `SELECT id, max_amount_cents, daily_limit_cents, requires_second_approval
           FROM financial_approval_policies
          WHERE tenant_id=$1 AND scope=$2 AND is_active AND revoked_at IS NULL LIMIT 1`,
        [tenantId, PAYOUT_APPROVAL_SCOPE]
      );
      if (!pol.rows[0]) {
        await client.query('ROLLBACK');
        return block(422, 'PAYOUT_APPROVAL_POLICY_NOT_CONFIGURED', 'no active payout approval policy for tenant/scope.');
      }

      // Autoridade ativa do APROVADOR (operador financeiro institucional).
      const auth = await client.query<{ id: string; max_amount_cents: string; daily_limit_cents: string }>(
        `SELECT id, max_amount_cents, daily_limit_cents
           FROM financial_approval_authorities
          WHERE tenant_id=$1 AND user_id=$2 AND scope=$3 AND is_active AND revoked_at IS NULL LIMIT 1`,
        [tenantId, approverUserId, PAYOUT_APPROVAL_SCOPE]
      );
      if (!auth.rows[0]) {
        await client.query('ROLLBACK');
        return block(403, 'PAYOUT_APPROVAL_AUTHORITY_NOT_FOUND', 'approver has no active financial approval authority.');
      }

      const policyId = pol.rows[0].id;
      const authorityId = auth.rows[0].id;
      const maxCap = Math.min(
        Number(pol.rows[0].max_amount_cents),
        Number(auth.rows[0].max_amount_cents),
        PAYOUT_MVP_MAX_AMOUNT_CENTS
      );
      const dailyCap = Math.min(
        Number(pol.rows[0].daily_limit_cents),
        Number(auth.rows[0].daily_limit_cents),
        PAYOUT_MVP_DAILY_LIMIT_CENTS
      );

      // Snapshots D7 (também viram auditoria do evento).
      const kycRow = await client.query<{ kyc_status: string; kyc_level: string }>(
        `SELECT i.kyc_status, i.kyc_level FROM actors a
           JOIN identities i ON i.global_user_id = a.global_user_id
          WHERE a.id=$1 AND a.tenant_id=$2 LIMIT 1`,
        [actorId, tenantId]
      );
      const atlRow = await client.query(
        `SELECT 1 FROM atl_blocked_actors WHERE tenant_id=$1 AND actor_id=$2 LIMIT 1`,
        [tenantId, actorId]
      );
      const recRow = await client.query<{ active_count: string; outstanding_cents: string }>(
        `SELECT COUNT(*)::text AS active_count,
                COALESCE(SUM(amount_cents - recovered_amount_cents),0)::text AS outstanding_cents
           FROM actor_wallet_recovery_obligations
          WHERE tenant_id=$1 AND debtor_actor_id=$2
            AND status IN ('pending_approval','approved','partially_recovered')`,
        [tenantId, actorId]
      );
      const riskRow = await client.query<{ risk_level: string; risk_score: number }>(
        `SELECT risk_level, risk_score FROM actor_risk_profile WHERE actor_id=$1 LIMIT 1`,
        [actorId]
      );

      const snapshots: Snapshots = {
        kyc: {
          kyc_status: kycRow.rows[0]?.kyc_status ?? null,
          kyc_level: kycRow.rows[0]?.kyc_level ?? null,
        },
        risk: riskRow.rows[0]
          ? { risk_level: riskRow.rows[0].risk_level, risk_score: Number(riskRow.rows[0].risk_score) }
          : null,
        recovery: {
          active_count: Number(recRow.rows[0]!.active_count),
          outstanding_cents: Number(recRow.rows[0]!.outstanding_cents),
        },
      };

      const blockWithAudit = async (
        httpStatus: number,
        code: PayoutApprovalBlockCode,
        reason: string
      ): Promise<PayoutApprovalDecision> => {
        await recordEvent(client, {
          tenantId, policyId, authorityId, approvalRequestId, payoutRequestId, actorId,
          decision: 'blocked', approvedByUserId: approverUserId, requestedByUserId,
          amountCents: requestedAmountCents, reason: `${code}: ${reason}`, snapshots, idempotencyKey: null,
        });
        await client.query('COMMIT');
        return block(httpStatus, code, reason);
      };

      // D4/D5 — faixa MVP e multi-approval.
      if (requestedAmountCents > PAYOUT_MVP_MAX_AMOUNT_CENTS) {
        return blockWithAudit(422, 'APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL',
          `amount ${requestedAmountCents} acima do teto MVP ${PAYOUT_MVP_MAX_AMOUNT_CENTS} — requer multi-aprovação (frente futura).`);
      }
      if (pol.rows[0].requires_second_approval) {
        return blockWithAudit(422, 'APPROVAL_POLICY_REQUIRES_MULTI_APPROVAL',
          'policy exige segunda aprovação (multi-approval = frente futura).');
      }
      if (requestedAmountCents > maxCap) {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_AMOUNT_EXCEEDS_POLICY',
          `amount ${requestedAmountCents} acima do cap da política/autoridade (${maxCap}).`);
      }

      // D7 — travas absolutas (vence a mais restritiva).
      if (destinationType !== 'internal_settlement') {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_BLOCKED_DESTINATION',
          `destino '${destinationType}' fora do MVP (apenas internal_settlement).`);
      }
      if (snapshots.kyc.kyc_status !== 'approved') {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_BLOCKED_KYC',
          `KYC não aprovado (status=${snapshots.kyc.kyc_status ?? 'ausente'}).`);
      }
      if ((atlRow.rowCount ?? 0) > 0) {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_BLOCKED_ATL', 'actor consta na ATL (lista de bloqueio).');
      }
      if (snapshots.recovery.active_count > 0) {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_BLOCKED_RECOVERY',
          `recovery obligation ativa (count=${snapshots.recovery.active_count}, outstanding=${snapshots.recovery.outstanding_cents}).`);
      }
      if (snapshots.risk && (snapshots.risk.risk_level === 'high' || snapshots.risk.risk_level === 'blocked')) {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_BLOCKED_RISK',
          `risco restritivo (risk_level=${snapshots.risk.risk_level}).`);
      }

      // D4 — limite diário por actor (apenas eventos 'approved' contam; advisory lock garante consistência).
      const usedRow = await client.query<{ used: string }>(
        `SELECT COALESCE(SUM(amount_cents),0)::text AS used
           FROM financial_approval_policy_events
          WHERE tenant_id=$1 AND actor_id=$2 AND decision='approved'
            AND created_at >= date_trunc('day', now())`,
        [tenantId, actorId]
      );
      const dailyUsedCents = Number(usedRow.rows[0]!.used);
      if (dailyUsedCents + requestedAmountCents > dailyCap) {
        return blockWithAudit(422, 'PAYOUT_APPROVAL_DAILY_LIMIT_EXCEEDED',
          `uso diário ${dailyUsedCents} + ${requestedAmountCents} excede o limite ${dailyCap}.`);
      }

      // ✅ APROVADO — grava evento append-only (idempotente por payout; ledger do uso diário).
      const eventId = await recordEvent(client, {
        tenantId, policyId, authorityId, approvalRequestId, payoutRequestId, actorId,
        decision: 'approved', approvedByUserId: approverUserId, requestedByUserId,
        amountCents: requestedAmountCents, reason: 'approved within MVP policy/authority/range',
        snapshots, idempotencyKey: `payout-approval:${payoutRequestId}`,
      });
      await client.query('COMMIT');
      return { kind: 'approved', approved: true, policyId, authorityId, eventId, dailyUsedCents, idempotent: false };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

export const payoutApprovalPolicyService = new PayoutApprovalPolicyService();
