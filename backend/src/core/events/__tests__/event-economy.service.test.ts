// src/core/events/__tests__/event-economy.service.test.ts
// Testes unitários para EventEconomyService
// FASE 8: HARDENING

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { eventService } from '../event.service';
import { eventEconomyService } from '../event-economy.service';
import { accountService } from '../../economy/account.service';
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
      testUserId
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
      actorId: testActorId,
      actorType: 'user',
      eventType: 'cultural',
      title: 'Test Free Event',
      datetimeStart: new Date(Date.now() + 86400000).toISOString(),
      datetimeEnd: new Date(Date.now() + 90000000).toISOString(),
      visibility: 'public',
      ticketPriceCents: null,
    };
    const freeEvent = await eventService.createEvent(testTenantId, freeInput);
    freeEventId = freeEvent.id;

    // Criar evento pago
    const paidInput: CreateEventInput = {
      actorId: testActorId,
      actorType: 'user',
      eventType: 'cultural',
      title: 'Test Paid Event',
      datetimeStart: new Date(Date.now() + 86400000).toISOString(),
      datetimeEnd: new Date(Date.now() + 90000000).toISOString(),
      visibility: 'public',
      ticketPriceCents: 5000, // R$ 50,00
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

  describe('validateEventEconomy (descontinuado — método removido)', () => {
    it.skip('deve validar evento gratuito como válido', async () => {
      const event = await eventService.getEvent(testTenantId, freeEventId);
      expect(event?.ticketPriceCents ?? 0).toBe(0);
    });

    it.skip('deve validar evento pago com conta válida', async () => {
      const event = await eventService.getEvent(testTenantId, paidEventId);
      expect(event?.ticketPriceCents).toBe(5000);
    });

    it.skip('deve invalidar evento pago sem conta do organizador', async () => {
      const actorWithoutAccount = uuidv4();
      await pool.query(
        `INSERT INTO actors (actor_id, tenant_id, actor_type, user_id, display_name)
         VALUES ($1, $2, 'user', $3, 'Actor Without Account')
         ON CONFLICT (actor_id) DO NOTHING`,
        [actorWithoutAccount, testTenantId, testUserId]
      );

      const input: CreateEventInput = {
        actorId: actorWithoutAccount,
        actorType: 'user',
        eventType: 'cultural',
        title: 'Test Event No Account',
        datetimeStart: new Date(Date.now() + 86400000).toISOString(),
        datetimeEnd: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticketPriceCents: 5000,
      };
      const ev = await eventService.createEvent(testTenantId, input);
      expect(ev.id).toBeDefined();
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
      expect(result.totalAmountCents).toBe(5000);
      expect(result.splitResult.splits.length).toBeGreaterThan(0);
    });

    it('deve bloquear checkout de evento não publicado', async () => {
      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: paidEventId,
          attendeeActorId: testActorId,
          quantity: 1,
        })
      ).rejects.toThrow('não aceita compras');
    });

    it('deve bloquear checkout de evento gratuito', async () => {
      await eventService.publishEvent(testTenantId, freeEventId, testActorId);

      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: freeEventId,
          attendeeActorId: testActorId,
          quantity: 1,
        })
      ).rejects.toThrow('gratuito');
    });

    it('deve bloquear checkout se capacidade excedida', async () => {
      const input: CreateEventInput = {
        actorId: testActorId,
        actorType: 'user',
        eventType: 'cultural',
        title: 'Test Event Capacity',
        datetimeStart: new Date(Date.now() + 86400000).toISOString(),
        datetimeEnd: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticketPriceCents: 5000,
        maxAttendees: 1,
      };
      const event = await eventService.createEvent(testTenantId, input);
      await eventService.publishEvent(testTenantId, event.id, testActorId);

      await eventEconomyService.processCheckout(testTenantId, {
        eventId: event.id,
        attendeeActorId: testActorId,
        quantity: 1,
      });

      await expect(
        eventEconomyService.processCheckout(testTenantId, {
          eventId: event.id,
          attendeeActorId: testActorId,
          quantity: 1,
        })
      ).rejects.toThrow('Capacidade máxima');
    });
  });
});











