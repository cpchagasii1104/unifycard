BEGIN;

CREATE TABLE company_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE
);

INSERT INTO company_types (name) VALUES
  ('hortifruti'),
  ('açougue'),
  ('padaria'),
  ('salão')
ON CONFLICT (name) DO NOTHING;

COMMIT;
