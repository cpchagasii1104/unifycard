// frontend/src/api/compatibility.ts
// API client para Motor de Compatibilidade

import { apiFetchJson } from './client';
import type { CompatibilityInput, CompatibilityResult } from '../types/compatibility';

export async function evaluateCompatibility(
  input: CompatibilityInput
): Promise<CompatibilityResult> {
  return apiFetchJson<CompatibilityResult>('/compatibility/evaluate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

