// src/utils/intentDetection.ts
// Detecção de intenção - preparado para evolução com IA
// Estrutura pronta para plugar IA futura

export type IntentType = 'navigation' | 'search' | 'action';

export interface Intent {
  type: IntentType;
  route?: string;
  params?: Record<string, any>;
  confidence: number;
}

/**
 * Detecta intenção do texto do usuário
 * Hoje: apenas navegação simples baseada em correspondência de nomes
 * Futuro: suportará múltiplas intenções com IA/NLP
 */
export function detectIntent(
  text: string,
  availableRoutes: Array<{ name: string; route: string }>
): Intent {
  const normalizedText = text.toLowerCase().trim();

  if (!normalizedText) {
    return {
      type: 'search',
      confidence: 0,
    };
  }

  // Buscar correspondência exata ou parcial em rotas disponíveis
  for (const route of availableRoutes) {
    const routeName = route.name.toLowerCase();
    if (normalizedText.includes(routeName) || routeName.includes(normalizedText)) {
      return {
        type: 'navigation',
        route: route.route,
        confidence: 0.9,
        params: { matchedRoute: route.name },
      };
    }
  }

  // Se não encontrou correspondência, retornar busca
  return {
    type: 'search',
    confidence: 0.5,
    params: { query: text, fallback: true },
  };
}
