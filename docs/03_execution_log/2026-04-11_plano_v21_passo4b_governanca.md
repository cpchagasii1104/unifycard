# Plano v2.1 — PASSO 4b (governança / idempotência)

**Data:** 2026-04-11  
**Contexto:** execução contínua v2.1; segundo `psql -f` em `20260517100000_authority_roots_integrity.sql`.

## Registo obrigatório (IDP)

```text
PASSO 4b:
- Execução SQL: FAIL (constraint já existe)
- Estado do sistema: PASS (FK presente)
- Classificação: PASS POR IDP (Idempotência implícita)
```

## Evidência — critério funcional B4

- Query: `SELECT conname FROM pg_constraint WHERE conrelid = 'authority_roots'::regclass AND conname = 'fk_authority_roots_actor';`
- Resultado: **1 linha** (`fk_authority_roots_actor`).

## Nota

- **Falha de execução** = reexecução de DDL não idempotente; **não** indica ausência de FK.
- Bloqueadores operacionais em aberto: **GRANT** (`worker_user`), **B5**, **restart de workers** (inputs / decisão humana).

---

## STATUS consolidado (definição operacional)

```text
CORE_TECNICO: DONE ✅ — quando patches + RLS/FK + tsc estão provados (incl. 4b por estado (B) se aplicável).
PLANO_v2.1:   NOT_DONE ❌ — enquanto faltarem GRANT, B5 explícito e validação pós-restart dos workers.
```

**Bloqueadores restantes:** GRANT (role real dos workers); **B5** (governança / C.24); workers + evidência operacional (C.17 no âmbito de runtime).

**Plano mestre actualizado:** `UNIFICARD_PLANO_MESTRE_v2_1.md` — secções *FAIL FAST (escopo)*, *Plano vs script*, *Critério de aceite 4b*, *DONE técnico vs DONE operacional*, errata Abril 2026.

---

## STANDBY v2.1 (2026-04-11)

```text
CORE_TECNICO:   DONE ✅
PLANO_v2.1 E2E: NÃO concluído ⚠️
```

**Registado no plano:** secção *STANDBY v2.1* em `UNIFICARD_PLANO_MESTRE_v2_1.md` (checklist mínimo + riscos GRANT/B5).

**Não vender como:** «100% plano v2.1» sem GRANT + B5 + validação workers.
