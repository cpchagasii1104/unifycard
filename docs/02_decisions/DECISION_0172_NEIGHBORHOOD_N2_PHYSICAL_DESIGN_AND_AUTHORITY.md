# DECISION-0172 — N2-0: escolhas físicas e de autoridade da fundação canônica de bairro

- **Status:** DECIDIDA / PROMULGADA (docs-only) — registra as decisões soberanas do GATE read-first N2 da frente `F-NEIGHBORHOOD-CANONICAL-IDENTITY`. Nenhuma fatia material é aberta por este documento. **Adendo N2-0.1 (2026-07-11):** esclarecimento vinculante §0.1 — `NOLOGIN` é estado inicial, não invariante permanente; a pendência de rollout LOGIN vive na DT existente `DT-DRIFT1-RLS-HARDENING-OPS-ROLLOUT-PENDING` (sem DT nova); o HOLD de bairro não depende de `NOLOGIN`.
- **Data:** 2026-07-11
- **Autoridade:** Clayton (soberana), sobre o relatório GATE N2 read-first executado em HEAD `c8c9dfecc` (sem edição/commit) e sobre o veredito que o aprovou com duas correções vinculantes.
- **Predecessoras:** DECISION-0171 + adendo N1.1 (§6.1) SELADAS pela Yala (`13cd7d84c` · `7d253d0f9` · selo `c8c9dfecc`); contenção N0/N0.1/N0.2 SELADA (`a81f004ea` · `7fcf407cd` · `c53e044dc` · selo `d79b863e2`).
- **Escopo:** decisão de desenho físico + autoridade + sequência. **NÃO** autoriza migration, schema, seed, writer, capability key, grant, alteração de guard, trigger, REVOKE, Social, Bank, nem remoção de HOLD. Cada fatia material (N2-pre…N2-G, N3) exige GO e auditoria próprios.

---

## 0. Contexto

O GATE N2 read-first (inventário do schema vivo, padrões reutilizáveis e substrato de authority) concluiu: **PRONTO COM PRÉ-FATIA OBRIGATÓRIA** — núcleo/aliases/sucessão desenháveis com moldes governados; writer bloqueado até existir autoridade territorial, trilha do grant utilizado e ajuste consciente do guard. O veredito soberano aprovou o GATE com **duas correções vinculantes** (HOLD físico por trigger, não só ACL; coerência composta de `addresses` como pré-condição do seed) e ratificou P1–P6. Este documento crava tudo isso como norma da frente.

**Correção material registrada (do veredito):** o `REVOKE` de `unificard_app` isolado NÃO é contenção física completa no ambiente atual — o runtime de desenvolvimento ainda usa `postgres` (superuser), então a barreira material relevante no dev é o **trigger de HOLD** (P5). O REVOKE é defesa em profundidade para o runtime-alvo. *(Sobre o estado LOGIN/NOLOGIN da role, ver o esclarecimento vinculante §0.1 abaixo, que prevalece sobre qualquer leitura de `NOLOGIN` como invariante permanente.)*

### 0.1. Esclarecimento vinculante do estado operacional da role (adendo N2-0.1)

Esta subseção **prevalece** sobre qualquer trecho deste documento (incluindo a frase original de §0 que descrevia `unificard_app` como `NOLOGIN`) que sugira que `NOLOGIN` é uma invariante permanente da role. Ela complementa, não revoga, o restante.

- `NOLOGIN` descreve o **estado inicial** produzido pela migration `20260620120000_db_role_rls_hardening.sql`, **não** uma invariante permanente. A própria migration prevê, como **ato de ops** explícito (passo 2 do seu cabeçalho), a promoção `ALTER ROLE unificard_app WITH LOGIN PASSWORD '<segredo fora do repo>'` + o apontamento do `DATABASE_URL` de runtime para `unificard_app`. O estado vivo `rolcanlogin=true` observado no dev é **compatível** com esse rollout governado (executado por Clayton em 2026-06-24, registrado no arco RLS-runtime-live), **não** um drift inexplicável.
- **Autoridade operacional dessa pendência é única e já existe:** `DT-DRIFT1-RLS-HARDENING-OPS-ROLLOUT-PENDING`. **Não** se abre segunda DT para o mesmo fato (evita duas verdades para a mesma pendência).
- O **requisito PERMANENTE** de `unificard_app` (o que realmente não pode driftar) é: **NOSUPERUSER · NOBYPASSRLS · sem ownership/DDL · grants mínimos · runtime usando a role controlada**. `LOGIN` é passo de rollout previsto, não violação.
- **O HOLD de `neighborhoods` NÃO depende de `NOLOGIN`.** Ele depende de: **(a)** REVOKE de DML efetivo para `unificard_app`; **(b)** trigger `ENABLE ALWAYS` que nega DML inclusive à role administrativa no fluxo normal; **(c)** guard anti-revival versionado; **(d)** inspeção do estado vivo por introspecção. Ainda que `unificard_app` esteja `LOGIN`, as quatro camadas seguem valendo.

---

## 1. Decisões vinculantes P1–P6

### P1 — Authority territorial: escopo explícito e tipado; tenant institucional REJEITADO
- O catálogo territorial é **global**; a curadoria não pode depender de "tenant especial" por convenção operacional (autoridade global escondida e difícil de provar — rejeitado).
- A casa continua sendo o substrato canônico de capability grants (`actor_capability_grants`), evoluído com **escopo territorial como extensão tipada e referencialmente íntegra**. O GATE da fatia de authority (N2-D) deverá avaliar estrutura subordinada ao grant com: nível territorial governado; **FKs reais** para país/estado/cidade/bairro conforme o nível; CHECK de shape; vigência; **ausência de `scope_ref_id` UUID genérico sem FK**; efeito global **explicitamente declarado**, nunca inferido do tenant.
- `tenant_id NULL` e "tenant do sistema" **não estão autorizados automaticamente**. A convivência tenant/global será fechada em **decisão docs-only própria da fatia de authority**.
- Nenhum grant material nasce desta decisão.

### P2 — Maker-checker: opção C no MVP, SEM autoaprovação implícita
- Enquanto houver apenas um curador habilitado, a mesma pessoa **pode** criar e aprovar, desde que: criação e aprovação sejam **duas operações explícitas**; cada operação exija **sua capability correspondente**; **não exista "create and approve" implícito**; evidência seja obrigatória; os **cinco elos** de rastreabilidade (§6.1-D da 0171: actor representado, conta executora, humano responsável, grant usado, momento) sejam persistidos.
- O schema deve permitir adotar maker-checker obrigatório no futuro **sem reescrita**. A mudança para separação obrigatória será decisão própria quando houver segundo curador operacional. **Não criar configuração dinâmica agora.**

### P3 — Capability por ação: múltiplas keys governadas
- Preservar o padrão `domain:action` existente (a key É a ação; match exato). **Não** criar key genérica com campo `action`.
- Operações conceituais distintas: criar registro canônico · aprovar · corrigir descrição/rename · desativar · registrar sucessão.
- A capability de "propor candidato" **não nasce no N2** (fila de candidatos adiada).
- Nomes físicos das keys: decididos no N2-D/authority, após busca no vocabulário e nos três registros governados (CHECK físico + allowlist TS + permission-keys).
- Uma pessoa pode possuir mais de uma key; isso não funde as operações em autorização única.

### P4 — Proveniência: modelo híbrido governado
- Nem CHECK fechado puro, nem texto livre puro. Combinar: **`source_kind` (ou equivalente) de vocabulário governado e fechado** · **referência verificável da fonte** · **evidência/justificativa textual** · **autoria e aprovação por actor** · **timestamps** · **regra de obrigatoriedade conforme o tipo de fonte** (curadoria interna ⇒ referência e justificativa OBRIGATÓRIAS).
- Tipos conceituais de fonte (nomes finais no N2-A): municipal oficial · governamental · cartográfica/documental pública · curadoria interna.
- **`external_code` NÃO nasce preventivamente no MVP** — só quando existir fonte concreta que forneça código estável. Até lá, `source_reference` registra a procedência sem fingir código oficial inexistente.

### P5 — Contenção física: N2-pre OBRIGATÓRIA (trigger + REVOKE + guard)
- O GATE achou que `unificard_app` tem INSERT/UPDATE/DELETE físicos em `neighborhoods` (guard de código é a única barreira). A microfatia N2-pre combina obrigatoriamente:
  1. `REVOKE INSERT, UPDATE, DELETE ON neighborhoods FROM unificard_app`;
  2. **trigger de HOLD** no banco bloqueando INSERT/UPDATE/DELETE de `neighborhoods` — a barreira material relevante enquanto o dev roda com role administrativa;
  3. guard que **exige a presença do trigger e a ausência dos grants**;
  4. prova de que SELECT e todos os readers continuam funcionando;
  5. registro explícito de que o runtime dev usa role administrativa e por isso o trigger é a barreira que vale nesse ambiente.
- O trigger é **explicitamente temporário e governado**: "`neighborhoods` permanece read-only até a abertura do writer canônico N2-E". Só poderá ser substituído na fatia do writer, com nova auditoria. O REVOKE é defesa em profundidade para o runtime-alvo, **não** proteção suficiente sozinho.
- **Nada é implementado por esta decisão** — N2-pre tem GO próprio.

### P6 — Vigência: preservar `is_active` + vigência temporal; NENHUM status novo no N2
- `valid_from_at` / `valid_until_at` = **vigência territorial** do registro; `is_active` = **disponibilidade operacional** para listagem/uso atual; curadoria/aprovação = provada por autoria/aprovação/trilha (**não** por `is_active`); visibilidade pública = decisão do read-model, não da identidade.
- Regras: criação aprovada nasce com `valid_from_at`; extinção encerra `valid_until_at` E torna `is_active=false`; ocultação técnica temporária pode usar `is_active=false` **sem fingir extinção territorial**; readers atuais passam a filtrar atividade + intervalo de vigência; **não criar `status` genérico nem reutilizar vocabulário KYC/draft/published**.

---

## 2. Demais decisões do GATE (registradas como norma da frente)

- Núcleo `neighborhoods` **reutilizado** (evolução ALTER aditiva; segunda tabela principal proibida — 0171 §2).
- Aliases em **tabela filha** (não `TEXT[]`); **colisão de aliases é permitida e tratada como AMBIGUIDADE explícita** (resolver devolve candidatos; rito humano decide; nunca escolha silenciosa); alias nunca auto-resolve FK.
- Sucessão territorial **N:N append-only** (eventos de linhagem com tipo governado, anti-self, evidência, autoria); **limitada à mesma `city_id` no MVP, fail-closed** (CHECK; relaxamento futuro = decisão consciente); **rename NÃO é sucessão** (rename = mesma identidade + alias atômico).
- Fila de candidatos **ADIADA** (não nasce no N2; entra como fatia própria quando o rito de resolução de endereços existir, com vocabulário territorial próprio — 0171 §7).
- PostGIS/geometria **fora** (0171 §3-F).
- `city_id` **imutável** pós-criação (erro de cadastro = desativar + criar correto + sucessão/correção documentada).
- **DELETE físico proibido** (extinção = desativação + evento de sucessão/extinção).
- Nome só muda **em transação com criação do alias** do nome anterior.
- `source`/`evidence` alteráveis **apenas por operação auditada** (amend com trilha).
- Catálogo **nasce vazio**; seed permanece **N3** (via contrato canônico, nunca SQL paralelo).

---

## 3. Coerência de `addresses` — pré-condição obrigatória ANTES do N3 (fatia N2-F)

O GATE provou que `addresses.neighborhood_id` é FK simples e que os writers vivos de rentals/events aceitam UUID sem validar pertencimento à cidade — furo real no dia em que o catálogo tiver linhas. Antes do primeiro seed:

- `CHECK (neighborhood_id IS NULL OR city_id IS NOT NULL)`;
- **FK composta** `addresses(city_id, neighborhood_id) → neighborhoods(city_id, neighborhood_id)` (o UNIQUE de suporte já existe);
- **remoção/superação da FK simples na mesma migration**;
- **nenhum backfill por `neighborhood_display_text`**;
- adequação dos writers vivos (rentals/events) ao novo shape;
- fatia própria (**N2-F**), com GO e auditoria próprios. Hoje há 0 endereços com `neighborhood_id` ⇒ a mudança nasce sem backfill territorial.

---

## 4. Authority — fronteiras registradas

- `actor_capability_grants` é a **casa canônica** a evoluir/compor; `canRepresentActor` permanece **apenas representação** (0171 §6.1-A).
- Authority territorial é **AND obrigatório**: autenticação → `canRepresentActor` → capability territorial explícita, escopada e vigente → operação. Em catálogo global **não existe owner nativo** — grant é obrigatório para todos.
- O **grant usado deve ser persistido em trilha append-only** (molde `actor_delegation_events`); os cinco elos de rastreabilidade permanecem obrigatórios.
- Tenant admin, role textual, `is_admin`, booleano local e acesso operacional genérico **nunca** são fallback (0171 §6.1-C).
- **N2-D/authority exige GATE específico antes da migration** (avaliar a estrutura de escopo tipada do P1, keys do P3, trilha, e o fix do `reason` sobrescrito no revoke identificado pelo GATE).

---

## 5. Guard — modelo futuro registrado

- **Allowlist por arquivo está REJEITADA** para o writer. Modelo futuro = **arquivo + check específico** (per-check): o repository canônico poderá receber autorização de DML, mas continuará proibido de: resolver bairro por texto; derivar ID de display/provider; usar `findOrCreate*`; escolher automaticamente por alias ou nome; e não pode existir segundo writer.
- O walk do guard deve **cobrir scripts runtime** (ou existir segundo controle) para impedir seed clandestino por SQL paralelo.
- **N2-0 não altera o guard** (cumprido — nenhuma linha de guard tocada por esta decisão).

---

## 6. Sequência material ratificada

```
N2-0   (esta) decisão docs-only das escolhas físicas e de autoridade
N2-pre HOLD físico: trigger + REVOKE + guard
N2-A   evolução aditiva do núcleo neighborhoods (proveniência P4, vigência P6)
N2-B   aliases (tabela filha)
N2-C   sucessão N:N append-only
N2-D   authority territorial + capability keys + trilha de uso do grant (com GATE próprio)
N2-E   writer canônico + allowlist por check + mutations
N2-F   coerência composta addresses(city_id, neighborhood_id)
N2-G   prova integrada e selo Yala
N3     seed curado, por contrato canônico
```

- Cada fatia: **GO próprio · commits isolados · provas · auditoria Yala**.
- A ordem entre N2-F e N2-E pode ser ajustada, mas **N2-F deve estar SELADA antes do N3**.
- Fila de candidatos permanece adiada. **Social, Bank, remoção dos HOLDs 501 e governança permanecem fora.**

---

## 7. Escopo negativo (cumprido nesta fatia)

Docs-only: zero migration/schema/seed/trigger/REVOKE; zero backend/src, backend/scripts, frontend; guard intocado; `CANONICAL_WRITER_ALLOW` vazia; nenhuma capability key/grant criada; zero Social; zero Bank/split/fundos; dois HOLDs 501 preservados; Δbank=0.

## 8. Efeito

- **N2-0 DECIDIDA/PROMULGADA docs-only.** Habilita, com GO próprio por fatia, a sequência do §6 — começando por N2-pre.
- **N2-pre e todas as fatias materiais permanecem TRANCADAS** até GO explícito.
