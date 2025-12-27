import type { City, CityRow } from '../world.types';
export declare class CityModel {
    /**
     * Converte row do banco para objeto City
     */
    static fromRow(row: CityRow): City;
    /**
     * Converte array de rows para array de Cities
     */
    static fromRows(rows: CityRow[]): City[];
}
//# sourceMappingURL=city.model.d.ts.map