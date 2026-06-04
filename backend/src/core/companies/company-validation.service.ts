// src/core/companies/company-validation.service.ts
// Serviço para Validação Presencial com QR + Funcionário Auditável (FASE 12)

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { pool, runQueriesWithTenant } from '@core/database/pool';
import { CompanyStatus } from '@unificard/contracts';
import { HttpError } from '@core/errors/http-error';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required for company validation');
}

const VALIDATION_TOKEN_EXPIRES_IN = '15m'; // Token expira em 15 minutos

export interface ValidationTokenPayload {
  company_id: string;
  token: string;
  expiresAt: string;
}

export interface ValidationRequest {
  company_id: string;
  qr_code_payload: string; // JWT assinado
  expiresAt: string;
}

export interface InPersonValidationInput {
  company_id: string;
  validation_token: string;
  employee_id: string;
  partner_id?: string;
  geo?: { lat: number; lng: number };
  device_fingerprint?: string;
  metadata?: Record<string, any>;
}

export interface CompanyValidation {
  id: string;
  company_id: string;
  company_status_before: string;
  company_status_after: string;
  validation_method: string;
  validated_by_employee_id: string | null;
  validated_by_partner_id: string | null;
  validatedAt: string;
  geo_lat: number | null;
  geo_lng: number | null;
  device_fingerprint: string | null;
  metadata: Record<string, any> | null;
}

class CompanyValidationService {
  /**
   * Gera token de validação e QR Code payload
   * FASE 12: Token JWT curto (15 min) para validação presencial
   */
  async requestValidation(
    tenantId: string,
    companyId: string
  ): Promise<ValidationRequest> {
    // Verificar se empresa existe e está PROVISIONAL
    const companyResult = await pool.query<{
      company_id: string;
      company_status: string;
    }>(`
      SELECT c.company_id, c.company_status
      FROM companies c
      WHERE c.company_id = $1
        AND c.tenant_id = $2
      LIMIT 1
    `, [companyId, tenantId]);

    const company = companyResult.rows;

    if (!company || company.length === 0) {
      throw new Error('Empresa não encontrada');
    }

    if (company[0].company_status !== 'PROVISIONAL') {
      throw new Error('Apenas empresas PROVISIONAL podem solicitar validação presencial');
    }

    // Gerar token único
    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutos

    // Criar payload JWT
    const payload: ValidationTokenPayload = {
      company_id: companyId,
      token,
      expiresAt: expiresAt.toISOString(),
    };

    // Assinar JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required for company validation');
    }
    const qrCodePayload = jwt.sign(payload, secret, {
      expiresIn: VALIDATION_TOKEN_EXPIRES_IN,
    });

    return {
      company_id: companyId,
      qr_code_payload: qrCodePayload,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Validação presencial legada (FASE 12 QR) — DESABILITADA (DECISION-0091 Fase 2.5).
   *
   * 🔴 Writer FÓSSIL neutralizado. `validateInPerson` era runtime-dead: escrevia contra o schema
   * arquivado (`migrations_archive/0047_company_validations.sql`, NÃO aplicado) — incompatível com o
   * schema vivo (`company_validations` mínimo de `0066`; `partner_employees` sem `name`/`active`;
   * `companies.verifiedAt` inexistente). NÃO escreve `company_status='VERIFIED'`/`is_verified`/
   * `verifiedAt`, nem `company_validations`, nem `kyb_status`. Verificação fiscal tem FONTE ÚNICA
   * (`fiscal_identities.kyb_status`) e writer KYB auditado. Evidência presencial KYB é greenfield
   * futuro (DECISION-0091 §4.4). Lança antes de qualquer leitura/escrita.
   *
   * `requestValidation`/QR seguem INTACTOS (inertes; só geram token).
   */
  async validateInPerson(
    _tenantId: string,
    input: InPersonValidationInput
  ): Promise<CompanyValidation> {
    const err = new HttpError(
      `PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED: Validação presencial legada desabilitada. Evidência presencial KYB exige novo desenho. (company=${input.company_id})`,
      501
    );
    (err as unknown as { code: string }).code = 'PJ_LEGACY_IN_PERSON_VERIFIED_DISABLED';
    throw err;
  }

  /**
   * Busca histórico de validações de uma empresa
   */
  async getValidationHistory(
    tenantId: string,
    companyId: string
  ): Promise<CompanyValidation[]> {
    const result = await runQueriesWithTenant<{
      id: string;
      company_id: string;
      company_status_before: string;
      company_status_after: string;
      validation_method: string;
      validated_by_employee_id: string | null;
      validated_by_partner_id: string | null;
      validatedAt: string;
      geo_lat: number | null;
      geo_lng: number | null;
      device_fingerprint: string | null;
      metadata: Record<string, any> | null;
    }>(
      tenantId,
      `
      SELECT id, company_id, company_status_before, company_status_after,
             validation_method, validated_by_employee_id, validated_by_partner_id,
             validatedAt, geo_lat, geo_lng, device_fingerprint, metadata
      FROM company_validations
      WHERE company_id = $1 AND tenant_id = $2
      ORDER BY validatedAt DESC
      `,
      [companyId, tenantId]
    );

    return (result || []).map((row) => ({
      id: row.id,
      company_id: row.company_id,
      company_status_before: row.company_status_before,
      company_status_after: row.company_status_after,
      validation_method: row.validation_method,
      validated_by_employee_id: row.validated_by_employee_id,
      validated_by_partner_id: row.validated_by_partner_id,
      validatedAt: row.validatedAt,
      geo_lat: row.geo_lat,
      geo_lng: row.geo_lng,
      device_fingerprint: row.device_fingerprint,
      metadata: row.metadata,
    }));
  }
}

export const companyValidationService = new CompanyValidationService();


