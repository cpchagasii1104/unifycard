# RFC — Modelo unificado de logística: demanda, plano e execução

**ID:** RFC-UNIFIED-LOGISTICS-MODEL-v1  
**Estado:** `RASCUNHO` — **não** autoriza alteração de código, migrations nem refactor até revisão humana explícita e eventual registo em `docs/03_execution_log/`.  
**Tipo:** decisão de domínio / fronteiras sistémicas (ficheiro em `docs/02_decisions/` — **não** é norma em `docs/01_normative/`).  
**Base:** auditoria global de logística e transporte no `backend/src` (múltiplos “cérebros”: rides, logistics, marketplace dispatch, work-instant, orchestrator).

---

## Precedência

1. Normas em `docs/01_normative/` (Lei de coerência, Constituição, protocolo GATE, SSOT financeiro, authority).  
2. `RFC_RIDES_DOMAIN_BOUNDARIES_AND_GOVERNANCE.md` — rides como execução e fronteiras já fixadas (P0).  
3. **Este RFC** — define o **modelo canónico transversal** de movimento físico; em conflito com (1), prevalece a norma.

---

## 1. Finalidade

Fixar **um** fluxo mental e contratual universal:

```text
Demanda canónica → Plano de transporte → Perna(s) → Execução (corrida / veículo)
```

Evitar sexta via paralela de “mini-logística” sem mapeamento explícito para este modelo.

## 2. Não-objetivos (explícitos)

- **Não** descreve implementação, PRs nem ordem de commits.  
- **Não** substitui contratos congelados (`DeliveryOrder`, etc.) até RFC de migração de schema/contrato filho.  
- **Não** absorve o módulo social `opportunity_dispatch` nem o fulfillment de stock sob o nome “logistics” sem distinção semântica.

---

## 3. Entidades canónicas (conceito)

| Entidade | Definição | SSOT desejado (evolução) |
|----------|-----------|-------------------------|
| **UnifiedDemand** | Unidade única de “há movimento físico a satisfazer”: origem, destino, janelas relevantes, carga (peso/volume), passageiros, urgência, **fonte** (pedido marketplace, evento, intent, etc.). Não é ledger nem agenda canónica. | Módulo ou bounded context **logistics** (+ persistência futura), referenciando entidades de origem por ID/tipo. |
| **TransportPlan** | Resposta do sistema ao UnifiedDemand: **uma ou mais** pernas ordenadas, política aplicada (versão do planner). | **Logistics** (ex.: `transport-planner.service` evolui para autoridade de plano). |
| **TransportLeg** | Segmento atómico do plano: origem, destino, **vehicleType** (ou classe de recurso móvel) **decidido pelo planner**. | **Logistics** (parte do plano). |
| **Ride** (execução) | Instância concreta no domínio **rides** que **executa** uma perna (ou subconjunto alinhado ao modelo `rides_*` existente). | **Rides** (tabelas `rides_*`); não redefine tipo de transporte canónico do plano. |

---

## 4. Relação com sistemas existentes (mapeamento conceitual)

| Artefacto hoje | Papel no modelo canónico | Nota |
|----------------|---------------------------|------|
| `DeliveryOrder` (marketplace / contrato) | **Origem** → materializa ou referencia **UnifiedDemand** (entrega física de pedido). | Não é `TransportPlan`; “delivery” comercial ≠ plano logístico. |
| `ServiceRequest` + fluxo **marketplace dispatch** | **Origem** → pode gerar **UnifiedDemand** quando o serviço implicar deslocação física; **dispatch** aqui = *service assignment* (prestador), não sinónimo de `TransportPlan`. | Manter nome “dispatch” no marketplace com glossário; evitar colisão com “vehicle dispatch”. |
| `ride_request` / `rides_rides` | **Execução** de **TransportLeg** (ou equivalente mapeado), mais estado operacional já definido no RFC rides. | `ride_request` é trigger/persistência de execução, não substituto de `UnifiedDemand` global. |
| `modules/logistics` (`TransportDemand`, `TransportPlan`, …) | **Protótipo alinhado** a **UnifiedDemand** / **TransportLeg** — evoluir nomenclatura por RFC filho se se unificar o nome `TransportDemand` ↔ `UnifiedDemand`. | Hoje sem BD e sem ligação a rides; este RFC autoriza apenas **direção**. |
| **Orchestrator** (`request_ride`, `vehicleType`) | **Anti-padrão** face a este RFC: não deve **originar** decisão de tipo de veículo; deve delegar em logistics ou repassar plano já calculado. | Regra explícita na secção 6. |
| **Work-instant** / assignments | **Orquestração de mão-de-obra**, não de frota. Só entra no modelo unificado se um **job** for explicitamente modelado como **perna logística** (futuro). | Fora do núcleo “transporte de bens/pessoas” salvo extensão formal. |

---

## 5. Normalização da palavra “dispatch” (sem unificar módulos)

| Contexto | Nome semântico recomendado | Módulo |
|----------|----------------------------|--------|
| Social / oportunidade | **Opportunity notification** | `modules/dispatch` |
| Marketplace / serviço | **Service assignment** | `marketplace` … `dispatch` |
| Rides / mobilidade | **Vehicle / driver dispatch** (operacional) | `rides` (matching, `is_online`, etc.) |

**Regra:** documentação e RFCs devem usar estes três significados; **proibido** tratar “dispatch” como conceito único sem qualificador.

---

## 6. Regras de decisão (governação)

1. **Só o núcleo logistics** (planner + políticas acordadas) **define** `vehicleType` / classe de recurso móvel para **TransportLeg** no âmbito de **UnifiedDemand** coberto por este RFC.  
2. **Rides** **executa** pernas; pode validar compatibilidade operacional (motorista, veículo cadastrado), **não** substitui o planner como SSOT de “o que o negócio decidiu transportar com”.  
3. **Marketplace** **não** cria segundo fio de “logística completa” paralelo: `DeliveryOrder` e fluxos de entrega **referenciam** ou **geram** **UnifiedDemand**; não confundir com plano nem com ledger.  
4. **Orchestrator** **não** define veículo por defeito em intents de transporte; passa a **encaminhar** para o pipeline demand → logistics → rides (detalhe de API em RFC de integração).  
5. **Fulfillment** (`SHIPPED`, picking) permanece **WMS / pedido**; só liga a **UnifiedDemand** quando houver entrega física last-mile explícita (evento de domínio ou campo de referência, a definir em RFC filho).

---

## 7. Multi-leg e agregação

### 7.1 Cadeia física (ex.: CD → hub → cliente)

- Modelado como **TransportPlan** com **N TransportLegs** em sequência.  
- **Rides** pode materializar **N** `ride_request` / corridas (ou extensão futura alinhada ao schema), **uma por perna** ou conforme mapeamento aprovado em RFC de schema.

### 7.2 Evento + transporte coletivo (demand aggregation)

- **Eventos** (ou módulo equivalente) geram **UnifiedDemand** **agregada** (vários participantes, mesma janela/rota-base).  
- **Logistics** aplica política de agrupamento (ex.: van vs ônibus) e produz **TransportPlan**.  
- **Rides** executa as pernas necessárias.

---

## 8. Fluxo de integração alvo (produto)

```text
Marketplace (pedido) ou Events (interesse) ou outro domínio
  → cria / atualiza UnifiedDemand
        → logistics: plano (TransportPlan + legs)
              → rides: execução (Ride / ride_request)
                    → bank: liquidação
                    → authority: governa mutações sensíveis
                    → eventos: efeitos pós-commit (norma já aplicável)
```

---

## 9. Tabela de migração conceitual (sem cronologia de código)

| De (hoje) | Para (alvo) | Risco se não migrar |
|-----------|-------------|---------------------|
| `DeliveryOrder` como “única verdade” de movimento | Origem ligada a **UnifiedDemand** + referência a **TransportPlan** | Duplicação de verdade de entrega vs transporte |
| `ServiceRequest` + dispatch marketplace | Mesma origem de **UnifiedDemand** quando houver deslocação | Prestador confundido com frota |
| `ride_request` isolado do plano global | Execução de **leg** com `planId` / `legSequence` (futuro) | Rides vira cérebro de tipo de transporte |
| Orchestrator `vehicleType` | Removido da decisão; delegação a logistics | 6.º decisor de meio |
| Logistics `TransportDemand` (código atual) | Alinhar nome/campos a **UnifiedDemand** (RFC filho) | Dois vocabulários para a mesma entidade |

---

## 10. Critérios de aceitação deste RFC (revisão humana)

- [ ] Produto e engenharia concordam com **UnifiedDemand** como **única** entrada de “movimento físico” cross-vertical.  
- [ ] Glossário “dispatch” (três significados) aceite em documentação transversal.  
- [ ] RFC rides permanece válido: rides **não** absorve planner nem SSOT de demanda global.  
- [ ] Próximo passo explícito escolhido: **RFC de integração** (API + IDs) **ou** **RFC de schema** — um de cada vez, sem misturar.

---

## 11. Histórico

| Data | Autor | Nota |
|------|-------|------|
| 2026-04-13 | Cursor (EXECUTOR) | Rascunho inicial pós-auditoria de logística no backend. |
