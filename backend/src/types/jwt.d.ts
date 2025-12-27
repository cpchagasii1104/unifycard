import 'jsonwebtoken';
import type { JwtPayload as AuthJwtPayload } from '@core/auth/auth.types';

declare module 'jsonwebtoken' {
  // Usa JwtPayload de auth.types.ts como fonte única de verdade
  export interface JwtPayload extends AuthJwtPayload {}
}

