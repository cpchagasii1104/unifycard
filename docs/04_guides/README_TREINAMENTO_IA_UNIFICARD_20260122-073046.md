---

# DOCUMENTO TÉCNICO / HISTÓRICO

⚠️ Este documento NÃO é norma.
⚠️ Não possui autoridade hierárquica.
⚠️ Se houver conflito, prevalece exclusivamente:
docs/01_normative/
------------------

# README_TREINAMENTO_IA_UNIFICARD.md

Status: TÉCNICO — DOCUMENTO DE REFERÊNCIA  
Natureza: Diretriz operacional (define ordem de leitura e interpretação)  
Audiência: IAs Guardiãs · Arquitetura · Operadores Humanos  
Escopo: Dataset de referência para treinamento do UnifiCard

---

## FINALIDADE

Este README existe para **impedir que IAs (ou humanos) se percam**.
Ele define:

- onde está a autoridade,
- em que ordem ler,
- o que é LEI, o que é LIMITE e o que é SUPORTE,
- e como evitar **anticore, duplicação e decisões implícitas**.

⚠️ Este documento **não cria regras novas**.  
Ele apenas **organiza e explicita a autoridade existente**.

---

## PRINCÍPIO OPERACIONAL (DIRETRIZ)

> **Recomenda-se que nenhuma ação seja executada no UnifiCard sem apontar,
> explicitamente, qual documento normativo a autoriza.**

Na dúvida:
- ❌ RECUSAR
- 📄 CITAR o conflito documental

---

## REGRA ZERO — ANTI-DUPLICAÇÃO (CHECKPOINT OBRIGATÓRIO)

Antes de qualquer análise, proposta ou implementação:

1. Assuma que **já existe algo parecido**
2. Verifique explicitamente no código, banco e docs
3. Se existir algo similar → **EXTENDER, nunca duplicar**

Documento obrigatório:
- `CHECK_DUPLICIDADE_OBRIGATORIO.md`

Sem cumprir este passo → **resposta inválida**.

---

## 📁 ORGANIZAÇÃO CANÔNICA DA PASTA `treinamento/`

Esta organização é **cognitiva e institucional**.
Ela existe para que **qualquer IA competente entenda o sistema rapidamente**.

---

### 00__LEIA_PRIMEIRO__/
**Bootstrap cognitivo obrigatório**

- README_TREINAMENTO_IA_UNIFICARD.md
- INDEX_INSTITUCIONAL.md
- HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md
- GLOSSARIO_CANONICO.md

👉 Se a IA errar aqui, errará todo o resto.

---

### 01__CORE_IMUTAVEL__/
**Contratos técnicos do sistema (referência técnica)**

- CORE_IMUTAVEL.md
- CORE_VS_MODULOS_CONTRACT.md
- CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md

Qualquer violação aqui → **bloqueio imediato**.

---

### 02__CORE_TEMPORAL__/
**Tempo é core. Core não tem jeitinho.**

- AGENDA_UNIVERSAL_CONTRACT.md
- CORE_TEMPORAL_HARDENING_CONTRACT.md
- AGENDA_UNIFICADA_MODELO_OPERACIONAL.md
- CHECKLIST_CI_REGRESSAO_TEMPORAL.md
- LEGADO_TEMPORAL_MIGRATION_PLAN.md

Nada cria agenda paralela. Nunca.

---

### 03__CORE_DECISAO_E_GOVERNANCA__/
**Impedir automação, score e inferência**

- GOVERNANCA_E_VISAO_CANONICA_UNIFICARD.md
- Decision_Safety_and_Containment_Contract.md
- Category_System_Contract_UnifiCard.md
- OBSERVABILIDADE_CONSTITUCIONAL.md

Aqui a IA aprende principalmente **o que NÃO pode fazer**.

---

### 04__CORE_FINANCEIRO__/
**Onde sistemas normalmente mentem — aqui não**

- Database_Canonical_Truth_Contract.md
- Database_Containment_Rules.md
- MATRIZ_FONTES_DE_VERDADE.md

- CORE_SPLIT_PAGAMENTO_CANONICO.md
- CORE_ESTORNOS_FINANCEIROS_CANONICO.md
- CORE_APROVACAO_FINANCEIRA_CANONICO.md
- CORE_AUTORIA_FINANCEIRA_IMPLEMENTACAO.md
- CORE_PERMISSOES_FINANCEIRAS_CANONICO.md

Financeiro exige **fronteira cognitiva clara**.

---

### 05__IDENTIDADE_E_PERMISSOES__/
**Quem pode fazer o quê (sem mágica)**

- MAPA_CANONICO_PERMISSIONS_v1.md
- USER_PROFILE_CONTRACT.md
- IDENTITY_CORE_CONTRACT.md

Permissão fora do mapa → inválida.

---

### 06__CHECKLISTS_E_GATES__/
**Impedir erro antes do PR**

- CHECK_DUPLICIDADE_OBRIGATORIO.md
- CATEGORY_HARDENING_CHECKLIST.md
- HARDENING_CYCLE_CLOSURE.md

IA boa passa por checklist. IA ruim ignora.

---

### 07__SUPORTE_E_GUIDELINES__/
**Ajudam, mas NÃO mandam**

- PADRAO_FRONTEND_CANONICO.md
- UX_MARKETPLACE_CHECKOUT_MULTI_VENDOR.md
- guideline_metadata_contexto_agenda_universal.md
- MASTER PLAN — AGENDA UNIVERSAL, UX TEMPORAL E GOVERNANÇA.md

⚠️ Estes documentos **não possuem autoridade canônica**.

---

### 08__RITUAIS_DAS_IAS__/
**Comportamento operacional das máquinas**

- RITUAL_DE_INICIALIZACAO_IA_GUARDIA.md
- PROMPT_IA_GUARDIA_V2.md

Evita IA criativa demais.

---

## ORDEM CANÔNICA DE LEITURA (OBRIGATÓRIA)

Toda IA Guardiã DEVE ler, nesta ordem mínima:

1. GOVERNANCA_E_VISAO_CANONICA_UNIFICARD.md
2. INDEX_INSTITUCIONAL.md
3. HIERARQUIA_E_AUTORIDADE_DOS_DOCUMENTOS.md
4. CHECK_DUPLICIDADE_OBRIGATORIO.md
5. CORE_IMUTAVEL.md
6. CORE_VS_MODULOS_CONTRACT.md
7. CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
8. AGENDA_UNIVERSAL_CONTRACT.md
9. Decision_Safety_and_Containment_Contract.md
10. Database_Canonical_Truth_Contract.md

---

## REGRA FINAL

> **No UnifiCard, o sistema não decide, não infere e não improvisa.  
> Ele apenas registra, sugere e executa decisões humanas explícitas.**

