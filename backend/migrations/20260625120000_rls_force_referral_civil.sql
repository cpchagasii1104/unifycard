-- 20260625120000_rls_force_referral_civil.sql
-- 🔴 F-RLS-FORCE-REFERRAL-CIVIL — fecha o BLOCKER do RLS-LIVE-OPS-PREFLIGHT-FINAL.
--
-- O preflight final do RLS-live achou 3 tabelas com RLS ENABLED + policy tenant-scoped, porém SEM FORCE
-- ROW LEVEL SECURITY — violando o invariante RLS+FORCE (defesa-em-profundidade: o DONO da tabela também
-- obedece à policy) e reprovando o §1.4 do runbook (`docs/ops/RUNBOOK_RLS_RUNTIME_LIVE_OPS.md`: 0 RLS-without-FORCE).
-- Estas 3 nasceram com ENABLE (mig 20260613120000/20260613130000/20260617120000) mas o FORCE ficou de fora.
-- Esta fatia adiciona SÓ o FORCE (sem policy nova, sem DISABLE). Forward-only; ALTER ... FORCE é idempotente.
-- NÃO toca dado, NÃO toca bank_*, NÃO vira RLS-live (a virada é ato OPS de repoint, separado).

BEGIN;

ALTER TABLE actor_referral_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE identity_civil_confirmation_events FORCE ROW LEVEL SECURITY;
ALTER TABLE user_referral_links FORCE ROW LEVEL SECURITY;

COMMIT;
