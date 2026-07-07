-- 20260707060000: ADENDO 0163-A — 7º propósito 'encontros_e_relacionamentos'
-- Extensão GOVERNADA (0163: "extensão só por DECISION"). Salvaguardas-lei no adendo do doc
-- (família 0071: sem inferência sobre membro, sem targeting por participação).
BEGIN;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS chk_groups_purpose;
ALTER TABLE groups ADD CONSTRAINT chk_groups_purpose
  CHECK (purpose IN ('cuidado_e_impacto','comunidade_e_pertencimento','fe_e_espiritualidade',
                     'interesse_e_hobby','aprendizado','ajuda_mutua_e_cooperacao',
                     'encontros_e_relacionamentos'));
COMMIT;
