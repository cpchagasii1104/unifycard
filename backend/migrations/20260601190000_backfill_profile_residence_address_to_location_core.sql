-- ============================================================
-- F1 (DECISION-0074) — Backfill do endereço civil PF: profiles.metadata.address → Location Core
-- ============================================================
-- Migra o endereço residencial da PESSOA FÍSICA do blob `profiles.metadata.address` para o substrato
-- canônico `addresses` + `address_assignments`, no modelo decidido (DECISION-0074, Opção A — CEP-âncora):
--   addresses:            country_id=BR, postal_code=CEP, street, number, complement;
--                         state_id/city_id/neighborhood_id = NULL (segue o padrão vivo de companies.service;
--                         `addresses` não tem coluna texto p/ city/UF; enriquecimento via CEP/catálogo é futuro);
--                         source='IMPORT_LEGACY'.
--   address_assignments:  owner_type='profile', owner_id=actor_id do user-actor, role='RESIDENCE', is_primary=true.
--
-- Forward-only, transacional, IDEMPOTENTE (re-run não duplica), fail-closed. PRESERVA o blob
-- `profiles.metadata.address` (cleanup é fatia F4). Endereço incompleto (sem CEP) é IGNORADO — NÃO cria
-- address inválido. NÃO cria actor (resolve via JOIN actors; pula quem não tem user-actor). NÃO resolve
-- city/state a FK (sem mapeamento frágil). NÃO toca Companies/PJ/company address, CPF, gender, financeiro.
-- Estado DEV: 1 profile com metadata.address.
-- ============================================================

BEGIN;

DO $$
DECLARE
  r RECORD;
  v_country UUID;
  v_addr UUID;
  v_cep TEXT;
  v_street TEXT;
  v_number TEXT;
  v_complement TEXT;
  v_migrated INT := 0;
  v_skipped INT := 0;
BEGIN
  SELECT country_id INTO v_country FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1;
  IF v_country IS NULL THEN
    RAISE EXCEPTION 'MIGRATION_ABORT: pais BR ausente no catalogo (Location Core nao semeado)';
  END IF;

  FOR r IN
    SELECT p.user_id, p.tenant_id, p.metadata->'address' AS addr, a.actor_id
    FROM profiles p
    JOIN actors a
      ON a.user_id = p.user_id
     AND a.tenant_id = p.tenant_id
     AND a.actor_type = 'user'
    WHERE p.metadata ? 'address'
  LOOP
    -- Minimo canonico (Opcao A): CEP. Sem CEP, endereco incompleto -> ignora (nao cria address invalido).
    v_cep := NULLIF(trim(r.addr->>'cep'), '');
    IF v_cep IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Idempotencia: ja existe residencia canonica primaria vigente para este actor?
    IF EXISTS (
      SELECT 1 FROM address_assignments aa
      WHERE aa.owner_type = 'profile'
        AND aa.owner_id = r.actor_id
        AND aa.role = 'RESIDENCE'
        AND aa.is_primary = TRUE
        AND aa.valid_until_at IS NULL
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_street := COALESCE(NULLIF(trim(r.addr->>'street'), ''), NULLIF(trim(r.addr->>'address'), ''));
    v_number := COALESCE(NULLIF(trim(r.addr->>'number'), ''), NULLIF(trim(r.addr->>'address_number'), ''));
    v_complement := NULLIF(trim(r.addr->>'complement'), '');

    INSERT INTO addresses (
      country_id, state_id, city_id, neighborhood_id,
      postal_code, street, number, complement,
      source, is_geocoded, created_by_tenant_id
    ) VALUES (
      v_country, NULL, NULL, NULL,
      v_cep, v_street, v_number, v_complement,
      'IMPORT_LEGACY', FALSE, r.tenant_id
    )
    RETURNING address_id INTO v_addr;

    INSERT INTO address_assignments (
      owner_type, owner_id, address_id, role, is_primary, valid_from_at
    ) VALUES (
      'profile', r.actor_id, v_addr, 'RESIDENCE', TRUE, now()
    );

    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE 'F1 backfill residencia PF: migrados=%, ignorados=%', v_migrated, v_skipped;
END $$;

-- VERIFICACAO POS: nenhum blob foi removido (preservacao); contadores coerentes.
DO $$
DECLARE
  v_blob INT;
  v_assign INT;
BEGIN
  SELECT count(*) INTO v_blob FROM profiles WHERE metadata ? 'address';
  SELECT count(*) INTO v_assign FROM address_assignments
    WHERE owner_type = 'profile' AND role = 'RESIDENCE' AND is_primary = TRUE AND valid_until_at IS NULL;
  RAISE NOTICE 'F1 pos-verificacao: profiles.metadata.address preservados=%, residencias canonicas primarias=%', v_blob, v_assign;
END $$;

COMMIT;
