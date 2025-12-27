import { CategoryContext } from '@unificard/contracts';
interface AuditEntry {
    inputOriginal: string;
    normalized: string;
    context: CategoryContext;
    decision: 'ALLOW' | 'DENY' | 'REVIEW';
    reasonCode?: string;
    confidence?: number;
    canonicalId?: string;
    lexicalDecision?: string;
    formCheckDecision?: string;
    cboMatchCode?: string;
    embeddingSimilarity?: number;
    tenantId?: string;
    actorId?: string;
    globalUserId?: string;
}
declare class CategoryInputAuditService {
    /**
     * Registra entrada de auditoria
     * Performance: <5ms (INSERT simples)
     */
    log(entry: AuditEntry): Promise<void>;
}
export declare const categoryInputAuditService: CategoryInputAuditService;
export type { AuditEntry };
//# sourceMappingURL=category-input-audit.service.d.ts.map