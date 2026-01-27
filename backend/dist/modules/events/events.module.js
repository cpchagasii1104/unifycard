"use strict";
// src/modules/events/events.module.ts
// Módulo de Eventos
// 🔴 BLINDAGEM: Registra EventFeedPlugin no FeedPluginRegistry
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventsModule = void 0;
const events_routes_1 = __importDefault(require("./events.routes"));
const events_rsvp_routes_1 = require("./events-rsvp.routes");
const events_spec_routes_1 = require("./events-spec.routes");
const events_economy_routes_1 = __importDefault(require("./events-economy.routes"));
const events_closure_routes_1 = __importDefault(require("./events-closure.routes"));
const events_state_history_routes_1 = __importDefault(require("./events-state-history.routes"));
const events_sprint76_routes_1 = __importDefault(require("./events-sprint76.routes"));
const event_rfq_routes_1 = require("./event-rfq.routes");
const feed_plugin_service_1 = require("@core/feed/feed-plugin.service");
const event_feed_plugin_1 = require("./event-feed.plugin");
const eventsModule = async (fastify) => {
    await fastify.register(events_routes_1.default);
    // RSVP (confirmação de presença) - Action Router
    await fastify.register(events_rsvp_routes_1.eventsRSVPRoutes);
    // EventSpec - Especificação Declarativa de Evento
    await fastify.register(events_spec_routes_1.eventsSpecRoutes);
    await fastify.register(events_economy_routes_1.default);
    await fastify.register(events_closure_routes_1.default);
    await fastify.register(events_state_history_routes_1.default);
    // SPRINT 76: Rotas canônicas de eventos, bilheteria e check-in
    await fastify.register(events_sprint76_routes_1.default);
    // RFQ (Request for Quotation) / ORÇAMENTO EM LOTE
    // Feature flag: RFQ
    const { isRFQEnabled } = await Promise.resolve().then(() => __importStar(require('@core/features/feature-flags')));
    if (isRFQEnabled()) {
        await fastify.register(event_rfq_routes_1.eventRFQRoutes);
    }
    else {
        fastify.log.warn('[EventsModule] RFQ feature está desabilitada (FEATURE_RFQ_ENABLED=false)');
    }
    // 🔴 BLINDAGEM: Registrar EventFeedPlugin no FeedPluginRegistry
    // Plugin apenas renderiza dados, não executa ações
    // Feed não decide comportamento, apenas orquestra visualmente
    try {
        feed_plugin_service_1.feedPluginService.registerPlugin(event_feed_plugin_1.eventFeedPlugin);
        console.log('[BOOT] EventFeedPlugin registrado no FeedPluginRegistry');
    }
    catch (error) {
        console.error('[BOOT] Erro ao registrar EventFeedPlugin:', error);
        // Não quebra o módulo se registro falhar
    }
};
exports.eventsModule = eventsModule;
