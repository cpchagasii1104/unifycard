// src/hooks/useProfilePhysicalLogic.ts
// Fatia 4c (DECISION-0067): o catálogo HARDCODED de interesses (PREDEFINED_CONCEPTS com conceptId fake como
// 'leisure.cinema'/'activity.swimming') foi REMOVIDO. A seção de Interesses agora navega a árvore real
// scope='interest' (getCategoryTree('interest')) e declara via /profile/interest/c1 com conceptId real.
// Sem mapeamento de ids fake antigos para concepts reais. Sem texto livre criando concept.
import type { CategoryTree } from '../api/categories';
import type { SelectedInterest } from './useProfilePhysicalState';

export function useProfilePhysicalLogic() {
  // Um interesse está selecionado quando seu breadcrumb (categoryId) já está na lista (chave de UI).
  const isInterestSelected = (categoryId: string, selected: SelectedInterest[]): boolean => {
    return selected.some((s) => s.categoryId === categoryId);
  };

  // Resolve nome/path de uma categoria pelo id na árvore carregada (breadcrumb/UI, não identidade).
  const findCategoryInTree = (nodes: CategoryTree[], categoryId: string): CategoryTree | null => {
    for (const n of nodes) {
      if (n.categoryId === categoryId) return n;
      if (n.children) {
        const f = findCategoryInTree(n.children, categoryId);
        if (f) return f;
      }
    }
    return null;
  };

  return {
    isInterestSelected,
    findCategoryInTree,
  };
}
