// backend/src/core/authorization/soft-block.errors.ts
// Erros explícitos para Soft-Block (Fase 3)

import type { SoftBlockReasonCode } from './soft-block.types';

export class SoftBlockError extends Error {
  public readonly reasonCode: SoftBlockReasonCode;
  public readonly details?: Record<string, any>;
  public readonly statusCode: number = 403;

  constructor(reasonCode: SoftBlockReasonCode, details?: Record<string, any>) {
    const message = `SOFT_BLOCK_ERROR: ${reasonCode}${details ? ` - ${JSON.stringify(details)}` : ''}`;
    super(message);
    this.name = 'SoftBlockError';
    this.reasonCode = reasonCode;
    this.details = details;
  }
}




