// backend/src/core/auth/webauthn.types.ts
// SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Types
// Tipos para step-up authentication via WebAuthn/Passkeys

/**
 * Credencial WebAuthn registrada
 */
export interface WebAuthnCredential {
  id: string;
  tenantId: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  friendlyName?: string | null;
  createdAt: string;
  lastUsedAt?: Date | null;
}

/**
 * Challenge temporário para verificação
 */
export interface WebAuthnChallenge {
  id: string;
  tenantId: string;
  userId: string;
  challenge: string;
  expiresAt: Date;
  createdAt: string;
}

/**
 * Input para criar challenge
 */
export interface CreateChallengeInput {
  userId: string;
}

/**
 * Input para verificar assertion
 */
export interface VerifyAssertionInput {
  userId: string;
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle?: string;
}

/**
 * Resultado da verificação
 */
export interface VerifyResult {
  isVerified: boolean;
  error?: string;
  errorCode?: 'WEBAUTHN_NOT_REGISTERED' | 'INVALID_ASSERTION' | 'CHALLENGE_EXPIRED' | 'CHALLENGE_NOT_FOUND';
}








