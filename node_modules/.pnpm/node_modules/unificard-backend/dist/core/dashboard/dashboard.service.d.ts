import type { DashboardData } from './dashboard.types';
declare class DashboardService {
    /**
     * Busca dados completos do dashboard para o usuário autenticado
     */
    getDashboard(tenantId: string, userId: string): Promise<DashboardData>;
}
export declare const dashboardService: DashboardService;
export {};
//# sourceMappingURL=dashboard.service.d.ts.map