// src/core/companies/companies.service.ts
// Service para gerenciar empresas (PJ)

import { randomUUID } from 'crypto';
import { CompanyStatus } from '@unificard/contracts';
import { pool } from '@core/database/pool';
import { ensurePageActorTx } from '@modules/identity/actor-writer.service';
import { isActorEffectivelyBlocked } from '@modules/risk-identity/actor-effective-block';
import { socialPortsRegistry } from '@core/social/ports-registry';
import { isTestOverrideUser } from '../../utils/isTestOverrideUser';
import { runQueryWithTenant, runQueriesWithTenant, getClientWithTenant } from '@core/database/pool';
import { withTransaction } from '@core/database/transaction.helper';
import { HttpError } from '@core/errors/http-error';
import { locationRepository } from '@core/location/location.repository';
import type { CreateAddressInput } from '@core/location/location.types';
import type {
  Company,
  CompanyUser,
  CreateCompanyInput,
  UpdateCompanyInput,
  SelfUpdateCompanyUserInput,
  RevenueFederalData,
  CompanyAddress,
  CompanyContact,
  CompanyActivity,
  CompanyDomain,
  MarketplaceDomain,
} from './companies.types';

/**
 * Capabilities finas R2 materializadas em `company_users.can_*`
 * (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION). A whitelist mapeia chave → coluna real;
 * usada por canUserPerformCompanyCapability para autorizar SEM interpolar string de cliente.
 * Inclui as colunas pré-existentes reutilizadas (can_view_reports) e as criadas na migration
 * 20260613170000 (can_view_audit_logs / can_view_risk / can_manage_risk / can_manage_policy).
 */
export type CompanyCapabilityKey =
  | 'can_view_reports'
  | 'can_view_audit_logs'
  | 'can_view_risk'
  | 'can_manage_risk'
  | 'can_manage_policy';

const COMPANY_CAPABILITY_COLUMNS: Record<CompanyCapabilityKey, string> = {
  can_view_reports: 'can_view_reports',
  can_view_audit_logs: 'can_view_audit_logs',
  can_view_risk: 'can_view_risk',
  can_manage_risk: 'can_manage_risk',
  can_manage_policy: 'can_manage_policy',
};

/**
 * Capabilities TENANT-LEVEL materializadas em `tenant_operator_grants.can_*`
 * (F-R2-TENANT-LEVEL-OPERATOR-GRANTS, DECISION-0126). Modelo SEPARADO de company_users: destrava as
 * superfícies tenant-wide (reporting/risk-overview/audit-tenant/policy-tenant) que `company_users.can_*`
 * NUNCA pode abrir. Whitelist fixa (sem SQL injection). SOMENTE leitura/política não-financeira.
 */
export type TenantCapabilityKey =
  | 'can_view_tenant_reports'
  | 'can_view_tenant_audit_logs'
  | 'can_view_tenant_risk'
  | 'can_manage_tenant_policy'
  | 'can_view_tenant_trust'
  | 'can_manage_tenant_trust';

const TENANT_CAPABILITY_COLUMNS: Record<TenantCapabilityKey, string> = {
  can_view_tenant_reports: 'can_view_tenant_reports',
  can_view_tenant_audit_logs: 'can_view_tenant_audit_logs',
  can_view_tenant_risk: 'can_view_tenant_risk',
  can_manage_tenant_policy: 'can_manage_tenant_policy',
  can_view_tenant_trust: 'can_view_tenant_trust',
  can_manage_tenant_trust: 'can_manage_tenant_trust',
};

class CompaniesService {
  /**
   * Lista domínios de atuação da empresa.
   * Stub: retorna array vazio até implementação de persistência.
   */
  async getCompanyDomains(_companyId: string): Promise<CompanyDomain[]> {
    return [];
  }

  /**
   * Atualiza domínios de atuação da empresa.
   * Stub: retorna domínios passados até implementação de persistência.
   */
  async updateCompanyDomains(
    companyId: string,
    domains: MarketplaceDomain[]
  ): Promise<CompanyDomain[]> {
    return domains.map((domain, i) => ({
      companyDomainId: `stub-${companyId}-${i}`,
      companyId,
      domain,
      isEnabled: true,
      config: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    // Produto não resolve identidade (AUTHORITY_PRECEDENCE §4.5). Caller (rota) deve passar req.tenant?.id.
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para createCompany (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    // 🔴 Normalizar CNPJ defensivamente: remover formatação (pontos, barras, hífens)
    const normalizedCNPJ = input.cnpj.replace(/\D/g, '');
    
    // DECISION-0085 §4.3: dígito verificador validado na BORDA (função local, sem Receita/GovBR/internet).
    // Bloqueia antes de reservar a identidade fiscal — nenhuma fiscal_identity nasce com CNPJ inválido.
    const cnpjValidation = this.validateCNPJ(normalizedCNPJ);
    if (!cnpjValidation.valid) {
      throw new Error(cnpjValidation.error || 'CNPJ inválido');
    }

    // formattedCNPJ já é apenas números (normalizado acima)
    const formattedCNPJ = normalizedCNPJ;

    // 🔴 CORREÇÃO: Verificar se já existe COM filtro tenant_id
    const existingRows = await runQueriesWithTenant<{ company_id: string }>(
      finalTenantId,
      `
      SELECT company_id
      FROM companies
      WHERE tenant_id = $1 AND global_user_id = $2::uuid AND cnpj = $3
      LIMIT 1
      `,
      [finalTenantId, globalUserId, formattedCNPJ]
    );

    if (existingRows && existingRows.length > 0) {
      throw new Error('Empresa com este CNPJ já está cadastrada');
    }

    // OVERRIDE DE TESTE: Bypassar limite de PROVISIONAL para usuário de teste
    const userId = await this.resolveUserIdFromGlobalUserId(globalUserId, finalTenantId);
    if (!userId || !isTestOverrideUser(userId)) {
      // 🔴 CORREÇÃO: ANTI-FRAUDE com filtro tenant_id
      // F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL: o limite de onboarding conta TODOS os estados
      // pré-verificação (DRAFT = em configuração + PROVISIONAL = provisória pós-finalização),
      // não só PROVISIONAL. A empresa agora nasce DRAFT; contar só PROVISIONAL deixaria o
      // anti-fraude cego a rascunhos acumulados.
      const provisionalRows = await runQueriesWithTenant<{ count: string }>(
        finalTenantId,
        `
        SELECT COUNT(*) as count
        FROM companies
        WHERE tenant_id = $1 AND global_user_id = $2::uuid
          AND company_status IN ('DRAFT', 'PROVISIONAL')
          AND status != 'suspended'
        `,
        [finalTenantId, globalUserId]
      );

      const currentProvisionalCount = parseInt((provisionalRows?.[0]?.count || '0'), 10);
      const MAX_PROVISIONAL_PER_CPF = 3;

      if (currentProvisionalCount >= MAX_PROVISIONAL_PER_CPF) {
        throw new Error(
          `Limite de ${MAX_PROVISIONAL_PER_CPF} empresas em onboarding (rascunho/provisória) atingido. ` +
          `Conclua a verificação fiscal (KYB) de uma empresa existente ou aguarde antes de cadastrar novas.`
        );
      }
    }

    let revenueData: RevenueFederalData | null = null;
    // F-PJ-CNAE-EVIDENCE-WRITER (DECISION-0103 D7): momento em que a evidência fiscal foi obtida do provider.
    let revenueFetchedAt: Date | null = null;
    let companyName = input.companyName;
    let tradeName = input.tradeName;
    let address: CompanyAddress = input.address || {};
    let contact: CompanyContact = input.contact || {};
    // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): `activity` local removido — extração de CNAE
    // não era persistida (companies não tem colunas de atividade). Evidência CNAE irá para a casa fiscal.
    // F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL: a empresa NASCE DRAFT (em configuração).
    // Só vira PROVISIONAL quando o usuário finaliza o onboarding (activateCompanyOperationally,
    // Momento 2 — par soberano gravado). Antes disso ela não deve aparecer como cadastrada/pronta.
    // O fetch da Receita (prefill de nome/endereço) NÃO promove lifecycle.
    let companyStatus: CompanyStatus = 'DRAFT';

    // 🔴 Buscar dados da Receita Federal se solicitado (OPCIONAL - não bloqueia)
    if (input.fetchFromRevenue !== false) {
      try {
        revenueData = await this.fetchCNPJFromRevenue(formattedCNPJ);

        if (revenueData) {
          // F-PJ-CNAE-EVIDENCE-WRITER (DECISION-0103 D7): carimba quando a evidência fiscal foi obtida.
          revenueFetchedAt = new Date();
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

          // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): a extração de CNAE/atividade da Receita
          // para um `activity` local foi REMOVIDA — não era persistida (companies sem colunas de atividade;
          // o update tentava SET main_activity_code = ghost 42703). Evidência CNAE irá para a casa fiscal
          // (fiscal_identity_economic_activities) em frente própria (DECISION-0103 D2/D4). O fetch da Receita
          // segue intacto para prefill de nome/endereço/contato.

          // DECISION-0092/0093 + F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL: company_status é
          // lifecycle/onboarding; a empresa nasce DRAFT e o prefill da Receita NÃO a promove.
          // Verificação fiscal NÃO vem daqui — FONTE ÚNICA = fiscal_identities.kyb_status.
          companyStatus = 'DRAFT';
        } else {
          // Sem dados da Receita, mas com nome: continua DRAFT (em configuração).
          companyStatus = 'DRAFT';
        }
      } catch (err) {
        // 🔴 Erro na busca NÃO bloqueia cadastro
        console.warn('[CompaniesService] Erro ao buscar da Receita (não bloqueante):', err);
        companyStatus = 'DRAFT';
      }
    } else {
      // Se não tentou buscar, mas tem nome: continua DRAFT (em configuração).
      companyStatus = 'DRAFT';
    }

    // 🔴 Nome da empresa é obrigatório apenas se não veio da Receita
    if (!companyName) {
      throw new Error('Nome da empresa é obrigatório');
    }

    // 🔴 CORREÇÃO: Se há empresa primária, desmarcar outras COM filtro tenant_id
    if (input.isPrimary) {
      // Primeiro, buscar company_ids do usuário neste tenant
      const userCompaniesRows = await runQueriesWithTenant<{ company_id: string }>(
        finalTenantId,
        `
        SELECT c.company_id
        FROM companies c
        INNER JOIN company_users cu ON c.company_id = cu.company_id
        WHERE c.tenant_id = $1 AND cu.global_user_id = $2::uuid AND cu.is_active = true
        `,
        [finalTenantId, globalUserId]
      );

      if (userCompaniesRows && userCompaniesRows.length > 0) {
        const companyIds = userCompaniesRows.map(c => c.company_id);
        await runQueryWithTenant(
          finalTenantId,
          `
          UPDATE company_users
          SET is_primary = false, updated_at = NOW()
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

    // ── PRÉ-TX — actor humano do criador (LEITURA PURA, FORA da transação) ───────
    // PJ-B3 (F-PJ-HUMAN-TO-COMPANY-END-TO-END-CLOSURE): a pessoa humana JÁ NASCE com
    // identity+actor (C1). A criação de empresa NÃO cria nem repara actor humano —
    // resolve por leitura (findByUserId) e a ausência é erro estrutural honesto.
    // Nenhum writer de actor humano roda neste caminho (a cura via ensureUserActor
    // foi removida; só o page-actor da EMPRESA nasce aqui, dentro da transação).
    if (!userId) {
      throw new Error('userId é obrigatório para criar actors da empresa após o cadastro.');
    }
    const creatorActor = await socialPortsRegistry.getActorRepository().findByUserId(finalTenantId, userId);
    if (!creatorActor?.actor_id) {
      throw new Error(
        'COMPANY_CREATOR_ACTOR_MISSING: o criador não possui actor humano neste tenant. ' +
          'A criação de empresa não cria nem cura actors — o nascimento humano (C1) é o caminho canônico.'
      );
    }

    // Permissões + SOFT-BLOCK (validação que pode LANÇAR) — PRÉ-TX, antes de abrir transação.
    // F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH: defaults derivados do vocabulário ALINHADO ao banco
    // (owner/admin/staff/contractor/member). `owner` e `admin` carregam poder de gestão; staff/
    // contractor/member não. A autoridade material vive nestes flags can_manage_*, não no rótulo `role`.
    const isManagerTier = input.role === 'owner' || input.role === 'admin';
    const defaultPermissions = {
      // 🔴 F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED (Opção B): o CRIADOR da PJ sempre nasce com governança
      // inicial — `can_manage_company=true` imposto SERVER-SIDE, independente do `role` do formulário e
      // SEM confiar em `input.permissions.canManageCompany`. O `role` é preservado como rótulo/cargo
      // (vocabulário intacto); a autoridade material vive no flag (DT-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH).
      // Vale SÓ para o membership inicial do criador neste fluxo `createCompany`; membros adicionados
      // depois (company-members) seguem o vocabulário/permissões normais. Sem isto, um criador que escolhe
      // role≠owner nasce sem `canManageCompany` → empresa órfã de gestor/delegador (deadlock de governança).
      canManageCompany: true,
      canManageFinancial: input.permissions?.canManageFinancial ?? isManagerTier,
      canManageEmployees: input.permissions?.canManageEmployees ?? isManagerTier,
      canViewReports: input.permissions?.canViewReports ?? true,
      canManageServices: input.permissions?.canManageServices ?? isManagerTier,
      // DECISION-0116 adendo: criador NÃO precisa da flag — can_manage_company=true já
      // autoriza o consolidado. A flag nasce FALSE e só o writer admin-gated a concede.
      canViewConsolidatedInventory: false,
    };

    const { softBlockService } = await import('@core/authorization/soft-block.service');
    softBlockService.validateFlags(
      {
        can_manage_company: defaultPermissions.canManageCompany,
        can_manage_financial: defaultPermissions.canManageFinancial,
        can_manage_employees: defaultPermissions.canManageEmployees,
        can_manage_services: defaultPermissions.canManageServices,
      },
      {
        tenantId: finalTenantId,
        userId: userId || undefined,
        requestId: undefined, // TODO: extrair de request se disponível
      }
    );
    softBlockService.validateCompanyRole(input.role, {
      tenantId: finalTenantId,
      userId: userId || undefined,
      requestId: undefined,
    });

    // ── NÚCLEO TRANSACIONAL (F-ATOMIC-COMPANY-BIRTH / DECISION-0075 §9.2) ─────────
    // companies + company_users + page-actor numa ÚNICA transação. SEM cleanup
    // compensatório por DELETE: qualquer falha entre os passos → ROLLBACK total, zero órfão.
    // A escrita em `actors` permanece na camada actor-writer (ensurePageActorTx), só usando o
    // client desta transação (writer soberano §4.8). Endereço/domains/preferences saem para
    // pós-commit (não-críticos; nunca derrubam o núcleo já committado).
    let birthResult: { companyId: string; companyUserId: string; fiscalIdentityId: string };
    try {
      birthResult = await withTransaction(finalTenantId, async (client) => {
      // Tenant context DENTRO da tx (RLS de `actors`). set_config local=true após BEGIN: sobrevive
      // na transação e reverte no COMMIT (não vaza p/ conexão do pool).
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [finalTenantId]);

      // [FISCAL-FIRST] DECISION-0085 §4.6: reserva a identidade fiscal PJ pending + CNPJ único global
      // ANTES da company. CNPJ duplicado → UNIQUE global (uq_fiscal_identities_cnpj) explode AQUI,
      // dentro da tx → ROLLBACK total (fiscal + company + company_users + page-actor): zero órfão,
      // CNPJ nunca consumido pela metade. `fiscal_identities` é a FONTE da verdade do CNPJ.
      const fiscalRes = await client.query(
        `INSERT INTO fiscal_identities (cnpj, kyb_status, created_by_actor_id)
         VALUES ($1, 'pending', $2::uuid)
         RETURNING fiscal_identity_id, cnpj`,
        [formattedCNPJ, creatorActor.actor_id]
      );
      const fiscalId = fiscalRes.rows[0].fiscal_identity_id as string;
      const projectedCnpj = fiscalRes.rows[0].cnpj as string; // companies.cnpj = PROJEÇÃO da fonte fiscal

      const companyRes = await client.query(
        `
        INSERT INTO companies (
          tenant_id, global_user_id, fiscal_identity_id, cnpj, company_name, trade_name,
          status, company_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING company_id
        `,
        [
          finalTenantId,
          globalUserId,
          fiscalId,        // FK Opção 2: companies.fiscal_identity_id presente desde o nascimento pending
          projectedCnpj,   // projeção de fiscal_identities.cnpj (createCompany NÃO é fonte autônoma)
          companyName,
          tradeName || null,
          'active',
          // DECISION-0093 §4.3 / Fase 3.3-B1: is_verified REMOVIDO do INSERT (vestígio compat).
          // Verificação PJ = fiscal_identities.kyb_status. A coluna ainda existe (drop = Fase 3.3-B2).
          companyStatus, // Status do cadastro (PROVISIONAL/pending — não-operacional)
        ]
      );
      const newCompanyId = companyRes.rows[0].company_id as string;

      const userRes = await client.query(
        `
        INSERT INTO company_users (
          tenant_id, company_id, global_user_id, role, role_description,
          can_manage_company, can_manage_financial, can_manage_employees,
          can_view_reports, can_manage_services, can_view_consolidated_inventory,
          is_active, is_primary, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id AS company_user_id
        `,
        [
          finalTenantId,
          newCompanyId,
          globalUserId,
          input.role,
          input.roleDescription || null,
          defaultPermissions.canManageCompany,
          defaultPermissions.canManageFinancial,
          defaultPermissions.canManageEmployees,
          defaultPermissions.canViewReports,
          defaultPermissions.canManageServices,
          defaultPermissions.canViewConsolidatedInventory,
          true,
          input.isPrimary ?? false,
          JSON.stringify({}),
        ]
      );

      // Page-actor OBRIGATÓRIO (empresa não existe sem actor §4.8.2), na MESMA transação, via
      // writer soberano. Nasce pending/não-operacional (DECISION-0075 §9 / Opção B): o page-actor
      // existe mas NÃO habilita operação por si só. responsible_actor_id = actor humano do criador.
      const pageActor = await ensurePageActorTx(client, finalTenantId, newCompanyId, creatorActor.actor_id);

      // metadata/onboarding no page-actor (mesma tx) — EMPRESA_NASCIMENTO_CANONICO §1/§4/§7/§8.
      if (Object.keys(metadata).length > 0) {
        await client.query(
          `UPDATE actors
             SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('onboarding', $2::jsonb),
                 updated_at = NOW()
           WHERE actor_id = $1::uuid AND tenant_id = $3::uuid`,
          [pageActor.actor_id, JSON.stringify(metadata), finalTenantId]
        );
      }

      return {
        companyId: newCompanyId,
        companyUserId: userRes.rows[0].company_user_id as string,
        fiscalIdentityId: fiscalId,
      };
    });
    } catch (err: any) {
      // CNPJ duplicado na FONTE (uq_fiscal_identities_cnpj) → erro de domínio limpo, sem SQL cru vazando.
      if (err?.code === '23505' && /uq_fiscal_identities_cnpj/.test(String(err?.constraint ?? err?.message ?? ''))) {
        throw new Error('CNPJ já cadastrado no sistema: já existe identidade fiscal PJ para este CNPJ.');
      }
      throw err;
    }
    const { companyId, companyUserId } = birthResult;

    // ── PÓS-COMMIT — não-crítico: NUNCA derruba o núcleo já committado ───────────
    // 1) Endereço (opcional/enriquecimento). createAddressAndAssign é ATÔMICO (address +
    //    assignment numa tx própria): se falhar, a company permanece válida SEM endereço
    //    (estado válido) e NÃO sobra assignment órfão. Provado em teste (F-ATOMIC-COMPANY-BIRTH).
    if (address.cep || address.country) {
      try {
        const country = await locationRepository.findCountryByCode(address.country || 'BR');
        if (!country) {
          console.warn('[CompaniesService] Pais nao encontrado no catalogo de localizacao; empresa sem endereco canonico:', {
            tenantId: finalTenantId,
            companyId,
            countryCode: address.country || 'BR',
          });
        } else {
          const addressInput: CreateAddressInput = {
            countryId: country.id,
            stateId: null,
            cityId: null,
            neighborhoodId: null,
            postalCode: address.cep || null,
            street: address.address || null,
            number: address.addressNumber || null,
            complement: address.complement || null,
            reference: null,
            source: 'UX_INPUT',
            lat: null,
            lng: null,
          };

          const { address: createdAddress } = await locationRepository.createAddressAndAssign(
            addressInput,
            finalTenantId,
            { ownerType: 'company', ownerId: companyId, role: 'HQ', isPrimary: true }
          );

          await runQueryWithTenant(
            finalTenantId,
            `
            UPDATE companies
            SET primary_address_id = $1
            WHERE tenant_id = $2 AND company_id = $3
            `,
            [createdAddress.id, finalTenantId, companyId]
          );
        }
      } catch (err) {
        // Pós-commit: falha de endereço NÃO reverte o núcleo (company válida sem endereço).
        console.warn('[CompaniesService] Endereco pos-commit falhou (nucleo intacto, company sem endereco):', {
          tenantId: finalTenantId,
          companyId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 2) F-PJ-DOMAIN-SELECTOR-NEUTRALIZE (DECISION-0102 D9/D10): bloco GHOST de `company_domains` REMOVIDO.
    //    A escrita era pós-commit numa tabela INEXISTENTE (42P01 engolido), default 'market', livre escolha
    //    de frontend — drift sem persistência. Domínio de atuação não é livre escolha: deriva de CONCEPT +
    //    evidência fiscal, governado pelo backend. `input.domains` deixou de ser lido (e foi removido do tipo).

    // 3) Preferências de oportunidade — pós-commit, idempotente, tolerante a tabela ausente.
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

    // 4) F-PJ-CNAE-EVIDENCE-WRITER (DECISION-0103 D2/D3/D7/D8): persiste a evidência CNAE/atividade econômica
    //    retornada pelo fetch backend (ReceitaWS/BrasilAPI) na CASA FISCAL (fiscal_identity_economic_activities),
    //    ancorada em birthResult.fiscalIdentityId. Pós-commit best-effort / FAIL-OPEN (D8): a evidência é
    //    complementar — falha de coleta/persistência NÃO derruba a empresa já committada. NÃO persiste QSA (D5).
    //    CNAE é evidência, não identidade (não toca o par/CONCEPT, não autoriza domínio/publicação — D1/D10/D11).
    const hasActivityEvidence =
      !!revenueData &&
      !!revenueFetchedAt &&
      (((revenueData.atividade_principal?.length ?? 0) > 0) ||
        ((revenueData.atividades_secundarias?.length ?? 0) > 0));
    if (hasActivityEvidence && revenueData && revenueFetchedAt) {
      try {
        const { fiscalIdentityEconomicActivityService } = await import(
          '@core/identity/fiscal-identity-economic-activity.service'
        );
        await fiscalIdentityEconomicActivityService.persistEconomicActivities({
          fiscalIdentityId: birthResult.fiscalIdentityId,
          atividadePrincipal: revenueData.atividade_principal ?? null,
          atividadesSecundarias: revenueData.atividades_secundarias ?? null,
          // D7: provider-granular (receitaws/brasilapi) deixado para refresh futuro p/ não tocar o fetch;
          // 'receita_federal' identifica a origem fiscal da evidência (não-vazio, auditável).
          source: 'receita_federal',
          fetchedAt: revenueFetchedAt,
        });
      } catch (err) {
        // Pós-commit fail-open (D8): evidência complementar não reverte o núcleo já committado.
        console.warn('[CompaniesService] Persistência de evidência CNAE falhou (núcleo intacto, sem CNAE):', {
          tenantId: finalTenantId,
          companyId,
          fiscalIdentityId: birthResult.fiscalIdentityId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Buscar empresa completa
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    const companyUser = await this.getCompanyUserById(companyUserId, globalUserId, finalTenantId);

    if (!company || !companyUser) {
      throw new Error('Erro ao criar empresa');
    }

    return { company, companyUser };
  }

  /**
   * Ativação operacional da empresa (Momento 2) — single writer (Fase 3B.3).
   * Desenho: docs/02_decisions/DESENHO_FASE_3B_EMPRESA_DOIS_MOMENTOS.md (commit 691b2169).
   *
   * Três fases. A Fase 2 RESOLVE os actors por leitura pura (findByUserId/findByCompanyId)
   * — a ativação não cria nem cura actors (PJ-B3); ambos nasceram na transação de
   * createCompany. Só a Fase 3 abre transação (getClientWithTenant) e grava APENAS a
   * classificação primária (primary_company_type_id + primary_concept_id). SEM capabilities
   * (dívida D-CONCEPT/D-CONTEXT-RESOLVER). Falha em qualquer ponto → fail-closed.
   */
  async activateCompanyOperationally(input: {
    tenantId: string;
    companyId: string;
    responsibleUserId: string;
    primaryCompanyTypeId: string;
    primaryConceptId: string;
  }): Promise<{
    companyId: string;
    pageActorId: string;
    responsibleActorId: string;
    primaryCompanyTypeId: string;
    primaryConceptId: string;
    alreadyActive: boolean;
  }> {
    const { tenantId, companyId, responsibleUserId, primaryCompanyTypeId, primaryConceptId } = input;

    // ── FASE 1 — validações (FORA de transação) ──────────────────────────────
    const company = await runQueryWithTenant<{
      company_id: string;
      primary_company_type_id: string | null;
      primary_concept_id: string | null;
    }>(
      tenantId,
      `SELECT company_id, primary_company_type_id, primary_concept_id
         FROM companies
        WHERE company_id = $1 AND tenant_id = $2
        LIMIT 1`,
      [companyId, tenantId]
    );
    if (!company) {
      throw this.activationError('COMPANY_NOT_FOUND', `Empresa ${companyId} não encontrada no tenant`, 404);
    }

    const companyType = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `SELECT id FROM company_types WHERE id = $1 LIMIT 1`,
      [primaryCompanyTypeId]
    );
    if (!companyType) {
      throw this.activationError('COMPANY_TYPE_NOT_FOUND', `company_type ${primaryCompanyTypeId} inexistente`, 404);
    }

    const concept = await runQueryWithTenant<{ concept_id: string }>(
      tenantId,
      `SELECT concept_id FROM concepts WHERE concept_id = $1 LIMIT 1`,
      [primaryConceptId]
    );
    if (!concept) {
      throw this.activationError('CONCEPT_NOT_FOUND', `concept ${primaryConceptId} inexistente`, 404);
    }

    const allowedPair = await runQueryWithTenant<{ ok: number }>(
      tenantId,
      `SELECT 1 AS ok FROM company_type_allowed_concepts
        WHERE company_type_id = $1 AND concept_id = $2 LIMIT 1`,
      [primaryCompanyTypeId, primaryConceptId]
    );
    if (!allowedPair) {
      throw this.activationError(
        'COMPANY_TYPE_CONCEPT_NOT_ALLOWED',
        `par (company_type=${primaryCompanyTypeId}, concept=${primaryConceptId}) não permitido em company_type_allowed_concepts`,
        400
      );
    }

    // Idempotência preliminar: par diferente já gravado → fail fast (evita criar page-actor à toa).
    if (company.primary_company_type_id !== null || company.primary_concept_id !== null) {
      const samePair =
        company.primary_company_type_id === primaryCompanyTypeId &&
        company.primary_concept_id === primaryConceptId;
      if (!samePair) {
        throw this.activationError(
          'COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION',
          `empresa ${companyId} já operacional com classificação diferente`,
          409
        );
      }
    }

    // ── FASE 2 — resolver identidade operacional (LEITURA PURA, fora de transação) ──
    // PJ-B3: a ativação NÃO cura actor (nem humano nem page). Ambos nasceram na transação
    // de createCompany (F-ATOMIC-COMPANY-BIRTH); ausência aqui é corrupção estrutural →
    // erro honesto, nunca find-or-create.
    const actorRepo = socialPortsRegistry.getActorRepository();
    const responsibleActor = await actorRepo.findByUserId(tenantId, responsibleUserId);
    if (!responsibleActor?.actor_id) {
      throw this.activationError(
        'RESPONSIBLE_ACTOR_NOT_FOUND',
        `actor humano responsável (user ${responsibleUserId}) não existe — ativação não cria/cura actors`,
        404
      );
    }
    const pageActor = await actorRepo.findByCompanyId(tenantId, companyId);
    if (!pageActor?.actor_id || pageActor.actor_type !== 'page') {
      throw this.activationError(
        'PAGE_ACTOR_AMBIGUOUS',
        `page-actor da empresa ${companyId} ausente/inesperado — deveria ter nascido na criação (ativação não cria/cura actors)`,
        500
      );
    }

    // 🔴 F-COMPANY-OPERATIONAL-ACTIVATION-QUARANTINE-GATE (§4.8.4) — gestão/representação ≠ autoridade-ativa.
    // canManageCompany (rota) prova membership; NÃO prova que a autoridade está ATIVA. Se o actor institucional
    // da empresa (page-actor — sua âncora humana cascateia) OU o responsável que ativa estão efetivamente
    // bloqueados (atl_blocked_actors, via isActorEffectivelyBlocked — mesmo primitivo do offering-gate/capability-grant),
    // a ativação operacional é CONGELADA. Fail-closed, ANTES de qualquer escrita (BEGIN/SELECT FOR UPDATE/UPDATE).
    if (
      (await isActorEffectivelyBlocked(tenantId, pageActor.actor_id)) ||
      (await isActorEffectivelyBlocked(tenantId, responsibleActor.actor_id))
    ) {
      throw this.activationError(
        'ACTOR_EFFECTIVELY_BLOCKED',
        'autoridade institucional/responsável em quarentena — ativação operacional bloqueada',
        403
      );
    }

    // ── FASE 3 — transação da classificação (SÓ SELECT FOR UPDATE + UPDATE) ──
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');

      const locked = await client.query<{
        primary_company_type_id: string | null;
        primary_concept_id: string | null;
      }>(
        `SELECT primary_company_type_id, primary_concept_id
           FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          FOR UPDATE`,
        [companyId, tenantId]
      );
      if (locked.rowCount === 0) {
        await client.query('ROLLBACK');
        throw this.activationError('COMPANY_NOT_FOUND', `Empresa ${companyId} desapareceu sob lock`, 404);
      }

      const cur = locked.rows[0];
      if (cur.primary_company_type_id !== null || cur.primary_concept_id !== null) {
        const samePair =
          cur.primary_company_type_id === primaryCompanyTypeId &&
          cur.primary_concept_id === primaryConceptId;
        if (samePair) {
          await client.query('COMMIT');
          return {
            companyId,
            pageActorId: pageActor.actor_id,
            responsibleActorId: responsibleActor.actor_id,
            primaryCompanyTypeId,
            primaryConceptId,
            alreadyActive: true,
          };
        }
        await client.query('ROLLBACK');
        throw this.activationError(
          'COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION',
          `empresa ${companyId} já operacional com classificação diferente (detectado sob lock)`,
          409
        );
      }

      // F-PJ-LIFECYCLE-DRAFT-TO-PROVISIONAL: este é o Momento 2 (finalização do onboarding).
      // Além de gravar o par soberano, promove DRAFT → PROVISIONAL no MESMO UPDATE atômico.
      // CASE só promove quando ainda está DRAFT — não regride PROVISIONAL/ACTIVE/SUSPENDED
      // nem confere verificação (KYB é eixo separado em fiscal_identities.kyb_status).
      await client.query(
        `UPDATE companies
            SET primary_company_type_id = $1,
                primary_concept_id = $2,
                company_status = CASE WHEN company_status = 'DRAFT' THEN 'PROVISIONAL' ELSE company_status END,
                updated_at = now()
          WHERE company_id = $3 AND tenant_id = $4`,
        [primaryCompanyTypeId, primaryConceptId, companyId, tenantId]
      );

      await client.query('COMMIT');

      return {
        companyId,
        pageActorId: pageActor.actor_id,
        responsibleActorId: responsibleActor.actor_id,
        primaryCompanyTypeId,
        primaryConceptId,
        alreadyActive: false,
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // rollback best-effort; erro original prevalece
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Autoridade contextual sobre a empresa (F-PJ-ACTIVATION-ROUTE-WRITE-PAIR).
   * O writer activateCompanyOperationally NÃO verifica se o chamador pode gerir ESTA
   * empresa — autoridade contextual vive em company_users, NÃO em roles sistêmicos
   * (cf. companies.routes §submit-validation). Retorna true se o usuário é membro ativo
   * com can_manage_company OU role='owner'. Fail-closed: ausência de vínculo → false.
   */
  async canManageCompany(tenantId: string, companyId: string, globalUserId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ can_manage: boolean }>(
      tenantId,
      `SELECT (cu.can_manage_company OR cu.role = 'owner') AS can_manage
         FROM company_users cu
        WHERE cu.tenant_id = $1 AND cu.company_id = $2 AND cu.global_user_id = $3::uuid
          AND cu.is_active = true AND cu.member_status = 'active'
        LIMIT 1`,
      [tenantId, companyId, globalUserId]
    );
    return row?.can_manage === true;
  }

  /**
   * F-COMPANY-AGENDA-REAL-WIRING: resolve o page-actor de uma empresa, para superfícies (ex.: o
   * wizard de onboarding, ANTES de activateCompanyOperationally) que precisam materializar dados
   * ligados ao actor (agenda) sem esperar a empresa virar "operacional" — o page-actor nasce
   * atomicamente na criação da empresa (F-ATOMIC-COMPANY-BIRTH), NÃO na ativação; e canManageCompany
   * (a autoridade real) também não depende de company_status/ativação. LEITURA PURA, não cria/cura.
   */
  async getPageActorId(tenantId: string, companyId: string): Promise<string | null> {
    const actorRepo = socialPortsRegistry.getActorRepository();
    const pageActor = await actorRepo.findByCompanyId(tenantId, companyId);
    return pageActor?.actor_id ?? null;
  }

  /**
   * Autorizador da projeção consolidada de estoque (DECISION-0116 adendo COMPANY_INTERNAL).
   * Autorizado quando há vínculo ATIVO em company_users com:
   *   can_manage_company (mesma semântica de canManageCompany, incl. role='owner')
   *   OU can_view_consolidated_inventory (permissão específica concedida pelo admin).
   * Fail-closed: sem vínculo / inativo / suspenso → false. NÃO usa actorId de cliente,
   * NÃO usa capability default (can_manage_marketplace), NÃO usa FASE 6, NÃO cria actor.
   */
  async canViewConsolidatedInventory(tenantId: string, companyId: string, globalUserId: string): Promise<boolean> {
    const row = await runQueryWithTenant<{ can_view: boolean }>(
      tenantId,
      `SELECT (cu.can_manage_company OR cu.role = 'owner' OR cu.can_view_consolidated_inventory) AS can_view
         FROM company_users cu
        WHERE cu.tenant_id = $1 AND cu.company_id = $2 AND cu.global_user_id = $3::uuid
          AND cu.is_active = true AND cu.member_status = 'active'
        LIMIT 1`,
      [tenantId, companyId, globalUserId]
    );
    return row?.can_view === true;
  }

  /**
   * R2 FINE-GRAINED GRANTS (F-R2-COMPANY-USERS-FINE-GRANTS-MATERIALIZATION, 2026-06-13 ·
   * ESCOPO CORRIGIDO F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE, 2026-06-14, DECISION-0125 §escopo).
   * Autorizador genérico de capability fina sobre `company_users.can_*` — a fonte material do R2
   * mínimo. Generaliza canManageCompany/canViewConsolidatedInventory para qualquer can_* whitelisted.
   *
   * SUBJECT = `userId` (req.user.id server-side; users.id). A identidade global é resolvida DENTRO da
   * query pelo JOIN canônico `users.global_user_id` — NÃO confia em req.user.globalUserId (opcional)
   * nem em actorId client-declared. O actorId de params/query/body/actionContext NUNCA é subject.
   *
   * 🔴 ESCOPO COMPANY OBRIGATÓRIO (reseal Yala / decisão Clayton): `companyId` é REQUERIDO. Um grant
   * em UMA empresa NÃO autoriza leitura tenant-wide. Sem companyId resolvido → **fail-closed**
   * (`allowed=false, reason='company_scope_required'`). Com companyId → verifica o vínculo NAQUELA
   * empresa. `owner`/`can_manage_company` são supergrant SÓ DENTRO da empresa escopada — NUNCA viram
   * supergrant tenant-wide. A leitura tenant-wide/platform-admin ampla permanece DECISION_REQUIRED
   * (sem modelo de grant tenant-level/platform-operator). Coluna por whitelist fixa (sem SQL injection).
   */
  async canUserPerformCompanyCapability(
    tenantId: string,
    userId: string,
    capability: CompanyCapabilityKey,
    opts?: { companyId?: string }
  ): Promise<{ allowed: boolean; source: 'company_users.can_*'; reason?: string }> {
    const column = COMPANY_CAPABILITY_COLUMNS[capability];
    if (!column) {
      // capability fora da whitelist = erro de programação; fail-closed (nunca abre acesso).
      throw new Error(`canUserPerformCompanyCapability: capability não suportada: ${String(capability)}`);
    }
    if (!userId) {
      return { allowed: false, source: 'company_users.can_*', reason: 'no_subject' };
    }
    // 🔴 fail-closed sem escopo company: grant é per-empresa, nunca tenant-wide.
    if (!opts?.companyId) {
      return { allowed: false, source: 'company_users.can_*', reason: 'company_scope_required' };
    }
    const row = await runQueryWithTenant<{ allowed: boolean }>(
      tenantId,
      `SELECT (cu.can_manage_company OR cu.role = 'owner' OR cu.${column}) AS allowed
         FROM company_users cu
         JOIN users u ON u.global_user_id = cu.global_user_id
        WHERE cu.tenant_id = $1 AND u.id = $2::uuid AND cu.company_id = $3::uuid
          AND cu.is_active = true AND cu.member_status = 'active'
          AND (cu.can_manage_company OR cu.role = 'owner' OR cu.${column})
        LIMIT 1`,
      [tenantId, userId, opts.companyId]
    );
    return row?.allowed === true
      ? { allowed: true, source: 'company_users.can_*' }
      : { allowed: false, source: 'company_users.can_*', reason: 'no_grant_in_company' };
  }

  /**
   * R2 TENANT-LEVEL OPERATOR GRANTS (F-R2-TENANT-LEVEL-OPERATOR-GRANTS, 2026-06-14, DECISION-0126).
   * Autorizador tenant-level sobre `tenant_operator_grants.can_*` — modelo MATERIAL SEPARADO de
   * company_users. Destrava as superfícies tenant-wide que `company_users.can_*` NUNCA pode abrir.
   *
   * SUBJECT = userId (req.user.id server-side; users.id). Identidade global resolvida pelo JOIN canônico
   * users.global_user_id — actorId client-declared NUNCA é subject. Grant em tenant A NÃO vale tenant B
   * (filtro tog.tenant_id = $tenantId do request). Fail-closed: sem grant ativo com a capability → false.
   * Coluna por whitelist fixa (sem SQL injection). NÃO consulta company_users (modelos separados).
   */
  async canUserPerformTenantCapability(
    tenantId: string,
    userId: string,
    capability: TenantCapabilityKey
  ): Promise<{ allowed: boolean; source: 'tenant_operator_grants.can_*'; reason?: string }> {
    const column = TENANT_CAPABILITY_COLUMNS[capability];
    if (!column) {
      throw new Error(`canUserPerformTenantCapability: capability não suportada: ${String(capability)}`);
    }
    if (!userId) {
      return { allowed: false, source: 'tenant_operator_grants.can_*', reason: 'no_subject' };
    }
    const row = await runQueryWithTenant<{ allowed: boolean }>(
      tenantId,
      `SELECT tog.${column} AS allowed
         FROM tenant_operator_grants tog
         JOIN users u ON u.global_user_id = tog.global_user_id
        WHERE tog.tenant_id = $1 AND u.id = $2::uuid
          AND tog.is_active = true AND tog.${column} = true
        LIMIT 1`,
      [tenantId, userId]
    );
    return row?.allowed === true
      ? { allowed: true, source: 'tenant_operator_grants.can_*' }
      : { allowed: false, source: 'tenant_operator_grants.can_*', reason: 'no_tenant_grant' };
  }

  /**
   * Resolve o `companyId` material de um actor-alvo (F-R2-FINE-GRANTS-ANCHOR-AND-SCOPE-CLOSURE).
   * Usa `actors.company_id` (page/company-actor tem company_id; user-actor tem NULL). Server-side,
   * fail-closed: actor inexistente / sem company_id → null (⇒ o caller deve negar com
   * `company_scope_required`). NÃO confia em nada client-declared além do id consultado contra o tenant.
   */
  async resolveCompanyIdForActor(tenantId: string, actorId?: string | null): Promise<string | null> {
    if (!actorId) return null;
    const row = await runQueryWithTenant<{ cid: string | null }>(
      tenantId,
      `SELECT company_id::text AS cid
         FROM actors
        WHERE tenant_id = $1 AND id = $2::uuid AND company_id IS NOT NULL
        LIMIT 1`,
      [tenantId, actorId]
    );
    return row?.cid ?? null;
  }

  /**
   * Writer da permissão específica de consolidado (DECISION-0116 adendo).
   * Só quem canManageCompany na empresa-alvo concede/remove. O caminho NÃO toca
   * can_manage_company (campo único, sem permissions genéricas). Não usa R2/role textual/
   * capability default. O PUT self-scoped de company_users NÃO recebe este campo —
   * auto-concessão é vedada por desenho (membro não escala a própria visão).
   */
  async setConsolidatedInventoryPermission(
    tenantId: string,
    companyId: string,
    callerGlobalUserId: string,
    targetCompanyUserId: string,
    canView: boolean
  ): Promise<{ companyUserId: string; canViewConsolidatedInventory: boolean }> {
    const allowed = await this.canManageCompany(tenantId, companyId, callerGlobalUserId);
    if (!allowed) {
      throw HttpError.forbidden('Sem autoridade para gerir permissões desta empresa (canManageCompany)');
    }

    const row = await runQueryWithTenant<{ id: string; can_view_consolidated_inventory: boolean }>(
      tenantId,
      `UPDATE company_users cu
          SET can_view_consolidated_inventory = $1, updated_at = NOW()
        WHERE cu.id = $2::uuid AND cu.company_id = $3 AND cu.tenant_id = $4
        RETURNING cu.id, cu.can_view_consolidated_inventory`,
      [canView, targetCompanyUserId, companyId, tenantId]
    );
    if (!row) {
      throw HttpError.notFound('Vínculo de membro não encontrado nesta empresa');
    }
    return { companyUserId: row.id, canViewConsolidatedInventory: row.can_view_consolidated_inventory };
  }

  /**
   * Catálogo governado de company_types (F-PJ-ACTIVATION-READ-ENDPOINTS).
   * Global (sem tenant); alimenta a seleção do par no onboarding. SEM metadata/businessType.
   */
  async listOperationalCompanyTypes(tenantId: string): Promise<Array<{
    companyTypeId: string;
    slug: string;
    name: string;
    defaultDepartmentSlugs: string[];
    defaultBranchSlugs: string[];
  }>> {
    const rows = await runQueriesWithTenant<{
      id: string;
      name: string;
      slug: string;
      default_department_slugs: string[];
      default_branch_slugs: string[];
    }>(
      tenantId,
      `SELECT id, name, slug, default_department_slugs, default_branch_slugs
         FROM company_types
        ORDER BY name ASC`,
      []
    );
    return rows.map((r) => ({
      companyTypeId: r.id,
      slug: r.slug,
      name: r.name,
      defaultDepartmentSlugs: r.default_department_slugs ?? [],
      defaultBranchSlugs: r.default_branch_slugs ?? [],
    }));
  }

  /**
   * Conceitos PERMITIDOS por company_type (company_type_allowed_concepts ⋈ concepts).
   * F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS (DECISION-0107): expõe `displayName`/`shortLabel` por LEFT JOIN
   * em `concept_labels` (primária pt-BR/default). `concept_id`/`slug` seguem identidade; o label é
   * APRESENTAÇÃO (nunca chave de identidade; o JOIN é só projeção). Fallback honesto: sem label → null
   * (o frontend faz `displayName ?? slug`). Retorna null se o company_type não existe (→ 404 na rota);
   * [] se existe mas não tem pares allowed.
   */
  async listAllowedConceptsForCompanyType(
    tenantId: string,
    companyTypeId: string
  ): Promise<Array<{ conceptId: string; slug: string; domain: string; displayName: string | null; shortLabel: string | null }> | null> {
    const type = await runQueryWithTenant<{ id: string }>(
      tenantId,
      `SELECT id FROM company_types WHERE id = $1 LIMIT 1`,
      [companyTypeId]
    );
    if (!type) return null;
    const rows = await runQueriesWithTenant<{ concept_id: string; slug: string; domain: string; display_name: string | null; short_label: string | null }>(
      tenantId,
      `SELECT c.concept_id, c.slug, c.domain, cl.label AS display_name, cl.short_label
         FROM company_type_allowed_concepts a
         JOIN concepts c ON c.concept_id = a.concept_id
         LEFT JOIN concept_labels cl
           ON cl.concept_id = c.concept_id
          AND cl.locale = 'pt-BR' AND cl.context_key = 'default' AND cl.is_primary = true
        WHERE a.company_type_id = $1
        ORDER BY c.domain ASC, c.slug ASC`,
      [companyTypeId]
    );
    return rows.map((r) => ({ conceptId: r.concept_id, slug: r.slug, domain: r.domain, displayName: r.display_name ?? null, shortLabel: r.short_label ?? null }));
  }

  /**
   * F-PJ-CNAE-TO-CONCEPT-SUGGESTION-READ-ENDPOINT (DECISION-0104): consulta READ-ONLY de sugestão
   * CNAE → concept a partir da matriz curada `cnae_concept_suggestions` (seed γ).
   *
   * CNAE é SINAL/sugestão (D1): este método SÓ sugere; NÃO ativa empresa, NÃO escreve
   * companies.primary_company_type_id/primary_concept_id, NÃO publica, NÃO toca canonical_products/Bank.
   * Normaliza o CNAE (strip não-dígitos → 7 dígitos) — resolve a costura de formato
   * (DT-PJ-CNAE-CODE-FORMAT-NORMALIZATION-SEAM): a matriz guarda dígitos; a evidência guarda o formato do
   * provider; o consumidor normaliza antes do lookup. `companyType` derivado com segurança SÓ se exatamente
   * um company_type permitir o concept (company_type_allowed_concepts) — não vira autoridade. Display name do
   * concept é LEITURA do substrato (hoje ausente → null; DT-PJ-CONCEPT-DISPLAY-NAME-MISSING), nunca nova fonte.
   * A matriz é GLOBAL (sem tenant): pool direto.
   */
  async suggestConceptForCnae(rawCnae: string): Promise<{
    valid: boolean;
    normalizedCnaeCode: string;
    suggestion: {
      cnaeCode: string;
      normalizedCnaeCode: string;
      description: string;
      suggestedConceptId: string;
      suggestedConceptSlug: string;
      suggestedConceptDisplayName: string | null;
      confidence: string;
      source: string;
      version: string;
      companyTypeId: string | null;
      companyTypeSlug: string | null;
    } | null;
  }> {
    const normalized = String(rawCnae ?? '').replace(/\D/g, '');
    if (!/^\d{7}$/.test(normalized)) {
      return { valid: false, normalizedCnaeCode: normalized, suggestion: null };
    }

    const rows = await pool.query<{
      cnae_code: string;
      suggested_concept_id: string;
      concept_slug: string;
      display_name: string | null;
      confidence: string;
      rationale: string;
      source: string;
      catalog_version: string;
    }>(
      // F-PJ-CONCEPT-LABELS-EXPOSE-ENDPOINTS (DECISION-0107): LEFT JOIN concept_labels (primária pt-BR/default)
      // → suggestedConceptDisplayName. Label é APRESENTAÇÃO (projeção), nunca chave de identidade: o WHERE/
      // ORDER seguem por cnae_code/concept_id/slug; o lookup do concept NÃO usa label. Fallback honesto: sem label → null.
      `SELECT s.cnae_code, s.suggested_concept_id::text AS suggested_concept_id, c.slug AS concept_slug,
              cl.label AS display_name, s.confidence, s.rationale, s.source, s.catalog_version
         FROM cnae_concept_suggestions s
         JOIN concepts c ON c.concept_id = s.suggested_concept_id
         LEFT JOIN concept_labels cl
           ON cl.concept_id = c.concept_id
          AND cl.locale = 'pt-BR' AND cl.context_key = 'default' AND cl.is_primary = true
        WHERE s.cnae_code = $1 AND s.is_active = true AND s.review_status = 'approved'
        ORDER BY (CASE s.confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END) DESC, c.slug ASC
        LIMIT 1`,
      [normalized]
    );
    const row = rows.rows[0];
    if (!row) {
      return { valid: true, normalizedCnaeCode: normalized, suggestion: null };
    }

    // Derivação SEGURA de company_type: só se EXATAMENTE um type permite o concept (senão null).
    const types = await pool.query<{ id: string; slug: string }>(
      `SELECT ct.id::text AS id, ct.slug
         FROM company_type_allowed_concepts a
         JOIN company_types ct ON ct.id = a.company_type_id
        WHERE a.concept_id = $1::uuid`,
      [row.suggested_concept_id]
    );
    const singleType = types.rows.length === 1 ? types.rows[0] : null;

    return {
      valid: true,
      normalizedCnaeCode: normalized,
      suggestion: {
        cnaeCode: row.cnae_code,
        normalizedCnaeCode: normalized,
        description: row.rationale,
        suggestedConceptId: row.suggested_concept_id,
        suggestedConceptSlug: row.concept_slug,
        // Display name vem de concept_labels (LEFT JOIN); sem label → null honesto (frontend faz displayName ?? slug).
        suggestedConceptDisplayName: row.display_name ?? null,
        confidence: row.confidence,
        source: row.source,
        version: row.catalog_version,
        companyTypeId: singleType?.id ?? null,
        companyTypeSlug: singleType?.slug ?? null,
      },
    };
  }

  /**
   * F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION — sugestão de CONCEPT COMPANY-SCOPED, READ-ONLY.
   * O frontend NÃO manuseia CNAE cru: pergunta "qual a sugestão econômica desta empresa?" passando companyId;
   * o backend resolve a EVIDÊNCIA FISCAL já persistida (fiscal_identity_economic_activities), escolhe a atividade
   * PRIMÁRIA (ou a única), e REUSA suggestConceptForCnae. CNAE = adapter BR (classifierSystem='CNAE', countryCode='BR');
   * CONCEPT permanece SSOT semântico. Honest-empty com `reason` quando não houver evidência/primária/sugestão aprovada.
   * NÃO escreve, NÃO ativa, NÃO publica, NÃO cria autoridade, NÃO consulta Receita em runtime — só lê o persistido.
   */
  async suggestEconomicActivityConceptForCompany(tenantId: string, companyId: string): Promise<{
    companyId: string;
    countryCode: 'BR';
    classifierSystem: 'CNAE';
    suggestion: {
      suggestedConceptId: string;
      suggestedConceptSlug: string;
      label: string | null;
      confidence: string;
      source: string;
      version: string;
      rationale: string;
      companyTypeId: string | null;
      companyTypeSlug: string | null;
    } | null;
    reason?: 'NO_FISCAL_IDENTITY' | 'NO_ECONOMIC_ACTIVITY_EVIDENCE' | 'AMBIGUOUS_ECONOMIC_ACTIVITY' | 'NO_APPROVED_SUGGESTION';
  }> {
    const base = { companyId, countryCode: 'BR' as const, classifierSystem: 'CNAE' as const, suggestion: null };
    const co = await pool.query<{ fid: string | null }>(
      `SELECT fiscal_identity_id::text AS fid FROM companies WHERE company_id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [companyId, tenantId]
    );
    const fid = co.rows[0]?.fid ?? null;
    if (!fid) return { ...base, reason: 'NO_FISCAL_IDENTITY' };

    const acts = await pool.query<{ cnae_code: string; is_primary: boolean }>(
      `SELECT cnae_code, is_primary FROM fiscal_identity_economic_activities WHERE fiscal_identity_id = $1::uuid`,
      [fid]
    );
    if (acts.rows.length === 0) return { ...base, reason: 'NO_ECONOMIC_ACTIVITY_EVIDENCE' };
    const primary = acts.rows.find((r) => r.is_primary);
    const cnae = primary ? primary.cnae_code : (acts.rows.length === 1 ? acts.rows[0].cnae_code : null);
    if (!cnae) return { ...base, reason: 'AMBIGUOUS_ECONOMIC_ACTIVITY' };

    const res = await this.suggestConceptForCnae(cnae);
    if (!res.suggestion) return { ...base, reason: 'NO_APPROVED_SUGGESTION' };
    return {
      ...base,
      suggestion: {
        suggestedConceptId: res.suggestion.suggestedConceptId,
        suggestedConceptSlug: res.suggestion.suggestedConceptSlug,
        label: res.suggestion.suggestedConceptDisplayName,
        confidence: res.suggestion.confidence,
        source: res.suggestion.source,
        version: res.suggestion.version,
        rationale: res.suggestion.description,
        companyTypeId: res.suggestion.companyTypeId,
        companyTypeSlug: res.suggestion.companyTypeSlug,
      },
    };
  }

  private activationError(code: string, message: string, statusCode: number): HttpError {
    const err = new HttpError(`${code}: ${message}`, statusCode);
    (err as unknown as { code: string }).code = code;
    return err;
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
    // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): colunas de atividade não existem em companies.
    revenue_data: any;
    status: string;
    company_status: string;    kyb_status?: string | null;
    metadata: any;
    created_at?: Date;
    updated_at?: Date;
  }): Company {
    const createdRaw = row.created_at;
    const updatedRaw = row.updated_at;
    const toIso = (v: unknown) =>
      v != null ? (v instanceof Date ? v.toISOString() : String(v)) : '';
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
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): companies não tem colunas de atividade
      // (leitura ghost devolvia undefined). Evidência CNAE virá da casa fiscal em frente própria.
      activity: { secondaryActivities: [] },
      revenueData: row.revenue_data || undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      // DECISION-0089 Fase 1: verificação derivada exclusivamente de fiscal_identities.kyb_status.
      kybStatus: (row.kyb_status ?? null) as Company['kybStatus'],
      isKybApproved: row.kyb_status === 'approved',
      // CP3: projeção read-only do par soberano (writer único = activateCompanyOperationally).
      // Permite ao wizard REABRIR mostrando o par persistido em vez de estado vazio.
      primaryCompanyTypeId: (row as { primary_company_type_id?: string | null }).primary_company_type_id ?? null,
      primaryConceptId: (row as { primary_concept_id?: string | null }).primary_concept_id ?? null,
      metadata: row.metadata || undefined,
      createdAt: toIso(createdRaw),
      updatedAt: toIso(updatedRaw),
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
      const rows = await runQueriesWithTenant<{
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
        // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): colunas de atividade não existem em companies.
        revenue_data: unknown;
        status: string;
        company_status: string;        kyb_status: string | null;
        metadata: unknown;
        created_at: Date;
        updated_at: Date;
      }>(
        tenantId,
        `
        SELECT c.*, fi.kyb_status
        FROM companies c
        LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
        WHERE c.tenant_id = $1 AND c.company_id = $2::uuid
        LIMIT 1
        `,
        [tenantId, companyId]
      );

      if (!rows || rows.length === 0 || !rows[0]) {
        return null;
      }

      const companyOverride = this.mapCompanyRow(rows[0]);
      const userRoleOverride = await this.projectCallerCompanyUser(tenantId, companyId, globalUserId);
      return userRoleOverride ? ({ ...companyOverride, userRole: userRoleOverride } as Company) : companyOverride;
    }

    // Comportamento normal (sem override) — leitura por VÍNCULO (PJ-B4): o acesso deriva de
    // company_users ATIVO (membership), não de companies.global_user_id (autoria histórica).
    // O criador continua lendo (tem vínculo server-side desde o nascimento); membro autorizado
    // lê pela mesma porta; usuário sem vínculo → null (404 honesto na rota). Leitura NÃO
    // concede gestão/lifecycle/publicação (writers têm guards próprios via canManageCompany).
    const rowsNormal = await runQueriesWithTenant<{
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
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): colunas de atividade não existem em companies.
      revenue_data: unknown;
      status: string;
      company_status: string;      kyb_status: string | null;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
    }>(
      tenantId,
      `
      SELECT c.*, fi.kyb_status
      FROM companies c
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE c.tenant_id = $1 AND c.company_id = $2::uuid
        AND EXISTS (
          SELECT 1 FROM company_users cu
           WHERE cu.tenant_id = c.tenant_id AND cu.company_id = c.company_id
             AND cu.global_user_id = $3::uuid
             AND cu.is_active = true AND cu.member_status = 'active'
        )
      LIMIT 1
      `,
      [tenantId, companyId, globalUserId]
    );

    if (!rowsNormal || rowsNormal.length === 0 || !rowsNormal[0]) {
      return null;
    }

    const company = this.mapCompanyRow(rowsNormal[0]);
    const userRole = await this.projectCallerCompanyUser(tenantId, companyId, globalUserId);
    return userRole ? ({ ...company, userRole } as Company) : company;
  }

  /**
   * F-PJ-ONBOARDING-ROLE-DEDUP: projeta o vínculo FORMAL do chamador (company_users) — o mesmo
   * shape que listCompanies já entrega. getCompanyById omitia `userRole` embora o tipo Company o
   * declare e o onboarding precise dele para CONFIRMAR (não repergunta) o papel já definido no
   * cadastro. Leitura PURA do SSOT company_users: não escreve, não concede autoridade, não cria
   * vocabulário paralelo. Retorna null se não houver vínculo ativo do chamador (ex.: override de teste).
   */
  private async projectCallerCompanyUser(
    tenantId: string,
    companyId: string,
    globalUserId: string
  ): Promise<CompanyUser | null> {
    const rows = await runQueriesWithTenant<{
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
      can_view_consolidated_inventory: boolean;
      is_active: boolean;
      is_primary: boolean;
      cu_metadata: unknown;
      cu_created_at: Date;
      cu_updated_at: Date;
    }>(
      tenantId,
      `
      SELECT
        cu.id AS company_user_id,
        cu.company_id,
        cu.global_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.can_view_consolidated_inventory,
        cu.is_active,
        cu.is_primary,
        cu.metadata AS cu_metadata,
        cu.created_at AS cu_created_at,
        cu.updated_at AS cu_updated_at
      FROM company_users cu
      WHERE cu.tenant_id = $1 AND cu.company_id = $2::uuid AND cu.global_user_id = $3::uuid
        AND cu.is_active = true
      LIMIT 1
      `,
      [tenantId, companyId, globalUserId]
    );
    if (!rows || rows.length === 0 || !rows[0]) return null;
    const row = rows[0];
    return {
      companyUserId: row.company_user_id,
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      role: row.role as CompanyUser['role'],
      roleDescription: row.role_description ?? undefined,
      permissions: {
        canManageCompany: row.can_manage_company,
        canManageFinancial: row.can_manage_financial,
        canManageEmployees: row.can_manage_employees,
        canViewReports: row.can_view_reports,
        canManageServices: row.can_manage_services,
        canViewConsolidatedInventory: row.can_view_consolidated_inventory,
      },
      isActive: row.is_active,
      isPrimary: row.is_primary,
      metadata: (row.cu_metadata ?? undefined) as CompanyUser['metadata'],
      createdAt: row.cu_created_at instanceof Date ? row.cu_created_at.toISOString() : String(row.cu_created_at ?? ''),
      updatedAt: row.cu_updated_at instanceof Date ? row.cu_updated_at.toISOString() : String(row.cu_updated_at ?? ''),
    };
  }

  /**
   * Resolve user_id a partir de globalUserId (para override de teste)
   */
  private async resolveUserIdFromGlobalUserId(globalUserId: string, tenantId?: string): Promise<string | null> {
    if (tenantId) {
      const userRows = await runQueriesWithTenant<{ user_id: string }>(
        tenantId,
        `
        SELECT user_id FROM users
        WHERE global_user_id = $1::uuid
        LIMIT 1
        `,
        [globalUserId]
      );
      return userRows?.[0]?.user_id ?? null;
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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para listCompanies (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    const toIso = (v: unknown) =>
      v != null ? (v instanceof Date ? v.toISOString() : String(v)) : '';

    // OVERRIDE DE TESTE: Verificar se é usuário de teste
    const userId = await this.resolveUserIdFromGlobalUserId(globalUserId, finalTenantId);
    if (userId && isTestOverrideUser(userId)) {
      // 🔴 CORREÇÃO: Retornar TODAS as empresas (sem filtro de ownership, mas COM filtro tenant_id)
      const allCompaniesRows = await runQueriesWithTenant<{
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
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): colunas de atividade não existem em companies.
      revenue_data: unknown;
      status: string;
      company_status: string;      kyb_status: string | null;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
      company_user_id: string;
      role: string;
      role_description: string | null;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
      can_view_consolidated_inventory: boolean;
      is_active: boolean;
      is_primary: boolean;
      cu_metadata: unknown;
      cu_created_at: Date;
      cu_updated_at: Date | null;
    }>(
      finalTenantId,
      `
      SELECT
        c.*,
        fi.kyb_status,
        cu.id AS company_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.can_view_consolidated_inventory,
        cu.is_active,
        cu.is_primary,
        cu.metadata as cu_metadata,
        cu.created_at as cu_created_at,
        cu.updated_at as cu_updated_at
      FROM companies c
      LEFT JOIN company_users cu ON c.company_id = cu.company_id AND cu.is_active = true
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE c.tenant_id = $1
      ORDER BY c.created_at DESC
      `,
      [finalTenantId]
    );
    
    return (allCompaniesRows ?? []).map(row => ({
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      cnpj: row.cnpj,
      companyName: row.company_name,
      tradeName: row.trade_name ?? undefined,
      registrationDate: row.registered_at?.toISOString().split('T')[0] ?? undefined,
      address: {
        cep: row.cep ?? undefined,
        address: row.address ?? undefined,
        addressNumber: row.address_number ?? undefined,
        complement: row.complement ?? undefined,
        neighborhood: row.neighborhood ?? undefined,
        city: row.city ?? undefined,
        state: row.state ?? undefined,
        country: row.country ?? undefined,
      },
      contact: {
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        website: row.website ?? undefined,
      },
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): companies sem colunas de atividade (ghost).
      activity: { secondaryActivities: [] },
      revenueData: row.revenue_data ?? undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      kybStatus: (row.kyb_status ?? null) as Company['kybStatus'],
      isKybApproved: row.kyb_status === 'approved',
      metadata: row.metadata ?? undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      userRole: {
        companyUserId: row.company_user_id,
        companyId: row.company_id,
        globalUserId: row.global_user_id,
        role: row.role as CompanyUser['role'],
        roleDescription: row.role_description ?? undefined,
        permissions: {
          canManageCompany: row.can_manage_company,
          canManageFinancial: row.can_manage_financial,
          canManageEmployees: row.can_manage_employees,
          canViewReports: row.can_view_reports,
          canManageServices: row.can_manage_services,
          canViewConsolidatedInventory: row.can_view_consolidated_inventory,
        },
        isActive: row.is_active,
        isPrimary: row.is_primary,
        metadata: row.cu_metadata ?? undefined,
        createdAt: row.cu_created_at != null ? (row.cu_created_at instanceof Date ? row.cu_created_at.toISOString() : String(row.cu_created_at)) : '',
        updatedAt: row.cu_updated_at != null ? (row.cu_updated_at instanceof Date ? row.cu_updated_at.toISOString() : String(row.cu_updated_at)) : '',
      },
    } as Company & { userRole: CompanyUser }));
    }

    // Comportamento normal (sem override) — listagem por VÍNCULO (PJ-B4): INNER JOIN em
    // company_users do PRÓPRIO caller (ativo), não filtro por companies.global_user_id.
    // Criador e membro autorizado listam pela mesma porta; o userRole projetado é o vínculo
    // DO CALLER (o JOIN antigo sem filtro de membro projetava o vínculo de outro membro e
    // duplicava linhas em empresas multi-membro). Vínculo removido/inativo → empresa some.
    const resultRows = await runQueriesWithTenant<{
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
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): colunas de atividade não existem em companies.
      revenue_data: unknown;
      status: string;
      company_status: string;      kyb_status: string | null;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
      company_user_id: string;
      role: string;
      role_description: string | null;
      can_manage_company: boolean;
      can_manage_financial: boolean;
      can_manage_employees: boolean;
      can_view_reports: boolean;
      can_manage_services: boolean;
      can_view_consolidated_inventory: boolean;
      is_active: boolean;
      is_primary: boolean;
      cu_metadata: unknown;
      cu_created_at: Date;
      cu_updated_at: Date | null;
    }>(
      finalTenantId,
      `
      SELECT
        c.*,
        fi.kyb_status,
        cu.id AS company_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.can_view_consolidated_inventory,
        cu.is_active,
        cu.is_primary,
        cu.metadata as cu_metadata,
        cu.created_at as cu_created_at,
        cu.updated_at as cu_updated_at
      FROM companies c
      INNER JOIN company_users cu
              ON cu.company_id = c.company_id
             AND cu.tenant_id = c.tenant_id
             AND cu.global_user_id = $2::uuid
             AND cu.is_active = true
             AND cu.member_status = 'active'
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE c.tenant_id = $1
      ORDER BY c.created_at DESC
      `,
      [finalTenantId, globalUserId]
    );

    return resultRows.map(row => ({
      companyId: row.company_id,
      globalUserId: row.global_user_id,
      cnpj: row.cnpj,
      companyName: row.company_name,
      tradeName: row.trade_name ?? undefined,
      registrationDate: row.registered_at?.toISOString().split('T')[0] ?? undefined,
      address: {
        cep: row.cep ?? undefined,
        address: row.address ?? undefined,
        addressNumber: row.address_number ?? undefined,
        complement: row.complement ?? undefined,
        neighborhood: row.neighborhood ?? undefined,
        city: row.city ?? undefined,
        state: row.state ?? undefined,
        country: row.country ?? undefined,
      },
      contact: {
        phone: row.phone ?? undefined,
        email: row.email ?? undefined,
        website: row.website ?? undefined,
      },
      // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): companies sem colunas de atividade (ghost).
      activity: { secondaryActivities: [] },
      revenueData: row.revenue_data ?? undefined,
      status: row.status as Company['status'],
      companyStatus: (row.company_status || 'PROVISIONAL') as Company['companyStatus'],
      kybStatus: (row.kyb_status ?? null) as Company['kybStatus'],
      isKybApproved: row.kyb_status === 'approved',
      metadata: row.metadata ?? undefined,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      userRole: {
        companyUserId: row.company_user_id,
        companyId: row.company_id,
        globalUserId: row.global_user_id,
        role: row.role as CompanyUser['role'],
        roleDescription: row.role_description ?? undefined,
        permissions: {
          canManageCompany: row.can_manage_company,
          canManageFinancial: row.can_manage_financial,
          canManageEmployees: row.can_manage_employees,
          canViewReports: row.can_view_reports,
          canManageServices: row.can_manage_services,
          canViewConsolidatedInventory: row.can_view_consolidated_inventory,
        },
        isActive: row.is_active,
        isPrimary: row.is_primary,
        metadata: row.cu_metadata ?? undefined,
        createdAt: row.cu_created_at != null ? (row.cu_created_at instanceof Date ? row.cu_created_at.toISOString() : String(row.cu_created_at)) : '',
        updatedAt: row.cu_updated_at != null ? (row.cu_updated_at instanceof Date ? row.cu_updated_at.toISOString() : String(row.cu_updated_at)) : '',
      },
    } as Company & { userRole: CompanyUser }));
  }

  /**
   * Atualiza empresa.
   * 🔴 Bloqueia edição de CNPJ se a identidade fiscal já está verificada
   *    (kyb_status='approved' — DECISION-0092 Fase 3.0). O CNPJ vive na casa fiscal.
   */
  async updateCompany(
    companyId: string,
    globalUserId: string,
    input: UpdateCompanyInput,
    tenantId?: string
  ): Promise<Company> {
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para updateCompany (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    // 🔴 Verificar se empresa está validada - CNPJ não pode ser editado
    const existing = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!existing) {
      throw new Error('Empresa não encontrada');
    }

    // PJ-B4: leitura por vínculo NÃO concede gestão. Editar a entidade exige autoridade
    // material (can_manage_company OR role='owner', vínculo ativo) — não autoria histórica.
    const canManage = await this.canManageCompany(finalTenantId, companyId, globalUserId);
    if (!canManage) {
      throw new Error('Sem autoridade para editar esta empresa (canManageCompany)');
    }

    // 🔴 PROTEÇÃO: Bloquear alteração de CNPJ quando a identidade fiscal já está verificada.
    // DECISION-0092 Fase 3.0: a imutabilidade do CNPJ ancora na CASA FISCAL (fiscal_identities.kyb_status),
    // NÃO em company_status (eixo congelado pela Fase 2). O CNPJ é projeção de fiscal_identities.cnpj.
    if (input.cnpj && existing.kybStatus === 'approved') {
      throw new Error(
        `CNPJ não pode ser editado: identidade fiscal já verificada (KYB approved). ` +
        `O CNPJ vive na casa fiscal (fiscal_identities) e é imutável após aprovação.`
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

    // F-PJ-COMPANY-ACTIVITY-GHOST-CLEANUP (DECISION-0103 D12): bloco `input.activity` REMOVIDO — montava
    // `UPDATE companies SET main_activity_code/main_activity_description/secondary_activities` em colunas
    // INEXISTENTES (42703 latente). Evidência CNAE não mora em `companies` (vai p/ a casa fiscal — D2/D4).

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

    // DECISION-0090 Fase 2.1: branch latente de `company_status` REMOVIDO. updateCompany não escreve
    // mais company_status por input — verificação fiscal tem fonte única (fiscal_identities.kyb_status)
    // e writer próprio (KYB auditado). Edição comum permanece; lifecycle via writers dedicados.

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = NOW()`);
    values.push(companyId, finalTenantId);

    await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE companies
      SET ${updates.join(', ')}
      WHERE tenant_id = $${paramIdx + 1} AND company_id = $${paramIdx}::uuid
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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para getCompanyUserById (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    // 🔴 CORREÇÃO: Query COM filtro tenant_id via JOIN com companies
    const rows = await runQueriesWithTenant<{
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
      can_view_consolidated_inventory: boolean;
      is_active: boolean;
      is_primary: boolean;
      metadata: unknown;
      created_at: Date;
      updated_at: Date;
    }>(
      finalTenantId,
      `
      SELECT
        cu.id AS company_user_id,
        cu.tenant_id,
        cu.company_id,
        cu.global_user_id,
        cu.role,
        cu.role_description,
        cu.can_manage_company,
        cu.can_manage_financial,
        cu.can_manage_employees,
        cu.can_view_reports,
        cu.can_manage_services,
        cu.can_view_consolidated_inventory,
        cu.is_active,
        cu.is_primary,
        cu.metadata,
        cu.created_at,
        cu.updated_at
      FROM company_users cu
      INNER JOIN companies c ON cu.company_id = c.company_id
      WHERE cu.id = $1::uuid
        AND cu.global_user_id = $2::uuid
        AND c.tenant_id = $3
      LIMIT 1
      `,
      [companyUserId, globalUserId, finalTenantId]
    );

    if (!rows || rows.length === 0 || !rows[0]) {
      return null;
    }

    const toIso = (v: unknown) =>
      v != null ? (v instanceof Date ? v.toISOString() : String(v)) : '';

    const row = rows[0];
    const r = row as Record<string, unknown>;
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
        canViewConsolidatedInventory: row.can_view_consolidated_inventory,
      },
      isActive: row.is_active,
      isPrimary: row.is_primary,
      metadata: row.metadata || undefined,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    };
  }

  /**
   * AUTOATENDIMENTO do próprio vínculo (self-scoped) — F-COMPANY-USERS-SELF-UPDATE-AUTHORITY-ESCALATION-CLOSURE.
   *
   * Substitui o antigo `updateCompanyUser` (mass-assignment): aquele construía UPDATE dinâmico
   * a partir de `role`/`permissions.*`/`is_active`/`is_primary` num writer self-scoped
   * (`WHERE global_user_id = caller`), permitindo que QUALQUER membro se auto-promovesse a admin
   * (escalation provada por HTTP pela Yala). A autoria da linha (editar a PRÓPRIA linha) NÃO é
   * autoridade para conceder privilégios.
   *
   * Aqui o SQL menciona EXCLUSIVAMENTE `role_description` (único campo não-autoritativo).
   * Nenhum campo de autoridade é construível por este caminho. Mudanças de autoridade usam só os
   * writers administrativos gateados (`PUT /members/:memberId` via `requireCompanyManage`;
   * `setConsolidatedInventoryPermission`). A allowlist de campos é imposta na rota (rejeição
   * observável 403); este método é o segundo anteparo: SQL com coluna fixa.
   */
  async selfUpdateCompanyUser(
    companyUserId: string,
    callerGlobalUserId: string,
    input: SelfUpdateCompanyUserInput,
    tenantId?: string
  ): Promise<CompanyUser> {
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para selfUpdateCompanyUser (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    if (input.roleDescription === undefined) {
      // Nada a atualizar — devolve o estado atual (idempotente), self-scoped.
      const existing = await this.getCompanyUserById(companyUserId, callerGlobalUserId, finalTenantId);
      if (!existing) {
        throw HttpError.notFound('Relacionamento não encontrado');
      }
      return existing;
    }

    // SQL com coluna FIXA — só `role_description`. Self-scoped: a linha tem de ser do próprio caller.
    await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE company_users cu
      SET role_description = $1, updated_at = NOW()
      FROM companies c
      WHERE cu.company_id = c.company_id
        AND cu.id = $2::uuid
        AND cu.global_user_id = $3::uuid
        AND c.tenant_id = $4
      `,
      [input.roleDescription || null, companyUserId, callerGlobalUserId, finalTenantId]
    );

    const updated = await this.getCompanyUserById(companyUserId, callerGlobalUserId, finalTenantId);
    if (!updated) {
      throw HttpError.notFound('Relacionamento não encontrado');
    }

    return updated;
  }

  /**
   * Remove empresa (soft delete)
   * 🔴 REGRA: Bloquear remoção apenas se houver transações financeiras vinculadas
   * Permite remoção mesmo se company_status for APPROVED, desde que não haja transações
   */
  async deleteCompany(companyId: string, globalUserId: string, tenantId?: string): Promise<boolean> {
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para deleteCompany (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    // Verificar se empresa existe e o caller tem vínculo (leitura por membership — PJ-B4)
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // PJ-B4: exclusão é ato de GESTÃO — exige autoridade material (canManageCompany),
    // não autoria histórica nem mero vínculo de leitura.
    const canManage = await this.canManageCompany(finalTenantId, companyId, globalUserId);
    if (!canManage) {
      throw new Error('Sem autoridade para remover esta empresa (canManageCompany)');
    }

    // 🔴 GUARDA FAIL-CLOSED (F-PJ-DELETE-GUARD-BANK-PORT): bloquear exclusão de empresa com vínculo
    // financeiro MATERIAL. O SSOT financeiro é actor-keyed (bank_accounts.actor_id / bank_ledger;
    // owner_type ∈ {actor,system,escrow} — NÃO existe 'company'). As tabelas `accounts`/`transactions`
    // do guard legado são FANTASMAS (inexistentes no schema vivo): o SELECT lançava "relation does not
    // exist" e a proteção nunca foi exercida. Aqui resolvo os actors da empresa (actors.company_id) e
    // consulto o Bank READ PORT canônico — SEM SQL direto em bank_*. Bloqueio fail-closed em: saldo≠0,
    // OU qualquer movimentação, OU erro/indisponibilidade do port. Ausência provável de vínculo
    // (sem actor, ou actor sem conta/saldo/movimento) → exclusão permitida (preserva a regra atual:
    // existência de conta vazia não bloqueia; só movimentação/saldo material).
    const companyActors = await runQueriesWithTenant<{ id: string }>(
      finalTenantId,
      `SELECT id::text AS id FROM actors WHERE tenant_id = $1 AND company_id = $2::uuid`,
      [finalTenantId, companyId]
    );

    if (companyActors.length > 0) {
      const { bankPortsRegistry } = await import('@core/bank/ports-registry');
      const readPort = bankPortsRegistry.getBankTransactionRead();

      for (const actorRow of companyActors) {
        let summary: Awaited<ReturnType<typeof readPort.getWalletSummaryByActorId>>;
        let recentTxs: Awaited<ReturnType<typeof readPort.listRecentTransactionsByActorId>>;
        try {
          [summary, recentTxs] = await Promise.all([
            readPort.getWalletSummaryByActorId(finalTenantId, actorRow.id),
            readPort.listRecentTransactionsByActorId(finalTenantId, actorRow.id, { limit: 1 }),
          ]);
        } catch {
          // Incerteza no Bank port = fail-closed: não posso PROVAR ausência de vínculo financeiro.
          throw new Error(
            'PJ_DELETE_BLOCKED_BANK_UNAVAILABLE: não foi possível verificar o vínculo financeiro da ' +
              'empresa no Bank (leitura indisponível). Exclusão bloqueada por segurança (fail-closed).'
          );
        }

        const hasBalance = summary !== null && Number(summary.balanceCents) !== 0;
        const hasMovement = recentTxs.length > 0;
        if (hasBalance || hasMovement) {
          throw new Error(
            'PJ_DELETE_BLOCKED_FINANCIAL_LINK: não é possível excluir a empresa — há vínculo financeiro ' +
              '(saldo e/ou movimentação) no Bank. Empresas com histórico financeiro não podem ser excluídas.'
          );
        }
      }
    }

    // Soft delete COM filtro tenant_id; autoridade já provada acima via canManageCompany
    // (status operacional 'inactive' — NÃO toca
    // company_status/KYB/documentos). RETURNING torna o boolean de sucesso confiável:
    // runQueryWithTenant devolve rows[0], e um UPDATE sem RETURNING voltaria undefined.
    const deletedRow = await runQueryWithTenant<{ company_id: string }>(
      finalTenantId,
      `
      UPDATE companies
      SET status = 'inactive', updated_at = NOW()
      WHERE tenant_id = $1 AND company_id = $2::uuid
      RETURNING company_id
      `,
      [finalTenantId, companyId]
    );

    return deletedRow != null;
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
    // F-PJ-LEGACY-DOC-UPLOAD-TOMBSTONE (DECISION-0087): writer legado DESATIVADO. O SSOT documental KYB é
    // `fiscal_identity_documents`; este método gravava em `company_documents` (tabela FANTASMA — inexistente
    // no schema vivo) e promovia `company_status` (não-SSOT). Throw honesto como PRIMEIRA instrução: não
    // escreve em nenhuma tabela, não promove lifecycle, não aprova KYB. Documentos KYB usam o fluxo canônico
    // de fiscal identity documents. NÃO reconectar ao legado. (A rota POST /:companyId/documents já retorna 501.)
    throw new Error(
      'PJ_LEGACY_COMPANY_DOCUMENT_UPLOAD_DISABLED: upload legado de documento de empresa desativado ' +
        '(DECISION-0087). Documentos KYB serão enviados pelo fluxo documental fiscal (fiscal_identity_documents). ' +
        'Nenhum documento foi gravado e o status da empresa não foi alterado.'
    );

  }

  /**
   * F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): readers/admin legados DESATIVADOS fail-closed.
   * listCompanyDocuments / listPendingDocuments / updateDocumentStatus liam/escreviam `company_documents`
   * (tabela FANTASMA — inexistente no schema vivo) — dead-on-arrival. O SSOT documental KYB é
   * `fiscal_identity_documents` (fiscal-identity-document.service.ts; rotas /identity/pj/kyb/*). Throw honesto
   * como PRIMEIRA instrução: nada lê/escreve no fantasma; NÃO promove company_status; NÃO aprova KYB. Não reabrir.
   */
  async listCompanyDocuments(
    _companyId: string,
    _globalUserId: string,
    _tenantId?: string
  ): Promise<Array<{ documentId: string; documentType: string; fileName: string; filePath: string; fileSize: number; mimeType: string; status: string; createdAt: Date; updatedAt: Date }>> {
    throw new Error(
      'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED: leitura legada de documentos de empresa desativada ' +
        '(DECISION-0087). SSOT documental KYB = fiscal_identity_documents.'
    );
  }

  async listPendingDocuments(): Promise<Array<{ documentId: string; companyId: string; globalUserId: string; companyName: string; companyCnpj: string; documentType: string; fileName: string; filePath: string; fileSize: number; mimeType: string; status: string; createdAt: Date; updatedAt: Date }>> {
    throw new Error(
      'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED: backoffice legado de documentos pendentes desativado ' +
        '(DECISION-0087). Revisão documental KYB canônica = /identity/pj/kyb/* sobre fiscal_identity_documents.'
    );
  }

  async updateDocumentStatus(
    _documentId: string,
    _status: 'approved' | 'rejected',
    _rejectedReason?: string,
    _adminUserId?: string
  ): Promise<{ documentId: string; companyStatus: string }> {
    throw new Error(
      'PJ_LEGACY_COMPANY_DOCUMENTS_READERS_DISABLED: review/approve legado de documento desativado ' +
        '(DECISION-0087). Aprovar documento NAO verifica a empresa; revisao canonica = ' +
        '/identity/pj/kyb/documents/:id/review; aprovacao KYB tem writer proprio com gate documental.'
    );
  }

  /**
   * ADMIN OVERRIDE — DESABILITADO (DECISION-0090 Fase 2.2).
   *
   * 🔴 Override legado de verificação PJ NEUTRALIZADO. Esta função NÃO escreve mais
   * `company_status='VERIFIED'` / `is_verified=true` / `verifiedAt`, nem audit de validação.
   * Verificação fiscal tem FONTE ÚNICA (`fiscal_identities.kyb_status`) e writer próprio
   * (KYB auditado, `fiscal-identity-kyb.service`); override fiscal futuro deve passar por ele,
   * com actor, reason e trilha. Lança erro de domínio antes de qualquer escrita.
   *
   * Mantida (signature + rota) por compatibilidade de endpoint; sempre falha fail-closed.
   */
  async adminOverrideToVerified(
    companyId: string,
    _adminGlobalUserId: string,
    _tenantId: string
  ): Promise<Company> {
    const err = new HttpError(
      `PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED: Override legado de verificação PJ desabilitado. Use o fluxo KYB auditado. (company=${companyId})`,
      501
    );
    (err as unknown as { code: string }).code = 'PJ_LEGACY_VERIFIED_OVERRIDE_DISABLED';
    throw err;
  }

  // ============================================================
  // FRENTE B (2026-05-25): fluxo submissão→análise→decisão estruturado
  // Tabela: company_validation_requests (migration 20260530552000)
  // Convergência sobre padrão de modules/disputes/financial-dispute-repository.ts
  // ============================================================

  /**
   * submitForValidation: cria pedido de validação da empresa (status='pending').
   * Guard: company precisa estar em company_status='PROVISIONAL' (não revalidar VERIFIED).
   * UNIQUE parcial barra duplicidade — tratamos o erro de constraint para mensagem clara.
   * §8: tenant explícito; userId é users.id (req.user.id = users.id, alias em auth.plugin.ts).
   */
  async submitForValidation(
    companyId: string,
    tenantId: string,
    userId: string,
    notes?: string
  ): Promise<{
    id: string;
    companyId: string;
    submittedByUserId: string;
    submittedAt: string;
    status: string;
  }> {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para submitForValidation (§8 03_IDENTITY_CANONICA)');
    }
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('submitForValidation: userId é obrigatório (req.user.id = users.id)');
    }

    // Guard: company precisa existir no tenant E estar em PROVISIONAL.
    const companyRow = await runQueryWithTenant<{ company_status: string }>(
      tenantId,
      `SELECT company_status FROM companies WHERE tenant_id = $1::uuid AND company_id = $2::uuid LIMIT 1`,
      [tenantId, companyId]
    );
    if (!companyRow) {
      throw new Error(`COMPANY_NOT_FOUND: company ${companyId} não encontrada no tenant ${tenantId}`);
    }
    if (companyRow.company_status !== 'PROVISIONAL') {
      throw new Error(`COMPANY_NOT_IN_PROVISIONAL: company_status atual = '${companyRow.company_status}'. Submit só faz sentido para empresas PROVISIONAL.`);
    }

    try {
      const row = await runQueryWithTenant<{
        id: string;
        company_id: string;
        submitted_by_user_id: string;
        submitted_at: Date;
        status: string;
      }>(
        tenantId,
        `INSERT INTO company_validation_requests
           (tenant_id, company_id, submitted_by_user_id, submission_notes)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
         RETURNING id, company_id, submitted_by_user_id, submitted_at, status`,
        [tenantId, companyId, userId, notes ?? null]
      );
      if (!row) throw new Error('submitForValidation: insert falhou (sem RETURNING)');
      return {
        id: row.id,
        companyId: row.company_id,
        submittedByUserId: row.submitted_by_user_id,
        submittedAt: row.submitted_at.toISOString(),
        status: row.status,
      };
    } catch (err: any) {
      // 23505 = unique_violation no Postgres. Captura a partial unique e dá mensagem clara
      // em vez de vazar o erro cru de constraint.
      if (err && (err.code === '23505' || /uq_company_validation_requests_pending/.test(String(err.message || '')))) {
        throw new Error(`COMPANY_HAS_PENDING_VALIDATION: company ${companyId} já tem um pedido de validação pending. Aguarde a revisão ou cancele o pedido existente antes de submeter novo.`);
      }
      throw err;
    }
  }

  /**
   * reviewCompanyValidation: admin revisa um pedido de validação legado.
   *
   * DECISION-0090 Fase 2.4: APROVAÇÃO legada DESABILITADA — `decision='approved'` lança
   * PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED ANTES de abrir transação (request permanece
   * 'pending', nada é escrito). Esta função NÃO verifica mais empresa por fora do KYB (não escreve
   * company_status='VERIFIED'/is_verified nem audit STRUCTURED_REVIEW). Verificação fiscal tem
   * FONTE ÚNICA (fiscal_identities.kyb_status) e writer próprio (fiscal-identity-kyb.service).
   * REJEIÇÃO segue funcionando (transição pending→rejected na request; não verifica empresa).
   * §8: tenant explícito no WHERE.
   */
  async reviewCompanyValidation(
    requestId: string,
    decision: 'approved' | 'rejected',
    reason: string | undefined,
    reviewerUserId: string,
    tenantId: string
  ): Promise<{
    id: string;
    companyId: string;
    status: string;
    reviewedAt: string | null;
    reviewedByUserId: string | null;
    decisionReason: string | null;
  }> {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para reviewCompanyValidation (§8 03_IDENTITY_CANONICA)');
    }
    if (!reviewerUserId || typeof reviewerUserId !== 'string' || reviewerUserId.trim() === '') {
      throw new Error('reviewCompanyValidation: reviewerUserId é obrigatório (req.user.id = users.id)');
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new Error(`reviewCompanyValidation: decision inválida '${decision}' — esperado 'approved' ou 'rejected'`);
    }

    // DECISION-0090 Fase 2.4: aprovação legada DESABILITADA — não verifica empresa por fora do KYB.
    // Lança ANTES de abrir transação: a request permanece 'pending' e nada é escrito (companies/
    // is_verified/audit/kyb_status intactos). Aprovação fiscal deve usar o writer KYB auditado.
    if (decision === 'approved') {
      const err = new HttpError(
        `PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED: Aprovação legada de empresa desabilitada. Use o fluxo KYB auditado. (request=${requestId})`,
        501
      );
      (err as unknown as { code: string }).code = 'PJ_LEGACY_COMPANY_VALIDATION_APPROVAL_DISABLED';
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // RLS local à transação. `set_config(..., true)` = scope LOCAL (vale até COMMIT/ROLLBACK).
      await client.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);

      // 1) UPDATE da request (transição pending→approved|rejected). RETURNING para encadear.
      const requestResult = await client.query<{
        id: string;
        company_id: string;
        status: string;
        reviewed_at: Date | null;
        reviewed_by_user_id: string | null;
        decision_reason: string | null;
      }>(
        `UPDATE company_validation_requests
            SET status = $3,
                reviewed_at = NOW(),
                reviewed_by_user_id = $4::uuid,
                decision_reason = $5,
                updated_at = NOW()
          WHERE tenant_id = $1::uuid AND id = $2::uuid AND status = 'pending'
          RETURNING id, company_id, status, reviewed_at, reviewed_by_user_id, decision_reason`,
        [tenantId, requestId, decision, reviewerUserId, reason ?? null]
      );
      const updatedRequest = requestResult.rows[0];
      if (!updatedRequest) {
        throw new Error(`VALIDATION_REQUEST_NOT_REVIEWABLE: request ${requestId} não encontrado, fora do tenant, ou não está em status='pending'.`);
      }

      // 2) DECISION-0090 Fase 2.4: só REJEIÇÃO chega aqui (approved lançou antes da transação).
      //    Nada a verificar — COMMIT e retorna. NÃO escreve companies.company_status/is_verified
      //    nem audit de validação no page actor.
      await client.query('COMMIT');
      return {
        id: updatedRequest.id,
        companyId: updatedRequest.company_id,
        status: updatedRequest.status,
        reviewedAt: updatedRequest.reviewed_at ? updatedRequest.reviewed_at.toISOString() : null,
        reviewedByUserId: updatedRequest.reviewed_by_user_id,
        decisionReason: updatedRequest.decision_reason,
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch (_rollbackErr) {
        // ROLLBACK falhou (conexão já perdida) — deixa o erro original propagar.
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * getValidationQueue: lista requests do tenant, opcionalmente filtrados por status.
   * JOIN com companies para entregar contexto institucional na listagem (cnpj, nome).
   */
  async getValidationQueue(
    tenantId: string,
    status?: string
  ): Promise<Array<{
    id: string;
    companyId: string;
    companyName: string;
    cnpj: string | null;
    submittedByUserId: string;
    submittedAt: string;
    submissionNotes: string | null;
    status: string;
    reviewedAt: string | null;
    reviewedByUserId: string | null;
    decisionReason: string | null;
  }>> {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para getValidationQueue (§8 03_IDENTITY_CANONICA)');
    }
    const allowedStatus = ['pending', 'under_review', 'approved', 'rejected'];
    if (status !== undefined && !allowedStatus.includes(status)) {
      throw new Error(`getValidationQueue: status inválido '${status}' — esperado um de ${allowedStatus.join(',')}`);
    }

    const rows = await pool.query<{
      id: string;
      company_id: string;
      company_name: string;
      cnpj: string | null;
      submitted_by_user_id: string;
      submitted_at: Date;
      submission_notes: string | null;
      status: string;
      reviewed_at: Date | null;
      reviewed_by_user_id: string | null;
      decision_reason: string | null;
    }>(
      status
        ? `SELECT r.id, r.company_id, c.company_name, c.cnpj, r.submitted_by_user_id, r.submitted_at,
                  r.submission_notes, r.status, r.reviewed_at, r.reviewed_by_user_id, r.decision_reason
             FROM company_validation_requests r
             JOIN companies c ON c.company_id = r.company_id AND c.tenant_id = r.tenant_id
            WHERE r.tenant_id = $1::uuid AND r.status = $2
            ORDER BY r.submitted_at DESC`
        : `SELECT r.id, r.company_id, c.company_name, c.cnpj, r.submitted_by_user_id, r.submitted_at,
                  r.submission_notes, r.status, r.reviewed_at, r.reviewed_by_user_id, r.decision_reason
             FROM company_validation_requests r
             JOIN companies c ON c.company_id = r.company_id AND c.tenant_id = r.tenant_id
            WHERE r.tenant_id = $1::uuid
            ORDER BY r.submitted_at DESC`,
      status ? [tenantId, status] : [tenantId]
    );

    return rows.rows.map((row) => ({
      id: row.id,
      companyId: row.company_id,
      companyName: row.company_name,
      cnpj: row.cnpj,
      submittedByUserId: row.submitted_by_user_id,
      submittedAt: row.submitted_at.toISOString(),
      submissionNotes: row.submission_notes,
      status: row.status,
      reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
      reviewedByUserId: row.reviewed_by_user_id,
      decisionReason: row.decision_reason,
    }));
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
