-- ================================================
-- 0006_forward_only_lock.sql
-- Lei 2: Regime Forward-Only
-- Proíbe downgrade, reexecução e execução fora de ordem.
-- ================================================

BEGIN;

-- 1. Criação da autoridade única de versão

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schema_version_positive CHECK (version > 0)
);

-- 2. Inserção da versão atual (Genesis + 0006)

INSERT INTO schema_version (version)
VALUES (6);

-- 3. Função de proteção estrutural

CREATE OR REPLACE FUNCTION enforce_forward_only()
RETURNS TRIGGER AS $$
DECLARE
    current_max INTEGER;
BEGIN
    SELECT MAX(version) INTO current_max FROM schema_version;

    -- Bloqueia reexecução ou versão fora da sequência
    IF TG_OP = 'INSERT' THEN
        IF NEW.version <> current_max + 1 THEN
            RAISE EXCEPTION
            'Forward-only violation: expected version %, got %',
            current_max + 1,
            NEW.version;
        END IF;
    END IF;

    -- Bloqueia qualquer UPDATE
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION
        'Forward-only violation: UPDATE not allowed on schema_version';
    END IF;

    -- Bloqueia qualquer DELETE
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION
        'Forward-only violation: DELETE not allowed on schema_version';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger de proteção

CREATE TRIGGER schema_version_forward_only
BEFORE INSERT OR UPDATE OR DELETE
ON schema_version
FOR EACH ROW
EXECUTE FUNCTION enforce_forward_only();

COMMIT;

-- ================================================
-- Fim da Lei 2
-- ================================================
