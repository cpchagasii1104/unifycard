import { useState } from 'react';
import type { CategoryTree, Category } from '../api/categories';
import { getCategoryTree, getCategoryChildren, getProfessionalProfile } from '../api/categories';

export function useProfessionalCategories(
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setBio: (bio: string) => void,
  setSelectedSkills: (skills: any[]) => void
) {
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);

  /** N0 técnico usado só na árvore de BD; não deve aparecer como grupo na UI da aba profissional. */
  const HIDDEN_PROFESSIONAL_ROOT_SLUGS = new Set(['profissoes']);

  /**
   * Promove filhos do N0 técnico para raiz visual (mesmo nível que ex.: Saúde).
   * Não altera dados nem API — só a árvore em memória para renderização.
   */
  const flattenHiddenProfessionalRoots = (roots: CategoryTree[]): CategoryTree[] => {
    const out: CategoryTree[] = [];
    for (const node of roots) {
      if (node.level === 0 && HIDDEN_PROFESSIONAL_ROOT_SLUGS.has(node.slug)) {
        const kids = node.children ?? [];
        for (const child of kids) {
          out.push(child);
        }
      } else {
        out.push(node);
      }
    }
    return out;
  };

  // 🔒 FILTRO PROFISSIONAL: Filtrar categorias válidas para contexto profissional
  // REGRA CANÔNICA: scope='professional' OU scope='global' são válidos (alinhado com backend)
  // Referência: categories.repository.ts linha 887-890
  const filterProfessionalCategories = (tree: CategoryTree[]): CategoryTree[] => {
    // Helper para validar scope válido para profissional
    const isValidProfessionalScope = (scope?: string | null) =>
      scope === 'professional' || scope === 'global' || !scope;

    // Filtrar categorias (nível 0 = setores)
    const roots = tree
      .filter((category) => {
        // Apenas nível 0 (setores)
        if (category.level !== 0) return false;
        // Categorias com scope='professional' ou scope='global' são válidas
        return isValidProfessionalScope(category.scope);
      })
      .map((category) => ({
        ...category,
        // Filtrar recursivamente os children
        children: category.children
          ? category.children
              .filter((child) => isValidProfessionalScope(child.scope))
              .map((child) => ({
                ...child,
                // Filtrar children de level 2 também
                children: child.children
                  ? child.children.filter((grandchild) => isValidProfessionalScope(grandchild.scope))
                  : [],
              }))
          : [],
      }));

    return flattenHiddenProfessionalRoots(roots);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 🔴 ADR: Árvore profissional é INDEPENDENTE do perfil profissional
      // tenantId já foi resolvido no bootstrap - client.ts valida antes de fazer request
      // NÃO verificar tenantId manualmente aqui (client.ts já faz isso)
      
      // 🔴 ADR: Carregar árvore profissional usando context='professional' obrigatoriamente
      const tree = await getCategoryTree('professional').catch((err: any) => {
        // 🔴 FEATURE_UNAVAILABLE não é erro - tratar silenciosamente
        if (err.code === 'FEATURE_UNAVAILABLE' || err.status === 404) {
          // Feature não disponível: retornar lista vazia (não é erro)
          return [];
        }
        
        const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
        
        // Apenas erros reais devem ser logados
        if (import.meta.env.DEV) {
          console.error('Erro ao carregar categorias:', err);
        }
        throw new Error(`Erro ao carregar categorias: ${errorMsg}`);
      });

      // 🔴 ADR: Perfil profissional pode ou não existir - não bloquear UI
      // Carregar perfil profissional em paralelo, mas não falhar se não existir
      const profile = await getProfessionalProfile().catch((err) => {
        // 404 = perfil não existe ainda - estado esperado, não é erro
        if (err?.status === 404 || err?.code === 'NOT_FOUND') {
          // Não logar - é estado esperado (perfil não criado ainda)
          return { globalUserId: '', skills: [], bio: null };
        }
        // Outros erros não são críticos - perfil pode não existir ainda
        if (import.meta.env.DEV) {
          console.warn('Erro ao carregar perfil profissional (não crítico):', err);
        }
        return { globalUserId: '', skills: [], bio: null };
      });

      // 🔴 ADR: Tratar lista vazia como estado válido (não é erro)
      // Árvore pode estar vazia se feature não estiver configurada ainda
      if (tree.length === 0) {
        setCategoryTree([]);
      } else {
        // 🔒 Aplicar filtro profissional: apenas categorias permitidas
        const filteredTree = filterProfessionalCategories(tree);
        setCategoryTree(filteredTree);
      }
      
      // 🔴 ADR: Perfil profissional é opcional - não bloquear UI se não existir
      // Apenas setar dados se perfil existir
      if (profile) {
        setBio(profile.bio || '');
        setSelectedSkills(
          profile.skills.map((s) => ({
            categoryId: s.categoryId,
            categoryName: s.categoryName,
            categoryPath: s.categoryPath,
            skillLevel: s.skillLevel,
            yearsExperience: s.yearsExperience,
            hourlyRate: s.hourlyRate,
            pricingType: s.pricingType || 'hourly',
            serviceType: (s as any).serviceType || 'service',
            chargeVisit: (s as any).chargeVisit || false,
            visitPrice: (s as any).visitPrice || null,
            predefinedServices: (s as any).predefinedServices || [],
            comboDiscountRules: (s as any).comboDiscountRules || [],
          }))
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      
      // 🔴 ADR: Erro de tenant não deve ocorrer (já validado no bootstrap)
      // Apenas logar erros reais, não estados esperados
      if (errorMessage.includes('Não autenticado') || errorMessage.includes('401')) {
        setError('Sessão expirada. Por favor, faça login novamente.');
      } else {
        // Apenas mostrar erro se for erro real (não 404 ou feature unavailable)
        if (!errorMessage.includes('404') && !errorMessage.includes('FEATURE_UNAVAILABLE')) {
          setError(errorMessage);
        }
      }
      
      if (import.meta.env.DEV) {
        console.error('Erro ao carregar dados profissionais:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Função auxiliar para encontrar categoria pelo ID na árvore
  const findCategoryById = (tree: CategoryTree[], id: string): CategoryTree | null => {
    for (const cat of tree) {
      if (cat.categoryId === id) return cat;
      // 🔴 FIX: Recursão mesmo com children vazio
      if (cat.children) {
        const found = findCategoryById(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Função auxiliar para atualizar árvore com novos children
  const updateTreeWithChildren = (tree: CategoryTree[], parentId: string, children: Category[]): CategoryTree[] => {
    console.log('[updateTreeWithChildren] Chamado:', {
      treeLength: tree.length,
      parentId,
      childrenCount: children.length,
      childrenLevels: children.map(c => c.level),
    });

    return tree.map(cat => {
      if (cat.categoryId === parentId) {
        console.log('[updateTreeWithChildren] MATCH! Atualizando:', {
          catName: cat.name,
          catLevel: cat.level,
          newChildrenCount: children.length,
        });
        // Filtrar children para manter apenas os com scope='professional'
        const filteredChildren = children
          .filter(child => child.scope === 'professional')
          .map(child => ({
            ...child,
            children: [], // Children de nível 2 não têm filhos (mas podem ter se carregados depois)
          })) as CategoryTree[];
        
        const updatedCat = {
          ...cat,
          children: filteredChildren,
        };
        console.log('[updateTreeWithChildren] Categoria atualizada:', {
          name: updatedCat.name,
          childrenCount: updatedCat.children.length,
          childrenSample: updatedCat.children.slice(0, 3).map(c => ({ name: c.name, level: c.level })),
        });
        return updatedCat;
      }
      // 🔴 FIX: Recursão mesmo com children vazio para encontrar categoria em níveis mais profundos
      if (cat.children) {
        return {
          ...cat,
          children: updateTreeWithChildren(cat.children, parentId, children),
        };
      }
      return cat;
    });
  };


  return {
    categoryTree,
    setCategoryTree,
    filterProfessionalCategories,
    loadData,
    findCategoryById,
    updateTreeWithChildren,
  };
}

