"use strict";
// src/core/companies/companies.routes.ts
// Rotas para gerenciar empresas (PJ)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multipart_1 = __importDefault(require("@fastify/multipart"));
const companies_service_1 = require("./companies.service");
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const createCompanySchema = zod_1.z.object({
    cnpj: zod_1.z.string().min(14).max(18),
    companyName: zod_1.z.string().optional(),
    tradeName: zod_1.z.string().optional(),
    address: zod_1.z.object({
        cep: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        addressNumber: zod_1.z.string().optional(),
        complement: zod_1.z.string().optional(),
        neighborhood: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
    }).optional(),
    contact: zod_1.z.object({
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        website: zod_1.z.string().url().optional(),
    }).optional(),
    activity: zod_1.z.object({
        mainActivityCode: zod_1.z.string().optional(),
        mainActivityDescription: zod_1.z.string().optional(),
        secondaryActivities: zod_1.z.array(zod_1.z.object({
            code: zod_1.z.string(),
            description: zod_1.z.string(),
        })).optional(),
    }).optional(),
    role: zod_1.z.enum(['owner', 'partner', 'director', 'manager', 'employee', 'other']),
    roleDescription: zod_1.z.string().optional(),
    permissions: zod_1.z.object({
        canManageCompany: zod_1.z.boolean().optional(),
        canManageFinancial: zod_1.z.boolean().optional(),
        canManageEmployees: zod_1.z.boolean().optional(),
        canViewReports: zod_1.z.boolean().optional(),
        canManageServices: zod_1.z.boolean().optional(),
    }).optional(),
    isPrimary: zod_1.z.boolean().optional(),
    fetchFromRevenue: zod_1.z.boolean().optional(),
});
const updateCompanySchema = zod_1.z.object({
    companyName: zod_1.z.string().optional(),
    tradeName: zod_1.z.string().optional(),
    registrationDate: zod_1.z.string().optional(),
    address: zod_1.z.object({
        cep: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        addressNumber: zod_1.z.string().optional(),
        complement: zod_1.z.string().optional(),
        neighborhood: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
    }).optional(),
    contact: zod_1.z.object({
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        website: zod_1.z.string().url().optional(),
    }).optional(),
    activity: zod_1.z.object({
        mainActivityCode: zod_1.z.string().optional(),
        mainActivityDescription: zod_1.z.string().optional(),
        secondaryActivities: zod_1.z.array(zod_1.z.object({
            code: zod_1.z.string(),
            description: zod_1.z.string(),
        })).optional(),
    }).optional(),
    status: zod_1.z.enum(['active', 'inactive', 'suspended', 'closed']).optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
});
const updateCompanyUserSchema = zod_1.z.object({
    role: zod_1.z.enum(['owner', 'partner', 'director', 'manager', 'employee', 'other']).optional(),
    roleDescription: zod_1.z.string().optional(),
    permissions: zod_1.z.object({
        canManageCompany: zod_1.z.boolean().optional(),
        canManageFinancial: zod_1.z.boolean().optional(),
        canManageEmployees: zod_1.z.boolean().optional(),
        canViewReports: zod_1.z.boolean().optional(),
        canManageServices: zod_1.z.boolean().optional(),
    }).optional(),
    isActive: zod_1.z.boolean().optional(),
    isPrimary: zod_1.z.boolean().optional(),
});
const companiesRoutes = async (fastify) => {
    // Registrar multipart para upload de arquivos
    await fastify.register(multipart_1.default, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB
            files: 1,
        },
    });
    // Criar diretório de uploads se não existir
    const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'companies');
    if (!fs_1.default.existsSync(uploadsDir)) {
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
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
            const companies = await companies_service_1.companiesService.listCompanies(req.user.globalUserId);
            return { companies };
        }
        catch (error) {
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
    fastify.get('/:companyId', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const company = await companies_service_1.companiesService.getCompanyById(req.params.companyId, req.user.globalUserId);
            if (!company) {
                return reply.status(404).send({ ok: false, message: 'Empresa não encontrada' });
            }
            return reply.send({ ok: true, data: company });
        }
        catch (error) {
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
            const parsed = createCompanySchema.safeParse(req.body);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: 'Dados inválidos',
                    details: parsed.error.errors,
                });
            }
            const result = await companies_service_1.companiesService.createCompany(req.user.globalUserId, parsed.data);
            return reply.status(201).send(result);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao criar empresa');
            const message = error instanceof Error ? error.message : 'Erro ao criar empresa';
            return reply.status(400).send({ error: message });
        }
    });
    /**
     * PUT /companies/:companyId
     * Atualiza empresa
     */
    fastify.put('/:companyId', async (req, reply) => {
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
            const company = await companies_service_1.companiesService.updateCompany(req.params.companyId, req.user.globalUserId, parsed.data);
            return company;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar empresa');
            const message = error instanceof Error ? error.message : 'Erro ao atualizar empresa';
            return reply.status(400).send({ error: message });
        }
    });
    /**
     * DELETE /companies/:companyId
     * Remove empresa (soft delete)
     */
    fastify.delete('/:companyId', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const deleted = await companies_service_1.companiesService.deleteCompany(req.params.companyId, req.user.globalUserId);
            if (!deleted) {
                return reply.status(404).send({ error: 'Empresa não encontrada' });
            }
            return reply.status(204).send();
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao remover empresa');
            return reply.status(500).send({
                ok: false,
                message: 'Erro ao remover empresa',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
    /**
     * PUT /companies/:companyId/users/:companyUserId
     * Atualiza relacionamento usuário-empresa
     */
    fastify.put('/:companyId/users/:companyUserId', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        try {
            const parsed = updateCompanyUserSchema.safeParse(req.body);
            if (!parsed.success) {
                return reply.status(400).send({
                    error: 'Dados inválidos',
                    details: parsed.error.errors,
                });
            }
            const companyUser = await companies_service_1.companiesService.updateCompanyUser(req.params.companyUserId, req.user.globalUserId, parsed.data);
            return companyUser;
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar relacionamento');
            const message = error instanceof Error ? error.message : 'Erro ao atualizar relacionamento';
            return reply.status(400).send({ ok: false, message });
        }
    });
    /**
     * POST /companies/fetch-cnpj
     * Busca dados do CNPJ na Receita Federal (endpoint auxiliar)
     */
    fastify.post('/fetch-cnpj', async (req, reply) => {
        try {
            const { cnpj } = req.body;
            if (!cnpj) {
                return reply.status(400).send({ ok: false, message: 'CNPJ é obrigatório' });
            }
            fastify.log.info({ cnpj }, 'Buscando CNPJ na Receita Federal');
            const data = await companies_service_1.companiesService.fetchCNPJFromRevenue(cnpj);
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
        }
        catch (error) {
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
    fastify.post('/:companyId/documents', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const { companyId } = req.params;
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ ok: false, message: 'Arquivo não enviado' });
            }
            // Validar tipo de arquivo
            if (data.mimetype !== 'application/pdf') {
                return reply.status(400).send({ ok: false, message: 'Apenas arquivos PDF são aceitos' });
            }
            // Criar diretório da empresa se não existir
            const companyDir = path_1.default.join(uploadsDir, companyId);
            if (!fs_1.default.existsSync(companyDir)) {
                fs_1.default.mkdirSync(companyDir, { recursive: true });
            }
            // Salvar arquivo como buffer
            const buffer = await data.toBuffer();
            // 🔴 Obter IP do usuário para auditoria
            const userIp = req.ip ||
                req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                req.headers['x-real-ip'] ||
                'unknown';
            // Upload no banco (service vai gerar UUID e retornar o nome único)
            const result = await companies_service_1.companiesService.uploadCompanyDocument(companyId, req.user.globalUserId, {
                filename: data.filename, // Nome original (será substituído por UUID no service)
                filepath: '', // Não usado - service gera novo nome
                mimetype: data.mimetype,
                size: buffer.length,
            }, 'cnpj_receita', userIp);
            // 🔴 Salvar arquivo com nome único (UUID) retornado pelo service
            const finalFilepath = path_1.default.join(companyDir, result.fileName);
            fs_1.default.writeFileSync(finalFilepath, buffer);
            fastify.log.info({
                companyId,
                documentId: result.documentId,
                fileName: result.fileName,
                fileSize: buffer.length,
            }, '📄 Documento da empresa enviado');
            return reply.status(201).send({
                ok: true,
                message: 'Comprovante enviado com sucesso. Validação pendente.',
                data: {
                    documentId: result.documentId,
                    companyStatus: result.companyStatus,
                },
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao fazer upload de documento');
            const message = error instanceof Error ? error.message : 'Erro ao fazer upload de documento';
            return reply.status(400).send({ ok: false, message });
        }
    });
    /**
     * GET /companies/:companyId/documents
     * Lista documentos da empresa
     */
    fastify.get('/:companyId/documents', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const { companyId } = req.params;
            const documents = await companies_service_1.companiesService.listCompanyDocuments(companyId, req.user.globalUserId);
            return reply.send({ ok: true, data: documents });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao listar documentos');
            const message = error instanceof Error ? error.message : 'Erro ao listar documentos';
            return reply.status(400).send({ ok: false, message });
        }
    });
    /**
     * GET /companies/:companyId/documents/:documentId/file
     * Serve arquivo do documento (PDF)
     * 🔴 SEGURANÇA: Protegido por auth, valida companyId do usuário logado
     */
    fastify.get('/:companyId/documents/:documentId/file', async (req, reply) => {
        if (!req.user?.globalUserId) {
            return reply.status(401).send({ ok: false, message: 'Não autenticado' });
        }
        try {
            const { companyId, documentId } = req.params;
            // 🔴 SEGURANÇA: Verificar se empresa pertence ao usuário
            const company = await companies_service_1.companiesService.getCompanyById(companyId, req.user.globalUserId);
            if (!company) {
                return reply.status(404).send({ ok: false, message: 'Empresa não encontrada' });
            }
            // Buscar documento (já valida companyId + globalUserId)
            const documents = await companies_service_1.companiesService.listCompanyDocuments(companyId, req.user.globalUserId);
            const document = documents.find(d => d.documentId === documentId);
            if (!document) {
                return reply.status(404).send({ ok: false, message: 'Documento não encontrado' });
            }
            // Construir caminho completo do arquivo
            const filePath = path_1.default.join(uploadsDir, companyId, document.fileName);
            if (!fs_1.default.existsSync(filePath)) {
                fastify.log.warn({ filePath, companyId, documentId }, 'Arquivo não encontrado no filesystem');
                return reply.status(404).send({ ok: false, message: 'Arquivo não encontrado' });
            }
            // 🔴 AUDITORIA: Log de acesso ao arquivo
            fastify.log.info({
                companyId,
                documentId,
                globalUserId: req.user.globalUserId,
                userIp: req.ip || req.headers['x-forwarded-for'] || 'unknown',
                fileName: document.fileName,
            }, '📥 Download de documento da empresa');
            // Servir arquivo
            const fileStream = fs_1.default.createReadStream(filePath);
            reply.type('application/pdf');
            reply.header('Content-Disposition', `inline; filename="comprovante_${companyId}.pdf"`);
            return reply.send(fileStream);
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao servir arquivo');
            const message = error instanceof Error ? error.message : 'Erro ao servir arquivo';
            return reply.status(500).send({ ok: false, message });
        }
    });
    /**
     * GET /companies/admin/documents/pending
     * Lista documentos pendentes (ADMIN)
     */
    fastify.get('/admin/documents/pending', {
        preHandler: [fastify.requireRole(['admin', 'owner'])],
    }, async (req, reply) => {
        try {
            const documents = await companies_service_1.companiesService.listPendingDocuments();
            return reply.send({ ok: true, data: documents });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao listar documentos pendentes');
            const message = error instanceof Error ? error.message : 'Erro ao listar documentos pendentes';
            return reply.status(500).send({ ok: false, message });
        }
    });
    /**
     * PATCH /companies/admin/documents/:documentId/status
     * Aprova ou rejeita documento (ADMIN)
     */
    fastify.patch('/admin/documents/:documentId/status', {
        preHandler: [fastify.requireRole(['admin', 'owner'])],
    }, async (req, reply) => {
        try {
            const { documentId } = req.params;
            const { status, rejectedReason } = req.body;
            if (!status || !['approved', 'rejected'].includes(status)) {
                return reply.status(400).send({
                    ok: false,
                    message: 'Status deve ser "approved" ou "rejected"'
                });
            }
            if (status === 'rejected' && !rejectedReason) {
                return reply.status(400).send({
                    ok: false,
                    message: 'Motivo da rejeição é obrigatório'
                });
            }
            const result = await companies_service_1.companiesService.updateDocumentStatus(documentId, status, rejectedReason, req.user?.id);
            fastify.log.info({
                documentId,
                status,
                adminUserId: req.user?.id,
                companyStatus: result.companyStatus,
            }, `📋 Documento ${status === 'approved' ? 'aprovado' : 'rejeitado'}`);
            return reply.send({
                ok: true,
                message: status === 'approved'
                    ? 'Documento aprovado. Empresa validada.'
                    : 'Documento rejeitado.',
                data: result,
            });
        }
        catch (error) {
            fastify.log.error({ err: error }, 'Erro ao atualizar status do documento');
            const message = error instanceof Error ? error.message : 'Erro ao atualizar status do documento';
            return reply.status(400).send({ ok: false, message });
        }
    });
};
exports.default = companiesRoutes;
//# sourceMappingURL=companies.routes.js.map