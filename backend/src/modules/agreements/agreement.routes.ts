// backend/src/modules/agreements/agreement.routes.ts
// Rotas para Negociação Assistida e Registro de Acordos
// 🔴 BLINDAGEM: Nenhum booking/bundle/service-order sem acordo FINALIZED

import type { FastifyInstance } from 'fastify';
import { agreementService } from './agreement.service';
import type {
  CreateAgreementInput,
  UpdateAgreementInput,
  ProposeAgreementInput,
  AcceptAgreementInput,
  FinalizeAgreementInput,
} from './agreement.types';

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO (schema-ghost)
// ║ NORMA:   docs/01_normative/00_AGENT_PROTOCOL.md §2.3.2 (GATE antes de alterar tabela/SSOT)
// ║ NÃO:     religar estas rotas criando a tabela `agreements` por conta própria
// ║ EM VEZ:  GATE + decisão de produto + migration com RLS, nessa ordem — e só então o writer
// ╚════════════════════════════════════════════════════════════════
//
// 🔴 CONTENÇÃO 2026-08-05 — o substrato NÃO EXISTE e as rotas estavam VIVAS.
//
// Medido antes de conter:
//   · `agreements` (e qualquer tabela `%agreement%`) **não existe** no banco oficial;
//   · o módulo está REGISTRADO (`app.builder.ts:581`) — logo as 10 rotas respondiam de verdade;
//   · o repositório consulta `FROM agreements` / `INSERT INTO agreements` sem probe nenhum;
//   · não havia contenção: nenhum 501, nenhum `to_regclass`, nenhum guard.
// Efeito: **qualquer chamada devolvia 500 com o erro cru do Postgres (`42P01`) vazando para fora.**
//
// Alcance pela TELA é zero — `ContextualThreadView`, único host do painel de acordos, não é
// renderizado por ninguém, e as tabelas de thread contextual também não existem. Mas rota
// registrada é superfície: quem tiver o token alcança por HTTP direto, e 500 com detalhe interno
// é pior que 501 honesto.
//
// ⚠️ Isto NÃO decide o produto. O acordo assistido pode voltar — mas volta pela ordem desta casa:
// GATE, decisão, migration com RLS (`audit-tenant-table-born-with-rls`), leitor, e só então writer.
const AGREEMENTS_GHOST_BODY = {
  error: 'AGREEMENTS_SCHEMA_GHOST_CONTAINED',
  code: 'AGREEMENTS_SCHEMA_GHOST_CONTAINED',
  message:
    'Assisted agreements are disabled: the `agreements` substrate does not exist in the canonical ' +
    'schema. Every route here queried a missing table and surfaced a raw Postgres error (42P01) as ' +
    'a 500. Reopening requires a GATE, a product decision, and a migration that creates the table ' +
    'WITH RLS — in that order. No money is moved and no state is written.',
} as const;

const agreementRoutes = async (fastify: FastifyInstance) => {
  // Contenção na BORDA: recusa antes de qualquer handler tocar o service. Conter dentro do
  // service deixaria cada rota nova nascer descoberta; aqui, rota nova já nasce contida.
  fastify.addHook('onRequest', async (_req, reply) => {
    return reply.status(501).send(AGREEMENTS_GHOST_BODY);
  });

  /**
   * POST /agreements
   * Cria um novo Agreement Draft
   */
  fastify.post<{ Body: CreateAgreementInput }>('/agreements', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const userId = req.user?.id || '';

    const agreement = await agreementService.createAgreement(tenantId, userId, req.body);

    return reply.status(201).send({ agreement });
  });

  /**
   * GET /agreements/:agreementId
   * Busca agreement por ID
   */
  fastify.get<{ Params: { agreementId: string } }>(
    '/agreements/:agreementId',
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const agreement = await agreementService.getAgreement(tenantId, req.params.agreementId);

      return reply.send({ agreement });
    }
  );

  /**
   * GET /agreements
   * Lista agreements com filtros
   */
  fastify.get<{
    Querystring: {
      contextType?: string;
      contextId?: string;
      threadId?: string;
      requesterActorId?: string;
      providerActorId?: string;
      status?: string;
      limit?: number;
      offset?: number;
    };
  }>('/agreements', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const filters = {
      contextType: req.query.contextType as any,
      contextId: req.query.contextId,
      threadId: req.query.threadId,
      requesterActorId: req.query.requesterActorId,
      providerActorId: req.query.providerActorId,
      status: req.query.status as any,
      limit: req.query.limit,
      offset: req.query.offset,
    };

    const agreements = await agreementService.listAgreements(tenantId, filters);

    return reply.send({ agreements, totalCents: agreements.length });
  });

  /**
   * GET /agreements/context/:contextType/:contextId/finalized
   * Busca agreement finalizado por contexto
   * 🔴 BLINDAGEM: Usado para validar se pode criar booking/bundle/service-order
   */
  fastify.get<{
    Params: { contextType: string; contextId: string };
  }>('/agreements/context/:contextType/:contextId/finalized', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const agreement = await agreementService.getFinalizedAgreementByContext(
      tenantId,
      req.params.contextType,
      req.params.contextId
    );

    if (!agreement) {
      return reply.status(404).send({ error: 'Nenhum acordo finalizado encontrado' });
    }

    return reply.send({ agreement });
  });

  /**
   * PUT /agreements/:agreementId
   * Atualiza Agreement Draft
   */
  fastify.put<{ Params: { agreementId: string }; Body: UpdateAgreementInput }>(
    '/agreements/:agreementId',
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.updateAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/propose
   * Propõe acordo (muda status para PROPOSED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: ProposeAgreementInput }>(
    '/agreements/:agreementId/propose',
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.proposeAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/accept
   * Aceita acordo (muda status para ACCEPTED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: AcceptAgreementInput }>(
    '/agreements/:agreementId/accept',
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.acceptAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/:agreementId/finalize
   * Finaliza acordo (muda status para FINALIZED)
   */
  fastify.post<{ Params: { agreementId: string }; Body: FinalizeAgreementInput }>(
    '/agreements/:agreementId/finalize',
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'tenant required' });
      }
      const tenantId = req.tenant.id;
      const userId = req.user?.id || '';

      const agreement = await agreementService.finalizeAgreement(
        tenantId,
        userId,
        req.params.agreementId,
        req.body
      );

      return reply.send({ agreement });
    }
  );

  /**
   * POST /agreements/validate-closure
   * Valida se pode criar booking/bundle/service-order
   * 🔴 BLINDAGEM: Endpoint usado internamente para validação
   */
  fastify.post<{
    Body: {
      contextType: string;
      contextId: string;
      expectedPriceCents: number;
    };
  }>('/agreements/validate-closure', async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ error: 'tenant required' });
    }
    const tenantId = req.tenant.id;
    const validation = await agreementService.validateAgreementForClosure(
      tenantId,
      req.body.contextType,
      req.body.contextId,
      req.body.expectedPriceCents
    );

    return reply.send(validation);
  });
};

export default agreementRoutes;





