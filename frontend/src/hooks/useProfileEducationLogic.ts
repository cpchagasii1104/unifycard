import type { EducationEventType } from '../api/education';

// F2 (DECISION-0073): só eventos DECLARATIVOS são oferecidos na UI viva. Os eventos com aparência de
// credencial verificada (`contestada`/`confirmada`/`validada_institucionalmente`) estão RESERVADOS — fora
// do dropdown e rejeitados pelo backend (zod) — até existir substrato de credenciais (emissor/prova/
// autoridade/terceiro). Mantidos na union de tipos (`EducationEventType`) só para o read-model de eventuais
// eventos legados; NUNCA como opção viva.
const CANONICAL_EVENT_TYPES: readonly EducationEventType[] = [
  'educacao.declarada',
  'educacao.iniciada',
  'educacao.concluida',
  'educacao.abandonada',
] as const;

// Sem eventos de terceiro no MVP: autodeclaração não tem validador real. Vazio → isThirdPartyEvent=false
// → UI não pede/explibe `validator`/`evidence`.
const THIRD_PARTY_EVENTS: readonly EducationEventType[] = [] as const;

export function useProfileEducationLogic() {
  const isValidEventType = (eventType: string): eventType is EducationEventType => {
    return CANONICAL_EVENT_TYPES.includes(eventType as EducationEventType);
  };

  const isThirdPartyEvent = (eventType: EducationEventType): boolean => {
    return THIRD_PARTY_EVENTS.includes(eventType);
  };

  const validateForm = (
    formEventType: EducationEventType,
    formAuthorName: string,
    formAuthorRelation: string,
    formContext: string
  ): string | null => {
    if (!isValidEventType(formEventType)) {
      return 'Tipo de evento inválido. Apenas eventos canônicos são permitidos.';
    }

    if (isThirdPartyEvent(formEventType)) {
      if (!formAuthorName.trim()) {
        return 'Eventos de terceiros exigem identificação do autor.';
      }
      if (!formAuthorRelation.trim()) {
        return 'Eventos de terceiros exigem relação com o Actor.';
      }
      if (!formContext.trim()) {
        return 'Eventos de terceiros exigem contexto textual mínimo.';
      }
    }

    return null;
  };

  const getEventTypeLabel = (eventType: EducationEventType): string => {
    const labels: Record<EducationEventType, string> = {
      'educacao.declarada': 'Declarada',
      'educacao.iniciada': 'Iniciada',
      'educacao.concluida': 'Concluída',
      'educacao.abandonada': 'Abandonada',
      'educacao.contestada': 'Contestada',
      'educacao.confirmada': 'Confirmada',
      'educacao.validada_institucionalmente': 'Validada Institucionalmente',
    };
    return labels[eventType] || eventType;
  };

  const getEventTypeColor = (eventType: EducationEventType): string => {
    const colors: Record<EducationEventType, string> = {
      'educacao.declarada': '#6b7280',
      'educacao.iniciada': '#3b82f6',
      'educacao.concluida': '#10b981',
      'educacao.abandonada': '#ef4444',
      'educacao.contestada': '#f59e0b',
      'educacao.confirmada': '#8b5cf6',
      'educacao.validada_institucionalmente': '#06b6d4',
    };
    return colors[eventType] || '#6b7280';
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  };

  return {
    isValidEventType,
    isThirdPartyEvent,
    validateForm,
    getEventTypeLabel,
    getEventTypeColor,
    formatDate,
    CANONICAL_EVENT_TYPES,
  };
}

