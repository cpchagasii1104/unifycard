// frontend/src/api/service-discovery.ts
// API Client para Descoberta de Serviços
// SPRINT: Service Discovery MVP
// Conectado ao endpoint backend canônico GET /services/discover

import { apiFetch } from './client';
import { getService, type Service } from './services';
import { listServiceAvailabilities, type ServiceAvailability } from './service-availability';

export interface ServiceDiscoveryFilters {
  category_id?: string;
  city_id?: string;
  state_id?: string;
  country_id?: string;
  start_date?: string; // ISO 8601 date string
  end_date?: string; // ISO 8601 date string
  has_availability?: boolean;
  actor_type?: 'user' | 'page' | 'group' | 'channel';
  limit?: number;
  offset?: number;
}

// Estrutura retornada pelo backend /services/discover
// O backend retorna Service com campos camelCase (serviceId, etc)
export interface DiscoveredService {
  // Service fields (camelCase como retornado pelo backend)
  serviceId: string;
  // B2 / F-OFFER: identidade canônica do serviço — TRANSPORTADA do backend (NÃO derivada no front).
  // É a chave para listar as ofertas contratáveis via GET /services/offerings/by-canonical/:canonicalServiceId.
  canonicalServiceId: string | null;
  tenantId: string;
  actorId: string;
  name: string;
  slug: string | null;
  description: string | null;
  shortDescription: string | null;
  serviceType: string;
  status: string;
  categoryId: string | null;
  priceCents: number | null;
  currency: string | null;
  pricingType: string | null;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  neighborhood: string | null;
  metadata: Record<string, any> | null;
  createdAt: string; // ISO 8601 string
  updatedAt: string; // ISO 8601 string
  activatedAt: string | null; // ISO 8601 string
  
  // Enriched fields
  actor?: {
    actor_id: string;
    actor_type: string;
    display_name: string | null;
    city_id: string | null;
  };
  availability_summary?: {
    has_availability: boolean;
    next_available_date: string | null; // ISO 8601 string
  };
  
  // Compatibilidade com Service interface (para getServiceForDiscovery)
  id?: string; // Alias para serviceId
}

export interface ServiceDiscoveryResponse {
  ok: boolean;
  data: DiscoveredService[];
  count: number;
}

/**
 * Descobrir serviços usando endpoint backend canônico
 * 🔴 BLINDAGEM: NÃO cria ranking, score ou recomendação
 * 🔴 BLINDAGEM: Apenas consulta determinística e explícita
 */
export async function discoverServices(filters: ServiceDiscoveryFilters = {}): Promise<DiscoveredService[]> {
  try {
    const queryParams = new URLSearchParams();

    if (filters.category_id) queryParams.append('category_id', filters.category_id);
    if (filters.city_id) queryParams.append('city_id', filters.city_id);
    if (filters.state_id) queryParams.append('state_id', filters.state_id);
    if (filters.country_id) queryParams.append('country_id', filters.country_id);
    if (filters.start_date) queryParams.append('start_date', filters.start_date);
    if (filters.end_date) queryParams.append('end_date', filters.end_date);
    if (filters.has_availability !== undefined) {
      queryParams.append('has_availability', filters.has_availability ? 'true' : 'false');
    }
    if (filters.actor_type) queryParams.append('actor_type', filters.actor_type);
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.offset) queryParams.append('offset', filters.offset.toString());

    const query = queryParams.toString();
    const response = await apiFetch(`/services/discover${query ? `?${query}` : ''}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro ao descobrir serviços' }));
      throw new Error(error.error || 'Erro ao descobrir serviços');
    }

    const result: ServiceDiscoveryResponse = await response.json();

    if (!result.ok || !result.data) {
      throw new Error('Resposta inválida do servidor');
    }

    // Retornar dados na ordem recebida do backend (sem reordenar)
    return result.data || [];
  } catch (err) {
    console.error('Erro ao descobrir serviços:', err);
    throw err;
  }
}

/**
 * Buscar serviço com detalhes completos para descoberta
 * Nota: Usa endpoint de serviço individual e enriquece com disponibilidades
 */
export async function getServiceForDiscovery(serviceId: string): Promise<DiscoveredService | null> {
  try {
    const service = await getService(serviceId);
    
    // Buscar disponibilidades
    const availabilities = await listServiceAvailabilities(service.id).catch(() => []);

    const hasOpenAvailability = availabilities.some(
      av => av.status === 'active' && (!av.endDatetime || new Date(av.endDatetime) > new Date())
    );

    // Encontrar próxima data disponível
    const futureAvailabilities = availabilities
      .filter(av => {
        const avStart = new Date(av.startDatetime);
        return avStart > new Date() && av.status === 'active';
      })
      .sort((a, b) => new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime());

    const nextAvailableDate = futureAvailabilities.length > 0 
      ? futureAvailabilities[0].startDatetime 
      : null;

    // Mapear Service para DiscoveredService
    return {
      serviceId: service.id,
      canonicalServiceId: (service as { canonicalServiceId?: string | null }).canonicalServiceId ?? null,
      tenantId: service.tenantId,
      actorId: service.actorId,
      name: service.name,
      slug: service.slug,
      description: service.description,
      shortDescription: service.shortDescription,
      serviceType: service.serviceType,
      status: service.status,
      categoryId: service.categoryId,
      priceCents: service.priceCents,
      currency: service.currency,
      pricingType: service.pricingType,
      countryId: service.countryId,
      stateId: service.stateId,
      cityId: service.cityId,
      neighborhood: service.neighborhood,
      metadata: service.metadata,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt,
      activatedAt: null, // Service interface não tem este campo
      id: service.id, // Alias para compatibilidade
      availability_summary: {
        has_availability: hasOpenAvailability,
        next_available_date: nextAvailableDate,
      },
    };
  } catch (err) {
    console.error('Erro ao buscar serviço:', err);
    return null;
  }
}
