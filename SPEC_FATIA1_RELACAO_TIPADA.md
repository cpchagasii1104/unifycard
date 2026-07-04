# SPEC — FATIA 1: SUBSTRATO DE RELAÇÃO TIPADA (actor↔actor)

> **Status:** 🟡 PARA REVISÃO DE CLAYTON — **zero código até você aprovar este spec.** É a fundação de
> tudo do `DESENHO_PAGINA_DO_ACTOR.md` (plateias, chamado, onboarding de funcionário, CRM, B2B).
> **Não move dinheiro · não concede autoridade · construível já.**
> Ancorado em: Lei de Coerência §5 (não-duplicação), §8 (vocabulário governado, sem texto livre),
> DECISION-0113 (autoridade = canRepresentActor), DECISION-0125 (relação ≠ company_users).

---

## 1. O QUE É (e o que NÃO é)

**É:** a aresta que conecta dois actors, com **tipo governado** e **classificação assimétrica** (cada
lado vê o outro pela sua ótica). Um dado, três usos: **social** (plateias) · **CRM** (meus clientes/
fornecedores/colaboradores) · **B2B** (empresa↔empresa).

**NÃO é (fronteiras duras):**
- ❌ **não concede autoridade** — nunca escreve `company_users`/`canManageCompany`/permissão. Operar a
  empresa continua 100% no substrato de autoridade blindado (DECISION-0113/0125).
- ❌ **não move dinheiro** (Δbank=0).
- ❌ **não substitui `follows`** — seguir (assimétrico, sem consentimento, público) COEXISTE; relação
  exige consentimento + classificação. São degraus distintos da Escada.
- ❌ **não é cross-tenant nesta fatia** — relação intra-tenant por ora; B2B cross-tenant depende da
  decisão de tenancy (pendente/soberana), então fica gated e nomeado, não construído aqui.

---

## 2. MODELO DE DADOS (proposta — 2 tabelas)

### 2.1 `relationship_types` — vocabulário GOVERNADO (Lei §8; seed, não texto livre)
| coluna | o quê |
|---|---|
| `code` (PK) | ex.: `amigo`, `cliente`, `fornecedor`, `colaborador`, `parceiro`, `conhecido`, `familiar` |
| `label` | rótulo de exibição pt-BR |
| `applies_from` | actor_type do classificador (`user`/`page`) — ou `*` |
| `applies_to` | actor_type do classificado (`user`/`page`) — ou `*` |
| `active` | bool |

Seed inicial (aprovado §7 do desenho): PF↔PF {amigo, conhecido, familiar} · PF↔PJ {cliente,
colaborador, fornecedor} · PJ↔PJ {fornecedor, cliente, parceiro}. Extensível por RFC (não por código
de feature). **Proibido** classificar com `code` fora deste vocabulário (fail-closed).

### 2.2 `actor_relationships` — a aresta (a conexão + as duas óticas)
| coluna | o quê |
|---|---|
| `id` (PK) | uuid |
| `tenant_id` | intra-tenant (FK) |
| `from_actor_id` | quem PEDE a conexão |
| `to_actor_id` | quem RECEBE |
| `status` | `pending` · `accepted` · `rejected` · `removed` · `blocked` |
| `requester_label` | como o `from` classifica o `to` (∈ `relationship_types`; setável no envio) |
| `target_label` | como o `to` classifica o `from` (∈ `relationship_types`; setável no aceite) |
| `requested_at` / `responded_at` | temporal |
| `created_by_user_id` / `responded_by_user_id` | auditoria (principal server-side) |

**Invariantes de schema:**
- `from_actor_id <> to_actor_id` (não conecta consigo).
- UNIQUE por par não-ordenado (evita A→B e B→A duplicados) — canonicaliza `least/greatest`.
- `requester_label`/`target_label` FK → `relationship_types.code` (governança; NULL até classificar).
- Assimetria = as duas colunas de label independentes (você=fornecedor, eu=cliente).

---

## 3. FLUXO (bidirecional, como Clayton pediu)

1. **Enviar conexão:** actor A (via quem o representa — `canRepresentActor`) cria a aresta
   `from=A, to=B, status=pending, requester_label=<tipo, ex. fornecedor>`.
   - Variante onboarding: o patrão PEDE ao funcionário enviar → mesma rota, `from=funcionário, to=empresa`.
2. **Responder:** B (via quem o representa) aceita (`accepted` + `target_label=<tipo, ex. cliente>`) ou
   rejeita (`rejected`).
3. **Ler:** "minhas conexões do tipo X" (CRM: meus fornecedores) · "temos vínculo?" (gate de chamado/
   plateia, camadas acima).
4. **Colaborador → autoridade:** o aceite do tipo `colaborador` PODE abrir o painel de permissões, mas
   o grant é ato SEPARADO no substrato REAL (`company_users` + mapa canônico) — **fora desta fatia**
   (esta fatia só cria a aresta; a ponte de autoridade é a fatia de onboarding).

---

## 4. AUTORIDADE (a catraca que já blindamos, aplicada aqui)

- **Enviar/responder AS um actor exige `canRepresentActor(tenant, req.user, actorId)`** — você só
  conecta/aceita em nome de um actor que representa (self, empresa que gerencia, etc.). Fail-closed 403.
  Zero actorId client-declared como autoridade (DECISION-0113).
- **A aresta NUNCA lê nem escreve `company_users`/permissão.** Relação ≠ autoridade (regra dura).
- **Quarentena:** actor bloqueado (ATL) não envia/aceita (gate antes do write).

---

## 5. O QUE ISTO DESTRAVA (as fatias seguintes leem daqui)

- **Plateias** (privacidade por camada): "quem vê X" = query na aresta por tipo. (Fatia 5, + fecha a
  DT-SOCIAL-POST-VISIBILITY.)
- **CRM:** "meus clientes/fornecedores" = projeção da aresta por `label`. Aposenta `contacts` fantasma.
- **Chamado:** precondição de vínculo (mas o gate real é FATO-DE-NEGÓCIO, camada acima).
- **Orquestração B2B:** a config de orquestração pendura NA aresta PJ↔PJ (horizonte, gated PORTA-1).

---

## 6. PROVA (quando construir — não agora)

- **Guard:** a aresta nunca importa/escreve `company_users`/`canManageCompany`/`bank_*` (anti-vazamento
  de autoridade/dinheiro); labels sempre ∈ `relationship_types` (governança).
- **E2E adversarial:** (a) enviar/aceitar AS actor alheio → 403; (b) classificar com tipo fora do
  vocabulário → rejeitado; (c) aceitar conexão NÃO cria linha em `company_users` (relação≠autoridade);
  (d) Δbank=0; (e) auto-conexão → rejeitada.

---

## 7. FORA DE ESCOPO desta fatia (nomeado, não construído)

cross-tenant · a ponte colaborador→permissões (fatia de onboarding) · plateias na leitura (fatia 5) ·
chamado (fatia 6) · orquestração (horizonte) · a PÁGINA/blocos (fatia 3).

---

## ⇒ REVISÃO DE CLAYTON

Pontos pra você bater o martelo antes de eu codar:
1. **Nomes das tabelas** (`actor_relationships` + `relationship_types`) — ok, ou prefere outro?
2. **Modelo de 2 labels na mesma linha** (assimetria) — ok, ou prefere 2 linhas direcionais?
3. **Seed de tipos** — o conjunto do §2.1 serve, ou quer mexer (add/remover algum)?
4. **Status set** (`pending/accepted/rejected/removed/blocked`) — falta algum estado que você quer?

Aprovou → eu construo a fatia 1 com guard + E2E adversarial, sem tocar em autoridade/dinheiro.
