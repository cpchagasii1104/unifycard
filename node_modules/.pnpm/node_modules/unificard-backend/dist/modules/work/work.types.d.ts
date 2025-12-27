export interface WorkerRow {
    worker_id: string;
    tenant_id: string;
    user_id: string;
    bio: string | null;
    hourly_rate: string | null;
    location: unknown | null;
    availability: Record<string, string[]> | null;
    reputation_score: string | null;
    total_jobs_completed: number;
    total_jobs_cancelled: number;
    no_show_count: number;
    total_earnings: string | null;
    response_time_avg_minutes: number | null;
    is_active: boolean;
    is_verified: boolean;
    created_at: Date;
    updated_at: Date;
}
export interface SkillRow {
    skill_id: string;
    tenant_id: string;
    name: string;
    category: string | null;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface JobRow {
    job_id: string;
    tenant_id: string;
    client_user_id: string;
    title: string;
    description: string | null;
    required_skills: string[] | null;
    location: unknown | null;
    budget_min: string | null;
    budget_max: string | null;
    scheduled_at: Date | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}
export interface JobApplicationRow {
    application_id: string;
    tenant_id: string;
    job_id: string;
    worker_id: string;
    proposed_rate: string | null;
    message: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
}
export interface JobAssignmentRow {
    assignment_id: string;
    tenant_id: string;
    job_id: string;
    worker_id: string;
    client_user_id: string;
    agreed_rate: string | null;
    payment_type: string;
    status: string;
    payment_transaction_id: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface Worker {
    workerId: string;
    tenantId: string;
    userId: string;
    bio?: string;
    hourlyRate?: number;
    availability: Record<string, string[]>;
    reputationScore: number;
    totalJobsCompleted: number;
    totalJobsCancelled: number;
    noShowCount: number;
    totalEarnings: number;
    responseTimeAvgMinutes?: number;
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    reputation?: unknown;
}
export interface Skill {
    skillId: string;
    tenantId: string;
    name: string;
    category: string | null;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Job {
    jobId: string;
    tenantId: string;
    clientUserId: string;
    title: string;
    description?: string;
    requiredSkills: string[];
    budgetMin?: number;
    budgetMax?: number;
    scheduledAt?: Date | null;
    location: unknown | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    clientReputation?: unknown;
}
export interface JobApplication {
    applicationId: string;
    tenantId: string;
    jobId: string;
    workerId: string;
    proposedRate: number;
    message?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    workerReputation?: unknown;
}
export interface JobAssignment {
    assignmentId: string;
    tenantId: string;
    jobId: string;
    workerId: string;
    clientUserId: string;
    agreedRate: number;
    paymentType: string;
    status: string;
    paymentTransactionId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateWorkerInput {
    bio?: string;
    hourlyRate?: number;
    location?: {
        latitude: number;
        longitude: number;
    };
    availability?: Record<string, string[]>;
}
export interface UpdateWorkerInput {
    bio?: string;
    hourlyRate?: number;
    location?: {
        latitude: number;
        longitude: number;
    };
    availability?: Record<string, string[]>;
    isActive?: boolean;
}
export interface CreateSkillInput {
    name: string;
    category: string;
    description?: string;
}
export interface UpdateSkillInput {
    name?: string;
    category?: string;
    description?: string;
}
export interface CreateJobInput {
    title: string;
    description: string;
    requiredSkills: string[];
    budgetMin?: number;
    budgetMax?: number;
    scheduledAt?: string;
    location?: {
        latitude: number;
        longitude: number;
    };
}
export interface UpdateJobInput {
    title?: string;
    description?: string;
    budgetMin?: number;
    budgetMax?: number;
    scheduledAt?: string;
    status?: string;
}
export interface CreateApplicationInput {
    proposedRate: number;
    message?: string;
}
export interface UpdateApplicationInput {
    status?: string;
}
export interface CreateAssignmentInput {
    workerId: string;
    agreedRate: number;
    paymentType: 'fixed' | 'hourly';
}
export interface UpdateAssignmentInput {
    status?: string;
}
export interface SearchWorkersFilters {
    skillId?: string;
    isActive?: boolean;
    minReputation?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
    offset?: number;
}
//# sourceMappingURL=work.types.d.ts.map