// frontend/src/utils/temporal-state.ts
// SPRINT 19: Temporalidade Institucional
// Torna o tempo explícito sem criar urgência, cobrança ou pressão
//
// ═══════════════════════════════════════════════════════════════
// CONCEITO CANÔNICO (SPRINT 29)
// ═══════════════════════════════════════════════════════════════
// CONCEITO: Temporalidade / Tempo / Ausência
// NÃO DUPLICAR ESTE CONCEITO
// 
// Este arquivo é o ponto canônico para:
// - Estados temporais (recently_started, no_recent_activity, continuous, ended)
// - Formatação de tempo relativo/absoluto
// - Diferenciação entre ausência e encerramento (getAbsenceText)
// 
// Arquivos relacionados que USAM este conceito:
// - institutional-pulse.ts (usa conceito de tempo)
// - closure-continuity.ts (usa conceito de ausência)
// 
// Para qualquer necessidade de tempo/temporalidade/ausência, use este arquivo.
// 
// ═══════════════════════════════════════════════════════════════
// EVOLUÇÃO CONCEITUAL (SPRINT 31)
// ═══════════════════════════════════════════════════════════════
// Este conceito pode evoluir ao longo do tempo.
// Mudanças de significado devem ser registradas em:
// INSTITUTIONAL_CONCEPT_EVOLUTIONS.md
// ═══════════════════════════════════════════════════════════════
//
// ═══════════════════════════════════════════════════════════════
// CLASSIFICAÇÃO DE RESPONSABILIDADE (SPRINT 28)
// ═══════════════════════════════════════════════════════════════
// CAMADA: UI (Interface de Usuário)
// PÚBLICO PERMITIDO: Usuários finais, admin, piloto
// 
// ✅ PODE SER USADO em:
//    - Componentes de ação
//    - Handlers de execução
//    - Fluxos de usuário final
//    - Qualquer componente de UI
// 
// ✅ ESTRUTURA OPERACIONAL - Não é apenas leitura
// ═══════════════════════════════════════════════════════════════

/**
 * ESTADOS TEMPORAIS
 */
export type TemporalState = 
  | 'recently_started'    // Iniciado recentemente
  | 'no_recent_activity'   // Sem atividade recente
  | 'continuous'           // Contínuo
  | 'ended';               // Encerrado

/**
 * Configuração de limites temporais (em dias)
 */
const TEMPORAL_THRESHOLDS = {
  recent: 7,        // Considerado "recente" se < 7 dias
  inactive: 30,     // Considerado "sem atividade" se > 30 dias
} as const;

/**
 * Calcula estado temporal baseado em timestamps
 */
export function calculateTemporalState(
  createdAt: Date | string,
  updatedAt?: Date | string,
  endedAt?: Date | string
): TemporalState {
  const now = new Date();
  const created = new Date(createdAt);
  const updated = updatedAt ? new Date(updatedAt) : created;
  const ended = endedAt ? new Date(endedAt) : null;

  // Se foi encerrado, retornar estado "ended"
  if (ended) {
    return 'ended';
  }

  // Calcular diferenças em dias
  const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceUpdated = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));

  // Iniciado recentemente (< 7 dias desde criação)
  if (daysSinceCreated < TEMPORAL_THRESHOLDS.recent) {
    return 'recently_started';
  }

  // Sem atividade recente (> 30 dias desde última atualização)
  if (daysSinceUpdated > TEMPORAL_THRESHOLDS.inactive) {
    return 'no_recent_activity';
  }

  // Contínuo (entre 7 e 30 dias, ou atualizado recentemente)
  return 'continuous';
}

/**
 * Formata tempo relativo + absoluto
 */
export function formatTemporalLabel(
  date: Date | string,
  options?: {
    includeAbsolute?: boolean;
    showDays?: boolean;
  }
): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let relativeText = '';

  if (diffDays > 0) {
    relativeText = options?.showDays 
      ? `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`
      : diffDays === 1 
        ? 'há 1 dia'
        : `há ${diffDays} dias`;
  } else if (diffHours > 0) {
    relativeText = diffHours === 1 ? 'há 1 hora' : `há ${diffHours} horas`;
  } else if (diffMinutes > 0) {
    relativeText = diffMinutes === 1 ? 'há 1 minuto' : `há ${diffMinutes} minutos`;
  } else {
    relativeText = 'agora';
  }

  if (options?.includeAbsolute) {
    const absoluteText = d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${relativeText} (${absoluteText})`;
  }

  return relativeText;
}

/**
 * Textos descritivos para estados temporais
 */
export function getTemporalStateText(
  state: TemporalState,
  entityType: 'workflow' | 'pending' | 'dispute' | 'delegation' | 'company' | 'group',
  createdAt?: Date | string,
  updatedAt?: Date | string,
  endedAt?: Date | string
): string {
  switch (state) {
    case 'recently_started':
      return createdAt 
        ? `Iniciado ${formatTemporalLabel(createdAt)}`
        : 'Iniciado recentemente';
    
    case 'no_recent_activity':
      return updatedAt
        ? `Sem movimentação desde ${formatTemporalLabel(updatedAt)}`
        : 'Sem movimentação recente';
    
    case 'continuous':
      return updatedAt
        ? `Em atividade desde ${formatTemporalLabel(updatedAt)}`
        : 'Em atividade contínua';
    
    case 'ended':
      return endedAt
        ? `Encerrado em ${new Date(endedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}`
        : 'Encerrado anteriormente';
    
    default:
      return '';
  }
}

/**
 * Textos para ausência vs encerramento
 */
export function getAbsenceText(
  type: 'not_happened' | 'no_recent_activity' | 'ended',
  endedAt?: Date | string
): string {
  switch (type) {
    case 'not_happened':
      return 'Nenhuma atividade registrada até agora.';
    
    case 'no_recent_activity':
      return 'Sem movimentação recente.';
    
    case 'ended':
      return endedAt
        ? `Encerrado em ${new Date(endedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}.`
        : 'Encerrado anteriormente.';
    
    default:
      return '';
  }
}

/**
 * Substitui termos implícitos por tempo explícito
 */
export function replaceImplicitTime(
  implicitTerm: 'pending' | 'active' | 'inactive',
  date: Date | string,
  options?: {
    includeAbsolute?: boolean;
  }
): string {
  const formatted = formatTemporalLabel(date, options);

  switch (implicitTerm) {
    case 'pending':
      return `desde ${formatted}`;
    
    case 'active':
      return `em atividade desde ${formatted}`;
    
    case 'inactive':
      return `sem atividade desde ${formatted}`;
    
    default:
      return formatted;
  }
}

