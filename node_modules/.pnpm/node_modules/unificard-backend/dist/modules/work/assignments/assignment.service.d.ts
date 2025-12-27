import type { JobAssignment, CreateAssignmentInput, UpdateAssignmentInput } from '../work.types';
declare class AssignmentService {
    private toAssignment;
    getById(tenantId: string, assignmentId: string): Promise<JobAssignment | null>;
    createAssignment(tenantId: string, jobId: string, clientUserId: string, input: CreateAssignmentInput): Promise<JobAssignment>;
    updateAssignment(tenantId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<JobAssignment>;
    listAssignments(tenantId: string, filters: any): Promise<{
        assignments: JobAssignment[];
        total: number;
    }>;
    markAsCompleted(tenantId: string, assignmentId: string, reviewerUserId: string, reviewInput: {
        rating: number;
        comment?: string;
        qualityRating?: number;
        punctualityRating?: number;
        professionalismRating?: number;
    }, options?: {
        source?: string;
        metadata?: Record<string, any>;
    }): Promise<JobAssignment>;
}
export declare const assignmentService: AssignmentService;
export {};
//# sourceMappingURL=assignment.service.d.ts.map