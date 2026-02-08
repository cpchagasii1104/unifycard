// src/core/memory/memory.model.ts
import type {
  UserMemoryPreference,
  UserMemoryPreferenceRow,
  UserMemoryInteraction,
  UserMemoryInteractionRow,
  UserMemoryEntity,
  UserMemoryEntityRow,
  UserMemoryShortcut,
  UserMemoryShortcutRow,
} from './memory.types';

export class MemoryModel {
  static preferenceFromRow(row: UserMemoryPreferenceRow): UserMemoryPreference {
    return {
      preferenceId: row.preference_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      category: row.category,
      key: row.key,
      valueCents: row.value,
      confidence: row.confidence,
      usageCount: row.usage_count,
      lastUsedAt: row.last_usedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static preferencesFromRows(rows: UserMemoryPreferenceRow[]): UserMemoryPreference[] {
    return rows.map((row) => this.preferenceFromRow(row));
  }

  static interactionFromRow(row: UserMemoryInteractionRow): UserMemoryInteraction {
    return {
      interactionId: row.interaction_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      intent: row.intent,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityName: row.entity_name,
      parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
      interactionCount: row.interaction_count,
      firstInteractionAt: row.first_interactionAt,
      lastInteractionAt: row.last_interactionAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static interactionsFromRows(rows: UserMemoryInteractionRow[]): UserMemoryInteraction[] {
    return rows.map((row) => this.interactionFromRow(row));
  }

  static entityFromRow(row: UserMemoryEntityRow): UserMemoryEntity {
    return {
      entityId: row.entity_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      entityType: row.entity_type,
      targetGlobalUserId: row.target_global_user_id,
      targetCompanyId: row.target_company_id,
      entityName: row.entity_name,
      entityMetadata: row.entity_metadata && typeof row.entity_metadata === 'object' ? row.entity_metadata : {},
      relevanceScore: row.relevance_score,
      interactionCount: row.interaction_count,
      lastInteractionAt: row.last_interactionAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static entitiesFromRows(rows: UserMemoryEntityRow[]): UserMemoryEntity[] {
    return rows.map((row) => this.entityFromRow(row));
  }

  static shortcutFromRow(row: UserMemoryShortcutRow): UserMemoryShortcut {
    return {
      shortcutId: row.shortcut_id,
      tenantId: row.tenant_id,
      globalUserId: row.global_user_id,
      label: row.label,
      intent: row.intent,
      parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : {},
      usageCount: row.usage_count,
      lastUsedAt: row.last_usedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  static shortcutsFromRows(rows: UserMemoryShortcutRow[]): UserMemoryShortcut[] {
    return rows.map((row) => this.shortcutFromRow(row));
  }
}


















