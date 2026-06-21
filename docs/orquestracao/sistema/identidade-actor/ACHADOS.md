# sistema/identidade-actor — ACHADOS (destilado da Rodada 7 · cadeia-de-oferta)

> Etapa IDENTIDADE/ACTOR. Fonte: IA-ACTOR · DECISION-0113 (DT-mãe OPEN) · 0062 (CPF/CNPJ SSOT).

## Núcleo
- `actor_id` = crachá operacional; `global_user_id` = quem a pessoa é. Toda ação de capacidade/oferta keyed por **actor**, nunca por `global_user_id` (os 2 ghosts furavam isso).
- **`canRepresentActor`** = gate vivo (DECISION-0113, 5 canais; DT-mãe **OPEN** — não selada). `actorId` declarado pelo cliente = HINT.
- `resolveActiveActorFromRequest` resolve qual actor age (header/query `x-actor-id`/`actor_id` → `assertActorRepresentable`→`canRepresentActor`); fallback self-only via `ensureUserActor` (idempotente, único create-path em leitura — vigiar `allowUserFallback:true` em GETs).
- `actor_types` (`userActor`/`pageActor`/`groupActor`) nascem só pelo writer único; `ActiveActor` discriminado por tipo, não colapsado. F-OFFER não infere company-actor de user-actor sem `canManageCompany`.

## Pendência transversal
- DT-mãe 0113 OPEN bloqueia selo pleno de representação; F-OFFER opera sobre `canRepresentActor` já vivo, mas não fecha 0113.
