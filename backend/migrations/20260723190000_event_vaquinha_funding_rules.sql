-- 20260723190000: VAQUINHA (all-or-nothing crowdfunding) — REGRAS DECLARADAS na linha events (SLICE S1).
-- A vaquinha do Clayton = financiamento coletivo tudo-ou-nada: uma META, um PRAZO e estorno-se-não-atingir.
-- A META já existe como events.min_attendees (contagem de PESSOAS, GO 2026-07-08) e o modo de acesso
-- event_access_type='contribuicao_opcional' já existe. Esta fatia adiciona SÓ as regras DECLARADAS que faltam:
--   • funding_deadline_at — o PRAZO da vaquinha (quando o "prometer" fecha). CONCEITO DISTINTO de datetime_end
--     (= FIM do evento): o prazo de financiamento é ANTES do evento acontecer, não o encerramento dele.
--   • is_all_or_nothing — prefixo booleano canônico is_ (cf. 20260530410000_fix_boolean_prefixes.sql). v1: a
--     regra de estorno É tudo-ou-nada (se min_attendees não for atingido até funding_deadline_at → tudo estorna).
-- 🔴 Bank-free (Δbank=0): a META continua PESSOAS (min_attendees), NUNCA cents/funding_goal_cents — NENHUMA
--    coluna de dinheiro nasce aqui. A MOVIMENTAÇÃO real de dinheiro (promessa/estorno) é PORTA-01, FORA desta
--    fatia. Aqui só a REGRA declarada. política de estorno mais rica (enum) = DEFERIDA (all_or_nothing captura v1).
-- Additive + idempotente + forward-only. Sem sha/immutability pin em events (tabela já teve vários ADD COLUMN).
BEGIN;

-- 1. As 2 colunas de regra da vaquinha (DECLARADAS, NULLABLE p/ deadline; booleano com DEFAULT canônico false).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS funding_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_all_or_nothing   BOOLEAN NOT NULL DEFAULT false;

-- 2. CHECK físico: all-or-nothing EXIGE a meta (não há vaquinha tudo-ou-nada sem META de pessoas).
--    Tolerante a NULL; linhas existentes passam (is_all_or_nothing default false → NOT false = true).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_all_or_nothing_requires_goal'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT chk_events_all_or_nothing_requires_goal
      CHECK (NOT is_all_or_nothing OR min_attendees IS NOT NULL);
  END IF;
END $$;

-- 3. CHECK físico: o PRAZO de financiamento fecha AT/ANTES de o evento começar (funding_deadline_at <=
--    datetime_start). Tolerante a NULL nos dois lados (fatia não força datas). funding_deadline_at NUNCA é
--    datetime_end (fim do evento) — são conceitos separados; aqui o backstop físico prova a distinção temporal.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_funding_deadline_before_start'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT chk_events_funding_deadline_before_start
      CHECK (
        funding_deadline_at IS NULL
        OR datetime_start IS NULL
        OR funding_deadline_at <= datetime_start
      );
  END IF;
END $$;

-- 4. CHECK físico: vaquinha all-or-nothing SÓ em evento de contribuição opcional. Um evento gratuito ou pago
--    (ingresso de valor fixo) não é vaquinha. Row-level: vê ambas as colunas no fim do statement. Tolerante a
--    NULL (is_all_or_nothing default false → passa). Coerência declarada = o modo de acesso governa a regra.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_all_or_nothing_access_type'
  ) THEN
    ALTER TABLE events
      ADD CONSTRAINT chk_events_all_or_nothing_access_type
      CHECK (NOT is_all_or_nothing OR event_access_type = 'contribuicao_opcional');
  END IF;
END $$;

COMMIT;
