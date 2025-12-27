"use strict";
// backend/src/core/notify/handlers/index.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllNotifyHandlers = registerAllNotifyHandlers;
// ============================================================
// 🔥 Handlers do módulo WORK
// ============================================================
const work_notify_handlers_1 = require("./work-notify.handlers");
// ============================================================
// 🔥 Handlers do módulo RIDES (NOVO)
// ============================================================
const rides_notify_handlers_1 = require("./rides-notify.handlers");
function registerAllNotifyHandlers(eventBus) {
    // ============================================================
    // WORK
    // ============================================================
    (0, work_notify_handlers_1.registerWorkNotifyHandlers)(eventBus);
    // ============================================================
    // RIDES
    // ============================================================
    (0, rides_notify_handlers_1.registerRidesNotifyHandlers)(eventBus);
    // ============================================================
    // 🔜 Futuro — plug-and-play
    //
    // import { registerFoodNotifyHandlers } from './food-notify.handlers';
    // registerFoodNotifyHandlers(eventBus);
    //
    // import { registerMarketplaceNotifyHandlers } from './marketplace-notify.handlers';
    // registerMarketplaceNotifyHandlers(eventBus);
    // ============================================================
}
//# sourceMappingURL=index.js.map