# BASELINE INSTITUCIONAL — v1

## Status
CONGELADO • CANÔNICO • REFERÊNCIA OBRIGATÓRIA

Este documento declara o **estado institucional válido** do ecossistema UnifiCard.
Ele consolida regras, decisões, práticas e guardrails que NÃO podem ser alterados
sem decisão formal registrada.

Qualquer mudança futura parte deste baseline.

---

## 1. O QUE ESTE DOCUMENTO É

- Um marco institucional
- Um ponto de referência contra regressão
- Um contrato de entendimento entre humanos, IA e código
- A fotografia oficial do sistema em estado saudável

---

## 2. O QUE ESTE DOCUMENTO NÃO É

- Não é roadmap
- Não é plano futuro
- Não é especificação de feature
- Não é espaço para discussão

---

## 3. PRINCÍPIOS FUNDAMENTAIS CONGELADOS

Os princípios abaixo estão estabelecidos e não são negociáveis:

- Governança vem antes de execução
- SSOT é obrigatório
- Context ≠ Domain
- Categoria ≠ Feature ≠ Ferramenta
- Agenda é infraestrutura temporal, não categoria
- IA não decide
- Decisão precede execução
- Execução deixa rastro documental

---

## 4. HIERARQUIA DE AUTORIDADE (OFICIAL)

A hierarquia institucional válida é:

1. `docs/01_normative/` — LEI
2. `docs/02_decisions/` — DECISÕES REGISTRADAS
3. `docs/03_technical/` — IMPLEMENTAÇÃO ESPERADA
4. `docs/04_guides/` — OPERAÇÃO HUMANA E IA
5. Código — IMPLEMENTAÇÃO REAL

Conflitos são resolvidos **sempre de cima para baixo**.
Nenhuma exceção é permitida.

---

## 5. DOCUMENTOS CANÔNICOS ATIVOS

### Normativos (LEI)
- `REGRA_CANONICA_USO_DE_IA.md`
- `REGRA_CANONICA_CRIACAO_DE_CONTEXT.md`
- `REGRA_CANONICA_DOMAIN_METADATA.md`

### SSOT
- `SSOT_Categorias_UnifiCard.md`

### Decisões estruturais
- `RESULTADO_VALIDACAO_GATES_PRE_MVP.md`
- `CHECKPOINT_MATURIDADE_ESCALA.md`

---

## 6. PROMPTS CANÔNICOS (OBRIGATÓRIOS)

Todo uso de IA deve obedecer:

- `PROMPT_CANONICO_EXECUCAO_CURSOR.md`
- `PROMPT_CANONICO_AUDITORIA.md`
- `PROMPT_CANONICO_HARDENING.md`

Prompts fora disso não têm autoridade institucional.

---

## 7. CHECKLISTS OPERACIONAIS ATIVOS

Antes de qualquer ação crítica, devem ser usados:

- `CHECKLIST_USO_DE_IA.md`
- `CHECKLIST_USO_CONTEXT.md`
- `CHECKLIST_USO_DOMAIN.md`
- `CHECKLIST_ALTERACAO_CATEGORIAS.md`
- `CHECKLIST_ALTERACAO_SCHEMA.md`
- `CHECKLIST_ALTERACAO_MIGRATIONS.md`

Ignorar checklist invalida a ação.

---

## 8. ESTADO TÉCNICO CONGELADO

No momento deste baseline, o sistema atende:

- SSOT de leitura fechado (tree/search/autocomplete)
- Context explícito, sem fallback
- Domain governado via metadata
- Migrações íntegras, numeradas e enforçadas em CI
- Testes críticos executáveis
- CI com travas mínimas reais

Este é o **mínimo aceitável** para evolução.

---

## 9. COMO EVOLUIR A PARTIR DESTE BASELINE

Para qualquer mudança futura:

1. Criar ou atualizar decisão em `docs/02_decisions/`
2. Verificar impacto nos normativos
3. Executar com prompts canônicos
4. Atualizar documentação relevante
5. (Opcional) Criar novo baseline (v2)

Mudança sem isso é inválida.

---

## 10. REGRA FINAL

> Este baseline existe para proteger o sistema
> de pressa, criatividade excessiva e regressão invisível.

Qualquer tentativa de “dar um jeitinho”
é tratada como falha institucional.

Fim.
