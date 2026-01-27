// backend/src/modules/loyalty/loyalty-voucher.repository.ts
// SPRINT 93: LOYALTY / FIDELIDADE

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import type {
  LoyaltyVoucher,
  LoyaltyVoucherStatus,
  LoyaltyVoucherType,
} from './loyalty.types';

interface LoyaltyVoucherRow {
  id: string;
  tenant_id: string;
  contact_id: string;
  status: string;
  voucher_type: string;
  value: string | null;
  benefit_code: string | null;
  expires_at: Date | null;
  created_from_ledger_id: string | null;
  used_reference_type: string | null;
  used_reference_id: string | null;
  metadata: any;
  created_at: Date;
  used_at: Date | null;
}

class LoyaltyVoucherRepository {
  private toLoyaltyVoucher(row: LoyaltyVoucherRow): LoyaltyVoucher {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      contactId: row.contact_id,
      status: row.status as LoyaltyVoucherStatus,
      voucherType: row.voucher_type as LoyaltyVoucherType,
      value: row.value ? parseFloat(row.value) : null,
      benefitCode: row.benefit_code,
      expiresAt: row.expires_at,
      createdFromLedgerId: row.created_from_ledger_id,
      usedReferenceType: row.used_reference_type,
      usedReferenceId: row.used_reference_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      usedAt: row.used_at,
    };
  }

  async createVoucher(
    tenantId: string,
    contactId: string,
    voucherType: LoyaltyVoucherType,
    value: number | null,
    benefitCode: string | null,
    expiresAt: Date | null,
    createdFromLedgerId: string | null
  ): Promise<LoyaltyVoucher> {
    const row = await runQueryWithTenant<LoyaltyVoucherRow>(
      tenantId,
      `
      INSERT INTO loyalty_vouchers (
        tenant_id, contact_id, status, voucher_type, value, benefit_code,
        expires_at, created_from_ledger_id, metadata
      )
      VALUES ($1, $2, 'ACTIVE', $3, $4, $5, $6, $7, '{}'::jsonb)
      RETURNING id, tenant_id, contact_id, status, voucher_type, value, benefit_code,
                expires_at, created_from_ledger_id, used_reference_type, used_reference_id,
                metadata, created_at, used_at
      `,
      [
        tenantId,
        contactId,
        voucherType,
        value,
        benefitCode,
        expiresAt,
        createdFromLedgerId,
      ]
    );

    if (!row) {
      throw new Error('Erro ao criar voucher');
    }

    return this.toLoyaltyVoucher(row);
  }

  async listVouchers(
    tenantId: string,
    contactId: string,
    status?: LoyaltyVoucherStatus
  ): Promise<LoyaltyVoucher[]> {
    const conditions: string[] = ['tenant_id = $1', 'contact_id = $2'];
    const params: any[] = [tenantId, contactId];

    if (status) {
      conditions.push('status = $3');
      params.push(status);
    }

    const rows = await runQueriesWithTenant<LoyaltyVoucherRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, status, voucher_type, value, benefit_code,
             expires_at, created_from_ledger_id, used_reference_type, used_reference_id,
             metadata, created_at, used_at
      FROM loyalty_vouchers
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      `,
      params
    );

    return rows.map((row) => this.toLoyaltyVoucher(row));
  }

  async getVoucherById(tenantId: string, voucherId: string): Promise<LoyaltyVoucher | null> {
    const row = await runQueryWithTenant<LoyaltyVoucherRow>(
      tenantId,
      `
      SELECT id, tenant_id, contact_id, status, voucher_type, value, benefit_code,
             expires_at, created_from_ledger_id, used_reference_type, used_reference_id,
             metadata, created_at, used_at
      FROM loyalty_vouchers
      WHERE tenant_id = $1 AND id = $2
      `,
      [tenantId, voucherId]
    );

    return row ? this.toLoyaltyVoucher(row) : null;
  }
}

export const loyaltyVoucherRepository = new LoyaltyVoucherRepository();





