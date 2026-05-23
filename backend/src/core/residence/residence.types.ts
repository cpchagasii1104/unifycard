// src/core/residence/residence.types.ts

export interface UserResidence {
  globalUserId: string;
  countryId: string | null;
  stateId: string | null;
  cityId: string | null;
  timezone: string | null;
  currency: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserResidenceRow {
  global_user_id: string;
  country_id: string | null;
  state_id: string | null;
  city_id: string | null;
  timezone: string | null;
  currency: string;
  languages: string[];
  created_at: Date;
  updated_at: Date;
}

export interface SetResidenceInput {
  countryId?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  timezone?: string | null;
  currency?: string;
  languages?: string[];
}

export interface ResidenceResponse {
  globalUserId: string;
  country: {
    countryId: string;
    name: string;
    code: string;
  } | null;
  state: {
    stateId: string;
    name: string;
    code: string;
  } | null;
  city: {
    cityId: string;
    name: string;
  } | null;
  timezone: string | null;
  currency: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
}


















