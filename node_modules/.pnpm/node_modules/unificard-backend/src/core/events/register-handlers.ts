// src/core/events/register-handlers.ts
// Registro centralizado de handlers do EventBus
// Chamado no bootstrap (server.ts) DEPOIS de tudo estar inicializado
// Isso evita circular imports e problemas de TDZ

import { eventBus } from './event-bus';

// ⭐ REPUTATION HANDLERS
import { registerReputationEventHandlers } from '@core/reputation/reputation.events';

// ⭐ NOTIFY HANDLERS (Work + futuros módulos)
import { registerAllNotifyHandlers } from '@core/notify/handlers';

// ⭐ Orchestrator Work Handlers
import { onJobCreated, onAssignmentCompleted } from '../orchestrator/executors/work.executors';

// ⭐ Groups Handlers
import { handleGroupCreated, handleGroupMemberJoined, handleGroupMemberLeft, handleGroupFundReceived } from '../orchestrator/executors/groups.executors';

// ⭐ Groups Activity Handlers
import { onGroupFundReceived } from '../orchestrator/executors/groups-activity.executors';

// ⭐ Canonical Event Adapters
import { registerWorkAdapters } from '../orchestrator/adapters/work.adapter';
import { registerRidesAdapters } from '../orchestrator/adapters/rides.adapter';

/**
 * Registra todos os handlers do EventBus
 * Deve ser chamado no bootstrap (server.ts) DEPOIS de buildApp()
 */
export function registerCoreHandlers(): void {
  console.log("🔵 [DEBUG] Registering EventBus handlers...");
  
  // 🔥 Reputation (escuta core.review.created)
  registerReputationEventHandlers(eventBus);

  // 🔥 Notify (escuta eventos do Work e outros módulos)
  registerAllNotifyHandlers(eventBus);

  // 🔥 Orchestrator Work Handlers (escuta eventos do Work para Memory/AI)
  eventBus.registerHandler('work.job.created', onJobCreated);
  eventBus.registerHandler('work.assignment.completed', onAssignmentCompleted);

  // 🔥 Groups Handlers (escuta eventos de grupos para Memory/AI)
  eventBus.registerHandler('group.created', handleGroupCreated);
  eventBus.registerHandler('group.member.joined', handleGroupMemberJoined);
  eventBus.registerHandler('group.member.left', handleGroupMemberLeft);
  eventBus.registerHandler('group.fund.received', handleGroupFundReceived);

  // 🔥 Groups Activity Handlers (cria auto-posts econômicos)
  eventBus.registerHandler('group.fund.received', onGroupFundReceived);

  // 🔥 Canonical Event Adapters (tradução para formato canônico)
  registerWorkAdapters();
  registerRidesAdapters();

  console.log("🔵 [DEBUG] EventBus handlers registered");
}













