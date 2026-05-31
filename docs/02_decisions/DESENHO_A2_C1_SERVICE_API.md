# DESENHO_A2 — C1 SERVICE-API (Perfil Profissional MVP C1)

Norma-base: CONTRATO A1 (promulgado por Clayton).
HEAD-âncora de referência: 761f9571.
Natureza: DESENHO. Não é autorização de código. A2-código permanece NÃO autorizado
até decisão explícita de Clayton.
Ratificação: Opus (coordenador) redigiu; ChatGPT ratificou com 4 reparos obrigatórios,
todos incorporados nesta versão.

## §0 — REGRA DE LEITURA DESTE DESENHO
Todo path/nome de arquivo/coluna abaixo é PROPOSTA a confirmar no repo vivo (761f9571)
antes de implementar. Onde o desenho e o vivo divergirem, o vivo manda e o desenho é
corrigido — nunca o código forçado ao desenho.

## §1 — ESCOPO E ANTI-ESCOPO (vinculante, Contrato A1 cond.7)
CRIA: camada de leitura/escrita actor-first sobre o substrato C1 já existente
(actor_professional_profiles 1:1 + actor_professional_concepts 1:N — migration 579000, DONE).
NÃO TOCA: preço, oferta, worker, availability, capability, authority, bank_*, split,
payout, certificação. Não toca o substrato (migration). Não toca os arquivos legados
profile-professional.* (ver §7).

## §2 — LAYOUT DE ARQUIVOS (proposta; novo, separado do legado)
backend/src/core/profile/professional-c1/
  professional-c1.types.ts       (DTOs do contrato limpo)
  professional-c1.repository.ts   (acesso às 2 tabelas; colunas explícitas; sem SELECT *)
  professional-c1.service.ts      (regras C1; sem SQL cru)
  professional-c1.routes.ts       (rotas actor-first; ActionContext obrigatório)
Montagem: registrar em profile.routes.ts sob o prefixo /profile (confirmar ponto exato
de registro no vivo; P1 mapeou profile.module.ts → profile.routes.ts).
Justificativa: arquivo novo evita contaminar o legado (deprecação limpa em A3) e
materializa D-A1.3 (contrato NOVO, não bundle).

## §3 — CONTRATO HTTP (actor-first; ActionContext obrigatório em TODAS as rotas)
Precondição comum a TODAS as rotas, nesta ordem:
1. !req.actionContext?.actorId → 400 "ActionContext obrigatório"
2. !req.tenant?.id → 400 "Tenant não encontrado"
3. [REPARO 1 — guarda de identidade] resolver actor (read-only) por
   tenant.id + actionContext.actorId:
   - se não existir → 404 "Actor não encontrado" (distingue actor inexistente de
     actor existente sem declaração)
   - SEM ensureUserActor, SEM criação. Multímetro da identidade.
4. [REPARO 2 — fail-closed do invariante] se actor.id !== actor.actor_id →
   erro controlado ACTOR_ID_INVARIANT_BROKEN; NÃO ler/escrever C1.

Rotas:
- R1. GET  /profile/professional/c1
      Após (3)+(4): 200 { concepts: ConceptDTO[], professional_bio: string|null }
      actor existe sem declaração → 200 { concepts: [], professional_bio: null } (D-A1.2 verbatim)
      Leitura NUNCA cria. (actor inexistente já tratado em (3) → 404.)
- R2. PUT  /profile/professional/c1/bio
      body { professional_bio: string|null } → upsert 1:1. 200 { professional_bio }
- R3. POST /profile/professional/c1/concepts
      body { concept_id (obrig), source_category_id?, skill_level 1..5 (obrig),
             years_experience? } → 201 ConceptDTO
      UNIQUE(tenant,actor,concept) violada → 409 (não 500)
- R4. PATCH /profile/professional/c1/concepts/:conceptId
      body { skill_level?, years_experience?, reactivate?: true } → 200 ConceptDTO
- R5. DELETE /profile/professional/c1/concepts/:conceptId
      desativação lógica (is_active=false + retired_at=now()); NUNCA delete físico. 200 {...}

DTO seco (REPARO 4 — removido conceptId_semantic):
  ConceptDTO = { conceptId, sourceCategoryId|null, skillLevel, yearsExperience|null,
                 isActive, declaredAt, updatedAt, retiredAt|null }
  Nome/label de concept = enriquecimento explícito futuro (A3/UI), NÃO em A2.

## §4 — REPOSITORY (assinaturas; colunas explícitas; sem SELECT *; run*WithTenant)
professionalC1Repository:
  getProfile(tenantId, actorId): Promise<ProfileRow | null>
    SELECT id, tenant_id, actor_id, professional_bio, created_at, updated_at
    FROM actor_professional_profiles WHERE tenant_id=$1 AND actor_id=$2 LIMIT 1
  upsertBio(tenantId, actorId, bio): Promise<ProfileRow>
    INSERT ... ON CONFLICT (tenant_id, actor_id) DO UPDATE SET professional_bio,
    updated_at=now() RETURNING <colunas explícitas>
  listActiveConcepts(tenantId, actorId): Promise<ConceptRow[]>
    SELECT <colunas> FROM actor_professional_concepts
    WHERE tenant_id=$1 AND actor_id=$2 AND is_active=true ORDER BY declared_at
  declareConcept(tenantId, actorId, input): Promise<ConceptRow>   (INSERT, RETURNING)
  updateConcept(tenantId, actorId, conceptId, patch): Promise<ConceptRow|null>
  retireConcept(tenantId, actorId, conceptId): Promise<ConceptRow|null>
    UPDATE ... SET is_active=false, retired_at=now(), updated_at=now()
    WHERE tenant_id=$1 AND actor_id=$2 AND concept_id=$3 RETURNING <colunas>
Toda query filtra tenant_id=$1 explícito (isolamento multi-tenant explícito, não por
JOIN-transitividade). actorId usado = valor de actionContext.actorId; a FK valida contra
actors.id (= actor_id por trigger). Nenhuma criação de actor aqui.

NOTA-REPARO2: a guarda do §3(4) precisa de actor.id E actor.actor_id. O findById vivo
lista actor_id (não id). DECISÃO DE DESENHO: usar um read dedicado, colunas explícitas,
  SELECT id, actor_id FROM actors WHERE tenant_id=$1 AND actor_id=$2 LIMIT 1
como método novo professionalC1Repository.getActorIdentityCheck(tenantId, actorId)
(read-only), OU estender o retorno do findById se for trivial e não quebrar callers —
escolher o menor toque, confirmado no vivo. NÃO é lookup solto proibido (parte de actorId
já resolvido; não resolve user/global_user → actor).

REPARO 3 — integridade de concept_id (tradução de erro, sem 500 cru):
  Confirmar no schema vivo a FK actor_professional_concepts.concept_id → concepts(concept_id)
  (P4 confirmou existência). Em declareConcept/updateConcept:
    - violação de FK concept_id (concept inexistente) → 400/404 limpo (padrão do projeto)
    - violação UNIQUE(tenant,actor,concept) → 409
    - violação CHECK skill_level/years → 400
  O service intercepta o erro do banco e mapeia ao status; NUNCA propaga 500 cru.
  Se a FK NÃO existir no vivo (refutar P4), exigir check read-only mínimo
  (SELECT 1 FROM concepts WHERE concept_id=$ … tenant-scoped) antes do INSERT.
  Concept fantasma não entra pela porta da frente.

## §5 — SERVICE (regras; sem SQL; delega ao repository)
professionalC1Service — TODA operação começa por:
  (a) guarda de identidade [REPARO 1]: getActorIdentityCheck → null ⇒ 404
  (b) invariante [REPARO 2]: id !== actor_id ⇒ ACTOR_ID_INVARIANT_BROKEN, fail-closed
Depois:
  getProfessionalC1 → { concepts: listActiveConcepts, professional_bio: getProfile?.bio ?? null };
    profile null + concepts vazio (mas actor existe, passou em (a)) ⇒
    { concepts: [], professional_bio: null }
  updateBio / declareConcept / updateConcept / retireConcept
  Validações app-level (skill 1..5, years 0..80|null, concept_id presente) ANTES do banco,
  para erro limpo; banco é a rede de segurança. Mapeamento de erro de integridade [REPARO 3].
PROIBIÇÕES (cond.7): zero preço/oferta/worker/availability/capability/authority/bank_*/
  split/payout/certificação. Zero console.log. Zero ensureUserActor. Zero lookup solto.

## §6 — VALIDAÇÃO DE PAYLOAD (rotas; Zod, padrão do projeto)
  skill_level: z.number().int().min(1).max(5)
  years_experience: z.number().int().min(0).max(80).nullable().optional()
  concept_id: z.string().uuid()
  professional_bio: z.string().max(<limite a confirmar no vivo>).nullable()
Erros de validação → 400 com details; erros de service → status mapeado (nunca 500 cru).

## §7 — LEGADO (D-A1.3 / D-A1.4): NÃO mexer em A2
profile-professional.* permanece intocado em A2 (já retorna 500 no caso real; caminho
morto, não contrato vivo). NÃO preservar seu bundle no C1. Deprecação/remoção dos endpoints
legados + migração dos callers frontend (ProfileProfessional.tsx, ProfileAgenda.tsx,
useProfessionalCategories, education[] órfão) = A3, lockstep. A2 também NÃO toca
core.service.ts:348 nem profile-inference.service.ts:245 (callers do legado).

## §8 — PLANO DE TESTE (E2E/integração; cond.1..7 viram asserção)
T1.  [cond.1+REPARO2] actor sob teste: SELECT id=actor_id. Falha ⇒ teste falha.
T2.  [cond.4] GET de actor existente sem declaração → 200 {concepts:[],professional_bio:null}
T3.  GET não cria actor nem profile (count actors/profiles antes=depois)
T4.  POST concept válido → 201; concept_id faltando → 400
T5.  POST duplicado → 409 (não 500)
T6.  PATCH skill_level fora de 1..5 → 400; dentro → 200
T7.  DELETE → is_active=false + retired_at NOT NULL; linha PERMANECE (zero delete físico)
T8.  [cond.7] nenhuma rota/coluna de anti-escopo
T9.  [anti-lookup] grep no diff: zero lookup user/global_user→actor; leitura por actionContext.actorId
T10. ActionContext ausente → 400 em todas as rotas
T11. [REPARO1] actorId de actor INEXISTENTE → 404 (não 200-vazio, não 500)
T12. [REPARO2] actor com id≠actor_id (forçado só no fixture) → ACTOR_ID_INVARIANT_BROKEN, sem I/O em C1
T13. [REPARO3] POST com concept_id inexistente → 400/404 limpo (não 500)

## §9 — GATES (executora roda ANTES e DEPOIS de cada passo de CÓDIGO em A2)
Baseline ANTES (capturar verde): validate:actor-writer-boundaries ·
validate:bank-ledger-boundaries · validate:regression-guards ·
validate-architectural-patterns --strict (critical_new=0) · validate:architectural
(baseline 20) · tsc --noEmit. DEPOIS: mesmos, todos PASS / sem regressão; tsc sem erro
novo nos arquivos C1.

## §10 — DTs A REGISTRAR (não corrigir em A2)
DT-ACTORS-ID-ACTORID-NO-INVARIANT (cond.2) · DT-CORE-PROFILE-GET-CREATES-ACTOR ·
DT-LOOSE-ACTOR-LOOKUPS (6) · citação "Lei 7" → ancorar §4.10/§7.

## §11 — FORA DESTE DESENHO (decisão de Clayton, pós-ratificação)
Liberação de A2-código. Sequência de A3 (frontend). Blindagem do invariante id=actor_id.
Envelope de resposta (manter shape D-A1.2 verbatim vs. wrapper {ok,data}) — decisão à parte;
o desenho honra o shape promulgado.
