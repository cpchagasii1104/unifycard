import { CategoryContext } from '@unificard/contracts';
interface GateResult {
    decision: 'ALLOW' | 'DENY' | 'REVIEW';
    reasonCode?: string;
    suggestion?: string;
    canonicalId?: string;
    cboCode?: string;
    confidence?: number;
    canonicalHobby?: string;
}
interface GateOptions {
    context: CategoryContext;
    skipFormCheck?: boolean;
    skipCBO?: boolean;
    tenantId?: string;
    actorId?: string;
    globalUserId?: string;
}
declare class CategoryInputGateService {
    /**
     * Pipeline completo de validação
     * Performance: <60ms (sem IA)
     */
    validate(input: string, options: GateOptions): Promise<GateResult>;
}
export declare const categoryInputGateService: CategoryInputGateService;
export type { GateResult, GateOptions };
//# sourceMappingURL=category-input-gate.service.d.ts.map