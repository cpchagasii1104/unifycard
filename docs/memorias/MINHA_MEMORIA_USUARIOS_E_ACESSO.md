# MINHA MEMÓRIA — IA-USUÁRIOS-E-ACESSO

> **Protocolo de uso:** esta memória é insumo operacional, **não norma soberana**. Antes de usar qualquer evidência material, **revalidar HEAD, branch, status, schema/código vivo e a fonte soberana aplicável**. Esta instância só pode editar **este arquivo**; a executora `unificard` pode editar sob GO da IA Diretora/Clayton. Protocolo completo: `docs/memorias/README.md`. **Fronteira:** acesso humano/login/role/permissão é meu eixo; `actorId` alvo / `canRepresentActor` / 5 canais 0113 é da IA-ACTOR-USERS (ver README → Fronteira oficial).

## Instância: Auditora Read-Only de Identidade, Acesso e Autoridade
## Data de criação: 2026-06-09 | Branch: rescue-structural

---

============================================================
PEDIDO DA EXECUTORA — 2026-06-09
Status: ABERTO
HEAD no momento do pedido: 1d42a9d2
Branch: rescue-structural
Para: IA-USUÁRIOS-E-ACESSO
Frente relacionada: marketplace residual traps / DECISION-0113 / inventory scope
Prioridade: alta
============================================================

CONTEXTO:
`can_manage_marketplace` é DEFAULT de toda company (actor-registry). Os gates marketplace usavam `requirePermission` (capability) sem `canRepresentActor` sobre o actor alvo — corrigido nos 6 DB-backed. Resta decidir quem legitimamente vê o extrato itemizado tenant-wide de `inventory/movements` (opção d = "só admin/plataforma real"). Ver `DT-INVENTORY-MOVEMENTS-ITEMIZED-CROSSCOMPANY-SCOPE`.

DÚVIDA OBJETIVA:
1. Existe diferença formal entre permissão FUNCIONAL de marketplace (`can_manage_marketplace`) e AUTORIDADE operacional sobre actor alvo?
2. `can_manage_marketplace` (default de company) pode autorizar listagem itemizada cross-company?
3. Alguma role/RBAC/`company_users` existente legitimaria visão tenant-wide itemizada (admin/plataforma/finance)?
4. Se a resposta for admin/plataforma, qual trilho de acesso humano deveria PROVAR isso (qual permission/role concreta)?

EVIDÊNCIA ESPERADA:
- mapa de roles/permissões (RBAC legado/V2), `company_users`, permission-keys vivo;
- classificação; riscos; recomendação; STOPs.

FORMATO DE RESPOSTA ESPERADO:
RESPOSTA DA INSTÂNCIA · HEAD no momento da resposta · Fonte soberana confirmada · VEREDITO · EVIDÊNCIAS · RISCOS · RECOMENDAÇÃO · STOPs · Status: RESPONDIDO ou STALE

STOPs: não editar código · não criar migration · não alterar banco · não commitar · não responder fora do próprio domínio · resposta é insumo, não GO.
============================================================

---

## §1 — IDENTIDADE DA INSTÂNCIA

**Papel:** Auditora read-only de identidade/acesso/autoridade  
**Modo:** READ-ONLY ESTRITO — não edito código, não crio migrations, não fecho DTs  
**Único write permitido:** este arquivo  
**Proibido:** tocar Bank/ledger, frontend, CRIACAO_DE_EMPRESAS.md, .png

---

## §2 — MODELO CANÔNICO (as três camadas)

```
CPF → global_users.global_user_id (QUEM A PESSOA É — cross-tenant, permanente)
           ↓
      users.user_id (QUEM ESTÁ LOGADO — tenant-scoped, técnico)
      users.global_user_id FK → global_users (SET NULL)
           ↓
      actors.actor_id (QUEM ESTÁ AGINDO — papel operacional)
      actors.user_id FK → users (SET NULL)
```

**Invariante fundamental:** global_user_id ≠ user_id ≠ actor_id  
**São três coisas diferentes** com três funções diferentes.

---

## §3 — MAPA DE TABELAS MATERIAIS

### Identidade ontológica
| Tabela | Papel | Âncora |
|--------|-------|--------|
| `global_users` | Identidade cross-tenant | `cpf UNIQUE`, `global_user_id PK` |
| `identities` | KYC/fiscal SSOT | `global_user_id PK`, `tax_id`, `kyc_status`, `kyc_level` |
| `users` | Conta técnica tenant | `user_id = id` (trigger), `global_user_id FK SET NULL` |
| `profiles` | Dados apresentacionais | `tenant_id + user_id PK` |

### Ator operacional
| Tabela | Papel | Chaves |
|--------|-------|--------|
| `actors` | Unidade que age | `actor_id = id` (trigger), `user_id FK SET NULL`, `actor_type` (10 valores) |
| `actor_delegations` | Delegação R2 (CONGELADA) | `user_actor_id → institutional_actor_id`, `scopes_json`, `status`, `expires_at` |

### Empresa/membership
| Tabela | Papel | Roles |
|--------|-------|-------|
| `company_users` | SSOT membros (DECISION-0042) | `role`: owner/admin/staff/contractor/member; `member_status`: active/invited/suspended |

### RBAC (dois sistemas)
| Sistema | Tabelas | Status |
|---------|---------|--------|
| RBAC Legado | `roles`, `permissions`, `user_roles`, `role_permissions` | Legado, não evoluir |
| RBAC V2 | `actor_has_permission()` DB function | STUB RETURN FALSE (DT-RBAC-FAIL-CLOSED) |

### Depreciado
- `user_identity_links` — §10.2 08_AUTORIDADE_CANONICA.md: explicitamente depreciado, não é fonte de autoridade

---

## §4 — MAPA DE CÓDIGO CRÍTICO

### ActionContext middleware (formato apenas, NÃO autoridade)
`backend/src/core/action-context/action-context.middleware.ts`
- Lê actorId de 4 fontes: `x-action-context` header, body `actionContext`, query `actionContext`, body direct fields
- **Valida APENAS:** formato UUID, scope campos obrigatórios
- **NÃO valida:** se userId pode representar actorId
- **Aplicado por:** `action-context.plugin.ts` em TODOS os routes autenticados exceto `GET /social/actors/available`

### RBAC V2 plugin (gate real — cobertura seletiva)
`backend/src/plugins/rbac.plugin.ts`
```
requirePermission('resource:action', 'scope') →
  1. validateActionContext (formato/scope)
  2. assertActorRepresentable → canRepresentActor(userId, actorId) ← GATE DECISÃO-0113
     └── SE false → 403 ANTES de verificar permissão
  3. actorHasAllPermissions → actor_has_permission() → STUB RETURN FALSE
```
**CRÍTICO:** este gate só existe em rotas que USAM requirePermission/requireRole.

### canRepresentActor — 5 vetores
`backend/src/core/authorization/authorization.service.ts`
```
V1: actor.user_id = userId (propriedade direta)
V2: canManageCompany(userId, actor.company_id) (ator de empresa)
V3: actor.owner_actor_id → verify ownership via grupo/page
V4: actor_registry soft-block check
V5: actor_delegations ativas (não revogadas, não expiradas, scope correto)
```

### canManageCompany
```sql
WHERE (cu.can_manage_company = true OR cu.role = 'owner')
  AND cu.is_active = true
  AND cu.member_status = 'active'
```

### Writer único de atores (LEI_COERENCIA §4.8)
`backend/src/modules/identity/actor-writer.service.ts`
- `ensureUserActor(userId, tenantId)` → actor type='user'
- `ensurePageActor(params)` → `responsibleActorId` OBRIGATÓRIO
- `ensureGroupActor(params)` → `responsibleActorId` OBRIGATÓRIO

### identity.service.ts (LEGADO CONGELADO)
- Marcado: "LEGADO PRÉ-GATE-0 — CONGELADO"
- Contém `syntheticCpfForUser()` para users sem CPF real
- **NÃO usar como modelo. NÃO criar novos callers. NÃO evoluir.**

---

## §5 — DECISION-0113: OS 5 CANAIS

| Canal | Veículo | Arquivo | Status (2026-06-09) |
|-------|---------|---------|---------------------|
| C1 | `actionContext` no body/header | action-context.middleware.ts | Em fechamento (gates por rota) |
| C2 | `x-actor-id` header | `resolveActiveActorFromRequest` | Primitivo corrigido `9996cbd2`, aguarda selo+sweep |
| C3 | `query actor_id` | routes de leitura | Em fechamento |
| C4 | `params :actorId` | routes com param | Em fechamento |
| C5 | `params :id` de recurso privado | routes proprietárias | Em fechamento |

**DT-mãe fecha SOMENTE quando todos 5 canais estão selados.**  
F6.5.6b (events) / F6.5.7 / F6.5.8 / F6.5.9 — pendentes.

---

## §6 — ACTOR_TYPE: 10 VALORES (FRAGMENTAÇÃO)

**Correntes (modelo atual):**
- `user` → Pessoa física individual ← **CANÔNICO per §4.8.7**
- `page` → Página/empresa/marca ← **CANÔNICO per §4.8.7**
- `group` → Grupo/comunidade
- `channel` → Canal de conteúdo

**Legado (não evoluir):**
- `actor_human` / `person` → semântica de 'user'
- `actor_organizational` / `company` → semântica de 'page'
- `system` / `actor_system` → ator de sistema

**RISCO:** código que verifica `actor_type = 'user'` não captura rows `actor_type = 'person'` ou `'actor_human'` — mesma semântica, check diferente.  
**DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION:** OPEN.

---

## §7 — RISCOS ATIVOS

### RISCO-1 (ALTO): Rotas sem requirePermission aceitam actorId como fact
ActionContext middleware = HINT extractor.  
Representabilidade = gate exclusivo do rbac.plugin.  
Rotas autenticadas sem requirePermission aceitam actorId do cliente sem canRepresentActor.  
→ DECISION-0113 está fechando rota a rota.

### RISCO-2 (MÉDIO): RBAC legado ignora actor layer
`user_has_permission()` usa user_id → role → permission.  
Não verifica actorId, canRepresentActor, ATL.  
User com role='admin' em legacy pode passar gates que deveriam verificar actor.

### RISCO-3 (MÉDIO): canManageCompany — is_active × member_status inconsistência
`is_active` (campo legado) e `member_status` (DECISION-0042) coexistem.  
Query usa AMBOS. Rows históricas com valores discrepantes = comportamento imprevisível.

### RISCO-4 (ESTRUTURAL): actor_has_permission = STUB RETURN FALSE
Todas as rotas com requirePermission falham-fechadas.  
Arquitetura correta, execução suspensa.

### RISCO-5 (ESTRUTURAL): 94 atores humanos sem user_id (DECISION-0062 pendente)
canRepresentActor V1 (direct user_id match) não funciona para esses atores.

### RISCO-6 (ARCH): AUTHORITY_PRECEDENCE.md ausente
Arquivo citado em referências normativas mas não existe no repo.

---

## §8 — O QUE NÃO TOCAR

| Item | Motivo |
|------|--------|
| `identity.service.ts` | CONGELADO deliberadamente. Não evoluir, não replicar. |
| `actor_delegations` / R2 | CONGELADO até DECISION-0113 fechar |
| RBAC V2 reactivation | DT-RBAC-FAIL-CLOSED-STUB-FASE6. Pré-condições documentadas. |
| `global_users` backfill | Não fazer backfill sintético. CPF real ou nada. |
| `user_identity_links` | Depreciado. Não criar novos callers. |
| RBAC legado (roles/permissions 0060) | Não evoluir. Investimento vai para V2. |

---

## §9 — DÍVIDAS TÉCNICAS CONHECIDAS NESTE EIXO

| DT | Status | Bloqueio |
|----|--------|----------|
| DT-RBAC-FAIL-CLOSED-STUB-FASE6-REACTIVATION-TRAP | OPEN | 0113 + canRepresentActor preserved |
| DT-ACTOR-TYPE-VOCABULARY-FRAGMENTATION | OPEN | Convergência gradual |
| DT-ACTOR-ID-BACKFILL (DECISION-0062 F4/F5) | OPEN | CPFs reais + backfill |
| DT-CONSERVATION-OBSERVABILITY | OPEN | Janelas B/C de divergência |
| user_identity_links callers não auditados | CANDIDATA | Auditoria de callers |
| AUTHORITY_PRECEDENCE.md ausente | CANDIDATA | Criar ou confirmar inexistência deliberada |
| canManageCompany is_active×member_status | CANDIDATA | Normalizar para SSOT único |

---

## §10 — PROTOCOLO DE RESPOSTA À EXECUTORA

Quando a executora perguntar sobre um route/endpoint/operação:

```
RESPOSTA PARA: IA EXECUTORA
VEREDITO: [PASS | FAIL | INCONCLUSIVO | GATE NECESSÁRIO]
CANAL DECISION-0113: [C1/C2/C3/C4/C5 — qual canal está envolvido]
EVIDÊNCIAS:
  - [arquivo:linha — o que o código faz hoje]
  - [norma — o que deveria fazer]
RISCOS:
  - [risco específico se o gate não existir]
RECOMENDAÇÃO:
  - [o que adicionar/verificar — SEM escrever o código]
STOPS:
  - [condições bloqueantes antes de mergear]
```

**Nunca:** sugerir implementação sem citar norma  
**Nunca:** fechar DT  
**Nunca:** abrir DECISION  
**Nunca:** avaliar R2/delegações enquanto 0113 está aberta

---

## §11 — SEQUÊNCIA DE PRIORIDADE RECOMENDADA

1. **DECISION-0113 fechar (F6.5.6b/7/8/9 + x-actor-id sweep)** — bloqueante de tudo
2. **RBAC V2 reactivation** — desbloqueado por 0113; canRepresentActor preserved
3. **Auditoria user_identity_links callers** — independente
4. **Normalizar actor_type** — backfill + grep callers legados
5. **DECISION-0062 F4/F5** (backfill actors.user_id IS NULL) — independente

---

## §12 — FONTES NORMATIVAS LIDAS NESTA SESSÃO

- `docs/01_normative/00_AGENT_PROTOCOL.md`
- `docs/01_normative/CONSTITUICAO_UNIFICARD.md`
- `docs/01_normative/LEIS_OPERACIONAIS_UNIFICARD.md`
- `docs/01_normative/03_IDENTITY_CANONICA.md`
- `docs/01_normative/02_ACTORS_SSOT.md`
- `docs/01_normative/AUTHORITY_LAW.md`
- `docs/01_normative/08_AUTORIDADE_CANONICA.md`
- `docs/01_normative/AUTHORITY_ENFORCEMENT_MODEL.md`
- `docs/01_normative/ACTOR_TRACEABILITY_CONTRACT.md`
- `docs/01_normative/CORE_IDENTITY_AND_ACTORS_CONTRACT.md`
- `docs/01_normative/IDENTITY_SSOT_PRECEDENCE.md`
- `docs/01_normative/LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md`
- `docs/01_normative/SSOT_REGISTRY_UNIFICARD.md`
- `docs/01_normative/AUTHORITY_PRECEDENCE.md` ← **AUSENTE (arquivo não existe)**

## §13 — MIGRATIONS LIDAS

- `backend/migrations/0002_identity.sql` — genesis actors (person/company/system)
- `backend/migrations/0009_create_identities.sql` — tabela identities
- `backend/migrations/0058_users_global_users_profiles_app.sql` — global_users + users + profiles
- `backend/migrations/0060_rbac_roles.sql` — RBAC legado completo
- `backend/migrations/0064_add_user_id_to_actors.sql` — evolução actors (10 tipos + user_id FK)
- `backend/migrations/20260530493000_create_actor_delegations.sql` — actor_delegations
- `backend/migrations/20260530541000_company_users_membership_expansion.sql` — DECISION-0042

## §14 — CÓDIGO LIDO

- `backend/src/core/action-context/action-context.middleware.ts` (completo)
- `backend/src/plugins/action-context.plugin.ts` (completo)
- `backend/src/plugins/rbac.plugin.ts` (completo)
- `backend/src/core/authorization/authorization.service.ts` (linhas 1-100, 320-391, 447-478)
- `backend/src/modules/identity/actor-writer.service.ts` (completo)
- `backend/src/core/identity/identity.service.ts` (linhas 1-100)
- `backend/src/core/actor-registry/actor-registry.service.ts` (linhas 1-100)
- `backend/src/core/companies/companies.service.ts` (canManageCompany method)
- `backend/src/core/rbac/rbac.service.ts` (linhas 1-80)

---

*Instância criada: 2026-06-09. Próxima atualização: quando F6.5.6b–6.5.9 fecharem ou quando x-actor-id sweep selar.*
