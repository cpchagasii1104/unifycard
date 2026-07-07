-- 20260707220000: remove 'other' de resource_type (anti-padrão de ontologia — "Outros" é balde de
-- exceções; se surgir um 5º tipo genuíno, entra por RFC, não por fallback). Sistema virgem: 0
-- recursos 'other' (verificado). Também limpa detritos de smoke (label ILIKE '%(smoke)%') — não são
-- dados reais. GO direto de Clayton (2026-07-07, "momento certo de corrigir da forma certa").
BEGIN;
DELETE FROM rentable_resources WHERE label ILIKE '%(smoke)%';
ALTER TABLE rentable_resources DROP CONSTRAINT IF EXISTS rentable_resources_resource_type_check;
ALTER TABLE rentable_resources ADD CONSTRAINT rentable_resources_resource_type_check
  CHECK (resource_type IN ('equipment', 'vehicle', 'property', 'space'));
COMMIT;
