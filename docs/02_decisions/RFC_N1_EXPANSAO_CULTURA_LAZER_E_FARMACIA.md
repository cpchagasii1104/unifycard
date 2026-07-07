# RFC — Expansão de N1: cultura-lazer-e-eventos + farmácia (v2, com teste de redução aplicado)

**Status:** 🟡 PROPOSTA v2 (aguarda ratificação de Clayton; N1 exige RFC formal, doc 19 §6.1;
mesma esteira que fechou bens-imoveis — revisão externa antes do carimbo). NADA semeado.
**Origem:** Clayton no hub do marketplace (2026-07-07): "falta mercado, farmácia, materiais de
construção, turismo/viagens".
**v2 — o que mudou:** aplicado o teste de redução ("isto se reduz ao que já existe?") por item,
igual foi exigido para bens-imoveis. Achou 2 correções reais na v1 (abaixo).

## 1. O que a auditoria já resolveu sem RFC (não repetido aqui)
Mercado=`alimentacao`, Materiais de construção=`materiais-de-construcao`, Moda=`vestuario-e-
acessorios` — os 3 já existiam como N1 de `produtos-e-comercio`; só faltava a página projetar.

## 2. cultura-lazer-e-eventos — teste de redução aplicado, 4→3 N1
**Teste:** os N1 propostos se reduzem entre si (ortogonalidade) e não se reduzem ao que já existe
noutro N0 (`producao-e-realizacao-de-eventos` em `servicos` é a PRESTAÇÃO de serviço de evento —
fotografia/buffet/decoração — nunca o evento/experiência em si; correto manter fora, sem overlap).

**Correção v2**: `turismo-e-passeios` e `viagens-e-hospedagem` (v1, 2 N1 separados) se reduzem a
**1 N1** com contextos diferentes — mesma mecânica de `alimentacao` (1 N1, contextos supermercado/
delivery/nutricao ativando N2 distintos). Passeio guiado e hospedagem são a MESMA jornada
(a viagem), não entidades ortogonais.

| N1 | Definição | N2 direcionais | Contexto |
|---|---|---|---|
| `eventos-e-ingressos` | O evento em si e seu acesso | shows, festivais, baladas, teatro | — |
| `turismo-e-viagens` | A jornada (deslocamento+estadia+experiência local) | passagens, hotel, temporada, passeios guiados, city tour | `viagem` (passagem/hotel) vs `passeio-local` (city tour/trilha) |
| `esporte-e-lazer` | Prática e assistência esportiva | campeonatos, quadras, academias-lazer | — |

## 3. Farmácia — CORRIGIDO (v1 propunha saude-e-bem-estar; teste de redução mostrou erro)
**Teste de redução aplicado**: farmácia-VAREJO (comprar remédio/protetor solar no balcão) não tem
as invariantes que justificam `saude-e-bem-estar` (sigilo médico, regulação CFM — doc 18 §10:
"ética médica, sigilo, regulação CFM"). É venda de produto embalado, não cuidado médico. O doc 19
já tem o PRECEDENTE EXATO: `estetica-e-cuidados-pessoais` foi redirecionado pra fora de
`saude-e-bem-estar` (§4.1: "Removeu 'bem-estar'; foca em aparência") pela mesma razão. Aplicando a
mesma lógica: farmácia-varejo é `produtos-e-comercio`, não saúde.

**Proposta corrigida**: N1 `farmacia-e-parafarmacia` em `produtos-e-comercio` (14º N1 do domínio).
**Anti-conflito com `higiene-e-beleza`** (já existe no mesmo N0): fronteira = propósito ESTÉTICO
(higiene-e-beleza: perfume, maquiagem, cuidado capilar — beleza) vs propósito TERAPÊUTICO
(farmacia-e-parafarmacia: medicamento, suplemento, primeiros socorros — saúde-produto), mesmo
padrão de fronteira já usado em `alimentacao` vs `bebidas` (critério físico) e `veiculos` vs
`pecas-e-acessorios-automotivos` (critério funcional).

| N1 | Definição | N2 direcionais |
|---|---|---|
| `farmacia-e-parafarmacia` | Varejo farmacêutico e parafarmácia (produto, não serviço médico) | medicamentos, dermocosméticos terapêuticos, suplementos, primeiros socorros |

## 4. Ratificação necessária
1. `eventos-e-ingressos` + `turismo-e-viagens` (consolidado) + `esporte-e-lazer` em
   cultura-lazer-e-eventos (3 N1, não mais 4)
2. `farmacia-e-parafarmacia` em `produtos-e-comercio` (não mais saude-e-bem-estar)
Após "ratificado": migration semeia N1 pela ordem N1→N2→Concepts (tríade), doc 19 ganha adendo
formal, e as páginas Eventos/Fazer-compras passam a projetar automaticamente.
