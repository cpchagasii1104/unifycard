"use strict";
// src/core/core.service.ts
// Serviço CORE - agrega dados de todos os módulos
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreService = exports.CoreService = void 0;
const pool_1 = require("@core/database/pool");
const profile_professional_service_1 = require("./profile/profile-professional.service");
const profile_physical_service_1 = require("./profile/profile-physical.service");
const profile_education_service_1 = require("./profile/profile-education.service");
const identity_service_1 = require("./identity/identity.service");
class CoreService {
    /**
     * Busca perfil completo agregando dados de todos os módulos
     * NUNCA retorna erro se uma parte estiver vazia - retorna null ou array vazio
     *
     * @param actorId Opcional: se fornecido, busca profile do actor específico (PF/PJ/Group)
     *                 Se não fornecido, usa actor PF do userId (compatibilidade)
     */
    async getCompleteProfile(tenantId, userId, actorId) {
        // Inicializar estrutura com valores padrão
        const profile = {
            actor: null,
            personal_profile: null,
            professional_profile: null,
            education_profile: null,
            physical_profile: null,
            addresses: [],
            contacts: [],
            interests: [],
            companies: [],
            identity_status: 'INCOMPLETE', // Inicializar como INCOMPLETE, será calculado depois
        };
        try {
            // 1. Actor (para Social)
            // 🔴 BLINDAGEM: Se actorId fornecido, busca actor específico (PF/PJ/Group)
            // Se não fornecido, usa actor PF do userId (compatibilidade)
            try {
                const { socialPortsRegistry } = await Promise.resolve().then(() => __importStar(require('@core/social/ports-registry')));
                const actorRepository = socialPortsRegistry.getActorRepository();
                let actor;
                if (actorId) {
                    actor = await actorRepository.findById(tenantId, actorId);
                }
                else {
                    actor = await actorRepository.findOrCreateUserActor(tenantId, userId);
                }
                if (actor) {
                    profile.actor = {
                        actor_id: actor.actor_id,
                        actor_type: actor.actor_type,
                        display_name: actor.display_name,
                        avatar_url: actor.avatar_url,
                        cover_url: actor.cover_url || null,
                        bio: actor.bio || null,
                    };
                    // 🔴 BLINDAGEM: Para actors não-user (page/group/channel), alguns perfis não são suportados
                    // Retornar estrutura vazia ao invés de dados de PF
                    if (actor.actor_type !== 'user') {
                        // Profile pessoal/profissional/saúde/aprendizado não são suportados para page/group/channel
                        // Manter estrutura vazia (já inicializada acima)
                        // Apenas education_profile pode ser usado (já é event-based por actor)
                        // Buscar education_profile se actorId fornecido
                        try {
                            const { profileEducationService } = await Promise.resolve().then(() => __importStar(require('./profile/profile-education.service')));
                            const educationProfile = await profileEducationService.getEducationProfile(tenantId, userId);
                            if (educationProfile) {
                                profile.education_profile = educationProfile;
                            }
                        }
                        catch (err) {
                            // Log mas não quebra
                            console.error('Erro ao buscar education_profile:', err);
                        }
                        return profile;
                    }
                }
            }
            catch (err) {
                // Log mas não quebra
                console.error('Erro ao buscar actor:', err);
            }
            // 2. Perfil pessoal básico
            // 🔴 CORREÇÃO CRÍTICA: profiles é SEMPRE a fonte de verdade
            // NUNCA usar identity/global_users como fonte primária ou sobrescrever valores válidos
            // 2. Perfil pessoal - Query única com JOIN + geração garantida
            let referralCode = null;
            let cpf = null;
            try {
                const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
                // Query única que busca referral_code e CPF de uma vez
                const identityResult = await pool.query(`
          SELECT u.referral_code, up.cpf
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.user_id
          WHERE u.user_id = $1
          LIMIT 1
          `, [userId]);
                const row = identityResult.rows[0];
                if (row) {
                    cpf = row.cpf || null;
                    referralCode = row.referral_code || null;
                    // 🔴 GERAÇÃO GARANTIDA: Se não tem código, gerar AGORA
                    if (!referralCode) {
                        const { referralService } = await Promise.resolve().then(() => __importStar(require('@core/referral/referral.service')));
                        const { devLog } = await Promise.resolve().then(() => __importStar(require('@utils/devLog')));
                        devLog.info('referral.code.generating', { userId });
                        referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
                        devLog.success('referral.code.generated', { userId, referralCode });
                    }
                }
            }
            catch (err) {
                const { devLog } = await Promise.resolve().then(() => __importStar(require('@utils/devLog')));
                devLog.error('referral.identity.fetch.error', {
                    userId,
                    tenantId,
                    error: err instanceof Error ? err.message : String(err),
                });
                // Fallback: tentar gerar código mesmo em caso de erro na query
                try {
                    const { referralService } = await Promise.resolve().then(() => __importStar(require('@core/referral/referral.service')));
                    const { devLog } = await Promise.resolve().then(() => __importStar(require('@utils/devLog')));
                    referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
                    devLog.success('referral.code.generated.fallback', { userId, referralCode });
                }
                catch (genErr) {
                    const { devLog } = await Promise.resolve().then(() => __importStar(require('@utils/devLog')));
                    devLog.error('referral.code.generation.failed', {
                        userId,
                        error: genErr instanceof Error ? genErr.message : String(genErr),
                    });
                }
            }
            try {
                // 🔴 CORREÇÃO CRÍTICA: Buscar CPF de user_profiles via JOIN explícito
                // CPF NUNCA vem de profiles.metadata - sempre de user_profiles
                const personalProfileRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT
            p.full_name,
            p.phone,
            p.metadata,
            up.cpf
          FROM profiles p
          LEFT JOIN user_profiles up ON up.user_id = p.user_id
          WHERE p.tenant_id = $1 AND p.user_id = $2
          ORDER BY p.updatedAt DESC
          LIMIT 1
          `, [tenantId, userId]);
                if (personalProfileRow) {
                    const row = personalProfileRow;
                    // 🔴 REGRA: CPF SEMPRE vem de user_profiles (fonte única de verdade)
                    // Se não encontrou CPF na query acima, usar o que foi buscado anteriormente
                    const finalCpf = row.cpf || cpf;
                    // 🔴 INSTRUMENTAÇÃO: Log do metadata ANTES de montar personal_profile
                    console.log('[CoreService] 🔍 Dados recebidos da query com JOIN:', {
                        tenantId,
                        userId,
                        fullName: row.full_name,
                        phone: row.phone,
                        metadataType: typeof row.metadata,
                        metadataIsObject: row.metadata && typeof row.metadata === 'object',
                        metadataKeys: row.metadata ? Object.keys(row.metadata) : [],
                        cpfFromUserProfiles: row.cpf,
                        finalCpf: finalCpf,
                        hasAddress: !!row.metadata?.address,
                    });
                    profile.personal_profile = {
                        // Preservar valores de profiles (null é válido, não fazer fallback)
                        fullName: row.full_name ?? null,
                        phone: row.phone ?? null,
                        // metadata SEMPRE vem de profiles, nunca de identity
                        // metadata NUNCA contém CPF (regra de negócio)
                        metadata: row.metadata || {},
                        referralCode: referralCode,
                        cpf: finalCpf, // ← FONTE ÚNICA: user_profiles
                    };
                    console.log('[CoreService] ✅ personal_profile montado com CPF de user_profiles:', {
                        tenantId,
                        userId,
                        fullName: profile.personal_profile.fullName,
                        phone: profile.personal_profile.phone,
                        hasMetadata: !!profile.personal_profile.metadata,
                        metadataKeys: Object.keys(profile.personal_profile.metadata || {}),
                        cpf: profile.personal_profile.cpf ? profile.personal_profile.cpf.substring(0, 3) + '***' : null,
                        cpfSource: 'user_profiles',
                    });
                }
                else {
                    // Se não existe profile, criar estrutura mínima com referralCode
                    console.log('[CoreService] ⚠️ personal_profile não encontrado em profiles (criando estrutura mínima)');
                    profile.personal_profile = {
                        fullName: null,
                        phone: null,
                        metadata: {},
                        referralCode: referralCode,
                        cpf: cpf, // ← FONTE ÚNICA: user_profiles (buscado anteriormente)
                    };
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil pessoal:', err);
                // Em caso de erro, criar estrutura mínima com referralCode
                profile.personal_profile = {
                    fullName: null,
                    phone: null,
                    metadata: {},
                    referralCode: referralCode,
                    cpf: cpf, // ← FONTE ÚNICA: user_profiles (buscado anteriormente)
                };
            }
            // 3. Perfil profissional
            try {
                const professionalProfile = await profile_professional_service_1.profileProfessionalService.getProfessionalProfile(tenantId, userId);
                if (professionalProfile) {
                    profile.professional_profile = {
                        skills: professionalProfile.skills || [],
                        bio: professionalProfile.bio || null,
                        availability: professionalProfile.availability ? JSON.stringify(professionalProfile.availability) : null,
                    };
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil profissional:', err);
            }
            // 3.5. Perfil educacional (DOMÍNIO SEPARADO DO PROFISSIONAL)
            try {
                const educationProfile = await profile_education_service_1.profileEducationService.getEducationProfile(tenantId, userId);
                if (educationProfile) {
                    profile.education_profile = {
                        education: educationProfile.education || [],
                    };
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil educacional:', err);
            }
            // 4. Perfil físico/interesses
            try {
                const physicalProfile = await profile_physical_service_1.profilePhysicalService.getPhysicalProfile(tenantId, userId);
                if (physicalProfile) {
                    // Extrair dados de saúde compartilhados (altura, peso, peso ideal) se existirem
                    const sharedHealthData = physicalProfile.metadata?.sharedHealthData;
                    profile.physical_profile = {
                        interests: physicalProfile.interests || [],
                        lifestyle: physicalProfile.lifestyle || {
                            drinks: null,
                            smokes: null,
                            relationshipStatus: null,
                            sexualOrientation: null,
                        },
                        preferences: {
                            ...(physicalProfile.preferences || {}),
                            ...(sharedHealthData ? {
                                height: sharedHealthData.height,
                                weight: sharedHealthData.weight,
                                idealWeight: sharedHealthData.idealWeight,
                            } : {}),
                        },
                    };
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil físico:', err);
            }
            // 5. Endereços (BUSCAR DIRETAMENTE DO BANCO - profiles.metadata.address)
            // 🔴 CORREÇÃO CRÍTICA: Não depender de profile.personal_profile.metadata.address
            // Buscar diretamente do banco para garantir que o endereço seja encontrado
            try {
                // 🔴 BUSCAR ENDEREÇO DIRETAMENTE DO BANCO (profiles.metadata)
                const addressResult = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT metadata
          FROM profiles
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY updatedAt DESC
          LIMIT 1
          `, [tenantId, userId]);
                // 🔴 INSTRUMENTAÇÃO: Log do que foi encontrado no banco
                console.log('[CoreService] 🔍 Buscando endereço diretamente do banco:', {
                    tenantId,
                    userId,
                    foundRecord: !!addressResult,
                    hasMetadata: !!addressResult?.metadata,
                    metadataType: typeof addressResult?.metadata,
                    metadataKeys: addressResult?.metadata ? Object.keys(addressResult.metadata) : [],
                    hasAddress: !!addressResult?.metadata?.address,
                    addressValue: addressResult?.metadata?.address,
                });
                // Verificar se há endereço no metadata retornado do banco
                const metadataFromDb = addressResult?.metadata || {};
                const addressInDb = metadataFromDb.address;
                if (addressInDb && typeof addressInDb === 'object' && Object.keys(addressInDb).length > 0) {
                    // Verificar se tem pelo menos um campo essencial preenchido
                    const hasEssentialField = addressInDb.cep ||
                        addressInDb.address ||
                        addressInDb.street ||
                        addressInDb.city;
                    if (hasEssentialField) {
                        const addr = addressInDb;
                        console.log('[CoreService] ✅ Endereço encontrado diretamente do banco:', {
                            tenantId,
                            userId,
                            cep: addr.cep,
                            street: addr.street,
                            address: addr.address,
                            number: addr.number,
                            address_number: addr.address_number,
                            city: addr.city,
                            state: addr.state,
                        });
                        profile.addresses = [{
                                address_id: 'metadata',
                                cep: addr.cep || null,
                                // 🔧 CORREÇÃO: Compatibilidade de schema de endereço (backward compatible)
                                address: addr.address || addr.street || null,
                                address_number: addr.address_number || addr.number || null,
                                complement: addr.complement || null,
                                neighborhood: addr.neighborhood || null,
                                city: addr.city || null,
                                state: addr.state || null,
                                country: addr.country || 'BR',
                                is_primary: true,
                            }];
                        console.log('[CoreService] ✅ Endereço montado e adicionado ao array:', {
                            tenantId,
                            userId,
                            addressesCount: profile.addresses.length,
                            address: profile.addresses[0],
                        });
                    }
                    else {
                        console.log('[CoreService] ⚠️ Endereço encontrado no banco mas sem campos essenciais:', {
                            tenantId,
                            userId,
                            addressInDb,
                        });
                    }
                }
                else {
                    console.log('[CoreService] ⚠️ NENHUM endereço encontrado no metadata do banco:', {
                        tenantId,
                        userId,
                        hasMetadata: !!metadataFromDb,
                        metadataKeys: Object.keys(metadataFromDb),
                        addressInDb,
                    });
                }
                // Se não encontrou, tentar buscar de companies (endereço da empresa principal)
                if (profile.addresses.length === 0) {
                    const companyAddress = await (0, pool_1.runQueryWithTenant)(tenantId, `
            SELECT c.cep, c.address, c.address_number, c.complement, c.neighborhood, c.city, c.state, c.country
            FROM companies c
            INNER JOIN company_users cu ON c.company_id = cu.company_id
            INNER JOIN users u ON cu.global_user_id = u.global_user_id
            WHERE u.user_id = $1 AND u.tenant_id = $2 AND c.status = 'active'
            ORDER BY c.createdAt DESC
            LIMIT 1
            `, [userId, tenantId]);
                    if (companyAddress) {
                        profile.addresses = [{
                                address_id: 'company',
                                cep: companyAddress.cep,
                                address: companyAddress.address,
                                address_number: companyAddress.address_number,
                                complement: companyAddress.complement,
                                neighborhood: companyAddress.neighborhood,
                                city: companyAddress.city,
                                state: companyAddress.state,
                                country: companyAddress.country || 'BR',
                                is_primary: true,
                            }];
                    }
                }
            }
            catch (err) {
                console.error('[CoreService] ❌ Erro ao buscar endereços:', {
                    tenantId,
                    userId,
                    error: err instanceof Error ? err.message : String(err),
                    stack: err instanceof Error ? err.stack : undefined,
                });
                // Manter array vazio
            }
            // 🔴 INSTRUMENTAÇÃO: Log final do resultado
            console.log('[CoreService] 📊 Resultado final de endereços:', {
                tenantId,
                userId,
                addressesCount: profile.addresses.length,
                addresses: profile.addresses,
            });
            // 6. Contatos (extraídos do profile.phone e metadata)
            try {
                const contacts = [];
                if (profile.personal_profile?.phone) {
                    contacts.push({
                        contact_id: 'phone',
                        type: 'phone',
                        valueCents: profile.personal_profile.phone,
                        is_primary: true,
                    });
                }
                // Buscar email do user
                const userEmail = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT email FROM users WHERE user_id = $1 LIMIT 1`, [userId]);
                if (userEmail?.email) {
                    contacts.push({
                        contact_id: 'email',
                        type: 'email',
                        valueCents: userEmail.email,
                        is_primary: false,
                    });
                }
                profile.contacts = contacts;
            }
            catch (err) {
                console.error('Erro ao buscar contatos:', err);
                // Manter array vazio
            }
            // 7. Interesses (do physical_profile já buscado)
            // Interesses já vêm no physical_profile.interests, não precisa buscar separado
            if (profile.physical_profile?.interests) {
                profile.interests = profile.physical_profile.interests.map((interest) => ({
                    interest_id: interest.interest_id || interest.id || '',
                    name: interest.name || interest.label || '',
                    category: interest.category || null,
                }));
            }
            // 8. Empresas
            try {
                const companies = await (0, pool_1.runQueriesWithTenant)(tenantId, `
          SELECT c.company_id, c.company_name, c.trade_name, c.cnpj, c.is_verified
          FROM companies c
          INNER JOIN company_users cu ON c.company_id = cu.company_id
          INNER JOIN users u ON cu.global_user_id = u.global_user_id
          WHERE u.user_id = $1 AND u.tenant_id = $2
          ORDER BY c.createdAt DESC
          `, [userId, tenantId]);
                profile.companies = companies.map((row) => ({
                    company_id: row.company_id,
                    company_name: row.company_name,
                    trade_name: row.trade_name,
                    cnpj: row.cnpj,
                    is_verified: row.is_verified || false,
                }));
            }
            catch (err) {
                console.error('Erro ao buscar empresas:', err);
            }
            // 🔴 IDENTITY STATUS: Calcular estado civil do usuário
            // COMPLETE se todos os dados civis imutáveis estão presentes
            const hasFullName = !!(profile.personal_profile?.fullName && profile.personal_profile.fullName.trim().length > 0);
            const hasCpf = !!(profile.personal_profile?.cpf && profile.personal_profile.cpf.trim().length > 0);
            // Buscar birthdate de identity (global_users)
            let hasBirthdate = false;
            try {
                const identityData = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
                hasBirthdate = !!(identityData?.global?.birthdate);
            }
            catch (err) {
                console.warn('Erro ao buscar birthdate para identity_status:', err);
            }
            // Buscar gender de metadata
            const gender = profile.personal_profile?.metadata?.gender;
            const hasGender = !!(gender && (gender === 'male' || gender === 'female'));
            // Calcular identity_status
            profile.identity_status = (hasFullName && hasCpf && hasBirthdate && hasGender)
                ? 'COMPLETE'
                : 'INCOMPLETE';
            console.log('[CoreService] 🔍 Identity Status calculado:', {
                tenantId,
                userId,
                hasFullName,
                hasCpf,
                hasBirthdate,
                hasGender,
                identity_status: profile.identity_status,
            });
            return profile;
        }
        catch (error) {
            // Se erro geral, logar mas retornar estrutura parcial
            console.error('Erro geral ao buscar perfil completo:', error);
            // Garantir que identity_status está definido mesmo em caso de erro
            if (!profile.identity_status) {
                profile.identity_status = 'INCOMPLETE';
            }
            return profile; // Retorna o que conseguiu buscar
        }
    }
    /**
     * 🔴 PARTE 3 - BARRA DE PROGRESSO
     * Calcula o progresso de preenchimento do perfil (0-100%)
     * Regra: 100% só é atingido com validação presencial aprovada
     */
    async calculateProfileProgress(tenantId, userId) {
        const completeProfile = await this.getCompleteProfile(tenantId, userId);
        // 1. Dados pessoais básicos (25% do total)
        let personalDataScore = 0;
        const personalMax = 25;
        if (completeProfile.personal_profile?.fullName)
            personalDataScore += 5;
        if (completeProfile.personal_profile?.cpf)
            personalDataScore += 5;
        if (completeProfile.personal_profile?.phone)
            personalDataScore += 5;
        // 🔴 CORREÇÃO: Envolver getIdentityProfile em try/catch para tratar quando global_user não existe
        let globalUser = null;
        try {
            globalUser = await identity_service_1.identityService.getIdentityProfile(userId, tenantId);
        }
        catch (err) {
            // global_user não existe - considerar null e continuar cálculo
            // Não lançar exception - progresso pode ser calculado sem birthdate
        }
        if (globalUser?.global?.birthdate)
            personalDataScore += 5;
        if (completeProfile.personal_profile?.metadata?.gender)
            personalDataScore += 5;
        const personalData = Math.min(personalDataScore, personalMax);
        // 2. Perfil profissional (20% do total)
        let professionalScore = 0;
        const professionalMax = 20;
        if (completeProfile.professional_profile?.skills && completeProfile.professional_profile.skills.length > 0) {
            professionalScore += 10;
        }
        if (completeProfile.professional_profile?.bio)
            professionalScore += 10;
        const professionalProfile = Math.min(professionalScore, professionalMax);
        // 2.5. Perfil educacional - NÃO CONTRIBUI PARA SCORE
        // Educação é apenas informacional, não gera score
        // 3. Perfil físico/interesses (15% do total)
        let physicalScore = 0;
        const physicalMax = 15;
        if (completeProfile.physical_profile?.interests && completeProfile.physical_profile.interests.length > 0) {
            physicalScore += 10;
        }
        if (completeProfile.physical_profile?.lifestyle) {
            const lifestyle = completeProfile.physical_profile.lifestyle;
            if (lifestyle.drinks || lifestyle.smokes || lifestyle.relationshipStatus || lifestyle.sexualOrientation) {
                physicalScore += 5;
            }
        }
        const physicalProfile = Math.min(physicalScore, physicalMax);
        // 4. Perfil de aprendizado - NÃO CONTRIBUI PARA SCORE
        // 🔴 BLINDAGEM CANÔNICA: Aprendizado é interesse ativo e direção declarada
        // NÃO representa completude de perfil, NÃO deve contribuir para score
        // Aprendizado é autodireção, não validação de perfil completo
        // Comentário explícito: "Aprendizado é interesse ativo, não completude."
        const learningProfile = 0;
        // 5. Empresas (10% do total)
        let companiesScore = 0;
        const companiesMax = 10;
        if (completeProfile.companies && completeProfile.companies.length > 0) {
            companiesScore = companiesMax;
        }
        const companies = Math.min(companiesScore, companiesMax);
        // 6. Validação presencial (20% do total)
        // 🔴 REGRA CRÍTICA: Validação presencial é necessária para 100%
        let presentialValidation = 0;
        const presentialMax = 20;
        let hasPresentialValidation = false;
        // Verificar se há empresa validada presencialmente
        try {
            const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            if (globalUser?.global?.globalUserId) {
                const validationResult = await pool.query(`
          SELECT COUNT(*) as count
          FROM companies c
          JOIN company_validations cv ON cv.company_id = c.company_id
          WHERE c.global_user_id = $1
            AND cv.validation_method = 'in_person'
            AND cv.status = 'approved'
          `, [globalUser.global.globalUserId]);
                const validationCount = parseInt(validationResult.rows[0]?.count || '0', 10);
                if (validationCount > 0) {
                    presentialValidation = presentialMax;
                    hasPresentialValidation = true;
                }
            }
        }
        catch (err) {
            // Ignorar erro - validação presencial não disponível
        }
        // Calcular progresso total
        // 🔴 BLINDAGEM CANÔNICA: Educação NÃO contribui para score (é apenas informacional)
        // 🔴 BLINDAGEM CANÔNICA: Aprendizado NÃO contribui para score (é interesse ativo, não completude)
        // Aprendizado é autodireção e interesse declarado, não representa completude de perfil
        const totalScore = personalData + professionalProfile + physicalProfile + learningProfile + companies + presentialValidation;
        // Progresso máximo sem validação presencial: 80%
        const maxProgressWithoutValidation = 80;
        const progress = hasPresentialValidation ? totalScore : Math.min(totalScore, maxProgressWithoutValidation);
        // Mensagens contextuais
        const messages = [];
        if (progress < 50) {
            messages.push('Complete seu perfil para acessar todos os recursos');
        }
        else if (progress < 80) {
            messages.push('Continue preenchendo seu perfil para desbloquear mais funcionalidades');
        }
        else if (progress < 100) {
            messages.push('Para chegar a 100%, valide presencialmente em uma loja parceira');
        }
        else {
            messages.push('Perfil completo! Você tem acesso a todos os recursos');
        }
        return {
            progress,
            maxProgressWithoutValidation,
            hasPresentialValidation,
            breakdown: {
                personalData,
                professionalProfile,
                physicalProfile,
                learningProfile,
                companies,
                presentialValidation,
            },
            messages,
        };
    }
}
exports.CoreService = CoreService;
exports.coreService = new CoreService();
