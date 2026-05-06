# PROPOSTA — `actor_registry` como projeção operacional para authority (runtime)

> **ESTADO OPERACIONAL DO §GLOBAL BLOCK:** ver `STATUS_EXECUCAO_GLOBAL.md` (raiz do repositório)  
> **REGRA NORMATIVA:** definida em `PLANO_BASE_MODULO.md` (secção §GLOBAL BLOCK).  
> ⚠️ **Estado operacional pode variar por data.** Ver sempre `STATUS_EXECUCAO_GLOBAL.md`.

**Estado:** PROPOSTA — aguarda validação humana (`APROVADO` / `REJEITADO`).  
**Enquadramento:** `PLANO_BASE_MODULO.md` §5.1, §12; `00_AGENT_PROTOCOL.md` §2.3.2–2.3.3; `LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md` §4.9 (authority) e §5 (não-duplicação).  
**Contexto desta PROPOSTA:** execução material (migration, seed, endpoints) **proibida** até decisão humana explícita (`APROVADO` / conforme template da PROPOSTA). O valor actual de **§GLOBAL BLOCK** e condições de desbloqueio estão sempre em `STATUS_EXECUCAO_GLOBAL.md` — **não** inferir só a partir deste documento.

---

## 1. Classificação

| Eixo | Classificação |
|------|----------------|
| **Pilar** | **authority** (resolução de “pode atuar como”; §4.9 da lei) |
| **Natureza da tabela** | **Projeção materializada / índice relacional** — suporta ramos de `canActAs` que consultam registo por `(tenant_id, actor_id)` ou por entidade; **não** substitui mapa canónico de `permissionKey` nem o serviço de authority. |
| **SSOT — identidade operacional** | `actors` (como em `SSOT_REGISTRY_UNIFICARD.md` §5.1). |
| **SSOT — identidade civil / documento** | `identities` (+ precedência em `IDENTITY_SSOT_PRECEDENCE.md` quando aplicável). |
| **`actor_registry` é SSOT?** | **Não.** Não define “quem é” nem “quem pode” sozinha; apenas **materializa** vínculos já existentes no modelo (actor ↔ entidade) para consulta determinística **sem** inferência de papel a partir desta tabela. |

---

## 2. Objetivo

1. **Eliminar falha técnica imediata:** queries a `actor_registry` deixam de falhar com `42P01` (relação inexistente) quando o código chama `actorRegistryService.findByActorId` a partir de `authorization.service` / guards de permissão.  
2. **Manter a norma:** não introduzir segunda fonte de verdade para identidade, KYC, nem para decisão final de permissão (mapa canónico + `canActAs` / fachada `authority.service` permanecem autoridade normativa de produto).

---

## 3. Compatibilidade obrigatória com o código existente

O serviço `backend/src/core/actor-registry/actor-registry.service.ts` executa `SELECT * FROM actor_registry` e espera, no mínimo, as colunas:

- `registry_id` (UUID, PK)  
- `tenant_id` (UUID, FK → `tenants.id`)  
- `actor_id` (UUID, FK → `actors.id`)  
- `actor_type` (`VARCHAR`, valores usados pelo serviço: `company` | `event` | `group` | `service` | `project`)  
- `entity_table` (`VARCHAR`)  
- `entity_id` (`UUID`)  
- `capabilities_json` (`JSONB`, default `{}`)  
- `created_at`, `updated_at` (`TIMESTAMPTZ`)

**Conclusão:** a PROPOSTA **não** admite DDL apenas com `(actor_id, tenant_id, created_at)` — violaria o runtime actual. A migration canónica deve **alinhar-se a este contrato físico** (ou exigir alteração de código em PROPOSTA separada, explicitamente aprovada).

---

## 4. Estrutura DDL proposta (alinhamento repo ↔ banco)

- **Ficheiro:** nova migration em `backend/migrations/` com timestamp e nome explícito (ex.: `…_actor_registry_baseline.sql`).  
- **Forward-only, idempotente:** `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` onde a lei e o checklist do plano base permitirem para este ambiente (PARTIAL/EMPTY); **sem** `DROP` de dados.  
- **FKs:** `tenant_id` → `tenants(id)`; `actor_id` → `actors(id)` — **não** reutilizar nomes legados `tenant_id` / `actor_id` como colunas PK de `tenants`/`actors` do arquivo `migrations_archive/` (drift conhecido).  
- **RLS:** seguir o padrão das tabelas críticas do projeto (política por `app.current_tenant` + papel `unificard_infra` se já for norma nas migrações vizinhas).  
- **Unicidade:** `(tenant_id, actor_id)` e `(tenant_id, entity_table, entity_id)` — coerente com `ON CONFLICT` já usado no `INSERT` do serviço.

*(O detalhe SQL exacto fica para a fase **APROVADO → executar**, não neste documento.)*

---

## 5. Natureza e garantias

| Garantia | Descrição |
|-----------|-----------|
| **Sem nova semântica de domínio** | A tabela não define regras de negócio; só persiste mapeamentos **já deriváveis** de `actors` + entidades (`users`, `companies`, …) conforme política de população aprovada. |
| **Sem ownership de permissões** | Não armazena `permissionKey`, roles globais, nem matriz de RBAC — isso permanece no mapa canónico e nos serviços de authority. |
| **Sem inferência de “pode”** | `capabilities_json` no modelo actual é **atributo técnico** do registo; a PROPOSTA impõe **limites** na evolução (ver §7). |

---

## 6. População de dados (fora do DDL — segunda decisão)

Desbloquear **só** a existência da tabela **não** garante `findByActorId` retornar linha para actors `actor_human` usados em `canActAs`. É necessário **sub-PROPOSTA** ou anexo aprovado para:

- regras de **seed** / backfill (ex.: uma linha por `(tenant_id, actor_id)` de actors humanos com `entity_table` / `entity_id` canónicos apontando para `users`); **ou**  
- alteração controlada do fluxo em `authorization.service` para não depender de `actor_registry` para ownership directo humano (só com RFC + PROPOSTA própria).

**Esta PROPOSTA** cobre **DDL + classificação + limites**; **população** exige linha explícita no `APROVADO` ou documento filho.

---

## 7. Limites explícitos (evolução)

É **proibido** sem nova PROPOSTA / RFC:

1. Adicionar colunas de **roles** ou **permission** como fonte decisória.  
2. Usar `actor_registry` para **inferir ownership** civil (CPF/CNPJ) em substituição a `identities` / `actors`.  
3. Expandir `capabilities_json` para **poderes** não auditáveis ou não alinhados a `soft-block.service` / mapa canónico.  
4. Tratar contagens ou agregações sobre esta tabela como **gate** de identidade (A1–A4) — os gates continuam em `identities` / `actors` / scripts `identity:*`.

---

## 8. Riscos

| Risco | Mitigação |
|-------|-----------|
| **Segunda verdade** | Documentar que o SSOT de “quem existe” é `actors`; o registo é **projeção**; divergência → corrigir fonte ou apagar projeção, nunca “ganhar” sobre `actors`. |
| **Drift código ↔ DDL** | Teste de smoke: `findByActorId` após migrate; grep de `FROM actor_registry` no repo. |
| **§GLOBAL BLOCK** | Com **§GLOBAL BLOCK ATIVO**, **nenhuma** população em massa que altere estado civil/identity sem plano `PLANO_IDENTITY_RECONCILIATION.md` aprovado. |

---

## 9. Critério de aprovação

```text
APROVADO: executar opção [A] DDL baseline + [B] política de população ⟨descrever⟩  
REJEITADO: ⟨ motivo ⟩
```

**Assinatura:** ⟨ humano responsável · data UTC ⟩

---

## 9.1 Registo de aprovação e execução (material)

| Data (UTC) | Evento |
|------------|--------|
| 2026-04-16 | **APROVADO** — validação normativa humana (chat). |
| 2026-04-16 | **DDL aplicado** — migration `backend/migrations/20260529130000_actor_registry_baseline.sql` em ambiente alvo via `psql` + `DATABASE_URL` do `backend/.env`. |
| 2026-04-16 | **Código** — `authorization.service.ts`: ramo de ownership alargado a `actor_human` e `person` quando `user_id === userId` (alinhamento 0064 / LEI §4.8.7). |
| 2026-04-16 | **Infra / env** — `backend/src/core/db/load-backend-env.ts`: raiz do pacote `unificard-backend` (walk-up até `package.json`) + releitura da linha bruta de `DATABASE_URL` (dotenv trunca `#` em valores não citados); usado por `migrate.ts`, `pool.ts`, `BOOT.ts`, `schema-guard.ts`. |

**Nota (resolvida no repo):** o `28P01` observado com Node vs `psql` devia-se à truncagem de `DATABASE_URL` pelo dotenv quando a senha contém `#`, não a credenciais distintas. CI/local: garantir `DATABASE_URL` válida; opcionalmente citar o URL inteiro no `.env` se houver `#`.

---

## 10. Pós-aprovação (só após `APROVADO`)

1. Criar migration em `backend/migrations/` conforme §4.  
2. `pnpm migrate` no ambiente alvo (nunca LIVE sem checklist `PLANO_BASE` §12.1).  
3. Registar execução em `docs/03_execution_log/` com referência a este ficheiro + opção aprovada.  
4. **Não** marcar `§GLOBAL BLOCK INATIVO` só por esta mudança — isso exige queries A1–A4 do `PLANO_BASE_MODULO.md` §STATE_TRANSITION.

---

*Fim da PROPOSTA.*
