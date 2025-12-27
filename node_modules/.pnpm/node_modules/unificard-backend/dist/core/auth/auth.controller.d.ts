import type { FastifyRequest, FastifyReply } from 'fastify';
export declare class AuthController {
    register(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    login(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    refreshToken(req: FastifyRequest, reply: FastifyReply): Promise<never>;
    logout(req: FastifyRequest, reply: FastifyReply): Promise<never>;
}
export declare const authController: AuthController;
//# sourceMappingURL=auth.controller.d.ts.map