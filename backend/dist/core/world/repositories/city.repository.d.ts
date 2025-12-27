import type { CityRow } from '../world.types';
export declare class CityRepository {
    /**
     * Busca todas as cidades de um estado
     */
    findByStateId(stateId: string): Promise<CityRow[]>;
    /**
     * Busca cidade por ID
     */
    findById(cityId: string): Promise<CityRow | undefined>;
    /**
     * Busca cidades por termo (busca em nome e nome em inglês)
     */
    search(term: string, countryId?: string, stateId?: string, limit?: number, offset?: number): Promise<CityRow[]>;
}
//# sourceMappingURL=city.repository.d.ts.map