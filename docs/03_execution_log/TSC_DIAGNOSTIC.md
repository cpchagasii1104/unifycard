# Diagnóstico TSC — Por que o número de erros mudou?

**Data:** 2026-02 (execução atual)  
**Objetivo:** Congelar contexto e comparar saída atual do `tsc` com o último baseline conhecido.

---

## PASSO 1 — Contexto congelado

| Item | Valor |
|------|--------|
| **commit** | a2a4cbe654c51ccd1d66dbbf0915710277bbdd4f |
| **branch** | genesis_v2_rebase |
| **workspace** | dirty (M e ?? em vários arquivos; muitos dist/ e tsc_*.txt) |

---

## PASSO 2 — Execução tsc

- **Diretório:** backend (`c:\unificard\backend`)
- **node:** v22.16.0
- **tsc:** Version 5.9.3
- **Comando:** `npx tsc --noEmit > tsc_now.txt` (e `tsc_now_2.txt`)
- **Diff tsc_now.txt vs tsc_now_2.txt:** idênticos (exit 0).

---

## PASSO 3 — Baseline anterior

- **Arquivo usado:** `backend/tsc_final_6dd.txt`
- **Diff gerado:** `backend/tsc_diff.txt` (git diff --no-index tsc_final_6dd.txt tsc_now.txt)

---

## PASSO 4 — Contagens

### Erros totais (linhas com "error TS")

| Momento | Arquivo | Total |
|---------|---------|--------|
| **Antes** | tsc_final_6dd.txt | 1001 |
| **Depois** | tsc_now.txt | 865 |

**Conclusão:** O número total de erros **diminuiu** (1001 → 865; −136). Não houve aumento.

### TS2339

| Momento | TS2339 |
|---------|--------|
| **Antes** (tsc_final_6dd.txt) | 169 |
| **Depois** (tsc_now.txt) | 50 |

**Conclusão:** TS2339 **diminuiu** (169 → 50; −119), alinhado ao registrado no log da FASE 6E (50 bloqueios congelados).

### Top 10 códigos TS em tsc_now.txt

| Código | Contagem |
|--------|----------|
| TS2322 | 167 |
| TS2304 | 158 |
| TS18047 | 102 |
| TS2307 | 69 |
| TS18046 | 52 |
| TS2339 | 50 |
| TS7006 | 28 |
| TS18004 | 8 |
| TS2554 | 7 |
| TS7053 | 6 |

### Quais TS codes cresceram?

**Nenhum.** Em relação a tsc_final_6dd.txt, o total de erros diminuiu; todos os códigos relevantes diminuíram ou permanecem (TS2339 passou de 169 para 50). Não foi identificado código TS com aumento na comparação com tsc_final_6dd.txt.

### 5 primeiras linhas “novas” no diff (linhas + em tsc_now em relação a 6dd)

O diff mostra principalmente linhas **removidas** (−) no “agora” (erros que deixaram de aparecer). Linhas **+** que aparecem no diff são em geral mudanças de contexto (numeração). Exemplos de linhas que aparecem como adição no diff e contêm erro (podem ser reordenação de arquivo):

1. `+src/modules/ledger/ledger.routes.ts(67,22): error TS18047: 'req.tenant' is possibly 'null'.`
2. `+src/modules/ledger/ledger.routes.ts(86,27): error TS2304: Cannot find name 'ledgerService'.`
3. `+src/modules/ledger/ledger.routes.ts(99,22): error TS18047: 'req.tenant' is possibly 'null'.`
4. `+src/modules/ledger/ledger.routes.ts(108,27): error TS2304: Cannot find name 'ledgerService'.`
5. `+src/modules/ledger/ledger.routes.ts(120,22): error TS18047: 'req.tenant' is possibly 'null'.`

---

## Resumo objetivo

| Pergunta | Resposta |
|----------|----------|
| **Erros totais antes/depois?** | Antes 1001, depois 865 (−136). |
| **TS2339 antes/depois?** | Antes 169, depois 50 (−119). |
| **Quais TS codes cresceram?** | Nenhum; totais diminuíram. |
| **5 primeiras linhas novas do diff?** | Acima (ledger.routes TS18047/TS2304). |
| **Mudança de versão node/ts?** | Não verificada em relação ao momento do 6dd; atual: node v22.16.0, tsc 5.9.3. |
| **Mudança de commit/branch ou dirty?** | Branch genesis_v2_rebase; workspace dirty. |

**Conclusão:** Na comparação com `tsc_final_6dd.txt`, o número de erros do tsc **não aumentou**; **diminuiu** (1001 → 865). Se em outro ambiente ou commit se observou aumento, pode ser devido a: (1) outro baseline (outro arquivo ou branch), (2) workspace dirty distinto, (3) versões diferentes de node/tsc.
