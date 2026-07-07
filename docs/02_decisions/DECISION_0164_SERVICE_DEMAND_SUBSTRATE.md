# DECISION-0164 — Substrato de DEMANDA de serviço (fatia A do motor de orquestração)

**Status:** ✅ RATIFICADA por Clayton 2026-07-07 ("execute", após pack F-SERVICE-DEMAND-ORCHESTRATION
com 7 adendos + 3 decisões cravadas na mesma conversa) · **Contrato exigido pelo 00_AGENT_PROTOCOL
§2.3.3 para tabela nova.**

## 1. O que promulga
- **D1 — Tabela `service_demands`** (RLS ENABLE+FORCE, GUC `app.current_tenant`): a DEMANDA é objeto
  econômico de 1ª classe (matching consulta concept∩tempo∩quantidade — jsonb em posts não indexa).
  Colunas: emissor (actor_id), concept_id (FK concepts — SSOT semântico), vinculo, quantity/
  quantity_filled (decrementa até fechar), datas/horários/dias-da-semana (TEMPO), radius_km (ESPAÇO;
  geo fino compõe com feed-proximity), acceptance_mode, pricing_mode, offered_price_cents (REGISTRO
  do combinado — mover dinheiro = PORTA-1), cancel_notice_hours (emissor define), visibility
  (default 'public' — decisão Clayton), status de ciclo de vida, post_id opcional (espelho no feed).
- **D2 — Vocabulários GOVERNADOS novos (fonte TS única + CHECK + manifest):**
  `vinculo`: diaria | periodo | recorrente | efetivo (decisão Clayton: wizard se molda)
  `acceptance_mode`: automatico | com_analise (adendo 2)
  `pricing_mode`: preco_ofertado | orcamento (adendo 6)
  `demand_status`: open | filled | closed | cancelled
  `response_status`: pending | accepted | chosen | rejected | withdrawn (candidatura/aceite)
- **D3 — Tabela `service_demand_responses`** (RLS idem): aceite/candidatura do provider —
  automatico: response accepted → incrementa quantity_filled (até fechar) · com_analise: response
  pending → emissor escolhe (chosen). Cancelamento do provider reabre a vaga (decrementa) — a
  re-orquestração (push) é fatia C (depende de central de notificações).
- **D4 — Concepts de trabalho:** compor com os EXISTENTES (manicure, faxina-residencial, jardinagem)
  e criar os faltantes no N0 `servicos` (garcom, pedreiro, servente-demolicao, encarregado-de-obra,
  seguranca-eventos, cozinheiro, eletricista, encanador) e `mobilidade-e-logistica` (motoboy) —
  método tríade; lista sujeita a emenda de Clayton (rito confirmado).
- **D5 — Fronteiras:** Δbank=0 (valores são REGISTRO); relação≠autoridade; catraca 0113 em toda rota
  (actionContext + canRepresentActor); reputação/no-show = fatia posterior (religamento do ranking
  pack); custo de visita (adendo 7) = fase orçamento (fatia B+).

## 2. Cruza com
Pack F-SERVICE-DEMAND-ORCHESTRATION (REMEDIATION_DT_LOG) · 0113 · 0116 · 0162/0163 (padrões) ·
ranking pack (HOLD) · PORTA-1 (dinheiro).
