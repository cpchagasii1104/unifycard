// src/core/root-config/root-config.types.ts

export interface RootConfig {
  id: string;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  timezone: string | null;
  currency: string | null;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}


// Database row types
export interface RootConfigRow {
  id: string;
  country_id: string | null;
  state_id: string | null;
  city_id: string | null;
  timezone: string | null;
  currency: string | null;
  languages: string[];
  created_at: string;
  updated_at: string;
}

export interface UpdateRootConfigInput {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  timezone?: string | null;
  currency?: string | null;
  languages?: string[];
}

export interface SetRegionInput {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
}

export interface SetLanguagesInput {
  languages: string[];
}



