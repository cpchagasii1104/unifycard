-- 20260806230000: F3 — a CHAVE evento↔demanda (DECISION-0196 §H, GATE + GO Clayton 2026-08-06).
--
-- `service_demands.need_id` — FK ANULÁVEL para `event_operational_needs`. Nulo = demanda avulsa
-- (sem evento), que é o caso de 100% do dado de hoje. NADA REGRIDE. Forward-only. Δbank=0.
--
-- ── POR QUE A CHAVE É A NEED, E NÃO O EVENTO ─────────────────────────────────────────────────────
-- Ligar `service_demands` direto a `events` criaria SEGUNDA VERDADE sobre "o que este evento
-- precisa" — e essa pergunta JÁ TEM CASA: `event_operational_needs` (§H). Medido em 2026-08-06:
--   SELECT fulfillment_kind, count(*) FROM event_operational_needs GROUP BY 1;
--   -- service 12 · rentable 2   ⇒ 14 needs VIVAS, o número da §H confere
--   UNIQUE (event_id, need_concept_id)  ⇒ a need é única por (evento, conceito); need_id é N:1
--
--     events → event_operational_needs → service_demands → service_demand_responses
--                (o QUE precisa)          (o PEDIDO)         (o PREÇO)
--
-- ⛔ O VALOR NÃO ENTRA AQUI (§H.2). Necessidade declarada ≠ preço; pedido ≠ preço. O valor mora na
--    RESPOSTA (`quote_cents`) e a F3 agrega de baixo para cima. Varredura feita antes desta
--    migration: ZERO tabela no banco com coluna cost/budget/orcamento — não há com o que colidir.
-- ⚠️ `event_financial_execution` NÃO serve e o nome engana (0 linhas; status/error_message/
--    processed_at = rastreamento de execução, não custo). Registrado para ninguém tropeçar de novo.
--
-- ── 🔴 O QUE O GATE ACHOU E O PLANO NÃO DIZIA: a FK atravessa fronteira de ISOLAMENTO ────────────
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('service_demands','event_operational_needs');
--   -- service_demands          t   ← RLS LIGADO, e tenant_id NOT NULL
--   -- event_operational_needs  f   ← RLS DESLIGADO, e SEM coluna tenant_id
-- O tenant da need mora UM SALTO adiante, em `events.tenant_id`. Uma FK anulável simples NÃO impede
-- uma demanda do tenant A apontar para need de evento do tenant B — duas respostas para "de quem é
-- isto", que é precisamente o que a regra de Clayton ("não pode existir segunda verdade") proíbe.
-- Hoje o risco é LATENTE, não vivo: 2 tenants, só 1 com eventos.
--
-- ⚠️ E a ausência de `tenant_id` NÃO é defeito da need — é o PADRÃO da casa: 6 tabelas com
--    `event_id` e sem `tenant_id` (event_category_facets, event_theme_links, …). Endurecer o padrão
--    aqui seria o roteador legislando. A saída é a que a `DECISION-0146 §A.6` já prescreve:
--    *"onde FK condicional não couber, guard/writer fail-closed"*. Por isso esta migration entrega
--    a FK, e a COERÊNCIA DE TENANT é imposta no writer (`demand.service.ts`) + guard
--    `audit-demand-need-tenant-coherence`. Declarado aqui para ninguém supor que o banco cobre o
--    que ele não cobre.
--
-- ── ON DELETE SET NULL, e não CASCADE ───────────────────────────────────────────────────────────
-- Apagar a NECESSIDADE não pode apagar o PEDIDO: a demanda é registro comercial próprio, com
-- respostas e possivelmente compromisso. Perder o elo é degradação aceitável (vira demanda avulsa);
-- perder a demanda seria destruição de fato. Mesmo espírito do `service_orders.booking_id`, que já
-- é SET NULL neste repositório.

BEGIN;

ALTER TABLE service_demands
  ADD COLUMN IF NOT EXISTS need_id uuid NULL
  REFERENCES event_operational_needs(id) ON DELETE SET NULL;

COMMENT ON COLUMN service_demands.need_id IS
  'DECISION-0196 §H · 2026-08-06. A NECESSIDADE do evento que este pedido atende. NULL = demanda '
  'avulsa (sem evento) — o caso de 100% do dado ao nascer desta coluna. NAO carrega valor (§H.2: o '
  'preco mora na RESPOSTA). COERENCIA DE TENANT NAO e garantida pelo banco: event_operational_needs '
  'nao tem tenant_id (o tenant mora em events) — e imposta no writer + guard '
  'audit-demand-need-tenant-coherence, conforme DECISION-0146 §A.6.';

-- Leitura do dashboard: "as demandas desta need" e "as needs deste evento" são as duas consultas
-- da F3. Parcial porque NULL é o caso comum (demanda avulsa) e não precisa entrar no índice.
CREATE INDEX IF NOT EXISTS idx_service_demands_need
  ON service_demands (need_id) WHERE need_id IS NOT NULL;

COMMIT;
