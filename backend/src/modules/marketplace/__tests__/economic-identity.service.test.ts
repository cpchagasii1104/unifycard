// backend/src/modules/marketplace/__tests__/economic-identity.service.test.ts
// FASE 1 — Economic Identity Service Tests (safety net + institutional validation)

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { economicIdentityService } from '../economic-identity.service';
import { socialPortsRegistry } from '@core/social/ports-registry';

describe('EconomicIdentityService — Institutional Invariants', () => {
  const testTenantId = uuidv4();
  let testActorId: string;
  let testUserId: string;
  let testGlobalUserId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (id, name, slug, city_id)
       VALUES ($1, 'Test Tenant EconomicIdentity', 'test-economic-' || $1, NULL)
       ON CONFLICT (id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuário de teste
    testUserId = uuidv4();
    testGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User EconomicID', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'test-economic@test.com', $3, now())
       ON CONFLICT (user_id) DO NOTHING`,
      [testUserId, testTenantId, testGlobalUserId]
    );

    // Criar actor via writer canônico
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findOrCreateUserActor(testTenantId, testUserId);
    testActorId = actor.actor_id;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM economic_identity_events WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM economic_identities WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM actors WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM users WHERE tenant_id = $1', [testTenantId]);
    await pool.query('DELETE FROM global_users WHERE global_user_id = $1', [testGlobalUserId]);
    await pool.query('DELETE FROM tenants WHERE id = $1', [testTenantId]);
  });

  // ============================================================
  // TESTE 1: Trust Score é event-sourced (não manual)
  // Fundamento: EconomicIdentity.contract.ts linha 11
  // "Trust Level é derivado de fatos objetivos, nunca manual."
  // ============================================================
  describe('Trust Score Calculation', () => {
    it('DEVE calcular trust_score_bps a partir de eventos (event-sourced)', async () => {
      // Criar economic_identity
      const identity = await economicIdentityService.createEconomicIdentity(testTenantId, {
        actorId: testActorId,
        actorType: 'user',
      });

      expect(identity.trustLevel).toBe('L0'); // inicial = 0 bps → L0

      // Adicionar eventos
      await economicIdentityService.recordEconomicEvent(testTenantId, testActorId, {
        eventType: 'order_completed',
        valueDelta: 500,
        metadata: { order_id: 'test-order-1' },
      });

      await economicIdentityService.recordEconomicEvent(testTenantId, testActorId, {
        eventType: 'service_delivered',
        valueDelta: 300,
        metadata: { service_id: 'test-service-1' },
      });

      await economicIdentityService.recordEconomicEvent(testTenantId, testActorId, {
        eventType: 'payment_on_time',
        valueDelta: 200,
        metadata: { payment_id: 'test-payment-1' },
      });

      // Recalcular trust score
      const result = await economicIdentityService.recalculateTrustScore(testTenantId, testActorId);

      // Verificar que soma de eventos = trust_score_bps
      // 500 + 300 + 200 = 1000 bps → L1 (>= 1667 = L2)
      expect(result?.trustLevel).toBe('L1');
    });

    it('DEVE limitar trust_score_bps a [0, 10000]', async () => {
      // Limpar eventos anteriores
      await pool.query('DELETE FROM economic_identity_events WHERE tenant_id = $1 AND actor_id = $2', [testTenantId, testActorId]);

      // Evento massivo (> 10000)
      await economicIdentityService.recordEconomicEvent(testTenantId, testActorId, {
        eventType: 'massive_event',
        valueDelta: 15000, // excede 10000
      });

      const result = await economicIdentityService.recalculateTrustScore(testTenantId, testActorId);

      // Deve clamp a 10000 → L5
      expect(result?.trustLevel).toBe('L5');
    });
  });

  // ============================================================
  // TESTE 2: LEGACY — Comportamento ATUAL (verifiedAssets = false, limits = 0)
  // ⚠️ Documenta comportamento que será corrigido em FASE 2.3-2.4
  // ============================================================
  describe('LEGACY — Current Behavior (baseline antes de correção)', () => {
    it('LEGACY: verifiedAssets hardcoded false (ANTES de integração identities)', async () => {
      const result = await economicIdentityService.getEconomicIdentity(testTenantId, testActorId);

      // Comportamento ATUAL (será corrigido)
      expect(result?.verifiedAssets.documentsVerified).toBe(false);
      expect(result?.verifiedAssets.bankAccountVerified).toBe(false);
      expect(result?.verifiedAssets.companyVerified).toBe(false);
    });

    it('LEGACY: limits hardcoded 0 (ANTES de integração Bank)', async () => {
      const result = await economicIdentityService.getEconomicIdentity(testTenantId, testActorId);

      // Comportamento ATUAL (será corrigido)
      expect(result?.limits.maxInvoiceAmount).toBe(0);
      expect(result?.limits.maxMonthlyVolume).toBe(0);
    });
  });
});
