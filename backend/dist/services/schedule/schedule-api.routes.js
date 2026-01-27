"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const luxon_1 = require("luxon");
const AvailabilityResolver_1 = require("./AvailabilityResolver");
const availabilityResolver = new AvailabilityResolver_1.AvailabilityResolver();
const scheduleApiRoutes = async (fastify) => {
    /**
     * POST /api/schedules/check-availability
     * Verifica disponibilidade de funcionário
     */
    fastify.post('/check-availability', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        try {
            const startTime = luxon_1.DateTime.fromISO(req.body.startTime);
            const endTime = luxon_1.DateTime.fromISO(req.body.endTime);
            if (!startTime.isValid || !endTime.isValid) {
                return reply.status(400).send({ error: 'Invalid date format' });
            }
            const result = await availabilityResolver.checkEmployeeAvailability({
                employeeId: req.body.employeeId,
                companyId: req.body.companyId,
                tenantId: req.tenant.id,
                serviceId: req.body.serviceId,
                startTime,
                endTime,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao verificar disponibilidade');
            return reply.status(500).send({ error: 'Erro ao verificar disponibilidade' });
        }
    });
    /**
     * POST /api/schedules/reserve-slot
     * Reserva um slot
     */
    fastify.post('/reserve-slot', async (req, reply) => {
        if (!req.user) {
            return reply.status(401).send({ error: 'Não autenticado' });
        }
        if (!req.tenant) {
            return reply.status(400).send({ error: 'Tenant não encontrado' });
        }
        if (!req.user.globalUserId) {
            return reply.status(400).send({ error: 'Global user ID required' });
        }
        try {
            const result = await availabilityResolver.reserveSlot({
                scheduleId: req.body.scheduleId,
                slotId: req.body.slotId,
                userId: req.user.globalUserId,
                tenantId: req.tenant.id,
                actionId: req.body.actionId,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof Error) {
                return reply.status(400).send({ error: error.message });
            }
            fastify.log.error({ err: error }, 'Erro ao reservar slot');
            return reply.status(500).send({ error: 'Erro ao reservar slot' });
        }
    });
};
exports.default = scheduleApiRoutes;
