// backend/src/core/companies/company-canonical.routes.ts
// Rotas para criação canônica de Company (Nascimento Canônico)
//
// 🔴 REGRAS PÉTREAS:
// - Endpoint único de criação de Company
// - Persistência somente de Company (state=CREATED)
// - Nenhuma criação automática de entidades derivadas
// - Nenhum rollback destrutivo
// - Emissão de um único evento: COMPANY_CREATED

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { companyCanonicalService } from './company-canonical.service';
import type { CreateCompanyCanonicalInput } from './company-canonical.service';

const createCompanySchema = z.object({
  legal_name: z.string().min(1).max(500),
  document_type: z.enum(['CPF', 'CNPJ']),
  document_number: z.string().min(1).max(20),
  country: z.string().length(2), // ISO-3166
});

const companyCanonicalRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /companies/canonical
   * Cria Company em estado CREATED (nascimento canônico)
   * 
   * 🔴 ÚNICA CONSEQUÊNCIA SISTÊMICA PERMITIDA:
   * - Company { state: CREATED }
   * - Evento COMPANY_CREATED
   * 
   * 🔴 PROIBIÇÕES ABSOLUTAS:
   * - NÃO cria Actor, Page, Service, Wallet, Card, ERP, CRM, Agenda
   * - NÃO exige verificação (KYC/KYB)
   * - NÃO ativa marketplace ou indexação
   * - NÃO cria integrações preparatórias
   * - NÃO registra listeners, handlers, filas, tópicos
   * - NÃO emite eventos além de COMPANY_CREATED
   */
  fastify.post<{ Body: CreateCompanyCanonicalInput }>(
    '/companies/canonical',
    {
      schema: {
        description: 'Cria Company em estado CREATED (nascimento canônico)',
        tags: ['companies'],
        body: {
          type: 'object',
          required: ['legal_name', 'document_type', 'document_number', 'country'],
          properties: {
            legal_name: { type: 'string', minLength: 1, maxLength: 500 },
            document_type: { type: 'string', enum: ['CPF', 'CNPJ'] },
            document_number: { type: 'string', minLength: 1, maxLength: 20 },
            country: { type: 'string', minLength: 2, maxLength: 2 },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      const tenantId = req.tenant.id;

      // Validar payload
      const parsed = createCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      try {
        // Criar Company (state=CREATED) + emitir COMPANY_CREATED
        const company = await companyCanonicalService.createCompany(tenantId, parsed.data);

        return reply.status(201).send({
          company: {
            company_id: company.company_id,
            tenant_id: company.tenant_id,
            legal_name: company.legal_name,
            document_type: company.document_type,
            document_number: company.document_number,
            country: company.country,
            state: company.state,
            createdAt: company.createdAt,
          },
        });
      } catch (error: any) {
        const statusCode = error.statusCode || 500;
        fastify.log.error({ err: error }, 'Erro ao criar Company');
        return reply.status(statusCode).send({
          error: error.message || 'Erro ao criar Company',
        });
      }
    }
  );
};

export default companyCanonicalRoutes;


