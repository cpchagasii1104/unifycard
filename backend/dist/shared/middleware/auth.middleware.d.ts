import type { Request, Response, NextFunction } from "express";
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email?: string;
                role?: string;
                permissions?: string[];
                tenantId?: string;
            };
            tenant?: {
                id: string;
                name?: string;
            };
        }
    }
}
export declare function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.middleware.d.ts.map