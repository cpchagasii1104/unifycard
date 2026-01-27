// backend/src/core/auth/webauthn.service.ts
// SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Service
// SCAFFOLDING REALISTA: Step-up authentication via WebAuthn/Passkeys
//
// ⚠️ IMPORTANTE: Este fluxo exige credencial WebAuthn registrada para enforcement real.
// Se não houver credencial registrada, retorna erro explícito WEBAUTHN_NOT_REGISTERED.
// Não cria falsa sensação de segurança.
//
// ⚠️ SCAFFOLDING: Verificação de assinatura criptográfica ainda não implementada.
// Por enquanto, apenas verifica:
// - Credencial existe
// - Challenge é válido
// - Dados estão presentes
// Em produção, deve validar assinatura usando public_key e biblioteca WebAuthn adequada.

import { randomBytes } from 'crypto';
import { webauthnRepository } from './webauthn.repository';
import type {
  CreateChallengeInput,
  VerifyAssertionInput,
  VerifyResult,
} from './webauthn.types';

/**
 * Duração do challenge (5 minutos)
 */
const CHALLENGE_EXPIRATION_MS = 5 * 60 * 1000;

class WebAuthnService {
  /**
   * Cria challenge para step-up authentication
   * 
   * ⚠️ SCAFFOLDING: Verifica se há credencial registrada.
   * Se não houver, retorna erro explícito.
   */
  async createChallenge(
    tenantId: string,
    input: CreateChallengeInput
  ): Promise<{
    challenge: string;
    challengeId: string;
    expiresAt: Date;
    hasCredential: boolean;
  }> {
    // Verificar se usuário tem credencial registrada
    const hasCredential = await webauthnRepository.hasCredential(
      tenantId,
      input.userId
    );

    if (!hasCredential) {
      const error = new Error('WebAuthn credential not registered') as Error & {
        statusCode?: number;
        errorCode?: string;
      };
      error.statusCode = 400;
      error.errorCode = 'WEBAUTHN_NOT_REGISTERED';
      throw error;
    }

    // Gerar challenge aleatório (base64)
    const challengeBytes = randomBytes(32);
    const challenge = challengeBytes.toString('base64url');

    // Calcular expiração
    const expiresAt = new Date(Date.now() + CHALLENGE_EXPIRATION_MS);

    // Armazenar challenge
    const challengeRecord = await webauthnRepository.createChallenge(
      tenantId,
      input.userId,
      challenge,
      expiresAt
    );

    return {
      challenge,
      challengeId: challengeRecord.id,
      expiresAt,
      hasCredential: true,
    };
  }

  /**
   * Verifica assertion WebAuthn
   * 
   * ⚠️ SCAFFOLDING: Verificação simplificada.
   * Em produção, deve validar:
   * - Assinatura criptográfica
   * - Counter (prevenir replay)
   * - Challenge (prevenir replay)
   * - Origin (prevenir MITM)
   * 
   * Por enquanto, retorna verified=true apenas se:
   * - Credencial existe
   * - Challenge é válido
   * 
   * ⚠️ NÃO é verificação real de assinatura ainda.
   */
  async verifyAssertion(
    tenantId: string,
    input: VerifyAssertionInput
  ): Promise<VerifyResult> {
    // 1. Verificar se credencial existe
    const credential = await webauthnRepository.getCredentialById(
      tenantId,
      input.credentialId
    );

    if (!credential) {
      return {
        verified: false,
        error: 'Credential not found',
        errorCode: 'WEBAUTHN_NOT_REGISTERED',
      };
    }

    // 2. Verificar se challenge é válido (extrair do clientDataJSON)
    // Por enquanto, vamos assumir que o challenge está no clientDataJSON
    // Em produção, deve ser parseado e validado
    let challengeFromClient: string | null = null;
    try {
      const clientData = JSON.parse(
        Buffer.from(input.clientDataJSON, 'base64url').toString('utf-8')
      );
      challengeFromClient = clientData.challenge;
    } catch {
      return {
        verified: false,
        error: 'Invalid clientDataJSON',
        errorCode: 'INVALID_ASSERTION',
      };
    }

    // 3. Buscar challenge válido
    const challenge = await webauthnRepository.getValidChallenge(
      tenantId,
      input.userId,
      challengeFromClient
    );

    if (!challenge) {
      return {
        verified: false,
        error: 'Challenge expired or not found',
        errorCode: 'CHALLENGE_EXPIRED',
      };
    }

    // 4. ⚠️ SCAFFOLDING: Verificação simplificada
    // Em produção, deve validar assinatura criptográfica usando public_key
    // Por enquanto, apenas verifica que:
    // - Credencial existe
    // - Challenge é válido
    // - Dados estão presentes
    const hasRequiredData =
      input.authenticatorData &&
      input.clientDataJSON &&
      input.signature;

    if (!hasRequiredData) {
      return {
        verified: false,
        error: 'Missing required assertion data',
        errorCode: 'INVALID_ASSERTION',
      };
    }

    // 5. ⚠️ HOTFIX: Verificação criptográfica REAL ainda não implementada
    // NUNCA retornar verified=true enquanto verificação real não existir
    // TODO: Validar assinatura criptográfica
    // - Parsear authenticatorData
    // - Verificar counter (deve ser > credential.counter)
    // - Verificar assinatura usando public_key
    // - Verificar origin no clientDataJSON

    // 6. HOTFIX: Não atualizar counter nem remover challenge
    // (pois verificação não foi realmente feita)

    // 7. HOTFIX: Retornar erro explícito indicando que verificação não está implementada
    return {
      verified: false,
      error: 'WebAuthn cryptographic verification not yet implemented',
      errorCode: 'WEBAUTHN_VERIFY_NOT_IMPLEMENTED',
    };
  }

  /**
   * Verifica se usuário tem credencial registrada
   */
  async hasCredential(tenantId: string, userId: string): Promise<boolean> {
    return await webauthnRepository.hasCredential(tenantId, userId);
  }
}

export const webauthnService = new WebAuthnService();

