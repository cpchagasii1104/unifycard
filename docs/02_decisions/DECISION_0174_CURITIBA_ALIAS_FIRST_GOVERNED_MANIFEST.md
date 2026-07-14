# DECISION-0174 — MVP Curitiba alias-first: execução governada de manifest de aliases (N0-D)

**Status:** DECIDIDO · FRONTEIRA · PRÉ-MATERIAL
**Frente:** F-NEIGHBORHOOD-CANONICAL-AUTO-INGESTION · MVP Curitiba alias-first · N0-D
**Base:** rescue-structural @ `f32f0a46f` (arco territorial A→B→C→D + onboarding PF/residência selados; Δbank=0)
**GATE origem:** GATE N0 read-only (recomendação **A** — forma física fechada)
**Data:** 2026-07-13

## Contexto (GATE N0, read-only)
O GATE N0 fechou a forma física do MVP com base em precedentes vivos:
- `fn_grant_territorial_capability` (SECURITY DEFINER, platform_bootstrap) aceita a key EXATA `territory:manage_neighborhood_aliases`, valida city/grantee/issuer/executor/responsible sob `FOR SHARE`, grava grant+evento atomicamente e **NÃO depende de grant territorial anterior** (sem circularidade).
- `fn_assert_territorial_capability` valida o conjunto FECHADO das 6 keys, trava Actor e grant `FOR SHARE`, cardinalidade fail-closed, nunca transforma tenant em autoridade.
- O padrão N3 provou manifest JSON governado + hash estrutural + loader one-shot + advisory lock + dry-run/apply + writer canônico sem INSERT direto.
- `neighborhood_curation_events` tem semântica ESPECÍFICA de bairro created/approved (3 campos NOT NULL) → aliases exigem trilha PRÓPRIA.
- Grants vivos em Curitiba (9d431002) = só `territory:create_neighborhood` + `territory:approve_neighborhood` (grantee Actor 213f4903). `manage_neighborhood_aliases` = 0. HOLD de `neighborhood_aliases` = ENABLE ALWAYS (bloqueia todo DML, sem writer).

`14_POLICIES_CANONICA.md` = **PROPOSTO / NÃO VIGENTE** — não fundamenta authority. Base vinculante = `DECISION_SAFETY_AND_CONTAINMENT_CONTRACT` + `DECISION_CORE_CONTRACT`/hardenings + SSOT de Actors/authority + `actor_capability_grants` + `permission-keys.ts` + `canRepresentActor` + `fn_assert_territorial_capability` + `fn_grant_territorial_capability` + DECISION-0171/0172/0173 + HOLD de neighborhood_aliases + contrato postal/freetext-containment.

## Invariantes
representation = `canRepresentActor` · authority = `actor_capability_grants` · manifest = conteúdo decidido · approval event = decisão humana · job = execução técnica · `neighborhood_id` = identidade · provider text = evidência/candidato.

## Duas precisões vinculantes (do estado aceito)
1. **A fonte institucional da abertura é uma decisão explícita de `platform_bootstrap`.** `fn_grant_territorial_capability` é o MECANISMO fechado que materializa essa decisão — não uma autoridade soberana por si só.
2. **Rerun do mesmo `manifest_id`+version+hash já executado com sucesso deve FALHAR FECHADO** (zero write, exit não-zero). Uma relação exata preexistente pode ser no-op/replay DENTRO de outro manifest aprovado; o mesmo one-shot concluído não retorna novo "sucesso".

## Decisões (D0 … D22)

**D0 · Escopo.** N0-D governa SOMENTE: aliases de Curitiba; bairros canônicos JÁ existentes; manifest fechado; aprovação humana em lote; execução técnica; writer de INSERT; abertura estreita do HOLD; trilha de auditoria. Ratificado: ZERO bairro novo · ZERO alteração semântica do resolver · ZERO vínculo address→neighborhood · ZERO Social · ZERO Bank.

**D1 · Job não é Actor.** O job NÃO entra em `actors`, não recebe capability, não representa humano, não aprova manifest, não escolhe/altera linhas — é só principal técnico de execução. A execução técnica registra no mínimo: automation_execution_id, executor_kind='job', executor_name, run_id, application_name, code_commit, manifest_id, manifest_version, manifest_hash, started_at, completed_at, result_counts, outcome. `outcome/status` = projeção operacional, NÃO authority.

**D2 · Autoridade única.** `actor_capability_grants` + `permission-keys.ts` = SSOT único de autoridade territorial. Capability exata de aliases = `territory:manage_neighborhood_aliases`. Proibido: capability substituta, wildcard, prefix match, role/admin fallback, tenant-only authority, manifest como authority, job como authority, status como authority.

**D3 · Actor humano aprovador (MVP Curitiba).** approver_actor_id = `213f4903` · approver_user_id = `9305ac13` · scope_city_id = Curitiba `9d431002`. Esse Actor é `actor_type='user'`, tenant-bound, com representação direta pelo usuário, já curador territorial de Curitiba. A aprovação exige: usuário autenticado → canRepresentActor → fn_assert_territorial_capability → `territory:manage_neighborhood_aliases` → Curitiba → manifest/version/hash exatos. Actor/usuário/tenant derivam SERVER-SIDE. Sem "primeiro Actor" nem IDs autoritativos do payload.

**D4 · PORTA-TERRITORY-ALIASES (necessária, envelope SEPARADO anterior a N1).** Sequência N0-D → PORTA → N1. Fonte institucional da abertura = decisão explícita de `platform_bootstrap`; `fn_grant_territorial_capability` = mecanismo fechado de materialização. A PORTA deverá: reutilizar `fn_grant_territorial_capability`; conceder SÓ `territory:manage_neighborhood_aliases`; escopo Curitiba; Actor humano aprovado; criar exatamente 1 grant + 1 evento de grant; one-shot dry-run/apply; confirmação literal; advisory lock; rerun fail-closed; guard + mutations; Δbank=0. NÃO poderá: abrir HOLD, criar writer/manifest/alias, conceder create/approve de novo, administrar grants, tocar Social/Bank. **Ausência de circularidade ratificada:** a decisão platform_bootstrap autoriza a PORTA; a PORTA não depende do grant que cria.

**D5 · Quatro fatos distintos (nenhum substitui o outro).** `capability_granted` (casa de grant events — prova que o Actor pode administrar aliases) · `manifest_approved` (humano aprovou conteúdo/versão/hash exatos) · `automation_executed` (qual job/run executou) · `alias_created` (qual alias materializado). Ordem temporal: grant → aprovação → execução → alias.

**D6 · Manifest híbrido (Opção C).** Arquivo JSON governado (fonte do conteúdo enumerado) + approval/execution persistidos no DB. Sem engine genérica de policies. Header mínimo: manifest_code, manifest_version, city_id, city_external_code, source_dataset, source_dataset_version, source_dataset_hash, line_count, generated_at. Linha mínima: alias_text, neighborhood_id, canonical_neighborhood_name, source_kind, source_reference, evidence. `alias_normalized` = RECALCULADO pela função canônica no writer (se presente no arquivo, só prova comparativa, nunca input soberano). Hash: projeção canônica, ordenação determinística, Unicode exato, chaves fechadas, sem PII, nenhuma linha adicionável após aprovação.

**D7 · Fontes.** source_kind ∈ {`government_official`, `public_documentary`, `internal_curation`} (vocabulário CHECK vivo). Provider postal (ViaCEP/BrasilAPI) = evidence de DESCOBERTA, NUNCA source soberana de identidade. Proibido manifest gerado automaticamente de texto bruto do provider sem composição + aprovação humana. NÃO criar alias redundante quando `name_normalized` já resolve a variação.

**D8 · Aprovação humana.** Prova de acesso ao conteúdo completo. Registra: manifest_id, manifest_version, manifest_hash, city_id, approved_by_user_id, approved_by_actor_id, territorial_grant_id, capability_key, scope_city_id, line_count, approved_at. O aprovador audita: alias original, normalização calculada, bairro alvo, nome canônico, cidade, fonte, referência, evidência, versão, hash, contagem. Aprovação de um hash NÃO reutilizável para outro hash. Grant validado e travado na aprovação.

**D9 · Revogação e supersessão.** Lifecycle próprio por eventos: `manifest_approved` / `manifest_revoked` / `manifest_superseded`. NÃO reutilizar `neighborhood_succession_events`. Execução depende de: approval imutável existente + manifest/version/hash coincidentes + grant ainda válido + ausência de revogação + ausência de supersessão aplicável. `status` = read-model derivado (NÃO autoriza execução). Revogação/supersessão exigem representação humana + capability exata vigente.

**D10 · Execução técnica.** O job NÃO chama canRepresentActor, não simula usuário/Actor, não recebe grant, não cria aprovação. O job: (1) carrega aprovação imutável; (2) identifica manifest/version/hash; (3) registra execução técnica; (4) trava aprovação; (5) revalida o MESMO grant via fn_assert_territorial_capability; (6) verifica vigência/revogação/escopo; (7) verifica ausência de revogação/supersessão do manifest; (8) executa SÓ linhas aprovadas. A execução técnica NÃO é fonte de authority.

**D11 · Trilha própria de alias.** `neighborhood_curation_events` NÃO reutilizada. Criar em N1 `neighborhood_alias_curation_events` (append-only), shape mínimo: event_id, alias_id, neighborhood_id, city_id, operation='alias_created', manifest_id, manifest_version, manifest_hash, manifest_approval_id, automation_execution_id, approver_actor_id, approver_user_id, territorial_grant_id, capability_key, source_kind, source_reference, evidence, occurred_at. Cada `alias_created` referencia OBRIGATORIAMENTE approval + execution + grant + manifest + linha materializada.

**D12 · Autoria na row de alias.** Para este MVP FECHADO, `created_by_actor_id` e `approved_by_actor_id` podem apontar para o MESMO Actor humano aprovador, porque: o manifest enumera todas as linhas; o humano aprova diretamente o conjunto completo; o hash executado é idêntico ao aprovado; nenhuma linha pode ser acrescentada; o job é registrado separadamente na execution house. **Registrado expressamente:** esse colapso é ESPECÍFICO do MVP fechado — NÃO reutilizar para aliases futuros desconhecidos ou regras abertas.

**D13 · HOLD e token.** Padrão: autorização de lote + token interno one-use POR LINHA. O writer emite uma autorização interna por INSERT; o row trigger consome o token por linha. Token bound a: transaction/xid, backend_pid, operation='insert_alias', manifest_id, manifest_line, neighborhood_id, alias_normalized. Token: one-use, inacessível à aplicação, consumido pelo row trigger, rollback-safe, sem GUC/role/tenant especial, sem trigger disable. Resultado: INSERT pelo writer permitido; INSERT direto/UPDATE/DELETE bloqueados.

**D14 · Writer canônico.** `fn_create_canonical_alias`, SECURITY DEFINER, search_path pinado, ACL fechada, com loader one-shot autorizado. O writer: (1) carrega+trava approval; (2) valida manifest/version/hash; (3) verifica revogação/supersessão; (4) revalida+trava grant; (5) valida execução; (6) valida bairro ativo ∈ Curitiba; (7) normaliza pela fn canônica; (8) preflight integral; (9) classifica replay/conflito; (10) emite token one-use; (11) insere alias; (12) insere evento próprio; (13) tudo na mesma transação. Proibido: UPDATE/DELETE, SQL direto fora do writer, findOrCreateNeighborhood, criação de bairro, texto→identidade, provider como authority, authority por job/manifest/status, authority por tenant.

**D15 · Conflito.** Regra NOVA e mais restritiva do loader. Chave = `city_id + alias_normalized`. Classificação: relação exata existente → replay/no-op permitido DENTRO de um manifest aprovado distinto; alias inexistente → INSERT; mesma forma normalizada ligada a target DIFERENTE → conflito. Qualquer conflito → abort ANTES do 1º INSERT (zero write). A regra NÃO apaga ambiguidade histórica, não escolhe vencedor, não muda o resolver, não cria UNIQUE global, sem score/ranking/LIMIT 1.

**D16 · Atomicidade.** Rito de N1: BEGIN → advisory lock city+manifest → valida approval/grant/manifest → preflight de TODAS as linhas → prova zero conflitos → INSERTs autorizados → alias events → provas finais → COMMIT único. Qualquer falha → ROLLBACK integral. SEM commit parcial. Chunking = decisão futura nacional.

**D17 · Replay e rerun.** Replay de relação: relação exata preexistente DENTRO de um manifest aprovado diferente = no-op idempotente. Rerun do mesmo manifest_id+version+hash já executado com sucesso = **rerun fail-closed** (zero write, exit não-zero; NÃO retorna novo sucesso). Parcial = fail-closed (não reconciliar). Revogado/hash divergente = fail-closed. Cada execução legítima nova exige novo run_id.

**D18 · Resolver.** N1 NÃO altera a semântica do resolver postal: 0 target → pending; 1 → resolved; >1 → pending/ambiguous. Sem ranking/prioridade/winner. Popular aliases só permite que casos antes pendentes se tornem resolvidos.

**D19 · Migrations futuras.** PORTA-TERRITORY-ALIASES = migration **0** (reutiliza função de grant + grants + grant events + guard pattern). N1 = migration OBRIGATÓRIA para: approval/revocation/supersession events; execution house; alias curation events; alias writer authorizations; evolução ESTREITA dos triggers HOLD; função writer. Nenhuma migration criada nesta decisão docs-only.

**D20 · Mutations obrigatórias (família futura).** 1 job recebe capability; 2 job em actors; 3 status autoriza; 4 hash não validado; 5 approval sem representation; 6 approval sem capability; 7 approval com grant inválido; 8 execução sem revalidar grant; 9 execução após revogação; 10 hash divergente; 11 linha adicionada após approval; 12 provider vira fonte soberana; 13 alias cria bairro; 14 INSERT direto; 15 UPDATE permitido; 16 DELETE permitido; 17 token reutilizável; 18 token fora da transação; 19 GUC bypass; 20 role bypass; 21 tenant bypass; 22 trigger disable; 23 capability substituta; 24 grant errado; 25 city errada; 26 job simula representação; 27 grant event substitui approval; 28 execution sem alias event; 29 alias event sem approval; 30 conflito não aborta; 31 ranking/LIMIT 1; 32 UNIQUE global; 33 commit parcial; 34 rerun do mesmo manifest aceito; 35 Bank/Social importado; 36 produto real passa.

**D21 · Fronteiras Social/Bank.** Territory cria e resolve identidade; Social apenas LÊ city_id/neighborhood_id; Bank consome eventos territoriais; Bank provisiona contas regionais; onboarding nunca chama Bank; `alias_created` não movimenta dinheiro. N0-D NÃO autoriza qualquer atividade financeira.

**D22 · Sequência.** N0 (concluído) → N0-D (esta decisão) → PORTA-TERRITORY-ALIASES (grant exato, separada) → N1 (Curitiba alias-first) → N2 (catálogo oficial de municípios) → N3 (fila governada de candidatos) → N4 (manifests oficiais de bairros) → N5 (address→neighborhood_id) → N6 (Social territorial) → N7 (Bank regional). Nenhuma fase posterior é aberta por esta decisão.

## Escopo negativo
N0-D NÃO autoriza: migration, grant, writer, HOLD, manifest aplicado, alias, bairro, vínculo de endereço, Social, Bank, conta regional, split, ledger, fundo regional.

**MVP CURITIBA ALIAS-FIRST · N0-D REGISTRADA · FORMA FÍSICA RATIFICADA · MATERIAL NÃO INICIADO.**
