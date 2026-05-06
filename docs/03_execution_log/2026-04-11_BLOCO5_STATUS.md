# Bloco 5 — estado final

**Data:** 2026-04-11  
**SHA (árvore de trabalho no momento da execução):** `05fee6f35a0e0d052f1df70591509520096b7d5e` *(actualizar no merge se diferente).*

```
Bloco 5: PASS
```

## Pendências (não bloqueiam o fecho operacional definido nesta execução)

- **C.25_SPEC** §1–3 (inferência): permanece **rascunho**; CI **não** aplica essas regras.
- **Testes dedicados** cenários C.11 (duplicata global/scoped) e C.2 (GTIN dup) — **backlog** (matriz documenta ausência).
- **C.17.1** itens 5–6: **N/A** por ausência de trilho (documentado na matriz).
- **SHA** do commit em cada log histórico: **C.26** «ideal» — logs `2026-04-10_*` sem SHA; reconciliação por ficheiro + data.

## Evidências

- `docs/03_execution_log/2026-04-10_c17_pipeline.md` (actualizado: `authority_roots` **RESOLVIDO**)
- `docs/03_execution_log/2026-04-11_bloco5_c171_matrix.md`
- `docs/03_execution_log/2026-04-10_lei_4_10.md`
- `docs/03_execution_log/2026-04-10_c25_ci_gate.md`
- `docs/03_execution_log/2026-04-11_c25_ci_enabled.md`
- `backend/migrations/20260514100000_authority_roots.sql`
- `.github/workflows/canonical-gates.yml`

## Decisão

```
pronto
```

Para o âmbito: **C.17** com E2E limpo pós-`authority_roots`, **§4.10** na Lei, **matriz C.17.1** preenchida, **plano reconciliado**, **workflow CI** do gate C.22.
