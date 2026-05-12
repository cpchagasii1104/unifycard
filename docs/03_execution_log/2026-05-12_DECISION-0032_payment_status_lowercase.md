# DECISION-0032 — Payment status canônico = lowercase + boundary mapper

**Data:** 2026-05-12
**Modo:** EXECUTOR (decisão arquitetural, sem implementação de código)
**Branch:** `rescue-structural`
**Escopo:** Edição institucional de 2 arquivos versionados + criação deste log. Zero alteração de código TS, schema SQL ou comportamento runtime.

---

## Contexto da execução

Continuação direta da investigação read-only DT-PAYMENT-CASING-DRIFT (relatório material `executei_8.md`, gitignored, 384 linhas). Após cobertura completa nos 4 níveis (norma + persistência + runtime + semântica compilada + transformadores) e refutação institucional da hipótese "ratificar UPPERCASE como exceção", Clayton autorizou caminho B: formalizar DECISION-0032.

## Ações executadas (2 arquivos versionados + 1 log)

| Arquivo | Tipo | Mudança |
|---|---|---|
| `REMEDIATION_DECISIONS_LOG.md` | Edit (append) | Adicionada entrada `DECISION-0032 — Payment status canônico = lowercase; gateways convertem casing na fronteira via mapper` ao final do arquivo |
| `REMEDIATION_DT_LOG.md` | Edit (in-place) | `DT-PAYMENT-CASING-DRIFT.Status: OPEN → CLOSED (2026-05-12 — encerrada por DECISION-0032)`. Conformidade §22 code.md: substituído campo Status original; **não** adicionado segundo campo. Vinculação atualizada (C36, DECISION-0028, **DECISION-0032**). Bloco "Resolução prevista" reescrito como "Resolução" com referência completa à investigação e aos 3 eixos da decisão. |
| `docs/03_execution_log/2026-05-12_DECISION-0032_payment_status_lowercase.md` | Write (este arquivo) | Conformidade §7 AGENT_PROTOCOL: execução versionada exige log institucional |

## DECISION-0032 — sumário canônico

**Tipo:** arquitetural (semântica linguística + boundary)
**Status:** ATIVO
**Encerra:** DT-PAYMENT-CASING-DRIFT

**3 eixos canônicos:**

1. **Casing canônico:** `payment_*.status`/`payment_status`/`intent_type` e demais colunas semânticas em domínio payment seguem **lowercase**. Tipos TS UPPERCASE são violação.
2. **Vocabulário canônico:** valores aceitos restritos aos CHECKs ativos (`payment_intents_payment_status_check` 11 valores; `payment_milestones_status_check` 5 valores). Writer B `payments/payment-intent-repository.ts` deve convergir (`'created'/'payment_received'/'completed'` ficam fora).
3. **Boundary mapper obrigatório:** integrações com gateways externos convertem casing/vocabulário na fronteira via mapper em `backend/src/modules/gateway/`. Domínio interno nunca recebe payload bruto de provider. `ExternalPaymentStatus` (boundary leak Stripe identificado) deve ser confinado a camada de gateway.

**Refutações registradas:**
- Opção A (ratificar UPPERCASE como exceção formal análoga a DECISION-0028): refutada. Investigação não produziu evidência arquitetural fortíssima; contratos canônicos congelados adjacentes já decidiram lowercase materialmente; ratificação seria fragmentação institucional sem necessidade estrutural.
- Opção B (manter status quo OPEN): refutada. Ausência de decisão indefinida vira pseudo-exceção informal.

**Não autoriza:** implementação direta. Plano faseado de execução (migrations + edits TS + testes) será sessão dedicada — referência: caminho C proposto em `executei_8.md`.

## Verificação

```bash
# Confirmar entrada DECISION-0032 no log canônico
grep -nE "^### DECISION-0032" REMEDIATION_DECISIONS_LOG.md

# Confirmar Status CLOSED em DT-PAYMENT-CASING-DRIFT (linha única, sem duplicação §22)
grep -nE "^- \*\*Status:\*\*" REMEDIATION_DT_LOG.md | grep -A0 -B0 PAYMENT

# Confirmar log institucional criado
ls docs/03_execution_log/2026-05-12_DECISION-0032_payment_status_lowercase.md

# Confirmar zero alteração de código (apenas markdown institucional + 1 untracked já existente)
git status --short | grep -vE "^\?\? " | grep -vE "(REMEDIATION_DECISIONS_LOG\.md|REMEDIATION_DT_LOG\.md|docs/03_execution_log/2026-05-12_DECISION-0032)"
```

## Multi-agente

- **Investigação:** Claude Code (Opus 4.7) — relatório material `executei_8.md`
- **Refinamento normativo:** Clayton (3 iterações de cobertura ampliada: 2.4.b/c/d/e/f no plano)
- **Decisão soberana:** Clayton
- **Auditoria externa proposta:** Opus 4.7 / ChatGPT (caminho C — antes de implementação)

## Estado físico ao final desta execução

| Item | Estado |
|---|---|
| `REMEDIATION_DECISIONS_LOG.md` | +DECISION-0032 (versionado) |
| `REMEDIATION_DT_LOG.md` | DT-PAYMENT-CASING-DRIFT CLOSED (versionado) |
| `docs/03_execution_log/2026-05-12_DECISION-0032_payment_status_lowercase.md` | criado (versionado) |
| `executei_8.md` | inalterado, gitignored, 384 linhas (referência material) |
| Plano `antes-de-executar-planeje-dreamy-dragonfly.md` | inalterado, 272 linhas (artefato local) |
| Memória institucional | inalterada (3 entradas + índice consolidados em sessão anterior) |
| Código TS / schema SQL / comportamento runtime | **ZERO alteração** |

## Próximo passo

**Caminho C — plano faseado de execução**, em sessão dedicada, com 4 fases mapeadas em DECISION-0032 (convergência Writer A→B; normalização payment_transactions/milestones; mapper de gateway; alinhamento frontend). Implementação só após plano faseado revisado.

---

**FIM DO LOG. Decisão arquitetural formalizada. Implementação preservada para sessão dedicada.**
