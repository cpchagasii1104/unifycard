# DECISION-0171 — Fundação da identidade territorial canônica de bairro (Location Core)

- **Status:** DECIDIDA / PROMULGADA (docs-only) — habilita a frente `F-NEIGHBORHOOD-CANONICAL-IDENTITY` (fatia N1). **Adendo N1.1 (2026-07-11):** esclarecimento vinculante de autoridade de curadoria em §6.1 (ressalva Yala — representação de actor ≠ autoridade de curadoria; capability explícita obrigatória; fail-closed).
- **Data:** 2026-07-11
- **Autoridade:** Clayton (soberana), sobre HEAD selado `d79b863e2` (selo Yala N0/N0.1/N0.2).
- **Escopo:** decisão de doutrina + contrato conceitual. **NÃO** autoriza código, migration, coluna, seed, writer canônico, catálogo populado, resolução de `addresses.neighborhood_id`, dashboard, endpoint, Social, Bank, split, fundo, nem remoção de qualquer HOLD. É a formalização da IDENTIDADE; a materialização é N2+ com GO próprio.
- **Predecessora selada:** contenção `DT-LOCATION-CORE-NEIGHBORHOOD-FREE-TEXT-WRITER` (N0 `a81f004ea` · N0.1 `7fcf407cd` · N0.2 `c53e044dc` · selo Yala `d79b863e2` — FECHADA/CONTIDA/SELADA). Os três vetores de identidade-por-texto (criação SQL por nome, resolução SQL por nome, resolução em memória no `resolveCep`) estão contidos e guardados por `audit-neighborhood-freetext-writer-containment.mjs`.
- **Substrato de referência:** DECISION-0020 (Location Core `countries→states→cities→neighborhoods`, `addresses`, `address_assignments`), DECISION-0074 (residência PF no Location Core, `role='RESIDENCE'`), DECISION-0077/0078 (enriquecimento geo por CEP; `cep_resolution_cache` = insumo, não SSOT; centroide coarse por LGPD), DECISION-0079 (bairro = texto de exibição; **veto** de FK por nome livre e de uso territorial de bairro textual), DECISION-0165/0166 (fundo regional por FK; **D4** = nível `neighborhood` em HOLD até catálogo governado). Normas: CONSTITUICAO (Art. I soberania do ator, Art. VIII meta-observabilidade agregada), LEIS_OPERACIONAIS (Lei 7 — identidade não vive em slug/nome/enum), PROHIBITED_STRUCTURES (proibido SSOT territorial paralelo / mini-core), LEI_DE_COERENCIA_SISTEMICA (uma verdade, múltiplos consumidores), 07_NOMENCLATURA (nomes físicos), 08_AUTORIDADE_CANONICA + ACTOR_TRACEABILITY (curadoria atribuível a actor).

---

## 0. Prova de rastreabilidade normativa (00_AGENT_PROTOCOL §2.2.2)

**Pilar da tarefa:** Location Core / identidade territorial (SSOT geográfico), com Privacidade transversal e Social/Bank como consumidores FUTUROS (sem execução).

**União cautelosa dos domínios declarada:** Location Core · identidade territorial · SSOT/ontologia · autoridade e rastreabilidade · privacidade/LGPD · Social (consumidor futuro) · Bank (consumidor futuro, sem execução).

**SSOTs concretos por pilar (o que governa, onde vive):**
- Identidade territorial de bairro → tabela `neighborhoods` (`neighborhood_id` PK, `city_id` FK NOT NULL, `name`, `name_normalized` GENERATED, `is_active`), Location Core, DECISION-0020. **É o núcleo a reutilizar.**
- Cadeia territorial → `countries→states→cities→neighborhoods` + `addresses`/`address_assignments` (DECISION-0020/0074).
- Bairro textual de exibição → `addresses.neighborhood_display_text` (DECISION-0079) — **exibição/evidência, nunca identidade**.
- Autoridade/curadoria → camada canônica de authority/capability + `canRepresentActor` (SSOT_REGISTRY §5.16; 08_AUTORIDADE). **Sem role/booleano/ACL paralelo.**
- Nomenclatura de colunas → 07_NOMENCLATURA (§4.11 status/lifecycle, §4.12 external ids, §4.13 audit fields `created_by_actor_id`/`approved_by...`).
- Dinheiro → Bank (`bank_ledger`/`regional_fund_accounts`), Lei 5 — fora desta decisão.

**O que NÃO é SSOT (e não pode virar autoridade):** `neighborhood_display_text`, `bairro` do provider (ViaCEP/BrasilAPI), `cep_resolution_cache`, CEP isolado, logradouro, `actor_active_location`, `ownerId` técnico de conta de fundo, nome/`name_normalized` sozinho.

**GATE §2.3.2 (respondido):** pilar = Location Core; SSOT que governa = `neighborhoods` (existente); estrutura já existe = SIM (reutilizar por evolução aditiva no N2, nunca 2ª tabela principal); risco de duplicar verdade = mitigado pela tese central (§2) + proibição de SSOT paralelo (PROHIBITED_STRUCTURES). Como esta fatia é **docs-only** (nenhuma coluna/tabela/enum/CHECK criada), não há alteração estrutural — só doutrina/contrato.

**Documentos lidos nesta sessão (auditorias delegadas + leituras diretas):** 00_AGENT_PROTOCOL, CONSTITUICAO_UNIFICARD, LEIS_OPERACIONAIS_UNIFICARD, SSOT_REGISTRY_UNIFICARD, 18_DOMAIN_ONTOLOGY_UNIFICARD, CORE_IMUTAVEL, PROHIBITED_STRUCTURES, LEI_DE_COERENCIA_SISTEMICA, 07_NOMENCLATURA_CANONICA (§4.11/§4.12/§4.13 diretamente), 08_AUTORIDADE_CANONICA, ACTOR_TRACEABILITY_CONTRACT, DECISION-0020/0074/0077/0078/0079/0165/0166, registros N0/N0.1/N0.2 + selo Yala, REMEDIATION_DT_LOG.md e dividatecnica.md vigentes. Schema vivo de `neighborhoods`/`addresses` confirmado por inspeção direta (`\d`, `information_schema`) no banco `unificard_dev`.

---

## 1. Contexto e problema

O sistema é virgem (sem usuários/empresas/transações reais). O split regional já foi **arquitetado** para os níveis `planet → country → state → city → neighborhood` (DECISION-0165/0166; `regional_fund_accounts` com FK composta `(city_id, neighborhood_id)`), mas o nível `neighborhood` está em **HOLD 501** (DECISION-0166 D4) porque **não existe catálogo governado de bairros**: `neighborhoods=0`, `addresses.neighborhood_id=0`. Paralelamente, Clayton quer que Social ("moradores do meu bairro") e Bank (fundo do bairro) consumam a **mesma** identidade territorial, sem duplicá-la.

A contenção selada (N0–N0.2) provou e travou o anti-padrão: nenhum código pode transformar texto de bairro (CEP/provider/usuário) em `neighborhood_id`. Falta agora **decidir a identidade** — o que é um bairro canônico, quem o cria, como evolui — sem ainda materializar nada. É o que esta DECISION faz.

**Distinção-âncora (herdada da 0079, agora elevada a fundação):** cidade tem código oficial (IBGE `external_code`) → é canônica por FK; bairro **não tem** código nacional uniforme → sua identidade canônica nasce por **curadoria governada**, não por importação automática de texto.

---

## 2. Tese central (cravada)

**`neighborhoods.neighborhood_id` é a identidade territorial canônica de bairro do Location Core.** SSOT único; múltiplos consumidores.

Regras vinculantes:
1. O núcleo existente `neighborhoods` **será reutilizado** (evolução aditiva no N2). **Proibida** uma segunda tabela principal de bairros (PROHIBITED_STRUCTURES — mini-core/SSOT territorial paralelo).
2. Bairro é identificado **no contexto obrigatório de uma cidade**: `city_id` é parte estrutural da identidade. Não existe bairro "solto".
3. Nome, aliases, CEP, provider e texto de endereço **não são identidade** — são exibição/evidência.
4. `neighborhood_display_text` permanece **somente exibição / evidência auxiliar** (DECISION-0079 mantida).
5. Social e Bank **podem consumir** o mesmo `neighborhood_id`; **não podem definir, corrigir ou duplicar** a identidade do bairro.
6. A conta do fundo regional **não é** identidade territorial; `ownerId` técnico da conta **não é** SSOT (a verdade é a FK do Location Core).
7. Residência no bairro **não concede automaticamente** voto, administração, representação territorial nem poder financeiro.

---

## 3. Decisões soberanas já ratificadas por Clayton — NÃO REABRIR

**A — Curadoria híbrida com confirmação humana.** Fontes oficiais/municipais têm prioridade; fontes públicas verificáveis fornecem evidência; CEP/ViaCEP/BrasilAPI/provider/texto livre geram **apenas sugestão**; curadoria interna documentada é permitida quando não há fonte oficial adequada; **sugestão nunca cria linha canônica nem FK automaticamente**; toda criação/confirmação canônica exige actor autorizado + rastreabilidade.

**B — Não reutilizar vocabulário de KYC.** KYC verifica identidade jurídica; curadoria territorial verifica confiabilidade geográfica; palavras semelhantes (`pending`/`approved`) **não** autorizam compartilhar vocabulário. Um eventual workflow de candidatos terá **vocabulário territorial próprio e governado**. **Nenhuma enum/CHECK é criada no N1.**

**C — Identidade estável.** Mudança de nome/correção ortográfica **preserva** `neighborhood_id` (nome antigo vira alias); divisão/fusão/reorganização **material** cria **novos** IDs; referências históricas não são reescritas; identidade antiga permanece auditável.

**D — Aliases em estrutura filha.** Aliases **não** serão `TEXT[]` no núcleo; a futura estrutura filha permitirá fonte, normalização, auditoria, vigência e retirada individual. Não é SSOT paralelo — é **atributo multivalorado** da identidade canônica.

**E — Sucessão territorial N:N, append-only.** Divisão 1→N, fusão N→1, reorganização N→N; uma FK única `superseded_by_neighborhood_id` é **insuficiente**; a futura estrutura de sucessão registra origem, destino, tipo, vigência e evidência; é **linhagem** do Location Core, não segunda identidade.

**F — PostGIS não é obrigatório para o MVP.** Catálogo e identidade estável existem sem geometria; sem geometria o sistema **não promete** delimitação espacial automática; polígonos/geofence/resolução espacial ficam para frente própria; **nenhuma** fronteira é inferida de GPS/CEP/proximidade.

**G — Cidade avança em frente separada.** A plateia "moradores da minha cidade" não depende da fundação de bairro; **não compartilha** working tree/commit material com esta frente; nenhuma autorização de runtime social nasce do N1.

---

## 4. Semântica da identidade

Um `neighborhood_id` representa uma **identidade territorial governada**, pertencente obrigatoriamente a uma única `city_id`.

Dimensões conceitualmente distintas (não confundir identidade com seus atributos):
- **identidade** do bairro (`neighborhood_id`, estável);
- **nome vigente**;
- **aliases** (nomes alternativos/históricos);
- **fonte/proveniência**;
- **evidências** (justificativa da curadoria);
- **vigência administrativa** (quando aplicável);
- **status de uso** do registro (ativo/obsoleto — vocabulário territorial próprio, decidido no N2);
- **sucessão territorial** (linhagem);
- **geometria futura** (opcional, frente própria).

Cravado:
- Dois bairros homônimos em cidades diferentes são **identidades diferentes** (o `city_id` no par resolve).
- Igualdade de nome **dentro** da cidade **não é prova suficiente** de identidade.
- O `UNIQUE(city_id, name_normalized)` existente **ajuda a impedir duplicação nominal**, mas **não** transforma o nome em autoridade.
- Uma linha canônica só deve existir **depois** do rito de aprovação.
- A tabela canônica **não** serve como fila de sugestões/rascunhos (ver §7).

---

## 5. Fontes e proveniência

**Ordem conceitual de confiabilidade:**
1. ato/cadastro/fonte municipal oficial;
2. outra fonte governamental/administrativa verificável;
3. base pública cartográfica/documental com procedência;
4. curadoria interna documentada e aprovada;
5. CEP/provider/texto — **somente evidência auxiliar**.

A futura materialização (N2) **deve registrar**, por bairro canônico: tipo/origem da fonte; referência verificável (quando existir); actor que criou; actor que aprovou; momento da aprovação; evidência/justificativa; **ausência honesta de código oficial** (não fingir código onde não há).

`external_code` (07_NOMENCLATURA §4.12) é **opcional e escopado à fonte** — não existe código nacional uniforme de bairro; quando ausente, o registro é honesto quanto a isso.

**Nomes físicos:** este N1 define **requisitos**; os **nomes exatos** de colunas/tabelas e a migration são decisão do **N2**, aplicando 07_NOMENCLATURA (snake_case plural; `_at` timestamps; `_id` FKs reais; tipo-vocabulário = CHECK governado). Exemplos ILUSTRATIVOS não-vinculantes: `source`/`source_reference`, `created_by_actor_id`, `approved_by_actor_id`, `approved_at`, `external_code`. Nenhum deles é fato consumado.

---

## 6. Autoridade de curadoria

- Usuário comum **não** cria bairro canônico; texto enviado por usuário **não** cria identidade; provider externo **não** tem autoridade.
- Curador é **actor identificado**; a autorização **reutiliza a camada canônica de authority/capability**, com **capability/grant territorial explícito** (ver §6.1) **além** da representação válida do actor executor. **Proibido** criar role local, booleano administrativo ou ACL paralela.
- Toda aprovação é **atribuível** a actor humano responsável (ACTOR_TRACEABILITY); autoridade pode ser **revogada sem apagar histórico**.
- **Substrato de authority existente** (candidato de composição futura, sem criar grant/capability/código no N1): a fachada de autoridade/`canRepresentActor` (prova de representação) **e** a camada de capability/delegação canônica do repo (autorização de curadoria). O **nome exato** da capability de curadoria territorial **fica como requisito do N2** — não é inventado aqui como fato consumado.

### 6.1. Esclarecimento vinculante de autoridade de curadoria (adendo N1.1 — ressalva Yala)

Esta subseção **prevalece** sobre qualquer leitura anterior deste documento que sugira que a representação de actor, sozinha, autorize curadoria territorial. Ela complementa (não revoga) os bullets de §6; onde houver aparente conflito, vale o texto abaixo.

Cadeia vinculante de autorização de curadoria:

```
autenticação da conta
      ↓
canRepresentActor  (prova de que a conta pode agir por aquele actor)
      ↓
capability/grant territorial explícito, escopado e vigente (casa canônica de authority)
      ↓
permissão para criar/aprovar/alterar/rejeitar/descontinuar bairro canônico
```

**A — Limite de `canRepresentActor`.** `canRepresentActor` comprova **exclusivamente** que a conta está autorizada a agir em nome de determinado actor. Essa prova de representação **não concede, por si**, autoridade de curadoria territorial. Representar PF, PJ, grupo ou qualquer outro actor **não** transforma o representante em curador territorial.

**B — Capability obrigatória.** Criar, alterar, aprovar, rejeitar ou descontinuar identidade territorial canônica de bairro **exige** capability/grant territorial **explícito, escopado e vigente**, emitido pela **casa canônica de authority/capability**, **além** da representação válida do actor executor. O **nome físico** dessa capability continua **reservado ao GATE/N2** — a DECISION **não** inventa chave concreta.

**C — Fail-closed.** Ausência, expiração ou revogação da capability **nega** a operação. **Não substituem** essa capability: autenticação simples, administração de tenant, role textual, `is_admin`, booleano local, `canRepresentActor` isolado ou acesso operacional genérico. **Nenhum fallback administrativo implícito** é permitido.

**D — Rastreabilidade humana.** Criação e aprovação são **atribuíveis a actor humano responsável**, inclusive quando o humano atua **representando uma PJ**. Devem permanecer rastreáveis: o actor representado, a conta executora, o actor humano responsável, a capability/grant usada e o momento da operação. A **revogação futura** da autoridade **não apaga** o histórico das ações já realizadas.

**E — Separação das operações (requisito do GATE N2).** O N2 deverá **distinguir**, no mínimo, as capacidades conceituais de: propor/cadastrar candidato · criar registro canônico · aprovar · corrigir dados descritivos · desativar · registrar sucessão. **Não** se decide aqui se serão **uma ou várias** capability keys — isso é resultado do GATE N2.

---

## 7. Candidatos ≠ catálogo canônico

Duas naturezas **distintas**:

**A. Registro canônico aprovado** — vive no núcleo `neighborhoods`; identidade estável; referenciável por FK; consumível por Social/Bank no futuro.

**B. Sugestão/candidato** — **não** é bairro canônico; **não** pode ser referenciado como `neighborhood_id`; **não** ocupa linha "draft" em `neighborhoods`; pode futuramente viver em fila/estrutura de curadoria **separada**, com **vocabulário territorial próprio**; sua forma física fica para decisão/fatia posterior.

**O N1 NÃO cria essa fila.** Fica proibido usar o núcleo `neighborhoods` como buffer de rascunhos.

---

## 8. Aliases — contrato conceitual (sem criar tabela)

Requisitos da futura estrutura filha de aliases (materialização no N2):
- **FK obrigatória** para `neighborhood_id`;
- alias original **e** forma normalizada;
- fonte/proveniência;
- actor responsável;
- vigência, quando aplicável;
- **unicidade governada** dentro da cidade/identidade;
- histórico e **retirada** sem apagar o bairro;
- alias **nunca** cria bairro automaticamente;
- colisão de alias **não** é resolvida silenciosamente (curadoria decide).

Nenhuma tabela é criada neste N1 — apenas o contrato.

---

## 9. Sucessão territorial — contrato conceitual (sem criar tabela)

Casos cobertos:
- **rename/correção:** mesmo `neighborhood_id` + alias/histórico;
- **divisão:** ID antigo → múltiplos IDs novos;
- **fusão:** múltiplos IDs antigos → ID novo;
- **reorganização:** N→N;
- **extinção** sem sucessor;
- **correção de cadastro** sem alteração territorial (mesmo ID).

A futura linhagem deve ser: **append-only**; auditável; **sem reescrever FKs históricas**; **sem transferir automaticamente** audiência, voto, fundo ou autoridade; cada consumidor decide, por **contrato próprio**, como tratar sucessão.

Cravado: endereço antigo, publicação histórica e lançamento financeiro **não** são reatribuídos retroativamente só porque o território mudou.

---

## 10. Resolução de endereços — fluxo futuro (sem writer no N1)

`addresses.neighborhood_display_text` → evidências/candidatos **dentro da mesma `city_id`** → revisão/validação **governada** → somente então `addresses.neighborhood_id`.

**Regras duras:**
- nenhuma escrita automática por igualdade de nome;
- nenhuma escrita automática por candidato único;
- CEP isolado **não** identifica bairro; logradouro isolado **não** identifica bairro;
- localização momentânea **não** prova residência; GPS/IP **não** resolve bairro cadastral; `actor_active_location` **não** é residência;
- provider **nunca** preenche FK; sugestão auxilia o curador, **nunca** substitui aprovação;
- correções preservam trilha auditável; associação contestada pode ser removida/corrigida **sem apagar** a identidade territorial;
- somente **residência principal vigente** (`role='RESIDENCE'`, `is_primary`, `valid_until_at IS NULL`) poderá ser usada pelos consumidores sociais futuros.

**O writer canônico continua inexistente no N1.** `CANONICAL_WRITER_ALLOW` permanece **vazia**.

---

## 11. Privacidade (Art. VIII + LGPD)

- Catálogo público de bairros **não** é dado pessoal.
- Associação pessoa/endereço/bairro **é** dado pessoal protegido.
- **Nenhum** endpoint enumera moradores por bairro.
- **Nenhum** consumer recebe endereço completo para decidir audiência; Social recebe apenas **decisão booleana** ou referência autorizada; Bank recebe apenas o **escopo territorial** necessário.
- Contagens futuras exigem **agregação + limiar** de privacidade (Art. VIII — meta-observabilidade agregada, nunca individual).
- Complemento, unidade e número residencial **nunca** formam audiência de condomínio/bairro.
- Bairro canônico **não** autoriza exposição da residência.

---

## 12. Consumidores futuros — documentados, NÃO autorizados

**SOCIAL futuro:** residência principal vigente do autor + do leitor + mesmo `neighborhood_id` → possível predicado territorial de leitura. O N1 **não** autoriza: coluna de audiência, frontend, endpoint, matching social, lista de moradores, proposta/votação, actor comunitário.

**BANK futuro:** `scope_level='neighborhood'` + `country_id/state_id/city_id/neighborhood_id` → possível resolução de `regional_fund_accounts`. O N1 **não** autoriza: remover HOLD 501, criar policy line, criar conta, mover dinheiro, semear fundos, conceder autoridade a moradores.

**GOVERNANÇA futura:** morar **não** é representar; **não** é administrar; **não** é votar automaticamente; **não** é movimentar fundo. Propostas/votação/administração exigem contratos próprios.

---

## 13. Sequência de fatias (registrada, nenhuma material aberta)

- **N1** — esta DECISION docs-only.
- **N2** — fundação **aditiva** do catálogo: evolução de `neighborhoods` (colunas de proveniência/curadoria/status por 07_NOMENCLATURA), estrutura filha de aliases, estrutura de sucessão, **ajuste consciente do guard** (registrar o writer governado em `CANONICAL_WRITER_ALLOW`); **sem seed**, salvo GO explícito separado.
- **N3** — curadoria/seed inicial governado.
- **N4** — rito de resolução de endereços (`display_text` → candidato → aprovação → `neighborhood_id`).
- **N5** — Social: moradores do mesmo bairro.
- **N6** — Bank: avaliação financeira própria para levantar o HOLD D4.
- **N7** — propostas, votação e administração comunitária.

Cada fatia exige **GO e auditoria próprios**. **`CANONICAL_WRITER_ALLOW` permanece vazia no N1.**

---

## 14. Escopo negativo (cumprido nesta fatia)

Docs-only: **zero** código, migration, coluna, enum, CHECK, seed, writer, catálogo populado, resolução de `addresses.neighborhood_id`; **zero** alteração em backend/src, frontend/src, guards ou `CANONICAL_WRITER_ALLOW`; **zero** Social; **zero** Bank/split/fundos; **dois HOLDs 501 preservados**; **zero** alteração em documentos normativos congelados ou no selo anterior; **Δbank=0**.

---

## 15. Efeito

- **DECIDIDA / PROMULGADA docs-only.** Habilita a frente `F-NEIGHBORHOOD-CANONICAL-IDENTITY` a, com GO próprio, abrir o **N2** (fundação aditiva).
- **N2 e todas as fatias materiais (N3–N7) TRANCADAS.** O primeiro writer canônico só nasce com: DECISION ratificada (esta) + alteração consciente do guard (`CANONICAL_WRITER_ALLOW`) + rito de curadoria + prova de autoridade + testes + nova auditoria.
- Bairro textual/CEP/provider seguem **só** como sugestão/exibição; HOLDs financeiros **intactos**.
