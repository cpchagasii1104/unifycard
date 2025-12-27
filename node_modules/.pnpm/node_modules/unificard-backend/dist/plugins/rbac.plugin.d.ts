import { FastifyPluginAsync } from 'fastify';
import type { PermissionString } from '@core/rbac/rbac.types';
declare module 'fastify' {
    interface FastifyInstance {
        requirePermission: (permissions: PermissionString[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireAnyPermission: (permissions: PermissionString[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
        requireRole: (roles: string[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
declare const _default: FastifyPluginAsync;
export default _default;
//# sourceMappingURL=rbac.plugin.d.ts.map