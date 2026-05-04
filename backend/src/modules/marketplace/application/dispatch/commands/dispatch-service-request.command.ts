// backend/src/modules/marketplace/application/dispatch/commands/dispatch-service-request.command.ts
// Comando: dispatch de requisição de serviço (CQRS - command).

import type { MarketplaceDispatchModule } from '../../../domain/dispatch/marketplace-dispatch.service';
import type { ServiceDispatch } from '@contracts/marketplace';

export class DispatchServiceRequestCommand {
  constructor(private readonly dispatchModule: MarketplaceDispatchModule) {}

  execute(tenantId: string, requestId: string): Promise<ServiceDispatch> {
    return this.dispatchModule.dispatchServiceRequest(tenantId, requestId);
  }
}