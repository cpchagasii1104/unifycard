-- 20260806180000: `live_presence.status` converge para minúsculo (GO Clayton 2026-08-06).
--
-- `07_NOMENCLATURA §4.11` e a tabela de case do CLAUDE.md §3.2: **status/lifecycle é snake_case
-- MINÚSCULO**. MAIÚSCULO é exclusividade de `severity` e `priority` (§4.34), que são outro eixo.
-- `live_presence.status` nasceu `ONLINE|OFFLINE` — a exceção sem razão.
--
-- 🔴 POR QUE AGORA, e não "quando alguém precisar": a tabela tem **0 linhas** (medido em
-- unificard_dev, 2026-08-06). Este é o momento mais barato que vai existir — com dado dentro, a
-- mesma convergência vira migração de conteúdo, com janela e risco. O `organizacaoevento.md §8`
-- ainda lista "CHECK em live_presence.status" como pré-requisito do trilho de urgência; o CHECK já
-- existia (errata do GATE F0), e o que faltava era o CASE.
--
-- Δbank = 0. Forward-only. Sem backfill necessário (0 linhas) — o UPDATE fica por CORREÇÃO DE FORMA,
-- para que esta migration seja verdadeira também em qualquer ambiente que já tenha dado.

BEGIN;

ALTER TABLE live_presence DROP CONSTRAINT IF EXISTS live_presence_status_check;

-- Converte o dado ANTES de reapertar o CHECK — a ordem inversa faria a própria migration falhar
-- num ambiente com linhas.
UPDATE live_presence SET status = lower(status) WHERE status <> lower(status);

ALTER TABLE live_presence
  ADD CONSTRAINT live_presence_status_check CHECK (status IN ('online', 'offline'));

COMMENT ON COLUMN live_presence.status IS
  'Presenca ao vivo. MINUSCULO por 07_NOMENCLATURA §4.11 (status/lifecycle e snake_case minusculo; '
  'MAIUSCULO e so severity/priority, §4.34). Convergido em 2026-08-06 com a tabela ainda VAZIA — '
  'o momento mais barato. Vocabulario fechado: online|offline.';

COMMIT;
