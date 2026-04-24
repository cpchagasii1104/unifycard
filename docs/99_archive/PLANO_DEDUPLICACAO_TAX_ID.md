# PLANO_DEDUPLICACAO_TAX_ID.md

**Quando usar:** resultado da query **A4** em `PLANO_IDENTITY_RECONCILIATION.md` devolve **uma ou mais linhas** (`tax_id` com `COUNT(*) > 1`). (Ordem: A4 antes de fechar A2 elegível — dedup não depende de `is_identity_required`.)  
**Natureza:** **não é só técnico** — envolve produto, histórico e, em última instância, orientação jurídica/compliance no teu contexto. Este documento **não** substitui parecer legal.

**Regra:** **não** avançar batch de reconciliação em massa até existir **PROPOSTA aprovada** com critério canónico explícito por `tax_id` duplicado.

---

## 1. O que A4 detectou

Mais de uma linha em `identities` partilha o mesmo `tax_id` (mesmo CPF/CNPJ ao nível de coluna). Isso pode ser:

- bug de dados (seed, migração, teste);
- duas pessoas distintas incorretamente fundidas (grave);
- duas linhas “válidas” por evolução do modelo (ex.: merge incompleto de contas).

**Sem decidir qual identidade é canónica por `tax_id`**, qualquer `UPDATE`/`DELETE` arrisca violar histórico ou compliance.

---

## 2. Informação mínima a recolher (por cada `tax_id` duplicado)

Para cada `tax_id` com `n > 1`:

```sql
SELECT i.global_user_id, i.tax_id, i.tax_id_type, i.kyc_status, i.kyc_level,
       i.created_at, i.updated_at
FROM identities i
WHERE i.tax_id = '<tax_id_em_conflito>'
ORDER BY i.created_at;
```

Acrescentar (manual ou queries):

- vínculos em `global_users` (mesmo `global_user_id`);
- vínculos em `actors` / `users` (volume de operações por âncora);
- existência de movimentação financeira ou contratos ligados a cada `global_user_id` (domínio Bank/marketplace — listar fontes).

---

## 3. Critérios de canonicidade (escolher **uma** política por ambiente — não misturar)

| ID | Política (esboço) | Prós | Contras |
|----|-------------------|------|---------|
| **P1** | **Mais antiga** (`created_at` mínimo) = canónica; outras arquivar/repoint | Simples de automatizar | Pode contradizer KYC mais recente |
| **P2** | **KYC aprovado** (`kyc_status = 'approved'`) prevalece; empate → P1 | Alinha a confiança operacional | Dois `approved` → exige desempate |
| **P3** | **Nenhuma fusão automática** — só decisão humana caso a caso | Menor risco jurídico | Lento |
| **P4** | **Merge de histórico** (um `global_user_id` alvo; repoint de FKs) — desenho por caso | Preserva trilhos | Muito trabalhoso; exige mapa de FKs |

**Recomendação de processo:** começar com **P3** em LIVE até volume baixo; definir política **P1 ou P2** por escrito para staging e depois generalizar se o negócio aceitar.

**Regra crítica (anti-inconsistência):** por **ambiente** (`dev` / `staging` / `prod`), existe **exatamente uma** política ativa (P1–P4) para deduplicação automática ou semi-automática. **Não** alternar P1 vs P2 por `tax_id` ad hoc — isso gera estado **inauditável**. Excepções só via **P3** documentada por caso com entrada no ledger (§6).

---

## 4. Saídas técnicas possíveis (após decisão por `tax_id`)

*(Só executar com PROPOSTA aprovada e evidência em log.)*

- Repoint: `actors.global_user_id`, `users.global_user_id`, etc. para o **único** `global_user_id` canónico **ou**  
- Arquivar linha duplicada em `identities` (soft-delete / tabela de arquivo) se o schema permitir — **nunca** apagar à cegas se existir histórico regulado.  
- Registo em `FALSIFICATION_LOG.md` se a correção expuser “segunda verdade” corrigida.

---

## 5. PROPOSTA (formato obrigatório)

```text
PROPOSTA-DEDUP-TAX_ID-⟨YYYYMMDD⟩:

- tax_id (s) em conflito: ⟨ lista ⟩
- Política escolhida: P1 | P2 | P3 | P4 (com detalhe)
- global_user_id canónico por tax_id: ⟨ tabela ⟩
- Impacto Bank / marketplace / actors / users: ⟨ ⟩
- SQL ou scripts (anexos) — forward-only
- Rollback: ⟨ backup / reversão ⟩

APROVADO: ⟨ sim — quem / quando ⟩
```

---

## 6. Ledger de decisão de canonicidade (append-only)

**Objetivo:** provar **para sempre** qual `global_user_id` foi escolhido como canónico para cada `tax_id` corrigido, com **quem** decidiu e **sob que política** — sem reescrever histórico.

**Formato recomendado:** ficheiro **JSON Lines** (uma linha = uma decisão), append-only. **Nunca** editar ou apagar linhas anteriores; correção errada = **nova** linha que referencia a anterior.

**Caminho sugerido:** `docs/03_execution_log/tax_id_canonicality_decisions.jsonl`  
*(Se o repositório não puder guardar identificadores sensíveis: usar armazenamento seguro à parte e aqui só `path:` + hash do artefacto.)*

### 6.1 Campos mínimos por linha (JSON)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `decision_id` | string (UUID) | sim | Gerado no momento da decisão |
| `ts_utc` | string ISO8601 | sim | Momento da decisão |
| `environment` | string | sim | `dev` \| `staging` \| `prod` |
| `tax_id` | string | sim | Valor exato tratado |
| `policy` | `P1`\|`P2`\|`P3`\|`P4` | sim | Deve coincidir com política do ambiente |
| `canonical_global_user_id` | UUID | sim | Vencedor |
| `superseded_global_user_ids` | array UUID | sim | Lista completa dos repointed/arquivados |
| `proposta_ref` | string | sim | ex.: `PROPOSTA-DEDUP-TAX_ID-20260415` |
| `approved_by` | string | sim | Identidade humana ou papel normado |
| `evidence_refs` | array string | sim | Paths a SQL output, dumps, tickets |
| `notes` | string | não | Livre; sem substituir campos obrigatórios |

**Exemplo de linha (ilustrativo):**

```json
{"decision_id":"…","ts_utc":"2026-04-15T12:00:00Z","environment":"staging","tax_id":"00000000000","policy":"P3","canonical_global_user_id":"…","superseded_global_user_ids":["…"],"proposta_ref":"PROPOSTA-DEDUP-TAX_ID-20260415","approved_by":"Nome — papel","evidence_refs":["docs/03_execution_log/IDENTITY-PRECHECK-20260415.txt"],"notes":"Empate resolvido manualmente."}
```

Após cada decisão aplicada em BD: **append** uma linha **antes** de declarar A4 resolvido para esse `tax_id`.

### 6.2 Manifest de resolução (opcional — ativa o gate no CI)

Quando um PR ou pipeline declarar que **A4 foi limpo** por deduplicação (lista explícita de `tax_id` tratados), colocar **`docs/03_execution_log/tax_id_resolution_manifest.json`** com o formato abaixo. O job **`validate:tax-id-ledger`** no CI falha se **qualquer** `tax_id` do manifest **não** tiver linha no ledger com o **mesmo** `tax_id` e **`canonical_global_user_id`** igual a `expected_canonical_global_user_id`.

**Sem manifest:** o CI só valida estrutura do ledger **se** o ficheiro JSONL existir e tiver linhas; caso contrário **SKIP** (não obriga ledger em repos sem dedup).

**Com manifest com `items` não vazio:** o ledger **tem** de existir, ter pelo menos uma linha válida por item, e cobrir cada par `(tax_id, expected_canonical_global_user_id)`.

```json
{
  "version": 1,
  "environment": "staging",
  "generated_at_utc": "2026-04-15T18:00:00Z",
  "items": [
    {
      "tax_id": "00000000000000",
      "expected_canonical_global_user_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "proposta_ref": "PROPOSTA-DEDUP-TAX_ID-20260415"
    }
  ]
}
```

**Prova fora do git:** podes manter só `ledger_sha256` + caminho no manifest estendido no teu processo interno; o gate mínimo no repo exige **ledger + manifest coerentes** quando o manifest está presente.

**Comando local:** `npm run validate:tax-id-ledger` (ou `TAX_ID_LEDGER_PATH` / `TAX_ID_RESOLUTION_MANIFEST_PATH` para paths alternativos).

---

## 7. Ligações

- `PLANO_IDENTITY_RECONCILIATION.md` — A4, fase 0, runbook `EXECUTAR/IDENTITY_RECONCILIATION_RUNBOOK.md`  
- `PLANO_BASE_MODULO.md` — §STATE_TRANSITION_RULES, §8.8  
- `docs/01_normative/FALSIFICATION_LOG.md` — se aplicável

---

*Mecanismo de decisão para o “próximo dragão”; execução só após aprovação explícita.*
