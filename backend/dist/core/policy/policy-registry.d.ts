import type { Policy, PolicyDomain, PolicyValue } from './policy.types';
/**
 * Registry de políticas
 * Fonte inicial: array hardcoded
 * Futuramente pode ser migrado para banco/config sem alterar interface
 */
declare class PolicyRegistry {
    private policies;
    constructor();
    /**
     * Inicializa políticas padrão
     */
    private initializePolicies;
    /**
     * Busca uma política específica por domínio e chave
     */
    getPolicy(domain: PolicyDomain, key: string): Policy | null;
    /**
     * Lista todas as políticas, opcionalmente filtradas por domínio
     */
    listPolicies(domain?: PolicyDomain): Policy[];
    /**
     * Busca valor de uma política (helper)
     */
    getPolicyValue<T extends PolicyValue>(domain: PolicyDomain, key: string, defaultValue?: T): T | null;
}
export declare const policyRegistry: PolicyRegistry;
export {};
//# sourceMappingURL=policy-registry.d.ts.map