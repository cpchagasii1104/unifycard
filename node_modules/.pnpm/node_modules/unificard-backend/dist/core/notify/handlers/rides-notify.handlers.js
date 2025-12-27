"use strict";
// backend/src/core/notify/handlers/rides-notify.handlers.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRidesNotifyHandlers = registerRidesNotifyHandlers;
const notify_service_1 = require("@core/notify/notify.service");
function registerRidesNotifyHandlers(eventBus) {
    const toString = (value) => String(value ?? '');
    // Quando uma nova solicitação de corrida é criada
    eventBus.subscribe('rides.ride_request.created', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const passengerId = toString(payload.passengerId);
        if (!passengerId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: passengerId,
            channel: 'push',
            templateName: null,
            target: passengerId,
            payload: {
                title: 'Corrida solicitada',
                body: 'Estamos buscando um motorista para você.',
                requestId: payload.requestId,
            },
        });
    });
    // Motorista atribuído à corrida
    eventBus.subscribe('rides.ride.driver_assigned', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const passengerId = toString(payload.passengerId);
        if (!passengerId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: passengerId,
            channel: 'push',
            templateName: null,
            target: passengerId,
            payload: {
                title: 'Motorista a caminho',
                body: `Seu motorista ${payload.driverName} está a caminho.`,
                rideId: payload.rideId,
                driverId: payload.driverId,
            },
        });
    });
    // Corrida iniciada
    eventBus.subscribe('rides.ride.started', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const passengerId = toString(payload.passengerId);
        if (!passengerId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: passengerId,
            channel: 'push',
            templateName: null,
            target: passengerId,
            payload: {
                title: 'Corrida iniciada',
                body: 'Sua corrida começou.',
                rideId: payload.rideId,
            },
        });
    });
    // Corrida concluída
    eventBus.subscribe('rides.ride.completed', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const passengerId = toString(payload.passengerId);
        if (!passengerId)
            return;
        const finalPrice = payload.finalPrice;
        const finalPriceText = typeof finalPrice === 'number'
            ? finalPrice.toFixed(2)
            : finalPrice ?? '';
        await notify_service_1.notifyService.send({
            tenantId,
            userId: passengerId,
            channel: 'push',
            templateName: null,
            target: passengerId,
            payload: {
                title: 'Corrida finalizada',
                body: `Valor final: R$ ${finalPriceText}`,
                rideId: payload.rideId,
            },
        });
    });
    // Corrida cancelada
    eventBus.subscribe('rides.ride.cancelled', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const passengerId = toString(payload.passengerId);
        if (!passengerId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: passengerId,
            channel: 'push',
            templateName: null,
            target: passengerId,
            payload: {
                title: 'Corrida cancelada',
                body: 'Sua corrida foi cancelada.',
                rideId: payload.rideId,
                cancelledBy: payload.cancelledBy,
            },
        });
    });
    // Motorista entrou em pausa forçada (limite 12h)
    eventBus.subscribe('rides.driver.forced_break', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const driverId = toString(payload.driverId);
        if (!driverId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: driverId,
            channel: 'push',
            templateName: null,
            target: driverId,
            payload: {
                title: 'Pausa obrigatória',
                body: 'Você atingiu o limite de horas dirigindo. Faça uma pausa antes de voltar.',
                forcedBreakUntil: payload.forcedBreakUntil,
            },
        });
    });
    // Zona com alta demanda
    eventBus.subscribe('rides.zone.high_demand', async (event) => {
        const { tenantId } = event;
        const payload = event.payload;
        const zoneId = toString(payload.zoneId);
        if (!zoneId)
            return;
        await notify_service_1.notifyService.send({
            tenantId,
            userId: null,
            channel: 'push',
            templateName: null,
            target: zoneId,
            payload: {
                title: 'Zona com alta demanda',
                body: 'Há poucas corridas disponíveis nesta região. Considere se mover para lá.',
                zoneId: payload.zoneId,
            },
        });
    });
}
//# sourceMappingURL=rides-notify.handlers.js.map