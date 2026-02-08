// backend/src/core/auth/webauthn.repository.ts
// SPRINT 36.3: BANK SAFETY LAYER - WebAuthn Repository

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type { WebAuthnCredential, WebAuthnChallenge } from './webauthn.types';

interface WebAuthnCredentialRow {
  id: string;
  tenant_id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: string;
  friendly_name: string | null;
  createdAt: Date;
  last_usedAt: Date | null;
}

interface WebAuthnChallengeRow {
  id: string;
  tenant_id: string;
  user_id: string;
  challenge: string;
  expiresAt: Date;
  createdAt: Date;
}

class WebAuthnRepository {
  /**
   * Converte row para WebAuthnCredential
   */
  private toCredential(row: WebAuthnCredentialRow): WebAuthnCredential {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      credentialId: row.credential_id,
      publicKey: row.public_key,
      counter: parseInt(row.counter, 10),
      friendlyName: row.friendly_name,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.last_usedAt,
    };
  }

  /**
   * Converte row para WebAuthnChallenge
   */
  private toChallenge(row: WebAuthnChallengeRow): WebAuthnChallenge {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      challenge: row.challenge,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Busca credenciais de um usuário
   */
  async getCredentialsByUser(
    tenantId: string,
    userId: string
  ): Promise<WebAuthnCredential[]> {
    const rows = await runQueriesWithTenant<WebAuthnCredentialRow>(
      tenantId,
      `
      SELECT id, tenant_id, user_id, credential_id, public_key, counter,
             friendly_name, createdAt, last_usedAt
      FROM webauthn_credentials
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY createdAt DESC
      `,
      [tenantId, userId]
    );

    return rows.map((row) => this.toCredential(row));
  }

  /**
   * Busca credencial por credential_id
   */
  async getCredentialById(
    tenantId: string,
    credentialId: string
  ): Promise<WebAuthnCredential | null> {
    const row = await runQueryWithTenant<WebAuthnCredentialRow>(
      tenantId,
      `
      SELECT id, tenant_id, user_id, credential_id, public_key, counter,
             friendly_name, createdAt, last_usedAt
      FROM webauthn_credentials
      WHERE tenant_id = $1 AND credential_id = $2
      LIMIT 1
      `,
      [tenantId, credentialId]
    );

    return row ? this.toCredential(row) : null;
  }

  /**
   * Verifica se usuário tem credencial registrada
   */
  async hasCredential(tenantId: string, userId: string): Promise<boolean> {
    const count = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*)::text as count
      FROM webauthn_credentials
      WHERE tenant_id = $1 AND user_id = $2
      `,
      [tenantId, userId]
    );

    return parseInt(count?.count || '0', 10) > 0;
  }

  /**
   * Cria challenge temporário
   */
  async createChallenge(
    tenantId: string,
    userId: string,
    challenge: string,
    expiresAt: Date
  ): Promise<WebAuthnChallenge> {
    const row = await runQueryWithTenant<WebAuthnChallengeRow>(
      tenantId,
      `
      INSERT INTO webauthn_challenges (tenant_id, user_id, challenge, expiresAt)
      VALUES ($1, $2, $3, $4)
      RETURNING id, tenant_id, user_id, challenge, expiresAt, createdAt
      `,
      [tenantId, userId, challenge, expiresAt]
    );

    if (!row) {
      throw new Error('Erro ao criar challenge');
    }

    return this.toChallenge(row);
  }

  /**
   * Busca challenge válido (não expirado)
   */
  async getValidChallenge(
    tenantId: string,
    userId: string,
    challenge: string
  ): Promise<WebAuthnChallenge | null> {
    const row = await runQueryWithTenant<WebAuthnChallengeRow>(
      tenantId,
      `
      SELECT id, tenant_id, user_id, challenge, expiresAt, createdAt
      FROM webauthn_challenges
      WHERE tenant_id = $1
        AND user_id = $2
        AND challenge = $3
        AND expiresAt > NOW()
      ORDER BY createdAt DESC
      LIMIT 1
      `,
      [tenantId, userId, challenge]
    );

    return row ? this.toChallenge(row) : null;
  }

  /**
   * Remove challenge (após uso ou expiração)
   */
  async deleteChallenge(
    tenantId: string,
    challengeId: string
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      DELETE FROM webauthn_challenges
      WHERE id = $1 AND tenant_id = $2
      `,
      [challengeId, tenantId]
    );
  }

  /**
   * Atualiza counter e last_usedAt de uma credencial
   */
  async updateCredentialUsage(
    tenantId: string,
    credentialId: string,
    newCounter: number
  ): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
      UPDATE webauthn_credentials
      SET counter = $1, last_usedAt = NOW()
      WHERE tenant_id = $2 AND credential_id = $3
      `,
      [newCounter, tenantId, credentialId]
    );
  }
}

export const webauthnRepository = new WebAuthnRepository();








