# Governança semântica de catálogo — anexo operacional (não normativo)

**Status:** complemento documental · **subordinado** a `docs/01_normative/`  
**Não altera** precedência constitucional nem cria norma paralela.

## Precedência e conflitos (ler primeiro)

Em qualquer divergência de leitura entre **este ficheiro**, o **`PRODUTO_PLANO_MESTRE_COMPLETO.md`** e **`docs/01_normative/`**:

1. Prevalem **`docs/01_normative/`** e o **contrato C.1–C.30** do plano mestre (encadeamento transaccional, SSOT semântico/financeiro).
2. Depois o **resto** do plano mestre (incl. **EIXO 9**, **C.31–C.34**).
3. **Este anexo** perde sempre — é índice e reforço anti-ambiguidade, **não** fonte de verdade.

Se uma frase aqui puder ser lida como «atalho de implementação», a leitura **válida** é a do plano (**C.1**, **C.10**, **C.19**, **C.31–C.33**).

## Finalidade

Resumir o âmbito do **EIXO 9** (plan mestre ≥ v1.9) para quem prefere um ficheiro curto. **Não** substitui a leitura do plano nas secções **EIXO 9** e **C.31–C.34**.

## Onde está a regra operacional completa

- `PRODUTO_PLANO_MESTRE_COMPLETO.md` — **«EIXO 9 — Catálogo universal…»** e **C.31–C.34**.  
- `docs/02_decisions/RFC_SEMANTIC_SIGNALS_ONBOARDING_BRIDGE.md` — RFC da ponte (sinais → onboarding governado; inferência **antes**, nunca durante `concept_ref`).

## Princípios (remissão, sem reinterpretação)

1. **Sinais** (empresa, CNAE, categorias de navegação, padrão aprovado) **não** substituem o encadeamento **C.1** para `concept_ref` em checkout/intent/offer (`product → canonical_product → concept`, READY, **adapter**).
2. **Padrão aprovado** = artefacto de **onboarding / navegação / sugestão** reutilizável — **não** SSOT de CONCEPT; **não** substitui `concept_ref`; **não** dispensa adapter (**C.33**).
3. **Vigilância — termo «padrão reutilizável»:** no **plano** está qualificado; na **execução (código)** o termo é perigoso — qualquer atalho que copie padrão para trilho de execução ou persistência semântica viola **C.1** / **C.19**. Enforcement (review + **C.25** quando existir lista fechada) deve ser **explícito**; **não** inferir permissão a partir deste anexo.
4. **Precedência entre travas** (`AUTHORITY_LAW.md` **Art. 14**): não existe `AUTHORITY_PRECEDENCE.md` no repositório com esse nome.
5. **Media** global/canónica: apenas **diretriz** no plano + caixa **[ ]** decisão humana antes de política executável — ver plano **EIXO 9** § Media.

## C.25 — inferência / «camada permitida» (monitor obrigatório)

- No plano, **C.25** contém **RISCO / PENDÊNCIA (v1.9):** bloqueio CI por «inferência fora da camada permitida» **exige lista fechada** de módulos, rotas ou artefactos (**RFC ou decisão humana** antes de automação).
- **Proibição operacional:** não expandir regex ou job CI sobre inferência **sem** essa lista — risco de falso positivo/negativo.
- **Próxima sessão (produto/engineering):** fechar definição; até lá o ponto permanece **aberto** (correctamente marcado no plano). **Excepção estreita (2026-04-10):** existe gate **C.22** (`pnpm run check:canonical-gates` no backend) documentado em `docs/03_execution_log/2026-04-10_c25_ci_gate.md` — **não** cobre inferência §1–3 do spec.
- **Spec dedicada (não é o plano):** `docs/02_decisions/C.25_SPEC.md` — modelo §1–5 (onde pode / onde é proibido / como inferir / como o CI valida / exemplos). **Regra:** sem lista fechada aprovada neste spec → **CI não opina sobre inferência**.

## Fronteira legado (honestidade)

- O **EIXO 9** deixa o **plano** coerente; o **repositório** no seu conjunto pode ainda ter comportamento **fora** desse eixo (ex.: fluxos legados de categoria/IA).
- Harmonização eventual = **roadmap + RFC**, não leitura extensiva deste anexo como «já está tudo alinhado no código».

## O que este anexo explicitamente NÃO faz

- Não define schema, rotas, nem regras de CI.
- Não cria segunda fonte de verdade semântica ou financeira.
- Não flexibiliza **C.1**, **Lei 5**, **Art. 11–14** de `AUTHORITY_LAW.md`, nem GATE em `00_AGENT_PROTOCOL.md`.

## Execução

Alterações de código, migrations e CI **não** fazem parte deste anexo — seguir o plano mestre e `docs/03_execution_log/`.
