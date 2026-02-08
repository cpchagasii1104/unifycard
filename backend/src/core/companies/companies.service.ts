// src/core/companies/companies.service.ts
// Service para gerenciar empresas (PJ)

import { randomUUID } from 'crypto';
import { CompanyStatus } from '@unificard/contracts';
import { pool } from '@core/database/pool';
import { isTestOverrideUser } from '../../utils/isTestOverrideUser';
import { runQueryWithTenant } from '@core/database/pool';
import type {
  Company,
  CompanyUser,
  CreateCompanyInput,
  UpdateCompanyInput,
  UpdateCompanyUserInput,
  RevenueFederalData,
  CompanyAddress,
  CompanyContact,
  CompanyActivity,
  CompanyDomain,
  MarketplaceDomain,
} from './companies.types';

class CompaniesService {
  /**
   * Busca dados do CNPJ na Receita Federal (API pública)
   * 🔴 NUNCA lança erro bloqueante - sempre retorna null em caso de falha
   */
  async fetchCNPJFromRevenue(cnpj: string): Promise<RevenueFederalData | null> {
    // Remove formatação do CNPJ
    const cleanCNPj = cnpj.replace(/\D/g, '');
    
    if (cleanCNPj.length !== 14) {
      console.warn('[CompaniesService] CNPJ deve ter 14 dígitos:', cnpj);
      return null; // Não lançar erro, apenas retornar null
    }

    // API pública da Receita Federal
    // Tentativa 1: receitaws.com.br
    try {
      // Criar AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`https://www.receitaws.com.br/v1/${cleanCNPj}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: any = await response.json();
        
        if (data.status === 'ERROR') {
          throw new Error(data.message || 'CNPJ não encontrado');
        }

        // Validar se tem dados essenciais
        if (data.nome || data.razao_social) {
          return data as RevenueFederalData;
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.warn(`Erro ao buscar em receitaws.com.br (${errorMsg}), tentando alternativa...`);
    }

    // Tentativa 2: API alternativa (brasilapi.com.br)
    try {
      // Pequeno delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

      // Criar AbortController para timeout
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000);

      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPj}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller2.signal,
      });

      clearTimeout(timeoutId2);

      if (response.ok) {
        const data: any = await response.json();
        
        // Converter formato da BrasilAPI para formato esperado
        if (data.razao_social) {
          return {
            cnpj: data.cnpj || cleanCNPj,
            razao_social: data.razao_social,
            nome_fantasia: data.nome_fantasia,
            data_abertura: data.data_inicio_atividade,
            situacao_cadastral: data.descricao_situacao_cadastral,
            tipo_logradouro: data.logradouro?.split(' ')[0],
            logradouro: data.logradouro,
            numero: data.numero,
            complemento: data.complemento,
            bairro: data.bairro,
            municipio: data.municipio,
            uf: data.uf,
            cep: data.cep?.replace(/\D/g, ''),
            telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : undefined,
            email: data.email,
            capital_social: data.capital_social?.toString(),
            porte: data.porte,
            natureza_juridica: data.natureza_juridica,
            atividade_principal: data.cnae_fiscal_principal ? [{
              code: data.cnae_fiscal_principal.codigo,
              text: data.cnae_fiscal_principal.descricao,
            }] : [],
            atividades_secundarias: data.cnaes_secundarios?.map((cnae: any) => ({
              code: cnae.codigo,
              text: cnae.descricao,
            })) || [],
            qsa: data.qsa?.map((socio: any) => ({
              nome: socio.nome,
              qual: socio.qual,
              pais_origem: socio.pais_origem,
            })) || [],
          } as RevenueFederalData;
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.warn(`[CompaniesService] Erro ao buscar em brasilapi.com.br: ${errorMsg}`);
    }

    // 🔴 CORREÇÃO: Se ambas as APIs falharam, retornar null (NÃO lançar erro)
    console.warn('[CompaniesService] Não foi possível buscar dados da Receita Federal. As APIs podem estar temporariamente indisponíveis.');
    return null; // Permite cadastro manual
  }

  /**
   * Valida CNPJ - APENAS formato básico (14 dígitos)
   * 🔴 NÃO valida dígitos verificadores - permite cadastro mesmo com CNPJ não validado
   */
  validateCNPJFormat(cnpj: string): { valid: boolean; error?: string } {
    const clean = cnpj.replace(/\D/g, '');
    
    if (clean.length !== 14) {
      return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
    }

    // Verifica se todos os dígitos são iguais (formato inválido óbvio)
    if (/^(\d)\1+$/.test(clean)) {
      return { valid: false, error: 'CNPJ inválido (todos os dígitos são iguais)' };
    }

    // 🔴 APENAS validação de formato - não valida dígitos verificadores
    return { valid: true };
  }

  /**
   * Valida CNPJ completo (com dígitos verificadores) - usado apenas para validação final
   */
  validateCNPJ(cnpj: string): { valid: boolean; error?: string } {
    const formatValidation = this.validateCNPJFormat(cnpj);
    if (!formatValidation.valid) {
      return formatValidation;
    }

    const clean = cnpj.replace(/\D/g, '');
    
    // Validação dos dígitos verificadores
    let length = clean.length - 2;
    let numbers = clean.substring(0, length);
    const digits = clean.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return { valid: false, error: 'CNPJ inválido (dígito verificador incorreto)' };
    }

    length = length + 1;
    numbers = clean.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) {
      return { valid: false, error: 'CNPJ inválido (dígito verificador incorreto)' };
    }

    return { valid: true };
  }

  /**
   * Formata CNPJ (XX.XXX.XXX/XXXX-XX)
   */
  formatCNPJ(cnpj: string): string {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return cnpj;
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  /**
   * Cria uma nova empresa
   * 🔴 SEMPRE salva, mesmo sem dados da Receita Federal
   */
  async createCompany(
    globalUserId: string,
    input: CreateCompanyInput,
    tenantId?: string
  ): Promise<{ company: Company; companyUser: CompanyUser }> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          operation: 'createCompany',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para createCompany');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        tenantId: finalTenantId,
        operation: 'createCompany',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para createCompany');
    }

    // 🔴 Normalizar CNPJ defensivamente: remover formatação (pontos, barras, hífens)
    const normalizedCNPJ = input.cnpj.replace(/\D/g, '');
    
    // 🔴 Validar APENAS formato do CNPJ (não dígitos verificadores)
    const formatValidation = this.validateCNPJFormat(normalizedCNPJ);
    if (!formatValidation.valid) {
      throw new Error(formatValidation.error || 'CNPJ deve ter 14 dígitos');
    }

    // formattedCNPJ já é apenas números (normalizado acima)
    const formattedCNPJ = normalizedCNPJ;

    // 🔴 CORREÇÃO: Verificar se já existe COM filtro tenant_id
    const existing = await runQueryWithTenant<{ company_id: string }>(
      finalTenantId,
      `
      SELECT company_id
      FROM companies
      WHERE tenant_id = $1 AND global_user_id = $2::uuid AND cnpj = $3
      LIMIT 1
      `,
      [finalTenantId, globalUserId, formattedCNPJ]
    );

    if (existing && existing.rows && existing.rows.length > 0) {
      throw new Error('Empresa com este CNPJ já está cadastrada');
    }

    // OVERRIDE DE TESTE: Bypassar limite de PROVISIONAL para usuário de teste
    const userId = await this.resolveUserIdFromGlobalUserId(globalUserId, finalTenantId);
    if (!userId || !isTestOverrideUser(userId)) {
      // 🔴 CORREÇÃO: ANTI-FRAUDE com filtro tenant_id
      const provisionalCount = await runQueryWithTenant<{ count: string }>(
        finalTenantId,
        `
        SELECT COUNT(*) as count
        FROM companies
        WHERE tenant_id = $1 AND global_user_id = $2::uuid 
          AND company_status = 'PROVISIONAL'
          AND status != 'suspended'
        `,
        [finalTenantId, globalUserId]
      );

      const currentProvisionalCount = parseInt((provisionalCount?.rows?.[0]?.count || '0'), 10);
      const MAX_PROVISIONAL_PER_CPF = 3;

      if (currentProvisionalCount >= MAX_PROVISIONAL_PER_CPF) {
        throw new Error(
          `Limite de ${MAX_PROVISIONAL_PER_CPF} empresas em validação atingido. ` +
          `Complete a validação presencial de uma empresa existente ou aguarde a aprovação antes de cadastrar novas.`
        );
      }
    }

    let revenueData: RevenueFederalData | null = null;
    let companyName = input.companyName;
    let tradeName = input.tradeName;
    let address: CompanyAddress = input.address || {};
    let contact: CompanyContact = input.contact || {};
    let activity: CompanyActivity = input.activity || {};
    // Status inicial: PROVISIONAL (permite uso social com limites)
    let companyStatus: CompanyStatus = 'PROVISIONAL';
    let isVerified = false;

    // 🔴 Buscar dados da Receita Federal se solicitado (OPCIONAL - não bloqueia)
    if (input.fetchFromRevenue !== false) {
      try {
        revenueData = await this.fetchCNPJFromRevenue(formattedCNPJ);
        
        if (revenueData) {
          companyName = companyName || revenueData.razao_social;
          tradeName = tradeName || revenueData.nome_fantasia;
          
          // Preencher endereço
          if (!address.address && revenueData.logradouro) {
            address = {
              cep: revenueData.cep?.replace(/\D/g, ''),
              address: `${revenueData.tipo_logradouro || ''} ${revenueData.logradouro || ''}`.trim(),
              addressNumber: revenueData.numero,
              complement: revenueData.complemento,
              neighborhood: revenueData.bairro,
              city: revenueData.municipio,
              state: revenueData.uf,
              country: 'BR',
            };
          }

          // Preencher contato
          if (!contact.phone && revenueData.telefone) {
            contact.phone = revenueData.telefone;
          }
          if (!contact.email && revenueData.email) {
            contact.email = revenueData.email;
          }

          // Preencher atividade
          if (revenueData.atividade_principal && revenueData.atividade_principal.length > 0) {
            activity.mainActivityCode = revenueData.atividade_principal[0].code;
            activity.mainActivityDescription = revenueData.atividade_principal[0].text;
          }

          if (revenueData.atividades_secundarias) {
            activity.secondaryActivities = revenueData.atividades_secundarias.map(a => ({
              code: a.code,
              description: a.text,
            }));
          }

          // Se conseguiu buscar da Receita, pode marcar como VERIFIED (mas por padrão fica PROVISIONAL)
          // VERIFIED só vem de validação presencial ou admin override
          // Por enquanto, mesmo com dados da Receita, fica PROVISIONAL
          companyStatus = 'PROVISIONAL';
          isVerified = false; // isVerified só true em VERIFIED+
        } else {
          // Sem dados da Receita, mas com nome: PROVISIONAL
          companyStatus = 'PROVISIONAL';
        }
      } catch (err) {
        // 🔴 Erro na busca NÃO bloqueia cadastro
        console.warn('[CompaniesService] Erro ao buscar da Receita (não bloqueante):', err);
        companyStatus = 'PROVISIONAL';
      }
    } else {
      // Se não tentou buscar, mas tem nome: PROVISIONAL
      companyStatus = 'PROVISIONAL';
    }

    // 🔴 Nome da empresa é obrigatório apenas se não veio da Receita
    if (!companyName) {
      throw new Error('Nome da empresa é obrigatório');
    }

    // 🔴 CORREÇÃO: Se há empresa primária, desmarcar outras COM filtro tenant_id
    if (input.isPrimary) {
      // Primeiro, buscar company_ids do usuário neste tenant
      const userCompanies = await runQueryWithTenant<{ company_id: string }>(
        finalTenantId,
        `
        SELECT c.company_id
        FROM companies c
        INNER JOIN company_users cu ON c.company_id = cu.company_id
        WHERE c.tenant_id = $1 AND cu.global_user_id = $2::uuid AND cu.is_active = true
        `,
        [finalTenantId, globalUserId]
      );

      if (userCompanies && userCompanies.rows && userCompanies.rows.length > 0) {
        const companyIds = userCompanies.rows.map(c => c.company_id);
        await runQueryWithTenant(
          finalTenantId,
          `
          UPDATE company_users
          SET is_primary = false, updatedAt = now()
          WHERE company_id = ANY($1::uuid[]) AND global_user_id = $2::uuid
          `,
          [companyIds, globalUserId]
        );
      }
    }

    // Preparar metadata com categorização mínima (sem decisão automática)
    const metadata: Record<string, any> = {};
    
    // Adicionar business_category se fornecido
    if (input.businessCategory) {
      metadata.business_category = input.businessCategory;
    }
    
    // Adicionar service_categories se fornecido
    if (input.serviceCategories && input.serviceCategories.length > 0) {
      metadata.service_categories = input.serviceCategories;
    }

    // Criar empresa
    const companyResult = await pool.query<{
      company_id: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `
      INSERT INTO companies (
        tenant_id, global_user_id, cnpj, company_name, trade_name, registered_at,
        cep, address, address_number, complement, neighborhood, city, state, country,
        phone, email, website,
        main_activity_code, main_activity_description, secondary_activities,
        revenue_data, status, is_verified, company_status, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17,
        $18, $19, $20,
        $21, $22, $23, $24, $25
      )
      RETURNING company_id, createdAt, updatedAt
      `,
      [
        finalTenantId,
        globalUserId,
        formattedCNPJ,
        companyName,
        tradeName || null,
        revenueData?.data_abertura ? new Date(revenueData.data_abertura) : null,
        address.cep || null,
        address.address || null,
        address.addressNumber || null,
        address.complement || null,
        address.neighborhood || null,
        address.city || null,
        address.state || null,
        address.country || 'BR',
        contact.phone || null,
        contact.email || null,
        contact.website || null,
        activity.mainActivityCode || null,
        activity.mainActivityDescription || null,
        activity.secondaryActivities ? JSON.stringify(activity.secondaryActivities) : '[]',
        revenueData ? JSON.stringify(revenueData) : '{}',
        'active',
        isVerified, // Verificado se conseguiu buscar da Receita Federal
        companyStatus, // Status do cadastro
        JSON.stringify(metadata), // Metadata com categorização
      ]
    );

    const companyId = companyResult.rows[0].company_id;

    // Criar domínios da empresa (obrigatório: pelo menos 1)
    const domains = input.domains && input.domains.length > 0 
      ? input.domains 
      : ['market']; // Default: market para compatibilidade
    
    for (const domain of domains) {
      await pool.query(
        `
        INSERT INTO company_domains (company_id, domain, enabled, config)
        VALUES ($1, $2, true, '{}'::jsonb)
        ON CONFLICT (company_id, domain) DO UPDATE
        SET enabled = true, updatedAt = NOW()
        `,
        [companyId, domain]
      );
    }

    // Criar relacionamento usuário-empresa
    const defaultPermissions = {
      canManageCompany: input.permissions?.canManageCompany ?? (input.role === 'owner'),
      canManageFinancial: input.permissions?.canManageFinancial ?? (input.role === 'owner' || input.role === 'director'),
      canManageEmployees: input.permissions?.canManageEmployees ?? (input.role === 'owner' || input.role === 'director' || input.role === 'manager'),
      canViewReports: input.permissions?.canViewReports ?? true,
      canManageServices: input.permissions?.canManageServices ?? (input.role === 'owner' || input.role === 'director' || input.role === 'manager'),
    };

    const userResult = await pool.query<{
      company_user_id: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `
      INSERT INTO company_users (
        company_id, global_user_id, role, role_description,
        can_manage_company, can_manage_financial, can_manage_employees,
        can_view_reports, can_manage_services,
        is_active, is_primary, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING company_user_id, createdAt, updatedAt
      `,
      [
        companyId,
        globalUserId,
        input.role,
        input.roleDescription || null,
        defaultPermissions.canManageCompany,
        defaultPermissions.canManageFinancial,
        defaultPermissions.canManageEmployees,
        defaultPermissions.canViewReports,
        defaultPermissions.canManageServices,
        true,
        input.isPrimary ?? false,
        JSON.stringify({}),
      ]
    );

    // 🔴 CRÍTICO: Criar actor do tipo 'page' OBRIGATORIAMENTE após criar empresa
    // Empresa NÃO pode existir sem actor
    // Se falhar, fazer rollback da criação da empresa
    // tenantId já foi resolvido no início do método
    if (!finalTenantId) {
      // Se não conseguir resolver tenantId, fazer rollback
      await pool.query(
        `DELETE FROM companies WHERE company_id = $1::uuid`,
        [companyId]
      );
      await pool.query(
        `DELETE FROM company_users WHERE company_id = $1::uuid`,
        [companyId]
      );
      await pool.query(
        `DELETE FROM company_domains WHERE company_id = $1::uuid`,
        [companyId]
      );
      throw new Error('Não foi possível determinar tenant_id. Empresa não foi criada.');
    }

    try {
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      await actorRepository.findOrCreatePageActor(finalTenantId, companyId);
    } catch (err) {
      // 🔴 ROLLBACK: Se criação do actor falhar, reverter criação da empresa
      console.error('[CompaniesService] Erro ao criar actor para empresa (fazendo rollback):', err);
      
      // Deletar empresa criada
      await pool.query(
        `DELETE FROM companies WHERE company_id = $1::uuid`,
        [companyId]
      );
      
      // Deletar company_users criado
      await pool.query(
        `DELETE FROM company_users WHERE company_id = $1::uuid`,
        [companyId]
      );
      
      // Deletar company_domains criados
      await pool.query(
        `DELETE FROM company_domains WHERE company_id = $1::uuid`,
        [companyId]
      );
      
      throw new Error(
        `Falha ao criar actor para empresa. Empresa não foi criada. ` +
        `Erro: ${err instanceof Error ? err.message : 'Erro desconhecido'}`
      );
    }

    // Criar preferências de oportunidade (estrutura mínima, sem matching automático)
    try {
      await pool.query(
        `
        INSERT INTO company_opportunity_preferences (
          company_id, tenant_id, receive_rfqs, receive_dispatches, matching_enabled
        )
        VALUES ($1::uuid, $2::uuid, false, false, false)
        ON CONFLICT (company_id) DO NOTHING
        `,
        [companyId, finalTenantId]
      );
    } catch (err) {
      // Não bloquear se tabela não existir ainda (migration pode não ter rodado)
      console.warn('[CompaniesService] Erro ao criar preferências de oportunidade (não bloqueante):', err);
    }

    // Buscar empresa completa
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    const companyUser = await this.getCompanyUserById(userResult.rows[0].company_user_id, globalUserId);

    if (!company || !companyUser) {
      throw new Error('Erro ao criar empresa');
    }

    return { company, companyUser };
  }

  /**
   * Resolve tenant_id a partir de global_user_id
   */
  private async resolveTenantIdFromGlobalUserId(globalUserId: string): Promise<string | null> {
    const result = await pool.query<{ tenant_id: string }>(
      `
      SELECT u.tenant_id
      FROM users u
      INNER JOIN global_users gu ON u.user_id = gu.user_id
      WHERE gu.global_user_id = $1::uuid
      LIMIT 1
      `,
      [globalUserId]
    );
    return result.rows[0]?.tenant_id || null;
  }

  /**
   * Mapeia row do banco para Company
   */
  private mapCompanyRow(row: {
    company_id: string;
    global_user_id: string;
    cnpj: string;
    company_name: string;
    trade_name: string | null;
    registered_at: Date | null;
    cep: string | null;
    address: string | null;
    address_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    main_activity_code: string | null;
    main_activity_description: string | null;
    secondary_activities: any;
    revenue_data: any;
    status: string;
    company_status: string;
    is_verified: boolean;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
  }): Company {
    return {
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      cnpj: row.cnpj,
      companyName: row.company_name,
      tradeName: row.trade_name || undefined,
      registrationDate: row.registered_at?.toISOString().split('T')[0],
      address: {
        cep: row.cep || undefined,
        address: row.address || undefined,
        addressNumber: row.address_number || undefined,
        complement: row.complement || undefined,
        neighborhood: row.neighborhood || undefined,
        city: row.city || undefined,
        state: row.state || undefined,
        country: row.country || undefined,
      },
      contact: {
        phone: row.phone || undefined,
        email: row.email || undefined,
        website: row.website || undefined,
      },
      activity: {
        mainActivityCode: row.main_activity_code || undefined,
        mainActivityDescription: row.main_activity_description || undefined,
        secondaryActivities: row.secondary_activities || [],
      },
      revenueData: row.revenue_data || undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      isVerified: row.is_verified,
      metadata: row.metadata || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Busca empresa por ID
   * 
   * 🔴 GARANTIA CANÔNICA: Cross-tenant leakage prevention
   * - SEMPRE filtra por tenant_id para prevenir vazamento entre tenants
   * - Nenhuma query pode usar apenas company_id isolado
   * - Usa runQueryWithTenant para garantir isolamento de tenant
   */
  async getCompanyById(companyId: string, globalUserId: string, tenantId?: string): Promise<Company | null> {
    // 🔴 CRÍTICO: tenantId é obrigatório para prevenir cross-tenant leakage
    if (!tenantId) {
      // 🔴 LOG CANÔNICO: Cross-tenant violation detectada
      const { canonicalLogger } = await import('@core/logging/canonical-logger');
      canonicalLogger.abuse(null, 'Cross-tenant violation: tenantId ausente em getCompanyById', {
        companyId,
        globalUserId,
      });
      throw new Error('CROSS_TENANT_LEAKAGE_PREVENTION: tenantId is required for getCompanyById');
    }

    // OVERRIDE DE TESTE: Ignorar ownership se for usuário de teste
    const userId = await this.resolveUserIdFromGlobalUserId(globalUserId, tenantId);
    if (userId && isTestOverrideUser(userId)) {
      // Buscar empresa sem verificar ownership (mas COM filtro tenant_id)
      const result = await runQueryWithTenant<{
        company_id: string;
        global_user_id: string;
        cnpj: string;
        company_name: string;
        trade_name: string | null;
        registered_at: Date | null;
        cep: string | null;
        address: string | null;
        address_number: string | null;
        complement: string | null;
        neighborhood: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        phone: string | null;
        email: string | null;
        website: string | null;
        main_activity_code: string | null;
        main_activity_description: string | null;
        secondary_activities: any;
        revenue_data: any;
        status: string;
        company_status: string;
        is_verified: boolean;
        metadata: any;
        createdAt: Date;
        updatedAt: Date;
      }>(
        tenantId,
        `
        SELECT *
        FROM companies
        WHERE tenant_id = $1 AND company_id = $2::uuid
        LIMIT 1
        `,
        [tenantId, companyId]
      );

      if (!result || !result.rows || result.rows.length === 0 || !result.rows[0]) {
        return null;
      }

      return this.mapCompanyRow(result.rows[0]);
    }

    // Comportamento normal (sem override) - usa runQueryWithTenant para garantir isolamento
    const result = await runQueryWithTenant<{
      company_id: string;
      global_user_id: string;
      cnpj: string;
      company_name: string;
      trade_name: string | null;
      registered_at: Date | null;
      cep: string | null;
      address: string | null;
      address_number: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      main_activity_code: string | null;
      main_activity_description: string | null;
      secondary_activities: any;
      revenue_data: any;
      status: string;
      company_status: string;
      is_verified: boolean;
      metadata: any;
      createdAt: Date;
      updatedAt: Date;
    }>(
      tenantId,
      `
      SELECT *
      FROM companies
      WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid
      LIMIT 1
      `,
      [tenantId, companyId, globalUserId]
    );

    if (!result || !result.rows || result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    return this.mapCompanyRow(result.rows[0]);
  }

  /**
   * Resolve user_id a partir de globalUserId (para override de teste)
   */
  private async resolveUserIdFromGlobalUserId(globalUserId: string, tenantId?: string): Promise<string | null> {
    if (tenantId) {
      const user = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `
        SELECT user_id FROM users
        WHERE global_user_id = $1::uuid
        LIMIT 1
        `,
        [globalUserId]
      );
      return user?.rows?.[0]?.user_id || null;
    }
    
    const user = await pool.query<{ user_id: string }>(
      `
      SELECT user_id FROM users
      WHERE global_user_id = $1::uuid
      LIMIT 1
      `,
      [globalUserId]
    );
    return user.rows[0]?.user_id || null;
  }

  /**
   * Lista todas as empresas do usuário
   * OVERRIDE: Se for usuário de teste, retorna todas as empresas
   */
  async listCompanies(globalUserId: string, tenantId?: string): Promise<Array<Company & { userRole: CompanyUser }>> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          operation: 'listCompanies',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para listCompanies');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        tenantId: finalTenantId,
        operation: 'listCompanies',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para listCompanies');
    }

    // OVERRIDE DE TESTE: Verificar se é usuário de teste
    const userId = await this.resolveUserIdFromGlobalUserId(globalUserId, finalTenantId);
    if (userId && isTestOverrideUser(userId)) {
      // 🔴 CORREÇÃO: Retornar TODAS as empresas (sem filtro de ownership, mas COM filtro tenant_id)
      const allCompaniesResult = await runQueryWithTenant<{
      company_id: string;
      global_user_id: string;
      cnpj: string;
      company_name: string;
      trade_name: string | null;
      registered_at: Date | null;
      cep: string | null;
      address: string | null;
      address_number: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      main_activity_code: string | null;
      main_activity_description: string | null;
      secondary_activities: any;
      revenue_data: any;
      status: string;
      company_status: string;
      is_verified: boolean;
      metadata: any;
      createdAt: Date;
      updatedAt: Date;
      company_user_id: string;
      role: string;
      role_description: string | null;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
      is_active: boolean;
      is_primary: boolean;
      cu_metadata: any;
      cu_createdAt: Date;
      cu_updatedAt: Date;
    }>(
      `
      SELECT 
        c.*,
        cu.company_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.is_active,
        cu.is_primary,
        cu.metadata as cu_metadata,
        cu.createdAt as cu_createdAt,
        cu.updatedAt as cu_updatedAt
      FROM companies c
      LEFT JOIN company_users cu ON c.company_id = cu.company_id AND cu.is_active = true
      WHERE c.tenant_id = $1
      ORDER BY c.createdAt DESC
      `,
      [finalTenantId]
    );
    
    return (allCompaniesResult?.rows || []).map(row => ({
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      cnpj: row.cnpj,
      companyName: row.company_name,
      tradeName: row.trade_name || undefined,
      registrationDate: row.registered_at?.toISOString().split('T')[0],
      address: {
        cep: row.cep || undefined,
        address: row.address || undefined,
        addressNumber: row.address_number || undefined,
        complement: row.complement || undefined,
        neighborhood: row.neighborhood || undefined,
        city: row.city || undefined,
        state: row.state || undefined,
        country: row.country || undefined,
      },
      contact: {
        phone: row.phone || undefined,
        email: row.email || undefined,
        website: row.website || undefined,
      },
      activity: {
        mainActivityCode: row.main_activity_code || undefined,
        mainActivityDescription: row.main_activity_description || undefined,
        secondaryActivities: row.secondary_activities || [],
      },
      revenueData: row.revenue_data || undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      isVerified: row.is_verified,
      metadata: row.metadata || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      userRole: {
        companyUserId: row.company_user_id,
        companyId: row.company_id,
        globalUserId: row.global_user_id,
        role: row.role as CompanyUser['role'],
        roleDescription: row.role_description || undefined,
        permissions: {
          canManageCompany: row.can_manage_company,
          canManageFinancial: row.can_manage_financial,
          canManageEmployees: row.can_manage_employees,
          canViewReports: row.can_view_reports,
          canManageServices: row.can_manage_services,
        },
        isActive: row.is_active,
        isPrimary: row.is_primary,
        metadata: row.cu_metadata || undefined,
        createdAt: row.cu_createdAt,
        updatedAt: row.cu_updatedAt,
      },
    }));
    }

    // 🔴 CORREÇÃO: Comportamento normal (sem override) COM filtro tenant_id
    const result = await runQueryWithTenant<{
      company_id: string;
      global_user_id: string;
      cnpj: string;
      company_name: string;
      trade_name: string | null;
      registered_at: Date | null;
      cep: string | null;
      address: string | null;
      address_number: string | null;
      complement: string | null;
      neighborhood: string | null;
      city: string | null;
      state: string | null;
      country: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      main_activity_code: string | null;
      main_activity_description: string | null;
      secondary_activities: any;
      revenue_data: any;
      status: string;
      company_status: string;
      is_verified: boolean;
      metadata: any;
      createdAt: Date;
      updatedAt: Date;
      company_user_id: string;
      role: string;
      role_description: string | null;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
      is_active: boolean;
      is_primary: boolean;
      cu_metadata: any;
      cu_createdAt: Date;
      cu_updatedAt: Date;
    }>(
      finalTenantId,
      `
      SELECT 
        c.*,
        cu.company_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.is_active,
        cu.is_primary,
        cu.metadata as cu_metadata,
        cu.createdAt as cu_createdAt,
        cu.updatedAt as cu_updatedAt
      FROM companies c
      LEFT JOIN company_users cu ON c.company_id = cu.company_id AND cu.is_active = true
      WHERE c.tenant_id = $1 AND c.global_user_id = $2::uuid
      ORDER BY c.createdAt DESC
      `,
      [finalTenantId, globalUserId]
    );

    return result.rows.map(row => ({
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      cnpj: row.cnpj,
      companyName: row.company_name,
      tradeName: row.trade_name || undefined,
      registrationDate: row.registered_at?.toISOString().split('T')[0],
      address: {
        cep: row.cep || undefined,
        address: row.address || undefined,
        addressNumber: row.address_number || undefined,
        complement: row.complement || undefined,
        neighborhood: row.neighborhood || undefined,
        city: row.city || undefined,
        state: row.state || undefined,
        country: row.country || undefined,
      },
      contact: {
        phone: row.phone || undefined,
        email: row.email || undefined,
        website: row.website || undefined,
      },
      activity: {
        mainActivityCode: row.main_activity_code || undefined,
        mainActivityDescription: row.main_activity_description || undefined,
        secondaryActivities: row.secondary_activities || [],
      },
      revenueData: row.revenue_data || undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      isVerified: row.is_verified,
      metadata: row.metadata || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      userRole: {
        companyUserId: row.company_user_id,
        companyId: row.company_id,
        globalUserId: row.global_user_id,
        role: row.role as CompanyUser['role'],
        roleDescription: row.role_description || undefined,
        permissions: {
          canManageCompany: row.can_manage_company,
          canManageFinancial: row.can_manage_financial,
          canManageEmployees: row.can_manage_employees,
          canViewReports: row.can_view_reports,
          canManageServices: row.can_manage_services,
        },
        isActive: row.is_active,
        isPrimary: row.is_primary,
        metadata: row.cu_metadata || undefined,
        createdAt: row.cu_createdAt,
        updatedAt: row.cu_updatedAt,
      },
    }));
  }

  /**
   * Atualiza empresa
   * 🔴 Bloqueia edição de CNPJ se company_status = 'validated'
   */
  async updateCompany(
    companyId: string,
    globalUserId: string,
    input: UpdateCompanyInput
  ): Promise<Company> {
    // 🔴 CRÍTICO: Resolver tenantId
    const finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
    if (!finalTenantId) {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para updateCompany');
    }

    // 🔴 Verificar se empresa está validada - CNPJ não pode ser editado
    const existing = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!existing) {
      throw new Error('Empresa não encontrada');
    }

    // 🔴 PROTEÇÃO: Bloquear alteração de CNPJ se status for VERIFIED ou superior
    // Regra: Empresas validadas não podem ter CNPJ alterado
    if (input.cnpj && (existing.companyStatus === 'VERIFIED' || existing.companyStatus === 'APPROVED')) {
      throw new Error(
        `CNPJ não pode ser editado. ` +
        `Empresa está com status "${existing.companyStatus}" e o CNPJ está bloqueado.`
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    // 🔴 Se tentou atualizar CNPJ, validar formato e atualizar
    if (input.cnpj !== undefined) {
      const formatValidation = this.validateCNPJFormat(input.cnpj);
      if (!formatValidation.valid) {
        throw new Error(formatValidation.error || 'CNPJ inválido');
      }
      const formattedCNPJ = this.formatCNPJ(input.cnpj);
      updates.push(`cnpj = $${paramIdx}`);
      values.push(formattedCNPJ);
      paramIdx++;
    }

    if (input.companyName !== undefined) {
      updates.push(`company_name = $${paramIdx}`);
      values.push(input.companyName);
      paramIdx++;
    }

    if (input.tradeName !== undefined) {
      updates.push(`trade_name = $${paramIdx}`);
      values.push(input.tradeName || null);
      paramIdx++;
    }

    if (input.registrationDate !== undefined) {
      updates.push(`registered_at = $${paramIdx}`);
      values.push(input.registrationDate ? new Date(input.registrationDate) : null);
      paramIdx++;
    }

    if (input.address) {
      if (input.address.cep !== undefined) updates.push(`cep = $${paramIdx}`), values.push(input.address.cep || null), paramIdx++;
      if (input.address.address !== undefined) updates.push(`address = $${paramIdx}`), values.push(input.address.address || null), paramIdx++;
      if (input.address.addressNumber !== undefined) updates.push(`address_number = $${paramIdx}`), values.push(input.address.addressNumber || null), paramIdx++;
      if (input.address.complement !== undefined) updates.push(`complement = $${paramIdx}`), values.push(input.address.complement || null), paramIdx++;
      if (input.address.neighborhood !== undefined) updates.push(`neighborhood = $${paramIdx}`), values.push(input.address.neighborhood || null), paramIdx++;
      if (input.address.city !== undefined) updates.push(`city = $${paramIdx}`), values.push(input.address.city || null), paramIdx++;
      if (input.address.state !== undefined) updates.push(`state = $${paramIdx}`), values.push(input.address.state || null), paramIdx++;
      if (input.address.country !== undefined) updates.push(`country = $${paramIdx}`), values.push(input.address.country || null), paramIdx++;
    }

    if (input.contact) {
      if (input.contact.phone !== undefined) updates.push(`phone = $${paramIdx}`), values.push(input.contact.phone || null), paramIdx++;
      if (input.contact.email !== undefined) updates.push(`email = $${paramIdx}`), values.push(input.contact.email || null), paramIdx++;
      if (input.contact.website !== undefined) updates.push(`website = $${paramIdx}`), values.push(input.contact.website || null), paramIdx++;
    }

    if (input.activity) {
      if (input.activity.mainActivityCode !== undefined) updates.push(`main_activity_code = $${paramIdx}`), values.push(input.activity.mainActivityCode || null), paramIdx++;
      if (input.activity.mainActivityDescription !== undefined) updates.push(`main_activity_description = $${paramIdx}`), values.push(input.activity.mainActivityDescription || null), paramIdx++;
      if (input.activity.secondaryActivities !== undefined) updates.push(`secondary_activities = $${paramIdx}`), values.push(JSON.stringify(input.activity.secondaryActivities || [])), paramIdx++;
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIdx}`);
      values.push(input.status);
      paramIdx++;
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIdx}`);
      values.push(JSON.stringify(input.metadata));
      paramIdx++;
    }

    if (input.companyStatus !== undefined) {
      updates.push(`company_status = $${paramIdx}`);
      values.push(input.companyStatus);
      paramIdx++;
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updatedAt = now()`);
    values.push(companyId, globalUserId, finalTenantId);

    await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE companies
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramIdx + 2} AND company_id = $${paramIdx}::uuid AND global_user_id = $${paramIdx + 1}::uuid
      `,
      values
    );

    const updated = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!updated) {
      throw new Error('Erro ao atualizar empresa');
    }

    return updated;
  }

  /**
   * Busca relacionamento usuário-empresa por ID
   */
  async getCompanyUserById(companyUserId: string, globalUserId: string, tenantId?: string): Promise<CompanyUser | null> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          companyUserId,
          operation: 'getCompanyUserById',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para getCompanyUserById');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        companyUserId,
        tenantId: finalTenantId,
        operation: 'getCompanyUserById',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para getCompanyUserById');
    }

    // 🔴 CORREÇÃO: Query COM filtro tenant_id via JOIN com companies
    const result = await runQueryWithTenant<{
      company_user_id: string;
      company_id: string;
      global_user_id: string;
      role: string;
      role_description: string | null;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
      is_active: boolean;
      is_primary: boolean;
      metadata: any;
      createdAt: Date;
      updatedAt: Date;
    }>(
      finalTenantId,
      `
      SELECT cu.*
      FROM company_users cu
      INNER JOIN companies c ON cu.company_id = c.company_id
      WHERE cu.company_user_id = $1::uuid 
        AND cu.global_user_id = $2::uuid
        AND c.tenant_id = $3
      LIMIT 1
      `,
      [companyUserId, globalUserId, finalTenantId]
    );

    if (!result || !result.rows || result.rows.length === 0 || !result.rows[0]) {
      return null;
    }

    const row = result.rows[0];
    return {
      companyUserId: row.company_user_id,
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      role: row.role as CompanyUser['role'],
      roleDescription: row.role_description || undefined,
      permissions: {
        canManageCompany: row.can_manage_company,
        canManageFinancial: row.can_manage_financial,
        canManageEmployees: row.can_manage_employees,
        canViewReports: row.can_view_reports,
        canManageServices: row.can_manage_services,
      },
      isActive: row.is_active,
      isPrimary: row.is_primary,
      metadata: row.metadata || undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Atualiza relacionamento usuário-empresa
   */
  async updateCompanyUser(
    companyUserId: string,
    globalUserId: string,
    input: UpdateCompanyUserInput,
    tenantId?: string
  ): Promise<CompanyUser> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          companyUserId,
          operation: 'updateCompanyUser',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para updateCompanyUser');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        companyUserId,
        tenantId: finalTenantId,
        operation: 'updateCompanyUser',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para updateCompanyUser');
    }
    const updates: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (input.role !== undefined) {
      updates.push(`role = $${paramIdx}`);
      values.push(input.role);
      paramIdx++;
    }

    if (input.roleDescription !== undefined) {
      updates.push(`role_description = $${paramIdx}`);
      values.push(input.roleDescription || null);
      paramIdx++;
    }

    if (input.permissions) {
      if (input.permissions.canManageCompany !== undefined) {
        updates.push(`can_manage_company = $${paramIdx}`);
        values.push(input.permissions.canManageCompany);
        paramIdx++;
      }
      if (input.permissions.canManageFinancial !== undefined) {
        updates.push(`can_manage_financial = $${paramIdx}`);
        values.push(input.permissions.canManageFinancial);
        paramIdx++;
      }
      if (input.permissions.canManageEmployees !== undefined) {
        updates.push(`can_manage_employees = $${paramIdx}`);
        values.push(input.permissions.canManageEmployees);
        paramIdx++;
      }
      if (input.permissions.canViewReports !== undefined) {
        updates.push(`can_view_reports = $${paramIdx}`);
        values.push(input.permissions.canViewReports);
        paramIdx++;
      }
      if (input.permissions.canManageServices !== undefined) {
        updates.push(`can_manage_services = $${paramIdx}`);
        values.push(input.permissions.canManageServices);
        paramIdx++;
      }
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramIdx}`);
      values.push(input.isActive);
      paramIdx++;
    }

    if (input.isPrimary !== undefined) {
      // 🔴 CORREÇÃO: Se está marcando como primária, desmarcar outras COM filtro tenant_id
      if (input.isPrimary) {
        // Buscar company_ids do usuário neste tenant
        const userCompanies = await runQueryWithTenant<{ company_id: string }>(
          finalTenantId,
          `
          SELECT c.company_id
          FROM companies c
          INNER JOIN company_users cu ON c.company_id = cu.company_id
          WHERE c.tenant_id = $1 AND cu.global_user_id = $2::uuid AND cu.is_active = true
          `,
          [finalTenantId, globalUserId]
        );

        if (userCompanies && userCompanies.rows && userCompanies.rows.length > 0) {
          const companyIds = userCompanies.rows.map(c => c.company_id);
          await runQueryWithTenant(
            finalTenantId,
            `
            UPDATE company_users
            SET is_primary = false, updatedAt = now()
            WHERE company_id = ANY($1::uuid[]) AND global_user_id = $2::uuid AND company_user_id != $3::uuid
            `,
            [companyIds, globalUserId, companyUserId]
          );
        }
      }
      updates.push(`is_primary = $${paramIdx}`);
      values.push(input.isPrimary);
      paramIdx++;
    }

    if (updates.length === 0) {
      const existing = await this.getCompanyUserById(companyUserId, globalUserId, finalTenantId);
      if (!existing) {
        throw new Error('Relacionamento não encontrado');
      }
      return existing;
    }

    updates.push(`updatedAt = now()`);
    values.push(companyUserId, globalUserId, finalTenantId);

    // 🔴 CORREÇÃO: UPDATE COM filtro tenant_id via JOIN
    await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE company_users cu
      SET ${updates.join(', ')}
      FROM companies c
      WHERE cu.company_id = c.company_id
        AND cu.company_user_id = $${paramIdx}::uuid 
        AND cu.global_user_id = $${paramIdx + 1}::uuid
        AND c.tenant_id = $${paramIdx + 2}
      `,
      values
    );

    const updated = await this.getCompanyUserById(companyUserId, globalUserId, finalTenantId);
    if (!updated) {
      throw new Error('Erro ao atualizar relacionamento');
    }

    return updated;
  }

  /**
   * Remove empresa (soft delete)
   * 🔴 REGRA: Bloquear remoção apenas se houver transações financeiras vinculadas
   * Permite remoção mesmo se company_status for APPROVED, desde que não haja transações
   */
  async deleteCompany(companyId: string, globalUserId: string, tenantId?: string): Promise<boolean> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          companyId,
          operation: 'deleteCompany',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para deleteCompany');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        companyId,
        tenantId: finalTenantId,
        operation: 'deleteCompany',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para deleteCompany');
    }

    // Verificar se empresa existe e pertence ao usuário
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // 🔴 PROTEÇÃO: Verificar se há transações financeiras associadas
    // Buscar accounts vinculados à empresa (se houver owner_type = 'company')
    const accounts = await pool.query<{ account_id: string }>(
      `
      SELECT account_id
      FROM accounts
      WHERE owner_id = $1::uuid AND owner_type = 'company'
      LIMIT 1
      `,
      [companyId]
    );

    if (accounts.rows.length > 0) {
      // Verificar se há transações envolvendo essas contas
      const accountIds = accounts.rows.map(a => a.account_id);
      const transactions = await pool.query<{ count: string }>(
        `
        SELECT COUNT(*) as count
        FROM transactions
        WHERE from_account = ANY($1::uuid[]) OR to_account = ANY($1::uuid[])
        `,
        [accountIds]
      );

      const txCount = parseInt(transactions.rows[0]?.count || '0', 10);
      if (txCount > 0) {
        throw new Error(
          `Não é possível excluir a empresa. Existem ${txCount} transação(ões) financeira(s) associada(s). ` +
          `Empresas com histórico financeiro não podem ser excluídas.`
        );
      }
    }

    // 🔴 CORREÇÃO: Se passou todas as verificações, fazer soft delete COM filtro tenant_id
    const result = await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE companies
      SET status = 'inactive', updatedAt = now()
      WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid
      `,
      [finalTenantId, companyId, globalUserId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Upload documento da empresa (PDF)
   * 🔴 SEGURANÇA: Valida MIME type + extensão, renomeia com UUID, registra auditoria
   */
  async uploadCompanyDocument(
    companyId: string,
    globalUserId: string,
    file: {
      filename: string;
      filepath: string;
      mimetype: string;
      size: number;
    },
    documentType: string = 'cnpj_receita',
    userIp?: string,
    tenantId?: string
  ): Promise<{ documentId: string; companyStatus: string; fileName: string }> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          companyId,
          operation: 'uploadCompanyDocument',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para uploadCompanyDocument');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        companyId,
        tenantId: finalTenantId,
        operation: 'uploadCompanyDocument',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para uploadCompanyDocument');
    }

    // Verificar se empresa existe e pertence ao usuário
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // 🔴 SEGURANÇA 1: Validar MIME type E extensão
    const validMimeTypes = ['application/pdf'];
    const validExtensions = ['.pdf'];
    const fileExtension = file.filename.toLowerCase().substring(file.filename.lastIndexOf('.'));
    
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new Error(`Tipo de arquivo inválido. Apenas PDF é aceito. Recebido: ${file.mimetype}`);
    }
    
    if (!validExtensions.includes(fileExtension)) {
      throw new Error(`Extensão inválida. Apenas arquivos .pdf são aceitos. Recebido: ${fileExtension}`);
    }

    // Validar tamanho (máximo 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new Error('Arquivo muito grande. Tamanho máximo: 10MB');
    }

    // 🔴 SEGURANÇA 2: Renomear arquivo com UUID (evita conflitos e exposição)
    const fileExtensionSafe = fileExtension || '.pdf';
    const uniqueFilename = `${randomUUID()}${fileExtensionSafe}`;
    
    // Construir URL relativa do arquivo (com nome seguro)
    const fileUrl = `/uploads/companies/${companyId}/${uniqueFilename}`;
    
    // Nota: O arquivo será salvo no filesystem pelo route handler com este nome único

    // 🔴 CORREÇÃO: Inserir documento no banco COM validação de tenant_id via JOIN
    // Nota: company_documents não tem tenant_id direto, então validamos via companies
    const result = await runQueryWithTenant<{
      document_id: string;
    }>(
      finalTenantId,
      `
      INSERT INTO company_documents (
        company_id,
        global_user_id,
        document_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        status
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, 'pending'
      FROM companies c
      WHERE c.company_id = $1::uuid 
        AND c.tenant_id = $8
        AND c.global_user_id = $2::uuid
      ON CONFLICT (company_id, document_type, status) 
      WHERE status = 'pending'
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        file_size = EXCLUDED.file_size,
        mime_type = EXCLUDED.mime_type,
        updatedAt = now()
      RETURNING document_id
      `,
      [
        companyId,
        globalUserId,
        documentType,
        uniqueFilename, // Usar nome único, não o original
        fileUrl,
        file.size,
        file.mimetype,
        finalTenantId,
      ]
    );

    if (!result || !result.rows || result.rows.length === 0 || !result.rows[0]) {
      throw new Error('Erro ao salvar documento');
    }

    // 🔴 AUDITORIA: Registrar log do upload
    const documentId = result.rows[0].document_id;
    console.log('[CompaniesService] 📄 Upload de documento:', {
      documentId,
      companyId,
      globalUserId,
      documentType,
      fileName: uniqueFilename,
      fileSize: file.size,
      userIp: userIp || 'unknown',
      timestamp: new Date().toISOString(),
    });

    // 🔴 CORREÇÃO: Atualizar status da empresa para 'PROVISIONAL' COM filtro tenant_id
    const statusUpdate = await runQueryWithTenant<{ company_status: string }>(
      finalTenantId,
      `
      UPDATE companies
      SET company_status = 'PROVISIONAL', updatedAt = now()
      WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid
        AND company_status != 'VERIFIED'
      RETURNING company_status
      `,
      [finalTenantId, companyId, globalUserId]
    );

    // 🔴 AUDITORIA: Log de mudança de status
    if (statusUpdate && statusUpdate.rows && statusUpdate.rows.length > 0 && statusUpdate.rows[0]) {
      console.log('[CompaniesService] 📊 Status da empresa alterado:', {
        companyId,
        globalUserId,
        oldStatus: company.companyStatus,
        newStatus: statusUpdate.rows[0].company_status,
        reason: 'upload_document',
        timestamp: new Date().toISOString(),
      });
    }

    // Buscar status atualizado
    const updatedCompany = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    
    return {
      documentId: result.rows[0].document_id,
      companyStatus: updatedCompany?.companyStatus || 'PROVISIONAL',
      fileName: uniqueFilename,
    };
  }

  /**
   * Lista documentos da empresa
   */
  async listCompanyDocuments(
    companyId: string,
    globalUserId: string,
    tenantId?: string
  ): Promise<Array<{
    documentId: string;
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    // 🔴 CRÍTICO: Resolver tenantId se não fornecido
    let finalTenantId = tenantId;
    if (!finalTenantId) {
      finalTenantId = await this.resolveTenantIdFromGlobalUserId(globalUserId);
      if (!finalTenantId) {
        console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: Não foi possível resolver tenantId para globalUserId', {
          globalUserId,
          companyId,
          operation: 'listCompanyDocuments',
          timestamp: new Date().toISOString(),
        });
        throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para listCompanyDocuments');
      }
    }

    // 🔴 CRÍTICO: Validar tenantId antes de qualquer query
    if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
      console.error('[CompaniesService] ❌ GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido', {
        globalUserId,
        companyId,
        tenantId: finalTenantId,
        operation: 'listCompanyDocuments',
        timestamp: new Date().toISOString(),
      });
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId inválido para listCompanyDocuments');
    }

    // Verificar se empresa existe e pertence ao usuário
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // 🔴 CORREÇÃO: Query COM filtro tenant_id via JOIN com companies
    const result = await runQueryWithTenant<{
      document_id: string;
      document_type: string;
      file_name: string;
      file_path: string;
      file_size: number;
      mime_type: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      finalTenantId,
      `
      SELECT 
        cd.document_id,
        cd.document_type,
        cd.file_name,
        cd.file_path,
        cd.file_size,
        cd.mime_type,
        cd.status,
        cd.createdAt,
        cd.updatedAt
      FROM company_documents cd
      INNER JOIN companies c ON cd.company_id = c.company_id
      WHERE cd.company_id = $1::uuid 
        AND cd.global_user_id = $2::uuid
        AND c.tenant_id = $3
      ORDER BY cd.createdAt DESC
      `,
      [companyId, globalUserId, finalTenantId]
    );

    return result.rows.map(row => ({
      documentId: row.document_id,
      documentType: row.document_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Lista documentos pendentes (ADMIN - todos os documentos pendentes)
   */
  async listPendingDocuments(): Promise<Array<{
    documentId: string;
    companyId: string;
    globalUserId: string;
    companyName: string;
    companyCnpj: string;
    documentType: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>> {
    const result = await pool.query<{
      document_id: string;
      company_id: string;
      global_user_id: string;
      company_name: string;
      company_cnpj: string;
      document_type: string;
      file_name: string;
      file_path: string;
      file_size: number;
      mime_type: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `
      SELECT 
        cd.document_id,
        cd.company_id,
        cd.global_user_id,
        c.company_name,
        c.cnpj as company_cnpj,
        cd.document_type,
        cd.file_name,
        cd.file_path,
        cd.file_size,
        cd.mime_type,
        cd.status,
        cd.createdAt,
        cd.updatedAt
      FROM company_documents cd
      INNER JOIN companies c ON cd.company_id = c.company_id
      WHERE cd.status = 'pending'
      ORDER BY cd.createdAt ASC
      `,
      []
    );

    return result.rows.map(row => ({
      documentId: row.document_id,
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      companyName: row.company_name,
      companyCnpj: row.company_cnpj,
      documentType: row.document_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  /**
   * Aprova ou rejeita documento (ADMIN)
   */
  async updateDocumentStatus(
    documentId: string,
    status: 'approved' | 'rejected',
    rejectedReason?: string,
    adminUserId?: string
  ): Promise<{ documentId: string; companyStatus: string }> {
    // Buscar documento
    const docResult = await pool.query<{
      document_id: string;
      company_id: string;
      global_user_id: string;
      document_type: string;
      status: string;
    }>(
      `
      SELECT document_id, company_id, global_user_id, document_type, status
      FROM company_documents
      WHERE document_id = $1::uuid
      LIMIT 1
      `,
      [documentId]
    );

    if (!docResult.rows[0]) {
      throw new Error('Documento não encontrado');
    }

    const doc = docResult.rows[0];

    // Atualizar status do documento com metadata
    const currentMetadata = await pool.query<{ metadata: any }>(
      `
      SELECT metadata FROM company_documents WHERE document_id = $1::uuid
      `,
      [documentId]
    );
    
    const existingMetadata = currentMetadata.rows[0]?.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      approved_by: adminUserId || null,
      approvedAt: new Date().toISOString(),
      ...(status === 'rejected' && rejectedReason ? { rejected_reason: rejectedReason } : {}),
    };

    await pool.query(
      `
      UPDATE company_documents
      SET 
        status = $1,
        metadata = $2::jsonb,
        updatedAt = now()
      WHERE document_id = $3::uuid
      `,
      [status, JSON.stringify(updatedMetadata), documentId]
    );

    // Se aprovado, atualizar status da empresa para 'VERIFIED'
    if (status === 'approved') {
      await pool.query(
        `
        UPDATE companies
        SET company_status = 'VERIFIED', is_verified = true, updatedAt = now()
        WHERE company_id = $1::uuid
        `,
        [doc.company_id]
      );

      // 🔴 AUDITORIA: Log de aprovação
      console.log('[CompaniesService] ✅ Documento aprovado:', {
        documentId,
        companyId: doc.company_id,
        globalUserId: doc.global_user_id,
        documentType: doc.document_type,
        approvedBy: adminUserId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    } else {
      // 🔴 AUDITORIA: Log de rejeição
      console.log('[CompaniesService] ❌ Documento rejeitado:', {
        documentId,
        companyId: doc.company_id,
        globalUserId: doc.global_user_id,
        documentType: doc.document_type,
        rejectedReason,
        rejectedBy: adminUserId || 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    // Buscar status atualizado da empresa
    const companyResult = await pool.query<{ company_status: string }>(
      `
      SELECT company_status
      FROM companies
      WHERE company_id = $1::uuid
      LIMIT 1
      `,
      [doc.company_id]
    );

    return {
      documentId,
      companyStatus: companyResult.rows[0]?.company_status || 'PROVISIONAL',
    };
  }

  /**
   * ADMIN OVERRIDE: Marca empresa como VERIFIED (apenas para testes internos)
   * ⚠️ ATENÇÃO: Esta função é apenas para testes. Não deve ser usada em produção sem auditoria adequada.
   * 
   * @param companyId ID da empresa
   * @param adminGlobalUserId ID do admin que está fazendo o override
   * @returns Empresa atualizada
   */
  async adminOverrideToVerified(
    companyId: string,
    adminGlobalUserId: string
  ): Promise<Company> {
    // 🔴 CRÍTICO: Resolver tenantId
    const finalTenantId = await this.resolveTenantIdFromGlobalUserId(adminGlobalUserId);
    if (!finalTenantId) {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para adminOverrideToVerified');
    }
    
    // Buscar empresa
    const company = await this.getCompanyById(companyId, adminGlobalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // Atualizar status para VERIFIED
    const result = await pool.query<{
      company_id: string;
      company_status: string;
      updatedAt: Date;
    }>(
      `
      UPDATE companies
      SET 
        company_status = 'VERIFIED',
        is_verified = true,
        updatedAt = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'validation_method', 'ADMIN_OVERRIDE',
          'validated_by', 'SYSTEM_ADMIN',
          'validatedAt', now(),
          'admin_global_user_id', $2::uuid
        )
      WHERE company_id = $1::uuid
      RETURNING company_id, company_status, updatedAt
      `,
      [companyId, adminGlobalUserId]
    );

    if (result.rows.length === 0) {
      throw new Error('Erro ao atualizar status da empresa');
    }

    // Retornar empresa atualizada
    return await this.getCompanyById(companyId, adminGlobalUserId, finalTenantId) as Company;
  }

  /**
   * Estrutura de dados para validação presencial (preparação para futuro)
   * Esta função não implementa a UI, apenas prepara a estrutura de dados
   */
  async prepareInPersonValidation(
    companyId: string,
    employeeId: string,
    partnerStoreId: string
  ): Promise<{
    validationToken: string;
    expiresAt: Date;
  }> {
    // Gerar token único para validação
    const validationToken = `VAL-${companyId.substring(0, 8)}-${Date.now()}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token válido por 7 dias

    // TODO: Criar tabela company_validations quando necessário
    // Por enquanto, apenas retorna estrutura
    return {
      validationToken,
      expiresAt,
    };
  }
}

export const companiesService = new CompaniesService();


