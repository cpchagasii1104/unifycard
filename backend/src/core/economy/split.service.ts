// src/core/economy/split.service.ts
//
// Engine de splits econômicos do Unificard
// Divide pagamentos em múltiplos destinos (worker, tenant, região, grupos)

import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getClientWithTenant, runQueryWithTenant } from '@core/database/pool';
import { insertEventOutboxRow } from '@core/events/event-outbox.repository';
import { transactionService } from './transaction.service';
import { splitLoggerService } from '../logging/split-logger.service';
import { policyRegistry } from '../policy/policy-registry';
import type {
  SplitRule,
  SplitConfig,
  SplitContext,
  SplitResult,
} from './split.types';

// Constantes técnicas: inteiros apenas; percentage em 0–1
const ROUNDING_TOLERANCE_CENTS = 1; // 1 centavo de tolerância

/**
 * `event_outbox.event_id` é UUID NOT NULL. Idempotência pós-commit do ramo GROUP:
 * mesma chave estável por transferência bancária — ver EVENT_OUTBOX_E_ENTREGA_CANONICO.md §3.
 */
function deterministicGroupFundReceivedOutboxEventId(bankTransactionId: string): string {
  const hash = createHash('sha256')
    .update(`group.fund.received:${bankTransactionId}`)
    .digest();
  const b = Buffer.alloc(16);
  hash.copy(b, 0, 0, 16);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

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
   * Calcula os splits sem criar transações. Valores sempre em amountCents (inteiros).
   */
  calculateSplits(context: SplitContext): SplitResult {
    const module = context.metadata?.module;
    const config = this.getDefaultConfigForTenant(
      context.tenantId,
      context.currency,
      module
    );
    const totalCents = context.amountCents;
    const splits: Array<{ rule: SplitRule; amountCents: number }> = [];

    let totalCalculatedCents = 0;
    for (const rule of config.rules) {
      const amountCents = Math.round(totalCents * rule.percentage);
      splits.push({ rule, amountCents });
      totalCalculatedCents += amountCents;
    }

    const differenceCents = totalCents - totalCalculatedCents;
    if (Math.abs(differenceCents) > ROUNDING_TOLERANCE_CENTS) {
      const primarySplitIndex = splits.findIndex(
        (s) => s.rule.targetType === 'WORKER' || s.rule.targetType === 'EVENT_ORGANIZER'
      );
      if (primarySplitIndex >= 0) {
        splits[primarySplitIndex].amountCents += differenceCents;
      } else {
        splits[splits.length - 1].amountCents += differenceCents;
      }
    }

    return {
      totalAmount: totalCents,
      splits,
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
              amountCents: split.amountCents,
              'economy.action': 'split-skipped',
            }, `Skipping GROUP split: no group accounts provided`);
            result.splits.push({
              rule: split.rule,
              amountCents: split.amountCents,
            });
            continue;
          }
          const n = context.groupAccountIds.length;
          const baseCents = Math.floor(split.amountCents / n);
          const remainder = split.amountCents - baseCents * n;
          for (let i = 0; i < n; i++) {
            const groupAccountId = context.groupAccountIds[i];
            const amountCents = baseCents + (i < remainder ? 1 : 0);
            if (amountCents <= 0) continue;
            const eventId = context.metadata?.idempotencyKey
              ? createHash('sha256')
                  .update(`${context.metadata.idempotencyKey}:GROUP:${groupAccountId}:${i}`)
                  .digest('hex')
                  .slice(0, 36)
              : uuidv4();
            try {
              const transferResult = await transactionService.transfer(context.tenantId, {
                fromAccount: context.customerAccountId,
                toAccount: groupAccountId,
                amountCents,
                eventId,
                referenceType: 'economy_split_group',
                referenceId: eventId,
                metadata: {
                  ...context.metadata,
                  splitTargetType: split.rule.targetType,
                  splitDescription: split.rule.description,
                  splitPercentage: split.rule.percentage,
                  groupAccountId,
                  groupIndex: i,
                  totalGroups: n,
                },
                concept_id: 'group-contribution-payment',
              });

              result.splits.push({
                rule: split.rule,
                amountCents,
                transactionId: transferResult.transactionId,
              });

              try {
                const groupAccount = await runQueryWithTenant<{ group_id: string }>(
                  context.tenantId,
                  `
                  SELECT group_id FROM group_accounts WHERE account_id = $1 LIMIT 1
                  `,
                  [groupAccountId]
                );

                if (groupAccount) {
                  const outboxClient = await getClientWithTenant(context.tenantId);
                  try {
                    await outboxClient.query('BEGIN');
                    await insertEventOutboxRow(outboxClient, {
                      tenantId: context.tenantId,
                      eventId: deterministicGroupFundReceivedOutboxEventId(
                        transferResult.transactionId
                      ),
                      eventType: 'group.fund.received',
                      eventVersion: 1,
                      payload: {
                        groupId: groupAccount.group_id,
                        accountId: groupAccountId,
                        amountCents,
                        source: context.source,
                        transactionId: transferResult.transactionId,
                        assignmentId: context.metadata?.assignmentId,
                        jobId: context.metadata?.jobId,
                        workerUserId: context.metadata?.workerUserId,
                      },
                      metadata: {},
                    });
                    await outboxClient.query('COMMIT');
                  } catch (outboxErr) {
                    await outboxClient.query('ROLLBACK');
                    throw outboxErr;
                  } finally {
                    outboxClient.release();
                  }
                }
              } catch (error) {
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
                amountCents,
                err: error,
                'economy.action': 'split-error',
              }, `Error creating GROUP split transaction`);
              result.splits.push({
                rule: split.rule,
                amountCents,
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
          amountCents: split.amountCents,
          'economy.action': 'split-skipped',
        }, `Skipping split: no account found for target type ${split.rule.targetType}`);
        result.splits.push({
          rule: split.rule,
          amountCents: split.amountCents,
        });
        continue;
      }

      try {
        const splitIndex = result.splits.length;
        const eventId = context.metadata?.idempotencyKey
          ? createHash('sha256')
              .update(`${context.metadata.idempotencyKey}-${split.rule.targetType}-${splitIndex}`)
              .digest('hex')
              .slice(0, 32)
              .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
          : uuidv4();

        const transferResult = await transactionService.transfer(context.tenantId, {
          fromAccount: context.customerAccountId,
          toAccount: targetAccountId,
          amountCents: split.amountCents,
          eventId,
          referenceType: 'economy_split_transfer',
          referenceId: eventId,
          metadata: {
            ...context.metadata,
            splitTargetType: split.rule.targetType,
            splitDescription: split.rule.description,
            splitPercentage: split.rule.percentage,
          },
        });

        result.splits.push({
          rule: split.rule,
          amountCents: split.amountCents,
          transactionId: transferResult.transactionId,
        });

        splitLoggerService.logSplit({
          timestamp: new Date().toISOString(),
          module: context.metadata?.module || 'unknown',
          amountCents: split.amountCents,
          transactionId: transferResult.transactionId,
          tenantId: context.tenantId,
          splitTargetType: split.rule.targetType,
          splitPercentage: split.rule.percentage,
        });

        if (split.rule.targetType === 'REGION' && context.regionAccountId) {
          const regionId = context.metadata?.regionId || 'unknown';
          splitLoggerService.logRegionCredit({
            timestamp: new Date().toISOString(),
            module: context.metadata?.module || 'work',
            regionId,
            amountCents: split.amountCents,
            transactionId: transferResult.transactionId,
            tenantId: context.tenantId,
          });
        }
      } catch (error) {
        console.error({
          tenantId: context.tenantId,
          targetType: split.rule.targetType,
          targetAccountId,
          amountCents: split.amountCents,
          err: error,
          'economy.action': 'split-error',
        }, `Error creating split transaction for ${split.rule.targetType}`);
        result.splits.push({
          rule: split.rule,
          amountCents: split.amountCents,
        });
      }
    }

    // Log estruturado
    console.log({
      tenantId: context.tenantId,
      amountCents: context.amountCents,
      currency: context.currency,
      source: context.source,
      splitCount: result.splits.length,
      splits: result.splits.map((s) => ({
        targetType: s.rule.targetType,
        percentage: s.rule.percentage,
        amountCents: s.amountCents,
        transactionId: s.transactionId ?? null,
      })),
      'economy.action': 'apply-splits',
    }, 'Applied economic splits for transaction');

    return result;
  }
}

export const splitEngineService = new SplitEngineService();


