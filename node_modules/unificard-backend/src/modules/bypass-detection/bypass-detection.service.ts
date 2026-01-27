// backend/src/modules/bypass-detection/bypass-detection.service.ts
// Service de Anti-Bypass & Off-Platform Detection
// 🔴 BLINDAGEM: Regras determinísticas, não heurísticas
// 🔴 BLINDAGEM: Nenhuma detecção sem evidência

import type {
  RegisterBypassDetectionInput,
  MessageAnalysisResult,
  ValueAnalysisResult,
  BypassSignalType,
  BypassSignalSeverity,
} from './bypass-detection.types';
import {
  OFF_PLATFORM_CONTACT_PATTERNS,
  OFF_PLATFORM_KEYWORDS,
  BYPASS_SEVERITY_THRESHOLDS,
} from './bypass-detection.types';
import { BadRequestError } from '@core/errors';
import { recordBusinessAuditSafely } from '../business-audit/business-audit.helpers';

class BypassDetectionService {
  /**
   * Analisa mensagem para detectar contatos off-platform e palavras-chave
   * 🔴 BLINDAGEM: Análise determinística baseada em padrões exatos
   */
  analyzeMessage(messageContent: string): MessageAnalysisResult {
    const detectedContacts: string[] = [];
    const detectedKeywords: string[] = [];

    // Detectar contatos off-platform
    for (const pattern of OFF_PLATFORM_CONTACT_PATTERNS) {
      const matches = messageContent.match(pattern);
      if (matches) {
        detectedContacts.push(...matches);
      }
    }

    // Detectar palavras-chave
    const lowerContent = messageContent.toLowerCase();
    for (const keyword of OFF_PLATFORM_KEYWORDS) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        detectedKeywords.push(keyword);
      }
    }

    const hasOffPlatformContact = detectedContacts.length > 0;
    const hasOffPlatformKeywords = detectedKeywords.length > 0;

    // Determinar severidade
    let severity: BypassSignalSeverity = 'LOW';
    if (hasOffPlatformContact && hasOffPlatformKeywords) {
      severity = 'HIGH';
    } else if (hasOffPlatformContact || hasOffPlatformKeywords) {
      severity = 'MEDIUM';
    }

    return {
      hasOffPlatformContact,
      hasOffPlatformKeywords,
      detectedContacts: [...new Set(detectedContacts)], // Remover duplicatas
      detectedKeywords: [...new Set(detectedKeywords)],
      severity,
    };
  }

  /**
   * Analisa divergência de valores
   * 🔴 BLINDAGEM: Cálculo determinístico baseado em diferença percentual
   */
  analyzeValueMismatch(detectedValue: number, expectedValue: number): ValueAnalysisResult {
    if (expectedValue === 0) {
      return {
        hasMismatch: detectedValue !== 0,
        detectedValue,
        expectedValue,
        difference: detectedValue,
        percentageDifference: detectedValue > 0 ? Infinity : 0,
        severity: 'HIGH',
      };
    }

    const difference = Math.abs(detectedValue - expectedValue);
    const percentageDifference = difference / expectedValue;

    // Determinar severidade baseado em thresholds
    let severity: BypassSignalSeverity = 'LOW';
    if (percentageDifference >= BYPASS_SEVERITY_THRESHOLDS.VALUE_MISMATCH.HIGH) {
      severity = 'HIGH';
    } else if (percentageDifference >= BYPASS_SEVERITY_THRESHOLDS.VALUE_MISMATCH.MEDIUM) {
      severity = 'MEDIUM';
    }

    return {
      hasMismatch: difference > 0,
      detectedValue,
      expectedValue,
      difference,
      percentageDifference,
      severity,
    };
  }

  /**
   * Registra detecção de bypass
   * 🔴 BLINDAGEM: Sempre requer evidencePackId
   */
  async registerBypassDetection(
    tenantId: string,
    input: RegisterBypassDetectionInput
  ): Promise<{ eventId: string; trustImpact: number }> {
    // Validar que evidence pack existe
    const { evidenceService } = await import('../evidence/evidence.service');
    try {
      await evidenceService.getPack(tenantId, input.evidencePackId);
    } catch (err) {
      throw new BadRequestError('Evidence pack não encontrado. Toda detecção de bypass requer evidência.');
    }

    const { randomUUID } = await import('crypto');
    const eventId = randomUUID();

    // Adicionar evento ao Evidence Pack
    await evidenceService.addEvent(tenantId, input.evidencePackId, {
      eventId,
      eventType: 'bypass_detected' as any, // Tipo customizado para bypass
      timestamp: new Date(),
      actorId: input.actorId,
      userId: null,
      data: {
        signalType: input.signalType,
        severity: input.severity,
        detectedValue: input.detectedValue,
        expectedValue: input.expectedValue,
        messageContent: input.messageContent,
        metadata: input.metadata,
      },
      source: 'bypass_detection',
      sourceId: eventId,
    });

    // Registrar no Trust Engine
    const { trustEngineService } = await import('../trust/trust-engine.service');
    
    // Determinar tipo de evento de trust baseado no sinal
    let trustEventType: 'off_platform_signal_detected' | 'agreement_bypass_attempted' | 'escrow_bypass_attempted' | 'bypass_attempt_detected' | 'off_platform_contact_shared';
    let trustScoreImpact: number;

    switch (input.signalType) {
      case 'value_mismatch':
      case 'missing_agreement':
        trustEventType = 'agreement_bypass_attempted';
        trustScoreImpact = -10; // Primeira ocorrência
        break;
      case 'off_platform_contact':
        trustEventType = 'off_platform_contact_shared';
        trustScoreImpact = -10; // Primeira ocorrência
        break;
      case 'off_platform_keyword':
        trustEventType = 'off_platform_signal_detected';
        trustScoreImpact = -10; // Primeira ocorrência
        break;
      default:
        trustEventType = 'bypass_attempt_detected';
        trustScoreImpact = -5; // Severidade menor
    }

    // Verificar se é segunda ocorrência (penalidade maior)
    const trustProfile = await trustEngineService.getTrustProfile(tenantId, input.actorId);
    const recentEvents = await trustEngineService.listTrustEvents(tenantId, {
      actorId: input.actorId,
      eventType: trustEventType,
      limit: 10,
    });

    // Se já houve ocorrência recente (últimas 30 dias), aumentar penalidade
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentBypassEvents = recentEvents.filter(
      (e) => new Date(e.createdAt) > thirtyDaysAgo
    );

    if (recentBypassEvents.length >= 1) {
      // Segunda ocorrência: penalidade maior
      trustScoreImpact = -25;
    }

    // Registrar evento de trust
    await trustEngineService.registerTrustEvent(tenantId, {
      actorId: input.actorId,
      eventType: trustEventType,
      severity: input.severity === 'HIGH' ? 'HIGH' : input.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW',
      contextType: input.contextType,
      contextId: input.contextId,
      evidencePackId: input.evidencePackId,
      metadata: {
        bypassSignalType: input.signalType,
        detectedValue: input.detectedValue,
        expectedValue: input.expectedValue,
        messageContent: input.messageContent,
      },
    });

    // Registrar audit log
    await recordBusinessAuditSafely(tenantId, {
      action: 'bypass_detected',
      actorId: input.actorId,
      userId: null,
      contextType: input.contextType as any,
      contextId: input.contextId,
      metadata: {
        signalType: input.signalType,
        severity: input.severity,
        trustScoreImpact,
        eventId,
      },
    });

    return {
      eventId,
      trustImpact: trustScoreImpact,
    };
  }

  /**
   * Detecta tentativa de bypass em valor
   */
  async detectValueBypass(
    tenantId: string,
    actorId: string,
    detectedValue: number,
    expectedValue: number,
    contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement',
    contextId: string
  ): Promise<{ detected: boolean; eventId?: string }> {
    const analysis = this.analyzeValueMismatch(detectedValue, expectedValue);

    if (!analysis.hasMismatch) {
      return { detected: false };
    }

    // Buscar evidence pack do contexto
    const { evidenceService } = await import('../evidence/evidence.service');
    const evidencePack = await evidenceService.getPackByContext(tenantId, contextType, contextId);

    if (!evidencePack) {
      // Se não houver evidence pack, criar um
      const newPack = await evidenceService.getOrCreatePack(tenantId, {
        contextType,
        contextId,
      });
      const result = await this.registerBypassDetection(tenantId, {
        actorId,
        signalType: 'value_mismatch',
        severity: analysis.severity,
        contextType,
        contextId,
        evidencePackId: newPack.packId,
        detectedValue,
        expectedValue,
        metadata: {
          difference: analysis.difference,
          percentageDifference: analysis.percentageDifference,
        },
      });
      return { detected: true, eventId: result.eventId };
    }

    const result = await this.registerBypassDetection(tenantId, {
      actorId,
      signalType: 'value_mismatch',
      severity: analysis.severity,
      contextType,
      contextId,
      evidencePackId: evidencePack.packId,
      detectedValue,
      expectedValue,
      metadata: {
        difference: analysis.difference,
        percentageDifference: analysis.percentageDifference,
      },
    });

    return { detected: true, eventId: result.eventId };
  }

  /**
   * Detecta tentativa de bypass em mensagem
   */
  async detectMessageBypass(
    tenantId: string,
    actorId: string,
    messageContent: string,
    contextType: 'event' | 'booking' | 'bundle' | 'service_order' | 'agreement' | 'thread',
    contextId: string
  ): Promise<{ detected: boolean; eventId?: string; signalType?: BypassSignalType }> {
    const analysis = this.analyzeMessage(messageContent);

    if (!analysis.hasOffPlatformContact && !analysis.hasOffPlatformKeywords) {
      return { detected: false };
    }

    // Buscar evidence pack do contexto
    const { evidenceService } = await import('../evidence/evidence.service');
    const evidencePack = await evidenceService.getPackByContext(tenantId, contextType, contextId);

    if (!evidencePack) {
      // Se não houver evidence pack, criar um
      const newPack = await evidenceService.getOrCreatePack(tenantId, {
        contextType,
        contextId,
      });
      
      const signalType: BypassSignalType = analysis.hasOffPlatformContact
        ? 'off_platform_contact'
        : 'off_platform_keyword';

      const result = await this.registerBypassDetection(tenantId, {
        actorId,
        signalType,
        severity: analysis.severity,
        contextType,
        contextId,
        evidencePackId: newPack.packId,
        messageContent,
        metadata: {
          detectedContacts: analysis.detectedContacts,
          detectedKeywords: analysis.detectedKeywords,
        },
      });
      return { detected: true, eventId: result.eventId, signalType };
    }

    const signalType: BypassSignalType = analysis.hasOffPlatformContact
      ? 'off_platform_contact'
      : 'off_platform_keyword';

    const result = await this.registerBypassDetection(tenantId, {
      actorId,
      signalType,
      severity: analysis.severity,
      contextType,
      contextId,
      evidencePackId: evidencePack.packId,
      messageContent,
      metadata: {
        detectedContacts: analysis.detectedContacts,
        detectedKeywords: analysis.detectedKeywords,
      },
    });

    return { detected: true, eventId: result.eventId, signalType };
  }
}

export const bypassDetectionService = new BypassDetectionService();

