-- ============================================================
-- 20260707050000: DECISION-0163 — propósito GOVERNADO do grupo
-- ============================================================
-- Ratificada por Clayton 2026-07-07. Eixo ortogonal à categoria (TREE):
-- propósito = POR QUE o grupo existe. Fonte TS: group-purpose.vocabulary.ts.
-- Existentes: default 'comunidade_e_pertencimento' (D3 — dono pode reclassificar depois).
-- ============================================================

BEGIN;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'comunidade_e_pertencimento';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_groups_purpose') THEN
    ALTER TABLE groups
      ADD CONSTRAINT chk_groups_purpose
      CHECK (purpose IN ('cuidado_e_impacto','comunidade_e_pertencimento','fe_e_espiritualidade',
                         'interesse_e_hobby','aprendizado','ajuda_mutua_e_cooperacao'));
  END IF;
END $$;

COMMIT;
