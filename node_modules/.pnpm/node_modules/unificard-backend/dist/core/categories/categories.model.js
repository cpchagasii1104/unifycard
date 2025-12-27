"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryModel = void 0;
class CategoryModel {
    static fromRow(row) {
        return {
            categoryId: row.category_id,
            parentId: row.parent_id,
            name: row.name,
            slug: row.slug,
            description: row.description,
            level: row.level,
            path: row.path || [],
            keywords: (() => {
                if (!row.keywords)
                    return [];
                if (Array.isArray(row.keywords))
                    return row.keywords;
                // Se for JSONB do PostgreSQL, pode vir como objeto ou string
                if (typeof row.keywords === 'string') {
                    try {
                        const parsed = JSON.parse(row.keywords);
                        return Array.isArray(parsed) ? parsed : [];
                    }
                    catch {
                        return [];
                    }
                }
                // Se for objeto JSONB
                if (typeof row.keywords === 'object') {
                    try {
                        const values = Object.values(row.keywords);
                        return values.filter(v => typeof v === 'string');
                    }
                    catch {
                        return [];
                    }
                }
                return [];
            })(),
            countryCode: row.country_code || null,
            status: row.status || 'active', // FASE 3.6: Suporta 'auto_active' também
            requiresReview: row.requires_review || false,
            createdByAI: row.created_by_ai || false,
            approvedBy: row.approved_by || null,
            approvedAt: row.approved_at || null,
            rejectionReason: row.rejection_reason || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    static fromRows(rows) {
        return rows.map((row) => this.fromRow(row));
    }
    static toRow(category) {
        const row = {};
        if (category.categoryId !== undefined)
            row.category_id = category.categoryId;
        if (category.parentId !== undefined)
            row.parent_id = category.parentId;
        if (category.name !== undefined)
            row.name = category.name;
        if (category.slug !== undefined)
            row.slug = category.slug;
        if (category.description !== undefined)
            row.description = category.description;
        if (category.level !== undefined)
            row.level = category.level;
        if (category.path !== undefined)
            row.path = category.path;
        if (category.keywords !== undefined)
            row.keywords = category.keywords;
        if (category.countryCode !== undefined)
            row.country_code = category.countryCode;
        if (category.status !== undefined)
            row.status = category.status;
        if (category.requiresReview !== undefined)
            row.requires_review = category.requiresReview;
        if (category.createdByAI !== undefined)
            row.created_by_ai = category.createdByAI;
        if (category.approvedBy !== undefined)
            row.approved_by = category.approvedBy;
        if (category.approvedAt !== undefined)
            row.approved_at = category.approvedAt;
        if (category.rejectionReason !== undefined)
            row.rejection_reason = category.rejectionReason;
        return row;
    }
}
exports.CategoryModel = CategoryModel;
//# sourceMappingURL=categories.model.js.map