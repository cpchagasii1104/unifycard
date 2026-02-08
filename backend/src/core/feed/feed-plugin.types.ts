// src/core/feed/feed-plugin.types.ts
// Tipos do FEED PLUGIN SYSTEM
// 🔴 BLINDAGEM: Feed = orquestrador visual, Domínios = motores
// 🔴 BLINDAGEM: Feed NÃO pode decidir comportamento
// 🔴 BLINDAGEM: Feed NÃO pode executar ações de domínio
// 🔴 BLINDAGEM: Feed apenas renderiza e orquestra visualmente

import { ActorIntent } from '@core/social/ports';

/**
 * Ação possível no feed
 * 🔴 BLINDAGEM: Ação é apenas declaração, não execução
 * 🔴 BLINDAGEM: Feed NÃO executa ações de domínio
 */
export enum FeedAction {
  VIEW = 'view',       // Visualizar detalhes
  BOOK = 'book',       // Agendar/Reservar
  JOIN = 'join',       // Participar/Juntar-se
  SHARE = 'share',     // Compartilhar
  CONTACT = 'contact', // Contatar
  BUY = 'buy',         // Comprar
  VOTE = 'vote',       // Votar
  FOLLOW = 'follow',   // Seguir
}

/**
 * DTO (Data Transfer Object) para renderização no feed
 * 🔴 BLINDAGEM: DTO é apenas dados, não lógica
 * 🔴 BLINDAGEM: Feed usa DTO para renderizar, não para decidir
 */
export interface FeedItemDTO {
  // Identificação
  id: string; // ID do item (post_id, event_id, service_id, etc)
  type: string; // Tipo do item (post, event, service, project, etc)
  
  // Conteúdo visual
  title?: string; // Título do item
  description?: string; // Descrição do item
  imageUrl?: string; // URL da imagem principal
  thumbnailUrl?: string; // URL da thumbnail
  
  // Metadados visuais
  metadata?: Record<string, any>; // Metadados adicionais para renderização
  
  // Ações disponíveis
  availableActions?: FeedAction[]; // Ações que podem ser executadas (declaração, não execução)
  
  // Timestamps
  createdAt: string; // Data de criação
  updatedAt?: Date; // Data de atualização
}

/**
 * Interface do Plugin do Feed
 * 🔴 BLINDAGEM: Plugin declara capacidades, não executa ações
 * 🔴 BLINDAGEM: Feed usa plugin para renderizar, não para decidir
 */
export interface SocialFeedPlugin {
  /**
   * Nome do plugin (identificador único)
   * Ex: 'events', 'services', 'groups', 'projects'
   */
  name: string;
  
  /**
   * Intents suportados pelo plugin
   * 🔴 BLINDAGEM: Plugin declara quais intents suporta, não decide comportamento
   */
  supportedIntents: ActorIntent[];
  
  /**
   * Renderiza dados do item para o feed
   * 🔴 BLINDAGEM: Apenas transforma dados em DTO, não executa ações
   * 
   * @param sourceId ID da entidade fonte (post_id, event_id, service_id, etc)
   * @param sourceType Tipo da entidade fonte (post, event, service, etc)
   * @param intent Intent que originou o item
   * @param metadata Metadados adicionais do item
   * @returns DTO para renderização no feed
   */
  renderFeedItem(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent,
    metadata?: Record<string, any>
  ): Promise<FeedItemDTO | null>;
  
  /**
   * Declara ações possíveis para o item
   * 🔴 BLINDAGEM: Apenas declara ações, não executa
   * 
   * @param sourceId ID da entidade fonte
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o item
   * @returns Lista de ações disponíveis (declaração, não execução)
   */
  getAvailableActions(
    sourceId: string,
    sourceType: string,
    intent: ActorIntent
  ): Promise<FeedAction[]>;
  
  /**
   * Valida se o plugin pode processar um item
   * 🔴 BLINDAGEM: Apenas valida capacidade, não decide comportamento
   * 
   * @param sourceType Tipo da entidade fonte
   * @param intent Intent que originou o item
   * @returns true se o plugin pode processar, false caso contrário
   */
  canHandle(sourceType: string, intent: ActorIntent): boolean;
}

/**
 * Resultado de resolução de plugin
 * 🔴 BLINDAGEM: Resultado é apenas informação, não decisão
 */
export interface PluginResolutionResult {
  plugin: SocialFeedPlugin | null;
  resolved: boolean;
  reason?: string; // Motivo da resolução (ou falta dela)
}

/**
 * Opções para resolução de plugin
 */
export interface PluginResolutionOptions {
  sourceType: string; // Tipo da entidade fonte
  intent: ActorIntent; // Intent que originou o item
  sourceId?: string; // ID da entidade fonte (opcional)
  metadata?: Record<string, any>; // Metadados adicionais (opcional)
}


