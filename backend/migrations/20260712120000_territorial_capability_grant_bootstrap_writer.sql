-- PORTA-TERRITORY-1 · writer governado de grant TERRITORIAL (primitiva ausente na fundação N2-D).
-- fn_grant_actor_capability é actor-only (hardcode scope_type='actor'); não havia writer territory-scope.
-- Esta função espelha o padrão selado (SECURITY DEFINER, search_path pinado, grant+evento atômico),
-- porém hardcode: scope_type='territory', tenant_id NULL, scope_actor_id NULL, scope_city_id obrigatório,
-- status='active' (nunca suspended), authority_source='platform_bootstrap' (decisão explícita da PORTA,
-- NÃO self-authorization territorial). Sem ON CONFLICT/UPSERT/reconciliação: o índice único parcial
-- uidx_actor_capability_grants_territory_active é o enforcement final (rerun → unique_violation).
-- ACL fechada: sem EXECUTE para PUBLIC nem unificard_app — só o owner (operação one-shot de bootstrap).
-- Reusa a casa canônica actor_capability_grants + actor_capability_grant_events; nenhuma trilha paralela.

CREATE OR REPLACE FUNCTION public.fn_grant_territorial_capability(
  p_scope_city_id uuid,
  p_grantee_actor_id uuid,
  p_capability_key text,
  p_granted_by_user_id uuid,
  p_granted_by_actor_id uuid,
  p_valid_until timestamptz,
  p_reason text,
  p_executed_by_user_id uuid,
  p_executed_by_actor_id uuid,
  p_responsible_human_actor_id uuid,
  p_event_reason text
)
 RETURNS actor_capability_grants
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_grant public.actor_capability_grants%ROWTYPE;
  v_city uuid;
  v_grantee_tenant uuid;
  v_grantee_type text;
BEGIN
  -- capability territorial EXATA (as 6 keys); nunca financeira/actor/wildcard.
  IF p_capability_key NOT IN (
    'territory:create_neighborhood', 'territory:approve_neighborhood',
    'territory:correct_neighborhood', 'territory:deactivate_neighborhood',
    'territory:manage_neighborhood_aliases', 'territory:register_neighborhood_succession'
  ) THEN
    RAISE EXCEPTION 'TERRITORIAL_CAPABILITY_INVALID: % nao e capability territorial.', p_capability_key;
  END IF;

  -- city existe e é lockada (FOR SHARE); FK fk_acg_scope_city também garante existência.
  SELECT city_id INTO v_city FROM public.cities WHERE city_id = p_scope_city_id FOR SHARE;
  IF v_city IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_CITY_NOT_FOUND: %', p_scope_city_id;
  END IF;

  -- grantee Actor existe, é tenant-bound e lockado (FOR SHARE).
  SELECT tenant_id, actor_type INTO v_grantee_tenant, v_grantee_type
    FROM public.actors WHERE actor_id = p_grantee_actor_id FOR SHARE;
  IF v_grantee_type IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_GRANTEE_NOT_FOUND: %', p_grantee_actor_id;
  END IF;
  IF v_grantee_tenant IS NULL THEN
    RAISE EXCEPTION 'TERRITORIAL_GRANTEE_NOT_TENANT_BOUND: %', p_grantee_actor_id;
  END IF;

  -- issuer/executor/responsible humano existem como Actors (lock FOR SHARE); nenhum caller-supplied tenant.
  PERFORM 1 FROM public.actors WHERE actor_id = p_granted_by_actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TERRITORIAL_ISSUER_NOT_FOUND: %', p_granted_by_actor_id; END IF;
  PERFORM 1 FROM public.actors WHERE actor_id = p_executed_by_actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TERRITORIAL_EXECUTOR_NOT_FOUND: %', p_executed_by_actor_id; END IF;
  PERFORM 1 FROM public.actors WHERE actor_id = p_responsible_human_actor_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TERRITORIAL_RESPONSIBLE_NOT_FOUND: %', p_responsible_human_actor_id; END IF;

  -- INSERT do grant TERRITORIAL (shape hardcoded; o CHECK chk_acg_scope_shape e o índice único são a barreira final).
  INSERT INTO public.actor_capability_grants (
    tenant_id, grantee_actor_id, capability_key, scope_type, scope_actor_id, scope_city_id,
    granted_by_user_id, granted_by_actor_id, authority_source, status, valid_from, valid_until, reason
  ) VALUES (
    NULL, p_grantee_actor_id, p_capability_key, 'territory', NULL, p_scope_city_id,
    p_granted_by_user_id, p_granted_by_actor_id, 'platform_bootstrap', 'active', now(), p_valid_until, p_reason
  ) RETURNING * INTO v_grant;

  -- evento 'granted' atômico (audit trail; snapshot obrigatório via trigger).
  INSERT INTO public.actor_capability_grant_events (
    grant_id, event_type, grantee_actor_id, capability_key, scope_type, tenant_id, scope_actor_id, scope_city_id,
    valid_from, valid_until, authority_source, executed_by_user_id, executed_by_actor_id, responsible_human_actor_id, event_reason
  ) VALUES (
    v_grant.grant_id, 'granted', v_grant.grantee_actor_id, v_grant.capability_key, v_grant.scope_type, v_grant.tenant_id,
    v_grant.scope_actor_id, v_grant.scope_city_id, v_grant.valid_from, v_grant.valid_until, v_grant.authority_source,
    p_executed_by_user_id, p_executed_by_actor_id, p_responsible_human_actor_id, p_event_reason
  );

  RETURN v_grant;
END;
$function$;

-- ACL: writer de bootstrap NÃO é executável por PUBLIC nem pela role de runtime da app.
REVOKE ALL ON FUNCTION public.fn_grant_territorial_capability(uuid,uuid,text,uuid,uuid,timestamptz,text,uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_grant_territorial_capability(uuid,uuid,text,uuid,uuid,timestamptz,text,uuid,uuid,uuid,text) FROM unificard_app;
