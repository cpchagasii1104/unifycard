// src/core/companies/companies.routes.ts
// Rotas para gerenciar empresas (PJ)

import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { companiesService } from './companies.service';
import { companyPublicationsService } from './company-publications.service';
import { companyValidationService } from './company-validation.service';
import type { CreateCompanyInput, UpdateCompanyInput } from './companies.types';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';

const createCompanySchema = z.object({
  cnpj: z.string().min(14).max(18),
  companyName: z.string().optional(),
  tradeName: z.string().optional(),
  address: z.object({
    cep: z.string().optional(),
    address: z.string().optional(),
    addressNumber: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  }).optional(),
  activity: z.object({
    mainActivityCode: z.string().optional(),
    mainActivityDescription: z.string().optional(),
    secondaryActivities: z.array(z.object({
      code: z.string(),
      description: z.string(),
    })).optional(),
  }).optional(),
  role: z.enum(['owner', 'admin', 'staff', 'contractor', 'member']),
  roleDescription: z.string().optional(),
  permissions: z.object({
    canManageCompany: z.boolean().optional(),
    canManageFinancial: z.boolean().optional(),
    canManageEmployees: z.boolean().optional(),
    canViewReports: z.boolean().optional(),
    canManageServices: z.boolean().optional(),
  }).optional(),
  isPrimary: z.boolean().optional(),
  fetchFromRevenue: z.boolean().optional(),
  businessCategory: z.enum(['product', 'service', 'industry', 'hub', 'hybrid']).optional(),
  serviceCategories: z.array(z.string()).optional(),
});

const updateCompanySchema = z.object({
  companyName: z.string().optional(),
  tradeName: z.string().optional(),
  registrationDate: z.string().optional(),
  address: z.object({
    cep: z.string().optional(),
    address: z.string().optional(),
    addressNumber: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  contact: z.object({
    phone: z.string().optional(),
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  }).optional(),
  activity: z.object({
    mainActivityCode: z.string().optional(),
    mainActivityDescription: z.string().optional(),
    secondaryActivities: z.array(z.object({
      code: z.string(),
      description: z.string(),
    })).optional(),
  }).optional(),
  status: z.enum(['active', 'inactive', 'suspended', 'closed']).optional(),
  metadata: z.record(z.any()).optional(),
});

// F-PJ-ACTIVATION-ROUTE-WRITE-PAIR: body da ativação operacional. SÓ o par canônico;
// businessType/businessCategory/serviceCategories/hybrid/metadata NÃO são aceitos aqui.
const operationalActivationSchema = z.object({
  companyTypeId: z.string().uuid(),
  conceptId: z.string().uuid(),
});

// F-PJ-PUBLICATION-OFFERING-WRITER: body de publish/retire. SÓ conceptId + source/intent opcionais;
// businessType/businessCategory/hybrid/metadata NÃO são aceitos.
const publishConceptSchema = z.object({
  conceptId: z.string().uuid(),
  source: z.string().max(64).optional(),
  intent: z.string().max(256).optional(),
});
const retireConceptSchema = z.object({
  source: z.string().max(64).optional(),
  intent: z.string().max(256).optional(),
}).optional();

// F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE: o PUT self-scoped do próprio vínculo
// é AUTOATENDIMENTO. ALLOWLIST EXPLÍCITA de campos não-autoritativos (não blacklist): qualquer
// campo fora dela — role, permissions(.*), isActive, isPrimary, memberStatus, aliases, objetos
// aninhados, chaves desconhecidas — é rejeitado de forma OBSERVÁVEL (403), nunca descartado em
// silêncio. Schema `.strict()` é o 2º anteparo (chaves extras → erro, não drop). Autoridade muda
// SÓ por writer administrativo gateado (PUT /members/:memberId; setConsolidatedInventoryPermission).
const SELF_EDITABLE_COMPANY_USER_FIELDS = ['roleDescription'] as const;
const selfUpdateCompanyUserSchema = z
  .object({
    roleDescription: z.string().max(256).optional(),
  })
  .strict();

const companiesRoutes: FastifyPluginAsync = async (fastify) => {
  // Registrar multipart para upload de arquivos
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });

  // Criar diretório de uploads se não existir
  const uploadsDir = path.join(process.cwd(), 'uploads', 'companies');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  /**
   * GET /companies
   * Lista todas as empresas do usuário
   */
  fastify.get('/', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      const companies = await companiesService.listCompanies(req.user.globalUserId, req.tenant?.id);
      return { companies };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar empresas');
        return reply.status(500).send({ 
          ok: false, 
          message: 'Erro ao listar empresas',
          error: error instanceof Error ? error.message : String(error)
        });
    }
  });

  /**
   * GET /companies/:companyId
   * Busca empresa específica
   */
  fastify.get<{ Params: { companyId: string } }>('/:companyId', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      const company = await companiesService.getCompanyById(req.params.companyId, req.user.globalUserId, req.tenant?.id);
      if (!company) {
        return reply.status(404).send({ ok: false, message: 'Empresa não encontrada' });
      }
      return reply.send({ ok: true, data: company });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar empresa');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar empresa',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /companies
   * Cria nova empresa
   */
  fastify.post('/', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      // 🔴 Normalizar CNPJ antes de validar schema (defensivo)
      const body = req.body as Record<string, any>;
      const normalizedBody = {
        ...body,
        cnpj: typeof body?.cnpj === 'string' ? body.cnpj.replace(/\D/g, '') : body?.cnpj,
      };
      
      const parsed = createCompanySchema.safeParse(normalizedBody);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: parsed.error.errors,
        });
      }

      const result = await companiesService.createCompany(req.user.globalUserId, parsed.data as CreateCompanyInput, req.tenant?.id);
      return reply.status(201).send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao criar empresa');
      const message = error instanceof Error ? error.message : 'Erro ao criar empresa';
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * GET /companies/:companyId/domains
   * Lista domínios ativos de uma empresa
   */
  fastify.get<{
    Params: { companyId: string };
  }>('/:companyId/domains', async (req, reply) => {
    const { companyId } = req.params;
    
    try {
      const domains = await companiesService.getCompanyDomains(companyId);
      return reply.send({ domains });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar domínios da empresa');
      const message = error instanceof Error ? error.message : 'Erro ao buscar domínios';
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * POST /companies/:companyId/domains
   * Atualiza domínios de uma empresa
   */
  fastify.post<{
    Params: { companyId: string };
    Body: {
      domains: Array<'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs'>;
    };
  }>('/:companyId/domains', async (req, reply) => {
    const { companyId } = req.params;
    const { domains } = req.body;
    
    if (!domains || domains.length === 0) {
      return reply.status(400).send({ error: 'Pelo menos um domínio deve ser selecionado' });
    }

    try {
      const updatedDomains = await companiesService.updateCompanyDomains(companyId, domains);
      return reply.send({ domains: updatedDomains });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao atualizar domínios da empresa');
      const message = error instanceof Error ? error.message : 'Erro ao atualizar domínios';
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * PUT /companies/:companyId
   * Atualiza empresa
   */
  fastify.put<{ Params: { companyId: string } }>('/:companyId', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      const parsed = updateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: parsed.error.errors,
        });
      }

      const company = await companiesService.updateCompany(
        req.params.companyId,
        req.user.globalUserId,
        parsed.data as UpdateCompanyInput,
        req.tenant?.id
      );
      return company;
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao atualizar empresa');
      const message = error instanceof Error ? error.message : 'Erro ao atualizar empresa';
      return reply.status(400).send({ error: message });
    }
  });

  /**
   * DELETE /companies/:companyId
   * Remove empresa (soft delete)
   */
  fastify.delete<{ Params: { companyId: string } }>('/:companyId', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    try {
      const deleted = await companiesService.deleteCompany(
        req.params.companyId,
        req.user.globalUserId,
        req.tenant?.id
      );
      if (!deleted) {
        return reply.status(404).send({ error: 'Empresa não encontrada' });
      }
      return reply.status(204).send();
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao remover empresa');
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Se for erro de validação (transações vinculadas), retornar 400 com mensagem clara
      if (errorMessage.includes('transação') || errorMessage.includes('histórico financeiro')) {
        return reply.status(400).send({ 
          ok: false, 
          message: errorMessage,
          error: errorMessage
        });
      }
      
      // Outros erros: retornar 500 com mensagem do erro
      return reply.status(500).send({ 
        ok: false, 
        message: errorMessage,
        error: errorMessage
      });
    }
  });

  /**
   * PUT /companies/:companyId/users/:companyUserId
   * AUTOATENDIMENTO do próprio vínculo (self-scoped). Só campos NÃO-autoritativos
   * (allowlist: roleDescription). Campos de autoridade (role/permissions/is_active/
   * is_primary/member_status) → 403 observável. Autoridade muda só por writer admin gateado.
   */
  fastify.put<{ Params: { companyId: string; companyUserId: string } }>(
    '/:companyId/users/:companyUserId',
    async (req, reply) => {
      if (!req.user?.globalUserId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      if (!req.tenant?.id) {
        return reply.status(401).send({ error: 'Tenant obrigatório' });
      }

      // ── ANTEPARO 1 (allowlist explícita, rejeição OBSERVÁVEL) ──────────────────────
      // Inspeciona as chaves CRUAS do body. Qualquer chave fora da allowlist self-editable
      // (role, permissions, isActive, isPrimary, memberStatus, can*, aliases, aninhados,
      // chaves desconhecidas) → 403. NÃO confia no zod para descartar: rejeita por chave.
      const rawBody = (req.body ?? {}) as Record<string, unknown>;
      const allowed = new Set<string>(SELF_EDITABLE_COMPANY_USER_FIELDS);
      const disallowedKeys = Object.keys(rawBody).filter((k) => !allowed.has(k));
      if (disallowedKeys.length > 0) {
        return reply.status(403).send({
          error: 'Autoatendimento não pode alterar autoridade/estrutura do vínculo. Use o writer administrativo (PUT /members/:memberId).',
          code: 'COMPANY_USER_SELF_UPDATE_FIELD_FORBIDDEN',
          forbiddenFields: disallowedKeys,
          allowedFields: [...SELF_EDITABLE_COMPANY_USER_FIELDS],
        });
      }

      // ── ANTEPARO 2 (schema estrito: tipo + chaves extras → erro, não drop) ─────────
      const parsed = selfUpdateCompanyUserSchema.safeParse(rawBody);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Dados inválidos',
          details: parsed.error.errors,
        });
      }

      try {
        const companyUser = await companiesService.selfUpdateCompanyUser(
          req.params.companyUserId,
          req.user.globalUserId,
          parsed.data,
          req.tenant.id
        );
        return companyUser;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404) {
          return reply.status(404).send({ error: (error as Error).message });
        }
        fastify.log.error({ err: error }, 'Erro ao atualizar relacionamento');
        const message = error instanceof Error ? error.message : 'Erro ao atualizar relacionamento';
        return reply.status(400).send({ ok: false, message });
      }
    }
  );

  /**
   * PUT /companies/:companyId/users/:companyUserId/consolidated-inventory-permission
   * Concede/remove can_view_consolidated_inventory de um membro (DECISION-0116 adendo).
   * Gate server-side: SÓ quem canManageCompany na empresa-alvo. O PUT genérico de membro
   * (acima) é self-scoped e NÃO recebe este campo — auto-concessão é vedada por desenho.
   */
  fastify.put<{ Params: { companyId: string; companyUserId: string } }>(
    '/:companyId/users/:companyUserId/consolidated-inventory-permission',
    async (req, reply) => {
      if (!req.user?.globalUserId) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }
      if (!req.tenant?.id) {
        return reply.status(401).send({ error: 'Tenant obrigatório' });
      }

      const body = req.body as { canViewConsolidatedInventory?: unknown } | null;
      if (!body || typeof body.canViewConsolidatedInventory !== 'boolean') {
        return reply.status(400).send({ error: 'canViewConsolidatedInventory (boolean) é obrigatório' });
      }

      try {
        const result = await companiesService.setConsolidatedInventoryPermission(
          req.tenant.id,
          req.params.companyId,
          req.user.globalUserId,
          req.params.companyUserId,
          body.canViewConsolidatedInventory
        );
        return result;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 403 || statusCode === 404) {
          return reply.status(statusCode).send({ error: (error as Error).message });
        }
        fastify.log.error({ err: error }, 'Erro ao definir permissão de consolidado');
        return reply.status(400).send({ error: error instanceof Error ? error.message : 'Erro ao definir permissão' });
      }
    }
  );

  /**
   * POST /companies/fetch-cnpj
   * Busca dados do CNPJ na Receita Federal (endpoint auxiliar)
   */
  fastify.post<{ Body: { cnpj: string } }>('/fetch-cnpj', async (req, reply) => {
    try {
      const { cnpj } = req.body;
      if (!cnpj) {
        return reply.status(400).send({ ok: false, message: 'CNPJ é obrigatório' });
      }

      fastify.log.info({ cnpj }, 'Buscando CNPJ na Receita Federal');
      const data = await companiesService.fetchCNPJFromRevenue(cnpj);
      if (!data) {
        fastify.log.warn({ cnpj }, 'CNPJ não encontrado na Receita Federal (não bloqueante)');
        // 🔴 Retornar mensagem neutra, não erro bloqueante
        return reply.send({ 
          ok: false, 
          message: 'Não foi possível buscar dados da Receita Federal no momento. Você pode preencher os dados manualmente.',
          data: null
        });
      }

      fastify.log.info({ cnpj, razao_social: data.razao_social }, 'CNPJ encontrado com sucesso');
      return reply.send({ ok: true, data });
    } catch (error) {
      fastify.log.error({ err: error, cnpj: req.body?.cnpj }, 'Erro ao buscar CNPJ');
      const message = error instanceof Error ? error.message : 'Erro ao buscar dados da Receita Federal. Tente novamente mais tarde.';
      return reply.status(500).send({ 
        ok: false, 
        message,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /companies/:companyId/documents
   * Upload documento da empresa (PDF)
   */
  fastify.post<{ Params: { companyId: string } }>('/:companyId/documents', async (req, reply) => {
    // F-PJ-LEGACY-DOC-UPLOAD-TOMBSTONE (DECISION-0087): upload legado DESATIVADO fail-closed.
    // O SSOT documental KYB é `fiscal_identity_documents`; este endpoint gravava em `company_documents`
    // (tabela FANTASMA — não existe no schema vivo nem há migration que a crie) e promovia `company_status`
    // — caminho não-SSOT que só produzia erro de runtime. Retorna 501 honesto ANTES de ler o arquivo /
    // tocar o disco / chamar o service: NÃO grava documento, NÃO promove lifecycle, NÃO aprova KYB.
    // Documentos KYB usam o fluxo canônico de fiscal identity documents (frente própria de writer/UX).
    return reply.status(501).send({
      ok: false,
      error: 'PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED',
      code: 'PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED',
      message:
        'Upload legado de documento de empresa desativado (DECISION-0087). Documentos KYB serão enviados ' +
        'pelo fluxo documental fiscal (fiscal identity documents). Nenhum documento foi gravado e o status ' +
        'da empresa não foi alterado.',
      decision: 'DECISION-0087',
    });
  });

  /**
   * POST /companies/:companyId/kyb/documents   (F-PJ-KYB-DOCUMENTS-USER-SUBMIT, DECISION-0112 §10 A4)
   * Submissão documental KYB USER-FACING. Autoria AUTH-DERIVED (req.user.userId → ensureUserActor;
   * NÃO actionContext.actorId/body — spoofável); autoridade = canManageCompany (posse de companyId não
   * basta). Fluxo: multipart→buffer → validate(MIME+magic) → MalwareScanPort(clean-only) →
   * DocumentStoragePort(privado) → submitFiscalIdentityDocument. NÃO toca company_status/kyb_status/Bank.
   * documentType vem por querystring (?documentType=) ou campo multipart.
   */
  fastify.post<{ Params: { companyId: string }; Querystring: { documentType?: string } }>(
    '/:companyId/kyb/documents',
    async (req, reply) => {
      if (!req.user?.globalUserId || !req.user?.userId) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      if (!req.tenant?.id) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }
      const companyId = req.params.companyId;
      if (!z.string().uuid().safeParse(companyId).success) {
        return reply.status(400).send({ ok: false, code: 'INVALID_COMPANY_ID', message: 'companyId inválido' });
      }
      try {
        const data = await req.file();
        if (!data) {
          return reply.status(400).send({ ok: false, code: 'KYB_DOC_FILE_REQUIRED', message: 'Arquivo é obrigatório (multipart).' });
        }
        const buffer = await data.toBuffer();
        const documentType = (
          req.query?.documentType ?? (data.fields as Record<string, { value?: string }> | undefined)?.documentType?.value ?? ''
        ).toString();

        const { submitKybDocument } = await import('../kyb-documents/kyb-document-submit.service');
        const result = await submitKybDocument({
          tenantId: req.tenant.id,
          companyId,
          globalUserId: req.user.globalUserId,
          userId: req.user.userId,
          documentType,
          buffer,
          mimeType: data.mimetype,
          originalFilename: data.filename,
        });
        return reply.status(201).send({ ok: true, data: result });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
        const code = (error as { code?: string }).code;
        const message = error instanceof Error ? error.message : 'Erro ao submeter documento KYB';
        if (statusCode >= 500) fastify.log.error({ err: error, companyId }, 'Erro no submit KYB documento');
        return reply.status(statusCode).send({ ok: false, code, message });
      }
    },
  );

  /**
   * GET /companies/:companyId/documents
   * Lista documentos da empresa
   */
  fastify.get<{ Params: { companyId: string } }>('/:companyId/documents', async (_req, reply) => {
    // F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): reader legado DESATIVADO fail-closed.
    // Lia de `company_documents` (tabela FANTASMA, inexistente no schema vivo) — dead-on-arrival.
    // O SSOT documental KYB é `fiscal_identity_documents` (rotas /identity/pj/kyb/*). NÃO reabrir o legado.
    return reply.status(501).send({
      ok: false,
      error: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      code: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      message:
        'Listagem legada de documentos de empresa desativada (DECISION-0087). O SSOT documental KYB é ' +
        'fiscal_identity_documents. A UI canônica de documentos depende do provider de storage (fatia própria).',
      decision: 'DECISION-0087',
    });
  });

  /**
   * GET /companies/:companyId/documents/:documentId/file
   * Serve arquivo do documento (PDF)
   * 🔴 SEGURANÇA: Protegido por auth, valida companyId do usuário logado
   */
  fastify.get<{ Params: { companyId: string; documentId: string } }>(
    '/:companyId/documents/:documentId/file',
    async (_req, reply) => {
      // F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): file-server legado DESATIVADO. Servia arquivo
      // de `uploads/companies/` indexado por `company_documents` (FANTASMA) — dead-on-arrival. O SSOT
      // documental é `fiscal_identity_documents` (file_reference OPACO); download protegido = fatia de storage.
      return reply.status(501).send({
        ok: false,
        error: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
        code: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
        message:
          'Download legado de documento de empresa desativado (DECISION-0087). Documentos KYB usam ' +
          'fiscal_identity_documents; download protegido depende do provider de storage (fatia própria).',
        decision: 'DECISION-0087',
      });
    }
  );

  /**
   * GET /companies/admin/documents/pending
   * Lista documentos pendentes (ADMIN)
   */
  fastify.get('/admin/documents/pending', {
    preHandler: [fastify.requireRole(['admin', 'owner'])],
  }, async (_req, reply) => {
    // F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): backoffice legado DESATIVADO. Lia
    // `company_documents` (FANTASMA) — dead-on-arrival. A revisão documental canônica é admin via
    // /identity/pj/kyb/* sobre `fiscal_identity_documents` (gate KYB já exige docs mínimos aceitos).
    return reply.status(501).send({
      ok: false,
      error: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      code: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      message:
        'Backoffice legado de documentos de empresa desativado (DECISION-0087). Revisão documental KYB ' +
        'canônica = /identity/pj/kyb/* sobre fiscal_identity_documents (admin). UI depende do provider de storage.',
      decision: 'DECISION-0087',
    });
  });

  /**
   * PATCH /companies/admin/documents/:documentId/status
   * Aprova ou rejeita documento (ADMIN)
   */
  fastify.patch<{ 
    Params: { documentId: string };
    Body: { status: 'approved' | 'rejected'; rejectedReason?: string };
  }>('/admin/documents/:documentId/status', {
    preHandler: [fastify.requireRole(['admin', 'owner'])],
  }, async (_req, reply) => {
    // F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): review/approve legado DESATIVADO. Operava sobre
    // `company_documents` (FANTASMA) — dead-on-arrival — e carregava o anti-padrão "aprovar documento =
    // empresa validada" (já neutralizado por 0090). Revisão documental canônica = PATCH
    // /identity/pj/kyb/documents/:id/review sobre `fiscal_identity_documents`; aprovação KYB tem writer
    // próprio (fiscal-identity-kyb) com gate de docs mínimos. Upload/review NÃO mexem company_status/kyb_status aqui.
    return reply.status(501).send({
      ok: false,
      error: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      code: 'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED',
      message:
        'Revisão legada de documento de empresa desativada (DECISION-0087). Use o fluxo documental fiscal ' +
        'canônico (/identity/pj/kyb/documents/:id/review sobre fiscal_identity_documents). Aprovar documento ' +
        'NÃO verifica a empresa; aprovação KYB tem writer próprio com gate documental.',
      decision: 'DECISION-0087',
    });
  });

  /**
   * POST /companies/:companyId/admin/override-verified
   * ADMIN OVERRIDE: Marca empresa como VERIFIED (apenas para testes internos)
   * ⚠️ ATENÇÃO: Esta rota é apenas para testes. Não deve ser usada em produção sem auditoria adequada.
   * 
   * ═══════════════════════════════════════════════════════════════
   * ESCOPO DE DECISÃO (SPRINT 32)
   * ═══════════════════════════════════════════════════════════════
   * Decisões relacionadas a esta exceção (admin override)
   * devem declarar seu escopo em:
   * INSTITUTIONAL_DECISION_SCOPE.md
   * ═══════════════════════════════════════════════════════════════
   */
  fastify.post<{ 
    Params: { companyId: string };
  }>('/:companyId/admin/override-verified', {
    preHandler: [fastify.requireRole(['admin', 'owner'])],
  }, async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    // DECISION-0090 Fase 2.2: override legado de verificação PJ DESABILITADO. Não escreve
    // company_status='VERIFIED'/is_verified/verifiedAt. Verificação fiscal tem fonte única
    // (fiscal_identities.kyb_status) e writer KYB auditado. Endpoint mantido por compatibilidade.
    fastify.log.warn({
      companyId: req.params.companyId,
      adminGlobalUserId: req.user.globalUserId,
    }, 'Override legado de verificação PJ recusado (DECISION-0090 Fase 2.2)');

    return reply.status(501).send({
      ok: false,
      code: 'PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED',
      message: 'Override legado de verificação PJ desabilitado. Use o fluxo KYB auditado.',
    });
  });

  /**
   * POST /companies/:companyId/request-validation
   * Solicita validação presencial e gera QR Code
   * FASE 12: Validação Presencial com QR + Funcionário Auditável
   */
  fastify.post<{
    Params: { companyId: string };
  }>('/:companyId/request-validation', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // DECISION-0096: requestValidation está reservado/desabilitado (HttpError 501). NÃO capturar
    // o erro aqui — deixá-lo propagar ao error-handler global preserva o status 501 + code canônico
    // (`PJ_PRESENTIAL_VALIDATION_RESERVED`). O catch antigo mascarava o 501 como HTTP 400.
    const validationRequest = await companyValidationService.requestValidation(
      req.tenant.id,
      req.params.companyId
    );

    return reply.send(validationRequest);
  });

  /**
   * POST /companies/validate/in-person
   * Valida empresa presencialmente (funcionário parceiro)
   * FASE 12: Validação Presencial com QR + Funcionário Auditável
   */
  fastify.post<{
    Body: {
      company_id: string;
      validation_token: string;
      employee_id: string;
      partner_id?: string;
      geo?: { lat: number; lng: number };
      device_fingerprint?: string;
      metadata?: Record<string, any>;
    };
  }>('/validate/in-person', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // DECISION-0096/0091: validateInPerson é tombstone (HttpError 501
    // `PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED`). NÃO capturar — deixar propagar ao error-handler
    // global preserva o status 501 original. O catch antigo rebaixava o 501 para HTTP 400.
    const validation = await companyValidationService.validateInPerson(
      req.tenant.id,
      {
        company_id: req.body.company_id,
        validation_token: req.body.validation_token,
        employee_id: req.body.employee_id,
        partner_id: req.body.partner_id,
        geo: req.body.geo,
        device_fingerprint: req.body.device_fingerprint,
        metadata: req.body.metadata,
      }
    );

    return reply.send(validation);
  });

  // DECISION-0096 / Presential UX 2 (higiene): rota `GET /companies/:id/validation-history`
  // REMOVIDA — lia o vestígio `company_validations` (0 linhas, sem writer vivo) e estava órfã
  // (sem caller frontend após a remoção da UX presencial). Auditoria de evidência presencial é
  // greenfield futuro (DT-PJ-FASE12-QR-KYB-EVIDENCE-DESIGN-MISSING). As rotas request-validation
  // e validate/in-person seguem montadas, retornando 501 honesto.

  /**
   * GET /companies/audit/alerts
   * Busca alertas de auditoria não resolvidos
   * FASE 13: Auditoria & Alertas Anti-Abuso
   */
  fastify.get<{
    Querystring: {
      severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      limit?: string;
    };
  }>('/audit/alerts', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      const auditModule = await import('@core/audit/audit.service');
      const severityParam = req.query.severity as string | undefined;
      const severity = severityParam ? (severityParam.toLowerCase() as 'low' | 'medium' | 'high' | 'critical') : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;

      const alerts = await auditModule.auditService.getUnresolvedAlerts(
        req.tenant.id,
        severity,
        limit
      );

      return reply.send({ alerts });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar alertas de auditoria');
      return reply.status(500).send({
        error: 'Erro ao buscar alertas de auditoria',
      });
    }
  });

  // ============================================================
  // FRENTE B (2026-05-25): fluxo submissão→análise→decisão estruturado
  //   Tabela: company_validation_requests (migration 20260530552000)
  //   Service: submitForValidation / reviewCompanyValidation / getValidationQueue
  //   Convergência sobre padrão de modules/disputes/financial-dispute-repository.ts
  // ============================================================

  /**
   * POST /companies/:companyId/submit-validation
   * Cria pedido de validação (status='pending') para uma empresa PROVISIONAL.
   *
   * Evolução prevista: liberar submit para manager/merchant + gate contextual
   * company_users.role='owner' AND company_id=alvo. requireRole resolve autoridade
   * SISTÊMICA no tenant, NÃO autoridade sobre ESTE recurso — autoridade contextual
   * por empresa vive em company_users, não em roles.name. Não promover 'owner'
   * para role global sem decisão arquitetural.
   */
  fastify.post<{
    Params: { companyId: string };
    Body: { notes?: string };
  }>('/:companyId/submit-validation', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      const result = await companiesService.submitForValidation(
        req.params.companyId,
        req.tenant.id,
        req.user.id,
        req.body?.notes
      );
      fastify.log.info({
        requestId: result.id,
        companyId: result.companyId,
        submittedByUserId: result.submittedByUserId,
      }, '📝 Frente B: pedido de validação criado');
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao submeter empresa para validação');
      const message = error instanceof Error ? error.message : 'Erro ao submeter empresa para validação';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * GET /companies/admin/validation-queue
   * Lista pedidos de validação do tenant; query.status opcional filtra por estado.
   */
  fastify.get<{
    Querystring: { status?: string };
  }>('/admin/validation-queue', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }
    try {
      const queue = await companiesService.getValidationQueue(req.tenant.id, req.query.status);
      return reply.send({ ok: true, data: queue });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar fila de validação');
      const message = error instanceof Error ? error.message : 'Erro ao listar fila de validação';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * PATCH /companies/admin/validation-requests/:requestId/review
   * Admin decide pending → approved/rejected. Path approved é atômico
   * (request + companies + actors.metadata.validation em uma transação).
   */
  fastify.patch<{
    Params: { requestId: string };
    Body: { decision: 'approved' | 'rejected'; reason?: string };
  }>('/admin/validation-requests/:requestId/review', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }
    const { decision, reason } = req.body ?? ({} as { decision?: 'approved' | 'rejected'; reason?: string });
    if (decision !== 'approved' && decision !== 'rejected') {
      return reply.status(400).send({
        ok: false,
        message: "Body.decision deve ser 'approved' ou 'rejected'",
      });
    }

    try {
      const result = await companiesService.reviewCompanyValidation(
        req.params.requestId,
        decision,
        reason,
        req.user.id,
        req.tenant.id
      );
      fastify.log.info({
        requestId: result.id,
        companyId: result.companyId,
        decision: result.status,
        reviewerUserId: result.reviewedByUserId,
        method: 'STRUCTURED_REVIEW',
      }, `✅ Frente B: validação ${result.status}`);
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao revisar pedido de validação');
      const message = error instanceof Error ? error.message : 'Erro ao revisar pedido de validação';
      return reply.status(400).send({ ok: false, message });
    }
  });

  // ============================================================
  // F-PJ-ACTIVATION-READ-ENDPOINTS (DECISION-0098)
  //   Catálogo governado para o onboarding montar o par (primary_company_type_id,
  //   primary_concept_id): lista company_types e os concepts PERMITIDOS por type
  //   (company_type_allowed_concepts ⋈ concepts). Read-only; NÃO grava o par; SEM
  //   businessType/businessCategory/hybrid/metadata. Rotas estáticas (segmento literal
  //   'operational-activation') — Fastify prioriza estático sobre ':companyId'.
  // ============================================================

  /**
   * GET /companies/operational-activation/company-types
   * Catálogo global governado de company_types (alimenta a seleção do par).
   */
  fastify.get('/operational-activation/company-types', async (req, reply) => {
    if (!req.user?.globalUserId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }
    try {
      const data = await companiesService.listOperationalCompanyTypes(req.tenant.id);
      return reply.send({ ok: true, data });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar company_types');
      return reply.status(500).send({ ok: false, message: 'Erro ao listar company types' });
    }
  });

  /**
   * GET /companies/operational-activation/company-types/:companyTypeId/concepts
   * Concepts PERMITIDOS para o company_type (company_type_allowed_concepts ⋈ concepts).
   * 400 INVALID_COMPANY_TYPE_ID (uuid) · 404 COMPANY_TYPE_NOT_FOUND · 200 [] se sem pares.
   */
  fastify.get<{ Params: { companyTypeId: string } }>(
    '/operational-activation/company-types/:companyTypeId/concepts',
    async (req, reply) => {
      if (!req.user?.globalUserId) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }
      const companyTypeId = req.params.companyTypeId;
      if (!z.string().uuid().safeParse(companyTypeId).success) {
        return reply.status(400).send({ ok: false, code: 'INVALID_COMPANY_TYPE_ID', message: 'companyTypeId inválido' });
      }
      try {
        const data = await companiesService.listAllowedConceptsForCompanyType(req.tenant.id, companyTypeId);
        if (data === null) {
          return reply.status(404).send({ ok: false, code: 'COMPANY_TYPE_NOT_FOUND', message: 'company_type não encontrado' });
        }
        return reply.send({ ok: true, data });
      } catch (error) {
        fastify.log.error({ err: error, companyTypeId }, 'Erro ao listar concepts permitidos');
        return reply.status(500).send({ ok: false, message: 'Erro ao listar concepts permitidos' });
      }
    }
  );

  /**
   * GET /companies/operational-activation/cnae-suggestion?cnae=<código>
   * F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT (DECISION-0104): READ-ONLY. Sugere concept a partir
   * da matriz curada (seed γ). CNAE sugere a PORTA; NÃO ativa, NÃO escreve primary_*, NÃO publica.
   * Aceita CNAE com/sem máscara (query param normaliza). 400 INVALID_CNAE · 200 { data: suggestion|null }.
   */
  fastify.get<{ Querystring: { cnae?: string } }>(
    '/operational-activation/cnae-suggestion',
    async (req, reply) => {
      if (!req.user?.globalUserId) {
        return reply.status(401).send({ ok: false, message: 'Não autenticado' });
      }
      if (!req.tenant) {
        return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
      }
      const raw = (req.query.cnae ?? '').toString();
      try {
        const result = await companiesService.suggestConceptForCnae(raw);
        if (!result.valid) {
          return reply.status(400).send({
            ok: false,
            code: 'INVALID_CNAE',
            message: 'CNAE deve ter 7 dígitos (com ou sem máscara).',
            normalizedCnaeCode: result.normalizedCnaeCode,
          });
        }
        // 200 mesmo sem sugestão (vazio honesto, sem fallback): data = null.
        return reply.send({ ok: true, data: result.suggestion });
      } catch (error) {
        fastify.log.error({ err: error, cnae: raw }, 'Erro ao sugerir concept por CNAE');
        return reply.status(500).send({ ok: false, message: 'Erro ao consultar sugestão de CNAE' });
      }
    }
  );

  // ============================================================
  // F-PJ-ACTIVATION-ROUTE-WRITE-PAIR (DECISION-0098)
  //   Caminho vivo e autorizado para a ATIVAÇÃO OPERACIONAL PJ (Momento 2).
  //   Grava o par soberano (primary_company_type_id, primary_concept_id) via o writer
  //   activateCompanyOperationally, validado por company_type_allowed_concepts.
  //   Autoridade: contextual via company_users (NÃO apenas requireRole sistêmico).
  //   NÃO escreve tenant_concept_offerings; NÃO toca marketplace/hybrid/Bank/KYB.
  // ============================================================

  /**
   * POST /companies/:companyId/operational-activation
   * Body: { companyTypeId: uuid, conceptId: uuid }
   * Erros do writer mapeados 1:1 pelo statusCode embutido no HttpError;
   * 403 COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN para falta de autoridade contextual.
   */
  fastify.post<{
    Params: { companyId: string };
    Body: { companyTypeId: string; conceptId: string };
  }>('/:companyId/operational-activation', async (req, reply) => {
    if (!req.user?.globalUserId || !req.user?.userId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    const companyId = req.params.companyId;
    if (!z.string().uuid().safeParse(companyId).success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_COMPANY_ID', message: 'companyId inválido' });
    }

    const parsed = operationalActivationSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        code: 'INVALID_BODY',
        message: 'companyTypeId e conceptId (uuid) são obrigatórios',
        errors: parsed.error.flatten(),
      });
    }

    // Guard contextual: o chamador precisa ter autoridade de gestão sobre ESTA empresa.
    const canManage = await companiesService.canManageCompany(req.tenant.id, companyId, req.user.globalUserId);
    if (!canManage) {
      return reply.status(403).send({
        ok: false,
        code: 'COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN',
        message: 'Sem autoridade para ativar operacionalmente esta empresa',
      });
    }

    try {
      const result = await companiesService.activateCompanyOperationally({
        tenantId: req.tenant.id,
        companyId,
        responsibleUserId: req.user.userId,
        primaryCompanyTypeId: parsed.data.companyTypeId,
        primaryConceptId: parsed.data.conceptId,
      });
      fastify.log.info({
        companyId,
        primaryCompanyTypeId: result.primaryCompanyTypeId,
        primaryConceptId: result.primaryConceptId,
        alreadyActive: result.alreadyActive,
      }, '🏢 Ativação operacional PJ (par canônico gravado)');
      return reply.send({ ok: true, data: result });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      fastify.log.error({ err: error, companyId, code }, 'Erro na ativação operacional PJ');
      const message = error instanceof Error ? error.message : 'Erro na ativação operacional';
      return reply.status(statusCode).send({ ok: false, code, message });
    }
  });

  // ============================================================
  // F-PJ-PUBLICATION-OFFERING-WRITER (DECISION-0099/0100)
  //   Publica/despublica a empresa por concept em company_concept_publications (SSOT de oferta).
  //   Publicar != ativar: grava a placa no cadastro soberano; NÃO acende no discovery (não toca
  //   tenant_concept_offerings/marketplace nesta fatia). Gates: autoridade contextual (company_users)
  //   + KYB approved (publish) + empresa operacional + concept=primary_concept_id. Reversível e auditável.
  // ============================================================

  /**
   * POST /companies/:companyId/publications
   * Body: { conceptId: uuid, source?, intent? }. Idempotente (active existente → alreadyPublished=true).
   */
  fastify.post<{
    Params: { companyId: string };
    Body: { conceptId: string; source?: string; intent?: string };
  }>('/:companyId/publications', async (req, reply) => {
    if (!req.user?.globalUserId || !req.user?.userId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }
    const companyId = req.params.companyId;
    if (!z.string().uuid().safeParse(companyId).success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_COMPANY_ID', message: 'companyId inválido' });
    }
    const parsed = publishConceptSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_BODY', message: 'conceptId (uuid) é obrigatório', errors: parsed.error.flatten() });
    }
    try {
      const data = await companyPublicationsService.publishCompanyConcept({
        tenantId: req.tenant.id,
        companyId,
        responsibleUserId: req.user.userId,
        globalUserId: req.user.globalUserId,
        conceptId: parsed.data.conceptId,
        source: parsed.data.source,
        intent: parsed.data.intent,
      });
      fastify.log.info({ companyId, conceptId: data.conceptId, alreadyPublished: data.alreadyPublished }, '📣 Publicação de oferta PJ');
      return reply.send({ ok: true, data });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      fastify.log.error({ err: error, companyId, code }, 'Erro ao publicar oferta PJ');
      const message = error instanceof Error ? error.message : 'Erro ao publicar oferta';
      return reply.status(statusCode).send({ ok: false, code, message });
    }
  });

  /**
   * POST /companies/:companyId/publications/:conceptId/retire
   * Despublica (retira) a publicação active. NÃO exige KYB. Idempotente (sem active → alreadyRetired=true).
   */
  fastify.post<{
    Params: { companyId: string; conceptId: string };
    Body: { source?: string; intent?: string };
  }>('/:companyId/publications/:conceptId/retire', async (req, reply) => {
    if (!req.user?.globalUserId || !req.user?.userId) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }
    const { companyId, conceptId } = req.params;
    if (!z.string().uuid().safeParse(companyId).success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_COMPANY_ID', message: 'companyId inválido' });
    }
    if (!z.string().uuid().safeParse(conceptId).success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_CONCEPT_ID', message: 'conceptId inválido' });
    }
    if (req.body !== undefined && !retireConceptSchema.safeParse(req.body).success) {
      return reply.status(400).send({ ok: false, code: 'INVALID_BODY', message: 'body inválido' });
    }
    try {
      const data = await companyPublicationsService.retireCompanyConceptPublication({
        tenantId: req.tenant.id,
        companyId,
        responsibleUserId: req.user.userId,
        globalUserId: req.user.globalUserId,
        conceptId,
      });
      fastify.log.info({ companyId, conceptId, alreadyRetired: data.alreadyRetired }, '📕 Despublicação de oferta PJ');
      return reply.send({ ok: true, data });
    } catch (error) {
      const code = (error as { code?: string }).code;
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      fastify.log.error({ err: error, companyId, conceptId, code }, 'Erro ao despublicar oferta PJ');
      const message = error instanceof Error ? error.message : 'Erro ao despublicar oferta';
      return reply.status(statusCode).send({ ok: false, code, message });
    }
  });
};

export { companiesRoutes };

