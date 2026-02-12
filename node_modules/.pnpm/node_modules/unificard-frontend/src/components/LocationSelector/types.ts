// src/components/LocationSelector/types.ts
// Tipos do LocationSelector

export type LocationScope = 'national' | 'state' | 'city' | 'neighborhood';

export interface LocationValue {
  country_id?: string;
  state_id?: string;
  city_id?: string;
  neighborhood_id?: string;
}

export interface LocationSelectorProps {
  scope: LocationScope;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  required?: boolean;
  disabled?: boolean;
  labels?: {
    country?: string;
    state?: string;
    city?: string;
    neighborhood?: string;
  };
  className?: string;
  error?: string;
}

export interface LocationData {
  countries: Array<{ id: string; name: string }>;
  states: Array<{ id: string; name: string }>;
  cities: Array<{ id: string; name: string }>;
  neighborhoods: Array<{ id: string; name: string }>;
}

export interface LocationLoading {
  countries: boolean;
  states: boolean;
  cities: boolean;
  neighborhoods: boolean;
}







