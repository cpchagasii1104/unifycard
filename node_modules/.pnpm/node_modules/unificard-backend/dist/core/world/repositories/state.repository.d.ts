import type { StateRow } from '../world.types';
export declare class StateRepository {
    /**
     * Busca todos os estados de um país
     */
    findByCountryId(countryId: string): Promise<StateRow[]>;
    /**
     * Busca estado por ID
     */
    findById(stateId: string): Promise<StateRow | undefined>;
}
//# sourceMappingURL=state.repository.d.ts.map