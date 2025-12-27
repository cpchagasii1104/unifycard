interface EmploymentRow {
    company_employee_id: string;
    company_id: string;
    global_user_id: string;
    tenant_id: string;
    started_at: Date;
    ended_at: Date | null;
    role: string;
    can_manage_schedule: boolean;
    can_manage_services: boolean;
    metadata: Record<string, any>;
    created_at: Date;
    updated_at: Date;
}
export declare class EmployeeService {
    /**
     * Contrata funcionário
     * 🔴 CRÍTICO: Cria agenda pessoal automaticamente
     */
    hireEmployee(params: {
        companyId: string;
        userId: string;
        tenantId: string;
        role: 'owner' | 'admin' | 'manager' | 'staff';
    }): Promise<EmploymentRow>;
    /**
     * Demite funcionário
     */
    terminateEmployee(params: {
        companyId: string;
        employeeId: string;
        tenantId: string;
        reason?: string;
    }): Promise<{
        success: boolean;
    }>;
}
export {};
//# sourceMappingURL=EmployeeService.d.ts.map