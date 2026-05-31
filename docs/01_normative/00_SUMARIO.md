# 00_SUMARIO.md
# Sumário Temático — docs/01_normative/

Este arquivo responde perguntas operacionais e lista os 20 arquivos críticos mais referenciados.
Para o índice completo (120 arquivos), ver: [00_INDEX.md](00_INDEX.md)

---

## Seção 1 — Onde encontrar X

### 1. Qual é a lei máxima do sistema?
**Arquivo:** `CONSTITUICAO_UNIFICARD.md`
Seção: completo. Status: IMUTÁVEL. Nenhuma outra lei pode contradizê-la.

### 2. Quem tem autoridade para quê?
**Arquivo:** `AUTHORITY_LAW.md` — lei suprema de autoridade.
**Complemento:** `08_AUTORIDADE_CANONICA.md` — como autoridade é exercida, delegada e revogada.
**Complemento:** `AUTHORITY_ENFORCEMENT_MODEL.md` — ponte entre soberania, regra verificável e gates futuros.
**Annexos:** `AUTHORITY_ANNEX_EVASION.md`, `AUTHORITY_ANNEX_IRREVERSIBLE_ACTIONS.md`, `AUTHORITY_ANNEX_TEST_OF_BREAK.md`

### 3. O que um agente de IA deve fazer antes de qualquer ação?
**Arquivo:** `00_AGENT_PROTOCOL.md` — protocolo de entrada obrigatório.
Seção §2.2: ordem de leitura lexical 00→99.
**Complemento:** `00_AGENT.md` — entrypoint canônico para agentes.
**Pré-execução:** `SSOT_PREFLIGHT.md` — verificações obrigatórias pré-alteração.

### 4. Qual é a SSOT financeira? Quem pode escrever no ledger?
**Arquivo:** `SSOT_EXCLUSIVE_BANK_RULE.md` — UnifyBank ÚNICA fonte verdade financeira.
**Complemento:** `SSOT_REGISTRY_UNIFICARD.md` — registry completo (dinheiro em centavos, ledger).
**Complemento:** `BANK_DOMAIN_RULES.md` — regras do domínio Bank.
**Complemento:** `LEDGER_SOVEREIGNTY.md` — único ledger financeiro soberano.
**Acesso restrito a:** `backend/src/modules/bank/`

### 5. Como a identidade de uma pessoa é definida?
**Arquivo:** `CORE_IDENTITY_AND_ACTORS_CONTRACT.md` — contrato fundacional identidade/atores.
**Complemento:** `02_ACTORS_SSOT.md` — ontologia explícita de Actors.
**Complemento:** `03_IDENTITY_CANONICA.md` — identidade canônica única por pessoa física.
**Complemento:** `IDENTITY_SSOT_PRECEDENCE.md` — precedência identity/actors/económicas.
**Chave:** `actor_id`. Escritor: `actor-writer.service`.

### 6. O que é permitido no CORE? O que pode mudar?
**Arquivo:** `CORE_IMUTAVEL.md` — conjunto imutável não duplicável.
**Complemento:** `CORE_VS_MODULOS_CONTRACT.md` — separação imutável CORE vs MÓDULOS.
**Complemento:** `CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md` — diferença conceitual.
**DECISION-0021:** CORE é jurisdição sobre verdade compartilhada, não pasta física. Soberania pode existir fora de `/core` quando SSOT/lei/contrato declara writer autorizado e enforcement.

### 7. O que está proibido estruturalmente no código?
**Arquivo:** `PROHIBITED_STRUCTURES.md` — todas as estruturas, tabelas e padrões PROIBIDOS.
Inclui: mini-cores clandestinos, seção FISCALIZAÇÃO, STATUS DE GATES, e critério FAIL-OPEN.

### 8. Quais são as leis operacionais vigentes?
**Arquivo:** `LEIS_OPERACIONAIS_UNIFICARD.md` — leis operacionais com vigência declarada.
**Complemento:** `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` — lei fundamental de coerência.

### 9. Como criar ou nomear tabelas e colunas no banco?
**Arquivo:** `07_NOMENCLATURA_CANONICA.md` — OBRIGATÓRIO · BLINDADO.
**Complemento:** `VOCABULARIO_CANONICO_UNIFICARD.md` — vocabulário canônico.
**Complemento:** `99_GLOSSARIO_CANONICO.md` — glossário semântico.

### 10. O que é categoria? Como validar uso de categorias?
**Arquivo:** `04_CATEGORIES_SSOT.md` — ontologia canônica de categorias.
**Complemento:** `CATEGORY_SCOPES_SEMANTICS.md` — o que é e o que não é categoria.
**Complemento:** `CORE_CATEGORY_VALIDATION_MATRIX.md` — critérios de validação.
**Decisão:** `CATEGORY_TREE_CANONICAL_DECISION.md` — decisão arquitetural definitiva.
**Nota:** `category_id` é TREE/navegação, não SSOT semântica. SSOT semântica = `CONCEPT`.

### 11. Como o sistema processa pagamentos e splits?
**Arquivo:** `CORE_SPLIT_PAGAMENTO_CANONICO.md` — core split pagamento imutável.
**Complemento:** `CORE_APROVACAO_FINANCEIRA_CANONICO.md` — aprovação financeira.
**Complemento:** `CORE_PERMISSOES_FINANCEIRAS_CANONICO.md` — permissões financeiras.
**Complemento:** `CORE_ESTORNOS_FINANCEIROS_CANONICO.md` — estornos.

### 12. Como o sistema pode evoluir sem quebrar contratos?
**Arquivo:** `PROCESSO_OFICIAL_EVOLUCAO_UNIFICARD.md` — processo oficial de evolução.
**Complemento:** `06_GOVERNANCA_CANONICA.md` — como o sistema pode mudar legitimamente.
**Complemento:** `ENFORCEMENT_MINIMO_PRE_MVP.md` — gates obrigatórios pré-MVP.
**Complemento:** `REGIME_OBSERVACAO_POS_MVP.md` — regime pós-MVP.

### 13. O que são contratos e quais existem?
**Arquivo:** `05_CONTRATOS_CANONICOS.md` — contrato como unidade mínima de legitimidade.
**Arquivo:** `CONTRACTS.md` — arquitetura cross-layer frontend/backend.
**Core:** `CORE_FINANCIAL_CONTRACT.md`, `CORE_IDENTITY_AND_ACTORS_CONTRACT.md`, `CORE_TEMPORAL_CONTRACT.md`, `CORE_OBSERVABILITY_CONTRACT.md`, `CORE_CATEGORY_CONTRACT.md`
**Específicos:** `USER_PROFILE_CONTRACT.md`, `CONTRATO_GRUPOS_V2.md` (vigente; dois bolsos), `CONTRATO_GRUPOS_V1.md` (parcialmente revogado pelo V2), `CONTRATO_FEED_MATCHING_UNIFICARD.md`, `CORE_VS_MODULOS_CONTRACT.md`

### 14. Como a observabilidade e os effects são controlados?
**Arquivo:** `CORE_OBSERVABILITY_CONTRACT.md` — contrato fundacional de observabilidade.
**Complemento:** `OBSERVABILIDADE_CONSTITUCIONAL.md` — observabilidade constitucional.
**Complemento:** `HANDLER_EXECUTION_AND_RELIABILITY.md` — execução handlers e publicação.
**Complemento:** `EVENT_OUTBOX_E_ENTREGA_CANONICO.md` — entrega efeitos via outbox.
**Complemento:** `EFFECTS_ACTOR_CONTRATO.md` — contrato técnico de effects.

---

## Seção 2 — Top 20 Arquivos Críticos

Arquivos mais referenciados no sistema. Exclui: LEGADO, NON-NORMATIVE, RFC/Plano puro.

| # | Arquivo | Status | O que resolve |
|---|---------|--------|---------------|
| 1 | 00_AGENT_PROTOCOL.md | CANÔNICO · VIGENTE | Protocolo de entrada obrigatório para qualquer agente |
| 2 | LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md | CANÔNICO · VIGENTE | Lei fundamental que governa toda arquitetura |
| 3 | CONSTITUICAO_UNIFICARD.md | IMUTÁVEL | Lei máxima — nenhuma outra pode contradizê-la |
| 4 | AUTHORITY_LAW.md | CANÔNICO · VIGENTE | Quem tem autoridade para quê no sistema |
| 5 | SSOT_REGISTRY_UNIFICARD.md | CANÔNICO · VIGENTE | Registry único de fontes de verdade (financeiro, identidade, semântica) |
| 6 | PROHIBITED_STRUCTURES.md | NORMATIVO · VINCULANTE | O que é estruturalmente proibido no código |
| 7 | 07_NOMENCLATURA_CANONICA.md | CANÔNICO · VIGENTE · OBRIGATÓRIO · BLINDADO | Como nomear tabelas, colunas e módulos |
| 8 | LEIS_OPERACIONAIS_UNIFICARD.md | CANÔNICO · VIGENTE | Leis operacionais vigentes com data de ativação |
| 9 | SSOT_EXCLUSIVE_BANK_RULE.md | CANÔNICO · VIGENTE | UnifyBank como única SSOT financeira |
| 10 | CORE_IMUTAVEL.md | CORE | O que é CORE e o que não pode mudar |
| 11 | SSOT_PREFLIGHT.md | CANÔNICO · OBRIGATÓRIO | Checklist obrigatório antes de qualquer alteração |
| 12 | CORE_IDENTITY_AND_ACTORS_CONTRACT.md | CORE | Contrato fundacional de identidade e atores |
| 13 | IDENTITY_SSOT_PRECEDENCE.md | CANÔNICO · VIGENTE | Qual identidade prevalece e por quê |
| 14 | ENFORCEMENT_MINIMO_PRE_MVP.md | APROVADO · VINCULANTE | Gates mínimos obrigatórios para o MVP |
| 15 | CORE_FINANCIAL_CONTRACT.md | CORE | Contrato fundacional de governança financeira |
| 16 | CATEGORY_SCOPES_SEMANTICS.md | CANÔNICO · VIGENTE | O que é e o que não é categoria no sistema |
| 17 | INVARIANTES_OPERACIONAIS_LEDGER.md | CANÔNICO · VIGENTE | Invariantes que nunca podem ser violados no ledger |
| 18 | BANK_DOMAIN_RULES.md | CANÔNICO · VIGENTE | Regras do domínio Bank reforçam Lei de Coerência |
| 19 | REGRA_CANONICA_USO_DE_IA.md | CANÔNICO · VIGENTE | O que um agente de IA pode e não pode fazer |
| 20 | ARCHITECTURE_DEPENDENCY_BOUNDARIES.md | CANÔNICO · VIGENTE | Fronteiras de dependência entre módulos/camadas |

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 00_AGENT.md
- 00_AGENT_PROTOCOL.md
- 00_INDEX.md
- 02_ACTORS_SSOT.md
- 03_IDENTITY_CANONICA.md
- 04_CATEGORIES_SSOT.md
- 05_CONTRATOS_CANONICOS.md
- 06_GOVERNANCA_CANONICA.md
- 07_NOMENCLATURA_CANONICA.md
- 08_AUTORIDADE_CANONICA.md
- 99_GLOSSARIO_CANONICO.md
- ARCHITECTURE_DEPENDENCY_BOUNDARIES.md
- AUTHORITY_ANNEX_EVASION.md
- AUTHORITY_ANNEX_IRREVERSIBLE_ACTIONS.md
- AUTHORITY_ANNEX_TEST_OF_BREAK.md
- AUTHORITY_LAW.md
- BANK_DOMAIN_RULES.md
- CATEGORY_SCOPES_SEMANTICS.md
- CATEGORY_TREE_CANONICAL_DECISION.md
- CONSTITUICAO_UNIFICARD.md
- CONTRACTS.md
- CONTRATO_FEED_MATCHING_UNIFICARD.md
- CONTRATO_GRUPOS_V1.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_CATEGORY_CONTRACT.md
- CORE_CATEGORY_VALIDATION_MATRIX.md
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
- CORE_FINANCIAL_CONTRACT.md
- CORE_IDENTITY_AND_ACTORS_CONTRACT.md
- CORE_IMUTAVEL.md
- CORE_OBSERVABILITY_CONTRACT.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
- CORE_SPLIT_PAGAMENTO_CANONICO.md
- CORE_TEMPORAL_CONTRACT.md
- CORE_VS_MODULOS_CONTRACT.md
- EFFECTS_ACTOR_CONTRATO.md
- ENFORCEMENT_MINIMO_PRE_MVP.md
- EVENT_OUTBOX_E_ENTREGA_CANONICO.md
- HANDLER_EXECUTION_AND_RELIABILITY.md
- IDENTITY_SSOT_PRECEDENCE.md
- INVARIANTES_OPERACIONAIS_LEDGER.md
- LEDGER_SOVEREIGNTY.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
- OBSERVABILIDADE_CONSTITUCIONAL.md
- PROCESSO_OFICIAL_EVOLUCAO_UNIFICARD.md
- PROHIBITED_STRUCTURES.md
- REGIME_OBSERVACAO_POS_MVP.md
- REGRA_CANONICA_USO_DE_IA.md
- SSOT_EXCLUSIVE_BANK_RULE.md
- SSOT_PREFLIGHT.md
- SSOT_REGISTRY_UNIFICARD.md
- USER_PROFILE_CONTRACT.md
- VOCABULARIO_CANONICO_UNIFICARD.md

### Referenciado por
_não referenciado por nenhum arquivo mapeado_
<!-- AUTO-GENERATED-END -->
