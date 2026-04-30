BEGIN;

CREATE TABLE IF NOT EXISTS service_payment_executions (
  execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id UUID NOT NULL,

  payment_request_id UUID NOT NULL UNIQUE,

  payer_actor_id UUID NOT NULL,
  receiver_actor_id UUID NOT NULL,

  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,

  executed_at TIMESTAMPTZ NOT NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spe_tenant_id
  ON service_payment_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_spe_payment_request_id
  ON service_payment_executions(payment_request_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'actors'
      AND column_name = 'actor_id'
  ) THEN
    BEGIN
      ALTER TABLE service_payment_executions
      ADD CONSTRAINT fk_spe_payer_actor
      FOREIGN KEY (payer_actor_id)
      REFERENCES actors(actor_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
      ALTER TABLE service_payment_executions
      ADD CONSTRAINT fk_spe_receiver_actor
      FOREIGN KEY (receiver_actor_id)
      REFERENCES actors(actor_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  ELSE
    RAISE WARNING 'actors.actor_id nao encontrado - FKs nao criadas - investigar divergencia';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'service_payment_requests'
  ) THEN
    BEGIN
      ALTER TABLE service_payment_executions
      ADD CONSTRAINT fk_spe_payment_request
      FOREIGN KEY (payment_request_id)
      REFERENCES service_payment_requests(payment_request_id)
      ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE service_payment_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_payment_executions FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY tenant_isolation ON service_payment_executions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE service_payment_executions IS
  'Registro canonico de execucoes de pagamento de servico.
   UNIQUE em payment_request_id garante uma execucao por request.
   Splits ficam em bank_splits, referenciados via metadata.bankTransactionId.';

COMMIT;
