// backend/src/modules/marketplace/application/services/discovery-application.service.ts
// Application Service: descoberta de lojas, geolocalização, store search.

export interface IDiscoveryOrchestrator {
  getStores(scope?: string, valueCents?: string): {
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      location?: {
        visible_in_locator: boolean;
        city?: string;
        neighborhood?: string;
      };
      branches: Array<{
        branch_id: string;
        name: string;
        city: string;
        location?: {
          city: string;
          neighborhood?: string;
          visible_in_locator?: boolean;
        };
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  };
  getCategories(): {
    categories: Array<{
      id: string;
      name: string;
      templates: string[];
      children?: Array<{
        id: string;
        name: string;
        templates: string[];
      }>;
    }>;
  };
}

export interface IDiscoveryApplicationDeps {
  orchestrator: IDiscoveryOrchestrator;
}

export class DiscoveryApplicationService {
  constructor(private readonly deps: IDiscoveryApplicationDeps) {}

  /**
   * Buscar lojas próximas (descoberta local)
   * NÃO calcula distância, NÃO ordena automaticamente
   * Apenas filtra por localização e critérios
   */
  getStoresNear(params: {
    city: string;
    neighborhood?: string;
    category_id?: string;
    template_id?: string;
  }): {
    city: string;
    filters_applied: {
      city: string;
      neighborhood?: string;
      category_id?: string;
      template_id?: string;
    };
    stores: Array<{
      storeId: string;
      name: string;
      templateId: string;
      branches: Array<{
        branch_id: string;
        name: string;
        neighborhood?: string;
        pickup: boolean;
        delivery: boolean;
      }>;
    }>;
  } {
    const { city, neighborhood, category_id, template_id } = params;
    const allStoresData = this.deps.orchestrator.getStores();
    let filteredStores = allStoresData.stores;

    // Filtrar por visibilidade no locator
    filteredStores = filteredStores.filter(store => {
      if (store.location && !store.location.visible_in_locator) {
        return false;
      }
      const hasVisibleBranch = store.branches.some(branch => {
        const branchInCity = branch.city === city || (branch.location && branch.location.city === city);
        const branchVisible = !branch.location || branch.location.visible_in_locator;
        return branchInCity && branchVisible;
      });
      return hasVisibleBranch;
    });

    if (template_id) {
      filteredStores = filteredStores.filter(store => store.templateId === template_id);
    }

    if (category_id) {
      const categoriesData = this.deps.orchestrator.getCategories();
      const findCategory = (cats: typeof categoriesData.categories): (typeof categoriesData.categories)[0] | null => {
        for (const cat of cats) {
          if (cat.id === category_id) return cat;
          if (cat.children) {
            const found = findCategory(cat.children);
            if (found) return found;
          }
        }
        return null;
      };
      const category = findCategory(categoriesData.categories);
      if (!category) {
        filteredStores = [];
      } else {
        filteredStores = filteredStores.filter(store => category.templates.includes(store.templateId));
      }
    }

    const resultStores = filteredStores.map(store => {
      const filteredBranches = store.branches
        .filter(branch => {
          const branchInCity = branch.city === city || (branch.location && branch.location.city === city);
          if (!branchInCity) return false;
          if (neighborhood) {
            const branchNeighborhood = branch.location?.neighborhood;
            if (branchNeighborhood !== neighborhood) return false;
          }
          const branchVisible = !branch.location || branch.location.visible_in_locator;
          return branchVisible;
        })
        .map(branch => ({
          branch_id: branch.branch_id,
          name: branch.name,
          neighborhood: branch.location?.neighborhood,
          pickup: branch.pickup,
          delivery: branch.delivery,
        }));

      if (filteredBranches.length === 0) {
        return null;
      }
      return {
        storeId: store.storeId,
        name: store.name,
        templateId: store.templateId,
        branches: filteredBranches,
      };
    }).filter((store): store is NonNullable<typeof store> => store !== null);

    return {
      city,
      filters_applied: {
        city,
        neighborhood,
        category_id,
        template_id,
      },
      stores: resultStores,
    };
  }
}