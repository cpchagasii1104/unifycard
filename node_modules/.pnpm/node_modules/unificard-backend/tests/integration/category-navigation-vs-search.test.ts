// backend/tests/integration/category-navigation-vs-search.test.ts
// GATE 2 — SSOT DE LEITURA DE CATEGORIAS
// Teste que compara navegação vs busca de categorias usando o mesmo dataset

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { categoriesService } from '@core/categories/categories.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '@core/tenants/system-tenant';
import type { CategoryContext } from '@unificard/contracts';

describe('GATE 2 — Navegação vs Busca de Categorias (SSOT)', () => {
  let testTenantId: string;

  beforeAll(async () => {
    await ensureSystemTenant();
    testTenantId = uuidv4();

    await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug, created_at, updated_at)
       VALUES ($1, 'Test Tenant Gate 2', 'test-tenant-gate2', NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  it('deve retornar resultados idênticos entre navegação e busca para o mesmo termo', async () => {
    const context: CategoryContext = 'professional';
    const searchTerm = 'Pedreiro';

    // Navegação: obter todas as categorias e filtrar manualmente
    const navigationTree = await categoriesService.getCategoriesForTenant(testTenantId, context);
    const navigationResults = navigationTree.filter(cat => 
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Busca: usar método de busca
    // Obter countryCode do tenant
    const tenant = await pool.query('SELECT country_code FROM tenants WHERE tenant_id = $1', [testTenantId]);
    const countryCode = tenant.rows[0]?.country_code || null;
    
    const searchResults = await categoriesService.searchCategories(
      searchTerm,
      100,
      countryCode,
      context
    );

    // Comparar resultados
    const navigationIds = navigationResults.map(c => c.categoryId).sort();
    const searchIds = searchResults.map(c => c.categoryId).sort();

    expect(navigationIds).toEqual(searchIds);
  });

  it('deve retornar resultados idênticos entre navegação e busca para múltiplos termos', async () => {
    const context: CategoryContext = 'professional';
    const searchTerms = ['Pedreiro', 'Eletricista', 'Encanador'];

    for (const term of searchTerms) {
      const navigationTree = await categoriesService.getCategoriesForTenant(testTenantId, context);
      const navigationResults = navigationTree.filter(cat => 
        cat.name.toLowerCase().includes(term.toLowerCase()) ||
        cat.slug.toLowerCase().includes(term.toLowerCase())
      );

      const tenant = await pool.query('SELECT country_code FROM tenants WHERE tenant_id = $1', [testTenantId]);
      const countryCode = tenant.rows[0]?.country_code || null;
      
      const searchResults = await categoriesService.searchCategories(
        term,
        100,
        countryCode,
        context
      );

      const navigationIds = navigationResults.map(c => c.categoryId).sort();
      const searchIds = searchResults.map(c => c.categoryId).sort();

      expect(navigationIds).toEqual(searchIds);
    }
  });

  it('deve falhar se houver divergência estrutural entre navegação e busca', async () => {
    const context: CategoryContext = 'professional';
    const searchTerm = 'Pedreiro';

    const navigationTree = await categoriesService.getCategoriesForTenant(testTenantId, context);
    const navigationResults = navigationTree.filter(cat => 
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tenant = await pool.query('SELECT country_code FROM tenants WHERE tenant_id = $1', [testTenantId]);
    const countryCode = tenant.rows[0]?.country_code || null;
    
    const searchResults = await categoriesService.searchCategories(
      searchTerm,
      100,
      countryCode,
      context
    );

    // Verificar que ambos usam o mesmo dataset
    const navigationIds = navigationResults.map(c => c.categoryId).sort();
    const searchIds = searchResults.map(c => c.categoryId).sort();

    // Se houver divergência, este teste falhará
    expect(navigationIds).toEqual(searchIds);
  });
});

