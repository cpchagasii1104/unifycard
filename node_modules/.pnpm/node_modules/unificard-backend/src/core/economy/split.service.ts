// src/core/economy/split.service.ts
//
// Engine de splits econômicos do Unificard
// Divide pagamentos em múltiplos destinos (worker, tenant, região, grupos)

import { createHash } from 'crypto';
import { transactionService } from './transactions/transaction.service';
import { accountService } from './accounts/account.service';
import { runQueryWithTenant } from '@core/database/pool';
import { eventBus } from '@core/events/event-bus';
import { splitLoggerService } from '../logging/split-logger.service';
import { policyRegistry } from '../policy/policy-registry';
import type {
  SplitRule,
  SplitConfig,
  SplitContext,
  SplitResult,
} from './split.types';

// Constantes técnicas (não são normas econômicas)
const ROUNDING_TOLERANCE = 0.01; // Tolerância para arredondamento de diferenças
const DECIMAL_PLACES_MULTIPLIER = 100; // Para arredondar para 2 casas decimais

class SplitEngineService {
  /**
   * Obtém configuração padrão de splits para um tenant
   * Lê normas econômicas do Policy Registry (constituição, não configuração)
   * Fallbacks explícitos garantem funcionamento mesmo se policies não existirem
   * 
   * 🔴 CRÍTICO: Para contextos EVENT, sempre usa EVENT_ORGANIZER em vez de WORKER
   */
  getDefaultConfigForTenant(
    tenantId: string,
    currency: string = 'BRL',
    module?: string
  ): SplitConfig {
    // 🔴 REGRA IMUTÁVEL: Contextos EVENT nunca usam WORKER
    const isEventContext =
      module === 'EVENT_TICKET' || module === 'EVENT_CONSUMPTION';

    // Ler normas econômicas do Policy Registry (síncrono, imutável, sem contexto)
    // Fallbacks explícitos: valores hardcoded como última linha de defesa
    const primaryPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      isEventContext ? 'split_event_organizer_percentage' : 'split_worker_percentage',
      0.70
    ) || 0.70;

    const tenantPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_tenant_percentage',
      0.15
    ) || 0.15;

    const regionPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_region_percentage',
      0.10
    ) || 0.10;

    const groupPercentage = policyRegistry.getPolicyValue<number>(
      'economy',
      'split_group_percentage',
      0.05
    ) || 0.05;

    // Construir regras a partir das normas econômicas
    const rules: SplitRule[] = [
      // 🔴 CRÍTICO: EVENT usa ORGANIZER, outros usam WORKER
      {
        targetType: isEventContext ? 'EVENT_ORGANIZER' : 'WORKER',
        percentage: primaryPercentage,
        targetIdKey: isEventContext ? undefined : 'workerUserId',
        description: isEventContext ? 'Event organizer share' : 'Worker share',
      },
      {
        targetType: 'TENANT',
        percentage: tenantPercentage,
        targetIdKey: 'tenantId',
        description: 'Tenant/platform fee',
      },
      {
        targetType: 'REGION',
        percentage: regionPercentage,
        targetIdKey: 'regionId',
        description: 'Regional fund',
      },
      {
        targetType: 'GROUP',
        percentage: groupPercentage,
        targetIdKey: 'groupId',
        description: 'User groups',
      },
    ];

    return {
      tenantId,
      rules,
      currency,
    };
  }

  /**
   * Calcula os splits sem criar transações
   */
  calculateSplits(context: SplitContext): SplitResult {
    // 🔴 CRÍTICO: Passa module do metadata para detectar contexto EVENT
    const module = context.metadata?.module;
    const config = this.getDefaultConfigForTenant(
      context.tenantId,
      context.currency,
      module
    );
    const splits: Array<{ rule: SplitRule; amount: number }> = [];

    // Calcular amount para cada regra
    let totalCalculated = 0;
    for (const rule of config.rules) {
      const amount = context.amount * rule.percentage;
      splits.push({
        rule,
        amount,
      });
      totalCalculated += amount;
    }

    // Normalizar para não ultrapassar o total
    // Ajustar diferença no split primário (WORKER ou EVENT_ORGANIZER)
    const difference = context.amount - totalCalculated;
    if (Math.abs(difference) > ROUNDING_TOLERANCE) {
      // Ajustar o split primário (WORKER ou EVENT_ORGANIZER)
      const primarySplitIndex = splits.findIndex(
        (s) => s.rule.targetType === 'WORKER' || s.rule.targetType === 'EVENT_ORGANIZER'
      );
      if (primarySplitIndex >= 0) {
        splits[primarySplitIndex].amount += difference;
      } else {
        // Fallback: ajustar o último split
        splits[splits.length - 1].amount += difference;
      }
    }

    return {
      totalAmount: context.amount,
      splits: splits.map((s) => ({
        rule: s.rule,
        amount: Math.round(s.amount * DECIMAL_PLACES_MULTIPLIER) / DECIMAL_PLACES_MULTIPLIER, // Arredondar para 2 casas decimais
      })),
    };
  }

  /**
   * Aplica os splits criando transações reais
   */
  async applySplits(context: SplitContext): Promise<SplitResult> {
    const calculation = this.calculateSplits(context);
    const result: SplitResult = {
      totalAmount: calculation.totalAmount,
      splits: [],
    };

    // Resolver contas e criar transações para cada split
    for (const split of calculation.splits) {
      let targetAccountId: string | null = null;

      // Resolver destino baseado no targetType
      switch (split.rule.targetType) {
        case 'WORKER':
          targetAccountId = context.workerAccountId || null;
          break;

        case 'EVENT_ORGANIZER':
          // 🔴 CRÍTICO: Evento NUNCA deve usar WORKER, sempre EVENT_ORGANIZER
          targetAccountId = context.eventOrganizerAccountId || null;
          break;

        case 'TENANT':
        case 'PLATFORM':
          // Por enquanto, PLATFORM usa tenantAccountId (TODO separar)
          targetAccountId = context.tenantAccountId || null;
          break;

        case 'REGION':
          targetAccountId = context.regionAccountId || null;
          break;

        case 'GROUP':
          // GROUP será tratado separadamente (múltiplas contas)
          // Se não houver groupAccountIds, pular com WARNING
          if (!context.groupAccountIds || context.groupAccountIds.length === 0) {
            console.warn({
              tenantId: context.tenantId,
              targetType: split.rule.targetType,
              amount: split.amount,
              'economy.action': 'split-skipped',
            }, `Skipping GROUP split: no group accounts provided`);
            result.splits.push({
              rule: split.rule,
              amount: split.amount,
            });
            continue;
          }
          // Dividir o valor do GROUP igualmente entre todos os grupos
          const groupAmountPerAccount = split.amount / context.groupAccountIds.length;
          for (let i = 0; i < context.groupAccountIds.length; i++) {
            const groupAccountId = context.groupAccountIds[i];
            try {
              const transferResult = await transactionService.transfer(context.tenantId, {
                fromAccount: context.customerAccountId,
                toAccount: groupAccountId,
                amount: groupAmountPerAccount,
                metadata: {
                  ...context.metadata,
                  splitTargetType: split.rule.targetType,
                  splitDescription: split.rule.description,
                  splitPercentage: split.rule.percentage,
                  groupAccountId,
                  groupIndex: i,
                  totalGroups: context.groupAccountIds.length,
                },
              });

              result.splits.push({
                rule: split.rule,
                amount: groupAmountPerAccount,
                transactionId: transferResult.transaction.transactionId,
              });

              // Emitir evento group.fund.received (com informações para auto-post)
              try {
                const groupAccount = await runQueryWithTenant<{ group_id: string }>(
                  context.tenantId,
                  `
                  SELECT group_id FROM group_accounts WHERE account_id = $1 LIMIT 1
                  `,
                  [groupAccountId]
                );

                if (groupAccount) {
                  await eventBus.publish({
                    tenantId: context.tenantId,
                    type: 'group.fund.received',
                    payload: {
                      groupId: groupAccount.group_id,
                      accountId: groupAccountId,
                      amount: groupAmountPerAccount,
                      source: context.source,
                      transactionId: transferResult.transaction.transactionId,
                      assignmentId: context.metadata?.assignmentId,
                      jobId: context.metadata?.jobId,
                      workerUserId: context.metadata?.workerUserId,
                    },
                  });
                }
              } catch (error) {
                // Log mas não quebra
                console.error({
                  tenantId: context.tenantId,
                  groupAccountId,
                  err: error,
                  'economy.action': 'emit-group-fund-event',
                }, 'Error emitting group fund received event');
              }
            } catch (error) {
              console.error({
                tenantId: context.tenantId,
                targetType: split.rule.targetType,
                groupAccountId,
                amount: groupAmountPerAccount,
                err: error,
                'economy.action': 'split-error',
              }, `Error creating GROUP split transaction`);
              // Adicionar split sem transactionId (erro)
              result.splits.push({
                rule: split.rule,
                amount: groupAmountPerAccount,
              });
            }
          }
          continue; // Já processado, pular para próximo split
      }

      // Se não encontrou conta para o destino
      if (!targetAccountId) {
        // 🔴 CRÍTICO: EVENT_ORGANIZER sem conta é ERRO FATAL (não pode pular)
        if (split.rule.targetType === 'EVENT_ORGANIZER') {
          throw new Error(
            `CRITICAL: Event organizer account not resolved for event ${context.metadata?.eventId}. ` +
            `Event must have created_by_company_id or created_by_global_user_id.`
          );
        }

        // Para outros tipos, pular com WARNING (comportamento antigo)
        console.warn({
          tenantId: context.tenantId,
          targetType: split.rule.targetType,
          amount: split.amount,
          'economy.action': 'split-skipped',
        }, `Skipping split: no account found for target type ${split.rule.targetType}`);
        result.splits.push({
          rule: split.rule,
          amount: split.amount,
        });
        continue;
      }

      // Criar transação para este split
      try {
        // 🔴 CRÍTICO: eventId determinístico para idempotência no ledger
        // Se houver idempotencyKey no metadata, gera eventId determinístico
        // Caso contrário, usa UUID aleatório (comportamento padrão)
        let eventId: string | undefined = undefined;
        if (context.metadata?.idempotencyKey) {
          // Gerar eventId determinístico baseado em idempotencyKey + targetType + index
          // Isso garante que retry do checkout não duplica transações no ledger
          const splitIndex = result.splits.length;
          const deterministicSeed = `${context.metadata.idempotencyKey}-${split.rule.targetType}-${splitIndex}`;
          const hash = createHash('sha256').update(deterministicSeed).digest('hex');
          // Formatar como UUID (8-4-4-4-12)
          eventId = `${hash.substring(0, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}-${hash.substring(16, 20)}-${hash.substring(20, 32)}`;
        }

        const transferResult = await transactionService.transfer(context.tenantId, {
          fromAccount: context.customerAccountId,
          toAccount: targetAccountId,
          amount: split.amount,
          eventId, // 🔴 CRÍTICO: eventId determinístico para idempotência
          metadata: {
            ...context.metadata,
            splitTargetType: split.rule.targetType,
            splitDescription: split.rule.description,
            splitPercentage: split.rule.percentage,
          },
        });

        result.splits.push({
          rule: split.rule,
          amount: split.amount,
          transactionId: transferResult.transaction.transactionId,
        });

        // Log estruturado para split executado
        splitLoggerService.logSplit({
          timestamp: new Date().toISOString(),
          module: context.metadata?.module || 'unknown',
          amount: split.amount,
          transactionId: transferResult.transaction.transactionId,
          tenantId: context.tenantId,
          splitTargetType: split.rule.targetType,
          splitPercentage: split.rule.percentage,
        });

        // Log especial para crédito em conta REGION
        if (split.rule.targetType === 'REGION' && context.regionAccountId) {
          // Usar regionId do metadata se disponível, senão 'unknown'
          const regionId = context.metadata?.regionId || 'unknown';

          splitLoggerService.logRegionCredit({
            timestamp: new Date().toISOString(),
            module: context.metadata?.module || 'work',
            regionId,
            amount: split.amount,
            transactionId: transferResult.transaction.transactionId,
            tenantId: context.tenantId,
          });
        }
      } catch (error) {
        console.error({
          tenantId: context.tenantId,
          targetType: split.rule.targetType,
          targetAccountId,
          amount: split.amount,
          err: error,
          'economy.action': 'split-error',
        }, `Error creating split transaction for ${split.rule.targetType}`);
        // Adicionar split sem transactionId (erro)
        result.splits.push({
          rule: split.rule,
          amount: split.amount,
        });
      }
    }

    // Log estruturado
    console.log({
      tenantId: context.tenantId,
      amount: context.amount,
      currency: context.currency,
      source: context.source,
      splitCount: result.splits.length,
      splits: result.splits.map((s) => ({
        targetType: s.rule.targetType,
        percentage: s.rule.percentage,
        amount: s.amount,
        transactionId: s.transactionId || null,
      })),
      'economy.action': 'apply-splits',
    }, 'Applied economic splits for transaction');

    return result;
  }
}

export const splitEngineService = new SplitEngineService();

