# DECISION-0101 — Revogação/perda de KYB approved e cascata sobre publicações PJ

**Data:** 2026-06-04
**Tipo:** Arquitetural / Governança fiscal / Publicação
**Status:** PROMULGADA (docs-only — não autoriza código/schema/migration/writer)
**Frente:** `F-PJ-PUBLICATION-OFFERING-KYB-REVOCATION`
**HEAD de origem:** `e90b3152`

---

## 1. Título
KYB approved é gate **contínuo** da publicação pública PJ: a perda de approved (rejected/suspended/closed)
deve **retirar** as publicações ativas da empresa no SSOT `company_concept_publications` e recalcular a
projeção `tenant_concept_offerings` — por autoridade **fiscal/institucional** (não do dono), auditada pelo
**actor humano do reviewer**. Sem actor humano auditável, o fluxo para; **não** se inventa system actor agora.

## 2. Data
2026-06-04.

## 3. Tipo
Arquitetural / Governança fiscal / Publicação. Docs-only.

## 4. Status
PROMULGADA. Não autoriza código, schema, migration ou writer (ver §11/§D12).

## 5. Contexto
A cadeia de publicação PJ está completa: publicar ≠ ativar (DECISION-0099); SSOT de publicação =
`company_concept_publications` + `tenant_concept_offerings` como read-model derivado (DECISION-0100);
writer publish/unpublish gated por KYB approved no ATO; projeção de discovery na mesma transação; rebuild
idempotente do read-model. O publish exige `fiscal_identities.kyb_status='approved'` **no momento do ato** —
mas nada reage se a empresa **perde** KYB depois. As 3 auditorias paralelas (A norma/KYB writer, B publication
writer/schema, C discovery/marketplace) convergiram: a regra de revogação precisa ser cravada em norma
**antes** de qualquer código, e o caminho de actor/audit deve ser o **reviewer humano**, não um system actor.

## 6. Problema
`DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION`: se `kyb_status` sai de `approved`
(approved → rejected/suspended/closed), a publicação `active` permanece e o discovery (`tenant_concept_offerings`)
continua mostrando a oferta — **oferta publicamente descobrível sem KYB vigente** (segunda-verdade temporal:
KYB-no-ato ≠ KYB-vigente). Hoje **nem existe o botão**: o runtime só transiciona `pending → approved|rejected`.

## 7. Evidência material (auditorias A/B/C)
1. **KYB writer atual (A):** `fiscal-identity-kyb.service` só cobre `pending → approved|rejected` (review atômico
   UPDATE request + UPDATE fiscal_identities). **NÃO há writer vivo** para `approved → rejected/suspended/closed`,
   nem hook/evento pós-KYB. ⇒ a cascata não tem gatilho material hoje.
2. **Publication writer atual (B):** publish/unpublish escreve `company_concept_publications`; a projeção
   atualiza `tenant_concept_offerings` na mesma transação; o `retire` atual **exige autoridade contextual do dono**
   (`company_users.can_manage_company`/owner) — logo **não serve** diretamente para uma retirada **sistêmica** por KYB.
   O schema de publicação **suporta** retirada (status active→retired, retired_at, retired_by_actor_id), mas há
   **conflito sobre o actor/audit** de uma retirada institucional.
3. **Discovery atual (C):** o reader `marketplace-contextual` lê `tenant_concept_offerings`, retorna tenants,
   **não filtra KYB**. Reader filter **sozinho mascararia** a inconsistência se `company_concept_publications.status`
   continuasse `active`. ⇒ primeiro corrigir o SSOT, depois (talvez) o filtro defensivo.
4. **Audit atual (A/B):** KYB review já registra `reviewed_by_actor_id`; publication retire exige
   `retired_by_actor_id`; **não há padrão institucional consolidado de system actor soberano**. ⇒ o actor humano do
   reviewer é o caminho canônico preferencial.

## 8. Decisão
KYB approved é gate **contínuo** da publicação pública. A saída de approved (rejected/suspended/closed) **retira**
as publicações ativas da empresa no SSOT e recalcula a projeção, por **autoridade fiscal/institucional** (não do
dono), auditada pelo **actor humano do reviewer**. Sem actor humano auditável, o fluxo **para** (fail-closed);
**não** se usa `SYSTEM_ACTOR_ID` hardcoded nem se cria actor institucional nesta DECISION. A reaprovação **não**
republica (publicar segue ato soberano explícito). O reader filter é defesa-em-profundidade **posterior**, nunca
substituto da correção do SSOT. O rebuild **não** filtra KYB (reflete o SSOT). **Antes da cascata, é preciso o ato
fiscal de sair de approved — que hoje não existe.**

## 9. Decisões D1–D12

**D1 — KYB approved é gate CONTÍNUO de publicação pública.** Publicação pública exige
`fiscal_identities.kyb_status='approved'` não só no momento do publish, mas **enquanto a publicação estiver ativa**.

**D2 — Perda de approved RETIRA publicação.** Transições futuras de saída de approved devem retirar as publicações
**ativas** da empresa: `approved → rejected` · `approved → suspended` · `approved → closed` · qualquer futura
`approved → pending` (se vier a existir).

**D3 — Reaprovação NÃO republica.** Transições para approved autorizam **nova** publicação, mas **não** republicam
automaticamente: `pending/rejected/suspended/closed → approved`. Publicar continua **ato soberano explícito**
(DECISION-0099 D1).

**D4 — Retirada por KYB é sistêmica/institucional, NÃO ação do dono.** A retirada disparada por perda de KYB **não**
depende de `company_users.can_manage_company`. A autoridade decorre da **decisão fiscal/KYB**. O dono **não pode**
manter publicação pública se o KYB deixou de ser approved.

**D5 — Actor/audit da retirada = reviewer humano.** A retirada por KYB é auditada pelo **actor humano do
operador/reviewer** que executou a decisão fiscal, quando houver: usar o actor do reviewer (`reviewed_by_actor_id`);
preencher `retired_by_actor_id` com esse actor; `source='kyb_revocation'`; `intent`/motivo com a razão fiscal quando
disponível.

**D6 — Sem actor humano auditável, NÃO inventar system actor agora.** Proibido `SYSTEM_ACTOR_ID` hardcoded como
solução principal. Proibido criar actor institucional nesta DECISION. Se uma revogação futura não tiver actor humano
auditável, ela deve **parar/falhar** (fail-closed) ou exigir **decisão própria** sobre actor institucional. Atalho com
sentinela UUID **não é** padrão soberano (evita nascer mais um fantasma com crachá).

**D7 — Retirada deve atualizar a projeção.** Ao retirar publicações ativas por perda de KYB, recalcular
`tenant_concept_offerings`: se ainda existe outra publicação `active` do mesmo tenant+concept, `is_active` permanece
true; senão, `is_active=false`. Isolamento por empresa preservado (DECISION-0100 D10 / DECISION-0099 D7).

**D8 — Atomicidade.** Quando houver writer de saída de approved, a mudança KYB + retirada das publicações +
atualização da projeção devem ser **atômicas** (preferencialmente na mesma transação). Se a projeção falhar →
rollback da transição fiscal (ou mecanismo equivalente fail-closed). **Não** deixar "KYB revogado, publication
active" como sucesso silencioso.

**D9 — Reader filter é defesa-em-profundidade, NÃO substituto.** O reader `marketplace-contextual` pode, no futuro,
filtrar KYB approved como defesa-em-profundidade — mas **sozinho não resolve**, porque mascara publicação `active`
inconsistente. **Primeiro corrigir o SSOT** (`company_concept_publications`), depois avaliar o filtro defensivo.

**D10 — Rebuild NÃO resolve revogação KYB.** `rebuild-tenant-concept-offerings` deriva exclusivamente de
`company_concept_publications.status='active'` e **não** filtra KYB. Revogação precisa retirar a publicação **no SSOT**;
o rebuild apenas reflete o SSOT.

**D11 — Writer de saída de approved ainda NÃO existe.** O runtime cobre só `pending → approved|rejected`. Antes da
cascata, é necessário **desenhar/implementar** uma frente de KYB revocation/suspension que permita
`approved → rejected/suspended/closed` com autoridade fiscal adequada. **A cascata é consequência desse ato; o ato vem
primeiro.**

**D12 — Bloqueios.** Esta DECISION NÃO autoriza ainda: código; migration; alteração do writer KYB; alteração do
publication writer; alteração do reader marketplace/contextual; uso de system actor; reader filter; alteração de Bank;
alteração de frontend; alteração de onboarding; alteração de hybrid.

## 10. O que esta DECISION ratifica
- **Ratifica e estende** DECISION-0099 (publicação = ato soberano, KYB-gated, reversível, auditável) e DECISION-0100
  (SSOT = `company_concept_publications`; tco = read-model; D9 derivação; D10 reconciliação).
- **Ratifica** `fiscal_identities.kyb_status` como SSOT de verificação fiscal (DECISION-0089/0097 D3) e o page-actor
  como eixo operacional (DECISION-0097 D7).
- **Confirma** que o rebuild (DT CLOSED) não muda: deriva do SSOT, sem KYB.

## 11. O que NÃO está autorizado
Ver D12. Em particular: nenhum writer de saída de approved; nenhuma cascata em runtime; nenhum reader filter; nenhum
system actor; nenhuma alteração de KYB/publication/reader/Bank/frontend/onboarding/hybrid.

## 12. Impacto em DTs
- `DT-PJ-PUBLICATION-OFFERING-KYB-REVOCATION-PROJECTION` → **GOVERNED / DECISIONED** (regra definida; **não CLOSED** —
  falta writer/transição runtime).
- **Criada** `DT-PJ-KYB-APPROVED-REVOCATION-WRITER-MISSING` (OPEN) — runtime não tem writer para
  `approved → rejected/suspended/closed`; a cascata não tem gatilho material.
- **Criada** `DT-PJ-KYB-REVOCATION-READER-DEFENSE-MISSING` (OPEN) — reader sem filtro defensivo KYB; só após o writer.
- **Não reabrir:** `DT-PJ-PUBLICATION-OFFERING-SOVEREIGN-SHAPE-MISSING` (CLOSED) ·
  `DT-PJ-TENANT-CONCEPT-OFFERINGS-LEGACY-REBUILD` (CLOSED) · `DT-PJ-COMPANY-STATUS-KYB-SECOND-TRUTH` (CLOSED).
- `DT-PJ-MARKETPLACE-HYBRID-ATOMIC-ANTI-PATTERN` permanece OPEN (ortogonal).

## 13. Próximas frentes autorizáveis (sem execução nesta DECISION)
1. **`F-PJ-KYB-APPROVED-REVOCATION-WRITER` (read-only/DESENHO primeiro):** o ato fiscal `approved →
   rejected/suspended/closed` com autoridade fiscal + actor humano do reviewer (D4/D5/D6), depois a **cascata** de
   retirada de publicações + projeção atômica (D2/D7/D8). O ato vem antes da cascata.
2. **`F-PJ-KYB-REVOCATION-READER-DEFENSE` (depois do writer):** filtro defensivo KYB approved no reader (D9).
Ordem: writer de revogação (ato fiscal + cascata) → reader defensivo. Marketplace-hybrid é ortogonal.

## 14. Referências normativas
Constituição (Art. III/IV/V) · LEIS (Lei 5 financeiro, Lei 7 semântica) · SSOT_REGISTRY · LEI_DE_COERENCIA (§4.8/4.9)
· 07_NOMENCLATURA · 18_DOMAIN_ONTOLOGY · EMPRESA_NASCIMENTO_CANONICO · SERVICE_CANONICO · DECISION-0097 (D3 KYB SSOT,
D7 page-actor) · DECISION-0098 · DECISION-0099 · DECISION-0100 · DECISION-0088/0094 (gate KYB vivo).

## 15. Referências de estado/commits
HEAD origem `e90b3152` ("chore(pj): add tenant concept offerings rebuild"). Cadeia: schema `ac064c01` · writer
`21e0beef` · projeção `72376330` · rebuild `e90b3152`. Runtime: `fiscal-identity-kyb.service.ts` (KYB writer, só
pending→approved|rejected), `company-publications.service.ts` (publish/unpublish + projeção),
`authority-decision.evaluatePageActorKybApproved` (gate KYB no ato), `rebuild-tenant-concept-offerings.ts` (reconciliação).
Auditorias A/B/C (norma/KYB writer · publication writer/schema · discovery/marketplace) recebidas por Clayton nesta frente.
