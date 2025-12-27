// src/utils/actorLanguage.ts
// Utilitário central para linguagem adaptativa baseada no ator ativo
// REGRA: A linguagem da interface segue o activeActor. Sem exceções.

import { AvailableActor } from '../api/social';

/**
 * Verifica se o modo atual é Pessoa Física
 */
export function isPersonMode(activeActor: AvailableActor | null): boolean {
  return activeActor?.actor_type === 'user';
}

/**
 * Verifica se o modo atual é Pessoa Jurídica (Empresa)
 */
export function isCompanyMode(activeActor: AvailableActor | null): boolean {
  return activeActor?.actor_type === 'page';
}

/**
 * Retorna o nome do ator ativo
 */
export function getActorLabel(activeActor: AvailableActor | null): string {
  if (!activeActor) {
    return 'Você';
  }
  return activeActor.display_name || 'Você';
}

/**
 * Retorna o pronome apropriado baseado no modo
 * PF: "você", PJ: nome da empresa
 */
export function getActorPronoun(activeActor: AvailableActor | null): string {
  if (isPersonMode(activeActor)) {
    return 'você';
  }
  return getActorLabel(activeActor);
}

/**
 * Retorna o pronome possessivo apropriado
 * PF: "seu/sua", PJ: "da empresa" ou nome direto
 */
export function getActorPossessive(activeActor: AvailableActor | null): string {
  if (isPersonMode(activeActor)) {
    return 'seu';
  }
  // Para empresas, preferir nome direto para evitar ambiguidade
  return `de ${getActorLabel(activeActor)}`;
}

/**
 * Retorna texto adaptado baseado no modo
 * @param activeActor - Ator ativo
 * @param personText - Texto para modo Pessoa Física
 * @param companyText - Texto para modo Empresa (opcional, usa personText se não fornecido)
 */
export function getAdaptiveText(
  activeActor: AvailableActor | null,
  personText: string,
  companyText?: string
): string {
  if (isPersonMode(activeActor)) {
    return personText;
  }
  
  // Se não forneceu texto específico para empresa, substitui "você" pelo nome
  if (!companyText) {
    const actorName = getActorLabel(activeActor);
    return personText.replace(/você/gi, actorName)
                     .replace(/seu/gi, `de ${actorName}`)
                     .replace(/sua/gi, `de ${actorName}`);
  }
  
  return companyText;
}

/**
 * Retorna o texto "Publicando como..." adaptado
 */
export function getPublishingAsText(activeActor: AvailableActor | null): string {
  if (isPersonMode(activeActor)) {
    return 'Publicando como você';
  }
  return `Publicando como ${getActorLabel(activeActor)}`;
}

/**
 * Retorna o texto de público/audiência adaptado
 */
export function getAudienceLabel(activeActor: AvailableActor | null): string {
  if (isPersonMode(activeActor)) {
    return 'Seu público';
  }
  return `Público ${getActorPossessive(activeActor)}`;
}

/**
 * Retorna mensagem de sucesso adaptada
 */
export function getSuccessMessage(
  activeActor: AvailableActor | null,
  action: 'published' | 'joined' | 'supported' | 'created'
): string {
  const actorLabel = getActorLabel(activeActor);
  
  if (isPersonMode(activeActor)) {
    const messages = {
      published: 'Você publicou com sucesso.',
      joined: 'Você entrou no grupo.',
      supported: 'Você apoiou este projeto.',
      created: 'Você criou com sucesso.',
    };
    return messages[action];
  }
  
  // Modo empresa
  const messages = {
    published: `${actorLabel} publicou com sucesso.`,
    joined: `${actorLabel} entrou no grupo.`,
    supported: `${actorLabel} apoiou este projeto.`,
    created: `${actorLabel} criou com sucesso.`,
  };
  return messages[action];
}

/**
 * Retorna texto de empty state adaptado
 */
export function getEmptyStateText(
  activeActor: AvailableActor | null,
  context: 'feed' | 'groups' | 'posts'
): string {
  if (isPersonMode(activeActor)) {
    const messages = {
      feed: 'Seu feed está vazio. Comece seguindo pessoas e grupos!',
      groups: 'Você ainda não participa de grupos.',
      posts: 'Você ainda não publicou nada.',
    };
    return messages[context];
  }
  
  const actorLabel = getActorLabel(activeActor);
  const messages = {
    feed: `O feed ${getActorPossessive(activeActor)} está vazio. Comece seguindo pessoas e grupos!`,
    groups: `${actorLabel} ainda não participa de grupos.`,
    posts: `${actorLabel} ainda não publicou nada.`,
  };
  return messages[context];
}













