# PLANO_GROUPS_REFATOR_ARQUITETURAL.md

Versao: 1.1
Data: 2026-04-20
Status: BLOCO 1 EM ANDAMENTO

---

## §A - Estado Atual (BLOCO 1)

Fase atual: BLOCO 1 em andamento
Ultima execucao: 2026-04-20 UTC

Escopo desta fase:
- Inventario de tabelas do dominio groups no banco (information_schema).
- Listagem de arquivos TypeScript do modulo groups por tamanho.
- Gate 2 local: INSERT INTO bank_ / UPDATE bank_ no modulo groups (excluindo testes).
- Actor-writer: ensureUserActor / actorRepository.findOrCreate no modulo groups.

---

## Resultado PASSO 1 — Tabelas do dominio groups

3 tabelas encontradas:

| table_name    |
|---------------|
| group_events  |
| group_members |
| groups        |

Nota: group_events foi criada na migration 20260530420000 (events genesis).
Tabelas ausentes a verificar: group_invites, group_roles, group_bans, group_settings (backlog — confirmar se necessarias).

---

## Resultado PASSO 2 — Arquivos do modulo groups (top 15 por tamanho)

| Arquivo                           | Bytes  |
|-----------------------------------|--------|
| groups.routes.ts                  | 49158  |
| groups.service.ts                 | 38595  |
| groups.repository.ts              | 27215  |
| votes.repository.ts               | 10700  |
| groups.types.ts                   | 10454  |
| votes.routes.ts                   | 10233  |
| votes.service.ts                  | 9275   |
| group-image.service.ts            | 7143   |
| votes.types.ts                    | 3466   |
| groups-state-history.routes.ts    | 2833   |
| groups-closure.routes.ts          | 2641   |
| groups.insights.service.ts        | 2438   |
| group-creation-policy.ts          | 2214   |
| groups.insights.routes.ts         | 1613   |
| groups-repository.adapter.ts      | 1012   |

Observacoes:
- groups.routes.ts (49 KB) e groups.service.ts (38 KB) sao os arquivos criticos.
- Modulo contem subdominio votes (votes.service.ts, votes.repository.ts, votes.routes.ts).
- group-image.service.ts indica acoplamento com armazenamento de imagens.
- groups.insights.service.ts indica metricas/analytics de grupos.

---

## Resultado PASSO 3 — Gate 2 (bank_ writes)

NO_MATCHES

Conclusao: nenhum write direto em banco financeiro detectado no modulo groups. Gate 2 limpo.

---

## Resultado PASSO 4 — Actor-writer

| Arquivo                        | Linha | Ocorrencia                                          |
|-------------------------------|-------|-----------------------------------------------------|
| groups.service.ts              | 13    | import { ensureUserActor } from '@modules/identity/actor-writer.service' |
| groups.service.ts              | 265   | const actor = await ensureUserActor(tenantId, ownerUserId) |
| votes.service.ts               | 6     | import { ensureUserActor } from '@modules/identity/actor-writer.service' |
| votes.service.ts               | 32    | const userActor = await ensureUserActor(tenantId, userId) |
| votes.service.ts               | 134   | comentario: ensureUserActor obtido antes da transacao |

Conclusao: actor-writer canonico em uso nos dois writers principais (groups.service.ts + votes.service.ts). Padrao correto.

---

## Analise FASE S

| Dimensao          | Resultado                                     | Acao requerida |
|-------------------|-----------------------------------------------|----------------|
| Tabelas existem?  | 3 (groups, group_members, group_events)        | Verificar se faltam tabelas (invites, roles, bans?) |
| Gate 2 (bank_)    | NO_MATCHES                                    | Nenhuma        |
| Actor-writer      | ensureUserActor canonico em service + votes   | Nenhuma imediata |
| Volume TS         | 2 arquivos grandes (routes 49KB, service 38KB) | Audit writers/readers |

Sem bloqueador estrutural para avancar ao BLOCO 1.

---

## Proximo passo sugerido

- BLOCO 1: verificar se faltam tabelas (group_invites, group_roles, group_bans, group_settings).
- FASE S.1: mapear writers/readers por arquivo — groups.service.ts (38KB) e votes.service.ts prioritarios.
- FASE S.2: auditoria de campos monetarios (_cents) e booleans (is_ prefix) em grupos/votos.
- Verificar SELECT * em grupos (grep nos 3 principais services).

---

## BLOCO 1 — Evidencias (2026-04-20)

### Tabelas referenciadas no codigo vs banco

| Tabela               | No banco? | Referenciada no codigo?        |
|----------------------|-----------|--------------------------------|
| groups               | SIM       | INSERT/UPDATE/FROM             |
| group_members        | SIM       | INSERT/UPDATE/FROM             |
| group_events         | SIM       | FROM/COUNT (criada em events)  |
| group_accounts       | NAO       | INSERT INTO, FROM, INNER JOIN  |
| group_invites        | NAO       | INSERT INTO, UPDATE (6x)       |
| group_votes          | NAO       | INSERT INTO, UPDATE            |
| group_vote_options   | NAO       | INSERT INTO                    |
| group_vote_responses | NAO       | INSERT INTO                    |

Tabelas faltantes: 5 (group_accounts, group_invites, group_votes, group_vote_options, group_vote_responses)

### Writers mapeados

| Arquivo                   | Tabela               | Tipo           |
|--------------------------|----------------------|----------------|
| groups.repository.ts:157  | groups               | INSERT         |
| groups.repository.ts:388  | groups               | UPDATE         |
| groups.repository.ts:409  | groups               | UPDATE         |
| groups.repository.ts:429  | group_members        | INSERT (upsert)|
| groups.repository.ts:561  | group_accounts       | INSERT         |
| groups.repository.ts:646  | group_invites        | INSERT         |
| groups.repository.ts:668  | group_invites        | UPDATE         |
| groups.repository.ts:702  | group_invites        | UPDATE         |
| groups.repository.ts:728  | group_invites        | UPDATE         |
| groups.repository.ts:771  | group_invites        | UPDATE         |
| groups.repository.ts:812  | group_invites        | UPDATE         |
| votes.repository.ts:96    | group_votes          | INSERT         |
| votes.repository.ts:137   | group_vote_options   | INSERT         |
| votes.repository.ts:263   | group_vote_responses | INSERT         |
| votes.repository.ts:360   | group_votes          | UPDATE         |
| votes.service.ts:55       | group_votes          | INSERT (DT!)   |
| votes.service.ts:105      | group_vote_options   | INSERT (DT!)   |

DT detectado: votes.service.ts tem INSERT INTO direto no service layer — deveria delegar ao votes.repository.ts.

### SELECT *

NO_MATCHES — modulo groups limpo.

### Proximos passos BLOCO 1

1. Criar migration genesis para as 5 tabelas ausentes.
2. Registrar DT: votes.service.ts:55,105 tem SQL direto (refatorar para repository).
3. Confirmar gates apos migration.
