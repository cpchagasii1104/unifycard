// frontend/src/utils/webauthn.ts
// SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Step-Up Utility
// Util para step-up authentication via WebAuthn/Passkeys

import { apiFetch } from '../api/client';
import { atobBase64Url } from './jwt';

/**
 * ⚠️ SCAFFOLDING: Este fluxo exige credencial WebAuthn registrada para enforcement real.
 * Se não houver credencial, retorna erro explícito.
 * Não cria falsa sensação de segurança.
 */

export interface StepUpResult {
  verified: boolean;
  error?: string;
  errorCode?: 'WEBAUTHN_NOT_REGISTERED' | 'USER_CANCELLED' | 'NOT_SUPPORTED' | 'UNKNOWN_ERROR';
}

/**
 * Inicia step-up authentication via WebAuthn
 *
 * Fluxo:
 * 1. Solicita challenge do backend
 * 2. Usa navigator.credentials.get() para obter assertion
 * 3. Envia assertion para backend para verificação
 *
 * ⚠️ Se não houver credencial registrada, retorna erro explícito.
 * ⚠️ Se usuário cancelar, retorna erro explícito.
 * ⚠️ Não finge sucesso.
 */
export async function startStepUp(
  userId: string,
  _apiBaseUrl: string = 'http://localhost:3000'
): Promise<StepUpResult> {
  try {
    // 1. Verificar suporte do browser
    if (!window.PublicKeyCredential) {
      return {
        verified: false,
        error: 'WebAuthn não é suportado neste navegador',
        errorCode: 'NOT_SUPPORTED',
      };
    }

    // 2. Solicitar challenge do backend (apiFetch → tenant + ActionContext)
    let challengeData: { challenge: string };
    try {
      const challengeResponse = await apiFetch('/api/auth/webauthn/challenge', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      challengeData = await challengeResponse.json();
    } catch (e: any) {
      if (e?.errorCode === 'WEBAUTHN_NOT_REGISTERED') {
        return {
          verified: false,
          error: 'Credencial WebAuthn não registrada',
          errorCode: 'WEBAUTHN_NOT_REGISTERED',
        };
      }

      const msg = e?.message || 'Erro ao criar challenge';
      return {
        verified: false,
        error: msg,
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    // 3. Obter assertion do authenticator
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge: Uint8Array.from(atobBase64Url(challengeData.challenge), (c) => c.charCodeAt(0)),
      timeout: 60000, // 60 segundos
      rpId: window.location.hostname,
      allowCredentials: [], // Aceitar qualquer credencial do usuário
      userVerification: 'required',
    };

    let assertion: PublicKeyCredential;
    try {
      assertion = (await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions,
      })) as PublicKeyCredential;
    } catch (error: any) {
      // Usuário cancelou ou erro do authenticator
      if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
        return {
          verified: false,
          error: 'Autenticação cancelada pelo usuário',
          errorCode: 'USER_CANCELLED',
        };
      }

      throw error;
    }

    if (!assertion) {
      return {
        verified: false,
        error: 'Nenhuma credencial retornada',
        errorCode: 'UNKNOWN_ERROR',
      };
    }

    // 4. Extrair dados da assertion
    const response = assertion.response as AuthenticatorAssertionResponse;

    const assertionData = {
      userId,
      credentialId: btoa(
        String.fromCharCode(...new Uint8Array(assertion.rawId))
      ),
      authenticatorData: btoa(
        String.fromCharCode(...new Uint8Array(response.authenticatorData))
      ),
      clientDataJSON: btoa(
        String.fromCharCode(...new Uint8Array(response.clientDataJSON))
      ),
      signature: btoa(
        String.fromCharCode(...new Uint8Array(response.signature))
      ),
      userHandle: response.userHandle
        ? btoa(String.fromCharCode(...new Uint8Array(response.userHandle)))
        : undefined,
    };

    // 5. Enviar assertion para backend para verificação
    try {
      const verifyResponse = await apiFetch('/api/auth/webauthn/verify', {
        method: 'POST',
        body: JSON.stringify(assertionData),
      });
      const verifyData = await verifyResponse.json();

      return {
        verified: verifyData.verified === true,
      };
    } catch (e: any) {
      return {
        verified: false,
        error: e?.message || 'Erro ao verificar assertion',
        errorCode: e?.errorCode || 'UNKNOWN_ERROR',
      };
    }
  } catch (error: any) {
    console.error('[WebAuthn] Erro no step-up:', error);
    return {
      verified: false,
      error: error.message || 'Erro desconhecido no step-up',
      errorCode: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Verifica se usuário tem credencial WebAuthn registrada
 */
export async function checkWebAuthnStatus(
  userId: string,
  _apiBaseUrl: string = 'http://localhost:3000'
): Promise<{ hasCredential: boolean }> {
  try {
    const response = await apiFetch(`/api/auth/webauthn/status/${userId}`, {
      method: 'GET',
    });
    const data = await response.json();
    return { hasCredential: data.hasCredential === true };
  } catch (error) {
    console.error('[WebAuthn] Erro ao verificar status:', error);
    return { hasCredential: false };
  }
}
