// src/utils/temporal/materializeResult.test.ts
// F-AGENDA-EDITING-UX-TRUTHFULNESS-V2 — prova automatizada (pura, sem DOM) do núcleo de verdade
// do save: rejected/conflicts/protectedCount viram veredito PARCIAL, nunca sucesso pleno.
import { describe, it, expect } from 'vitest';
import { summarizeMaterializeResult } from './materializeResult';
import type { MaterializeWeeklyTemplateResult } from '../../api/availability';

function makeResult(over: Partial<MaterializeWeeklyTemplateResult>): MaterializeWeeklyTemplateResult {
  return {
    created: 0,
    kept: 0,
    reactivated: 0,
    retired: 0,
    protectedCount: 0,
    rejected: [],
    conflicts: [],
    horizonWeeks: 8,
    timezone: 'America/Sao_Paulo',
    ownerType: 'user',
    ownerId: 'actor-1',
    ...over,
  };
}

describe('summarizeMaterializeResult', () => {
  it('clean: tudo aplicado → status clean, sem detalhe', () => {
    const s = summarizeMaterializeResult(makeResult({ created: 5, kept: 2 }));
    expect(s.status).toBe('clean');
    expect(s.notAppliedCount).toBe(0);
    expect(s.detail).toBe('');
    expect(s.message).toBe('Agenda salva.');
  });

  it('rejected > 0 → partial e conta rejeitados', () => {
    const s = summarizeMaterializeResult(
      makeResult({ rejected: [{ entry: 'monday 99:99-10:00', reason: 'invalid' }] })
    );
    expect(s.status).toBe('partial');
    expect(s.rejectedCount).toBe(1);
    expect(s.notAppliedCount).toBe(1);
    expect(s.detail).toContain('1 rejeitado');
    expect(s.message).toContain('parcialmente');
  });

  it('conflicts > 0 → partial e conta conflitos', () => {
    const s = summarizeMaterializeResult(
      makeResult({ conflicts: [{ templateKey: 'mon-09', reason: 'overlap' }] })
    );
    expect(s.status).toBe('partial');
    expect(s.conflictsCount).toBe(1);
    expect(s.detail).toContain('conflito');
  });

  it('protectedCount > 0 → partial (não finge sucesso pleno)', () => {
    const s = summarizeMaterializeResult(makeResult({ protectedCount: 2, created: 3 }));
    expect(s.status).toBe('partial');
    expect(s.protectedCount).toBe(2);
    expect(s.detail).toContain('2 protegido');
  });

  it('misto: soma rejected+conflicts+protected em notAppliedCount', () => {
    const s = summarizeMaterializeResult(
      makeResult({
        rejected: [{ entry: 'x', reason: 'r' }],
        conflicts: [{ templateKey: 'k', reason: 'c' }, { templateKey: 'k2', reason: 'c2' }],
        protectedCount: 1,
      })
    );
    expect(s.status).toBe('partial');
    expect(s.notAppliedCount).toBe(4);
    expect(s.detail).toContain('1 rejeitado');
    expect(s.detail).toContain('2 em conflito');
    expect(s.detail).toContain('1 protegido');
  });

  it('defensivo: campos ausentes não quebram (trata como 0)', () => {
    const s = summarizeMaterializeResult({} as MaterializeWeeklyTemplateResult);
    expect(s.status).toBe('clean');
    expect(s.notAppliedCount).toBe(0);
  });
});
