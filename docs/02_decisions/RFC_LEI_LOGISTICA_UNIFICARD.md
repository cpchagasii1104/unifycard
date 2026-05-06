> **Nota de trilho (obrigatória):** Este documento consolida proposta normativa de logística/movimento físico. **Não substitui** a normativa vigente em `docs/01_normative/` até aprovação humana explícita e consolidação formal pelo trilho institucional correto (fora de MODO EXECUTOR sobre norma).

# RFC — Proposta: Lei de Logística e Movimento Físico — UNIFICARD

**ID:** RFC-LEI-LOGISTICA-v1  
**STATUS:** `RASCUNHO`  
**Natureza:** proposta normativa (candidata a futuro `docs/01_normative/LEI_LOGISTICA_UNIFICARD.md` após revisão e promoção explícita)  
**Vigência:** nenhuma até aprovação humana e eventual ficheiro canónico em `01_normative/`.  
**Escopo:** GLOBAL — todo código e contrato que materializem deslocação física de bens ou pessoas no ecossistema UnifiCard

**Contexto:** o texto abaixo foi produzido como lei e colocado temporariamente em `docs/01_normative/`; isso **não** cumpre `00_AGENT_PROTOCOL.md` (EXECUTOR não altera normativa). O conteúdo foi **preservado** aqui; o caminho em `01_normative/` foi **neutralizado** (stub). Ver `docs/03_execution_log/` com registo desta correcção.

---

## Subordinação e precedência

1. `CONSTITUICAO_UNIFICARD.md`  
2. `LEIS_OPERACIONAIS_UNIFICARD.md`  
3. `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — em especial **§2** (realidade única), **§3.1** (pilares universais), **§3.2** (SSOT), **§4.2** (apenas o SSOT define estado final da sua dimensão), e a proibição de **SSOT paralelo** / **realidade paralela**.  
4. `SSOT_REGISTRY_UNIFICARD.md` — entradas futuras para movimento físico **devem** convergir com esta proposta, após promoção a lei, com atualização explícita do registry quando a persistência canónica existir.  
5. `18_DOMAIN_ONTOLOGY_UNIFICARD.md` — domínio `mobilidade-e-logistica` como **domínio de produto**; **não** confundir com pilar.  
6. `docs/02_decisions/RFC_UNIFIED_LOGISTICS_MODEL.md` — modelo e mapeamentos evolutivos; em tensão com (1)–(4), prevalecem os documentos de maior precedência.

---

# 1. FINALIDADE

Esta proposta fixa a **soberania sistémica** sobre **movimento físico** (transporte de pessoas e bens, cadeias multi-perna, agregação de demanda): **quem pode criar verdade**, **quem planeja** e **quem executa**, de modo que **nenhum módulo** crie **demanda de transporte** ou **decisão de meio móvel** paralela às fontes aqui definidas.

---

# 2. NATUREZA (o que logística **é** e **não** é)

## 2.1 Logística **não** é pilar

Os **pilares universais** do sistema (money, time, identity, state, event, authority) estão definidos na `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` **§3.1**. **Logística não constitui novo pilar.**

## 2.2 Logística **é** dimensão operacional transversal com SSOT próprio de movimento

* Atravessa módulos (marketplace, eventos, rides, etc.).  
* **Compõe** os pilares onde necessário: usa **time** (janelas, SLA), **state** (estado do plano e das pernas), **event** (efeitos observáveis), **money** (liquidação via Bank), **identity** / **authority** (quem ordena e quem executa) — **sem** substituir os SSOT desses pilares.

## 2.3 Objeto da proposta

**Movimento físico canónico:** necessidade reconhecível de deslocar massa, volume e/ou pessoas entre lugares, com políticas de serviço aplicáveis.

---

# 3. SSOT DE LOGÍSTICA (FONTES DE VERDADE DO MOVIMENTO)

As entidades conceptuais canónicas **são** (nomes estáveis; persistência concreta em RFC/schema filho):

| Entidade | Papel |
|----------|--------|
| **UnifiedDemand** | **Única** entrada válida de “existe necessidade de movimento físico” no sistema, com origem referenciada (pedido, evento, intent, etc.). |
| **TransportPlan** | Plano de execução derivado do UnifiedDemand: sequência, política e metadados do planner. |
| **TransportLeg** | Unidade executável do plano: origem, destino, **vehicleType** (ou classe de recurso móvel equivalente **decidida pelo núcleo de logística**). |

**Implementação de referência (código):** `backend/src/modules/logistics/` — **até** alinhamento total de nomenclatura (`TransportDemand` ↔ `UnifiedDemand` por RFC), a proposta aplica-se ao **papel** das entidades, não ao nome do ficheiro.

---

# 4. REGRAS OBRIGATÓRIAS

1. **Toda** necessidade de movimento físico reconhecida pelo produto **DEVE** materializar-se ou referenciar-se como **UnifiedDemand** (ou extensão normada equivalente). **É proibido** sustentar, como verdade primária de **movimento**, modelos paralelos não mapeados a UnifiedDemand.  
2. **Somente** o núcleo **logistics** (planner e políticas registadas) **gera** **TransportPlan** e define **vehicleType** em **TransportLeg**.  
3. **Rides** **executa** pernas de transporte materializadas no domínio `rides_*` **em conformidade** com o plano (ou com exceção normada e auditável). **É proibido** que **rides** seja a **origem** da decisão canónica de tipo de meio para o plano global.  
4. **Marketplace** **não** define logística canónica: cria pedidos, contratos e operações de comércio; quando houver entrega física, **gera ou referencia** **UnifiedDemand** — **não** substitui TransportPlan.  
5. **Orchestrator** **não** define **vehicleType** nem cria plano de transporte; **delega** ao pipeline demanda → logistics → rides (contratos de API em RFC filho).  
6. **Fulfillment** (stock, picking, `SHIPPED`) permanece **domínio de pedido / WMS**; só se liga ao movimento físico canónico por **referência** a UnifiedDemand quando a entrega exigir transporte — **sem** confundir estado comercial de envio com SSOT de plano.

---

# 5. INTEGRAÇÃO (FLUXO CANÓNICO ALVO)

```text
Marketplace | Events | outros domínios
  → UnifiedDemand
        → Logistics: TransportPlan (+ TransportLegs)
              → Rides: execução (corrida / perna)
                    → Bank: liquidação (SSOT money)
                    → Authority: governação de mutações sensíveis
                    → Event / outbox: efeitos pós-commit (pilares já normados)
```

Nenhuma seta pode ser saltada para **inventar** segunda verdade de movimento.

---

# 6. PROIBIÇÕES EXPLÍCITAS

1. **É proibido** usar **DeliveryOrder** (ou equivalente comercial) como **SSOT de logística** ou substituto de **UnifiedDemand** / **TransportPlan** — apenas como **origem comercial** ou **referência** mapeada.  
2. **É proibido** **vehicleType** (ou equivalente) **hardcoded** ou decidido **fora** do núcleo logistics em fluxos que representem **plano canónico de movimento** (inclui defaults em orchestrator para intents de transporte).  
3. **É proibido** manter **múltiplos modelos concorrentes** de “demanda de entrega / transporte” sem **mapeamento explícito** para UnifiedDemand e sem plano de convergência aprovado (GATE + RFC).  
4. **É proibido** confundir **service assignment** (marketplace dispatch — prestador de serviço) com **vehicle dispatch** (execução de perna logística) na **norma** e na **documentação** sem qualificador lexical.

---

# 7. PRINCÍPIO DE CONVERGÊNCIA (CÓDIGO EXISTENTE)

O repositório pode conter **estado de transição** (`ride_request` isolado, `TransportDemand` em código, `DeliveryOrder` em memória, orchestrator com `vehicleType`). Isto **não** dispensa a proposta, após promoção: a implementação **deve** convergir para este contrato **sem** criar sétima via paralela. Cada alteração **exige** revisão humana (GATE) e, quando aplicável, entrada em `docs/03_execution_log/` e atualização do **SSOT_REGISTRY**.

---

# 8. DISPOSIÇÕES FINAIS

* Violação das regras aqui propostas, após adoção, enquadrar-se-ia na **LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md** **§2** e nas regras de **não-duplicação** de SSOT.  
* Dúvidas de fronteira entre “comércio”, “serviço” e “movimento físico” resolvem-se à luz do **RFC_UNIFIED_LOGISTICS_MODEL.md** e de RFCs filhos, **sem** enfraquecer o texto desta proposta após aprovação.

---

## Histórico

| Data | Nota |
|------|------|
| 2026-04-13 | Texto base redigido (tentativa incorreta de colocação em `01_normative/` por MODO EXECUTOR). |
| 2026-04-13 | **Correcção de trilho:** conteúdo consolidado neste RFC; `docs/01_normative/LEI_LOGISTICA_UNIFICARD.md` neutralizado (stub). |
