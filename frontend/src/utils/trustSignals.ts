// src/utils/trustSignals.ts
// Sinais de confiança dinâmicos baseados em ações reais

import { safeDate, safeNumber } from './guardrails';

export interface TrustSignal {
  type: 'badge' | 'text' | 'stat';
  label: string;
  icon?: string;
  priority: number; // 1 = mais importante, 5 = menos importante
}

export interface ActorTrustData {
  actor_id: string;
  actor_type: 'user' | 'page';
  posts_count: number;
  services_count?: number;
  events_count?: number;
  products_count?: number;
  followers_count?: number;
  company_status?: string | null;
  created_at?: string;
  last_activity?: string; // Timestamp da última atividade
  total_impact_cents?: number; // Impacto total gerado
  total_revenue_cents?: number; // Receita total
}

/**
 * Gera sinais de confiança para um ator baseado em dados reais
 */
export function getTrustSignals(actorData: ActorTrustData): TrustSignal[] {
  const signals: TrustSignal[] = [];
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

  // 1. STATUS ESPECIAL (prioridade alta)
  
  // Empresa verificada
  if (actorData.actor_type === 'page' && actorData.company_status === 'VERIFIED') {
    signals.push({
      type: 'badge',
      label: 'Verificada',
      icon: '✓',
      priority: 1,
    });
  }

  // Empresa em validação
  if (actorData.actor_type === 'page' && actorData.company_status === 'PROVISIONAL') {
    signals.push({
      type: 'badge',
      label: 'Em validação',
      icon: '⏳',
      priority: 2,
    });
  }

  // Novo usuário (menos de 30 dias)
  if (actorData.created_at) {
    const createdDate = new Date(actorData.created_at).getTime();
    const daysSinceCreation = (now - createdDate) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 30) {
      signals.push({
        type: 'badge',
        label: 'Novo na comunidade',
        icon: '🌱',
        priority: 3,
      });
    }
  }

  // 2. ATIVIDADE RECENTE (prioridade alta)
  
  if (actorData.last_activity) {
    const lastActivityDate = new Date(actorData.last_activity).getTime();
    if (lastActivityDate > sevenDaysAgo) {
      signals.push({
        type: 'badge',
        label: 'Ativo recentemente',
        icon: '💚',
        priority: 2,
      });
    }
  } else if (actorData.posts_count > 0) {
    // Se não temos last_activity, mas há posts, assumir atividade recente se posts_count > 0
    signals.push({
      type: 'badge',
      label: 'Ativo na comunidade',
      icon: '💚',
      priority: 3,
    });
  }

  // 3. HISTÓRICO DE SERVIÇOS (prioridade média-alta)
  
  if (actorData.services_count !== undefined && actorData.services_count > 0) {
    if (actorData.services_count === 1) {
      signals.push({
        type: 'badge',
        label: '🌱 Primeira oferta',
        icon: '🌱',
        priority: 3,
      });
    } else {
      signals.push({
        type: 'stat',
        label: `${actorData.services_count} serviços realizados`,
        priority: 2,
      });
    }
  }

  // 4. HISTÓRICO DE PRODUTOS (prioridade média-alta)
  
  if (actorData.products_count !== undefined && actorData.products_count > 0) {
    if (actorData.products_count === 1) {
      signals.push({
        type: 'badge',
        label: '🌱 Primeira oferta',
        icon: '🌱',
        priority: 3,
      });
    } else {
      signals.push({
        type: 'stat',
        label: `${actorData.products_count} produtos vendidos`,
        priority: 2,
      });
    }
  }

  // 5. HISTÓRICO DE EVENTOS (prioridade média)
  
  if (actorData.events_count !== undefined && actorData.events_count > 0) {
    signals.push({
      type: 'stat',
      label: `${actorData.events_count} eventos criados`,
      priority: 3,
    });
  }

  // 6. IMPACTO GERADO (prioridade alta)
  
  if (actorData.total_impact_cents && actorData.total_impact_cents > 0) {
    const impactReais = actorData.total_impact_cents / 100;
    if (impactReais >= 1000) {
      signals.push({
        type: 'stat',
        label: `Impacto gerado: R$ ${(impactReais / 1000).toFixed(1)}k`,
        priority: 1,
      });
    } else {
      signals.push({
        type: 'stat',
        label: `Impacto gerado: R$ ${impactReais.toFixed(0)}`,
        priority: 2,
      });
    }
  }

  // 7. RECEITA TOTAL (prioridade média, apenas para empresas)
  
  if (actorData.actor_type === 'page' && actorData.total_revenue_cents && actorData.total_revenue_cents > 0) {
    const revenueReais = actorData.total_revenue_cents / 100;
    if (revenueReais >= 1000) {
      signals.push({
        type: 'stat',
        label: `Receita: R$ ${(revenueReais / 1000).toFixed(1)}k`,
        priority: 3,
      });
    }
  }

  // 8. SEGUIDORES (prioridade baixa, apenas se significativo)
  
  if (actorData.followers_count && actorData.followers_count >= 10) {
    signals.push({
      type: 'stat',
      label: `${actorData.followers_count} seguidores`,
      priority: 4,
    });
  }

  // Ordenar por prioridade (menor = mais importante)
  signals.sort((a, b) => a.priority - b.priority);

  // Limitar a 3-4 sinais mais importantes para não poluir
  return signals.slice(0, 4);
}

/**
 * Gera sinais de confiança para um post específico (serviço/produto/evento)
 */
export function getPostTrustSignals(post: {
  intent?: string;
  actor?: { actor_id: string; actor_type: string } | null;
  created_at: string;
  cta?: { price: number | null } | null;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];
  const now = Date.now();
  const postDate = new Date(post.created_at).getTime();
  const daysSincePost = (now - postDate) / (1000 * 60 * 60 * 24);

  // Primeira oferta (se for service_offer ou product_offer)
  if (post.intent === 'service_offer' || post.intent === 'product_offer') {
    if (daysSincePost < 7) {
      signals.push({
        type: 'badge',
        label: '🌱 Primeira oferta',
        icon: '🌱',
        priority: 2,
      });
    }
  }

  // Oferta recente
  if (daysSincePost < 3) {
    signals.push({
      type: 'badge',
      label: 'Novo',
      icon: '✨',
      priority: 3,
    });
  }

  // Oferta com preço (indica seriedade)
  if (post.cta?.price && post.cta.price > 0) {
    signals.push({
      type: 'badge',
      label: 'Preço definido',
      icon: '💰',
      priority: 3,
    });
  }

  return signals;
}

/**
 * Gera sinais de confiança para um evento específico
 */
export function getEventTrustSignals(eventData: {
  participantsCount?: number;
  hasImpact?: boolean;
  totalConversions?: number;
  created_at?: string;
  updated_at?: string;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];
  const now = Date.now();
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

  // 1. Evento já gerou impacto (prioridade alta)
  if (eventData.hasImpact) {
    signals.push({
      type: 'badge',
      label: 'Já gerou impacto',
      icon: '💚',
      priority: 1,
    });
  }

  // 2. Evento com participantes (prioridade média-alta)
  const participantsCount = safeNumber(eventData.participantsCount, 0);
  if (participantsCount > 0) {
    if (participantsCount === 1) {
      signals.push({
        type: 'badge',
        label: '1 pessoa confirmou',
        icon: '✅',
        priority: 2,
      });
    } else {
      signals.push({
        type: 'stat',
        label: `${participantsCount} pessoas confirmaram`,
        priority: 2,
      });
    }
  }

  // 3. Evento ativo recentemente (prioridade média)
  if (eventData.updated_at) {
    const updatedDate = safeDate(eventData.updated_at, 0);
    if (updatedDate > sevenDaysAgo && updatedDate > 0) {
      signals.push({
        type: 'badge',
        label: 'Ativo recentemente',
        icon: '💚',
        priority: 3,
      });
    }
  } else if (eventData.created_at) {
    const createdDate = safeDate(eventData.created_at, 0);
    if (createdDate > sevenDaysAgo && createdDate > 0) {
      signals.push({
        type: 'badge',
        label: 'Evento recente',
        icon: '✨',
        priority: 3,
      });
    }
  }

  // 4. Evento com conversões (prioridade alta)
  const totalConversions = safeNumber(eventData.totalConversions, 0);
  if (totalConversions > 0) {
    signals.push({
      type: 'stat',
      label: `${totalConversions} ${totalConversions === 1 ? 'compra realizada' : 'compras realizadas'}`,
      priority: 1,
    });
  }

  // Ordenar por prioridade (menor = mais importante)
  signals.sort((a, b) => a.priority - b.priority);

  // Limitar a 2-3 sinais mais importantes
  return signals.slice(0, 3);
}


