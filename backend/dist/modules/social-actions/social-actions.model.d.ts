import type { SocialAction, SocialActionRow } from './social-actions.types';
export declare class SocialActionsModel {
    static fromRow(row: SocialActionRow): SocialAction;
    static fromRows(rows: SocialActionRow[]): SocialAction[];
    static toRow(action: Partial<SocialAction>): Partial<SocialActionRow>;
}
//# sourceMappingURL=social-actions.model.d.ts.map