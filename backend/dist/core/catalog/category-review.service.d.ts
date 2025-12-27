import type { Category } from '../categories/categories.types';
interface PendingCategoryWithMetadata extends Category {
    confidence?: number;
    createdByAI?: boolean;
    originalText?: string;
    aiReasoning?: string;
    createdAt: Date;
}
interface ApproveCategoryInput {
    categoryId: string;
    adminId: string;
    tenantId: string;
}
interface RejectCategoryInput {
    categoryId: string;
    adminId: string;
    tenantId: string;
    reason?: string;
}
declare class CategoryReviewService {
    /**
     * Lista todas as categorias pendentes de aprovação
     * Inclui metadados de IA (confidence, reasoning, etc.)
     */
    getPendingCategories(): Promise<PendingCategoryWithMetadata[]>;
    /**
     * Aprova uma categoria pendente
     * Registra auditoria completa da decisão
     */
    approveCategory(input: ApproveCategoryInput): Promise<Category>;
    /**
     * Rejeita uma categoria pendente
     * Registra motivo da rejeição e auditoria
     */
    rejectCategory(input: RejectCategoryInput): Promise<Category>;
    /**
     * Conta total de categorias pendentes
     */
    getPendingCount(): Promise<number>;
}
export declare const categoryReviewService: CategoryReviewService;
export {};
//# sourceMappingURL=category-review.service.d.ts.map