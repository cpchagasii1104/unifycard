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
export declare function registerAllNotifyHandlers(eventBus: EventBus): void;
//# sourceMappingURL=index.d.ts.map