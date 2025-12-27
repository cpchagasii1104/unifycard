/**
 * Handlers de notificação do módulo RIDES.
 *
 * Eventos escutados (sugeridos):
 * - rides.ride_request.created
 * - rides.ride.driver_assigned
 * - rides.ride.driver_arrived
 * - rides.ride.started
 * - rides.ride.completed
 * - rides.ride.cancelled
 * - rides.driver.forced_break
 * - rides.zone.high_demand
 */
import type { EventBus } from '@core/events/event-bus';
export declare function registerRidesNotifyHandlers(eventBus: EventBus): void;
//# sourceMappingURL=rides-notify.handlers.d.ts.map