export type UUID = string;
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };
export interface GeographyPoint {
  lat: number;
  lng: number;
}

