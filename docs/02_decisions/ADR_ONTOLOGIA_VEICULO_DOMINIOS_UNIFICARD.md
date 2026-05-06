# ADR: Ontologia de veículo e mapeamento context → domain (UnifiCard)

**Status:** aceite para execução do plano rides/mobilidade v2  
**Data:** 2026-04-13  

## Decisão de domínios (FASE 0)

| Context (`ConceptResolutionContext`) | `concepts.domain` (N0) |
|-----------------------------------|------------------------|
| `vehicle` | `mobilidade-e-logistica` |
| `product` | `produtos-e-comercio` |
| `service` | `servicos` |

## Ontologia de veículo (antes da FASE 1)

**Nível 1 (classe funcional):** carro, moto, van, caminhao, onibus, bicicleta, pickup, lancha, iate, navio, helicoptero, aviao → seeds na FASE 1 (migration versionada).

**Nível 2 (modelo/família):** ex. fiat-uno, honda-civic → migration separada quando produto exigir.

**Nível 3 (variante semântica):** ex. fiat-uno-fire → apenas quando compatibilidade operacional real mudar.

**Regra de ano:** ano não vira conceito por padrão; só sobe de nível se a ontologia provar diferença estrutural de compatibilidade.

**Governança:** criação de `concepts` somente via migration versionada + `app.concept_governance`; nunca runtime automático; nunca backfill sem aprovação humana.

## Proibições imediatas (PRs)

- Lookup de conceito por `slug` sem `context` ou `domain` explícito.
- `.toFixed()` em cálculo financeiro.
- `eventBus.emit` direto em fluxo com mutação de estado durável.

## Verificação de PRs

A verificação de “nenhum PR aberto violando” é **manual** (humano / CI), fora do executor Cursor.
