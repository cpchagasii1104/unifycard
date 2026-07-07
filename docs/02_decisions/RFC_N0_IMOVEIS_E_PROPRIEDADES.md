# RFC — Novo N0 core: `bens-imoveis`

**Status:** 🟡 PROPOSTA v2 (revisada após 2ª rodada com IA externa — aguarda ratificação de
Clayton; RFC formal exigido para N0, doc 18 §14: "aprovação unânime para mudanças em itens
congelados"). NADA semeado.
**Origem:** locação de imóveis (`/locacoes`, resourceType='property') não tem concept possível —
zero N0 cobre apartamento/casa/kitnet nos 12 domínios congelados.

## 1. Teste formal (doc 18 §3, ordem obrigatória) + teste de independência de feature
**Critério 1 (entidades próprias) — PASSA.** Imóvel tem invariantes jurídico-registrais que não
existem em nenhum N0 atual: matrícula no Cartório de Registro de Imóveis, ITBI na transferência,
IPTU recorrente, Lei do Inquilinato (locação), usucapião, zoneamento urbano. Não é redutível a:
- `produtos-e-comercio` — não é SKU/estoque (não se "reabastece", tem registro cartorial único).
- `ativos-corporativos` — propósito é uso/controle **operacional empresarial**; moradia pessoal de
  PF é patrimônio pessoal, propósito diferente.
- `servicos` — locação de imóvel não é prestação de mão de obra.

**Teste de independência (2ª rodada, IA externa):** *"Se removermos TODAS as telas de locação, o
domínio continua existindo?"* — SIM: compra, venda, herança, usucapião, desapropriação, condomínio,
hipoteca, inventário, regularização, registro — nenhum depende de locação. *"Se o UnifiCard nunca
mais trabalhar com aluguel, o domínio desaparece?"* — Também não. **Conclusão reforçada: é domínio
do mundo, não recurso especializado de uma feature.** Por passar o Critério 1 de forma limpa (ao
contrário de `construcao-e-infraestrutura`, que FALHA no critério 1 e por isso é condicional), a
classificação correta é **N0 CORE**, não condicional.

## 2. Nome revisado: `bens-imoveis` (era `imoveis-e-propriedades`)
Correção da 2ª rodada: "propriedades" é jurídicamente sobrecarregado (propriedade intelectual,
industrial, rural, fiduciária, direitos reais — universo muito maior que imóvel). `bens-imoveis`
segue o mesmo padrão estrutural de `ativos-corporativos` (substantivo+qualificador, sem forçar
"X-e-Y" onde não cabe) e não amplia o escopo além do que o domínio realmente cobre.

## 3. N1 propostos — 3 (era 4; "eventos" removido como N1, virou CONTEXT)
| N1 | Definição | N2 direcionais |
|---|---|---|
| `imoveis-residenciais` | Moradia | apartamento, casa, kitnet, studio, sobrado |
| `imoveis-comerciais` | Uso profissional/comercial | sala comercial, loja, galpão, escritório, consultório |
| `terrenos-e-lotes` | Terra nua | terreno urbano, terreno rural, lote |

**Correção da 2ª rodada (achado real):** "espaços para eventos" NÃO é natureza do imóvel — é USO.
Um galpão continua sendo `imoveis-comerciais` esteja ele abrigando uma fábrica ou uma festa de
casamento; o imóvel não muda, muda o CONTEXTO de utilização. Isso é exatamente o que a norma já
resolve com CONTEXT (doc 20 §2: "CONTEXT ativa subconjunto, não cria verdade") — mesmo padrão já
usado em `alimentacao` (contextos supermercado/delivery/nutricao ativando N2 diferentes sobre o
mesmo N1). Resolução: `context_slug='eventos'` sobre `imoveis-comerciais` (e possivelmente
`imoveis-residenciais`, para casas de veraneio usadas em festas) ativa N2 como salão-de-festas,
chácara, sítio — SEM criar um 4º N1. `producao-e-realizacao-de-eventos` (servicos) continua sendo
a PRESTAÇÃO de serviço; aqui é só o imóvel/espaço em si.

## 4. Atributos (LAYER 5 — não semânticos, não bloqueiam este RFC)
Metragem, nº de quartos/banheiros, mobiliado/vazio, andar, vaga de garagem — são **facets**
(mesmo padrão que marca/modelo/ano de veículo: coluna/jsonb de ATRIBUTO, não identidade) aplicados
sobre o CONCEPT (`apartamento`, `casa`...), nunca definem o CONCEPT em si.

## 5. Ratificação necessária
1. O N0 `bens-imoveis` como CORE (13º domínio) — nome revisado, ou Clayton prefere outro?
2. Os 3 N1 propostos (residenciais/comerciais/terrenos) — concorda com "eventos" virando CONTEXT
   em vez de N1?
Após "ratificado": RFC formal segue pro doc 18 (comitê + aprovação unânime, conforme §14), depois
migration semeia N0 → N1 → concepts (apartamento, casa, kitnet...) pela tríade, e `/locacoes`
libera resourceType='property' de verdade.
