// src/modules/social/social.types.ts

export type PostType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'EVENT_ANNOUNCEMENT'
  | 'EVENT_UPDATE'
  | 'EVENT_REMINDER';

export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'FRIENDS' | 'GROUP';

export interface Post {
  postId: string;
  tenantId: string;
  globalUserId: string;
  content: string;
  type?: PostType; // Tipo de post
  visibility?: PostVisibility; // Visibilidade do post
  media: MediaItem[];
  intent?: string | null;
  confidence?: number | null;
  categories: string[];
  suggestedActions: SuggestedAction[];
  metadata: Record<string, any>;
  jobId?: string; // Job vinculado ao post (se criado via social-work)
  eventId?: string | null; // Evento vinculado ao post (1 evento pode ter N posts)
  // Campos para posts de serviços (extraídos do metadata)
  serviceInfo?: ServiceInfo; // Informações do serviço
  isServicePost?: boolean; // Flag para indicar que é um post de serviço
  createdAt: string;
  updatedAt: string;
}

export interface PostRow {
  post_id: string;
  tenant_id: string;
  global_user_id: string;
  content: string;
  type: string | null;
  visibility: string | null;
  media: any; // JSONB
  intent: string | null;
  confidence: number | null;
  categories: string[];
  suggested_actions: any; // JSONB
  metadata: any; // JSONB
  event_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface MediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  thumbnailUrl?: string;
  duration?: number; // Para vídeo/áudio em segundos
  metadata?: Record<string, any>;
}

export interface SuggestedAction {
  action: string;
  module: string;
  endpoint?: string;
  payload?: Record<string, any>;
  description: string;
}

export interface ServiceInfo {
  categoryId?: string; // ID da categoria profissional (ex: mecânica, odontologia)
  categoryName?: string; // Nome da categoria (para exibição)
  price?: number; // Preço do serviço
  pricingType?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote'; // Tipo de cobrança
  currency?: string; // Moeda (ex: 'BRL', 'USD')
  description?: string; // Descrição detalhada do serviço
  duration?: number; // Duração estimada em minutos
  requiresSchedule?: boolean; // Se requer agendamento
  requiresPayment?: boolean; // Se requer pagamento antecipado
}

export interface CreatePostInput {
  content: string;
  media?: MediaItem[];
  metadata?: Record<string, any>;
  categories?: string[]; // IDs de categorias (opcional, AI completa se não fornecido)
  intent?: string; // Intent manual (opcional, AI detecta se não fornecido)
  // Campos para posts de serviços
  serviceInfo?: ServiceInfo; // Informações do serviço (se for post de serviço)
  isServicePost?: boolean; // Flag para indicar que é um post de serviço
}

export interface PostAnalysis {
  intent?: string;
  confidence?: number;
  categories: string[];
  suggestedActions: SuggestedAction[];
}

export interface FeedOptions {
  limit?: number;
  offset?: number;
  categoryId?: string;
  intent?: string;
  userId?: string;
  groupId?: string; // Novo: filtrar por grupo
  startDate?: Date;
  endDate?: Date;
}

export interface FeedResult {
  posts: Post[];
  totalCents: number;
  hasMore: boolean;
}




