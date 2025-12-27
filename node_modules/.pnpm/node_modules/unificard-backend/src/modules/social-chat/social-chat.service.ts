// src/modules/social-chat/social-chat.service.ts
import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import { SocialChatRepository } from './social-chat.repository';
import { SocialChatModel } from './social-chat.model';
import { categoriesService } from '@core/categories/categories.service';
import { orchestratorService } from '@core/orchestrator/orchestrator.service';
import { socialActionsService } from '../social-actions/social-actions.service';
import type {
  ChatMessage,
  SendMessageInput,
  Conversation,
} from './social-chat.types';

class SocialChatService {
  private repository = new SocialChatRepository();

  /**
   * Transcreve áudio (placeholder para futuro)
   */
  private async transcribeAudio(audioUrl: string): Promise<string> {
    // TODO: Implementar transcrição de áudio real
    // Por enquanto, retorna placeholder
    return `[Áudio transcrito de ${audioUrl}]`;
  }

  /**
   * Envia uma mensagem e processa automaticamente
   */
  async sendMessage(
    fastify: FastifyInstance,
    tenantId: string,
    globalUserId: string,
    input: SendMessageInput
  ): Promise<ChatMessage> {
    // 1. Gerar ou usar conversationId
    const conversationId = input.conversationId || uuidv4();

    // 2. Processar conteúdo (texto ou áudio)
    let content = input.text || '';
    let rawContent: string | null = null;

    if (input.audioUrl && !input.text) {
      // Transcrever áudio (placeholder)
      rawContent = input.audioUrl;
      content = await this.transcribeAudio(input.audioUrl);
    }

    if (!content) {
      throw new Error('Conteúdo da mensagem é obrigatório');
    }

    // 3. Classificar texto em categorias
    const categoryClassifications = await categoriesService.classifyTextIntoCategories({
      text: content,
      maxCategories: 5,
    });
    const detectedCategories = categoryClassifications.map((c) => c.categoryId);

    // 4. Analisar texto com orchestrator para detectar intent
    let detectedIntent: string | null = null;
    let confidence: number | null = null;
    let suggestedActions: any[] = [];

    try {
      const analysis = await orchestratorService.analyzeText(
        fastify,
        {
          text: content,
          audioUrl: input.audioUrl,
          context: {
            userId: globalUserId,
          },
        },
        globalUserId,
        tenantId
      );

      // Pegar intent principal se confiança >= 0.7
      const primaryIntent = analysis.intents[0];
      if (primaryIntent && primaryIntent.confidence >= 0.7) {
        detectedIntent = primaryIntent.intent;
        confidence = primaryIntent.confidence;
        suggestedActions = analysis.suggestedActions || [];
      }
    } catch (error) {
      // Silenciosamente ignora erros de análise (não quebra criação da mensagem)
      console.warn('Erro ao analisar intent da mensagem:', error);
    }

    // 5. Criar mensagem no banco
    const row = await this.repository.create({
      conversationId,
      tenantId,
      globalUserId,
      content,
      rawContent,
      media: input.media || [],
      intent: detectedIntent,
      confidence,
      categories: detectedCategories,
      suggestedActions,
      metadata: input.metadata || {},
    });

    const message = SocialChatModel.fromRow(row);

    // 6. Criar ação automaticamente se intent foi detectada
    if (detectedIntent && confidence && confidence >= 0.7) {
      try {
        // Buscar análise novamente para pegar parâmetros
        const analysis = await orchestratorService.analyzeText(
          fastify,
          {
            text: content,
            context: {
              userId: globalUserId,
            },
          },
          globalUserId,
          tenantId
        );

        const primaryIntent = analysis.intents[0];
        const parameters = primaryIntent?.parameters || {};

        // Criar ação vinculada à mensagem (usando messageId como postId temporariamente)
        // Em produção, pode criar uma tabela de relacionamento ou usar um campo específico
        await socialActionsService.createAction(tenantId, globalUserId, {
          postId: message.messageId, // Usando messageId como referência
          intent: detectedIntent,
          confidence,
          parameters,
        });
      } catch (error) {
        // Silenciosamente ignora erros ao criar ação
        console.warn('Erro ao criar ação automática da mensagem:', error);
      }
    }

    return message;
  }

  /**
   * Busca mensagem por ID
   */
  async getMessage(tenantId: string, messageId: string): Promise<ChatMessage | null> {
    const row = await this.repository.findById(tenantId, messageId);
    return row ? SocialChatModel.fromRow(row) : null;
  }

  /**
   * Busca conversa completa com mensagens e ações
   */
  async getConversation(
    tenantId: string,
    conversationId: string
  ): Promise<Conversation> {
    // Buscar mensagens
    const { rows, total } = await this.repository.findByConversation(tenantId, conversationId);
    const messages = SocialChatModel.fromRows(rows);

    // Buscar ações vinculadas às mensagens desta conversa
    const actions: Conversation['actions'] = [];
    for (const message of messages) {
      if (message.intent) {
        try {
          // Buscar ações criadas a partir desta mensagem
          // Nota: usando messageId como postId na criação, então buscamos por postId = messageId
          const messageActions = await socialActionsService.getActionsByPost(
            tenantId,
            message.messageId
          );
          actions.push(
            ...messageActions.map((action) => ({
              actionId: action.actionId,
              intent: action.intent,
              status: action.status,
              createdAt: action.createdAt,
            }))
          );
        } catch (error) {
          // Silenciosamente ignora erros
        }
      }
    }

    return {
      conversationId,
      messages,
      total,
      actions,
    };
  }
}

export const socialChatService = new SocialChatService();








