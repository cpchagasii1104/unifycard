import type { Job } from '../work/work.types';
declare class SocialWorkService {
    /**
     * Resolve user_id local a partir de global_user_id
     */
    private resolveLocalUserId;
    /**
     * Cria um job automaticamente usando dados do post
     */
    createJobFromPost(postId: string, globalUserId: string, tenantId: string): Promise<Job>;
    /**
     * Retorna o job criado a partir de um post, caso exista
     */
    getWorkOfferForPost(postId: string, tenantId: string): Promise<Job | null>;
    /**
     * Resolve job a partir de um post
     * Valida se post existe, se tem jobId e se o job existe
     * Retorna o job ou null se não houver
     */
    resolveJobFromPost(postId: string, tenantId: string): Promise<Job | null>;
}
export declare const socialWorkService: SocialWorkService;
export {};
//# sourceMappingURL=social-work.service.d.ts.map