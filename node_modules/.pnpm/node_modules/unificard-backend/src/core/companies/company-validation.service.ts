// src/core/companies/company-validation.service.ts
// Serviço para Validação Presencial com QR + Funcionário Auditável (FASE 12)

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { CompanyStatus } from '@unificard/contracts';
import { authService } from '@core/auth/auth.service';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const VALIDATION_TOKEN_EXPIRES_IN = '15m'; // Token expira em 15 minutos

export interface ValidationTokenPayload {
  company_id: string;
  token: string;
  expires_at: string;
}

export interface ValidationRequest {
  company_id: string;
  qr_code_payload: string; // JWT assinado
  expires_at: string;
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
  validated_at: string;
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
    const company = await runQueryWithTenant<{
      company_id: string;
      company_status: string;
    }>(
      tenantId,
      `
      SELECT company_id, company_status
      FROM companies
      WHERE company_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [companyId, tenantId]
    );

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
      expires_at: expiresAt.toISOString(),
    };

    // Assinar JWT
    const qrCodePayload = jwt.sign(payload, JWT_SECRET, {
      expiresIn: VALIDATION_TOKEN_EXPIRES_IN,
    });

    return {
      company_id: companyId,
      qr_code_payload: qrCodePayload,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Valida empresa presencialmente (funcionário parceiro)
   * FASE 12: Validação com funcionário identificado + prova técnica
   */
  async validateInPerson(
    tenantId: string,
    input: InPersonValidationInput
  ): Promise<CompanyValidation> {
    // 1. Verificar e decodificar token usando authService (centralizado)
    let payload: ValidationTokenPayload;
    try {
      payload = authService.verifyJWT<ValidationTokenPayload>(input.validation_token);
    } catch (err) {
      throw new Error('Token de validação inválido ou expirado');
    }

    // 2. Verificar se token não expirou (jwt.verify já valida expiração, mas mantemos validação explícita para clareza)
    const expiresAt = new Date(payload.expires_at);
    if (expiresAt < new Date()) {
      throw new Error('Token de validação expirado');
    }

    // 3. Verificar se company_id do token corresponde
    if (payload.company_id !== input.company_id) {
      // FASE 13: Registrar tentativa de abuso
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.recordValidationAbuseAttempt(
          tenantId,
          input.company_id,
          input.device_fingerprint,
          'Token não corresponde à empresa'
        );
      } catch (err) {
        // Não crítico
      }
      throw new Error('Token não corresponde à empresa');
    }

    // 4. Verificar se funcionário existe e está ativo
    const employee = await runQueryWithTenant<{
      id: string;
      partner_id: string;
      name: string;
      active: boolean;
    }>(
      tenantId,
      `
      SELECT id, partner_id, name, active
      FROM partner_employees
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [input.employee_id, tenantId]
    );

    if (!employee || employee.length === 0 || !employee[0].active) {
      throw new Error('Funcionário não encontrado ou inativo');
    }

    // 5. Verificar se empresa ainda está PROVISIONAL
    const company = await runQueryWithTenant<{
      company_id: string;
      company_status: string;
    }>(
      tenantId,
      `
      SELECT company_id, company_status
      FROM companies
      WHERE company_id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [input.company_id, tenantId]
    );

    if (!company || company.length === 0) {
      throw new Error('Empresa não encontrada');
    }

    if (company[0].company_status !== 'PROVISIONAL') {
      throw new Error('Empresa já foi validada ou não está em status PROVISIONAL');
    }

    // 6. Verificar se mesmo funcionário já validou esta empresa (anti-fraude)
    const existingValidation = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `
      SELECT id
      FROM company_validations
      WHERE company_id = $1 
        AND validated_by_employee_id = $2
        AND tenant_id = $3
      LIMIT 1
      `,
      [input.company_id, input.employee_id, tenantId]
    );

    if (existingValidation && existingValidation.length > 0) {
      throw new Error('Este funcionário já validou esta empresa anteriormente');
    }

    // 7. Verificar limite diário de validações por funcionário (anti-fraude)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validationsToday = await runQueryWithTenant<{ count: number }>(
      tenantId,
      `
      SELECT COUNT(*)::int as count
      FROM company_validations
      WHERE validated_by_employee_id = $1
        AND tenant_id = $2
        AND validated_at >= $3
      `,
      [input.employee_id, tenantId, today]
    );

    const dailyLimit = 20; // Limite diário por funcionário
    if (validationsToday && validationsToday[0].count >= dailyLimit) {
      throw new Error(`Limite diário de validações atingido (${dailyLimit})`);
    }

    // 8. Executar validação em transação única
    const validationId = randomUUID();
    const validatedAt = new Date();

    await runQueriesWithTenant(tenantId, [
      // Inserir registro de validação
      {
        query: `
          INSERT INTO company_validations (
            id, tenant_id, company_id, company_status_before, company_status_after,
            validation_method, validated_by_employee_id, validated_by_partner_id,
            validated_at, geo_lat, geo_lng, device_fingerprint, metadata
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        `,
        params: [
          validationId,
          tenantId,
          input.company_id,
          company[0].company_status, // PROVISIONAL
          'VERIFIED',
          'IN_PERSON_QR',
          input.employee_id,
          input.partner_id || employee[0].partner_id,
          validatedAt,
          input.geo?.lat || null,
          input.geo?.lng || null,
          input.device_fingerprint || null,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ],
      },
      // Atualizar status da empresa
      {
        query: `
          UPDATE companies
          SET company_status = 'VERIFIED',
              verified_at = $1,
              updated_at = NOW()
          WHERE company_id = $2 AND tenant_id = $3
        `,
        params: [validatedAt, input.company_id, tenantId],
      },
    ]);

      // 9. FASE 13: Avaliar padrões de validação (não crítico)
      try {
        const auditModule = await import('@core/audit/audit.service');
        await auditModule.auditService.evaluateValidationPatterns(tenantId, input.employee_id);
      } catch (err) {
        console.warn('Erro ao avaliar padrões de validação (não crítico):', err);
      }

      // 10. Retornar registro de validação
      const validation = await runQueryWithTenant<{
      id: string;
      company_id: string;
      company_status_before: string;
      company_status_after: string;
      validation_method: string;
      validated_by_employee_id: string | null;
      validated_by_partner_id: string | null;
      validated_at: string;
      geo_lat: number | null;
      geo_lng: number | null;
      device_fingerprint: string | null;
      metadata: Record<string, any> | null;
    }>(
      tenantId,
      `
      SELECT id, company_id, company_status_before, company_status_after,
             validation_method, validated_by_employee_id, validated_by_partner_id,
             validated_at, geo_lat, geo_lng, device_fingerprint, metadata
      FROM company_validations
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [validationId, tenantId]
    );

    if (!validation || validation.length === 0) {
      throw new Error('Erro ao recuperar registro de validação');
    }

    const row = validation[0];
    return {
      id: row.id,
      company_id: row.company_id,
      company_status_before: row.company_status_before,
      company_status_after: row.company_status_after,
      validation_method: row.validation_method,
      validated_by_employee_id: row.validated_by_employee_id,
      validated_by_partner_id: row.validated_by_partner_id,
      validated_at: row.validated_at,
      geo_lat: row.geo_lat,
      geo_lng: row.geo_lng,
      device_fingerprint: row.device_fingerprint,
      metadata: row.metadata,
    };
  }

  /**
   * Busca histórico de validações de uma empresa
   */
  async getValidationHistory(
    tenantId: string,
    companyId: string
  ): Promise<CompanyValidation[]> {
    const result = await runQueryWithTenant<{
      id: string;
      company_id: string;
      company_status_before: string;
      company_status_after: string;
      validation_method: string;
      validated_by_employee_id: string | null;
      validated_by_partner_id: string | null;
      validated_at: string;
      geo_lat: number | null;
      geo_lng: number | null;
      device_fingerprint: string | null;
      metadata: Record<string, any> | null;
    }>(
      tenantId,
      `
      SELECT id, company_id, company_status_before, company_status_after,
             validation_method, validated_by_employee_id, validated_by_partner_id,
             validated_at, geo_lat, geo_lng, device_fingerprint, metadata
      FROM company_validations
      WHERE company_id = $1 AND tenant_id = $2
      ORDER BY validated_at DESC
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
      validated_at: row.validated_at,
      geo_lat: row.geo_lat,
      geo_lng: row.geo_lng,
      device_fingerprint: row.device_fingerprint,
      metadata: row.metadata,
    }));
  }
}

export const companyValidationService = new CompanyValidationService();

