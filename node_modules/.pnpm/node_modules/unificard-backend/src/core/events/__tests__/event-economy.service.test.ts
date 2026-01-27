// src/core/events/__tests__/event-economy.service.test.ts
// Testes unitários para EventEconomyService
// FASE 8: HARDENING

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { eventService } from '../event.service';
import { eventEconomyService } from '../event-economy.service';
import { accountService } from '../../economy/accounts/account.service';
import { socialPortsRegistry } from '@core/social/ports-registry';
import type { CreateEventInput } from '../event.types';

describe('EventEconomyService', () => {
  const testTenantId = uuidv4();
  let testUserId: string;
  let testGlobalUserId: string;
  let testActorId: string;
  let testAccountId: string;
  let freeEventId: string;
  let paidEventId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant Economy', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuário de teste
    testUserId = uuidv4();
    testGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User Economy', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'test@economy.com', $3, now())
       ON CONFLICT (user_id) DO NOTHING`,
      [testUserId, testTenantId, testGlobalUserId]
    );

    // Criar actor
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findOrCreateUserActor(
      testTenantId,
      testUserId,
      testGlobalUserId
    );
    testActorId = actor.actor_id;

    // Criar conta
    const account = await accountService.getOrCreateUserPrimaryAccount(
      testTenantId,
      testUserId,
      'BRL'
    );
    testAccountId = account.accountId;
  });

  beforeEach(async () => {
    // Criar evento gratuito
    const freeInput: CreateEventInput = {
      actor_id: testActorId,
      actor_type: 'user',
      event_type: 'cultural',
      title: 'Test Free Event',
      datetime_start: new Date(Date.now() + 86400000).toISOString(),
      datetime_end: new Date(Date.now() + 90000000).toISOString(),
      visibility: 'public',
      ticket_price_cents: null,
    };
    const freeEvent = await eventService.createEvent(testTenantId, freeInput);
    freeEventId = freeEvent.id;

    // Criar evento pago
    const paidInput: CreateEventInput = {
      actor_id: testActorId,
      actor_type: 'user',
      event_type: 'cultural',
      title: 'Test Paid Event',
      datetime_start: new Date(Date.now() + 86400000).toISOString(),
      datetime_end: new Date(Date.now() + 90000000).toISOString(),
      visibility: 'public',
      ticket_price_cents: 5000, // R$ 50,00
    };
    const paidEvent = await eventService.createEvent(testTenantId, paidInput);
    paidEventId = paidEvent.id;
  });

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query(`DELETE FROM event_attendees WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM events WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM actors WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM global_users WHERE global_user_id = $1`, [testGlobalUserId]);
    await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
  });

  describe('validateEventEconomy', () => {
    it('deve validar evento gratuito como válido', async () => {
      const result = await eventEconomyService.validateEventEconomy(testTenantId, freeEventId);

      expect(result.isValid).toBe(true);
    });

    it('deve validar evento pago com conta válida', async () => {
      const result = await eventEconomyService.validateEventEconomy(testTenantId, paidEventId);

      expect(result.isValid).toBe(true);
    });

    it('deve invalidar evento pago sem conta do organizador', async () => {
      // Criar evento pago sem conta (usando actor sem conta)
      const actorWithoutAccount = uuidv4();
      await pool.query(
        `INSERT INTO actors (actor_id, tenant_id, actor_type, user_id, display_name)
         VALUES ($1, $2, 'user', $3, 'Actor Without Account')
         ON CONFLICT (actor_id) DO NOTHING`,
        [actorWithoutAccount, testTenantId, testUserId]
      );

      const input: CreateEventInput = {
        actor_id: actorWithoutAccount,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event No Account',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticket_price_cents: 5000,
      };
      const event = await eventService.createEvent(testTenantId, input);

      const result = await eventEconomyService.validateEventEconomy(testTenantId, event.id);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('conta');
    });
  });

  describe('processCheckout', () => {
    it('deve processar checkout feliz (evento pago publicado)', async () => {
      // Publicar evento primeiro
      await eventService.publishEvent(testTenantId, paidEventId, testActorId);

      const result = await eventEconomyService.processCheckout(testTenantId, {
        eventId: paidEventId,
        attendeeActorId: testActorId,
        quantity: 1,
      });

      expect(result).toBeDefined();
      expect(result.eventId).toBe(paidEventId);
      expect(result.attendeeId).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.totalAmount).toBe(5000);
      expect(result.splitResult.splits.length).toBeGreaterThan(0);
    });

    it('deve bloquear checkout de evento não publicado', async () => {
      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: paidEventId, // Ainda em draft
          attendeeActorId: testActorId,
        })
      ).rejects.toThrow('não aceita compras');
    });

    it('deve bloquear checkout de evento gratuito', async () => {
      await eventService.publishEvent(testTenantId, freeEventId, testActorId);

      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: freeEventId,
          attendeeActorId: testActorId,
        })
      ).rejects.toThrow('gratuito');
    });

    it('deve bloquear checkout se capacidade excedida', async () => {
      // Criar evento com capacidade limitada
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event Capacity',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticket_price_cents: 5000,
        max_attendees: 1,
      };
      const event = await eventService.createEvent(testTenantId, input);
      await eventService.publishEvent(testTenantId, event.id, testActorId);

      // Primeiro checkout (OK)
      await eventEconomyService.processCheckout(testTenantId, {
        eventId: event.id,
        attendeeActorId: testActorId,
      });

      // Segundo checkout (deve falhar)
      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: event.id,
          attendeeActorId: testActorId,
        })
      ).rejects.toThrow('Capacidade máxima');
    });
  });
});










