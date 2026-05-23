/**
 * Registo explícito category → N1 (slug N1 no mesmo N0).
 *
 * Chaves: `${domainKey}:${categorySlugNormalizado}` → `n1Slug` (existente em `n1_nodes`).
 * `categorySlugNormalizado` = mesmo algoritmo que `normalizeConceptSlug` (concept-governance).
 *
 * Não colocar aqui correspondências ambíguas. Estender em PRs auditáveis.
 */
export const EXPLICIT_DOMAIN_SLUG_TO_N1_SLUG: Record<string, string> = {
  // produtos-e-comercio — exemplos canónicos (estender conforme catálogo real)
  'produtos-e-comercio:cerveja': 'bebidas',
  'produtos-e-comercio:carne-bovina': 'alimentacao',
  'produtos-e-comercio:notebook': 'eletroeletronicos',
  'produtos-e-comercio:smartphone': 'eletroeletronicos',
  'produtos-e-comercio:geladeira': 'eletroeletronicos',

  // servicos — exemplos DEV comuns (scope professional → servicos)
  'servicos:advocacia': 'consultoria-e-assessoria',
  'servicos:tecnologia-informacao': 'servicos-de-tecnologia',
  'servicos:tecnologia-da-informacao': 'servicos-de-tecnologia',

  // financas-e-economia — preencher quando existirem categorias nesse N0
  // 'financas-e-economia:conta-corrente': 'contas-e-relacionamento',
};

/**
 * Overrides por `category_id` (UUID) quando slug+domínio não bastam ou precisam precedência.
 */
export const EXPLICIT_CATEGORY_ID_TO_N1_SLUG: Record<string, string> = {};