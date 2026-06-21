# respostas/IA-SEMANTICA.md — IA-SEMANTICA (append-only)

> Dona do eixo SEMÂNTICA (concepts / concept_relations / categories-navegação / labels / needs-graph /
> governança do grafo). READ-ONLY. Análise = INSUMO, nunca GO. Disco vence narrativa.

---

## RODADA 5 — U1b PRÉ-SEED: forma canônica dos 10 concepts + 9 arestas (PROPOSTA, não execução)

**Carimbo:** HEAD no momento `6c93c648` · branch `rescue-structural` | **Revalidou no vivo:** **sim** (disco/migrations de 1ª mão; existência de rows no banco vivo = INCONCLUSIVO → IA-BANCO) | **Fonte:** ver `arquivo:linha` em cada item | **Status: RESPONDIDO** (PROPOSTA para Clayton ratificar; DECISION-0142 segue HELD até o fechamento).

> **Natureza:** isto é a forma canônica que a dona-do-eixo PROPÕE (DECISION-0070: taxonomia não nasce de runtime/IA/frontend; nasce de proposta curada + governança). NÃO é GO, NÃO executa, NÃO toca código/migration/banco.

---

### 0. Substrato revalidado de 1ª mão (o que o disco diz hoje)

- **`concepts`** (`0069_concepts.sql:12-18`, evoluído por `0074:35-43`): colunas `concept_id` (PK) · `slug TEXT NOT NULL` · `domain TEXT NOT NULL` (FK→`domains.domain_key`) · **UNIQUE `(domain, slug)`**. Slug é auxiliar; identidade = `concept_id`; domain = N0 (FK). **Convenção viva = kebab-case** (todos os seeds: `cuidados-pessoais`, `cinema-e-series`, `varejo-alimentar-especializado-carnes`…).
- **`domains`** (`0073_domains_n0.sql:20-36`): 12 N0 core + 1 condicional + (depois) `financeiro-*`/`item-comercial` (DECISION-0105). **Os 4 domínios que a Rodada 5 usa existem todos:** `cultura-lazer-e-eventos`, `servicos`, `mobilidade-e-logistica`, `produtos-e-comercio`.
- **Governança de `concepts`** (`0075_concept_governance_trigger.sql:17-30`): trigger `trg_concept_governance` exige `app.concept_governance='true'` (set_config local na mesma tx); senão **bloqueia** (`check_violation`). Seed idempotente por `ON CONFLICT (domain, slug) DO NOTHING`.
- **Governança de `concept_relations`** (trigger `0077` / `app.graph_governance`): **já provada no U1** (negative-proof NP2 mordeu). CHECK do `relation_type` agora aceita os **6 tipos** (`20260620130000_widen…:26-33`). Grafo é **GLOBAL, sem `tenant_id`** (DECISION-0092; nota de re-baseline da RODADA 3).
- **`concept_labels`** (`20260605170000_create_concept_labels.sql`): camada de APRESENTAÇÃO governada (DECISION-0107). **D12 = SEM seed** (labels vêm em fatia própria); fallback honesto: sem label → projeção retorna **slug** (`COMMENT` linha 50). Label NÃO é identidade (proibido resolver concept por label).
- **DECISION-0105** (`DECISION_0105_…:31-52, 86`): `concepts.domain` é **multi-camada**; para a Rodada 5 a camada relevante é **N0 de atuação** (tipo de serviço/vendedor). Mapeamento promulgado §9: `services → servicos`, `events → cultura-lazer-e-eventos`. **Âncora direta das minhas escolhas de domain.**
- **Precedente de seed de concepts:** `20260616120000_seed_concepts_temporal_purpose.sql` (set_config + INSERT VALUES + ON CONFLICT). **Precedente de árvore governada:** `20260601120000`/`20260601130000` (learning/interest, com GUARD 0 de domínio + guards fail-closed de contagem).

---

### 1+2+3. TABELA CANÔNICA FINAL (concept · slug-kebab · domain · novo|reusar · justificativa)

| # | Need (intent/serviço) | **slug-kebab** | **domain** | novo/reusar | Justificativa (fonte) |
|---|---|---|---|---|---|
| 1 | Casamento (intent-raiz) | `festa-de-casamento` | `cultura-lazer-e-eventos` | **NOVO** | `events → cultura-lazer-e-eventos` (0105 §9); é o concept-intenção raiz que decompõe o grafo |
| 2 | Local / espaço do evento | `local-de-evento` | `servicos` | **NOVO** | vendor de locação de espaço = serviço (N0 atuação; precedente `salao → servicos`, `20260416125000:20,33`). **Ponto de juízo** (alt. `cultura-lazer-e-eventos`) — ver §4b |
| 3 | Buffet / alimentação | `buffet-alimentacao` | `servicos` | **NOVO** | serviço de alimentação para festa. Adjacência reportada com `alimentacao-servico-preparado` (establishment) — ver §4a |
| 4 | Fotografia e vídeo | `fotografia-video` | `servicos` | **NOVO** | **colisão evitada:** `fotografia`/`video` já existem em `educacao-e-conhecimento` (LEARNING, `20260601120000:37,42`). Slug+domain distintos; é serviço de festa, não aprendizado (ponto 1) |
| 5 | Música e som | `musica-som` | `servicos` | **NOVO** | idem: `musica` existe em `educacao` (LEARNING, `…:38`). Serviço de festa ≠ aula de música |
| 6 | Decoração de festa | `decoracao-festa` | `servicos` | **NOVO** | idem: `decoracao` existe em `educacao` (LEARNING, `…:68`). Serviço de festa ≠ curso de decoração |
| 7 | Beleza (cabelo/maquiagem) | `beleza-cabelo-maquiagem` | `servicos` | **NOVO** | adjacência reportada com `servicos-pessoais-beleza` (establishment/salão, `20260416125000:20`) — ver §4a |
| 8 | Locação de traje | `locacao-de-traje` | `servicos` | **NOVO** | locação = serviço (você aluga, não compra). **Ponto de juízo** (alt. `produtos-e-comercio`) — ver §4b |
| 9 | Transporte | `transporte` | `mobilidade-e-logistica` | **NOVO** | N0 mobilidade. Só veículos específicos existem (`carro/moto/van/…`, `20260524100000:11-22`); a **classe** `transporte` não existe → nasce nova |
| 10 | Cerimonial / assessoria | `cerimonial` | `servicos` | **NOVO** | serviço de cerimonial/assessoria de evento; inexistente no disco; nasce novo |

**Resumo:** **10/10 NOVOS. ZERO reuso.** Nenhum dos 10 slugs existe hoje em nenhum domínio (grep nas migrations: sem match). Reusar qualquer concept de `educacao-e-conhecimento` violaria o **ponto 1** + DECISION-0070 (aprendizado ≠ serviço de festa).

---

### 4. COLISÕES (relatório obrigatório — pontos 1 e 2)

**4a. Colisões/adjacências reais encontradas:**
- **`educacao-e-conhecimento` (LEARNING) — NÃO reutilizar (ponto 1, confirmado):** existem `fotografia`, `musica`, `video`, `decoracao` (+ `culinaria`, `confeitaria`…) como concepts de **aprendizado** (`20260601120000:37-72`). São identidade "curso/conteúdo", não "serviço de festa". Minha proposta os **evita** por (i) domínio distinto (`servicos`) e (ii) slug distinto (`fotografia-video`/`musica-som`/`decoracao-festa`). Como `UNIQUE` é `(domain, slug)`, mesmo um slug limpo em `servicos` NÃO colidiria com `educacao`; ainda assim mantenho slugs compostos para evitar **mesmo-string-em-2-domínios** (footgun em log/label). **Não é equivalência real → nascer novo.**
- **`servicos` — adjacências de granularidade (REPORTADAS para juízo):**
  - `servicos-pessoais-beleza` (establishment/`salao`, `20260416125000:20,33`) **vizinho** de `beleza-cabelo-maquiagem`.
  - `alimentacao-servico-preparado` (establishment/`restaurante`, `…:21,34`) **vizinho** de `buffet-alimentacao`.
  - **Veredito:** NÃO são equivalência real — os existentes são **classificação de tipo-de-empresa** (lastro de `company_type_allowed_concepts`), enquanto os da festa são **need-concepts da decomposição do casamento**. Papel diferente → **nascer novo**, mas **reporto** a adjacência para Clayton decidir se quer consolidar (recomendo NÃO consolidar: conflataria "tipo de negócio" com "necessidade de festa", anti-padrão D5/0105).

**4b. Pontos de juízo de `domain` (única decisão de produto que sobra — ponto 3):**
- **`local-de-evento`** → recomendo **`servicos`** (vendor de locação de espaço; N0 = atuação, paralelo a `salao→servicos`). Alternativa defensável: `cultura-lazer-e-eventos` (se Clayton preferir agrupar o espaço com o evento). Como o `domain` **não limita matching** (ADENDO Clayton 2026-06-16, `20260616120000:7`), o impacto é só de classificação.
- **`locacao-de-traje`** → recomendo **`servicos`** (locação = serviço). Alternativa: `produtos-e-comercio` (se tratado como comércio de vestuário). Locação não transfere propriedade → serviço é o enquadramento mais fiel.

> Ambos os "|" da direção preliminar são **resolvidos para `servicos`** na minha proposta; deixo as alternativas explícitas porque são juízo de produto de Clayton, não de norma.

---

### 5. LABELS — política (ponto 4)

**FORA do escopo do U1b.** DECISION-0107 **D12**: `concept_labels` nasce **sem seed**; a projeção do needs-graph retorna **slug** (fallback honesto desenhado em `20260605170000:50` — "sem label → null → frontend mostra slug"). Logo:
- **NÃO criar label agora.** A projeção `intent-concept → need-concepts` é servível só com `concepts` + `concept_relations` (slug é suficiente).
- Se/quando se quiser display amigável ("Local do evento", "Buffet"), isso é **fatia separada** (seed governado de `concept_labels`, `is_primary=true`, `source='curadoria'`, locale `pt-BR`) — **não bloqueia** U1b nem 0142.

---

### 6. FORMA DA SEED-MIGRATION DE CONCEPTS (proposta — espelha `20260616120000`)

Migration única, forward-only, idempotente, governada, fail-closed (timestamp > `20260620130000`):
```
BEGIN;
-- GUARD 0 (fail-closed): os 4 domínios N0 devem existir
DO $$ BEGIN
  IF (SELECT count(*) FROM domains
      WHERE domain_key IN ('cultura-lazer-e-eventos','servicos','mobilidade-e-logistica')) < 3
  THEN RAISE EXCEPTION 'ABORT: domínio N0 ausente'; END IF;
END $$;

SELECT set_config('app.concept_governance', 'true', true);  -- trigger 0075

INSERT INTO concepts (slug, domain) VALUES
  ('festa-de-casamento',      'cultura-lazer-e-eventos'),
  ('local-de-evento',         'servicos'),
  ('buffet-alimentacao',      'servicos'),
  ('fotografia-video',        'servicos'),
  ('musica-som',              'servicos'),
  ('decoracao-festa',         'servicos'),
  ('beleza-cabelo-maquiagem', 'servicos'),
  ('locacao-de-traje',        'servicos'),
  ('cerimonial',              'servicos'),
  ('transporte',              'mobilidade-e-logistica')
ON CONFLICT (domain, slug) DO NOTHING;

-- GUARD final (fail-closed): os 10 devem estar presentes
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM concepts WHERE slug IN
   ('festa-de-casamento','local-de-evento','buffet-alimentacao','fotografia-video','musica-som',
    'decoracao-festa','beleza-cabelo-maquiagem','locacao-de-traje','cerimonial','transporte');
  IF n <> 10 THEN RAISE EXCEPTION 'ABORT: concepts esperados=10, encontrados=%', n; END IF;
END $$;
COMMIT;
```
- **Negative-proof (deve morder):** rodar o INSERT **sem** `set_config('app.concept_governance',…)` → trigger `0075` bloqueia (`concept insert blocked`). Paralela à NP do U1.

---

### 7. FORMA DA SEED-GOVERNADA DAS 9 ARESTAS (proposta — caminho `app.graph_governance` já provado no U1)

Migration separada (depende de §6), governada, idempotente. Arestas ratificadas por Clayton (`requires` ×5, `related_to` ×4, **SEM `suggests`**):
```
BEGIN;
SELECT set_config('app.graph_governance', 'true', true);  -- trigger 0077 (provado no U1)

INSERT INTO concept_relations (subject_concept_id, object_concept_id, relation_type)
SELECT s.concept_id, o.concept_id, v.rel
FROM (VALUES
  ('local-de-evento',         'requires'),
  ('buffet-alimentacao',      'requires'),
  ('fotografia-video',        'requires'),
  ('musica-som',              'requires'),
  ('decoracao-festa',         'requires'),
  ('beleza-cabelo-maquiagem', 'related_to'),
  ('locacao-de-traje',        'related_to'),
  ('transporte',              'related_to'),
  ('cerimonial',              'related_to')
) AS v(obj_slug, rel)
JOIN concepts s ON s.slug = 'festa-de-casamento' AND s.domain = 'cultura-lazer-e-eventos'
JOIN concepts o ON o.slug = v.obj_slug          -- resolução por (slug,domain) abaixo
   AND o.domain = CASE v.obj_slug WHEN 'transporte' THEN 'mobilidade-e-logistica' ELSE 'servicos' END
ON CONFLICT DO NOTHING;   -- alvo do ON CONFLICT = constraint UNIQUE viva → IA-BANCO confirma o nome

-- GUARD final: 9 arestas com subject=festa-de-casamento
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM concept_relations r
   JOIN concepts s ON s.concept_id=r.subject_concept_id
   WHERE s.slug='festa-de-casamento' AND s.domain='cultura-lazer-e-eventos';
  IF n <> 9 THEN RAISE EXCEPTION 'ABORT: arestas esperadas=9, encontradas=%', n; END IF;
END $$;
COMMIT;
```
- **Resolução por `(slug, domain)`** (não por slug só): `UNIQUE` de concepts é `(domain, slug)`; o `CASE` garante que `transporte` resolve em `mobilidade-e-logistica` e o resto em `servicos`. Determinístico.
- **Alvo do `ON CONFLICT`:** o `concept_relations` é **global pós-0092 (sem `tenant_id`)** → UNIQUE provável `(subject_concept_id, object_concept_id, relation_type)`. **O nome/colunas exatos da constraint viva = IA-BANCO** (prova-viva que não alcanço read-only).
- **Negative-proof (já provada no U1):** INSERT sem `app.graph_governance` → trigger `0077` bloqueia.

> **Uma migration ou duas?** Recomendo **DUAS** (concepts → depois arestas), espelhando o precedente learning/interest (A=concepts, B=árvore): cada uma com idempotência + negative-proof + guard próprios; B depende de A. Combinar numa só tx também é viável (dois `set_config` na mesma transação), mas separar dá reseal mais limpo da IA-YALA.

---

### 8. FRONTEIRA · INCONCLUSIVO · STOPs

- **FRONTEIRA:** **IA-BANCO** — existência viva dos 4 domínios + nome/colunas exatos da UNIQUE de `concept_relations` (pós-0092) + estado vivo dos triggers `0075`/`0077` (prova-viva das duas negative-proofs). **IA-OFERTA** NÃO cruza aqui (U1b é vocabulário/grafo; `services`/`service_offerings` intocados). **IA-DECISOES-DT** — DECISION-0142 (HELD) recebe esta proposta como insumo.
- **INCONCLUSIVO (read-only não alcança):** se algum dos 10 slugs já tem **row no banco vivo** (o disco não mostra seed deles, mas confirmação de rowcount é da IA-BANCO); nome exato da constraint de `concept_relations`.
- **STOPs honrados (ponto 5):** proposta toca **apenas** `concepts` + `concept_relations`. **NÃO** toca `services`/`service_offerings`/`company_concept_publications`/`tenant_concept_offerings`/RFQ/presença/dinheiro/worker/payout. **NÃO** cria `categories` nem associa `concept_id` a categoria (o needs-graph é concept→concept puro; categories = navegação, fora). **NÃO** executei nada — PROPOSTA para Clayton ratificar; **DECISION-0142 permanece HELD** até o fechamento da forma.

**Status: RESPONDIDO** — proposta canônica completa (slug+domain+reuso+colisões+label+2 formas de seed), carimbada HEAD `6c93c648`, READ-ONLY.

— **IA-SEMANTICA**, sob coordenação da IA-DIRETORA.

---

## RODADA 5b — REVISÃO PELA LENTE DE REUSO (folha = SSOT context-neutral) — SET FINAL

**Carimbo:** HEAD no momento `6c93c648` · branch `rescue-structural` | **Revalidou no vivo:** **sim** (disco/migrations de 1ª mão; rowcount vivo = INCONCLUSIVO → IA-BANCO) | **Status: RESPONDIDO** (PROPOSTA, não execução; DECISION-0142 HELD).

> **Nota de barramento:** a RODADA 5b ainda **não está postada no `INBOX.md`** (em HEAD `6c93c648` o INBOX mostra RODADA 5 **FECHADA** e nenhum bloco 5b). Respondo à **diretriz de ativação de Clayton** (lente de REUSO), que carrega o conteúdo da tarefa. A IA-DIRETORA reconcilia o INBOX quando consolidar.

### A. A lente muda a resposta da RODADA 5 (e por quê)

A RODADA 5 concluiu "10 NOVOS / 0 reuso" sob o **ponto 1** ("não reutilizar concept de `educacao` se é aprendizado"). A **lente de REUSO** reenquadra o que esses concepts **são** — e o **disco prova** o reenquadramento:

- **Precedente vivo (decisivo):** o seed de interesse **já reutiliza 27 concepts de `educacao-e-conhecimento`** para folhas `scope='interest'`, **MESMO `concept_id`**, categoria distinta (`20260601130000:10,13,170`). Ou seja, `fotografia`/`musica`/`decoracao` **já não são identidade "curso"** — são o **SUBJECT context-neutral** ("fotografia, a coisa"), reusado por contexto via a aresta/categoria. O slug foi seedado "**LIMPO do tópico, sem sufixo de contexto**" de propósito (`20260601120000:7`).
- **Lei 7 / 0105:** identidade = `concept_id`; `domain` é **auxiliar/breadcrumb**, e (ADENDO Clayton 2026-06-16, `20260616120000:7`) **domínio NÃO limita matching**. Logo uma aresta `festa-de-casamento requires fotografia` pode apontar para o `fotografia` que mora em `educacao` — **cross-domain é legítimo** no grafo global.
- **Os próprios nomes ratificados por Clayton já são neutros:** `requires (local·buffet·fotografia·musica·decoracao)` — **não** `fotografia-video`/`musica-som`/`decoracao-festa`. Os sufixos `-festa`/`-video`/`-som`/`-de-traje` da "direção preliminar" eram **context-bundling**; a lente os remove. **Contexto mora na ARESTA (`festa-de-casamento`), nunca na folha.**

**Payoff do reuso:** com folhas neutras, um futuro `festa-de-aniversario`/`evento-corporativo` **reusa as MESMAS folhas** (`requires fotografia/musica/decoracao/buffet/local`) — "um substrato, N verticais". Folha context-bundled mataria isso.

> **Isto REVERTE o ponto 1 da RODADA 5.** É decisão de produto de Clayton/IA-DIRETORA; eu, como dona do eixo, recomendo a versão-reuso por ser a canônica (concept = subject; offering = verbo; contexto = aresta).

### B. SET FINAL (lente de reuso) — `festa-de-casamento` (raiz/intent) + 9 folhas neutras

| Aresta | **folha (slug neutro)** | **domain (existente)** | **REUSAR / NOVO** | Justificativa (fonte) |
|---|---|---|---|---|
| (raiz) | `festa-de-casamento` | `cultura-lazer-e-eventos` | **NOVO** | é o **vertical/intent** (subject das arestas), context-specific por natureza; `events→cultura-lazer` (0105 §9). NÃO é folha |
| requires | `fotografia` | `educacao-e-conhecimento` | **REUSAR** | subject neutro já vivo (`20260601120000:37`), já reusado em interest. Contexto festa = aresta |
| requires | `musica` | `educacao-e-conhecimento` | **REUSAR** | idem (`…:38`) |
| requires | `decoracao` | `educacao-e-conhecimento` | **REUSAR** | idem (`…:68`) |
| requires | `local-de-evento` | `servicos` | **NOVO** | inexistente; neutro (qualquer evento). Vendor de espaço = serviço (precedente `salao→servicos`) |
| requires | `buffet` | `servicos` | **NOVO** (com candidato de reuso) | inexistente. **Candidato de reuso:** `alimentacao-servico-preparado` (establishment/restaurante, `20260416125000:21`) — ver §C |
| related_to | `beleza` | — | **REUSAR `servicos-pessoais-beleza`** | já vivo, neutro (provider de beleza serve festa+dia-a-dia), `20260416125000:20`. Alt.: NOVO `beleza` — ver §C |
| related_to | `locacao-de-traje` | `servicos` | **NOVO** | inexistente; locação = serviço; serve casamento/formatura/gala (neutro o bastante) |
| related_to | `transporte` | `mobilidade-e-logistica` | **NOVO** | só veículos específicos vivos (`carro/moto/…`, `20260524100000`); a **classe** `transporte` não existe; neutra |
| related_to | `cerimonial` | `servicos` | **NOVO** | inexistente; assessoria de evento; reusável por tipo de evento |

**Contagem:** **REUSAR = 4** (`fotografia`, `musica`, `decoracao`, `servicos-pessoais-beleza`) · **NOVO = 6** (`festa-de-casamento`, `local-de-evento`, `buffet`, `locacao-de-traje`, `transporte`, `cerimonial`).
**`video`/`-som` caem:** as arestas ratificadas são `fotografia`/`musica` (singular). Vídeo/som = `related_to` futuro, se Clayton quiser — não force agora.
**NÃO mover os reusados:** `fotografia`/`musica`/`decoracao` **permanecem** em `educacao-e-conhecimento` (mover seria DML/rename, fora de escopo; domain é auxiliar). A aresta cruza domínio — legítimo.

### C. Equivalências REAIS a Clayton decidir (ponto 2 — reporto, não decido)

1. **`beleza` → recomendo REUSAR `servicos-pessoais-beleza`** (existente, neutro). Risco: está amarrado a `company_type='salao'` via `company_type_allowed_concepts` — mas isso é binding de ativação, não impede a aresta. Alternativa limpa: **NOVO `beleza`** em `servicos` (desacoplado do establishment). *Lente de reuso favorece REUSAR.*
2. **`buffet` → candidato a REUSAR `alimentacao-servico-preparado`** (existente). Risco: esse concept é "serviço de alimentação preparada" amarrado a `company_type='restaurante'`; buffet/catering de evento **pode** ser serviço distinto (atende no local). Recomendo **NOVO `buffet`** + flag — mas se Clayton entender que "caterer = provider de alimentacao-servico-preparado", **REUSAR** é o canônico.

### D. Labels (inalterado da RODADA 5)
**Fora de escopo** (DECISION-0107 D12: sem seed; projeção retorna **slug**). As folhas reusadas **já poderiam** ganhar label no futuro sem afetar U1b.

### E. Forma da seed — AJUSTES vs RODADA 5 (mesma governança; só muda o conteúdo)

**Migration A (concepts) — só os 6 NOVOS** (não seedar os reusados; eles já existem):
```
SELECT set_config('app.concept_governance','true',true);   -- trigger 0075
INSERT INTO concepts (slug, domain) VALUES
  ('festa-de-casamento','cultura-lazer-e-eventos'),
  ('local-de-evento','servicos'),
  ('buffet','servicos'),
  ('locacao-de-traje','servicos'),
  ('cerimonial','servicos'),
  ('transporte','mobilidade-e-logistica')
ON CONFLICT (domain, slug) DO NOTHING;
-- guard: 6 presentes (+ pré-check fail-closed: os 4 reusados existem:
--   fotografia/musica/decoracao em 'educacao-e-conhecimento' e servicos-pessoais-beleza em 'servicos')
```
> **GUARD NOVO obrigatório:** antes das arestas, **assert que os 4 reusados existem** (senão a aresta resolve NULL e falha silenciosa). Fail-closed.

**Migration B (9 arestas governadas) — JOIN por `(slug, domain)` com domínios MISTOS:**
```
SELECT set_config('app.graph_governance','true',true);     -- trigger 0077 (provado no U1)
INSERT INTO concept_relations (subject_concept_id, object_concept_id, relation_type)
SELECT s.concept_id, o.concept_id, v.rel
FROM (VALUES
  ('fotografia',              'educacao-e-conhecimento', 'requires'),
  ('musica',                  'educacao-e-conhecimento', 'requires'),
  ('decoracao',               'educacao-e-conhecimento', 'requires'),
  ('local-de-evento',         'servicos',                'requires'),
  ('buffet',                  'servicos',                'requires'),
  ('servicos-pessoais-beleza','servicos',                'related_to'),
  ('locacao-de-traje',        'servicos',                'related_to'),
  ('transporte',              'mobilidade-e-logistica',  'related_to'),
  ('cerimonial',              'servicos',                'related_to')
) AS v(obj_slug, obj_domain, rel)
JOIN concepts s ON s.slug='festa-de-casamento' AND s.domain='cultura-lazer-e-eventos'
JOIN concepts o ON o.slug=v.obj_slug AND o.domain=v.obj_domain   -- (slug,domain) exato
ON CONFLICT DO NOTHING;   -- alvo = UNIQUE viva (subject,object,relation_type) pós-0092 → IA-BANCO confirma
-- guard: 9 arestas com subject=festa-de-casamento
```
- **Resolução por `(slug, domain)` explícito é AGORA obrigatória** (domínios mistos: educacao + servicos + mobilidade) — resolver por slug só erraria.
- Negative-proofs idênticas: sem `concept_governance` → 0075 morde; sem `graph_governance` → 0077 morde (provado no U1).
- **Duas migrations** (A→B); B depende de A + dos 4 reusados.

### F. FRONTEIRA · INCONCLUSIVO · STOPs
- **FRONTEIRA — IA-BANCO:** rowcount vivo dos 4 reusados (`fotografia`/`musica`/`decoracao`/`servicos-pessoais-beleza`) e dos 6 novos; nome exato da UNIQUE de `concept_relations` pós-0092; estado vivo dos triggers 0075/0077.
- **FRONTEIRA — IA-OFERTA/IA-DIRETORA (alerta material):** como as folhas reusadas moram em `educacao-e-conhecimento`, a descoberta `need-concept → providers` **deve casar por `concept_id`** (nunca filtrar por `concept.domain`) — coerente com o ADENDO 2026-06-16. Documentar para a MACRO 2.
- **INCONCLUSIVO:** existência de row dos 4 reusados no banco vivo (disco mostra o seed; confirmação = IA-BANCO).
- **STOPs:** só `concepts`+`concept_relations`; **não** cria categories nem associa concept_id a categoria; **não** move/renomeia os reusados; **não** toca services/offerings/publications/RFQ/dinheiro/presença/worker/payout; **não** executa. DECISION-0142 **HELD** até Clayton fechar a forma.

**Status: RESPONDIDO** — SET FINAL pela lente de reuso (4 REUSAR + 6 NOVO; contexto na aresta; folhas neutras), carimbado HEAD `6c93c648`, READ-ONLY. **Reverte o ponto 1 da RODADA 5 — decisão de Clayton.**

— **IA-SEMANTICA**, sob coordenação da IA-DIRETORA.

---

## F-OFFER-4 (2º elo) — RÉGUA DE RESOLUÇÃO SEMÂNTICA (entrada humana → concept_id → discovery)

**Carimbo:** HEAD no momento `f6c07742` · branch `rescue-structural` | **Revalidou no vivo:** **sim** (07 §18.14/§4262-4278, `semantic.adapter.ts`, DECISION-0142, IA-DESCOBERTA-FRONT — 1ª mão; rowcount/JOIN vivo = INCONCLUSIVO → IA-BANCO 3º elo) | **Status: RESPONDIDO** (INSUMO, não GO).

> **Contexto recebido (IA-DESCOBERTA, 1º elo):** discovery viva casa por `category_id`/`domain` como IDENTIDADE em 3 superfícies (`discoverServices`/`assertServicosCategory`/`/services/discover`) → viola 0142 §B. Resolver `category→concept` EXISTE (`semantic.adapter.resolveConceptFromCategory/Slug`). `concept_id` vive em `canonical_services.concept_id`; `services` liga via `canonical_service_id`; `tenant_concept_offerings` já casa por concept. `categories.concept_id` marcado "proibido transacional" (07 §4262/4278).

### A chave: SEPARAR **resolução-de-leitura** (filtro de busca) de **concept_ref-persistido** (linha transacional)

O que 07 §18.14 proíbe (`:4260-4286`) é **derivar o `concept_ref` PERSISTIDO** dos fluxos **intent/pedido/oferta** a partir de `categories.concept_id` (`:4262` "exclusivamente a partir de `canonical_products.concept_id`"; `:4278` "Não é permitido derivar concept_ref de categories.concept_id, nem como fallback"; `:4286` "domínio de produto e oferta"). É proibição sobre **a identidade gravada numa linha** — porque `categories.concept_id` é navegação **mutável** e gravá-la como verdade transacional cria drift. **NÃO** é proibição de um **hop de leitura** navegação→concept que produz só um **parâmetro de query** efêmero. Discovery/search **não cria linha** de intent/pedido/oferta. Essa separação é o eixo de toda a régua.

### (1) RÉGUA DE RESOLUÇÃO CANÔNICA — entrada humana → concept_id

- **Entrada = navegação** (`category_id` | `category slug` | `categoryPath` | `domain`). A UI mantém isto (correto: navegação, não identidade) — o re-key é **server-side**.
- **Resolução (read-only, p/ discovery):** `category_id`→`resolveConceptFromCategory` (lê `categories.concept_id`) ou `slug`→`resolveConceptFromSlug` → `concept_id` (`semantic.adapter.ts:40-73`). **PERMITIDO**: é hop navegação→concept que vira **filtro de query**, não `concept_ref` gravado. **07 §4262/4278 NÃO impede** (não é fluxo intent/pedido/oferta; nada é persistido).
- **Resolução (transacional, quando vira oferta/intent/pedido):** aí sim a identidade gravada **DEVE** vir de `canonical_services.concept_id` (análogo serviço do `canonical_products.concept_id` de §18.14), **NUNCA** de `categories.concept_id`/`domain`. O ponto onde a oferta hoje usa `domain` como identidade (`assertServicosCategory`, `metadata->>'domain'='servicos'`) **é a violação a remover** — religar ao concept via `canonical_service`.
- **Régua de uma linha (canônica):** *navegação resolve concept_id para FILTRAR (read); só `canonical_services.concept_id` carimba concept_ref para GRAVAR (write). `categories.concept_id` nunca é gravado nem é fallback de gravação.*

### (2) MATCHING por concept_id sem esconder reuso

- Discovery casa por **`concept_id`**: `services` JOIN `canonical_services` ON `services.canonical_service_id = canonical_services.id`, **`WHERE canonical_services.concept_id = :resolvedConceptId`**. `tenant_concept_offerings.concept_id` já é o padrão correto vivo (cross-tenant, concept-bound).
- **PROIBIDO** `WHERE category_id = …` ou qualquer filtro por `concept.domain` como identidade (0142 **§B.3**, vinculante; `assertServicosCategory` é exatamente isso).
- **Reuso cross-domain APARECE por construção:** as folhas reusadas (`fotografia`/`musica`/`decoracao` em `educacao-e-conhecimento`; `servicos-pessoais-beleza`) são casadas por `concept_id` — **agnóstico a domain** (0142 §B.2, ADENDO 2026-06-16). É o filtro-por-domain ATUAL que as **esconderia**; o re-key as **revela** (não é o re-key que quebra — o estado atual já está errado).
- **Escopo V1 = single-concept:** entrada resolve UM `concept_id` → casa providers daquele concept. A **expansão needs-graph** (`festa-de-casamento` → 9 folhas via `concept_relations`) é o **motor de composição** (MACRO 1/5), **elo posterior** — não embutir em F-OFFER-4 V1.

### (3) Status de 07 §4262/4278 — IMPEDE ou não?

**NÃO impede o re-key de discovery; REFORÇA-o.** Confirmado de 1ª mão (`07:4260-4286`): a norma é sobre **`concept_ref` persistido em produto/oferta**, mandando `canonical_*.concept_id` e vetando `categories.concept_id`. Aplicada a F-OFFER-4: (a) discovery-read com hop `categories.concept_id` = **fora** da proibição (não persiste concept_ref); (b) oferta/intent/pedido = **dentro** → deve usar `canonical_services.concept_id` (a norma é §18.14 "Produtos", mas §4286 nomeia "produto e **oferta**" — o análogo serviço é direto). **Consistente com 0142 §B.** Único cuidado: a resolução-de-leitura **nunca** pode ser gravada como concept_ref — manter o hop estritamente efêmero.

### (4) Texto livre `q` → concept

**FUTURO, fora do V1.** Não há resolver `texto→concept` hoje (IA-DESCOBERTA `:29,35`; `SearchPage q` não integrado). V1 resolve só navegação estruturada (`category_id`/`slug`). Texto→concept exige fatia própria (normalização/desambiguação governada — DECISION-0070: não inventar taxonomia no runtime). **Não bloqueia F-OFFER-4.**

### (5) VEREDITO

**PRONTO_PARA_GO** — a régua é **determinável** das normas vigentes (0142 §B + 07 §18.14 lendo a distinção **read-filter × concept_ref-persistido**); **não exige DECISION soberana nova**. Condições do GO (não-bloqueantes de norma, são de execução/prova):
1. **Registrar a clarificação de régua** (1 linha, insumo F-OFFER-4, não nova lei): *"resolução de leitura para discovery via `categories.concept_id` é hop navegação→concept (filtro efêmero), NÃO o `concept_ref` transacional vetado por 07 §4262/4278"*. Se a IA-DECISOES/Clayton julgarem a interpretação contenciosa, vira micro-ratificação — **avalio que não precisa**.
2. **IA-BANCO (3º elo)** confirma prova-viva: rowcount `services`/`canonical_services`/`service_offerings` (a discrepância "~200 vs services=0" do 1º elo); viabilidade/índices do JOIN `services.canonical_service_id → canonical_services.concept_id`; `canonical_services.concept_id` NOT NULL vivo.
3. **Escopo travado:** V1 = single-concept, server-side re-key, UI mantém navegação; `assertServicosCategory`→bind por `canonical_service`; `human-mvp` permanece ghost (não re-keyar código morto); marketplace-por-category = frente adjacente a decidir (não arrasto).

### FRONTEIRA · STOPs
- **FRONTEIRA:** **IA-BANCO** (3º elo — prova-viva acima). **IA-OFERTA** (dona de `services`/`canonical_services`/`service_offerings` — o re-key do filtro é execução dela/IA-DIRETORA sob GO). **IA-DECISOES-DT** (se quiser formalizar a clarificação da régua). **FRONT** só se a régua mudar o contrato da rota (não muda: entrada segue category/slug).
- **STOPs honrados (proibições da tarefa):** não auditei availability/dinheiro/ranking/presence; não propus implementação (descrevi régua/JOIN como contrato semântico, não código a escrever); não toquei nada (READ-ONLY); análise = INSUMO, não GO.

**Status: RESPONDIDO** — régua canônica entregue (read-filter × concept_ref; match por `canonical_services.concept_id`; reuso preservado; texto livre futuro), **VEREDITO PRONTO_PARA_GO** condicionado à prova-viva da IA-BANCO. Carimbado HEAD `f6c07742`, READ-ONLY.

— **IA-SEMANTICA**, sob coordenação da IA-DIRETORA.
