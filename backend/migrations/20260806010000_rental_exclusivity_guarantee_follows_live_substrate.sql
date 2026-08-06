-- 20260806010000: F-RENTAL-EXCLUSIVITY-GUARANTEE (GO Clayton 2026-08-05).
--
-- A garantia de banco da locação ficou presa ao substrato APOSENTADO. Esta migration a move para o
-- substrato VIVO e retira o bloqueio que a norma proíbe. Forward-only. Δbank=0.
--
-- ── (A) A REGRA QUE NÃO MIGROU ───────────────────────────────────────────────────────────────────
-- `rentable_quantity_single_unless_equipment` (TRAVA 3, 20260708200000, GO Clayton 2026-07-08) vive
-- em `rentable_resources` — 0 linhas desde o arco asset-first. Quando `actor_asset_rental_terms`
-- nasceu (20260708400000, MESMO DIA, horas depois) ela copiou 11 CHECKs do legado e DEIXOU ESTA
-- PARA TRÁS. E é justamente `actor_asset_rental_terms.quantity` que a trava de exclusividade lê
-- como CAPACIDADE (`unified-availability.repository.ts:490` → `:505`,
-- confirmBookingWithResourceLock): `quantity=10` num `resource_type='vehicle'` faria o confirm
-- aceitar 10 reservas confirmadas sobrepostas DO MESMO CARRO.
--
-- ⚠️ ALCANCE MEDIDO, declarado para não inflar: NÃO há superfície HTTP que grave isso hoje. O
-- service valida nos DOIS caminhos de escrita (`rentable-resource.service.ts:92-96` no create,
-- `:780-786` no update) e o único seed usa o writer canônico. Isto é RESTAURAÇÃO DE DEFESA EM
-- PROFUNDIDADE — a doutrina da própria TRAVA 3 ("o service protege ANTES, mas o banco é a última
-- linha") —, não fechamento de buraco alcançável. Sem backfill: o dado vivo já conforma
-- (3 equipment qty 10 · 1 vehicle qty 1).
--
-- ── (B) O BLOQUEIO QUE A NORMA PROÍBE ────────────────────────────────────────────────────────────
-- `availability_rental_no_overlap` é uma EXCLUDE em `availability` — exatamente o que
-- DECISION-0146 §A.7 proíbe por escrito ("PROIBIDO EXCLUDE constraint em availability") e G1 repete
-- ("availability overlap NUNCA hard-blocka"), porque hard-block na DECLARAÇÃO colide com o
-- ARTIGO II da Constituição (conflito gera FATO→ALERTA→humano, nunca ação automática).
-- O GATE-pequeno de 2026-08-05 provou que ela é dispensável: a trava do COMPROMISSO
-- (confirmBookingWithResourceLock + RENTAL_RESOURCE_TIME_CONFLICT, commit 6359d31cc) nasceu
-- 2026-06-23 — QUINZE DIAS ANTES do bloqueio de declaração — e cobre a impossibilidade física na
-- camada que a §A.7 prescreve. Alcance da EXCLUDE hoje: 0 linhas (owner_type='rentable_resource').
--
-- 🟡 FICA NOMEADO, não resolvido aqui: depois desta migration a exclusividade de locação repousa
-- inteiramente no advisory lock de aplicação. A §A.7 admite constraint forte no COMPROMISSO
-- ("se houver constraint forte, ela mira compromisso real de booking") — e não há nenhuma em
-- `bookings`. Materializá-la é fatia própria, com GATE e GO. Ver DT-COMMITMENT-LAYER-HAS-NO-DB-CONSTRAINT.

BEGIN;

-- (A) a garantia acompanha o substrato vivo. Mesma semântica, mesma forma da TRAVA 3.
ALTER TABLE actor_asset_rental_terms
  ADD CONSTRAINT chk_aart_quantity_single_unless_equipment
  CHECK (resource_type = 'equipment' OR quantity = 1);

COMMENT ON CONSTRAINT chk_aart_quantity_single_unless_equipment ON actor_asset_rental_terms IS
  'F-RENTAL-EXCLUSIVITY-GUARANTEE (2026-08-05): sucessora de rentable_quantity_single_unless_equipment '
  '(TRAVA 3), que ficou em rentable_resources quando o arco asset-first migrou o substrato. Alimenta a '
  'capacidade lida por confirmBookingWithResourceLock. Só equipamento é fungível; veiculo/imovel/espaco '
  'tem identidade propria e quantity=1. Capacidade multipla de ESPACO e outro atributo, nao quantity.';

-- (B) o bloqueio de DECLARAÇÃO sai do banco (DECISION-0146 §A.7 / G1 · CONSTITUIÇÃO ART. II).
-- 0 linhas alcançadas; nada é destruído. A proteção real vive no COMPROMISSO.
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_rental_no_overlap;

COMMIT;
