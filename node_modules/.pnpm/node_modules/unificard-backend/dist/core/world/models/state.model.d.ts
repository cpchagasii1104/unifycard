import type { State, StateRow } from '../world.types';
export declare class StateModel {
    /**
     * Converte row do banco para objeto State
     */
    static fromRow(row: StateRow): State;
    /**
     * Converte array de rows para array de States
     */
    static fromRows(rows: StateRow[]): State[];
}
//# sourceMappingURL=state.model.d.ts.map