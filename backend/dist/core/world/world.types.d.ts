export interface Country {
    countryId: string;
    code: string;
    name: string;
    nameEn: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface State {
    stateId: string;
    countryId: string;
    code: string;
    name: string;
    nameEn: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface City {
    cityId: string;
    stateId: string;
    name: string;
    nameEn: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface CountryRow {
    country_id: string;
    code: string;
    name: string;
    name_en: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface StateRow {
    state_id: string;
    country_id: string;
    code: string;
    name: string;
    name_en: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface CityRow {
    city_id: string;
    state_id: string;
    name: string;
    name_en: string | null;
    latitude: number | null;
    longitude: number | null;
    created_at: Date;
    updated_at: Date;
}
export interface CityFullPath {
    city: {
        cityId: string;
        name: string;
        nameEn: string | null;
    };
    state: {
        stateId: string;
        name: string;
        nameEn: string | null;
        code: string;
    };
    country: {
        countryId: string;
        name: string;
        nameEn: string | null;
        code: string;
    };
}
//# sourceMappingURL=world.types.d.ts.map