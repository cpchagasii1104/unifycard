// backend/src/core/companies/company-canonical.service.ts
// Company Canonical Birth - Nascimento Canônico
//
// 🔴 REGRAS PÉTREAS:
// - Company pode existir em estado CREATED sem Actor, Page, Service
// - Actor NÃO é pré-requisito ontológico de existência de Company
// - É proibido rollback ontológico (apagamento de Company) por falha em entidade derivada
// - Formulário NÃO cria capacidade, apenas existência canônica
// - Integrações só reagem a eventos do Core — nunca ao formulário
//
// OBJETIVO ÚNICO:
// Criar Company { state: CREATED } + emitir evento COMPANY_CREATED
// Nada além disso é autorizado.

import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { BadRequestError } from '@core/errors';

export type DocumentType = 'CPF' | 'CNPJ';

export interface CreateCompanyCanonicalInput {
  legal_name: string;
  document_type: DocumentType;
  document_number: string;
  country: string; // ISO-3166 (ex: 'BR')
  tenant_id: string; // Obrigatório para isolamento
}

export interface CompanyCanonical {
  company_id: string;
  tenant_id: string;
  legal_name: string;
  document_type: DocumentType;
  document_number: string;
  country: string;
  state: 'CREATED';
  global_user_id: string | null;
  createdAt: Date;
}

/**
 * Service para criação canônica de Company
 * 
 * 🔴 PROIBIÇÕES ABSOLUTAS:
 * - NÃO cria Actor, Page, Service, Wallet, Card, ERP, CRM, Agenda
 * - NÃO exige, dispara ou prepara verificação (KYC/KYB)
 * - NÃO ativa marketplace ou indexação
 * - NÃO cria integrações preparatórias
 * - NÃO registra listeners, handlers, filas, tópicos ou subscribers
 * - NÃO emite eventos além de COMPANY_CREATED
 * - NÃO assume cardinalidade Company ↔ Actor
 * - NÃO cria "Actor técnico", "mínimo" ou implícito
 */
class CompanyCanonicalService {
  /**
   * Cria Company em estado CREATED (nascimento canônico)
   * 
   * ÚNICA CONSEQUÊNCIA SISTÊMICA PERMITIDA:
   * - Company { state: CREATED }
   * - Evento COMPANY_CREATED
   */
  async createCompany(
    tenantId: string,
    input: CreateCompanyCanonicalInput
  ): Promise<CompanyCanonical> {
    // 1. Validar input
    if (!input.legal_name || input.legal_name.trim().length === 0) {
      throw new BadRequestError('legal_name é obrigatório');
    }

    if (!input.document_type || !['CPF', 'CNPJ'].includes(input.document_type)) {
      throw new BadRequestError('document_type deve ser CPF ou CNPJ');
    }

    if (!input.document_number || input.document_number.trim().length === 0) {
      throw new BadRequestError('document_number é obrigatório');
    }

    // Normalizar document_number (apenas números)
    const normalizedDocument = input.document_number.replace(/\D/g, '');

    // Validar formato conforme tipo
    if (input.document_type === 'CPF' && normalizedDocument.length !== 11) {
      throw new BadRequestError('CPF deve ter 11 dígitos');
    }
    if (input.document_type === 'CNPJ' && normalizedDocument.length !== 14) {
      throw new BadRequestError('CNPJ deve ter 14 dígitos');
    }

    if (!input.country || input.country.length !== 2) {
      throw new BadRequestError('country deve ser código ISO-3166 de 2 caracteres');
    }

    // 2. Criar Company (state=CREATED, global_user_id=NULL)
    const companyId = uuidv4();

    const companyRow = await runQueryWithTenant<{
      company_id: string;
      tenant_id: string;
      legal_name: string;
      document_type: string;
      document_number: string;
      country: string;
      state: string;
      global_user_id: string | null;
      createdAt: Date;
    }>(
      tenantId,
      `
      INSERT INTO companies (
        company_id,
        tenant_id,
        legal_name,
        document_type,
        document_number,
        country,
        state,
        global_user_id,
        createdAt,
        updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW(), NOW())
      RETURNING 
        company_id,
        tenant_id,
        legal_name,
        document_type,
        document_number,
        country,
        state,
        global_user_id,
        createdAt
      `,
      [
        companyId,
        tenantId,
        input.legal_name.trim(),
        input.document_type,
        normalizedDocument,
        input.country.toUpperCase(),
        'CREATED',
      ]
    );

    if (!companyRow) {
      throw new Error('Falha ao criar Company');
    }

    const company: CompanyCanonical = {
      company_id: companyRow.company_id,
      tenant_id: companyRow.tenant_id,
      legal_name: companyRow.legal_name,
      document_type: companyRow.document_type as DocumentType,
      document_number: companyRow.document_number,
      country: companyRow.country,
      state: 'CREATED',
      global_user_id: companyRow.global_user_id,
      createdAt: companyRow.createdAt,
    };

    // 3. Emitir evento COMPANY_CREATED (ÚNICO evento permitido)
    try {
      await eventBus.publish({
        tenantId,
        type: 'COMPANY_CREATED',
        version: 1,
        payload: {
          company_id: company.company_id,
          state: 'CREATED',
        },
        metadata: {
          legal_name: company.legal_name,
          document_type: company.document_type,
          document_number: company.document_number,
          country: company.country,
        },
      });
    } catch (error) {
      // 🔴 REGRA: Falha no evento NÃO apaga Company (proibido rollback ontológico)
      // Company permanece mesmo se evento falhar
      console.error('[CompanyCanonicalService] Erro ao emitir COMPANY_CREATED (não crítico):', error);
    }

    return company;
  }
}

export const companyCanonicalService = new CompanyCanonicalService();


