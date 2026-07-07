# RFC — Novo N0 core: `imoveis-e-propriedades`

**Status:** 🟡 PROPOSTA (aguarda ratificação de Clayton — RFC formal exigido para N0, doc 18 §14:
"aprovação unânime para mudanças em itens congelados"). NADA semeado.
**Origem:** locação de imóveis (`/locacoes`, resourceType='property') não tem concept possível —
zero N0 cobre apartamento/casa/kitnet nos 12 domínios congelados.

## 1. Teste formal (doc 18 §3, ordem obrigatória)
**Critério 1 (entidades próprias) — PASSA.** Imóvel tem invariantes jurídico-registrais que não
existem em nenhum N0 atual: matrícula no Cartório de Registro de Imóveis, ITBI na transferência,
IPTU recorrente, Lei do Inquilinato (locação), usucapião, zoneamento urbano. Não é redutível a:
- `produtos-e-comercio` — não é SKU/estoque (não se "reabastece", tem registro cartorial único).
- `ativos-corporativos` — propósito é uso/controle **operacional empresarial**; moradia pessoal de
  PF é patrimônio pessoal, propósito diferente (mesmo raciocínio que separou ações-controle de
  ações-trading em §7.1 — aqui separa uso-empresarial de moradia-pessoal).
- `servicos` — locação de imóvel não é prestação de mão de obra.

Por passar o Critério 1 de forma limpa (ao contrário de `construcao-e-infraestrutura`, que FALHA
no critério 1 e por isso é condicional), a classificação correta é **N0 CORE**, não condicional.

## 2. Nome proposto
`imoveis-e-propriedades` (padrão `X-e-Y` da nomenclatura canônica; cobre residencial/comercial/
terreno/temporada — mais genérico que "moradia" para não restringir a uso pessoal).

## 3. N1 propostos (mínimo — foco em locação, o pedido de hoje)
| N1 | Definição | N2 direcionais | Anti-conflito |
|---|---|---|---|
| `imoveis-residenciais` | Moradia | apartamento, casa, kitnet, studio, sobrado | — |
| `imoveis-comerciais` | Uso profissional/comercial | sala comercial, loja, galpão, escritório, consultório | — |
| `terrenos-e-lotes` | Terra nua | terreno urbano, terreno rural, lote | — |
| `espacos-para-eventos` | O ESPAÇO em si (não a produção) | salão de festas, chácara, sítio, buffet-espaço | `producao-e-realizacao-de-eventos` (servicos) continua sendo a PRESTAÇÃO; aqui é só o imóvel/espaço locado |

## 4. Atributos (LAYER 5 — não semânticos, não bloqueiam este RFC)
Metragem, nº de quartos/banheiros, mobiliado/vazio, andar, vaga de garagem — são **facets**
(`rentable_resources.metadata` jsonb, coluna nova de ATRIBUTO, não identidade) aplicados sobre o
CONCEPT (`apartamento`, `casa`...), nunca definem o CONCEPT em si.

## 5. Ratificação necessária
1. O N0 `imoveis-e-propriedades` como CORE (13º domínio) — ou Clayton prefere condicional?
2. Os 4 N1 propostos (ou emendas)
Após "ratificado": RFC formal segue pro doc 18 (comitê + aprovação unânime, conforme §14), depois
migration semeia N0 → N1 → concepts (apartamento, casa, kitnet...) pela tríade, e `/locacoes`
libera resourceType='property' de verdade.
