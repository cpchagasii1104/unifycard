// backend/src/core/notify/handlers/index.ts

/**
 * Inicializa todos os handlers de notificação do sistema.
 *
 * Cada módulo (work, rides, food etc.) terá seu próprio arquivo
 * e este arquivo os registra todos em um único ponto.
 *
 * O Notify aqui funciona como um “hub”:
 *   EventBus → Handlers → NotifyService.enqueue()
 */

import type { EventBus } from '@core/events/event-bus';

// ============================================================
// 🔥 Handlers do módulo WORK
// ============================================================
import { registerWorkNotifyHandlers } from './work-notify.handlers';

// ============================================================
// 🔥 Handlers do módulo RIDES (NOVO)
// ============================================================
import { registerRidesNotifyHandlers } from './rides-notify.handlers';

export function registerAllNotifyHandlers(eventBus: EventBus): void {
  // ============================================================
  // WORK
  // ============================================================
  registerWorkNotifyHandlers(eventBus);

  // ============================================================
  // RIDES
  // ============================================================
  registerRidesNotifyHandlers(eventBus);

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
