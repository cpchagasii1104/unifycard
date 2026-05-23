-- 0012_unify_actor_and_kyc_ontology.sql
-- Unificação ontológica de actor_type e KYC

-- Normalizar actor_type
UPDATE actors
SET actor_type = 'actor_human'
WHERE actor_type IN ('person','user');

UPDATE actors
SET actor_type = 'actor_organizational'
WHERE actor_type IN ('company','page');

-- Atualizar constraint do actor_type
ALTER TABLE actors DROP CONSTRAINT IF EXISTS actors_actor_type_check;

ALTER TABLE actors
ADD CONSTRAINT actors_actor_type_check
CHECK (actor_type IN ('actor_human','actor_organizational','actor_system'));

-- Garantir KYC canônico
UPDATE identities
SET kyc_status = 'approved'
WHERE kyc_status = 'verified';

-- Remover valores não canônicos
UPDATE identities
SET kyc_status = 'pending'
WHERE kyc_status NOT IN ('pending','approved','rejected');
