-- 20260510100000_actor_responsibility.sql
-- §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD
-- Adiciona responsible_actor_id em actors + trigger de validação
-- FASE 2: trigger em modo WARNING (não bloqueia) — muda para EXCEPTION na Fase 4

BEGIN;

-- 1. Coluna responsible_actor_id
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS responsible_actor_id UUID
    REFERENCES actors(id) ON DELETE RESTRICT;

-- Índice reverso: "quais entidades este humano responde?"
CREATE INDEX IF NOT EXISTS idx_actors_responsible_actor_id
  ON actors (responsible_actor_id)
  WHERE responsible_actor_id IS NOT NULL;

-- 2. Trigger de validação (WARNING enquanto backfill não está completo)
CREATE OR REPLACE FUNCTION trg_actor_responsibility_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_responsible_type TEXT;
BEGIN
  -- Humanos são a âncora final — não têm responsável
  IF NEW.actor_type IN ('user', 'actor_human', 'person') THEN
    IF NEW.responsible_actor_id IS NOT NULL THEN
      RAISE EXCEPTION
        'Actor humano (tipo=%) não pode ter responsible_actor_id.',
        NEW.actor_type;
    END IF;
    RETURN NEW;
  END IF;

  -- Sistema não requer âncora humana
  IF NEW.actor_type IN ('actor_system', 'system') THEN
    RETURN NEW;
  END IF;

  -- FASE 2: WARNING (muda para EXCEPTION na Fase 4 após backfill)
  IF NEW.responsible_actor_id IS NULL THEN
    RAISE WARNING
      'Actor não-humano (tipo=%, id=%) sem responsible_actor_id. '
      'Obrigatório após Fase 4 (backfill completo). '
      'Ver §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD.',
      NEW.actor_type, NEW.id;
    RETURN NEW;
  END IF;

  -- Responsável DEVE ser humano E do mesmo tenant
  SELECT actor_type INTO v_responsible_type
  FROM actors
  WHERE id = NEW.responsible_actor_id
    AND tenant_id = NEW.tenant_id;

  IF v_responsible_type IS NULL THEN
    RAISE EXCEPTION
      'responsible_actor_id=% não encontrado no tenant=%.',
      NEW.responsible_actor_id, NEW.tenant_id;
  END IF;

  IF v_responsible_type NOT IN ('user', 'actor_human', 'person') THEN
    RAISE EXCEPTION
      'responsible_actor_id deve ser actor humano. Encontrado: tipo=%. '
      'Proibido page→page (cadeia sem CPF). §4.8.2.',
      v_responsible_type;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actors_responsibility ON actors;
CREATE TRIGGER trg_actors_responsibility
  BEFORE INSERT OR UPDATE OF responsible_actor_id, actor_type
  ON actors
  FOR EACH ROW
  EXECUTE FUNCTION trg_actor_responsibility_check();

COMMENT ON COLUMN actors.responsible_actor_id IS
  'Actor humano (CPF) âncora desta entidade não-humana. '
  'NULL = actor humano ou sistema (âncora final). '
  'NOT NULL obrigatório para page/group/channel/company após Fase 4. '
  'Regra: humano → NULL; não-humano → actor humano; sistema → NULL. '
  'Garantia: trigger trg_actors_responsibility. '
  'Writer único: modules/identity/actor-writer.service. §4.8.';

COMMIT;
