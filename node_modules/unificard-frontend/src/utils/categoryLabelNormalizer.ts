// src/utils/categoryLabelNormalizer.ts
// Normalização de labels humanos de categorias para UI
// 🔒 REGRA: "&" nunca deve aparecer para o usuário - sempre substituir por " e "

/**
 * Normaliza label humano de categoria para exibição na UI
 * Substitui "&" por "e" para manter consistência visual
 *
 * @param label - Label original da categoria (pode conter "&")
 * @returns Label normalizado para exibição (com "e" em vez de "&")
 *
 * @example
 * normalizeCategoryLabel("Cultura, Lazer & Eventos") // "Cultura, Lazer e Eventos"
 * normalizeCategoryLabel("Produtos & Comércio") // "Produtos e Comércio"
 * normalizeCategoryLabel("A&B") // "A e B"
 * normalizeCategoryLabel("A & B") // "A e B"
 */
export function normalizeCategoryLabel(label: string | null | undefined): string {
  if (!label || typeof label !== 'string') {
    return '';
  }

  // Substituir padrões com "&" por "e":
  // - " & " → " e " (com espaços)
  // - "&" sozinho → " e " (adicionando espaços)
  // Depois normalizar espaços múltiplos para evitar "  e  "
  return label
    .replace(/\s*&\s*/g, ' e ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Normaliza array de labels de categorias
 * Útil para normalizar paths completos de categorias
 * 
 * @param labels - Array de labels de categoria
 * @returns Array de labels normalizados
 */
export function normalizeCategoryLabels(labels: string[]): string[] {
  return labels.map(label => normalizeCategoryLabel(label));
}

/**
 * Normaliza path completo de categoria para exibição
 * Ex: ["Cultura, Lazer & Eventos", "Shows & Festivais"] 
 *     -> "Cultura, Lazer e Eventos > Shows e Festivais"
 * 
 * @param path - Array de labels do path da categoria
 * @param separator - Separador entre os labels (padrão: " > ")
 * @returns String com path normalizado
 */
export function normalizeCategoryPath(path: string[], separator: string = ' > '): string {
  return normalizeCategoryLabels(path).join(separator);
}

