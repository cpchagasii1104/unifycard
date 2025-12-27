/**
 * Domínios de políticas
 */
export type PolicyDomain = 'economy' | 'work' | 'rides' | 'fund' | 'simulation';
/**
 * Valores possíveis de uma política
 */
export type PolicyValue = number | boolean | string;
/**
 * Interface de uma política declarativa
 */
export interface Policy {
    id: string;
    domain: PolicyDomain;
    key: string;
    value: PolicyValue;
    effectiveFrom: string;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=policy.types.d.ts.map