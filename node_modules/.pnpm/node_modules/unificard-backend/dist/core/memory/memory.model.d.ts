import type { UserMemoryPreference, UserMemoryPreferenceRow, UserMemoryInteraction, UserMemoryInteractionRow, UserMemoryEntity, UserMemoryEntityRow, UserMemoryShortcut, UserMemoryShortcutRow } from './memory.types';
export declare class MemoryModel {
    static preferenceFromRow(row: UserMemoryPreferenceRow): UserMemoryPreference;
    static preferencesFromRows(rows: UserMemoryPreferenceRow[]): UserMemoryPreference[];
    static interactionFromRow(row: UserMemoryInteractionRow): UserMemoryInteraction;
    static interactionsFromRows(rows: UserMemoryInteractionRow[]): UserMemoryInteraction[];
    static entityFromRow(row: UserMemoryEntityRow): UserMemoryEntity;
    static entitiesFromRows(rows: UserMemoryEntityRow[]): UserMemoryEntity[];
    static shortcutFromRow(row: UserMemoryShortcutRow): UserMemoryShortcut;
    static shortcutsFromRows(rows: UserMemoryShortcutRow[]): UserMemoryShortcut[];
}
//# sourceMappingURL=memory.model.d.ts.map