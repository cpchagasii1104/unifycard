// backend/src/modules/marketplace/contact.routes.ts
// SPRINT 0: CONTACTS / CLIENTES UNIFICADOS

import type { FastifyInstance } from 'fastify';
import { contactService } from './contact.service';
import type {
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
} from './contact.types';

const contactRoutes = async (fastify: FastifyInstance) => {
  /**
   * POST /contacts
   * Cria novo contato
   */
  fastify.post<{ Body: CreateContactInput }>('/contacts', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const contact = await contactService.createContact(
      tenantId,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.status(201).send({ contact });
  });

  /**
   * PATCH /contacts/:id
   * Atualiza contato
   */
  fastify.patch<{
    Params: { id: string };
    Body: UpdateContactInput;
  }>('/contacts/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;
    const actionContext = (req as any).actionContext;

    if (!actionContext?.actorId) {
      return reply.status(400).send({ error: 'actorId é obrigatório' });
    }

    const contact = await contactService.updateContact(
      tenantId,
      contactId,
      req.body,
      actionContext.actorId,
      actionContext.actingUserId
    );

    return reply.send({ contact });
  });

  /**
   * GET /contacts
   * Lista contatos
   */
  fastify.get<{
    Querystring: {
      type?: string;
      taxId?: string;
      email?: string;
      phone?: string;
      userId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    };
  }>('/contacts', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: ContactFilters = {};
    if (req.query.type) {
      filters.type = req.query.type as any;
    }
    if (req.query.taxId) {
      filters.taxId = req.query.taxId;
    }
    if (req.query.email) {
      filters.email = req.query.email;
    }
    if (req.query.phone) {
      filters.phone = req.query.phone;
    }
    if (req.query.userId) {
      filters.userId = req.query.userId;
    }
    if (req.query.search) {
      filters.search = req.query.search;
    }
    if (req.query.limit) {
      filters.limit = req.query.limit;
    }
    if (req.query.offset) {
      filters.offset = req.query.offset;
    }

    const contacts = await contactService.listContacts(tenantId, filters);

    return reply.send({ contacts });
  });

  /**
   * GET /contacts/:id
   * Busca contato por ID
   */
  fastify.get<{ Params: { id: string } }>('/contacts/:id', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;

    const contact = await contactService.getContactById(tenantId, contactId);

    if (!contact) {
      return reply.status(404).send({ error: 'Contato não encontrado' });
    }

    return reply.send({ contact });
  });

  /**
   * GET /contacts/search
   * Busca contatos por taxId, email ou phone
   */
  fastify.get<{
    Querystring: {
      taxId?: string;
      email?: string;
      phone?: string;
    };
  }>('/contacts/search', async (req, reply) => {
    const tenantId = req.tenant!.id;

    const filters: ContactFilters = {};
    if (req.query.taxId) {
      filters.taxId = req.query.taxId;
    }
    if (req.query.email) {
      filters.email = req.query.email;
    }
    if (req.query.phone) {
      filters.phone = req.query.phone;
    }

    const contacts = await contactService.listContacts(tenantId, filters);

    return reply.send({ contacts });
  });

  /**
   * POST /contacts/:id/kyc/validate
   * Valida KYC básico do contato
   */
  fastify.post<{ Params: { id: string } }>('/contacts/:id/kyc/validate', async (req, reply) => {
    const tenantId = req.tenant!.id;
    const contactId = req.params.id;

    const result = await contactService.validateKyc(tenantId, contactId);

    return reply.send(result);
  });
};

export default contactRoutes;

