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
const profile_service_1 = require("./profile/profile.service");
const profile_professional_service_1 = require("./profile/profile-professional.service");
const profile_physical_service_1 = require("./profile/profile-physical.service");
class CoreService {
    /**
     * Busca perfil completo agregando dados de todos os módulos
     * NUNCA retorna erro se uma parte estiver vazia - retorna null ou array vazio
     */
    async getCompleteProfile(tenantId, userId, globalUserId) {
        // Inicializar estrutura com valores padrão
        const profile = {
            actor: null,
            personal_profile: null,
            professional_profile: null,
            physical_profile: null,
            addresses: [],
            contacts: [],
            interests: [],
            companies: [],
        };
        try {
            // 1. Actor (para Social)
            try {
                const { actorRepository } = await Promise.resolve().then(() => __importStar(require('@modules/social/actor.repository')));
                const actor = await actorRepository.findOrCreateUserActor(tenantId, userId, globalUserId);
                if (actor) {
                    profile.actor = {
                        actor_id: actor.actor_id,
                        actor_type: actor.actor_type,
                        display_name: actor.display_name,
                        avatar_url: actor.avatar_url,
                        cover_url: actor.cover_url || null,
                        bio: actor.bio || null,
                    };
                }
            }
            catch (err) {
                // Log mas não quebra
                console.error('Erro ao buscar actor:', err);
            }
            // 2. Perfil pessoal básico
            // 🔴 CORREÇÃO CRÍTICA: profiles é SEMPRE a fonte de verdade
            // NUNCA usar identity/global_users como fonte primária ou sobrescrever valores válidos
            try {
                const personalProfile = await profile_service_1.profileService.getProfile(tenantId, userId);
                if (personalProfile) {
                    // 🔴 REGRA: Usar valores de profiles, mesmo se forem null/empty
                    // NÃO fazer fallback para identity - profiles é a fonte de verdade
                    // 🔴 INSTRUMENTAÇÃO: Log do metadata ANTES de montar personal_profile
                    console.log('[CoreService] 🔍 Metadata recebido de profileService.getProfile():', {
                        tenantId,
                        userId,
                        metadataType: typeof personalProfile.metadata,
                        metadataIsObject: personalProfile.metadata && typeof personalProfile.metadata === 'object',
                        metadataKeys: personalProfile.metadata ? Object.keys(personalProfile.metadata) : [],
                        hasAddress: !!personalProfile.metadata?.address,
                        addressType: typeof personalProfile.metadata?.address,
                        addressValue: personalProfile.metadata?.address,
                    });
                    profile.personal_profile = {
                        // Preservar valores de profiles (null é válido, não fazer fallback)
                        fullName: personalProfile.fullName ?? null,
                        phone: personalProfile.phone ?? null,
                        // metadata SEMPRE vem de profiles, nunca de identity
                        metadata: personalProfile.metadata || {},
                    };
                    console.log('[CoreService] ✅ personal_profile montado APENAS de profiles:', {
                        tenantId,
                        userId,
                        fullName: profile.personal_profile.fullName,
                        phone: profile.personal_profile.phone,
                        hasMetadata: !!profile.personal_profile.metadata,
                        metadataKeys: Object.keys(profile.personal_profile.metadata || {}),
                        hasAddressInMetadata: !!profile.personal_profile.metadata?.address,
                        addressKeys: profile.personal_profile.metadata?.address ? Object.keys(profile.personal_profile.metadata.address) : [],
                        addressType: typeof profile.personal_profile.metadata?.address,
                        addressValue: profile.personal_profile.metadata?.address,
                    });
                }
                else {
                    // Se não existe profile, retornar null (NÃO criar vazio, NÃO buscar de identity)
                    console.log('[CoreService] ⚠️ personal_profile não encontrado em profiles (retornando null)');
                    profile.personal_profile = null;
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil pessoal:', err);
                // Em caso de erro, retornar null (NÃO fazer fallback para identity)
                profile.personal_profile = null;
            }
            // 3. Perfil profissional
            try {
                const professionalProfile = await profile_professional_service_1.profileProfessionalService.getProfessionalProfile(tenantId, userId);
                if (professionalProfile) {
                    profile.professional_profile = {
                        skills: professionalProfile.skills || [],
                        education: professionalProfile.education || [],
                        bio: professionalProfile.bio || null,
                        availability: professionalProfile.availability ? JSON.stringify(professionalProfile.availability) : null,
                    };
                }
            }
            catch (err) {
                console.error('Erro ao buscar perfil profissional:', err);
            }
            // 4. Perfil físico/interesses
            try {
                const physicalProfile = await profile_physical_service_1.profilePhysicalService.getPhysicalProfile(tenantId, userId);
                if (physicalProfile) {
                    profile.physical_profile = {
                        interests: physicalProfile.interests || [],
                        lifestyle: physicalProfile.lifestyle || {
                            drinks: null,
                            smokes: null,
                            relationshipStatus: null,
                            sexualOrientation: null,
                        },
                        preferences: physicalProfile.preferences || {},
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
          ORDER BY updated_at DESC
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
            SELECT cep, address, address_number, complement, neighborhood, city, state, country
            FROM companies
            WHERE global_user_id = $1 AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            `, [globalUserId]);
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
                        value: profile.personal_profile.phone,
                        is_primary: true,
                    });
                }
                // Buscar email do user
                const userEmail = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT email FROM users WHERE user_id = $1 LIMIT 1`, [userId]);
                if (userEmail?.email) {
                    contacts.push({
                        contact_id: 'email',
                        type: 'email',
                        value: userEmail.email,
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
          WHERE cu.global_user_id = $1
          ORDER BY c.created_at DESC
          `, [globalUserId]);
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
            return profile;
        }
        catch (error) {
            // Se erro geral, logar mas retornar estrutura parcial
            console.error('Erro geral ao buscar perfil completo:', error);
            return profile; // Retorna o que conseguiu buscar
        }
    }
}
exports.CoreService = CoreService;
exports.coreService = new CoreService();
//# sourceMappingURL=core.service.js.map