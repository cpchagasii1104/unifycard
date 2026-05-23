// src/core/events/register-handlers.ts
// Registro centralizado de handlers do EventBus
// Chamado no bootstrap (server.ts) DEPOIS de tudo estar inicializado
// Isso evita circular imports e problemas de TDZ

import { eventBus } from './event-bus';
import { registerSagaCompensationHandler } from '@core/sagas/handlers/saga-compensation.handler';

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

// ⭐ Marketplace — dispatch aceito (outbox → worker → bus canónico)
import { registerMarketplaceDispatchAcceptedHandlers } from '@modules/marketplace/application/handlers/register-marketplace-dispatch-accepted-handlers';

// ⭐ Event Feed Handlers (cria posts no feed quando eventos são criados/publicados)
import { socialPortsRegistry } from '@core/social/ports-registry';

/**
 * Registra todos os handlers do EventBus
 * Deve ser chamado no bootstrap (server.ts) DEPOIS de buildApp()
 */
export async function registerCoreHandlers(): Promise<void> {
  console.log("🔵 [DEBUG] Registering EventBus handlers...");
  
  // 🔥 Reputation (escuta core.review.created)
  registerReputationEventHandlers(eventBus);

  // 🔥 Notify (escuta eventos do Work e outros módulos)
  registerAllNotifyHandlers(eventBus);

  // 🔥 Marketplace — DispatchAcceptedEvent (fila outbox + worker)
  registerMarketplaceDispatchAcceptedHandlers(eventBus);

  // 🔥 Sagas — compensação ledger controlada em handler (INFRA-4.2; não em failSaga)
  registerSagaCompensationHandler(eventBus);

  // 🔥 Orchestrator Work Handlers (escuta eventos do Work para Memory/AI)
  eventBus.registerHandler('work.job.created', 'orchestrator.work.job_created', onJobCreated);
  eventBus.registerHandler('work.assignment.completed', 'orchestrator.work.assignment_completed', onAssignmentCompleted);

  // 🔥 Groups Handlers (escuta eventos de grupos para Memory/AI)
  eventBus.registerHandler('group.created', 'orchestrator.groups.created', handleGroupCreated);
  eventBus.registerHandler('group.member.joined', 'orchestrator.groups.member_joined', handleGroupMemberJoined);
  eventBus.registerHandler('group.member.left', 'orchestrator.groups.member_left', handleGroupMemberLeft);
  eventBus.registerHandler('group.fund.received', 'orchestrator.groups.fund_received.memory', handleGroupFundReceived);

  // 🔥 Groups Activity Handlers (cria auto-posts econômicos)
  eventBus.registerHandler('group.fund.received', 'orchestrator.groups.fund_received.activity', onGroupFundReceived);

  // 🔥 Event Feed Handlers (cria posts no feed quando eventos são criados/publicados)
  const eventFeedHandlers = socialPortsRegistry.getEventFeedHandlers();
  eventFeedHandlers.registerEventFeedHandlers();

  // 🔥 Canonical Event Adapters (tradução para formato canônico)
  await registerWorkAdapters();
  await registerRidesAdapters();

  // 🔥 Read Model Projectors (projeta Read Models a partir de Effects)
  // Import dinâmico para evitar dependência circular
  import('@core/read-models/read-model.projector').then(async ({ registerReadModelHandlers }) => {
    await registerReadModelHandlers();
  }).catch((err) => {
    console.error('[register-handlers] Erro ao registrar Read Model handlers:', err);
  });

  console.log("🔵 [DEBUG] EventBus handlers registered");
}












