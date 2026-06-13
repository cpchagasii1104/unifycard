# 2026-06-13 — F-REGISTER-PUBLIC-CONTRACT-AND-REFERRAL-HARDENING

Frente **documental** de fechamento de cartório do cadastro/referral, sem reabrir
runtime. Parent `702dd722` · branch `rescue-structural`.

## Escopo entregue

### A/B — Contrato/API pública (`docs/01_normative/contracts/PUBLIC-API-CONTRACT.md`, v1.0.0 → v1.1.0)
- Novo endpoint documentado **`GET /auth/check-referral`**: rota pública pré-sessão;
  `{ valid: boolean }`; formato inválido → 400; código inexistente → `{ valid:false }`;
  rate-limit `auth.check-referral`; tenant `unificard-inicial` server-side; `x-tenant-id`
  não-autoridade; frontend `apiFetchPublic`; `/auth/register` = validação soberana final.
- `POST /auth/register` corrigido (stale): `x-tenant-id` IGNORADO como autoridade (tenant
  institucional server-side; **não cria** `user-*`); `gender` com **5 valores** canônicos
  (`male`/`female`/`non_binary`/`other`/`prefer_not_to_say`); nota de referral transacional
  (DECISION-0119) na resposta; `tenantId` retornado = `unificard-inicial`.
- Seção de Headers, Changelog (v1.1.0), Referências e footer atualizados.

### C — Comentário stale (`backend/src/core/auth/auth.service.ts`)
- Bloco de validação pré-tx: removida a afirmação "a APLICAÇÃO ocorre pós-commit (dado
  progressivo financeiro)" → agora "vínculo A→B materializado DENTRO da transação de
  nascimento (DECISION-0119 D2); código válido sem vínculo ⇒ rollback total".
- Bloco pós-commit: removido `referral` da lista de "dados progressivos best-effort"
  (perfil/gender seguem progressivos; referral NÃO é mais pós-commit).

### D — `/referral/validate` (`backend/src/core/referral/referral.routes.ts`)
- Comentário da rota marca-a **logada/legada**, **não** usada no pré-cadastro (o pré-cadastro
  usa `/auth/check-referral`); candidata a tombstone documental. **Runtime inalterado.**

### Auditoria de superfície (`backend/docs/audit/AUTH-MODULE-PUBLIC-SURFACE-AUDIT.md`)
- `GET /auth/check-referral` adicionado à lista e auditado (self-contained; tenant
  server-side; não usa `req.tenant`/`req.user`/`x-tenant-id` como autoridade).

### E — `users.referral_code` UNIQUE (READ-FIRST, sem migration)
- READ-FIRST dev: 8 códigos, 8 distintos (global e por tenant), **0 colisões**, **nenhum
  índice** sobre `referral_code`. Geração = `crypto.randomBytes(4)` (8 hex) com unicidade
  por check-then-write tenant-scoped (sem UNIQUE no banco → janela de corrida improvável).
- Registrada **`DT-REFERRAL-CODE-UNIQUE-HARDENING` OPEN**: recomenda UNIQUE parcial
  `(tenant_id, UPPER(referral_code)) WHERE referral_code IS NOT NULL` em fatia própria com GO.
  Dados limpos ⇒ não exige PARAR para novo GO; hardening eletivo, não correção urgente.

## Gates / tsc

- `git diff --check`: **0** (trailing whitespace de hard-break markdown removido das linhas tocadas).
- `validate:actor-writer-boundaries`: **GATE OK**.
- `validate:bank-ledger-boundaries`: **GATE OK**.
- `validate:regression-guards`: **EXIT 0**.
- `validate-architectural-patterns --strict`: **critical_new=0** (4 warnings textuais pré-existentes).
- tsc backend: **25 pré-existentes (arco 0113), ZERO novo** em auth/referral/register.
- tsc frontend: **0**.

## Hard stops respeitados

Zero Bank (ledger/transactions/splits/accounts); split-engine/percentual/janela/política
intactos; `user_referral_links` não tocada; **sem migration**; PJ/CNAE/catálogo/permissões/
authority intocados; FASE 6 não ativada; R2/delegação intocados; sem refactor de runtime
(só comentários); DECISION-0119 não reaberta.

## Estado

- F-REGISTER-PUBLIC-CONTRACT-AND-REFERRAL-HARDENING: **IMPLEMENTED / HOLD PARA CONFERÊNCIA**.
- Não seguir para authority/PJ/cargos/grants/CNAE.
