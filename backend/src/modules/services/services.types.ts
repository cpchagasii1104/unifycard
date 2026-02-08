// src/modules/services/services.types.ts
// Tipos do Domínio de SERVIÇOS
// 🔴 BLINDAGEM: Serviço NÃO é post, NÃO é categoria, NÃO é agenda
// Serviço é um objeto de domínio que pode gerar ações reais

/**
 * Tipo de Serviço
 * 🔴 BLINDAGEM: Tipo é contexto, não decisão
 */
export enum ServiceType {
  SERVICE = 'service',    // Serviço genérico
  RENTAL = 'rental',      // Aluguel/locação
  EVENT = 'event',        // Evento (serviço de evento)
  JOB = 'job',            // Vaga de trabalho (serviço de contratação)
}

/**
 * Status do Serviço
 * 🔴 BLINDAGEM: Status é estado, não decisão
 */
export enum ServiceStatus {
  DRAFT = 'draft',        // Rascunho (não visível)
  ACTIVE = 'active',      // Ativo (visível e disponível)
  PAUSED = 'paused',      // Pausado (visível mas não disponível)
}

/**
 * Tipo de Precificação
 * 🔴 BLINDAGEM: Precificação é informação, não execução de pagamento
 */
export type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'fixed' | 'quote';

/**
 * Serviço (entidade de domínio)
 * 🔴 BLINDAGEM: Serviço pertence a um Actor (user, page ou group)
 * Serviço NÃO decide nada sozinho
 * Serviço NÃO faz matching automático
 * Serviço NÃO executa pagamento direto
 * Serviço NÃO cria score
 */
export interface Service {
  serviceId: string;
  tenantId: string;
  actorId: string; // OBRIGATÓRIO: Actor que oferece o serviço
  name: string;
  slug: string;
  description?: string | null;
  shortDescription?: string | null;
  serviceType: ServiceType;
  status: ServiceStatus;
  categoryId?: string | null; // Categoria (opcional, scope adequado)
  priceCents?: number | null; // Preço em centavos
  currency: string; // Moeda (ex: 'BRL', 'USD')
  pricingType?: PricingType | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  neighborhood?: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  activatedAt?: Date | null; // Quando foi ativado pela primeira vez
}

/**
 * Linha do banco de dados (ServiceRow)
 */
export interface ServiceRow {
  service_id: string;
  tenant_id: string;
  actor_id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  service_type: ServiceType;
  status: ServiceStatus;
  category_id: string | null;
  price_cents: number | null;
  currency: string;
  pricing_type: PricingType | null;
  country_id: string | null;
  state_id: string | null;
  city_id: string | null;
  neighborhood: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  activatedAt: Date | null;
}

/**
 * Input para criar serviço
 * 🔴 BLINDAGEM: actorId é OBRIGATÓRIO
 */
export interface CreateServiceInput {
  actorId: string; // OBRIGATÓRIO
  name: string;
  slug?: string; // Opcional: será gerado se não fornecido
  description?: string | null;
  shortDescription?: string | null;
  serviceType?: ServiceType;
  status?: ServiceStatus; // Default: 'draft'
  categoryId?: string | null;
  priceCents?: number | null;
  currency?: string; // Default: 'BRL'
  pricingType?: PricingType | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  neighborhood?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Input para atualizar serviço
 */
export interface UpdateServiceInput {
  name?: string;
  description?: string | null;
  shortDescription?: string | null;
  serviceType?: ServiceType;
  status?: ServiceStatus;
  categoryId?: string | null;
  priceCents?: number | null;
  currency?: string;
  pricingType?: PricingType | null;
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  neighborhood?: string | null;
  metadata?: Record<string, any>;
}



