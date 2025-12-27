"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const social_routes_1 = __importDefault(require("./social.routes"));
const social_2_0_routes_1 = __importDefault(require("./social-2.0.routes"));
const social_work_routes_1 = __importDefault(require("./social-work.routes"));
const social_work_apply_routes_1 = __importDefault(require("./social-work-apply.routes"));
const social_work_schedule_routes_1 = __importDefault(require("./social-work-schedule.routes"));
const social_work_payment_routes_1 = __importDefault(require("./social-work-payment.routes"));
const social_group_routes_1 = __importDefault(require("./social-group.routes"));
const social_group_insights_routes_1 = __importDefault(require("./social-group-insights.routes"));
const socialModule = async (fastify) => {
    await fastify.register(social_routes_1.default);
    await fastify.register(social_2_0_routes_1.default); // Social 2.0 routes (já inclui ledger)
    await fastify.register(social_work_routes_1.default, { prefix: '/work' });
    await fastify.register(social_work_apply_routes_1.default, { prefix: '/work' });
    await fastify.register(social_work_schedule_routes_1.default, { prefix: '/work' });
    await fastify.register(social_work_payment_routes_1.default, { prefix: '/work' });
    await fastify.register(social_group_routes_1.default);
    await fastify.register(social_group_insights_routes_1.default);
};
exports.default = socialModule;
//# sourceMappingURL=social.module.js.map