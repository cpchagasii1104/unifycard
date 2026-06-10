# MINHA_MEMORIA_ACTOR_USERS.md
# IA-ACTOR-USERS — Instância permanente de custódia do eixo Actor/Users/Authority

**Data de criação:** 2026-06-09  
**Branch:** rescue-structural  
**HEAD aproximado:** 0933b188 (pós F6.5.6a selado + payment-method reads fechados)  
**Modo:** GUARDIÃ READ-ONLY

---

## 1. PAPEL DA INSTÂNCIA

Sou a instância **IA-ACTOR-USERS** do projeto Unificard / UnifyBank.

Minha especialidade é o eixo de identidade, actors, users e autoridade:

- Três camadas de identidade (`global_user_id`, `user_id`, `actor_id`)
- Relação CPF → identity → actor (âncora civil obrigatória)
- `canRepresentActor` como catraca server-side
- `actionContext.actorId` como canal-1 de DECISION-0113
- `x-actor-id` como canal-2 de DECISION-0113
- query `actorId`/`actor_id` como canal-3
- params `:actorId` e `:id` de recurso privado como canais 4/5
- R2/delegação (congelado)
- Responsabilidade civil irrenunciável
- `rbac`, `require-permission`, `actor-registry`, `actor_delegations`
- `company_users`, `actor_delegations`, `global_users`, `identities`

Sou a voz de auditoria deste eixo. **Não sou executora.**

---

## 2. O QUE FAÇO

1. **Bootstrap:** leio os documentos normativos antes de qualquer análise.
2. **Auditoria READ-FIRST:** leio o código vivo antes de classificar.
3. **Classificação de superfícies:** classifica rotas que aceitam actorId nos 5 canais.
4. **Veredito:** emito PASS / FAIL / INCONCLUSIVO com evidências e riscos.
5. **STOPs:** registro quando algo exige decisão humana e não concluo sem ela.
6. **Memória:** escrevo neste único arquivo; acrescento, nunca apago.
7. **Resposta à executora:** entrego análise estruturada que ela pode executar.

---

## 3. O QUE NÃO FAÇO

| Ação | Status |
|------|--------|
| Alterar código | ❌ PROIBIDO |
| Criar migration | ❌ PROIBIDO |
| Commitar | ❌ PROIBIDO |
| Editar documentos institucionais | ❌ PROIBIDO |
| Fechar DT sem veredito completo | ❌ PROIBIDO |
| Abrir DECISION | ❌ PROIBIDO |
| Tocar Bank/ledger | ❌ PROIBIDO |
| Mexer em frontend | ❌ PROIBIDO |
| Tocar `CRIACAO_DE_EMPRESAS.md` | ❌ PROIBIDO |
| Tocar `criacao-de-empresa.png` | ❌ PROIBIDO |
| Tocar `fluxo-empresa.png` | ❌ PROIBIDO |
| Sugerir R2 antes de 0113 fechar | ❌ PROIBIDO |
| Inferir actorId sem gate | ❌ PROIBIDO |
| Criar actor em GET (side-effect) | ❌ PROIBIDO |
| Usar LIMIT 1 em resolver de actor | ❌ PROIBIDO |
| Chamar getActiveActor em GET | ❌ PROIBIDO |

---

## 4. ARQUIVO DE MEMÓRIA PERMITIDO

```
docs/memorias/MINHA_MEMORIA_ACTOR_USERS.md
```

Só este. Nenhum outro arquivo de escrita. Acrescento; nunca apago histórico.

---

## 5. DOCUMENTOS LIDOS NO BOOTSTRAP (2026-06-09)

| Documento | Status |
|-----------|--------|
| `docs/01_normative/00_AGENT_PROTOCOL.md` | ✅ LIDO |
| `docs/01_normative/CONSTITUICAO_UNIFICARD.md` | ✅ LIDO |
| `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md` (parcial) | ✅ LIDO (Lei 1–7) |
| `docs/01_normative/03_IDENTITY_CANONICA.md` | ✅ LIDO |
| `docs/01_normative/02_ACTORS_SSOT.md` | ✅ LIDO |
| `docs/01_normative/AUTHORITY_LAW.md` | ✅ LIDO |
| `docs/01_normative/AUTHORITY_ENFORCEMENT_MODEL.md` | ✅ LIDO |
| `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md` | ✅ LIDO |
| `docs/01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md` | ✅ LIDO |
| `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md` | ✅ LIDO |
| `STATUS_EXECUCAO_GLOBAL.md` (top 150 linhas) | ✅ LIDO |
| `REMEDIATION_DT_LOG.md` (top 100 linhas) | ✅ LIDO |
| `REMEDIATION_DECISIONS_LOG.md` (top 100 linhas) | ✅ LIDO |
| `opus.md` (top 100 linhas — estado mais recente) | ✅ LIDO |
| `docs/01_normative/08_AUTORIDADE_CANONICA.md` | ⚠️ NÃO LIDO (arquivo existe; ler na próxima auditoria profunda) |
| `docs/01_normative/AUTHORITY_PRECEDENCE.md` | ⚠️ NÃO LIDO (arquivo existe; ler na próxima auditoria profunda) |
| `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md` | ⚠️ NÃO LIDO (arquivo existe; bootstrap mínimo coberto pelos acima) |
| `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` | ⚠️ NÃO LIDO (referenciado via contratos lidos) |

**Código vivo lido:**
- `backend/src/core/action-context/action-context.middleware.ts` ✅
- `backend/src/plugins/action-context.plugin.ts` ✅
- `backend/src/core/actor-registry/actor-registry.service.ts` (parcial) ✅
- `backend/src/core/authorization/authorization.service.ts` — método `canRepresentActor` ✅

**Nota:** os 4 documentos não-lidos existem no repositório; não são ausentes. Não disparam STOP de bootstrap. Devem ser lidos antes de auditoria no domínio de delegação/precedência de autoridade entre entidades.

---

## 6. AS TRÊS CAMADAS DE IDENTIDADE

```
global_user_id ≠ user_id ≠ actor_id
```

| Camada | O que representa | Escopo | SSOT |
|--------|-----------------|--------|------|
| `global_user_id` | A **pessoa física real** (CPF) | Global, sem tenant | `identities` / `03_IDENTITY_CANONICA.md` |
| `user_id` | **Conta técnica/contextual** no tenant | Por tenant (user_id por tenant) | `users` (contexto do tenant) |
| `actor_id` | **Papel operacional** que age no sistema | Por tenant, ligado a identidade ou PJ | `actors` / `02_ACTORS_SSOT.md` |

**Resolução técnica canônica:**

```
(global_user_id, tenant_id) → user_id
user_id → actors (via user_id coluna ou company_users / delegações)
```

Nunca resolver actorId a partir de identidade por heurística. Nunca inferir actor.

---

## 7. POR QUE ELAS NÃO PODEM SER COLAPSADAS

- `global_user_id` é ontológico, permanente, histórico. Não pode mudar. Não depende de tenant.
- `user_id` é técnico e contextual. Uma pessoa pode ter `user_id` em múltiplos tenants.
- `actor_id` é operacional. Uma pessoa pode operar como PF (actor humano), PJ (empresa), grupo, etc. ao mesmo tempo.

**Colapsar é:**
- Criar identidade por tenant (proibido — §5 de `03_IDENTITY_CANONICA.md`)
- Tratar usuário como sinônimo de actor (proibido — §10 de `02_ACTORS_SSOT.md`)
- Inferir actor a partir de sessão/token/request (proibido — §10 de `02_ACTORS_SSOT.md`)

**O drift real NÃO é o colapso dos IDs (que são layers legítimas). O drift real é:**
- Fragmentação de `actor_type` (vocabulário não-canônico)
- Readers fazendo lookup direto por `actorId` sem gate de representabilidade
- `actorId` vindo do cliente sem validação server-side
- Actors sem âncora civil (sem CPF)
- `actionContext` usado como autoria soberana sem `canRepresentActor`

---

## 8. O QUE É ACTOR

Actor é a **unidade ontológica de ação** do sistema.

> "Se age → é actor. Se não age → não é actor."
> — `02_ACTORS_SSOT.md` §1

- Actor é operacional (não é identidade, não é conta, não é perfil, não é sessão)
- Actor NUNCA pode existir sem CPF responsável (mesmo PJ precisa de CPF âncora)
- Actor pode ser: Pessoa Física, PJ, Sistema, Serviço, Instituição, Agente Automatizado
- Capabilities de actor vêm de `actor_registry` e são declaradas por tipo (`company`, `event`, `group`, etc.)
- `getDefaultCapabilities('company')` retorna `can_manage_marketplace: true` para TODA company — isso NÃO é autoridade sobre um actor filtrado; é gate de módulo. (**Armadilha documentada: capability ≠ autoridade sobre o alvo.**)

**Crachá operacional. Crachá não abre porta. A catraca server-side abre ou bloqueia.**

---

## 9. O QUE É USER

User é a **representação técnica e contextual** de uma pessoa em um tenant.

- `user_id` = conta técnica no tenant
- Existe dentro do escopo de um `tenant_id`
- Pode mudar (desativado, reativado, migrado)
- NÃO carrega autoridade nem permissão diretamente
- NÃO é sinônimo de actor

**Resolução:** `req.user.userId` = `user_id` na sessão autenticada. É o ponto de partida para `canRepresentActor`.

---

## 10. O QUE É GLOBAL_USER

Global user é a **âncora de identidade global** da pessoa física.

- Representa o CPF: "quem a pessoa É no mundo"
- Um `global_user_id` por pessoa, independente de tenant
- Não pode ser duplicado, não pode ser descartado
- Não confere poder por si só
- Resolução técnica: `(global_user_id, tenant_id) → user_id`

**Se não existe `global_user_id`, não existe pessoa no sistema.**

---

## 11. O QUE É IDENTITY

Identity é a **raiz ontológica** + **autoridade de KYC/documento**.

- Tabela `identities` = SSOT de dados fiscais e KYC (`tax_id`, `tax_id_type`, `kyc_status`, `kyc_level`)
- Chave por `global_user_id`
- Permanente, histórica
- NÃO define poder, NÃO autoriza ações, NÃO decide permissões
- Identidade fiscal PJ (CNPJ) tem casa própria — não compete com identidade PF (DECISION-0084)

**Violação crítica:** ler KYC/fiscal de `actors` ignorando `identities` quando disponível para o mesmo `global_user_id` = falha estrutural equivalente ao Gate 2.

---

## 12. O QUE É AUTHORITY

Authority é o **direito soberano de decidir, delegar, assumir risco e responder juridicamente**.

- Definida em `AUTHORITY_LAW.md` (Constituição de Autoridade)
- Authority ≠ permissão técnica
- Authority ≠ role organizacional
- Authority ≠ configuração de produto
- **Raiz humana irrenunciável:** toda autoridade deriva de um ator humano com CPF
- **ATL (Authority Trust Level):** ATL0→ATL4; só modificável por norma/Risk Authority, nunca por produto/tenant/feature flag
- **IA não cria nem delega autoridade** (Art. 11)
- Toda ação econômica tem UM responsável econômico único (Art. 3)

**Catraca server-side. A IA resolve; o sistema bloqueia ou libera.**

---

## 13. O QUE É ACTIONCONTEXT

ActionContext é um **hint de canal-1** (DECISION-0113), não autoridade soberana.

```typescript
interface ActionContext {
  actorId: string;   // HINT — não é autoridade
  intent: string;
  source: string;
  scope: string;
}
```

- Propagado pelo middleware `action-context.middleware.ts`
- Pode vir de: header `x-action-context`, body `actionContext`, query `actionContext`
- O middleware valida **formato e scope** (deve conter tenantId), **NÃO** valida se o user pode representar o actorId
- Validação de autoria = **`canRepresentActor(tenantId, req.user.userId, actionContext.actorId)`** no handler

**Armadilha histórica documentada (opus.md cont.157):**
> O comentário "actor-first: ownerId vem do contexto, nunca do cliente" era falso senso de segurança — actionContext.actorId é hint (lido pelo middleware, que valida só formato/scope).

**Regra:** `actionContext.actorId` declarado é HINT. Autoria soberana só com `canRepresentActor` server-side antes da operação.

---

## 14. O QUE É R2/DELEGAÇÃO

R2 é a **próxima raiz arquitetural** após o fechamento real de DECISION-0113.

- Define como um actor pode **delegar** permissões a outro (ex.: empresa delega para funcionário)
- Implementado via `actor_delegations` (tabela de delegação ativa, com escopo/validade/revogação)
- `canRepresentActor` já inclui delegação ativa como vetor 5 (via `findActiveDelegation`)
- **Congelado:** R2 NÃO avança antes de DECISION-0113 fechar completamente (denominador real dos 5 canais)
- Desenho de R2 está bom mas a premissa "0113 fechada" envelheceu (ver `dividas.md`)

**STOP permanente:** nunca sugerir implementação de R2 enquanto DT-mãe 0113 estiver OPEN.

---

## 15. O QUE É RESPONSABILIDADE CIVIL

Responsabilidade civil é a **âncora humana irrenunciável** de toda ação no sistema.

- Todo actor deve ter `responsible_actor_id` rastreável até um CPF (actor humano)
- Actors de sistema (`actor_system`) são infraestrutura — não substituem pessoa física em obrigações civis
- Saída de actor NÃO apaga responsabilidade histórica
- Transferência de empresa NÃO apaga âncora civil anterior — registra nova âncora com trilho temporal
- Multiplicidade de personas (PJ, grupos) AUMENTA o dever de vigilância do CPF

**Regra de autoria em rotas sensíveis:**
- `req.user.userId → ensureUserActor()` SÓ quando o writer for autorizado (write com criação legítima de actor)
- `GET` não deve ter side-effect → não chamar `getActiveActor` ou `ensureUserActor` em rotas de leitura
- `req.actionContext.actorId` não é autoria soberana se vier do cliente sem `canRepresentActor`

---

## 16. CAMPANHA DECISION-0113

### Princípio central

```
actorId declarado pelo cliente é HINT, não autoridade.
```

### Os 5 canais

| Canal | Source | Exemplo | Status (2026-06-09) |
|-------|--------|---------|---------------------|
| **Canal 1** | `actionContext.actorId` | header x-action-context | COBERTO (middleware + canRepresentActor por arquivo) |
| **Canal 2** | `x-actor-id` header | `resolveActiveActorFromRequest` | PRIMITIVO CORRIGIDO (`9996cbd2`); await sweep confirmar |
| **Canal 3** | query `actorId` / `actor_id` | `?actorId=` | MAIORIA COBERTA; re-sweep exaustivo pendente |
| **Canal 4** | params `:actorId` | `/actors/:actorId/dispatches` | PARCIALMENTE COBERTO; opportunity-dispatch selado |
| **Canal 5** | params `:id` de recurso privado | `/accounts/:accountId`, `/invoices/:invoiceId` | PARCIALMENTE COBERTO; account, invoice, payment-method selados |

### Pergunta de auditoria em toda rota

> "O gate valida o MESMO sujeito que dirige a leitura/escrita?"

Se não validar:
- A vivo (ativo)
- Bloqueia 0113
- DT-mãe NÃO fecha

### Estado atual (HEAD 0933b188, 2026-06-09)

Selados por Yala:
- `unified-calendar` — `?actorId` gateado por canRepresentActor; sem actorId = self server-side read-only
- `invoice by-id` — valida emissor/destinatário; admin escape sem LIMIT 1; ambiguidade fail-closed
- `payment-method` reads — list/by-id/default com canRepresentActor; list sem actorId = financial:view_all_ledger
- `account` reads — /:accountId e /balance com owner real; list e /owner = financial:view_all_ledger
- `unified-availability` — arquivo inteiro fechado ponta-a-ponta (7 GETs + writes + participants + bookings)
- `opportunity-dispatch` — canRepresentActor sobre req.params.id (actor alvo)
- `marketplace-inventory` — canRepresentActor sobre query.actorId (corrigido após FAIL Yala)
- `dashboard/reports` — 6 rotas A money-adjacent com helper resolveReportActorId
- `economic-overview` — canRepresentActor sobre req.params.actorId

**DT-mãe OPEN.** Fecha SOMENTE com denominador completo dos 5 canais + Yala sweep final.

### Re-sweep exaustivo pendente

- Grep backend inteiro por `?actorId`/`/:actorId`/`/actors/:id`/`actor_id` — NÃO lista de memória (já mentiu)
- b2b-contracts / availability / organization
- groups economy (`/economy/groups/:groupId/overview` — gate de membership/role, não canRepresentActor simples)
- settlement / AP / AR (owner ambíguo, STOP até READ-FIRST)
- `/regions/:id/account` (decisão Clayton: transparência vs admin)
- marketplace identity/sla (RE-AUDITAR à luz do FAIL de can_manage_marketplace default)
- FASE 6 / RBAC real = BLOQUEADO até 0113 fechar OU preservar canRepresentActor dentro de requirePermission

---

## 17. DÍVIDAS TÉCNICAS CONHECIDAS DO EIXO ACTOR/USERS

| DT | Status | Descrição |
|----|--------|-----------|
| DT-mãe DECISION-0113 | **OPEN** | 5 canais de actorId sem gate server-side; fecha só com denominador completo |
| DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP | **OPEN** | `actor_has_permission` stub RETURN FALSE; FASE 6 não pode avançar antes de 0113 fechar; patches 0113 são defesa-em-profundidade load-bearing |
| DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION | **OPEN** | 3 vocabulários de actor_type coexistindo; `chk_actor_requires_identity` inefetiva sobre `actor_type='user'` runtime |
| DT-FINDORCREATEUSERACTOR | **CLOSED** (F3.1 v2) | register identity-before-actor + fail-closed |
| DT-UNIFYCARD-ACQUIRING-LEGACY-TOMBSTONE | **OPEN** | UnifyCard proxy reject-all = C-INERTE; reativação exige frente financeira governada |
| DT-MONEY-LATENT-REACTIVATION-TRAP | **OPEN** | Família geral de "neutralizado hoje, religar sem gate revive" |
| DT-C1-LEARNING-INTEREST-REACTIVATION | **OPEN LOW** | edge 409 |
| DT-RECOVERY-PAYOUT-GATE | **PARTIAL** | payout externo futuro |
| 94 atores legados `global_user_id IS NULL` | **OPEN** | backfill é fatia futura (DECISION-0062 F4/F5 pendentes) |

---

## 18. STOPS DA IA-ACTOR-USERS

Registro STOP e NÃO concluo quando:

1. **Owner ambíguo:** recurso by-id sem FK clara para actor_id — parar, fazer READ-FIRST do schema, confirmar ownership antes de gatear.
2. **Decisão de produto pendente:** qual parte de um recurso bi-lateral pode acessar o quê (ex.: groups economy = membership/role vs canRepresentActor).
3. **SSOT ausente:** tabela de recurso ausente no DB vivo (ex.: `invoices` ausente em DEV → behavioral N/A honesto).
4. **Canal-2 x-actor-id:** sempre verificar `resolveActiveActorFromRequest` antes de declarar canal-2 limpo.
5. **re-sweep incompleto:** nunca fechar DT-mãe 0113 com lista de memória — exige grep 1ª mão do backend inteiro.
6. **R2/delegação:** qualquer pedido de desenho ou implementação de R2 enquanto 0113 OPEN → STOP.
7. **Documento normativo ausente/ilegível quando relevante:** registrar STOP, não concluir.
8. **getActiveActor em GET:** se sugerido como resolver de actorId em rota de leitura → STOP, usar SELECT read-only (padrão DECISION-0069).
9. **LIMIT 1 em resolver de user-actor:** se encontrado → STOP, exigir correção fail-closed (0 ou >1 → erro).

---

## 19. COMO RESPONDER A PEDIDOS DA EXECUTORA

Protocolo fixo para qualquer pedido de análise de rota:

```
RESPOSTA PARA: IA DIRETORA

VEREDITO: [A vivo | F (fechado/OK) | E (stub/ausente) | C (filtro morto) | M (money, parar) | INCONCLUSIVO]

CANAL: [1-actionContext | 2-x-actor-id | 3-query | 4-params:actorId | 5-params:id-recurso]

EVIDÊNCIAS:
- Arquivo: [path]
- Handler: [nome]
- Linha crítica: [o que lê sem gate]
- Ownership do recurso: [onde está o actorId do dono — provado ou não]
- Bank materialidade: [SIM/NÃO — grep bank_*]

RISCOS:
- [descrever: IDOR / mass-disclosure / autoria-spoofável / etc.]

RECOMENDAÇÃO:
- [canRepresentActor(recurso.actorId) | financial:view_all_ledger | decisão Clayton | outro]
- [resolver owner ANTES do gate (by-id) | actorId do params (canal-5) | etc.]

STOPS:
- [listar se algum bloqueador existe]
```

**Classificação por tipo:**
- **actorId hint:** actorId vem do cliente sem gate → A vivo
- **self server-side:** sem actorId = resolve o próprio user (read-only SELECT, não getActiveActor)
- **owner real de recurso:** actorId vem do recurso no DB, não do params → provar FK
- **admin cross-actor:** listagem de múltiplos actors → financial:view_all_ledger (não canRepresentActor)
- **R2/delegação:** tem actor_delegations ativa → canRepresentActor já cobre (vetor 5)
- **by-id privado:** params.id = resourceId (não actorId) → resolver owner real do recurso
- **dead/stub:** rota registrada mas reject/501/tabela ausente → C-INERTE ou E
- **inconclusivo:** ownership ambíguo → STOP + READ-FIRST

**Nunca:** implementar, criar actor em GET, usar LIMIT 1, sugerir R2 com 0113 aberta.

---

## 20. PRÓXIMAS AUDITORIAS RECOMENDADAS

Por ordem de prioridade (estado 2026-06-09):

1. **RE-SWEEP EXAUSTIVO de actorId** — grep backend inteiro (não lista de memória). Denominador real dos 5 canais. Cada arquivo encontrado = READ-FIRST → classificar → veredito.

2. **marketplace identity/sla** — RE-AUDITAR: foram classificadas F-OK sob `can_manage_marketplace`, mas essa capability é DEFAULT de toda company (igual ao FAIL de marketplace-inventory). Podem ser A pelo mesmo motivo.

3. **b2b-contracts / availability (rotas) / organization-units** — classificadas E (stub/tabela ausente no DB vivo) mas precisam confirmação de 1ª mão no DB atual.

4. **groups economy** (`/economy/groups/:groupId/overview`) — NÃO é `canRepresentActor` simples; exige decisão sobre gate de membership/role de grupo. STOP até decisão Clayton.

5. **settlement / AP / AR** — owner ambíguo (STOP declarado). READ-FIRST obrigatório do schema de settlements antes de qualquer patch.

6. **`/regions/:id/account`** — decisão Clayton: transparência regional vs admin. STOP até decisão.

7. **FASE 6 / RBAC real** — BLOQUEADO até 0113 fechar OU preservar `canRepresentActor` dentro de `requirePermission` (rbac.plugin:151 já o faz — remover esse bind ressuscita autoria spoofável globalmente).

8. **`08_AUTORIDADE_CANONICA.md` + `AUTHORITY_PRECEDENCE.md`** — não lidos neste bootstrap; ler antes de auditoria profunda de delegação/precedência de autoridade entre entidades.

---

## FRASE-GUIA

```
User é sessão.
Actor é crachá operacional.
Authority é catraca.
SSOT é cartório.
Bank é cofre.
Frontend é balcão.

Crachá não abre porta.
Catraca server-side abre ou bloqueia.

actorId do cliente é HINT.
canRepresentActor é a prova.
```

---

## HISTÓRICO DE ATUALIZAÇÕES

| Data | Conteúdo |
|------|----------|
| 2026-06-09 | Criação inicial — bootstrap completo, 20 seções, estado HEAD 0933b188 |
