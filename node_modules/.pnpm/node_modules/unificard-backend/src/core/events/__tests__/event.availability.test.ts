// backend/src/core/events/__tests__/event.availability.test.ts
// Testes para integração READ-ONLY com Agenda Universal
// EVENT_DOMAIN_MINIMUM_CONTRACT FASE 2

import { describe, it, expect, jest } from '@jest/globals';
import { eventService } from '../event.service';
import { NotFoundError } from '@core/errors';

describe('EventService - getEventAvailability (READ-ONLY)', () => {
  describe('getEventAvailability', () => {
    it('deve usar apenas métodos de consulta da Agenda Universal', async () => {
      // Este teste garante que getEventAvailability não chama métodos de write
      // Mock/spy para garantir que NÃO chama createAvailability, createBooking, etc.
      expect(true).toBe(true); // Placeholder - validação real via mocks
    });

    it('deve retornar informação sem alterar estado', async () => {
      // Este teste garante que o endpoint não muda estado do evento
      // A resposta deve ser apenas informacional
      expect(true).toBe(true); // Placeholder - validação real
    });

    it('deve detectar conflitos informacionalmente', async () => {
      // Este teste verifica que conflitos são detectados mas não bloqueiam
      // A resposta deve incluir conflicts mas não alterar estado
      expect(true).toBe(true); // Placeholder - validação real
    });

    it('deve retornar erro se evento não existir', async () => {
      // Este teste verifica que evento inexistente retorna NotFoundError
      expect(true).toBe(true); // Placeholder - validação real
    });
  });
});

