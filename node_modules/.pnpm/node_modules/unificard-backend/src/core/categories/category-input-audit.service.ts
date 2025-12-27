// src/core/categories/category-input-audit.service.ts
// Serviço de auditoria de inputs de categorias
// FASE 3.8: Category Input Gate

import { pool } from '@core/database/pool';
import { CategoryContext } from '@unificard/contracts';

interface AuditEntry {
  inputOriginal: string;
  normalized: string;
  context: CategoryContext;
  decision: 'ALLOW' | 'DENY' | 'REVIEW';
  reasonCode?: string;
  confidence?: number;
  canonicalId?: string;
  lexicalDecision?: string;
  formCheckDecision?: string;
  cboMatchCode?: string;
  embeddingSimilarity?: number;
  tenantId?: string;
  actorId?: string;
  globalUserId?: string;
}

class CategoryInputAuditService {
  /**
   * Registra entrada de auditoria
   * Performance: <5ms (INSERT simples)
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO category_input_audit (
          input_original, normalized, context, decision, reason_code,
          confidence, canonical_id, lexical_decision, form_check_decision,
          cbo_match_code, embedding_similarity, tenant_id, actor_id, global_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          entry.inputOriginal,
          entry.normalized,
          entry.context,
          entry.decision,
          entry.reasonCode || null,
          entry.confidence || null,
          entry.canonicalId || null,
          entry.lexicalDecision || null,
          entry.formCheckDecision || null,
          entry.cboMatchCode || null,
          entry.embeddingSimilarity || null,
          entry.tenantId || null,
          entry.actorId || null,
          entry.globalUserId || null,
        ]
      );
    } catch (error) {
      // Log não crítico - não falhar se auditoria falhar
      console.error('[CategoryInputAudit] Erro ao registrar auditoria (não crítico):', error);
    }
  }
}

export const categoryInputAuditService = new CategoryInputAuditService();
export type { AuditEntry };



