// src/utils/nameNormalizer.ts
// Normalização de nomes próprios

/**
 * Normaliza nome completo capitalizando corretamente
 * Regras:
 * - Primeira letra de cada palavra em maiúscula
 * - Palavras de ligação (de, da, do, dos, das, e) sempre em minúsculo
 * - Primeira palavra sempre capitalizada
 * 
 * @param name - Nome a ser normalizado
 * @returns Nome normalizado
 * 
 * @example
 * normalizeFullName("joÃO dA siLVa") // "João da Silva"
 * normalizeFullName("MARIA DOS SANTOS") // "Maria dos Santos"
 * normalizeFullName("josé e maria") // "José e Maria"
 */
export function normalizeFullName(name: string): string {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Palavras de ligação que devem ficar em minúsculo
  const linkingWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

  // Remover espaços extras e dividir em palavras
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);

  if (words.length === 0) {
    return '';
  }

  // Normalizar cada palavra
  const normalizedWords = words.map((word, index) => {
    const lowerWord = word.toLowerCase();
    
    // Primeira palavra sempre capitaliza
    if (index === 0) {
      return capitalizeFirstLetter(lowerWord);
    }
    
    // Palavras de ligação ficam minúsculas
    if (linkingWords.has(lowerWord)) {
      return lowerWord;
    }
    
    // Demais palavras capitalizam
    return capitalizeFirstLetter(lowerWord);
  });

  return normalizedWords.join(' ');
}

/**
 * Capitaliza a primeira letra de uma palavra
 */
function capitalizeFirstLetter(word: string): string {
  if (!word || word.length === 0) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}




