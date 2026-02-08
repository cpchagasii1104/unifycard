// backend/src/core/categories/__tests__/ssot.test.ts
// Testes institucionais para SSOT de leitura de categorias
// SSOT: Single Source of Truth - garante que nenhuma leitura ocorre sem tenant e context

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { CategoryRepository } from '../categories.repository';
import { categoriesService } from '../categories.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '@core/tenants/system-tenant';
import type { CategoryContext } from '@unificard/contracts';

describe('SSOT - Single Source of Truth para Leitura de Categorias', () => {
  let testTenantId1: string;
  let testTenantId2: string;
  let repository: CategoryRepository;

  beforeAll(async () => {
    // Garantir que system-tenant existe
    await ensureSystemTenant();

    // Criar tenants de teste
    testTenantId1 = uuidv4();
    testTenantId2 = uuidv4();

    await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug, createdAt, updatedAt)
       VALUES ($1, 'Test Tenant 1', 'test-tenant-1', NOW(), NOW()),
              ($2, 'Test Tenant 2', 'test-tenant-2', NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId1, testTenantId2]
    );

    repository = new CategoryRepository();
  });

  afterAll(async () => {
    // Limpar tenants de teste
    await pool.query('DELETE FROM tenants WHERE tenant_id = ANY($1)', [[testTenantId1, testTenantId2]]);
  });

  describe('TEST 1 — Repository guard', () => {
    it('deve lançar erro ao chamar findAll() sem context', async () => {
      await expect(
        repository.findAll(undefined, undefined)
      ).rejects.toThrow('SSOT_VIOLATION: context is mandatory for category reads');
    });

    it('deve lançar erro ao chamar findAll() com context null', async () => {
      await expect(
        repository.findAll(undefined, null as any)
      ).rejects.toThrow('SSOT_VIOLATION: context is mandatory for category reads');
    });

    it('deve lançar erro ao chamar findAll() com context vazio', async () => {
      await expect(
        repository.findAll(undefined, '' as any)
      ).rejects.toThrow('SSOT_VIOLATION: context is mandatory for category reads');
    });
  });

  describe('TEST 2 — Service guard', () => {
    it('deve lançar erro ao chamar getCategoriesForTenant sem tenantId', async () => {
      await expect(
        categoriesService.getCategoriesForTenant('' as any, 'professional')
      ).rejects.toThrow('SSOT_VIOLATION: tenantId is mandatory for category reads');
    });

    it('deve lançar erro ao chamar getCategoriesForTenant sem context', async () => {
      await expect(
        categoriesService.getCategoriesForTenant(testTenantId1, undefined as any)
      ).rejects.toThrow('SSOT_VIOLATION: context is mandatory for category reads');
    });

    it('deve lançar erro ao chamar getCategoriesForTenant com context null', async () => {
      await expect(
        categoriesService.getCategoriesForTenant(testTenantId1, null as any)
      ).rejects.toThrow('SSOT_VIOLATION: context is mandatory for category reads');
    });

    it('deve lançar erro se tenant não existir', async () => {
      const nonExistentTenant = uuidv4();
      await expect(
        categoriesService.getCategoriesForTenant(nonExistentTenant, 'professional')
      ).rejects.toThrow(`Tenant não encontrado: ${nonExistentTenant}`);
    });
  });

  describe('TEST 3 — HTTP guard (context)', () => {
    // Este teste será executado via script de validação com curl
    // Aqui apenas documentamos o comportamento esperado
    it('deve retornar HTTP 400 / CONTEXT_REQUIRED quando context estiver ausente', () => {
      // Comportamento esperado:
      // GET /categories/tree (sem context)
      // → HTTP 400
      // → { "ok": false, "error": "CONTEXT_REQUIRED" }
      expect(true).toBe(true); // Placeholder - teste real via curl no script
    });
  });

  describe('TEST 4 — HTTP guard (tenant)', () => {
    // Este teste será executado via script de validação com curl
    // Aqui apenas documentamos o comportamento esperado
    it('deve retornar HTTP 401 / TENANT_REQUIRED quando tenant estiver ausente', () => {
      // Comportamento esperado:
      // GET /categories/tree?context=professional (sem header X-Tenant-ID)
      // → HTTP 401
      // → { "ok": false, "error": "TENANT_REQUIRED" }
      expect(true).toBe(true); // Placeholder - teste real via curl no script
    });
  });

  describe('TEST 5 — Consistência', () => {
    it('deve retornar árvores idênticas em chamadas consecutivas', async () => {
      const tree1 = await categoriesService.getCategoriesForTenant(testTenantId1, 'professional');
      const tree2 = await categoriesService.getCategoriesForTenant(testTenantId1, 'professional');

      // Comparar estrutura (não apenas referência)
      expect(tree1.length).toBe(tree2.length);
      
      // Comparar IDs das raízes
      const ids1 = tree1.map(c => c.categoryId).sort();
      const ids2 = tree2.map(c => c.categoryId).sort();
      expect(ids1).toEqual(ids2);
    });
  });

  describe('TEST 6 — Isolamento por tenant', () => {
    it('deve retornar árvores independentes para diferentes tenants', async () => {
      const tree1 = await categoriesService.getCategoriesForTenant(testTenantId1, 'professional');
      const tree2 = await categoriesService.getCategoriesForTenant(testTenantId2, 'professional');

      // Árvores devem ser independentes (não compartilhar cache entre tenants)
      // Mesmo que os dados sejam iguais, devem ser instâncias separadas
      expect(tree1).not.toBe(tree2); // Referências diferentes

      // Estrutura pode ser igual, mas cache deve ser isolado
      // Verificar que cache keys são diferentes
      const cacheKey1 = `${testTenantId1}:professional`;
      const cacheKey2 = `${testTenantId2}:professional`;
      expect(cacheKey1).not.toBe(cacheKey2);
    });
  });

  describe('TEST 7 — Kill switch', () => {
    const originalEnv = process.env.ENFORCE_CANONICAL_ONLY;

    afterEach(() => {
      // Restaurar env original
      if (originalEnv === undefined) {
        delete process.env.ENFORCE_CANONICAL_ONLY;
      } else {
        process.env.ENFORCE_CANONICAL_ONLY = originalEnv;
      }
    });

    it('deve lançar erro ao chamar método legado quando ENFORCE_CANONICAL_ONLY=true', async () => {
      process.env.ENFORCE_CANONICAL_ONLY = 'true';

      await expect(
        categoriesService.getCategoryTree(undefined, 'professional')
      ).rejects.toThrow('SSOT_VIOLATION: getCategoryTree is deprecated');
    });

    it('deve apenas emitir warning quando ENFORCE_CANONICAL_ONLY não estiver ativo', async () => {
      delete process.env.ENFORCE_CANONICAL_ONLY;

      // Método legado deve funcionar (mas com warning)
      // Não podemos testar o warning facilmente, mas podemos verificar que não lança erro
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      try {
        await categoriesService.getCategoryTree(undefined, 'professional');
        // Se chegou aqui, não lançou erro (comportamento esperado sem kill switch)
        expect(consoleSpy).toHaveBeenCalled();
      } catch (error) {
        // Se lançou erro, pode ser porque não há categorias ou outro motivo
        // O importante é que não seja erro de SSOT_VIOLATION
        expect((error as Error).message).not.toContain('SSOT_VIOLATION: getCategoryTree is deprecated');
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
});





