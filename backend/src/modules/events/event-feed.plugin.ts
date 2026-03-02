// src/modules/events/event-feed.plugin.ts
// Plugin do Feed para Eventos
// 🔴 BLINDAGEM: Feed não decide comportamento
// 🔴 BLINDAGEM: Plugin não executa ações de domínio
// 🔴 BLINDAGEM: Ações são apenas declaração, não execução
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores

import type {
  SocialFeedPlugin,
  FeedItemDTO,
} from '@core/feed/feed-plugin.types';
import { FeedAction } from '@core/feed/feed-plugin.types';
import { ActorIntent } from '@modules/social/actor-intents.types';
import { eventsService } from './events.service';
import type { Event } from './events.types';
import { pool } from '@core/database/pool';

/**
 * Plugin do Feed para Eventos
 * 🔴 BLINDAGEM: Plugin apenas renderiza dados, não executa ações
 * 🔴 BLINDAGEM: Plugin não decide comportamento
 * 🔴 BLINDAGEM: Ações são apenas declaração, não execução
 */
class EventFeedPlugin implements SocialFeedPlugin {
  name = 'events';
  
  /**
   * Intents suportados pelo plugin
   * 🔴 BLINDAGEM: Plugin declara quais intents suporta, não decide comportamento
   */
  supportedIntents: ActorIntent[] = [
    ActorIntent.ANNOUNCE_EVENT, // Intent canônico para anunciar evento
  ];

  /**
   * Renderiza dados do evento para o feed
   * 🔴 BLINDAGEM: Apenas transforma dados em DTO, não executa ações
   * 🔴 BLINDAGEM: Feed usa DTO para renderizar, não para decidir
   * 
   * @param sourceId ID do post (não do evento diretamente)
   * @param sourceType Tipo da entidade fonte (geralmente 'post')
   * @param intent Intent que originou o item
   * @param metadata Metadados do post (pode conter linked_event_id ou event_id)
   * @returns DTO para renderização no feed
   */
  async renderFeedItem(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null> {
    // 🔴 BLINDAGEM: Buscar ID do evento a partir do metadata do post
    // O metadata pode conter linked_event_id ou event_id
    const eventId = metadata?.linked_event_id || metadata?.event_id || metadata?.eventId;
    
    if (!eventId) {
      // Se não houver event_id no metadata, tentar usar sourceId diretamente
      // (caso o post_id seja o mesmo que o event_id)
      // Mas isso é menos comum, então retornamos null
      return null;
    }

    // 🔴 BLINDAGEM: Buscar dados do evento (apenas leitura, não execução)
    // Precisamos do tenantId, mas não temos acesso direto aqui
    // Vamos buscar o post primeiro para obter o tenantId
    const post = await this.getPost(sourceId);
    if (!post) {
      return null;
    }

    const tenantId = post.tenant_id;

    // 🔴 BLINDAGEM: Buscar evento usando o serviço de eventos
    // NÃO executa ações, apenas lê dados
    const event = await eventsService.getEvent(tenantId, eventId);
    if (!event) {
      return null;
    }

    // 🔴 BLINDAGEM: Transformar dados do evento em DTO (apenas dados, não lógica)
    return this.eventToDTO(event, sourceId);
  }

  /**
   * Declara ações possíveis para o evento
   * 🔴 BLINDAGEM: Apenas declara ações, não executa
   * 🔴 BLINDAGEM: Execução é feita pelo domínio de eventos, não pelo feed
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
    // 🔴 BLINDAGEM: Buscar ID do evento a partir do metadata do post
    const post = await this.getPost(sourceId);
    if (!post) {
      return [];
    }

    const metadata = post.metadata || {};
    const eventId = metadata.linked_event_id || metadata.event_id || metadata.eventId;
    
    if (!eventId) {
      return [];
    }

    const tenantId = post.tenant_id;

    // 🔴 BLINDAGEM: Buscar evento para determinar ações disponíveis
    // NÃO executa ações, apenas lê dados para declarar ações
    const event = await eventsService.getEvent(tenantId, eventId);
    if (!event) {
      return [];
    }

    // 🔴 BLINDAGEM: Declarar ações baseadas no estado do evento
    // Ações são apenas declaração, não execução
    const actions: FeedAction[] = [];

    // Sempre disponível: visualizar evento
    actions.push(FeedAction.VIEW);

    // Se evento está publicado e tem ticket, permitir comprar
    if (event.status === 'published' && event.ticketPrice && event.ticketPrice > 0) {
      actions.push(FeedAction.BUY);
    }

    // Se evento permite check-in (status publicado e ainda não terminou)
    if (event.status === 'published' && event.endTime > new Date()) {
      // 🔴 BLINDAGEM: Check-in seria uma ação, mas não temos enum específico
      // Por enquanto, não incluímos check-in nas ações padrão
      // Pode ser adicionado como ação customizada no futuro
      // Ação de check-in deve ser executada pelo domínio de eventos, não pelo feed
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
    // 1. Intent é ANNOUNCE_EVENT
    // 2. SourceType é 'post' ou 'event'
    return (
      intent === ActorIntent.ANNOUNCE_EVENT &&
      (sourceType === 'post' || sourceType === 'event')
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
   * Transforma evento em DTO para renderização
   * 🔴 BLINDAGEM: Apenas transformação de dados, não lógica
   * 
   * @param event Evento a ser transformado
   * @param postId ID do post relacionado
   * @returns DTO para renderização
   */
  private eventToDTO(event: Event, postId: string): FeedItemDTO {
    // 🔴 BLINDAGEM: Construir DTO estável com dados mínimos do evento
    // DTO é apenas dados, não lógica
    
    // Formatar preço se existir (ticketPrice pode estar em reais ou centavos)
    // Assumindo que ticketPrice está em reais (ajustar se necessário)
    const priceInfo = event.ticketPrice
      ? {
          amountCents: event.ticketPrice,
          currency: 'BRL', // Default, pode ser extraído do evento se disponível
        }
      : null;

    // 🔴 BLINDAGEM: Construir metadados visuais (apenas dados, não lógica)
    const visualMetadata: Record<string, any> = {
      eventId: event.id,
      datetimeStart: event.startTime.toISOString(), // Converter Date para ISO string
      datetimeEnd: event.endTime.toISOString(), // Converter Date para ISO string
      city: event.cityId || null, // ID da cidade, pode ser expandido para nome se necessário
      status: event.status,
      eventType: event.eventType || 'SHOW',
      timezone: event.timezone || 'America/Sao_Paulo',
    };

    if (priceInfo) {
      visualMetadata.price = priceInfo;
    }

    if (event.maxCapacity) {
      visualMetadata.maxCapacity = event.maxCapacity;
    }

    if (event.currentOccupancy !== undefined) {
      visualMetadata.currentOccupancy = event.currentOccupancy;
    }

    // 🔴 BLINDAGEM: Retornar DTO estável
    return {
      id: postId, // ID do post (não do evento) para manter referência ao post original
      type: 'event',
      title: event.title,
      description: event.description || undefined,
      // imageUrl e thumbnailUrl podem ser adicionados se o evento tiver imagens
      metadata: visualMetadata,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt ? (typeof event.updatedAt === 'string' ? new Date(event.updatedAt) : event.updatedAt) : undefined,
      // availableActions será preenchido separadamente via getAvailableActions
    };
  }
}

/**
 * Instância singleton do plugin
 * 🔴 BLINDAGEM: Singleton é apenas para acesso global, não para decisão
 */
export const eventFeedPlugin = new EventFeedPlugin();


