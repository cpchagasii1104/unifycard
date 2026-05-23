-- 0010_migrate_identity_from_actors.sql
-- Migração dos dados atuais para identities
--
-- actors (0002) não possui global_user_id; apenas identities (0009) possui.
-- Geração de UUID canônico + UPDATE actors antes de DROP cpf_cnpj / FK.
-- (Transação externa: runner migrate.ts)

ALTER TABLE actors ADD COLUMN global_user_id UUID;

INSERT INTO identities (
    global_user_id,
    tax_id,
    tax_id_type,
    kyc_status,
    kyc_level
)
SELECT DISTINCT ON (a.cpf_cnpj)
    uuid_generate_v4(),
    a.cpf_cnpj,
    CASE
        WHEN length(a.cpf_cnpj) = 11 THEN 'cpf'
        ELSE 'cnpj'
    END,
    CASE
        WHEN a.kyc_status = 'verified' THEN 'approved'
        WHEN a.kyc_status = 'pending' THEN 'pending'
        WHEN a.kyc_status = 'rejected' THEN 'rejected'
        ELSE 'pending'
    END,
    'none'
FROM actors a
WHERE a.cpf_cnpj IS NOT NULL
ORDER BY a.cpf_cnpj, a.id;

UPDATE actors act
SET global_user_id = i.global_user_id
FROM identities i
WHERE act.cpf_cnpj IS NOT NULL
  AND i.tax_id = act.cpf_cnpj;

ALTER TABLE actors DROP COLUMN IF EXISTS cpf_cnpj;
ALTER TABLE actors DROP COLUMN IF EXISTS kyc_status;

ALTER TABLE actors
ADD CONSTRAINT fk_actor_identity
FOREIGN KEY (global_user_id)
REFERENCES identities(global_user_id);

ALTER TABLE actors
ADD CONSTRAINT chk_actor_requires_identity
CHECK (
    actor_type != 'actor_human'
    OR global_user_id IS NOT NULL
);
