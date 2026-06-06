// src/core/companies/companies.service.ts
// Service para gerenciar empresas (PJ)

import { randomUUID } from 'crypto';
import { CompanyStatus } from '@unificard/contracts';
import { pool } from '@core/database/pool';
import { ensurePageActor, ensurePageActorTx, ensureUserActor } from '@modules/identity/actor-writer.service';
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

    // ── PRÉ-TX — user-actor do criador (idempotente, FORA da transação) ──────────
    // Identity-before-actor (DECISION-0062 / §7): ensureUserActor exige identity preexistente
    // e usa conexão própria (NÃO compõe transação). Falha aqui = nascimento nem inicia.
    if (!userId) {
      throw new Error('userId é obrigatório para criar actors da empresa após o cadastro.');
    }
    const creatorActor = await ensureUserActor(finalTenantId, userId);

    // Permissões + SOFT-BLOCK (validação que pode LANÇAR) — PRÉ-TX, antes de abrir transação.
    // F-PJ-COMPANY-USER-ROLE-VOCABULARY-MISMATCH: defaults derivados do vocabulário ALINHADO ao banco
    // (owner/admin/staff/contractor/member). `owner` e `admin` carregam poder de gestão; staff/
    // contractor/member não. A autoridade material vive nestes flags can_manage_*, não no rótulo `role`.
    const isManagerTier = input.role === 'owner' || input.role === 'admin';
    const defaultPermissions = {
      canManageCompany: input.permissions?.canManageCompany ?? (input.role === 'owner'),
      canManageFinancial: input.permissions?.canManageFinancial ?? isManagerTier,
      canManageEmployees: input.permissions?.canManageEmployees ?? isManagerTier,
      canViewReports: input.permissions?.canViewReports ?? true,
      canManageServices: input.permissions?.canManageServices ?? isManagerTier,
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
          can_view_reports, can_manage_services,
          is_active, is_primary, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
   * Três fases. Os writers de actor (ensureUserActor/ensurePageActor) usam
   * runQueryWithTenant/client interno e por isso rodam FORA da transação — NUNCA dentro de
   * BEGIN/COMMIT. Só a Fase 3 abre transação (getClientWithTenant) e grava APENAS a
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

    // ── FASE 2 — garantir identidade operacional (FORA de transação) ─────────
    // ensureUserActor/ensurePageActor usam client interno; NUNCA dentro de BEGIN/COMMIT.
    const responsibleActor = await ensureUserActor(tenantId, responsibleUserId);
    if (!responsibleActor?.actor_id) {
      throw this.activationError(
        'RESPONSIBLE_ACTOR_NOT_FOUND',
        `actor humano responsável (user ${responsibleUserId}) não resolvido`,
        404
      );
    }
    const pageActor = await ensurePageActor(tenantId, companyId, responsibleActor.actor_id);
    if (!pageActor?.actor_id || pageActor.actor_type !== 'page') {
      throw this.activationError(
        'PAGE_ACTOR_AMBIGUOUS',
        `page-actor da empresa ${companyId} em estado inesperado`,
        500
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

    // Comportamento normal (sem override) - usa runQueryWithTenant para garantir isolamento
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
      WHERE c.tenant_id = $1 AND c.company_id = $2::uuid AND global_user_id = $3::uuid
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
        },
        isActive: row.is_active,
        isPrimary: row.is_primary,
        metadata: row.cu_metadata ?? undefined,
        createdAt: row.cu_created_at != null ? (row.cu_created_at instanceof Date ? row.cu_created_at.toISOString() : String(row.cu_created_at)) : '',
        updatedAt: row.cu_updated_at != null ? (row.cu_updated_at instanceof Date ? row.cu_updated_at.toISOString() : String(row.cu_updated_at)) : '',
      },
    } as Company & { userRole: CompanyUser }));
    }

    // 🔴 CORREÇÃO: Comportamento normal (sem override) COM filtro tenant_id
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
        cu.is_active,
        cu.is_primary,
        cu.metadata as cu_metadata,
        cu.created_at as cu_created_at,
        cu.updated_at as cu_updated_at
      FROM companies c
      LEFT JOIN company_users cu ON c.company_id = cu.company_id AND cu.is_active = true
      LEFT JOIN fiscal_identities fi ON fi.fiscal_identity_id = c.fiscal_identity_id
      WHERE c.tenant_id = $1 AND c.global_user_id = $2::uuid
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
      },
      isActive: row.is_active,
      isPrimary: row.is_primary,
      metadata: row.metadata || undefined,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para updateCompanyUser (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;
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
            WHERE company_id = ANY($1::uuid[]) AND global_user_id = $2::uuid AND id != $3::uuid
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

    updates.push(`updated_at = NOW()`);
    values.push(companyUserId, globalUserId, finalTenantId);

    // 🔴 CORREÇÃO: UPDATE COM filtro tenant_id via JOIN
    await runQueryWithTenant(
      finalTenantId,
      `
      UPDATE company_users cu
      SET ${updates.join(', ')}
      FROM companies c
      WHERE cu.company_id = c.company_id
        AND cu.id = $${paramIdx}::uuid 
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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para deleteCompany (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

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
      SET status = 'inactive', updated_at = NOW()
      WHERE tenant_id = $1 AND company_id = $2::uuid AND global_user_id = $3::uuid
      `,
      [finalTenantId, companyId, globalUserId]
    ) as { rowCount: number | null };

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
    // §8 03_IDENTITY_CANONICA: tenant é input explícito da operação (sem fallback / sem LIMIT 1).
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('GLOBAL_USER_ID_TENANT_SAFETY_VIOLATION: tenantId é obrigatório para listCompanyDocuments (§8 03_IDENTITY_CANONICA)');
    }
    const finalTenantId = tenantId;

    // Verificar se empresa existe e pertence ao usuário
    const company = await this.getCompanyById(companyId, globalUserId, finalTenantId);
    if (!company) {
      throw new Error('Empresa não encontrada');
    }

    // 🔴 CORREÇÃO: Query COM filtro tenant_id via JOIN com companies
    const docListRows = await runQueriesWithTenant<{
      document_id: string;
      document_type: string;
      file_name: string;
      file_path: string;
      file_size: number;
      mime_type: string;
      status: string;
      created_at: Date;
      updated_at: Date;
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
        cd.created_at,
        cd.updated_at
      FROM company_documents cd
      INNER JOIN companies c ON cd.company_id = c.company_id
      WHERE cd.company_id = $1::uuid 
        AND cd.global_user_id = $2::uuid
        AND c.tenant_id = $3
      ORDER BY cd.created_at DESC
      `,
      [companyId, globalUserId, finalTenantId]
    );

    return docListRows.map(row => ({
      documentId: row.document_id,
      documentType: row.document_type,
      fileName: row.file_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      created_at: Date;
      updated_at: Date;
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
        cd.created_at,
        cd.updated_at
      FROM company_documents cd
      INNER JOIN companies c ON cd.company_id = c.company_id
      WHERE cd.status = 'pending'
      ORDER BY cd.created_at ASC
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
        updated_at = NOW()
      WHERE document_id = $3::uuid
      `,
      [status, JSON.stringify(updatedMetadata), documentId]
    );

    // DECISION-0090 Fase 2.3: documento é EVIDÊNCIA, NÃO verifica a empresa. updateDocumentStatus
    // atualiza apenas o documento legado (company_documents) — NÃO escreve companies.company_status/
    // is_verified. Fonte única de verificação PJ = fiscal_identities.kyb_status (writer KYB auditado).
    if (status === 'approved') {
      // 🔴 AUDITORIA: Log de aprovação (apenas do documento)
      console.log('[CompaniesService] ✅ Documento aprovado (não verifica empresa — DECISION-0090):', {
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
