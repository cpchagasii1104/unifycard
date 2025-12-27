import type { FastifyInstance } from 'fastify';
import type { Post, CreatePostInput, FeedOptions, FeedResult } from './social.types';
declare class SocialService {
    private repository;
    /**
     * Cria um novo post com análise automática de intent e categorias
     */
    createPost(fastify: FastifyInstance, tenantId: string, globalUserId: string, input: CreatePostInput): Promise<Post>;
    /**
     * Busca post por ID
     */
    getPost(tenantId: string, postId: string): Promise<Post | null>;
    /**
     * Busca feed de posts
     */
    getFeed(tenantId: string, options?: FeedOptions): Promise<FeedResult>;
    /**
     * Vincula um job a um post
     */
    linkJobToPost(postId: string, jobId: string, tenantId: string): Promise<void>;
}
export declare const socialService: SocialService;
export {};
//# sourceMappingURL=social.service.d.ts.map