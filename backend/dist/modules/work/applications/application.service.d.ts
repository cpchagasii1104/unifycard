import type { JobApplication, CreateApplicationInput, UpdateApplicationInput } from '../work.types';
declare class ApplicationService {
    private toApplication;
    getById(tenantId: string, applicationId: string): Promise<JobApplication | null>;
    createApplication(tenantId: string, workerId: string, jobId: string, input: CreateApplicationInput): Promise<JobApplication>;
    updateApplication(tenantId: string, applicationId: string, input: UpdateApplicationInput): Promise<JobApplication>;
    listApplications(tenantId: string, filters: any): Promise<{
        applications: JobApplication[];
        total: number;
    }>;
}
export declare const applicationService: ApplicationService;
export {};
//# sourceMappingURL=application.service.d.ts.map