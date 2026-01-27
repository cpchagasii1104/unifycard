// backend/src/core/events/__tests__/event.aggregate.test.ts
// Testes para agregado Event mínimo (EVENT_DOMAIN_MINIMUM_CONTRACT)

import { canTransition, assertTransitionAllowed } from '../event.aggregate';
import type { EventStatus } from '../event.types';

describe('Event Aggregate - Transitions', () => {
  describe('canTransition', () => {
    it('deve permitir draft -> declared', () => {
      expect(canTransition('draft', 'declared')).toBe(true);
    });

    it('deve permitir draft -> cancelled', () => {
      expect(canTransition('draft', 'cancelled')).toBe(true);
    });

    it('deve permitir declared -> published', () => {
      expect(canTransition('declared', 'published')).toBe(true);
    });

    it('deve permitir declared -> cancelled', () => {
      expect(canTransition('declared', 'cancelled')).toBe(true);
    });

    it('deve permitir published -> active', () => {
      expect(canTransition('published', 'active')).toBe(true);
    });

    it('deve permitir published -> cancelled', () => {
      expect(canTransition('published', 'cancelled')).toBe(true);
    });

    it('deve permitir active -> ended', () => {
      expect(canTransition('active', 'ended')).toBe(true);
    });

    it('deve permitir active -> cancelled', () => {
      expect(canTransition('active', 'cancelled')).toBe(true);
    });

    it('NÃO deve permitir declared -> active', () => {
      expect(canTransition('declared', 'active')).toBe(false);
    });

    it('NÃO deve permitir active -> cancelled quando já ended', () => {
      expect(canTransition('ended', 'cancelled')).toBe(false);
    });

    it('NÃO deve permitir ended -> qualquer status', () => {
      expect(canTransition('ended', 'published')).toBe(false);
      expect(canTransition('ended', 'active')).toBe(false);
      expect(canTransition('ended', 'cancelled')).toBe(false);
    });

    it('NÃO deve permitir cancelled -> qualquer status', () => {
      expect(canTransition('cancelled', 'published')).toBe(false);
      expect(canTransition('cancelled', 'active')).toBe(false);
      expect(canTransition('cancelled', 'ended')).toBe(false);
    });
  });

  describe('assertTransitionAllowed', () => {
    it('deve lançar erro para transição inválida', () => {
      expect(() => {
        assertTransitionAllowed('declared', 'active');
      }).toThrow('Transição de status inválida');
    });

    it('não deve lançar erro para transição válida', () => {
      expect(() => {
        assertTransitionAllowed('draft', 'declared');
      }).not.toThrow();
    });
  });
});

