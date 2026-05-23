// src/core/world/world.types.ts

export interface Country {
  countryId: string;
  code: string; // ISO 3166-1 alpha-2 (ex: "BR", "US")
  name: string;
  nameEn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface State {
  stateId: string;
  countryId: string;
  code: string; // Código do estado (ex: "SP", "RJ")
  name: string;
  nameEn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface City {
  cityId: string;
  stateId: string;
  name: string;
  nameEn: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
}

// Database row types
export interface CountryRow {
  country_id: string;
  code: string;
  name: string;
  name_en: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StateRow {
  state_id: string;
  country_id: string;
  code: string;
  name: string;
  name_en: string | null;
  created_at: string;
  updated_at: string;
}

export interface CityRow {
  city_id: string;
  state_id: string;
  name: string;
  name_en: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
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



