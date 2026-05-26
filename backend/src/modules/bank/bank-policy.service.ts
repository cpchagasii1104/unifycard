// backend/src/modules/bank/bank-policy.service.ts
//
// DECISION-0048 (2026-05-26): este serviço FOI O policy registry
// hierárquico de SPLIT (resolveSplitPolicy / setPolicy / SplitPolicy*).
// A canonicidade de policy de split / decisão econômica foi convergida
// para economic_policy_engine + economic_policies em PE-1 + DECISION-
// 0048. As funções resolveSplitPolicy / setPolicy / tipos SplitPolicy*
// foram REMOVIDAS.
//
// O que sobra aqui:
//   - getPolicy<T>(tenantId, key): leitura genérica chave-valor de
//     bank_policies. Mantida porque bank-limit.service.ts continua
//     consultando para configurar limites operacionais (defaultLimit) —
//     uso distinto de policy econômica.
//
// Restrições:
//   - NOVOS módulos NÃO devem importar bank-policy.service. Guardrail
//     NO_LEGACY_BANK_POLICY_SERVICE_IMPORT em validate-architectural-
//     patterns.mjs bloqueia importação fora da allowlist.
//   - bank_policies como tabela está hard-deprecated (migration
//     20260530566000 + COMMENT). Remoção física rastreada em
//     DT-BANK-POLICIES-PHYSICAL-REMOVAL.

import { runQueryWithTenant } from '@core/database/pool';

class BankPolicyService {
  /**
   * Leitura genérica de bank_policies por chave. Mantida APENAS para
   * bank-limit.service consultar configuração de limites operacionais.
   * NÃO usar para policy de split — DECISION-0048 convergiu split policy
   * para economic_policy_engine.
   */
  async getPolicy<T = unknown>(
    tenantId: string,
    key: string
  ): Promise<T | null> {
    const result = await runQueryWithTenant<{
      value_json: T;
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

    return result.value_json;
  }
}

export const bankPolicyService = new BankPolicyService();
