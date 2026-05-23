// Financial Dispute Controller — registro e listagem de disputas. Somente escrita em financial_disputes e financial_alerts.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import type { FastifyPluginAsync } from 'fastify';
import {
  createDispute,
  listOpenDisputes,
  updateDisputeStatus,
} from './financial-dispute-repository';
import type { DisputeStatus } from './financial-dispute-repository';
import { createFinancialAlert } from '@modules/alerts/financial-alert-repository';

const financialDisputeController: FastifyPluginAsync = async (app) => {
  // POST /financial/disputes
  app.post<{
    Body: { tenant_id: string; reference_id: string; dispute_type: string; amount_cents: number };
  }>('/financial/disputes', async (req, reply) => {
    const { tenant_id, reference_id, dispute_type, amount_cents } = req.body || {};
    if (!tenant_id || !reference_id || !dispute_type || amount_cents == null) {
      return reply.status(400).send({
        error: 'tenant_id, reference_id, dispute_type and amount_cents are required',
      });
    }
    try {
      const dispute = await createDispute(tenant_id, {
        referenceId: reference_id,
        disputeType: dispute_type,
        amountCents: Number(amount_cents),
      });
      await createFinancialAlert(tenant_id, {
        alertType: 'FINANCIAL_DISPUTE_OPENED',
        referenceId: dispute.id,
        severity: 'warning',
        message: `Disputa aberta: ${dispute_type} (ref=${reference_id}, amount=${amount_cents})`,
      });
      return reply.status(201).send(dispute);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to create dispute' });
    }
  });

  // GET /financial/disputes?tenant_id= (opcional)
  app.get<{ Querystring: { tenant_id?: string } }>('/financial/disputes', async (req, reply) => {
    const tenant_id = req.query.tenant_id;
    try {
      const disputes = await listOpenDisputes(tenant_id);
      return reply.send({ disputes });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to list disputes' });
    }
  });

  // PATCH /financial/disputes/:id
  app.patch<{
    Params: { id: string };
    Body: { tenant_id: string; status: DisputeStatus };
  }>('/financial/disputes/:id', async (req, reply) => {
    const { id } = req.params;
    const { tenant_id, status } = req.body || {};
    if (!tenant_id || !status) {
      return reply.status(400).send({ error: 'tenant_id and status are required' });
    }
    const valid: DisputeStatus[] = ['opened', 'under_review', 'resolved', 'rejected'];
    if (!valid.includes(status)) {
      return reply.status(400).send({ error: 'status must be one of: ' + valid.join(', ') });
    }
    try {
      const dispute = await updateDisputeStatus(tenant_id, id, status);
      return reply.send(dispute);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to update dispute' });
    }
  });
};

export default financialDisputeController;