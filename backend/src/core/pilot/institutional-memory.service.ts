// backend/src/core/pilot/institutional-memory.service.ts
// SPRINT 26: Memória Institucional Declarativa
// Service para declarações de aprendizado institucional

import { institutionalMemoryRepository, type CreateInstitutionalMemoryInput } from './institutional-memory.repository';
import { isPilotMode } from './pilot-events.service';

class InstitutionalMemoryService {
  /**
   * Cria uma nova declaração de aprendizado
   * Apenas funciona se PILOT_MODE=true
   */
  async createDeclaration(
    tenantId: string,
    input: CreateInstitutionalMemoryInput
  ): Promise<import('./institutional-memory.repository').InstitutionalMemoryDeclaration | null> {
    if (!isPilotMode()) {
      return null;
    }

    try {
      return await institutionalMemoryRepository.create(tenantId, input);
    } catch (error) {
      console.warn('[InstitutionalMemory] Erro ao criar declaração:', error);
      throw error;
    }
  }

  /**
   * Lista declarações de aprendizado
   * Apenas funciona se PILOT_MODE=true
   */
  async listDeclarations(
    tenantId: string,
    options?: {
      limit?: number;
      offset?: number;
      context?: string;
    }
  ): Promise<import('./institutional-memory.repository').InstitutionalMemoryDeclaration[]> {
    if (!isPilotMode()) {
      return [];
    }

    try {
      return await institutionalMemoryRepository.list(tenantId, options);
    } catch (error) {
      console.warn('[InstitutionalMemory] Erro ao listar declarações:', error);
      // Antes: return []  ("nao ha declaracoes"). Erro de leitura virava afirmacao de ausencia — some sem alarme.
      // Zero e uma afirmacao; desconhecido e a verdade, e desconhecido tem que APARECER.
      throw error;
    }
  }

  /**
   * Atualiza versão de uma declaração
   */
  async updateDeclaration(
    tenantId: string,
    declarationId: string,
    newContent: string
  ): Promise<import('./institutional-memory.repository').InstitutionalMemoryDeclaration | null> {
    if (!isPilotMode()) {
      return null;
    }

    try {
      return await institutionalMemoryRepository.updateVersion(tenantId, declarationId, newContent);
    } catch (error) {
      console.warn('[InstitutionalMemory] Erro ao atualizar declaração:', error);
      throw error;
    }
  }

  /**
   * Remove uma declaração (soft delete)
   */
  async deleteDeclaration(
    tenantId: string,
    declarationId: string
  ): Promise<boolean> {
    if (!isPilotMode()) {
      return false;
    }

    try {
      return await institutionalMemoryRepository.softDelete(tenantId, declarationId);
    } catch (error) {
      console.warn('[InstitutionalMemory] Erro ao deletar declaração:', error);
      // Antes: return false — falha de escrita virava "nao apagou/nao existia", indistinguiveis.
      // A irma updateDeclaration deste mesmo arquivo JA propaga: uma regra, nao duas.
      throw error;
    }
  }
}

export const institutionalMemoryService = new InstitutionalMemoryService();

