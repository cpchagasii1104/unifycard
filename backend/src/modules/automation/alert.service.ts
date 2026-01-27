// backend/src/modules/automation/alert.service.ts
// SPRINT 50: Service para alertas

import { alertRepository } from './alert.repository';
import type {
  Alert,
  CreateAlertInput,
  UpdateAlertStatusInput,
  AlertFilters,
} from './automation.types';

/**
 * Service para gerenciar alertas
 * 
 * ⚠️ REGRAS ARQUITETURAIS:
 * - Alertas são criados por automações
 * - Resolução é manual (humano decide)
 * - Não executa economia automaticamente
 */
class AlertService {
  /**
   * Cria alerta
   */
  async createAlert(
    tenantId: string,
    input: CreateAlertInput
  ): Promise<Alert> {
    return await alertRepository.createAlert(tenantId, input);
  }

  /**
   * Atualiza status do alerta
   */
  async updateAlertStatus(
    tenantId: string,
    alertId: string,
    input: UpdateAlertStatusInput
  ): Promise<Alert> {
    return await alertRepository.updateAlertStatus(tenantId, alertId, input);
  }

  /**
   * Busca alerta por ID
   */
  async getAlertById(
    tenantId: string,
    alertId: string
  ): Promise<Alert | null> {
    return await alertRepository.getAlertById(tenantId, alertId);
  }

  /**
   * Lista alertas
   */
  async listAlerts(
    tenantId: string,
    filters: AlertFilters = {}
  ): Promise<Alert[]> {
    return await alertRepository.listAlerts(tenantId, filters);
  }

  /**
   * Conta alertas abertos
   */
  async countOpenAlerts(
    tenantId: string,
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<number> {
    return await alertRepository.countOpenAlerts(tenantId, severity);
  }
}

export const alertService = new AlertService();







