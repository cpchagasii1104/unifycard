-- Corrigir trigger categories_before_write para converter UUID para TEXT na comparação
CREATE OR REPLACE FUNCTION categories_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v_parent_path TEXT[];
BEGIN
  -- Raiz
  IF NEW.parent_id IS NULL THEN
    NEW.level := 0;
    NEW.path  := ARRAY[NEW.slug];
    RETURN NEW;
  END IF;

  -- Buscar path do pai
  SELECT path INTO v_parent_path
  FROM categories
  WHERE category_id = NEW.parent_id;

  IF v_parent_path IS NULL THEN
    RAISE EXCEPTION 'Parent category % not found', NEW.parent_id;
  END IF;

  -- Prevenir ciclos indiretos (corrigido: converter UUID para TEXT)
  IF NEW.category_id IS NOT NULL
     AND NEW.category_id::text = ANY(v_parent_path) THEN
    RAISE EXCEPTION 'Cyclic category hierarchy detected';
  END IF;

  NEW.path  := v_parent_path || NEW.slug;
  NEW.level := array_length(NEW.path, 1) - 1;

  RETURN NEW;
END;
$$;













