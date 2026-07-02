-- ============================================================
-- 20260702110000: aplica category_input_audit (DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST)
-- ============================================================
-- Achado colateral do fechamento de DT-CBO-MATCHER-DORMANT-LANDMINE: categoryInputAuditService.log()
-- (category-input-audit.service.ts) sempre fez INSERT INTO category_input_audit, mas a tabela NUNCA
-- foi aplicada no schema vivo — só existe em migrations_archive/0352_occupations_reference.sql
-- (migration "059", nunca rodada pelo runner canônico, que lê só backend/migrations/). Toda chamada
-- falhava em silêncio (try/catch próprio do .log()) — nenhuma auditoria de fato era gravada, nunca,
-- para NENHUM contexto (não só via CBO).
--
-- 🔴 NÃO é um `git mv` do archive: o arquivo original define category_input_audit.canonical_id como
-- FK para occupations_reference(occupation_id) — a MESMA tabela que DT-CBO-MATCHER-DORMANT-LANDMINE
-- (Opção A, decisão de Clayton) escolheu NÃO reviver. Aplicar a migration original ao pé da letra
-- reativaria exatamente o que acabou de ser removido (armadilha de reativação clássica desta sessão).
--
-- Esta migration aplica category_input_audit SEM essa FK e SEM os 3 campos hoje mortos, confirmados
-- via grep (nenhum caller de categoryInputAuditService.log() em categories.service.ts ou
-- category-input-gate.service.ts passa canonicalId/cboMatchCode/embeddingSimilarity — nem antes nem
-- depois da remoção do CBO):
--   - canonical_id (FK p/ occupations_reference, tabela intencionalmente não revivida)
--   - cbo_match_code (exclusivo do CBO, removido em F-CBO-MATCHER-DORMANT-LANDMINE-REMOVAL)
--   - embedding_similarity (exclusivo de embeddings_cache, TAMBÉM nunca aplicada — dormente desde a
--     origem, nunca escrita por nenhum caller, mesma família semântica do CBO)
-- Se um mapeamento occupation→concept ou busca semântica virar demanda real de produto no futuro,
-- será redesenho concept-bound (nunca reviver occupations_reference como runtime soberano — ver
-- DT-CBO-MATCHER-DORMANT-LANDMINE), com colunas adicionadas por migration própria naquele momento.
--
-- Lei 2: forward-only. Colunas/índices restantes seguem fielmente o desenho original (migration 059)
-- onde não há conflito com a decisão acima.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS category_input_audit (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  input_original VARCHAR(500) NOT NULL,
  normalized VARCHAR(500) NOT NULL,

  context VARCHAR(50) NOT NULL,
  decision VARCHAR(20) NOT NULL,

  reason_code VARCHAR(100),
  confidence NUMERIC(3,2),

  lexical_decision VARCHAR(20),
  form_check_decision VARCHAR(20),

  -- Contexto (não governança)
  tenant_id UUID,
  actor_id UUID,
  global_user_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_context
  ON category_input_audit (context);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_decision
  ON category_input_audit (decision);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_created_at
  ON category_input_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_category_input_audit_normalized
  ON category_input_audit (normalized);

COMMENT ON TABLE category_input_audit IS
  'Ledger append-only de auditoria de inputs de categorias (IA e humano). Aplicada em 20260702110000 '
  '(DT-CATEGORY-INPUT-AUDIT-SCHEMA-GHOST) sem canonical_id/cbo_match_code/embedding_similarity — '
  'campos exclusivos do CBO/embeddings semânticos, nunca escritos, features dormentes não revividas.';

COMMIT;
