// backend/src/core/tenants/__tests__/tenant-context-permissions.test.ts
// Testes institucionais para permissões por (tenant, context)
// Garante isolamento soberano e enforcement de permissões

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { categoriesService } from '@core/categories/categories.service';
import { SYSTEM_TENANT, ensureSystemTenant } from '@core/tenants/system-tenant';
import { tenantContextPermissionService } from '../tenant-context-permission.service';
import type { CategoryContext } from '@unificard/contracts';

describe('Tenant Context Permissions — Isolamento Soberano', () => {
  let governmentTenantId: string;
  let companyTenantId: string;
  let personTenantId: string;

  beforeAll(async () => {
    // Garantir que system-tenant existe
    await ensureSystemTenant();

    // Garantir que system-tenant tem read em todos os contexts
    const contexts: CategoryContext[] = [
      'professional',
      'interest',
      'learning',
      'health',
      'education',
      'company',
      'economy',
      'person',
      'government',
      'infrastructure',
    ];

    for (const context of contexts) {
      await pool.query(
        `INSERT INTO tenant_contexts (tenant_id, context, permission, created_at)
         VALUES ($1, $2, 'read', NOW())
         ON CONFLICT (tenant_id, context) DO NOTHING`,
        [SYSTEM_TENANT.tenantId, context]
      );
    }

    // Criar tenants de teste
    governmentTenantId = uuidv4();
    companyTenantId = uuidv4();
    personTenantId = uuidv4();

    // Criar tenants no banco
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug, created_at, updated_at)
       VALUES ($1, 'Government Tenant', 'government-test', NOW(), NOW()),
              ($2, 'Company Tenant', 'company-test', NOW(), NOW()),
              ($3, 'Person Tenant', 'person-test', NOW(), NOW())
       ON CONFLICT (tenant_id) DO NOTHING`,
      [governmentTenantId, companyTenantId, personTenantId]
    );

    // Configurar permissões do government tenant
    // admin em government, infrastructure
    // read em professional, company
    await pool.query(
      `INSERT INTO tenant_contexts (tenant_id, context, permission, created_at)
       VALUES ($1, 'government', 'admin', NOW()),
              ($1, 'infrastructure', 'admin', NOW()),
              ($1, 'professional', 'read', NOW()),
              ($1, 'company', 'read', NOW())
       ON CONFLICT (tenant_id, context) DO UPDATE SET permission = EXCLUDED.permission`,
      [governmentTenantId]
    );

    // Configurar permissões do company tenant
    // write em company
    // read em professional
    await pool.query(
      `INSERT INTO tenant_contexts (tenant_id, context, permission, created_at)
       VALUES ($1, 'company', 'write', NOW()),
              ($1, 'professional', 'read', NOW())
       ON CONFLICT (tenant_id, context) DO UPDATE SET permission = EXCLUDED.permission`,
      [companyTenantId]
    );

    // Configurar permissões do person tenant
    // write em person
    // read em professional
    await pool.query(
      `INSERT INTO tenant_contexts (tenant_id, context, permission, created_at)
       VALUES ($1, 'person', 'write', NOW()),
              ($1, 'professional', 'read', NOW())
       ON CONFLICT (tenant_id, context) DO UPDATE SET permission = EXCLUDED.permission`,
      [personTenantId]
    );
  });

  afterAll(async () => {
    // Limpar permissões de teste
    await pool.query('DELETE FROM tenant_contexts WHERE tenant_id = ANY($1)', [
      [governmentTenantId, companyTenantId, personTenantId]
    ]);
    
    // Limpar tenants de teste
    await pool.query('DELETE FROM tenants WHERE tenant_id = ANY($1)', [
      [governmentTenantId, companyTenantId, personTenantId]
    ]);
  });

  describe('TEST 1 — Governo pode ler professional', () => {
    it('deve permitir acesso de leitura para government tenant em professional', async () => {
      // Government tem read em professional
      const hasAccess = await tenantContextPermissionService.hasReadAccess(
        governmentTenantId,
        'professional'
      );
      expect(hasAccess).toBe(true);

      // Deve conseguir ler categorias via CategoriesService
      const tree = await categoriesService.getCategoriesForTenant(
        governmentTenantId,
        'professional'
      );
      expect(Array.isArray(tree)).toBe(true);
    });
  });

  describe('TEST 2 — Governo NÃO pode escrever professional', () => {
    it('deve negar acesso de escrita para government tenant em professional', async () => {
      // Government tem apenas read em professional, não write
      const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
        governmentTenantId,
        'professional'
      );
      expect(hasWriteAccess).toBe(false);

      // Tentar ler deve funcionar (tem read)
      await expect(
        categoriesService.getCategoriesForTenant(governmentTenantId, 'professional')
      ).resolves.toBeDefined();

      // Mas não deve ter write access
      expect(hasWriteAccess).toBe(false);
    });
  });

  describe('TEST 3 — Mercado NÃO pode escrever government', () => {
    it('deve negar acesso de escrita para company tenant em government', async () => {
      // Company não tem permissão em government
      const hasReadAccess = await tenantContextPermissionService.hasReadAccess(
        companyTenantId,
        'government'
      );
      expect(hasReadAccess).toBe(false);

      const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
        companyTenantId,
        'government'
      );
      expect(hasWriteAccess).toBe(false);

      // Deve lançar CONTEXT_ACCESS_DENIED ao tentar ler
      await expect(
        categoriesService.getCategoriesForTenant(companyTenantId, 'government')
      ).rejects.toThrow('CONTEXT_ACCESS_DENIED');
    });
  });

  describe('TEST 4 — Mercado pode escrever company', () => {
    it('deve permitir acesso de escrita para company tenant em company', async () => {
      // Company tem write em company
      const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
        companyTenantId,
        'company'
      );
      expect(hasWriteAccess).toBe(true);

      // Deve conseguir ler categorias via CategoriesService
      const tree = await categoriesService.getCategoriesForTenant(
        companyTenantId,
        'company'
      );
      expect(Array.isArray(tree)).toBe(true);
    });
  });

  describe('TEST 5 — Pessoa física não escreve government', () => {
    it('deve negar acesso de escrita para person tenant em government', async () => {
      // Person não tem permissão em government
      const hasReadAccess = await tenantContextPermissionService.hasReadAccess(
        personTenantId,
        'government'
      );
      expect(hasReadAccess).toBe(false);

      const hasWriteAccess = await tenantContextPermissionService.hasWriteAccess(
        personTenantId,
        'government'
      );
      expect(hasWriteAccess).toBe(false);

      // Deve lançar CONTEXT_ACCESS_DENIED ao tentar ler
      await expect(
        categoriesService.getCategoriesForTenant(personTenantId, 'government')
      ).rejects.toThrow('CONTEXT_ACCESS_DENIED');
    });
  });

  describe('TEST 6 — System-tenant lê tudo', () => {
    it('deve permitir acesso de leitura para system-tenant em todos os contexts', async () => {
      // System-tenant deve ter read em todos os contexts
      const contexts: CategoryContext[] = [
        'professional',
        'interest',
        'learning',
        'health',
        'education',
        'company',
        'economy',
        'person',
        'government',
        'infrastructure',
      ];

      for (const context of contexts) {
        const hasReadAccess = await tenantContextPermissionService.hasReadAccess(
          SYSTEM_TENANT.tenantId,
          context
        );
        expect(hasReadAccess).toBe(true);

        // Deve conseguir ler categorias via CategoriesService
        const tree = await categoriesService.getCategoriesForTenant(
          SYSTEM_TENANT.tenantId,
          context
        );
        expect(Array.isArray(tree)).toBe(true);
      }
    });
  });

  describe('TEST 7 — Isolamento entre tenants', () => {
    it('deve garantir que tenants não compartilham permissões', async () => {
      // Government tem read em professional
      const govHasAccess = await tenantContextPermissionService.hasReadAccess(
        governmentTenantId,
        'professional'
      );
      expect(govHasAccess).toBe(true);

      // Company também tem read em professional
      const companyHasAccess = await tenantContextPermissionService.hasReadAccess(
        companyTenantId,
        'professional'
      );
      expect(companyHasAccess).toBe(true);

      // Mas company NÃO tem acesso a government
      const companyHasGovAccess = await tenantContextPermissionService.hasReadAccess(
        companyTenantId,
        'government'
      );
      expect(companyHasGovAccess).toBe(false);

      // E government tem admin em government
      const govHasAdminAccess = await tenantContextPermissionService.hasAdminAccess(
        governmentTenantId,
        'government'
      );
      expect(govHasAdminAccess).toBe(true);
    });
  });
});

