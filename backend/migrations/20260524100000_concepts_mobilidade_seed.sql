-- Seeds de conceitos Nível 1 (classe funcional) para mobilidade-e-logistica.
-- Ver docs/03_execution_log/RIDES_MOBILIDADE_EXECUTION_FINAL_2026-04-13.md — FASE 1.
-- Idempotente: ON CONFLICT DO NOTHING.

BEGIN;

SELECT set_config('app.concept_governance', 'true', true);

INSERT INTO concepts (slug, domain)
VALUES
  ('carro',        'mobilidade-e-logistica'),
  ('moto',         'mobilidade-e-logistica'),
  ('van',          'mobilidade-e-logistica'),
  ('caminhao',     'mobilidade-e-logistica'),
  ('onibus',       'mobilidade-e-logistica'),
  ('bicicleta',    'mobilidade-e-logistica'),
  ('pickup',       'mobilidade-e-logistica'),
  ('lancha',       'mobilidade-e-logistica'),
  ('iate',         'mobilidade-e-logistica'),
  ('navio',        'mobilidade-e-logistica'),
  ('helicoptero',  'mobilidade-e-logistica'),
  ('aviao',        'mobilidade-e-logistica')
ON CONFLICT (domain, slug) DO NOTHING;

COMMIT;
