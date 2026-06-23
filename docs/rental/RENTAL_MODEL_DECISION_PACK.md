# Decision Pack — Rental Model (DECISION_RENTAL_MODEL)

**Data:** 2026-06-23 · **HEAD:** `c7ddd59a` · **Tipo:** DECISION PACK (READ-FIRST, **docs-only — nenhuma locação implementada**) · **Branch:** `rescue-structural`
**Para:** Clayton decidir o modelo canônico de locação ANTES de qualquer código. Ordem: SEMÂNTICA → IDENTIDADE → AUTORIDADE → **TEMPO → ESTOQUE/RECURSO** → ESTADO → FINANCEIRO.

## 1. Estado atual (de 1ª mão)
**Locação = `ENUM_ONLY` + `STUB` de UI. Não existe cadeia real.**
- `ServiceType.RENTAL='rental'` (services.types.ts:12) + Zod enum (services.routes.ts) + CHECK `service_type IN (...,'rental',...)` (migration 20260418120000). **Nunca acionado por handler/switch** (grep `switch serviceType`/`case rental`/`=== 'rental'` = 0 que dispara lógica).
- UI `module-registry`: `{moduleKey:'rentals', route:'/em-desenvolvimento', status:'STUB'}`. Labels "Aluguel" (projeção de enum).
- Templates STUB sem fluxo: `property-rental` (service-booking.service / marketplace-offerings). Conceito `locacao-de-traje` (wedding pilot) mapeado como serviço.
- **0 migrations rental* · 0 tabela `rentable_resource` · 0 entidade de recurso · 0 handler.**

## 2. Matriz de domínio (SSOTs vivos que locação reusaria)
| SSOT | Estado | Serve locação? |
|---|---|---|
| `availability` (owner_type polimórfico: user/service/event/group/page/service_offering) | REAL_CHAIN | **SIM** — é o SSOT temporal. Conflito via `detectConflicts` por owner. |
| `availability-owner-authority` (policy por owner_type) | REAL_CHAIN | SIM — basta um branch novo p/ o owner de locação. |
| UnifiedBooking (requested→confirmed→checked_in/out) | REAL_CHAIN/TIME | SIM — ciclo de vida (check-in/out = estado, não dinheiro). |
| `service_offerings` (canonical, provider_actor_id, duration_minutes, price) | REAL_CHAIN | parcial — comercial/preço, mas conflita por **provider**, não recurso. |
| `inventory_reservation` (FOR UPDATE lock, por variant+quantity) | PRODUCT_ADJACENT | só p/ locação **fungível** (quantidade), não item único. |
| Order/OrderItem (draft) | INVENTORY_ADJACENT | intenção; OrderItem é quantidade fungível. |
| Escrow / Agreement / Payment Milestone | MONEY_ADJACENT | **HOLD** (caução/rental fee/multa). |

## 3. A pergunta que decide o modelo: **dimensão de conflito**
> Duas pessoas não podem alugar **o mesmo carro** no mesmo intervalo — mas um locador com 3 carros aluga os 3 simultaneamente.
- **Item ÚNICO** (carro, sala, equipamento específico) → exclusividade por **`resource_id`**.
- **Item FUNGÍVEL** (10 furadeiras idênticas) → **quantidade** (inventory).
- **Recurso = o próprio provider/espaço** (agenda de uso) → por **provider** (service_offering).

⚠️ **Por isso C (service_offering) sozinho mis-modela locação de item único:** conflitaria por provider (409 PROVIDER_TIME_CONFLICT), bloqueando indevidamente o carro#2 enquanto o carro#1 está alugado. Os agentes recomendaram C por "reusar mais" — mas erra a exclusividade. O eixo correto é **recurso no tempo**.

## 4. Opções
**Opção A — Locação como product offer (estoque/quantidade)**
- rental = tipo de oferta de produto; reserva bloqueia inventory_reservation (quantidade); tempo = atributo do pedido.
- ✔ bom p/ fungível · ✔ reusa inventory · ✗ não modela exclusividade de item único · ✗ tempo vira atributo solto (não SSOT temporal).

**Opção B — Locação como `rentable_resource` reusando `availability` (RECOMENDADA)**
- nova tabela-registro `rentable_resources` (id, owner_actor_id, resource_type, label, metadata) — **só o registro do recurso**.
- disponibilidade/booking via **`availability` com `owner_type='rentable_resource'`, `owner_id=resource_id`** → conflito por recurso "de graça" (detectConflicts já é por owner). **NÃO cria agenda/booking paralelos.**
- authority: branch novo em `availability-owner-authority` (resource → owner_actor_id).
- ✔ exclusividade por item único · ✔ reusa SSOT temporal + booking + gate polimórfico · ✔ MVP pré-money sem tocar dinheiro · ✗ 1 tabela-registro nova (mínima) + 1 owner_type.

**Opção C — Locação como service_offering temporal**
- rental = oferta de serviço com duração; usa availability(owner_type=service_offering)+booking; zero tabela nova.
- ✔ reusa o máximo · ✔ bom p/ "recurso = provider/espaço" · ✗ **conflita por provider, não recurso** → quebra item único · ✗ mistura "serviço" e "bem alugável" na mesma entidade.

## 5. Recomendação técnica
**Opção B (rentable_resource reusando availability) como ESPINHA canônica**, porque locação é fundamentalmente **um recurso bloqueado no tempo**, e B dá exclusividade por recurso reusando o SSOT temporal (sem agenda/estoque/booking paralelos). Traços de A (quantidade p/ fungível) e C (provider-bound p/ agenda de uso) entram como **variações futuras**, não como espinha.
- **Fronteiras:** TEMPO = `availability` (não criar nova) · RECURSO = `rentable_resources` (registro) · ESTOQUE = só se fungível (futuro) · **DINHEIRO = HOLD** (caução/fee/multa nascem só na Camada 1 financeira, pós-RLS-live/PORTA-1).
- **Decisão de Clayton:** (1) ratificar B como espinha; (2) o catálogo-alvo é dominado por itens únicos (confirma B) ou fungíveis (puxaria A)?; (3) caução/multa ficam 100% HOLD no MVP?

## 6. MVP pré-money sugerido (se Clayton aprovar B)
```
rentable_resources (registro do recurso, owner_actor_id)
→ availability owner_type='rentable_resource' (reusa SSOT temporal + gate de autoridade)
→ reservation/booking pré-money (requested→confirmed→checked_in/out = ESTADO, não dinheiro)
→ checkout / caução / rental fee / multa / late-fee / payout = HOLD
```
Sem caução real, sem multa financeira, sem checkout, sem bank_*. Reserva/booking só via os SSOTs seguros já existentes.

## 7. Próxima frente material (se aprovado)
`F-RENTAL-RESOURCE-CORE` — escopo: migration `rentable_resources` (registro) + `owner_type='rentable_resource'` no CHECK de availability + branch no `availability-owner-authority` (policy resource→owner_actor_id) + guards (conflito por recurso; dinheiro fora; sem agenda paralela). Arquivos prováveis: nova migration · unified-availability.types · availability-owner-authority.ts · guards. Testes: e2e reserva-por-recurso com conflito por resource_id; Δbank=0. **Sem dinheiro.**

## 8. Lista de HOLD (não entram no MVP)
caução (depositCents) · multa · late-fee · no-show financeiro · payout · checkout/payment · escrow de locação. Todos nascem só após a Camada 1 financeira (RLS-live + PORTA-1).

---
**RECOMENDO DECISION: Opção B (rentable_resource reusando availability) como espinha; caução/multa/checkout = HOLD; MVP pré-money = registro+disponibilidade+reserva.** Nenhuma locação implementada neste pacote (docs-only). STOP aguardando escolha de Clayton.
