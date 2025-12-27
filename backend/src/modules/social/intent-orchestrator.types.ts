// src/modules/social/intent-orchestrator.types.ts
// Tipos para o IntentOrchestratorService - focado em conversação e automação

/**
 * Tipos de intenção específicos para rede social
 */
export type SocialIntentType =
  | 'event'
  | 'service_offer'
  | 'product_offer'
  | 'booking'
  | 'personal_post'
  | 'friends_post'
  | 'project'
  | 'vote'
  | 'invitation';

/**
 * Contexto do ator (quem está falando)
 */
export interface ActorContext {
  actorId: string;
  actorType: 'user' | 'page' | 'group' | 'channel';
  actorName?: string;
  isCompany?: boolean;
  companyId?: string;
}

/**
 * Input para análise de intenção
 */
export interface AnalyzeIntentInput {
  text: string;
  actorContext: ActorContext;
  conversationHistory?: ConversationMessage[];
  previousAnalysisId?: string;
}

/**
 * Mensagem de conversa
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

/**
 * Campo faltante identificado
 */
export interface MissingField {
  field: string;
  fieldLabel: string;
  fieldType: 'text' | 'date' | 'time' | 'number' | 'boolean' | 'select' | 'multiselect';
  question: string;
  options?: string[]; // Para select/multiselect
  required: boolean;
  reasoning: string;
}

/**
 * Ação sugerida que pode ser executada automaticamente
 */
export interface SuggestedAction {
  action: string;
  actionLabel: string;
  canExecute: boolean;
  requiresConfirmation: boolean;
  payload: Record<string, any>;
  description: string;
  reasoning: string;
}

/**
 * Análise completa de intenção
 */
export interface IntentAnalysis {
  intentType: SocialIntentType;
  confidence: number; // 0-1
  extractedData: ExtractedData;
  missingFields: MissingField[];
  suggestedActions: SuggestedAction[];
  questions: string[]; // Perguntas para o usuário
  reasoning: string;
  canProceed: boolean; // Se tem dados suficientes para criar
}

/**
 * Dados extraídos do texto
 */
export interface ExtractedData {
  // Evento
  eventSubtype?: 'SHOW' | 'CINEMA' | 'ESPORTE' | 'BAR' | 'RESTAURANTE' | 'FEIRA' | 'WORKSHOP' | 'EXPOSICAO' | 'FESTIVAL' | 'BALADA';
  dateTime?: string; // ISO string
  location?: string;
  description?: string;
  
  // Ocupação
  occupancyType?: 'TABLE' | 'PERSON' | 'SLOT' | 'HYBRID';
  capacity?: number;
  tableCount?: number;
  seatsPerTable?: number;
  isPaid?: boolean;
  price?: number;
  pricePerPerson?: number;
  pricePerTable?: number;
  
  // Público
  audience?: 'public' | 'friends' | 'company' | 'group';
  targetGroupId?: string;
  targetActorId?: string;
  
  // CTA
  ctaType?: 'booking' | 'service' | 'payment';
  ctaPrice?: number;
  
  // Serviço/Produto
  serviceType?: string;
  productName?: string;
  servicePrice?: number;
  
  // Outros
  tags?: string[];
  metadata?: Record<string, any>;
}

/**
 * Resposta da análise
 */
export interface AnalyzeIntentResponse {
  analysisId: string;
  analysis: IntentAnalysis;
  conversationState: 'collecting_info' | 'ready_to_create' | 'needs_clarification';
  nextMessage?: string; // Mensagem para mostrar ao usuário
}

/**
 * Input para continuar conversa
 */
export interface ContinueConversationInput {
  analysisId: string;
  userResponse: string;
  actorContext: ActorContext;
}

/**
 * Resposta da continuação
 */
export interface ContinueConversationResponse {
  analysisId: string;
  updatedAnalysis: IntentAnalysis;
  conversationState: 'collecting_info' | 'ready_to_create' | 'needs_clarification';
  nextMessage: string;
  questions: string[];
}

/**
 * Input para executar ação
 */
export interface ExecuteActionInput {
  analysisId: string;
  actionId: string;
  actorContext: ActorContext;
  confirmations?: Record<string, any>; // Respostas do usuário para campos faltantes
}

/**
 * Resultado da execução
 */
export interface ExecuteActionResult {
  success: boolean;
  actionId: string;
  result?: {
    postId?: string;
    eventId?: string;
    reservationId?: string;
    [key: string]: any;
  };
  error?: string;
  nextSteps?: string[];
}













