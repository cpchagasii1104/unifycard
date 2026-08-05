// backend/src/modules/policy-engine/policy-engine.service.ts
// Policy Engine Service - Avaliação e aplicação de políticas
// 🔴 BLINDAGEM: Nenhuma sanção automática
// 🔴 BLINDAGEM: Apenas gera recomendações e estados possíveis
// 🔴 BLINDAGEM: Todas as decisões são explícitas e humanas

import { policyRepository } from './policy.repository';
import type {
  PolicyRule,
  PolicyDecision,
  CreatePolicyInput,
  ApplyPolicyDecisionInput,
  RevokePolicyDecisionInput,
  PolicyEvaluationResult,
  PolicyFilters,
  PolicyDecisionFilters,
} from './policy.types';
import { NotFoundError, BadRequestError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class PolicyEngineService {
  /**
   * Cria uma nova política
   * 🔴 BLINDAGEM: Política criada como inativa (requer ativação explícita)
   */
  async createPolicy(tenantId: string, input: CreatePolicyInput, userId: string): Promise<PolicyRule> {
    // Validar ações
    if (!input.actions || input.actions.length === 0) {
      throw new BadRequestError('Política deve ter pelo menos uma ação');
    }

    // Criar política
    const policy = await policyRepository.createPolicy(tenantId, input);

    // Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'policy_created' as any,
      actorId: userId, // Usar userId como actorId temporário
      userId,
      contextType: 'risk_command_center' as any,
      contextId: policy.policyId,
      metadata: {
        policyId: policy.policyId,
        policyType: policy.policyType,
        actions: policy.actions,
      },
    });

    return policy;
  }

  /**
   * Lista políticas com filtros
   */
  async listPolicies(tenantId: string, filters: PolicyFilters = {}): Promise<PolicyRule[]> {
    return policyRepository.listPolicies(tenantId, filters);
  }

  /**
   * Busca política por ID
   */
  async getPolicy(tenantId: string, policyId: string): Promise<PolicyRule> {
    const policy = await policyRepository.findById(tenantId, policyId);
    if (!policy) {
      throw new NotFoundError('Política não encontrada');
    }
    return policy;
  }

  /**
   * Ativa uma política
   * 🔴 BLINDAGEM: Incrementa versão e marca como ativa (imutável após ativação)
   */
  async activatePolicy(tenantId: string, policyId: string, userId: string): Promise<PolicyRule> {
    const policy = await policyRepository.activatePolicy(tenantId, policyId, userId);

    // Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'policy_activated' as any,
      actorId: userId,
      userId,
      contextType: 'risk_command_center' as any,
      contextId: policyId,
      metadata: {
        policyId,
        version: policy.version,
      },
    });

    return policy;
  }

  /**
   * Desativa uma política
   */
  async deactivatePolicy(tenantId: string, policyId: string, userId: string): Promise<PolicyRule> {
    const policy = await policyRepository.deactivatePolicy(tenantId, policyId);

    // Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'policy_deactivated' as any,
      actorId: userId,
      userId,
      contextType: 'risk_command_center' as any,
      contextId: policyId,
      metadata: {
        policyId,
      },
    });

    return policy;
  }

  /**
   * Avalia políticas para um actor
   * 🔴 BLINDAGEM: Apenas avalia, nunca aplica automaticamente
   */
  async evaluatePoliciesForActor(
    tenantId: string,
    actorId: string
  ): Promise<PolicyEvaluationResult[]> {
    // Buscar todas as políticas ativas
    const activePolicies = await policyRepository.listPolicies(tenantId, {
      isActive: true,
      limit: 1000,
    });

    // Buscar perfil de risco do actor
    const { riskDashboardService } = await import('../risk-command-center/risk-dashboard.service');
    // 🔴 ANTES: `catch { return [] }` com o comentário "se não encontrar perfil, retornar
    // avaliações vazias". Num motor de política, lista vazia é **"nenhuma política se aplica"** —
    // a resposta PERMISSIVA. Qualquer erro de leitura do perfil de risco (não só "não encontrou")
    // virava liberação silenciosa. E o `catch` não distinguia as duas coisas: ausência de perfil e
    // falha ao ler o perfil chegavam ao mesmo `[]`.
    //
    // ALCANCE (medido 2026-08-05, `grep -rn "policyEngineService\." src`): **zero chamador vivo**.
    // Gravidade CONTIDA hoje; corrigido porque o motor é candidato natural a religamento.
    const riskProfile = await riskDashboardService.getActorRiskProfile(tenantId, actorId);

    // Buscar trust profile
    const { trustRepository } = await import('../trust/trust.repository');
    const trustProfile = await trustRepository.findByActor(tenantId, actorId);

    if (!trustProfile) {
      return [];
    }

    // Avaliar cada política
    const results: PolicyEvaluationResult[] = [];

    for (const policy of activePolicies) {
      const evaluation = this.evaluatePolicy(policy, riskProfile, trustProfile);
      if (evaluation.matches) {
        results.push(evaluation);
      }
    }

    return results;
  }

  /**
   * Avalia uma política específica contra um perfil de risco
   * 🔴 BLINDAGEM: Determinístico, sem heurística opaca
   */
  private evaluatePolicy(
    policy: PolicyRule,
    riskProfile: any,
    trustProfile: any
  ): PolicyEvaluationResult {
    const matchedConditions: string[] = [];
    let matches = true;

    const conditions = policy.conditions;

    // Verificar minRiskLevel
    if (conditions.minRiskLevel) {
      const riskLevelOrder: Record<string, number> = {
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
        BLOCKED: 4,
      };
      const actorRiskOrder = riskLevelOrder[riskProfile.riskLevel] || 0;
      const minRiskOrder = riskLevelOrder[conditions.minRiskLevel] || 0;

      if (actorRiskOrder >= minRiskOrder) {
        matchedConditions.push(`Risk Level >= ${conditions.minRiskLevel}`);
      } else {
        matches = false;
      }
    }

    // Verificar maxTrustScore
    if (conditions.maxTrustScore !== undefined) {
      if (trustProfile.currentScore <= conditions.maxTrustScore) {
        matchedConditions.push(`Trust Score <= ${conditions.maxTrustScore}`);
      } else {
        matches = false;
      }
    }

    // Verificar minTrustScore
    if (conditions.minTrustScore !== undefined) {
      if (trustProfile.currentScore >= conditions.minTrustScore) {
        matchedConditions.push(`Trust Score >= ${conditions.minTrustScore}`);
      } else {
        matches = false;
      }
    }

    // Verificar hasOpenDisputes
    if (conditions.hasOpenDisputes !== undefined) {
      if (riskProfile.openDisputes > 0 === conditions.hasOpenDisputes) {
        matchedConditions.push(`Has Open Disputes: ${conditions.hasOpenDisputes}`);
      } else {
        matches = false;
      }
    }

    // Verificar bypassDetectedLast30Days
    if (conditions.bypassDetectedLast30Days !== undefined) {
      if (riskProfile.bypassDetected.last30Days >= conditions.bypassDetectedLast30Days) {
        matchedConditions.push(`Bypass (30d) >= ${conditions.bypassDetectedLast30Days}`);
      } else {
        matches = false;
      }
    }

    // Verificar bypassDetectedLast90Days
    if (conditions.bypassDetectedLast90Days !== undefined) {
      if (riskProfile.bypassDetected.last90Days >= conditions.bypassDetectedLast90Days) {
        matchedConditions.push(`Bypass (90d) >= ${conditions.bypassDetectedLast90Days}`);
      } else {
        matches = false;
      }
    }

    // Verificar financialVolumeCents
    if (conditions.financialVolumeCents !== undefined) {
      if (riskProfile.financialVolumeCents >= conditions.financialVolumeCents) {
        matchedConditions.push(`Financial Volume >= ${conditions.financialVolumeCents}`);
      } else {
        matches = false;
      }
    }

    // Determinar severidade baseada no risk level
    const severityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      BLOCKED: 'CRITICAL',
    };
    const severity = severityMap[riskProfile.riskLevel] || 'MEDIUM';

    // Gerar explicação
    const explanation = matches
      ? `Política "${policy.name}" corresponde ao perfil de risco do actor. Condições atendidas: ${matchedConditions.join(', ')}.`
      : `Política "${policy.name}" não corresponde ao perfil de risco do actor.`;

    return {
      policyId: policy.policyId,
      policyName: policy.name,
      policyVersion: policy.version,
      matches,
      matchedConditions,
      recommendedActions: matches ? policy.actions : [],
      severity,
      explanation,
    };
  }

  /**
   * Aplica uma decisão de política manualmente
   * 🔴 BLINDAGEM: Requer confirmação explícita e cria Evidence Pack
   */
  async applyPolicyDecision(
    tenantId: string,
    input: ApplyPolicyDecisionInput,
    userId: string,
    actorId: string
  ): Promise<PolicyDecision> {
    // Buscar política
    const policy = await this.getPolicy(tenantId, input.policyId);
    if (!policy.isActive) {
      throw new BadRequestError('Política deve estar ativa para aplicar decisão');
    }

    // Criar Evidence Pack
    const { evidenceService } = await import('../evidence/evidence.service');
    const { randomUUID } = await import('crypto');
    const evidencePack = await evidenceService.getOrCreatePack(tenantId, {
      contextType: 'risk_command_center' as any,
      contextId: input.actorId,
    });

    // Registrar evento no Evidence Pack
    await evidenceService.addEvent(tenantId, evidencePack.packId, {
      eventId: randomUUID(),
      eventType: 'policy_decision_applied' as any,
      timestamp: new Date(),
      actorId,
      userId,
      data: {
        policyId: input.policyId,
        policyVersion: policy.version,
        actions: policy.actions,
        reason: input.reason,
        expiresAt: input.expiresAt,
      },
      source: 'system',
      sourceId: input.policyId,
    });

    // Criar decisão
    const decision = await policyRepository.createDecision(
      tenantId,
      input,
      userId,
      actorId,
      evidencePack.packId
    );

    // Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'policy_decision_applied' as any,
      actorId,
      userId,
      contextType: 'risk_command_center' as any,
      contextId: input.actorId,
      metadata: {
        decisionId: decision.decisionId,
        policyId: input.policyId,
        policyVersion: policy.version,
        actions: policy.actions,
      },
    });

    return decision;
  }

  /**
   * Lista decisões com filtros
   */
  async listDecisions(tenantId: string, filters: PolicyDecisionFilters = {}): Promise<PolicyDecision[]> {
    return policyRepository.listDecisions(tenantId, filters);
  }

  /**
   * Busca decisão por ID
   */
  async getDecision(tenantId: string, decisionId: string): Promise<PolicyDecision> {
    const decision = await policyRepository.findDecisionById(tenantId, decisionId);
    if (!decision) {
      throw new NotFoundError('Decisão não encontrada');
    }
    return decision;
  }

  /**
   * Revoga uma decisão
   * 🔴 BLINDAGEM: Reversão explícita, registra no Evidence Pack
   */
  async revokeDecision(
    tenantId: string,
    decisionId: string,
    userId: string,
    actorId: string,
    revocationReason: string
  ): Promise<PolicyDecision> {
    // Buscar decisão
    const decision = await this.getDecision(tenantId, decisionId);
    if (decision.status !== 'ACTIVE') {
      throw new BadRequestError('Apenas decisões ativas podem ser revogadas');
    }

    // Registrar no Evidence Pack se existir
    if (decision.evidencePackId) {
      const { evidenceService } = await import('../evidence/evidence.service');
      const { randomUUID } = await import('crypto');
      await evidenceService.addEvent(tenantId, decision.evidencePackId, {
        eventId: randomUUID(),
        eventType: 'policy_decision_revoked' as any,
        timestamp: new Date(),
        actorId,
        userId,
        data: {
          decisionId: decision.decisionId,
          revocationReason,
        },
        source: 'system',
        sourceId: decision.decisionId,
      });
    }

    // Revogar decisão
    const revoked = await policyRepository.revokeDecision(
      tenantId,
      decisionId,
      userId,
      actorId,
      revocationReason
    );

    // Registrar auditoria
    await recordBusinessAuditSafely(tenantId, {
      action: 'policy_decision_revoked' as any,
      actorId,
      userId,
      contextType: 'risk_command_center' as any,
      contextId: decision.actorId,
      metadata: {
        decisionId: decision.decisionId,
        policyId: decision.policyId,
        revocationReason,
      },
    });

    return revoked;
  }

  /**
   * Busca decisões ativas para um actor
   */
  async getActiveDecisionsForActor(tenantId: string, actorId: string): Promise<PolicyDecision[]> {
    return policyRepository.getActiveDecisionsForActor(tenantId, actorId);
  }
}

export const policyEngineService = new PolicyEngineService();




