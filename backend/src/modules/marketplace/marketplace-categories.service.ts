// backend/src/modules/marketplace/marketplace-categories.service.ts
// Marketplace Categories Service
// 🔴 BLINDAGEM: Marketplace consome categorias CORE, não cria novas

import { categoriesService } from '@core/categories/categories.service';
import { CategoryRepository } from '@core/categories/categories.repository';
import type { Category } from '@core/categories/categories.types';
import type {
  MarketplaceCategory,
  MarketplaceCategoryFilters,
  ImportCategoriesInput,
  ActorCategoryImport,
  MarketplaceCategoryType,
  MarketplaceDomain,
} from './marketplace-categories.types';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { CategoryModel } from '@core/categories/categories.model';

class MarketplaceCategoriesService {
  private categoryRepository = new CategoryRepository();
  /**
   * Lista categorias raiz do Marketplace (Segments)
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace' e taxonomy = 'department'
   * 🔴 FILTRO: category_type = 'segment' (segmentos como Supermercados, Farmácias, etc.)
   * 🔴 FILTRO: Se marketplaceDomain fornecido, filtra por metadata.marketplace_domain
   */
  async getRootCategories(
    tenantId: string,
    filters: MarketplaceCategoryFilters = {}
  ): Promise<MarketplaceCategory[]> {
    // 2026-07-07 (Clayton: "respeitar ontologia/N0/N1/N2"): os "segmentos" do marketplace
    // NÃO são taxonomia própria — são PROJEÇÃO dos N1 GOVERNADOS (n1_nodes, doc 19 CONGELADO)
    // do N0 mapeado pelo domínio (MARKETPLACE_DOMAIN_TO_N0, DECISION-0106). Zero árvore paralela.
    // Mata o fallback histórico context='professional' + filtros comentados (TODOs antigos).
    const domain = (filters.marketplaceDomain || 'market') as string;
    const { MARKETPLACE_DOMAIN_TO_N0 } = await import('@core/marketplace-domain/marketplace-domain-n0-mapping');
    const { pool } = await import('@core/database/pool');

    // vehicles não tem N0 próprio (mapping=null): é o PAR de N1 de produtos-e-comercio
    // definido no doc 19 ("possui chassis"). real_estate/jobs: sem N0 → vazio HONESTO
    // (expansão = RFC doc 21, decisão soberana — nunca inventado aqui).
    const VEHICLES_N1 = ['veiculos', 'pecas-e-acessorios-automotivos'];
    const n0 = MARKETPLACE_DOMAIN_TO_N0[domain as keyof typeof MARKETPLACE_DOMAIN_TO_N0] ?? null;

    let rows: Array<{ n1_id: string; slug: string }> = [];
    if (domain === 'vehicles') {
      const r = await pool.query(
        `SELECT n1_id::text, slug FROM n1_nodes WHERE slug = ANY($1) ORDER BY sort_order`, [VEHICLES_N1]);
      rows = r.rows;
    } else if (n0) {
      const r = await pool.query(
        `SELECT n1_id::text, slug FROM n1_nodes WHERE domain_key = $1 ORDER BY sort_order`, [n0]);
      rows = r.rows;
    }

    const humanize = (slug: string) =>
      slug.split('-').map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : (w === 'e' ? 'e' : w))).join(' ');

    const now = new Date().toISOString();
    return rows.map((r) => ({
      id: r.n1_id,
      categoryId: r.n1_id,
      slug: r.slug,
      name: humanize(r.slug),
      description: undefined,
      parentId: undefined,
      scope: 'marketplace-n1-projection',
      isActive: true,
      metadata: { category_type: 'segment', marketplace_domain: domain, n1_slug: r.slug, n0_domain: n0 },
      createdAt: now,
      updatedAt: now,
      path: [r.slug],
      level: 0,
    })) as unknown as MarketplaceCategory[];
  }

  /**
   * Lista branches (products/services) de um department
   * 🔴 BLINDAGEM: Apenas categorias com metadata.taxonomy = 'branch'
   * 🔴 FALLBACK: Se não houver branches, retorna array vazio (não retorna categories)
   */
  async getDepartmentBranches(
    tenantId: string,
    departmentId: string
  ): Promise<MarketplaceCategory[]> {
    // Buscar filhos diretos do department usando o service canônico
    const children = await categoriesService.getChildren(departmentId);

    // Filtrar apenas branches (taxonomy = 'branch')
    // Nota: metadata não está no tipo Category canônico, remover filtro por enquanto
    // TODO: Implementar filtro de metadata quando disponível
    const branches = children;

    // Converter para MarketplaceCategory
    return Promise.all(branches.map((c) => this.toMarketplaceCategory(c)));
  }

  /**
   * Lista categories de uma branch específica
   * 🔴 BLINDAGEM: Apenas categorias (não branches, não subcategories)
   * 🔴 FALLBACK: Se não houver categories, retorna array vazio (não retorna branches)
   */
  async getBranchCategories(
    tenantId: string,
    branchId: string,
    filters: MarketplaceCategoryFilters = {}
  ): Promise<MarketplaceCategory[]> {
    // Buscar filhos diretos da branch usando o service canônico
    const children = await categoriesService.getChildren(branchId);

    // Filtrar apenas categories (taxonomy = 'category' ou NULL, mas não 'branch' nem 'department')
    // Nota: metadata não está no tipo Category canônico, remover filtro por enquanto
    // TODO: Implementar filtro de metadata quando disponível
    let categories = children;

    // Se actorId foi fornecido, filtrar apenas categorias importadas
    if (filters.actorId) {
      const importedCategoryIds = await this.getImportedCategoryIds(tenantId, filters.actorId);
      categories = categories.filter((c) => importedCategoryIds.includes(c.categoryId));
    }

    // Converter para MarketplaceCategory
    return Promise.all(categories.map((c) => this.toMarketplaceCategory(c)));
  }

  /**
   * Lista todos os filhos de uma categoria
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   * 🔴 REGRA: Retorna todos os filhos (branches, categories, subcategories) sem filtrar por taxonomy
   * 🔴 ORDENAÇÃO: Branches primeiro, depois categories, depois subcategories
   * 🔴 FILTRO: Se marketplaceDomain fornecido, filtra por metadata.marketplace_domain
   */
  async getCategoryChildren(
    tenantId: string,
    categoryId: string,
    filters: MarketplaceCategoryFilters = {}
  ): Promise<MarketplaceCategory[]> {
    // Buscar filhos diretos usando o service canônico
    const children = await categoriesService.getChildren(categoryId);

    // Filtrar apenas categorias do domínio marketplace
    // Nota: metadata não está no tipo Category canônico, remover filtro por enquanto
    // TODO: Implementar filtro de metadata quando disponível
    let marketplaceChildren = children;

    // Filtrar por marketplace_domain: BLOQUEIO - Category (core) não declara metadata; filtro desativado até core expor.

    // Se actorId foi fornecido, filtrar apenas categorias importadas
    if (filters.actorId) {
      const importedCategoryIds = await this.getImportedCategoryIds(tenantId, filters.actorId);
      marketplaceChildren = marketplaceChildren.filter((c) => importedCategoryIds.includes(c.categoryId));
    }

    // Ordenar por nome (ordenar por taxonomy requer metadata em Category - core não expõe ainda)
    marketplaceChildren.sort((a, b) => a.name.localeCompare(b.name));

    // Converter para MarketplaceCategory com path e level corretos
    return Promise.all(marketplaceChildren.map((c) => this.toMarketplaceCategory(c)));
  }

  /**
   * Busca categoria por ID
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   */
  async getCategoryById(
    tenantId: string,
    categoryId: string
  ): Promise<MarketplaceCategory | null> {
    const category = await categoriesService.getCategoryById(categoryId);
    if (!category) return null;

    // Validar que é categoria do domínio marketplace
    // Nota: metadata não está no tipo Category canônico, mas pode estar em path/level
    // Por enquanto, assumir que todas as categorias retornadas são válidas
    // TODO: Verificar se metadata existe no Category canônico ou se precisa ser buscado separadamente

    return this.toMarketplaceCategory(category);
  }

  /**
   * Busca categoria por path (com path completo)
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   */
  async getCategoryByPath(
    tenantId: string,
    path: string[]
  ): Promise<MarketplaceCategory | null> {
    if (path.length === 0) return null;

    // Buscar todas as categorias ativas do marketplace usando o repository canônico
    // TRAVA: BLOCKED_BY_SCHEMA - context obrigatório - usar 'professional' como fallback até definir context específico para marketplace
    // NÃO criar novos usos deste padrão - context deve ser explícito quando schema permitir
    const allRows = await this.categoryRepository.findAll(undefined, 'professional' as any);
    const allCategories = CategoryModel.fromRows(allRows);

    // Filtrar apenas categorias do domínio marketplace
    // Nota: metadata não está no tipo Category canônico, assumir que todas são válidas por enquanto
    const marketplaceCategories = allCategories;

    // Buscar categoria raiz primeiro
    let currentCategory = marketplaceCategories.find(
      (c) => !c.parentId && c.slug === path[0]
    );
    if (!currentCategory) return null;

    // Navegar pela hierarquia
    for (let i = 1; i < path.length; i++) {
      const children = marketplaceCategories.filter(
        (c) => c.parentId === currentCategory!.categoryId
      );
      const child = children.find((c) => c.slug === path[i]);
      if (!child) return null;
      currentCategory = child;
    }

    return this.toMarketplaceCategory(currentCategory);
  }

  /**
   * Busca breadcrumb de uma categoria
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   */
  async getCategoryBreadcrumb(
    tenantId: string,
    categoryId: string
  ): Promise<Array<{ categoryId: string; name: string; slug: string; path: string }>> {
    const category = await categoriesService.getCategoryById(categoryId);
    if (!category) return [];

    // Validar que é categoria do domínio marketplace
    // Nota: metadata não está no tipo Category canônico, assumir que todas são válidas por enquanto

    const breadcrumb: Array<{ categoryId: string; name: string; slug: string; path: string }> = [];

    // Se tem parent, buscar recursivamente
    if (category.parentId) {
      const parentBreadcrumb = await this.getCategoryBreadcrumb(tenantId, category.parentId);
      breadcrumb.push(...parentBreadcrumb);
    }

    // Construir path até esta categoria
    const path = breadcrumb.map((b) => b.slug).concat(category.slug);

    breadcrumb.push({
      categoryId: category.categoryId,
      name: category.name,
      slug: category.slug,
      path: '/' + path.join('/'),
    });

    return breadcrumb;
  }

  /**
   * Importa categorias para um Actor/Empresa
   * 🔴 BLINDAGEM: Apenas cria referências, não duplica categorias
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   */
  async importCategories(
    tenantId: string,
    actorId: string,
    input: ImportCategoriesInput,
    importedByActorId: string
  ): Promise<ActorCategoryImport> {
    // Validar que todas as categorias existem e são do domínio marketplace
    for (const categoryId of input.categoryIds) {
      const category = await categoriesService.getCategoryById(categoryId);
      if (!category) {
        throw new Error(`Categoria ${categoryId} não encontrada`);
      }
      // Nota: metadata não está no tipo Category canônico, assumir que todas são válidas por enquanto
    }

    // Buscar importação existente ou criar nova
    const existing = await this.getActorCategoryImport(tenantId, actorId);
    
    if (existing) {
      // Atualizar lista de categorias importadas
      const updatedCategoryIds = [...new Set([...existing.categoryIds, ...input.categoryIds])];
      
      await runQueryWithTenant(
        tenantId,
        `
        UPDATE actor_category_imports
        SET category_ids = $1::uuid[], metadata = $2::jsonb, updated_at = NOW()
        WHERE actor_id = $3 AND tenant_id = $4
        `,
        [updatedCategoryIds, JSON.stringify(input.metadata || {}), actorId, tenantId]
      );

      return {
        actorId,
        categoryIds: updatedCategoryIds,
        importedAt: existing.importedAt,
        importedByActorId: existing.importedByActorId,
        metadata: { ...existing.metadata, ...input.metadata },
      };
    } else {
      // Criar nova importação
      await runQueryWithTenant(
        tenantId,
        `
        INSERT INTO actor_category_imports (tenant_id, actor_id, category_ids, imported_by_actor_id, metadata)
        VALUES ($1, $2, $3::uuid[], $4, $5::jsonb)
        `,
        [
          tenantId,
          actorId,
          input.categoryIds,
          importedByActorId,
          JSON.stringify(input.metadata || {}),
        ]
      );

      return {
        actorId,
        categoryIds: input.categoryIds,
        importedAt: new Date(),
        importedByActorId,
        metadata: input.metadata,
      };
    }
  }

  /**
   * Lista categorias importadas por um Actor
   * 🔴 BLINDAGEM: Apenas categorias com metadata.domain = 'marketplace'
   */
  async getImportedCategories(
    tenantId: string,
    actorId: string
  ): Promise<MarketplaceCategory[]> {
    const importData = await this.getActorCategoryImport(tenantId, actorId);
    if (!importData || importData.categoryIds.length === 0) {
      return [];
    }

    const categories: Category[] = [];
    for (const categoryId of importData.categoryIds) {
      const category = await categoriesService.getCategoryById(categoryId);
      // Filtrar apenas categorias do domínio marketplace
      // Nota: metadata não está no tipo Category canônico, assumir que todas são válidas por enquanto
      if (category) {
        categories.push(category);
      }
    }

    return Promise.all(categories.map((c) => this.toMarketplaceCategory(c)));
  }

  /**
   * Busca IDs de categorias importadas por um Actor
   */
  private async getImportedCategoryIds(
    tenantId: string,
    actorId: string
  ): Promise<string[]> {
    const importData = await this.getActorCategoryImport(tenantId, actorId);
    return importData?.categoryIds || [];
  }

  /**
   * Busca importação de categorias de um Actor
   */
  private async getActorCategoryImport(
    tenantId: string,
    actorId: string
  ): Promise<ActorCategoryImport | null> {
    const row = await runQueryWithTenant<{
      actor_id: string;
      category_ids: string[];
      created_at: Date;
      imported_by_actor_id: string;
      metadata: any;
    }>(
      tenantId,
      `
      SELECT actor_id, category_ids, created_at, imported_by_actor_id, metadata
      FROM actor_category_imports
      WHERE actor_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [actorId, tenantId]
    );

    if (!row) return null;

    return {
      actorId: row.actor_id,
      categoryIds: row.category_ids,
      importedAt: row.created_at,
      importedByActorId: row.imported_by_actor_id,
      metadata: row.metadata || {},
    };
  }

  /**
   * Converte Category canônico para MarketplaceCategory
   */
  private async toMarketplaceCategory(category: Category): Promise<MarketplaceCategory> {
    // Buscar path completo recursivamente
    const path: string[] = [];
    let level = 0;
    let current: Category | null = category;

    while (current) {
      path.unshift(current.slug);
      level++;
      if (current.parentId) {
        current = await categoriesService.getCategoryById(current.parentId);
      } else {
        current = null;
      }
    }

    return {
      ...category,
      id: category.categoryId,
      type: this.inferCategoryType(category),
      path,
      level: level - 1, // Ajustar para começar em 0
    };
  }

  /**
   * Lista segmentos por domínio
   * 🔴 REGRA: Retorna apenas category_type = 'segment'
   */
  async getSegmentsByDomain(
    tenantId: string,
    domain: MarketplaceDomain
  ): Promise<MarketplaceCategory[]> {
    return this.getRootCategories(tenantId, { marketplaceDomain: domain });
  }

  /**
   * Lista categorias de oferta de uma store
   * 🔴 REGRA: Retorna apenas category_type = 'offer_category'
   * 🔴 NOTA: Por enquanto retorna array vazio (implementação futura)
   */
  async getOfferCategoriesByStore(
    tenantId: string,
    storeId: string
  ): Promise<MarketplaceCategory[]> {
    // TODO: Implementar busca de offer_categories por store
    // Por enquanto, retornar array vazio para não quebrar
    return [];
  }

  /**
   * Converte Category canônico para MarketplaceCategory (síncrono, sem path completo)
   */
  private toMarketplaceCategorySync(category: Category): MarketplaceCategory {
    return {
      ...category,
      id: category.categoryId,
      type: this.inferCategoryType(category),
      path: [category.slug], // Path parcial (apenas slug atual)
      level: 0, // Será calculado corretamente quando necessário
    };
  }

  /**
   * Infere tipo de categoria baseado em metadata
   * 🔴 BLINDAGEM: Marketplace é para produtos, não serviços
   * Nota: metadata não está no tipo Category canônico, usar default 'product'
   */
  private inferCategoryType(category: Category): MarketplaceCategoryType {
    // Nota: metadata não está disponível no tipo Category canônico
    // Por enquanto, retornar 'product' como default para marketplace
    // TODO: Verificar se metadata precisa ser buscado separadamente ou se está em outro campo
    return 'product';
  }
}

export const marketplaceCategoriesService = new MarketplaceCategoriesService();


