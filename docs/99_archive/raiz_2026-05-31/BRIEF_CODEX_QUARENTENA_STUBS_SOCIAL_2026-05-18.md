# Brief de Quarentena — 5 Stubs em `api/social.ts`

**Data:** 2026-05-18
**De:** Claude (auditoria contextual frontend)
**Para:** Codex (execução frontend cirúrgica)
**Escopo:** frontend puro — sem dependência backend
**Estimativa:** 1-2 horas

---

## Contexto

Auditoria de `frontend/src/api/bank.ts` e `api/social.ts` em 2026-05-18 identificou 5 funções em `social.ts` que **retornam `{success: true}` ou coleções vazias hardcoded sem chamar `apiFetch`**. São stubs declarados para satisfazer imports, mas em produção fingem confirmar ações que não aconteceram.

**Severidade:** CRÍTICA para `confirmCTA` (tipada como CTA financeiro com `transactionId`, `revenue_entry`, `profit_share_entry`). ALTA para os demais (vazio falso, sucesso falso).

---

## Os 5 stubs identificados

| # | Função | Arquivo:linha | Comportamento hoje | Severidade |
|---|---|---|---|---|
| 1 | `confirmCTA(ctaId, data?)` | `api/social.ts:124-126` | retorna `{success: true}` sem `apiFetch` | **CRÍTICA** |
| 2 | `followActor(actorId)` | `api/social.ts:108-110` | retorna `{success: true}` sem `apiFetch` | ALTA |
| 3 | `unfollowActor(actorId)` | `api/social.ts:112-114` | retorna `{success: true}` sem `apiFetch` | ALTA |
| 4 | `getLedger(options?)` | `api/social.ts:94-96` | retorna `{entries: []}` hardcoded | ALTA |
| 5 | `getLedgerSummary(actorId?)` | `api/social.ts:100-102` | retorna `{total: 0, breakdown: [], group_contributions: []}` hardcoded | ALTA |
| 6 | `getComments(postId, options?)` | `api/social.ts:104-106` | retorna `{comments: [], next_cursor: null, has_more: false}` hardcoded | MÉDIA |

(Total: 6 stubs, listados como "5+1" porque `getComments` tem natureza ligeiramente diferente.)

---

## Princípio operacional vinculante

> **Stub que afirma sucesso de operação não-realizada é violação grave do princípio de causalidade rastreável** (Princípio Operacional §4 da Home Contextual: "soberania cognitiva — usuário sempre pode auditar por que algo apareceu").
>
> Stub que retorna coleção vazia falsifica "vazio" — induz usuário a achar que não há dado.

Ambos os padrões precisam ser **explicitamente quarentenados** antes que algum consumer dependa deles e propague falsidade.

---

## Opções de quarentena (Codex escolhe)

### Opção A — `throw new Error('NOT_IMPLEMENTED')`

```ts
export async function confirmCTA(_ctaId: string, _data?: any): Promise<ConfirmCTAResponse> {
  throw new Error('NOT_IMPLEMENTED: confirmCTA — backend endpoint ausente. Ver DT-PRESSURE');
}
```

**Vantagem:** consumer falha visivelmente em runtime, força tratamento explícito.
**Desvantagem:** se há caller que esperava o stub silencioso, vai quebrar UI.

### Opção B — retornar erro estruturado

```ts
export async function confirmCTA(_ctaId: string, _data?: any): Promise<ConfirmCTAResponse> {
  return { success: false, message: 'NOT_IMPLEMENTED: backend endpoint ausente' };
}
```

**Vantagem:** consumer pode checar `result.success` e mostrar empty state.
**Desvantagem:** ainda parece "operação executada com erro", não "operação não existe".

### Opção C — comentar a função inteira

```ts
// REMOVIDA — backend endpoint não existe. Ver DT-PRESSURE-CONFIRM-CTA-FANTASMA
// export async function confirmCTA(...) { ... }
```

**Vantagem:** TS quebra build se algum caller tentar usar. Caller é forçado a tratar.
**Desvantagem:** se há muitos callers, build quebra em N lugares ao mesmo tempo.

---

## Recomendação

**Sequência sugerida (depende de quantos callers existem):**

1. **Para cada função, rodar grep antes de decidir:**

   ```
   grep -rn "confirmCTA\|followActor\|unfollowActor\|getLedger\|getLedgerSummary\|getComments" frontend/src
   ```

2. **Se 0-2 callers:** Opção C (comentar). Atualizar callers para empty state honesto.

3. **Se 3-10 callers:** Opção A (throw) + adaptar callers para try/catch + empty state.

4. **Se 10+ callers:** Opção B (erro estruturado) + plano de migração em sub-frente própria.

---

## Análise específica por função

### 1. `confirmCTA` — CRÍTICA

Tipo `ConfirmCTAResponse` sugere fluxo econômico (`transactionId`, `revenue_entry`, `profit_share_entry`). **Stub que afirma sucesso é mentira sobre confirmação de transação.**

**Recomendação:** Opção A (throw) ou C (comentar) — força caller a tratar explicitamente. NÃO use Opção B (`success: false`) porque algumas UIs já interpretam `success: false` como "tentou e falhou" e não como "operação não existe".

**Antes de quarentenar:** rastrear quem chama. Se algum componente chama achando que confirmou pagamento, é incidente em runtime — registrar no `STATUS_EXECUCAO_GLOBAL.md`.

### 2. `followActor` / `unfollowActor`

UI provavelmente mostra "Seguindo!" após chamada. Antes de quarentenar, decidir se follow é feature real do UnifiCard ou se foi vestígio de tentativa anterior.

**Decisão pendente Clayton:** o UnifiCard quer mecânica de "follow" como Twitter/Instagram? Memória institucional sugere que **NÃO** — relação emerge de comportamento, não de declaração (Princípio Operacional §10). Se confirmado, follow deve ser deprecated, não implementado.

**Recomendação imediata:** Opção C (comentar) com TODO de decisão arquitetural. Não implementar backend sem decisão.

### 3. `getLedger` / `getLedgerSummary`

Estes retornam vazios hardcoded. Auditoria não identificou consumer ativo (não confirmado por grep). Possível dead code.

**Recomendação:** Opção C (comentar) + grep. Se 0 callers, candidato a remoção em sessão dedicada.

### 4. `getComments`

Comentários em posts é feature válida do UnifiCard (memória `project_arquitetura_lego_universal.md` não veta). Endpoint backend pode existir mas frontend não chega lá.

**Recomendação:** Opção A (throw) ou implementar caller real via endpoint backend correto se existir. Auditar backend antes de assumir que é fantasma. Caso confirmado fantasma, abrir DT-PRESSURE-COMMENTS-FANTASMA.

---

## DT-PRESSURE a abrir junto com a quarentena

Sugiro abrir 1-3 DTs novas no `REMEDIATION_DT_LOG.md`:

1. **DT-PRESSURE-CONFIRM-CTA-FANTASMA** — endpoint backend de CTA não existe; tipo sugere fluxo econômico
2. **DT-FOLLOW-MECHANICS-DECISION-PENDING** — decisão arquitetural sobre se UnifiCard tem mecânica de follow
3. **DT-PRESSURE-COMMENTS-FANTASMA** — se confirmado que `/social/comments/*` não existe

Posso abrir essas se Codex preferir. Ou Codex abre junto com a execução.

---

## Smoke pós-quarentena

Após quarentena, rodar:

1. `cd frontend && npx tsc --noEmit` — confirmar que TS compila (se Opção A/B) ou que callers foram atualizados (se Opção C)
2. Browser smoke: navegar nas páginas que poderiam chamar essas funções (cartões CTA, perfis de actor, ledger views, comments) — confirmar que não há erro silencioso
3. Console: zero `NOT_IMPLEMENTED` em fluxos comuns; se aparecer, tratar caller

---

## Estimativa material

- Análise dos callers (grep + leitura): 30-45 min
- Quarentena propriamente dita: 30-60 min
- Smoke + ajuste de callers: 30-60 min
- DT-PRESSURE registro: 15-30 min

**Total: 2-3h para Codex em sessão dedicada.**

---

## Coordenação com Claude

- Não preciso autorização adicional para Codex executar — escopo é frontend puro, sem soberania backend.
- Se algum caller precisar de endpoint backend (raro nesse escopo), Codex abre DT-PRESSURE e me aciona.
- Resultado final (commits + DTs abertas) atualiza este brief para `COMPLETED` em sessão futura.

---

**Vinculado a:** memória `project_home_contextual_modelo_2026-05-18.md` (P1 item 1)
**Bloqueia:** confiança institucional na causalidade do fluxo CTA financeiro (princípio operacional §1 da Home)
**Não bloqueia:** P1 itens 2-7 (são frentes backend que rodam em paralelo)
