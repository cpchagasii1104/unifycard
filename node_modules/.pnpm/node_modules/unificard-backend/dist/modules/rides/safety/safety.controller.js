"use strict";
// backend/src/modules/rides/safety/safety.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.safetyController = exports.SafetyController = void 0;
const safety_service_1 = require("./safety.service");
class SafetyController {
    // Contatos de emergência
    async addEmergencyContact(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        const body = req.body;
        const contact = await safety_service_1.safetyService.addEmergencyContact(tenantId, userId, {
            name: body.name,
            phone: body.phone,
        });
        return reply.send({
            success: true,
            data: contact,
        });
    }
    async listEmergencyContacts(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        const contacts = await safety_service_1.safetyService.listEmergencyContacts(tenantId, userId);
        return reply.send({
            success: true,
            data: contacts,
        });
    }
    // Compartilhamento de corrida
    async shareRide(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        const { rideId } = req.params;
        const share = await safety_service_1.safetyService.shareRide(tenantId, String(rideId), userId);
        return reply.send({
            success: true,
            data: share,
        });
    }
    async listRideShares(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return reply.status(401).send({ error: 'Tenant not found' });
        }
        const { rideId } = req.params;
        const shares = await safety_service_1.safetyService.listRideShares(tenantId, String(rideId));
        return reply.send({
            success: true,
            data: shares,
        });
    }
    // Disputas
    async openDispute(req, reply) {
        const tenantId = req.tenant?.id;
        const userId = req.user?.id;
        if (!tenantId || !userId) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        const { rideId } = req.params;
        const body = req.body;
        const dispute = await safety_service_1.safetyService.openDispute(tenantId, String(rideId), userId, body.reason, body.details);
        return reply.send({
            success: true,
            data: dispute,
        });
    }
    async listDisputesForRide(req, reply) {
        const tenantId = req.tenant?.id;
        if (!tenantId) {
            return reply.status(401).send({ error: 'Tenant not found' });
        }
        const { rideId } = req.params;
        const disputes = await safety_service_1.safetyService.listRideDisputes(tenantId, String(rideId));
        return reply.send({
            success: true,
            data: disputes,
        });
    }
}
exports.SafetyController = SafetyController;
exports.safetyController = new SafetyController();
