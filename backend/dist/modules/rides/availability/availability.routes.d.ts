import type { FastifyPluginAsync } from 'fastify';
export interface OnlineBody {
    lat: number;
    lng: number;
    cityId: string;
    vehicleId?: string | null;
}
export interface LocationBody {
    lat: number;
    lng: number;
}
declare const availabilityRoutes: FastifyPluginAsync;
export default availabilityRoutes;
//# sourceMappingURL=availability.routes.d.ts.map