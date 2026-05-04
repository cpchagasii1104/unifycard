// backend/src/modules/marketplace/application/dispatch/commands/accept-dispatch.command.ts
// Comando: aceitar dispatch de serviço (CQRS - command).

import type { MarketplaceDispatchModule } from '../../../domain/dispatch/marketplace-dispatch.service';
import type { Order } from '@contracts/marketplace';

export class AcceptDispatchCommand {
  constructor(private readonly dispatchModule: MarketplaceDispatchModule) {}

  execute(tenantId: string, dispatchId: string, providerActorId: string): Promise<Order> {
    return this.dispatchModule.acceptServiceDispatch(tenantId, dispatchId, providerActorId);
  }
}