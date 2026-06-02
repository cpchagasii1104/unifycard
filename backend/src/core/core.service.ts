// src/core/core.service.ts
// Serviço CORE - agrega dados de todos os módulos

import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { profileService } from './profile/profile.service';
import { profileProfessionalService } from './profile/profile-professional.service';
import { profilePhysicalService } from './profile/profile-physical.service';
// F4 (DECISION-0069): interesses do getCompleteProfile vêm do C1 actor-first/concept-first (helper de
// leitura), não mais do físico legado (que retorna []). Lifestyle/Health continuam no fluxo legado.
import { profileC1DeclarationsReadService } from './profile/profile-c1-declarations-read.service';
// F1 (DECISION-0074): endereço civil PF preferido do Location Core (residência canônica).
// F-GEO-3 (DECISION-0077): city/UF vêm da FK canônica (states/cities); o blob só enriquece city/UF como
// fallback transitório quando a FK ainda não foi enriquecida.
// F-GEO-4c (DECISION-0079): bairro vem de addresses.neighborhood_display_text (texto de exibição controlado);
// blob só fallback enquanto a coluna for NULL. Cleanup total do blob fica para o F-GEO-4d.
import { locationRepository } from './location/location.repository';
// F4 Lifestyle (DECISION-0071): physical_profile.lifestyle vem do SSOT actor-first (lifestyleService), não
// mais do blob legado. Resolve actor user via resolveUserActorId (DECISION-0069). sexualOrientation fora.
import { lifestyleService } from './profile/lifestyle/lifestyle.service';
import { profileEducationService } from './profile/profile-education.service';
import { identityService } from './identity/identity.service';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
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
    referralCode: string | null;
    cpf: string | null;
    birthdate: string | null;
    profile_personal_confirmed: boolean;
    profilePersonalConfirmed: boolean;
    can_edit_personal_data: boolean;
  } | null;
  identity_status: 'COMPLETE' | 'INCOMPLETE';
  professional_profile: {
    skills: any[];
    bio: string | null;
    availability: string | null;
  } | null;
  education_profile: {
    education: any[];
  } | null;
  physical_profile: {
    interests: any[];
    lifestyle: {
      drinks: string | null;
      smokes: string | null;
      relationshipStatus: string | null;
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
    valueCents: string;
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
   * 
   * @param actorId Opcional: se fornecido, busca profile do actor específico (PF/PJ/Group)
   *                 Se não fornecido, usa actor PF do userId (compatibilidade)
   */
  async getCompleteProfile(
    tenantId: string,
    userId: string,
    actorId?: string
  ): Promise<CompleteProfile> {
    // Inicializar estrutura com valores padrão
    const profile: CompleteProfile = {
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
        const { socialPortsRegistry } = await import('@core/social/ports-registry');
        const actorRepository = socialPortsRegistry.getActorRepository();
        let actor;
        if (actorId) {
          actor = await actorRepository.findById(tenantId, actorId);
        } else {
          actor = await ensureUserActor(tenantId, userId);
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
          
          // Bifurcação contextual (DECISION-0043 pendente; princípio 4 DT_PRIORIZATION):
          // campos não aplicáveis por actor_type são comportamento esperado, não gap.
          // Perfis PF-only (personal/professional/physical/learning/health) permanecem
          // null (já inicializados linhas 99-110). Apenas education_profile (event-based
          // por actor) e companies (relacionadas) são populados quando aplicáveis.
          // Resolve DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT: substitui early return
          // rotulado "BLINDAGEM" (commit c4c45ec77) por bifurcação explícita.
          if (actor.actor_type !== 'user') {
            try {
              const { profileEducationService } = await import('./profile/profile-education.service');
              const educationProfile = await profileEducationService.getEducationProfile(tenantId, userId);
              if (educationProfile) {
                profile.education_profile = educationProfile;
              }
            } catch (err) {
              console.error('Erro ao buscar education_profile:', err);
            }
            return profile;
          }
        }
      } catch (err) {
        // Log mas não quebra
        console.error('Erro ao buscar actor:', err);
      }

      // 2. Perfil pessoal básico
      // 🔴 CORREÇÃO CRÍTICA: profiles é SEMPRE a fonte de verdade
      // NUNCA usar identity/global_users como fonte primária ou sobrescrever valores válidos
      
      // 2. Perfil pessoal - Query única com JOIN + geração garantida
      let referralCode: string | null = null;
      let cpf: string | null = null;
      
      try {
        const { pool } = await import('@core/database/pool');
        
        // Query única que busca referral_code e CPF de uma vez
        const identityResult = await pool.query<{
          referral_code: string | null;
          cpf: string | null;
        }>(
          `
          SELECT u.referral_code, up.cpf
          FROM users u
          LEFT JOIN user_profiles up ON up.user_id = u.user_id
          WHERE u.user_id = $1
          LIMIT 1
          `,
          [userId]
        );
        
        const row = identityResult.rows[0];
        if (row) {
          cpf = row.cpf || null;
          referralCode = row.referral_code || null;
          
          // 🔴 GERAÇÃO GARANTIDA: Se não tem código, gerar AGORA
          if (!referralCode) {
            const { referralService } = await import('@core/referral/referral.service');
            const { devLog } = await import('@utils/devLog');
            devLog.info('referral.code.generating', { userId });
            referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
            devLog.success('referral.code.generated', { userId, referralCode });
          }
        }
      } catch (err) {
        const { devLog } = await import('@utils/devLog');
        devLog.error('referral.identity.fetch.error', {
          userId,
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        
        // Fallback: tentar gerar código mesmo em caso de erro na query
        try {
          const { referralService } = await import('@core/referral/referral.service');
          const { devLog } = await import('@utils/devLog');
          referralCode = await referralService.getOrCreateReferralCode(tenantId, userId);
          devLog.success('referral.code.generated.fallback', { userId, referralCode });
        } catch (genErr) {
          const { devLog } = await import('@utils/devLog');
          devLog.error('referral.code.generation.failed', {
            userId,
            error: genErr instanceof Error ? genErr.message : String(genErr),
          });
        }
      }
      
      try {
        // 🔴 CORREÇÃO CRÍTICA: Buscar CPF de user_profiles via JOIN explícito
        // CPF NUNCA vem de profiles.metadata - sempre de user_profiles
        console.error('PARAM_DEBUG', JSON.stringify({ tenantId, userId }));
        const personalProfileRow = await runQueryWithTenant<{
          full_name: string | null;
          phone: string | null;
          metadata: any;
          cpf: string | null;
          birthdate: Date | string | null;
          gender: string | null;
          profile_personal_confirmed: boolean | null;
        }>(
          tenantId,
          `
          SELECT
            p.full_name,
            p.phone,
            p.metadata,
            up.cpf,
            gu.birthdate,
            gu.gender,
            (
              COALESCE(p.is_profile_personal_confirmed, false)
              OR COALESCE((p.metadata->>'profile_personal_confirmed')::boolean, false)
            ) AS profile_personal_confirmed
          FROM profiles p
          LEFT JOIN user_profiles up ON up.user_id = p.user_id
          LEFT JOIN users u ON u.id = p.user_id
          LEFT JOIN global_users gu ON gu.global_user_id = u.global_user_id
          WHERE p.tenant_id = $1 AND p.user_id = $2
          ORDER BY p.updated_at DESC
          LIMIT 1
          `,
          [tenantId, userId]
        );

        console.error('PARAM_DEBUG_RESULT', JSON.stringify(personalProfileRow ?? 'UNDEFINED'));
        if (personalProfileRow) {
          const row = personalProfileRow;
          
          // 🔴 REGRA: CPF SEMPRE vem de user_profiles (fonte única de verdade)
          // Se não encontrou CPF na query acima, usar o que foi buscado anteriormente
          const finalCpf = row.cpf || cpf;
          const profilePersonalConfirmed = row.profile_personal_confirmed === true;
          const birthdate =
            row.birthdate instanceof Date
              ? `${row.birthdate.getUTCFullYear()}-${String(row.birthdate.getUTCMonth() + 1).padStart(2, '0')}-${String(row.birthdate.getUTCDate()).padStart(2, '0')}`
              : typeof row.birthdate === 'string'
                ? row.birthdate.substring(0, 10)
                : null;
          
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
            profilePersonalConfirmed,
            hasAddress: !!row.metadata?.address,
          });
          
          // F2 GENDER (DECISION-0080): gender canônico vem de global_users.gender (Identity SSOT).
          // Espelha no objeto montado (metadata.gender) para os consumidores que leem dali
          // (identity_status, social-targeting demographics) SEM depender do blob. Blob é fallback
          // transitório até o cleanup (F4). Troca de FONTE, não de contrato de saída.
          const baseMetadata = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {};
          const mirroredMetadata = row.gender
            ? { ...baseMetadata, gender: row.gender }
            : baseMetadata;

          profile.personal_profile = {
            // Preservar valores de profiles (null é válido, não fazer fallback)
            fullName: row.full_name ?? null,
            phone: row.phone ?? null,
            // metadata SEMPRE vem de profiles; gender espelhado do Identity SSOT (F2/DECISION-0080)
            // metadata NUNCA contém CPF (regra de negócio)
            metadata: mirroredMetadata,
            referralCode: referralCode,
            cpf: finalCpf, // ← FONTE ÚNICA: user_profiles
            birthdate,
            profile_personal_confirmed: profilePersonalConfirmed,
            profilePersonalConfirmed,
            can_edit_personal_data: !profilePersonalConfirmed,
          };
          
          console.log('[CoreService] ✅ personal_profile montado com CPF de user_profiles:', {
            tenantId,
            userId,
            fullName: profile.personal_profile.fullName,
            phone: profile.personal_profile.phone,
            hasMetadata: !!profile.personal_profile.metadata,
            metadataKeys: Object.keys(profile.personal_profile.metadata || {}),
            cpf: profile.personal_profile.cpf ? profile.personal_profile.cpf.substring(0, 3) + '***' : null,
            profilePersonalConfirmed: profile.personal_profile.profilePersonalConfirmed,
            cpfSource: 'user_profiles',
          });
        } else {
          // Se não existe profile, criar estrutura mínima com referralCode
          console.log('[CoreService] ⚠️ personal_profile não encontrado em profiles (criando estrutura mínima)');
          profile.personal_profile = {
            fullName: null,
            phone: null,
            metadata: {},
            referralCode: referralCode,
            cpf: cpf, // ← FONTE ÚNICA: user_profiles (buscado anteriormente)
            birthdate: null,
            profile_personal_confirmed: false,
            profilePersonalConfirmed: false,
            can_edit_personal_data: true,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar perfil pessoal:', err);
        // Em caso de erro, criar estrutura mínima com referralCode
        profile.personal_profile = {
          fullName: null,
          phone: null,
          metadata: {},
          referralCode: referralCode,
          cpf: cpf, // ← FONTE ÚNICA: user_profiles (buscado anteriormente)
          birthdate: null,
          profile_personal_confirmed: false,
          profilePersonalConfirmed: false,
          can_edit_personal_data: true,
        };
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
            bio: professionalProfile.bio || null,
            availability: professionalProfile.availability ? JSON.stringify(professionalProfile.availability) : null,
          };
        }
      } catch (err) {
        console.error('Erro ao buscar perfil profissional:', err);
      }

      // 3.5. Perfil educacional (DOMÍNIO SEPARADO DO PROFISSIONAL)
      try {
        const educationProfile = await profileEducationService.getEducationProfile(
          tenantId,
          userId
        );
        if (educationProfile) {
          profile.education_profile = {
            education: educationProfile.education || [],
          };
        }
      } catch (err) {
        console.error('Erro ao buscar perfil educacional:', err);
      }

      // 4. Perfil físico/interesses
      try {
        const physicalProfile = await profilePhysicalService.getPhysicalProfile(
          tenantId,
          userId
        );
        // Interesses vêm do C1 actor-first/concept-first (DECISION-0069/F4), NÃO do físico legado (que
        // retorna []). Lifestyle/Health permanecem no fluxo legado (getPhysicalProfile), intocados. Sem
        // actor / sem declaração ⇒ [] controlado; ambiguidade de actor é tratada pelo catch resiliente
        // desta seção (contrato: getCompleteProfile NUNCA lança — degrada por seção e registra).
        const interestC1 = await profileC1DeclarationsReadService.getUserInterestDeclarationsForProfile(
          tenantId,
          userId
        );
        const c1Interests = interestC1.interests.map((i) => ({
          conceptId: i.conceptId, // identidade semântica (Lei 7)
          categoryId: i.sourceCategoryId ?? '', // breadcrumb/backcompat (NUNCA identidade)
          categoryName: i.categoryName ?? '',
          categoryPath: i.categoryPath ?? [],
        }));

        // Lifestyle do SSOT actor-first (DECISION-0071/F4), NÃO mais do blob. Resolve actor 'user'; sem
        // actor → vazio controlado. sexualOrientation NÃO existe no SSOT. visibility private (self).
        const lifestyleActorId = await profileC1DeclarationsReadService.resolveUserActorId(tenantId, userId);
        const lifestyleOut: { drinks: string | null; smokes: string | null; relationshipStatus: string | null } = {
          drinks: null,
          smokes: null,
          relationshipStatus: null,
        };
        if (lifestyleActorId) {
          const ls = await lifestyleService.getLifestyle(tenantId, lifestyleActorId);
          for (const a of ls.attributes) {
            if (!a.isActive) continue;
            if (a.attributeKey === 'relationship_status') lifestyleOut.relationshipStatus = a.attributeValue;
            else if (a.attributeKey === 'drinks') lifestyleOut.drinks = a.attributeValue;
            else if (a.attributeKey === 'smokes') lifestyleOut.smokes = a.attributeValue;
          }
        }

        if (physicalProfile) {
          // Extrair dados de saúde compartilhados (altura, peso, peso ideal) se existirem
          const sharedHealthData = physicalProfile.metadata?.sharedHealthData;

          profile.physical_profile = {
            interests: c1Interests,
            lifestyle: lifestyleOut,
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

        // F1 (DECISION-0074): PREFERIR o Location Core (residência canônica PF) quando houver assignment
        // profile/RESIDENCE vigente. Transição: city/state/neighborhood não vivem no Location Core (Opção A),
        // então são enriquecidos do blob preservado APENAS para evitar regressão de exibição (sai no F4).
        // Fallback ao blob inteiro quando não há residência canônica.
        let residenceFromLocationCore = false;
        try {
          const resActorId = await profileC1DeclarationsReadService.resolveUserActorId(tenantId, userId);
          if (resActorId) {
            // F-GEO-3: lê a residência com city/UF resolvidos por FK canônica (states/cities).
            const canonical = await locationRepository.findPrimaryResidenceGeoByOwner('profile', resActorId, 'RESIDENCE');
            if (canonical) {
              const blob = (addressInDb && typeof addressInDb === 'object') ? addressInDb : {};
              // F-GEO-3: city/UF vêm da FK canônica quando enriquecidas; o blob só entra como fallback
              // transitório enquanto a FK ainda for NULL (endereço CEP-âncora sem enriquecimento) — evita
              // regressão de exibição até o cleanup (F4). Quando a FK existe, o blob NÃO é usado p/ city/UF.
              const cityCanonical = canonical.cityName;       // cities.name
              const stateCanonical = canonical.stateAbbreviation; // states.abbreviation (ex.: 'PR')
              // F-GEO-4c: bairro vem do Location Core (addresses.neighborhood_display_text, texto de exibição
              // controlado — DECISION-0079). O blob só entra como fallback transitório quando a coluna ainda é
              // NULL (registros não migrados pela F-GEO-4b) — sai no F-GEO-4d (cleanup do blob).
              const neighborhoodCanonical = canonical.neighborhoodDisplayText; // addresses.neighborhood_display_text
              profile.addresses = [{
                address_id: canonical.addressId,
                cep: canonical.postalCode || null,
                address: canonical.street || null,
                address_number: canonical.number || null,
                complement: canonical.complement || null,
                neighborhood: neighborhoodCanonical || blob.neighborhood || null,
                city: cityCanonical || blob.city || null,
                state: stateCanonical || blob.state || null,
                country: 'BR',
                is_primary: true,
              }];
              residenceFromLocationCore = true;
            }
          }
        } catch (e) {
          console.warn('[CoreService] Location Core residence read falhou; fallback ao blob:', e instanceof Error ? e.message : String(e));
        }

        if (!residenceFromLocationCore && addressInDb && typeof addressInDb === 'object' && Object.keys(addressInDb).length > 0) {
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
            SELECT
              a.postal_code AS cep,
              a.street AS address,
              a.number AS address_number,
              a.complement AS complement,
              NULL::text AS neighborhood,
              NULL::text AS city,
              NULL::text AS state,
              'BR'::text AS country,
              a.address_id AS canonical_address_id
            FROM companies c
            INNER JOIN company_users cu ON c.company_id = cu.company_id
            INNER JOIN users u ON cu.global_user_id = u.global_user_id
            LEFT JOIN addresses a ON c.primary_address_id = a.address_id
            WHERE u.user_id = $1 AND u.tenant_id = $2 AND c.status = 'active' AND a.address_id IS NOT NULL
            ORDER BY c.created_at DESC
            LIMIT 1
            `,
            [userId, tenantId]
          );
          if (companyAddress) {
            profile.addresses = [{
              address_id: companyAddress.canonical_address_id || 'company',
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
            valueCents: profile.personal_profile.phone,
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
            valueCents: userEmail.email,
            is_primary: false,
          });
        }
        profile.contacts = contacts;
      } catch (err) {
        console.error('Erro ao buscar contatos:', err);
        // Manter array vazio
      }

      // 7. Interesses (do physical_profile já buscado — agora C1 concept-first, F4)
      // Interesses já vêm no physical_profile.interests, não precisa buscar separado. interest_id usa o
      // conceptId (identidade C1); name usa o categoryName (breadcrumb). Fallbacks legados preservados.
      if (profile.physical_profile?.interests) {
        profile.interests = profile.physical_profile.interests.map((interest: any) => ({
          interest_id: interest.conceptId || interest.interest_id || interest.id || '',
          name: interest.categoryName || interest.name || interest.label || '',
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
          INNER JOIN users u ON cu.global_user_id = u.global_user_id
          WHERE u.user_id = $1 AND u.tenant_id = $2
          ORDER BY c.created_at DESC
          `,
          [userId, tenantId]
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

      // 🔴 IDENTITY STATUS: Calcular estado civil do usuário
      // COMPLETE se todos os dados civis imutáveis estão presentes
      const hasFullName = !!(profile.personal_profile?.fullName && profile.personal_profile.fullName.trim().length > 0);
      const hasCpf = !!(profile.personal_profile?.cpf && profile.personal_profile.cpf.trim().length > 0);

      // Buscar birthdate de identity (global_users)
      let hasBirthdate = false;
      try {
        const identityData = await identityService.getIdentityProfile(userId, tenantId);
        hasBirthdate = !!(identityData?.global?.birthdate);
      } catch (err) {
        console.warn('Erro ao buscar birthdate para identity_status:', err);
      }

      // F2 GENDER (DECISION-0080): gender vem do espelho canônico (global_users.gender → metadata.gender).
      // Enum canônico male|female|other (reconcilia a inconsistência que antes honrava só male/female).
      const gender = profile.personal_profile?.metadata?.gender;
      const hasGender = !!(gender && (gender === 'male' || gender === 'female' || gender === 'other'));

      // INSTRUMENTAÇÃO: Logar antes de calcular identity_status
      console.error('[IDENTITY_STATUS_DEBUG]', JSON.stringify({
        fullName: profile.personal_profile?.fullName,
        cpf: profile.personal_profile?.cpf,
        metadataGender: profile.personal_profile?.metadata?.gender,
        hasFullName,
        hasCpf,
        hasGender
      }));

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
    } catch (error) {
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
  async calculateProfileProgress(
    tenantId: string,
    userId: string
  ): Promise<{
    progress: number;
    maxProgressWithoutValidation: number;
    hasPresentialValidation: boolean;
    breakdown: {
      personalData: number;
      professionalProfile: number;
      physicalProfile: number;
      learningProfile: number;
      companies: number;
      presentialValidation: number;
    };
    messages: string[];
  }> {
    const completeProfile = await this.getCompleteProfile(tenantId, userId);
    
    // 1. Dados pessoais básicos (25% do total)
    let personalDataScore = 0;
    const personalMax = 25;
    if (completeProfile.personal_profile?.fullName) personalDataScore += 5;
    if (completeProfile.personal_profile?.cpf) personalDataScore += 5;
    if (completeProfile.personal_profile?.phone) personalDataScore += 5;
    
    // 🔴 CORREÇÃO: Envolver getIdentityProfile em try/catch para tratar quando global_user não existe
    let globalUser = null;
    try {
      globalUser = await identityService.getIdentityProfile(userId, tenantId);
    } catch (err) {
      // global_user não existe - considerar null e continuar cálculo
      // Não lançar exception - progresso pode ser calculado sem birthdate
    }
    
    if (globalUser?.global?.birthdate) personalDataScore += 5;
    if (completeProfile.personal_profile?.metadata?.gender) personalDataScore += 5;
    const personalData = Math.min(personalDataScore, personalMax);

    // 2. Perfil profissional (20% do total)
    let professionalScore = 0;
    const professionalMax = 20;
    if (completeProfile.professional_profile?.skills && completeProfile.professional_profile.skills.length > 0) {
      professionalScore += 10;
    }
    if (completeProfile.professional_profile?.bio) professionalScore += 10;
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
      // Completude conta presença de atributo Lifestyle ATIVO do SSOT (F4); sexualOrientation NÃO conta mais.
      const lifestyle = completeProfile.physical_profile.lifestyle;
      if (lifestyle.drinks || lifestyle.smokes || lifestyle.relationshipStatus) {
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
      const { pool } = await import('@core/database/pool');
      if (globalUser?.global?.globalUserId) {
        const validationResult = await pool.query<{ count: string }>(
          `
          SELECT COUNT(*) as count
          FROM companies c
          JOIN company_validations cv ON cv.company_id = c.company_id
          WHERE c.global_user_id = $1
            AND cv.validation_method = 'in_person'
            AND cv.status = 'approved'
          `,
          [globalUser.global.globalUserId]
        );
        
        const validationCount = parseInt(validationResult.rows[0]?.count || '0', 10);
        if (validationCount > 0) {
          presentialValidation = presentialMax;
          hasPresentialValidation = true;
        }
      }
    } catch (err) {
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
    const messages: string[] = [];
    if (progress < 50) {
      messages.push('Complete seu perfil para acessar todos os recursos');
    } else if (progress < 80) {
      messages.push('Continue preenchendo seu perfil para desbloquear mais funcionalidades');
    } else if (progress < 100) {
      messages.push('Para chegar a 100%, valide presencialmente em uma loja parceira');
    } else {
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

export const coreService = new CoreService();
