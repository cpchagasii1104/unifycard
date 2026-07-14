# DECISION-0175 — Escala Territorial Nacional Governada

- **Status:** DECIDIDO · DOCS-ONLY · MATERIAL NÃO INICIADO · AGUARDA AUDITORIA YALA (2026-07-14).
- **Base:** `rescue-structural` @ `0bb935359` (selo N1 Curitiba alias-first dormente).
- **Autoridade:** Clayton (soberana), sobre o arco read-only: GATE NAT-0 (Veredito B, ratificado com ressalva) → complemento normativo de suficiência do núcleo municipal (primeira mão) → complemento de suficiência pré-DECISION (Caminho B; DECISION-0171/0172/0074/0077/0078/0079 + 07_NOMENCLATURA §4.20 + PROHIBITED_STRUCTURES lidos cover-to-cover em primeira mão pela executora principal).
- **Escopo:** decisão de doutrina, contratos conceituais, escolhas de modelo, dependências e fronteiras da **expansão territorial nacional**. **Brasil-first, internacionalmente extensível.** **NÃO** autoriza nem materializa: código, teste, guard, script, migration, DDL/DML, ingestão IBGE, criação de país/estado/cidade/bairro/alias/candidato, aplicação da migration N1 dormente, manifest de Curitiba, abertura de HOLD, capability/grant/PORTA, vínculo/reprocessamento de endereço, evento persistido, Social territorial, conta/fundo regional, split, `bank_ledger`. Cada família material futura exige GATE/GO/auditoria/selo próprios.
- **Predecessoras vigentes:** DECISION-0171 (identidade canônica de bairro), DECISION-0172 (desenho físico e autoridade N2), DECISION-0173 (autoridade territorial), DECISION-0174 (Curitiba alias-first / manifest governado, N1 selada dormente), DECISION-0074/0077/0078/0079 (endereço PF, geo-enriquecimento, cache CEP, política de bairro), RFC_ADDRESS_POSTAL_RESOLUTION_AND_CITY_GOVERNANCE, RFC_ADDRESS_ONBOARDING_CANONICAL_FLOW.

---

## 0. Prova de rastreabilidade normativa (00_AGENT_PROTOCOL §2.2.2)

**Domínios:** território / Location Core · endereços · Actors · autoridade · resolução postal · candidatos territoriais · aliases · sucessão · automação e eventos · Social (fronteira negativa) · financeiro (fronteira negativa).

**SSOTs (nome exato, onde vive):**
- território = `countries`, `states`, `cities`, `neighborhoods` por IDs canônicos (Location Core; identidade de bairro = `neighborhoods.neighborhood_id`, DECISION-0171 §2);
- endereço físico = `addresses` (DECISION-0074);
- owner/role/vigência = `address_assignments` (DECISION-0074);
- Actor = `actors` (02_ACTORS_SSOT);
- autoridade = `actor_capability_grants` + capability exata (DECISION-0173; permission-keys.ts = registry de existência das keys);
- representação humana = `canRepresentActor` (prova de representação, ortogonal à capability — DECISION-0171 §6.1-A, DECISION-0173 §D3.11-D1);
- dinheiro = UnifyBank / `bank_ledger` (LEIS_OPERACIONAIS Lei 5);
- estado operacional = `REMEDIATION_DT_LOG.md` (00_AGENT_PROTOCOL).

**Precedência aplicada (00_AGENT_PROTOCOL §2.2.7):** CONSTITUIÇÃO > LEIS OPERACIONAIS > SSOT REGISTRY > ONTOLOGIA > DEMAIS NORMAS > DECISÕES > CARTÓRIO > CÓDIGO > CONVENIÊNCIA.

**Declarações expressas (vinculantes nesta DECISION):**
- schema vivo **não** vence norma (é fato, não fundamento de precedência);
- manifest **não** é authority; job **não** é Actor; candidato **não** é identidade;
- provider, cache, CEP, texto, IA e score **não** criam território;
- alias **não** é bairro; endereço **não** cria cidade ou bairro;
- Social e Bank **não** criam território;
- `bank_ledger` permanece soberano no domínio financeiro.

**NÃO-SSOT (não podem decidir identidade/autoridade):** CEP, texto de provider, `neighborhood_display_text`, `cep_resolution_cache`, coordenada isolada, alias, candidato, `external_code` isolado da sua fonte, N1/N2 da TREE (navegação), Social, Bank-como-criador, job técnico, manifest, approval record, execution record.

**Rótulos de sequência.** Os rótulos "N2/N3/N4…" da DECISION-0174 (§D22) são **internos à sequência territorial** dessa decisão e **não** têm relação com N1/N2 da TREE de navegação (00_AGENT_PROTOCOL — N1/N2 = navegação governada).

---

## D0 — Escopo

Esta DECISION governa, **sem materializar**: (1) o catálogo nacional de municípios; (2) as evidências nacionais e locais de bairros; (3) os candidatos territoriais; (4) aliases e sucessão em escala nacional; (5) o reprocessamento territorial de endereços; (6) os fatos territoriais futuros consumíveis por outros domínios; (7) as fronteiras negativas de Social e Bank. Ela define contratos, escolhas e dependências; **não cria nada material**.

## D1 — SSOT territorial (ratificação)

**Fato + norma (DECISION-0171 §2, DECISION-0074, DECISION-0079 §3; schema vivo).** `country_id`, `state_id`, `city_id` e `neighborhood_id` são as **identidades territoriais canônicas** do Location Core; bairro existe **em contexto obrigatório de `city_id`** (DECISION-0171 §2.2/§4). **Decisão:** texto, código externo, provider, CEP, geometria e candidato são **evidência ou referência**, nunca identidade; **nenhuma estrutura auxiliar** (candidato, cache, manifest, projeção, read-model, job) pode **decidir identidade por conta própria** — leitura que influencia decisão de identidade é **autoridade implícita e é proibida** (PROHIBITED_STRUCTURES). **Proibido** segundo catálogo/mini-core territorial paralelo (PROHIBITED_STRUCTURES §"MINI-CORES CLANDESTINOS"; DECISION-0171 §2.1). A expansão nacional **evolui** o Location Core, nunca o duplica.

## D2 — Autoridade institucional

**Norma (CONSTITUIÇÃO Art. I; 08_AUTORIDADE_CANONICA §2/§14; 02_ACTORS_SSOT; DECISION-0173).** Autoridade é sempre delegada e rastreável a um Human Actor ancorado em CPF; **não existem contas-deus, chaves-mestras nem bypass administrativo**; autoridade **não emerge de estrutura** (role/status/flag/`is_admin`/posse/vínculo técnico) — deriva de Lei + Ator Humano (PROHIBITED_STRUCTURES §"ESTRUTURAS DE AUTORIDADE PROIBIDAS").

**Decisão.** Toda ingestão territorial nacional futura exige, cumulativamente: (a) **fonte institucional explícita**; (b) **Human Actor rastreável** (CPF-âncora); (c) **autoridade governada** na casa canônica `actor_capability_grants`; (d) **capability exata** (match exato, sem wildcard/prefix/implicação — DECISION-0173 §4/§D3.4); (e) **escopo territorial real** por FK (DECISION-0172 P1); (f) **aprovação governada**; (g) **execução técnica posterior** e separada. **Ratifica-se:** o job **não** é Actor, **não** recebe autoridade, **apenas executa conteúdo previamente aprovado**; manifest, `status`/`outcome` e execution record **não** são authority (DECISION-0174 §D1/§D2/§D10).

## D3 — Escopo nacional e futura PORTA

**Fato (DECISION-0173 §3).** O escopo territorial material hoje é **apenas cidade** (Curitiba); país/estado/bairro **não** foram materializados — cada um exige migration + GO próprios. O desenho da autoridade **já admite** níveis país/estado/cidade/bairro com FK real por nível (DECISION-0172 P1).

**Decisão (conceitual, sem criar nada).** A ingestão municipal nacional exige: (1) **escopo país/nacional** e, quando necessário, **estado** — materializado por FK real ao nível correspondente; (2) **capability específica de catálogo municipal**, distinta das seis keys de bairro de DECISION-0173 §D3.3; (3) uma **PORTA futura e separada** de bootstrap da primeira autoridade institucional de catálogo (molde soberano de DECISION-0173 §6: GO humano, one-shot, fail-closed, sem `super_admin` runtime como authority permanente). **Proibido** reutilizar indevidamente as capabilities de bairro para o catálogo municipal (DECISION-0173 §D3.3/§D3.4). **Proibido** inventar um tenant institucional soberano (DECISION-0172 P1; DECISION-0173 §2 — tenant institucional REJEITADO; o grant territorial é global por FK com `tenant_id NULL` e efeito global explicitamente declarado). **Nenhuma key, migration, grant ou PORTA é criada por esta DECISION.**

## D4 — Fonte oficial municipal

**Decisão (forma governante).** O catálogo nacional de municípios adota **bulk oficial versionado + hash + manifest + diff entre versões + verificação incremental por fonte oficial** — a mesma doutrina de manifest governado de DECISION-0174 (§D5/§D6/§D8/§D16/§D17), ajustada ao catálogo de municípios (RFC_ADDRESS_POSTAL §D-E: "ingestão oficial de cidades = frente futura própria, fonte oficial, manifest versionado, proveniência, idempotente, governada, autoridade explícita, guard+auditoria; NUNCA sob demanda"). **Decisões:** (a) **IBGE** (Divisão Territorial Brasileira / API de Localidades) = **fonte institucional primária** dos municípios brasileiros; o `id` IBGE de 7 dígitos é o código oficial municipal; (b) a **API** serve à **verificação incremental / detecção de diferença**, nunca como writer sob demanda; (c) **consulta de CEP nunca cria cidade**; (d) ausência/indisponibilidade gera **`canonical_city_missing`** (fail-closed, RFC §D-D); (e) a ingestão ocorre **somente em frente própria** com autoridade e auditoria. Fonte primária não brasileira e crosswalks (item D5) são referência secundária, nunca soberania isolada.

## D5 — Identificadores externos (modelo canônico escolhido)

**Norma (DECISION-0171 §5; DECISION-0172 P4; RFC_ADDRESS_POSTAL §D-C).** `external_code` é **identificador externo escopado à fonte**, **não** SSOT; **não existe código nacional uniforme de bairro** — ausência de código é permitida e honesta; código externo nu **não** é identidade territorial global (a resolução oficial brasileira considera conjuntamente país + jurisdição estadual + código + fonte).

**Decisão (modelo canônico conceitual — vinculante; forma física reservada ao material).** Adota-se um **modelo governado de identificadores externos N:N**: um identificador externo **pertence a uma entidade territorial canônica**, **declara sua fonte/esquema** (ex.: IBGE-município, IBGE-CD_BAIRRO, Receita/TOM, esquema internacional), e carrega **vigência e proveniência**. Este modelo suporta simultaneamente: código IBGE municipal; `CD_BAIRRO` como **identificador estatístico/evidência** quando admissível; identificadores municipais; crosswalks Receita/TOM; identificadores de outros países; **múltiplas fontes por entidade**; vigência, histórico, colisão e sucessão. O `cities.external_code` vivo permanece **válido** como projeção do identificador IBGE municipal primário **durante a transição**, **nunca** como SSOT único de identidade.

**Regras (vinculantes):** identificador externo não é SSOT; código **nunca** existe sem fonte/contexto declarados; **não** criar coluna Brasil-específica paralela sem base normativa; **não** apagar identificador histórico; **não** reaproveitar código silenciosamente; ausência de código é permitida para bairros; `CD_BAIRRO` **não** transforma automaticamente um registro estatístico em identidade jurídica.

**Reconciliação `ibge_code` × `external_code` (fundamento).** Não há conflito normativo real (Caso A). **Fato:** `07_NOMENCLATURA_CANONICA.md` §4.20 ("Endereços" → "Campos Específicos Brasil") e §18.11 listam `ibge_code VARCHAR(10)` como **vocabulário de nomeação de um campo de endereço** (ao lado de `city`/`state`/`neighborhood` textuais que o Location Core deliberadamente **não** usa por serem FK), com correções de nome no estilo `❌ zip → postal_code`. Trata-se de **como nomear** um campo de endereço, **não** de qual estrutura é o SSOT da identidade territorial nem de proibir `external_code`. O termo `external_code` **não aparece** em 07_NOMENCLATURA — logo a norma **não** emite regra de que o identificador municipal do Location Core deva chamar-se `ibge_code`. O `external_code` é o conceito **mais geral e escopado à fonte** que **subsume** o código IBGE e é próprio do SSOT do Location Core, concern distinto do campo de endereço. **Portanto:** esta DECISION mantém `external_code` (escopado à fonte) como identificador do SSOT territorial, **não** cria coluna paralela `ibge_code` no SSOT, e **não requer edição de 07_NOMENCLATURA** (o `ibge_code` de §4.20 segue válido como nome de campo de endereço em DTO, se algum dia exposto). A precedência **não** foi resolvida por "schema vence norma" — foi resolvida por **distinção de escopo** entre o vocabulário de campo de endereço e o identificador do SSOT territorial. **Correção documental:** a referência "external_code (07_NOMENCLATURA §4.12)" em DECISION-0171 §5 e a menção correlata em DECISION-0172 são **stale** — §4.12 trata de identificadores externos de pagamento/idempotência, não de território; a governança de `external_code` territorial vive em DECISION-0171 §5, DECISION-0172 P4 e RFC_ADDRESS_POSTAL §D-C.

## D6 — Aprovação institucional em lote

**Decisão (DECISION-0174 §D5/§D8/§D10; DECISION-0172 P2).** A aprovação humana **não** precisa ser linha por linha quando houver: dataset institucional + versão + hash + conteúdo fechado + proveniência + autoridade válida + manifest aprovado. A aprovação de um manifest **pode autorizar execução em lote**, preservando: identificação de **quem aprovou** (Human Actor + capability + grant), **conteúdo exato aprovado** (versão + hash; aprovação de um hash não vale para outro), **exceções e conflitos**, **auditabilidade**, e **revogação/supersessão** (lifecycle próprio de eventos: approved/revoked/superseded — DECISION-0174 §D9). Humanos concentram-se em **exceções, conflitos e fatos não suficientemente sustentados** (D7). `status`/execution record permanecem read-model, nunca authority.

## D7 — Exceções humanas

**Decisão (DECISION-0171 §6.1; DECISION-0172 P3; RFC_ADDRESS_POSTAL §D-C/§D-D; postal-resolution states).** Exigem decisão humana específica, no mínimo: conflito entre fontes; mudança de código oficial; fusão/divisão/extinção/sucessão; bairro sem fonte suficiente; bairro popular versus oficial; geometrias conflitantes; colisão entre alias e bairros distintos; `provider_conflict`; `official_identifier_conflict`; baixa suficiência documental; **qualquer promoção que possa criar identidade nova**. Ausência/expiração/revogação de capability **nega** a operação (fail-closed, DECISION-0171 §6.1-C).

## D8 — Candidatos territoriais

**Norma (DECISION-0171 §7; DECISION-0172 §2 — fila de candidatos ADIADA, vocabulário territorial próprio; PROHIBITED_STRUCTURES).** **Decisão (definição vinculante):** o candidato é **registro auxiliar não soberano**, **separado** do catálogo canônico; **não** referenciável como `city_id`/`neighborhood_id`; **incapaz** de decidir identidade, conceder autoridade ou alimentar Social/Bank como território confirmado. **Escolha vinculante:** a futura casa persistente de candidatos será **compartilhada** entre município e bairro, com **discriminante territorial** (natureza territorial do candidato) — porque município-ausente e bairro-ausente têm a **mesma natureza** (evidência → candidato → decisão governada); diferenças de campo são resolvidas por discriminante, não por segundo SSOT. Forma física **reservada ao material**.

**Contrato conceitual mínimo (checklist, não schema):** tipo territorial; pai canônico; nome proposto e normalizado; identificadores externos com fonte; evidências; proveniência; primeira e última observação; estado de análise; conflito; decisão final. **Saídas governadas da análise:** vínculo a identidade existente · criação canônica · alias · sucessão · rejeição · permanência pendente (DECISION-0171 §3-C/§8/§9). **Proibido** que texto livre, CEP, provider, IA, job, cache ou score **promovam** candidato sem authority (PROHIBITED_STRUCTURES; DECISION-0171 §6/§10).

## D9 — Bairros nacionais

**Decisão (DECISION-0171 §2/§4/§5/§6; DECISION-0079).** Ratifica-se: bairro existe em contexto obrigatório de `city_id`; **ausência em base nacional não significa inexistência**; Censo/malhas, legislação, portais municipais, CEP e fontes comunitárias têm **níveis diferentes de evidência** (ordem de confiabilidade de DECISION-0171 §5); provider **nunca** cria bairro; **bairro estatístico não é automaticamente bairro jurídico**; texto popular pode resultar em **alias, candidato ou pendência**; criação canônica exige **rito de autoridade** (capability + representação + confirmação, DECISION-0171 §6.1). **Não** se inventa taxonomia fechada para favela/loteamento/distrito/comunidade/núcleo urbano/localidade/região administrativa: distinções finas usam **`source_kind` governado + evidência** (DECISION-0172 P4; DECISION-0174 §D7; LEIS Lei 7 — identidade não vive em enum/nome), com vocabulário próprio decidido em material, nunca taxonomia paralela ad hoc.

## D10 — Aliases e sucessão

**Decisão (DECISION-0171 §8/§9; DECISION-0172 §2; DECISION-0174 §D15).** Alias é **nome alternativo da mesma identidade**; alias **nunca** cria bairro; **ambiguidade permanece explícita** (resolver devolve candidatos; **nunca** `LIMIT 1`/score/vencedor silencioso); rename **preserva** identidade quando não há mudança ontológica (nome antigo vira alias na mesma transação); divisão e fusão **criam novas identidades e sucessão**; sucessão é **N:N append-only**, limitada à mesma `city_id` no MVP (fail-closed); histórico **não** é apagado; consumidores **não** herdam automaticamente audiência, voto, fundo, autoridade ou conta (DECISION-0171 §9).

## D11 — Pendências e reprocessamento

**Decisão (DECISION-0171 §10; DECISION-0074; DECISION-0077; DECISION-0078; RFC_ADDRESS_POSTAL).** Endereço físico e resolução territorial são **fatos distintos**; o reprocessamento **não** altera o endereço físico, **não** cria território, **não** escreve durante leitura; provider/cache **não** preenchem FK soberana; **confirmação humana anterior é preservada**; vigência e assignments ativos são respeitados (DECISION-0074); o processo é **idempotente, auditável e resistente a replay**. Só a **residência principal vigente** (`role='RESIDENCE'`, `is_primary`, `valid_until_at IS NULL`) é usável por consumidores sociais futuros (DECISION-0171 §10).

**Escolhas vinculantes (conceituais; forma física reservada):** (a) **haverá** uma casa persistente de pendências territoriais de endereço (o `cep_resolution_cache` é insumo técnico, não SSOT de pendência — DECISION-0078 §3); (b) a pendência **vincula-se à casa de candidatos** (D8) quando a resolução depender de identidade ainda inexistente; (c) a **chave da pendência não é baseada em PII** (nunca pessoa/endereço completo como identidade — DECISION-0171 §11); (d) **gatilhos** de reprocessamento: criação de município, bairro ou alias; aprovação de candidato; sucessão; nova versão de fonte oficial. **Nenhuma tabela nem evento é criado por esta DECISION.**

## D12 — Eventos e ownership

**Decisão (DECISION-0174 §D5/§D11/§D21; DECISION-0172 ADENDO N2-E-D-E).** Separam-se: **evento de domínio territorial** (fato de identidade) · **evento do domínio Address** (vínculo/reprocessamento de endereço) · **evento de curadoria** · **evento de automação** · **registro de approval/execution** · **log técnico**. **Ownership:** **Territory** produz fatos de identidade territorial; **Address** produz fatos de vínculo e reprocessamento de endereço; **Social e Bank apenas consomem** fatos autorizados; manifest/approval/execution **não** substituem eventos de domínio; **nenhum** evento carrega endereço completo ou PII desnecessária (DECISION-0171 §11; DECISION-0174 §D6). Esta DECISION define **famílias e contratos conceituais** de eventos; **não** emite eventos nem canoniza nomes — nomes finais respeitarão a nomenclatura vigente no material.

## D13 — Social (fronteira negativa)

**Ratificação (DECISION-0171 §11/§12; DECISION-0174 §D21).** Social **lê** IDs canônicos e fatos autorizados; **não** resolve CEP; **não** aprova candidato; **não** cria território; **não** mantém tabela territorial paralela; **não** recebe endereço completo quando um ID ou decisão booleana for suficiente (CONSTITUIÇÃO Art. VIII/X; DECISION-0171 §11).

## D14 — Bank (fronteira negativa)

**Ratificação (DECISION-0171 §12; DECISION-0174 §D21; DECISION-0166 D4 citada; LEIS Lei 5; PROHIBITED_STRUCTURES).** Territory **nunca** escreve dinheiro; **nenhuma** conta nasce por trigger direto de criação territorial; Bank decide suas próprias contas, fundos, políticas e splits; `bank_ledger` permanece SSOT financeiro; fatos territoriais **não** obrigam provisionamento financeiro; bairro/fundo/split/ledger permanecem **fora** desta frente; o **HOLD financeiro territorial** (nível `neighborhood` do fundo, DECISION-0166 D4) **permanece**.

## D15 — Revalidação da D22

**Fato.** Os rótulos "N2/N3/N4…" de DECISION-0174 §D22 são internos à sequência territorial e **não** têm relação com N1/N2 da TREE.

**Decisão (ordem recomendada de dependências — NÃO roadmap automático):**
```
DECISION nacional consolidada (esta)
  → catálogo municipal + autoridade correspondente (escopo/capability/PORTA)
  → candidatos + pendências/reprocessamento
  → bairros + aliases nacionais
  → Social
  → Bank
```
Dependências reais: municípios precedem bairros nacionais (bairro exige `city_id`); candidatos municipais e de bairro nascem provavelmente **juntos** sob discriminante (D8); reprocessamento nasce **acoplado** à casa de candidatos/rito de resolução (D11); aliases nacionais **dependem** da ingestão de bairros; eventos podem **evoluir por envelope**, desde que o vocabulário seja decidido antes de emitir o primeiro fato. **Cada envelope material exige GATE, GO, auditoria e selo próprios.** **A N1 Curitiba permanece historicamente encerrada e selada; esta revalidação trata da expansão nacional futura e NÃO a reordena nem invalida.**

## D16 — Supersessões documentais

1. **DECISION-0020/0021 (arquivos primários ausentes).** Confirmado por busca (`find`/`ls docs/02_decisions`/`git log --all -S`): **não existem** como documentos-decisão. Sua substância está viva e vinculante nos reprodutores citados nesta DECISION: SSOT/Location Core (via DECISION-0074/0077/0079), 00_AGENT_PROTOCOL §2.3.2 (jurisdição/autoridade), AUTHORITY_LAW, 08_AUTORIDADE_CANONICA, PROHIBITED_STRUCTURES §"MINI-CORES CLANDESTINOS". **Não** se cita 0020/0021 como autoridade disponível — cita-se o documento vigente reprodutor. **Gap documental registrado** (recuperação/criação dos primários = decisão própria, fora deste envelope).
2. **`ibge_code` × `external_code`.** Reconciliação válida = **Caso A (sem conflito real)**, fundamentada por distinção de escopo (vocabulário de campo de endereço em 07_NOMENCLATURA §4.20 vs. identificador do SSOT territorial). Ver D5. **Nunca** por "schema vence norma". **Nenhuma edição de 07_NOMENCLATURA é necessária ou autorizada aqui.**
3. **"Criar cidade sob demanda" (DECISION-0077 §2-C; DECISION-0078 §5).** Cláusulas identificadas: DECISION-0077 §2-C ("criar/importar `cities` por `external_code` IBGE **sob demanda** quando o CEP retornar município ausente") e DECISION-0078 §5 ("cria city por `external_code` IBGE **sob demanda**"). Documento posterior e mais restritivo: **RFC_ADDRESS_POSTAL_RESOLUTION_AND_CITY_GOVERNANCE** (decisão de fronteira, PRÉ-MATERIAL), §D-D ("`canonical_city_missing` fail-closed; NUNCA provider → INSERT em cities") e §D-E ("ingestão oficial de cidades = frente futura própria; NUNCA sob demanda"). **Supersessão declarada (documentalmente válida):** o regime pretendido é **consulta postal falha-fechada** (`canonical_city_missing`) **e ingestão apenas em frente própria governada** — a criação de cidade sob demanda de DECISION-0077 §2-C / 0078 §5 fica **superada** para o caminho canônico nacional. As demais cláusulas de 0077/0078 (cache como insumo, centroide coarse/LGPD, backfill idempotente por job, ViaCEP/BrasilAPI como provider/evidência) permanecem **compatíveis e vigentes**.
4. **DECISION-0079.** Superada por DECISION-0171/0172 no que se refere ao **caminho canônico de identidade** de bairro (bairro pode nascer identidade governada por curadoria, não apenas exibição). **Permanece compatível e vigente:** bairro como **texto de exibição/evidência** enquanto não houver identidade canônica; veto de FK por nome livre ("match por barbante"); autoridade territorial por UF/cidade com código oficial.

## D17 — Material futuro (famílias separadas; nenhuma aprovada aqui)

Ficam **separadas e não aprovadas** as futuras famílias materiais: (1) catálogo municipal; (2) authority/capability/PORTA territorial nacional; (3) identificadores externos; (4) candidatos e pendências; (5) bairros; (6) aliases; (7) reprocessamento; (8) eventos; (9) Social; (10) Bank. **Cada uma** exige GATE/GO/auditoria/selo próprios. **Esta DECISION não aprova automaticamente nenhuma delas.**

## D18 — Escopo negativo (cumprido nesta fatia)

Docs-only: **zero** código, migration, aplicação de migration, DDL/DML, ingestão, cidade, bairro, alias, candidato, endereço reprocessado, evento, Social, Bank; migration N1 dormente **não** aplicada; manifest de Curitiba **não** emitido; HOLD **não** aberto; nenhuma capability/grant/PORTA; **Δbank=0**. `07_NOMENCLATURA_CANONICA.md` **intocado**.

---

## Efeito

- **DECISION-0175 DECIDIDA / DOCS-ONLY.** Consolida a doutrina, os contratos conceituais, o modelo de identificadores, as escolhas de candidato/pendência/reprocessamento, o vocabulário de eventos, as fronteiras Social/Bank e a revalidação de D22 da **escala territorial nacional**.
- **Todas as famílias materiais (D17) permanecem TRANCADAS** até GATE/GO próprios.
- **AGUARDA UMA ÚNICA AUDITORIA YALA.** Nenhum material é iniciado por este documento.
