// Financial Freeze Controller — congelamento de valores por conta. Somente escrita em financial_freezes e financial_alerts.
// Não altera bank_transactions, bank_ledger nem bank_accounts.

import type { FastifyPluginAsync } from 'fastify';
import {
  createFreeze,
  releaseFreeze,
  cancelFreeze,
  listActiveFreezesFiltered,
} from './financial-freeze-repository';
import { createFinancialAlert } from '@modules/alerts/financial-alert-repository';

const financialFreezeController: FastifyPluginAsync = async (app) => {
  // POST /financial/freezes
  app.post<{
    Body: {
      tenant_id: string;
      account_id: string;
      reference_id: string;
      amount_cents: number;
      reason?: string;
    };
  }>('/financial/freezes', async (req, reply) => {
    const { tenant_id, account_id, reference_id, amount_cents, reason } = req.body || {};
    if (!tenant_id || !account_id || !reference_id || amount_cents == null) {
      return reply.status(400).send({
        error: 'tenant_id, account_id, reference_id and amount_cents are required',
      });
    }
    try {
      const freeze = await createFreeze(tenant_id, {
        accountId: account_id,
        referenceId: reference_id,
        amountCents: Number(amount_cents),
        reason: reason ?? null,
      });
      await createFinancialAlert(tenant_id, {
        alertType: 'FINANCIAL_FREEZE_CREATED',
        referenceId: freeze.id,
        severity: 'warning',
        message: `Freeze criado: account=${account_id} amount=${amount_cents} (ref=${reference_id})`,
      });
      return reply.status(201).send(freeze);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to create freeze' });
    }
  });

  // GET /financial/freezes?tenant_id=&account_id=
  app.get<{
    Querystring: { tenant_id?: string; account_id?: string };
  }>('/financial/freezes', async (req, reply) => {
    const { tenant_id, account_id } = req.query;
    try {
      const freezes = await listActiveFreezesFiltered(tenant_id, account_id);
      return reply.send({ freezes });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to list freezes' });
    }
  });

  // PATCH /financial/freezes/:id/release
  app.patch<{
    Params: { id: string };
    Body: { tenant_id: string };
  }>('/financial/freezes/:id/release', async (req, reply) => {
    const { id } = req.params;
    const tenant_id = req.body?.tenant_id;
    if (!tenant_id) {
      return reply.status(400).send({ error: 'tenant_id is required' });
    }
    try {
      const freeze = await releaseFreeze(tenant_id, id);
      return reply.send(freeze);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to release freeze' });
    }
  });

  // PATCH /financial/freezes/:id/cancel
  app.patch<{
    Params: { id: string };
    Body: { tenant_id: string };
  }>('/financial/freezes/:id/cancel', async (req, reply) => {
    const { id } = req.params;
    const tenant_id = req.body?.tenant_id;
    if (!tenant_id) {
      return reply.status(400).send({ error: 'tenant_id is required' });
    }
    try {
      const freeze = await cancelFreeze(tenant_id, id);
      return reply.send(freeze);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to cancel freeze' });
    }
  });
};

export default financialFreezeController;