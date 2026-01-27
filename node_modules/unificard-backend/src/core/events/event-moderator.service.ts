// src/core/events/event-moderator.service.ts
// Moderação de eventos conforme CONTRATO DE EVENTOS v1 Seção 7
// IA é guardiã, não criadora

import type { ModerationResult } from './event.types';

/**
 * Blocklist determinística (CONTRATO v1 Seção 7.2)
 */
const BLOCKLIST_TERMS: Set<string> = new Set([
  // Crime
  'ladrão', 'ladrao', 'roubo', 'assalto', 'traficante', 'traficar', 'drogas',
  'homicídio', 'homicidio', 'assassinato', 'estelionato', 'fraude', 'corrupção',
  'corrupcao', 'contrabando', 'pirataria', 'pirata', 'hacker criminoso',
  
  // Sexual explícito
  'punheteiro', 'punheta', 'masturbação', 'masturbacao', 'sexo', 'pornografia',
  'prostituta', 'prostituto', 'garota de programa', 'garoto de programa',
  'escort', 'acompanhante', 'puta', 'puto', 'vadia',
  
  // Violência e ódio
  'nazista', 'fascista', 'racista', 'xenófobo', 'xenofobo', 'homofóbico',
  'homofobico', 'misógino', 'misogino', 'terrorista', 'terrorismo',
  
  // Spam
  'spam', 'phishing', 'golpe', 'fraude', 'estelionato',
]);

/**
 * Padrões de bloqueio (regex)
 */
const BLOCK_PATTERNS: RegExp[] = [
  /(put|vadi|prostitut|escort|acompanhant)/i,
  /(ladr|roub|assalt|trafic)/i,
  /(nazi|fascist|racist|terrorist)/i,
];

class EventModeratorService {
  /**
   * Normaliza texto para análise
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();
  }

  /**
   * Verifica blocklist determinística
   */
  private checkBlocklist(text: string): ModerationResult | null {
    const normalized = this.normalizeText(text);
    const words = normalized.split(/\s+/);

    // Verificar palavras completas
    for (const word of words) {
      if (BLOCKLIST_TERMS.has(word)) {
        return {
          decision: 'rejected',
          reason: `Termo bloqueado: ${word}`,
          confidence: 1.0,
          flags: ['BLOCKLIST_EXACT_MATCH'],
        };
      }
    }

    // Verificar padrões regex
    for (const pattern of BLOCK_PATTERNS) {
      if (pattern.test(normalized)) {
        return {
          decision: 'rejected',
          reason: 'Padrão bloqueado detectado',
          confidence: 0.9,
          flags: ['BLOCKLIST_PATTERN_MATCH'],
        };
      }
    }

    return null;
  }

  /**
   * Análise semântica com IA (se disponível)
   */
  private async analyzeSemantic(
    title: string,
    description?: string | null
  ): Promise<ModerationResult | null> {
    try {
      // Tentar usar AI Kernel se disponível
      const { AIKernel } = await import('../ai/ai-kernel');
      const aiKernel = AIKernel.getInstance();

      const prompt = `Analise o seguinte evento e determine se é legítimo:

Título: ${title}
${description ? `Descrição: ${description}` : ''}

Responda em JSON:
{
  "decision": "approved" | "flagged" | "rejected",
  "reason": "razão da decisão",
  "confidence": 0.0-1.0,
  "flags": ["flag1", "flag2"]
}

Critérios:
- approved: evento legítimo, sem problemas
- flagged: evento suspeito, requer revisão
- rejected: evento claramente problemático (crime, spam, fraude)

Seja conservador: apenas rejeite se houver evidência clara de problema.`;

      const result = await aiKernel.run(prompt, {
        title,
        description: description || '',
      });

      if (result.success && result.result) {
        try {
          const jsonMatch = result.result.toString().match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.decision === 'rejected' || parsed.decision === 'flagged') {
              return {
                decision: parsed.decision,
                reason: parsed.reason || 'Análise semântica detectou problema',
                confidence: parsed.confidence || 0.7,
                flags: parsed.flags || ['AI_SEMANTIC_ANALYSIS'],
              };
            }
          }
        } catch (error) {
          // Se falhar ao parsear, continuar sem bloqueio
          console.warn('[EventModerator] Erro ao parsear resultado da IA:', error);
        }
      }
    } catch (error) {
      // Se IA não disponível, continuar sem análise semântica
      console.warn('[EventModerator] IA não disponível, usando apenas blocklist:', error);
    }

    return null;
  }

  /**
   * Pipeline completo de moderação (CONTRATO v1 Seção 7.2)
   * 
   * 1. Blocklist determinística
   * 2. Análise semântica (IA)
   * 3. Decisão
   */
  async moderate(
    title: string,
    description?: string | null
  ): Promise<ModerationResult> {
    // ETAPA 1: Blocklist determinística
    const blocklistCheck = this.checkBlocklist(title + ' ' + (description || ''));
    if (blocklistCheck) {
      return blocklistCheck;
    }

    // ETAPA 2: Análise semântica (IA)
    const semanticCheck = await this.analyzeSemantic(title, description);
    if (semanticCheck) {
      return semanticCheck;
    }

    // ETAPA 3: Aprovado (se passou todas as verificações)
    return {
      decision: 'approved',
      confidence: 1.0,
      flags: [],
    };
  }
}

export const eventModeratorService = new EventModeratorService();














