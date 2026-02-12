"use strict";
// src/modules/social/social-votes.service.ts
// Serviço para gerenciar votações em posts
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
exports.socialVotesService = exports.SocialVotesService = void 0;
const pool_1 = require("@core/database/pool");
class SocialVotesService {
    /**
     * Registra voto de um actor em um post
     * REGRA: Uma pessoa = um voto (enforced por UNIQUE constraint)
     */
    async castVote(tenantId, postId, actorId, optionIndex, userId) {
        try {
            // Verificar se post existe e é do tipo 'vote'
            const post = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT intent, intent_metadata
        FROM posts
        WHERE post_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [postId, tenantId]);
            if (!post) {
                return { success: false, message: 'Post não encontrado' };
            }
            if (post.intent !== 'vote') {
                return { success: false, message: 'Post não é uma votação' };
            }
            // Verificar se votação está fechada
            const metadata = typeof post.intent_metadata === 'string'
                ? JSON.parse(post.intent_metadata)
                : post.intent_metadata;
            if (metadata.closesAt) {
                const closesAt = new Date(metadata.closesAt);
                if (new Date() > closesAt) {
                    return { success: false, message: 'Votação já está fechada' };
                }
            }
            // Verificar se opção é válida
            if (!metadata.options || !Array.isArray(metadata.options)) {
                return { success: false, message: 'Opções de votação inválidas' };
            }
            if (optionIndex < 0 || optionIndex >= metadata.options.length) {
                return { success: false, message: 'Opção inválida' };
            }
            // REGRA: Verificar se actor é empresa PROVISIONAL (não pode votar)
            const actor = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT actor_type, company_id
        FROM actors
        WHERE actor_id = $1 AND tenant_id = $2
        LIMIT 1
        `, [actorId, tenantId]);
            // FASE 11: Verificar permissões baseadas em reputação
            let companyStatus = undefined;
            if (actor && actor.actor_type === 'page' && actor.company_id) {
                const company = await (0, pool_1.runQueryWithTenant)(tenantId, `
          SELECT company_status FROM companies
          WHERE company_id = $1 AND tenant_id = $2
          LIMIT 1
          `, [actor.company_id, tenantId]);
                if (company) {
                    companyStatus = company.company_status;
                }
            }
            // 🔴 BLINDAGEM: Verificar permissão via authorization.service (Core de Decisão)
            // Decisão FINAL de autorização deve passar por authorizationService.canActAs()
            // reputationService.getPermissions() retorna apenas MÉTRICAS/INPUT, não decisão
            if (userId) {
                const { authorizationService } = await Promise.resolve().then(() => __importStar(require('@core/authorization/authorization.service')));
                const auth = await authorizationService.canActAs(tenantId, userId, actorId, 'cast_vote');
                if (!auth.allowed) {
                    if (actor.actor_type === 'page' && companyStatus === 'PROVISIONAL') {
                        return {
                            success: false,
                            message: 'Empresas em validação não podem votar em votações públicas. Complete a validação presencial para habilitar esta funcionalidade.'
                        };
                    }
                    return {
                        success: false,
                        message: auth.reason || 'Você não tem permissão para votar. Continue usando a plataforma para desbloquear esta funcionalidade.'
                    };
                }
            }
            // Inserir voto (UNIQUE constraint garante uma pessoa = um voto)
            try {
                await (0, pool_1.runQueryWithTenant)(tenantId, `
          INSERT INTO post_votes (post_id, tenant_id, actor_id, option_index)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (post_id, actor_id) DO UPDATE
          SET option_index = EXCLUDED.option_index
          `, [postId, tenantId, actorId, optionIndex]);
            }
            catch (err) {
                // Se erro de constraint, já votou (mas atualiza o voto)
                if (err.code === '23505') {
                    // Já existe, atualizar
                    await (0, pool_1.runQueryWithTenant)(tenantId, `
            UPDATE post_votes
            SET option_index = $4
            WHERE post_id = $1 AND actor_id = $3
            `, [postId, tenantId, actorId, optionIndex]);
                }
                else {
                    throw err;
                }
            }
            return { success: true };
        }
        catch (error) {
            console.error('Erro ao registrar voto:', error);
            return { success: false, message: 'Erro ao registrar voto' };
        }
    }
    /**
     * Busca resultados de uma votação
     */
    async getVoteResults(tenantId, postId) {
        try {
            // Buscar post e metadata
            const post = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT intent_metadata
        FROM posts
        WHERE post_id = $1 AND tenant_id = $2 AND intent = 'vote'
        LIMIT 1
        `, [postId, tenantId]);
            if (!post) {
                return null;
            }
            const metadata = typeof post.intent_metadata === 'string'
                ? JSON.parse(post.intent_metadata)
                : post.intent_metadata;
            if (!metadata.options || !Array.isArray(metadata.options)) {
                return null;
            }
            // Buscar contagem de votos por opção
            const votes = await (0, pool_1.runQueriesWithTenant)(tenantId, `
        SELECT option_index, COUNT(*) as count
        FROM post_votes
        WHERE post_id = $1 AND tenant_id = $2
        GROUP BY option_index
        `, [postId, tenantId]);
            // Calcular totais
            const totalVotes = votes.reduce((sum, v) => sum + parseInt(v.count, 10), 0);
            // Mapear opções com contagem
            const options = metadata.options.map((text, index) => {
                const voteCount = votes.find((v) => v.option_index === index);
                const count = voteCount ? parseInt(voteCount.count, 10) : 0;
                const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                return {
                    index,
                    text,
                    count,
                    percentage,
                };
            });
            // Verificar se está fechada
            const closesAt = metadata.closesAt;
            const isClosed = closesAt ? new Date() > new Date(closesAt) : false;
            return {
                options,
                total_votes: totalVotes,
                closesAt: closesAt,
                is_closed: isClosed,
            };
        }
        catch (error) {
            console.error('Erro ao buscar resultados de votação:', error);
            return null;
        }
    }
    /**
     * Verifica se um actor já votou
     */
    async hasVoted(tenantId, postId, actorId) {
        try {
            const vote = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT vote_id
        FROM post_votes
        WHERE post_id = $1 AND actor_id = $2 AND tenant_id = $3
        LIMIT 1
        `, [postId, actorId, tenantId]);
            return !!vote;
        }
        catch (error) {
            console.error('Erro ao verificar voto:', error);
            return false;
        }
    }
}
exports.SocialVotesService = SocialVotesService;
exports.socialVotesService = new SocialVotesService();
