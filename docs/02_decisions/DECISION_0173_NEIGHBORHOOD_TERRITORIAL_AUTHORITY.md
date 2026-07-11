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
