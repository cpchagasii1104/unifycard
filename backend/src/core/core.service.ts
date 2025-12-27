// src/core/core.service.ts
// Serviço CORE - agrega dados de todos os módulos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { profileService } from './profile/profile.service';
import { profileProfessionalService } from './profile/profile-professional.service';
import { profilePhysicalService } from './profile/profile-physical.service';
import { identityService } from './identity/identity.service';
// Importar actorRepository dinamicamente para evitar dependência circular
// // actorRepository importado dinamicamente para evitar dependência circular

export interface CompleteProfile {
  actor: {
    actor_id: string;
    actor_type: string;
    display_name: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
  } | null;
  personal_profile: {
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
  } | null;
  professional_profile: {
    skills: any[];
    education: any[];
    bio: string | null;
    availability: string | null;
  } | null;
  physical_profile: {
    interests: any[];
    lifestyle: {
      drinks: string | null;
      smokes: string | null;
      relationshipStatus: string | null;
      sexualOrientation: string | null;
    };
    preferences: Record<string, any>;
  } | null;
  addresses: Array<{
    address_id: string;
    cep: string | null;
    address: string | null;
    address_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    is_primary: boolean;
  }>;
  contacts: Array<{
    contact_id: string;
    type: string;
    value: string;
    is_primary: boolean;
  }>;
  interests: Array<{
    interest_id: string;
    name: string;
    category: string | null;
  }>;
  companies: Array<{
    company_id: string;
    company_name: string;
    trade_name: string | null;
    cnpj: string | null;
    is_verified: boolean;
  }>;
}

export class CoreService {
  /**
   * Busca perfil completo agregando dados de todos os módulos
   * NUNCA retorna erro se uma parte estiver vazia - retorna null ou array vazio
   */
  async getCompleteProfile(
    tenantId: string,
    userId: string,
    globalUserId: string
  ): Promise<CompleteProfile> {
    // Inicializar estrutura com valores padrão
    const profile: CompleteProfile = {
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
        const { actorRepository } = await import('@modules/social/actor.repository');
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
      } catch (err) {
        // Log mas não quebra
        console.error('Erro ao buscar actor:', err);
      }

      // 2. Perfil pessoal básico
      // 🔴 CORREÇÃO CRÍTICA: profiles é SEMPRE a fonte de verdade
      // NUNCA usar identity/global_users como fonte primária ou sobrescrever valores válidos
      try {
        const personalProfile = await profileService.getProfile(tenantId, userId);
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
        } else {
          // Se não existe profile, retornar null (NÃO criar vazio, NÃO buscar de identity)
          console.log('[CoreService] ⚠️ personal_profile não encontrado em profiles (retornando null)');
          profile.personal_profile = null;
        }
      } catch (err) {
        console.error('Erro ao buscar perfil pessoal:', err);
        // Em caso de erro, retornar null (NÃO fazer fallback para identity)
        profile.personal_profile = null;
      }

      // 3. Perfil profissional
      try {
        const professionalProfile = await profileProfessionalService.getProfessionalProfile(
          tenantId,
          userId
        );
        if (professionalProfile) {
          profile.professional_profile = {
            skills: professionalProfile.skills || [],
            education: professionalProfile.education || [],
            bio: professionalProfile.bio || null,
            availability: professionalProfile.availability ? JSON.stringify(professionalProfile.availability) : null,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar perfil profissional:', err);
      }

      // 4. Perfil físico/interesses
      try {
        const physicalProfile = await profilePhysicalService.getPhysicalProfile(
          tenantId,
          userId
        );
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
      } catch (err) {
        console.error('Erro ao buscar perfil físico:', err);
      }

      // 5. Endereços (BUSCAR DIRETAMENTE DO BANCO - profiles.metadata.address)
      // 🔴 CORREÇÃO CRÍTICA: Não depender de profile.personal_profile.metadata.address
      // Buscar diretamente do banco para garantir que o endereço seja encontrado
      try {
        // 🔴 BUSCAR ENDEREÇO DIRETAMENTE DO BANCO (profiles.metadata)
        const addressResult = await runQueryWithTenant<{
          metadata: any;
        }>(
          tenantId,
          `
          SELECT metadata
          FROM profiles
          WHERE tenant_id = $1 AND user_id = $2
          ORDER BY updated_at DESC
          LIMIT 1
          `,
          [tenantId, userId]
        );

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
          const hasEssentialField = 
            addressInDb.cep || 
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
          } else {
            console.log('[CoreService] ⚠️ Endereço encontrado no banco mas sem campos essenciais:', {
              tenantId,
              userId,
              addressInDb,
            });
          }
        } else {
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
          const companyAddress = await runQueryWithTenant<any>(
            tenantId,
            `
            SELECT cep, address, address_number, complement, neighborhood, city, state, country
            FROM companies
            WHERE global_user_id = $1 AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [globalUserId]
          );
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
      } catch (err) {
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
        const contacts: any[] = [];
        if (profile.personal_profile?.phone) {
          contacts.push({
            contact_id: 'phone',
            type: 'phone',
            value: profile.personal_profile.phone,
            is_primary: true,
          });
        }
        // Buscar email do user
        const userEmail = await runQueryWithTenant<{ email: string }>(
          tenantId,
          `SELECT email FROM users WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        if (userEmail?.email) {
          contacts.push({
            contact_id: 'email',
            type: 'email',
            value: userEmail.email,
            is_primary: false,
          });
        }
        profile.contacts = contacts;
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
        // Manter array vazio
      }

      // 7. Interesses (do physical_profile já buscado)
      // Interesses já vêm no physical_profile.interests, não precisa buscar separado
      if (profile.physical_profile?.interests) {
        profile.interests = profile.physical_profile.interests.map((interest: any) => ({
          interest_id: interest.interest_id || interest.id || '',
          name: interest.name || interest.label || '',
          category: interest.category || null,
        }));
      }

      // 8. Empresas
      try {
        const companies = await runQueriesWithTenant<any>(
          tenantId,
          `
          SELECT c.company_id, c.company_name, c.trade_name, c.cnpj, c.is_verified
          FROM companies c
          INNER JOIN company_users cu ON c.company_id = cu.company_id
          WHERE cu.global_user_id = $1
          ORDER BY c.created_at DESC
          `,
          [globalUserId]
        );
        profile.companies = companies.map((row) => ({
          company_id: row.company_id,
          company_name: row.company_name,
          trade_name: row.trade_name,
          cnpj: row.cnpj,
          is_verified: row.is_verified || false,
        }));
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
      }

      return profile;
    } catch (error) {
      // Se erro geral, logar mas retornar estrutura parcial
      console.error('Erro geral ao buscar perfil completo:', error);
      return profile; // Retorna o que conseguiu buscar
    }
  }
}

export const coreService = new CoreService();

