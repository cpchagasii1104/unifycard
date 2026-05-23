// backend/src/core/http/canonical-http-error.ts
// §9.5 NOMENCLATURA_CANONICA — envelope { error, meta }

import { randomUUID } from 'crypto';

export interface CanonicalHttpErrorJson {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    help?: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

export function buildCanonicalHttpErrorPayload(
  code: string,
  message: string,
  requestId: string,
  options?: {
    details?: Record<string, unknown>;
    help?: string;
  }
): CanonicalHttpErrorJson {
  const rid = requestId?.trim() ? requestId : randomUUID();
  const err: CanonicalHttpErrorJson['error'] = { code, message };
  if (options?.details && Object.keys(options.details).length > 0) {
    err.details = options.details;
  }
  if (options?.help) {
    err.help = options.help;
  }
  return {
    error: err,
    meta: {
      requestId: rid,
      timestamp: new Date().toISOString(),
    },
  };
}