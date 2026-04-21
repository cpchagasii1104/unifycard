# REMEDIATION DECISIONS LOG

**Documento append-only. Toda decisão arquitetural tomada durante a remediação é registrada aqui.**
**Uma decisão registrada nunca é editada. Se superada, adicionar nova entrada referenciando a anterior.**

| Metadado | Valor |
|---|---|
| Criado | 2026-04-21 |
| Última entrada | (nenhuma) |
| Base normativa | `SYSTEM_REMEDIATION_PLAN.md` v1.0 |
| Arquivo relacionado | `SYSTEM_REMEDIATION_STATUS.md` (vivo) |

---

## Objetivo deste documento

Registrar permanentemente toda decisão que envolva:

1. Escolha arquitetural entre alternativas concorrentes (qual tabela de produto é SSOT, qual sistema de autorização sobrevive, etc.)
2. Ajuste no gate que impacte métricas anti-regressão (Seção 7 do PLAN)
3. Padrão de falso-positivo identificado + ajuste no script (Seção 6 do PLAN, limiar 3-5 FP)
4. Justificativa de desvio > 10% em baseline numérico do gate
5. Superação de uma versão do PLAN por outra (raríssimo, última instância)
6. Qualquer decisão que uma IA futura precise conhecer para não reabrir discussão

**Decisões fora deste log não existem.** Se não está aqui, não foi decidido.

---

## Formato obrigatório de cada entrada

```markdown
### DECISION-NNNN — <título curto e descritivo>

- **Data:** YYYY-MM-DD
- **Tipo:** <arquitetural | ajuste_gate | falso_positivo | desvio_baseline | superacao_plan | outro>
- **ID da violação (se aplicável):** Cxx
- **Contexto:** 
  (descrição do problema e por que exige decisão registrada)
- **Opções consideradas:**
  1. Opção A — descrição, prós, contras
  2. Opção B — descrição, prós, contras
  3. Opção C — descrição, prós, contras
- **Escolha:** Opção N
- **Justificativa:** 
  (por que essa opção vence; que invariante preserva; que risco aceita)
- **Consequências esperadas:**
  - Curto prazo: ...
  - Médio prazo: ...
- **Responsável:** <nome>
- **Validação prévia:** <quem revisou antes da decisão> (ChatGPT / Claude / Clayton / outro)
- **Supera:** DECISION-NNNN (se aplicável, senão "nenhuma")
- **Superada por:** (preencher apenas quando superada por entrada posterior)
- **Referências:** (links, linhas de código, migrations, arquivos SRC_FULL)
```

## Regras de integridade

- **Numeração sequencial** contínua. `DECISION-0001`, `DECISION-0002`, nunca pular.
- **Data no formato ISO** `YYYY-MM-DD`.
- **Nunca editar decisão registrada.** Se informação precisa mudar, nova entrada com `Supera: DECISION-NNNN` e a entrada antiga ganha `Superada por: DECISION-MMMM`.
- **Toda decisão que afeta Status.** Atualizar `SYSTEM_REMEDIATION_STATUS.md` no mesmo commit que registra a decisão.
- **Commit padronizado:** `"decisions: DECISION-NNNN <título>"`.

---

## Registros

---

### DECISION-0001 — Falsos negativos do gate v1.1: 42P01 e metadata->> em decisão

- **Data:** 2026-04-21
- **Tipo:** ajuste_gate
- **ID da violação:** C14 (42P01), C6 (metadata->>)
- **Contexto:**
  Validação manual (ETAPA 5 do gate v1.1) identificou 2 padrões que o gate não detecta:
  1. Catches de 42P01 quando o código extrai `const code = error.code` antes do `if` —
     o regex atual só cobre `error?.code === '42P01'` diretamente no bloco catch.
     9 ocorrências reais não detectadas em unified-availability.routes.ts e outros.
  2. metadata->> em decisão transacional quando a tabela transacional não aparece
     no mesmo snippet SQL capturado — critério de tabela transacional muito restrito.
     9 ocorrências reais não detectadas (city-readiness.service.ts, trust.service.ts, etc.)
- **Opções consideradas:**
  1. Expandir regex de 42P01 para cobrir extração de variável (`const code = error.code`)
  2. Relaxar critério de metadata->> (não exigir tabela transacional no snippet)
  3. Manter como está e registrar como dívida de gate v2
- **Escolha:** Opção 3
- **Justificativa:**
  Gate v1.1 sub-reporta, não super-reporta. Sub-reportar é aceitável nesta fase —
  significa que há violações reais que o gate não vê, mas não há ruído falso.
  Expandir agora quebraria o princípio P2 (correção incremental) e a ETAPA 5
  seria refeita. Registra como backlog do gate v2 (FASE 8 do PLAN).
- **Consequências esperadas:**
  - Curto prazo: 9+ catches de 42P01 e 9+ metadata->> continuam invisíveis ao gate
  - Médio prazo: gate v2 adiciona Regra 8 (catches) cobrindo esses padrões
- **Responsável:** Clayton
- **Validação prévia:** Claude + Visual Code (ETAPA 5 validação manual)
- **Supera:** nenhuma
- **Superada por:** (a preencher quando gate v2 implementar Regra 8)
- **Referências:**
  - unified-availability.routes.ts: linhas com `if (code === '42P01')`
  - trust.service.ts: metadata->>'actor_id' em CASE WHEN
  - SYSTEM_REMEDIATION_PLAN.md §6 (Loop de Validação do Gate)
  - SYSTEM_REMEDIATION_PLAN.md FASE 8 (Gates Evolutivos)

---

*(Próxima entrada: DECISION-0002)*

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada decisão)
