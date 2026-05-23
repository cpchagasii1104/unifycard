-- 0009_create_identities.sql
-- Criação da tabela de identidade global canônica

CREATE TABLE IF NOT EXISTS identities (
    global_user_id UUID PRIMARY KEY,

    tax_id TEXT NOT NULL,
    tax_id_type TEXT NOT NULL CHECK (tax_id_type IN ('cpf', 'cnpj')),

    kyc_status TEXT NOT NULL CHECK (kyc_status IN ('pending','approved','rejected')),
    kyc_level TEXT NOT NULL CHECK (kyc_level IN ('none','basic','complete')),

    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),

    CHECK (
        (tax_id_type = 'cpf' AND length(tax_id) = 11)
        OR
        (tax_id_type = 'cnpj' AND length(tax_id) = 14)
    )
);

-- Trigger padrão de updated_at
CREATE TRIGGER trg_identities_updated_at
BEFORE UPDATE ON identities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
