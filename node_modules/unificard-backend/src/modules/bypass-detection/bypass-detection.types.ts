// backend/src/modules/bypass-detection/bypass-detection.types.ts
// Camada de Anti-Bypass & Off-Platform Detection
// 🔴 BLINDAGEM: Nenhuma detecção sem evidência
// 🔴 BLINDAGEM: Regras determinísticas, não heurísticas

/**
 * Tipo de sinal de bypass detectado
 */
export type BypassSignalType =
  | 'value_mismatch' // Valor divergente do agreement
  | 'missing_agreement' // Tentativa sem agreement FINALIZED
  | 'off_platform_contact' // Contato direto compartilhado
  | 'off_platform_keyword' // Palavra-chave de fechamento externo
  | 'agreement_abandoned' // Acordo PROPOSED seguido de abandono
  | 'intensive_chat_no_closure'; // Conversa intensa sem fechamento

/**
 * Severidade do sinal
 */
export type BypassSignalSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Bypass Detection Event
 * 
 * REGRAS:
 * - Append-only: eventos são adicionados, nunca removidos
 * - Imutável após criação
 * - Sempre vinculado a EvidencePack
 */
export interface BypassDetectionEvent {
  eventId: string;
  tenantId: string;
  actorId: string;
  signalType: BypassSignalType;
  severity: BypassSignalSeverity;
  contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement' | 'thread';
  contextId: string;
  evidencePackId: string; // Obrigatório
  detectedValue?: any; // Valor detectado (ex: valor divergente, mensagem, etc.)
  expectedValue?: any; // Valor esperado (ex: valor do agreement)
  messageContent?: string; // Conteúdo da mensagem (se aplicável)
  metadata: Record<string, any> | null;
  createdAt: Date;
}

/**
 * Input para registrar detecção de bypass
 */
export interface RegisterBypassDetectionInput {
  actorId: string;
  signalType: BypassSignalType;
  severity: BypassSignalSeverity;
  contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement' | 'thread';
  contextId: string;
  evidencePackId: string;
  detectedValue?: any;
  expectedValue?: any;
  messageContent?: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado da análise de mensagem
 */
export interface MessageAnalysisResult {
  hasOffPlatformContact: boolean;
  hasOffPlatformKeywords: boolean;
  detectedContacts: string[];
  detectedKeywords: string[];
  severity: BypassSignalSeverity;
}

/**
 * Resultado da análise de valor
 */
export interface ValueAnalysisResult {
  hasMismatch: boolean;
  detectedValue: number;
  expectedValue: number;
  difference: number;
  percentageDifference: number;
  severity: BypassSignalSeverity;
}

/**
 * Padrões de contato off-platform (determinísticos)
 */
export const OFF_PLATFORM_CONTACT_PATTERNS = [
  /(\+55\s?)?(\d{2}\s?)?\d{4,5}[-.\s]?\d{4}/g, // Telefone BR
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // Telefone internacional
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /@[\w.]+/g, // Instagram/Twitter handle
  /(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/[\w.]+/gi, // Instagram URL
  /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/[\w.]+/gi, // Facebook URL
  /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com)\/[\w+]+/gi, // WhatsApp
  /whatsapp|zap|zapzap|wpp/gi, // Menções de WhatsApp
] as const;

/**
 * Palavras-chave de fechamento off-platform (determinísticas)
 */
export const OFF_PLATFORM_KEYWORDS = [
  'fechar fora',
  'fechar direto',
  'negociar fora',
  'negociar direto',
  'contratar fora',
  'contratar direto',
  'pagar fora',
  'pagar direto',
  'transferir direto',
  'pix direto',
  'sem plataforma',
  'fora da plataforma',
  'evitar taxa',
  'evitar comissão',
  'sem taxa',
  'sem comissão',
  'chama no whats',
  'me chama no',
  'me liga',
  'me telefona',
  'me passa o contato',
  'passa o contato',
  'me passa o número',
  'passa o número',
  'me passa o email',
  'passa o email',
  'me passa o instagram',
  'passa o instagram',
] as const;

/**
 * Limites para análise de severidade
 */
export const BYPASS_SEVERITY_THRESHOLDS = {
  VALUE_MISMATCH: {
    LOW: 0.05, // 5% de diferença
    MEDIUM: 0.15, // 15% de diferença
    HIGH: 0.30, // 30% de diferença
  },
  REPEATED_ATTEMPTS: {
    FIRST: 1,
    SECOND: 2,
    BLOCKED: 3,
  },
} as const;




