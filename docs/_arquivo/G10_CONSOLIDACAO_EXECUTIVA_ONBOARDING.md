# G10 — CONSOLIDAÇÃO EXECUTIVA: FLUXO DE CRIAÇÃO DE CONTA / ENERGIZAÇÃO INICIAL

**Natureza:** documento de AUDITORIA READ-ONLY para ratificação adversarial. NÃO é norma. NÃO abre DT oficial. NÃO autoriza execução. Nomes de DT e severidades são PROPOSTAS de auditoria até promulgação de Clayton.
**Data:** 2026-06-10 · **Auditoria:** instância Claude (Opus, GUARDIÃO) em auditoria adversarial cruzada com IA Diretora (ChatGPT) · **Ratificação adversarial:** pendente (ChatGPT/Yala) · **Promulgação:** exclusiva de Clayton.
**Fontes do snapshot:** `SRC_FULL.txt` (backend), `frontend_src_completo.txt`, `MIGRATIONS_FULL.txt`, `REMEDIATION_DECISIONS_LOG.md`, `REMEDIATION_DT_LOG.md`, `STATUS_EXECUCAO_GLOBAL.md`, `01_NORMATIVE_FULL.txt`. Memórias das instâncias datadas 2026-06-09 (HEAD ~`7430a32c`, branch `rescue-structural`).
**Convenção de citação:** números de linha referem-se aos arquivos AGREGADOS (`SRC` = SRC_FULL.txt; `FE` = frontend_src_completo.txt; `MIG` = MIGRATIONS_FULL.txt; `DEC` = REMEDIATION_DECISIONS_LOG.md; `DTL` = REMEDIATION_DT_LOG.md), salvo marcação `rel.` (linha dentro do arquivo extraído).
**Contexto de severidade:** sistema VIRGEM (apenas na máquina de Clayton; zero usuários/empresas/transações reais). Todos os achados são defeitos de planta-baixa, sem vítimas — o momento mais barato de decidir e corrigir.

---

## 1. RESUMO EXECUTIVO

- **O que o cadastro cria hoje:** uma identidade civil tecnicamente íntegra (CPF→global_user→user→identity→actor, na ordem causal correta) — dentro de um **tenant novo criado só para ela**.
- **O que ele não energiza:** comunidade nenhuma — feed, grupos, convites, referral e fundo regional nascem vazios e incomunicáveis por construção; e o actor PF nasce sem nenhuma capability (`{}`).
- **A decisão de Clayton que desbloqueia o resto:** *"em qual tenant nasce a pessoa física?"* — dela dependem piloto, referral, CTA de recuperação e qualquer energização social/econômica.

---

## 2. ACHADOS JÁ PROVADOS MATERIALMENTE NO SNAPSHOT

Comprovados por código no snapshot, independentes de norma ou de repo vivo:

| # | Fato provado | Evidência |
|---|---|---|
| F1 | Register frontend não envia `x-tenant-id` | rota lê só o header (SRC 12935); register usa `apiFetchPublic` |
| F2 | `apiFetchPublic` não injeta tenant (só remove headers de actor) | FE 3737-3753 |
| F3 | Sem header, backend cria tenant novo `user-{slug}-{ts}` por cadastro | SRC 13691-13705 |
| F4 | Convite de piloto é tenant-scoped estrito, checado APÓS criar o tenant novo | SRC 13730-13760; repo `WHERE tenant_id=$1` SRC 91916-91941 |
| F5 | Referral morto em duas camadas no cadastro: validação client usa `apiFetch` autenticado em página pública (→ `MISSING_TENANT` → status `invalid` → submit bloqueado); `applyReferralCode` busca código no tenant recém-nascido e re-lança 400 | FE 1876-1879; FE 3825-3835; SRC 13889-13902; rota `/referral/validate` no protectedScope (SRC app.builder:435) |
| F6 | Register aceita e valida 5 valores de gender | options FE ~50728-50732; zod `GENDER_VALUES` SRC 12887-12898; union de 5 no service SRC 13680 |
| F7 | SSOT persiste só 3 (`male|female|other`); valores fora evaporam (genderToSave=null + strip incondicional do blob) | SRC 72630; 99932-99936; 99955 |
| F8 | UI de reparo oferece só 2 (`male|female`); `other` exibe "Não informado" travado | FE 43500-43501 rel.46-47; options FE ~43797-43799; LockedField FE ~43772-43775 |
| F9 | Register retorna 200 mesmo com `ensureIdentityRow`/`ensureUserActor` falhando (duplo try/catch-warn, "será retentado no próximo acesso") | SRC 13993-13999; 14001-14012 |
| F10 | Não existe E2E de cadastro orgânico nem de falha parcial identity/actor nos scripts do snapshot | grep `validate-pipeline-e2e-*`: todos actor/bank/authority sobre seeds |
| F11 | `profileProgress` não gateia nada no backend (comparações `>=80` achadas são trust-score e nível de learning) | rota única SRC 99577; falsos-positivos SRC 110299, 96716 |
| F12 | `identity_status === 'COMPLETE'` (nome+CPF+nascimento+gender m/f/o) gateia criação de grupo nas duas camadas, com check estrutural próprio | fórmula SRC 6206-6222; gate 403 SRC 165799-165810; wizard FE 90556/90720; check SRC 334812 |
| F13 | Três GETs ainda criam actor (classe que o sweep 0113 caça) — e são hoje a única cura do cenário "actor ausente" | `GET /core/profile` via SRC 5589-5591; `GET /profile/progress` transitivo SRC 6271; `GET /social/actors/:id` SRC 277550-277560 |
| F14 | SocialLayout bloqueado sem actor exibe instrução sem nenhum CTA/rota; `/empresas` está atrás do próprio bloqueio e oculta no piloto | SocialLayout rel.178-186; App.tsx:286; `PILOT_HIDDEN_ROUTES` GlobalSidebar:96 |
| F15 | `PUT /profile/physical` é fantasma: frontend chama no passo ③ do save de Interesses; backend não tem a rota | chamada FE rel.262 do ProfilePhysical; grep PUT/POST `/physical` no SRC: vazio |
| F16 | Debug com dado civil no caminho quente: `IDENTITY_STATUS_DEBUG` despeja fullName+CPF em `console.error` a cada leitura de perfil; `PARAM_DEBUG`; `devLog` vivo (protocolo de abril afirmava devLog=0 — afirmação hoje falsa) | SRC 6206-6214; 5701; 5668+ |

Fatos auxiliares provados: actor PF nasce com capabilities `{}` (`getDefaultCapabilities` sem case `user`, SRC 7996-8040); login não repara identity/actor (SRC 14027-14140); bootstrap `GET /actors/available` é leitura pura (SRC 277426-277458); a cura acidental do actor é DEV-quebrada (client lança antes do fetch, FE 3845-3852; exempt-list FE 3905-3912) e `/home` fura o gate de actor (HomePage FE 146872-146880); reparador de identity inexiste em runtime (caller único = o próprio register; o segundo hit é o texto do erro da trava, SRC 274275-274281); estado "actor sem identity" é irrepresentável por construção (FK `fk_actor_identity` + trava — cumpre DECISION-0062 F3.1 v2/§7).

---

## 3. MAPA DAS RAÍZES P0/P1

> Campos por raiz: 1 Nome · 2 Severidade proposta · 3 Evidência principal · 4 Fonte normativa · 5 Confiança · 6 Impacto usuário · 7 Impacto arquitetural · 8 Decisão de Clayton? · 9 Patch cirúrgico? · 10 Bloqueia · 11 Próxima prova no repo vivo

### R1 · `DT-SIGNUP-TENANT-ISOLATION-NO-STRATEGY` (G1)
2. **P0** (proposta). 3. F1+F2+F3; zero ponte estrutural entre tenants em 250+ migrations (sem `parent_tenant`/`membership`/`hierarchy`; `tenant_contexts` é permissão de categoria intra-tenant, MIG 2251).
4. **VÁCUO-NORMATIVO** nas fontes do snapshot (DEC 444KB + 01_NORMATIVE 1.4MB: nada sobre estratégia de tenant no signup) **+ INCONCLUSIVO** quanto aos `DECISION_*.md` individuais de `docs/02_decisions/` (ausentes do snapshot). Indício contrário ao isolamento: `global_users.cpf` é âncora de "deduplicação **cross-tenant**" (DEC 5464) — o desenho assume pessoas atravessando tenants.
5. Confiança: **ALTO** para o comportamento do código; **BAIXO** para "acidente vs decisão" (depende do repo vivo).
6. Usuário nasce num universo privado vazio: social, grupos, marketplace, convites e indicação inertes por construção.
7. Multiplica tenants por pessoa; mina a premissa cross-tenant do CPF; contamina R2, R3, R7 e qualquer estratégia de comunidade/fundo regional.
8. **SIM** — Pergunta P0 nº1. 9. **NÃO** (decisão de arquitetura/produto). 10. Bloqueia R2, R3, R7 e o desenho do CTA.
11. `grep -ril "tenant" docs/02_decisions/DECISION_*.md`; `git log -S "Tenant criado automaticamente"` para datar a origem do auto-create.

### R2 · `DT-PILOT-INVITE-TENANT-MISMATCH` (G1b, filha de R1)
2. **P0 condicional** (enquanto `PILOT_MODE=true`). 3. F4: tenant novo é criado ANTES da checagem; convite vive no tenant semeado → `hasValidInvite(tenantNovo)` = false → 403 + tenant deletado.
4. **NORMA-CONTEXTUAL/VÁCUO:** a exceção do piloto está documentada in-code ("EXCEÇÃO INSTITUCIONAL SPRINT 30"); o escopo do convite frente a tenant recém-criado não tem decisão localizada.
5. **ALTO** (mecânica); herda o BAIXO de R1 quanto à intenção.
6. Cadastro orgânico em piloto é matematicamente impossível; convites do piloto nunca foram exercíveis pelo caminho público.
7. Piloto intestável de ponta a ponta pelo fluxo real.
8. **SIM** (deriva da Pergunta 1). 9. **NÃO** antes de R1. 10. Bloqueia qualquer teste de piloto com cadastro real.
11. Conferir `PILOT_MODE` no `.env` vivo e `SELECT tenant_id FROM pilot_invites` no dev.

### R3 · `DT-REGISTER-REFERRAL-DEAD-BY-CONSTRUCTION` (G1c, filha de R1)
2. **P1**. 3. F5 (dupla camada client+server).
4. **VÁCUO-NORMATIVO** (nenhuma norma sobre escopo do referral); o mecanismo de bloqueio do submit com código inválido é regra de UI legítima — o defeito é o "inválido" ser inevitável.
5. **ALTO**.
6. Campo "código de indicação" inutilizável; preenchê-lo IMPEDE o cadastro até ser apagado.
7. A "chave financeira" do referral (comentário do próprio register) nunca girou no caminho vivo.
8. **Parcial** — a camada client é técnica; a semântica (referral cruza tenant?) depende da Pergunta 1. 9. **Parcial** (client sim; semântica não). 10. Bloqueia aquisição por indicação. 11. Nenhuma adicional necessária.

### R4 · `DT-GENDER-CONTRACT-TRIPLE-VOCABULARY` (G2)
2. **P0/P1**. 3. F6+F7+F8; consequências: `onboarding_completed` nunca liga sem gender válido (SRC 100015-100036) → todo login → `/perfil` (FE 33944/50459); cadeia completa na tabela do turno G2.
4. **NORMA-VIOLADA (parcial) + INCONCLUSIVO:** DECISION-0080 é RATIFICADA por Clayton — gender é atributo civil do Identity SSOT, "perfil coleta, identidade guarda" (DEC 6424-6433) — e o princípio constitucional "nenhuma camada cria realidade paralela" é ferido por três vocabulários simultâneos. **Qual camada porta o vocabulário canônico** (o doc `DECISION_0080_*.md` e o pacote `@unificard/contracts` estão fora do snapshot) = INCONCLUSIVO.
5. **ALTO** para a incoerência material; **MÉDIO/BAIXO** para apontar a camada fora-da-lei.
6. `non_binary`/`prefer_not_to_say`: dado civil evapora em silêncio; loop perpétuo de login→/perfil; impedido de criar grupo (R11) com ordem impossível de cumprir; `other`: salvo no SSOT, exibido como "Não informado" travado + "contate o administrador".
7. Contrato↔SSOT↔UI divergentes em dado civil; o único gate real do perfil herda o defeito.
8. **SIM** — Pergunta P0 nº2. 9. **NÃO** (vocabulário civil é decisão; os patches posteriores são cirúrgicos). 10. Bloqueia R11 para esse público e o texto do gate de grupos.
11. Ler `docs/02_decisions/DECISION_0080_PROFILE_GENDER_IDENTITY_SSOT.md` + `packages/.../contracts` (`GENDER_VALUES`).

### R5 · `DT-REGISTER-BEST-EFFORT-IDENTITY-NO-RUNTIME-REPAIR` (G5A)
2. **P0/P1**. 3. F9 (metade identity) + caller único de `ensureIdentityRowForGlobalUserId` em runtime = o próprio register (SRC 13996; def 72462; o terceiro hit é a mensagem da trava 274280) + trava fail-closed SRC 274269-274281.
4. **Mista:** a TRAVA cumpre norma (DECISION-0062 F3.1 v2 + §7 ordem causal + FK `fk_actor_identity`) — está CERTA. O best-effort sem reparo é **VÁCUO-NORMATIVO + DECISÃO-PENDENTE** (política de nascimento parcial da PF); padrão adjacente ratificado existe para grupos ("dois momentos recuperável", Fase 3C.3), sem equivalente decidido para PF.
5. **ALTO** (código); a política é pendente por definição.
6. Conta morta-viva permanente: 200 no cadastro, beco depois, irreparável sem SQL/executora.
7. Estado A irrecuperável em runtime; o comentário "será retentado no próximo acesso" é promessa órfã literal.
8. **SIM** — Pergunta P0 nº3 (família `DT-COMPANY-BIRTH-NON-TRANSACTIONAL-CLEANUP`). 9. **NÃO** no chute. 10. Bloqueia R7 (CTA) e R8 (remoção dos GETs). 11. Opcional: reproduzir falha induzida em dev e observar o estado.

### R6 · `DT-REGISTER-BEST-EFFORT-ACTOR-CURE-BY-ACCIDENT` (G5B)
2. **P1**. 3. Reparador real e alcançável: GlobalHeader→`GET /profile/progress`→`calculateProfileProgress`→`getCompleteProfile`→`ensureUserActor` (SRC 6271 + 5589-5591; header presente em `/home`, que fura o gate de actor — FE 146872-146880); **DEV-quebrado** (client lança antes do fetch para rota não-exempt sem actor, FE 3845-3852); no cenário A o ensure lança na trava e o catch engole (`actor:null`, SRC 5624-5627).
4. A cura **VIOLA o padrão reader** (DECISION-0069 executada + correções da diretora no 0113 — DTL 11830: "NÃO cria actor, sem ensureUserActor; espelha o reader C1/DECISION-0069") sendo, simultaneamente, o único reparo existente ⇒ acoplamento obrigatório com R8.
5. **ALTO**.
6. Cura invisível, não-guiada, só em PROD; quem recarrega no beco de `/perfil` fica preso; o tour de boas-vindas convida para as portas trancadas.
7. Assimetria DEV≠PROD (o piloto local nunca reproduz o que produção curaria); dependência de efeito colateral de widget.
8. **SIM** (Pergunta 3 desenha o reparo legítimo). 9. **NÃO isolado**. 10/é bloqueada por: R8 (remoção dos GETs mata a cura). 11. Smoke manual em dev confirmando o throw do client.

### R7 · `DT-SOCIALLAYOUT-NO-ACTOR-BLOCKED-WITHOUT-CTA` (G5C)
2. **P1** (UI/jornada). 3. F14: dois `<p>` ordenando "Crie ou associe um perfil ou empresa" sem botão, link ou rota; as rotas de criação exigem `responsibleActorId` humano (`ensurePageActor`/`ensureGroupActor`) e moram atrás do próprio bloqueio.
4. **VÁCUO-NORMATIVO** (não há norma de recoverability de conta PF).
5. **ALTO**. 6. Instrução impossível na primeira tela pós-falha. 7. Dead-end de jornada institucionalizado.
8. **SIM** (o destino do CTA depende das Perguntas 1 e 3). 9. **NÃO** antes delas. 10. —. 11. —.

### R8 · `DT-GET-CREATES-ACTOR-SURVIVORS-0069` (G5D — rotear à IA-ACTOR-USERS)
2. **P1 lateral**. 3. F13 (três pontos).
4. **NORMA-VIOLADA com proveniência precisa:** não é o título literal da 0069 ("Readers user-scoped resolvem declarações C1 pelo actor user", DEC), e sim o PADRÃO executado dela + correções ratificadas da diretora no 0113 (DTL 11830) + régua operacional da executora (§2.11): leitura não cria actor.
5. **ALTO**. 6. Nenhum dano direto hoje — é a cura acidental. 7. Classe caçada pelo sweep sobrevivendo em três pontos; remoção ingênua mata a única cura do cenário B.
8. Sequenciamento **SIM**. 9. **SIM tecnicamente, PROIBIDO isolado** (STOP de acoplamento com R6). 10. Bloqueia o fechamento total da família reader-0069/0113. 11. Sweep no repo vivo por outros `ensureUserActor`/`getActiveActor` em handlers GET.

### R9 · `DT-REGISTER-PARTIAL-FAILURE-NO-E2E-COVERAGE` (G5E)
2. **P1**. 3. F10.
4. **VÁCUO-NORMATIVO** (nenhuma norma exige; a prática da casa — 4 gates + e2e por fatia — torna a ausência anômala).
5. **ALTO** dentro do escopo do snapshot (e2e fora de `src/scripts` não foram varridos).
6. Indireto. 7. O nascimento do usuário é o único fluxo crítico sem rede de prova.
8. **NÃO** (a Diretora pode mandar). 9. **SIM** — mas o conteúdo do e2e depende da Pergunta 3 (o que afirmar: atomicidade ou reparo?). 10. Bloqueia a validação de qualquer correção do nascimento. 11. Rodar a suíte no repo e confirmar inexistência fora do snapshot.

### R10 · `DT-PROFILE-COMPLETION-UNLOCK-PROMISE-WITHOUT-GATE` (G9)
2. **P1/P2** (honestidade de UI). 3. F11 + banner "Complete mais informações para **desbloquear recursos**" keyed em progress<80 (FE 38123-38132); única "mensagem" backend é payload do próprio cálculo (SRC 6355-6357).
4. **VÁCUO-NORMATIVO + DECISÃO-PENDENTE** (a promessa vira produto ou o texto vira honesto). Exceção documentada: a metade civil da promessa aponta para o gate real de grupos (R11/F12) — promessa parcialmente verdadeira, mal endereçada (fala em %, a chave é `identity_status`).
5. **ALTO**. 6. Expectativa falsa de desbloqueio por percentual. 7. Nenhum.
8. **SIM** — Pergunta P0 nº4. 9. **SIM** (texto) — STOP até a decisão. 10. —. 11. —.

### R11 · `DT-IDENTITY-STATUS-GENDER-DEPENDENCY-EXCLUDES-NONBINARY` (G9b — fusão G2×G9)
2. **P0/P1**. 3. F12 + F7: fórmula exige `gender ∈ {male,female,other}` (SRC 6206-6222); o 403 instrui "concluir cadastro básico (… e sexo)" (SRC 165804-165810) — que a vítima do R4 JÁ cumpriu e o sistema descartou; o form de reparo só aceita binário (F8).
4. O gate em si **CUMPRE** `identity_status`; a exclusão **HERDA a fonte de R4** (violação material + vocabulário INCONCLUSIVO).
5. **ALTO** (mecânica). 6. Único desbloqueio real do perfil negado permanentemente, com culpa atribuída ao usuário. 7. O único gate funcional de completude está contaminado pelo defeito civil.
8. **SIM** (Pergunta 2). 9. **NÃO isolado**. 10. —. 11. Idem R4.

---

## 4. PONTAS P2/P3 CIRÚRGICAS

### P-A · `DT-PHYSICAL-UPDATE-PUT-GHOST-IN-SAVE-CHAIN`
2. **P2**. 3. F15: `handleSave` da aba Interesses executa, no mesmo try: ① lifestyle→C1 ✅ ② `declareInterestConceptC1` ✅ ③ `updatePhysicalProfile()`→PUT inexistente (FE rel.210-262 do ProfilePhysical). 4. **VÁCUO** (apêndice legado). 5. **ALTO** para a chamada; **MÉDIO** para o efeito no feedback (as ~10 linhas entre ② e ③ não foram inspecionadas — pode haver catch interno). 6. Provável "erro ao salvar" sobre save que funcionou (dados reais já gravados nos SSOTs). 7. Nenhum. 8. **NÃO**. 9. **SIM** (remover o passo ③; jamais materializar a rota legada). 10. —. 11. Ler FE rel.255-275 do componente; smoke do save.

### P-B · `DT-EDUCATION-WRITER-RESOLVE-BY-FIRST`
2. **P2**. 3. Writer de educação resolve actor com `WHERE … actor_type='user' LIMIT 1` (SRC 95093-95106). 4. **NORMA-VIOLADA:** família resolve-pelo-primeiro — `03_IDENTITY_CANONICA §8` proíbe; padrão ratificado é exatamente-1 senão fail-closed (micro-correção do invoice by-id, DTL 11828). 5. **ALTO**. 6. Latente (DB virgem: 1 actor por user). 7. Writer fora do padrão de resolução. 8. **NÃO**. 9. **SIM** (espelhar o padrão exato-1) — rotear junto do pacote R8 à IA-ACTOR-USERS. 10. —. 11. —.

### P-C · `DT-EDUCATION-EVENTS-NO-CONSUMER`
2. **P3/produto**. 3. Event-sourcing real no outbox transacional (SRC 95125-95143); consumidor único = read-model do próprio perfil (SRC 5613). 4. **DECISÃO-PENDENTE** (Pergunta 5). 5. **MÉDIO** (escopo do grep; consumidores fora da varredura podem existir). 6. Dado nasce verdade e dorme. 7. Trilho certo sem trem. 8. **SIM**. 9. **NÃO**. 10. —. 11. Grep vivo por subscribers do tipo de evento.

### P-D · `DT-LIFESTYLE-COLLECTED-NOT-CONSUMED`
2. **P3/produto**. 3. Coleta exemplar (substrato `actor_lifestyle_attributes`+audit MIG 20298/20381; gates 0113-5.3; consent no form) com consumidor único = exibição no CORE (SRC 5902). 4. Coleta **CUMPRE** 0071/0113; finalidade = **DECISÃO-PENDENTE** (LGPD: coleta sem finalidade explícita não deve se perpetuar). 5. **MÉDIO** (idem escopo). 6. Dado sensível guardado certo, sem destino declarado. 7. —. 8. **SIM**. 9. **NÃO**. 10. —. 11. Idem P-C.

### P-E · `DT-COMPLETE-ONBOARDING-ENDPOINT-ZOMBIE`
2. **P3**. 3. Rota `POST /profile/complete-onboarding` viva (SRC 99469-99495, 100212) + wrapper FE 19079 com call-site removido (comentário FE 38035). 4. **VÁCUO**. 5. **ALTO**. 6. Nenhum. 7. Superfície morta. 8. **NÃO**. 9. **SIM**. 10. —. 11. Grep vivo por callers externos antes de remover.

### P-F · `DT-CONFIRM-FIRST-ACCESS-DUAL-ROUTE`
2. **P3**. 3. Duas portas setam a mesma verdade: `POST /profile/confirm-first-access` (SRC 99528) e `POST /identity/confirm-first-access` (SRC 71749). 4. **VÁCUO** (qual é a canônica?). 5. **ALTO**. 6. Nenhum. 7. Superfície duplicada para um flag soberano. 8. Micro-decisão da Diretora. 9. **SIM**. 10. —. 11. Confirmar qual path o frontend vivo chama (`confirmFirstAccess` em api/profile vs api/identity).

### P-G · HIGIENE — CPF/console no caminho quente
2. **P2 em dev; P0 se chegasse a produção**. 3. F16. 4. **NORMA-VIOLADA:** §Nomenclatura ("sem devLog"; o protocolo de sessão afirmava devLog=0); LGPD-adjacente (CPF em stdout a cada leitura de perfil). 5. **ALTO**. 6. Nenhum hoje (sistema virgem). 7. Sujeira no hot-path mais lido do sistema. 8. **NÃO**. 9. **SIM** (fatia de limpeza dedicada, sem carona). 10. —. 11. `grep -rn "devLog\|PARAM_DEBUG\|IDENTITY_STATUS_DEBUG" backend/src` no vivo para o censo real.

### Residuais anotados (não-DT)
Comentário morto no App.tsx ("/home sem layout" — falso desde 05-15) · comentário enganoso em api/auth.ts ("tenantId é enviado via header" — caminho inexistente) · `SELECT *` no pilot-invites.repository (§Nomenclatura) · handler `GET /education` passa `userId` no campo `globalUserId` (suspeita de nomeação, SRC ~95030 rel.) · `eventId` determinístico por `(eventType:tenantId:educationId)` — colisão em re-eventos do mesmo tipo: **INCONCLUSIVO** sem ler o conflito de `insertEventOutboxRow` · ramo morto `onRegisterSuccess→/home` no cadastro (backend hardcoda `requiresOnboarding=true`).

---

## 5. COISAS QUE NÃO PODEMOS AFIRMAR AINDA

1. **Tenant-per-user como ACIDENTE definitivo** — provado apenas o comportamento e o vácuo NAS FONTES DO SNAPSHOT; os `DECISION_*.md` individuais não estão aqui. Pela régua da casa ("vazio = inconclusivo"), a Hipótese B é a leitura mais provável, não um veredito.
2. **Vocabulário canônico final de gender** — exige leitura de `DECISION_0080_PROFILE_GENDER_IDENTITY_SSOT.md` e do pacote `@unificard/contracts` (ambos fora do snapshot). A incoerência de três camadas está provada; QUAL camada é a fora-da-lei, não.
3. **Qualquer promessa de produto não comprovada** — "energização" é lente de intenção de Clayton (0 ocorrências no código), não termo normativo; tudo que dependa de "o que o produto deveria fazer" está nas Perguntas, não nos vereditos.
4. **Severidades P0/P1 e nomes de DT** — propostas de auditoria; viram oficiais só por promulgação de Clayton e registro pelo processo (Diretora → executora → log).
5. **Ausência de consumidores** de educação/lifestyle e **ausência de E2E** fora do varrido — afirmações limitadas ao escopo dos greps no snapshot.
6. **Efeito exato do PUT fantasma no feedback** — pendente das ~10 linhas não lidas (P-A.11).
7. **Conduta do outbox em colisão de eventId** — pendente de `insertEventOutboxRow`.

---

## 6. MATRIZ DE DEPENDÊNCIA (ordem sugerida)

```
A. DECISÃO (Clayton): em qual tenant nasce a PF?            → destrava R1,R2,R3,R7
B. DECISÃO (Clayton): vocabulário de gender                  → destrava R4,R11 (e o texto do gate de grupos)
C. DECISÃO (Clayton): nascimento atômico × best-effort+reparo→ destrava R5,R6,R8,R9 (e o conteúdo do e2e)
D. Depois: CTA/reparo do beco sem actor (R7)                 ← depende de A e C
E. Depois: referral/piloto (R2,R3)                           ← depende de A
F. Depois: banner/progress (R10)                             ← depende da Pergunta 4
G. Por fim: P2/P3 cirúrgicas (P-A..P-G)                      ← independentes; só precisam de GO da Diretora
```

---

## 7. MATRIZ DE DECISÃO — 5 PERGUNTAS P0 PARA CLAYTON

| # | Pergunta (linguagem simples) | O que destrava | Raízes | Risco de adiar |
|---|---|---|---|---|
| 1 | **Quando alguém cria conta, entra em qual "mundo"?** Existe um tenant público/comunitário/regional inicial? A pessoa pode ter tenant pessoal E pertencer ao comunitário? | Piloto testável, referral vivo, social/grupos com gente, desenho do CTA | R1, R2, R3, R7 | Todo teste de cadastro real é inválido; cada signup fabrica um universo morto |
| 2 | **Gender será um campo único (qual vocabulário?) ou três campos separados (civil/social/clínico)?** | Fim da evaporação silenciosa; fim do loop de login; gate de grupos justo; UI de reparo coerente | R4, R11 | Dado civil de pessoa real será perdido em silêncio no primeiro cadastro não-binário |
| 3 | **Criar conta deve FALHAR se identity/actor não nascerem (atômico), ou pode nascer parcial COM reparo desenhado (dois-momentos, como nos grupos)?** | Política do nascimento PF; reparo legítimo; remoção segura dos GETs-que-criam; conteúdo do E2E | R5, R6, R8, R9 | Contas meio-vivas irreparáveis; cura por acidente que DEV não reproduz |
| 4 | **Perfil 100% deve destravar algo real, ou o texto do banner vira honesto** ("dados civis liberam gates de identidade; o resto melhora qualidade/inferência")? | Honestidade da UI; eventual roadmap de gates | R10 | Promessa visual envelhecendo até virar dívida de confiança |
| 5 | **Educação e lifestyle devem alimentar quais módulos agora** (matching? social? agenda? nenhum ainda)? Se nenhum: registrar finalidade futura explícita (LGPD) ou pausar coleta? | Finalidade declarada dos dados; prioridade de consumidores | P-C, P-D | Coleta sem finalidade explícita se perpetuando |

---

## 8. NÃO FAZER AINDA (STOPs consolidados)

1. Não corrigir tenant no chute. 2. Não mexer em gender sem decisão (nem "afrouxar" `identity_status` unilateralmente). 3. Não remover os GETs curativos antes de existir reparo legítimo (R6↔R8 acoplados). 4. Não inventar gates por progress. 5. Não reativar Saúde (DECISION-0071 manda os pré-requisitos). 6. Não criar `PUT /profile/physical` — a correção é remover o apêndice. 7. Não abrir execução financeira (fora do escopo desta auditoria). 8. Não mandar a executora patchar NADA deste documento sem decisão promulgada + GO da Diretora + selo Yala.

---

## 9. PRÓXIMO PASSO RECOMENDADO

1. **Ratificação adversarial deste documento** pela IA Diretora (ChatGPT) — caçar furo, exigir rederivação de qualquer item.
2. **Clayton responde as 5 perguntas** (Seção 7), na ordem A→B→C.
3. **Provas pendentes no repo vivo** (lista única, read-only, antes de qualquer GO): `DECISION_*.md` individuais (tenant) · `DECISION_0080_*.md` + `@unificard/contracts` (gender) · linhas FE rel.255-275 do ProfilePhysical (P-A) · `insertEventOutboxRow` (colisão) · censo `devLog/PARAM_DEBUG` · callers de `/profile/complete-onboarding` · sweep GET-cria-actor.
4. Só então a Diretora consolida os prompts cirúrgicos para a executora `unificard`, fatia a fatia, com "NÃO EXECUTAR AINDA" até ratificação tripla.

---

*Documento de auditoria read-only. Nada aqui foi executado, commitado ou registrado em log oficial. Auditoria: Claude (GUARDIÃO). Ratificação adversarial: pendente. Promulgação: exclusivamente Clayton.*
