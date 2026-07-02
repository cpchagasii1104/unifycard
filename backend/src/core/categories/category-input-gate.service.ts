// src/core/categories/category-input-gate.service.ts
// Serviço unificado do Category Input Gate
// FASE 3.8: Pipeline completo de validação

import { CategoryContext } from '@unificard/contracts';
import { categoryLexicalGateService } from './category-lexical-gate.service';
import { occupationFormCheckerService } from './occupation-form-checker.service';
import { categoryInputAuditService } from './category-input-audit.service';
import { hobbyVerbHeuristicService } from './hobby-verb-heuristic.service';
import { hobbyMatcherService } from './hobby-matcher.service';

interface GateResult {
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  reasonCode?: string;
  suggestion?: string;
  confidence?: number;
  canonicalHobby?: string; // Para hobbies: hobby canônico do dataset
}

interface GateOptions {
  context: CategoryContext;
  skipFormCheck?: boolean; // Para admin/manual, pode pular form check
  tenantId?: string;
  actorId?: string;
  globalUserId?: string;
}

class CategoryInputGateService {
  /**
   * Pipeline completo de validação
   * Performance: <60ms (sem IA)
   */
  async validate(
    input: string,
    options: GateOptions
  ): Promise<GateResult> {
    const { context, skipFormCheck = false, tenantId, actorId, globalUserId } = options;

    // ETAPA 1: Bloqueio Léxico Seguro (0-2ms)
    const lexicalCheck = categoryLexicalGateService.validate(input);
    if (lexicalCheck.decision === 'DENY') {
      // Auditoria
      await categoryInputAuditService.log({
        inputOriginal: input,
        normalized: lexicalCheck.normalized || input,
        context,
        decision: 'DENY',
        reasonCode: lexicalCheck.reasonCode,
        lexicalDecision: 'DENY',
        tenantId,
        actorId,
        globalUserId,
      });
      return {
        decision: 'DENY',
        reasonCode: lexicalCheck.reasonCode,
      };
    }

    // ETAPA 2: Occupation Form Check (0-1ms)
    // Aplicar para professional, education e company (NÃO para hobby)
    let formCheckDecision: 'ALLOW' | 'DENY' = 'ALLOW';
    let formCheckSuggestion: string | undefined;
    if (!skipFormCheck && (context === 'professional' || context === 'education' || context === 'company')) {
      const formCheck = occupationFormCheckerService.validate(input, context);
      formCheckDecision = formCheck.decision;
      formCheckSuggestion = formCheck.suggestion;
      if (formCheck.decision === 'DENY') {
        // Auditoria
        await categoryInputAuditService.log({
          inputOriginal: input,
          normalized: input,
          context,
          decision: 'DENY',
          reasonCode: formCheck.reasonCode,
          lexicalDecision: 'ALLOW',
          formCheckDecision: 'DENY',
          tenantId,
          actorId,
          globalUserId,
        });
        return {
          decision: 'DENY',
          reasonCode: formCheck.reasonCode,
          suggestion: formCheck.suggestion,
        };
      }
    }

    // ETAPA 3: Hobby Gate (para contexto hobby)
    // Pipeline: HobbyVerbHeuristic → HobbyMatcher
    if (context === 'hobby') {
      // 3.1. Heurística Verbal
      const verbCheck = hobbyVerbHeuristicService.validate(input);
      if (verbCheck.decision === 'DENY') {
        // Auditoria
        await categoryInputAuditService.log({
          inputOriginal: input,
          normalized: input,
          context,
          decision: 'DENY',
          reasonCode: verbCheck.reasonCode,
          lexicalDecision: 'ALLOW',
          tenantId,
          actorId,
          globalUserId,
        });
        return {
          decision: 'DENY',
          reasonCode: verbCheck.reasonCode,
          suggestion: verbCheck.suggestion,
        };
      }

      // 3.2. Hobby Matcher (exato + fuzzy)
      try {
        const hobbyMatch = await hobbyMatcherService.findMatch(input);
        if (!hobbyMatch.matched) {
          // Auditoria
          await categoryInputAuditService.log({
            inputOriginal: input,
            normalized: input,
            context,
            decision: 'DENY',
            reasonCode: hobbyMatch.reasonCode || 'NOT_IN_HOBBY_DATASET',
            lexicalDecision: 'ALLOW',
            tenantId,
            actorId,
            globalUserId,
          });
          return {
            decision: 'DENY',
            reasonCode: hobbyMatch.reasonCode || 'NOT_IN_HOBBY_DATASET',
            suggestion: 'Hobby não encontrado no dataset. Use hobbies válidos como "xadrez", "fotografia", "tocar violão", etc.',
          };
        }

        // Match encontrado - ALLOW
        await categoryInputAuditService.log({
          inputOriginal: input,
          normalized: input,
          context,
          decision: 'ALLOW',
          reasonCode: hobbyMatch.reasonCode,
          confidence: hobbyMatch.similarity,
          lexicalDecision: 'ALLOW',
          tenantId,
          actorId,
          globalUserId,
        });

        return {
          decision: 'ALLOW',
          canonicalHobby: hobbyMatch.canonicalHobby,
          confidence: hobbyMatch.similarity,
        };
      } catch (error) {
        console.error('[CategoryInputGate] Erro ao buscar hobby:', error);
        // Em caso de erro, bloquear por segurança
        await categoryInputAuditService.log({
          inputOriginal: input,
          normalized: input,
          context,
          decision: 'DENY',
          reasonCode: 'HOBBY_MATCH_ERROR',
          lexicalDecision: 'ALLOW',
          tenantId,
          actorId,
          globalUserId,
        });
        return {
          decision: 'DENY',
          reasonCode: 'HOBBY_MATCH_ERROR',
        };
      }
    }

    // F-CBO-MATCHER-DORMANT-LANDMINE-REMOVAL (DT-CBO-MATCHER-DORMANT-LANDMINE, Opção A):
    // ETAPA 4 (CBO Match) removida — cboMatcherService consultava `occupations_reference`, tabela
    // que nunca foi aplicada no schema vivo (só em migrations_archive). Toda chamada falhava em
    // silêncio (try/catch) e devolvia null — canonicalId/cboCode/confidence sempre undefined aqui.
    // Comportamento externo idêntico (campos já eram sempre ausentes); só o wiring morto foi retirado.

    // Resultado final
    return {
      decision: 'ALLOW',
    };
  }
}

export const categoryInputGateService = new CategoryInputGateService();
export type { GateResult, GateOptions };



