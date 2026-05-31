# SELO A2-CÓDIGO — Perfil Profissional C1 actor-first

## A2-CÓDIGO — SELADA (Perfil Profissional C1 actor-first) — 2026-05-31
Selada por Clayton. Primeira fatia entregue do perfil contextual por actor.
Commits: f959d912 (código C1) · 04030be2 (reparo :conceptId UUID) · 977898a4 (reparo PATCH vazio).
Ratificação tripla: Opus (coordenador/parecer) · ChatGPT (auditoria independente dos brutos, P1–P10
CONFIRMADO no HEAD 977898a4) · Clayton (selo).

### Correção do Contrato A1 (premissas refutadas pelo vivo — registradas para não virar fantasma)
- "5 gates verdes em baseline" estava ERRADO para validate:architectural. Estado correto:
  baseline legado Total=20, critical_new=0, zero violação nova do C1. A2 aceita por critério
  DIFERENCIAL (opção (a)); limpar as 20 violações legadas é frente própria, não A2.
- "não há CHECK actors.id=actor_id" REFUTADO pelo schema vivo: existe
  chk_actors_actor_id_equals_id | CHECK ((actor_id = id)). O invariante é estrutural; a guarda
  ACTOR_ID_INVARIANT_BROKEN permanece como defesa-em-profundidade. Substitui a premissa da cond.2.

### DTs adjacentes (ACHADOS — NÃO corrigidas em A2; cada uma exige read-only/ratificação própria)
- DT-CORE-PROFILE-GET-CREATES-ACTOR (legado)
- DT-LOOSE-ACTOR-LOOKUPS (~6, legado)
- DT-VALIDATE-ARCHITECTURAL-20-LEGADO (gate vermelho por dívida de perfil legado)
- citação "Lei 7" → ancorar em §4.10/§7

### A3 — NÃO AUTORIZADA
Pré-condição para abrir A3 (mesmo read-only): (1) bancada limpa/isolada, working tree sem
arquivos não relacionados; (2) autorização explícita de Clayton para A3 read-only.
