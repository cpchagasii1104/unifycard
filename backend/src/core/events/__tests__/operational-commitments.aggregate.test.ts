// backend/src/core/events/__tests__/operational-commitments.aggregate.test.ts
// Testes para aggregate de OperationalCommitment (FASE 4: sem economia)

import { describe, it, expect } from '@jest/globals';
import { canTransition, assertTransitionAllowed, isTerminalStatus } from '../operational-commitments.aggregate';
import type { OperationalCommitmentStatus } from '../operational-commitments.types';

describe('OperationalCommitment Aggregate - Transitions', () => {
  describe('canTransition', () => {
    it('deve permitir expected -> checked_in', () => {
      expect(canTransition('expected', 'checked_in')).toBe(true);
    });

    it('deve permitir expected -> failed', () => {
      expect(canTransition('expected', 'failed')).toBe(true);
    });

    it('deve permitir checked_in -> checked_out', () => {
      expect(canTransition('checked_in', 'checked_out')).toBe(true);
    });

    it('deve permitir checked_in -> failed', () => {
      expect(canTransition('checked_in', 'failed')).toBe(true);
    });

    it('NÃO deve permitir expected -> checked_out', () => {
      expect(canTransition('expected', 'checked_out')).toBe(false);
    });

    it('NÃO deve permitir checked_out -> qualquer status', () => {
      expect(canTransition('checked_out', 'checked_in')).toBe(false);
      expect(canTransition('checked_out', 'failed')).toBe(false);
    });

    it('NÃO deve permitir failed -> qualquer status', () => {
      expect(canTransition('failed', 'checked_in')).toBe(false);
      expect(canTransition('failed', 'checked_out')).toBe(false);
    });
  });

  describe('assertTransitionAllowed', () => {
    it('deve lançar erro para transição inválida', () => {
      expect(() => {
        assertTransitionAllowed('expected', 'checked_out');
      }).toThrow('Transição de status inválida');
    });

    it('não deve lançar erro para transição válida', () => {
      expect(() => {
        assertTransitionAllowed('expected', 'checked_in');
      }).not.toThrow();
    });
  });

  describe('isTerminalStatus', () => {
    it('deve identificar checked_out como terminal', () => {
      expect(isTerminalStatus('checked_out')).toBe(true);
    });

    it('deve identificar failed como terminal', () => {
      expect(isTerminalStatus('failed')).toBe(true);
    });

    it('NÃO deve identificar expected como terminal', () => {
      expect(isTerminalStatus('expected')).toBe(false);
    });

    it('NÃO deve identificar checked_in como terminal', () => {
      expect(isTerminalStatus('checked_in')).toBe(false);
    });
  });
});

