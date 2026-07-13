# RFC — Fluxo público canônico de onboarding de endereço territorial do Actor

**Status:** DECIDIDO · FASE A1 · PRÉ-MATERIAL
**Frente:** F-ADDRESS-ONBOARDING-CANONICAL-FLOW · A1-D (composição resolução→confirmação→writer)
**Base:** rescue-structural @ `c3894ecd2` (arco A→B→C→D selado) · Δbank=0
**Data:** 2026-07-13

## Contexto (GATE A0, read-only)
O GATE A0 confirmou que a fundação está pronta e apenas **desconectada**:
- Resolver postal da **Fase B** selado (`postalAddressResolverService.resolve`, exposto read-only em `GET /locations/cep/:cep`).
- Writer actor-territorial da **Fase C** selado (`setActorTerritorialAddress`/`retireActorTerritorialAddress`, owner_type='actor') — **ZERO callers públicos** (só guards).
- Autoridade `canRepresentActor(tenantId, userId, actorId)` existente e fail-closed (template vivo em `me-active-location.routes.ts`).
- Read-model `resolveActorTerritory(tenantId, actorId, purpose)` (Fase A) existente, sem rota.
- Frontend predominante ainda consome a **facade CEP textual** `/api/location/cep` (via `useAddressResolver`); só `RentalAddressSection` usa o resolver canônico.
- Residência PF viva ainda é escrita como **owner_type='profile'** (`PUT /profile/residence-address`); actor-scoped=0.
- Nenhuma lacuna estrutural de banco; **migration esperada = 0**.

**Objetivo da frente:** LIGAR casas seladas (resolver B → confirmação → writer C → leitura actor-scoped), não criar casas novas.

## Decisões (D-A … D-Q)

**D-A · Escopo do MVP.** MVP = Actor PF (`actor_type='user'`), `purpose=ACTOR_RESIDENCE` → role RESIDENCE. Inclui: primeiro endereço, substituição do vigente, leitura do vigente, confirmação humana, idempotência, autoridade por representação. FORA: PJ, HQ, OPERATIONAL, grupos, assets, rentals, eventos, retire público, multi-país, ingestão de municípios, criação de bairro/alias, Social, Bank. O backend valida `ACTOR_RESIDENCE → Actor PF → role RESIDENCE` (a trava da Fase A que lê `actors.actor_type` já força isso); nunca confia no actor_type do cliente.

**D-B · Actor alvo.** `actorId` explícito na rota (path); NUNCA autoridade paralela no body; tenant e operador derivam SÓ do auth context; o action-context deve representar o mesmo Actor da rota (divergência rota×contexto → fail-closed); `canRepresentActor(tenantId, operatorUserId, actorId)` obrigatório; erro de infra propaga; deny legítimo não vira sucesso nem erro genérico; autoridade tenant-only proibida.

**D-C · Preview postal.** Reutiliza EXCLUSIVAMENTE a casa canônica da Fase B (`GET /locations/cep/:cep`), com país EXPLÍCITO (query/formato governado). Proibido: default backend silencioso de BR; facade textual como fonte; chamada direta a ViaCEP/BrasilAPI; criação de city/state/neighborhood; usar `/api/location/cep` como nova autoridade. A facade `/api/location/cep` deixa de ser usada pela jornada PF no mesmo envelope material.

**D-D · DTO público estreito.** O frontend NÃO recebe o contrato interno completo da Fase B. Sucesso projeta somente `{ status:'resolved', country{id,code,displayName}, state{id,code,displayName}, city{id,displayName}, neighborhood{id|null, candidateId|null, status(resolved/candidate_requires_confirmation/pending/not_applicable), displayName|null}, postalCode, street|null, requiresUserConfirmation:true }` (nomes ajustáveis ao vocabulário real, semântica preservada). NÃO expor providerEvidence/responseHash/cacheHit/URLs/payload bruto/fallback interno/stack/coordenadas. Falhas → códigos públicos estáveis SEM perder a distinção material.

**D-E · Confirmação humana.** Cobre Actor alvo, purpose, país, CEP, state, city, logradouro, número, complemento, bairro/status. Provider-derived+user-confirmed: country/state/city/street/neighborhood(display/status). User-entered: number/complement. IDs canônicos trafegam como CROSS-CHECK, não autoridade final, e não mudam sem nova resolução. Mudança posterior em país/CEP/city/neighborhoodId/candidateId invalida a confirmação anterior.

**D-F · Re-resolução server-side (mecanismo do MVP).** preview → usuário confirma → o comando REEXECUTA `postalAddressResolverService.resolve` no backend → compara com a confirmação → só então chama o writer C. O comando: (1) recebe país+CEP; (2) re-resolve; (3) exige `status='resolved'`; (4) usa os IDs da RE-RESOLUÇÃO como autoridade; (5) compara `confirmedCityId`; (6) compara `confirmedNeighborhoodId` quando aplicável; (7) divergência → `territorial_confirmation_mismatch`; (8) não chama a Fase C em divergência/falha postal. Proof-token/HMAC = hardening FUTURO (nenhuma infra de token no MVP); indisponibilidade na re-resolução falha fechado; cache derivado pode reduzir a 2ª consulta; nunca grava com uma resolução que não conseguiu revalidar.

**D-G · Bairro.** `resolved` (alias governado) pode fornecer `neighborhoodId`; `candidate_requires_confirmation` NÃO vira identidade no MVP (escrita com `neighborhoodId=null`); `pending`→null; `not_applicable`→null; texto só como display/evidência; onboarding não cria neighborhood, não cria alias, não aprova candidato; cross-city proibido. Confirmação governada de candidato = incremento futuro próprio.

**D-H · Comando canônico.** `POST /actors/:actorId/territorial-address`. Request público `{ purpose:'ACTOR_RESIDENCE', countryCode, postalCode, street, number, complement?, confirmedCityId, confirmedNeighborhoodId?, idempotencyKey }`. PROIBIDOS no body: tenantId, operatorUserId, actorId (autoridade), actorType, role, owner_type, owner_id, existingAddressId, is_primary, valid_from, valid_until, status, provider, city textual como autoridade, neighborhood textual como identidade. O backend deriva role do purpose, re-resolve, autoriza, monta `TerritorialAddressInput` e chama EXCLUSIVAMENTE `setActorTerritorialAddress` — nunca escreve direto em addresses/address_assignments.

**D-I · Idempotência.** Reutiliza INTEGRALMENTE a casa da Fase C (idempotency_keys, two-phase inline, escopo interno Actor+purpose+operação); cliente envia chave opaca (preferência UUID); replay mesmo payload→resultado anterior; replay divergente→conflito; commit-com-resposta-perdida→replay; NENHUMA tabela/service/middleware de idempotência paralelo. O contrato público projeta de forma estável: sucesso novo, sucesso por replay, processamento concorrente, conflito de payload.

**D-J · Create/Replace.** MVP expõe só `set` (primeiro cadastro ou substituição atômica). Retire público NÃO no 1º envelope. A Fase C mantém advisory lock, encerramento do vigente, criação do novo, histórico, cardinalidade, idempotência, evento. Proibido: DELETE, UPDATE direto, encerramento feito pela rota, `expectedCurrentAssignmentId` no MVP.

**D-K · Leitura canônica.** `GET /actors/:actorId/territorial-address?purpose=ACTOR_RESIDENCE`. Exige auth + `canRepresentActor`; reutiliza `resolveActorTerritory`; enriquece IDs por Location Core; retorna só o vigente; não resolve por texto; não retorna histórico completo; não retorna provider/cache internals; não cria 2ª casa de resolução.

**D-L · Convergência da residência legada.** Após o envelope, actor-scoped RESIDENCE é a autoridade canônica para novas escritas de residência PF. `PUT /profile/residence-address` NÃO pode seguir como writer paralelo — no MESMO envelope material deve ser aposentada como writer direto OU virar facade fina do comando actor-scoped. Não pode: inserir owner_type='profile', atualizar por writer legado, criar city/state, ignorar canRepresentActor, manter 2ª casa de idempotência. `GET /profile/residence-address` pode transitoriamente: (1) retornar actor-scoped RESIDENCE quando existir; (2) usar o profile-RESIDENCE preservado só como fallback READ-ONLY; (3) nunca tratar o fallback legado como autoridade para nova escrita. Os 2 registros profile-RESIDENCE preservados permanecem byte/row intactos (não migrados/encerrados/apagados; não bloqueiam o novo fluxo; compatibilidade de leitura até frente própria). O address actor_asset/PICKUP permanece totalmente fora.

**D-M · Frontend PF.** 1º frontend material = só Profile/PF. Deve: abandonar `/api/location/cep`; consumir o preview canônico; enviar country explícito; preservar IDs canônicos; mostrar Actor alvo; mostrar state/city canônicos; exigir número; exibir bairro resolved/candidate/pending; exigir confirmação; invalidar confirmação quando o payload territorial mudar; enviar idempotencyKey; tratar replay/concurrency/mismatch; ler o vigente pelo read-model actor-scoped; nunca chamar provider direto; nunca enviar tenant/role/owner. CompaniesManager, EventFoundationStep, grupos e rentals NÃO entram — salvo remoção estritamente necessária de dependência compartilhada da facade CEP legada, sem mudar seus writers.

**D-N · canonical_city_missing.** Não chama writer C; não cria city; não resolve por nome; não mascara como falha genérica; informa que a localidade ainda não está no catálogo; permite corrigir país/CEP; picker canônico só se reutilizar Location Core e não contradizer o código oficial; escopo material limitado ao catálogo existente (27 capitais). Ingestão oficial de municípios permanece frente separada.

**D-O · API Contract Governance.** O envelope registra contract-first: preview postal canônico, comando set/replace, leitura do vigente, facade/depreciação da residência legada, códigos públicos de erro, idempotência, authority, privacidade. Local: `backend/docs/API_CONTRACT_GOVERNANCE.md` + contratos compartilhados em `packages/contracts` conforme a casa vigente. Nenhuma rota concluída sem contrato e teste de rota.

**D-P · Sem migration.** `migration=0` — schema actor-scoped, writer C, idempotency_keys, actor_events, constraints/trigger/cardinalidade, Location Core e read-model já existem. Se a executora encontrar necessidade REAL de migration → STOP e retorna ao cartório; não improvisar alteração estrutural no material.

**D-Q · Fronteiras negativas.** O 1º envelope não autoriza: PJ, company HQ, operational, grupos, eventos, rentals, migração dos 3 preservados, retire público, proof-token, ingestão de municípios, criação de bairro, aprovação de candidato, aliases, multi-país, Social, Bank, split, ledger, regional funds, UnifyCard/maquininha.

## Envelope material futuro ratificado (um único arco, sob novo GO, sem migration)
1. contratos compartilhados; 2. projeção pública estreita do resolver; 3. rota POST set/replace; 4. rota GET vigente; 5. autoridade por canRepresentActor; 6. re-resolução server-side; 7. cross-check da confirmação; 8. chamada exclusiva ao writer C; 9. reuso da idempotência C; 10. read-model enriquecido; 11. convergência do writer profile legado; 12. frontend Profile/PF; 13. convergência de `/api/location/cep` na jornada PF; 14. API contract governance; 15. guard consolidado; 16. testes unitários; 17. testes de integração; 18. testes de rota; 19. testes frontend; 20. cartório; 21. uma única auditoria Yala.

## Guard futuro (família mínima)
nenhuma escrita direta em addresses/address_assignments; writer C é a única escrita; resolver B é a única casa postal; re-resolução obrigatória; confirmação obrigatória; tenant server-side; actor da rota/action-context coerente; canRepresentActor obrigatório; infra-error propagado; purpose→role server-side; cityId do cliente só cross-check; candidate não vira identity; idempotência C reutilizada; writer profile legado aposentado; country explícito; sem city/state/neighborhood creation; sem provider direto; sem PII; sem Bank/Social; contratos registrados.

## Riscos registrados
- A re-resolução pode depender de provider/cache no write; indisponibilidade falha fechado.
- Os 2 registros profile-RESIDENCE permanecem como fallback legado de LEITURA; actor-scoped prevalece quando existir; coexistência física temporária ≠ duas autoridades.
- Frontend compartilhado ainda tem consumidores da facade CEP legada FORA do MVP.
- EventFoundationStep tem dívida texto×UUID fora desta frente.
- Expansão PJ/multi-país exigirá envelopes próprios.

## Escopo negativo
Esta decisão NÃO autoriza: código, rota, contrato executável, frontend, migration, write, provider call, chamada à Fase C, criação actor-scoped, conversão dos 3 preservados, criação de city/state/neighborhood/alias, preenchimento de neighborhood_id, ingestão de municípios, Social, Bank, split, ledger, regional funds, UnifyCard/maquininha.

**F-ADDRESS-ONBOARDING-CANONICAL-FLOW · DECISÃO DE FRONTEIRA REGISTRADA · MVP PF/RESIDÊNCIA RATIFICADO · MATERIAL NÃO INICIADO.**
