BEGIN;

ALTER TABLE reconciliation_discrepancies
ADD COLUMN metadata JSONB;

COMMIT;
