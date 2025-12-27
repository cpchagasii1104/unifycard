import type { CareSession, CareSessionRow, CareMessage, CareMessageRow } from './care.types';
export declare class CareModel {
    static fromRow(row: CareSessionRow): CareSession;
    static fromRows(rows: CareSessionRow[]): CareSession[];
    static toRow(session: Partial<CareSession>): Partial<CareSessionRow>;
}
export declare class CareMessageModel {
    static fromRow(row: CareMessageRow): CareMessage;
    static fromRows(rows: CareMessageRow[]): CareMessage[];
    static toRow(message: Partial<CareMessage>): Partial<CareMessageRow>;
}
//# sourceMappingURL=care.model.d.ts.map