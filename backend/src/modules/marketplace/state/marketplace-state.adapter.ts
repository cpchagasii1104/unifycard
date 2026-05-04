// backend/src/modules/marketplace/state/marketplace-state.adapter.ts
// Adapter que centraliza o acesso aos stores do módulo.
// Os stores continuam no facade; o adapter apenas expõe acesso estruturado.

import type {
  ServiceVisit,
  ServiceQuote,
  ServiceOrder,
  ServiceRequest,
  ServiceDispatch,
  ServicePreReservation,
  DisputeCase,
  PaymentTerminal,
  RegionalCapacitySnapshot,
} from '@contracts/marketplace';

type ServiceBookingMap = Map<string, {
  booking_id: string;
  offeringId: string;
  user_id: string;
  date: string;
  time: string;
  quantity: number;
  status: string;
  createdAt: string;
}>;

/**
 * Interface de leitura de estado para domain modules (tipo derivado do adapter).
 * Domain depende desta interface, não do adapter nem do facade.
 * Tipos sempre sincronizados com MarketplaceStateAdapter.
 *
 * Regra: domain modules não devem mutar estes Maps (somente leitura).
 * Mutação fica a cargo dos módulos donos do estado (ex.: DispatchModule, OfferingsModule).
 */
export type IMarketplaceStateReader = Pick<
  MarketplaceStateAdapter,
  | 'serviceBookings'
  | 'serviceOrders'
  | 'serviceRequests'
  | 'serviceDispatches'
  | 'preReservations'
  | 'disputeCases'
  | 'paymentTerminals'
>;

/**
 * Fonte mínima de estado (facade ou objeto que expõe os Maps).
 * Permite testar o adapter sem instanciar o facade completo.
 */
export interface IMarketplaceStateSource {
  getServiceVisitsMap(): Map<string, ServiceVisit>;
  getServiceQuotesMap(): Map<string, ServiceQuote>;
  getServiceBookingsMap(): ServiceBookingMap;
  getServiceOrdersMap(): Map<string, ServiceOrder>;
  getServiceRequestsMap(): Map<string, ServiceRequest>;
  getServiceDispatchesMap(): Map<string, ServiceDispatch>;
  getServicePreReservationsMap(): Map<string, ServicePreReservation>;
  getPaymentTerminalsMap(): Map<string, PaymentTerminal>;
  getDisputeCasesMap(): Map<string, DisputeCase>;
  getRegionalCapacitySnapshotsMap(): Map<string, RegionalCapacitySnapshot>;
}

/**
 * Adapter de estado do módulo marketplace.
 * Centraliza todos os acessos aos stores; consumidores usam state.serviceBookings em vez de deps.getServiceBookingsMap().
 * Implementa IMarketplaceStateReader para injeção em domain modules.
 */
export class MarketplaceStateAdapter implements IMarketplaceStateReader {
  constructor(private readonly source: IMarketplaceStateSource) {}

  get serviceVisits(): Map<string, ServiceVisit> {
    return this.source.getServiceVisitsMap();
  }

  get serviceQuotes(): Map<string, ServiceQuote> {
    return this.source.getServiceQuotesMap();
  }

  get serviceBookings(): ServiceBookingMap {
    return this.source.getServiceBookingsMap();
  }

  get serviceOrders(): Map<string, ServiceOrder> {
    return this.source.getServiceOrdersMap();
  }

  get serviceRequests(): Map<string, ServiceRequest> {
    return this.source.getServiceRequestsMap();
  }

  get serviceDispatches(): Map<string, ServiceDispatch> {
    return this.source.getServiceDispatchesMap();
  }

  get preReservations(): Map<string, ServicePreReservation> {
    return this.source.getServicePreReservationsMap();
  }

  get paymentTerminals(): Map<string, PaymentTerminal> {
    return this.source.getPaymentTerminalsMap();
  }

  get disputeCases(): Map<string, DisputeCase> {
    return this.source.getDisputeCasesMap();
  }

  get regionalCapacitySnapshots(): Map<string, RegionalCapacitySnapshot> {
    return this.source.getRegionalCapacitySnapshotsMap();
  }
}