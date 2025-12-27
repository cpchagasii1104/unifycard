import type { Country, State, City, CityFullPath } from '../world.types';
declare class WorldService {
    private countryRepo;
    private stateRepo;
    private cityRepo;
    /**
     * Lista todos os países
     */
    getCountries(): Promise<Country[]>;
    /**
     * Busca país por ID
     */
    getCountryById(countryId: string): Promise<Country | null>;
    /**
     * Busca país por código ISO
     */
    getCountryByCode(code: string): Promise<Country | null>;
    /**
     * Lista todos os estados de um país
     */
    getStatesByCountry(countryId: string): Promise<State[]>;
    /**
     * Busca estado por ID
     */
    getStateById(stateId: string): Promise<State | null>;
    /**
     * Lista todas as cidades de um estado
     */
    getCitiesByState(stateId: string): Promise<City[]>;
    /**
     * Busca cidade por ID
     */
    getCityById(cityId: string): Promise<City | null>;
    /**
     * Busca cidades por termo
     */
    searchCities(term: string, options?: {
        countryId?: string;
        stateId?: string;
        limit?: number;
        offset?: number;
    }): Promise<City[]>;
    /**
     * Busca caminho completo de uma cidade (cidade → estado → país)
     */
    getCityFullPath(cityId: string): Promise<CityFullPath | null>;
}
export declare const worldService: WorldService;
export {};
//# sourceMappingURL=world.service.d.ts.map