# BLOCO 1 — Auditoria pré-execução (norma × plano × código × migrations)

**Data:** 2026-04-09  
**Modo:** evidência cruzada (sem implementação neste registo)  
**Referências:** `PRODUTO_PLANO_MESTRE_COMPLETO.md`, `ORIENTACAO_PRODUTO_EXECUTAR.md`, normativa citada no plano  

**Nota de leitura:** O corpo abaixo (até «Actualização») é **snapshot** da auditoria **antes** da correcção `limit_amount_cents` no repositório. Depois de **`pnpm migrate`** com `20260513100000` + deploy do TS alinhado, o item **estrutural guardianship** passa a **PASS** no ambiente; **2B** continua pendente no adapter.

---

## RESULTADO (snapshot pré-correcção no repo)

**STATUS: FAIL** *(estrutural: NUMERIC no PG até migrate; ver secção «Actualização» no fim)*

O sistema **não** está em conformidade estrutural completa face ao SSOT financeiro documentado e existe **dívida semântica** explícita (2B) no adapter. O FAIL é **esperado** e **deve** ser lido antes de declarar “pronto para produção” ou usar `economic_guardianship` como dinheiro normativo.

---

## EVIDÊNCIAS

### 1. Adapter (`concept-offer-refs.adapter.ts`)

- **Scoped-only confirmado** na resolução READY:
  - `AND cp.tenant_id = $2::uuid` (lookup por `canonical_product_id`)
  - `AND cp.tenant_id = p.tenant_id` (JOIN em lote)
- Comentário no ficheiro remete a **Fase 2B** para `scope = 'global'` com `tenant_id IS NULL`.
- **Sem** `OR (global …)` no SQL actual; **sem** fallback GTIN no trilho deste adapter para `concept_ref`.

**Leitura:** alinhado a **1A** / estado **pré-2B**; **2B não implementado** no adapter.

### 2. `canonical_products` — DDL vs runtime

- **DDL (repo):** `backend/migrations/20260502100000_canonical_products_global_scope.sql` define coluna `scope` (`global` / `scoped`), `tenant_id` nullable, `chk_canonical_scope_tenant`, índices parciais global/scoped — **Fase 2A versionada**.
- **Runtime semântico:** adapter ainda **não** aplica `(scoped OR global)`; **Fase 2B** permanece bloqueador para “catálogo global seguro” no pipeline de resolução (C.15).

**Leitura:** não confundir “schema preparado” com “pipeline fechado”; **2B pendente**.

### 3. `economic_guardianship` — violação estrutural (crítica)

- **Ficheiro:** `backend/migrations/20260501100000_economic_guardianship.sql`
- **Estado actual (disco):** `limit_amount NUMERIC NOT NULL CHECK (limit_amount > 0)`
- **Norma documentada no plano/orientação (alvo):** `limit_amount_cents BIGINT NOT NULL CHECK (limit_amount_cents > 0)` (minor units; coerência com padrão `_cents` / §19.2).

**Leitura:** **divergência plano ≠ banco** está **documentada** nos `.md`; o **SQL aplicado** em ambientes migrados mantém **NUMERIC** até **migration corretiva aditiva**.

### 4. C.10 (autoridade) — snapshot

- Nenhuma evidência nesta auditoria de novo bypass do adapter para `concept_ref` em checkout; trilho principal continua **canonical_products → concept_id** via adapter.

*(Revalidar com grep C.22 completo na abertura formal do 2B.)*

---

## CHECKLIST (estado lógico)

| Item | Estado |
|------|--------|
| Normativa / plano / orientação coerentes com SSOT financeiro e §19.1 | ✓ (documental) |
| 1A (adapter sem identidade por categoria no trilho transaccional) | ✓ (conforme snapshot anterior + adapter actual) |
| 2A DDL `canonical_products` global | ✓ (ficheiro no repo) |
| 2B integração global no adapter/repo/serviços + grep C.22 | → **pendente** |
| 1B `economic_guardianship` conforme minor units | **FAIL** (`NUMERIC` no migration real) |
| Violação 1B registada no plano | ✓ (`[!]` em `PRODUTO_PLANO_MESTRE_COMPLETO.md` / `ORIENTACAO_PRODUTO_EXECUTAR.md`) |

---

## CONCLUSÃO

1. **FAIL estrutural:** `economic_guardianship.limit_amount` como **NUMERIC** viola o modelo monetário normativo (`_cents` / BIGINT). **Não** usar esta coluna como dinheiro soberano até migration corretiva + código alinhado.
2. **Incompleto (esperado):** resolução semântica **scoped-only** no adapter — **2B** obrigatório antes de declarar pipeline global seguro (C.7 / C.14 / C.15).
3. **Caminhos válidos (estratégia):**
   - **A:** migration corretiva **antes** de trilhos que consumam guardianship; reauditar Bloco 1.
   - **B:** prosseguir **2B** com Bloco 1 = **FAIL** registado, **desde que** nenhum runtime aplique teto nem persista decisão financeira sobre `limit_amount` até correcção.

**Regra de ouro:** um “PASS” do Bloco 1 que **omitir** o `NUMERIC` em `economic_guardianship` é **auditoria inválida**.

---

## Actualização (2026-04-09 — código + migration no repo)

- **Ficheiro:** `backend/migrations/20260513100000_economic_guardianship_limit_amount_cents.sql`
- **TS:** `authority-decision.service.ts`, `shadow-authorization.service.ts` → `limit_amount_cents`
- **Nota:** backfill **sem** `*100` (coerente com comparação a `amountCents` no serviço de decisão).
- **Pendente por ambiente:** `pnpm migrate` + `\d economic_guardianship` até marcar PASS estrutural.

---

## Próximos passos sugeridos (não executados neste log)

- [ ] `pnpm migrate` **por ambiente** + validar schema  
- [ ] Executar **2B** conforme `docs/02_decisions/PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md` + log dedicado  
- [ ] Reexecutar checklist Bloco 1 após migrate → alvo **PASS** estrutural (guardianship) + semântico (2B)
