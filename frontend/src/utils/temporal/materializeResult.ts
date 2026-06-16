// src/utils/temporal/materializeResult.ts
// F-AGENDA-EDITING-UX-TRUTHFULNESS-V2
// Interpreta o resultado da materialização da grade semanal (PUT /availability/weekly-template)
// em um veredito de save HONESTO para a UI. NÃO persiste nada, NÃO toca rede — função pura.
//
// Regra de verdade (DECISION-0072 / GO): um save só é "limpo" quando o backend não devolveu
// NENHUM horário não-aplicado. Qualquer `rejected`, `conflicts` ou `protectedCount` > 0 torna o
// save PARCIAL — a UI não pode fingir que a grade inteira foi aplicada.

import type { MaterializeWeeklyTemplateResult } from '../../api/availability';

export interface MaterializeSummary {
  /** 'clean' = backend aplicou tudo; 'partial' = algo não entrou (não é sucesso pleno). */
  status: 'clean' | 'partial';
  rejectedCount: number;
  conflictsCount: number;
  protectedCount: number;
  /** Soma dos horários que NÃO foram aplicados como declarados. */
  notAppliedCount: number;
  /** Mensagem principal para o usuário. */
  message: string;
  /** Detalhe mínimo com a contagem por categoria (vazio quando limpo). */
  detail: string;
}

/**
 * Resume o `MaterializeWeeklyTemplateResult` num veredito de save.
 * Defensivo a campos ausentes (arrays/numbers podem faltar em respostas parciais/legadas).
 */
export function summarizeMaterializeResult(
  result: MaterializeWeeklyTemplateResult
): MaterializeSummary {
  const rejectedCount = Array.isArray(result?.rejected) ? result.rejected.length : 0;
  const conflictsCount = Array.isArray(result?.conflicts) ? result.conflicts.length : 0;
  const protectedCount = typeof result?.protectedCount === 'number' ? result.protectedCount : 0;
  const notAppliedCount = rejectedCount + conflictsCount + protectedCount;

  if (notAppliedCount === 0) {
    return {
      status: 'clean',
      rejectedCount,
      conflictsCount,
      protectedCount,
      notAppliedCount,
      message: 'Agenda salva.',
      detail: '',
    };
  }

  const parts: string[] = [];
  if (rejectedCount > 0) parts.push(`${rejectedCount} rejeitado(s)`);
  if (conflictsCount > 0) parts.push(`${conflictsCount} em conflito`);
  if (protectedCount > 0) parts.push(`${protectedCount} protegido(s) (têm agendamentos ativos)`);

  return {
    status: 'partial',
    rejectedCount,
    conflictsCount,
    protectedCount,
    notAppliedCount,
    message: 'Salvo parcialmente — alguns horários não foram aplicados.',
    detail: parts.join(' · '),
  };
}
