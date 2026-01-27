// backend/src/core/pilot/pilot-human-observation.service.ts
// SPRINT 15/16: Service para observação humana (checklist, notas e hipóteses)
// REGRA DE OURO: Nenhuma decisão de produto será tomada com base em métricas automáticas do piloto.

import { pilotChecklistRepository, type PilotChecklistItem, type CreateChecklistItemInput, type UpdateChecklistItemInput } from './pilot-checklist.repository';
import { pilotNotesRepository, type PilotNote, type CreateNoteInput } from './pilot-notes.repository';

/**
 * Verifica se modo piloto está ativo
 */
function isPilotMode(): boolean {
  return process.env.PILOT_MODE === 'true';
}

/**
 * Itens padrão do checklist
 */
export const DEFAULT_CHECKLIST_ITEMS: CreateChecklistItemInput[] = [
  { observedUserId: '', itemKey: 'understood_context', itemLabel: 'Entendeu contexto de atuação' },
  { observedUserId: '', itemKey: 'created_company', itemLabel: 'Criou empresa' },
  { observedUserId: '', itemKey: 'invited_collaborator', itemLabel: 'Convidou colaborador' },
  { observedUserId: '', itemKey: 'understood_economy', itemLabel: 'Entendeu economia' },
  { observedUserId: '', itemKey: 'got_stuck', itemLabel: 'Ficou travado em algum ponto' },
];

class PilotHumanObservationService {
  /**
   * Atualiza item do checklist
   */
  async updateChecklistItem(
    tenantId: string,
    input: CreateChecklistItemInput,
    updateInput: UpdateChecklistItemInput
  ): Promise<PilotChecklistItem> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotChecklistRepository.upsertItem(tenantId, input, updateInput);
  }

  /**
   * Lista checklist de um usuário
   */
  async getChecklist(
    tenantId: string,
    observedUserId: string
  ): Promise<PilotChecklistItem[]> {
    if (!isPilotMode()) {
      return [];
    }

    const items = await pilotChecklistRepository.listByUser(tenantId, observedUserId);
    
    // Se não houver itens, retornar lista vazia (não criar automaticamente)
    return items;
  }

  /**
   * Inicializa checklist padrão para um usuário
   */
  async initializeChecklist(
    tenantId: string,
    observedUserId: string,
    checkedByUserId: string
  ): Promise<PilotChecklistItem[]> {
    if (!isPilotMode()) {
      return [];
    }

    const items: PilotChecklistItem[] = [];

    for (const defaultItem of DEFAULT_CHECKLIST_ITEMS) {
      const item = await pilotChecklistRepository.upsertItem(
        tenantId,
        { ...defaultItem, observedUserId },
        { checked: false, checkedByUserId }
      );
      items.push(item);
    }

    return items;
  }

  /**
   * Lista usuários com checklist
   */
  async listUsers(tenantId: string): Promise<string[]> {
    if (!isPilotMode()) {
      return [];
    }

    return await pilotChecklistRepository.listUsers(tenantId);
  }

  /**
   * Cria uma nota
   */
  async createNote(
    tenantId: string,
    input: CreateNoteInput,
    createdByUserId: string
  ): Promise<PilotNote> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotNotesRepository.create(tenantId, input, createdByUserId);
  }

  /**
   * Lista notas de um usuário
   */
  async getNotes(
    tenantId: string,
    observedUserId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PilotNote[]> {
    if (!isPilotMode()) {
      return [];
    }

    return await pilotNotesRepository.listByUser(tenantId, observedUserId, options);
  }

  /**
   * Deleta uma nota
   */
  async deleteNote(
    tenantId: string,
    noteId: string
  ): Promise<boolean> {
    if (!isPilotMode()) {
      throw new Error('Modo piloto não está ativo');
    }

    return await pilotNotesRepository.delete(tenantId, noteId);
  }
}

export const pilotHumanObservationService = new PilotHumanObservationService();

