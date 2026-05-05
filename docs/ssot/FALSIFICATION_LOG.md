# FALSIFICATION LOG — SSOT UnifiCard

Este documento registra **tentativas explícitas ou implícitas de violação do SSOT**,
bem como os resultados dos testes de falsificação executados ao longo do plano de correção.

Regra de ouro:
> Se um teste de falsificação não está registrado aqui, ele **não aconteceu**.

---

## COMO USAR ESTE LOG

Cada entrada deve representar **uma tentativa concreta de quebrar o SSOT**, seja por:
- escrita fora da autoridade única
- leitura legacy usada como decisão
- bypass de Gate
- ambiguidade detectada tardiamente

**Ambiguidade conta como falha até prova em contrário.**

---

## ORDEM E NATUREZA DO LOG (IMPORTANTE)

- Este log é **APPEND-ONLY**
- Entradas são **ordenadas por data de execução**, não por Gate
- **Nada é apagado**
- **Nada é editado retroativamente**
- Correções, descobertas tardias ou novos testes geram **novas entradas**
- Linha do tempo tem prioridade sobre fase do plano

Este documento é **forense**, não narrativo.

---

## TEMPLATE DE ENTRADA (copiar para cada novo teste)

### Entrada #[N]

- **Data:** YYYY-MM-DD
- **Gate:** Gate X
- **Domínio:** (ex.: bank, payments, marketplace, events, services, system)
- **Arquivo(s) envolvido(s):**
  - path/to/file.ts
- **Tentativa de falsificação:**
  - (descrever exatamente o ataque, cenário ou hipótese testada)
- **Hipótese de violação:**
  - (qual SSOT estaria sendo quebrado se isso passasse)
- **Resultado:**
  - PASSOU | FALHOU
- **Evidência:**
  - logs
  - prints
  - trechos de código
  - comandos executados
  - dumps
- **Conclusão:**
  - (por que passou ou falhou)
- **Ação corretiva (se aplicável):**
  - (refatorar, bloquear, registrar como proibido, criar novo Gate, etc.)

---

## ENTRADAS REGISTRADAS

### Entrada #1 — BASELINE HISTÓRICO

- **Data:** 2026-01-27
- **Gate:** Gate 0
- **Domínio:** system
- **Arquivo(s) envolvido(s):**
  - N/A
- **Tentativa de falsificação:**
  - Verificar se o sistema já possuía uma Fonte Única da Verdade (SSOT) financeira
    antes do início do plano de correção.
- **Hipótese de violação:**
  - Existência de múltiplas autoridades concorrentes de saldo, transação,
    ledger e split financeiro.
- **Resultado:**
  - FALHOU
- **Evidência:**
  - MATRIZ DE IMPACTO FORENSE — SSOT UnifiCard
  - Escritas diretas e paralelas em:
    - accounts
    - ledger
    - transactions
    - payment_splits
    - event_split_declarative
    - region_accounts
    - service_payment_*
- **Conclusão:**
  - O sistema operava historicamente com múltiplas verdades financeiras concorrentes.
  - Não existia SSOT financeiro consolidado.
- **Ação corretiva:**
  - Ativação formal do Plano de Correção SSOT com Gates sequenciais.
  - Congelamento do baseline e início da governança forense.

---

## REGRAS DE GOVERNANÇA DO LOG

1. Este log é **obrigatório** para:
   - fechamento de Gates
   - auditoria interna
   - revisão de arquitetura
2. Falha documentada é **vitória técnica**
3. Falha escondida é **dívida técnica**
4. Gate **não passa** se:
   - houver testes de falsificação previstos não registrados
   - existir ambiguidade sem entrada correspondente
5. Ausência de entrada = teste **não executado**

---

## STATUS

- Documento **ATIVO**
- Natureza: **forense / contratual**
- Autoridade: **governança SSOT**
- Este arquivo sobrevive a refactors de código, mudanças de time e reestruturações.

---

### Entrada #2 — `authority_roots` enforcement (pré-condição Bloco F, PLANO_EXECUCAO_CURSOR_v3)

- **Data:** 2026-04-13
- **Gate:** Gate §17 (BLOCOS F + G — critério `authority_roots`)
- **Domínio:** system / AUTHORITY_PRECEDENCE
- **Arquivo(s) envolvido(s):**
  - `backend/migrations/20260521100000_authority_roots_enforcement.sql` — **não criado** (pré-condição não satisfeita)
- **Tentativa de falsificação:**
  - Executar F.1 do plano: contar actores humanos sem linha em `authority_roots` antes de ativar enforcement (Opção A).
- **Hipótese de violação:**
  - Ativar trigger de obrigatoriedade de `authority_roots` com backfill incompleto bloquearia criação/atualização legítima de actores humanos.
- **Resultado:**
  - FALHOU (pré-condição: count > 0)
- **Evidência:**
  - Comando: `SELECT COUNT(*) AS actors_sem_authority_roots FROM actors a WHERE a.actor_type IN ('user', 'actor_human', 'person') AND NOT EXISTS (SELECT 1 FROM authority_roots ar WHERE ar.actor_id = a.id);`
  - Resultado: `actors_sem_authority_roots = 347`
  - Ref. plano: Bloco F — se resultado > 0, não criar migration; registrar com prazo.
- **Conclusão:**
  - Enforcement total (migration `20260521100000_authority_roots_enforcement.sql`) **não aplicável** até backfill manual de `authority_roots` para actores afectados.
- **Ação corretiva (se aplicável):**
  - Backfill manual de `authority_roots` para os actores humanos em falta; **prazo definido:** 2026-06-30; reexecutar F.1; se `COUNT = 0`, aplicar migration `20260521100000_authority_roots_enforcement.sql` conforme plano.

---

### Entrada #3 — Ambiguidade de enum `actor_type` (normativo vs registry)

- **Data:** 2026-04-14
- **Gate:** alinhamento documental (suporte a Gate 2 — sem ambiguidade de enum)
- **Domínio:** identity / nomenclatura / events (consumidor de `actor_type`)
- **Arquivo(s) envolvido(s):**
  - `docs/01_normative/07_NOMENCLATURA_CANONICA.md` — §4.38 emendado (v3.3.6)
  - `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` — subsecção `actor_type` sob **Identidade Global de Ator**
- **Tentativa de falsificação:**
  - Assumir que o SSOT registry ou tooling implícito restringe `actor_type` a um subconjunto antigo (ex.: apenas `user` / `page` / `system`), ignorando `group` e `channel` já persistidos em `actors`.
- **Hipótese de violação:**
  - Enum paralelo ou registry desactualizado → validação ou DDL divergente do §4.38; risco de rejeitar linhas legítimas ou de introduzir `CHECK` só no SQL sem norma.
- **Resultado:**
  - PASSOU (ambiguidade encerrada no plano documental: norma §4.38 + amarração explícita no registry + referência à migração 0064).
- **Evidência:**
  - `07` §4.38 inclui `'group'` e `'channel'` na enumeração operacional; `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` referencia §4.38 (≥ 3.3.6), 0064 e o subconjunto first-class social/eventos.
- **Conclusão:**
  - Nenhum enum de `actor_type` operacional deve ser inferido só a partir de código ou de lista parcial em documentos satélites; fonte normativa única para a lista completa: **§4.38**.

---

---

## ENTRADA FL-005 — Violação de Precedência de Gate: Gate 3 executado antes do Gate A

- **Data:** 2026-04-17
- **Gate afetado:** Gate 3 (e por consequência Gates 0 e 1)
- **Classificação:** VIOLAÇÃO DE ORDEM DE GATES (pré-Gate A)
- **Tipo:** Execução fora da ordem normativa obrigatória
- **Detectado por:** auditoria estrutural do grafo normativo
- **Descrição:**
  - Gate 3 (`GATE_3_REVIEW.md`) foi declarado FECHADO tecnicamente antes de Gate A existir formalmente como documento.
  - Gate A é pré-requisito absoluto de todos os outros Gates por regra em `GATES.md`.
  - O fechamento técnico do Gate 3 é válido no escopo de escrita financeira, mas NÃO pode ser considerado normativo até que Gate A seja executado e selado.
- **Risco:**
  - Se Gate A falhar quando executado, o fechamento do Gate 3 torna-se retroativamente inválido.
  - Status atual do Gate 3: **PROVISÓRIO** até Gate A fechar.
- **Ação requerida:**
  - Executar Gate A (`AUTHORITY_LAW.md` + critérios de `GATES.md §Gate A`) como próximo passo obrigatório.
  - Após fechamento do Gate A: revalidar Gate 3 e atualizar `GATES.md` para `FECHADO · VALIDADO PÓS GATE A`.
  - Se Gate A falhar: Gate 3 deve ser reaberto e re-executado.
  - Verificação automatizada disponível: `npm run docs:gateA:check`
- **Conclusão:**
  - A causa raiz é histórica: Gate A foi criado depois do trabalho técnico do Gate 3 estar concluído.
  - Isso não reduz a severidade normativa: a violação de ordem existe e é real.
  - Ambiguidade permanece **não resolvida** até Gate A fechar formalmente.
- **Resolução (2026-04-17):** Gate A fechado com 8/8 critérios (`npm run docs:gateA:check`).
  Gate 3 revalidado e promovido a `FECHADO · VALIDADO PÓS GATE A`.
  **FL-005 → RESOLVIDO.**

---


---

### Entrada #4 — Bypass de `actor-writer` (§4.8.1 LEI_DE_COERENCIA_SISTEMICA)

- **Data:** 2026-04-17
- **Gate:** disciplina de escrita runtime (§4.8.1 — `actor-writer.service.ts`)
- **Domínio:** identity / actors
- **Arquivo(s) envolvido(s):**
  - `backend/src/**` — múltiplos módulos (mapeamento Sessão 1: 22 ficheiros em `src` + 3 testes de integração; **44** ocorrências de `actorRepository.findOrCreateUserActor` / `findOrCreatePageActor` antes da correcção)
- **Tentativa de falsificação:**
  - Código de produto chamava `actorRepository.findOrCreateUserActor` / `findOrCreatePageActor` directamente, contornando a API canónica `ensureUserActor` / `ensurePageActor`.
- **Hipótese de violação:**
  - Dupla via de criação de `actors` → deriva comportamental e risco de segunda verdade operacional relativamente à LEI §4.8.
- **Resultado:**
  - FALHOU (violação real no estado pré-Sessão 2)
- **Evidência:**
  - `PLANO_ACTOR_WRITER_ENFORCEMENT.md` — Sessão 1 (grep); Sessão 2 (migração Grupo A); Sessão 3 (`validate:actor-writer-boundaries` + `audit-actor-writer-boundaries.mjs`, CI em `.github/workflows/backend-ci.yml`).
- **Conclusão:**
  - Comportamento corrigido; regressão bloqueada por gate em CI.
- **Ação corretiva:**
  - RESOLVIDO. P2 (`actor.helpers.ts`, `actor.utils.ts`) e `backend/src/scripts/**` permanecem na allowlist do gate até trabalho dedicado; testes fora do escopo da migração Sessão 2.

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- AUTHORITY_LAW.md
- GATES.md
- GATE_3_REVIEW.md

### Referenciado por
- 00_INDEX.md
- AUTHORITY_PRECEDENCE.md
- AUTHORITY_RECOVERY.md
- GATES.md
- GATE_2_BLOCKERS.md
- GATE_2_CHECKS.md
- GATE_3_EXECUTION.md
- GATE_3_REVIEW.md
- IDENTITY_SSOT_PRECEDENCE.md
- PROHIBITED_STRUCTURES.md
<!-- AUTO-GENERATED-END -->

| 2026-04-18 | backend/src/modules/bank/ | LEI_DE_COERENCIA §4.6 | Auditoria bank_ledger_writer: 15 escritas bank_* auditadas, todas dentro de modules/bank/ ou testes. Nenhuma violação. Gate validate:bank-ledger-boundaries ativo no CI. | ENCERRADO |