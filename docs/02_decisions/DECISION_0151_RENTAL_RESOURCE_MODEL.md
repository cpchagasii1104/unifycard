# DECISION-0151 — Rental Model: Resource-Based (Opção B) · DECISION_RENTAL_MODEL

**Status:** **PROMULGADA / DECISÃO DE MODELO (DOMÍNIO) / DOCS-ONLY** (Clayton 2026-06-23). Declara o modelo canônico de locação. **NÃO** implementa locação (sem migration/tabela/runtime/frontend/dinheiro). A execução é frente própria (`F-RENTAL-RESOURCE-CORE`) sob GO futuro.
**Data:** 2026-06-23 · **Branch:** `rescue-structural` · **HEAD (pré-commit):** `8a16d2ac` · **Insumo:** `docs/rental/RENTAL_MODEL_DECISION_PACK.md` (READ-FIRST 3 ângulos + verificação 1ª mão).
**Deriva de / coerente com:** DECISION-0118/0148 (availability owner polimórfico + booking subject) · DECISION-0122 (binding canônico de offering/booking) · DECISION-0110 (firewall financeiro). Ordem soberana: SEMÂNTICA → IDENTIDADE → AUTORIDADE → **TEMPO → ESTOQUE/RECURSO** → ESTADO → FINANCEIRO.

---

## §0 — Estado de partida (de 1ª mão)
Locação hoje = **ENUM_ONLY + STUB** (`ServiceType.RENTAL` + CHECK `service_type` + módulo UI `/em-desenvolvimento`); **0 tabelas rental*, 0 entidade de recurso, 0 handler/switch**. Nenhuma cadeia real. Esta decisão fixa a FORMA antes de qualquer código.

## §A — A DECISÃO (Opção B, soberana de Clayton)
1. **Locação é, canonicamente, RECURSO ESPECÍFICO BLOQUEADO NO TEMPO** — não "produto", não "serviço genérico".
2. **Modelo base:** `rentable_resource` (registro do recurso alugável; owner_actor_id; resource_type; label; metadata). É só o **registro** — não duplica nada.
3. **Disponibilidade reutiliza a Unified Availability** com `owner_type='rentable_resource'` (ou nome equivalente aprovado pela norma) + branch próprio em `availability-owner-authority` (policy resource → owner_actor_id). **NÃO criar agenda paralela.**
4. **Conflito é por `resource_id`, NÃO por provider.** (Uma pessoa com 3 carros aluga os 3 ao mesmo tempo; o conflito é no carro.) O `detectConflicts` por owner dá exclusividade por recurso "de graça".
5. **NÃO criar:** estoque paralelo · booking paralelo · ledger paralelo · order/checkout por atalho.
6. **Conflito por provider (service_offering) é INADEQUADO** para item único — por isso a espinha NÃO é Opção C.

## §B — Variações futuras (autorizadas, NÃO substituem a espinha B)
- **Opção A** (extensão): item **fungível** por quantidade/inventory (10 furadeiras iguais → `inventory_reservation` por quantidade).
- **Opção C** (extensão): caso **provider-bound** (sala/quadra/agenda de uso controlada pelo prestador → `service_offering` temporal).
- Para **recurso individual**, a espinha é **sempre B**.

## §C — Escopo MVP (pré-money)
`rentable_resources` (registro) → availability por recurso → reservation/booking pré-money como **ESTADO** (requested→confirmed→checked_in/out). **Sem** checkout, caução real, multa, late-fee, no-show financeiro, payout, escrow.

## §D — HOLD explícito (não entram no MVP; só na Camada 1 financeira, pós-RLS-live/PORTA-1)
`depositCents` (caução) · multa · late-fee · no-show financeiro · checkout/payment · payout · escrow · liquidação · **qualquer movimento em `bank_*`**.

## §E — Materialização (NÃO aqui; GO próprio)
`F-RENTAL-RESOURCE-CORE`: migration `rentable_resources` (registro) + `owner_type='rentable_resource'` no CHECK de availability + branch no `availability-owner-authority` + guards (conflito por recurso · dinheiro fora · sem agenda/estoque/booking paralelos). **MODO B; ZERO dinheiro/checkout/payout.**
