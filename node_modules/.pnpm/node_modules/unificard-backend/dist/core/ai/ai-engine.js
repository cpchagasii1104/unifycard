"use strict";
/**
 * AI Development Kernel - Engine
 *
 * Responsável por processar prompts internos e gerar raciocínios/ações
 * baseados no contexto do projeto Unificard.
 */
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
exports.AIEngine = void 0;
const ai_context_1 = require("./ai-context");
const tenant_service_1 = require("../tenants/tenant.service");
const world_service_1 = require("../world/services/world.service");
const identity_service_1 = require("../identity/identity.service");
const residence_service_1 = require("../residence/residence.service");
const root_config_service_1 = require("../root-config/root-config.service");
class AIEngine {
    context;
    constructor() {
        this.context = (0, ai_context_1.loadAIContext)();
    }
    /**
     * Processa um prompt interno e gera raciocínio baseado no contexto
     */
    async think(prompt, tenantId) {
        const reasoning = [];
        const suggestions = [];
        let contextWithRegion = { ...this.context };
        // Extrair globalUserId do prompt se disponível (formato: "globalUserId:xxx")
        const globalUserIdMatch = prompt.match(/globalUserId[:\s]+([a-f0-9-]+)/i);
        const globalUserId = globalUserIdMatch ? globalUserIdMatch[1] : null;
        // Detectar região com prioridade: user_residence > tenant.region > root-config
        let detectedRegion;
        // 1. Tentar user_residence (se globalUserId disponível)
        if (globalUserId) {
            try {
                const residence = await residence_service_1.residenceService.getResidenceWithDetails(globalUserId);
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
            }
            catch (error) {
                // Silenciosamente ignora erros
            }
        }
        // 2. Se não tem user_residence, tentar tenant.region
        if (!detectedRegion && tenantId) {
            try {
                const tenant = await tenant_service_1.tenantService.getTenantById(tenantId);
                if (tenant?.cityId) {
                    const cityPath = await world_service_1.worldService.getCityFullPath(tenant.cityId);
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
            }
            catch (error) {
                // Silenciosamente ignora erros
            }
        }
        // 3. Se ainda não tem, usar root-config
        if (!detectedRegion) {
            try {
                const rootConfig = await root_config_service_1.rootConfigService.getConfig();
                if (rootConfig?.cityId) {
                    const cityPath = await world_service_1.worldService.getCityFullPath(rootConfig.cityId);
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
            }
            catch (error) {
                // Silenciosamente ignora erros
            }
        }
        if (detectedRegion) {
            contextWithRegion.region = detectedRegion;
        }
        // Se globalUserId detectado, buscar dados do perfil global e reputação
        if (globalUserId) {
            try {
                const globalUser = await identity_service_1.identityService.getGlobalIdentity(globalUserId);
                if (globalUser) {
                    contextWithRegion.globalUser = {
                        globalUserId: globalUser.globalUserId,
                        fullName: globalUser.fullName,
                        avatarUrl: globalUser.avatarUrl,
                    };
                    reasoning.push(`Identidade global detectada: ${globalUser.fullName || globalUser.globalUserId}`);
                    // Buscar snapshot de reputação
                    try {
                        const { reputationService } = await Promise.resolve().then(() => __importStar(require('../reputation/reputation.service')));
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
                    }
                    catch (error) {
                        // Silenciosamente ignora erros ao buscar reputação
                    }
                    // Buscar snapshot de wallet
                    try {
                        const { accountService } = await Promise.resolve().then(() => __importStar(require('../economy/accounts/account.service')));
                        const { transactionService } = await Promise.resolve().then(() => __importStar(require('../economy/transactions/transaction.service')));
                        const accounts = await accountService.getAccountsByGlobalUserId(globalUserId);
                        if (accounts.length > 0) {
                            const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
                            const transactions = await transactionService.getTransactionsByGlobalUserId(globalUserId, { limit: 3 });
                            contextWithRegion.wallet = {
                                balance: primaryAccount.balance,
                                currency: primaryAccount.currency,
                                lastTransactions: transactions.slice(0, 3).map(tx => ({
                                    transactionId: tx.transactionId,
                                    type: tx.toGlobalUserId === globalUserId ? 'credit' : 'debit',
                                    amount: tx.amount,
                                })),
                            };
                            reasoning.push(`Wallet detectada: saldo ${primaryAccount.currency} ${primaryAccount.balance.toFixed(2)}`);
                        }
                    }
                    catch (error) {
                        // Silenciosamente ignora erros ao buscar wallet
                    }
                }
            }
            catch (error) {
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
    getContext() {
        return this.context;
    }
    /**
     * Valida se uma proposta está alinhada com o contexto do projeto
     */
    validateProposal(proposal) {
        const reasons = [];
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
exports.AIEngine = AIEngine;
//# sourceMappingURL=ai-engine.js.map