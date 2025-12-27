import type { Skill, CreateSkillInput, UpdateSkillInput } from '../work.types';
declare class SkillService {
    private toSkill;
    createSkill(tenantId: string, input: CreateSkillInput): Promise<Skill>;
    updateSkill(tenantId: string, skillId: string, input: UpdateSkillInput): Promise<Skill>;
    deleteSkill(tenantId: string, skillId: string): Promise<void>;
    getById(tenantId: string, skillId: string): Promise<Skill | null>;
    listSkills(tenantId: string, filters?: {
        category?: string;
        search?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        skills: Skill[];
        total: number;
    }>;
}
export declare const skillService: SkillService;
export {};
//# sourceMappingURL=skill.service.d.ts.map