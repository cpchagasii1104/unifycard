import { EventBus } from '@core/events/event-bus';
type CityRow = {
    city_id: string;
    tenant_id: string;
    name: string;
    state: string;
    timezone: string | null;
    lat: number | null;
    lng: number | null;
    base_fare: number | null;
    min_price: number | null;
    price_per_km: number | null;
    price_per_min: number | null;
    enabled: boolean;
    allows_multi_stop: boolean;
};
export declare class CitiesService {
    private eventBusInstance;
    constructor(eventBusInstance?: EventBus);
    createCity(tenantId: string, data: any): Promise<CityRow>;
    updateCity(tenantId: string, cityId: string, patch: any): Promise<CityRow>;
    listCities(tenantId: string): Promise<CityRow[]>;
    getCity(tenantId: string, cityId: string): Promise<CityRow>;
    deleteCity(tenantId: string, cityId: string): Promise<{
        ok: boolean;
    }>;
}
export declare const citiesService: CitiesService;
export {};
//# sourceMappingURL=cities.service.d.ts.map