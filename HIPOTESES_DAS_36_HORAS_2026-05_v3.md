# HIPÓTESES DAS 36 HORAS — JANELA 01/05 → 03/05/2026

**Versão:** 2.0 (2026-05-04)
**Compilado por:** Claude (Auditor) com base em material da pasta `unificard_03_05_arquivado/`
**Validado por:** ChatGPT (Crítico)
**Síntese estratégica:** Clayton (Orquestrador)
**Estado do sistema na geração:** HEAD `4c395634` em `rescue-structural`, 1 erro TS (narrowing)

---

## 📌 PROPÓSITO DESTE DOCUMENTO

Durante as 36 horas entre 01/05 e 03/05/2026, a Claude Code operou no projeto e produziu material que resultou em 1209 erros TypeScript, levando à operação de rescue para o backup de 01/05.

Este documento **não é** um inventário de código a recuperar. É um **pipeline de decisões arquiteturais vivas** — algumas certas, outras erradas, todas reveladoras.

### Princípio operacional

> **Não reaproveitamos código quebrado. Reaproveitamos a visão estratégica que motivou as mudanças.
> Cada alteração é uma hipótese a ser testada, não uma solução a ser copiada.**

### Intenção da Claude Code (síntese)

> Ela estava tentando organizar o sistema de forma mais rígida e coerente, criando uma "camada canônica" para cada conceito (atores, transações, estados). Os novos arquivos e documentos serviriam como base de regras explícitas que o código deveria seguir. A intenção era um sistema mais blindado e consistente — eliminar duplicidade, alinhar semântica, aplicar leis explícitas. O problema foi a execução: mexer em tudo simultaneamente sem validar passo a passo, gerando 1209 erros em cascata.

⚠️ **A intenção estava certa. A execução foi desastrosa.**

### Como usar este documento

```
abrir doc
  → escolher 1 hipótese
    → ler critério de validação
      → executar próxima ação sugerida
        → validar resultado
          → marcar EXECUTADA + registrar evidência
            → próxima
```

**Regra inviolável:** uma hipótese por sessão. Não atacar mais. Esse é o erro que custou as 36 horas.

---

## 🗂️ ÍNDICE DE HIPÓTESES MACRO

| # | Hipótese | Categoria | Status | Impacto | Critério de validação resumido |
|---|---|---|---|---|---|
| 001 | Ontologia em 17 documentos numerados | Documental | REJEITADA | Médio | N/A (rejeitada) |
| 002 | Mutation como camada explícita | Arquitetural | EM AVALIAÇÃO | Médio | Decisão estratégica registrada |
| 003 | Fix C4 bank-balance-by-region | Técnica | ACEITA | Baixo | `pnpm build` = 0 erros + gate sem violação C4 |
| 004 | Desabilitar fund.module.ts | Estratégica | EM AVALIAÇÃO | Alto | Mapeamento de dependências feito |
| 005 | testOverrideUsers como exceção | Operacional | EM AVALIAÇÃO | Alto | Decisão estratégica + gate anti-deploy |
| 006 | Princípio "impossível errar" como Lei 7 | Filosófica | EM AVALIAÇÃO | Baixo | Texto aprovado + DECISION registrada |
| 007 | EventOrganizerResolver | Arquitetural | EM AVALIAÇÃO | Médio | Análise de uso + decisão de centralização |
| 008 | Realinhamento de tipos rides/work | Técnica | EM AVALIAÇÃO | Alto | Tipos = schema real + Zod alinhado |
| 009 | Fix gate (5 lacunas) | Técnica | ACEITA | Baixo | Gate roda sem erros + baseline validado |
| 010 | Hygiene allowlist C3 → permanente | Política | ACEITA | Baixo | Allowlist sem warning de C3 |
| 011 | Hygiene allowlist C8 → resolvida | Política | ACEITA | Baixo | Allowlist sem entrada C8 |
| 012 | DECISION-0019 (consolidação) | Documental | ACEITA | Baixo | Docs commitados |
| 013 | DECISION-0020 (drift monetário) | Documental | ACEITA com adaptação | Médio | Doc commitado com nota de contexto |
| 014 | Constraints como blindagem real | Arquitetural | EM AVALIAÇÃO | Alto | Plano por constraint + 1 implementada |
| 015 | Schema drift (5+4 tabelas divergentes) | Técnica | EM AVALIAÇÃO | Alto | Cada tabela com decisão registrada |
| 016 | 21 migrations criadas durante 36h | Técnica | EM AVALIAÇÃO | Alto | Cada migration validada (apêndice) |
| 017 | ~27 arquivos .ts criados/editados | Técnica | EM AVALIAÇÃO | Alto | Cada arquivo validado (apêndice) |
| 018 | ~10 documentos reescritos (.bak) | Documental | EM AVALIAÇÃO | Médio | Cada doc avaliado (apêndice) |

**Legenda de status:**
- **ACEITA** → decisão de aceitar registrada, ainda não aplicada no código
- **EXECUTADA** → aplicada e validada no código (com commit + build OK)
- **REJEITADA** → avaliada e descartada com motivo registrado
- **EM AVALIAÇÃO** → requer dados ou decisão estratégica antes de prosseguir
- **DEPENDENTE** → aguarda outra hipótese ser resolvida primeiro

**Legenda de impacto se errada:**
- **Baixo** → errar custa minutos, fácil reverter
- **Médio** → errar custa horas, requer rollback estruturado
- **Alto** → errar custa dias, pode introduzir drift sistêmico

---

## 📋 TEMPLATE DE HIPÓTESE

```markdown
## Hipótese #NNN — [Nome curto]

**Origem:** [arquivo/commit/patch específico]
**Categoria:** [Documental | Técnica | Arquitetural | Estratégica | Operacional | Política | Filosófica]
**Impacto sistêmico se estiver errada:** [Baixo | Médio | Alto]

### O que foi proposto
[descrição factual sem julgamento]

### Propósito inferido (leitura caridosa)
[por que ela tentou fazer isso]

### Avaliação de cabimento
- Conflita com norma existente? [sim/não/parcial — citar norma]
- Resolve problema real? [sim/não/parcial]
- Risco de regressão? [baixo/médio/alto]
- Custo de implementação correta? [horas/dias/sessões]

### Critério de validação
[o que precisa acontecer no sistema para considerar validado — mensurável]
Exemplos:
- "pnpm build = 0 erros TS"
- "gate validate-schema-code-coherence sem violação C4"
- "query retorna lista correta de fundos regionais"

### Decisão atual
[ACEITA | EXECUTADA | REJEITADA | EM AVALIAÇÃO | DEPENDENTE]

### Motivo da decisão
[fundamentação registrada]

### Próxima ação sugerida
[passo concreto se alguém abrir essa hipótese agora]
Exemplo:
- "Rodar: pnpm build + node scripts/validate-schema-code-coherence.mjs"
- "Comparar resultado com baseline"
- "Se passar → executar cherry-pick"
- "Se falhar → investigar divergência"

### Evidência de execução (preencher após executar)
- Status: [vazio ou EXECUTADA em sessão YYYY-MM-DD]
- Commit aplicado: [hash]
- Build pós-execução: [N erros TS]
- Gate pós-execução: [PASS/FAIL]
- Validação completa: [PASS/FAIL com link para evidência]
- Notas: [observações da execução]

### Como proceder a partir daqui
- **Se ACEITA**: passos cirúrgicos para reintroduzir
- **Se REJEITADA**: critério futuro para revisitar (se aplicável)
- **Se EM AVALIAÇÃO**: dados/contexto faltantes para decidir
- **Se DEPENDENTE**: qual hipótese precisa ser resolvida primeiro
- **Se EXECUTADA**: próxima hipótese da fila
```

---

## 🔍 HIPÓTESES MACRO DETALHADAS

---

### Hipótese #001 — Ontologia em 17 documentos numerados

**Origem:** `docs/01_normative/01_SSOT.md` até `docs/01_normative/17_EFFECTS_CANONICA.md`
**Categoria:** Documental
**Impacto sistêmico se estiver errada:** Médio

#### O que foi proposto

Criação de 17 documentos canônicos numerados em ordem ontológica, cobrindo SSOT, Actors, Identity, Categories, Contratos, Governança, Nomenclatura, Autoridade, States, Events, Transactions, Mutations, Permissions, Policies, Action Context, Actions, Effects.

#### Propósito inferido

Formalizar a ontologia do sistema em camadas ordenadas, refletindo a Lei de Coerência. Criar "camada canônica" explícita para cada conceito.

#### Avaliação de cabimento

- **Conflita com norma existente?** SIM. Cria dupla autoridade com `CONSTITUICAO_UNIFICARD.md`, `LEIS_OPERACIONAIS_UNIFICARD.md`, `SSOT_REGISTRY_UNIFICARD.md`, `07_NOMENCLATURA_CANONICA.md`.
- **Resolve problema real?** Não como criação paralela. Conteúdo individual pode ter valor.
- **Risco de regressão?** Alto se adotado. Quebra Lei §1.
- **Custo de implementação correta?** N/A — estrutura inviável.

#### Critério de validação

N/A — hipótese rejeitada na forma proposta. Sub-hipóteses individuais podem ter critérios próprios (ver apêndice #001.NN).

#### Decisão atual

**REJEITADA** (forma macro)

#### Motivo da decisão

Adicionar 17 documentos paralelos cria conflito de autoridade. Conteúdo individual deve ser **avaliado em sub-hipóteses** e integrado aos normativos existentes — não substituí-los.

#### Próxima ação sugerida

Não trazer os 17 documentos. Para conceitos específicos com potencial valor (ex: Mutations, Action Context), abrir sessão dedicada para avaliar sub-hipóteses (#001.12, #001.15) e decidir integração aos normativos atuais.

#### Como proceder a partir daqui

- **Critério para reabrir como macro:** se análise individual de 3+ sub-hipóteses revelar lacunas reais nos normativos atuais, reabrir como discussão sobre estrutura de normativos
- **Sub-hipóteses individuais:** ver apêndice (#001.01 a #001.17)

---

### Hipótese #002 — Conceito de Mutation como camada explícita

**Origem:** `docs/01_normative/12_MUTATIONS_CANONICA.md`
**Categoria:** Arquitetural
**Impacto sistêmico se estiver errada:** Médio

#### O que foi proposto

Separar formalmente quatro conceitos:
```
Evento(s) → Transação → Mutação → Novo Estado
```

Mutação = ato explícito de mudar estado, vinculado a transação válida, auditável.

#### Propósito inferido

Eliminar mudanças implícitas, side-effects silenciosos, lógica de "atualização espalhada".

#### Avaliação de cabimento

- **Conflita com norma existente?** Parcial. Modelo atual trata Event/Transaction sem Mutation como conceito de primeira classe.
- **Resolve problema real?** Possivelmente.
- **Risco de regressão?** Médio.
- **Custo de implementação correta?** Sessão dedicada.

#### Critério de validação

- Casos de "mutação implícita" identificados no código atual
- Decisão de Clayton + ChatGPT sobre adoção
- Se adotado: integração ao normativo existente sem criar paralelo

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Filosoficamente forte. Decisão estratégica de Clayton, não decreto de IA.

#### Próxima ação sugerida

Sessão dedicada com Clayton + ChatGPT para responder:
1. Há casos de "mutação implícita" no código atual? (rodar grep por padrões de UPDATE direto fora de repository)
2. Modelo Event/Transaction atual sofre de ambiguidade?
3. Adicionar Mutation gera valor ou apenas ontologia adicional?

Se aprovado: enriquecer `LEI_DE_COERENCIA_SISTEMICA` (não criar documento paralelo).

#### Evidência de execução

[vazio]

---

### Hipótese #003 — Fix C4 bank-balance-by-region

**Origem:** Commit `7033c77e` + arquivo `_patch_c4.patch`
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

Substituir referência a coluna `metadata` (inexistente) por `account_type` + `owner_id LIKE` em `bank-balance-by-region.service.ts`.

#### Propósito inferido

Coluna `metadata` não existe em `bank_accounts`. Correção alinha código com schema real.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não.
- **Resolve problema real?** SIM. Bug confirmado.
- **Risco de regressão?** Baixo.
- **Custo de implementação correta?** 5 minutos.

#### Critério de validação

- `pnpm build` = 0 erros TS após cherry-pick
- Gate `validate-schema-code-coherence` sem violação C4
- Query `bank-balance-by-region` retorna dados (testar se houver dados de teste)

#### Decisão atual

**ACEITA**

#### Motivo da decisão

Drift confirmado. Correção cirúrgica. Validada por auditoria multi-IA.

#### Próxima ação sugerida

```powershell
cd C:\unificard
git remote add arquivado-03-05 C:\unificard_03_05_arquivado
git fetch arquivado-03-05
git cherry-pick 7033c77e
cd backend && pnpm build
# Validar: 0 erros TS
node ../scripts/validate-schema-code-coherence.mjs
# Validar: sem violação C4
```

#### Evidência de execução

[vazio]

#### Como proceder a partir daqui

Após executar: marcar EXECUTADA, preencher evidência, ir para Hipótese #009 (próxima na Fase 1).

---

### Hipótese #004 — Desabilitar fund.module.ts

**Origem:** `backend/src/core/economy/fund/fund.module.ts` reescrito como módulo desabilitado
**Categoria:** Estratégica
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

Reescrever `fund.module.ts` para não registrar nenhuma rota, com comentário "LEGACY MODULE DISABLED".

#### Propósito inferido

Eliminar realidade paralela ao SSOT financeiro `bank_*`. Aplicar Lei §SSOT Financeiro.

#### Avaliação de cabimento

- **Conflita com norma existente?** Alinhado com Lei §SSOT, conflita com código que importa de `fund/`.
- **Resolve problema real?** Possivelmente, mas execução proposta é destrutiva.
- **Risco de regressão?** ALTO. Várias rotas importam de `fund/`.
- **Custo de implementação correta?** Dias. Migração planejada.

#### Critério de validação

- Mapeamento completo de quem usa `fund/`
- Plano de migração documentado
- Após desabilitar: `pnpm build` = 0 erros + endpoints que dependiam de `fund/` operacionais via `bank_*`

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Direção arquitetural correta, execução proposta é destrutiva.

#### Próxima ação sugerida

Sessão dedicada de mapeamento:
```powershell
# Mapear consumidores de fund/
grep -r "from.*fund" backend/src/ --include="*.ts" | grep -v "node_modules"
grep -r "core/economy/fund" backend/src/ --include="*.ts"
```

Decidir caso a caso:
- Migrar para `bank_*`?
- Deletar consumidor?
- Manter como projeção read-only?

NÃO desabilitar `fund.module.ts` antes da migração completa.

#### Evidência de execução

[vazio]

---

### Hipótese #005 — testOverrideUsers como exceção institucional

**Origem:** `backend/src/config/testOverrideUsers.ts`
**Categoria:** Operacional
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

Mecanismo de "override" para usuários de teste com acesso total via lista de UUIDs.

#### Propósito inferido

Permitir testes sem passar por todos os fluxos de autorização.

#### Avaliação de cabimento

- **Conflita com norma existente?** SIM. Lei §SSOT Identity. Caminho paralelo de autoridade.
- **Resolve problema real?** Sim, mas é gambiarra.
- **Risco de regressão?** ALTO. Em produção: vazamento, escalada, fraude.
- **Custo de implementação correta?** Sistema de testes adequado — sessões dedicadas.

#### Critério de validação

- Decisão estratégica registrada (aceitar ou rejeitar)
- Se aceito: gate CI bloqueando deploy com lista populada em produção
- Se rejeitado: plano de sistema de testes adequado

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Mecanismo perigoso, mas captura necessidade real.

#### Próxima ação sugerida

Sessão estratégica: aceitar exceção com salvaguardas vs investir em sistema de testes adequado.

NÃO trazer este arquivo até decisão.

#### Evidência de execução

[vazio]

---

### Hipótese #006 — Princípio "impossível errar" como Lei 7

**Origem:** `auditoria-claude-code.txt`
**Categoria:** Filosófica
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

Formalizar Lei 7: "Sistema deve impedir erro, não apenas proibir. Sistema paranoico, não inteligente."

#### Propósito inferido

Capturar diferença entre "documentado" e "blindado".

#### Avaliação de cabimento

- **Conflita com norma existente?** Não. Complementa Lei §1.
- **Resolve problema real?** Sim.
- **Risco de regressão?** Baixo.
- **Custo de implementação correta?** Texto + DECISION.

#### Critério de validação

- Texto aprovado por Clayton + ChatGPT
- DECISION registrada
- Plano de constraints associado (Lei sem enforcement = armadilha)

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Princípio sólido. Decisão de formalização é prerrogativa de Clayton.

#### Próxima ação sugerida

Sessão de redação multi-IA com Clayton. Lei 7 só faz sentido com plano de constraints (ver Hipótese #014).

#### Evidência de execução

[vazio]

---

### Hipótese #007 — EventOrganizerResolver

**Origem:** `backend/src/core/checkout/EventOrganizerResolver.ts`
**Categoria:** Arquitetural
**Impacto sistêmico se estiver errada:** Médio

#### O que foi proposto

Resolver dedicado para conta financeira do organizador de evento (prioridade company > user, criação automática se não existir).

#### Propósito inferido

Centralizar lógica de "quem recebe pagamento de evento".

#### Avaliação de cabimento

- **Conflita com norma existente?** Parcial. Criação automática pode violar princípio "actor explícito".
- **Resolve problema real?** Possivelmente.
- **Risco de regressão?** Médio.
- **Custo de implementação correta?** Análise + redesenho.

#### Critério de validação

- Mapeamento de lógica dispersa de "conta do organizador"
- Decisão sobre criação proativa vs por demanda
- Se aceito: implementação alinhada com Lei §Identity

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Direção certa, execução discutível.

#### Próxima ação sugerida

```powershell
grep -rn "createdBy.*event\|event.*organizer" backend/src/ --include="*.ts"
```

Listar lugares que precisam dessa resolução. Decidir centralização.

#### Evidência de execução

[vazio]

---

### Hipótese #008 — Realinhamento de tipos rides/work

**Origem:** `backend/src/modules/rides/rides.types.ts`, `backend/src/modules/work/work.types.ts`
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

Reescrita de tipos com enums e estruturação de rows do banco.

#### Propósito inferido

Alinhar tipos com schema real, eliminar drift.

#### Avaliação de cabimento

- **Conflita com norma existente?** Pode conflitar com schemas Zod.
- **Resolve problema real?** Possivelmente. Drift é DECISION-0020.
- **Risco de regressão?** ALTO. Tipos são contrato.
- **Custo de implementação correta?** Sessão dedicada por módulo.

#### Critério de validação

- Tipos = schema real do banco
- Schemas Zod alinhados
- `pnpm build` = 0 erros após cada arquivo

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Direção certa, execução perigosa. Provável fonte significativa dos 1209 erros.

#### Próxima ação sugerida

NÃO trazer arquivos como vieram. Para cada módulo (rides primeiro, work depois):
1. Comparar tipo proposto com schema real do banco (`information_schema.columns`)
2. Comparar com schemas Zod existentes em routes
3. Aplicar mudança por endpoint, não global

#### Evidência de execução

[vazio]

---

### Hipótese #009 — Fix gate (5 lacunas em validate-schema-code-coherence)

**Origem:** Commit `14f77c3a`
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

Correções em `scripts/validate-schema-code-coherence.mjs` corrigindo 5 lacunas estruturais (DECISION-0018). 5 arquivos, 207 inserções, 5 deleções.

#### Propósito inferido

Eliminar falsos positivos/negativos do gate. Pré-requisito para confiar em hygiene da allowlist.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não.
- **Resolve problema real?** SIM.
- **Risco de regressão?** Baixo (script de gate, não código de produção).
- **Custo de implementação correta?** 10 minutos.

#### Critério de validação

- `pnpm build` = 0 erros TS após cherry-pick
- Gate roda sem TypeError/ReferenceError/SyntaxError
- `[ALLOWLIST_WARNINGS]` aparece no output do gate
- Mensagem de expired inclui `[type]`
- Comparação com `scripts/gate-baseline-v2.json` confere

#### Decisão atual

**ACEITA**

#### Motivo da decisão

Gate confiável é pré-requisito para hipóteses #010-011.

#### Próxima ação sugerida

```powershell
cd C:\unificard
git cherry-pick 14f77c3a
cd backend && pnpm build
# Validar: 0 erros TS
cd ..
node scripts/validate-schema-code-coherence.mjs
# Validar: sem TypeError, com [ALLOWLIST_WARNINGS], com [type] em expired
```

Após executar: aplicar Hipótese #010 (depende dela).

#### Evidência de execução

[vazio]

---

### Hipótese #010 — Hygiene allowlist C3 → permanente

**Origem:** Commit `2ac76130`
**Categoria:** Política
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

C3 vira regra permanente (deadline 2099-12-31). Razão: Ports & Adapters via socialPortsRegistry. Cria `DT-C3-actor-repository-excecao-estrutural.md`.

#### Propósito inferido

C3 é exceção arquitetural legítima, não débito. Reconhecer formalmente evita re-discutir.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não.
- **Resolve problema real?** SIM.
- **Risco de regressão?** Baixo.
- **Custo de implementação correta?** 5 minutos.

#### Critério de validação

- Allowlist tem entrada C3 com deadline 2099-12-31
- Gate não acusa C3 como warning expirado
- DT-C3 documento existe em `docs/decisions/`

#### Decisão atual

**ACEITA**

#### Motivo da decisão

Decisão arquitetural correta. Cherry-pick limpo.

#### Próxima ação sugerida

```powershell
cd C:\unificard
git cherry-pick 2ac76130
node scripts/validate-schema-code-coherence.mjs
# Validar: C3 sem warning de expired
cat scripts/schema-coherence-allowlist.json | grep -A 3 '"C3"'
# Validar: deadline = 2099-12-31
```

Após executar: aplicar Hipótese #011.

#### Evidência de execução

[vazio]

---

### Hipótese #011 — Hygiene allowlist C8 → resolvida

**Origem:** Commit `c40f4d88`
**Categoria:** Política
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

Remover C8 da allowlist (resolvida — código é coerente com schema real). Registra DT-C3 e DT-C4.

#### Propósito inferido

C8 não era violação real. Limpar allowlist.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não.
- **Resolve problema real?** Sim.
- **Risco de regressão?** Baixo.
- **Custo de implementação correta?** 5 minutos.

#### Critério de validação

- Allowlist sem entrada C8
- Gate roda sem violação C8
- DT-C4 existe em `docs/decisions/`

#### Decisão atual

**ACEITA**

#### Motivo da decisão

Validada por inspeção de schema real.

#### Próxima ação sugerida

```powershell
cd C:\unificard
git cherry-pick c40f4d88
node scripts/validate-schema-code-coherence.mjs
# Validar: sem entrada C8 na allowlist
```

Após executar: aplicar Hipótese #012.

#### Evidência de execução

[vazio]

---

### Hipótese #012 — DECISION-0019 (consolidação hygiene)

**Origem:** Commit `9e645967`
**Categoria:** Documental
**Impacto sistêmico se estiver errada:** Baixo

#### O que foi proposto

Documentação atualizada do status pós-DECISION-0018.

#### Propósito inferido

Manter `STATUS_EXECUCAO_GLOBAL.md` e `REMEDIATION_DECISIONS_LOG.md` atualizados.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não.
- **Resolve problema real?** Sim — preserva memória institucional.
- **Risco de regressão?** Baixo (apenas docs).
- **Custo de implementação correta?** 2 minutos.

#### Critério de validação

- `STATUS_EXECUCAO_GLOBAL.md` reflete fechamento de DECISION-0018
- `REMEDIATION_DECISIONS_LOG.md` tem entrada DECISION-0019

#### Decisão atual

**ACEITA**

#### Motivo da decisão

Documentação histórica. Cherry-pick após #009-011.

#### Próxima ação sugerida

```powershell
cd C:\unificard
git cherry-pick 9e645967
```

Após executar: aplicar Hipótese #003 ou #013.

#### Evidência de execução

[vazio]

---

### Hipótese #013 — DECISION-0020 (drift monetário)

**Origem:** Commit `89f1d87d`
**Categoria:** Documental
**Impacto sistêmico se estiver errada:** Médio

#### O que foi proposto

Registrar DECISION-0020:
- C65 (drift monetário amount/amountCents)
- DT-tsc reaberto (1489 erros TS originalmente)
- Princípio "Antes do primeiro usuário, toda concessão a legado é suspeita"

#### Propósito inferido

Capturar conhecimento sobre drift. Reabrir DT fechado erroneamente.

#### Avaliação de cabimento

- **Conflita com norma existente?** Parcial. Documenta drift que continua existindo no estado de 01/05.
- **Resolve problema real?** Sim.
- **Risco de regressão?** Baixo (docs).
- **Custo de implementação correta?** Cherry-pick + adaptação.

#### Critério de validação

- DECISION-0020 registrada em `REMEDIATION_DECISIONS_LOG.md`
- Nota de contexto pós-rescue adicionada (estado atual = 1 erro, não 1489)
- Princípio operacional documentado

#### Decisão atual

**ACEITA com adaptação**

#### Motivo da decisão

Documento valioso, mas precisa adaptação. "1489 erros TS" não corresponde ao estado atual.

#### Próxima ação sugerida

**Recomendado: Opção B (reescrever)**

Em vez de cherry-pick + amend, reescrever DECISION-0020 v2:
1. Drift monetário documentado (igual)
2. Aprendizado da operação de rescue de 04/05
3. Estado real atual

```powershell
# Não fazer cherry-pick direto
# Em vez disso, criar DECISION-0020-v2 manualmente em REMEDIATION_DECISIONS_LOG.md
# Usar conteúdo do commit 89f1d87d como referência (git show 89f1d87d)
```

#### Evidência de execução

[vazio]

---

### Hipótese #014 — Constraints como blindagem real (enforcement formal)

**Origem:** `auditoria-claude-code.txt` + migrations criadas
**Categoria:** Arquitetural
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

Transformar regras-convenção em constraints executáveis no banco:

| Regra atual | Forma blindada |
|---|---|
| Ledger append-only | `REVOKE UPDATE, DELETE ON bank_ledger FROM application_user` |
| amount_cents BIGINT | `CHECK (amount_cents = ROUND(amount_cents))` + lint rule |
| Actor obrigatório | Trigger no banco |
| Bank é SSOT | `REVOKE INSERT/UPDATE` em tabelas financeiras fora de `modules/bank/` |

#### Propósito inferido

Implementar Lei §1 com mecanismos de banco e CI.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não. Implementa princípios já vigentes.
- **Resolve problema real?** SIM.
- **Risco de regressão?** Alto se mal implementado.
- **Custo de implementação correta?** Sessões dedicadas, uma constraint por vez.

#### Critério de validação

Por constraint:
- Dry-run em DEV: query que tentaria violar é rejeitada
- Teste destrutivo: sistema quebra se alguém tentar burlar
- Aplicação em produção sem regressão de feature legítima

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Direção arquitetural mais importante das 36h. Requer planejamento. Cada constraint vira DECISION + sessão.

#### Próxima ação sugerida

Sessão estratégica para definir prioridade:
1. Listar todas as regras-convenção atuais
2. Para cada uma: avaliar se vale virar constraint
3. Priorizar por risco financeiro (ledger primeiro)
4. Sessão de implementação por constraint

**Esta é provavelmente a hipótese mais importante de todas.**

#### Evidência de execução

[vazio]

---

### Hipótese #015 — Schema drift (5+4 tabelas divergentes)

**Origem:** `auditoria-claude-code.txt`
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

Investigar drift entre migrations (216 tabelas) e banco real (215 tabelas).

**Só em migrations (5):** `_migration_category_merge`, `catalog_products`, `product_concept_resolution_queue`, `product_concepts`, `tenant_products`

**Só no banco (4):** `_deprecated_product_concept_resolution_queue`, `_deprecated_tenant_products`, `schema_migrations`, `system_coverage`

#### Propósito inferido

Garantir que migrations recriam fielmente o runtime.

#### Avaliação de cabimento

- **Conflita com norma existente?** Não. Problema confirmado.
- **Resolve problema real?** SIM.
- **Risco de regressão?** Alto.
- **Custo de implementação correta?** Sessão por tabela.

#### Critério de validação

Por tabela divergente:
- Decisão registrada (criar migration retroativa, drop, ou `_deprecated_`)
- Aplicação em DEV
- Banco e migrations convergentes

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Cada tabela é decisão individual.

#### Próxima ação sugerida

Sessão dedicada por tabela. Para cada caso (ver sub-hipóteses #015.NN no apêndice):
- Migration foi aplicada?
- Tabela foi dropada manualmente?
- Código ainda referencia?
- Decisão: migration retroativa, drop, ou `_deprecated_`?

NÃO fazer em batch.

#### Evidência de execução

[vazio]

---

### Hipótese #016 — 21 migrations criadas durante 36h

**Origem:** `backend/migrations/2026051*.sql` a `2026053*.sql` (21 arquivos)
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

21 migrations forward-only criadas no contexto de DECISION-0019 e relacionadas. Status no estado atual de `C:\unificard\`: já existem (vieram de 01/05).

#### Propósito inferido

Estruturar tabelas de event handler failures, governança econômica, eventos canônicos de produtos, autoridade de roots, etc.

#### Avaliação de cabimento

- **Conflita com norma existente?** Avaliar caso a caso.
- **Resolve problema real?** Caso a caso.
- **Risco de regressão?** Alto se aplicadas sem análise.
- **Custo de implementação correta?** Análise por migration.

#### Critério de validação

Por migration:
- Schema real do banco corresponde ao esperado pela migration
- Código que depende existe e funciona
- Gate `validate-schema-code-coherence` sem novas violações

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

21 migrations é trabalho real, mas precisa validação individual.

#### Próxima ação sugerida

Sub-hipóteses individuais (#016.01 a #016.21 no apêndice). Expandir conforme necessidade.

Primeiro passo: confirmar quais migrations já foram aplicadas no banco vs apenas criadas como arquivo.

```powershell
psql -U postgres -d unificard_dev -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 30;"
```

#### Evidência de execução

[vazio]

---

### Hipótese #017 — ~27 arquivos .ts criados/editados durante 36h

**Origem:** `backend/src/**/*.ts` modificados em `unificard_03_05_arquivado/`
**Categoria:** Técnica
**Impacto sistêmico se estiver errada:** Alto

#### O que foi proposto

27 arquivos TypeScript criados ou modificados. Alguns são macro-hipóteses (#004, #005, #007, #008), outros são individuais.

#### Propósito inferido

Implementar a "camada canônica" através de novos services, resolvers, types e helpers.

#### Avaliação de cabimento

- **Conflita com norma existente?** Avaliar caso a caso.
- **Resolve problema real?** Caso a caso.
- **Risco de regressão?** Alto.
- **Custo de implementação correta?** Sessão por arquivo crítico.

#### Critério de validação

Por arquivo:
- Tipos coerentes com schema do banco
- Imports não quebram
- `pnpm build` = 0 erros
- Lógica não duplica funcionalidade existente

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Arquivos individuais com propósitos distintos. Maioria provavelmente é fonte significativa dos 1209 erros.

#### Próxima ação sugerida

Sub-hipóteses individuais (#017.01 a #017.27 no apêndice). Expandir conforme necessidade.

Priorizar arquivos que já são macro-hipóteses (#004 fund, #005 testOverride, #007 EventOrganizer, #008 types).

#### Evidência de execução

[vazio]

---

### Hipótese #018 — ~10 documentos reescritos (.bak)

**Origem:** `docs/01_normative/*.md.bak` files
**Categoria:** Documental
**Impacto sistêmico se estiver errada:** Médio

#### O que foi proposto

Reescrita de documentos normativos com versão original preservada como `.bak`:
- `CONTRACTS.md.bak`
- `AGENDA_UNIVERSAL_CONTRACT.md.bak`
- `CORE_TEMPORAL_CONTRACT.md.bak`
- (e outros 7)

#### Propósito inferido

Aplicar nova "camada canônica" aos contratos existentes.

#### Avaliação de cabimento

- **Conflita com norma existente?** Sim, por definição (reescreveu).
- **Resolve problema real?** Avaliar caso a caso.
- **Risco de regressão?** Médio (docs orientam código).
- **Custo de implementação correta?** Análise por documento.

#### Critério de validação

Por documento:
- Mudanças identificadas (diff entre versão original e reescrita)
- Decisão sobre cada mudança (manter, rejeitar, integrar)

#### Decisão atual

**EM AVALIAÇÃO**

#### Motivo da decisão

Reescritas de normativos exigem auditoria — documentos guiam código.

#### Próxima ação sugerida

Sub-hipóteses individuais (#018.01 a #018.10 no apêndice). Para cada:
```powershell
diff docs/01_normative/CONTRACTS.md.bak \
     C:\unificard_03_05_arquivado\docs\01_normative\CONTRACTS.md
```

Decidir mudança a mudança.

#### Evidência de execução

[vazio]

---

## 📂 APÊNDICE — SUB-HIPÓTESES PENDENTES DE EXPANSÃO

⚠️ **Estas sub-hipóteses são placeholders.** Expandir para detalhe completo APENAS quando:
1. A macro hipótese estiver EM AVALIAÇÃO ou ACEITA
2. A sessão atual decidir trabalhar nessa sub-hipótese específica
3. Antes de qualquer execução técnica relacionada

### Sub-hipóteses #001 (Ontologia em 17 documentos)

```
#001.01 — 01_SSOT.md (princípio fundamental SSOT)
#001.02 — 02_ACTORS_SSOT.md (ontologia de Actors)
#001.03 — 03_IDENTITY_CANONICA.md
#001.04 — 04_CATEGORIES_SSOT.md
#001.05 — 05_CONTRATOS_CANONICOS.md
#001.06 — 06_GOVERNANCA_CANONICA.md
#001.07 — 07_NOMENCLATURA_CANONICA.md (já existe versão grande nos normativos)
#001.08 — 08_AUTORIDADE_CANONICA.md
#001.09 — 09_STATES_CANONICA.md
#001.10 — 10_EVENTS_CANONICA.md
#001.11 — 11_TRANSACTIONS_CANONICA.md
#001.12 — 12_MUTATIONS_CANONICA.md (também é macro #002)
#001.13 — 13_PERMISSIONS_CANONICA.md
#001.14 — 14_POLICIES_CANONICA.md
#001.15 — 15_ACTION_CONTEXT_CANONICA.md
#001.16 — 16_ACTIONS_CANONICA.md
#001.17 — 17_EFFECTS_CANONICA.md
```

**Critério para expandir uma:** quando ChatGPT + Clayton decidirem que conceito específico merece análise.

---

### Sub-hipóteses #015 (Schema drift)

```
#015.01 — _migration_category_merge (só em migrations)
#015.02 — catalog_products (só em migrations)
#015.03 — product_concept_resolution_queue (só em migrations)
#015.04 — product_concepts (só em migrations)
#015.05 — tenant_products (só em migrations)
#015.06 — _deprecated_product_concept_resolution_queue (só no banco)
#015.07 — _deprecated_tenant_products (só no banco)
#015.08 — schema_migrations (só no banco — provavelmente normal)
#015.09 — system_coverage (só no banco)
```

**Critério para expandir uma:** ao iniciar sessão dedicada para resolver uma tabela específica.

**Investigação por tabela:**
```sql
-- A tabela existe no banco?
SELECT * FROM information_schema.tables WHERE table_name = 'NOME';

-- O código referencia?
-- Em PowerShell:
-- grep -r "NOME" backend/src/ --include="*.ts"
```

---

### Sub-hipóteses #016 (21 migrations criadas)

```
#016.01 — 20260511120000_event_handler_failures.sql
#016.02 — 20260512100000_infra4_order_sagas_expand_ledger_compensations.sql
#016.03 — 20260513100000_economic_guardianship_limit_amount_cents.sql
#016.04 — 20260514100000_authority_roots.sql
#016.05 — 20260515100000_economic_guardianship_scope_check.sql
#016.06 — 20260518120000_bloco3_data_repair_n1_roots_and_e2e_cleanup.sql
#016.07 — 20260518121000_bloco3_scaffold_global_for_e2e_categories.sql
#016.08 — 20260519100000_canonical_product_events.sql
#016.09 — 20260519110000_canonical_product_events_triggers.sql
#016.10 — 20260519120000_canonical_product_events_backfill.sql
#016.11 — 20260519130000_visibility_indexes.sql
#016.12 — 20260520100000_canonical_products_governance_fields.sql
#016.13 — 20260522100000_canonical_products_version_increment.sql
#016.14 — 20260523100000_rides_vehicles_concept_id_nullable.sql
#016.15 — 20260524100000_concepts_mobilidade_seed.sql
#016.16 — 20260525100000_events_domain_and_financial_execution.sql
#016.17 — 20260526100000_draft_ms1_identities_timestamptz.sql
#016.18 — 20260526101000_draft_ms2_tenant_products_price_cents_append_only.sql
#016.19 — 20260527120000_unifycard_transactions_non_ssot_comment.sql
#016.20 — 20260528120000_unifycard_transactions_class_log_comment.sql
#016.21 — 20260529120000_actors_is_identity_required.sql
```

**Critério para expandir uma:** ao iniciar sessão para validar/aplicar/reverter migration específica.

**Validação por migration:**
```sql
-- Verificar se já foi aplicada
SELECT * FROM schema_migrations WHERE version = '20260511120000';

-- Inspecionar conteúdo
-- Ver migrations/NOME.sql

-- Verificar dependências
-- grep -r "tabela_da_migration" backend/src/
```

---

### Sub-hipóteses #017 (~27 arquivos .ts criados/editados)

```
ARQUIVOS DE TESTE/DEBUG (provavelmente lixo)
#017.01 — TESTE_ENTRYPOINT.ts (debug)
#017.02 — server-TESTE2.ts (debug)

CONFIG (também é macro #005)
#017.03 — config/testOverrideUsers.ts → ver #005

CORE — CHECKOUT (também é macro #007)
#017.04 — core/checkout/EventOrganizerResolver.ts → ver #007

CORE — CATALOG/CORE/DB/ERRORS
#017.05 — core/catalog/catalog-payment.service.ts
#017.06 — core/core.service.ts
#017.07 — core/db.ts
#017.08 — core/errors.ts

CORE — ECONOMY/FUND (também é macro #004)
#017.09 — core/economy/fund/fund-admin.routes.ts → ver #004
#017.10 — core/economy/fund/fund-dashboard.routes.ts → ver #004
#017.11 — core/economy/fund/fund-weekly-scheduler.ts → ver #004
#017.12 — core/economy/fund/fund.module.ts → ver #004
#017.13 — core/economy/fund/fund.routes.ts → ver #004
#017.14 — core/economy/fund/fund.types.ts → ver #004

MODULES — EVENTS
#017.15 — modules/events/event.service.ts
#017.16 — modules/events/events-multi-actor.service.ts

MODULES — MARKETPLACE
#017.17 — modules/marketplace/sub-services/subscriptions/subscriptions.service.ts

MODULES — RIDES (também é macro #008)
#017.18 — modules/rides/rides.types.ts → ver #008
#017.19 — modules/rides/shared/payment.ts

MODULES — WORK (também é macro #008)
#017.20 — modules/work/work-event-outbox.helper.ts
#017.21 — modules/work/work.events.ts
#017.22 — modules/work/work.types.ts → ver #008

SERVICES — EVENTS (NOVOS)
#017.23 — services/events/ConsumptionService.ts
#017.24 — services/events/EventService.ts
#017.25 — services/events/TicketService.ts
#017.26 — services/events/tests/event_checkout_hardening.test.ts

SERVICES — SCHEDULE (NOVO)
#017.27 — services/schedule/CompanyScheduleService.ts
```

**Critério para expandir uma:** ao iniciar sessão dedicada a um arquivo ou grupo.

**Validação por arquivo:**
```powershell
# Comparar versão arquivada com versão atual (se existe)
diff C:\unificard\backend\src\PATH C:\unificard_03_05_arquivado\backend\src\PATH

# Verificar imports/dependências
grep -rn "import.*from.*PATH" backend/src/

# Verificar se compila
cd backend && pnpm build
```

---

### Sub-hipóteses #018 (~10 documentos reescritos)

```
#018.01 — CONTRACTS.md (versão original em .bak)
#018.02 — AGENDA_UNIVERSAL_CONTRACT.md
#018.03 — CORE_EXECUTAVEL_VS_CORE_CONCEITUAL.md
#018.04 — CORE_TEMPORAL_CONTRACT.md
#018.05 — CORE_VS_MODULOS_CONTRACT.md
#018.06 — CORE_APROVACAO_FINANCEIRA_CANONICO.md
#018.07 — CORE_ESTORNOS_FINANCEIROS_CANONICO.md
#018.08 — CORE_TEMPORAL_HARDENING_CONTRACT.md
#018.09 — CORE_PERMISSOES_FINANCEIRAS_CANONICO.md
#018.10 — CORE_SPLIT_PAGAMENTO_CANONICO.md
```

**Critério para expandir uma:** quando documento for revisitado em sessão de governança.

**Validação por documento:**
```powershell
# Diff entre versão atual e versão reescrita pela Claude Code
diff docs/01_normative/NOME.md C:\unificard_03_05_arquivado\docs\01_normative\NOME.md

# Decidir mudança a mudança
```

---

## 📊 ORDEM DE EXECUÇÃO RECOMENDADA

### Fase 1 — Cherry-picks de baixo risco (validar pipeline)
1. **#009** (fix gate) — pré-requisito
2. **#010** (hygiene C3) — depende de #009
3. **#011** (hygiene C8) — depende de #009
4. **#012** (docs DECISION-0019) — depende de #009-011
5. **#003** (fix C4 bank-balance) — independente
6. **#013** (docs DECISION-0020 com adaptação) — após #012

### Fase 2 — Hipóteses estratégicas (sessões dedicadas)
7. **#006** (Lei 7) — sessão filosófica
8. **#014** (constraints) — provavelmente a mais valiosa
9. **#015** (schema drift) — uma tabela por sessão
10. **#016** (21 migrations) — validação por migration

### Fase 3 — Hipóteses técnicas (sessões com Codex)
11. **#002** (Mutations) — sessão arquitetural
12. **#007** (EventOrganizerResolver) — sessão arquitetural
13. **#008** (tipos rides/work) — uma por módulo
14. **#017** (arquivos .ts) — um arquivo crítico por vez

### Fase 4 — Hipóteses operacionais delicadas
15. **#005** (testOverrideUsers) — decisão estratégica
16. **#004** (desabilitar fund/) — só após mapeamento
17. **#018** (docs reescritos) — sessão de governança

### Hipóteses descartadas
- **#001** (17 docs paralelos) — REJEITADA macro

---

## ⚠️ REGRAS DE OURO PARA QUEM USAR ESTE DOCUMENTO

### 1. Uma hipótese por sessão

Não atacar mais de uma hipótese (ou sub-hipótese) por sessão de execução. Esse é o erro que custou as 36 horas.

### 2. 1 mudança → build → valida → commit

Para cada hipótese ACEITA:
- Aplicar mudança cirúrgica
- Rodar `pnpm build` (esperar 0 erros)
- Validar gate específico
- Confirmar critério de validação
- Commit

### 3. Atualizar status em fluxo

Após executar uma hipótese:
- Status: ACEITA → **EXECUTADA**
- Preencher seção "Evidência de execução"
- Atualizar tabela-índice macro
- Próxima sessão pega próxima hipótese da fila

### 4. Hipóteses em avaliação não são lixo

Hipóteses EM AVALIAÇÃO podem ser revisitadas. Não deletar, não decretar — registrar dados/decisões faltantes.

### 5. Multi-IA por padrão para impacto Alto

Hipóteses de impacto Alto requerem auditoria de pelo menos 2 IAs antes da execução.

### 6. Documentar decisões

Mesmo hipóteses REJEITADAS ficam no documento com motivo. Evita re-discutir indefinidamente.

### 7. Sub-hipóteses expandem sob demanda

Não expandir sub-hipóteses sem necessidade real. Expandir apenas quando:
- A macro está EM AVALIAÇÃO ou ACEITA
- Sessão atual vai trabalhar nela
- Antes de execução técnica relacionada

### 8. Próxima ação sugerida é gatilho

Cada hipótese tem "Próxima ação sugerida" — passo concreto. Se uma IA abre o documento e não sabe o que fazer, leu errado.

---

## 🛠️ MANUTENÇÃO DESTE DOCUMENTO

### Quando atualizar
- Toda vez que uma hipótese for executada (ACEITA → EXECUTADA)
- Quando uma hipótese REJEITADA for revisitada (com novo contexto)
- Quando nova hipótese for descoberta (revisão do material arquivado)
- Quando sub-hipótese for expandida para detalhe completo

### Quem atualiza
- IA executora atualiza após executar
- Clayton revisa e valida

### Onde fica
- Caminho canônico: `docs/decisions/HIPOTESES_DAS_36_HORAS_2026-05.md`
- Backup: ZIP da operação de rescue

### Quando arquivar
- Quando todas as hipóteses macro estiverem EXECUTADAS, REJEITADAS ou eternizadas como DECISIONs próprias
- Mover para `docs/99_archive/` com sumário do que aconteceu

---

## 🔗 REFERÊNCIAS

- `RELATORIO_36_HORAS_NORTE.md` — relato detalhado da janela
- `auditoria-claude-code.txt` — análise multi-IA original (preservar em `docs/99_archive/auditorias/`)
- `C:\unificard_03_05_arquivado\` — repositório arquivado com material original
- `C:\backup-pre-volta-01-05.zip` — backup da operação de rescue

### Commits relevantes em `arquivado-03-05/rescue-structural`

- `7033c77e` — Hipótese #003 (fix C4 bank-balance)
- `14f77c3a` — Hipótese #009 (fix gate)
- `2ac76130` — Hipótese #010 (hygiene C3)
- `c40f4d88` — Hipótese #011 (hygiene C8)
- `9e645967` — Hipótese #012 (docs DECISION-0019)
- `89f1d87d` — Hipótese #013 (docs DECISION-0020)

### Commits descartados (sem valor)

- `4c98cb1f` — status Loop §6 (sem valor)
- `a8981a35` — status Cenário E (sem valor)

---

## 📝 ASSINATURA

**Data:** 2026-05-04
**Versão:** 2.0 (com 4 ajustes ChatGPT + apêndice de sub-hipóteses)
**Sessão:** UnifiCard rescue — síntese final
**Compilador:** Claude (Auditor)
**Validação:** ChatGPT (Crítico) + Clayton (Orquestrador)
**Próxima sessão sugerida:** executar Hipótese #009 (fix gate) — primeira da Fase 1

---

## Hipótese #019 — Repurificação da fronteira core/modules

**Origem:** diagnóstico multi-IA sessão 2026-05-04
**Categoria:** Arquitetural
**Impacto sistêmico se estiver errada:** Alto

### O que foi identificado
core/ está contaminado: contém HTTP (Fastify), SQL decisório, imports de modules/, e arquivos *.routes.ts. A separação core/modules que deveria proteger os SSOTs colapsou por falta de enforcement. 58 inversões de dependência confirmadas em 32 arquivos. 250 arquivos com sinais de impureza. 14 domínios duplicados entre core/ e modules/.

### Categorias de classificação (critérios verificáveis)

**ATIVO:** tem caller identificável (import estático) OU registro indireto (app.builder.ts, worker, bootstrap, rota dinâmica)

**MORTO:** sem caller estático + sem registro em app.builder.ts ou bootstrap + sem worker/job associado + sem intenção clara

**LATENTE:** sem caller + depende de código real (não stub) + intenção explícita (comentário, nome, contexto) + sistema futuro identificável + função clara + condição de ativação definível

**CONTAMINADO:** tem caller ativo + está em core/ + (usa Fastify/HTTP OU SQL que toca SSOT fora do dono OU importa de modules/ sem exceção documentada). SQL de infraestrutura transversal NÃO é contaminação automática.

**INDETERMINADO:** não encaixa nos critérios acima — não forçar categoria, registrar evidências e aguardar decisão

### Critério de Classificação — Soberania / SSOT

A auditoria da Hipótese #019 não classifica arquivos apenas por pasta (`core/` vs `modules/`).

Ordem de prova:

1. Norma → quem DEVE mandar
2. SSOT Registry → onde a verdade vive
3. Builder/bootstrap → prova de vida operacional
4. Imports/callers → quem depende
5. Execução/SQL/chamadas → quem tenta mandar

Classificação final:

- dono correto
- consumidor autorizado
- invasor
- morto
- latente
- indeterminado

### Observação Operacional

Este critério é obrigatório para qualquer análise desta hipótese.
É proibido classificar por pasta sem aplicar a cadeia:
Norma → SSOT → Builder → Imports → Execução.

### Regra anti-cemitério para código latente
Todo código latente DEVE ter: função clara + sistema futuro identificado + condição de ativação definida. Se não cumprir os três → não é latente, é INDETERMINADO.

### Ordem de auditoria (pela Lei §7)
SEMÂNTICA → IDENTIDADE → AUTORIDADE → TEMPO → ESTADO → FINANCEIRO → EVENTO

Não atacar financeiro antes de identidade/autoridade estabilizados.

### Primeiro latente classificado
`backend/src/core/jobs/subscription-expiration.job.ts` — commit 65a0f754 — 2026-05-04
Ver: docs/decisions/CODIGO_LATENTE_REGISTRY.md

### Decisão atual
EM EXECUÇÃO — amostragem de 5 arquivos em andamento

### Próxima ação
Classificar amostra de 5 arquivos, checkpoint, depois gate CI fase 1 (modo log)

---

### Sub-hipótese #019.FR — Financial Read Surface

**Categoria:** Comportamental + Arquitetural
**Impacto se não resolvida:** Alto

**Estado atual (2026-05-05):**
- GET /economy/transactions/:id → FUNCIONA via wrapper → bankTransactionService
- GET /economy/transactions/event/:eventId → 501; retorna antes de qualquer validação
- GET /economy/transactions/account/:accountId → 501; retorna antes de qualquer validação
- dashboard.service.ts, ai-engine.ts, identity.routes.ts, identity.service.ts → ainda usam getTransactionsByGlobalUserId() que retorna []

**Leituras financeiras paralelas detectadas:**
- identity.routes.ts:862 → importa bank-ledger.repository direto
- dashboard.service.ts → usa transactionService wrapper
- ai-engine.ts → usa transactionService wrapper

**Decisões pendentes antes de implementar:**
1. Rotas /economy/transactions/* pertencem a /economy ou /bank?
2. Dashboard recebe histórico real ou wallet summary?
3. AI recebe histórico ou contexto resumido?
4. Identity acessa transações ou apenas saldo?
5. BankTransactionPort único ou Write + Read separados?

**Bloqueado por:** decisão de produto + decisão arquitetural sobre ReadPort
**Próxima ação:** sessão de decisão com Clayton antes de qualquer implementação

**Decisões registradas (2026-05-05):**
- Dashboard: userId → actorId via actorRepository antes de chamar ReadPort
- AI: manter stub vazio — proteção arquitetural, não bug
- Identity /wallet: remover import direto de bank-ledger.repository, substituir por ReadPort via actorId

**Port correto definido:**
- parâmetro: actorId (não globalUserId)
- coluna: bank_accounts.actor_id (indexada)
- ledger: bank_ledger.direction ('credit'|'debit')

**Ordem de execução aprovada:**
1. Criar BankTransactionReadPort
2. Implementar em bank-transaction-read.repository.ts
3. Criar adapter em modules/bank/adapters/
4. Registrar no bankPortsRegistry
5. Migrar identity.routes.ts:861 (prioridade — remove inversão confirmada)
6. Migrar dashboard.service.ts
7. AI — não migrar

---

**FIM DO DOCUMENTO**

> Este documento não é estático. É **pipeline de decisões arquiteturais vivo**.
> Cada sessão futura: pega hipótese → valida → atualiza status.
> Progresso mensurável. Sem caos. Sem repetir erro.

> **As 36 horas não foram trabalho perdido. Foram experimento que revelou onde o sistema quebra.
> Este documento garante que 36 horas nunca mais se percam — porque agora cada hora vira hipótese rastreável.**
