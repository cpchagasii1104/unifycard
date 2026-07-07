# RFC — F-RENTAL-ESPACOS-E-EVENTOS (expansão governada da locação)

**Status:** 🟡 PROPOSTA (aguarda revisão externa → ratificação de Clayton). NADA semeado.
**Rito:** doc 20 §11.3 exige RFC para QUALQUER novo N2 e QUALQUER novo contexto; doc 19 §6.1 exige
RFC formal para nova N1. Este RFC agrupa todas as expansões de ontologia que a conclusão de
"locação no modo operando" pediu, para passarem juntas pelo mesmo rito (evita 3 RFCs fatiados).
**Origem:** diálogo Clayton + 2 IAs (2026-07-07). Já executado SEM rito (GO direto, é UX/higiene):
remoção do tipo `other` + fim do fallback catálogo-inteiro. Tudo abaixo é o que EXIGE rito.

## 0. Princípio aplicado (Teste de Redução Ontológica — candidato a rito oficial)
Antes de propor qualquer estrutura nova: (1) cabe num Concept existente? (2) num N2? (3) num N1?
(4) viola SSOT? (5) tem identidade própria? — só então RFC. Aplicado item a item abaixo; o que
REDUZ a algo existente NÃO entra neste RFC.

## 1. Espaços (quadra, auditório, coworking...) — NÃO é tipo novo, é N2+CONTEXT sobre bens-imoveis
**Redução:** quadra/auditório/salão/estúdio/coworking/arena/palco/camping/quiosque/churrasqueira
têm a MESMA natureza de sala-comercial/galpão (estrutura construída sobre terreno, matrícula/IPTU/
zoneamento) — são `bens-imoveis` → N1 `imoveis-comerciais`. O que muda é o USO, não a natureza
(mesma régua que rejeitou "espaço para eventos" como N1 na ratificação de bens-imoveis).

**Proposta:**
- **Novos N2 em `imoveis-comerciais`** (concepts + tríade): `quadra`, `auditorio`, `estudio`,
  `coworking`, `arena`, `palco`, `camping`, `quiosque`, `churrasqueira`, `salao-de-festas` (já
  semeado), `chacara` (já semeado), `sala-de-reuniao`.
- **Novos CONTEXTs** sobre `imoveis-comerciais` (além de `eventos`, já semeado): `esportivo`
  (ativa quadra/arena/campo), `corporativo` (ativa coworking/sala-de-reuniao/auditorio).
- **UX:** o seletor de tipo PODE ter "Imóvel" e "Espaço" como duas entradas — ambas leem do MESMO
  N0 bens-imoveis (projeção, não ontologia nova; Lei de Coerência "navegação organiza, não cria
  significado"). "Espaço" projeta o subconjunto de concepts de uso não-residencial/evento.

## 2. equipamentos-para-eventos — GAP GENUÍNO, candidato a novo N1
**Redução:** testado item a item contra doc 20 (congelado):
- Áudio/vídeo de evento → REDUZ a `eletroeletronicos`→N2 `audio` (JÁ EXISTE, doc 20 §7.1.6). Fora.
- Ferramentas/construção → REDUZ a `materiais-de-construcao`→`ferramentas` (JÁ EXISTE §7.1.7). Fora.
- Informática → REDUZ a `eletroeletronicos`→`informatica`. Fora.
- **NÃO reduzem a N1 nenhum:** tenda, palco (equipamento móvel, ≠ palco-imóvel), inflável, cama
  elástica, mesa-de-evento, cadeira-de-evento (mobília de aluguel em escala ≠ `casa-e-decoracao`
  residencial), louça-de-buffet, painel, máquina-de-buffet (algodão-doce/pipoca), tenda/gazebo.
  → identidade própria (mobiliário/estrutura efêmera de evento, alugável, não-residencial).

**Proposta:** novo **N1 `equipamentos-para-eventos`** em `produtos-e-comercio` (14º N1 do domínio),
com N2 iniciais: `mobiliario-de-evento` (mesa/cadeira/tenda), `estruturas-temporarias` (palco/
painel/inflável/cama-elastica), `equipamentos-de-buffet` (máquina de algodão-doce/pipoca/freezer).
**Anti-conflito:** ≠ `casa-e-decoracao` (mobília RESIDENCIAL durável) — critério = uso efêmero/
aluguel em escala vs. mobília de moradia; mesmo tipo de fronteira já usado em papelaria vs.
mobiliário-de-escritório (doc 19 §4.2).

## 3. Festa/casamento/aniversário — NÃO é recurso nem tipo; é GRAPH (fora deste RFC)
Composição/intenção — "festa requires mesa+cadeira+som+espaço". Pertence à LAYER 6 GRAPH
(`requires`/`enables`), já nomeado em `segmentos.md` ("intenção composta #2"). Frente PRÓPRIA e
grande (matching/orquestração), FORA do escopo de locação. Registrado aqui só para NÃO ser
confundido com tipo de recurso.

## 4. Ratificação necessária
1. Novos N2 + CONTEXTs sobre `imoveis-comerciais` (§1) — concorda com espaços-como-N2?
2. Novo N1 `equipamentos-para-eventos` em produtos-e-comercio (§2) — concorda com o gap?
3. Confirma festa/casamento como GRAPH/fora-de-escopo (§3)?
Após "ratificado": migration na ordem N1→N2→Context→Concepts(tríade)→Facets→Projeção; doc 19/20
ganham adendo formal; UX de "Espaços" liberada de verdade.
