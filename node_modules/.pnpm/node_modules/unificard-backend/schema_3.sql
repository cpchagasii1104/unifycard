--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: credit_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.credit_status AS ENUM (
    'active',
    'inactive',
    'expired',
    'orphan'
);


ALTER TYPE public.credit_status OWNER TO postgres;

--
-- Name: evasion_pattern_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.evasion_pattern_type AS ENUM (
    'fragmentation',
    'persona_rotation',
    'cluster_suspicious',
    'automation_abuse',
    'chain_delegation',
    'timing_manipulation'
);


ALTER TYPE public.evasion_pattern_type OWNER TO postgres;

--
-- Name: transfer_purpose; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transfer_purpose AS ENUM (
    'donation',
    'reallocation',
    'refund',
    'split',
    'execution',
    'settlement',
    'expiration',
    'initial_credit',
    'group_allocation',
    'escrow_hold',
    'escrow_release'
);


ALTER TYPE public.transfer_purpose OWNER TO postgres;

--
-- Name: check_atl_before_transaction(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_atl_before_transaction() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM atl_blocked_actors 
    WHERE actor_id = NEW.actor_id
  ) THEN
    RAISE EXCEPTION 'ATL_BLOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_atl_before_transaction() OWNER TO postgres;

--
-- Name: check_coverage_before_credit(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_coverage_before_credit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_coverage NUMERIC;
  v_owner_type TEXT;
  v_capacity BIGINT;
  v_credits BIGINT;
BEGIN
  IF NEW.direction != 'credit' THEN RETURN NEW; END IF;
  
  SELECT ba.owner_type INTO v_owner_type 
  FROM bank_accounts ba 
  WHERE ba.id = NEW.account_id;

  IF v_owner_type = 'system' THEN RETURN NEW; END IF;
  
  SELECT execution_capacity_cents, total_credits_cents 
  INTO v_capacity, v_credits
  FROM system_coverage 
  WHERE tenant_id = NEW.tenant_id;
  
  IF v_capacity > 0 THEN
    v_coverage := (v_credits::NUMERIC / v_capacity::NUMERIC) * 100;
  ELSE
    v_coverage := 100;
  END IF;
  
  IF v_coverage >= 80 THEN
    RAISE EXCEPTION 'COVERAGE_EXCEEDED: % cobertura', ROUND(v_coverage, 2)
      USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_coverage_before_credit() OWNER TO postgres;

--
-- Name: detect_fragmentation(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.detect_fragmentation(p_actor_id uuid, p_window_hours integer DEFAULT 24, p_threshold_count integer DEFAULT 10, p_small_amount_threshold_cents integer DEFAULT 10000) RETURNS TABLE(is_suspicious boolean, transaction_count integer, total_amount_cents bigint, evidence jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_count INTEGER;
  v_total BIGINT;
  v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM actors WHERE id = p_actor_id;
  
  SELECT COUNT(*), COALESCE(SUM(amount_cents), 0) INTO v_count, v_total
  FROM bank_transactions bt
  JOIN bank_accounts ba ON ba.id = bt.account_id
  WHERE ba.actor_id = p_actor_id
    AND bt.created_at > now() - (p_window_hours || ' hours')::interval
    AND bt.amount_cents < p_small_amount_threshold_cents;
  
  IF v_count >= p_threshold_count THEN
    INSERT INTO evasion_patterns (tenant_id, actor_id, pattern_type, evidence, confidence_score)
    VALUES (v_tenant_id, p_actor_id, 'fragmentation',
      jsonb_build_object('count', v_count, 'total_cents', v_total),
      LEAST(v_count::NUMERIC / (p_threshold_count * 2), 1.0));
    
    RETURN QUERY SELECT true, v_count, v_total, jsonb_build_object('pattern', 'fragmentation', 'count', v_count);
  ELSE
    RETURN QUERY SELECT false, v_count, v_total, NULL::JSONB;
  END IF;
END;
$$;


ALTER FUNCTION public.detect_fragmentation(p_actor_id uuid, p_window_hours integer, p_threshold_count integer, p_small_amount_threshold_cents integer) OWNER TO postgres;

--
-- Name: expire_old_credits(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.expire_old_credits() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'expired',
      expires_at = now()
  WHERE credit_status = 'inactive'
    AND inactive_since < now() - interval '12 months'
    AND owner_type != 'system';
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.expire_old_credits() OWNER TO postgres;

--
-- Name: mark_inactive_accounts(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.mark_inactive_accounts() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE bank_accounts
  SET credit_status = 'inactive',
      inactive_since = now()
  WHERE credit_status = 'active'
    AND owner_type != 'system'
    AND last_activity_at < now() - interval '12 months';
    
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION public.mark_inactive_accounts() OWNER TO postgres;

--
-- Name: update_account_activity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_account_activity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE bank_accounts 
  SET last_activity_at = now(),
      inactive_since = NULL,
      credit_status = 'active'
  WHERE id = NEW.account_id 
    AND owner_type != 'system';
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_account_activity() OWNER TO postgres;

--
-- Name: validate_transfer_purpose(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.validate_transfer_purpose() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.purpose IS NULL THEN
    RAISE EXCEPTION 'MISSING_PURPOSE' USING ERRCODE = 'P0001';
  END IF;
  
  IF NEW.requires_justification = true 
     AND NEW.purpose IN ('reallocation', 'refund', 'execution')
     AND (NEW.justification IS NULL OR LENGTH(TRIM(NEW.justification)) < 10) THEN
    RAISE EXCEPTION 'MISSING_JUSTIFICATION' USING ERRCODE = 'P0001';
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.validate_transfer_purpose() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: actors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.actors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_type text NOT NULL,
    external_id text,
    display_name text NOT NULL,
    cpf_cnpj text,
    kyc_status text DEFAULT 'pending'::text NOT NULL,
    kyc_verified_at timestamp with time zone,
    kyc_limit_cents bigint DEFAULT 500000,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT actors_actor_type_check CHECK ((actor_type = ANY (ARRAY['person'::text, 'company'::text, 'system'::text]))),
    CONSTRAINT actors_kyc_status_check CHECK ((kyc_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text])))
);


ALTER TABLE public.actors OWNER TO postgres;

--
-- Name: ai_constitutional_limits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_constitutional_limits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    limit_type text NOT NULL,
    limit_value bigint NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    kill_switch boolean DEFAULT false NOT NULL,
    kill_switch_activated_at timestamp with time zone,
    kill_switch_activated_by text,
    kill_switch_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_constitutional_limits_limit_type_check CHECK ((limit_type = ANY (ARRAY['operations_per_hour'::text, 'operations_per_day'::text, 'blast_radius_pct'::text, 'max_amount_per_operation_cents'::text, 'max_total_amount_per_hour_cents'::text])))
);


ALTER TABLE public.ai_constitutional_limits OWNER TO postgres;

--
-- Name: ai_operations_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_operations_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    ai_instance_id text NOT NULL,
    ai_model text,
    operation_type text NOT NULL,
    affected_actors_count integer DEFAULT 0,
    amount_cents bigint DEFAULT 0,
    status text DEFAULT 'pending'::text NOT NULL,
    blocked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.ai_operations_log OWNER TO postgres;

--
-- Name: atl_blocked_actors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.atl_blocked_actors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    actor_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    blocked_at timestamp with time zone DEFAULT now() NOT NULL,
    blocked_reason text NOT NULL,
    blocked_by uuid
);


ALTER TABLE public.atl_blocked_actors OWNER TO postgres;

--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid,
    owner_type text NOT NULL,
    owner_id text NOT NULL,
    account_type text DEFAULT 'credit'::text NOT NULL,
    credit_status public.credit_status DEFAULT 'active'::public.credit_status,
    last_activity_at timestamp with time zone DEFAULT now(),
    inactive_since timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_accounts_owner_type_check CHECK ((owner_type = ANY (ARRAY['actor'::text, 'system'::text, 'escrow'::text])))
);


ALTER TABLE public.bank_accounts OWNER TO postgres;

--
-- Name: bank_ledger; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_ledger (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    account_id uuid NOT NULL,
    transaction_id uuid,
    direction text NOT NULL,
    amount_cents bigint NOT NULL,
    purpose public.transfer_purpose,
    justification text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_ledger_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT bank_ledger_direction_check CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])))
);


ALTER TABLE public.bank_ledger OWNER TO postgres;

--
-- Name: bank_splits; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_splits (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    transaction_id uuid NOT NULL,
    source_actor_id uuid NOT NULL,
    target_actor_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    split_type text NOT NULL,
    percentage numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_splits_amount_cents_check CHECK ((amount_cents > 0))
);


ALTER TABLE public.bank_splits OWNER TO postgres;

--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    account_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    purpose public.transfer_purpose NOT NULL,
    justification text,
    requires_justification boolean DEFAULT true,
    reference_type text,
    reference_id uuid,
    internal_completed_at timestamp with time zone,
    external_settled_at timestamp with time zone,
    external_partner text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_transactions_amount_cents_check CHECK ((amount_cents > 0))
);


ALTER TABLE public.bank_transactions OWNER TO postgres;

--
-- Name: coverage_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.coverage_audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    coverage_pct numeric(5,2) NOT NULL,
    execution_capacity_cents bigint NOT NULL,
    total_credits_cents bigint NOT NULL,
    operation_blocked boolean DEFAULT false
);


ALTER TABLE public.coverage_audit_log OWNER TO postgres;

--
-- Name: evasion_patterns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evasion_patterns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    pattern_type public.evasion_pattern_type NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    evidence jsonb NOT NULL,
    confidence_score numeric(3,2),
    is_confirmed boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    confirmed_by uuid,
    false_positive boolean DEFAULT false
);


ALTER TABLE public.evasion_patterns OWNER TO postgres;

--
-- Name: execution_fund_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_fund_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    movement_type text NOT NULL,
    amount_cents bigint NOT NULL,
    source_account_id uuid,
    source_description text,
    approved_by_user_id uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT execution_fund_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['credit_expiration'::text, 'orphan_recovery'::text, 'execution'::text, 'stabilization'::text])))
);


ALTER TABLE public.execution_fund_movements OWNER TO postgres;

--
-- Name: execution_fund_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.execution_fund_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    max_percentage_of_reserve integer DEFAULT 20 NOT NULL,
    allowed_uses text[] DEFAULT ARRAY['execution'::text, 'stabilization'::text, 'collective_impact'::text] NOT NULL,
    prohibited_uses text[] DEFAULT ARRAY['distribution'::text, 'profit'::text, 'operations'::text] NOT NULL,
    requires_committee_approval_above_cents bigint DEFAULT 1000000,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.execution_fund_rules OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    buyer_actor_id uuid NOT NULL,
    seller_actor_id uuid NOT NULL,
    total_cents bigint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_total_cents_check CHECK ((total_cents > 0))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: payment_intents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_intents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    amount_cents bigint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    intent_type text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_intents_amount_cents_check CHECK ((amount_cents > 0)),
    CONSTRAINT payment_intents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


ALTER TABLE public.payment_intents OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: system_coverage; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.system_coverage AS
 SELECT id AS tenant_id,
    COALESCE(( SELECT sum(
                CASE
                    WHEN (bl.direction = 'credit'::text) THEN bl.amount_cents
                    ELSE (- bl.amount_cents)
                END) AS sum
           FROM (public.bank_accounts ba
             JOIN public.bank_ledger bl ON ((bl.account_id = ba.id)))
          WHERE ((ba.tenant_id = t.id) AND (ba.owner_type = 'system'::text))), (0)::numeric) AS execution_capacity_cents,
    COALESCE(( SELECT sum(
                CASE
                    WHEN (bl.direction = 'credit'::text) THEN bl.amount_cents
                    ELSE (- bl.amount_cents)
                END) AS sum
           FROM (public.bank_accounts ba
             JOIN public.bank_ledger bl ON ((bl.account_id = ba.id)))
          WHERE ((ba.tenant_id = t.id) AND (ba.owner_type <> 'system'::text))), (0)::numeric) AS total_credits_cents
   FROM public.tenants t;


ALTER VIEW public.system_coverage OWNER TO postgres;

--
-- Name: unifycard_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unifycard_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    bank_transaction_id uuid,
    external_id text,
    operation_type text NOT NULL,
    amount_cents bigint NOT NULL,
    status text NOT NULL,
    external_partner text,
    raw_response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unifycard_transactions_operation_type_check CHECK ((operation_type = ANY (ARRAY['capture'::text, 'authorization'::text, 'settlement'::text, 'void'::text])))
);


ALTER TABLE public.unifycard_transactions OWNER TO postgres;

--
-- Name: actors actors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actors
    ADD CONSTRAINT actors_pkey PRIMARY KEY (id);


--
-- Name: actors actors_tenant_id_external_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actors
    ADD CONSTRAINT actors_tenant_id_external_id_key UNIQUE (tenant_id, external_id);


--
-- Name: ai_constitutional_limits ai_constitutional_limits_limit_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_constitutional_limits
    ADD CONSTRAINT ai_constitutional_limits_limit_type_key UNIQUE (limit_type);


--
-- Name: ai_constitutional_limits ai_constitutional_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_constitutional_limits
    ADD CONSTRAINT ai_constitutional_limits_pkey PRIMARY KEY (id);


--
-- Name: ai_operations_log ai_operations_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_operations_log
    ADD CONSTRAINT ai_operations_log_pkey PRIMARY KEY (id);


--
-- Name: atl_blocked_actors atl_blocked_actors_actor_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atl_blocked_actors
    ADD CONSTRAINT atl_blocked_actors_actor_id_key UNIQUE (actor_id);


--
-- Name: atl_blocked_actors atl_blocked_actors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atl_blocked_actors
    ADD CONSTRAINT atl_blocked_actors_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_tenant_id_owner_type_owner_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_tenant_id_owner_type_owner_id_key UNIQUE (tenant_id, owner_type, owner_id);


--
-- Name: bank_ledger bank_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_ledger
    ADD CONSTRAINT bank_ledger_pkey PRIMARY KEY (id);


--
-- Name: bank_splits bank_splits_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_splits
    ADD CONSTRAINT bank_splits_pkey PRIMARY KEY (id);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: coverage_audit_log coverage_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coverage_audit_log
    ADD CONSTRAINT coverage_audit_log_pkey PRIMARY KEY (id);


--
-- Name: evasion_patterns evasion_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evasion_patterns
    ADD CONSTRAINT evasion_patterns_pkey PRIMARY KEY (id);


--
-- Name: execution_fund_movements execution_fund_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_movements
    ADD CONSTRAINT execution_fund_movements_pkey PRIMARY KEY (id);


--
-- Name: execution_fund_rules execution_fund_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_rules
    ADD CONSTRAINT execution_fund_rules_pkey PRIMARY KEY (id);


--
-- Name: execution_fund_rules execution_fund_rules_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_rules
    ADD CONSTRAINT execution_fund_rules_tenant_id_key UNIQUE (tenant_id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_intents payment_intents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: unifycard_transactions unifycard_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unifycard_transactions
    ADD CONSTRAINT unifycard_transactions_pkey PRIMARY KEY (id);


--
-- Name: idx_actors_cpf_cnpj; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actors_cpf_cnpj ON public.actors USING btree (cpf_cnpj);


--
-- Name: idx_actors_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_actors_tenant ON public.actors USING btree (tenant_id);


--
-- Name: idx_ai_operations_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_operations_created ON public.ai_operations_log USING btree (created_at);


--
-- Name: idx_ai_operations_instance; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_operations_instance ON public.ai_operations_log USING btree (ai_instance_id);


--
-- Name: idx_atl_blocked_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_atl_blocked_actor ON public.atl_blocked_actors USING btree (actor_id);


--
-- Name: idx_bank_accounts_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_accounts_actor ON public.bank_accounts USING btree (actor_id);


--
-- Name: idx_bank_accounts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_accounts_status ON public.bank_accounts USING btree (credit_status);


--
-- Name: idx_bank_accounts_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_accounts_tenant ON public.bank_accounts USING btree (tenant_id);


--
-- Name: idx_bank_ledger_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_ledger_account ON public.bank_ledger USING btree (account_id);


--
-- Name: idx_bank_ledger_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_ledger_created ON public.bank_ledger USING btree (created_at);


--
-- Name: idx_bank_ledger_transaction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_ledger_transaction ON public.bank_ledger USING btree (transaction_id);


--
-- Name: idx_bank_splits_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_splits_source ON public.bank_splits USING btree (source_actor_id);


--
-- Name: idx_bank_splits_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_splits_target ON public.bank_splits USING btree (target_actor_id);


--
-- Name: idx_bank_splits_transaction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_splits_transaction ON public.bank_splits USING btree (transaction_id);


--
-- Name: idx_bank_transactions_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_account ON public.bank_transactions USING btree (account_id);


--
-- Name: idx_bank_transactions_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_actor ON public.bank_transactions USING btree (actor_id);


--
-- Name: idx_bank_transactions_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_created ON public.bank_transactions USING btree (created_at);


--
-- Name: idx_bank_transactions_purpose; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_purpose ON public.bank_transactions USING btree (purpose);


--
-- Name: idx_bank_transactions_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_bank_transactions_tenant ON public.bank_transactions USING btree (tenant_id);


--
-- Name: idx_coverage_audit_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_coverage_audit_tenant ON public.coverage_audit_log USING btree (tenant_id);


--
-- Name: idx_evasion_patterns_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evasion_patterns_actor ON public.evasion_patterns USING btree (actor_id);


--
-- Name: idx_evasion_patterns_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_evasion_patterns_type ON public.evasion_patterns USING btree (pattern_type);


--
-- Name: idx_execution_fund_movements_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_execution_fund_movements_tenant ON public.execution_fund_movements USING btree (tenant_id);


--
-- Name: idx_orders_buyer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_actor_id);


--
-- Name: idx_orders_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_seller ON public.orders USING btree (seller_actor_id);


--
-- Name: idx_orders_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_tenant ON public.orders USING btree (tenant_id);


--
-- Name: idx_payment_intents_actor; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_intents_actor ON public.payment_intents USING btree (actor_id);


--
-- Name: idx_payment_intents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_intents_status ON public.payment_intents USING btree (status);


--
-- Name: idx_payment_intents_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_intents_tenant ON public.payment_intents USING btree (tenant_id);


--
-- Name: idx_unifycard_bank_tx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unifycard_bank_tx ON public.unifycard_transactions USING btree (bank_transaction_id);


--
-- Name: idx_unifycard_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unifycard_tenant ON public.unifycard_transactions USING btree (tenant_id);


--
-- Name: bank_transactions trg_check_atl; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_check_atl BEFORE INSERT ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.check_atl_before_transaction();


--
-- Name: bank_ledger trg_check_coverage; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_check_coverage BEFORE INSERT ON public.bank_ledger FOR EACH ROW EXECUTE FUNCTION public.check_coverage_before_credit();


--
-- Name: bank_ledger trg_update_activity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_update_activity AFTER INSERT ON public.bank_ledger FOR EACH ROW EXECUTE FUNCTION public.update_account_activity();


--
-- Name: bank_transactions trg_validate_purpose; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_validate_purpose BEFORE INSERT ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_purpose();


--
-- Name: actors actors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.actors
    ADD CONSTRAINT actors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_operations_log ai_operations_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_operations_log
    ADD CONSTRAINT ai_operations_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: atl_blocked_actors atl_blocked_actors_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atl_blocked_actors
    ADD CONSTRAINT atl_blocked_actors_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: atl_blocked_actors atl_blocked_actors_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.atl_blocked_actors
    ADD CONSTRAINT atl_blocked_actors_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bank_accounts bank_accounts_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: bank_accounts bank_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bank_ledger bank_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_ledger
    ADD CONSTRAINT bank_ledger_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_ledger bank_ledger_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_ledger
    ADD CONSTRAINT bank_ledger_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bank_ledger bank_ledger_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_ledger
    ADD CONSTRAINT bank_ledger_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.bank_transactions(id);


--
-- Name: bank_splits bank_splits_source_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_splits
    ADD CONSTRAINT bank_splits_source_actor_id_fkey FOREIGN KEY (source_actor_id) REFERENCES public.actors(id);


--
-- Name: bank_splits bank_splits_target_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_splits
    ADD CONSTRAINT bank_splits_target_actor_id_fkey FOREIGN KEY (target_actor_id) REFERENCES public.actors(id);


--
-- Name: bank_splits bank_splits_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_splits
    ADD CONSTRAINT bank_splits_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bank_splits bank_splits_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_splits
    ADD CONSTRAINT bank_splits_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.bank_transactions(id);


--
-- Name: bank_transactions bank_transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.bank_accounts(id);


--
-- Name: bank_transactions bank_transactions_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: bank_transactions bank_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: coverage_audit_log coverage_audit_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.coverage_audit_log
    ADD CONSTRAINT coverage_audit_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: evasion_patterns evasion_patterns_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evasion_patterns
    ADD CONSTRAINT evasion_patterns_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: evasion_patterns evasion_patterns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evasion_patterns
    ADD CONSTRAINT evasion_patterns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: execution_fund_movements execution_fund_movements_source_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_movements
    ADD CONSTRAINT execution_fund_movements_source_account_id_fkey FOREIGN KEY (source_account_id) REFERENCES public.bank_accounts(id);


--
-- Name: execution_fund_movements execution_fund_movements_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_movements
    ADD CONSTRAINT execution_fund_movements_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: execution_fund_rules execution_fund_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.execution_fund_rules
    ADD CONSTRAINT execution_fund_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: orders orders_buyer_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_actor_id_fkey FOREIGN KEY (buyer_actor_id) REFERENCES public.actors(id);


--
-- Name: orders orders_seller_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_seller_actor_id_fkey FOREIGN KEY (seller_actor_id) REFERENCES public.actors(id);


--
-- Name: orders orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_intents payment_intents_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: payment_intents payment_intents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_intents
    ADD CONSTRAINT payment_intents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: unifycard_transactions unifycard_transactions_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unifycard_transactions
    ADD CONSTRAINT unifycard_transactions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.actors(id);


--
-- Name: unifycard_transactions unifycard_transactions_bank_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unifycard_transactions
    ADD CONSTRAINT unifycard_transactions_bank_transaction_id_fkey FOREIGN KEY (bank_transaction_id) REFERENCES public.bank_transactions(id);


--
-- Name: unifycard_transactions unifycard_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unifycard_transactions
    ADD CONSTRAINT unifycard_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- PostgreSQL database dump complete
--

