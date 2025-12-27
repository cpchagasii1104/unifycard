import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
/**
 * Middleware para validar o body da requisição com Zod
 */
export declare function validateBody<T extends z.ZodType>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware para validar os params da requisição com Zod
 */
export declare function validateParams<T extends z.ZodType>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware para validar a query da requisição com Zod
 */
export declare function validateQuery<T extends z.ZodType>(schema: T): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validation.middleware.d.ts.map