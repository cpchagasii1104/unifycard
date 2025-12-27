// src/core/identity/identity.routes.ts
import { FastifyPluginAsync } from 'fastify';
import { identityService } from './identity.service';
import { reputationService } from '@core/reputation/reputation.service';
import { accountService } from '@core/economy/accounts/account.service';
import { transactionService } from '@core/economy/transactions/transaction.service';
import { ledgerService } from '@core/economy/ledger/ledger.service';
import { residenceService } from '@core/residence/residence.service';
import residenceRoutes from '@core/residence/residence.routes';
import { updateGlobalIdentitySchema } from './identity.schemas';

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
      const profile = await identityService.getIdentityProfile(
        req.user.id,
        req.tenant.id
      );

      if (!profile) {
        return reply.status(404).send({ ok: false, message: 'Perfil não encontrado' });
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
      
      const serializedProfile = {
        ...profile,
        global: {
          ...profile.global,
          birthdate: serializedBirthdate,
        },
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
        // 🔴 CRÍTICO: Log de diagnóstico - verificar identidade do usuário
        fastify.log.info({
          authUser: {
            id: req.user.id,
            globalUserId: req.user.globalUserId,
            email: req.user.email,
          },
          tenantId: req.tenant.id,
        }, '🔍 DIAGNÓSTICO: Identidade do usuário autenticado');

        // Buscar global_user_id do usuário
        const profile = await identityService.getIdentityProfile(
          req.user.id,
          req.tenant.id
        );

        if (!profile) {
          fastify.log.error({
            userId: req.user.id,
            tenantId: req.tenant.id,
          }, '❌ Perfil não encontrado para atualização');
          return reply.status(404).send({ error: 'Perfil não encontrado' });
        }

        // 🔴 INSTRUMENTAÇÃO: Log padronizado para diagnóstico de múltiplos processos
        fastify.log.info({
          pid: process.pid,
          route: '/identity/update',
          method: 'POST',
          userId: req.user.id,
          tenantId: req.tenant.id,
          globalUserId: profile.global.globalUserId,
        }, '[RUNTIME] POST /identity/update');
        
        // 🔴 CRÍTICO: Log do global_user_id que será usado
        fastify.log.info({
          pid: process.pid,
          userId: req.user.id,
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
          birthdateIsDate: req.body?.birthdate instanceof Date,
          birthdateString: req.body?.birthdate ? String(req.body.birthdate) : null,
          birthdateConstructor: req.body?.birthdate ? req.body.birthdate.constructor?.name : null,
        }, '🔍 DIAGNÓSTICO: Payload recebido do frontend (APÓS preHandler)');
        
        // 🔴 CRÍTICO: Normalizar birthdate ANTES de qualquer validação
        // Fastify pode estar convertendo string para Date automaticamente via JSON.parse
        // Ou algum middleware pode estar fazendo conversão automática
        if (req.body?.birthdate !== null && req.body?.birthdate !== undefined && req.body?.birthdate !== '') {
          let birthdateValue: string;
          
          // Se for objeto Date, converter para YYYY-MM-DD imediatamente
          if (req.body.birthdate instanceof Date) {
            fastify.log.warn({
              birthdate: req.body.birthdate,
              birthdateType: typeof req.body.birthdate,
              birthdateString: req.body.birthdate.toString(),
            }, '⚠️ birthdate chegou como objeto Date (possível conversão automática), normalizando...');
            // Converter Date para YYYY-MM-DD usando UTC
            const year = req.body.birthdate.getUTCFullYear();
            const month = String(req.body.birthdate.getUTCMonth() + 1).padStart(2, '0');
            const day = String(req.body.birthdate.getUTCDate()).padStart(2, '0');
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
              isDate: req.body.birthdate instanceof Date,
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
          createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
          updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    try {
      const reputation = await reputationService.getScoreByGlobalUserId(req.user.globalUserId);
      
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
   * GET /identity/wallet
   * Retorna informações da wallet do usuário autenticado baseada em global_user_id
   */
  fastify.get('/wallet', async (req, reply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Não autenticado' });
    }

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    try {
      // Buscar todas as contas do global_user_id
      const accounts = await accountService.getAccountsByGlobalUserId(req.user.globalUserId);
      
      if (accounts.length === 0) {
        return reply.status(404).send({ error: 'Nenhuma conta encontrada' });
      }

      // Usar conta primária (BRL) ou primeira disponível
      const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];

      // Buscar últimas transações
      const transactions = await transactionService.getTransactionsByGlobalUserId(
        req.user.globalUserId,
        { limit: 10 }
      );

      // Calcular totais
      let totalIn = 0;
      let totalOut = 0;
      const lastTransactions = transactions.slice(0, 10).map(tx => {
        const isCredit = tx.toGlobalUserId === req.user?.globalUserId;
        const amount = tx.amount;
        
        if (isCredit) {
          totalIn += amount;
        } else {
          totalOut += amount;
        }

        return {
          transactionId: tx.transactionId,
          type: isCredit ? 'credit' as const : 'debit' as const,
          amount,
          createdAt: tx.createdAt,
        };
      });

      return {
        globalUserId: req.user.globalUserId,
        balance: primaryAccount.balance,
        currency: primaryAccount.currency,
        totalIn,
        totalOut,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    if (!req.tenant) {
      return reply.status(400).send({ error: 'Tenant não encontrado' });
    }

    try {
      // Buscar todas as contas do global_user_id
      const accounts = await accountService.getAccountsByGlobalUserId(req.user.globalUserId);
      
      if (accounts.length === 0) {
        return reply.status(404).send({ error: 'Nenhuma conta encontrada' });
      }

      // Buscar ledger entries de todas as contas
      const allEntries: any[] = [];
      for (const account of accounts) {
        try {
          const entries = await ledgerService.getLedgerEntries(
            account.tenantId,
            account.accountId,
            { limit: 50 }
          );
          allEntries.push(...entries.map(entry => ({
            ...entry,
            accountCurrency: account.currency,
            accountTenantId: account.tenantId,
          })));
        } catch (error) {
          // Ignora erros ao buscar ledger de contas de outros tenants
        }
      }

      // Ordenar por data (mais recente primeiro)
      allEntries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return {
        globalUserId: req.user.globalUserId,
        entries: allEntries.slice(0, 100), // Limitar a 100 entradas
        totalEntries: allEntries.length,
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

    if (!req.user.globalUserId) {
      return reply.status(404).send({ error: 'Identidade global não encontrada' });
    }

    try {
      const globalUser = await identityService.getGlobalIdentity(req.user.globalUserId);
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

      if (!req.user.globalUserId) {
        return reply.status(404).send({ error: 'Identidade global não encontrada' });
      }

      try {
        // Buscar metadata atual
        const globalUser = await identityService.getGlobalIdentity(req.user.globalUserId);
        if (!globalUser) {
          return reply.status(404).send({ error: 'Usuário não encontrado' });
        }

        // Atualizar metadata com userType
        const updatedMetadata = {
          ...globalUser.metadata,
          userType: req.body.userType,
        };

        const updated = await identityService.updateGlobalIdentity(req.user.globalUserId, {
          metadata: updatedMetadata,
        });

        return { userType: updated.metadata?.userType || 'physical' };
      } catch (error) {
        fastify.log.error({ err: error }, 'Erro ao atualizar configurações');
        return reply.status(500).send({ error: 'Erro ao atualizar configurações' });
      }
    }
  );

  // Registrar rotas de residence como sub-rotas
  // A rota GET /identity/residence está definida em residence.routes.ts
  await fastify.register(residenceRoutes, { prefix: '/residence' });
};

export default identityRoutes;

