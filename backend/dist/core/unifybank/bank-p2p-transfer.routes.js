"use strict";
// backend/src/core/unifybank/bank-p2p-transfer.routes.ts
// Rotas HTTP para transferência P2P
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const uuid_1 = require("uuid");
const bank_p2p_transfer_service_1 = require("./bank-p2p-transfer.service");
// Schema de validação do payload
const p2pTransferSchema = zod_1.z.object({
    toUserId: zod_1.z.string().uuid('Invalid destination user ID'),
    amount: zod_1.z.number().positive('Amount must be greater than zero'),
    eventId: zod_1.z.string().uuid('Invalid event ID').optional(),
});
const bankP2PTransferRoutes = async (fastify) => {
    /**
     * POST /bank/p2p-transfer
     * Executa transferência P2P do usuário autenticado para outro usuário
     *
     * Autenticação: OBRIGATÓRIA (Bearer token)
     * fromUserId vem EXCLUSIVAMENTE do req.user.id (JWT)
     *
     * Payload:
     * {
     *   "toUserId": "uuid",
     *   "amount": 100,
     *   "eventId": "uuid" (opcional, para idempotência)
     * }
     *
     * Respostas:
     * - 200: Transferência realizada com sucesso
     * - 400: Validação falhou (saldo insuficiente, amount inválido, etc)
     * - 401: Não autenticado
     * - 404: Usuário destino não encontrado
     * - 409: eventId duplicado (idempotência)
     */
    fastify.post('/p2p-transfer', async (req, reply) => {
        // 1. Verificar autenticação
        if (!req.user || !req.user.id) {
            return reply.status(401).send({ error: 'Authentication required' });
        }
        if (!req.tenant || !req.tenant.id) {
            return reply.status(400).send({ error: 'Tenant not found' });
        }
        const tenantId = req.tenant.id;
        const fromUserId = req.user.id;
        // 2. Validar payload
        const parsed = p2pTransferSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Invalid request body',
                details: parsed.error.errors,
            });
        }
        const { toUserId, amount, eventId } = parsed.data;
        // 3. Validar que não está transferindo para si mesmo
        if (fromUserId === toUserId) {
            return reply.status(400).send({ error: 'Cannot transfer to yourself' });
        }
        // 4. Gerar eventId se não fornecido (para idempotência)
        const finalEventId = eventId || (0, uuid_1.v4)();
        try {
            // 5. Executar transferência
            const result = await bank_p2p_transfer_service_1.bankP2PTransferService.transferP2P(tenantId, {
                fromUserId,
                toUserId,
                amount,
                eventId: finalEventId,
            });
            return reply.status(200).send({
                success: true,
                transaction: result.transaction,
                fromUserId: result.fromUserId,
                toUserId: result.toUserId,
                fromAccountBalance: result.fromAccountBalance,
                toAccountBalance: result.toAccountBalance,
            });
        }
        catch (error) {
            const err = error;
            const statusCode = err.statusCode || 500;
            // Mapear erros específicos
            if (err.message === 'Insufficient balance') {
                return reply.status(400).send({ error: 'Insufficient balance' });
            }
            if (err.message === 'Destination user not found') {
                return reply.status(404).send({ error: 'Destination user not found' });
            }
            if (err.message.includes('duplicate') || err.message.includes('already exists')) {
                return reply.status(409).send({ error: 'Duplicate eventId' });
            }
            // Erro genérico
            fastify.log.error({ err: error }, 'Error in P2P transfer');
            return reply.status(statusCode).send({ error: err.message || 'Transfer failed' });
        }
    });
};
exports.default = bankP2PTransferRoutes;
//# sourceMappingURL=bank-p2p-transfer.routes.js.map