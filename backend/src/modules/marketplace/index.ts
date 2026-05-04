// backend/src/modules/marketplace/index.ts
// SPRINT 37.1: MARKETPLACE CORE - Catálogo Canônico
// SPRINT 37.2: MARKETPLACE CORE - Produto & Variante
// SPRINT 37.3: MARKETPLACE CORE - Estoque (Movimentação)
// SPRINT 37.4: MARKETPLACE CORE - Lote & Validade (Opt-In)
// SPRINT 38.1: MARKETPLACE EXECUÇÃO - Order Core
// SPRINT 38.2: MARKETPLACE EXECUÇÃO - Order Lifecycle
// SPRINT 39.1: MARKETPLACE EXECUÇÃO - Payment Intent
// Exportações do módulo Marketplace

export { marketplaceService, MarketplaceService } from './marketplace.service';
import './marketplace-seed'; // side-effect: seed quando ENABLE_MARKETPLACE_SEED=true
export { productCatalogService } from './product-catalog.service';
// TODO: ADAPTER -> categories (core) - productCategoryRepository será removido após migração para categories core
export { productCategoryRepository } from './product-category.repository';
export { productAttributeRepository } from './product-attribute.repository';
export { productRepository } from './product.repository';
export { productVariantRepository } from './product-variant.repository';
export { inventoryService } from './inventory.service';
export { inventoryMovementRepository } from './inventory-movement.repository';
export { inventoryBalanceRepository } from './inventory-balance.repository';
export { inventoryLotService } from './inventory-lot.service';
export { inventoryLotRepository } from './inventory-lot.repository';
export { orderService } from './order.service';
export { orderRepository } from './order.repository';
export { orderItemRepository } from './order-item.repository';
export { orderStatusHistoryRepository } from './order-status-history.repository';
export { paymentIntentService } from './payment-intent.service';
export { paymentIntentRepository } from './payment-intent.repository';
export { paymentExecutionService } from './payment-execution.service';
export { fiscalDocumentService } from './fiscal-document.service';
export { fiscalDocumentRepository } from './fiscal-document.repository';
export { fiscalIssuanceService } from './fiscal-issuance.service';
export { mockFiscalProvider } from './fiscal-provider.mock';
export { sefazFiscalProvider } from './fiscal-provider.sefaz'; // SPRINT 53
export { fiscalProviderAttemptRepository } from './fiscal-provider-attempt.repository'; // SPRINT 53
export { fulfillmentService } from './fulfillment.service'; // SPRINT 54
export { fulfillmentRepository } from './fulfillment.repository'; // SPRINT 54
export { stockTransferService } from './stock-transfer.service'; // SPRINT 55
export { stockTransferRepository } from './stock-transfer.repository'; // SPRINT 55
export { stockTransferReceiptService } from './stock-transfer-receipt.service'; // SPRINT 56
export { stockTransferReceiptRepository } from './stock-transfer-receipt.repository'; // SPRINT 56
export { inventoryAdjustmentService } from './inventory-adjustment.service'; // SPRINT 57
export { inventoryAdjustmentRepository } from './inventory-adjustment.repository'; // SPRINT 57
export { inventorySlaService } from './inventory-sla.service'; // SPRINT 58
export { inventorySuggestionService } from './inventory-suggestion.service'; // SPRINT 59
export { inventoryHoldingCostService } from './inventory-holding-cost.service'; // SPRINT 60
export { realMarginService } from './real-margin.service'; // SPRINT 61
export { decisionSimulationService } from './decision-simulation.service'; // SPRINT 62
export { pricingStrategyService } from './pricing-strategy.service'; // SPRINT 63
export type { FiscalProvider } from './fiscal-provider.interface';
export type {
  FulfillmentOrder,
  FulfillmentItem,
  FulfillmentSource,
  FulfillmentStatus,
  FulfillmentItemStatus,
  CreateFulfillmentOrderInput,
  PickFulfillmentItemInput,
  ShipFulfillmentOrderInput,
} from './fulfillment.types'; // SPRINT 54
export type {
  StockTransfer,
  StockTransferItem,
  StockTransferStatus,
  CreateStockTransferInput,
  AddStockTransferItemInput,
  ShipStockTransferInput,
  ReceiveStockTransferInput,
} from './stock-transfer.types'; // SPRINT 55
export type {
  StockTransferReceipt,
  StockTransferReceiptItem,
  StockTransferReceiptStatus,
  StartReceiptInput,
  ReceiveItemInput,
  FinalizeReceiptInput,
} from './stock-transfer-receipt.types'; // SPRINT 56
export type {
  InventoryAdjustment,
  InventoryAdjustmentType,
  InventoryAdjustmentReferenceType,
  CreateInventoryAdjustmentInput,
  ListInventoryAdjustmentsOptions,
} from './inventory-adjustment.types'; // SPRINT 57
export type {
  StockAging,
  TransferSla,
  GetStockAgingOptions,
  GetTransferSlaOptions,
  SlaConfig,
} from './inventory-sla.types'; // SPRINT 58
export type {
  InventorySuggestion,
  InventorySuggestionType,
  ConfidenceLevel,
  SuggestionReasonCode,
  GetInventorySuggestionsOptions,
  SuggestionConfig,
} from './inventory-suggestion.types'; // SPRINT 59
export type {
  InventoryHoldingCost,
  CostLevel,
  GetHoldingCostsOptions,
  HoldingCostConfig,
} from './inventory-holding-cost.types'; // SPRINT 60
export type {
  RealMarginReport,
  MarginChannel,
  GetMarginOptions,
  MarginConfig,
} from './real-margin.types'; // SPRINT 61
export type {
  DecisionSimulationResult,
  ScenarioType,
  SimulatePriceChangeInput,
  SimulateDiscountInput,
  SimulateTransferInput,
  SimulateStockReductionInput,
  SimulationInput,
} from './decision-simulation.types'; // SPRINT 62
export type {
  PricingStrategyInsight,
  GetPricingStrategyOptions,
} from './pricing-strategy.types'; // SPRINT 63
export type {
  FiscalIssueResult,
  FiscalCancelResult,
  FiscalStatus,
  FiscalDocumentData,
} from './fiscal-provider.types';
export { pricingService } from './pricing.service';
export { productPriceRepository } from './product-price.repository';
export { promotionRepository } from './promotion.repository';
export type {
  ProductPrice,
  Promotion,
  PriceBreakdown,
  PricingContext,
  CreateProductPriceInput,
  CreatePromotionInput,
} from './pricing.types';
export type {
  ProductType,
  ProductAttributeDataType,
  ProductCategory,
  CreateProductCategoryInput,
  UpdateProductCategoryInput,
  ListProductCategoriesOptions,
  ProductAttribute,
  CreateProductAttributeInput,
  UpdateProductAttributeInput,
  ListProductAttributesOptions,
  Product,
  CreateProductInput,
  UpdateProductInput,
  ListProductsOptions,
  ProductVariant,
  CreateProductVariantInput,
  UpdateProductVariantInput,
} from './product-catalog.types';
export type {
  InventoryMovementType,
  InventoryMovement,
  CreateInventoryMovementInput,
  ListInventoryMovementsOptions,
  InventoryBalance,
  InventoryLot,
  CreateInventoryLotInput,
} from './inventory.types';
export type {
  OrderStatus,
  Order,
  CreateOrderInput,
  UpdateOrderInput,
  ListOrdersOptions,
  OrderItem,
  AddOrderItemInput,
  UpdateOrderItemInput,
  OrderStatusHistory,
  ChangeOrderStatusInput,
} from './order.types';
export type {
  PaymentIntentStatus,
  PaymentCurrency,
  PaymentIntent,
  CreatePaymentIntentInput,
  UpdatePaymentIntentInput,
  PaymentTransactionStatus,
  PaymentTransaction,
  ExecutePaymentInput,
} from './payment-intent.types';
export type {
  PaymentSplitRole,
  PaymentSplit,
  CreatePaymentSplitInput,
  DefineSplitsInput,
} from './payment-split.types';
export type {
  PayoutTransactionStatus,
  PayoutTransaction,
  ExecutePayoutInput,
} from './payout.types';

