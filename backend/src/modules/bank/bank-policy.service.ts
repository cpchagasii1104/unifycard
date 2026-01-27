// backend/src/modules/bank/bank-policy.service.ts
// CONTINUOUS PRODUCTION: Policy Registry Service
// Separa política (percentuais) da execução (split engine)

import { runQueryWithTenant } from '@core/database/pool';
import type { BankTransactionContext, BankSplitType, SystemAccountName } from './bank-split.types';

export interface SplitPolicyRule {
  splitType: BankSplitType;
  percentage: number;
  targetAccountName?: SystemAccountName;
  targetAccountId?: string;
}

export interface SplitPolicy {
  splits: SplitPolicyRule[];
}

/**
 * Metadata para resolução hierárquica de split policies
 * 
 * NOTA: Categoria NÃO é usada na resolução de split (viola Category_System_Contract_UnifiCard.md)
 * O campo category pode existir na interface para compatibilidade, mas NÃO é usado na lógica de resolução.
 */
export interface SplitPolicyMetadata {
  cityId?: string;
  state?: string; // Código do estado (ex: 'PR', 'SP')
  regionId?: string;
  country?: string; // Código do país (ex: 'BR')
  category?: string; // DEPRECATED: Não usado na resolução de split (viola contratos institucionais)
  cnpj?: string; // CNPJ da empresa/loja
  storeId?: string; // ID da loja
  channel?: string; // Canal: marketplace, evento, IRP, link, NFC
  campaignId?: string; // ID de campanha temporária
  [key: string]: any; // Campos adicionais para extensibilidade futura
}

class BankPolicyService {
  /**
   * Busca política ativa por chave
   */
  async getPolicy<T = any>(
    tenantId: string,
    key: string
  ): Promise<T | null> {
    const result = await runQueryWithTenant<{
      value_json: any;
    }>(
      tenantId,
      `
        SELECT value_json
        FROM bank_policies
        WHERE tenant_id = $1 
          AND key = $2 
          AND status = 'active'
        ORDER BY version DESC
        LIMIT 1
      `,
      [tenantId, key]
    );

    if (!result) {
      return null;
    }

    return result.value_json as T;
  }

  /**
   * Resolve política de split para um contexto com resolução hierárquica
   * 
   * Hierarquia de busca (primeira encontrada vence):
   * 1. split.{context}.{cityId}.{storeId} (mais específico)
   * 2. split.{context}.{cityId}
   * 3. split.{context}.{state}
   * 4. split.{context} (base)
   * 5. null (usa defaults hardcoded)
   * 
   * NOTA: Categoria NÃO é usada na resolução de split (viola Category_System_Contract_UnifiCard.md)
   * 
   * Retorna null se não houver policy (usa defaults)
   * 
   * @param tenantId - ID do tenant
   * @param context - Contexto da transação (service_booking, event_ticket, etc)
   * @param metadata - Metadata opcional para resolução hierárquica
   */
  async resolveSplitPolicy(
    tenantId: string,
    context: BankTransactionContext,
    metadata?: SplitPolicyMetadata
  ): Promise<SplitPolicy | null> {
    // Se não há metadata, usar comportamento antigo (backward compatible)
    if (!metadata) {
      const key = `split.${context}`;
      return await this.getPolicy<SplitPolicy>(tenantId, key);
    }

    // Resolução hierárquica: tentar keys mais específicas primeiro
    // NOTA: Categoria NÃO é usada (viola contratos institucionais)
    const candidateKeys: string[] = [];

    // 1. Mais específico: context.cityId.storeId
    if (metadata.cityId && metadata.storeId) {
      candidateKeys.push(`split.${context}.${metadata.cityId}.${metadata.storeId}`);
    }

    // 2. context.cityId
    if (metadata.cityId) {
      candidateKeys.push(`split.${context}.${metadata.cityId}`);
    }

    // 3. context.state
    if (metadata.state) {
      candidateKeys.push(`split.${context}.${metadata.state}`);
    }

    // 4. context (base)
    candidateKeys.push(`split.${context}`);

    // Buscar primeira policy encontrada (primeira vence)
    for (const key of candidateKeys) {
      const policy = await this.getPolicy<SplitPolicy>(tenantId, key);
      if (policy) {
        return policy;
      }
    }

    // Nenhuma policy encontrada
    return null;
  }

  /**
   * Cria ou atualiza política
   * Cria nova versão se já existir versão ativa
   */
  async setPolicy(
    tenantId: string,
    key: string,
    value: any,
    status: 'active' | 'deprecated' | 'draft' = 'active'
  ): Promise<void> {
    // Buscar última versão
    const lastVersion = await runQueryWithTenant<{ version: number }>(
      tenantId,
      `
        SELECT COALESCE(MAX(version), 0) as version
        FROM bank_policies
        WHERE tenant_id = $1 AND key = $2
      `,
      [tenantId, key]
    );

    const nextVersion = (lastVersion[0]?.version || 0) + 1;

    // Se status é 'active', deprecar versões anteriores
    if (status === 'active') {
      await runQueryWithTenant(
        tenantId,
        `
          UPDATE bank_policies
          SET status = 'deprecated'
          WHERE tenant_id = $1 AND key = $2 AND status = 'active'
        `,
        [tenantId, key]
      );
    }

    // Criar nova versão
    await runQueryWithTenant(
      tenantId,
      `
        INSERT INTO bank_policies (tenant_id, key, version, status, value_json)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [tenantId, key, nextVersion, status, JSON.stringify(value)]
    );
  }
}

export const bankPolicyService = new BankPolicyService();







