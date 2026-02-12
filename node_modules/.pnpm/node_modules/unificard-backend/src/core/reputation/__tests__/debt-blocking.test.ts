// src/core/reputation/__tests__/debt-blocking.test.ts
// Testes para bloqueio por débito pendente
// CONTRATO v1.4/Fase10: Débito pendente bloqueia ações críticas

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { penaltyService } from '../penalty.service';
import { runQueryWithTenant } from '@core/database/pool';

describe('Debt Blocking (CONTRATO v1.4)', () => {
  const testTenantId = uuidv4();
  let testActorId: string;
  let testEventId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant Debt', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar actor de teste
    testActorId = uuidv4();
    await pool.query(
      `INSERT INTO actor_scores (tenant_id, actor_id, actor_type, current_score)
       VALUES ($1, $2, 'user', 80)
       ON CONFLICT (tenant_id, actor_id, actor_type) DO NOTHING`,
      [testTenantId, testActorId, 'user']
    );

    // Criar evento de teste
    testEventId = uuidv4();
    await pool.query(
      `INSERT INTO events (id, tenant_id, actor_id, actor_type, event_type, title, datetime_start, datetime_end, status)
       VALUES ($1, $2, $3, 'user', 'cultural', 'Test Event', now() + INTERVAL '1 day', now() + INTERVAL '2 days', 'draft')
       ON CONFLICT (id) DO NOTHING`,
      [testEventId, testTenantId, testActorId]
    );
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query(`DELETE FROM actor_debts WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM actor_scores WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM events WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
  });

  it('deve permitir ação quando não há débito pendente', async () => {
    const result = await penaltyService.canPerformAction(
      testTenantId,
      testActorId,
      'user',
      'CREATE_EVENT'
    );

    expect(result.allowed).toBe(true);
  });

  it('deve bloquear CREATE_EVENT quando há débito pendente', async () => {
    // Criar débito pendente
    await runQueryWithTenant(
      testTenantId,
      `INSERT INTO actor_debts (
        tenant_id, event_id, debtor_actor_id, debtor_actor_type,
        creditor_actor_id, creditor_actor_type, amount_cents, reason, status,
        guarantor_actor_id, guarantor_actor_type, dueAt
      )
      VALUES ($1, $2, $3, 'user', $3, 'user', 5000, 'CANCELLATION', 'pending', $3, 'user', now() + INTERVAL '7 days')`,
      [testTenantId, testEventId, testActorId]
    );

    const result = await penaltyService.canPerformAction(
      testTenantId,
      testActorId,
      'user',
      'CREATE_EVENT'
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('débito pendente');
    expect(result.reason).toContain('R$50.00');

    // Limpar débito
    await runQueryWithTenant(
      testTenantId,
      `DELETE FROM actor_debts WHERE tenant_id = $1 AND debtor_actor_id = $2`,
      [testTenantId, testActorId]
    );
  });

  it('deve bloquear PURCHASE quando há débito pendente', async () => {
    // Criar débito pendente
    await runQueryWithTenant(
      testTenantId,
      `INSERT INTO actor_debts (
        tenant_id, event_id, debtor_actor_id, debtor_actor_type,
        creditor_actor_id, creditor_actor_type, amount_cents, reason, status,
        guarantor_actor_id, guarantor_actor_type, dueAt
      )
      VALUES ($1, $2, $3, 'user', $3, 'user', 10000, 'NO_SHOW', 'pending', $3, 'user', now() + INTERVAL '7 days')`,
      [testTenantId, testEventId, testActorId]
    );

    const result = await penaltyService.canPerformAction(
      testTenantId,
      testActorId,
      'user',
      'PURCHASE'
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('débito pendente');
    expect(result.reason).toContain('R$100.00');

    // Limpar débito
    await runQueryWithTenant(
      testTenantId,
      `DELETE FROM actor_debts WHERE tenant_id = $1 AND debtor_actor_id = $2`,
      [testTenantId, testActorId]
    );
  });

  it('deve permitir ação quando débito está PAID', async () => {
    // Criar débito pago
    await runQueryWithTenant(
      testTenantId,
      `INSERT INTO actor_debts (
        tenant_id, event_id, debtor_actor_id, debtor_actor_type,
        creditor_actor_id, creditor_actor_type, amount_cents, reason, status,
        guarantor_actor_id, guarantor_actor_type, dueAt, paidAt
      )
      VALUES ($1, $2, $3, 'user', $3, 'user', 5000, 'CANCELLATION', 'PAID', $3, 'user', now() - INTERVAL '1 day', now())
      ON CONFLICT DO NOTHING`,
      [testTenantId, testEventId, testActorId]
    );

    const result = await penaltyService.canPerformAction(
      testTenantId,
      testActorId,
      'user',
      'CREATE_EVENT'
    );

    expect(result.allowed).toBe(true);

    // Limpar débito
    await runQueryWithTenant(
      testTenantId,
      `DELETE FROM actor_debts WHERE tenant_id = $1 AND debtor_actor_id = $2`,
      [testTenantId, testActorId]
    );
  });

  it('deve bloquear actor sem score quando há débito pendente (CORREÇÃO: bypass corrigido)', async () => {
    // Criar actor sem score (novo actor)
    const newActorId = uuidv4();
    
    // Criar débito pendente para o novo actor
    await runQueryWithTenant(
      testTenantId,
      `INSERT INTO actor_debts (
        tenant_id, event_id, debtor_actor_id, debtor_actor_type,
        creditor_actor_id, creditor_actor_type, amount_cents, reason, status,
        guarantor_actor_id, guarantor_actor_type, dueAt
      )
      VALUES ($1, $2, $3, 'user', $3, 'user', 3000, 'CANCELLATION', 'PENDING', $3, 'user', now() + INTERVAL '7 days')`,
      [testTenantId, testEventId, newActorId]
    );

    // CORREÇÃO: Actor sem score mas com débito deve ser bloqueado
    const result = await penaltyService.canPerformAction(
      testTenantId,
      newActorId,
      'user',
      'CREATE_EVENT'
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('débito pendente');
    expect(result.reason).toContain('R$30.00');

    // Limpar débito
    await runQueryWithTenant(
      testTenantId,
      `DELETE FROM actor_debts WHERE tenant_id = $1 AND debtor_actor_id = $2`,
      [testTenantId, newActorId]
    );
  });
});


