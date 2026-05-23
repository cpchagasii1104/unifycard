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

    const meta = row.metadata;
    const metadata =
      meta &&
      typeof meta === 'object' &&
      !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : undefined;

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
      domainType: row.domain_type ?? 'SERVICE',
      status: row.status ?? 'active',
      requiresReview: row.requires_review ?? false,
      createdByAI: row.created_by_ai ?? false,
      approvedBy: row.approved_by ?? null,
      approvedAt: this.normalizeDate(row.approved_at ?? (row as { approvedAt?: Date | null }).approvedAt),
      rejectionReason: row.rejection_reason ?? null,
      metadata,
      createdAt: this.isoTimestamp(row.created_at ?? (row as { createdAt?: string }).createdAt),
      updatedAt: this.isoTimestamp(row.updated_at ?? (row as { updatedAt?: string }).updatedAt),
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
    if (category.domainType !== undefined) row.domain_type = category.domainType;
    if (category.status !== undefined) row.status = category.status;
    if (category.requiresReview !== undefined) row.requires_review = category.requiresReview;
    if (category.createdByAI !== undefined) row.created_by_ai = category.createdByAI;
    if (category.approvedBy !== undefined) row.approved_by = category.approvedBy;
    if (category.approvedAt !== undefined) row.approved_at = category.approvedAt;
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

  private static isoTimestamp(v: unknown): string {
    if (v == null || v === '') return '';
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'string') return v;
    return String(v);
  }

  private static normalizeDate(v: unknown): Date | null {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v;
    const d = new Date(v as string | number);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}

