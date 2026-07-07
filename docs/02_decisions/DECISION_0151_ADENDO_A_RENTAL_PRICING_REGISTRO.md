# DECISION-0151 — ADENDO A: preço-anúncio e unidade de cobrança em rentable_resources (REGISTRO)

**Status:** ✅ RATIFICADO POR ORDEM DIRETA (Clayton, 2026-07-07: "faltam informações se a locação
é por dia, por hora, por período... o objetivo aqui é a gente organizar de vez esta parte")
**Altera:** DECISION-0151 Opção B ("sem coluna financeira em rentable_resources")

## 1. O que muda
`rentable_resources` ganha DUAS colunas de ANÚNCIO:
- `pricing_unit` — vocabulário GOVERNADO (`RENTAL_PRICING_UNITS`: `por_hora` · `por_dia` ·
  `por_semana` · `por_mes`), CHECK físico + manifest.
- `price_cents` — BIGINT NULL, **REGISTRO PURO do preço anunciado**.

## 2. O que NÃO muda (a razão de ser da 0151 continua de pé)
- **Δbank=0 absoluto:** nenhuma leitura/escrita de `bank_*`; preço anunciado NUNCA alimenta
  decisão financeira, cálculo de saldo ou split. Execução de pagamento de locação = **PORTA-1**.
- Precedente selado: `service_demands.offered_price_cents` (DECISION-0164, Yala PASS §1 —
  "colunas de REGISTRO, nunca alimentam decisão financeira", LEI §4.6 respeitada).
- Guard da fronteira: mesma classe de verificação do motor de demanda.

## 3. Contexto do mesmo ato (superfície /locacoes)
- **Freio "sem discovery" da SLICE-B (2026-07-03) REVOGADO por Clayton** para locações:
  modo CONSUMIR = descoberta de recursos de terceiros (tela análoga ao Fazer compras);
  modo OPERAR = gestão do dono (cadastro completo + disponibilidade).
- Disponibilidade = **Agenda universal** (`availability.owner_type='rentable_resource'`,
  DECISION-0151 FASE 2a, anti-sobreposição por advisory lock JÁ VIVO) — proibido calendário paralelo.
