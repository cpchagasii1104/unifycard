# 2026-06-16 — F-CONTACTS-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT

A tabela `contacts` não existe no schema vivo (`to_regclass('public.contacts')=NULL`), mas o módulo
`contact.*` e callers vivos ainda a usam → **42P01 / 500 cru**. Esta frente CONTÉM o schema ghost com falha
honesta (501), **sem criar contacts** (gênese/ownership = frente própria futura). Parent `17f25d66` · branch
`rescue-structural` · dev **389 (ZERO migration)** · backend **code-only**.

## Declaração antes do patch

- **Domínio:** marketplace `contacts` — contenção fail-closed de schema ghost.
- **Docs lidos:** error-handler.plugin (envelope `{error:{code,message},meta}`, respeita `error.statusCode`),
  http-error/AppError (501 + `code` preservado), contact.{routes,service,repository}, os 5 callers, padrão
  canônico 501 (companies/webauthn). **Suficientes** porque o funil único (`contactService`, sem caller direto do
  repository) + o padrão 501 determinam a contenção sem tocar schema/ownership.
- **SSOT afetado:** nenhum (não existe tabela; nada criado). **NÃO é SSOT:** o guard é contenção, não gênese.
- **Sintoma vs causa-raiz:** contém o **sintoma** (42P01/500) honestamente; a **causa-raiz** (gênese de contacts +
  ownership institucional) segue OPEN como frente própria.

## Pré-flight

HEAD `17f25d66` (Evidence Pack era `7e104d70`; o único commit intermediário foi o fix frontend-only de rate-limit
da agenda — NÃO toca contacts; problema inalterado). branch `rescue-structural`. `contacts` confirmada ausente.
Sujeira prévia = memorias/notas pessoais (NADA contacts/CRM/payment-link/venue/subscription) → sem STOP. Archive
`migrations_archive/0065_contacts.sql` existe só como archive (não-SSOT). Nenhuma migration viva cria contacts.

## READ-FIRST — mapa da superfície

- **Funil único:** TODO acesso a `contacts` passa por `contactService`; **nenhum** arquivo importa
  `contactRepository` direto (grep). Callers: rotas `/marketplace/contacts*` (POST/PATCH/GET/GET:id/search/kyc) +
  `fiscal-kyc.service`, `payment-execution.service`, `payment-link.routes`, `subscription.service`, `venue.routes`.
- **Chokepoint do 42P01:** `contact.repository` (INSERT/SELECT/UPDATE em `contacts`), alcançado só via os 6 métodos
  do `contactService` (create/update/getById/getByTaxId/list/linkUser).
- **Padrão canônico de erro:** 501 NOT_IMPLEMENTED/reservado (companies.routes, company-validation.service,
  webauthn). ⇒ erro escolhido = **501 `CONTACTS_SCHEMA_GHOST_CONTAINED`** (AppError carrega `code`, que o
  error-handler preserva mesmo em produção).
- **Caller sensível (payment-execution):** a chamada a `contactService.getContactById` está dentro de `try { … }
  catch (pixError) { warn }` com `if (contact)` opcional → **degrada graciosamente**; o 501 (vs 42P01 de hoje) é
  capturado igual, sem sucesso falso e sem quebrar o PIX.

## Correção (code-only, fail-closed)

- **`contact-feature.guard.ts` (NOVO):** `isContactsFeatureAvailable()` (probe `to_regclass('public.contacts')`,
  cache só do positivo — auto-destrava na gênese sem restart) + `assertContactsFeatureAvailable()` →
  `throw new AppError(501, 'CONTACTS_SCHEMA_GHOST_CONTAINED: …', 'CONTACTS_SCHEMA_GHOST_CONTAINED')`.
- **`contact.service.ts`:** `await assertContactsFeatureAvailable()` no INÍCIO dos **6 métodos** que alcançam o
  repository — contenção ANTES do SQL. Cobre rotas + os 5 callers internos (todos via service).
- **NÃO tocado:** contact.repository (segue como está; só não é mais alcançado quando ghost), callers internos
  (degradam ou propagam o 501 — sem fallback falso), schema, migration, archive.

## Provas

| Prova | Resultado |
| --- | --- |
| backend typecheck (build) | **25** (baseline; 0 em arquivos de contact) |
| guard `audit-contacts-schema-ghost-containment.mjs` (no chain) | GATE OK |
| negative-proof | **4 mordidas** byte-idêntico (assert-removido · probe-quebrado · code-removido · funil-quebrado) |
| e2e efêmero `validate-pipeline-e2e-contacts-schema-ghost.ts` | **9/9** |
| validate:actor-writer-boundaries / bank-ledger-boundaries | GATE OK / GATE OK |
| validate:regression-guards | rc=0 (+1 guard) |
| validate-architectural-patterns --strict | exit 0 · critical_new=0 |

E2E cobre: G0 contacts ausente (`to_regclass`=NULL); T1–T6 POST/PATCH/GET/GET:id/search/kyc → **501**
`CONTACTS_SCHEMA_GHOST_CONTAINED` (não 500/42P01); T7 caller interno (`contactService.getContactById`) → AppError
501 contido; T8 nenhum vazamento de 42P01 (repository NÃO alcançado). Guard prova: 6 métodos guardados ANTES do
repo · funil sem caller direto do repository · nenhuma migration cria contacts.

## Escopo negativo (confirmado)

ZERO migration · ZERO `CREATE TABLE contacts` · ZERO restauração de `migrations_archive/0065_contacts.sql` ·
ZERO Bank/ledger/payout/split/recovery · ZERO suppliers · ZERO PDV · ZERO owner/`owner_actor_id`/`company_id` ·
ZERO CRM genesis · ZERO redesign de payment-link/venue/subscription · ZERO fallback falso/dado fake.

## DT

- **DT-CONTACTS-SCHEMA-GHOST** — sintoma **CONTIDO** fail-closed (501); **gênese/ownership OPEN** (frente própria).
  A gênese remove/ajusta o guard (probe `to_regclass` passa a verdadeiro). Vínculo:
  `DT-SHARED-TENANT-RESOURCE-VISIBILITY-NO-OWNERSHIP-POLICY` (classe D — contacts ghost, "não restaurar archive").

## Estado

**CLOSED / YALA PASS COM RESSALVA.** Fecha SÓ como **F-CONTACTS-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT**: `contacts`
ausente não gera mais 500 cru — toda superfície (rotas + callers via service) responde **501
`CONTACTS_SCHEMA_GHOST_CONTAINED`** ANTES do repository; gênese/ownership de contacts segue como frente própria
futura; archive não restaurado; zero migration. dev 389.

## YALA RESEAL — PASS COM RESSALVA

- **Veredito:** **PASS COM RESSALVA.** Âncora: HEAD `a55f22310fcadd6d2d8b636871267d15d3d6a755` · branch
  `rescue-structural` · parent `17f25d66` · dev 389/389 · zero migration. Conclusão: selar o **containment** como
  CLOSED; **gênese de contacts permanece futura** (NÃO fechada).
- **Provas confirmadas pela Yala:** commit `a55f2231`; `contacts` segue ausente (`to_regclass`=NULL); zero migration;
  archive `0065_contacts.sql` intocado; **501 `CONTACTS_SCHEMA_GHOST_CONTAINED`** em todas as superfícies; repository
  **não alcançado**; **e2e 9/9**; **negative-proof 4 mordidas**; **4 gates verdes** (actor-writer/bank-ledger/
  regression/arch).
- **Escopo negativo confirmado:** ZERO migration · ZERO CREATE TABLE contacts · ZERO restauração de archive ·
  ZERO Bank/ledger/payout/split/recovery · ZERO suppliers · ZERO PDV · ZERO owner/CRM genesis.
- **Ressalvas:**
  - **R1 — to_regclass / auto-destrave futuro (NÃO bloqueia o containment; OBRIGATÓRIA na gênese):** se uma migration
    futura criar `contacts` de forma qualificada/aspada ou fora do padrão reconhecido pelo guard, o runtime baseado em
    `to_regclass` pode destravar o módulo **sem owner institucional**. A futura **F-CONTACTS-GENESIS-INSTITUTIONAL-OWNER**
    deve endurecer/remover o guard conscientemente e impedir **tenant-only sem owner**.
  - **R2 / R3:** sem ressalvas adicionais materiais nesta frente (a Yala não levantou R2/R3 bloqueantes; registrado
    para completude — qualquer item futuro entra na frente de gênese).
- **Fechamento permitido:** SOMENTE da frente de **containment**. **Contacts genesis permanece FUTURA/OPEN**
  (tabela, owner, CRM, ownership institucional — frente própria F-CONTACTS-GENESIS-INSTITUTIONAL-OWNER, carregando R1).
- **Selo:** commit docs-only `docs: seal contacts schema ghost containment`. Estado final: **CLOSED / YALA PASS
  COM RESSALVA**.
