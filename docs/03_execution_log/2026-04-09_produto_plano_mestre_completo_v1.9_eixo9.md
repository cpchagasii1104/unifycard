# Execução — PRODUTO_PLANO_MESTRE_COMPLETO.md v1.9 (EIXO 9, só documentação)

**Data:** 2026-04-09  
**Modo:** AGENT · **âmbito estritamente documental** (sem código, migrations, contracts, CI, nem marcação de fases como concluídas).

## O que foi alterado

1. **`PRODUTO_PLANO_MESTRE_COMPLETO.md`** → versão **1.9**; cabeçalho e resumo executivo actualizados.
2. **Secção «Ordem macro» (v1.8):** novo **§4** — relação com **EIXO 9** (não desloca ordem A–E; não bloqueia **2B**).
3. **Contrato de execução:** texto inicial actualizado para **C.1–C.34**; **EIXO 9** como complemento subordinado a **C.1–C.30** e `docs/01_normative/`.
4. **`C.24`:** excepções passam a referir **C.1–C.34**.
5. **`C.25`:** parágrafo **RISCO / PENDÊNCIA (v1.9)** — CI sobre «inferência fora da camada» **só** com lista fechada (**EXIGE DEFINIÇÃO ADICIONAL**).
6. **`C.17.1`:** itens **5** e **6** (EIXO 9 / contestação) com **PENDÊNCIA** onde o trilho ainda não existir.
7. **Novo `## EIXO 9`** (após **C.30**, antes de **Estado do sistema**): modelo de camadas, sinais vs **C.1**, padrão aprovado qualificado, onboarding controlado, contestação, catálogo universal (honestidade repo), media (**[ ]** decisão humana), **RISCO** legado IA/categorias fora do escopo do eixo.
8. **Novos contratos `C.31`–`C.34`** (sem renumerar **C.1–C.30**).
9. **`C.8`:** linha de auditoria do pedido v1.9.
10. **Tabela de fases (resumo):** linha **EIXO 9** documental **[✓]** / implementação **[ ]**.
11. **Evidências v1.9** + checklist com itens v1.9 e **PENDÊNCIA**/**RISCO**.
12. **`docs/02_decisions/SEMANTIC_CATALOG_GOVERNANCE.md`** — anexo não normativo com remissão ao plano.

## Normativa consultada (bootstrap)

- `docs/01_normative/00_AGENT_PROTOCOL.md` (GATE §2.3.2–2.3.3, separação de camadas).
- `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`, `AUTHORITY_LAW.md` (**Art. 11–14**), `SSOT_REGISTRY_UNIFICARD.md`, `18_DOMAIN_ONTOLOGY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md` — **sem** alterar estes ficheiros.
- **`AUTHORITY_PRECEDENCE.md`:** **não existe** no repo; precedência de travas citada por **`AUTHORITY_LAW.md` Art. 14**.

## Salvaguardas aplicadas na redacção

- **Não** segundo encadeamento transaccional; **não** «empresa → categoria → produto → concept» como substituto de **C.1**.
- **Não** nova fase antes de **2B**; **não** violação de **C.7** / **C.14**.
- Política de imagem global: **apenas** diretriz + **[ ]** decisão humana obrigatória antes de implementação.
- Honestidade: **não** afirmar «IA nunca decide em todo o sistema»; política IA restringida ao **âmbito EIXO 9** + legado mencionado como **fora do escopo imediato**.

## Riscos deixados explicitamente no plano

- **C.25:** definição operacional da «camada de inferência/sugestão» para regex CI — **PENDÊNCIA / RFC**.
- **C.17.1** itens 5–6: **[!]** até existir implementação testável.
- Contestação e media: **trilho implementação** — **fora** deste patch documental.

## Status

**SUCESSO** (documentação apenas).

---

## Actualização pós-revisão (mesmo dia) — anexo `SEMANTIC_CATALOG_GOVERNANCE.md`

**Pedido:** rever o anexo com o mesmo rigor do plano para evitar ambiguidade disfarçada.

**Alterações:**

- Secção **Precedência e conflitos** (hierarquia explícita: normativa + C.1–C.30 > resto do plano > este anexo).
- **Vigilância** explícita sobre o termo **«padrão reutilizável»** em código (não atalho de execução; **C.25** quando houver lista).
- Bloco **C.25 / monitor:** RFC ou lista fechada **antes** de CI de inferência; lembrete para **próxima sessão**.
- **Fronteira legado** (plano coerente ≠ sistema inteiro já alinhado).
- Lista **O que este anexo NÃO faz**.

**Monitor único herdado do v1.9:** **C.25** — sem lista explícita de módulos/rotas → **sem** automação de gate de inferência (**PENDÊNCIA** mantida no plano).

---

## Actualização — `C.25_SPEC.md` (spec separada do plano)

**Objectivo:** cumprir recomendação «plano = execução; spec = definição de linguagem» para o gate de inferência sem poluir o plano mestre.

**Ficheiro criado:** `docs/02_decisions/C.25_SPEC.md` (rascunho com §1–5 em tabelas `[ ]`, precedência, regra **sem lista fechada → CI não opina sobre inferência**, critérios de fecho).

**Ligações acrescentadas:**

- `PRODUTO_PLANO_MESTRE_COMPLETO.md` **C.25** (parágrafo RISCO) → remissão ao spec.  
- **C.34** (linha do anexo) → `C.25_SPEC.md`.  
- `SEMANTIC_CATALOG_GOVERNANCE.md` § C.25 → remissão ao spec.

**Status:** SUCESSO (documentação apenas).

---

## Actualização — `RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`

**Ficheiro:** `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`  
**Conteúdo:** papel do consumidor de sinais; bloco **PROIBIDO** literal; regra **inferência antes / nunca durante** resolução semântica; mapa de chamadas; ligação a `store-onboarding.service.ts`; **teste de desligamento**; encaminhamento para preenchimento de `C.25_SPEC.md`.  
**Ligações:** actualizados `C.25_SPEC.md` (Ligações) e `SEMANTIC_CATALOG_GOVERNANCE.md` (Onde está a regra).

**Status:** SUCESSO (documentação apenas).

---

## Actualização — RFC §4 **Gatilho v1** (manual assistido)

**Alteração:** secção **§4** substituída por **decisão v1**: opção **B — manual assistido** (proposta `pending` + acção explícita «Aplicar» antes de `store-onboarding.service.ts`); **não** automático no `createTenant` em v1; A/C documentadas como evolução condicionada (2B, `C.25_SPEC`, C.17). Cabeçalho do RFC com linha **Gatilho v1**. Checklist §9: item gatilhos **[x]** com nota de assinatura no log.

**Status:** SUCESSO (documentação apenas).

---

## Actualização — RFC §4.1 + §9.1 (anti-padrões + modelo de assinatura)

**Ficheiro:** `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md`  
**Conteúdo:** **§4.1** violações explícitas (auto-apply, pending confundido com activo, código sem log); **§9.1** bloco copiável para `docs/03_execution_log/` com concordância institucional; frase *sugestão por padrão / execução por autorização*.

**Status:** SUCESSO (documentação apenas).

---

## Actualização — prompt BLOCO 2B + esqueleto de log

**Ficheiros:**

- `docs/02_decisions/PROMPT_AGENT_BLOCO_2B_CANONICAL_GLOBAL.md` — prompt enxuto para Agent mode (**C.15**, RFC §2/§4/§4.1, **C.25** sem CI novo de inferência).
- `docs/03_execution_log/2026-04-10_bloco2_global.md` — esqueleto **NÃO INICIADO** + checkpoints.

**RFC:** secção Ligações → prompt 2B.

**Status:** SUCESSO (documentação apenas).
