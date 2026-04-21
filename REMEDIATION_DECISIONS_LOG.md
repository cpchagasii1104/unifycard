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

*(Nenhuma decisão registrada até 2026-04-21.)*

---

**FIM DO DOCUMENTO** (continua crescendo por append a cada decisão)
