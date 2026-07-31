-- 20260731130000_severity_priority_canonical_convergence.sql
-- F-SEVERITY-CANONICAL-CONVERGENCE: converge as 4 colunas `severity` vivas para
-- docs/01_normative/07_NOMENCLATURA_CANONICA.md §4.34 — VARCHAR(20), UPPER_CASE,
-- vocabulário CRITICAL/ERROR/WARNING/INFO/AUDIT (severity ≠ priority: "não são sinônimos").
--
-- Origem do defeito: `alerts.severity` nasceu (migration 20260731120000) seguindo
-- automation.types.ts (low/medium/high/critical, vocabulário de PRIORITY colado em campo
-- SEVERITY) em vez de seguir a norma — a própria direção corrigiu a si mesma no mesmo dia.
-- Ao medir, as OUTRAS 3 superfícies vivas do mesmo campo tinham o mesmo defeito, cada uma à
-- sua maneira: audit_events/trust_events já usavam low/medium/high/critical (idêntico ao
-- defeito do alerts); financial_alerts usava info/warning/critical minúsculo (vocabulário
-- certo, case errado); trust_events tinha o agravante de DEFAULT 'low' minúsculo enquanto o
-- código (TrustEventSeverity) já escrevia LOW/MEDIUM/HIGH maiúsculo — dois vocabulários
-- coexistindo na mesma coluna, nunca colididos porque a tabela está vazia.
--
-- Mapeamento (regra geral aplicada a TODAS as 4 superfícies + dado existente):
--   critical → CRITICAL · high/HIGH → ERROR · medium/MEDIUM → WARNING · low/LOW → INFO
--   financial_alerts (já correto semanticamente): info → INFO · warning → WARNING ·
--   critical → CRITICAL (só maiúsculo, sem remapeamento de valor).
--
-- Estado medido em unificard_dev antes desta migration:
--   audit_events.severity      TEXT  CHECK chk_audit_events_severity        4 linhas (severity='low')
--   trust_events.severity      TEXT  CHECK trust_events_severity_check      0 linhas (DEFAULT 'low')
--   financial_alerts.severity  TEXT  SEM CONSTRAINT                         0 linhas
--   alerts.severity            ENUM alert_severity (low/medium/high/critical)  0 linhas

BEGIN;

-- ═══ 1. audit_events — 4 linhas vivas, remapear dado + trocar CHECK ═══
-- 🔴 ORDEM IMPORTA: o CHECK antigo (lowercase) ainda está ativo durante o UPDATE se não for
-- derrubado primeiro — gravar 'INFO' sob o CHECK velho viola a própria constraint que estamos
-- substituindo. Achado real via prova E2E (ephemeral) antes de tocar unificard_dev.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS chk_audit_events_severity;

UPDATE audit_events SET severity = CASE severity
  WHEN 'critical' THEN 'CRITICAL'
  WHEN 'high'     THEN 'ERROR'
  WHEN 'medium'   THEN 'WARNING'
  WHEN 'low'      THEN 'INFO'
  ELSE severity
END
WHERE severity IN ('critical', 'high', 'medium', 'low');

ALTER TABLE audit_events ADD CONSTRAINT chk_audit_events_severity
  CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT'));

-- ═══ 2. trust_events — vazia; trocar DEFAULT + CHECK (nome auto-gerado, achado ao vivo) ═══
ALTER TABLE trust_events ALTER COLUMN severity DROP DEFAULT;
ALTER TABLE trust_events DROP CONSTRAINT IF EXISTS trust_events_severity_check;
ALTER TABLE trust_events ADD CONSTRAINT trust_events_severity_check
  CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT'));
ALTER TABLE trust_events ALTER COLUMN severity SET DEFAULT 'WARNING';

-- ═══ 3. financial_alerts — vazia, SEM CONSTRAINT hoje; ganha o CHECK pela 1ª vez ═══
ALTER TABLE financial_alerts ADD CONSTRAINT chk_financial_alerts_severity
  CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT'));

-- ═══ 4. alerts.severity — ENUM nativo, vazia; troca de tipo com cuidado (mesmo sem linhas) ═══
ALTER TYPE alert_severity RENAME TO alert_severity_legacy_lowercase_20260731;

CREATE TYPE alert_severity AS ENUM ('CRITICAL', 'ERROR', 'WARNING', 'INFO', 'AUDIT');

ALTER TABLE alerts ALTER COLUMN severity DROP DEFAULT;
ALTER TABLE alerts ALTER COLUMN severity TYPE alert_severity USING (
  CASE severity::text
    WHEN 'critical' THEN 'CRITICAL'
    WHEN 'high'      THEN 'ERROR'
    WHEN 'medium'    THEN 'WARNING'
    WHEN 'low'       THEN 'INFO'
    ELSE 'WARNING' -- inalcançável: tabela vazia no momento desta migration
  END
)::alert_severity;
ALTER TABLE alerts ALTER COLUMN severity SET DEFAULT 'WARNING';

DROP TYPE alert_severity_legacy_lowercase_20260731;

COMMENT ON COLUMN audit_events.severity IS
  'Severidade (impacto técnico), vocabulário §4.34: CRITICAL, ERROR, WARNING, INFO, AUDIT. UPPER_CASE. severity ≠ priority — não são sinônimos.';
COMMENT ON COLUMN trust_events.severity IS
  'Severidade (impacto técnico), vocabulário §4.34: CRITICAL, ERROR, WARNING, INFO, AUDIT. UPPER_CASE. severity ≠ priority — não são sinônimos.';
COMMENT ON COLUMN financial_alerts.severity IS
  'Severidade (impacto técnico), vocabulário §4.34: CRITICAL, ERROR, WARNING, INFO, AUDIT. UPPER_CASE. severity ≠ priority — não são sinônimos.';
COMMENT ON COLUMN alerts.severity IS
  'Severidade (impacto técnico), vocabulário §4.34: CRITICAL, ERROR, WARNING, INFO, AUDIT. UPPER_CASE. severity ≠ priority — não são sinônimos.';

COMMIT;
