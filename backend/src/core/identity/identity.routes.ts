// src/core/identity/identity.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { identityService } from './identity.service';
import { reputationService } from '@core/reputation/reputation.service';
import { residenceService } from '@core/residence/residence.service';
import residenceRoutes from '@core/residence/residence.routes';
import { NotFoundError } from '@core/errors';
import { accountService } from '@core/economy/account.service';
import { transactionService } from '@core/economy/transaction.service';
import { updateGlobalIdentitySchema } from './identity.schemas';
import type { IdentityProfile } from './identity.types';

const identityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /identity/me
   * Retorna perfil completo (global + local) do usuário autenticado
   */
  fastify.get('/me', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ ok: false, message: 'Tenant não encontrado' });
    }

    try {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const actorId = req.actionContext.actorId;

      // 🔴 CORREÇÃO CRÍTICA: Buscar perfil - se não existir, retornar estrutura parcial
      // NUNCA criar global_user em fluxo de GET, mas também NÃO retornar 500
      // Retornar estrutura mínima para permitir primeiro acesso
      // 🔴 CORREÇÃO DEFINITIVA: Se getIdentityProfile falhar, tentar buscar dados do cadastro
      // Usar actorId do ActionContext (V2)
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(req.tenant.id, actorId);
      if (!actor || !actor.user_id) {
        return reply.status(404).send({ ok: false, message: 'Actor não encontrado ou não é do tipo user' });
      }
      const userId = actor.user_id;
      
      let profile: IdentityProfile | null = null;
      try {
        profile = await identityService.getIdentityProfile(userId, req.tenant.id);
      } catch (error) {
        // 🔴 CORREÇÃO: Se identity não existe ainda (primeiro acesso), retornar estrutura parcial
        // Isso permite que o frontend funcione mesmo sem global_user criado
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isGlobalUserNotFound = errorMessage.includes('Global user não encontrado') || 
                                     errorMessage.includes('não encontrado') ||
                                     errorMessage.includes('not found') ||
                                     errorMessage.includes('resolveGlobalUserId');
        
        if (isGlobalUserNotFound) {
          // 🔴 PRIMEIRO ACESSO: Tentar buscar dados do cadastro antes de retornar estrutura mínima
          fastify.log.info({
            userId,
            tenantId: req.tenant.id,
            message: 'Global user não encontrado - tentando buscar dados do cadastro',
          }, 'Primeiro acesso detectado');
          
          // Buscar dados locais e tentar buscar global_user diretamente
          const { runQueryWithTenant } = await import('@core/database/pool');
          const { pool } = await import('@core/database/pool');
          
          const localUser = await runQueryWithTenant<{
            id: string;
            tenant_id: string;
            email: string;
            created_at: Date;
            global_user_id: string | null;
          }>(
            req.tenant.id,
            `SELECT id, tenant_id, email, created_at, global_user_id FROM users WHERE id = $1 LIMIT 1`,
            [userId]
          );
          
          if (!localUser) {
            return reply.status(404).send({ 
              ok: false,
              message: 'Usuário não encontrado',
            });
          }
          
          // 🔴 CORREÇÃO: Se global_user_id existe em users, tentar buscar dados do global_user
          let globalUserData: any = null;
          if (localUser.global_user_id) {
            try {
              const globalUserResult = await pool.query<{
                global_user_id: string;
                full_name: string | null;
                birthdate: Date | null;
                avatar_url: string | null;
                gender: string | null;
                metadata: any;
                gu_created_at: Date;
                gu_updated_at: Date;
              }>(
                `SELECT global_user_id, full_name, birthdate, avatar_url, gender, metadata,
                        created_at AS gu_created_at, updated_at AS gu_updated_at
                 FROM global_users
                 WHERE global_user_id = $1
                 LIMIT 1`,
                [localUser.global_user_id]
              );
              
              if (globalUserResult.rows.length > 0) {
                globalUserData = globalUserResult.rows[0];
                fastify.log.info({
                  userId,
                  globalUserId: localUser.global_user_id,
                  hasFullName: !!globalUserData.full_name,
                  hasBirthdate: !!globalUserData.birthdate,
                }, 'Dados do cadastro encontrados no global_user');
              }
            } catch (globalError) {
              fastify.log.warn({ err: globalError }, 'Erro ao buscar global_user (não crítico)');
            }
          }
          
          // Retornar estrutura com dados do cadastro se disponíveis
          profile = {
            global: {
              globalUserId: globalUserData?.global_user_id || localUser.global_user_id || '',
              fullName: globalUserData?.full_name || null,
              birthdate: globalUserData?.birthdate || null,
              avatarUrl: globalUserData?.avatar_url || null,
              gender: globalUserData?.gender ?? null, // F2 GENDER (DECISION-0080)
              metadata: globalUserData?.metadata || {},
              createdAt: globalUserData?.gu_created_at != null ? (typeof globalUserData.gu_created_at === 'string' ? globalUserData.gu_created_at : (globalUserData.gu_created_at as Date).toISOString()) : (typeof localUser.created_at === 'string' ? localUser.created_at : (localUser.created_at as Date).toISOString()),
              updatedAt: globalUserData?.gu_updated_at != null ? (typeof globalUserData.gu_updated_at === 'string' ? globalUserData.gu_updated_at : (globalUserData.gu_updated_at as Date).toISOString()) : (typeof localUser.created_at === 'string' ? localUser.created_at : (localUser.created_at as Date).toISOString()),
            },
            local: {
              userId: localUser.id,
              tenantId: localUser.tenant_id,
              email: localUser.email,
              createdAt: localUser.created_at instanceof Date ? localUser.created_at.toISOString() : String(localUser.created_at),
            },
            reputation: undefined,
            wallet: undefined,
            residence: undefined,
          };
        } else {
          // Para outros erros, logar e retornar 500
          console.error('[IdentityService] ❌ ERRO CRÍTICO:', {
            userId,
            tenantId: req.tenant.id,
            error: errorMessage,
          });
          fastify.log.error({ err: error }, 'Erro ao buscar perfil');
          return reply.status(500).send({ 
            ok: false,
            message: 'Erro ao buscar perfil',
            error: errorMessage,
          });
        }
      }

      // 🔴 CRÍTICO: Serializar birthdate como string YYYY-MM-DD para evitar problemas de timezone
      // IMPORTANTE: Usar UTC para garantir que a data não mude de dia
      let serializedBirthdate: string | null = null;
      if (profile.global.birthdate) {
        // Garantir que seja Date
        const date = profile.global.birthdate instanceof Date 
          ? profile.global.birthdate 
          : new Date(profile.global.birthdate);
        
        // Usar UTC para extrair ano, mês e dia (evita problemas de timezone)
        serializedBirthdate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      }
      
      // 🔴 FONTE ÚNICA DE VERDADE: Buscar profile_personal_confirmed do profile
      // 🔴 CORREÇÃO CRÍTICA: Sempre buscar profile, mesmo que não exista (criar se necessário)
      const { profileService } = await import('@core/profile/profile.service');
      // F-C1-AUTO-REACHABLE-READ-PURITY: LEITURA PURA — NÃO cria profile no GET
      // (sem createProfileIfNotExists). Profile ausente = ausência honesta; os defaults abaixo
      // (profilePersonalConfirmed=false / canEditPersonalData=true) representam o primeiro acesso
      // sem materializar linha. A criação é writer explícito (PUT /profile), nunca este GET.
      const userProfile = await profileService.getProfile(req.tenant.id, userId);
      
      // 🔴 FONTE ÚNICA DE VERDADE: profile_personal_confirmed controla modal e cadeado
      // false → modal aparece, campos editáveis (primeiro acesso)
      // true → modal não aparece, campos bloqueados (já confirmado)
      // Se não tem profile, assume false (primeiro acesso - modal aparece)
      const profilePersonalConfirmed = userProfile ? userProfile.profilePersonalConfirmed : false;
      const canEditPersonalData = userProfile ? userProfile.canEditPersonalData : true;
      
      // F2 GENDER (DECISION-0080): gender canônico vem de global_users.gender (profile.global.gender).
      // Espelha no metadata exposto ao frontend (que ainda espera metadata.gender), SEM depender do blob —
      // novos usuários não têm gender no blob. Blob é fallback transitório até o cleanup (F4).
      const canonicalGender = (profile as any)?.global?.gender ?? null;
      const baseProfileMetadata = userProfile?.metadata || {};
      const profileMetadata = canonicalGender
        ? { ...baseProfileMetadata, gender: canonicalGender }
        : baseProfileMetadata;
      
      const serializedProfile = {
        ...profile,
        global: {
          ...profile.global,
          birthdate: serializedBirthdate,
        },
        // 🔴 CORREÇÃO: Incluir profile completo para frontend ter acesso a metadata.gender
        profile: userProfile ? {
          profileId: userProfile.profileId,
          tenantId: userProfile.tenantId,
          userId: userProfile.userId,
          fullName: userProfile.fullName,
          phone: userProfile.phone,
          metadata: profileMetadata, // Incluir metadata com gender
          createdAt: userProfile.createdAt,
          updatedAt: userProfile.updatedAt,
          profile_personal_confirmed: userProfile.profilePersonalConfirmed,
          can_edit_personal_data: userProfile.canEditPersonalData,
        } : null,
        // 🔴 FONTE ÚNICA DE VERDADE: profile_personal_confirmed controla modal e cadeado
        profile_personal_confirmed: profilePersonalConfirmed,
        can_edit_personal_data: canEditPersonalData,
      };

      return reply.send({ ok: true, data: serializedProfile });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar perfil');
      return reply.status(500).send({ 
        ok: false, 
        message: 'Erro ao buscar perfil',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /identity/update
   * Atualiza dados da identidade global do usuário autenticado
   */
  fastify.post<{
    Body: {
      fullName?: string | null;
      avatarUrl?: string | null;
      birthdate?: string | null;
      metadata?: Record<string, any>;
    };
  }>(
    '/update',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            fullName: { type: ['string', 'null'] },
            avatarUrl: { type: ['string', 'null'] },
            birthdate: { type: ['string', 'null'] },
            metadata: { type: 'object' },
          },
        },
      },
      preHandler: async (request, reply) => {
        // 🔴 CORREÇÃO DEFINITIVA: Interceptar e normalizar birthdate ANTES do handler principal
        // REGRA DE OURO: Aceitar APENAS string YYYY-MM-DD. Rejeitar Date, string de Date, etc.
        if (request.body && typeof request.body === 'object' && 'birthdate' in request.body) {
          const body = request.body as any;
          if (body.birthdate !== null && body.birthdate !== undefined && body.birthdate !== '') {
            let normalized: string | null = null;
            
            // Se for Date, converter para YYYY-MM-DD usando UTC
            if (body.birthdate instanceof Date) {
              fastify.log.error({
                birthdate: body.birthdate,
                birthdateType: typeof body.birthdate,
                birthdateString: body.birthdate.toString(),
              }, '❌ [preHandler] ERRO CRÍTICO: birthdate chegou como Date! Normalizando...');
              const year = body.birthdate.getUTCFullYear();
              const month = String(body.birthdate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(body.birthdate.getUTCDate()).padStart(2, '0');
              normalized = `${year}-${month}-${day}`;
              fastify.log.info({
                normalized,
              }, '✅ [preHandler] birthdate Date convertido para YYYY-MM-DD');
            }
            // Se for string
            else if (typeof body.birthdate === 'string') {
              const str = body.birthdate.trim();
              
              // Se já está no formato YYYY-MM-DD, usar diretamente
              if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
                normalized = str;
              }
              // Se parece ser string de Date (GMT ou dia da semana), converter
              else if (str.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/) || str.includes('GMT')) {
                fastify.log.error({
                  birthdate: str,
                }, '❌ [preHandler] ERRO CRÍTICO: birthdate é string de Date! Normalizando...');
                try {
                  const date = new Date(str);
                  if (!isNaN(date.getTime())) {
                    const year = date.getUTCFullYear();
                    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(date.getUTCDate()).padStart(2, '0');
                    normalized = `${year}-${month}-${day}`;
                    fastify.log.info({
                      original: str,
                      normalized,
                    }, '✅ [preHandler] birthdate string de Date convertida para YYYY-MM-DD');
                  } else {
                    fastify.log.error({
                      birthdate: str,
                    }, '❌ [preHandler] Data inválida após conversão');
                    normalized = null;
                  }
                } catch (e) {
                  fastify.log.error({
                    error: e,
                    birthdate: str,
                  }, '❌ [preHandler] Erro ao converter string de Date');
                  normalized = null;
                }
              }
              // Se contém T (ISO), extrair YYYY-MM-DD
              else if (str.includes('T')) {
                const match = str.match(/(\d{4})-(\d{2})-(\d{2})/);
                if (match) {
                  normalized = match[0];
                }
              }
              // Formato inválido
              else {
                fastify.log.error({
                  birthdate: str,
                }, '❌ [preHandler] Formato de birthdate inválido');
                normalized = null;
              }
            }
            
            // Atualizar body com valor normalizado
            if (normalized && normalized.match(/^\d{4}-\d{2}-\d{2}$/)) {
              body.birthdate = normalized;
            } else {
              body.birthdate = null;
            }
          }
        }
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        // ActionContext é obrigatório (V2)
        if (!req.actionContext || !req.actionContext.actorId) {
          return reply.status(400).send({ error: 'ActionContext obrigatório' });
        }

        const actorId = req.actionContext.actorId;

        // 🔴 REGRA CRÍTICA: Buscar perfil - se não existir, lançar erro explícito
        // Usar actorId do ActionContext (V2)
        const { socialPortsRegistry } = await import('@core/social/ports-registry');
        const actorRepository = socialPortsRegistry.getActorRepository();
        const actor = await actorRepository.findById(req.tenant.id, actorId);
        if (!actor || !actor.user_id) {
          throw new NotFoundError('Actor não encontrado ou não é do tipo user');
        }
        const userId = actor.user_id;
        // NUNCA criar global_user em fluxo de update
        let profile: IdentityProfile;
        try {
          profile = await identityService.getIdentityProfile(userId, req.tenant.id);
        } catch (error) {
          console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado para user_id', userId, {
            tenantId: req.tenant.id,
            error: error instanceof Error ? error.message : String(error),
            message: 'Não foi possível buscar perfil. NÃO criando novo global_user em fluxo de update.',
            hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
          });
          fastify.log.error({ err: error }, 'Erro ao buscar perfil - NÃO criando novo global_user');
          return reply.status(500).send({ 
            error: 'Erro ao buscar perfil',
            message: error instanceof Error ? error.message : String(error),
            hint: 'Global user não encontrado. Execute diagnóstico SQL para investigar múltiplos global_users.'
          });
        }

        // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
        fastify.log.info({
          pid: process.pid,
          route: '/identity/update',
          method: 'POST',
          userId: userId,
          tenantId: req.tenant.id,
          globalUserId: profile.global.globalUserId,
        }, '[RUNTIME] POST /identity/update');
        
        // Log do global_user_id que será usado
        fastify.log.info({
          pid: process.pid,
          userId: userId,
          globalUserId: profile.global.globalUserId,
          profileExists: !!profile,
          currentFullName: profile.global.fullName,
          currentBirthdate: profile.global.birthdate,
        }, '🔍 DIAGNÓSTICO: GlobalUserId resolvido para UPDATE');

        // 🔴 CRÍTICO: Log do payload recebido ANTES da validação
        // Log detalhado para diagnóstico do problema de conversão
        const rawBody = JSON.stringify(req.body);
        fastify.log.info({
          body: req.body,
          rawBodyString: rawBody,
          bodyKeys: Object.keys(req.body || {}),
          fullName: req.body?.fullName,
          birthdate: req.body?.birthdate,
          fullNameType: typeof req.body?.fullName,
          birthdateType: typeof req.body?.birthdate,
          birthdateIsDate: (() => {
            const bd = req.body?.birthdate;
            return bd != null && typeof bd === 'object' && (bd as any)?.constructor === Date;
          })(),
          birthdateString: req.body?.birthdate != null ? String(req.body.birthdate) : null,
          birthdateConstructor: req.body?.birthdate != null ? (req.body.birthdate as any)?.constructor?.name : null,
        }, '🔍 DIAGNÓSTICO: Payload recebido do frontend (APÓS preHandler)');
        
        // 🔴 CRÍTICO: Normalizar birthdate ANTES de qualquer validação
        // Fastify pode estar convertendo string para Date automaticamente via JSON.parse
        // Ou algum middleware pode estar fazendo conversão automática
        if (req.body?.birthdate !== null && req.body?.birthdate !== undefined && req.body?.birthdate !== '') {
          let birthdateValue: string;
          
          // Se for objeto Date, converter para YYYY-MM-DD imediatamente
          const birthdateObj = req.body.birthdate;
          if (birthdateObj != null && typeof birthdateObj === 'object' && (birthdateObj as any)?.constructor === Date) {
            const birthdate = birthdateObj as Date;
            fastify.log.warn({
              birthdate: birthdate,
              birthdateType: typeof birthdate,
              birthdateString: birthdate.toString(),
            }, '⚠️ birthdate chegou como objeto Date (possível conversão automática), normalizando...');
            // Converter Date para YYYY-MM-DD usando UTC
            const year = birthdate.getUTCFullYear();
            const month = String(birthdate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(birthdate.getUTCDate()).padStart(2, '0');
            birthdateValue = `${year}-${month}-${day}`;
            // Atualizar req.body para usar o valor normalizado
            req.body.birthdate = birthdateValue;
            fastify.log.info({
              normalized: birthdateValue,
            }, '✅ birthdate normalizado de Date para string YYYY-MM-DD');
          } else {
            birthdateValue = String(req.body.birthdate).trim();
          }
          
          // Se birthdate contém letras, é definitivamente um erro
          if (birthdateValue.match(/[a-zA-Z]/)) {
            fastify.log.error({
              birthdate: req.body.birthdate,
              birthdateValue,
              fullName: req.body?.fullName,
              birthdateType: typeof req.body.birthdate,
              isDate: (() => {
                const bd = req.body.birthdate;
                return bd != null && typeof bd === 'object' && (bd as any)?.constructor === Date;
              })(),
            }, '❌ ERRO CRÍTICO: birthdate contém letras - provavelmente é um nome!');
            return reply.status(400).send({ 
              error: `Valor inválido para data de nascimento: "${birthdateValue}". O campo data de nascimento não pode conter letras. Verifique se os campos não estão trocados.` 
            });
          }
          
          // Se não está no formato YYYY-MM-DD, rejeitar
          if (birthdateValue && !birthdateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
            fastify.log.error({
              birthdate: req.body.birthdate,
              birthdateValue,
              fullName: req.body?.fullName,
              format: 'Esperado: YYYY-MM-DD',
            }, '❌ ERRO: birthdate não está no formato YYYY-MM-DD');
            return reply.status(400).send({ 
              error: `Formato de data inválido: "${birthdateValue}". Use o formato YYYY-MM-DD (ex: 1990-01-15).` 
            });
          }
          
          // Garantir que req.body.birthdate seja a string normalizada
          req.body.birthdate = birthdateValue;
        }

        // Validar input
        let validated;
        try {
          validated = updateGlobalIdentitySchema.parse(req.body);
        } catch (zodError: any) {
          fastify.log.error({
            zodError,
            body: req.body,
          }, '❌ Erro de validação Zod');
          return reply.status(400).send({ 
            error: 'Dados inválidos',
            details: zodError.errors || zodError.message
          });
        }

        // 🔴 CRÍTICO: Log do payload VALIDADO
        fastify.log.info({
          validated,
          validatedKeys: Object.keys(validated),
          fullName: validated.fullName,
          birthdate: validated.birthdate,
          fullNameType: typeof validated.fullName,
          birthdateType: typeof validated.birthdate,
        }, '🔍 DIAGNÓSTICO: Payload após validação Zod');

        // Converter birthdate string para Date se fornecido
        // 🔴 CRÍTICO: Usar apenas a parte da data (YYYY-MM-DD) para evitar problemas de timezone
        const updates: any = { ...validated };
        if (validated.birthdate) {
          // Validar formato YYYY-MM-DD
          const dateMatch = validated.birthdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dateMatch) {
            return reply.status(400).send({ error: 'Formato de data inválido. Use YYYY-MM-DD' });
          }
          
          // Criar Date usando UTC para evitar problemas de timezone
          // Isso garante que a data seja interpretada corretamente independente do timezone do servidor
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months são 0-indexed
          const day = parseInt(dateMatch[3], 10);
          
          // Validar se a data é válida
          const date = new Date(Date.UTC(year, month, day));
          if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
            return reply.status(400).send({ error: 'Data de nascimento inválida' });
          }
          
          updates.birthdate = date;
        }

        // 🔴 DIAGNÓSTICO: Log antes de atualizar
        fastify.log.info({
          globalUserId: profile.global.globalUserId,
          updates,
          birthdateType: typeof updates.birthdate,
          birthdateValue: updates.birthdate,
        }, 'Atualizando identidade global');

        // Atualizar identidade global
        fastify.log.info({
          globalUserId: profile.global.globalUserId,
          updatesToApply: Object.keys(updates),
        }, '🔍 DIAGNÓSTICO: Iniciando UPDATE');

        const updated = await identityService.updateGlobalIdentity(
          req.tenant.id,
          profile.global.globalUserId,
          updates
        );

        // 🔴 DIAGNÓSTICO: Log após atualizar
        fastify.log.info({
          updated,
          birthdateAfter: updated.birthdate,
          birthdateType: typeof updated.birthdate,
          globalUserId: updated.globalUserId,
        }, '✅ Identidade global atualizada com sucesso');

        // 🔧 FIX (onboarding only after first successful save): Onboarding é setado automaticamente em upsertProfile
        // Não precisa chamar completeOnboarding manualmente aqui
        // O upsertProfile já verifica se dados obrigatórios existem e seta onboarding_completed automaticamente

        // 🔴 CRÍTICO: Serializar birthdate como string YYYY-MM-DD para evitar problemas de timezone
        // IMPORTANTE: Usar UTC para garantir que a data não mude de dia
        let serializedBirthdate: string | null = null;
        if (updated.birthdate) {
          // Garantir que seja Date
          const date = updated.birthdate instanceof Date 
            ? updated.birthdate 
            : new Date(updated.birthdate);
          
          // Usar UTC para extrair ano, mês e dia (evita problemas de timezone)
          serializedBirthdate = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        }
        
        // 🔴 CRÍTICO: Formatar resposta no formato exato esperado pelo frontend
        // O frontend espera IdentityProfile['global'] que tem:
        // - globalUserId, fullName, avatarUrl, birthdate (string), metadata, createdAt, updatedAt
        const response = {
          globalUserId: updated.globalUserId,
          fullName: updated.fullName,
          avatarUrl: updated.avatarUrl,
          birthdate: serializedBirthdate, // String YYYY-MM-DD
          metadata: updated.metadata || {},
          createdAt: (updated.createdAt as unknown) instanceof Date ? (updated.createdAt as unknown as Date).toISOString() : String(updated.createdAt),
          updatedAt: (updated.updatedAt as unknown) instanceof Date ? (updated.updatedAt as unknown as Date).toISOString() : String(updated.updatedAt),
        };

        // 🔴 DIAGNÓSTICO: Log resposta final
        fastify.log.info({
          response,
          serializedBirthdate: response.birthdate,
          responseKeys: Object.keys(response),
        }, 'Resposta serializada');

        // 🔴 CRÍTICO: Retornar no formato esperado pelo frontend
        // 🔴 VERIFICAÇÃO FINAL: Buscar novamente do banco para garantir que foi salvo
        const verifyAfterSave = await identityService.getGlobalIdentity(profile.global.globalUserId);
        fastify.log.info({
          globalUserId: profile.global.globalUserId,
          verifyAfterSave: verifyAfterSave ? {
            fullName: verifyAfterSave.fullName,
            birthdate: verifyAfterSave.birthdate,
            birthdateType: typeof verifyAfterSave.birthdate,
          } : null,
          responseSent: {
            fullName: response.fullName,
            birthdate: response.birthdate,
          },
          match: verifyAfterSave ? (
            verifyAfterSave.fullName === response.fullName &&
            (verifyAfterSave.birthdate ? (verifyAfterSave.birthdate instanceof Date ? verifyAfterSave.birthdate.toISOString().substring(0, 10) : String(verifyAfterSave.birthdate).substring(0, 10)) : null) === response.birthdate
          ) : false,
        }, '🔍 VERIFICAÇÃO FINAL: Dados após salvar vs dados enviados na resposta');
        
        // 🔴 CRÍTICO: Se os dados não correspondem, lançar erro
        if (verifyAfterSave && (
          verifyAfterSave.fullName !== response.fullName ||
          (verifyAfterSave.birthdate ? (verifyAfterSave.birthdate instanceof Date ? verifyAfterSave.birthdate.toISOString().substring(0, 10) : String(verifyAfterSave.birthdate).substring(0, 10)) : null) !== response.birthdate
        )) {
          fastify.log.error({
            globalUserId: profile.global.globalUserId,
            verifyAfterSave,
            responseSent: response,
          }, '❌ ERRO CRÍTICO: Dados verificados NÃO correspondem à resposta enviada!');
          return reply.status(500).send({ 
            error: 'Erro crítico: dados não foram salvos corretamente',
            message: 'Os dados foram atualizados mas não correspondem ao que foi salvo no banco',
          });
        }
        
        return reply.send(response);
      } catch (error) {
        // 🔴 CORREÇÃO: Erros de validação do domínio retornam 400, não 500
        // Erros de validação (formato inválido, campos trocados, etc.) são 400 Bad Request
        const isValidationError = error instanceof Error && (
          error.message.includes('inválido') ||
          error.message.includes('inválida') ||
          error.message.includes('formato') ||
          error.message.includes('não pode conter letras') ||
          error.message.includes('parece ser um nome') ||
          error.message.includes('campos não estão trocados')
        );
        
        // 🔴 DIAGNÓSTICO: Log detalhado de erros
        fastify.log.error({ 
          err: error,
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorMessage: error instanceof Error ? error.message : String(error),
          isValidationError,
          body: req.body,
        }, 'Erro ao atualizar perfil');
        
        if (error instanceof Error && error.name === 'ZodError') {
          // ZodError tem formato especial
          const zodError = error as any;
          const errorDetails = zodError.errors?.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message,
          })) || [];
          
          return reply.status(400).send({ 
            error: 'Validação falhou', 
            details: errorDetails,
            fullError: zodError.errors,
          });
        }
        
        // 🔴 CORREÇÃO: Erros de validação retornam 400, erros internos retornam 500
        // (isValidationError já foi declarado acima, na linha 410)
        const statusCode = isValidationError ? 400 : 500;
        return reply.status(statusCode).send({ 
          error: 'Erro ao atualizar perfil',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );

  /**
   * GET /identity/reputation
   * Retorna reputação do usuário autenticado baseada em global_user_id
   */
  fastify.get('/reputation', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // Resolver globalUserId a partir do actorId (temporário, até services migrarem para actorId)
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(req.tenant.id, req.actionContext.actorId);
      if (!actor || !actor.user_id) {
        return reply.status(404).send({ error: 'Actor não encontrado ou não é do tipo user' });
      }
      const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
      const globalUserId = await resolveGlobalUserId(actor.user_id, req.tenant.id);

      const reputation = await reputationService.getScoreByGlobalUserId(globalUserId);

      if (!reputation) {
        return reply.status(404).send({ error: 'Reputação não encontrada' });
      }

      return reputation;
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar reputação');
      return reply.status(500).send({ error: 'Erro ao buscar reputação' });
    }
  });

  /**
   * GET /identity/wallet/actor-statement
   *
   * Camada 1 — extrato da actor_wallet do actor logado (2026-05-26).
   *
   * Retorna saldo + entries com origem rastreável (D-money:
   * service_order/payment_request/payment_intent/payer). Saldo SEMPRE
   * vem da ledger via bankAccountService.getBalance (Bank é SSOT).
   *
   * Isolamento: actorId fixo = actionContext.actorId. Nenhum query
   * param expõe actor alheio.
   */
  fastify.get<{ Querystring: { limit?: string } }>('/wallet/actor-statement', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }
    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔴 DECISION-0113 fatia 6 (leitura cross-user): o actorId vem do actionContext (spoofável). Prova que o
    // req.user pode REPRESENTAR o actor ANTES de ler o statement de wallet alheio (fail-closed → 403 não-leak).
    let canReadStatement = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadStatement = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadStatement = false; }
    if (!canReadStatement) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    const limitParam = req.query?.limit ? Number(req.query.limit) : 100;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 100;

    const { actorWalletStatementService } = await import(
      '@modules/wallet/actor-wallet-statement.service'
    );
    const statement = await actorWalletStatementService.getActorWalletStatement(
      req.tenant.id,
      req.actionContext.actorId,
      limit
    );
    return statement;
  });

  /**
   * GET /identity/wallet
   * Retorna informações da wallet do usuário autenticado baseada em global_user_id
   */
  fastify.get('/wallet', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔴 DECISION-0113 fatia 6 (leitura cross-user): representabilidade ANTES de resolver globalUserId/wallet
    // alheio a partir do actorId declarado (fail-closed → 403 não-leak).
    let canReadWallet = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadWallet = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadWallet = false; }
    if (!canReadWallet) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      // Resolver globalUserId a partir do actorId (temporário, até services migrarem para actorId)
      const { socialPortsRegistry } = await import('@core/social/ports-registry');
      const actorRepository = socialPortsRegistry.getActorRepository();
      const actor = await actorRepository.findById(req.tenant.id, req.actionContext.actorId);
      if (!actor || !actor.user_id) {
        return reply.status(404).send({ error: 'Actor não encontrado ou não é do tipo user' });
      }
      const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
      const globalUserId = await resolveGlobalUserId(actor.user_id, req.tenant.id);

      // Buscar todas as contas do global_user_id
      const accounts = await accountService.getAccountsByGlobalUserId(globalUserId);
      
      // 🔴 Sem conta: retornar 200 com payload vazio (não é erro)
      if (accounts.length === 0) {
        return reply.status(200).send({
          hasWallet: false,
          balanceCents: 0,
          currency: 'BRL',
        });
      }

      // Usar conta primária (BRL) ou primeira disponível
      const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];

      // Buscar últimas transações
      const transactions = await transactionService.getTransactionsByGlobalUserId(
        globalUserId,
        { limit: 10 }
      );

      // Calcular totais (em centavos)
      let totalInCents = 0;
      let totalOutCents = 0;
      const lastTransactions = transactions.slice(0, 10).map(tx => {
        const isCredit = primaryAccount && tx.toAccountId === primaryAccount.accountId;
        const amountCents = tx.amountCents;
        if (isCredit) {
          totalInCents += amountCents;
        } else {
          totalOutCents += amountCents;
        }
        return {
          transactionId: tx.transactionId,
          type: isCredit ? 'credit' as const : 'debit' as const,
          amountCents,
          createdAt: tx.createdAt,
        };
      });

      return {
        globalUserId,
        balanceCents: primaryAccount.balanceCents,
        currency: primaryAccount.currency,
        totalInCents,
        totalOutCents,
        lastTransactions,
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar wallet');
      return reply.status(500).send({ error: 'Erro ao buscar wallet' });
    }
  });

  /**
   * GET /identity/ledger
   * Retorna histórico financeiro agregado do usuário autenticado baseado em global_user_id
   */
  fastify.get('/ledger', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    // 🔴 DECISION-0113 fatia 6 (leitura cross-user): representabilidade ANTES de ler o ledger financeiro
    // agregado (bank read port) do actor declarado (fail-closed → 403 não-leak).
    let canReadAggLedger = false;
    try {
      const { authorizationService } = await import('@core/authorization/authorization.service');
      canReadAggLedger = await authorizationService.canRepresentActor(req.tenant.id, req.user.userId, req.actionContext.actorId);
    } catch { canReadAggLedger = false; }
    if (!canReadAggLedger) {
      return reply.status(403).send({ error: 'Actor não representável pelo usuário autenticado' });
    }

    try {
      const actorId = req.actionContext.actorId;

      const { bankPortsRegistry: bankPortsRegistry2 } = await import('@core/bank/ports-registry');
      const readPort = bankPortsRegistry2.getBankTransactionRead();

      const [summary, recentTxs] = await Promise.all([
        readPort.getWalletSummaryByActorId(req.tenant.id, actorId),
        readPort.listRecentTransactionsByActorId(req.tenant.id, actorId, { limit: 100 }),
      ]);

      if (!summary) {
        return reply.status(404).send({ error: 'Nenhuma conta encontrada' });
      }

      return {
        actorId,
        balanceCents: summary.balanceCents,
        currency: summary.currency,
        accountsCount: summary.accountsCount,
        entries: recentTxs.map(tx => ({
          entryId: tx.entryId,
          accountId: tx.accountId,
          amountCents: tx.amountCents,
          direction: tx.direction,
          createdAt: tx.createdAt,
        })),
        totalEntries: recentTxs.length,
      };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar ledger');
      return reply.status(500).send({ error: 'Erro ao buscar ledger' });
    }
  });

  /**
   * GET /identity/configurations
   * Retorna configurações do usuário (PF/PJ, etc.)
   */
  fastify.get('/configurations', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    // ActionContext é obrigatório (V2)
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ error: 'ActionContext obrigatório' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // 🔴 DECISION-0113 fatia 6.2 (self): `userType` (PF/PJ) é a identidade do PRÓPRIO caller — espelha o
      // PUT da fatia 5.1. O sujeito é resolvido de `req.user` SERVER-SIDE, NÃO do `actionContext.actorId`
      // declarado (spoofável) — senão um caller lê o userType de OUTRO usuário. Removida a resolução via actor.
      const { resolveGlobalUserId: resolveGlobalUserId3 } = await import('@core/identity/identity.utils');
      const callerGlobalUserId = req.user.globalUserId ?? await resolveGlobalUserId3(req.user.userId, req.tenant.id);
      if (!callerGlobalUserId) {
        return reply.status(403).send({ error: 'Identidade global do usuário autenticado não resolvida' });
      }
      const globalUser = await identityService.getGlobalIdentity(callerGlobalUserId);
      if (!globalUser) {
        return reply.status(404).send({ error: 'Usuário não encontrado' });
      }

      const userType = (globalUser.metadata?.userType as 'physical' | 'legal' | 'both') || 'physical';
      return { userType };
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao buscar configurações');
      return reply.status(500).send({ error: 'Erro ao buscar configurações' });
    }
  });

  /**
   * PUT /identity/configurations
   * Atualiza configurações do usuário (PF/PJ, etc.)
   */
  fastify.put<{
    Body: {
      userType: 'physical' | 'legal' | 'both';
    };
  }>(
    '/configurations',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userType'],
          properties: {
            userType: { type: 'string', enum: ['physical', 'legal', 'both'] },
          },
        },
      },
    },
    async (req, reply) => {
      if (!req.user) {
        return reply.status(401).send({ error: 'Não autenticado' });
      }

      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      if (!req.tenant) {
        return reply.status(400).send({ error: 'Tenant não encontrado' });
      }

      try {
        // 🔴 DECISION-0113 fatia 5.1 (self): `userType` (PF/PJ) é a identidade do PRÓPRIO caller. O
        // sujeito é resolvido de `req.user` SERVER-SIDE — NÃO do `actionContext.actorId` declarado
        // (spoofável) — senão um caller altera o userType de OUTRO usuário. Padrão self (cf.
        // `POST /confirm-first-access`). Removida a dupla resolução via actor declarado.
        const { resolveGlobalUserId } = await import('@core/identity/identity.utils');
        const callerGlobalUserId = req.user.globalUserId ?? await resolveGlobalUserId(req.user.userId, req.tenant.id);
        if (!callerGlobalUserId) {
          return reply.status(403).send({ error: 'Identidade global do usuário autenticado não resolvida' });
        }
        const globalUser = await identityService.getGlobalIdentity(callerGlobalUserId);
        if (!globalUser) {
          return reply.status(404).send({ error: 'Usuário não encontrado' });
        }

        const updatedMetadata = {
          ...globalUser.metadata,
          userType: req.body.userType,
        };

        const updated = await identityService.updateGlobalIdentity(req.tenant.id, callerGlobalUserId, {
          metadata: updatedMetadata,
        });

        return { userType: updated.metadata?.userType || 'physical' };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao atualizar configurações');
        return reply.status(500).send({ error: 'Erro ao atualizar configurações' });
      }
    }
  );

  /**
   * POST /identity/confirm-first-access
   * Confirma primeiro acesso (chamado pelo botão "Entendi, continuar" do modal)
   * 🔴 FONTE ÚNICA DE VERDADE: Seta profile_personal_confirmed = true
   * Isso bloqueia os campos permanentemente e esconde o modal
   * - NÃO exige body (pode ser vazio)
   */
  fastify.post('/confirm-first-access', {
    bodyLimit: 1024,
    preHandler: async (req: any, reply: any) => {
      // 🔴 CORREÇÃO: Aceitar body vazio ou null
      // Se body está vazio ou null, normalizar para objeto vazio
      if (!req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0)) {
        req.body = {};
      }
    },
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // ActionContext é obrigatório (V2)
      if (!req.actionContext || !req.actionContext.actorId) {
        return reply.status(400).send({ error: 'ActionContext obrigatório' });
      }

      const actorId = req.actionContext.actorId;
      const userId = req.user.id;

      const { profileService } = await import('@core/profile/profile.service');
      
      // 🔴 FONTE ÚNICA DE VERDADE: Confirmar primeiro acesso
      // Isso seta profile_personal_confirmed = true
      await profileService.confirmFirstAccess(req.tenant.id, userId);
      
      fastify.log.info({
        userId,
        tenantId: req.tenant.id,
      }, '✅ Primeiro acesso confirmado - modal não aparecerá mais');

      return reply.send({ 
        ok: true, 
        message: 'Primeiro acesso confirmado com sucesso',
        firstAccessConfirmed: true,
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao confirmar primeiro acesso');
      return reply.status(500).send({ 
        error: 'Erro ao confirmar primeiro acesso',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ============================================================
  // FRENTE C Fatia C2 (2026-05-25): workflow submit→review→approve para KYC
  //   Tabela: identity_validation_requests (migration 20260530553000)
  //   Service: identity-validation.service.ts (novo módulo — identity.service
  //            é legado pré-Gate-0 CONGELADO, não pode ser expandido)
  //   Convergência sobre padrão da Frente B (companies submit→review).
  //
  // Decisão de escopo de tenant (veredito Etapa 1): workflow GLOBAL, sem
  //   tenant_id na tabela, sem RLS — consistente com identities. submitted_by
  //   e reviewed_by carregam tenant do operador (auditoria) via FK users.
  // ============================================================

  /**
   * POST /identity/submit-validation
   * Cria pedido de validação de KYC (status='pending') para a identity do user
   * logado OU de um globalUserId arbitrário (caminho admin).
   *
   * Evolução prevista: liberar para o próprio user submeter SUA identity
   * (gate fino futuro: subject = req.user.global_user_id derivado, sem
   * precisar de admin). Por ora requireRole(['admin']) consistente com
   * Frente B (companies). requireRole resolve autoridade SISTÊMICA no
   * tenant, NÃO autoridade sobre ESTE recurso — autoridade contextual
   * por pessoa vive na própria identity (PK = global_user_id), não em
   * roles.name. Não promover 'owner' (ou equivalente) para role global
   * sem decisão arquitetural.
   */
  fastify.post<{
    Body: {
      globalUserId: string;
      targetKycLevel?: 'basic' | 'complete';
      notes?: string;
    };
  }>('/submit-validation', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    const { globalUserId, targetKycLevel, notes } = req.body ?? ({} as any);
    if (!globalUserId || typeof globalUserId !== 'string') {
      return reply.status(400).send({ ok: false, message: 'Body.globalUserId é obrigatório' });
    }
    const level = targetKycLevel ?? 'basic';
    if (level !== 'basic' && level !== 'complete') {
      return reply.status(400).send({
        ok: false,
        message: "Body.targetKycLevel deve ser 'basic' ou 'complete' (default 'basic')",
      });
    }

    try {
      const { identityValidationService } = await import('@core/identity/identity-validation.service');
      const result = await identityValidationService.submitIdentityValidation(
        globalUserId,
        req.user.id,
        level,
        notes,
      );
      fastify.log.info({
        requestId: result.id,
        globalUserId: result.globalUserId,
        submittedByUserId: result.submittedByUserId,
        targetKycLevel: result.targetKycLevel,
      }, '📝 Frente C2: pedido de validação de identidade criado');
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao submeter identidade para validação');
      const message = error instanceof Error ? error.message : 'Erro ao submeter identidade para validação';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * GET /identity/admin/validation-queue
   * Lista pedidos de validação de identidade; query.status opcional filtra por estado.
   */
  fastify.get<{
    Querystring: { status?: string };
  }>('/admin/validation-queue', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    try {
      const { identityValidationService } = await import('@core/identity/identity-validation.service');
      const queue = await identityValidationService.getIdentityValidationQueue(req.query.status);
      return reply.send({ ok: true, data: queue });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar fila de validação de identidade');
      const message = error instanceof Error ? error.message : 'Erro ao listar fila de validação de identidade';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * PATCH /identity/admin/validation-requests/:requestId/review
   * Admin decide pending → approved/rejected. Atômico (UPDATE request +
   * UPDATE identities numa única transação).
   */
  fastify.patch<{
    Params: { requestId: string };
    Body: { decision: 'approved' | 'rejected'; reason?: string };
  }>('/admin/validation-requests/:requestId/review', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    const { decision, reason } = req.body ?? ({} as { decision?: 'approved' | 'rejected'; reason?: string });
    if (decision !== 'approved' && decision !== 'rejected') {
      return reply.status(400).send({
        ok: false,
        message: "Body.decision deve ser 'approved' ou 'rejected'",
      });
    }

    try {
      const { identityValidationService } = await import('@core/identity/identity-validation.service');
      const result = await identityValidationService.reviewIdentityValidation(
        req.params.requestId,
        decision,
        reason,
        req.user.id,
      );
      fastify.log.info({
        requestId: result.id,
        globalUserId: result.globalUserId,
        decision: result.status,
        targetKycLevel: result.targetKycLevel,
        reviewerUserId: result.reviewedByUserId,
      }, `✅ Frente C2: validação de identidade ${result.status}`);
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao revisar pedido de validação de identidade');
      const message = error instanceof Error ? error.message : 'Erro ao revisar pedido de validação de identidade';
      return reply.status(400).send({ ok: false, message });
    }
  });

  // ============================================================
  // F2-A KYB PJ (DECISION-0086): writer auditado da identidade fiscal PJ.
  //   Tabela: fiscal_identity_kyb_requests (migration 20260603130000)
  //   Service: fiscal-identity-kyb.service.ts (PJ-cêntrico; NUNCA toca identities PF/kyc_status).
  //   Fonte da verificação PJ = fiscal_identities.kyb_status. Transições: pending->approved/rejected.
  //   Operador (autoridade) = req.actionContext.actorId (actor humano) — NÃO user_id.
  //   Documentos = F2-B; gate authority = F2-C (fora desta frente).
  // ============================================================

  /**
   * POST /identity/pj/kyb/requests
   * Cria pedido KYB (status='pending') para uma identidade fiscal PJ. requireRole(['admin']).
   */
  fastify.post<{
    Body: { fiscalIdentityId: string; reason?: string };
  }>('/pj/kyb/requests', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    // Operador resolvido de forma canônica (actor humano). NÃO usar user_id como substituto.
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório (actor do operador ausente)' });
    }
    const { fiscalIdentityId, reason } = req.body ?? ({} as { fiscalIdentityId?: string; reason?: string });
    if (!fiscalIdentityId || typeof fiscalIdentityId !== 'string') {
      return reply.status(400).send({ ok: false, message: 'Body.fiscalIdentityId é obrigatório' });
    }
    try {
      const { fiscalIdentityKybService } = await import('@core/identity/fiscal-identity-kyb.service');
      const result = await fiscalIdentityKybService.submitFiscalKybRequest(
        fiscalIdentityId,
        req.actionContext.actorId,
        reason,
      );
      fastify.log.info({
        kybRequestId: result.kybRequestId,
        fiscalIdentityId: result.fiscalIdentityId,
        submittedByActorId: result.submittedByActorId,
      }, '📝 F2-A: pedido KYB PJ criado');
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao submeter KYB PJ');
      const message = error instanceof Error ? error.message : 'Erro ao submeter KYB PJ';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * GET /identity/pj/kyb/admin/queue
   * Lista pedidos KYB; query.status opcional. requireRole(['admin']).
   */
  fastify.get<{
    Querystring: { status?: string };
  }>('/pj/kyb/admin/queue', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    try {
      const { fiscalIdentityKybService } = await import('@core/identity/fiscal-identity-kyb.service');
      const queue = await fiscalIdentityKybService.getFiscalKybQueue(req.query.status);
      return reply.send({ ok: true, data: queue });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar fila KYB PJ');
      const message = error instanceof Error ? error.message : 'Erro ao listar fila KYB PJ';
      return reply.status(400).send({ ok: false, message });
    }
  });

  /**
   * PATCH /identity/pj/kyb/admin/requests/:requestId/review
   * Admin decide pending → approved/rejected. Atômico (UPDATE request + UPDATE fiscal_identities).
   * requireRole(['admin']).
   */
  fastify.patch<{
    Params: { requestId: string };
    Body: { decision: 'approved' | 'rejected'; reason: string };
  }>('/pj/kyb/admin/requests/:requestId/review', {
    preHandler: [fastify.requireRole(['admin'])],
  }, async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    }
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório (actor do operador ausente)' });
    }
    const { decision, reason } = req.body ?? ({} as { decision?: 'approved' | 'rejected'; reason?: string });
    if (decision !== 'approved' && decision !== 'rejected') {
      return reply.status(400).send({ ok: false, message: "Body.decision deve ser 'approved' ou 'rejected'" });
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return reply.status(400).send({ ok: false, message: 'Body.reason é obrigatório (auditoria da decisão)' });
    }
    try {
      const { fiscalIdentityKybService } = await import('@core/identity/fiscal-identity-kyb.service');
      const result = await fiscalIdentityKybService.reviewFiscalKybRequest(
        req.params.requestId,
        decision,
        reason,
        req.actionContext.actorId,
      );
      fastify.log.info({
        kybRequestId: result.kybRequestId,
        fiscalIdentityId: result.fiscalIdentityId,
        decision: result.status,
        reviewedByActorId: result.reviewedByActorId,
      }, `✅ F2-A: KYB PJ ${result.status}`);
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao revisar KYB PJ');
      const message = error instanceof Error ? error.message : 'Erro ao revisar KYB PJ';
      return reply.status(400).send({ ok: false, message });
    }
  });

  // ============================================================
  // F2-B KYB DOCUMENTOS PJ (DECISION-0087): SSOT documental KYB da identidade fiscal PJ.
  //   Tabela: fiscal_identity_documents (migration 20260603140000)
  //   Service: fiscal-identity-document.service.ts (docs DA EMPRESA; file_reference OPACO, sem upload).
  //   Operador (autoridade) = req.actionContext.actorId. Documentos de PESSOA = outro trilho.
  // ============================================================

  /** POST /identity/pj/kyb/documents — registra documento (submitted). requireRole(['admin']). */
  fastify.post<{
    Body: { fiscalIdentityId: string; documentType: string; fileReference: string; fileHash?: string; kybRequestId?: string };
  }>('/pj/kyb/documents', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
    if (!req.user) return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório (actor do operador ausente)' });
    }
    const { fiscalIdentityId, documentType, fileReference, fileHash, kybRequestId } = req.body ?? ({} as any);
    if (!fiscalIdentityId || !documentType || !fileReference) {
      return reply.status(400).send({ ok: false, message: 'fiscalIdentityId, documentType e fileReference são obrigatórios' });
    }
    try {
      const { fiscalIdentityDocumentService } = await import('@core/identity/fiscal-identity-document.service');
      const result = await fiscalIdentityDocumentService.submitFiscalIdentityDocument({
        fiscalIdentityId, documentType, fileReference, submittedByActorId: req.actionContext.actorId,
        kybRequestId: kybRequestId ?? null, fileHash: fileHash ?? null,
      });
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao submeter documento KYB PJ');
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Erro ao submeter documento' });
    }
  });

  /** GET /identity/pj/kyb/fiscal-identities/:fiscalIdentityId/documents — lista. requireRole(['admin']). */
  fastify.get<{ Params: { fiscalIdentityId: string } }>(
    '/pj/kyb/fiscal-identities/:fiscalIdentityId/documents', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
      try {
        const { fiscalIdentityDocumentService } = await import('@core/identity/fiscal-identity-document.service');
        const data = await fiscalIdentityDocumentService.listFiscalIdentityDocuments(req.params.fiscalIdentityId);
        return reply.send({ ok: true, data });
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao listar documentos KYB PJ');
        return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Erro ao listar documentos' });
      }
    });

  /** PATCH /identity/pj/kyb/documents/:documentId/review — accepted/rejected. requireRole(['admin']). */
  fastify.patch<{
    Params: { documentId: string };
    Body: { decision: 'accepted' | 'rejected'; reason: string };
  }>('/pj/kyb/documents/:documentId/review', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
    if (!req.user) return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório (actor do operador ausente)' });
    }
    const { decision, reason } = req.body ?? ({} as any);
    if (decision !== 'accepted' && decision !== 'rejected') {
      return reply.status(400).send({ ok: false, message: "Body.decision deve ser 'accepted' ou 'rejected'" });
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return reply.status(400).send({ ok: false, message: 'Body.reason é obrigatório (auditoria)' });
    }
    try {
      const { fiscalIdentityDocumentService } = await import('@core/identity/fiscal-identity-document.service');
      const result = await fiscalIdentityDocumentService.reviewFiscalIdentityDocument(req.params.documentId, decision, reason, req.actionContext.actorId);
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao revisar documento KYB PJ');
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Erro ao revisar documento' });
    }
  });

  /** POST /identity/pj/kyb/documents/:documentId/supersede — nova versão append-only. requireRole(['admin']). */
  fastify.post<{
    Params: { documentId: string };
    Body: { fileReference: string; fileHash?: string };
  }>('/pj/kyb/documents/:documentId/supersede', { preHandler: [fastify.requireRole(['admin'])] }, async (req, reply) => {
    if (!req.user) return reply.status(401).send({ ok: false, message: 'Não autenticado' });
    if (!req.actionContext || !req.actionContext.actorId) {
      return reply.status(400).send({ ok: false, message: 'ActionContext obrigatório (actor do operador ausente)' });
    }
    const { fileReference, fileHash } = req.body ?? ({} as any);
    if (!fileReference) {
      return reply.status(400).send({ ok: false, message: 'Body.fileReference é obrigatório' });
    }
    try {
      const { fiscalIdentityDocumentService } = await import('@core/identity/fiscal-identity-document.service');
      const result = await fiscalIdentityDocumentService.supersedeFiscalIdentityDocument(req.params.documentId, fileReference, fileHash ?? null, req.actionContext.actorId);
      return reply.send({ ok: true, data: result });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao supersede documento KYB PJ');
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Erro ao supersede documento' });
    }
  });

  // ── F-PJ-KYB-DOCUMENTS-ADMIN-REVIEW-UI: balcão de análise (fila + download protegido) ──
  // Review (accepted/rejected) já existe em PATCH /pj/kyb/documents/:documentId/review (só muda
  // document_status; NÃO toca kyb_status). Aqui entram a FILA e o DOWNLOAD protegido (clean-only).

  /** GET /identity/pj/kyb/documents/pending — fila de análise (documentos 'submitted'). requireRole(['admin']). */
  fastify.get('/pj/kyb/documents/pending', { preHandler: [fastify.requireRole(['admin'])] }, async (_req, reply) => {
    try {
      const { fiscalIdentityDocumentService } = await import('@core/identity/fiscal-identity-document.service');
      const data = await fiscalIdentityDocumentService.listPendingFiscalIdentityDocuments();
      return reply.send({ ok: true, data });
    } catch (error) {
      fastify.log.error({ err: error }, 'Erro ao listar fila KYB PJ');
      return reply.status(400).send({ ok: false, message: error instanceof Error ? error.message : 'Erro ao listar fila' });
    }
  });

  /** GET /identity/pj/kyb/documents/:documentId/file — download PROTEGIDO. requireRole(['admin']).
   *  Lê via DocumentStoragePort, valida hash vs SSOT, RE-ESCANEIA (clean-only) e só então devolve bytes.
   *  NUNCA expõe path local/URL pública. Produção sem scanner = fail-closed. */
  fastify.get<{ Params: { documentId: string } }>(
    '/pj/kyb/documents/:documentId/file',
    { preHandler: [fastify.requireRole(['admin'])] },
    async (req, reply) => {
      try {
        const { downloadKybDocument } = await import('@core/kyb-documents/kyb-document-download.service');
        const result = await downloadKybDocument(req.params.documentId, { scanTenantId: req.tenant?.id });
        reply.header('Content-Disposition', `inline; filename="kyb_${req.params.documentId}"`);
        reply.header('X-Document-Type', result.documentType);
        reply.type(result.mimeType);
        return reply.send(result.buffer);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
        const code = (error as { code?: string }).code;
        const message = error instanceof Error ? error.message : 'Erro ao baixar documento KYB';
        if (statusCode >= 500) fastify.log.error({ err: error, documentId: req.params.documentId }, 'Erro no download KYB');
        return reply.status(statusCode).send({ ok: false, code, message });
      }
    },
  );

  // Registrar rotas de residence como sub-rotas
  // A rota GET /identity/residence está definida em residence.routes.ts
  await fastify.register(residenceRoutes, { prefix: '/residence' });
};

export default identityRoutes;


