# 2026-06-14 — PRIMEIRA ONDA INDEPENDENTE (DECISION-0131) · BATCH 2 (B2f — MONEY UNBOUND)

Pós-PASS Yala de WAVE-1 BATCH-1 (commit `d4dc2a8d`). **B2f** — frente própria e prioritária: as duas rotas
econômicas v2 que CRIAM estado em `event.routes.ts` liam actor declarado no body SEM binding server-side.
Parent `d4dc2a8d` · branch `rescue-structural` · dev **385/385** (sem migration).

## Verificação de 1ª mão (STOP do GO respeitado)

| Rota | Lê do body | Route binda? | Service binda? | Veredito |
| --- | --- | --- | --- | --- |
| POST `/events/:id/economic/v2/custody` | `economic_owner_id` | **NÃO** (só auth+tenant; passa `...req.body`) | **NÃO** (`createCustody` só checa fase/existência/valor; INSERT em `event_custody`+outbox) | **UNBOUND** |
| POST `/events/:id/economic/v2/split` | `parts[].target_id` | **NÃO** | **NÃO** (`calculateSplit` valida % e guarda em Map IN-MEMORY; sem DB/ledger) | **UNBOUND** |

Conclusão: **nenhum binding** (rota nem service). Não concluí "seguro" — provei de 1ª mão que NÃO havia binding e
apliquei. _(Nenhuma das duas move dinheiro: custody = registro declarativo `event_custody`+outbox; split = cálculo
in-memory. Mas autoria spoofável é gap de autoridade real.)_

## Modelo de autoridade aplicado (canônico, sem inventar)

A autoridade correta é sobre o **EVENTO**, não sobre o actor declarado no body: **só quem REPRESENTA o actor dono do
evento (`event.actorId`) pode mexer na economia dele** (`canRepresentActor`, via o helper `userRepresentsActor` já
existente no arquivo — mesmo padrão de F-0113-EVENT-ACTOR-BODY-BINDING). `economic_owner_id`/`target_id` são **DADO**
(beneficiários), não autoridade — e **binding de split por target seria semanticamente errado** (split multi-parte não
exige representar cada beneficiário). _(Decisão registrada para a IA Diretora: bindei no dono do evento, não em
economic_owner_id/target_id; é o controle correto e fail-closed.)_

## Patch

- **`src/core/events/event.routes.ts`:** em CADA uma das 2 rotas econômicas, ANTES do side-effect:
  `eventService.getEvent(...)` (404 se ausente) → `userRepresentsActor(req.tenant.id, req.user.userId, event.actorId)`
  → **403 PERMISSION_DENIED** se não representa. Só então chama `createCustody`/`calculateSplit`. **Sem refactor de
  service; sem Core financeiro; sem bank_*; sem novo modelo de autoridade** (representabilidade é canônica).

## Provas (tripé)

- **Guard NOVO** `audit-event-economic-authority-binding.mjs` (no `validate:regression-guards`): FALHA se `createCustody`/
  `calculateSplit` forem chamados SEM `userRepresentsActor(..., event.actorId)` + 403 PERMISSION_DENIED + `getEvent`
  imediatamente antes; ou se o helper `userRepresentsActor`/`canRepresentActor` sumir.
- **Negative-proof** `negative-proof-event-economic-authority-binding.ps1`: (a) remover o binding · (b) adicionar
  `createCustody` sem binding → guard FALHA nos 2; restauração **byte-idêntica** (SHA256).
- **E2E** `validate-pipeline-e2e-event-economic-authority-binding.ts` (DB efêmera, social ports, stub-auth, **zero
  dinheiro**): **6/6** — T1 Bob(não-rep) custody→**403** + zero side-effect · T2 Alice(dona) custody→passa o gate
  (≠403) · T3 Bob split→**403** · T4 Alice split→passa (≠403) · T5 Bank intocado · T6 guard verde.

| Prova | Resultado |
| --- | --- |
| e2e (efêmero, zero dinheiro) | **6/6** |
| negative-proof | 2 mordidas; byte-idêntico |
| event-economic-authority-binding guard | GATE OK |
| actor-writer §4.8 / bank-ledger §4.6 | GATE OK / GATE OK |
| regression-guards (chain) | rc=0 (0113 baseline=0; +1 guard) |
| arch --strict | `critical_new=0` |
| tsc | build (tsconfig.build, strict:false) **25** · strict (tsconfig.json) **43** — ambos baseline herdado; **ZERO atribuível** aos arquivos tocados |

## Hard stops respeitados

Sem refactor amplo · sem Core financeiro · sem seed · sem `financial_approval_*` · sem cartão · sem RLS · sem mapper/
cargo/delegação/platform · F3 NÃO resolvido aqui · C4/B3f/A1/E1/E2/B1f NÃO executados junto. Bank intocado; dev 385/385.
Binding ANTES de qualquer side-effect; spoof por body fail-closed (403).

## Ressalvas

- `event_custody` é tabela **aspiracional** (ausente nas migrations FULL) e `calculateSplit` é **in-memory** (Map) —
  o motor econômico v2 é protótipo; o binding fecha o gap de autoridade independentemente de o motor virar produção.
- Bindei no **dono do evento** (correto/seguro), não em `economic_owner_id`/`target_id` (DADO; binding por target é
  errado p/ split multi-parte). Se a IA Diretora quiser binding adicional sobre `economic_owner_id` p/ custody, é
  refinamento próprio (com a ressalva de que o espaço de id do economic_owner é ambíguo: actor_id × entity_id).

## Estado

WAVE-1 BATCH-2 (B2f) **IMPLEMENTED / HOLD PARA RESEAL**. Rotas econômicas v2 custody/split vinculam autoridade ao dono
do evento (canRepresentActor) antes de qualquer side-effect; spoof por body fail-closed; Bank intocado; dev 385.
Restantes da onda (C4/B3f/A1/E1/E2/B1f) + F3 (frente Art.17 própria) seguem para batches próprios.
