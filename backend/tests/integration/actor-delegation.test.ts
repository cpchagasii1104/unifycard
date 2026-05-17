// backend/tests/integration/actor-delegation.test.ts
// CONTINUOUS PRODUCTION: Testes de delegação institucional
// Prova invariantes: PF sem delegação não publica como empresa, revogação bloqueia, etc.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { pool } from '../../src/core/database/pool';
import { actorRepository } from '../../src/modules/social/actor.repository';
import { actorRegistryService } from '../../src/core/actor-registry/actor-registry.service';
import { actorDelegationRepository } from '../../src/core/actor-delegation/actor-delegation.repository';
import { authorizationService } from '../../src/core/authorization/authorization.service';
import { companyMembersService } from '../../src/core/companies/company-members.service';
import { runQueryWithTenant } from '../../src/core/database/pool';
import { v4 as uuidv4 } from 'uuid';

describe('Actor Delegation - Continuous Production', () => {
  let testTenantId: string;
  let testUserId1: string; // PF sem delegação
  let testUserId2: string; // PF com delegação
  let testCompanyId: string;
  let testCompanyActorId: string;
  let testUser1ActorId: string;
  let testUser2ActorId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    const tenantResult = await pool.query(
      `INSERT INTO tenants (tenant_id, name, slug) 
       VALUES (gen_random_uuid(), 'Test Delegation', 'test-delegation')
       RETURNING tenant_id`
    );
    testTenantId = tenantResult.rows[0].tenant_id;

    // Criar usuários de teste
    const user1Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'user1@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId1 = user1Result.rows[0].user_id;

    const user2Result = await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, password_hash)
       VALUES (gen_random_uuid(), $1, 'user2@test.com', 'hash')
       RETURNING user_id`,
      [testTenantId]
    );
    testUserId2 = user2Result.rows[0].user_id;

    // Criar empresa de teste
    const companyResult = await pool.query(
      `INSERT INTO companies (company_id, tenant_id, company_name, status)
       VALUES (gen_random_uuid(), $1, 'Test Company', 'APPROVED')
       RETURNING company_id`,
      [testTenantId]
    );
    testCompanyId = companyResult.rows[0].company_id;

    // Criar actors
    testUser1ActorId = (await actorRepository.findOrCreateUserActor(testTenantId, testUserId1)).actor_id;
    testUser2ActorId = (await actorRepository.findOrCreateUserActor(testTenantId, testUserId2)).actor_id;
    testCompanyActorId = (
      await actorRepository.findOrCreatePageActor(
        testTenantId,
        testCompanyId,
        testUser1ActorId
      )
    ).actor_id;

    // Registrar company no Actor Registry
    await actorRegistryService.register(
      testTenantId,
      testCompanyActorId,
      'company',
      'companies',
      testCompanyId,
      {
        can_receive_funds: true,
        can_publish_feed: true,
        can_delegate: true,
      }
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query('DELETE FROM actor_delegations WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM actor_registry WHERE tenant_id = $1', [testTenantId]);
    // DECISION-0042: cleanup de membership agora aponta para company_users (SSOT unico).
    await pool.query('DELETE FROM company_users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM actors WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM companies WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM tenants WHERE tenant_id = $1', [testTenantId]);
  });

  describe('1. PF sem delegação não publica como empresa', () => {
    it('should deny permission when user has no delegation', async () => {
      const result = await authorizationService.canActAs(
        testTenantId,
        testUserId1,
        testCompanyActorId,
        'publish_feed'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('2. PF com delegação + permissão publica', () => {
    it('should allow permission when user has active delegation with scope', async () => {
      // Criar delegação
      await actorDelegationRepository.create(testTenantId, {
        userActorId: testUser2ActorId,
        institutionalActorId: testCompanyActorId,
        scopes: ['publish_feed'],
        isTransitive: false,
      });

      const result = await authorizationService.canActAs(
        testTenantId,
        testUserId2,
        testCompanyActorId,
        'publish_feed'
      );

      expect(result.allowed).toBe(true);
      expect(result.authoritySource).toBe('delegation');
    });
  });

  describe('3. Revogou -> bloqueia na hora', () => {
    it('should deny permission immediately after revocation', async () => {
      // Criar delegação
      const delegation = await actorDelegationRepository.create(testTenantId, {
        userActorId: testUser2ActorId,
        institutionalActorId: testCompanyActorId,
        scopes: ['publish_feed'],
        isTransitive: false,
      });

      // Verificar que tem permissão
      let result = await authorizationService.canActAs(
        testTenantId,
        testUserId2,
        testCompanyActorId,
        'publish_feed'
      );
      expect(result.allowed).toBe(true);

      // Revogar delegação
      await actorDelegationRepository.revoke(testTenantId, delegation.delegationId);

      // Verificar que permissão foi negada imediatamente
      result = await authorizationService.canActAs(
        testTenantId,
        testUserId2,
        testCompanyActorId,
        'publish_feed'
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('4. Capability gate: actor sem can_publish_feed não publica', () => {
    it('should deny even with delegation if actor lacks capability', async () => {
      // Criar actor sem capability can_publish_feed
      const limitedActorId = (
        await actorRepository.findOrCreatePageActor(
          testTenantId,
          testCompanyId,
          testUser1ActorId
        )
      ).actor_id;
      
      await actorRegistryService.register(
        testTenantId,
        limitedActorId,
        'company',
        'companies',
        testCompanyId,
        {
          can_receive_funds: true,
          can_publish_feed: false, // SEM capability
          can_delegate: false,
        }
      );

      // Criar delegação
      await actorDelegationRepository.create(testTenantId, {
        userActorId: testUser2ActorId,
        institutionalActorId: limitedActorId,
        scopes: ['publish_feed'],
        isTransitive: false,
      });

      // Verificar que mesmo com delegação, não pode publicar (falta capability)
      const result = await authorizationService.canActAs(
        testTenantId,
        testUserId2,
        limitedActorId,
        'publish_feed'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('capability');
    });
  });

  describe('5. Não-transitividade: A->B não permite B->C atuar por A', () => {
    it('should not allow transitive delegation by default', async () => {
      // Criar segundo company e actor
      const company2Result = await pool.query(
        `INSERT INTO companies (company_id, tenant_id, company_name, status)
         VALUES (gen_random_uuid(), $1, 'Test Company 2', 'APPROVED')
         RETURNING company_id`,
        [testTenantId]
      );
      const testCompany2Id = company2Result.rows[0].company_id;
      const testCompany2ActorId = (
        await actorRepository.findOrCreatePageActor(
          testTenantId,
          testCompany2Id,
          testUser1ActorId
        )
      ).actor_id;

      await actorRegistryService.register(
        testTenantId,
        testCompany2ActorId,
        'company',
        'companies',
        testCompany2Id
      );

      // Criar delegação A->B (user2 -> company1) com is_transitive=false
      await actorDelegationRepository.create(testTenantId, {
        userActorId: testUser2ActorId,
        institutionalActorId: testCompanyActorId,
        scopes: ['*'],
        isTransitive: false, // NÃO transitiva
      });

      // Criar delegação B->C (company1 -> company2) - user2 tentando atuar por company1
      // Isso NÃO deve funcionar porque is_transitive=false
      // Na prática, user2 não pode criar delegação em nome de company1 sem ser owner

      // Verificar que user2 NÃO pode atuar como company2 através de company1
      const result = await authorizationService.canActAs(
        testTenantId,
        testUserId2,
        testCompany2ActorId,
        'publish_feed'
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('6. Audit fields: created_by_user_id e created_as_actor_id presentes', () => {
    it('should include audit fields in post metadata', async () => {
      // Simular criação de post com action context
      const { SocialRepository } = await import('../../src/modules/social/social.repository');
      const socialRepository = new SocialRepository();

      const post = await socialRepository.create({
        tenantId: testTenantId,
        globalUserId: testUserId1,
        content: 'Test post',
        media: [],
        intent: 'personal',
        confidence: null,
        categories: [],
        suggestedActions: [],
        metadata: {},
        createdByUserId: testUserId1,
        createdAsActorId: testUser1ActorId,
      });

      // Verificar que metadata contém campos de audit
      const postWithMetadata = await runQueryWithTenant<{ metadata: any }>(
        testTenantId,
        `SELECT metadata FROM posts WHERE post_id = $1`,
        [post.post_id]
      );

      expect(postWithMetadata[0].metadata.created_by_user_id).toBe(testUserId1);
      expect(postWithMetadata[0].metadata.created_as_actor_id).toBe(testUser1ActorId);
    });
  });

  describe('7. Company member creates delegation automatically', () => {
    it('should create delegation when member is activated', async () => {
      // Criar membro ativo
      const member = await companyMembersService.createMember(
        testTenantId,
        testUserId1,
        {
          companyId: testCompanyId,
          actorId: testUser1ActorId,
          role: 'staff' as any,
          status: 'active' as any,
        }
      );

      // Verificar que delegação foi criada
      const delegations = await actorDelegationRepository.findActiveByUserActor(
        testTenantId,
        testUser1ActorId
      );

      const companyDelegation = delegations.find(
        (d) => d.institutionalActorId === testCompanyActorId
      );

      expect(companyDelegation).toBeDefined();
      expect(companyDelegation?.scopes).toContain('publish_feed');
    });
  });
});







