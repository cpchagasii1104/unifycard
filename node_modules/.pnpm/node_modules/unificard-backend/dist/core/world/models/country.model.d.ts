import type { Country, CountryRow } from '../world.types';
export declare class CountryModel {
    /**
     * Converte row do banco para objeto Country
     */
    static fromRow(row: CountryRow): Country;
    /**
     * Converte array de rows para array de Countries
     */
    static fromRows(rows: CountryRow[]): Country[];
}
//# sourceMappingURL=country.model.d.ts.map