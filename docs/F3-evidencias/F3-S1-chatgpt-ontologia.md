# F3-S1 — Análise Ontológica (ChatGPT)

**Data:** 2026-05-08
**Sessão:** F3-S1
**Origem:** ChatGPT (análise ontológica de relatórios e código)

## Achado central: "região" já é entidade econômica real

A norma já trata região como parte do motor econômico/distributivo, não só endereço postal. Exemplo explícito: fundo regional, splits regionais e distribuição territorial.

Existe código operacional resolvendo `regionId` para contas econômicas regionais:

- `region-account.service.ts`
- `resolveRegionAccountId`
- `tenant.cityId → stateId → regionId`
- criação de contas regionais
- uso de `region_accounts`

E aqui vem a bomba arquitetural — TODO explícito no código:

> "Usar stateId como regionId (por enquanto)"
> "TODO: Se houver tabela de regions separada..."

Isso é praticamente uma confissão arquitetural: o sistema SABE que "estado ≠ região", mas ainda está usando estado como proxy temporário.

## Ontologia territorial implícita

Já está emergindo:

- city
- state
- region
- tenant territorial
- economic region
- readiness por cidade
- eligibility por região
- regional funds
- regional accounts

Hierarquia sugerida pelo código:

```
cityId → stateId → regionId
```

Interface emergente:

```ts
interface CityReadiness {
  cityId: string;
  regionId: string;
}
```

O sistema já pensa territorialmente. Só não constitucionalizou isso ainda.

## Sistema NÃO tem SSOT geográfico

Não foi encontrado:
- tabela canônica de addresses
- tabela canônica de regions
- world registry consolidado
- geo SSOT formal
- authority territorial
- ontology territorial normativa

O que existe é:
- geografia espalhada
- múltiplos formatos
- strings livres
- JSONs livres
- cityId em alguns lugares
- state string em outros
- regionId improvisado
- TODOs arquiteturais explícitos

## `companies.address.state` é alerta vermelho

Schema atual aceita `cep, address, neighborhood, city, state, country` — tudo string livre.

Isso colide frontalmente com o que o sistema econômico já está insinuando:
- regiões econômicas
- contas regionais
- territorialidade operacional
- city readiness
- eligibility territorial

Existem dois mundos:

| Mundo     | Modelo           |
| --------- | ---------------- |
| Econômico | IDs territoriais |
| Cadastro  | strings livres   |

Isso é exatamente o tipo de "realidade paralela" que as normas proíbem.

## Indício forte de futura hierarquia World/Geo

A peça mais importante: `worldService.getCityFullPath()`. Sugere modelo hierárquico territorial:

```
country
  └── state
        └── city
              └── district
                    └── tenant
```

Mas: não está consolidado, não está normatizado, não virou SSOT.

## Conflito aberto: região administrativa vs região econômica

O código usa `stateId como regionId`. Significa que:
- a semântica ainda não foi decidida
- "região" ainda não foi constitucionalizada
- existe débito ontológico

Estado político ≠ região econômica ≠ região logística ≠ região cultural.

## Resposta filosófica das normas

A resposta está escondida no próprio SSOT:

> "Nenhuma camada pode criar realidade paralela."

E:
- filtros regionais já afetam economia
- readiness depende de cidade
- elegibilidade depende de região
- fundos regionais existem

Logo: geografia NÃO é atributo decorativo. Ela já é operacional, econômica, causal, distributiva.

Tratá-la como `state: string`, `city: string` é estruturalmente frágil.

## O achado mais importante

O sistema já parece estar caminhando para um WORLD / TERRITORIAL CORE com:
- IDs territoriais
- hierarquia
- resolução semântica
- territorialidade econômica

MAS o cadastro ainda está preso no modelo CRUD clássico:

```json
{
  "city": "Curitiba",
  "state": "PR"
}
```

Sistema literalmente no meio de uma transição ontológica sem perceber. Isso explica a sensação de "tem algo errado em colocar state TEXT". Tem mesmo. Porque o resto do sistema já começou a tratar território como entidade sistêmica.
