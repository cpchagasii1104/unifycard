"use strict";
// src/core/companies/companies.service.ts
// Service para gerenciar empresas (PJ)
Object.defineProperty(exports, "__esModule", { value: true });
exports.companiesService = void 0;
const crypto_1 = require("crypto");
const pool_1 = require("@core/database/pool");
class CompaniesService {
    /**
     * Busca dados do CNPJ na Receita Federal (API pública)
     * 🔴 NUNCA lança erro bloqueante - sempre retorna null em caso de falha
     */
    async fetchCNPJFromRevenue(cnpj) {
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
                const data = await response.json();
                if (data.status === 'ERROR') {
                    throw new Error(data.message || 'CNPJ não encontrado');
                }
                // Validar se tem dados essenciais
                if (data.nome || data.razao_social) {
                    return data;
                }
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (err) {
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
                const data = await response.json();
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
                        atividades_secundarias: data.cnaes_secundarios?.map((cnae) => ({
                            code: cnae.codigo,
                            text: cnae.descricao,
                        })) || [],
                        qsa: data.qsa?.map((socio) => ({
                            nome: socio.nome,
                            qual: socio.qual,
                            pais_origem: socio.pais_origem,
                        })) || [],
                    };
                }
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (err) {
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
    validateCNPJFormat(cnpj) {
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
    validateCNPJ(cnpj) {
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
            if (pos < 2)
                pos = 9;
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
            if (pos < 2)
                pos = 9;
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
    formatCNPJ(cnpj) {
        const clean = cnpj.replace(/\D/g, '');
        if (clean.length !== 14)
            return cnpj;
        return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    /**
     * Cria uma nova empresa
     * 🔴 SEMPRE salva, mesmo sem dados da Receita Federal
     */
    async createCompany(globalUserId, input) {
        // 🔴 Validar APENAS formato do CNPJ (não dígitos verificadores)
        const formatValidation = this.validateCNPJFormat(input.cnpj);
        if (!formatValidation.valid) {
            throw new Error(formatValidation.error || 'CNPJ deve ter 14 dígitos');
        }
        const formattedCNPJ = this.formatCNPJ(input.cnpj);
        // Verificar se já existe
        const existing = await pool_1.pool.query(`
      SELECT company_id
      FROM companies
      WHERE global_user_id = $1 AND cnpj = $2
      LIMIT 1
      `, [globalUserId, formattedCNPJ]);
        if (existing.rows.length > 0) {
            throw new Error('Empresa com este CNPJ já está cadastrada');
        }
        let revenueData = null;
        let companyName = input.companyName;
        let tradeName = input.tradeName;
        let address = input.address || {};
        let contact = input.contact || {};
        let activity = input.activity || {};
        let companyStatus = 'draft';
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
                    // Se conseguiu buscar da Receita, marcar como validated
                    companyStatus = 'validated';
                    isVerified = true;
                }
                else {
                    // Se não conseguiu buscar, mas tem nome, marcar como manual
                    if (companyName) {
                        companyStatus = 'manual';
                    }
                    else {
                        companyStatus = 'draft';
                    }
                }
            }
            catch (err) {
                // 🔴 Erro na busca NÃO bloqueia cadastro
                console.warn('[CompaniesService] Erro ao buscar da Receita (não bloqueante):', err);
                if (companyName) {
                    companyStatus = 'manual';
                }
                else {
                    companyStatus = 'draft';
                }
            }
        }
        else {
            // Se não tentou buscar, mas tem nome, marcar como manual
            if (companyName) {
                companyStatus = 'manual';
            }
            else {
                companyStatus = 'draft';
            }
        }
        // 🔴 Nome da empresa é obrigatório apenas se não veio da Receita
        if (!companyName) {
            throw new Error('Nome da empresa é obrigatório');
        }
        // Se há empresa primária, desmarcar outras
        if (input.isPrimary) {
            await pool_1.pool.query(`
        UPDATE company_users
        SET is_primary = false, updated_at = now()
        WHERE global_user_id = $1
        `, [globalUserId]);
        }
        // Criar empresa
        const companyResult = await pool_1.pool.query(`
      INSERT INTO companies (
        global_user_id, cnpj, company_name, trade_name, registration_date,
        cep, address, address_number, complement, neighborhood, city, state, country,
        phone, email, website,
        main_activity_code, main_activity_description, secondary_activities,
        revenue_data, status, is_verified, company_status, metadata
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23, $24
      )
      RETURNING company_id, created_at, updated_at
      `, [
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
            JSON.stringify({}), // Metadata inicial
        ]);
        const companyId = companyResult.rows[0].company_id;
        // Criar relacionamento usuário-empresa
        const defaultPermissions = {
            canManageCompany: input.permissions?.canManageCompany ?? (input.role === 'owner'),
            canManageFinancial: input.permissions?.canManageFinancial ?? (input.role === 'owner' || input.role === 'director'),
            canManageEmployees: input.permissions?.canManageEmployees ?? (input.role === 'owner' || input.role === 'director' || input.role === 'manager'),
            canViewReports: input.permissions?.canViewReports ?? true,
            canManageServices: input.permissions?.canManageServices ?? (input.role === 'owner' || input.role === 'director' || input.role === 'manager'),
        };
        const userResult = await pool_1.pool.query(`
      INSERT INTO company_users (
        company_id, global_user_id, role, role_description,
        can_manage_company, can_manage_financial, can_manage_employees,
        can_view_reports, can_manage_services,
        is_active, is_primary, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING company_user_id, created_at, updated_at
      `, [
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
        ]);
        // Buscar empresa completa
        const company = await this.getCompanyById(companyId, globalUserId);
        const companyUser = await this.getCompanyUserById(userResult.rows[0].company_user_id, globalUserId);
        if (!company || !companyUser) {
            throw new Error('Erro ao criar empresa');
        }
        return { company, companyUser };
    }
    /**
     * Busca empresa por ID
     */
    async getCompanyById(companyId, globalUserId) {
        const result = await pool_1.pool.query(`
      SELECT *
      FROM companies
      WHERE company_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [companyId, globalUserId]);
        if (!result.rows[0]) {
            return null;
        }
        const row = result.rows[0];
        return {
            companyId: row.company_id,
            globalUserId: row.global_user_id,
            cnpj: row.cnpj,
            companyName: row.company_name,
            tradeName: row.trade_name || undefined,
            registrationDate: row.registration_date?.toISOString().split('T')[0],
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
            status: row.status,
            companyStatus: (row.company_status || 'draft'),
            isVerified: row.is_verified,
            metadata: row.metadata || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Lista todas as empresas do usuário
     */
    async listCompanies(globalUserId) {
        const result = await pool_1.pool.query(`
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
        cu.created_at as cu_created_at,
        cu.updated_at as cu_updated_at
      FROM companies c
      INNER JOIN company_users cu ON c.company_id = cu.company_id
      WHERE c.global_user_id = $1 AND cu.is_active = true
      ORDER BY cu.is_primary DESC, c.created_at DESC
      `, [globalUserId]);
        return result.rows.map(row => ({
            companyId: row.company_id,
            globalUserId: row.global_user_id,
            cnpj: row.cnpj,
            companyName: row.company_name,
            tradeName: row.trade_name || undefined,
            registrationDate: row.registration_date?.toISOString().split('T')[0],
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
            status: row.status,
            companyStatus: (row.company_status || 'draft'),
            isVerified: row.is_verified,
            metadata: row.metadata || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userRole: {
                companyUserId: row.company_user_id,
                companyId: row.company_id,
                globalUserId: row.global_user_id,
                role: row.role,
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
                createdAt: row.cu_created_at,
                updatedAt: row.cu_updated_at,
            },
        }));
    }
    /**
     * Atualiza empresa
     * 🔴 Bloqueia edição de CNPJ se company_status = 'validated'
     */
    async updateCompany(companyId, globalUserId, input) {
        // 🔴 Verificar se empresa está validada - CNPJ não pode ser editado
        const existing = await this.getCompanyById(companyId, globalUserId);
        if (!existing) {
            throw new Error('Empresa não encontrada');
        }
        // 🔴 PROTEÇÃO: Bloquear alteração de CNPJ se status for validated OU pending_doc
        // Regra: Upload iniciado já congela o CNPJ
        if (input.cnpj && (existing.companyStatus === 'validated' || existing.companyStatus === 'pending_doc')) {
            throw new Error(`CNPJ não pode ser editado. ` +
                `Empresa está com status "${existing.companyStatus === 'validated' ? 'validada' : 'aguardando validação de documento'}" e o CNPJ está bloqueado.`);
        }
        const updates = [];
        const values = [];
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
            updates.push(`registration_date = $${paramIdx}`);
            values.push(input.registrationDate ? new Date(input.registrationDate) : null);
            paramIdx++;
        }
        if (input.address) {
            if (input.address.cep !== undefined)
                updates.push(`cep = $${paramIdx}`), values.push(input.address.cep || null), paramIdx++;
            if (input.address.address !== undefined)
                updates.push(`address = $${paramIdx}`), values.push(input.address.address || null), paramIdx++;
            if (input.address.addressNumber !== undefined)
                updates.push(`address_number = $${paramIdx}`), values.push(input.address.addressNumber || null), paramIdx++;
            if (input.address.complement !== undefined)
                updates.push(`complement = $${paramIdx}`), values.push(input.address.complement || null), paramIdx++;
            if (input.address.neighborhood !== undefined)
                updates.push(`neighborhood = $${paramIdx}`), values.push(input.address.neighborhood || null), paramIdx++;
            if (input.address.city !== undefined)
                updates.push(`city = $${paramIdx}`), values.push(input.address.city || null), paramIdx++;
            if (input.address.state !== undefined)
                updates.push(`state = $${paramIdx}`), values.push(input.address.state || null), paramIdx++;
            if (input.address.country !== undefined)
                updates.push(`country = $${paramIdx}`), values.push(input.address.country || null), paramIdx++;
        }
        if (input.contact) {
            if (input.contact.phone !== undefined)
                updates.push(`phone = $${paramIdx}`), values.push(input.contact.phone || null), paramIdx++;
            if (input.contact.email !== undefined)
                updates.push(`email = $${paramIdx}`), values.push(input.contact.email || null), paramIdx++;
            if (input.contact.website !== undefined)
                updates.push(`website = $${paramIdx}`), values.push(input.contact.website || null), paramIdx++;
        }
        if (input.activity) {
            if (input.activity.mainActivityCode !== undefined)
                updates.push(`main_activity_code = $${paramIdx}`), values.push(input.activity.mainActivityCode || null), paramIdx++;
            if (input.activity.mainActivityDescription !== undefined)
                updates.push(`main_activity_description = $${paramIdx}`), values.push(input.activity.mainActivityDescription || null), paramIdx++;
            if (input.activity.secondaryActivities !== undefined)
                updates.push(`secondary_activities = $${paramIdx}`), values.push(JSON.stringify(input.activity.secondaryActivities || [])), paramIdx++;
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
        updates.push(`updated_at = now()`);
        values.push(companyId, globalUserId);
        await pool_1.pool.query(`
      UPDATE companies
      SET ${updates.join(', ')}
      WHERE company_id = $${paramIdx} AND global_user_id = $${paramIdx + 1}
      `, values);
        const updated = await this.getCompanyById(companyId, globalUserId);
        if (!updated) {
            throw new Error('Erro ao atualizar empresa');
        }
        return updated;
    }
    /**
     * Busca relacionamento usuário-empresa por ID
     */
    async getCompanyUserById(companyUserId, globalUserId) {
        const result = await pool_1.pool.query(`
      SELECT *
      FROM company_users
      WHERE company_user_id = $1 AND global_user_id = $2
      LIMIT 1
      `, [companyUserId, globalUserId]);
        if (!result.rows[0]) {
            return null;
        }
        const row = result.rows[0];
        return {
            companyUserId: row.company_user_id,
            companyId: row.company_id,
            globalUserId: row.global_user_id,
            role: row.role,
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
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Atualiza relacionamento usuário-empresa
     */
    async updateCompanyUser(companyUserId, globalUserId, input) {
        const updates = [];
        const values = [];
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
            // Se está marcando como primária, desmarcar outras
            if (input.isPrimary) {
                await pool_1.pool.query(`
          UPDATE company_users
          SET is_primary = false, updated_at = now()
          WHERE global_user_id = $1 AND company_user_id != $2
          `, [globalUserId, companyUserId]);
            }
            updates.push(`is_primary = $${paramIdx}`);
            values.push(input.isPrimary);
            paramIdx++;
        }
        if (updates.length === 0) {
            const existing = await this.getCompanyUserById(companyUserId, globalUserId);
            if (!existing) {
                throw new Error('Relacionamento não encontrado');
            }
            return existing;
        }
        updates.push(`updated_at = now()`);
        values.push(companyUserId, globalUserId);
        await pool_1.pool.query(`
      UPDATE company_users
      SET ${updates.join(', ')}
      WHERE company_user_id = $${paramIdx} AND global_user_id = $${paramIdx + 1}
      `, values);
        const updated = await this.getCompanyUserById(companyUserId, globalUserId);
        if (!updated) {
            throw new Error('Erro ao atualizar relacionamento');
        }
        return updated;
    }
    /**
     * Remove empresa (soft delete)
     * 🔴 PROTEÇÃO: Não permite excluir se houver documento ou transação associada
     */
    async deleteCompany(companyId, globalUserId) {
        // Verificar se empresa existe e pertence ao usuário
        const company = await this.getCompanyById(companyId, globalUserId);
        if (!company) {
            throw new Error('Empresa não encontrada');
        }
        // 🔴 PROTEÇÃO 1: Verificar se há documentos anexados
        const documents = await pool_1.pool.query(`
      SELECT COUNT(*) as count
      FROM company_documents
      WHERE company_id = $1 AND status != 'rejected'
      `, [companyId]);
        const docCount = parseInt(documents.rows[0]?.count || '0', 10);
        if (docCount > 0) {
            throw new Error(`Não é possível excluir a empresa. Existem ${docCount} documento(s) anexado(s). ` +
                `Remova os documentos antes de excluir a empresa.`);
        }
        // 🔴 PROTEÇÃO 2: Verificar se há transações associadas
        // Buscar accounts vinculados à empresa (se houver owner_type = 'company')
        const accounts = await pool_1.pool.query(`
      SELECT account_id
      FROM accounts
      WHERE owner_id = $1::text AND owner_type = 'company'
      LIMIT 1
      `, [companyId]);
        if (accounts.rows.length > 0) {
            // Verificar se há transações envolvendo essas contas
            const accountIds = accounts.rows.map(a => a.account_id);
            const transactions = await pool_1.pool.query(`
        SELECT COUNT(*) as count
        FROM transactions
        WHERE from_account = ANY($1::uuid[]) OR to_account = ANY($1::uuid[])
        `, [accountIds]);
            const txCount = parseInt(transactions.rows[0]?.count || '0', 10);
            if (txCount > 0) {
                throw new Error(`Não é possível excluir a empresa. Existem ${txCount} transação(ões) financeira(s) associada(s). ` +
                    `Empresas com histórico financeiro não podem ser excluídas.`);
            }
        }
        // Se passou todas as verificações, fazer soft delete
        const result = await pool_1.pool.query(`
      UPDATE companies
      SET status = 'inactive', updated_at = now()
      WHERE company_id = $1 AND global_user_id = $2
      `, [companyId, globalUserId]);
        return result.rowCount !== null && result.rowCount > 0;
    }
    /**
     * Upload documento da empresa (PDF)
     * 🔴 SEGURANÇA: Valida MIME type + extensão, renomeia com UUID, registra auditoria
     */
    async uploadCompanyDocument(companyId, globalUserId, file, documentType = 'cnpj_receita', userIp) {
        // Verificar se empresa existe e pertence ao usuário
        const company = await this.getCompanyById(companyId, globalUserId);
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
        const uniqueFilename = `${(0, crypto_1.randomUUID)()}${fileExtensionSafe}`;
        // Construir URL relativa do arquivo (com nome seguro)
        const fileUrl = `/uploads/companies/${companyId}/${uniqueFilename}`;
        // Nota: O arquivo será salvo no filesystem pelo route handler com este nome único
        // Inserir documento no banco
        const result = await pool_1.pool.query(`
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
      ON CONFLICT (company_id, document_type, status) 
      WHERE status = 'pending'
      DO UPDATE SET
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        file_size = EXCLUDED.file_size,
        mime_type = EXCLUDED.mime_type,
        updated_at = now()
      RETURNING document_id
      `, [
            companyId,
            globalUserId,
            documentType,
            uniqueFilename, // Usar nome único, não o original
            fileUrl,
            file.size,
            file.mimetype,
        ]);
        if (!result.rows[0]) {
            throw new Error('Erro ao salvar documento');
        }
        // 🔴 AUDITORIA: Registrar log do upload
        console.log('[CompaniesService] 📄 Upload de documento:', {
            documentId: result.rows[0].document_id,
            companyId,
            globalUserId,
            documentType,
            fileName: uniqueFilename,
            fileSize: file.size,
            userIp: userIp || 'unknown',
            timestamp: new Date().toISOString(),
        });
        // Atualizar status da empresa para 'pending_doc'
        const statusUpdate = await pool_1.pool.query(`
      UPDATE companies
      SET company_status = 'pending_doc', updated_at = now()
      WHERE company_id = $1 AND global_user_id = $2
        AND company_status != 'validated'
      RETURNING company_status
      `, [companyId, globalUserId]);
        // 🔴 AUDITORIA: Log de mudança de status
        if (statusUpdate.rows[0]) {
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
        const updatedCompany = await this.getCompanyById(companyId, globalUserId);
        return {
            documentId: result.rows[0].document_id,
            companyStatus: updatedCompany?.companyStatus || 'pending_doc',
            fileName: uniqueFilename, // Retornar nome único para salvar no filesystem
        };
    }
    /**
     * Lista documentos da empresa
     */
    async listCompanyDocuments(companyId, globalUserId) {
        // Verificar se empresa existe e pertence ao usuário
        const company = await this.getCompanyById(companyId, globalUserId);
        if (!company) {
            throw new Error('Empresa não encontrada');
        }
        const result = await pool_1.pool.query(`
      SELECT 
        document_id,
        document_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        status,
        created_at,
        updated_at
      FROM company_documents
      WHERE company_id = $1 AND global_user_id = $2
      ORDER BY created_at DESC
      `, [companyId, globalUserId]);
        return result.rows.map(row => ({
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
    async listPendingDocuments() {
        const result = await pool_1.pool.query(`
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
      `, []);
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
    async updateDocumentStatus(documentId, status, rejectedReason, adminUserId) {
        // Buscar documento
        const docResult = await pool_1.pool.query(`
      SELECT document_id, company_id, global_user_id, document_type, status
      FROM company_documents
      WHERE document_id = $1
      LIMIT 1
      `, [documentId]);
        if (!docResult.rows[0]) {
            throw new Error('Documento não encontrado');
        }
        const doc = docResult.rows[0];
        // Atualizar status do documento com metadata
        const currentMetadata = await pool_1.pool.query(`
      SELECT metadata FROM company_documents WHERE document_id = $1
      `, [documentId]);
        const existingMetadata = currentMetadata.rows[0]?.metadata || {};
        const updatedMetadata = {
            ...existingMetadata,
            approved_by: adminUserId || null,
            approved_at: new Date().toISOString(),
            ...(status === 'rejected' && rejectedReason ? { rejected_reason: rejectedReason } : {}),
        };
        await pool_1.pool.query(`
      UPDATE company_documents
      SET 
        status = $1,
        metadata = $2::jsonb,
        updated_at = now()
      WHERE document_id = $3
      `, [status, JSON.stringify(updatedMetadata), documentId]);
        // Se aprovado, atualizar status da empresa para 'validated'
        if (status === 'approved') {
            await pool_1.pool.query(`
        UPDATE companies
        SET company_status = 'validated', is_verified = true, updated_at = now()
        WHERE company_id = $1
        `, [doc.company_id]);
            // 🔴 AUDITORIA: Log de aprovação
            console.log('[CompaniesService] ✅ Documento aprovado:', {
                documentId,
                companyId: doc.company_id,
                globalUserId: doc.global_user_id,
                documentType: doc.document_type,
                approvedBy: adminUserId || 'unknown',
                timestamp: new Date().toISOString(),
            });
        }
        else {
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
        const companyResult = await pool_1.pool.query(`
      SELECT company_status
      FROM companies
      WHERE company_id = $1
      LIMIT 1
      `, [doc.company_id]);
        return {
            documentId,
            companyStatus: companyResult.rows[0]?.company_status || 'pending_doc',
        };
    }
}
exports.companiesService = new CompaniesService();
//# sourceMappingURL=companies.service.js.map