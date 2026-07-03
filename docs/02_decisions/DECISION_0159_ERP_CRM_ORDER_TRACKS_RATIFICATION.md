# DECISION-0159 — Ratificação de trilhos separados + substrato comum; definição precisa de "ERP Social"

> **Arquivo canônico.** Fonte append-only viva: `REMEDIATION_DECISIONS_LOG.md` (§ DECISION-0159). Criado em 2026-07-03 na mesma sessão da promulgação.

- **Data:** 2026-07-03
- **Frente:** análise doutrinária pós-imagens + parecer técnico cruzando `DT-ERP-CRM-CANONICAL-ORDER-CONVERGENCE` contra os diagramas · **HEAD (pré-commit):** `b4a9d7670`
- **Tipo:** Arquitetural / ontológica (DOCS-ONLY) — **NÃO MATERIAL**. Ratifica um fork que a própria DT já havia nomeado.
- **Status:** **PROMULGADA / DOCS-ONLY / DECISION_PROMULGATED.** Resolve o `DECISION_REQUIRED` de `DT-ERP-CRM-CANONICAL-ORDER-CONVERGENCE` (28/06).

## Contexto
Clayton apontou que ERP, CRM e PDV tocam a mesma pergunta material (serviços, produtos, locações). Releu-se a doutrina arquitetural dos diagramas da raiz e cruzou-se contra a DT que já mapeara 4 trilhos de ordem sem camada comum. A DT já apresentava dois caminhos e já apontava o doutrinariamente favorecido — só não fora promulgado.

## Decisão soberana (Clayton, via GO ao parecer técnico)
1. **Trilhos separados + substrato comum é o modelo canônico.** Serviços, produtos/PDV, locações e (quando auditado) rides permanecem 4 trilhos distintos, unidos só por: `actor` + `unified_availability`/`bookings` + `bank_ledger` + `my-orders`. **NÃO** nasce uma tabela `orders` canônica única por cima dos 4 trilhos.
2. **Fundamento doutrinário:** ordem canônica única violaria "sem terceira entidade criadora de estado", "sem engine universal" e "segunda fonte de verdade" (freios explícitos em `mapa.png`/`BASE.png`). O PDV já prova o modelo correto: reusa `orders`/`order_items`/catálogo do marketplace em vez de modelo próprio — é `fluxo.png` funcionando como projetado.
3. **O gap real é a maturação de Coordination/Publication** (marcadas `EMERGENTE` nos diagramas), não a ausência de Order único.
4. **Definição precisa de "ERP Social":** não é módulo a construir — é a composição já nomeada no diagrama: **Identidade real + Autoridade real + Settlement + Publication (relatórios = projeção)**.
5. **Locações confirmadas no caminho certo:** `rentable_resources` (DECISION-0151) estende o mesmo pilar TEMPO que serviços usa. Falta só a superfície HTTP equivalente aos passos 6-8 do Trilho B, não desenho novo.

## Materialização / Prova
**NENHUMA** (docs-only). **Δbank=0.**

## Consequências
`DT-ERP-CRM-CANONICAL-ORDER-CONVERGENCE` → CLOSED/DECIDED. Abre precondição para `F-RENTAL-RESOURCE-SURFACE-SLICE-A`. Registra separadamente `DT-CRM-CONTACTS-PARALLEL-IDENTITY-RISK` (não resolvido aqui).

- **Responsável:** Clayton / IA-DIRETORA (executor: Claude Fable 5).
- **Referências:** `visao-do-unificard.png` · `BASE.png` · `mapa.png` · `fluxo.png` · DECISION-0151 · DECISION-0062 (D7).
