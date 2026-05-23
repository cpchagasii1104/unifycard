BEGIN;

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL
    REFERENCES orders(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id UUID,
  reason TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order
  ON order_status_history (order_id, "createdAt" DESC);

CREATE OR REPLACE FUNCTION prevent_order_status_history_modification()
RETURNS TRIGGER
SET search_path = pg_catalog, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order_status_history é append-only. UPDATE/DELETE proibidos.';
END;
$$;

CREATE TRIGGER prevent_order_status_history_update
  BEFORE UPDATE ON order_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_order_status_history_modification();

CREATE TRIGGER prevent_order_status_history_delete
  BEFORE DELETE ON order_status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_order_status_history_modification();

COMMENT ON TABLE order_status_history IS
  'Histórico imutável de transições de status de pedidos. Append-only.';

COMMIT;
