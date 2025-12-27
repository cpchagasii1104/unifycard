import type { CountryRow } from '../world.types';
export declare class CountryRepository {
    /**
     * Busca todos os países
     */
    findAll(): Promise<CountryRow[]>;
    /**
     * Busca país por ID
     */
    findById(countryId: string): Promise<CountryRow | undefined>;
    /**
     * Busca país por código ISO
     */
    findByCode(code: string): Promise<CountryRow | undefined>;
}
//# sourceMappingURL=country.repository.d.ts.map