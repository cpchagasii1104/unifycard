// backend/src/core/concepts/subject-pool.service.ts
// RFC-SHARED-SUBJECT-CONCEPT-POOL — reader ÚNICO do pool canônico de ASSUNTO, compartilhado por TEMA de
// evento (event-taxonomy.searchThemes) e INTERESSE declarado (interest-c1). AUTORIDADE de elegibilidade =
// shared_subject_concepts (enabled). canonical_services entra SÓ como LEFT JOIN AUXILIAR de rótulo/texto —
// NUNCA decide pertencimento ao pool. SSOT = concepts.concept_id. Categoria/TREE = navegação, não autoridade.
// NÃO é oferta/serviço/locação (esses seguem concept_offer_kinds). Δbank=0.

import { runQueriesWithTenant } from '@core/database/pool';

export interface SubjectConcept {
  key: string;
  conceptId: string;
  label: string;
}

/**
 * Busca concepts do pool de ASSUNTO por termo. Pertencimento vem de shared_subject_concepts (autoridade);
 * canonical_services.name é só rótulo auxiliar (COALESCE p/ slug quando ausente). Sem canonical_services,
 * o concept AINDA aparece (pertencimento não depende dele). Um concept, um assunto; sem duplicar.
 */
export async function searchSubjectConcepts(tenantId: string, q: string, limit = 20): Promise<SubjectConcept[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await runQueriesWithTenant<{ slug: string; concept_id: string; label: string }>(
    tenantId,
    `SELECT c.slug, c.concept_id, COALESCE(cs.name, c.slug) AS label
       FROM shared_subject_concepts ssc
       JOIN concepts c ON c.concept_id = ssc.concept_id
       LEFT JOIN canonical_services cs
         ON cs.concept_id = c.concept_id AND cs.tenant_id IS NULL AND cs.status = 'active'
      WHERE ssc.enabled = true
        AND unaccent(COALESCE(cs.name, c.slug)) ILIKE unaccent($1)
      ORDER BY COALESCE(cs.name, c.slug) ASC
      LIMIT $2`,
    [`%${term}%`, Math.min(Math.max(limit, 1), 50)]
  );
  return rows.map((r) => ({ key: r.slug, conceptId: r.concept_id, label: r.label }));
}
