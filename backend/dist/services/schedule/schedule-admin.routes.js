"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const SlotGenerator_1 = require("./SlotGenerator");
const CompanyScheduleService_1 = require("./CompanyScheduleService");
const rbac_service_1 = require("@core/rbac/rbac.service");
const slotGenerator = new SlotGenerator_1.SlotGenerator();
const companyScheduleService = new CompanyScheduleService_1.CompanyScheduleService();
const scheduleAdminRoutes = async (fastify) => {
    /**
     * Helper para validar se usuário é admin da empresa
     */
    async function requireCompanyAdmin(req, companyId) {
        const tenantId = req.tenant.id;
        const userId = req.user.id;
        if (!userId) {
            throw fastify.httpErrors.unauthorized('Authentication required');
        }
        // Verificar se usuário tem permissão de gerenciar funcionários (admin)
        const hasPermission = await rbac_service_1.rbacService.userHasAllPermissions(tenantId, userId, [
            'companies:manage',
        ]);
        if (!hasPermission.hasPermission) {
            // Verificar se é funcionário com can_manage_schedule
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/db')));
            const employee = await runQueryWithTenant(tenantId, {
                text: `
            SELECT can_manage_schedule
            FROM company_employees
            WHERE company_id = $1
              AND global_user_id = $2
              AND ended_at IS NULL
          `,
                values: [companyId, req.user.globalUserId],
            });
            if (!employee || !employee.can_manage_schedule) {
                throw fastify.httpErrors.forbidden('Requires company admin permission');
            }
        }
    }
    /**
     * POST /admin/schedules/generate-slots
     * Gera slots para uma agenda
     */
    fastify.post('/generate-slots', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            await requireCompanyAdmin(req, req.body.companyId);
            const result = await slotGenerator.generateCompanySlots({
                scheduleId: req.body.scheduleId,
                companyId: req.body.companyId,
                tenantId: req.tenant.id,
                daysAhead: req.body.daysAhead,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao gerar slots');
            return reply.status(500).send({ error: 'Erro ao gerar slots' });
        }
    });
    /**
     * POST /admin/companies/:id/schedule
     * Cria ou atualiza agenda da empresa
     */
    fastify.post('/companies/:id/schedule', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            await requireCompanyAdmin(req, req.params.id);
            const scheduleId = await companyScheduleService.ensureCompanySchedule({
                companyId: req.params.id,
                tenantId: req.tenant.id,
                timezone: req.body.timezone,
                businessHours: req.body.businessHours,
            });
            return reply.status(200).send({ scheduleId });
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao criar/atualizar agenda');
            return reply.status(500).send({ error: 'Erro ao criar/atualizar agenda' });
        }
    });
    /**
     * GET /admin/companies/:id/schedule
     * Lê agenda da empresa
     */
    fastify.get('/companies/:id/schedule', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            await requireCompanyAdmin(req, req.params.id);
            const { runQueryWithTenant } = await Promise.resolve().then(() => __importStar(require('@core/db')));
            const schedule = await runQueryWithTenant(req.tenant.id, {
                text: `
              SELECT schedule_id, company_id, tenant_id, metadata, created_at, updated_at
              FROM schedules
              WHERE company_id = $1
            `,
                values: [req.params.id],
            });
            if (!schedule) {
                return reply.status(404).send({ error: 'Schedule not found' });
            }
            return reply.status(200).send(schedule);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao ler agenda');
            return reply.status(500).send({ error: 'Erro ao ler agenda' });
        }
    });
};
exports.default = scheduleAdminRoutes;
