// Treasury Account Controller — POST/GET /internal/treasury/accounts
// Não altera bank_transactions nem bank_ledger. Apenas registra contas institucionais.

import type { FastifyPluginAsync } from 'fastify';
import {
  createTreasuryAccount,
  listTreasuryAccounts,
} from './treasury-account-repository';

const treasuryAccountController: FastifyPluginAsync = async (app) => {
  // POST /treasury/accounts
  app.post<{
    Body: {
      tenant_id: string;
      treasury_type: string;
      account_id: string;
      metadata?: Record<string, unknown>;
    };
  }>('/treasury/accounts', async (req, reply) => {
    const { tenant_id, treasury_type, account_id, metadata } = req.body || {};
    if (!tenant_id || !treasury_type || !account_id) {
      return reply.status(400).send({
        error: 'tenant_id, treasury_type and account_id are required',
      });
    }
    try {
      const account = await createTreasuryAccount(tenant_id, {
        treasuryType: treasury_type,
        accountId: account_id,
        metadata: metadata ?? {},
      });
      return reply.status(201).send(account);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to create treasury account' });
    }
  });

  // GET /treasury/accounts?tenant_id= (opcional)
  app.get<{ Querystring: { tenant_id?: string } }>('/treasury/accounts', async (req, reply) => {
    const tenant_id = req.query.tenant_id;
    try {
      const accounts = await listTreasuryAccounts(tenant_id);
      return reply.send({ accounts });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to list treasury accounts' });
    }
  });
};

export default treasuryAccountController;