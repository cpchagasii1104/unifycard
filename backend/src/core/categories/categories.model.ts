// src/core/categories/categories.model.ts
import type { Category, CategoryRow } from './categories.types';

export class CategoryModel {

  /**
   * Converte uma row do banco em Category canônica.
   * ESTE MÉTODO É UM GATE DE SSOT.
   */
  static fromRow(row: CategoryRow): Category {
    if (row.level === null || row.level === undefined) {
      throw new Error(`Category ${row.slug} inválida: level ausente`);
    }

    const path = this.normalizePath(row.path, row.level, row.slug);

    return {
      categoryId: row.category_id,
      parentId: row.parent_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      level: row.level,
      path,
      keywords: this.normalizeKeywords(row.keywords),
      countryCode: row.country_code || null,
      scope: row.scope,
      status: row.status ?? 'active',
      requiresReview: row.requires_review ?? false,
      createdByAI: row.created_by_ai ?? false,
      approvedBy: row.approved_by ?? null,
      approvedAt: row.approvedAt ?? null,
      rejectionReason: row.rejection_reason ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static fromRows(rows: CategoryRow[]): Category[] {
    return rows.map((row) => this.fromRow(row));
  }

  static toRow(category: Partial<Category>): Partial<CategoryRow> {
    const row: Partial<CategoryRow> = {};

    if (category.categoryId !== undefined) row.category_id = category.categoryId;
    if (category.parentId !== undefined) row.parent_id = category.parentId;
    if (category.name !== undefined) row.name = category.name;
    if (category.slug !== undefined) row.slug = category.slug;
    if (category.description !== undefined) row.description = category.description;
    if (category.level !== undefined) row.level = category.level;
    if (category.path !== undefined) row.path = category.path;
    if (category.keywords !== undefined) row.keywords = category.keywords;
    if (category.countryCode !== undefined) row.country_code = category.countryCode;
    if (category.status !== undefined) row.status = category.status;
    if (category.requiresReview !== undefined) row.requires_review = category.requiresReview;
    if (category.createdByAI !== undefined) row.created_by_ai = category.createdByAI;
    if (category.approvedBy !== undefined) row.approved_by = category.approvedBy;
    if (category.approvedAt !== undefined) row.approvedAt = category.approvedAt;
    if (category.rejectionReason !== undefined) row.rejection_reason = category.rejectionReason;

    return row;
  }

  // ============================
  // Helpers canônicos (privados)
  // ============================

  private static normalizePath(
    rawPath: unknown,
    level: number,
    slug: string
  ): string[] {
    if (level === 0) return [];

    if (!Array.isArray(rawPath)) {
      throw new Error(`Category ${slug} inválida: path ausente para level ${level}`);
    }

    if (rawPath.length !== level) {
      throw new Error(
        `Category ${slug} inválida: path.length (${rawPath.length}) != level (${level})`
      );
    }

    if (!rawPath.every(p => typeof p === 'string' && p.length > 0)) {
      throw new Error(`Category ${slug} inválida: path contém valores inválidos`);
    }

    return rawPath;
  }

  private static normalizeKeywords(raw: unknown): string[] {
    if (!raw) return [];

    if (Array.isArray(raw)) {
      return raw.filter(k => typeof k === 'string');
    }

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed)
          ? parsed.filter(k => typeof k === 'string')
          : [];
      } catch {
        return [];
      }
    }

    if (typeof raw === 'object') {
      try {
        return Object.values(raw).filter(v => typeof v === 'string') as string[];
      } catch {
        return [];
      }
    }

    return [];
  }
}

