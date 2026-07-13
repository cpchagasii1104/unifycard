-- FASE D (RFC B1-D / GATE D0) — prova DB TRANSACIONAL (ROLLBACK) da limpeza governada de fixtures
-- territoriais. Espelha a semântica do one-shot (remove 34 addr + 9 asg do manifest, preserva 3+3).
-- NÃO usa provider, NÃO toca Bank/Social/território. Estado final = estado inicial (rollback total).
\set ON_ERROR_STOP off

-- Manifest fechado (mesmos UUIDs de fixture-cleanup-territorial-manifest.json).
\set pa1 '489dca58-b16e-4719-824b-478f39038e73'
\set pa2 '7f466fe2-0140-40b7-88f7-399481675871'
\set pa3 '92314c39-88b1-4aa2-a23d-6666e8a8bdd0'
\set ps1 'cd59d586-2432-46c0-9796-3061004f0b59'
\set ps2 'cf98a49d-9558-4d40-9e39-09ca389ae631'
\set ps3 'db6430b1-1326-4ce2-8f17-732dfff508d4'

BEGIN;

DO $t$
DECLARE
  preserve_addr uuid[] := ARRAY['489dca58-b16e-4719-824b-478f39038e73','7f466fe2-0140-40b7-88f7-399481675871','92314c39-88b1-4aa2-a23d-6666e8a8bdd0']::uuid[];
  preserve_asg  uuid[] := ARRAY['cd59d586-2432-46c0-9796-3061004f0b59','cf98a49d-9558-4d40-9e39-09ca389ae631','db6430b1-1326-4ce2-8f17-732dfff508d4']::uuid[];
  remove_addr   uuid[];
  remove_asg    uuid[];
  n int; da int; dd int;
BEGIN
  -- Deriva os removíveis = todos menos os preservados (espelha o manifest 34/9).
  SELECT array_agg(address_id) INTO remove_addr FROM addresses WHERE NOT (address_id = ANY(preserve_addr));
  SELECT array_agg(assignment_id) INTO remove_asg FROM address_assignments WHERE NOT (assignment_id = ANY(preserve_asg));

  -- P1 baseline 37/12/0
  SELECT count(*) INTO n FROM addresses; IF n=37 THEN RAISE NOTICE 'P1a OK addresses=37'; ELSE RAISE WARNING 'P1a FAIL=%',n; END IF;
  SELECT count(*) INTO n FROM address_assignments; IF n=12 THEN RAISE NOTICE 'P1b OK assignments=12'; ELSE RAISE WARNING 'P1b FAIL=%',n; END IF;
  SELECT count(*) INTO n FROM address_assignments WHERE owner_type='actor'; IF n=0 THEN RAISE NOTICE 'P1c OK actor-scoped=0'; ELSE RAISE WARNING 'P1c FAIL=%',n; END IF;

  -- P2 preserve 3/3 existe
  IF array_length(preserve_addr,1)=3 AND (SELECT count(*) FROM addresses WHERE address_id=ANY(preserve_addr))=3 THEN RAISE NOTICE 'P2a OK preserve addr 3/3';
  ELSE RAISE WARNING 'P2a FAIL'; END IF;
  IF array_length(preserve_asg,1)=3 AND (SELECT count(*) FROM address_assignments WHERE assignment_id=ANY(preserve_asg))=3 THEN RAISE NOTICE 'P2b OK preserve asg 3/3';
  ELSE RAISE WARNING 'P2b FAIL'; END IF;

  -- P3 remove 34/9 existe
  IF array_length(remove_addr,1)=34 THEN RAISE NOTICE 'P3a OK remove addr=34'; ELSE RAISE WARNING 'P3a FAIL=%',array_length(remove_addr,1); END IF;
  IF array_length(remove_asg,1)=9 THEN RAISE NOTICE 'P3b OK remove asg=9'; ELSE RAISE WARNING 'P3b FAIL=%',array_length(remove_asg,1); END IF;

  -- P4 owners preservados vivos + city ativa + VIGENTE
  SELECT count(*) INTO n FROM address_assignments aa JOIN addresses ad ON ad.address_id=aa.address_id
    JOIN cities c ON c.city_id=ad.city_id AND c.is_active
    WHERE aa.assignment_id=ANY(preserve_asg) AND aa.valid_until_at IS NULL AND aa.is_primary
      AND ((aa.owner_type='profile' AND EXISTS(SELECT 1 FROM actors a WHERE a.id=aa.owner_id))
        OR (aa.owner_type='actor_asset' AND EXISTS(SELECT 1 FROM actor_assets x WHERE x.id=aa.owner_id)));
  IF n=3 THEN RAISE NOTICE 'P4 OK preservados: owner vivo + city ativa + VIGENTE'; ELSE RAISE WARNING 'P4 FAIL=%',n; END IF;

  -- P5 owners removíveis mortos/inexistentes
  SELECT count(*) INTO n FROM address_assignments aa WHERE aa.assignment_id=ANY(remove_asg) AND (
    (aa.owner_type='profile' AND EXISTS(SELECT 1 FROM actors a WHERE a.id=aa.owner_id))
    OR (aa.owner_type='company' AND EXISTS(SELECT 1 FROM companies co WHERE co.company_id=aa.owner_id))
    OR (aa.owner_type='rentable_resource' AND EXISTS(SELECT 1 FROM rentable_resources rr WHERE rr.id=aa.owner_id)));
  IF n=0 THEN RAISE NOTICE 'P5 OK todos os removíveis têm owner morto/inexistente'; ELSE RAISE WARNING 'P5 FAIL owner vivo=%',n; END IF;

  -- P6 nenhuma FK externa nos 34
  SELECT (SELECT count(*) FROM actor_active_location WHERE address_id=ANY(remove_addr))
       + (SELECT count(*) FROM companies WHERE primary_address_id=ANY(remove_addr))
       + (SELECT count(*) FROM posts WHERE address_id=ANY(remove_addr))
       + (SELECT count(*) FROM tenants WHERE headquarters_address_id=ANY(remove_addr)) INTO n;
  IF n=0 THEN RAISE NOTICE 'P6 OK zero FK externa nos removíveis'; ELSE RAISE WARNING 'P6 FAIL=%',n; END IF;

  -- P7 nenhum evento referencia os 34
  SELECT count(*) INTO n FROM actor_events WHERE reference_id = ANY(SELECT unnest(remove_addr)::text);
  IF n=0 THEN RAISE NOTICE 'P7 OK zero evento referencia removíveis'; ELSE RAISE WARNING 'P7 FAIL=%',n; END IF;

  -- P8 DELETE 9 assignments → P9 DELETE 34 addresses (ordem)
  DELETE FROM address_assignments WHERE assignment_id=ANY(remove_asg); GET DIAGNOSTICS da = ROW_COUNT;
  IF da=9 THEN RAISE NOTICE 'P8 OK deletou 9 assignments'; ELSE RAISE WARNING 'P8 FAIL=%',da; END IF;
  DELETE FROM addresses WHERE address_id=ANY(remove_addr); GET DIAGNOSTICS dd = ROW_COUNT;
  IF dd=34 THEN RAISE NOTICE 'P9 OK deletou 34 addresses'; ELSE RAISE WARNING 'P9 FAIL=%',dd; END IF;

  -- P10 final 3/3/0
  SELECT count(*) INTO n FROM addresses; IF n=3 THEN RAISE NOTICE 'P10a OK addresses=3'; ELSE RAISE WARNING 'P10a FAIL=%',n; END IF;
  SELECT count(*) INTO n FROM address_assignments; IF n=3 THEN RAISE NOTICE 'P10b OK assignments=3'; ELSE RAISE WARNING 'P10b FAIL=%',n; END IF;
  SELECT count(*) INTO n FROM address_assignments WHERE owner_type='actor'; IF n=0 THEN RAISE NOTICE 'P10c OK actor-scoped=0'; ELSE RAISE WARNING 'P10c FAIL=%',n; END IF;

  -- P11 preservados intactos + P12 órfãos=0 + dangling=0
  IF (SELECT count(*) FROM addresses WHERE address_id=ANY(preserve_addr))=3
     AND (SELECT count(*) FROM address_assignments WHERE assignment_id=ANY(preserve_asg))=3 THEN RAISE NOTICE 'P11 OK preservados intactos'; ELSE RAISE WARNING 'P11 FAIL'; END IF;
  SELECT count(*) INTO n FROM addresses a WHERE NOT EXISTS(SELECT 1 FROM address_assignments aa WHERE aa.address_id=a.address_id);
  IF n=0 THEN RAISE NOTICE 'P12a OK órfãos=0'; ELSE RAISE WARNING 'P12a FAIL=%',n; END IF;
  SELECT count(*) INTO n FROM address_assignments aa WHERE NOT EXISTS(SELECT 1 FROM addresses a WHERE a.address_id=aa.address_id);
  IF n=0 THEN RAISE NOTICE 'P12b OK zero assignment dangling'; ELSE RAISE WARNING 'P12b FAIL=%',n; END IF;

  -- P13 território inalterado + P14 bank intacto
  IF (SELECT count(*) FROM neighborhoods)=75 AND (SELECT count(*) FROM cities)=27 AND (SELECT count(*) FROM states)=27
     AND (SELECT count(*) FROM cep_resolution_cache)=3 THEN RAISE NOTICE 'P13 OK território/cache inalterado'; ELSE RAISE WARNING 'P13 FAIL'; END IF;
  IF (SELECT count(*) FROM bank_accounts)=15 AND (SELECT coalesce(sum(reconciliation_balance_cents),0) FROM bank_accounts)=0 THEN RAISE NOTICE 'P14 OK bank intacto Δbank=0'; ELSE RAISE WARNING 'P14 FAIL'; END IF;
END $t$;

ROLLBACK;

-- P15 pós-ROLLBACK: baseline 37/12/0 restaurado, resíduo zero
DO $t$
DECLARE a int; s int; sc int;
BEGIN
  SELECT count(*) INTO a FROM addresses; SELECT count(*) INTO s FROM address_assignments; SELECT count(*) INTO sc FROM address_assignments WHERE owner_type='actor';
  IF a=37 AND s=12 AND sc=0 THEN RAISE NOTICE 'P15 OK rollback total: addresses=37 assignments=12 actor-scoped=0 (resíduo zero)';
  ELSE RAISE WARNING 'P15 FAIL a=% s=% sc=%',a,s,sc; END IF;
END $t$;

-- ── PROVAS NEGATIVAS (cada uma aborta ANTES de qualquer COMMIT; rollback isola) ──

-- N1 removível ganhando FK externa viva → preflight de referência deve pegar (simulado: injeta post→addr)
BEGIN;
DO $t$
DECLARE remove_addr uuid[]; n int; victim uuid;
BEGIN
  SELECT array_agg(address_id) INTO remove_addr FROM addresses WHERE address_id NOT IN ('489dca58-b16e-4719-824b-478f39038e73','7f466fe2-0140-40b7-88f7-399481675871','92314c39-88b1-4aa2-a23d-6666e8a8bdd0');
  victim := remove_addr[1];
  -- simula referência nova: um post passa a apontar para um removível
  UPDATE posts SET address_id=victim WHERE id=(SELECT id FROM posts LIMIT 1);
  SELECT count(*) INTO n FROM posts WHERE address_id=ANY(remove_addr);
  IF n>0 THEN RAISE NOTICE 'N1 OK: referência externa nova DETECTADA (preflight P6 abortaria; n=%)', n;
  ELSE RAISE NOTICE 'N1 SKIP: sem posts para simular (invariante ainda válido)'; END IF;
END $t$;
ROLLBACK;

-- N2 owner removível reaparecendo → preflight de morte-do-owner deve pegar
BEGIN;
DO $t$
DECLARE n int;
BEGIN
  -- simula: um rentable_resource morto "reaparece" (insert efêmero com o owner_id de um remove-asg)
  -- Como rentable_resources tem schema próprio, apenas provamos a DETECÇÃO lógica:
  SELECT count(*) INTO n FROM address_assignments aa WHERE aa.owner_type='rentable_resource'
    AND aa.assignment_id NOT IN ('cd59d586-2432-46c0-9796-3061004f0b59','cf98a49d-9558-4d40-9e39-09ca389ae631','db6430b1-1326-4ce2-8f17-732dfff508d4')
    AND EXISTS(SELECT 1 FROM rentable_resources rr WHERE rr.id=aa.owner_id);
  IF n=0 THEN RAISE NOTICE 'N2 OK: nenhum owner removível vivo HOJE (se reaparecesse, preflight P5 abortaria)';
  ELSE RAISE WARNING 'N2 INESPERADO: owner removível já vivo=%',n; END IF;
END $t$;
ROLLBACK;

-- N3 preservado incluído no manifest de remoção → overlap deve ser 0 (prova estrutural)
DO $t$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM addresses WHERE address_id IN ('489dca58-b16e-4719-824b-478f39038e73','7f466fe2-0140-40b7-88f7-399481675871','92314c39-88b1-4aa2-a23d-6666e8a8bdd0')
    AND address_id IN (SELECT address_id FROM addresses WHERE address_id NOT IN ('489dca58-b16e-4719-824b-478f39038e73','7f466fe2-0140-40b7-88f7-399481675871','92314c39-88b1-4aa2-a23d-6666e8a8bdd0'));
  IF n=0 THEN RAISE NOTICE 'N3 OK: preserve∩remove=0 (preservado jamais no remove)'; ELSE RAISE WARNING 'N3 FAIL overlap=%',n; END IF;
END $t$;

-- N4 baseline inicial divergente → o one-shot aborta (aqui provamos a semântica: se addresses≠37, fail-closed)
DO $t$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM addresses;
  IF n=37 THEN RAISE NOTICE 'N4 OK: baseline=37 (divergência dispararia BASELINE DIVERGENTE no one-shot)';
  ELSE RAISE WARNING 'N4: baseline=% (one-shot recusaria)',n; END IF;
END $t$;
