// frontend/src/types/authority-context.ts
// CONTINUOUS PRODUCTION: Tipos de Contexto de Autoridade - SPRINT 10
// Modelo que expõe responsabilidade institucional de forma clara

export type AuthoritySource = 'ownership' | 'delegation' | 'system';

export interface AuthorityContext {
  executedBy?: string; // User ID que executou a ação
  executedByName?: string; // Nome/display do usuário (se disponível)
  actingFor: string; // Actor ID em nome do qual a ação foi executada
  actingForName?: string; // Nome/display do actor (se disponível)
  authoritySource?: AuthoritySource; // Fonte da autoridade
  permissionUsed?: string; // Permission key usada (se disponível)
  scope?: string; // Escopo da ação (financeiro, equipe, etc.)
}

export function getAuthoritySourceLabel(source?: AuthoritySource): string {
  switch (source) {
    case 'ownership':
      return 'Propriedade';
    case 'delegation':
      return 'Delegação';
    case 'system':
      return 'Sistema';
    default:
      return 'Não especificado';
  }
}

export function getAuthoritySourceDescription(source?: AuthoritySource): string {
  switch (source) {
    case 'ownership':
      return 'Ação executada por ser proprietário da entidade';
    case 'delegation':
      return 'Ação executada através de delegação de permissão';
    case 'system':
      return 'Ação executada pelo sistema automaticamente';
    default:
      return 'Fonte de autoridade não especificada';
  }
}







