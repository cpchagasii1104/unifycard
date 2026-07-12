# DECISION-0173 — N2-D.0: autoridade territorial da fundação canônica de bairro

- **Status:** DECIDIDA / PROMULGADA (docs-only) — registra o desenho soberano da autoridade territorial de curadoria de bairro da frente `F-NEIGHBORHOOD-CANONICAL-IDENTITY`, após o GATE N2-D read-first. **Nenhuma fatia material é aberta por este documento.** Não cria capability física, grant, coluna, CHECK, key, enforcement, writer, porta de bootstrap, nem toca `actor_capability_grants`, `permission-keys.ts`, allowlists, rotas de authority ou `canRepresentActor`.
- **Data:** 2026-07-11
- **Autoridade:** Clayton (soberana), sobre o relatório do GATE N2-D read-first (executado em HEAD `fc539abcd`, read-only, zero material) e sobre o veredito que o aprovou com quatro ajustes vinculantes.
- **Predecessoras:** DECISION-0171 + adendo N1.1 §6/§6.1 (representação ≠ curadoria; capability territorial explícita obrigatória; fail-closed) · DECISION-0172 P1/P2/P3 (casa canônica evoluída; tenant institucional rejeitado; maker-checker opção C; keys por ação) · N2-C SELADA pela Yala (`62cbeae24` material · `e0f7ab486`/`fc539abcd` cartório). Sobe a montante: DECISION-0113 (autoridade server-side; canal client-declared é hint), DECISION-0135 (nomenclatura `domain:action`), DECISION-0136 (substrato `actor_capability_grants`), DECISION-0137 (tri-registry de permissões), DECISION-0138 (grant de operador — decisão de produto separada).
- **Escopo:** decisão de desenho de autoridade + convivência tenant/global + vocabulário de keys + ciclo de vida do grant + composição de enforcement + sequência material. **NÃO** autoriza migration, schema, capability física, grant, key, allowlist, trigger, enforcement, writer, porta de bootstrap, Social, Bank, nem remoção de HOLD. Cada fatia material (N2-D.1…D.3, PORTA-TERRITORY-1, N2-E…N2-G, N3) exige GO e auditoria próprios.

---

## 0. Contexto e rastreabilidade

O GATE N2-D read-first (inventário do substrato vivo de authority, read-only, sem edição/commit) concluiu que a autoridade territorial deve **evoluir a casa canônica** `actor_capability_grants` — nunca criar um segundo sistema de permissões. Achados comprovados por arquivo:

- `canRepresentActor` (`authorization.service.ts:335`) responde **exclusivamente** se a conta pode operar como determinado Actor (ownership · `canManageCompany` · dono de grupo · registry · delegação FULL `'*'`). É **prova de representação**, nunca de curadoria. Não consulta `actor_capability_grants`.
- `actor_capability_grants` (DECISION-0136) é a **casa canônica** de capability. Hoje: `scope_type='actor'` TRAVADO por CHECK (`chk_acg_scope_type`), `scope_actor_id` NOT NULL, `tenant_id` NOT NULL; primitivo `hasCapabilityGrant` DEFINIDO mas **não aplicado a rota de negócio** (quarentenado; `audit-capability-grant-quarantine.mjs`).
- **Nenhuma capability territorial existe.** Nada escopa autoridade a país/estado/cidade/bairro.
- **Defeito material vivo:** `repository.revoke` faz `reason=COALESCE($4, reason)` — o motivo da revogação **sobrescreve** o motivo da concessão (uma coluna, dois sentidos), sintoma da ausência de trilha append-only na casa de capability (a casa de delegação já tem `actor_delegation_events`).

**Authority SSOT existente reconhecido:** `actor_capability_grants` (grants) + `permission-keys.ts` (registry canônico das capability keys). `canRepresentActor` é prova de representação; `business-permissions` é role-map, **não** registry; RBAC legado **não** participa. **Location Core continua o SSOT territorial.** **Bank não participa.**

Este documento crava, como norma da frente, o desenho aprovado com os quatro ajustes vinculantes do veredito.

---

## 1. Casa canônica — evolução, não duplicação (vinculante)

A autoridade territorial **NÃO cria nova tabela principal de grants**. Ela **evolui** `actor_capability_grants` para admitir:

```
scope_type = 'actor' | 'territory'
```

`canRepresentActor` **permanece intocado e puro** — não recebe `city_id` nem capability.

**PROIBIDO** (segunda verdade de autoridade / atalho):
- `territorial_permissions`, `neighborhood_admins`, `city_admins`, `curator_roles` ou qualquer tabela paralela de grants;
- role textual como authority; booleano `is_super_admin`/`is_admin` como authority;
- `scope_ref_id` genérico (UUID sem FK); `metadata`/JSON como escopo.

---

## 2. Convivência tenant/global (vinculante — a alternativa "tenant institucional" está REJEITADA)

O catálogo territorial é **global** e **não pode** ser artificialmente "possuído" por um tenant institucional (DECISION-0172 P1). Ratifica-se o modelo de dois shapes mutuamente exclusivos:

**Grant actor-scoped** (preserva a semântica atual):
```
scope_type       = 'actor'
tenant_id        NOT NULL      -- isolado por tenant
scope_actor_id   NOT NULL
scope_city_id    NULL
```

**Grant territorial (city)**:
```
scope_type       = 'territory'
tenant_id        NULL          -- efeito global explicitamente declarado
scope_actor_id   NULL
scope_city_id    NOT NULL      -- FK real → cities.city_id
grantee_actor_id NOT NULL      -- continua sendo Actor real
```

- O grant territorial declara **efeito global explicitamente**; nunca inferido de tenant.
- Conta e Actor **não** viram "globais" por causa do grant — o global é o **efeito do grant**, não a identidade.
- **REJEITADO:** tenant institucional; tenant "sistema"; fallback para o tenant da requisição; qualquer duplicação do catálogo por tenant.

**Shape inválido deve falhar (CHECK, na fatia material):** actor sem tenant · actor sem `scope_actor_id` · actor com `scope_city_id` · territory com tenant · territory com `scope_actor_id` · territory sem `scope_city_id`.

---

## 3. Escopo MVP — apenas cidade (vinculante)

A arquitetura **pode** admitir futuramente país · estado · cidade · bairro. A necessidade material atual é **Curitiba**. A N2-D material inicial suporta **somente**:

```
scope_type = 'territory'
scope_city_id → cities.city_id   (FK real, sem scope_ref_id genérico)
```

**Não materializar agora** (cada um exige migration + GO próprios): country scope · state scope · neighborhood scope · herança territorial genérica · cross-city · arrays de região · radius/geofence · CEP como authority.

**Semântica do escopo de cidade:**
```
grant city-scoped para Curitiba
→ cobre operações sobre bairros cujo city_id = Curitiba
→ NÃO cobre São José dos Pinhais nem qualquer outra cidade futura
→ NÃO altera a identidade do Actor
→ NÃO concede representação
```

---

## 4. Capability keys (vinculante — `permission-keys.ts` é o registry SSOT)

`permission-keys.ts` está ratificado como SSOT das capability keys (DECISION-0135/0137); os demais vocabulários **não** decidem a existência das chaves usadas por grants. Ficam ratificadas como candidatas finais da N2-D as **seis** keys:

```
territory:create_neighborhood
territory:approve_neighborhood
territory:correct_neighborhood
territory:deactivate_neighborhood
territory:manage_neighborhood_aliases
territory:register_neighborhood_succession
```

**Gramática:** `domain:action`. **Regras:** match exato · sem wildcard · sem implicação automática · criar ≠ aprovar · corrigir ≠ desativar · alias ≠ rename automático · sucessão ≠ rename · possuir várias keys **não** funde operações · **zero financeiro** · **nenhuma key de "propor"** enquanto candidatos permanecem adiados (DECISION-0171 §7 / 0172 P3).

As seis keys deverão entrar **sincronizadas** nos três registros — **somente em N2-D.2 material**:
1. `permission-keys.ts` (registry SSOT);
2. CHECK físico de `actor_capability_grants` (`chk_acg_capability_nonfinancial`);
3. allowlist TS da casa de grants (`NON_FINANCIAL_CAPABILITY_ALLOWLIST`).

**NÃO** adicionar uma sétima key de "administração dos próprios grants territoriais" nesta DECISION. O bootstrap inicial e a futura delegação de curadores precisam de **contrato próprio**, para impedir autoelevação de privilégio.

---

## 5. Maker-checker MVP — opção C (vinculante)

Ratifica-se a opção C (DECISION-0172 P2):
- a **mesma** pessoa/Actor **pode** criar e aprovar no MVP;
- criação e aprovação são **operações separadas**; cada uma exige **sua** capability e produz **sua** trilha;
- **nunca** existe autoaprovação implícita ("create-and-approve");
- o schema deve permitir **exigir pessoas diferentes no futuro sem reescrever** o catálogo.

Para Clayton no lançamento: poderá possuir `create` e `approve`; continuará havendo **dois atos auditáveis** (`created_by` X / `approved_by` X), cada um com a key e o grant usados + datas/evidência.

---

## 6. Bootstrap da primeira autoridade — PORTA-TERRITORY-1 (vinculante; NÃO implementada aqui)

Hoje **não existe "dono do território"** que conceda o primeiro grant. Logo, o sistema **não pode** exigir um grant territorial anterior para criar o primeiro; e **não pode** resolver isso deixando `super_admin` conceder grants livremente em runtime. A solução é uma **porta soberana de bootstrap, separada**:

**PORTA-TERRITORY-1** — finalidade: criar os primeiros grants territoriais de Curitiba para o Actor indicado por Clayton. A porta:
- exige **GO humano explícito**; ocorre **somente após a N2-D material selada** e **antes** do writer N2-E;
- **não** nasce em rota pública; **não** usa `super_admin` como fallback runtime; **não** usa get-or-create; **não** usa seed permissivo;
- resolve conta, Actor e Curitiba **fail-closed**, exigindo **uma única correspondência** (por `city_id`/IBGE);
- registra executor humano, Actor, cidade, keys, evidência e momento;
- **não** concede outra cidade; **não** cria bairros; **não** abre writer;
- pode ser executada **uma única vez** por operação governada.

Depois da porta, o runtime reconhece **somente os grants persistidos**. A condição `super_admin` serve apenas para **operar a cerimônia autorizada**, jamais como authority territorial permanente. **Não implementar a porta nesta DECISION** nem nas migrations estruturais N2-D.1/D.2.

---

## 7. Ciclo de vida do grant e defeito do `reason` (vinculante)

Registra-se o defeito vivo: `repository.revoke` **sobrescreve** o `reason` da concessão. Decisão:
- o `reason` existente significa **motivo da concessão**;
- o motivo de **revogação** é dado **separado**;
- revoke **nunca** pode apagar o motivo original;
- toda mudança de estado do grant (granted/revoked/expired/suspended) deve produzir **trilha append-only** (molde `actor_delegation_events`: trigger `BEFORE UPDATE/DELETE`, snapshot no momento do evento);
- revogação e expiração **não** apagam histórico; o estado corrente **pode** continuar projetado na linha do grant, mas o histórico **não** pode depender apenas do `UPDATE`.

A **N2-D.2** definirá o shape material da trilha. **Não corrigir código nesta DECISION.**

---

## 8. Composição de enforcement (vinculante — pertence ao N2-E)

O AND obrigatório do writer N2-E:
```
1. conta autenticada;
2. Actor operacional resolvido server-side;
3. canRepresentActor(tenant, user, actor) = true;
4. capability territorial ATIVA;
5. capability CORRETA para a operação (match exato da key);
6. scope_city_id igual à cidade do recurso;
7. vigência válida (valid_from/valid_until);
8. grant não revogado/expirado/suspenso.
Ausência em QUALQUER elo → deny fail-closed.
```

**Não** substituem nenhum elo: `super_admin` · tenant admin · role textual · `is_admin` · user autenticado · `canRepresentActor` isolado · `actor_id` vindo do body · cidade digitada · CEP · frontend. `canRepresentActor` **não** receberá `city_id` nem capability — a composição vive no serviço territorial/writer. Catálogo global = **sem owner nativo** ⇒ grant obrigatório para todos.

---

## 9. Contrato dos cinco elos da ação (vinculante — persistência é do N2-E)

Toda ação territorial futura deve persistir os **cinco elos** (DECISION-0171 §6.1-D): Actor representado · `user_id` da conta executora · Actor humano responsável · `grant_id`/capability usada · momento da ação.

- **N2-D** cria o grant e o primitivo; o **primitivo deve devolver `grant_id`**; **não** altera `neighborhoods`/aliases/sucessões para registrar ações que ainda não existem.
- **N2-E** materializa a trilha **por operação**, preenche os cinco elos e **nunca** aceita autoria declarada pelo cliente.
- **Não** criar tabela genérica de audit nesta DECISION.

---

## 10. Sequência material ratificada (todas TRANCADAS até GO próprio)

```
N2-D.0 (esta)          decisão docs-only da autoridade territorial
N2-D.1  scope_type='territory'; tenant_id nullable SÓ p/ territory; scope_city_id FK
        real; CHECKs de shape; índices parciais separados actor/territory; guard
        estrutural. ZERO key nova · ZERO enforcement · ZERO grant.
N2-D.2  seis keys nos três registros sincronizados; trilha append-only; correção do
        reason/revoke; services/repository/types. Rotas seguem quarentenadas.
        ZERO writer territorial · ZERO grant real.
N2-D.3  hasTerritorialCapability(actor, key, city_id): match exato; vigência/status
        fail-closed; retorna grant_id. SEM wiring em rota · SEM writer · SEM bootstrap.
[selo Yala da N2-D encerra o arco de authority]
PORTA-TERRITORY-1      ato soberano separado; só depois do selo completo N2-D; cria
                       os grants iniciais de Curitiba.
```

Cada fatia: **GO próprio · material próprio · provas · cartório · auditoria Yala.** A ordem N2-F/N2-E pode ser ajustada, mas **N2-F deve estar selada antes do N3** (DECISION-0172 §6).

---

## 11. Travas preservadas

Permanecem bloqueadas: N2-D.1/D.2/D.3 (até selo docs desta N2-D.0) · PORTA-TERRITORY-1 · saneamento de `neighborhoods.name` (trava independente) · N2-E · N2-F · N2-G · N3 · cadastro dos 75 bairros de Curitiba · aliases reais · CEP→bairro canônico · frontend administrativo · Social · Bank. `CANONICAL_WRITER_ALLOW` permanece **vazia**. HOLDs territoriais (núcleo/alias/3 de sucessão) permanecem **ativos**. Dois HOLDs 501 preservados. Δbank=0.

---

## 12. Escopo negativo (cumprido nesta fatia)

Docs-only: zero migration/schema/capability/grant/key/allowlist/trigger/enforcement; zero `backend/src`, `backend/scripts`, runner, guards, banco, roles; `actor_capability_grants`, `permission-keys.ts`, rotas de authority e `canRepresentActor` **intocados**; `neighborhoods`/aliases/sucessões/addresses intocados; frontend intocado; zero Social; zero Bank/split/fundo; dois HOLDs 501 preservados; `CANONICAL_WRITER_ALLOW` vazia; Δbank=0.

## 13. Efeito

- **N2-D.0 DECIDIDA/PROMULGADA docs-only.** Habilita, com GO próprio por fatia, a sequência do §10 — começando por N2-D.1.
- **N2-D.1…D.3, PORTA-TERRITORY-1 e todas as fatias materiais permanecem TRANCADAS** até GO explícito. A próxima auditoria é **apenas documental**; só após o selo desta N2-D.0 nasce o GO material da N2-D.1.

---

## ADENDO D1 — Saneamento da auditoria Yala da N2-D.0 (2026-07-11)

- **Status:** DECIDIDO / DOCS-ONLY / AGUARDA REAUDITORIA YALA LIMITADA.
- **Natureza:** este adendo **prevalece** sobre qualquer leitura anterior deste documento em conflito com o texto abaixo; **complementa** (não revoga) o restante. Anexado append-only — nada do conteúdo promulgado acima foi apagado ou reescrito.
- **Auditoria Yala da N2-D.0 (`4f2bbdb2c`):** veredito **🟡 SELO COM RESSALVA (documental)**. A arquitetura principal permanece **aprovada** — a casa `actor_capability_grants` evoluída, as seis capabilities, Curitiba como primeiro escopo, o AND com `canRepresentActor` e a PORTA-TERRITORY-1 separada **não** são questionados. **Nenhuma falha material; nenhuma nova casa de authority.** As ressalvas são **limitadas a lifecycle e à convivência tenant/global**, e fecham lacunas **antes** de virarem schema. Estado vivo que justifica o adendo: `actor_capability_grants` ainda tem `tenant_id NOT NULL`, escopo exclusivo por Actor, status `active/revoked/expired/suspended`, coluna única `reason` e unicidade ativa dependente de tenant; `canRepresentActor` é só representação; a revogação atual pode sobrescrever o motivo da concessão.

### D1.1 — `suspended` proibido para grants territoriais no MVP (Opção B)

Ratifica-se a alternativa mais estreita:
- grants `scope_type='actor'` existentes **continuam** subordinados ao lifecycle vigente — esta decisão **não** remove `suspended` globalmente;
- grants `scope_type='territory'` **não** podem nascer nem transicionar para `status='suspended'`;
- **não existem** eventos territoriais `suspended` / `resumed` / `reactivated`;
- suporte futuro a suspensão territorial exige **nova** decisão, migration, guard, provas e Yala próprios.

**Obrigação material futura (não implementar agora):** N2-D.1 ou N2-D.2 deverá criar invariante física fail-closed equivalente a `scope_type='territory' ⇒ status <> 'suspended'`. O primitivo N2-D.3 continuará negando qualquer status ≠ `active`, inclusive por defesa em profundidade.

### D1.2 — Expiração: vigência efetiva vs. materialização de `expired`

Dois fatos **distintos**:

**A. Expiração efetiva por vigência.** `valid_until <= now()` torna o grant **ineficaz imediatamente** na leitura fail-closed do resolver — **não** depende de `UPDATE`, job ou evento. Um grant pode continuar fisicamente com `status='active'` e já ser ineficaz.

**B. Materialização histórica de `expired`.** O status/evento `expired` **não** nasce automaticamente com a passagem do tempo; só existe quando um **emissor governado** executar a transição. Emissores possíveis no futuro (job governado · comando administrativo canônico · rotina explícita de manutenção) — **nenhum autorizado nesta DECISION**. **Não** se promete evento `expired` para todo grant vencido. Se uma transição explícita para `expired` existir no futuro: o estado corrente muda para `expired` **e** o evento append-only `expired` é inserido, **na mesma transação**, preservando executor, Actor responsável e momento.

### D1.3 — Atomicidade do lifecycle

Toda transição material de lifecycle é **atômica**: mudança do estado corrente do grant **+** inserção do evento append-only correspondente = **uma única transação**. No MVP territorial: criação (row `active` + evento `granted`) · revogação (row `revoked` + evento `revoked`) · expiração explícita, quando houver emissor (row `expired` + evento `expired`).

**Proibido:** `UPDATE` de status sem evento · evento sem alteração correspondente quando a transição exigir estado · commit parcial · best-effort · evento assíncrono posterior como única trilha · editar/apagar evento histórico. A N2-D.2 deverá escolher mecanismo fail-closed — preferencialmente trigger/função transacional ou repository único protegido — **sem** oferecer rota de `UPDATE` direto.

### D1.4 — `reason` e legado

- `reason` atual = **motivo da concessão**; `revoke_reason` é **separado**; o evento `revoked` preserva seu próprio motivo; revogar **nunca** altera o `reason` original; **nenhuma** migration inventa motivo histórico.

**Read-first obrigatório antes da N2-D.2** (inspeção, não mutação): contar todos os `actor_capability_grants`; agrupar por status; identificar rows `revoked`; identificar `reason` preenchido; verificar evidência de `reason` sobrescrito; verificar eventos `granted/revoked/expired/suspended` existentes.
- **Sem rows:** registrar zero e seguir.
- **Com rows:** não apagar; não reescrever silenciosamente; não atribuir motivo presumido; não fabricar eventos históricos; apresentar **plano forward-only específico** antes da aplicação.
- **Motivo original irrecuperável:** preservar o valor vivo sem reclassificá-lo falsamente; registrar a limitação histórica; **nunca** declarar que ele representa comprovadamente o motivo da concessão.

### D1.5 — `tenant_id` NULL: consequências vinculantes (não é só mudar coluna)

A N2-D.1 deve tratar explicitamente:

**A. Shape.** Actor-scoped: `tenant_id NOT NULL` · `scope_actor_id NOT NULL` · `scope_city_id NULL`. Territory-scoped: `tenant_id NULL` · `scope_actor_id NULL` · `scope_city_id NOT NULL`.

**B. Unicidade.** Preservar o índice parcial actor-scoped equivalente ao existente. Criar índice parcial territorial **independente de tenant**: `(grantee_actor_id, capability_key, scope_city_id) WHERE scope_type='territory' AND status='active'`. **Não** depender de NULL dentro do UNIQUE atual para deduplicar grants territoriais; **não** criar UNIQUE global que misture actor e territory.

**C. Repository e types.** **Não** usar um único `tenantId` opcional com semântica ambígua. Contratos explícitos e separados: operações actor-scoped (`tenantId` obrigatório · `scopeActorId` obrigatório · `cityId` proibido); operações territory-scoped (`tenantId` proibido/ausente · `cityId` obrigatório · `scopeActorId` proibido). **Não** inferir scope pelo conjunto de campos silenciosamente.

**D. Queries.** `list/findActive/grant/revoke` com caminhos **tipados e separados**. Territorial: nunca filtrar pelo tenant da request; nunca `COALESCE` tenant; nunca `tenant_id = $tenant OR tenant_id IS NULL` como autorização; usar `grant_id` + shape territorial ou Actor/key/city explícitos; validar FK real de city; não retornar grants de outra cidade por fallback. Actor-scoped: comportamento tenant-aware existente preservado.

**E. Acesso.** Auditar na D.1/D.2: ACL · RLS (se existir) · políticas · repository · rotas · serializers · tipos · listagens · revogação. **Grant global não torna o Actor, user ou sessão globais.** `canRepresentActor` continua recebendo o **tenant real** do Actor/conta.

**F. Grant/list/revoke territorial.** Sem tenant inferido · sem tenant institucional · sem tenant da request como fallback · sem rota genérica que aceite os dois formatos sem discriminante · fail-closed para shape inconsistente.

### D1.6 — Trilha de lifecycle: campos mínimos

A trilha append-only registra, no mínimo: `grant_id` · `event_type` · `grantee_actor_id` · `capability_key` · `scope_type` · `scope_city_id` **ou** `scope_actor_id` conforme o caso · `user_id` executor · Actor concedente/revogador · Actor humano responsável rastreável · motivo específico do evento · `occurred_at` · snapshot mínimo necessário do grant. **Actor IDs não substituem o user executor; user não substitui Actor; super admin não substitui autoridade.** O shape físico final pertence à N2-D.2.

### D1.7 — Fatias refinadas (obrigações atualizadas)

- **N2-D.1:** `tenant_id` nullable **condicionado ao scope**; `scope_city_id` FK; seis shapes fail-closed; índices parciais separados; proteção contra `suspended` territorial (se for a fatia estrutural adequada); repository/types/queries mapeados **sem enforcement**; zero key nova; zero grant real.
- **N2-D.2:** seis keys nos três registros; lifecycle append-only; `reason`/`revoke_reason` separados; atomicidade estado+evento; `suspended` territorial proibido e guardado; `expired` apenas com emissor explícito; inspeção de legado; rotas seguem quarentenadas; zero grant real.
- **N2-D.3:** resolver **somente** `active`; `valid_from <= now()`; `valid_until` NULL ou `> now()`; scope city exata; retorna `grant_id`; nenhuma inferência de tenant; sem writer/wiring.
- **PORTA-TERRITORY-1:** continua trancada até o **selo integral** da N2-D.

### D1.8 — Efeito do adendo

**N2-D.0-R DECIDIDA docs-only — AGUARDA REAUDITORIA YALA LIMITADA.** N2-D.1 permanece **trancada** até SELO COMPLETO. Nenhuma capability, grant ou authority material foi criada. PORTA-TERRITORY-1, N2-E, N2-F, N2-G e N3 permanecem trancadas; saneamento de `neighborhoods.name` segue pendente; Social e Bank permanecem fora.

---

## ADENDO D2 — Fechamento final das ressalvas documentais da N2-D.0 (2026-07-11)

- **Status:** DECIDIDO / DOCS-ONLY / AGUARDA REAUDITORIA YALA FINAL LIMITADA.
- **Natureza:** este adendo **complementa** o ADENDO D1 e **prevalece apenas nos dois pontos específicos abaixo** (D2.1 e D2.2); **não** revoga o restante de D1 nem de §§0–13; **não** cria autorização material.
- **Reauditoria Yala do ADENDO D1 (`2118370dd`):** veredito **🟡 SELO COM RESSALVA (documental)**. D1 resolveu corretamente quase toda a matéria; restaram **duas** lacunas de redação, **sem falha material**: R1 (dono material da constraint de `suspended`) e R2 (fluxo obrigatório para renovar um grant fisicamente `active` porém vencido). O estado operacional só muda pelo cartório — a reauditoria, por si só, **não** libera material.

### D2.1 — `suspended`: dono material inequívoco (encerra R1)

A **N2-D.1**, e não "D.1 ou D.2", é **obrigatoriamente** responsável por criar a invariante física:

```
scope_type='territory' → status <> 'suspended'
```

Forma esperada: CHECK real no banco · fail-closed · presente **no mesmo commit** que introduzir `scope_type='territory'` · **nenhum estado intermediário** aceita `territory+suspended` · a migration deve **provar** os shapes inválidos · o guard estrutural da D.1 deve validar a **presença e a forma** da constraint.

A **N2-D.2**: **não** cria essa constraint pela primeira vez; **protege** a constraint contra drop/enfraquecimento; **impede** repository/service/lifecycle de transicionar `territory` para `suspended`; **não** inclui eventos `suspended`/`resumed`/`reactivated`; mantém grants actor-scoped **fora** desta proibição territorial.

Removida de leituras futuras qualquer ambiguidade do tipo "D.1 ou D.2", "se for a fatia adequada" ou "pode ser criado posteriormente" — a redação de D1.1 fica **substituída neste ponto específico** pela atribuição inequívoca acima.

### D2.2 — `active` vencido e regrant (encerra R2)

**A. Autoridade efetiva.** `valid_until <= now()` → o grant **não autoriza imediatamente**; o resolver nega; **não** exige `UPDATE`/job/evento (preserva D1.2-A).

**B. Estado físico.** O grant pode permanecer temporariamente `status='active'` com `valid_until<=now()`. Enquanto assim permanecer: ocupa a unicidade parcial de `active`; **não pode** coexistir com novo grant equivalente; **não pode** ser sobrescrito; **não pode** ter sua vigência reciclada; **não pode** ser substituído in-place.

**C. Nova concessão equivalente.** Antes de criar novo grant para a mesma combinação (`grantee_actor_id`, `capability_key`, `scope_city_id`), um **emissor governado** deve, em sequência auditável:
```
1. localizar exatamente o grant antigo fisicamente active;
2. confirmar valid_until<=now();
3. confirmar que pertence ao mesmo Actor/key/cidade;
4. executar transição explícita para status='expired';
5. inserir evento append-only `expired`;
6. estado+evento na MESMA transação;
7. concluir sem commit parcial;
8. somente depois criar NOVA row de grant active;
9. inserir evento `granted` da nova row na mesma transação de criação.
```

**Proibido:** expiração silenciosa · `UPDATE` direto sem evento · alterar `valid_until` do grant antigo para reutilizá-lo · transformar o grant antigo em nova concessão · apagar o grant antigo · criar o novo antes de liberar a unicidade · `ON CONFLICT` para sobrescrever · inferir motivo ou executor · criar evento retroativo falso.

Cada nova concessão possui: novo `grant_id` · novo `reason` de concessão · nova vigência · novo evento `granted` · executor e Actor responsável **próprios**.

### D2.3 — Emissor do `expired`: nada implementado aqui

Nenhum emissor é implementado ou autorizado nesta docs-only. A capacidade de materializar `expired` pertence à **N2-D.2**, que deverá: definir uma operação canônica transacional; permanecer **sem rota pública aberta**; registrar user executor; registrar Actor humano responsável; registrar motivo da transição; inserir evento append-only; bloquear `UPDATE` direto. A **N2-D.1** cria **somente** a estrutura e a unicidade.

**Consequência:** N2-D.1 pode ser executada sem regrant runtime, pois **zero** grant territorial será criado nessa fatia; N2-D.2 deve estar selada **antes** da PORTA-TERRITORY-1; **nenhum** grant real pode existir antes de lifecycle e emissor estarem selados.

### D2.4 — Índice territorial: reafirmação

```
(grantee_actor_id, capability_key, scope_city_id)
  WHERE scope_type='territory' AND status='active'
```
Sem `tenant_id`; sem depender de NULL no índice antigo; sem misturar actor-scoped e territory-scoped. A aparente colisão com um grant `active`-vencido é **intencional e fail-closed**: impede novo grant enquanto o antigo não tiver sido encerrado corretamente, forçando a transição auditável para `expired` — **não** deve ser contornada relaxando a unicidade. **Não** usar `now()` no predicado do índice.

### D2.5 — Fatias consolidadas (substituem D1.7 nos pontos acima)

- **N2-D.1:** introduz territory/city; `tenant_id` nullable condicionado; `scope_city_id` FK; CHECKs dos seis shapes; **CHECK físico `territory→status<>'suspended'`**; índices parciais; guard estrutural. Zero keys novas · zero lifecycle novo · zero grant · zero enforcement.
- **N2-D.2:** seis keys nos três registros; lifecycle append-only; `reason`/`revoke_reason`; **operação canônica de revoke**; **operação canônica de explicit-expire**; **contrato active-vencido→expired→novo grant**; atomicidade; proteção contra `suspended` territorial; read-first do legado. Rotas ainda quarentenadas · zero grant real.
- **N2-D.3:** resolver `active` e vigente; `valid_from<=now()`; `valid_until` IS NULL ou `>now()`; Actor/key/city exatos; retorna `grant_id`; sem inferência de tenant; sem writer.
- **PORTA-TERRITORY-1:** só depois do selo integral de D.1+D.2+D.3; será a **primeira** criação real de grants territoriais.

### D2.6 — Efeito do adendo

**N2-D.0-R2 DECIDIDA docs-only — AGUARDA REAUDITORIA YALA FINAL LIMITADA.** N2-D.1 permanece **trancada até SELO COMPLETO**. Nenhuma capability, grant ou authority territorial foi criada. D.2, D.3, PORTA-TERRITORY-1, N2-E, N2-F, N2-G e N3 permanecem trancadas; saneamento de `neighborhoods.name` segue pendente; Social e Bank permanecem fora.

---

## ADENDO D3 — Matriz governada scope_type × capability_key (2026-07-11)

- **Status:** DECIDIDO / DOCS-ONLY / AGUARDA REAUDITORIA YALA LIMITADA.
- **Natureza:** anexado append-only após a auditoria material da N2-D.1 (**🟡 SELO COM RESSALVA exclusivamente documental**; material `6f5df7d7d` considerado **sólido** — migration/shape/FK/anti-suspended/índices aprovados; nenhuma migration corretiva exigida). **Não** edita §§0–13, ADENDO D1 nem ADENDO D2; complementa a decisão **apenas** no vínculo entre tipo de escopo e capability key. **Não** cria key, grant, lifecycle, constraint ou código.
- **Origem do problema:** a casa original tinha um CHECK **plano** de `capability_key` e um único escopo actor. Apenas acrescentar as seis keys territoriais à lista plana permitiria combinações cruzadas indevidas (ex.: grant `territory` com `calendar:block`, ou grant `actor` com `territory:approve_neighborhood`). A DECISION-0137 decide a **existência** canônica das keys; não decidiu **em qual tipo de escopo** cada key pode ser usada.

### D3.1 — Existência ≠ compatibilidade

- `permission-keys.ts` **continua** o SSOT de **existência** das capability keys para grants; não é substituído nem duplicado; `business-permissions` continua role-map; RBAC legado continua fora.
- A **matriz scope×capability** não cria novo SSOT de keys; decide **somente** se uma key canônica é admissível naquele scope; pertence à casa de authority/grants; será materializada na **N2-D.2**.

**Frase canônica:** *"permission-keys.ts define a existência da key. A matriz scope×capability define onde essa key pode formar um grant válido."*

### D3.2 — Conjunto actor-scoped

Toda capability key atualmente permitida para grants antes da N2-D.2 **permanece actor-scoped** (inclui, conforme inventário vivo, keys de domínios como `calendar:*`, `services:*` e demais keys não territoriais já governadas). A **lista física exata** será obtida por **read-first da N2-D.2**, confrontando: (1) `permission-keys.ts`; (2) allowlist TS da casa de grants; (3) CHECK físico vigente; (4) usos reais de `actor_capability_grants`.

Regras: nenhuma key existente muda silenciosamente para territory · actor-scoped **não pode** usar nenhuma das seis `territory:*` · key nova futura deve **declarar explicitamente** seu conjunto · **ausência de classificação de scope ⇒ key não pode ser concedida**. Este adendo **não congela** uma lista incompleta de keys actor-scoped — congela a **regra** de que o conjunto vivo anterior permanece actor-only.

### D3.3 — Conjunto territorial

Somente estas **seis** keys podem formar grant com `scope_type='territory'` no MVP:

```
territory:create_neighborhood
territory:approve_neighborhood
territory:correct_neighborhood
territory:deactivate_neighborhood
territory:manage_neighborhood_aliases
territory:register_neighborhood_succession
```

**Proibido em território:** `calendar:*` · `services:*` · `financial:*` · `split:*` · `bank:*` · qualquer key actor-scoped · wildcard · prefix inference · custom string · unknown key · `manage_all` · grant-administration key. **Nenhuma** das seis keys territoriais pode formar grant actor-scoped. **Nenhuma key pertence aos dois conjuntos no MVP.**

### D3.4 — Matriz fechada (tabela-verdade)

```
actor     + key actor-scoped ........... válido estruturalmente
actor     + key territory:* ............ INVÁLIDO
territory + uma das seis territory:* ... válido estruturalmente
territory + key actor-scoped ........... INVÁLIDO
territory + key desconhecida ........... INVÁLIDO
actor     + key desconhecida ........... INVÁLIDO
```

Não há: key em ambos os conjuntos · fallback · compatibilidade por prefixo (`startsWith('territory:')` = inferência de autoridade, PROIBIDA — correspondência é por **conjuntos exatos e governados**) · compatibilidade por metadata/role/frontend/super_admin.

### D3.5 — Obrigação física da N2-D.2

A N2-D.2 materializará uma constraint efetiva equivalente a:

```
(scope_type='actor'     AND capability_key IN (<conjunto actor-scoped governado>))
OR
(scope_type='territory' AND capability_key IN (<seis keys territoriais>))
```

Implementação admitida: **(A)** recriar `chk_acg_capability_nonfinancial` como matriz scope-aware; **ou (B)** manter o CHECK de existência e adicionar CHECK específico de matriz. Em qualquer opção: a proteção final é **física**; lista plana **não basta**; constraint **validada** (não `NOT VALID`); cobre INSERT e UPDATE; não aceita NULL; falha **antes** de qualquer grant real; criada **no mesmo commit** que introduzir as seis keys. **Não criar agora.**

### D3.6 — Contrato TypeScript da N2-D.2

Dois conjuntos **explícitos**: actor-scoped capability keys · territorial capability keys. União plana pode existir **somente como derivação** (`actor set ∪ territorial set`) — **não** decide compatibilidade, **não** pode ser usada sozinha em create/grant, **não** substitui o discriminante `scope_type`.

Input futuro **discriminado**: Actor grant (`scopeType='actor'` · `tenantId` obrigatório · `scopeActorId` obrigatório · `scopeCityId` proibido · `capabilityKey` ∈ actor set) vs. Territorial grant (`scopeType='territory'` · `tenantId` ausente · `scopeActorId` proibido · `scopeCityId` obrigatório · `capabilityKey` ∈ territorial set). **Proibido:** `tenantId` opcional ambíguo · `scopeType` inferido por campos · key prefix para escolher shape · cast para contornar a matriz.

### D3.7 — Tri-registry e guard da N2-D.2

Sincronizar: (1) `permission-keys.ts` = existência das seis keys; (2) TS da casa de grants = conjunto actor-scoped + conjunto territorial + matriz por scope; (3) CHECK físico = matriz scope×capability.

O guard da N2-D.2 deve **morder**: territory+`calendar:*` · territory+`services:*` · actor+`territory:*` · unknown key em qualquer scope · retirada de uma das seis keys de `permission-keys.ts` · key territorial só no CHECK mas ausente no SSOT · key territorial só no TS · lista plana usada como única autorização · prefix-based validation · wildcard · cast/bypass · enfraquecimento posterior do CHECK · DROP/`NOT VALID` · repository que não valida a matriz · rota genérica que aceita combinação cruzada. E deve **provar**: `union(actor set, territory set) ⊆ permission-keys.ts` **e** `intersection(actor set, territory set) = ∅`.

### D3.8 — Zero grant antes da matriz

Enquanto a matriz não estiver implementada e selada: **nenhum** grant territorial real pode existir; PORTA-TERRITORY-1 permanece bloqueada; nenhum repository/route territorial pode abrir; nenhuma das seis keys pode ser concedida; o estado vivo permanece **0 territory rows**. **A capacidade estrutural da D.1 não é autorização operacional.**

### D3.9 — Correção documental da redação de rollback

A expressão histórica **"COMMIT→ROLLBACK"** (usada em entradas anteriores do cartório para descrever a prova de resíduo-zero) é tecnicamente imprecisa e fica **superada** pela descrição correta: **(A) ensaio descartável** — `BEGIN;` aplicar o corpo da migration; inspecionar; `ROLLBACK;` ⇒ zero resíduo; **(B) aplicação definitiva** — runner canônico ⇒ **COMMIT definitivo único**. Nenhum COMMIT foi revertido por ROLLBACK na mesma transação. As entradas históricas **não** são apagadas nem reescritas; a correção vale como nota append-only daqui em diante.

### D3.10 — Sequência e efeito

Após este adendo: (1) reauditoria Yala limitada do D3; (2) se SELO COMPLETO ⇒ registro docs-only do selo final da N2-D.1; (3) **somente depois** ⇒ GO material da N2-D.2. A N2-D.2 entregará **conjuntamente**: seis keys · matriz scope×capability · lifecycle append-only · `reason`/`revoke_reason` · revoke canônico · explicit-expire · contrato de regrant · inspeção de legado · zero grant real — **sem separar as keys da matriz em commits que deixem estado intermediário permissivo**.

**N2-D.1-R DECIDIDA docs-only — AGUARDA REAUDITORIA YALA LIMITADA.** A N2-D.1 **não** recebe SELO COMPLETO ainda. N2-D.2/D.3, PORTA-TERRITORY-1, N2-E, N2-F, N2-G e N3 permanecem trancadas; nenhuma capability territorial ou grant foi criada; Social e Bank permanecem fora.

---

## ADENDO N2-D.3 — RESOLVER/ASSERTION DE CAPABILITY TERRITORIAL (material `ed09e9307`)

Ratificado por Clayton antes da execução material. Introduz o **primitivo canônico de consulta/enforcement** da autoridade territorial, reutilizando integralmente `actor_capability_grants` (nunca segunda casa). Não cria grant real, rota, writer nem abre PORTA-TERRITORY-1.

### D3.11-D1 — Composição tenant × território
O grant territorial permanece **global por cidade** (`tenant_id NULL`, `scope_type='territory'`, `scope_city_id NOT NULL`, `grantee_actor_id` tenant-bound). A **utilização** exige cumulativamente: **(A)** a pessoa autenticada representa o grantee Actor — `canRepresentActor` com o **tenant server-side** da requisição; **(B)** esse Actor possui capability territorial válida para a **key exata** e a **cidade canônica exata**. Proibido: `tenant_id IS NULL` como bypass; `tenant = $x OR tenant_id IS NULL`; receber `actorTenant` do cliente; buscar Actor globalmente e depois comparar tenant; substituir Actor por user_id/role/email/profile/claim. Representar ≠ capability; capability ≠ representabilidade.

### D3.11-D2 — Primitivo SQL agora, atômico para a row do grant
`public.fn_assert_territorial_capability(p_grantee_actor_id, p_capability_key, p_scope_city_id) RETURNS uuid` (SECURITY DEFINER, owner postgres, search_path pinado). Valida e **trava** (`FOR SHARE`) a row do grant **e** a row do grantee Actor (FK `grantee_actor_id` é `ON DELETE CASCADE` → sem o lock, deletar o Actor cascatearia o grant sob os pés do writer). Cardinalidade **0/1/>1 fail-closed** (`LIMIT 2`, ordem determinística por `grant_id`, nunca `LIMIT 1` arbitrário). É **atômica para a ROW do grant**, **não** reivindica atomicidade completa da representabilidade humana — esta compõe no runtime TS.

### D3.11-D3 — Superfície
Resolver interno + wrapper TypeScript interno (`territorial-capability-resolver.ts`, fonte única `hasTerritorialCapability`/`assertTerritorialCapability`). **Zero rota** (pública/admin), **zero grant real**, **zero frontend**.

### D3.11-D4 — SSOT do lifecycle
A **row** de `actor_capability_grants` é a verdade operacional. `actor_capability_grant_events` permanece trilha append-only/auditoria — o resolver **não** consulta eventos como segunda autoridade de lifecycle. Triggers/invariantes selados preservados.

### D3.11-D5 — Fronteira transacional honesta
O primitivo SQL trava e valida atomicamente o grant; o wrapper TS compõe representabilidade para leitura/assertion; **não existe ainda writer territorial**, logo **não se afirma atomicidade completa entre representação e escrita**.

### D3.11-D6 — Writer territorial proibido
Até a N2-E, **qualquer** writer territorial é proibido — **mesmo que chame o resolver**. O guard `audit-territorial-capability-resolver.mjs` proíbe writer/rota/grant territorial. A N2-E substituirá essa proibição por enforcement transacional próprio (representação + capability + writer na mesma transação).

### D3.11-D7 — city_id do recurso canônico
O `scope_city_id` deve vir do **recurso canônico server-side** (Location Core: `address_assignments`/`neighborhoods`→city), nunca do body. Contrato para os futuros writers; não implementado nesta fatia.

### D3.11-D8 — Escopo negativo
Sem grant real, sem PORTA-TERRITORY-1, sem Social/Bank, sem novo Actor type, sem segunda casa, sem alterar `canRepresentActor`, sem alterar a matriz/keys seladas, `fn_expire`/`fn_regrant` intactas. Negação uniforme `TERRITORIAL_CAPABILITY_DENIED` não-vazante (nunca expõe Actor/tenant/city/key/grant_id/status). Δbank=0.

**N2-D.3 EXECUTADA material — AGUARDA AUDITORIA YALA POR ENVELOPE.** PORTA-TERRITORY-1, N2-E, N2-F, N2-G e N3 permanecem trancadas; nenhum grant territorial existe; Social e Bank permanecem fora.
