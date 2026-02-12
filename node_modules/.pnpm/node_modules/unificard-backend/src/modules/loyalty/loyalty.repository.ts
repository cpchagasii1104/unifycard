// backend/src/modules/loyalty/loyalty.repository.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import type {
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LoyaltyAccountStatus,
  LoyaltyLedgerEntryType,
} from './loyalty.types';

interface LoyaltyAccountRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  status: string;
  points_balance: string;
  lifetime_earned: string;
  lifetime_redeemed: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

interface LoyaltyLedgerRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  entry_type: string;
  points: string;
  reference_type: string | null;
  reference_id: string | null;
  reason_code: string | null;
  description: string | null;
  created_by_actor_id: string | null;
  created_by_user_id: string | null;
  createdAt: Date;
}

class LoyaltyRepository {
  private toLoyaltyAccount(row: LoyaltyAccountRow): LoyaltyAccount {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      status: row.status as LoyaltyAccountStatus,
      pointsBalance: parseInt(row.points_balance, 10),
      lifetimeEarned: parseInt(row.lifetime_earned, 10),
      lifetimeRedeemed: parseInt(row.lifetime_redeemed, 10),
      metadata: row.metadata || {},
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toLoyaltyLedgerEntry(row: LoyaltyLedgerRow): LoyaltyLedgerEntry {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      entryType: row.entry_type as LoyaltyLedgerEntryType,
      points: parseInt(row.points, 10),
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      reasonCode: row.reason_code,
      description: row.description,
      createdByActorId: row.created_by_actor_id,
      createdByUserId: row.created_by_user_id,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async getOrCreateAccount(tenantId: string, contactId: string): Promise<LoyaltyAccount> {
    // Tentar buscar existente
    const existing = await this.getAccountByContact(tenantId, contactId);
    if (existing) {
      return existing;
    }

    // Criar novo
    const row = await runQueryWithTenant<LoyaltyAccountRow>(
      tenantId,
      `
      INSERT INTO loyalty_accounts (tenant_id, contact_id, status, points_balance, lifetime_earned, lifetime_redeemed, metadata)
      VALUES ($1, $2, 'ACTIVE', 0, 0, 0, '{}'::jsonb)
      ON CONFLICT (tenant_id, contact_id) DO UPDATE SET updatedAt = NOW()
      RETURNING id, tenant_id, contact_id, status, points_balance, lifetime_earned, lifetime_redeemed, metadata, createdAt, updatedAt
      `,
      [tenantId, contactId]
    );

    if (!row) {
      throw new Error('Erro ao criar conta de fidelidade');
    }

    return this.toLoyaltyAccount(row);
  }

  async getAccountByContact(tenantId: string, contactId: string): Promise<LoyaltyAccount | null> {
    const row = await runQueryWithTenant<LoyaltyAccountRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, status, points_balance, lifetime_earned, lifetime_redeemed, metadata, createdAt, updatedAt
      FROM loyalty_accounts
      WHERE tenant_id = $1 AND contact_id = $2
      `,
      [tenantId, contactId]
    );

    return row ? this.toLoyaltyAccount(row) : null;
  }

  /**
   * Adiciona pontos (EARN) - transação atômica
   */
  async addPoints(
    tenantId: string,
    contactId: string,
    points: number,
    entryType: LoyaltyLedgerEntryType,
    referenceType: string | null,
    referenceId: string | null,
    reasonCode: string | null,
    description: string | null,
    createdByActorId: string | null,
    createdByUserId: string | null
  ): Promise<{ ledgerEntry: LoyaltyLedgerEntry; newBalance: number }> {
    const client = await getClientWithTenant(tenantId);

    try {
      await client.query('BEGIN');

      // Inserir ledger entry (idempotência via constraint)
      const ledgerRow = await runQueryWithTenant<LoyaltyLedgerRow>(
        tenantId,
        `
        INSERT INTO loyalty_ledger (
          tenant_id, contact_id, entry_type, points, reference_type, reference_id,
          reason_code, description, created_by_actor_id, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tenant_id, reference_type, reference_id, entry_type) DO NOTHING
        RETURNING id, tenant_id, contact_id, entry_type, points, reference_type, reference_id,
                  reason_code, description, created_by_actor_id, created_by_user_id, createdAt
        `,
        [
          tenantId,
          contactId,
          entryType,
          points,
          referenceType,
          referenceId,
          reasonCode,
          description,
          createdByActorId,
          createdByUserId,
        ]
      );

      // Se já existe (idempotência), buscar existente
      if (!ledgerRow) {
        const existing = await runQueryWithTenant<LoyaltyLedgerRow>(
          tenantId,
          `
          SELECT id, tenant_id, contact_id, entry_type, points, reference_type, reference_id,
                 reason_code, description, created_by_actor_id, created_by_user_id, createdAt
          FROM loyalty_ledger
          WHERE tenant_id = $1 AND reference_type = $2 AND reference_id = $3 AND entry_type = $4
          `,
          [tenantId, referenceType, referenceId, entryType]
        );

        if (!existing) {
          await client.query('ROLLBACK');
          throw new Error('Erro ao criar ledger entry');
        }

        // Retornar existente sem atualizar balance
        const account = await this.getAccountByContact(tenantId, contactId);
        await client.query('COMMIT');
        return {
          ledgerEntry: this.toLoyaltyLedgerEntry(existing),
          newBalance: account?.pointsBalance || 0,
        };
      }

      // Atualizar account balance
      if (entryType === 'EARN') {
        await client.query(
          `
          UPDATE loyalty_accounts
          SET points_balance = points_balance + $1,
              lifetime_earned = lifetime_earned + $1,
              updatedAt = NOW()
          WHERE tenant_id = $2 AND contact_id = $3
          `,
          [points, tenantId, contactId]
        );
      } else if (entryType === 'REDEEM') {
        await client.query(
          `
          UPDATE loyalty_accounts
          SET points_balance = points_balance - $1,
              lifetime_redeemed = lifetime_redeemed + $1,
              updatedAt = NOW()
          WHERE tenant_id = $2 AND contact_id = $3
          `,
          [points, tenantId, contactId]
        );
      }

      await client.query('COMMIT');

      // Buscar novo balance
      const account = await this.getAccountByContact(tenantId, contactId);
      return {
        ledgerEntry: this.toLoyaltyLedgerEntry(ledgerRow),
        newBalance: account?.pointsBalance || 0,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async listLedger(
    tenantId: string,
    contactId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LoyaltyLedgerEntry[]> {
    const rows = await runQueriesWithTenant<LoyaltyLedgerRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, entry_type, points, reference_type, reference_id,
             reason_code, description, created_by_actor_id, created_by_user_id, createdAt
      FROM loyalty_ledger
      WHERE tenant_id = $1 AND contact_id = $2
      ORDER BY createdAt DESC
      LIMIT $3 OFFSET $4
      `,
      [tenantId, contactId, limit, offset]
    );

    return rows.map((row) => this.toLoyaltyLedgerEntry(row));
  }
}

export const loyaltyRepository = new LoyaltyRepository();







