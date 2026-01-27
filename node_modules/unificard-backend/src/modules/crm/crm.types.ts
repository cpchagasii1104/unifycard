// backend/src/modules/crm/crm.types.ts
// SPRINT 88: CRM CANÔNICO

/**
 * Visibilidade da nota
 */
export type CrmNoteVisibility = 'INTERNAL' | 'SHARED';

/**
 * Canal de consentimento
 */
export type CrmConsentChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH';

/**
 * Status do consentimento
 */
export type CrmConsentStatus = 'GRANTED' | 'REVOKED';

/**
 * Tipo de evento na timeline
 */
export type CrmTimelineEventType =
  | 'ORDER_CREATED'
  | 'ORDER_PAID'
  | 'TICKET_PURCHASED'
  | 'CHECKIN'
  | 'PAYMENT_LINK_USED'
  | 'RECEIVABLE_CREATED'
  | 'FISCAL_DRAFT'
  | 'FISCAL_ISSUED'
  | 'NOTE_ADDED'
  | 'TAG_ASSIGNED'
  | 'TAG_REMOVED'
  | 'CONSENT_CHANGED';

/**
 * Nota do CRM
 */
export interface CrmNote {
  id: string;
  tenantId: string;
  contactId: string;
  authorActorId: string;
  authorUserId: string | null;
  note: string;
  visibility: CrmNoteVisibility;
  metadata: Record<string, any>;
  createdAt: Date;
}

/**
 * Tag do CRM
 */
export interface CrmTag {
  id: string;
  tenantId: string;
  name: string;
  color: string | null;
  createdAt: Date;
}

/**
 * Vínculo entre contact e tag
 */
export interface CrmContactTag {
  id: string;
  tenantId: string;
  contactId: string;
  tagId: string;
  createdAt: Date;
}

/**
 * Consentimento de comunicação
 */
export interface CrmConsent {
  id: string;
  tenantId: string;
  contactId: string;
  channel: CrmConsentChannel;
  status: CrmConsentStatus;
  updatedByActorId: string;
  updatedByUserId: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Evento da timeline
 */
export interface CrmTimelineEvent {
  id: string;
  type: CrmTimelineEventType;
  occurredAt: Date;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  sourceEntity: {
    type: string; // 'order', 'ticket_sale', 'payment_link', 'receivable', 'fiscal_document', 'note', 'tag', 'consent'
    id: string;
  } | null;
}

/**
 * Input para criar nota
 */
export interface CreateCrmNoteInput {
  contactId: string;
  note: string;
  visibility?: CrmNoteVisibility;
  metadata?: Record<string, any>;
}

/**
 * Input para criar tag
 */
export interface CreateCrmTagInput {
  name: string;
  color?: string;
}

/**
 * Input para definir consentimento
 */
export interface SetCrmConsentInput {
  contactId: string;
  channel: CrmConsentChannel;
  status: CrmConsentStatus;
  metadata?: Record<string, any>;
}

/**
 * Filtros para timeline
 */
export interface CrmTimelineFilters {
  eventTypes?: CrmTimelineEventType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}





