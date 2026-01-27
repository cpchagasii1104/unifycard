/**
 * AI Development Kernel - Engine
 * 
 * Responsável por processar prompts internos e gerar raciocínios/ações
 * baseados no contexto do projeto Unificard.
 */

import { loadAIContext, AIContext } from "./ai-context";
import { tenantService } from "../tenants/tenant.service";
import { worldService } from "../world/services/world.service";
import { identityService } from "../identity/identity.service";
import { residenceService } from "../residence/residence.service";
import { rootConfigService } from "../root-config/root-config.service";

export interface AIThought {
  prompt: string;
  context: AIContext;
  reasoning: string[];
  suggestions: string[];
  result: any;
}

export class AIEngine {
  private context: AIContext;

  constructor() {
    this.context = loadAIContext();
  }

  /**
   * Processa um prompt interno e gera raciocínio baseado no contexto
   */
  async think(prompt: string, tenantId?: string): Promise<AIThought> {
    const reasoning: string[] = [];
    const suggestions: string[] = [];
    let contextWithRegion = { ...this.context };

    // Extrair globalUserId do prompt se disponível (formato: "globalUserId:xxx")
    const globalUserIdMatch = prompt.match(/globalUserId[:\s]+([a-f0-9-]+)/i);
    const globalUserId = globalUserIdMatch ? globalUserIdMatch[1] : null;

    // Detectar região com prioridade: user_residence > tenant.region > root-config
    let detectedRegion: AIContext['region'] | undefined;

    // 1. Tentar user_residence (se globalUserId disponível)
    if (globalUserId) {
      try {
        const residence = await residenceService.getResidenceWithDetails(globalUserId);
        if (residence?.city) {
          detectedRegion = {
            country: residence.country ? {
              countryId: residence.country.countryId,
              name: residence.country.name,
              code: residence.country.code,
            } : undefined,
            state: residence.state ? {
              stateId: residence.state.stateId,
              name: residence.state.name,
              code: residence.state.code,
            } : undefined,
            city: {
              cityId: residence.city.cityId,
              name: residence.city.name,
            },
          };
          reasoning.push(`Região detectada (residência digital): ${residence.city.name}, ${residence.state?.name || ''}, ${residence.country?.name || ''}`);
        }
      } catch (error) {
        // Silenciosamente ignora erros
      }
    }

    // 2. Se não tem user_residence, tentar tenant.region
    if (!detectedRegion && tenantId) {
      try {
        const tenant = await tenantService.getTenantById(tenantId);
        if (tenant?.cityId) {
          const cityPath = await worldService.getCityFullPath(tenant.cityId);
          if (cityPath) {
            detectedRegion = {
              country: {
                countryId: cityPath.country.countryId,
                name: cityPath.country.name,
                code: cityPath.country.code,
              },
              state: {
                stateId: cityPath.state.stateId,
                name: cityPath.state.name,
                code: cityPath.state.code,
              },
              city: {
                cityId: cityPath.city.cityId,
                name: cityPath.city.name,
              },
            };
            reasoning.push(`Região detectada (tenant): ${cityPath.city.name}, ${cityPath.state.name}, ${cityPath.country.name}`);
          }
        }
      } catch (error) {
        // Silenciosamente ignora erros
      }
    }

    // 3. Se ainda não tem, usar root-config
    if (!detectedRegion) {
      try {
        const rootConfig = await rootConfigService.getConfig();
        if (rootConfig?.cityId) {
          const cityPath = await worldService.getCityFullPath(rootConfig.cityId);
          if (cityPath) {
            detectedRegion = {
              country: {
                countryId: cityPath.country.countryId,
                name: cityPath.country.name,
                code: cityPath.country.code,
              },
              state: {
                stateId: cityPath.state.stateId,
                name: cityPath.state.name,
                code: cityPath.state.code,
              },
              city: {
                cityId: cityPath.city.cityId,
                name: cityPath.city.name,
              },
            };
            reasoning.push(`Região detectada (root-config): ${cityPath.city.name}, ${cityPath.state.name}, ${cityPath.country.name}`);
          }
        }
      } catch (error) {
        // Silenciosamente ignora erros
      }
    }

    if (detectedRegion) {
      contextWithRegion.region = detectedRegion;
    }

    // Se globalUserId detectado, buscar dados do perfil global e reputação
    if (globalUserId) {
      try {
        const globalUser = await identityService.getGlobalIdentity(globalUserId);
        if (globalUser) {
          contextWithRegion.globalUser = {
            globalUserId: globalUser.globalUserId,
            fullName: globalUser.fullName,
            avatarUrl: globalUser.avatarUrl,
          };
          reasoning.push(`Identidade global detectada: ${globalUser.fullName || globalUser.globalUserId}`);

          // Buscar snapshot de reputação
          try {
            const { reputationService } = await import('../reputation/reputation.service');
            const reputation = await reputationService.getScoreByGlobalUserId(globalUserId);
            if (reputation) {
              contextWithRegion.reputation = {
                globalScore: reputation.scores.global,
                workScore: reputation.scores.work,
                ridesScore: reputation.scores.rides,
                eventsScore: reputation.scores.events,
                commerceScore: reputation.scores.commerce,
              };
              reasoning.push(`Reputação detectada: score global ${reputation.scores.global.toFixed(2)}`);
            }
          } catch (error) {
            // Silenciosamente ignora erros ao buscar reputação
          }

          // Buscar snapshot de wallet
          try {
            const { accountService } = await import('../economy/accounts/account.service');
            const { transactionService } = await import('../economy/transactions/transaction.service');
            const accounts = await accountService.getAccountsByGlobalUserId(globalUserId);
            
            if (accounts.length > 0) {
              const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
              const transactions = await transactionService.getTransactionsByGlobalUserId(globalUserId, { limit: 3 });
              
              contextWithRegion.wallet = {
                balance: primaryAccount.balance,
                currency: primaryAccount.currency,
                lastTransactions: transactions.slice(0, 3).map(tx => ({
                  transactionId: tx.transactionId,
                  type: tx.toGlobalUserId === globalUserId ? 'credit' as const : 'debit' as const,
                  amount: tx.amount,
                })),
              };
              reasoning.push(`Wallet detectada: saldo ${primaryAccount.currency} ${primaryAccount.balance.toFixed(2)}`);
            }
          } catch (error) {
            // Silenciosamente ignora erros ao buscar wallet
          }
        }
      } catch (error) {
        // Silenciosamente ignora erros ao buscar identidade global
      }
    }

    // Análise básica do prompt
    reasoning.push(`Processando prompt: "${prompt}"`);
    reasoning.push(`Contexto do projeto: ${contextWithRegion.projectName} v${contextWithRegion.version}`);
    reasoning.push(`Domínios relevantes: ${contextWithRegion.domain.join(", ")}`);

    // Validações baseadas no contexto
    if (prompt.toLowerCase().includes("module") || prompt.toLowerCase().includes("módulo")) {
      reasoning.push("Prompt relacionado a módulos - verificando estrutura core/ e modules/");
      suggestions.push("Garantir que módulos seguem padrão multi-tenant");
      suggestions.push("Verificar integração com Economy e Reputation");
    }

    if (prompt.toLowerCase().includes("architecture") || prompt.toLowerCase().includes("arquitetura")) {
      reasoning.push("Prompt relacionado a arquitetura - analisando estrutura atual");
      suggestions.push(`Core modules: ${this.context.architecture.core.join(", ")}`);
      suggestions.push(`Business modules: ${this.context.architecture.modules.join(", ")}`);
    }

    if (prompt.toLowerCase().includes("code") || prompt.toLowerCase().includes("código")) {
      reasoning.push("Prompt relacionado a código - aplicando regras do projeto");
      suggestions.push(`Linguagem: ${this.context.rules.language}`);
      suggestions.push(`Banco: ${this.context.rules.database}`);
      suggestions.push("Sempre considerar multi-tenant e contexto de usuário");
    }

    return {
      prompt,
      context: contextWithRegion,
      reasoning,
      suggestions,
      result: "AI internal reasoning placeholder - será expandido com lógica mais sofisticada"
    };
  }

  /**
   * Retorna o contexto atual do projeto
   */
  getContext(): AIContext {
    return this.context;
  }

  /**
   * Valida se uma proposta está alinhada com o contexto do projeto
   */
  validateProposal(proposal: string): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let valid = true;

    // Verificar multi-tenant
    if (!proposal.toLowerCase().includes("tenant") && 
        (proposal.toLowerCase().includes("create") || proposal.toLowerCase().includes("criar"))) {
      reasons.push("Atenção: proposta pode não considerar multi-tenant");
      valid = false;
    }

    // Verificar estrutura core/ vs modules/
    if (proposal.toLowerCase().includes("module") && 
        !proposal.toLowerCase().includes("core/") && 
        !proposal.toLowerCase().includes("modules/")) {
      reasons.push("Atenção: proposta deve especificar se é core/ ou modules/");
    }

    return { valid, reasons };
  }
}

