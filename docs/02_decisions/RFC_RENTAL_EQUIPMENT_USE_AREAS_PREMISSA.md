# RFC-RENTAL-EQUIPMENT-USE-AREAS — Premissa ontológica (HOLD, aguarda abertura)

**Status:** HOLD. Nota de premissa registrada 2026-07-07 (não é o RFC — é o alicerce que o RFC não pode violar).
**Contexto:** após F-EQUIPMENT-CATALOG-HIGH-TURN-SEED (catálogo 6→25, commit `b035ea8b6`).

## A regra que o RFC deve honrar

```
Equipamento  = IDENTIDADE   → CONCEPT (N0 'produtos-e-comercio'), UMA verdade por item.
Uso em evento = NAVEGAÇÃO    → área de uso / faceta / contexto (many-to-many, projeção).
```

## Correção de registro (diretora, 2026-07-07)

Formulação **incorreta** que circulou no fechamento do seed:

> "Se o RFC decidir que evento precisa de N0 próprio, é migração de domain de 7 concepts."

Formulação **correta** (vinculante):

> Itens como tenda, mesa, cadeira, caixa de som, microfone, projetor e torre de iluminação **são
> bens/equipamentos alugáveis**. O uso "eventos" pode futuramente virar área de uso / faceta /
> contexto de navegação via RFC, mas isso **NÃO muda automaticamente a identidade nem o N0** do
> concept. Só haveria migração de domain se uma **auditoria ontológica futura provar classificação
> incorreta**. Por padrão, equipamento usado em evento continua sendo produto/equipamento alugável.

Motivo: uma cadeira de evento continua sendo cadeira. O que muda é o **uso**, não a **natureza**.
Tratar "uso em evento" como se alterasse a identidade reintroduziria a duplicação de verdade que a
tese identidade≠navegação existe para impedir.

## Substrato governado já existente (para o RFC avaliar, não decidir aqui)

- CONCEPT = identidade (tabela `concepts`, plana, ancorada no N0 `domain`).
- Navegação governada viva: `n1_nodes` → `n2_nodes` → `context_nodes` (via `context_n2_mapping`,
  many-to-many com `is_default`+`sort_order`) + `concept_relations` (related_to/requires).
- **NÃO existe hoje** mapeamento concept↔área-de-uso. O RFC decidirá o modelo:
  `concept_use_areas` novo × reuso de `context_nodes` × faceta governada.

## Fora deste registro (HOLD mantido)

- Abrir/decidir o RFC. UX Área→Equipamento. Qualquer agrupamento (eventos/limpeza/construção) no
  frontend. Com 25 itens a lista plana é aceitável para o MVP — agrupar é refinamento, não bloqueador.
