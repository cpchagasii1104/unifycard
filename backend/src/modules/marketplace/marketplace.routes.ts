// backend/src/modules/marketplace/marketplace.routes.ts
// SPRINT 41.1: MARKETPLACE OPERÁVEL (API + UI MÍNIMA)
// Rotas REST para operar o marketplace end-to-end
//
// Regra de arquitetura: este ficheiro deve ser um agregador fino.
// Rotas por domínio devem ficar em routes/marketplace-*.routes.ts e ser registadas
// via registerMarketplace*Routes(). Não adicionar grandes blocos de rotas inline aqui.
// Fluxo: routes → MarketplaceService (facade) → aggregators → application → domain.

import { FastifyPluginAsync } from 'fastify';
import { marketplaceService } from './marketplace.service';
import { marketplaceLogger } from './marketplace.logger';
import supplierRoutes from './supplier.routes'; // SPRINT 69
import purchaseOrderRoutes from './purchase-order.routes'; // SPRINT 69
import accountsPayableRoutes from './accounts-payable.routes'; // SPRINT 70
import accountsReceivableRoutes from './accounts-receivable.routes'; // SPRINT 71
import paymentMethodRoutes from './payment-method.routes'; // SPRINT 72
import unifyCardRoutes from './unifycard.routes'; // SPRINT 73
import settlementRoutes from './settlement.routes'; // SPRINT 77
import taxProfileRoutes from './tax-profile.routes'; // SPRINT 80
import businessSegmentRoutes from './business-segment.routes'; // SPRINT 81
import unifyCardMethodRoutes from './unifycard-method.routes'; // SPRINT 82
import regionalFeeRoutes from './regional-fee.routes'; // SPRINT 83
import eventSettlementRoutes from './event-settlement.routes'; // SPRINT 84
import financialAgendaRoutes from './financial-agenda.routes'; // SPRINT 85
import contactRoutes from './contact.routes'; // SPRINT 0
import fiscalKycRoutes from './fiscal-kyc.routes'; // SPRINT 84
import pixRoutes from '../payments/pix.routes'; // SPRINT 85
import { venueAdminRoutes } from '../venue/venue.routes'; // SPRINT 92
import loyaltyRoutes from '../loyalty/loyalty.routes'; // SPRINT 93
import presenceRoutes from '../presence/presence.routes'; // SPRINT 94
import liveChatRoutes from '../live-chat/live-chat.routes'; // SPRINT 95
import { registerMarketplaceDispatchRoutes } from './routes/marketplace-dispatch.routes';
import { registerMarketplaceOrdersRoutes } from './routes/marketplace-orders.routes';
import { registerMarketplaceCompanyRoutes } from './routes/marketplace-company.routes';
import { registerMarketplaceCapacityRoutes } from './routes/marketplace-capacity.routes';
import { registerMarketplaceServicesRoutes } from './routes/marketplace-services.routes';
import { registerMarketplaceCheckoutRoutes } from './routes/marketplace-checkout.routes';
import { registerMarketplaceGovernanceRoutes } from './routes/marketplace-governance.routes';
import { registerCatalogRoutes } from './routes/marketplace-catalog.routes';
import { registerMarketplacePaymentsRoutes } from './routes/marketplace-payments.routes';
import { registerPricingRoutes } from './routes/marketplace-pricing.routes';
import { registerMarketplaceInventoryRoutes } from './routes/marketplace-inventory.routes';
import { registerMarketplaceRefsRoutes } from './routes/marketplace-refs.routes';
import { registerMarketplacePaymentPlanRoutes } from './routes/marketplace-payment-plan.routes';
import { registerMarketplaceDeliveryRoutes } from './routes/marketplace-delivery.routes';
import { registerMarketplacePdvDeprecatedRoutes } from './routes/marketplace-pdv-deprecated.routes';
import { registerMarketplaceSubscriptionsRoutes } from './routes/marketplace-subscriptions.routes';
import { registerMarketplaceIndustriesRoutes } from './routes/marketplace-industries.routes';
import { registerMarketplaceHubsRoutes } from './routes/marketplace-hubs.routes';
import { registerMarketplaceTrustRoutes } from './routes/marketplace-trust.routes';
import { registerMarketplaceRegionalImpactRoutes } from './routes/marketplace-regional-impact.routes';
import { registerMarketplaceExpansionRoutes } from './routes/marketplace-expansion.routes';
import { registerMarketplaceIncentivesRoutes } from './routes/marketplace-incentives.routes';
import { registerMarketplaceB2BRoutes } from './routes/marketplace-b2b.routes';
import { registerMarketplaceProductionRoutes } from './routes/marketplace-production.routes';
import { registerMarketplaceEconomicRoutes } from './routes/marketplace-economic.routes';
import { registerMarketplaceTemplatesRoutes } from './routes/marketplace-templates.routes';
import { registerMarketplacePluginsRoutes } from './routes/marketplace-plugins.routes';
import { registerVouchersRoutes } from './routes/marketplace-vouchers.routes';
import b2bSupplyOrderRoutes from './b2b-supply-order.routes';

const marketplaceRoutes: FastifyPluginAsync = async (fastify) => {
  marketplaceLogger.init('Rotas protegidas do Marketplace registradas');

  // Rotas por domínio (handlers em routes/*.routes.ts; sem handlers inline)
  registerMarketplaceDispatchRoutes(fastify, marketplaceService);
  registerMarketplaceOrdersRoutes(fastify, marketplaceService);
  registerMarketplaceCompanyRoutes(fastify, marketplaceService);
  registerMarketplaceCapacityRoutes(fastify, marketplaceService);
  // Rotas /marketplace/services/* (templates, offerings, booking, etc.): fonte única em marketplace-services.routes.ts
  registerMarketplaceServicesRoutes(fastify, marketplaceService);
  registerMarketplaceCheckoutRoutes(fastify, marketplaceService);
  await registerMarketplaceGovernanceRoutes(fastify, marketplaceService);
  await registerCatalogRoutes(fastify);
  registerMarketplacePaymentsRoutes(fastify, marketplaceService);
  await registerPricingRoutes(fastify);
  registerMarketplaceInventoryRoutes(fastify, marketplaceService);
  await registerMarketplaceRefsRoutes(fastify, marketplaceService);
  registerMarketplaceTemplatesRoutes(fastify, marketplaceService);
  await registerMarketplacePluginsRoutes(fastify);
  await registerVouchersRoutes(fastify);
  await registerMarketplacePaymentPlanRoutes(fastify, marketplaceService);
  await registerMarketplaceDeliveryRoutes(fastify, marketplaceService);
  await registerMarketplacePdvDeprecatedRoutes(fastify);
  await registerMarketplaceSubscriptionsRoutes(fastify, marketplaceService);
  await registerMarketplaceIndustriesRoutes(fastify, marketplaceService);
  await registerMarketplaceHubsRoutes(fastify, marketplaceService);
  await registerMarketplaceTrustRoutes(fastify, marketplaceService);
  await registerMarketplaceRegionalImpactRoutes(fastify, marketplaceService);
  await registerMarketplaceExpansionRoutes(fastify, marketplaceService);
  await registerMarketplaceIncentivesRoutes(fastify, marketplaceService);
  await registerMarketplaceB2BRoutes(fastify, marketplaceService);
  await registerMarketplaceProductionRoutes(fastify, marketplaceService);
  await registerMarketplaceEconomicRoutes(fastify, marketplaceService);

  // B2B supply orders (tenant ↔ tenant); pagamento: POST .../b2b-supply-orders/:id/execute-payment (Bank ledger)
  await fastify.register(b2bSupplyOrderRoutes);

  // SPRINT 69: Suppliers + Purchase Orders
  await fastify.register(supplierRoutes);
  await fastify.register(purchaseOrderRoutes);
  // SPRINT 70: Accounts Payable
  await fastify.register(accountsPayableRoutes);
  // SPRINT 71: Accounts Receivable
  await fastify.register(accountsReceivableRoutes);
  // SPRINT 72: Payment Methods
  await fastify.register(paymentMethodRoutes);
  // SPRINT 73: UnifyCard Acquiring
  await fastify.register(unifyCardRoutes);
  // SPRINT 77: Settlement Regional
  await fastify.register(settlementRoutes);
  // SPRINT 80: Tax Profile
  await fastify.register(taxProfileRoutes);
  // SPRINT 81: Business Segment
  await fastify.register(businessSegmentRoutes);
  // SPRINT 82: UnifyCard Methods
  await fastify.register(unifyCardMethodRoutes);
  // SPRINT 83: Regional Fees
  await fastify.register(regionalFeeRoutes);
  // SPRINT 84: Event Settlements
  await fastify.register(eventSettlementRoutes);
  // SPRINT 85: Financial Agenda
  await fastify.register(financialAgendaRoutes);
  // SPRINT 0: Contacts
  await fastify.register(contactRoutes);
  // SPRINT 84: Fiscal KYC
  await fastify.register(fiscalKycRoutes);
  // SPRINT 85: PIX
  await fastify.register(pixRoutes);
  // F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7): o módulo crm.* (SPRINT 88) foi REMOVIDO —
  // reaches vivo e SEM guard nas tabelas fantasma crm_notes/crm_tags/crm_consents/crm_contact_tags
  // (bomba de 42P01 em runtime, achado do read-first). CRM agora é PROJEÇÃO da aresta de relação
  // tipada (GET /relationships/mine?label=) + suppliers reconciliado — nunca módulo próprio.
  // SPRINT 92: Venue (Menu + Tab)
  await fastify.register(venueAdminRoutes);
  // SPRINT 93: Loyalty / Fidelidade
  await fastify.register(loyaltyRoutes, { prefix: '/loyalty' });
  // SPRINT 94: Presence / Check-in Social
  await fastify.register(presenceRoutes, { prefix: '/presence' });
  // SPRINT 95: Live Chat / Presença ao Vivo
  await fastify.register(liveChatRoutes, { prefix: '/live' });
};

export default marketplaceRoutes;
