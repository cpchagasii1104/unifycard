import type { FastifyReply, FastifyRequest } from 'fastify';
type CreateCityBody = {
    name: string;
    state: string;
    timezone?: string | null;
    lat?: number | null;
    lng?: number | null;
    base_fare?: number | null;
    min_price?: number | null;
    price_per_km?: number | null;
    price_per_min?: number | null;
    enabled?: boolean;
    allows_multi_stop?: boolean;
};
export declare class CitiesController {
    createCity(req: FastifyRequest<{
        Body: CreateCityBody;
    }>, reply: FastifyReply): Promise<never>;
    listCities(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const citiesController: CitiesController;
export {};
//# sourceMappingURL=cities.controller.d.ts.map