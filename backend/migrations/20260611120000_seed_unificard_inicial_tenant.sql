-- ============================================================
-- F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC — tenant institucional de entrada
-- ============================================================
-- Materializa o tenant institucional canônico "Comunidade Inicial Unificard"
-- (slug `unificard-inicial`), usado como FALLBACK server-side do cadastro orgânico
-- (decisão TENANT FECHADA + DECISION-0115 D1). NÃO pertence a usuário individual;
-- não representa região/empresa/grupo.
--
-- Regras:
--   - id gerado pelo banco (uuid_generate_v4 default) — SEM UUID hardcoded;
--   - idempotente: ON CONFLICT (slug) DO NOTHING (tenants_slug_key);
--   - forward-only; não move/usuários antigos; não toca tenants `user-*` históricos;
--   - sem UPDATE destrutivo; não toca Bank.
-- ============================================================

BEGIN;

INSERT INTO tenants (name, slug)
VALUES ('Comunidade Inicial Unificard', 'unificard-inicial')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
