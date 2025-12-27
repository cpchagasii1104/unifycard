// src/core/policy/policy-registry.ts
// Registry de políticas declarativas (fonte inicial hardcoded)

import type { Policy, PolicyDomain, PolicyValue } from './policy.types';

/**
 * Registry de políticas
 * Fonte inicial: array hardcoded
 * Futuramente pode ser migrado para banco/config sem alterar interface
 */
class PolicyRegistry {
  private policies: Policy[] = [];

  constructor() {
    // Políticas iniciais hardcoded
    this.initializePolicies();
  }

  /**
   * Inicializa políticas padrão
   */
  private initializePolicies(): void {
    const now = new Date().toISOString();

    this.policies = [
      {
        id: 'economy.regional_split_percentage',
        domain: 'economy',
        key: 'regional_split_percentage',
        value: 0.10,
        effectiveFrom: now,
        metadata: {
          description: 'Percentual do split que vai para o fundo regional',
          min: 0,
          max: 1,
          type: 'percentage',
        },
      },
      {
        id: 'fund.cashback_enabled',
        domain: 'fund',
        key: 'cashback_enabled',
        value: true,
        effectiveFrom: now,
        metadata: {
          description: 'Habilita cashback no fundo regional',
          type: 'boolean',
        },
      },
      {
        id: 'simulation.allowed',
        domain: 'simulation',
        key: 'allowed',
        value: true,
        effectiveFrom: now,
        metadata: {
          description: 'Permite execução de simulações',
          type: 'boolean',
        },
      },
      // Split Engine - Normas econômicas de distribuição
      {
        id: 'economy.split_worker_percentage',
        domain: 'economy',
        key: 'split_worker_percentage',
        value: 0.70,
        effectiveFrom: now,
        metadata: {
          description: 'Percentual do split que vai para o worker',
          min: 0,
          max: 1.0,
          type: 'percentage',
        },
      },
      {
        id: 'economy.split_tenant_percentage',
        domain: 'economy',
        key: 'split_tenant_percentage',
        value: 0.15,
        effectiveFrom: now,
        metadata: {
          description: 'Percentual do split que vai para tenant/platform',
          min: 0,
          max: 1.0,
          type: 'percentage',
        },
      },
      {
        id: 'economy.split_region_percentage',
        domain: 'economy',
        key: 'split_region_percentage',
        value: 0.10,
        effectiveFrom: now,
        metadata: {
          description: 'Percentual do split que vai para fundo regional',
          min: 0,
          max: 1.0,
          type: 'percentage',
        },
      },
      {
        id: 'economy.split_group_percentage',
        domain: 'economy',
        key: 'split_group_percentage',
        value: 0.05,
        effectiveFrom: now,
        metadata: {
          description: 'Percentual do split que vai para grupos de usuários',
          min: 0,
          max: 1.0,
          type: 'percentage',
        },
      },
    ];
  }

  /**
   * Busca uma política específica por domínio e chave
   */
  getPolicy(domain: PolicyDomain, key: string): Policy | null {
    const policy = this.policies.find(
      (p) => p.domain === domain && p.key === key
    );

    if (!policy) {
      return null;
    }

    // Verificar se política está em vigor (effectiveFrom)
    const effectiveDate = new Date(policy.effectiveFrom);
    const now = new Date();

    if (effectiveDate > now) {
      return null; // Política ainda não está em vigor
    }

    return policy;
  }

  /**
   * Lista todas as políticas, opcionalmente filtradas por domínio
   */
  listPolicies(domain?: PolicyDomain): Policy[] {
    let filtered = this.policies;

    if (domain) {
      filtered = this.policies.filter((p) => p.domain === domain);
    }

    // Filtrar apenas políticas em vigor
    const now = new Date();
    return filtered.filter((p) => {
      const effectiveDate = new Date(p.effectiveFrom);
      return effectiveDate <= now;
    });
  }

  /**
   * Busca valor de uma política (helper)
   */
  getPolicyValue<T extends PolicyValue>(
    domain: PolicyDomain,
    key: string,
    defaultValue?: T
  ): T | null {
    const policy = this.getPolicy(domain, key);
    if (!policy) {
      return defaultValue !== undefined ? defaultValue : null;
    }
    return policy.value as T;
  }
}

export const policyRegistry = new PolicyRegistry();

