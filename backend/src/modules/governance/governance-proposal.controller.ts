// Governance Proposal Controller — POST/GET /internal/governance/proposals, POST .../proposals/:id/vote
// Não altera bank_transactions nem bank_ledger.

import type { FastifyPluginAsync } from 'fastify';
import {
  createProposal,
  voteProposal,
  listOpenProposals,
} from './governance-proposal-repository';

const governanceProposalController: FastifyPluginAsync = async (app) => {
  // POST /governance/proposals
  app.post<{
    Body: {
      tenant_id: string;
      proposal_type: string;
      reference_id?: string | null;
      payload?: Record<string, unknown>;
      voting_deadline: string;
    };
  }>('/governance/proposals', async (req, reply) => {
    const { tenant_id, proposal_type, reference_id, payload, voting_deadline } = req.body || {};
    if (!tenant_id || !proposal_type || !voting_deadline) {
      return reply.status(400).send({
        error: 'tenant_id, proposal_type and voting_deadline are required',
      });
    }
    const deadline = new Date(voting_deadline);
    if (isNaN(deadline.getTime())) {
      return reply.status(400).send({ error: 'voting_deadline must be a valid ISO date' });
    }
    try {
      const proposal = await createProposal(tenant_id, {
        proposalType: proposal_type,
        referenceId: reference_id ?? null,
        payload: payload ?? {},
        votingDeadline: deadline,
      });
      return reply.status(201).send(proposal);
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to create proposal' });
    }
  });

  // POST /governance/proposals/:id/vote
  app.post<{
    Params: { id: string };
    Body: { tenant_id: string; vote: 'for' | 'against' };
  }>('/governance/proposals/:id/vote', async (req, reply) => {
    const { id } = req.params;
    const { tenant_id, vote } = req.body || {};
    if (!tenant_id || !vote) {
      return reply.status(400).send({ error: 'tenant_id and vote (for|against) are required' });
    }
    if (vote !== 'for' && vote !== 'against') {
      return reply.status(400).send({ error: 'vote must be "for" or "against"' });
    }
    try {
      const proposal = await voteProposal(tenant_id, id, vote);
      return reply.send(proposal);
    } catch (err) {
      req.log.error(err);
      return reply.status(400).send({ error: 'Proposal not found or voting closed' });
    }
  });

  // GET /governance/proposals?tenant_id= (opcional)
  app.get<{ Querystring: { tenant_id?: string } }>('/governance/proposals', async (req, reply) => {
    const tenant_id = req.query.tenant_id;
    try {
      const proposals = await listOpenProposals(tenant_id);
      return reply.send({ proposals });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'Failed to list proposals' });
    }
  });
};

export default governanceProposalController;