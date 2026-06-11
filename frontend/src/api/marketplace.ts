// src/api/marketplace.ts
// API do Marketplace (end-to-end)
import { apiFetch, apiFetchJson } from './client';

// ============================================================
// VITRINE / HOME
// ============================================================

export interface MarketplaceHome {
  domain: string;
  version: string;
  sections: Array<{
    id: string;
    title: string;
    type: string;
    order: number;
  }>;
}

export async function getHome(): Promise<MarketplaceHome> {
  return apiFetchJson<MarketplaceHome>('/marketplace/home');
}

// ============================================================
// CATEGORIAS DE PRODUTO
// ============================================================

export interface MarketplaceCategory {
  id: string;
  name: string;
  templates: string[];
  children?: Array<{
    id: string;
    name: string;
    templates: string[];
  }>;
}

export interface MarketplaceCategories {
  domain: string;
  version: string;
  categories: MarketplaceCategory[];
}

export async function getCategories(): Promise<MarketplaceCategories> {
  // BLOCKED_BY_FRONTEND_DEPENDENCY: Endpoint específico do marketplace mantido
  // Backend já usa adapter sobre categories core
  return apiFetchJson<MarketplaceCategories>('/marketplace/categories');
}

// ============================================================
// LOJAS E FILIAIS
// ============================================================

export interface MarketplaceBranch {
  branch_id: string;
  name: string;
  city: string;
  neighborhood?: string | null;
  pickup: boolean;
  delivery: boolean;
}

export interface MarketplaceStore {
  store_id: string;
  name: string;
  template_id: string;
  branches: MarketplaceBranch[];
  location?: { visible_in_locator?: boolean };
}

export interface MarketplaceStores {
  domain: string;
  version: string;
  scope_applied?: {
    scope: string;
    value: string;
    filter_field: string;
  };
  stores: MarketplaceStore[];
}

export interface GetStoresParams {
  scope?: string;
  value?: string;
}

export async function getStores(params?: GetStoresParams): Promise<MarketplaceStores> {
  const queryParams = new URLSearchParams();
  if (params?.scope) {
    queryParams.append('scope', params.scope);
  }
  if (params?.value) {
    queryParams.append('value', params.value);
  }
  
  const queryString = queryParams.toString();
  const url = `/marketplace/stores${queryString ? `?${queryString}` : ''}`;
  
  return apiFetchJson<MarketplaceStores>(url);
}

// ============================================================
// CATÁLOGO DA LOJA
// ============================================================

export interface StoreCatalog {
  store_id: string;
  name: string;
  template_id: string;
  categories: Array<{
    id: string;
    name: string;
  }>;
}

export async function getStoreCatalog(storeId: string): Promise<StoreCatalog> {
  return apiFetchJson<StoreCatalog>(`/marketplace/store/${storeId}/catalog`);
}

// ============================================================
// CATÁLOGO CANÔNICO DE PRODUTOS
// ============================================================

export interface CanonicalProduct {
  id: string;
  name: string;
  description: string;
  category_id: string;
  attributes: Record<string, any>;
  images: string[];
}

export interface CanonicalProducts {
  domain: string;
  version: string;
  products: CanonicalProduct[];
}

export async function getCanonicalProducts(): Promise<CanonicalProducts> {
  return apiFetchJson<CanonicalProducts>('/marketplace/products/canonical');
}

// ============================================================
// PRODUTOS ATIVADOS POR LOJA
// ============================================================

export interface StoreProduct {
  product_id: string;
  name: string;
  description: string;
  category_id: string;
  attributes: Record<string, any>;
  images: string[];
  enabled: boolean;
  price: {
    amount: number;
    currency: string;
  } | null;
  stock: {
    quantity: number;
    unit: string;
  } | null;
  // Produtos industriais (dropship)
  industry_id?: string; // Se presente, produto é industrial
  hub_id?: string; // Hub que fará o fulfillment
  is_industrial?: boolean; // Flag para identificação rápida
}

export interface StoreProducts {
  domain: string;
  version: string;
  store_id: string;
  products: StoreProduct[];
}

export interface GetStoreProductsParams {
  categoryId?: string;
}

export async function getStoreProducts(storeId: string, params?: GetStoreProductsParams): Promise<StoreProducts> {
  const queryParams = new URLSearchParams();
  if (params?.categoryId) {
    queryParams.append('category_id', params.categoryId);
  }
  
  const queryString = queryParams.toString();
  const url = `/marketplace/store/${storeId}/products${queryString ? `?${queryString}` : ''}`;
  
  return apiFetchJson<StoreProducts>(url);
}

// ============================================================
// PEDIDOS (CARRINHO)
// ============================================================

export interface OrderItem {
  product_id: string;
  name: string;
  price: {
    amount: number;
    currency: string;
  };
  quantity: number;
  subtotal: number;
}

export interface Order {
  order_id: string;
  store_id: string;
  channel: 'online' | 'physical' | 'b2b';
  origin: 'marketplace' | 'store_pdv' | 'external';
  customer_id?: string;
  items: OrderItem[];
  total: number;
}

export interface CreateOrderInput {
  store_id: string;
}

export interface AddOrderItemInput {
  product_id: string;
  quantity: number;
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return apiFetchJson<Order>('/marketplace/order', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addOrderItem(orderId: string, input: AddOrderItemInput): Promise<Order> {
  return apiFetchJson<Order>(`/marketplace/order/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getOrder(orderId: string): Promise<Order> {
  return apiFetchJson<Order>(`/marketplace/order/${orderId}`);
}

// ============================================================
// CHECKOUT INTENT
// ============================================================

export interface CheckoutOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface CheckoutOrder {
  store_id: string;
  items: CheckoutOrderItem[];
  subtotal: number;
}

export interface CheckoutIntent {
  checkout_id: string;
  orders: CheckoutOrder[];
  total: number;
  payment_options: {
    allow_balance: boolean;
    allow_card: boolean;
    allow_invoice: boolean;
  };
  status: 'open' | 'confirmed';
}

export async function createCheckoutFromOrder(orderId: string): Promise<CheckoutIntent> {
  return apiFetchJson<CheckoutIntent>(`/marketplace/checkout/from-order/${orderId}`, {
    method: 'POST',
  });
}

export async function getCheckout(checkoutId: string): Promise<CheckoutIntent> {
  return apiFetchJson<CheckoutIntent>(`/marketplace/checkout/${checkoutId}`);
}

export async function confirmCheckout(checkoutId: string): Promise<CheckoutIntent> {
  return apiFetchJson<CheckoutIntent>(`/marketplace/checkout/${checkoutId}/confirm`, {
    method: 'POST',
  });
}

// ============================================================
// PAYMENT ORCHESTRATOR (PAYMENT PLAN)
// ============================================================

export interface PaymentSplit {
  type: 'seller' | 'platform' | 'affiliate' | 'regional_fund';
  target_id: string;
  amount: number;
  currency: string;
}

export interface PaymentPlan {
  payment_plan_id: string;
  checkout_id: string;
  method: 'balance' | 'card' | 'invoice';
  total: number;
  splits: PaymentSplit[]; // ⚠️ NÃO EXPOR NA UX — apenas compatibilidade de contrato (não é fonte de verdade de UI)
  status: 'calculated' | 'executed';
}

export interface CreatePaymentPlanInput {
  method: 'balance' | 'card' | 'invoice';
}

export async function createPaymentPlan(checkoutId: string, input: CreatePaymentPlanInput): Promise<PaymentPlan> {
  return apiFetchJson<PaymentPlan>(`/marketplace/payment-plan/from-checkout/${checkoutId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getPaymentPlan(paymentPlanId: string): Promise<PaymentPlan> {
  return apiFetchJson<PaymentPlan>(`/marketplace/payment-plan/${paymentPlanId}`);
}

export interface ExecutePaymentPlanResult extends PaymentPlan {
  ledgerEntries?: Array<{ entryId: string; accountId: string; entryType: 'credit' | 'debit' }>;
  invoiceId?: string;
}

export async function executePaymentPlan(paymentPlanId: string): Promise<ExecutePaymentPlanResult> {
  return apiFetchJson<ExecutePaymentPlanResult>(`/marketplace/payment-plan/${paymentPlanId}/execute`, {
    method: 'POST',
  });
}

// ============================================================
// LOGÍSTICA (DELIVERY)
// ============================================================

export interface DeliveryOrder {
  delivery_id: string;
  checkout_id: string;
  store_id: string;
  type: 'own' | 'third_party';
  vehicle: 'bike' | 'moto' | 'car' | 'van';
  eta_minutes: number;
  cost: {
    amount: number;
    currency: string;
    payer: 'seller' | 'buyer' | 'platform';
  };
  status: 'created' | 'assigned' | 'in_transit' | 'delivered';
}

export interface CreateDeliveryResult {
  deliveries: DeliveryOrder[];
}

export interface GetDeliveriesResult {
  deliveries: DeliveryOrder[];
}

export async function createDeliveryFromCheckout(checkoutId: string): Promise<CreateDeliveryResult> {
  return apiFetchJson<CreateDeliveryResult>(`/marketplace/delivery/from-checkout/${checkoutId}`, {
    method: 'POST',
  });
}

export async function getDelivery(deliveryId: string): Promise<DeliveryOrder> {
  return apiFetchJson<DeliveryOrder>(`/marketplace/delivery/${deliveryId}`);
}

export async function getDeliveriesByCheckout(checkoutId: string): Promise<GetDeliveriesResult> {
  return apiFetchJson<GetDeliveriesResult>(`/marketplace/delivery/checkout/${checkoutId}`);
}

// PDV canónico: `src/api/pdv.ts` → `/pdv/*` (sessões + orders em PostgreSQL).
// Removido: `/marketplace/pdv/*` (Map em memória).

// ============================================================
// SERVIÇOS, AGENDA E RECORRÊNCIA
// ============================================================

export interface ServiceTemplate {
  template_id: string;
  name: string;
  description: string;
  category_id: string;
  type: 'session' | 'recurring' | 'rental';
  default_duration_minutes?: number;
  pricing_model: 'per_session' | 'per_period';
}

export interface ServiceOffering {
  offering_id: string;
  template_id: string;
  name: string;
  description: string;
  price: {
    amount: number;
    currency: string;
  };
  duration_minutes?: number;
  recurrence?: 'weekly' | 'monthly';
  active: boolean;
}

export interface ServiceAvailability {
  weekday: number;
  start_time: string;
  end_time: string;
  capacity: number;
}

export interface ServiceBooking {
  booking_id: string;
  offering_id: string;
  user_id: string;
  date: string;
  time: string;
  quantity: number;
  status: 'reserved' | 'confirmed' | 'cancelled';
  created_at: string;
}

export interface CreateServiceBookingInput {
  offering_id: string;
  user_id: string;
  date: string;
  time: string;
  quantity: number;
}

export interface ConfirmServiceBookingResult {
  booking_id: string;
  order_id: string;
  offering_id: string;
  price: {
    amount: number;
    currency: string;
  };
}

export async function getServiceTemplates(): Promise<{ domain: string; version: string; templates: ServiceTemplate[] }> {
  return apiFetchJson<{ domain: string; version: string; templates: ServiceTemplate[] }>('/marketplace/services/templates');
}

export async function getStoreServiceOfferings(storeId: string): Promise<{ store_id: string; offerings: ServiceOffering[] }> {
  return apiFetchJson<{ store_id: string; offerings: ServiceOffering[] }>(`/marketplace/services/store/${storeId}/offerings`);
}

export async function getServiceAvailability(offeringId: string): Promise<{ availability: ServiceAvailability[] }> {
  return apiFetchJson<{ availability: ServiceAvailability[] }>(`/marketplace/services/offering/${offeringId}/availability`);
}

export async function createServiceBooking(input: CreateServiceBookingInput): Promise<ServiceBooking> {
  return apiFetchJson<ServiceBooking>('/marketplace/services/booking', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function confirmServiceBooking(bookingId: string): Promise<ConfirmServiceBookingResult> {
  return apiFetchJson<ConfirmServiceBookingResult>(`/marketplace/services/booking/${bookingId}/confirm`, {
    method: 'POST',
  });
}

export async function getServiceBooking(bookingId: string): Promise<ServiceBooking> {
  return apiFetchJson<ServiceBooking>(`/marketplace/services/booking/${bookingId}`);
}

export async function addServiceOrderToOrder(orderId: string, serviceOrderId: string): Promise<Order> {
  return apiFetchJson<Order>(`/marketplace/services/order/${orderId}/add-service/${serviceOrderId}`, {
    method: 'POST',
  });
}

// ============================================================
// LOCALIZAÇÃO & DESCOBERTA
// ============================================================

export interface StoreLocation {
  country: string;
  state: string;
  city: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  visible_in_locator: boolean;
}

export interface NearStoreBranch {
  branch_id: string;
  name: string;
  neighborhood?: string;
  pickup: boolean;
  delivery: boolean;
}

export interface NearStore {
  store_id: string;
  name: string;
  template_id: string;
  branches: NearStoreBranch[];
}

export interface GetStoresNearParams {
  city: string;
  neighborhood?: string;
  category_id?: string;
  template_id?: string;
}

export interface GetStoresNearResult {
  city: string;
  filters_applied: {
    city: string;
    neighborhood?: string;
    category_id?: string;
    template_id?: string;
  };
  stores: NearStore[];
}

export async function getStoresNear(params: GetStoresNearParams): Promise<GetStoresNearResult> {
  const queryParams = new URLSearchParams();
  queryParams.set('city', params.city);
  if (params.neighborhood) queryParams.set('neighborhood', params.neighborhood);
  if (params.category_id) queryParams.set('category_id', params.category_id);
  if (params.template_id) queryParams.set('template_id', params.template_id);
  
  return apiFetchJson<GetStoresNearResult>(`/marketplace/stores/near?${queryParams.toString()}`);
}

// ============================================================
// ATTRIBUTION & SHARING
// ============================================================

export interface AttributionSource {
  type: 'user' | 'group' | 'page' | 'store';
  id: string;
}

export interface AttributionVisibility {
  scope: 'direct' | 'group' | 'friends';
  target_ids?: string[];
}

export interface AttributionCommission {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface AttributionContext {
  attribution_id: string;
  source: AttributionSource;
  intent: 'business' | 'recommendation' | 'entertainment';
  visibility: AttributionVisibility;
  commission?: AttributionCommission;
  created_at: string;
}

export interface CreateShareInput {
  content_type: 'product' | 'service' | 'store';
  content_id: string;
  attribution_context: {
    source: AttributionSource;
    intent: 'business' | 'recommendation' | 'entertainment';
    visibility: AttributionVisibility;
    commission?: AttributionCommission;
  };
}

export interface CreateShareResult {
  share_id: string;
  attribution_id: string;
  share_url: string;
}

export async function createShare(input: CreateShareInput): Promise<CreateShareResult> {
  return apiFetchJson<CreateShareResult>('/marketplace/share', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================
// CATÁLOGO
// ============================================================

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ProductAttribute {
  id: string;
  name: string;
  slug: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit?: string | null;
  isRequired: boolean;
  appliesToCategoryId?: string | null;
  metadata?: Record<string, any>;
}

export async function listCategories(): Promise<ProductCategory[]> {
  const response = await apiFetch('/marketplace/catalog/categories');
  const data = await response.json();
  return data.categories || [];
}

export async function createCategory(input: { name: string; slug?: string; parentId?: string }): Promise<ProductCategory> {
  return apiFetchJson('/marketplace/categories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listAttributes(): Promise<ProductAttribute[]> {
  const response = await apiFetch('/marketplace/attributes');
  const data = await response.json();
  return data.attributes || [];
}

export async function createAttribute(input: {
  name: string;
  slug?: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum';
  unit?: string;
  isRequired?: boolean;
  appliesToCategoryId?: string;
}): Promise<ProductAttribute> {
  return apiFetchJson('/marketplace/attributes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================
// PRODUTOS/VARIANTES
// ============================================================

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  productType: 'UNIT' | 'WEIGHT' | 'LOT';
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  plu?: string | null;
  attributes?: Record<string, any>;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export async function listProducts(): Promise<Product[]> {
  const response = await apiFetch('/marketplace/products');
  const data = await response.json();
  return data.products || [];
}

export async function createProduct(input: {
  name: string;
  description?: string;
  categoryId?: string;
  productType: 'UNIT' | 'WEIGHT' | 'LOT';
}): Promise<Product> {
  return apiFetchJson('/marketplace/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listVariants(productId: string): Promise<ProductVariant[]> {
  const response = await apiFetch(`/marketplace/products/${productId}/variants`);
  const data = await response.json();
  return data.variants || [];
}

export async function createVariant(productId: string, input: {
  sku: string;
  plu?: string;
  attributes?: Record<string, any>;
}): Promise<ProductVariant> {
  return apiFetchJson(`/marketplace/products/${productId}/variants`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================
// ESTOQUE
// ============================================================

export interface InventoryMovement {
  id: string;
  productVariantId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  unit: string;
  reason?: string | null;
  inventoryLotId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

/**
 * Saldo de variante. Backend retorna {quantity, unit} (cf. inventoryService.getCurrentBalance);
 * productVariantId é injetado client-side pelo caller (não está no payload).
 */
export interface InventoryBalance {
  productVariantId: string;
  quantity: number;
  unit: string;
}

export interface InventoryLot {
  id: string;
  productVariantId: string;
  lotCode: string;
  manufactureDate?: string | null;
  expirationDate?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Extrato de movimentos de uma variante NA PERSPECTIVA DE UM ACTOR (ACTOR_PRIVATE).
 * F-INVENTORY-LEGACY-READERS-RECONCILIATION-IMPL-PARTIAL: `actorId` é OBRIGATÓRIO — o
 * backend rejeita sem actorId (400 INVENTORY_ACTOR_ID_REQUIRED) e exige canRepresentActor.
 * Não há mais extrato tenant-wide.
 */
export async function getMovements(
  actorId: string,
  variantId: string,
  filters?: { movementType?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }
): Promise<InventoryMovement[]> {
  const params = new URLSearchParams({ actorId, variantId });
  if (filters?.movementType) params.set('movementType', filters.movementType);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.limit != null) params.set('limit', String(filters.limit));
  if (filters?.offset != null) params.set('offset', String(filters.offset));
  const response = await apiFetch(`/marketplace/inventory/movements?${params.toString()}`);
  const data = await response.json();
  return data.movements || [];
}

/**
 * @deprecated DESATIVADO no backend (501 INVENTORY_TENANT_WIDE_BALANCE_DISABLED).
 * Saldo tenant-wide era leak de recurso privado (DECISION-0116). Sem callers internos.
 * Use `getBalanceByActor(actorId, variantId)` ou o saldo consolidado empresarial
 * (`/inventory/company/:companyId/balance`). Mantido só por compatibilidade externa
 * desconhecida; NÃO criar fallback.
 */
export async function getBalance(variantId: string): Promise<InventoryBalance> {
  const response = await apiFetch(`/marketplace/inventory/balance?variantId=${variantId}`);
  const data = await response.json();
  return { productVariantId: variantId, quantity: data.quantity, unit: data.unit };
}

/**
 * Saldo operacional de uma variante NA PERSPECTIVA DE UM ACTOR (drill-down).
 * Consome GET /marketplace/inventory/balance/by-actor (PASSO 4 do trilho Codex).
 */
export async function getBalanceByActor(
  actorId: string,
  variantId: string
): Promise<InventoryBalance> {
  const response = await apiFetch(
    `/marketplace/inventory/balance/by-actor?actorId=${encodeURIComponent(actorId)}&variantId=${encodeURIComponent(variantId)}`
  );
  const data = await response.json();
  return { productVariantId: variantId, quantity: data.quantity, unit: data.unit };
}

export interface AvailableStock {
  productVariantId: string;
  totalBalance: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export async function getAvailableStock(variantId: string): Promise<AvailableStock> {
  const response = await apiFetch(`/marketplace/inventory/available?variantId=${variantId}`);
  const data = await response.json();
  return data.available;
}

export async function addMovement(input: {
  productVariantId: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  unit: string;
  reason?: string;
  inventoryLotId?: string;
}): Promise<InventoryMovement> {
  return apiFetchJson('/marketplace/inventory/movements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listLots(variantId: string): Promise<InventoryLot[]> {
  const response = await apiFetch(`/marketplace/inventory/lots?variantId=${variantId}`);
  const data = await response.json();
  return data.lots || [];
}

export async function createLot(input: {
  productVariantId: string;
  lotCode: string;
  manufactureDate?: string;
  expirationDate?: string;
}): Promise<InventoryLot> {
  return apiFetchJson('/marketplace/inventory/lots', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ============================================================
// PEDIDOS (LEGADO - Sistema completo com tenant)
// ============================================================

// NOTA: Interfaces renomeadas para evitar conflito com versão pública (carrinho simples)
// A versão pública usa Order e OrderItem definidos acima (linhas 189-205)

export interface LegacyOrder {
  id: string;
  buyerActorId: string;
  sellerActorId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'CANCELLED' | 'EXPIRED';
  totalQuantity: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface LegacyOrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string;
  reason?: string | null;
  createdAt: string;
}

// Funções legadas de pedidos (sistema completo com tenant)
// NOTA: createOrder e addOrderItem agora são da versão pública (carrinho simples)
// Estas funções legadas usam endpoints protegidos (/marketplace/orders)

export async function listOrders(): Promise<LegacyOrder[]> {
  const response = await apiFetch('/marketplace/orders');
  const data = await response.json();
  return data.orders || [];
}

export async function createLegacyOrder(input: {
  buyerActorId: string;
  sellerActorId: string;
}): Promise<LegacyOrder> {
  return apiFetchJson('/marketplace/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function addLegacyOrderItem(orderId: string, input: {
  productVariantId: string;
  quantity: number;
  unit: string;
}): Promise<LegacyOrderItem> {
  return apiFetchJson(`/marketplace/orders/${orderId}/items`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  await apiFetch(`/marketplace/orders/${orderId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function submitOrder(orderId: string): Promise<LegacyOrder> {
  return apiFetchJson(`/marketplace/orders/${orderId}/submit`, {
    method: 'POST',
  });
}

export async function cancelOrder(orderId: string): Promise<LegacyOrder> {
  return apiFetchJson(`/marketplace/orders/${orderId}/cancel`, {
    method: 'POST',
  });
}

export async function getOrderHistory(orderId: string): Promise<OrderStatusHistory[]> {
  const response = await apiFetch(`/marketplace/orders/${orderId}/history`);
  const data = await response.json();
  return data.history || [];
}

// ============================================================
// PAGAMENTOS
// ============================================================

export interface PaymentIntent {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'AUTHORIZED' | 'FAILED' | 'CANCELLED';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  paymentIntentId: string;
  bankTransactionId?: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorCode?: string | null;
  createdAt: string;
}

export interface PaymentSplit {
  id: string;
  paymentIntentId: string;
  recipientActorId: string;
  amount: number;
  percentage?: number | null;
  role: 'SELLER' | 'PLATFORM' | 'FUND' | 'OTHER';
}

export interface PayoutTransaction {
  id: string;
  paymentIntentId: string;
  paymentSplitId: string;
  recipientActorId: string;
  bankTransactionId?: string | null;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  errorCode?: string | null;
  createdAt: string;
}

export async function createPaymentIntent(input: {
  orderId: string;
  amount: number;
  currency?: string;
}): Promise<PaymentIntent> {
  return apiFetchJson('/marketplace/payment-intents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function authorizePaymentIntent(intentId: string): Promise<PaymentIntent> {
  return apiFetchJson(`/marketplace/payment-intents/${intentId}/authorize`, {
    method: 'POST',
  });
}

export async function executePayment(input: {
  paymentIntentId: string;
  buyerActorId: string;
  sellerActorId: string;
  idempotencyKey?: string;
}): Promise<PaymentTransaction> {
  const headers: Record<string, string> = {};
  if (input.idempotencyKey) {
    headers['Idempotency-Key'] = input.idempotencyKey;
  }
  return apiFetchJson('/marketplace/payments/execute', {
    method: 'POST',
    body: JSON.stringify(input),
    headers,
  });
}

export async function defineSplits(paymentIntentId: string, splits: Array<{
  recipientActorId: string;
  amount: number;
  percentage?: number;
  role: 'SELLER' | 'PLATFORM' | 'FUND' | 'OTHER';
}>): Promise<PaymentSplit[]> {
  const response = await apiFetchJson('/marketplace/payment-splits/define', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId, splits }),
  }) as { splits?: PaymentSplit[] };
  return response.splits || [];
}

export async function executePayout(paymentIntentId: string, idempotencyKey?: string): Promise<PayoutTransaction[]> {
  const headers: Record<string, string> = {};
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const response = await apiFetchJson('/marketplace/payouts/execute', {
    method: 'POST',
    body: JSON.stringify({ paymentIntentId }),
    headers,
  }) as { payouts?: PayoutTransaction[] };
  return response.payouts || [];
}

export async function getPayouts(paymentIntentId: string): Promise<PayoutTransaction[]> {
  const response = await apiFetch(`/marketplace/payouts?paymentIntentId=${paymentIntentId}`);
  const data = await response.json();
  return data.payouts || [];
}

// ============================================================
// REFERÊNCIAS (SOCIAL PLUGIN)
// ============================================================

export interface MarketplaceRef {
  type: 'product_variant' | 'order' | 'payment_intent';
  id: string;
  name: string;
  status: string;
  link: string;
}

export async function getMarketplaceRef(type: string, id: string): Promise<MarketplaceRef> {
  return apiFetchJson(`/marketplace/refs/${type}/${id}`);
}

// ============================================================
// SUBSCRIPTIONS (ASSINATURAS E RECORRÊNCIA)
// ============================================================

export interface Subscription {
  subscription_id: string;
  type: 'product' | 'service' | 'mixed';
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  linked_entities: {
    products?: Array<{ product_id: string; store_id: string; quantity: number }>;
    service_offerings?: Array<{ offering_id: string; store_id: string; quantity: number }>;
  };
  customer_id: string;
  store_id: string;
  payment_method: 'balance' | 'card' | 'invoice';
  attribution_id?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  expires_at?: string;
}

export interface SubscriptionCycle {
  cycle_id: string;
  subscription_id: string;
  cycle_number: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'billed' | 'paid' | 'failed';
  order_id?: string;
  checkout_id?: string;
  payment_plan_id?: string;
  invoice_issued_at?: string;
  invoice_due_date?: string;
  invoice_paid_at?: string;
  created_at: string;
}

export interface CreateSubscriptionInput {
  type: 'product' | 'service' | 'mixed';
  billing_cycle: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  linked_entities: {
    products?: Array<{ product_id: string; store_id: string; quantity: number }>;
    service_offerings?: Array<{ offering_id: string; store_id: string; quantity: number }>;
  };
  customer_id: string;
  store_id: string;
  payment_method: 'balance' | 'card' | 'invoice';
  attribution_id?: string;
}

export interface GenerateCycleResult {
  cycle: SubscriptionCycle;
  order: Order;
  checkout: CheckoutIntent;
  payment_plan: PaymentPlan;
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
  const response = await apiFetchJson<Subscription>('/marketplace/subscriptions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getSubscription(subscriptionId: string): Promise<Subscription> {
  const response = await apiFetchJson<Subscription>(`/marketplace/subscriptions/${subscriptionId}`);
  return response;
}

export async function getCustomerSubscriptions(customerId: string): Promise<{ subscriptions: Subscription[] }> {
  const response = await apiFetchJson<{ subscriptions: Subscription[] }>(`/marketplace/subscriptions/customer/${customerId}`);
  return response;
}

export async function getStoreSubscriptions(storeId: string): Promise<{ subscriptions: Subscription[] }> {
  const response = await apiFetchJson<{ subscriptions: Subscription[] }>(`/marketplace/subscriptions/store/${storeId}`);
  return response;
}

export async function pauseSubscription(subscriptionId: string): Promise<Subscription> {
  const response = await apiFetchJson<Subscription>(`/marketplace/subscriptions/${subscriptionId}/pause`, {
    method: 'POST',
  });
  return response;
}

export async function resumeSubscription(subscriptionId: string): Promise<Subscription> {
  const response = await apiFetchJson<Subscription>(`/marketplace/subscriptions/${subscriptionId}/resume`, {
    method: 'POST',
  });
  return response;
}

export async function cancelSubscription(subscriptionId: string): Promise<Subscription> {
  const response = await apiFetchJson<Subscription>(`/marketplace/subscriptions/${subscriptionId}/cancel`, {
    method: 'POST',
  });
  return response;
}

export async function generateSubscriptionCycle(subscriptionId: string): Promise<GenerateCycleResult> {
  const response = await apiFetchJson<GenerateCycleResult>(`/marketplace/subscriptions/${subscriptionId}/generate-cycle`, {
    method: 'POST',
  });
  return response;
}

export async function getSubscriptionCycles(subscriptionId: string): Promise<{ cycles: SubscriptionCycle[] }> {
  const response = await apiFetchJson<{ cycles: SubscriptionCycle[] }>(`/marketplace/subscriptions/${subscriptionId}/cycles`);
  return response;
}

export async function getSubscriptionCycle(cycleId: string): Promise<SubscriptionCycle> {
  const response = await apiFetchJson<SubscriptionCycle>(`/marketplace/subscription-cycles/${cycleId}`);
  return response;
}

// ============================================================
// INDÚSTRIA E DISTRIBUIÇÃO REGIONAL
// ============================================================

export interface IndustryAccount {
  industry_id: string;
  name: string;
  cnpj: string;
  categories_supported: string[];
  default_margin_rules: {
    hub_margin_percentage: number;
    store_margin_percentage: number;
    minimum_price?: number;
  };
  authorized_hubs: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistributionHub {
  hub_id: string;
  industry_id: string;
  name: string;
  location: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  supported_products: string[];
  fulfillment_type: 'pickup' | 'delivery' | 'mixed';
  margin_override?: {
    percentage?: number;
    fixed_amount?: number;
  };
  logistics_profile: {
    default_eta_minutes: number;
    supported_vehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
    cost_per_km?: number;
    base_cost?: number;
  };
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateIndustryAccountInput {
  name: string;
  cnpj: string;
  categories_supported: string[];
  default_margin_rules: {
    hub_margin_percentage: number;
    store_margin_percentage: number;
    minimum_price?: number;
  };
  authorized_hubs?: string[];
}

export interface CreateDistributionHubInput {
  industry_id: string;
  name: string;
  location: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  supported_products: string[];
  fulfillment_type: 'pickup' | 'delivery' | 'mixed';
  margin_override?: {
    percentage?: number;
    fixed_amount?: number;
  };
  logistics_profile: {
    default_eta_minutes: number;
    supported_vehicles: Array<'bike' | 'moto' | 'car' | 'van' | 'truck'>;
    cost_per_km?: number;
    base_cost?: number;
  };
}

export interface CreateDropshipPaymentPlanInput {
  checkout_id: string;
  method: 'balance' | 'card' | 'invoice';
  dropship_items: Array<{
    product_id: string;
    industry_id: string;
    hub_id: string;
    store_id: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface CreateDeliveryFromHubInput {
  checkout_id: string;
  hub_id: string;
  store_id: string;
}

export async function createIndustryAccount(input: CreateIndustryAccountInput): Promise<IndustryAccount> {
  const response = await apiFetchJson<IndustryAccount>('/marketplace/industries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getIndustryAccounts(): Promise<{ industries: IndustryAccount[] }> {
  const response = await apiFetchJson<{ industries: IndustryAccount[] }>('/marketplace/industries');
  return response;
}

export async function getIndustryAccount(industryId: string): Promise<IndustryAccount> {
  const response = await apiFetchJson<IndustryAccount>(`/marketplace/industries/${industryId}`);
  return response;
}

export async function createDistributionHub(input: CreateDistributionHubInput): Promise<DistributionHub> {
  const response = await apiFetchJson<DistributionHub>('/marketplace/hubs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getIndustryHubs(industryId: string): Promise<{ hubs: DistributionHub[] }> {
  const response = await apiFetchJson<{ hubs: DistributionHub[] }>(`/marketplace/hubs/industry/${industryId}`);
  return response;
}

export async function createPaymentPlanWithDropship(input: CreateDropshipPaymentPlanInput): Promise<PaymentPlan> {
  const response = await apiFetchJson<PaymentPlan>('/marketplace/payment-plan/dropship', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function createDeliveryFromHub(input: CreateDeliveryFromHubInput): Promise<DeliveryOrder> {
  const response = await apiFetchJson<DeliveryOrder>('/marketplace/delivery/from-hub', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

// ============================================================
// GOVERNANÇA, SLA, REPUTAÇÃO E RISCO
// ============================================================

export interface SLAContract {
  sla_id: string;
  actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
  actor_id: string;
  metrics: {
    fulfillment_time: { target_hours: number; max_hours: number; unit: 'hours' };
    cancellation_rate: { target_percentage: number; max_percentage: number; unit: 'percentage' };
    dispute_rate: { target_percentage: number; max_percentage: number; unit: 'percentage' };
  };
  thresholds: {
    warning: {
      fulfillment_time_hours: number;
      cancellation_rate_percentage: number;
      dispute_rate_percentage: number;
    };
    violation: {
      fulfillment_time_hours: number;
      cancellation_rate_percentage: number;
      dispute_rate_percentage: number;
    };
  };
  penalties: {
    fulfillment_time_violation: { type: 'percentage' | 'fixed'; value: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
    cancellation_rate_violation: { type: 'percentage' | 'fixed'; value: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
    dispute_rate_violation: { type: 'percentage' | 'fixed'; value: number; redirect_to: 'regional_fund' | 'customer' | 'platform' };
  };
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReputationSnapshot {
  snapshot_id: string;
  actor_id: string;
  actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
  period: { year: number; month: number };
  metrics: {
    total_orders: number;
    fulfilled_orders: number;
    cancelled_orders: number;
    disputed_orders: number;
    average_fulfillment_time_hours: number;
    cancellation_rate_percentage: number;
    dispute_rate_percentage: number;
    on_time_delivery_percentage: number;
  };
  score: {
    base_score: number;
    fulfillment_penalty: number;
    cancellation_penalty: number;
    dispute_penalty: number;
    final_score: number;
  };
  sla_status: {
    fulfillment_time: 'compliant' | 'warning' | 'violation';
    cancellation_rate: 'compliant' | 'warning' | 'violation';
    dispute_rate: 'compliant' | 'warning' | 'violation';
    overall: 'compliant' | 'warning' | 'violation';
  };
  created_at: string;
}

export interface DisputeCase {
  dispute_id: string;
  order_id: string;
  checkout_id?: string;
  actor_involved: {
    actor_id: string;
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
    role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
  };
  type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
  status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'escalated';
  description: string;
  resolution?: {
    resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
    amount?: number;
    currency?: string;
    ledger_entry_id?: string;
    resolved_by: string;
    resolved_at: string;
    notes?: string;
  };
  created_at: string;
  updated_at: string;
}

export async function createSLAContract(input: any): Promise<SLAContract> {
  const response = await apiFetchJson<SLAContract>('/marketplace/sla-contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getSLAContract(slaId: string): Promise<SLAContract> {
  const response = await apiFetchJson<SLAContract>(`/marketplace/sla-contracts/${slaId}`);
  return response;
}

export async function generateReputationSnapshot(input: {
  actor_id: string;
  actor_type: 'store' | 'hub' | 'industry' | 'service_provider';
  year: number;
  month: number;
}): Promise<ReputationSnapshot> {
  const response = await apiFetchJson<ReputationSnapshot>('/marketplace/reputation-snapshots/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getReputationSnapshots(actorId: string): Promise<{ snapshots: ReputationSnapshot[] }> {
  const response = await apiFetchJson<{ snapshots: ReputationSnapshot[] }>(`/marketplace/reputation-snapshots/${actorId}`);
  return response;
}

export async function applySLAPenaltiesToPaymentPlan(paymentPlanId: string): Promise<PaymentPlan> {
  const response = await apiFetchJson<PaymentPlan>(`/marketplace/payment-plan/${paymentPlanId}/apply-sla-penalties`, {
    method: 'POST',
  });
  return response;
}

export async function createDisputeCase(input: {
  order_id: string;
  checkout_id?: string;
  actor_involved: {
    actor_id: string;
    actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer';
    role: 'seller' | 'fulfillment' | 'buyer' | 'platform';
  };
  type: 'delivery' | 'quality' | 'payment' | 'cancellation' | 'other';
  description: string;
}): Promise<DisputeCase> {
  const response = await apiFetchJson<DisputeCase>('/marketplace/disputes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function resolveDisputeCase(disputeId: string, resolution: {
  resolution_type: 'refund' | 'partial_refund' | 'replacement' | 'credit' | 'dismissed';
  amount?: number;
  currency?: string;
  resolved_by: string;
  notes?: string;
}): Promise<DisputeCase> {
  const response = await apiFetchJson<DisputeCase>(`/marketplace/disputes/${disputeId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(resolution),
  });
  return response;
}

export async function getDisputeCase(disputeId: string): Promise<DisputeCase> {
  const response = await apiFetchJson<DisputeCase>(`/marketplace/disputes/${disputeId}`);
  return response;
}

export async function getDisputesByOrder(orderId: string): Promise<{ disputes: DisputeCase[] }> {
  const response = await apiFetchJson<{ disputes: DisputeCase[] }>(`/marketplace/disputes/order/${orderId}`);
  return response;
}

// ============================================================
// TRUST LAYER E IDENTIDADE ECONÔMICA
// ============================================================

export interface EconomicIdentity {
  economic_identity_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  actor_id: string;
  trust_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  verified_assets: {
    documents_verified: boolean;
    bank_account_verified: boolean;
    company_verified: boolean;
  };
  limits: {
    max_invoice_amount: number;
    max_monthly_volume: number;
  };
  status: 'active' | 'restricted' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface TrustEvent {
  trust_event_id: string;
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  type: 'upgrade' | 'downgrade' | 'restriction' | 'suspension';
  from_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  to_level: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  reason: string;
  source: 'sla' | 'dispute' | 'payment' | 'manual_system' | 'verification';
  metadata?: Record<string, any>;
  created_at: string;
}

export async function createEconomicIdentity(input: {
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  actor_id: string;
  verified_assets?: {
    documents_verified?: boolean;
    bank_account_verified?: boolean;
    company_verified?: boolean;
  };
}): Promise<EconomicIdentity> {
  const response = await apiFetchJson<EconomicIdentity>('/marketplace/economic-identities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getEconomicIdentity(actorId: string): Promise<EconomicIdentity> {
  const response = await apiFetchJson<EconomicIdentity>(`/marketplace/economic-identities/${actorId}`);
  return response;
}

export async function recalculateTrustLevel(actorId: string): Promise<EconomicIdentity> {
  const response = await apiFetchJson<EconomicIdentity>(`/marketplace/economic-identities/${actorId}/recalculate`, {
    method: 'POST',
  });
  return response;
}

export async function getTrustEvents(actorId: string): Promise<{ events: TrustEvent[] }> {
  const response = await apiFetchJson<{ events: TrustEvent[] }>(`/marketplace/trust-events/${actorId}`);
  return response;
}

// ============================================================
// FUNDO REGIONAL
// ============================================================

export interface RegionalFund {
  regional_fund_id: string;
  region: { country: string; state: string; city: string };
  balance: number;
  currency: string;
  rules: {
    min_reserve: number;
    max_monthly_outflow: number;
    allowed_uses: Array<'infrastructure' | 'incentives' | 'subsidies' | 'community_services'>;
  };
  governance: {
    decision_model: 'automatic' | 'council';
    council_actor_ids?: string[];
  };
  status: 'active' | 'restricted';
  created_at: string;
  updated_at: string;
}

export interface RegionalFundAllocation {
  allocation_id: string;
  regional_fund_id: string;
  type: 'subsidy' | 'incentive' | 'reimbursement' | 'infrastructure';
  target_actor_id: string;
  target_actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  reference?: {
    order_id?: string;
    subscription_id?: string;
    project_id?: string;
    delivery_id?: string;
  };
  amount: number;
  currency: string;
  reason: string;
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  ledger_entry_id?: string;
  created_at: string;
  executed_at?: string;
}

export async function createRegionalFund(input: {
  region: { country: string; state: string; city: string };
  min_reserve: number;
  max_monthly_outflow: number;
  allowed_uses: Array<'infrastructure' | 'incentives' | 'subsidies' | 'community_services'>;
  governance: {
    decision_model: 'automatic' | 'council';
    council_actor_ids?: string[];
  };
  initial_balance?: number;
}): Promise<RegionalFund> {
  const response = await apiFetchJson<RegionalFund>('/marketplace/regional-funds', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getRegionalFundByRegion(region: {
  country: string;
  state: string;
  city: string;
}): Promise<RegionalFund> {
  const response = await apiFetchJson<RegionalFund>(
    `/marketplace/regional-funds/region?country=${region.country}&state=${region.state}&city=${region.city}`
  );
  return response;
}

export async function allocateRegionalFund(fundId: string, input: {
  type: 'subsidy' | 'incentive' | 'reimbursement' | 'infrastructure';
  target_actor_id: string;
  target_actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  amount: number;
  reason: string;
  reference?: {
    order_id?: string;
    subscription_id?: string;
    project_id?: string;
    delivery_id?: string;
  };
}): Promise<RegionalFundAllocation> {
  const response = await apiFetchJson<RegionalFundAllocation>(`/marketplace/regional-funds/${fundId}/allocate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getRegionalFundLedger(fundId: string): Promise<{ ledger: any[] }> {
  const response = await apiFetchJson<{ ledger: any[] }>(`/marketplace/regional-funds/${fundId}/ledger`);
  return response;
}

export async function getRegionalFundAllocations(fundId: string): Promise<{ allocations: RegionalFundAllocation[] }> {
  const response = await apiFetchJson<{ allocations: RegionalFundAllocation[] }>(`/marketplace/regional-funds/${fundId}/allocations`);
  return response;
}

// ============================================================
// FEED ECONÔMICO (NÃO SOCIAL)
// ============================================================

export interface EconomicEvent {
  event_id: string;
  type:
    | 'order_created'
    | 'order_completed'
    | 'service_booked'
    | 'subscription_started'
    | 'subscription_cycle_generated'
    | 'regional_fund_credit'
    | 'regional_fund_allocation'
    | 'new_store_opened'
    | 'industry_product_activated';
  region: { country: string; state: string; city: string };
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider' | 'regional_fund';
  reference_id?: string;
  amount?: number;
  currency?: string;
  visibility: 'public' | 'local' | 'restricted';
  display_text: string;
  created_at: string;
}

export interface GetEconomicFeedParams {
  country: string;
  state: string;
  city: string;
  types?: string; // Comma-separated
  visibility?: 'public' | 'local' | 'restricted';
  limit?: number;
}

export async function getEconomicFeed(params: GetEconomicFeedParams): Promise<{ events: EconomicEvent[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', params.country);
  queryParams.append('state', params.state);
  queryParams.append('city', params.city);
  if (params.types) queryParams.append('types', params.types);
  if (params.visibility) queryParams.append('visibility', params.visibility);
  if (params.limit) queryParams.append('limit', params.limit.toString());

  const response = await apiFetchJson<{ events: EconomicEvent[] }>(`/marketplace/economic-feed?${queryParams.toString()}`);
  return response;
}

// ============================================================
// MÉTRICAS DE IMPACTO REGIONAL
// ============================================================

export interface RegionalImpactMetrics {
  snapshot_id: string;
  region: { country: string; state: string; city: string };
  period: { year: number; month: number };
  total_transactions_amount: number;
  total_orders_count: number;
  total_services_count: number;
  total_subscriptions_active: number;
  total_stores_active: number;
  total_industrial_products_active: number;
  regional_fund_inflow: number;
  regional_fund_outflow: number;
  average_ticket: number;
  currency: string;
  generated_at: string;
}

export async function generateRegionalImpactSnapshot(input: {
  region: { country: string; state: string; city: string };
  year: number;
  month: number;
}): Promise<RegionalImpactMetrics> {
  const response = await apiFetchJson<RegionalImpactMetrics>('/marketplace/regional-impact/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getRegionalImpactSnapshots(region: {
  country: string;
  state: string;
  city: string;
}): Promise<{ snapshots: RegionalImpactMetrics[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<{ snapshots: RegionalImpactMetrics[] }>(
    `/marketplace/regional-impact/snapshots?${queryParams.toString()}`
  );
  return response;
}

export async function getLatestRegionalImpact(region: {
  country: string;
  state: string;
  city: string;
}): Promise<RegionalImpactMetrics> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<RegionalImpactMetrics>(
    `/marketplace/regional-impact/latest?${queryParams.toString()}`
  );
  return response;
}

// ============================================================
// EXPANSÃO AUTOMÁTICA E ATIVAÇÃO REGIONAL
// ============================================================

export interface ActivationEvent {
  activation_id: string;
  rule_id: string;
  region: { country: string; state: string; city: string };
  snapshot_id: string;
  action_type: 'suggest_hub' | 'unlock_incentive' | 'enable_industry_onboarding';
  action_payload?: {
    incentive_type?: string;
    max_amount?: number;
  };
  status: 'triggered' | 'consumed';
  created_at: string;
  consumed_at?: string;
}

export interface RegionalActivationStatus {
  hub_suggested: boolean;
  incentive_unlocked: {
    max_amount: number;
    incentive_type: string;
    unlocked_at: string;
  } | null;
  industry_onboarding_enabled: boolean;
}

export async function getRegionalActivationHistory(region: {
  country: string;
  state: string;
  city: string;
}): Promise<{ activations: ActivationEvent[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<{ activations: ActivationEvent[] }>(
    `/marketplace/regional-activations/history?${queryParams.toString()}`
  );
  return response;
}

export async function getRegionalActivationStatus(region: {
  country: string;
  state: string;
  city: string;
}): Promise<RegionalActivationStatus> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<RegionalActivationStatus>(
    `/marketplace/regional-activations/status?${queryParams.toString()}`
  );
  return response;
}

// ============================================================
// INCENTIVOS ECONÔMICOS DIRECIONADOS
// ============================================================

export interface IncentiveRule {
  rule_id: string;
  region: { country: string; state: string; city: string };
  incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
  max_amount: number;
  max_per_actor: number;
  max_per_period: number;
  currency: string;
  requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
  status: 'active' | 'paused';
  created_at: string;
}

export interface IncentiveGrant {
  grant_id: string;
  rule_id: string;
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  region: { country: string; state: string; city: string };
  incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
  amount: number;
  currency: string;
  reference: {
    order_id?: string;
    delivery_id?: string;
    subscription_id?: string;
    onboarding_id?: string;
  };
  status: 'granted' | 'consumed' | 'expired';
  granted_at: string;
  consumed_at?: string;
  expired_at?: string;
}

export interface AvailableIncentive {
  rule_id: string;
  incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
  max_amount: number;
  max_per_actor: number;
  requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
  available_amount: number;
}

export async function createIncentiveRule(input: {
  region: { country: string; state: string; city: string };
  incentive_type: 'delivery' | 'onboarding' | 'service' | 'logistics';
  max_amount: number;
  max_per_actor: number;
  max_per_period: number;
  requires_trust_level: 'L2' | 'L3' | 'L4' | 'L5';
}): Promise<IncentiveRule> {
  const response = await apiFetchJson<IncentiveRule>('/marketplace/incentives/rules', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function grantIncentive(input: {
  rule_id: string;
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub' | 'industry' | 'service_provider';
  amount: number;
  reference: {
    order_id?: string;
    delivery_id?: string;
    subscription_id?: string;
    onboarding_id?: string;
  };
}): Promise<IncentiveGrant> {
  const response = await apiFetchJson<IncentiveGrant>('/marketplace/incentives/grant', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function consumeIncentive(grantId: string): Promise<{ message: string }> {
  const response = await apiFetchJson<{ message: string }>(`/marketplace/incentives/${grantId}/consume`, {
    method: 'POST',
  });
  return response;
}

export async function getAvailableIncentives(actorId: string, region: {
  country: string;
  state: string;
  city: string;
}): Promise<{ incentives: AvailableIncentive[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('actor_id', actorId);
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<{ incentives: AvailableIncentive[] }>(
    `/marketplace/incentives/available?${queryParams.toString()}`
  );
  return response;
}

// ============================================================
// SISTEMA DE CONTRATOS COMERCIAIS B2B ENTRE ATORES
// ============================================================

export interface B2BCommercialContract {
  contract_id: string;
  supplier_id: string;
  supplier_type: 'store' | 'hub' | 'industry';
  buyer_id: string;
  buyer_type: 'store' | 'hub';
  region: { country: string; state: string; city: string };
  products: Array<{
    product_id: string;
    name: string;
    unit_price: number;
    currency: string;
    minimum_quantity: number;
    maximum_quantity?: number;
  }>;
  terms: {
    volume_commitment: number;
    delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
    payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    penalty_rate?: number;
  };
  status: 'draft' | 'active' | 'fulfilled' | 'breached' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
  signed_at?: string;
}

export interface B2BContractExecution {
  execution_id: string;
  contract_id: string;
  order_id: string;
  payment_plan_id: string;
  products: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
  total_amount: number;
  currency: string;
  delivery_date: string;
  payment_due_date: string;
  penalty_applied?: number;
  status: 'pending' | 'delivered' | 'paid' | 'overdue' | 'penalized';
  executed_at: string;
  delivered_at?: string;
  paid_at?: string;
}

export async function createB2BContract(input: {
  supplier_id: string;
  supplier_type: 'store' | 'hub' | 'industry';
  buyer_id: string;
  buyer_type: 'store' | 'hub';
  region: { country: string; state: string; city: string };
  products: Array<{
    product_id: string;
    name: string;
    unit_price: number;
    currency: string;
    minimum_quantity: number;
    maximum_quantity?: number;
  }>;
  terms: {
    volume_commitment: number;
    delivery_schedule: 'weekly' | 'monthly' | 'quarterly';
    payment_terms: 'net_15' | 'net_30' | 'net_60' | 'prepaid';
    penalty_rate?: number;
  };
  start_date: string;
  end_date: string;
}): Promise<B2BCommercialContract> {
  const response = await apiFetchJson<B2BCommercialContract>('/marketplace/b2b-contracts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function signB2BContract(contractId: string): Promise<B2BCommercialContract> {
  const response = await apiFetchJson<B2BCommercialContract>(`/marketplace/b2b-contracts/${contractId}/sign`, {
    method: 'POST',
  });
  return response;
}

export async function executeB2BContract(contractId: string, input: {
  products: Array<{
    product_id: string;
    quantity: number;
  }>;
  delivery_date: string;
}): Promise<B2BContractExecution> {
  const response = await apiFetchJson<B2BContractExecution>(`/marketplace/b2b-contracts/${contractId}/execute`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getB2BContractsByActor(actorId: string, role: 'supplier' | 'buyer'): Promise<{ contracts: B2BCommercialContract[] }> {
  const response = await apiFetchJson<{ contracts: B2BCommercialContract[] }>(
    `/marketplace/b2b-contracts/actor/${actorId}?role=${role}`
  );
  return response;
}

export async function getB2BContractExecutions(contractId: string): Promise<{ executions: B2BContractExecution[] }> {
  const response = await apiFetchJson<{ executions: B2BContractExecution[] }>(
    `/marketplace/b2b-contracts/${contractId}/executions`
  );
  return response;
}

// ============================================================
// SISTEMA DE CONSCIÊNCIA DE CUSTO E SUSTENTABILIDADE ECONÔMICA
// ============================================================

export interface OperationalCostProfile {
  profile_id: string;
  actor_id: string;
  actor_type: 'store' | 'service_provider';
  period: { year: number; month: number };
  fixed_costs: {
    rent?: number;
    utilities?: number;
    internet?: number;
    salaries?: number;
    taxes?: number;
    other?: number;
  };
  variable_costs: Array<{
    product_id?: string;
    service_id?: string;
    cost_per_unit: number;
    currency: string;
  }>;
  declared_volume_expectation?: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface EconomicSustainabilitySnapshot {
  snapshot_id: string;
  actor_id: string;
  actor_type: 'store' | 'service_provider';
  period: { year: number; month: number };
  total_fixed_cost: number;
  average_variable_cost: number;
  average_price: number;
  break_even_volume: number;
  current_margin_percentage: number;
  sustainability_status: 'healthy' | 'warning' | 'critical';
  calculation_explanation: string;
  currency: string;
  created_at: string;
}

export async function createOperationalCostProfile(input: {
  actor_id: string;
  actor_type: 'store' | 'service_provider';
  period: { year: number; month: number };
  fixed_costs: {
    rent?: number;
    utilities?: number;
    internet?: number;
    salaries?: number;
    taxes?: number;
    other?: number;
  };
  variable_costs: Array<{
    product_id?: string;
    service_id?: string;
    cost_per_unit: number;
    currency: string;
  }>;
  declared_volume_expectation?: number;
}): Promise<OperationalCostProfile> {
  const response = await apiFetchJson<OperationalCostProfile>('/marketplace/economic-cost-profile', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

// Função antiga renomeada para evitar conflito com a nova versão
export async function getOperationalCostProfileByActor(actorId: string, period: {
  year: number;
  month: number;
}): Promise<OperationalCostProfile> {
  const queryParams = new URLSearchParams();
  queryParams.append('year', period.year.toString());
  queryParams.append('month', period.month.toString());

  const response = await apiFetchJson<OperationalCostProfile>(
    `/marketplace/economic-cost-profile/${actorId}?${queryParams.toString()}`
  );
  return response;
}

export async function generateEconomicSustainabilitySnapshot(input: {
  actor_id: string;
  period: { year: number; month: number };
}): Promise<EconomicSustainabilitySnapshot> {
  const response = await apiFetchJson<EconomicSustainabilitySnapshot>(
    '/marketplace/economic-sustainability/generate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
  return response;
}

export async function getLatestEconomicSustainabilitySnapshot(actorId: string): Promise<EconomicSustainabilitySnapshot> {
  const response = await apiFetchJson<EconomicSustainabilitySnapshot>(
    `/marketplace/economic-sustainability/${actorId}`
  );
  return response;
}

export async function getEconomicSustainabilitySnapshots(actorId: string): Promise<{ snapshots: EconomicSustainabilitySnapshot[] }> {
  const response = await apiFetchJson<{ snapshots: EconomicSustainabilitySnapshot[] }>(
    `/marketplace/economic-sustainability/${actorId}/history`
  );
  return response;
}

// ============================================================
// COMPRA COLETIVA PROGRAMADA E LOTES DE PRODUÇÃO COMPROMETIDOS
// ============================================================

export interface ProductionBatch {
  batch_id: string;
  industry_id: string;
  product_id: string;
  min_quantity: number;
  max_quantity?: number;
  unit_price: { amount: number; currency: string };
  commit_deadline: string;
  regions_allowed: Array<{ country: string; state: string; city: string }>;
  status: 'open' | 'closed' | 'executed' | 'expired';
  total_committed_quantity: number;
  created_at: string;
  closed_at?: string;
  updated_at: string;
}

export interface BatchCommitment {
  commitment_id: string;
  batch_id: string;
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub';
  quantity: number;
  created_at: string;
  cancelled_at?: string;
  status: 'active' | 'cancelled' | 'converted';
  order_id?: string;
}

export async function createProductionBatch(input: {
  industry_id: string;
  product_id: string;
  min_quantity: number;
  max_quantity?: number;
  unit_price: { amount: number; currency: string };
  commit_deadline: string;
  regions_allowed: Array<{ country: string; state: string; city: string }>;
}): Promise<ProductionBatch> {
  const response = await apiFetchJson<ProductionBatch>('/marketplace/production-batches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getOpenBatches(region: {
  country: string;
  state: string;
  city: string;
}): Promise<{ batches: ProductionBatch[] }> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);

  const response = await apiFetchJson<{ batches: ProductionBatch[] }>(
    `/marketplace/production-batches/open?${queryParams.toString()}`
  );
  return response;
}

export async function getProductionBatch(batchId: string): Promise<ProductionBatch> {
  const response = await apiFetchJson<ProductionBatch>(`/marketplace/production-batches/${batchId}`);
  return response;
}

export async function commitToBatch(batchId: string, input: {
  actor_id: string;
  actor_type: 'user' | 'store' | 'hub';
  quantity: number;
}): Promise<BatchCommitment> {
  const response = await apiFetchJson<BatchCommitment>(`/marketplace/production-batches/${batchId}/commit`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function cancelCommitment(batchId: string, commitmentId: string): Promise<BatchCommitment> {
  const response = await apiFetchJson<BatchCommitment>(
    `/marketplace/production-batches/${batchId}/commitments/${commitmentId}/cancel`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function getBatchCommitments(batchId: string): Promise<{ commitments: BatchCommitment[] }> {
  const response = await apiFetchJson<{ commitments: BatchCommitment[] }>(
    `/marketplace/production-batches/${batchId}/commitments`
  );
  return response;
}

export async function evaluateBatchAtDeadline(batchId: string): Promise<ProductionBatch> {
  const response = await apiFetchJson<ProductionBatch>(`/marketplace/production-batches/${batchId}/evaluate`, {
    method: 'POST',
  });
  return response;
}

export async function convertBatchToOrders(batchId: string): Promise<{ orders: any[] }> {
  const response = await apiFetchJson<{ orders: any[] }>(`/marketplace/production-batches/${batchId}/convert`, {
    method: 'POST',
  });
  return response;
}

export async function getActorCommitments(actorId: string): Promise<{ commitments: BatchCommitment[] }> {
  const response = await apiFetchJson<{ commitments: BatchCommitment[] }>(
    `/marketplace/production-batches/actor/${actorId}/commitments`
  );
  return response;
}

// ============================================================
// ONBOARDING UNIFICADO DE EMPRESAS + CONEXÃO AUTOMÁTICA
// ============================================================

export interface CompanyOnboarding {
  onboarding_id: string;
  company_id: string;
  company_type: 'cnpj' | 'cpf' | 'mei';
  company_name: string;
  document: string;
  category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  documents: {
    cnpj?: string;
    qsa_document?: string;
    last_contractual_change?: string;
    address_proof?: string;
  };
  bank_account: {
    type: 'unifibank' | 'external';
    account_id?: string;
    external_bank_name?: string;
    external_account_number?: string;
    verified: boolean;
  };
  marketplace_enabled: boolean;
  services_enabled: boolean;
  products_enabled: boolean;
  pdv_enabled: boolean;
  payment_infrastructure: {
    accept_unificard: boolean;
    accept_external_gateway: boolean;
    external_gateway_provider?: string;
  };
  payment_terminal_requested: boolean;
  payment_terminal_type?: 'unified_card' | 'external';
  payment_terminal_provider?: string;
  plan_id: string;
  status: 'draft' | 'in_progress' | 'completed' | 'failed';
  economic_identity_id?: string;
  store_id?: string;
  branch_id?: string;
  service_provider_id?: string;
  industry_account_id?: string;
  hub_id?: string;
  payment_infrastructure_config_id?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface PaymentTerminal {
  terminal_id: string;
  company_id: string;
  terminal_type: 'unified_card' | 'external';
  provider?: string;
  status: 'requested' | 'approved' | 'active' | 'suspended' | 'cancelled';
  transaction_fee_structure: {
    base_rate: number;
    regional_fund_percentage: number;
    platform_percentage: number;
    referral_percentage?: number;
  };
  monthly_transaction_limit?: number;
  requested_at: string;
  approved_at?: string;
  activated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyPlan {
  plan_id: string;
  name: string;
  display_name: string;
  description: string;
  capabilities: {
    max_stores?: number;
    max_branches?: number;
    max_products?: number;
    max_services?: number;
    max_monthly_transactions?: number;
    b2b_contracts_enabled: boolean;
    industry_enabled: boolean;
    hub_enabled: boolean;
    batch_production_enabled: boolean;
    pdv_enabled: boolean;
    advanced_analytics: boolean;
  };
  price?: {
    amount: number;
    currency: string;
    billing_cycle: 'monthly' | 'yearly';
  };
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export async function getAllCompanyPlans(): Promise<{ plans: CompanyPlan[] }> {
  const response = await apiFetchJson<{ plans: CompanyPlan[] }>('/marketplace/company-plans');
  return response;
}

export async function getCompanyPlan(planId: string): Promise<CompanyPlan> {
  const response = await apiFetchJson<CompanyPlan>(`/marketplace/company-plans/${planId}`);
  return response;
}

export async function createCompanyOnboarding(input: {
  company_type: 'cnpj' | 'cpf' | 'mei';
  company_name: string;
  document: string;
  category: 'product' | 'service' | 'industry' | 'hub' | 'hybrid';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  documents: {
    cnpj?: string;
    qsa_document?: string;
    last_contractual_change?: string;
    address_proof?: string;
  };
  bank_account: {
    type: 'unifibank' | 'external';
    account_id?: string;
    external_bank_name?: string;
    external_account_number?: string;
    verified: boolean;
  };
  marketplace_enabled: boolean;
  services_enabled: boolean;
  products_enabled: boolean;
  pdv_enabled: boolean;
  payment_infrastructure: {
    accept_unificard: boolean;
    accept_external_gateway: boolean;
    external_gateway_provider?: string;
  };
  payment_terminal_requested: boolean;
  payment_terminal_type?: 'unified_card' | 'external';
  payment_terminal_provider?: string;
  plan_id?: string;
}): Promise<CompanyOnboarding> {
  const response = await apiFetchJson<CompanyOnboarding>('/marketplace/company-onboarding', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function completeCompanyOnboarding(onboardingId: string): Promise<CompanyOnboarding> {
  const response = await apiFetchJson<CompanyOnboarding>(
    `/marketplace/company-onboarding/${onboardingId}/complete`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function getCompanyOnboarding(onboardingId: string): Promise<CompanyOnboarding> {
  const response = await apiFetchJson<CompanyOnboarding>(`/marketplace/company-onboarding/${onboardingId}`);
  return response;
}

export async function approvePaymentTerminal(terminalId: string): Promise<PaymentTerminal> {
  const response = await apiFetchJson<PaymentTerminal>(`/marketplace/payment-terminals/${terminalId}/approve`, {
    method: 'POST',
  });
  return response;
}

export async function activatePaymentTerminal(terminalId: string): Promise<PaymentTerminal> {
  const response = await apiFetchJson<PaymentTerminal>(`/marketplace/payment-terminals/${terminalId}/activate`, {
    method: 'POST',
  });
  return response;
}

export async function getPaymentTerminal(terminalId: string): Promise<PaymentTerminal> {
  const response = await apiFetchJson<PaymentTerminal>(`/marketplace/payment-terminals/${terminalId}`);
  return response;
}

export async function getCompanyPaymentTerminals(companyId: string): Promise<{ terminals: PaymentTerminal[] }> {
  const response = await apiFetchJson<{ terminals: PaymentTerminal[] }>(
    `/marketplace/payment-terminals/company/${companyId}`
  );
  return response;
}

// ============================================================
// TRANSPARÊNCIA FINANCEIRA REGIONAL
// ============================================================

export interface RegionalFinancialFlow {
  region: {
    country: string;
    state: string;
    city: string;
  };
  period: {
    year: number;
    month: number;
  };
  total_transacted: number;
  total_fees: number;
  regional_fund: {
    total_revenue: number;
    infrastructure_cost: number;
    net_balance: number;
  };
  platform: {
    total_revenue: number;
  };
  infrastructure: {
    total_cost: number;
    funded_by_regional_fund: number;
  };
  incentives: {
    total_granted: number;
  };
  currency: string;
  generated_at: string;
}

export async function getRegionalFinancialFlow(region: {
  country: string;
  state: string;
  city: string;
}, period: {
  year: number;
  month: number;
}): Promise<RegionalFinancialFlow> {
  const queryParams = new URLSearchParams();
  queryParams.append('country', region.country);
  queryParams.append('state', region.state);
  queryParams.append('city', region.city);
  queryParams.append('year', period.year.toString());
  queryParams.append('month', period.month.toString());

  const response = await apiFetchJson<RegionalFinancialFlow>(
    `/marketplace/regional-financial-flow?${queryParams.toString()}`
  );
  return response;
}

// ============================================================
// ORQUESTRADOR DE DEMANDA DE SERVIÇOS (AGORA / AGENDADO / COMBO)
// ============================================================

export interface ServiceRequest {
  request_id: string;
  requester_actor_id: string;
  city: string;
  neighborhood?: string;
  intent: 'now' | 'scheduled' | 'bundle';
  service_items: Array<{ offering_id: string; quantity: number }>;
  schedule: {
    mode: 'now' | 'scheduled';
    max_wait_minutes?: number;
    date?: string;
    time_window_minutes?: number;
  };
  constraints: {
    provider_radius_mode: 'same_neighborhood' | 'same_city';
    min_trust_level_required: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    allow_multiple_providers: boolean;
  };
  status: 'open' | 'dispatched' | 'accepted' | 'expired' | 'cancelled';
  created_at: string;
  dispatched_at?: string;
  accepted_at?: string;
  expired_at?: string;
  cancelled_at?: string;
}

export interface ServiceDispatch {
  dispatch_id: string;
  request_id: string;
  candidates: Array<{
    provider_actor_id: string;
    offering_id: string;
    eligibility_reason: string;
  }>;
  rules_applied: {
    trust: boolean;
    availability: boolean;
    online: boolean;
    region: boolean;
  };
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  accepted_by?: string;
  created_at: string;
  accepted_at?: string;
  expired_at?: string;
}

export async function createServiceRequest(input: {
  requester_actor_id: string;
  city: string;
  neighborhood?: string;
  intent: 'now' | 'scheduled' | 'bundle';
  service_items: Array<{ offering_id: string; quantity: number }>;
  schedule: {
    mode: 'now' | 'scheduled';
    max_wait_minutes?: number;
    date?: string;
    time_window_minutes?: number;
  };
  constraints: {
    provider_radius_mode: 'same_neighborhood' | 'same_city';
    min_trust_level_required: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    allow_multiple_providers: boolean;
  };
}): Promise<ServiceRequest> {
  const response = await apiFetchJson<ServiceRequest>('/marketplace/services/requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getServiceRequest(requestId: string): Promise<ServiceRequest> {
  const response = await apiFetchJson<ServiceRequest>(`/marketplace/services/requests/${requestId}`);
  return response;
}

export async function listEligibleServiceProviders(requestId: string): Promise<{
  candidates: Array<{
    provider_actor_id: string;
    offering_id: string;
    eligibility_reason: string;
    reputation_score?: number;
  }>;
}> {
  const queryParams = new URLSearchParams();
  queryParams.append('request_id', requestId);

  const response = await apiFetchJson<{
    candidates: Array<{
      provider_actor_id: string;
      offering_id: string;
      eligibility_reason: string;
      reputation_score?: number;
    }>;
  }>(`/marketplace/services/providers/eligible?${queryParams.toString()}`);
  return response;
}

export async function dispatchServiceRequest(requestId: string): Promise<ServiceDispatch> {
  const response = await apiFetchJson<ServiceDispatch>(`/marketplace/services/requests/${requestId}/dispatch`, {
    method: 'POST',
  });
  return response;
}

export async function acceptServiceDispatch(dispatchId: string, providerActorId: string): Promise<{ order: any }> {
  const response = await apiFetchJson<{ order: any }>(`/marketplace/services/dispatch/${dispatchId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ provider_actor_id: providerActorId }),
  });
  return response;
}

export async function expireServiceRequest(requestId: string): Promise<ServiceRequest> {
  const response = await apiFetchJson<ServiceRequest>(`/marketplace/services/requests/${requestId}/expire`, {
    method: 'POST',
  });
  return response;
}

export async function getServiceDispatch(dispatchId: string): Promise<ServiceDispatch> {
  const response = await apiFetchJson<ServiceDispatch>(`/marketplace/services/dispatch/${dispatchId}`);
  return response;
}

// ============================================================
// PRESENCE/ONLINE CANÔNICO PARA PROVIDERS + SLA DE RESPOSTA
// ============================================================

export interface ProviderPresence {
  presence_id: string;
  provider_actor_id: string;
  status: 'online' | 'offline';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
  last_seen: string;
  response_sla_metrics?: {
    average_response_time_minutes: number;
    total_dispatches_received: number;
    total_dispatches_accepted: number;
    total_dispatches_declined: number;
    last_response_time_minutes?: number;
  };
  created_at: string;
  updated_at: string;
}

export async function updateProviderPresence(providerActorId: string, input: {
  status: 'online' | 'offline';
  region: {
    country: string;
    state: string;
    city: string;
    neighborhood?: string;
  };
}): Promise<ProviderPresence> {
  const response = await apiFetchJson<ProviderPresence>(`/marketplace/providers/${providerActorId}/presence`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getProviderPresence(providerActorId: string): Promise<ProviderPresence> {
  const response = await apiFetchJson<ProviderPresence>(`/marketplace/providers/${providerActorId}/presence`);
  return response;
}

export async function getProviderResponseSLAMetrics(providerActorId: string): Promise<{
  average_response_time_minutes: number;
  total_dispatches_received: number;
  total_dispatches_accepted: number;
  total_dispatches_declined: number;
  acceptance_rate: number;
  last_response_time_minutes?: number;
}> {
  const response = await apiFetchJson<{
    average_response_time_minutes: number;
    total_dispatches_received: number;
    total_dispatches_accepted: number;
    total_dispatches_declined: number;
    acceptance_rate: number;
    last_response_time_minutes?: number;
  }>(`/marketplace/providers/${providerActorId}/sla-metrics`);
  return response;
}

export async function declineServiceDispatch(dispatchId: string, providerActorId: string): Promise<{
  message: string;
  dispatch: ServiceDispatch;
}> {
  const response = await apiFetchJson<{ message: string; dispatch: ServiceDispatch }>(
    `/marketplace/services/dispatch/${dispatchId}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ provider_actor_id: providerActorId }),
    }
  );
  return response;
}

// ============================================================
// MATCHING ECONÔMICO DE SERVIÇOS + PRÉ-RESERVA INTELIGENTE
// ============================================================

export interface ServicePreReservation {
  pre_reservation_id: string;
  dispatch_id: string;
  request_id: string;
  provider_actor_id: string;
  offering_id: string;
  date: string;
  time: string;
  quantity: number;
  hold_duration_minutes: number;
  expires_at: string;
  status: 'active' | 'confirmed' | 'expired' | 'released';
  created_at: string;
  confirmed_at?: string;
  expired_at?: string;
  released_at?: string;
}

export async function getPreReservation(preReservationId: string): Promise<ServicePreReservation> {
  const response = await apiFetchJson<ServicePreReservation>(
    `/marketplace/services/pre-reservations/${preReservationId}`
  );
  return response;
}

export async function getPreReservationsByDispatch(dispatchId: string): Promise<{
  pre_reservations: ServicePreReservation[];
}> {
  const response = await apiFetchJson<{ pre_reservations: ServicePreReservation[] }>(
    `/marketplace/services/dispatch/${dispatchId}/pre-reservations`
  );
  return response;
}

export async function expirePreReservations(): Promise<{ message: string }> {
  const response = await apiFetchJson<{ message: string }>('/marketplace/services/pre-reservations/expire', {
    method: 'POST',
  });
  return response;
}

// ============================================================
// APP DO USUÁRIO (DEMANDANTE): TIMELINE DE SERVIÇO
// ============================================================

export interface ServiceRequestTimelineEvent {
  type: string;
  timestamp: string;
  actor_id?: string;
  payload?: any;
}

export interface ServiceRequestStatus {
  request_id: string;
  status: 'searching' | 'waiting_provider' | 'confirmed' | 'in_progress' | 'completed' | 'expired';
  intent: 'now' | 'scheduled' | 'bundle';
  provider?: {
    provider_actor_id: string;
    confirmed_at: string;
  };
  confirmed_schedule?: {
    date: string;
    time: string;
  };
  service_items: Array<{ offering_id: string; quantity: number }>;
  city: string;
  neighborhood?: string;
}

export async function getServiceRequestTimeline(requestId: string): Promise<{ timeline: ServiceRequestTimelineEvent[] }> {
  const response = await apiFetchJson<{ timeline: ServiceRequestTimelineEvent[] }>(
    `/marketplace/services/requests/${requestId}/timeline`
  );
  return response;
}

export async function getServiceRequestStatus(requestId: string): Promise<ServiceRequestStatus> {
  const response = await apiFetchJson<ServiceRequestStatus>(
    `/marketplace/services/requests/${requestId}/status`
  );
  return response;
}

export async function completeServiceRequest(
  requestId: string,
  completedBy: string
): Promise<{ request_id: string; completed_at: string; status: 'completed' }> {
  const response = await apiFetchJson<{ request_id: string; completed_at: string; status: 'completed' }>(
    `/marketplace/services/requests/${requestId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ completed_by: completedBy }),
    }
  );
  return response;
}

// ============================================================
// PAGAMENTO NO SERVIÇO: ESCROW LIGHT + CONFIRMAÇÃO DUPLA
// ============================================================

export interface ServicePaymentHold {
  hold_id: string;
  request_id: string;
  payment_plan_id: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'disputed' | 'expired';
  created_at: string;
  release_deadline_at: string;
  release_policy: 'client_confirm' | 'auto_after_deadline' | 'provider_confirm_with_proof';
  released_at?: string;
  released_by?: string;
  dispute_case_id?: string;
}

export async function getServicePaymentHold(requestId: string): Promise<ServicePaymentHold | null> {
  try {
    const response = await apiFetchJson<ServicePaymentHold>(
      `/marketplace/services/requests/${requestId}/payment-hold`
    );
    return response;
  } catch (err: any) {
    if (err.status === 404) {
      return null;
    }
    throw err;
  }
}

export async function confirmServiceCompletedByCustomer(
  requestId: string,
  customerActorId: string
): Promise<{ hold_id: string; released_at: string; status: 'released' }> {
  const response = await apiFetchJson<{ hold_id: string; released_at: string; status: 'released' }>(
    `/marketplace/services/requests/${requestId}/confirm-completed`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_actor_id: customerActorId }),
    }
  );
  return response;
}

export async function confirmServiceCompletedByProvider(
  requestId: string,
  providerActorId: string
): Promise<{ hold_id: string; released_at: string; status: 'released' }> {
  const response = await apiFetchJson<{ hold_id: string; released_at: string; status: 'released' }>(
    `/marketplace/providers/${providerActorId}/services/requests/${requestId}/confirm-completed`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function disputeService(
  requestId: string,
  actorId: string,
  role: 'customer' | 'provider',
  reason: 'service_not_done' | 'quality_issue' | 'wrong_service' | 'other'
): Promise<{ hold_id: string; dispute_case_id: string; status: 'disputed' }> {
  const response = await apiFetchJson<{ hold_id: string; dispute_case_id: string; status: 'disputed' }>(
    `/marketplace/services/requests/${requestId}/dispute`,
    {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId, role, reason }),
    }
  );
  return response;
}

// ============================================================
// ORÇAMENTO ASSISTIDO + EXECUÇÃO VINCULADA (QUOTE → SERVICE)
// ============================================================

export interface ServiceVisit {
  visit_id: string;
  request_id: string;
  dispatch_id: string;
  provider_actor_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'visit_scheduled' | 'visit_completed' | 'visit_cancelled' | 'visit_expired';
  created_at: string;
  completed_at?: string;
  cancelled_at?: string;
  expired_at?: string;
}

export interface ServiceQuote {
  quote_id: string;
  request_id: string;
  visit_id: string;
  provider_actor_id: string;
  service_value: { amount: number; currency: string };
  description: string;
  requires_materials: boolean;
  execution_date?: string;
  execution_time?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  accepted_at?: string;
  declined_at?: string;
  expired_at?: string;
  booking_id?: string;
  order_id?: string;
}

export async function getServiceVisit(visitId: string): Promise<ServiceVisit> {
  const response = await apiFetchJson<ServiceVisit>(`/marketplace/services/visits/${visitId}`);
  return response;
}

export async function getServiceVisitsByRequest(requestId: string): Promise<{ visits: ServiceVisit[] }> {
  const response = await apiFetchJson<{ visits: ServiceVisit[] }>(
    `/marketplace/services/requests/${requestId}/visits`
  );
  return response;
}

export async function completeServiceVisit(visitId: string): Promise<ServiceVisit> {
  const response = await apiFetchJson<ServiceVisit>(
    `/marketplace/services/visits/${visitId}/complete`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function createServiceQuote(input: {
  request_id: string;
  visit_id: string;
  provider_actor_id: string;
  service_value: { amount: number; currency: string };
  description: string;
  requires_materials: boolean;
  execution_date?: string;
  execution_time?: string;
}): Promise<ServiceQuote> {
  const response = await apiFetchJson<ServiceQuote>('/marketplace/services/quotes', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response;
}

export async function getServiceQuote(quoteId: string): Promise<ServiceQuote> {
  const response = await apiFetchJson<ServiceQuote>(`/marketplace/services/quotes/${quoteId}`);
  return response;
}

export async function getServiceQuotesByRequest(requestId: string): Promise<{ quotes: ServiceQuote[] }> {
  const response = await apiFetchJson<{ quotes: ServiceQuote[] }>(
    `/marketplace/services/requests/${requestId}/quotes`
  );
  return response;
}

export async function acceptServiceQuote(
  quoteId: string,
  customerActorId: string
): Promise<{ quote_id: string; booking_id: string; order_id: string; payment_hold_id: string }> {
  const response = await apiFetchJson<{ quote_id: string; booking_id: string; order_id: string; payment_hold_id: string }>(
    `/marketplace/services/quotes/${quoteId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_actor_id: customerActorId }),
    }
  );
  return response;
}

export async function declineServiceQuote(quoteId: string, customerActorId: string): Promise<ServiceQuote> {
  const response = await apiFetchJson<ServiceQuote>(
    `/marketplace/services/quotes/${quoteId}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ customer_actor_id: customerActorId }),
    }
  );
  return response;
}

// ============================================================
// GOVERNANÇA ANTI-DESVIO DE SERVIÇOS (QUOTE & EXECUÇÃO)
// ============================================================

export interface ServiceGovernanceMetrics {
  provider_actor_id: string;
  category_id?: string;
  period: {
    start_date: string;
    end_date: string;
  };
  visitas_sem_orcamento: number;
  orcamentos_enviados: number;
  orcamentos_aceitos: number;
  orcamentos_recusados: number;
  orcamentos_expirados: number;
  taxa_quote_to_execution: number;
  status: 'healthy' | 'warning' | 'sla_violation' | 'trust_penalty';
  warnings_count: number;
  sla_violations_count: number;
  trust_downgrades_count: number;
  calculated_at: string;
  last_warning_at?: string;
  last_sla_violation_at?: string;
  last_trust_downgrade_at?: string;
}

export async function getServiceGovernanceMetrics(
  providerActorId: string,
  startDate?: string,
  endDate?: string,
  categoryId?: string
): Promise<ServiceGovernanceMetrics> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (categoryId) params.append('category_id', categoryId);

  const response = await apiFetchJson<ServiceGovernanceMetrics>(
    `/marketplace/providers/${providerActorId}/governance-metrics?${params.toString()}`
  );
  return response;
}

export async function getMatchingPriority(providerActorId: string): Promise<{ provider_actor_id: string; priority: number }> {
  const response = await apiFetchJson<{ provider_actor_id: string; priority: number }>(
    `/marketplace/providers/${providerActorId}/matching-priority`
  );
  return response;
}

// ============================================================
// TEMPLATES DE NEGÓCIO + IMPORTAÇÃO CANÔNICA DE CATÁLOGO
// ============================================================

export interface BusinessTemplate {
  template_id: string;
  name: string;
  description: string;
  category_ids: string[];
  suggested_industrial_products: Array<{
    product_id: string;
    category_id: string;
  }>;
  default_services: Array<{
    template_id: string;
    category_id: string;
  }>;
  canonical_images: {
    logo?: string;
    banner?: string;
    icon?: string;
  };
  flags: {
    produto_proprio: boolean;
    industrial: boolean;
    ambos: boolean;
  };
  created_at: string;
}

export async function getAllBusinessTemplates(): Promise<{ templates: BusinessTemplate[] }> {
  const response = await apiFetchJson<{ templates: BusinessTemplate[] }>('/marketplace/business-templates');
  return response;
}


export async function getImportedProducts(storeId: string): Promise<{
  products: Array<{
    store_product_id: string;
    product_id: string;
    category_id: string;
    enabled: boolean;
    price: { amount: number; currency: string } | null;
    stock: { quantity: number; unit: string } | null;
  }>;
}> {
  const response = await apiFetchJson<{
    products: Array<{
      store_product_id: string;
      product_id: string;
      category_id: string;
      enabled: boolean;
      price: { amount: number; currency: string } | null;
      stock: { quantity: number; unit: string } | null;
    }>;
  }>(`/marketplace/stores/${storeId}/imported-products`);
  return response;
}

export async function getImportedServices(storeId: string): Promise<{
  services: Array<{
    offering_id: string;
    template_id: string;
    price: { amount: number; currency: string };
    duration_minutes?: number;
    active: boolean;
  }>;
}> {
  const response = await apiFetchJson<{
    services: Array<{
      offering_id: string;
      template_id: string;
      price: { amount: number; currency: string };
      duration_minutes?: number;
      active: boolean;
    }>;
  }>(`/marketplace/stores/${storeId}/imported-services`);
  return response;
}

export async function activateImportedProduct(
  storeId: string,
  productId: string,
  price: { amount: number; currency: string },
  stock?: { quantity: number; unit: string }
): Promise<{ success: boolean }> {
  const response = await apiFetchJson<{ success: boolean }>(
    `/marketplace/stores/${storeId}/products/${productId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({ price, stock }),
    }
  );
  return response;
}

export async function deactivateImportedProduct(storeId: string, productId: string): Promise<{ success: boolean }> {
  const response = await apiFetchJson<{ success: boolean }>(
    `/marketplace/stores/${storeId}/products/${productId}/deactivate`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function activateImportedService(
  offeringId: string,
  price: { amount: number; currency: string },
  durationMinutes?: number
): Promise<{ success: boolean }> {
  const response = await apiFetchJson<{ success: boolean }>(
    `/marketplace/service-offerings/${offeringId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({ price, duration_minutes: durationMinutes }),
    }
  );
  return response;
}

export async function deactivateImportedService(offeringId: string): Promise<{ success: boolean }> {
  const response = await apiFetchJson<{ success: boolean }>(
    `/marketplace/service-offerings/${offeringId}/deactivate`,
    {
      method: 'POST',
    }
  );
  return response;
}

// ============================================================
// ATORES COLABORADORES (CONTADOR, VENDEDOR, GESTOR)
// ============================================================

export type ActorRole = 'accountant' | 'sales' | 'manager' | 'service_operator';

export interface CompanyCollaborator {
  collaboration_id: string;
  company_id: string;
  actor_id: string;
  role: ActorRole;
  permissions: string[];
  status: 'invited' | 'accepted' | 'revoked' | 'declined';
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  revoked_at?: string;
  declined_at?: string;
  revoked_by?: string;
}

export async function inviteCollaborator(
  companyId: string,
  actorId: string,
  role: ActorRole,
  invitedBy: string
): Promise<CompanyCollaborator> {
  const response = await apiFetchJson<CompanyCollaborator>(
    `/marketplace/companies/${companyId}/collaborators/invite`,
    {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId, role, invited_by: invitedBy }),
    }
  );
  return response;
}

export async function acceptCollaborationInvite(
  collaborationId: string,
  actorId: string
): Promise<CompanyCollaborator> {
  const response = await apiFetchJson<CompanyCollaborator>(
    `/marketplace/collaborations/${collaborationId}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId }),
    }
  );
  return response;
}

export async function declineCollaborationInvite(
  collaborationId: string,
  actorId: string
): Promise<CompanyCollaborator> {
  const response = await apiFetchJson<CompanyCollaborator>(
    `/marketplace/collaborations/${collaborationId}/decline`,
    {
      method: 'POST',
      body: JSON.stringify({ actor_id: actorId }),
    }
  );
  return response;
}

export async function revokeCollaboration(
  collaborationId: string,
  revokedBy: string
): Promise<CompanyCollaborator> {
  const response = await apiFetchJson<CompanyCollaborator>(
    `/marketplace/collaborations/${collaborationId}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify({ revoked_by: revokedBy }),
    }
  );
  return response;
}

export async function getCompanyCollaborators(
  companyId: string,
  status?: 'invited' | 'accepted' | 'revoked' | 'declined'
): Promise<{ collaborators: CompanyCollaborator[] }> {
  const params = status ? `?status=${status}` : '';
  const response = await apiFetchJson<{ collaborators: CompanyCollaborator[] }>(
    `/marketplace/companies/${companyId}/collaborators${params}`
  );
  return response;
}

export async function getActorCollaborations(
  actorId: string,
  status?: 'invited' | 'accepted' | 'revoked' | 'declined'
): Promise<{ collaborations: CompanyCollaborator[] }> {
  const params = status ? `?status=${status}` : '';
  const response = await apiFetchJson<{ collaborations: CompanyCollaborator[] }>(
    `/marketplace/actors/${actorId}/collaborations${params}`
  );
  return response;
}

export async function getCollaboration(collaborationId: string): Promise<CompanyCollaborator> {
  const response = await apiFetchJson<CompanyCollaborator>(
    `/marketplace/collaborations/${collaborationId}`
  );
  return response;
}

export async function getActorCompanyPermissions(
  companyId: string,
  actorId: string
): Promise<{ permissions: string[] }> {
  const response = await apiFetchJson<{ permissions: string[] }>(
    `/marketplace/companies/${companyId}/actors/${actorId}/permissions`
  );
  return response;
}

// ============================================================
// EXTENSIBILIDADE CONTROLADA (PLUGINS CANÔNICOS)
// ============================================================

export type PluginCategory = 'pricing_helper' | 'category_specific_ui' | 'compliance_extensions' | 'reports_extensions';

export type PluginHook = 
  | 'before_order_created'
  | 'after_order_created'
  | 'before_checkout_created'
  | 'after_checkout_created'
  | 'before_payment_plan_created'
  | 'after_payment_plan_created'
  | 'before_product_display'
  | 'after_product_display'
  | 'before_service_booking'
  | 'after_service_booking'
  | 'before_report_generation'
  | 'after_report_generation';

export interface PluginDefinition {
  plugin_id: string;
  name: string;
  description: string;
  category: PluginCategory;
  version: string;
  allowed_hooks: PluginHook[];
  allowed_contracts: string[];
  status: 'active' | 'inactive' | 'deprecated';
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface PluginExecution {
  execution_id: string;
  plugin_id: string;
  hook: PluginHook;
  input_data: Record<string, any>;
  output_data?: Record<string, any>;
  status: 'pending' | 'executed' | 'failed';
  executed_at?: string;
  error_message?: string;
}

export async function registerPlugin(
  definition: Omit<PluginDefinition, 'plugin_id' | 'created_at' | 'updated_at'>
): Promise<PluginDefinition> {
  const response = await apiFetchJson<PluginDefinition>('/marketplace/plugins/register', {
    method: 'POST',
    body: JSON.stringify(definition),
  });
  return response;
}

export async function getPlugins(
  category?: PluginCategory,
  status?: 'active' | 'inactive' | 'deprecated'
): Promise<{ plugins: PluginDefinition[] }> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (status) params.append('status', status);

  const response = await apiFetchJson<{ plugins: PluginDefinition[] }>(
    `/marketplace/plugins?${params.toString()}`
  );
  return response;
}

export async function getPlugin(pluginId: string): Promise<PluginDefinition> {
  const response = await apiFetchJson<PluginDefinition>(`/marketplace/plugins/${pluginId}`);
  return response;
}

export async function updatePluginStatus(
  pluginId: string,
  status: 'active' | 'inactive' | 'deprecated'
): Promise<PluginDefinition> {
  const response = await apiFetchJson<PluginDefinition>(
    `/marketplace/plugins/${pluginId}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ status }),
    }
  );
  return response;
}

export async function getPluginExecutions(
  pluginId: string,
  hook?: PluginHook
): Promise<{ executions: PluginExecution[] }> {
  const params = hook ? `?hook=${hook}` : '';
  const response = await apiFetchJson<{ executions: PluginExecution[] }>(
    `/marketplace/plugins/${pluginId}/executions${params}`
  );
  return response;
}

export async function executePluginHook(
  hook: PluginHook,
  inputData: Record<string, any>,
  context?: { company_id?: string; store_id?: string; actor_id?: string }
): Promise<{ results: Array<{ plugin_id: string; output_data?: Record<string, any>; error?: string }> }> {
  const response = await apiFetchJson<{ results: Array<{ plugin_id: string; output_data?: Record<string, any>; error?: string }> }>(
    '/marketplace/plugins/execute-hook',
    {
      method: 'POST',
      body: JSON.stringify({ hook, input_data: inputData, context }),
    }
  );
  return response;
}

// ============================================================
// AVALIAÇÃO PÓS-SERVIÇO BIDIRECIONAL (USUÁRIO ⇄ PRESTADOR)
// ============================================================

export interface ServiceEvaluation {
  evaluation_id: string;
  request_id: string;
  evaluator_type: 'user' | 'provider';
  evaluator_actor_id: string;
  target_actor_id: string;
  scores: {
    execution_quality: number; // 1-5
    punctuality: number; // 1-5
    communication: number; // 1-5
    compliance: number; // 1-5
  };
  created_at: string;
  immutable: true;
}

export interface EvaluationAggregate {
  actor_id: string;
  period: {
    start_date: string;
    end_date: string;
  };
  total_evaluations: number;
  average_scores: {
    execution_quality: number;
    punctuality: number;
    communication: number;
    compliance: number;
  };
  overall_average: number;
  low_score_count: number;
  trend: 'improving' | 'stable' | 'declining';
}

export async function createServiceEvaluation(
  requestId: string,
  evaluatorType: 'user' | 'provider',
  evaluatorActorId: string,
  scores: {
    execution_quality: number;
    punctuality: number;
    communication: number;
    compliance: number;
  }
): Promise<ServiceEvaluation> {
  const response = await apiFetchJson<ServiceEvaluation>(
    `/marketplace/services/requests/${requestId}/evaluations`,
    {
      method: 'POST',
      body: JSON.stringify({
        evaluator_type: evaluatorType,
        evaluator_actor_id: evaluatorActorId,
        scores,
      }),
    }
  );
  return response;
}

export async function getServiceEvaluationsByRequest(requestId: string): Promise<{ evaluations: ServiceEvaluation[] }> {
  const response = await apiFetchJson<{ evaluations: ServiceEvaluation[] }>(
    `/marketplace/services/requests/${requestId}/evaluations`
  );
  return response;
}

export async function getActorEvaluations(
  actorId: string,
  startDate?: string,
  endDate?: string
): Promise<{ evaluations: ServiceEvaluation[] }> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const response = await apiFetchJson<{ evaluations: ServiceEvaluation[] }>(
    `/marketplace/actors/${actorId}/evaluations?${params.toString()}`
  );
  return response;
}

export async function getEvaluationAggregates(
  actorId: string,
  startDate: string,
  endDate: string
): Promise<EvaluationAggregate> {
  const response = await apiFetchJson<EvaluationAggregate>(
    `/marketplace/actors/${actorId}/evaluation-aggregates?start_date=${startDate}&end_date=${endDate}`
  );
  return response;
}

export async function getEvaluationWindow(requestId: string): Promise<{
  request_id: string;
  completed_at: string;
  user_evaluated: boolean;
  provider_evaluated: boolean;
  expires_at: string;
  is_expired: boolean;
}> {
  const response = await apiFetchJson<{
    request_id: string;
    completed_at: string;
    user_evaluated: boolean;
    provider_evaluated: boolean;
    expires_at: string;
    is_expired: boolean;
  }>(`/marketplace/services/requests/${requestId}/evaluation-window`);
  return response;
}

// ============================================================
// TEMPLATES CANÔNICOS DE CATÁLOGO POR CATEGORIA (IMPORTAÇÃO INICIAL)
// ============================================================

export type ProductTemplateType = 'industrialized' | 'own' | 'service';

export interface ProductTemplate {
  template_id: string;
  name: string;
  description?: string;
  category_id: string;
  type: ProductTemplateType;
  default_unit: string;
  canonical_images: {
    main?: string;
    thumbnail?: string;
  };
  attributes: Record<string, any>;
  version: string;
  created_at: string;
  updated_at?: string;
  immutable: true;
}

export interface ServiceTemplateCanonical {
  template_id: string;
  name: string;
  description?: string;
  category_id: string;
  type: 'one_time' | 'recurring' | 'quote_required';
  default_duration_minutes?: number;
  default_pricing_model: 'fixed' | 'hourly' | 'per_unit';
  canonical_images: {
    icon?: string;
    banner?: string;
  };
  attributes: Record<string, any>;
  version: string;
  created_at: string;
  updated_at?: string;
  immutable: true;
}

export async function getProductTemplates(
  categoryId?: string,
  businessTemplateId?: string
): Promise<{ templates: ProductTemplate[] }> {
  const params = new URLSearchParams();
  if (categoryId) params.append('category_id', categoryId);
  if (businessTemplateId) params.append('business_template_id', businessTemplateId);

  const response = await apiFetchJson<{ templates: ProductTemplate[] }>(
    `/marketplace/product-templates?${params.toString()}`
  );
  return response;
}

export async function getProductTemplate(templateId: string): Promise<ProductTemplate> {
  const response = await apiFetchJson<ProductTemplate>(`/marketplace/product-templates/${templateId}`);
  return response;
}

export async function getServiceTemplatesCanonical(
  categoryId?: string,
  businessTemplateId?: string
): Promise<{ templates: ServiceTemplateCanonical[] }> {
  const params = new URLSearchParams();
  if (categoryId) params.append('category_id', categoryId);
  if (businessTemplateId) params.append('business_template_id', businessTemplateId);

  const response = await apiFetchJson<{ templates: ServiceTemplateCanonical[] }>(
    `/marketplace/service-templates-canonical?${params.toString()}`
  );
  return response;
}

export async function getServiceTemplateCanonical(templateId: string): Promise<ServiceTemplateCanonical> {
  const response = await apiFetchJson<ServiceTemplateCanonical>(
    `/marketplace/service-templates-canonical/${templateId}`
  );
  return response;
}

export async function importCanonicalCatalog(
  companyId: string,
  storeId: string,
  businessTemplateId: string,
  options?: {
    import_all?: boolean;
    import_partial?: boolean;
    product_template_ids?: string[];
    service_template_ids?: string[];
    skip_product_templates?: string[];
    skip_service_templates?: string[];
  }
): Promise<{
  imported_products: number;
  imported_services: number;
  imported_categories: number;
  imported_templates: {
    products: Array<{ template_id: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
    services: Array<{ template_id: string; offering_id?: string; status: 'imported' | 'skipped' }>;
  };
}> {
  const response = await apiFetchJson<{
    imported_products: number;
    imported_services: number;
    imported_categories: number;
    imported_templates: {
      products: Array<{ template_id: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
      services: Array<{ template_id: string; offering_id?: string; status: 'imported' | 'skipped' }>;
    };
  }>(
    `/marketplace/companies/${companyId}/stores/${storeId}/import-catalog`,
    {
      method: 'POST',
      body: JSON.stringify({
        business_template_id: businessTemplateId,
        ...options,
      }),
    }
  );
  return response;
}

export async function importProductTemplates(
  storeId: string,
  templateIds: string[],
  options?: {
    import_all?: boolean;
    import_partial?: boolean;
    skip_items?: string[];
  }
): Promise<{
  imported_count: number;
  skipped_count: number;
  imported_templates: Array<{ template_id: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
}> {
  const response = await apiFetchJson<{
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{ template_id: string; store_product_id?: string; status: 'imported' | 'skipped' }>;
  }>(
    `/marketplace/stores/${storeId}/import-product-templates`,
    {
      method: 'POST',
      body: JSON.stringify({
        template_ids: templateIds,
        ...options,
      }),
    }
  );
  return response;
}

export async function importServiceTemplates(
  storeId: string,
  templateIds: string[],
  options?: {
    import_all?: boolean;
    import_partial?: boolean;
    skip_items?: string[];
  }
): Promise<{
  imported_count: number;
  skipped_count: number;
  imported_templates: Array<{ template_id: string; offering_id?: string; status: 'imported' | 'skipped' }>;
}> {
  const response = await apiFetchJson<{
    imported_count: number;
    skipped_count: number;
    imported_templates: Array<{ template_id: string; offering_id?: string; status: 'imported' | 'skipped' }>;
  }>(
    `/marketplace/stores/${storeId}/import-service-templates`,
    {
      method: 'POST',
      body: JSON.stringify({
        template_ids: templateIds,
        ...options,
      }),
    }
  );
  return response;
}

export async function getTemplateUsageAudit(
  templateId?: string,
  categoryId?: string
): Promise<{
  audit: Array<{
    template_id: string;
    template_type: 'product' | 'service';
    category_id: string;
    business_template_id?: string;
    usage_count: number;
    last_used_at: string;
  }>;
}> {
  const params = new URLSearchParams();
  if (templateId) params.append('template_id', templateId);
  if (categoryId) params.append('category_id', categoryId);

  const response = await apiFetchJson<{
    audit: Array<{
      template_id: string;
      template_type: 'product' | 'service';
      category_id: string;
      business_template_id?: string;
      usage_count: number;
      last_used_at: string;
    }>;
  }>(`/marketplace/template-usage-audit?${params.toString()}`);
  return response;
}

// ============================================================
// BUSINESS TEMPLATES (ARQUÉTIPOS DE EMPRESA) + ATIVAÇÃO GUIADA
// ============================================================

export type BusinessTemplateType =
  | 'supermarket'
  | 'beverage_distributor'
  | 'pharmacy'
  | 'gym'
  | 'clinic'
  | 'service_provider'
  | 'restaurant'
  | 'construction_material'
  | 'beauty_services'
  | 'health_clinic';

export type ProductType = 'industrialized' | 'own' | 'both';
export type CompanyPlanType = 'Basic' | 'Professional' | 'Industrial';

export interface BusinessTemplate {
  template_id: string;
  name: string;
  description: string;
  type: BusinessTemplateType;
  version: string;
  category_ids: string[];
  allowed_product_types: ProductType;
  default_product_templates: string[];
  default_service_templates: string[];
  operational_config: {
    requires_agenda: boolean;
    supports_dispatch: boolean;
    supports_quote_flow: boolean;
    supports_pdv: boolean;
    supports_b2b: boolean;
  };
  default_roles_enabled: Array<'manager' | 'sales' | 'service_operator' | 'accountant'>;
  recommended_plan: CompanyPlanType;
  canonical_images: {
    logo?: string;
    banner?: string;
    icon?: string;
  };
  flags: {
    produto_proprio: boolean;
    industrial: boolean;
    ambos: boolean;
  };
  created_at: string;
  updated_at?: string;
  immutable: true;
}

export interface CompanyActivationState {
  company_id: string;
  catalog_ready: boolean;
  services_ready: boolean;
  agenda_configured: boolean;
  dispatch_enabled: boolean;
  quote_flow_enabled: boolean;
  pdv_enabled: boolean;
  b2b_enabled: boolean;
  updated_at: string;
}

export async function getBusinessTemplates(type?: BusinessTemplateType): Promise<{ templates: BusinessTemplate[] }> {
  const params = new URLSearchParams();
  if (type) params.append('type', type);

  const response = await apiFetchJson<{ templates: BusinessTemplate[] }>(
    `/marketplace/business-templates?${params.toString()}`
  );
  return response;
}

export async function getBusinessTemplate(templateId: string): Promise<BusinessTemplate> {
  const response = await apiFetchJson<BusinessTemplate>(`/marketplace/business-templates/${templateId}`);
  return response;
}

export async function getCompanyActivationState(companyId: string): Promise<CompanyActivationState> {
  const response = await apiFetchJson<CompanyActivationState>(`/marketplace/companies/${companyId}/activation-state`);
  return response;
}

export async function getBusinessTemplateUsageAudit(
  templateId?: string
): Promise<{
  audit: Array<{
    template_id: string;
    usage_count: number;
    last_used_at: string;
    companies: string[];
  }>;
}> {
  const params = new URLSearchParams();
  if (templateId) params.append('template_id', templateId);

  const response = await apiFetchJson<{
    audit: Array<{
      template_id: string;
      usage_count: number;
      last_used_at: string;
      companies: string[];
    }>;
  }>(`/marketplace/business-templates/usage-audit?${params.toString()}`);
  return response;
}

// ============================================================
// APP DO PRESTADOR: INBOX DE DISPATCH
// ============================================================

export interface DispatchInboxItem {
  dispatch_id: string;
  request_id: string;
  request_summary: {
    intent: 'now' | 'scheduled' | 'bundle';
    service_items: Array<{ offering_id: string; quantity: number }>;
    city: string;
    neighborhood?: string;
    schedule: {
      mode: 'now' | 'scheduled';
      date?: string;
      time?: string;
    };
  };
  pre_reservation?: {
    pre_reservation_id: string;
    date: string;
    time: string;
    expires_at: string;
    status: 'active' | 'expired';
  };
  status: 'sent' | 'accepted' | 'declined' | 'expired';
  created_at: string;
}

export interface DispatchStatus {
  dispatch_id: string;
  provider_actor_id: string;
  is_eligible: boolean;
  pre_reservation_status?: 'active' | 'expired' | 'confirmed' | 'released';
  pre_reservation_expires_at?: string;
  time_remaining_minutes?: number;
  already_accepted: boolean;
  accepted_by?: string;
}

export async function getProviderDispatchInbox(providerActorId: string): Promise<{ inbox: DispatchInboxItem[] }> {
  const response = await apiFetchJson<{ inbox: DispatchInboxItem[] }>(
    `/marketplace/providers/${providerActorId}/dispatch-inbox`
  );
  return response;
}

export async function getDispatchStatus(dispatchId: string, providerId: string): Promise<DispatchStatus> {
  const queryParams = new URLSearchParams();
  queryParams.append('provider_id', providerId);
  const response = await apiFetchJson<DispatchStatus>(
    `/marketplace/services/dispatch/${dispatchId}/status?${queryParams.toString()}`
  );
  return response;
}

// ============================================================
// ESCALA DE SERVIÇOS & CAPACIDADE PRODUTIVA (MULTI-AGENDA)
// ============================================================

export type ServiceResourceType = 'individual_provider' | 'company_professional' | 'equipment' | 'facility';
export type ServiceResourceStatus = 'active' | 'unavailable' | 'overloaded' | 'maintenance';

export interface ServiceResource {
  resource_id: string;
  store_id: string;
  type: ServiceResourceType;
  name: string;
  description?: string;
  actor_id?: string;
  physical_id?: string;
  has_own_agenda: boolean;
  required_for_services: string[];
  status: ServiceResourceStatus;
  status_reason?: string;
  status_updated_at: string;
  historical_metrics: {
    average_execution_time_minutes: number;
    sla_response_rate: number;
    sla_execution_rate: number;
    cancellation_rate: number;
    overrun_rate: number;
    total_services_completed: number;
    last_30_days_services: number;
  };
  current_capacity: {
    total_slots_available: number;
    slots_reserved: number;
    slots_confirmed: number;
    slots_in_progress: number;
    slots_available: number;
    risk_level: 'low' | 'medium' | 'high';
  };
  created_at: string;
  updated_at: string;
  immutable: false;
}

export interface ServiceResourceDependency {
  dependency_id: string;
  service_template_id: string;
  required_resources: string[];
  all_required: boolean;
  created_at: string;
  immutable: true;
}

export interface CompanyCapacityMetrics {
  company_id: string;
  store_id: string;
  period: {
    start: string;
    end: string;
  };
  total_capacity: number;
  utilized_capacity: number;
  available_capacity: number;
  bottleneck_resources: Array<{
    resource_id: string;
    resource_name: string;
    utilization_rate: number;
    risk_level: 'low' | 'medium' | 'high';
  }>;
  saturation_rate: number;
  rejected_services_count: number;
  rejected_services_last_30_days: number;
  calculated_at: string;
  immutable: true;
}

export interface ResourceCapacityMetrics {
  resource_id: string;
  resource_name: string;
  store_id: string;
  capacity_total: number;
  capacity_reserved: number;
  capacity_confirmed: number;
  capacity_in_progress: number;
  capacity_utilized: number;
  capacity_available: number;
  risk_sla: 'low' | 'medium' | 'high';
  risk_factors: string[];
  historical_average_utilization: number;
  historical_peak_utilization: number;
  calculated_at: string;
  immutable: true;
}

export async function createOrUpdateServiceResource(
  storeId: string,
  body: {
    type: ServiceResourceType;
    name: string;
    description?: string;
    actor_id?: string;
    physical_id?: string;
    has_own_agenda?: boolean;
    required_for_services?: string[];
  }
): Promise<ServiceResource> {
  const response = await apiFetchJson<ServiceResource>(
    `/marketplace/stores/${storeId}/resources`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return response;
}

export async function getServiceResourcesByStore(storeId: string): Promise<{ resources: ServiceResource[] }> {
  const response = await apiFetchJson<{ resources: ServiceResource[] }>(
    `/marketplace/stores/${storeId}/resources`
  );
  return response;
}

export async function getServiceResource(resourceId: string): Promise<ServiceResource> {
  const response = await apiFetchJson<ServiceResource>(`/marketplace/resources/${resourceId}`);
  return response;
}

export async function updateServiceResourceStatus(
  resourceId: string,
  status: ServiceResourceStatus,
  reason?: string
): Promise<ServiceResource> {
  const response = await apiFetchJson<ServiceResource>(
    `/marketplace/resources/${resourceId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }
  );
  return response;
}

export async function createResourceDependency(
  serviceTemplateId: string,
  requiredResources: string[],
  allRequired: boolean = true
): Promise<ServiceResourceDependency> {
  const response = await apiFetchJson<ServiceResourceDependency>(
    `/marketplace/services/${serviceTemplateId}/resource-dependencies`,
    {
      method: 'POST',
      body: JSON.stringify({ required_resources: requiredResources, all_required: allRequired }),
    }
  );
  return response;
}

export async function getResourceDependenciesByService(
  serviceTemplateId: string
): Promise<{ dependencies: ServiceResourceDependency[] }> {
  const response = await apiFetchJson<{ dependencies: ServiceResourceDependency[] }>(
    `/marketplace/services/${serviceTemplateId}/resource-dependencies`
  );
  return response;
}

export async function getCompanyCapacityMetrics(storeId: string): Promise<CompanyCapacityMetrics> {
  const response = await apiFetchJson<CompanyCapacityMetrics>(
    `/marketplace/stores/${storeId}/capacity-metrics`
  );
  return response;
}

export async function getResourceCapacityMetrics(resourceId: string): Promise<ResourceCapacityMetrics> {
  const response = await apiFetchJson<ResourceCapacityMetrics>(
    `/marketplace/resources/${resourceId}/capacity-metrics`
  );
  return response;
}

// ============================================================
// GESTÃO DE COMISSÃO & REPASSE INTERNO POR RECURSO (PROMPT 24)
// ============================================================

export type CompensationModel = 'none' | 'fixed_percent' | 'fixed_value' | 'salary' | 'mixed';

export interface ResourceCompensationConfig {
  resource_id: string;
  compensation_model: CompensationModel;
  percent_value?: number;
  fixed_amount?: number;
  currency?: string;
  monthly_salary?: number;
  base_salary?: number;
  variable_percent?: number;
  min_compensation?: number;
  max_compensation?: number;
  active: boolean;
  effective_from: string;
  effective_until?: string;
  created_at: string;
  updated_at: string;
  immutable: false;
}

export interface ResourceCompensation {
  compensation_id: string;
  resource_id: string;
  service_order_id: string;
  service_booking_id: string;
  store_id: string;
  service_value: {
    amount: number;
    currency: string;
  };
  compensation_amount: {
    amount: number;
    currency: string;
  };
  compensation_model: CompensationModel;
  calculation_details: {
    base_value?: number;
    percent_applied?: number;
    fixed_value_applied?: number;
    adjustments?: Array<{
      type: 'min_limit' | 'max_limit' | 'salary_adjustment';
      amount: number;
      reason: string;
    }>;
  };
  status: 'calculated' | 'pending' | 'paid' | 'cancelled';
  paid_at?: string;
  ledger_entry_id?: string;
  created_at: string;
  updated_at: string;
  immutable: true;
}

export interface ResourceCompensationHistory {
  resource_id: string;
  period: {
    start: string;
    end: string;
  };
  compensations: ResourceCompensation[];
  total_services: number;
  total_compensation: {
    amount: number;
    currency: string;
  };
  average_per_service: {
    amount: number;
    currency: string;
  };
  by_model: Record<CompensationModel, {
    count: number;
    total: number;
  }>;
  generated_at: string;
  immutable: true;
}

export interface CompanyCompensationReport {
  company_id: string;
  store_id: string;
  period: {
    start: string;
    end: string;
  };
  total_compensations_paid: {
    amount: number;
    currency: string;
  };
  total_resources: number;
  total_services: number;
  by_resource: Array<{
    resource_id: string;
    resource_name: string;
    compensation_model: CompensationModel;
    services_count: number;
    total_compensation: {
      amount: number;
      currency: string;
    };
  }>;
  by_model: Record<CompensationModel, {
    resources_count: number;
    services_count: number;
    total_compensation: {
      amount: number;
      currency: string;
    };
  }>;
  generated_at: string;
  immutable: true;
}

export async function setResourceCompensationConfig(
  resourceId: string,
  config: {
    compensation_model: CompensationModel;
    percent_value?: number;
    fixed_amount?: number;
    currency?: string;
    monthly_salary?: number;
    base_salary?: number;
    variable_percent?: number;
    min_compensation?: number;
    max_compensation?: number;
    active: boolean;
    effective_from: string;
    effective_until?: string;
  }
): Promise<ResourceCompensationConfig> {
  const response = await apiFetchJson<ResourceCompensationConfig>(
    `/marketplace/resources/${resourceId}/compensation-config`,
    {
      method: 'POST',
      body: JSON.stringify(config),
    }
  );
  return response;
}

export async function getResourceCompensationConfig(
  resourceId: string
): Promise<ResourceCompensationConfig> {
  const response = await apiFetchJson<ResourceCompensationConfig>(
    `/marketplace/resources/${resourceId}/compensation-config`
  );
  return response;
}

export async function getResourceCompensations(
  resourceId: string,
  options?: {
    start_date?: string;
    end_date?: string;
    status?: 'calculated' | 'pending' | 'paid' | 'cancelled';
  }
): Promise<{ compensations: ResourceCompensation[] }> {
  const params = new URLSearchParams();
  if (options?.start_date) params.append('start_date', options.start_date);
  if (options?.end_date) params.append('end_date', options.end_date);
  if (options?.status) params.append('status', options.status);

  const response = await apiFetchJson<{ compensations: ResourceCompensation[] }>(
    `/marketplace/resources/${resourceId}/compensations?${params.toString()}`
  );
  return response;
}

export async function getCompanyCompensations(
  storeId: string,
  options?: {
    start_date?: string;
    end_date?: string;
    status?: 'calculated' | 'pending' | 'paid' | 'cancelled';
  }
): Promise<{ compensations: ResourceCompensation[] }> {
  const params = new URLSearchParams();
  if (options?.start_date) params.append('start_date', options.start_date);
  if (options?.end_date) params.append('end_date', options.end_date);
  if (options?.status) params.append('status', options.status);

  const response = await apiFetchJson<{ compensations: ResourceCompensation[] }>(
    `/marketplace/stores/${storeId}/compensations?${params.toString()}`
  );
  return response;
}

export async function getResourceCompensationHistory(
  resourceId: string,
  startDate: string,
  endDate: string
): Promise<ResourceCompensationHistory> {
  const params = new URLSearchParams();
  params.append('start_date', startDate);
  params.append('end_date', endDate);

  const response = await apiFetchJson<ResourceCompensationHistory>(
    `/marketplace/resources/${resourceId}/compensation-history?${params.toString()}`
  );
  return response;
}

export async function getCompanyCompensationReport(
  storeId: string,
  startDate: string,
  endDate: string
): Promise<CompanyCompensationReport> {
  const params = new URLSearchParams();
  params.append('start_date', startDate);
  params.append('end_date', endDate);

  const response = await apiFetchJson<CompanyCompensationReport>(
    `/marketplace/stores/${storeId}/compensation-report?${params.toString()}`
  );
  return response;
}

export async function processResourceCompensation(
  serviceOrderId: string,
  serviceBookingId: string,
  completedResources: string[]
): Promise<{ compensations: ResourceCompensation[] }> {
  const response = await apiFetchJson<{ compensations: ResourceCompensation[] }>(
    `/marketplace/services/orders/${serviceOrderId}/process-compensation`,
    {
      method: 'POST',
      body: JSON.stringify({
        service_booking_id: serviceBookingId,
        completed_resources: completedResources,
      }),
    }
  );
  return response;
}

export async function markCompensationAsPaid(compensationId: string): Promise<ResourceCompensation> {
  const response = await apiFetchJson<ResourceCompensation>(
    `/marketplace/compensations/${compensationId}/mark-paid`,
    {
      method: 'PATCH',
    }
  );
  return response;
}

// ============================================================
// VOUCHERS LOCAIS & OFERTAS RELÂMPAGO (PROMPT 25)
// ============================================================

export type VoucherType = 'product' | 'service' | 'bundle';
export type VoucherVisibilityScope = 'local_neighborhood' | 'city' | 'restricted_group';
export type VoucherOfferStatus = 'draft' | 'active' | 'paused' | 'expired' | 'depleted';
export type VoucherClaimStatus = 'claimed' | 'redeemed' | 'expired' | 'cancelled' | 'no_show';

export interface VoucherOffer {
  offer_id: string;
  issuer_actor_id: string;
  store_id: string;
  type: VoucherType;
  title: string;
  description: string;
  visibility_scope: VoucherVisibilityScope;
  restricted_group_ids?: string[];
  start_at: string;
  end_at: string;
  redemption_deadline_at?: string;
  quantity_total: number;
  quantity_claimed: number;
  quantity_per_user: number;
  eligibility: {
    min_trust_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
    new_users_only?: boolean;
    first_purchase_required?: boolean;
  };
  schedule_constraints?: {
    weekdays?: number[];
    time_start?: string;
    time_end?: string;
  };
  pickup_constraints?: {
    max_minutes_after_claim?: number;
    requires_checkin?: boolean;
  };
  linked_product_id?: string;
  linked_service_template_id?: string;
  linked_service_offering_id?: string;
  linked_bundle_items?: Array<{
    product_id?: string;
    service_offering_id?: string;
    quantity: number;
  }>;
  discount_value?: {
    type: 'percentage' | 'fixed';
    amount: number;
    currency: string;
  };
  status: VoucherOfferStatus;
  created_at: string;
  updated_at: string;
  immutable: false;
}

export interface VoucherClaim {
  claim_id: string;
  offer_id: string;
  claimer_user_id: string;
  status: VoucherClaimStatus;
  claimed_at: string;
  redemption_code: string;
  redeemed_at?: string;
  expires_at: string;
  store_checkin_required: boolean;
  checked_in_at?: string;
  audit: {
    ip_hash?: string;
    device_hash?: string;
    claimed_from_neighborhood?: string;
    claimed_from_city?: string;
  };
  linked_order_id?: string;
  linked_service_booking_id?: string;
  created_at: string;
  updated_at: string;
  immutable: true;
}

export async function listVoucherOffers(filters?: {
  city?: string;
  neighborhood?: string;
  scope?: VoucherVisibilityScope;
  type?: VoucherType;
  active?: boolean;
}): Promise<{ offers: VoucherOffer[] }> {
  const params = new URLSearchParams();
  if (filters?.city) params.append('city', filters.city);
  if (filters?.neighborhood) params.append('neighborhood', filters.neighborhood);
  if (filters?.scope) params.append('scope', filters.scope);
  if (filters?.type) params.append('type', filters.type);
  if (filters?.active !== undefined) params.append('active', filters.active.toString());

  const response = await apiFetchJson<{ offers: VoucherOffer[] }>(
    `/marketplace/vouchers/offers?${params.toString()}`
  );
  return response;
}

export async function getVoucherOffer(offerId: string): Promise<VoucherOffer> {
  const response = await apiFetchJson<VoucherOffer>(`/marketplace/vouchers/offers/${offerId}`);
  return response;
}

export async function claimVoucherOffer(
  offerId: string,
  userId: string,
  audit?: {
    ip_hash?: string;
    device_hash?: string;
    neighborhood?: string;
    city?: string;
  }
): Promise<VoucherClaim> {
  const response = await apiFetchJson<VoucherClaim>(
    `/marketplace/vouchers/offers/${offerId}/claim`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, audit }),
    }
  );
  return response;
}

export async function getVoucherClaim(claimId: string): Promise<VoucherClaim> {
  const response = await apiFetchJson<VoucherClaim>(`/marketplace/vouchers/claims/${claimId}`);
  return response;
}

export async function expireVoucherClaims(): Promise<{
  expired_count: number;
  expired_claims: string[];
}> {
  const response = await apiFetchJson<{
    expired_count: number;
    expired_claims: string[];
  }>('/marketplace/vouchers/claims/expire-check', {
    method: 'POST',
  });
  return response;
}

export async function createVoucherOffer(
  storeId: string,
  offer: {
    type: VoucherType;
    title: string;
    description: string;
    visibility_scope: VoucherVisibilityScope;
    restricted_group_ids?: string[];
    start_at: string;
    end_at: string;
    redemption_deadline_at?: string;
    quantity_total: number;
    quantity_per_user?: number;
    eligibility?: {
      min_trust_level?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
      new_users_only?: boolean;
      first_purchase_required?: boolean;
    };
    schedule_constraints?: {
      weekdays?: number[];
      time_start?: string;
      time_end?: string;
    };
    pickup_constraints?: {
      max_minutes_after_claim?: number;
      requires_checkin?: boolean;
    };
    linked_product_id?: string;
    linked_service_template_id?: string;
    linked_service_offering_id?: string;
    linked_bundle_items?: Array<{
      product_id?: string;
      service_offering_id?: string;
      quantity: number;
    }>;
    discount_value?: {
      type: 'percentage' | 'fixed';
      amount: number;
      currency: string;
    };
  }
): Promise<VoucherOffer> {
  const response = await apiFetchJson<VoucherOffer>(
    `/marketplace/stores/${storeId}/vouchers/offers`,
    {
      method: 'POST',
      body: JSON.stringify(offer),
    }
  );
  return response;
}

export async function activateVoucherOffer(offerId: string): Promise<VoucherOffer> {
  const response = await apiFetchJson<VoucherOffer>(
    `/marketplace/vouchers/offers/${offerId}/activate`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function pauseVoucherOffer(offerId: string): Promise<VoucherOffer> {
  const response = await apiFetchJson<VoucherOffer>(
    `/marketplace/vouchers/offers/${offerId}/pause`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function redeemVoucherClaim(
  claimId: string,
  presentedCode: string
): Promise<{
  claim: VoucherClaim;
  order_id?: string;
  service_booking_id?: string;
}> {
  const response = await apiFetchJson<{
    claim: VoucherClaim;
    order_id?: string;
    service_booking_id?: string;
  }>(`/marketplace/vouchers/claims/${claimId}/redeem`, {
    method: 'POST',
    body: JSON.stringify({ presented_code: presentedCode }),
  });
  return response;
}

export async function markVoucherNoShow(claimId: string): Promise<VoucherClaim> {
  const response = await apiFetchJson<VoucherClaim>(
    `/marketplace/vouchers/claims/${claimId}/no-show`,
    {
      method: 'POST',
    }
  );
  return response;
}

// ============================================================
// CAPACIDADE REGIONAL & GARGALOS (LEITURA ESTRUTURAL) (PROMPT 16)
// ============================================================

export type RegionalCapacityStatus = 'healthy' | 'warning' | 'critical';
export type BottleneckCause =
  | 'lack_of_professionals'
  | 'excess_demand'
  | 'capacity_distribution_issue'
  | 'schedule_bottleneck'
  | 'time_bottleneck';
export type SLARiskLevel = 'low' | 'medium' | 'high';

export interface RegionalCapacityMetric {
  region_id: string;
  service_category: string;
  total_resources: number;
  active_resources: number;
  overloaded_resources: number;
  avg_utilization_rate: number;
  peak_utilization_rate: number;
  overload_events_count: number;
  request_expiration_rate: number;
  dispatch_rejection_rate: number;
  avg_response_time_minutes: number;
  avg_execution_time_minutes: number;
  avg_confirmation_time_minutes: number;
  sla_risk_level: SLARiskLevel;
  sla_violation_rate: number;
  request_to_execution_rate: number;
  status: RegionalCapacityStatus;
  bottleneck_cause?: BottleneckCause;
  bottleneck_details?: string;
  calculated_at: string;
  immutable: true;
}

export interface RegionalCapacitySnapshot {
  snapshot_id: string;
  region_id: string;
  period: {
    start: string;
    end: string;
  };
  period_type: 'weekly' | 'monthly';
  total_resources: number;
  total_active_resources: number;
  total_overloaded_resources: number;
  by_category: RegionalCapacityMetric[];
  by_company_type: Array<{
    company_type: string;
    total_resources: number;
    active_resources: number;
    avg_utilization_rate: number;
    status: RegionalCapacityStatus;
  }>;
  identified_bottlenecks: Array<{
    category: string;
    cause: BottleneckCause;
    severity: 'low' | 'medium' | 'high';
    details: string;
  }>;
  overall_status: RegionalCapacityStatus;
  overall_sla_risk: SLARiskLevel;
  version: string;
  generated_at: string;
  immutable: true;
}

export async function listRegionalCapacityMetrics(filters?: {
  region_id: string;
  service_category?: string;
  status?: RegionalCapacityStatus;
}): Promise<{ metrics: RegionalCapacityMetric[] }> {
  const params = new URLSearchParams();
  if (filters?.region_id) params.append('region_id', filters.region_id);
  if (filters?.service_category) params.append('service_category', filters.service_category);
  if (filters?.status) params.append('status', filters.status);

  const response = await apiFetchJson<{ metrics: RegionalCapacityMetric[] }>(
    `/marketplace/regional-capacity/metrics?${params.toString()}`
  );
  return response;
}

export async function getRegionalCapacityMetric(
  regionId: string,
  categoryId: string
): Promise<RegionalCapacityMetric> {
  const response = await apiFetchJson<RegionalCapacityMetric>(
    `/marketplace/regional-capacity/metrics/${regionId}/${categoryId}`
  );
  return response;
}

export async function generateRegionalCapacitySnapshot(
  regionId: string,
  period: {
    start: string;
    end: string;
  },
  periodType: 'weekly' | 'monthly' = 'monthly'
): Promise<RegionalCapacitySnapshot> {
  const response = await apiFetchJson<RegionalCapacitySnapshot>(
    '/marketplace/regional-capacity/snapshots',
    {
      method: 'POST',
      body: JSON.stringify({
        region_id: regionId,
        period,
        period_type: periodType,
      }),
    }
  );
  return response;
}

export async function listRegionalCapacitySnapshots(filters?: {
  region_id?: string;
  period_type?: 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
}): Promise<{ snapshots: RegionalCapacitySnapshot[] }> {
  const params = new URLSearchParams();
  if (filters?.region_id) params.append('region_id', filters.region_id);
  if (filters?.period_type) params.append('period_type', filters.period_type);
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);

  const response = await apiFetchJson<{ snapshots: RegionalCapacitySnapshot[] }>(
    `/marketplace/regional-capacity/snapshots?${params.toString()}`
  );
  return response;
}

export async function getRegionalCapacitySnapshot(
  snapshotId: string
): Promise<RegionalCapacitySnapshot> {
  const response = await apiFetchJson<RegionalCapacitySnapshot>(
    `/marketplace/regional-capacity/snapshots/${snapshotId}`
  );
  return response;
}

// ============================================================
// EXPANSÃO GUIADA DE PRESTADORES (SERVIÇOS) (PROMPT 17)
// ============================================================

export type ExpansionSignalType =
  | 'need_more_providers'
  | 'need_more_capacity'
  | 'need_specialized_provider'
  | 'need_extended_hours';

export type ExpansionUnlockFeature =
  | 'facilitated_onboarding'
  | 'economic_incentive'
  | 'service_catalog_suggestion'
  | 'b2b_capacity_market'
  | 'strategic_vouchers';

export interface RegionalExpansionSignal {
  signal_id: string;
  region_id: string;
  service_category: string;
  signal_type: ExpansionSignalType;
  bottleneck_cause: BottleneckCause;
  triggering_metrics: {
    status: RegionalCapacityStatus;
    sla_risk_level: SLARiskLevel;
    request_expiration_rate: number;
    dispatch_rejection_rate: number;
    avg_utilization_rate: number;
    overloaded_resources_ratio: number;
  };
  critical_time_window?: {
    weekdays?: number[];
    time_start?: string;
    time_end?: string;
  };
  source_snapshot_id: string;
  unlocked_features: ExpansionUnlockFeature[];
  status: 'active' | 'resolved' | 'expired';
  created_at: string;
  resolved_at?: string;
  immutable: true;
}

export interface ExpansionUnlock {
  unlock_id: string;
  signal_id: string;
  region_id: string;
  service_category: string;
  feature: ExpansionUnlockFeature;
  details: {
    description: string;
    eligibility_criteria?: string[];
    available_until?: string;
  };
  status: 'available' | 'consumed' | 'expired';
  consumed_at?: string;
  created_at: string;
  updated_at: string;
  immutable: false;
}

export async function generateExpansionSignalsFromSnapshot(
  snapshotId: string
): Promise<{ signals: RegionalExpansionSignal[] }> {
  const response = await apiFetchJson<{ signals: RegionalExpansionSignal[] }>(
    '/marketplace/regional-expansion/generate-signals',
    {
      method: 'POST',
      body: JSON.stringify({ snapshot_id: snapshotId }),
    }
  );
  return response;
}

export async function getActiveExpansionSignals(filters?: {
  region_id?: string;
  service_category?: string;
  signal_type?: ExpansionSignalType;
}): Promise<{ signals: RegionalExpansionSignal[] }> {
  const params = new URLSearchParams();
  if (filters?.region_id) params.append('region_id', filters.region_id);
  if (filters?.service_category) params.append('service_category', filters.service_category);
  if (filters?.signal_type) params.append('signal_type', filters.signal_type);

  const response = await apiFetchJson<{ signals: RegionalExpansionSignal[] }>(
    `/marketplace/regional-expansion/signals?${params.toString()}`
  );
  return response;
}

export async function getAvailableExpansionUnlocks(filters?: {
  region_id?: string;
  service_category?: string;
  feature?: ExpansionUnlockFeature;
}): Promise<{ unlocks: ExpansionUnlock[] }> {
  const params = new URLSearchParams();
  if (filters?.region_id) params.append('region_id', filters.region_id);
  if (filters?.service_category) params.append('service_category', filters.service_category);
  if (filters?.feature) params.append('feature', filters.feature);

  const response = await apiFetchJson<{ unlocks: ExpansionUnlock[] }>(
    `/marketplace/regional-expansion/unlocks?${params.toString()}`
  );
  return response;
}

export async function consumeExpansionUnlock(unlockId: string): Promise<ExpansionUnlock> {
  const response = await apiFetchJson<ExpansionUnlock>(
    `/marketplace/regional-expansion/unlocks/${unlockId}/consume`,
    {
      method: 'POST',
    }
  );
  return response;
}

export async function getRegionalExpansionSummary(regionId: string): Promise<{
  active_signals_count: number;
  available_unlocks_count: number;
  categories_affected: string[];
  features_unlocked: ExpansionUnlockFeature[];
}> {
  const response = await apiFetchJson<{
    active_signals_count: number;
    available_unlocks_count: number;
    categories_affected: string[];
    features_unlocked: ExpansionUnlockFeature[];
  }>(`/marketplace/regional-expansion/summary/${regionId}`);
  return response;
}

export async function isFeatureUnlocked(
  regionId: string,
  serviceCategory: string,
  feature: ExpansionUnlockFeature
): Promise<{ is_unlocked: boolean }> {
  const params = new URLSearchParams();
  params.append('region_id', regionId);
  params.append('service_category', serviceCategory);
  params.append('feature', feature);

  const response = await apiFetchJson<{ is_unlocked: boolean }>(
    `/marketplace/regional-expansion/check-feature?${params.toString()}`
  );
  return response;
}

// ============================================================
// PRECIFICAÇÃO ASSISTIDA (PRIVADA, NÃO PRESCRITIVA) (PROMPT 15)
// ============================================================

export type OperationalRiskLevel = 'low' | 'medium' | 'high';

export interface BreakEvenAnalysis {
  break_even_monthly_services: number;
  break_even_monthly_revenue: { amount: number; currency: string };
  current_monthly_services: number;
  current_monthly_revenue: { amount: number; currency: string };
  margin_to_break_even: number;
  is_above_break_even: boolean;
  calculated_at: string;
  immutable: true;
}

export interface ServiceMarginAnalysis {
  service_offering_id: string;
  service_name: string;
  average_price: { amount: number; currency: string };
  average_cost: { amount: number; currency: string };
  margin_per_service: { amount: number; currency: string };
  margin_percentage: number;
  is_profitable: boolean;
  services_executed_count: number;
  total_revenue: { amount: number; currency: string };
  total_cost: { amount: number; currency: string };
  calculated_at: string;
  immutable: true;
}

export interface OperationalCostProfile {
  store_id: string;
  company_id: string;
  fixed_costs_monthly: {
    rent?: { amount: number; currency: string };
    salaries?: { amount: number; currency: string };
    pro_labore?: { amount: number; currency: string };
    systems?: { amount: number; currency: string };
    other?: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  variable_costs_per_service: {
    materials?: { amount: number; currency: string };
    commission?: { amount: number; currency: string };
    transportation?: { amount: number; currency: string };
    other?: { amount: number; currency: string };
    average_per_service: { amount: number; currency: string };
  };
  costs_per_hour?: {
    fixed_cost_per_hour: { amount: number; currency: string };
    variable_cost_per_hour: { amount: number; currency: string };
    total_cost_per_hour: { amount: number; currency: string };
  };
  data_source: {
    declared: boolean;
    historical: boolean;
    last_updated: string;
  };
  calculated_at: string;
  immutable: false;
}

export interface RealOperationMetrics {
  store_id: string;
  company_id: string;
  period: {
    start: string;
    end: string;
  };
  average_ticket: { amount: number; currency: string };
  total_revenue: { amount: number; currency: string };
  total_services: number;
  average_execution_time_minutes: number;
  average_response_time_minutes: number;
  cancellation_rate: number;
  cancelled_services_count: number;
  total_requests_count: number;
  services_at_loss: number;
  services_at_loss_percentage: number;
  total_loss_amount: { amount: number; currency: string };
  calculated_at: string;
  immutable: true;
}

export interface PricingAssistanceReport {
  report_id: string;
  store_id: string;
  company_id: string;
  actor_id: string;
  period: {
    start: string;
    end: string;
  };
  cost_profile: OperationalCostProfile;
  operation_metrics: RealOperationMetrics;
  break_even_analysis: BreakEvenAnalysis;
  service_margins: ServiceMarginAnalysis[];
  average_monthly_margin: {
    total_revenue: { amount: number; currency: string };
    total_cost: { amount: number; currency: string };
    margin: { amount: number; currency: string };
    margin_percentage: number;
  };
  operational_risk: OperationalRiskLevel;
  risk_factors: string[];
  alerts: Array<{
    type: 'operating_at_loss' | 'below_break_even' | 'high_cancellation_rate' | 'low_margin_services';
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }>;
  governance: {
    no_price_suggestion: true;
    no_catalog_modification: true;
    no_matching_interference: true;
    private_only: true;
  };
  generated_at: string;
  immutable: true;
}

export async function setOperationalCostProfile(
  storeId: string,
  companyId: string,
  profile: {
    fixed_costs_monthly?: {
      rent?: { amount: number; currency: string };
      salaries?: { amount: number; currency: string };
      pro_labore?: { amount: number; currency: string };
      systems?: { amount: number; currency: string };
      other?: { amount: number; currency: string };
    };
    variable_costs_per_service?: {
      materials?: { amount: number; currency: string };
      commission?: { amount: number; currency: string };
      transportation?: { amount: number; currency: string };
      other?: { amount: number; currency: string };
    };
    costs_per_hour?: {
      fixed_cost_per_hour?: { amount: number; currency: string };
      variable_cost_per_hour?: { amount: number; currency: string };
    };
  }
): Promise<OperationalCostProfile> {
  const response = await apiFetchJson<OperationalCostProfile>(
    `/marketplace/stores/${storeId}/operational-cost-profile`,
    {
      method: 'POST',
      body: JSON.stringify({
        company_id: companyId,
        ...profile,
      }),
    }
  );
  return response;
}

export async function getOperationalCostProfile(storeId: string): Promise<OperationalCostProfile> {
  const response = await apiFetchJson<OperationalCostProfile>(
    `/marketplace/stores/${storeId}/operational-cost-profile`
  );
  return response;
}

export async function generatePricingAssistanceReport(
  storeId: string,
  companyId: string,
  actorId: string,
  period: {
    start: string;
    end: string;
  }
): Promise<PricingAssistanceReport> {
  const response = await apiFetchJson<PricingAssistanceReport>(
    `/marketplace/stores/${storeId}/pricing-assistance-report`,
    {
      method: 'POST',
      body: JSON.stringify({
        company_id: companyId,
        actor_id: actorId,
        period,
      }),
    }
  );
  return response;
}

export async function getPricingAssistanceReport(
  reportId: string,
  actorId: string
): Promise<PricingAssistanceReport> {
  const params = new URLSearchParams();
  params.append('actor_id', actorId);

  const response = await apiFetchJson<PricingAssistanceReport>(
    `/marketplace/pricing-assistance-reports/${reportId}?${params.toString()}`
  );
  return response;
}

export async function listPricingAssistanceReports(
  storeId: string,
  actorId: string,
  filters?: {
    start_date?: string;
    end_date?: string;
  }
): Promise<{ reports: PricingAssistanceReport[] }> {
  const params = new URLSearchParams();
  params.append('actor_id', actorId);
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);

  const response = await apiFetchJson<{ reports: PricingAssistanceReport[] }>(
    `/marketplace/stores/${storeId}/pricing-assistance-reports?${params.toString()}`
  );
  return response;
}

