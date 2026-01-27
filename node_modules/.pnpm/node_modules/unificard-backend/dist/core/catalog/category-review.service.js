"use strict";
// src/core/catalog/category-review.service.ts
//
// Serviço para gerenciar revisão e aprovação de categorias criadas por IA
// Centraliza lógica de fila de aprovação humana
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryReviewService = void 0;
const categories_service_1 = require("../categories/categories.service");
const pool_1 = require("@core/database/pool");
const categories_model_1 = require("../categories/categories.model");
class CategoryReviewService {
    /**
     * Lista todas as categorias pendentes de aprovação
     * Inclui metadados de IA (confidence, reasoning, etc.)
     */
    async getPendingCategories() {
        const result = await pool_1.pool.query(`
      SELECT 
        c.category_id,
        c.parent_id,
        c.name,
        c.slug,
        c.description,
        c.level,
        c.path,
        COALESCE(to_jsonb(c.keywords), '[]'::jsonb) as keywords,
        c.country_code,
        c.status,
        c.requires_review,
        c.created_by_ai,
        c.approved_by,
        c.approved_at,
        c.rejection_reason,
        c.created_at,
        c.updated_at,
        -- Buscar metadados de auditoria da tabela category_ai_logs
        cal.ai_confidence as confidence,
        cal.original_text,
        cal.ai_suggestion->>'reasoning' as ai_reasoning
      FROM categories c
      LEFT JOIN category_ai_logs cal ON cal.category_id = c.category_id
      WHERE c.status = 'pending' AND c.requires_review = true
      ORDER BY c.created_at DESC
      `);
        return result.rows.map((row) => {
            const category = categories_model_1.CategoryModel.fromRow(row);
            return {
                ...category,
                confidence: row.confidence,
                createdByAI: row.created_by_ai || false,
                originalText: row.original_text || undefined,
                aiReasoning: row.ai_reasoning || undefined,
            };
        });
    }
    /**
     * Aprova uma categoria pendente
     * Registra auditoria completa da decisão
     */
    async approveCategory(input) {
        const { categoryId, adminId, tenantId } = input;
        // Usar método existente do categoriesService
        const approved = await categories_service_1.categoriesService.approveCategory(categoryId, adminId);
        // Registrar auditoria adicional (se necessário)
        // O categoriesService já atualiza approved_by e approved_at
        return approved;
    }
    /**
     * Rejeita uma categoria pendente
     * Registra motivo da rejeição e auditoria
     */
    async rejectCategory(input) {
        const { categoryId, reason } = input;
        // Usar método existente do categoriesService
        const rejected = await categories_service_1.categoriesService.rejectCategory(categoryId, reason || 'Rejeitada por moderador');
        return rejected;
    }
    /**
     * Conta total de categorias pendentes
     */
    async getPendingCount() {
        const result = await pool_1.pool.query(`
      SELECT COUNT(*) as count
      FROM categories
      WHERE status = 'pending' AND requires_review = true
      `);
        return parseInt(result.rows[0]?.count || '0', 10);
    }
}
exports.categoryReviewService = new CategoryReviewService();
