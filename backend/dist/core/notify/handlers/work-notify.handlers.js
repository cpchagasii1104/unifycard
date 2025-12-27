"use strict";
// backend/src/core/notify/handlers/work-notify.handlers.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkNotifyHandlers = registerWorkNotifyHandlers;
const notify_service_1 = require("@core/notify/notify.service");
function registerWorkNotifyHandlers(eventBus) {
    // ============================================================
    // 📩 1. Nova candidatura criada (worker → cliente)
    // ============================================================
    eventBus.registerHandler('work.application.created', async (event) => {
        const { tenantId, payload } = event;
        if (!payload?.clientUserId)
            return;
        const clientUserId = String(payload.clientUserId);
        await notify_service_1.notifyService.enqueue({
            tenantId,
            userId: clientUserId,
            channel: 'push',
            templateName: null,
            target: clientUserId,
            payload: {
                title: 'Nova candidatura recebida',
                body: 'Um worker se candidatou ao seu job.',
                jobId: payload.jobId,
                applicationId: payload.applicationId,
            },
        });
    });
    // ============================================================
    // 📩 2. Assignment criado (cliente aceitou worker)
    // ============================================================
    eventBus.registerHandler('work.assignment.created', async (event) => {
        const { tenantId, payload } = event;
        if (!payload?.workerId)
            return;
        const workerId = String(payload.workerId);
        await notify_service_1.notifyService.enqueue({
            tenantId,
            userId: workerId,
            channel: 'push',
            templateName: null,
            target: workerId,
            payload: {
                title: 'Você foi selecionado!',
                body: 'Um cliente aceitou sua candidatura.',
                assignmentId: payload.assignmentId,
                jobId: payload.jobId,
            },
        });
    });
    // ============================================================
    // 📩 3. Assignment completado (ambos devem avaliar)
    // ============================================================
    eventBus.registerHandler('work.assignment.completed', async (event) => {
        const { tenantId, payload } = event;
        if (!payload?.assignmentId)
            return;
        // Worker → avaliar cliente
        if (payload.workerId) {
            const workerId = String(payload.workerId);
            await notify_service_1.notifyService.enqueue({
                tenantId,
                userId: workerId,
                channel: 'push',
                templateName: null,
                target: workerId,
                payload: {
                    title: 'Trabalho concluído!',
                    body: 'O cliente marcou o job como concluído. Avalie o cliente.',
                    assignmentId: payload.assignmentId,
                },
            });
        }
        // Cliente → avaliar worker
        if (payload.clientUserId) {
            const clientUserId = String(payload.clientUserId);
            await notify_service_1.notifyService.enqueue({
                tenantId,
                userId: clientUserId,
                channel: 'push',
                templateName: null,
                target: clientUserId,
                payload: {
                    title: 'Trabalho finalizado',
                    body: 'Você marcou o job como concluído. Avalie o worker.',
                    assignmentId: payload.assignmentId,
                },
            });
        }
    });
    // ============================================================
    // 📩 4. Pagamento concluído — worker recebe confirmação
    // ============================================================
    eventBus.registerHandler('work.assignment.paid', async (event) => {
        const { tenantId, payload } = event;
        if (!payload?.workerId)
            return;
        const workerId = String(payload.workerId);
        await notify_service_1.notifyService.enqueue({
            tenantId,
            userId: workerId,
            channel: 'push',
            templateName: null,
            target: workerId,
            payload: {
                title: 'Pagamento recebido',
                body: `Você recebeu R$ ${payload.amount} pelo trabalho.`,
                assignmentId: payload.assignmentId,
                transactionId: payload.paymentTransactionId,
            },
        });
    });
}
//# sourceMappingURL=work-notify.handlers.js.map