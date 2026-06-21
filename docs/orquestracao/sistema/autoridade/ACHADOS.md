# sistema/autoridade — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa AUTORIDADE (quem pode declarar/ofertar). Fonte: IA-AUTORIDADE/IA-BANCO · DECISION-0113/0118/0100/0101/0126/0136 · AUTHORITY_LAW Art.17.

## Gates canônicos (corretos)
- **`canRepresentActor(tenant,userId,actorId)`** = gate de PF/serviço/oferta, **fail-closed** (incerteza = deny).
- **`canManageCompany`** (`can_manage_company OR role='owner'`, membership ativa) **+ KYB approved** = gate de PJ. Company-scoped, NÃO representação genérica (satisfaz 0118).
- **`actorId` do cliente = HINT**, nunca autoridade (DECISION-0113). `userId` server-side é o real.

## Buracos = "produto permite, autoridade não prova" (são GHOSTS — re-acoplar)
- **`assign-skill`** → `global_user_id`, **ZERO canRepresentActor**. (tabela ausente; re-acoplar à espinha gated.)
- **`human_mvp`** → gate **tenant-level** (`hasWriteAccess`) = **confused-deputy** (qualquer caller cria oferta por qualquer person_id). (tabela ausente.)

## Binding ausente
- `service_offerings` prova `canRepresentActor(provider)` mas **NÃO** prova capacidade declarada → a PONTE declaração→oferta deve **re-gatear** (sem herança de permissão entre substratos).

## Substrato latente
- **`actor_capability_grants`** = 0 linhas (dormant); allowlist já inclui `services:create/edit/disable` → é o **lar canônico do "funcionário oferta pela company"**. Ativar = migration + decisão + reseal, **nunca por carona**.
- FASE 6 (`actor_has_permission`) = stub deny-all (off). Não usar como autoridade.
