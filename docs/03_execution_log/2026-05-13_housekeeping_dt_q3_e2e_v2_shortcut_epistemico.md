# Housekeeping HK5 — Registro formal de DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO

**Data:** 2026-05-13
**Modo:** memória histórica (DT formal)
**Branch:** `rescue-structural`
**HEAD anterior:** `cde2d712` (housekeeping pós-F5)
**HEAD pós-housekeeping:** TBD (este commit)

---

## 1. Origem material

Sessão GUARDIÃO de mapa pré-E2E (autorizada por Clayton em 2026-05-13) descobriu materialmente que o **caminho fundacional canônico declarado por DECISION-0031 não existe em código**:

- `backend/src/modules/escrow/escrow.service.ts:312-347` tem 5 métodos STUB (`lock`, `startRelease`, `release`, `complete`, `getEscrowByEvent`) com comentário literal "TODO: integrar com event-escrow quando existir"
- `backend/src/jobs/post-event-split.job.ts` (linhas 109, 140, 197, 230, 279) invoca esses 5 stubs em sequência
- `splitEngineService` (core/economy, usado pelo job pós-evento) NÃO TEM rule de reserve no split event_ticket — apenas EVENT_ORGANIZER/TENANT/REGION/GROUP
- `bankSplitEngineService` (modules/bank) TEM reserve 17% no split event_ticket, mas é invocado em outro caminho (transações P2P/transfer via `bank-transaction.service`), não no settle pós-evento

Consequência: `q3-e2e-v2.ts` (commit `61e10c26`, declarado "smoke econômico fundacional") usa shortcut **Opção C** que DECISION-0031 (mesmo dia, possivelmente depois) refutou explicitamente. Passa 11/11 mas valida ledger técnico, não fluxo fundacional canônico.

Registro completo da descoberta em `executei_21.md` (gitignored).

## 2. O que este housekeeping atualiza

### `REMEDIATION_DT_LOG.md`

Adicionada entrada formal **DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO** com:

- **Status:** OPEN
- **Classe:** DT-R (runtime / falsa solvência institucional)
- **Origem:** Investigação prévia smoke v3 fundacional (executei_21)
- **Vinculação a:** DECISION-0031, commit `61e10c26`, achado em `escrow.service.ts:312-347`
- **Critério de convergência:** após DECISION-0035 formalizada + smoke v3 fundacional canônico implementado, v2 deprecated ou deletado
- **Bloqueador para:** declaração legítima de "fluxo econômico ponta-a-ponta validado em runtime"
- **Prioridade:** ALTA — falsa solvência institucional em ponto soberano (caminho fundacional econômico)

## 3. Por que registrar agora (timing)

Quanto mais tempo a falsa solvência permanece não-registrada, maior o risco de virar precedente institucional não-questionado. Próxima sessão (humana ou IA) que ler git log + STATUS_EXECUCAO_GLOBAL pode citar v2 como prova de "fluxo econômico fundacional validado em runtime" — quando não é.

Custo de registrar agora: ~10min (este commit).
Custo de não registrar: risco institucional alto + retrabalho futuro para desfazer narrativa equivocada.

Decisão: registrar agora em commit isolado, antes de iniciar sessão δ' (DRAFT DECISION-0035).

## 4. O que este housekeeping NÃO faz (transparência institucional)

- ❌ NÃO inicia δ' (sessão dedicada de investigação material + DRAFT DECISION-0035) — frente separada
- ❌ NÃO deleta ou deprecated `q3-e2e-v2.ts` — fica para sessão pós-DECISION-0035 formalizada
- ❌ NÃO altera STATUS_EXECUCAO_GLOBAL.md — DT-Q3-E2E-V2 será citada lá em housekeeping consolidado pós-δ' / pós-DECISION-0035
- ❌ NÃO cria DECISION nova — DT registra falsa solvência; DECISION-0035 será produto da sessão δ' (DRAFT) + audit multi-AI + formalização autorizada por Clayton
- ❌ NÃO toca código de runtime — DT é registro institucional

## 5. Aderência ao protocolo

- §7 — log institucional criado
- §29 — git add específico (apenas REMEDIATION_DT_LOG.md + este log)
- §25 — DT com critério de convergência explícito (após DECISION-0035 + smoke v3)
- §10 — não toquei norma soberana (Constituição/Leis/07); apenas registrei falsa solvência em log apropriado
- Calibração 2026-05-13 — "menos meta-governança" honrada (commit cirúrgico, não inflar)

## 6. Estado pós-housekeeping

| Item | Estado |
|---|---|
| `q3-e2e-v2.ts` | Permanece como está; agora rastreado por DT |
| Caminho fundacional canônico | Reconhecido como STUB; bloqueador para declaração legítima |
| Próxima ação | δ' — sessão de investigação material + DRAFT DECISION-0035 |
| Sistema institucional | Memória histórica preserva descoberta material; risco de precedente equivocado mitigado |
