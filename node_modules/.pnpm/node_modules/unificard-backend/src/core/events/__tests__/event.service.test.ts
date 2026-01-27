// src/core/events/__tests__/event.service.test.ts
// Testes unitários para EventService
// FASE 8: HARDENING

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '@core/database/pool';
import { eventService } from '../event.service';
import { accountService } from '../../economy/accounts/account.service';
import { socialPortsRegistry } from '@core/social/ports-registry';
import type { CreateEventInput } from '../event.types';

describe('EventService', () => {
  const testTenantId = uuidv4();
  let testUserId: string;
  let testGlobalUserId: string;
  let testActorId: string;
  let testAccountId: string;

  beforeAll(async () => {
    // Criar tenant de teste
    await pool.query(
      `INSERT INTO tenants (tenant_id, name, city_id)
       VALUES ($1, 'Test Tenant Events', NULL)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [testTenantId]
    );

    // Criar usuário de teste
    testUserId = uuidv4();
    testGlobalUserId = uuidv4();

    await pool.query(
      `INSERT INTO global_users (global_user_id, full_name, created_at)
       VALUES ($1, 'Test User Events', now())
       ON CONFLICT (global_user_id) DO NOTHING`,
      [testGlobalUserId]
    );

    await pool.query(
      `INSERT INTO users (user_id, tenant_id, email, global_user_id, created_at)
       VALUES ($1, $2, 'test@events.com', $3, now())
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

  afterAll(async () => {
    // Limpar dados de teste
    await pool.query(`DELETE FROM events WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM event_attendees WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM actors WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM users WHERE tenant_id = $1`, [testTenantId]);
    await pool.query(`DELETE FROM global_users WHERE global_user_id = $1`, [testGlobalUserId]);
    await pool.query(`DELETE FROM tenants WHERE tenant_id = $1`, [testTenantId]);
  });

  describe('createEvent', () => {
    it('deve criar evento gratuito como draft', async () => {
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event Free',
        datetime_start: new Date(Date.now() + 86400000).toISOString(), // Amanhã
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticket_price_cents: null,
      };

      const event = await eventService.createEvent(testTenantId, input);

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.status).toBe('draft');
      expect(event.ticket_price_cents).toBeNull();
      expect(event.actor_id).toBe(testActorId);
    });

    it('deve criar evento pago como draft', async () => {
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event Paid',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
        ticket_price_cents: 5000, // R$ 50,00
      };

      const event = await eventService.createEvent(testTenantId, input);

      expect(event).toBeDefined();
      expect(event.status).toBe('draft');
      expect(event.ticket_price_cents).toBe(5000);
    });

    it('deve validar Actor × EventType', async () => {
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'page', // Page não pode criar 'social'
        event_type: 'social',
        title: 'Test Event Invalid',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
      };

      await expect(eventService.createEvent(testTenantId, input)).rejects.toThrow();
    });
  });

  describe('publishEvent', () => {
    let freeEventId: string;
    let paidEventId: string;

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
        ticket_price_cents: 5000,
      };
      const paidEvent = await eventService.createEvent(testTenantId, paidInput);
      paidEventId = paidEvent.id;
    });

    it('deve publicar evento gratuito sem validação econômica', async () => {
      const event = await eventService.publishEvent(testTenantId, freeEventId, testActorId);

      expect(event.status).toBe('published');
    });

    it('deve publicar evento pago com economia válida', async () => {
      // Evento pago com conta válida deve publicar
      const event = await eventService.publishEvent(testTenantId, paidEventId, testActorId);

      expect(event.status).toBe('published');
    });

    it('deve bloquear publicação se não for o criador', async () => {
      const otherActorId = uuidv4();
      
      await expect(
        eventService.publishEvent(testTenantId, freeEventId, otherActorId)
      ).rejects.toThrow('Apenas o criador do evento pode publicá-lo');
    });

    it('deve bloquear publicação se status não for draft', async () => {
      // Publicar primeiro
      await eventService.publishEvent(testTenantId, freeEventId, testActorId);

      // Tentar publicar novamente
      await expect(
        eventService.publishEvent(testTenantId, freeEventId, testActorId)
      ).rejects.toThrow();
    });
  });

  describe('cancelEvent', () => {
    it('deve cancelar evento publicado', async () => {
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event Cancel',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
      };

      const event = await eventService.createEvent(testTenantId, input);
      await eventService.publishEvent(testTenantId, event.id, testActorId);
      
      const cancelled = await eventService.cancelEvent(testTenantId, event.id, testActorId);

      expect(cancelled.status).toBe('cancelled');
    });

    it('deve bloquear cancelamento se não for o criador', async () => {
      const input: CreateEventInput = {
        actor_id: testActorId,
        actor_type: 'user',
        event_type: 'cultural',
        title: 'Test Event Cancel',
        datetime_start: new Date(Date.now() + 86400000).toISOString(),
        datetime_end: new Date(Date.now() + 90000000).toISOString(),
        visibility: 'public',
      };

      const event = await eventService.createEvent(testTenantId, input);
      const otherActorId = uuidv4();

      await expect(
        eventService.cancelEvent(testTenantId, event.id, otherActorId)
      ).rejects.toThrow('Apenas o criador do evento pode cancelá-lo');
    });
  });
});










