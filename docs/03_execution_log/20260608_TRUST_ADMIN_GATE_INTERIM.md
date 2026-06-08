# Execução — F-TRUST-ADMIN-GATE-INTERIM (DECISION-0113, classe F: compliance NU → role-admin) — backend

**Data:** 2026-06-08 · **Modo:** EXECUÇÃO CONTROLADA (reads+writes no mesmo corte por exceção justificada) · **Branch:** `rescue-structural` · **HEAD origem:** `24c8d92d`
**Decisor:** Clayton/IA diretora (role-admin, NÃO canRepresentActor; sem vocabulário novo; modelo fino → R2.4) · **Esteira:** eu (escritora); Yala verifica.

## Objetivo
Fechar o **F** da classificação cont.133: o módulo `trust` (risco/anti-fraude/compliance) estava **100% NU** — só `if (!req.tenant)` — em **todas as 6 rotas** (reads E writes). Aplicar **gate-admin interino** que bloqueia no `req.user`, sem inventar o modelo fino de compliance/risco (R2.4).

## Achado READ-FIRST (1ª mão)
- `trust.routes.ts` está em `protectedScope` (auth.plugin garante `req.user`), mas as rotas só checavam `req.tenant` → qualquer caller autenticado do tenant lia o mapa de risco inteiro E escrevia sinais de fraude.
- **6 rotas NU:** GET `/trust/profile/:actorId`, GET `/trust/profiles`, GET `/trust/events`, POST `/trust/events`, POST `/trust/can-proceed`, POST `/trust/recalculate/:actorId`.
- Compliance/anti-fraude é **cross-actor por design**: o operador legítimo precisa ver/agir sobre o risco de OUTROS atores → `canRepresentActor` seria ERRADO (bloquearia o uso legítimo). É a 3ª classe de gate (self / canRepresentActor / **role-admin**).
- `requireRole(['admin'])` é o mecanismo canônico já existente (fatia 1: validateActionContext + assertActorRepresentable + role check; bloqueia 401/403). Não precisa de permission nova.

## Decisão (GO da diretora)
1. Gate = `requireRole(['admin'])` (role-admin real, preso no `req.user`) — **não** `canRepresentActor`.
2. Reads + writes no **MESMO corte** — exceção legítima: a raiz é UMA (módulo inteiro nu); separar D aqui seria artificial.
3. **ZERO permission nova** (`admin:view_risk`/`trust:*` etc.) — "nasce em norma/decisão, não no susto". Modelo fino de compliance/risk = **R2.4**.
4. Sem migration; sem tocar cultural/policy/impact/reputation/marketplace-categories/public-profiles/events-spec/Bank/R2/canal-5-params/F6.5.6b.

## Implementação (backend; 1 arquivo de rota)
`trust.routes.ts`: `const adminOnly = requireRole(['admin'])` definido 1x no topo da função + `{ preHandler: adminOnly as never }` como 2º arg nas 6 rotas (preHandler roda ANTES do handler async → bloqueia antes de qualquer chamada de service). Comentário no topo explica a trava (compliance cross-actor → canRepresentActor errado; INTERINO; R2.4; sem permission nova).

## Prova
- **e2e novo** `validate-pipeline-e2e-trust-admin-gate-interim.ts` **12/12**:
  - **A estrutural:** adminOnly via `requireRole(['admin'])` (sem permission nova); 6 rotas com `preHandler: adminOnly`; cada rota nomeada gateada; POST `/trust/events` (write) gateado.
  - **B disciplina:** ZERO `canRepresentActor(` (só o comentário explica por que NÃO usar — regex `\(` evita casar a palavra no comentário); ZERO permission nova (`trust:`/`risk:`/`compliance:`); marcado INTERINO + R2.4.
  - **C behavioral do mecanismo:** role `admin` existe no tenant (alvo real); admin-pass/non-admin→403 ponta-a-ponta via HTTP reportado **N/A** honestamente (exige fastify.inject + actionContext + fixture); mecanismo `requireRole`/`assertActorRepresentable` coberto pela regressão `rbac-actor-binding` (13/13).
- **Backend tsc** fora de geo = **0**. **4 gates OK** (actor-writer · bank-ledger · regression-guards dev **365** · arch critical_new=0/warning_new=1 baseline c3).
- **Só `trust.routes.ts` no diff** de código (+ e2e novo) — confirmado por `git status`.
- **Regressões verdes:** rbac-actor-binding 13/13 · money-live 12/12 · canal3-money 7/7 · cultural 7/7 · x-actor-id 9/9.

## O que NÃO foi tocado
cultural · policy · impact/balance · impact/ledger (G) · reputation · marketplace-categories · public-profiles · events-spec (→ F6.5.6b) · canal 5 (params `id`) · Bank/ledger · R2 · migration · frontend · nenhuma DT financeira.

## DTs
- `DT-TRUST-MODULE-UNGATED-COMPLIANCE` → **PARTIALLY MITIGATED** (gate-admin interino fecha a porta; o modelo fino de compliance/risco fica para R2.4 → NÃO CLOSED).
- `DT-DIRECT-QUERY-ACTOR-READERS-UNVALIDATED` (DT-mãe) permanece **OPEN**.

## Próximo passo (espera go)
1. Yala sela o trust gate interino. 2. Ler policy / `requirePolicyPermission`. 3. Decidir impact/ledger (G). 4. Voltar para F6.5.6b events → 6.5.7/8/9 → selo final Yala (grep dos 5 canais). **R2 continua congelado.**
