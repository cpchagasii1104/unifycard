// src/modules/services/service-feed.plugin.ts
// Plugin do Feed para Serviços
// 🔴 BLINDAGEM: Feed não executa ações
// 🔴 BLINDAGEM: Plugin não decide comportamento
// 🔴 BLINDAGEM: Ações são apenas declaração, não execução
// 🔴 BLINDAGEM: Booking é domínio, não feed
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores

import type {
  SocialFeedPlugin,
  FeedItemDTO,
} from '@core/feed/feed-plugin.types';
import { FeedAction } from '@core/feed/feed-plugin.types';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { servicesService } from './services.service';
import type { Service } from './services.types';
import { pool } from '@core/database/pool';

/**
 * Plugin do Feed para Serviços
 * 🔴 BLINDAGEM: Plugin apenas renderiza dados, não executa ações
 * 🔴 BLINDAGEM: Plugin não decide comportamento
 * 🔴 BLINDAGEM: Ações são apenas declaração, não execução
 * 🔴 BLINDAGEM: Booking é domínio, não feed
 */
class ServicesFeedPlugin implements SocialFeedPlugin {
  name = 'services';
  
  /**
   * Intents suportados pelo plugin
   * 🔴 BLINDAGEM: Plugin declara quais intents suporta, não decide comportamento
   */
  supportedIntents: ActorIntent[] = [
    ActorIntent.OFFER_SERVICE, // Intent canônico para ofertar serviço
  ];

  /**
   * Renderiza dados do serviço para o feed
   * 🔴 BLINDAGEM: Apenas transforma dados em DTO, não executa ações
   * 🔴 BLINDAGEM: Feed usa DTO para renderizar, não para decidir
   * 
   * @param sourceId ID do post (não do serviço diretamente)
   * @param sourceType Tipo da entidade fonte (geralmente 'post')
   * @param intent Intent que originou o item
   * @param metadata Metadados do post (pode conter service_id ou linked_service_id)
   * @returns DTO para renderização no feed
   */
  async renderFeedItem(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null> {
    // 🔴 BLINDAGEM: Buscar ID do serviço a partir do metadata do post
    // O metadata pode conter linked_service_id ou service_id
    const serviceId = metadata?.linked_service_id || metadata?.service_id || metadata?.serviceId;
    
    if (!serviceId) {
      // Se não houver service_id no metadata, retornar null
      return null;
    }

    // 🔴 BLINDAGEM: Buscar dados do serviço (apenas leitura, não execução)
    // Precisamos do tenantId, mas não temos acesso direto aqui
    // Vamos buscar o post primeiro para obter o tenantId
    const post = await this.getPost(sourceId);
    if (!post) {
      return null;
    }

    const tenantId = post.tenant_id;

    // 🔴 BLINDAGEM: Buscar serviço usando o serviço de services
    // NÃO executa ações, apenas lê dados
    const service = await servicesService.getService(tenantId, serviceId);
    if (!service) {
      return null;
    }

    // 🔴 BLINDAGEM: Transformar dados do serviço em DTO (apenas dados, não lógica)
    return this.serviceToDTO(service, sourceId);
  }

  /**
   * Declara ações possíveis para o serviço
   * 🔴 BLINDAGEM: Apenas declara ações, não executa
   * 🔴 BLINDAGEM: Execução é feita pelo domínio de services, não pelo feed
   * 🔴 BLINDAGEM: Booking é domínio, não feed
   * 
   * @param sourceId ID do post
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o item
   * @returns Lista de ações disponíveis (declaração, não execução)
   */
  async getAvailableActions(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent
  ): Promise<FeedAction[]> {
    // 🔴 BLINDAGEM: Buscar ID do serviço a partir do metadata do post
    const post = await this.getPost(sourceId);
    if (!post) {
      return [];
    }

    const metadata = post.metadata || {};
    const serviceId = metadata.linked_service_id || metadata.service_id || metadata.serviceId;
    
    if (!serviceId) {
      return [];
    }

    const tenantId = post.tenant_id;

    // 🔴 BLINDAGEM: Buscar serviço para determinar ações disponíveis
    // NÃO executa ações, apenas lê dados para declarar ações
    const service = await servicesService.getService(tenantId, serviceId);
    if (!service) {
      return [];
    }

    // 🔴 BLINDAGEM: Declarar ações baseadas no estado do serviço
    // Ações são apenas declaração, não execução
    const actions: FeedAction[] = [];

    // Sempre disponível: visualizar serviço
    actions.push(FeedAction.VIEW);

    // Se serviço está ativo, verificar se tem availability para permitir booking
    // 🔴 BLINDAGEM: Booking é domínio, não feed - apenas declaramos a ação
    if (service.status === 'active') {
      const hasAvailability = await this.hasAvailability(tenantId, serviceId);
      if (hasAvailability) {
        actions.push(FeedAction.BOOK);
      }
    }

    return actions;
  }

  /**
   * Valida se o plugin pode processar um item
   * 🔴 BLINDAGEM: Apenas valida capacidade, não decide comportamento
   * 
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o item
   * @returns true se o plugin pode processar, false caso contrário
   */
  canHandle(sourceType: string, intent: ActorIntent): boolean {
    // 🔴 BLINDAGEM: Plugin pode processar se:
    // 1. Intent é OFFER_SERVICE
    // 2. SourceType é 'post' ou 'service'
    return (
      intent === ActorIntent.OFFER_SERVICE &&
      (sourceType === 'post' || sourceType === 'service')
    );
  }

  /**
   * Busca post por ID
   * 🔴 BLINDAGEM: Apenas leitura, não execução
   * 
   * @param postId ID do post
   * @returns Dados do post ou null
   */
  private async getPost(postId: string): Promise<{
    tenant_id: string;
    metadata: Record<string, any>;
  } | null> {
    // 🔴 BLINDAGEM: Buscar post usando query direta (apenas leitura)
    // Não usamos serviço de posts para evitar dependência circular
    // Usamos pool.query diretamente pois não temos tenantId aqui
    const result = await pool.query<{
      tenant_id: string;
      metadata: Record<string, any>;
    }>(
      `
      SELECT tenant_id, COALESCE(metadata, '{}'::jsonb) as metadata
      FROM posts
      WHERE post_id = $1
      LIMIT 1
      `,
      [postId]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Verifica se serviço tem availability
   * 🔴 BLINDAGEM: Apenas verifica existência, não executa booking
   * 🔴 BLINDAGEM: Booking é domínio, não feed
   * 
   * @param tenantId ID do tenant
   * @param serviceId ID do serviço
   * @returns true se tem availability, false caso contrário
   */
  private async hasAvailability(tenantId: string, serviceId: string): Promise<boolean> {
    // 🔴 F-SERVICE-AVAILABILITY-LEGACY-FEED-BADGE-CONTAINMENT-SLICE-A2C (DECISION-0156 /
    //    DT-SERVICE-AVAILABILITY-RUNTIME-DRIFT-FROM-SSOT R3): o feed empurra `FeedAction.BOOK` quando este
    //    sinal é true. Para serviço canônico-bound o SSOT temporal reservável é a OFERTA
    //    (owner_type='service_offering'), NUNCA o escopo legado owner_type='service' — então NÃO habilitamos a
    //    CTA de booking do feed a partir do sinal legado (ele parecia agenda reservável real e não é). Contenção
    //    fail-closed: canônico ⇒ false. Dado legado preservado; enum e writers intactos; re-key do feed para
    //    service_offering = resíduo (frente de feed/discovery própria). Conter ≠ matar.
    const service = await servicesService.getService(tenantId, serviceId);
    if (service?.canonicalServiceId) {
      return false;
    }
    // 🟡 Serviço sem canonical (legado puro, inexistente sob F-OFFER-2A) preserva a leitura legada abaixo.
    // Usamos Unified Availability Core (owner_type = 'service', owner_id = serviceId). Apenas verificação,
    // não execução; NÃO autoridade de oferta-tempo nem de booking.
    const result = await pool.query<{ count: string }>(
      `
      SELECT COUNT(*) as count
      FROM availability
      WHERE tenant_id = $1
        AND owner_type = 'service'
        AND owner_id = $2
        AND status = 'active'
      LIMIT 1
      `,
      [tenantId, serviceId]
    );

    if (!result.rows || result.rows.length === 0) {
      return false;
    }

    const count = parseInt(result.rows[0].count, 10);
    return count > 0;
  }

  /**
   * Transforma serviço em DTO para renderização
   * 🔴 BLINDAGEM: Apenas transformação de dados, não lógica
   * 
   * @param service Serviço a ser transformado
   * @param postId ID do post relacionado
   * @returns DTO para renderização
   */
  private serviceToDTO(service: Service, postId: string): FeedItemDTO {
    // 🔴 BLINDAGEM: Construir DTO estável com dados mínimos do serviço
    // DTO é apenas dados, não lógica
    
    // Formatar preço se existir (priceCents está em centavos)
    const priceInfo = service.priceCents
      ? {
          amountCents: service.priceCents,
          currency: service.currency || 'BRL',
        }
      : null;

    // 🔴 BLINDAGEM: Construir metadados visuais (apenas dados, não lógica)
    const visualMetadata: Record<string, any> = {
      serviceId: service.serviceId,
      status: service.status,
      serviceType: service.serviceType,
      pricingType: service.pricingType || null,
    };

    if (priceInfo) {
      visualMetadata.price = priceInfo;
    }

    // Localização (se disponível)
    if (service.cityId) {
      visualMetadata.city = service.cityId;
    }
    if (service.stateId) {
      visualMetadata.state = service.stateId;
    }
    if (service.countryId) {
      visualMetadata.country = service.countryId;
    }
    if (service.neighborhood) {
      visualMetadata.neighborhood = service.neighborhood;
    }

    // 🔴 BLINDAGEM: Retornar DTO estável
    return {
      id: postId, // ID do post (não do serviço) para manter referência ao post original
      type: 'service',
      title: service.name,
      description: service.description || service.shortDescription || undefined,
      // imageUrl e thumbnailUrl podem ser adicionados se o serviço tiver imagens
      metadata: visualMetadata,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt ? (typeof service.updatedAt === 'string' ? new Date(service.updatedAt) : service.updatedAt) : undefined,
      // availableActions será preenchido separadamente via getAvailableActions
    };
  }
}

/**
 * Instância singleton do plugin
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const servicesFeedPlugin = new ServicesFeedPlugin();


