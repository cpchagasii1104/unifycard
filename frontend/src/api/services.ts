// frontend/src/api/services.ts
// API Client para Services (Catálogo)
// SPRINT: Services MVP

import { apiFetch } from './client';

export type ServiceStatus = 'draft' | 'active' | 'paused';
export type ServiceType = 'service' | 'rental' | 'event' | 'job';
export type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'fixed' | 'quote';

export interface Service {
  // Contrato vivo = backend DTO (services.repository.toService): a chave é `serviceId`
  // (row.service_id), NÃO `id`. O frontend projeta esse contrato; não inventa `id` paralelo.
  serviceId: string;
  tenantId: string;
  actorId: string;
  name: string;
  slug: string | null;
  description: string | null;
  shortDescription: string | null;
  serviceType: ServiceType;
  status: ServiceStatus;
  categoryId: string | null;
  // Backend mapeia services.canonical_service_id no DTO (services.repository) — chave p/ listar ofertas by-canonical.
  canonicalServiceId: string | null;
  priceCents: number | null;
  currency: string | null;
  pricingType: PricingType | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  neighborhood: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceInput {
  actorId: string;
  name: string;
  slug?: string;
  description?: string | null;
  shortDescription?: string | null;
  serviceType?: ServiceType;
  status?: ServiceStatus;
  // Vínculo com o serviço CANÔNICO (catálogo governado). Backend aceita em createServiceSchema
  // (z.string().uuid().nullable().optional()). É a chave que liga discovery → ofertas by-canonical.
  canonicalServiceId?: string | null;
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

export interface ServiceFilters {
  status?: ServiceStatus;
}

/**
 * Criar novo serviço
 */
export async function createService(input: CreateServiceInput): Promise<Service> {
  const response = await apiFetch('/services', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao criar serviço' }));
    throw new Error(error.error || 'Erro ao criar serviço');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Buscar serviço por ID
 */
export async function getService(serviceId: string): Promise<Service> {
  const response = await apiFetch(`/services/${serviceId}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao buscar serviço' }));
    throw new Error(error.error || 'Erro ao buscar serviço');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Listar serviços de um actor
 */
export async function listActorServices(actorId: string, filters?: ServiceFilters): Promise<Service[]> {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);

  const query = queryParams.toString();
  const response = await apiFetch(`/services/actors/${actorId}/services${query ? `?${query}` : ''}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao listar serviços' }));
    throw new Error(error.error || 'Erro ao listar serviços');
  }
  const result = await response.json();
  return result.data || [];
}

/**
 * Atualizar serviço
 */
export async function updateService(serviceId: string, input: UpdateServiceInput): Promise<Service> {
  const response = await apiFetch(`/services/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro ao atualizar serviço' }));
    throw new Error(error.error || 'Erro ao atualizar serviço');
  }
  const result = await response.json();
  return result.data;
}




