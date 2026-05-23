// backend/src/services/employee/EmployeeService.ts
// LEGACY — BLOQUEADO em 2026-04-28 (C63 FASE 2A)
// DECISION-0014: schedules/schedule_slots não são SSOT temporal canônico.
// SSOT canônico: unified_availability + unified_bookings (core/availability/)

export class EmployeeLegacyError extends Error {
  constructor(method: string) {
    super(
      `[C63] EmployeeService.${method}() está BLOQUEADO. ` +
      `Use unified-availability.service.ts. DECISION-0014.`
    );
    this.name = 'EmployeeLegacyError';
  }
}

export class EmployeeService {
  async hireEmployee(_params: {
    companyId: string;
    userId: string;
    tenantId: string;
    role: 'owner' | 'admin' | 'manager' | 'staff';
  }): Promise<never> {
    throw new EmployeeLegacyError('hireEmployee');
  }

  async terminateEmployee(_params: {
    companyId: string;
    employeeId: string;
    tenantId: string;
    reason?: string;
  }): Promise<never> {
    throw new EmployeeLegacyError('terminateEmployee');
  }
}
