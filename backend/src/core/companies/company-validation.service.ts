// src/core/companies/company-validation.service.ts
// Serviço para Validação Presencial com QR + Funcionário Auditável (FASE 12)

import { runQueriesWithTenant } from '@core/database/pool';
import { CompanyStatus } from '@unificard/contracts';
import { HttpError } from '@core/errors/http-error';

// DECISION-0096: validação presencial PJ reservada/desabilitada. Este serviço NÃO gera mais
// token/JWT/QR — a maquinaria de assinatura (jwt, randomUUID, JWT_SECRET, expiração) foi removida
// porque requestValidation passou a fail-fast com HTTP 501 antes de qualquer geração.

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
   * RESERVADO/DESABILITADO (DECISION-0096). Originalmente gerava token JWT/QR para validação
   * presencial (FASE 12). Agora lança HttpError 501 (`PJ_PRESENTIAL_VALIDATION_RESERVED`) antes de
   * qualquer geração — não há consumidor vivo (validateInPerson é tombstone) e o sistema não pode
   * gerar QR órfão. Reativação exige greenfield (evidência presencial KYB).
   */
  async requestValidation(
    _tenantId: string,
    companyId: string
  ): Promise<ValidationRequest> {
    // DECISION-0096: validação presencial PJ está RESERVADA/DESABILITADA.
    // Fail-fast com HTTP 501 ANTES de qualquer query, randomUUID, jwt.sign ou geração de
    // validationToken/QR — não há consumidor vivo (validateInPerson é tombstone) e o sistema não
    // pode gerar QR órfão. NÃO escreve company_status/is_verified/verifiedAt/kyb_status. A
    // verificação PJ ocorre pelo fluxo KYB/documental (fiscal_identities.kyb_status). FASE 12 não revive.
    const err = new HttpError(
      `PJ_PRESENTIAL_VALIDATION_RESERVED: Validação presencial PJ está reservada/desabilitada (DECISION-0096). A verificação PJ ocorre pelo fluxo KYB/documental. (company=${companyId})`,
      501
    );
    (err as unknown as { code: string }).code = 'PJ_PRESENTIAL_VALIDATION_RESERVED';
    throw err;
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
   * `requestValidation`/QR TAMBÉM desabilitados (DECISION-0096): lançam 501 antes de gerar token.
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


