/**
 * Domínios N0 canónicos — alinhados a:
 * docs/01_normative/18_DOMAIN_ONTOLOGY_UNIFICARD.md (sec. 7 e 8).
 *
 * Uso: validação em código, seeds, APIs; SSOT no banco = tabela `domains`.
 */
export const N0_CORE_DOMAIN_KEYS = [
  'pessoas-e-identidades',
  'organizacoes-e-instituicoes',
  'comunidades-e-grupos',
  'produtos-e-comercio',
  'servicos',
  'ativos-corporativos',
  'financas-e-economia',
  'mobilidade-e-logistica',
  'cultura-lazer-e-eventos',
  'saude-e-bem-estar',
  'educacao-e-conhecimento',
  'governanca-e-decisao',
] as const;

/** Condicional (sec. 8): elegível, ativação estratégica. */
export const N0_CONDITIONAL_DOMAIN_KEYS = ['construcao-e-infraestrutura'] as const;

export const N0_ALL_DOMAIN_KEYS = [
  ...N0_CORE_DOMAIN_KEYS,
  ...N0_CONDITIONAL_DOMAIN_KEYS,
] as const;

export type N0DomainKey = (typeof N0_ALL_DOMAIN_KEYS)[number];

export function isN0DomainKey(value: string): value is N0DomainKey {
  return (N0_ALL_DOMAIN_KEYS as readonly string[]).includes(value);
}

/**
 * Deriva N0 a partir de `categories.scope` (bootstrap / normalização).
 * Valores fora do switch → produtos-e-comercio (catálogo genérico).
 */
export function inferN0FromCategoryScope(scope: string | null | undefined): N0DomainKey {
  switch (scope) {
    case 'learning':
      return 'educacao-e-conhecimento';
    case 'professional':
      return 'servicos';
    case 'interest':
      return 'cultura-lazer-e-eventos';
    case 'company':
      return 'organizacoes-e-instituicoes';
    case 'cause':
      return 'comunidades-e-grupos';
    case 'event':
      return 'cultura-lazer-e-eventos';
    case 'group':
      return 'comunidades-e-grupos';
    case 'campaign':
      return 'produtos-e-comercio';
    case 'global':
      return 'produtos-e-comercio';
    default:
      return 'produtos-e-comercio';
  }
}