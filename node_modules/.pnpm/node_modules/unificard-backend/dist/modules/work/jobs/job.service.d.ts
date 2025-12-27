import type { Job, CreateJobInput, UpdateJobInput } from '../work.types';
declare class JobService {
    private toJob;
    getById(tenantId: string, jobId: string): Promise<Job | null>;
    createJob(tenantId: string, clientUserId: string, input: CreateJobInput): Promise<Job>;
    updateJob(tenantId: string, jobId: string, input: UpdateJobInput): Promise<Job>;
    listJobs(tenantId: string, filters: any): Promise<{
        jobs: Job[];
        total: number;
    }>;
}
export declare const jobService: JobService;
export {};
//# sourceMappingURL=job.service.d.ts.map