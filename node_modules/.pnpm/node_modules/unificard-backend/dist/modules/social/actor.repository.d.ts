export interface ActorRow {
    actor_id: string;
    tenant_id: string;
    actor_type: 'user' | 'page' | 'group' | 'channel';
    user_id: string | null;
    company_id: string | null;
    group_id: string | null;
    display_name: string;
    slug: string | null;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
    metadata: any;
    created_at: string;
    updated_at: string;
}
export declare class ActorRepository {
    /**
     * Busca actor por ID
     */
    findById(tenantId: string, actorId: string): Promise<ActorRow | null>;
    /**
     * Busca ou cria actor para um usuário
     */
    findOrCreateUserActor(tenantId: string, userId: string, globalUserId: string): Promise<ActorRow>;
    /**
     * Busca ou cria actor para uma empresa (page)
     */
    findOrCreatePageActor(tenantId: string, companyId: string): Promise<ActorRow>;
    /**
     * Atualiza actor (avatar, cover, bio)
     */
    update(tenantId: string, actorId: string, updates: {
        display_name?: string;
        avatar_url?: string;
        cover_url?: string;
        bio?: string;
        metadata?: any;
    }): Promise<ActorRow>;
}
export declare const actorRepository: ActorRepository;
//# sourceMappingURL=actor.repository.d.ts.map