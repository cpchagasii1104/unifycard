# F3-S2 — Reconciliação (ChatGPT)

**Data:** 2026-05-08
**Sessão:** F3-S2
**Origem:** ChatGPT (releitura do diagnóstico após relatório arqueológico do Codex)

## O que mudou no diagnóstico

O Location Core EXISTE materialmente. Só que:
- parcialmente
- fora de sync
- com migrations não aplicadas
- e com código tentando operar em múltiplas versões de schema ao mesmo tempo

Isso é MUITO diferente de "nunca existiu".

Cenário real:

| Camada       | Estado                       |
| ------------ | ---------------------------- |
| Código       | avançado                     |
| Contratos    | existem                      |
| Repositories | existem                      |
| Endpoints    | existem                      |
| Banco        | parcialmente materializado   |
| Migrations   | incompletas / não executadas |
| Runtime      | híbrido                      |
| Semântica    | inconsistente                |

Isso explica perfeitamente:
- `countries.active`
- `name_display`
- fallbacks
- `COALESCE`
- comentários defensivos
- queries híbridas
- "minimal installations"

## Diagnóstico correto

Não é: "precisamos inventar um Location Core"

É: "precisamos estabilizar e consolidar um Location Core já iniciado"

Isso reduz MUITO o risco. Porque:
- a direção arquitetural já foi escolhida no passado
- vocês não estão inventando paradigma novo
- estão resgatando consistência

## Pontos consolidados

### CEP já foi corretamente tratado como UX

O comentário "CEP é UX, não fonte de verdade" é ouro arquitetural. Sistemas grandes operam exatamente assim.

Fluxo correto:
```
CEP → resolução → IDs territoriais → persistência canônica
```

NÃO:
```
CEP → salvar texto livre → inferir região depois
```

### Sistema já tinha desenho territorial maduro

Vocês já tinham:
- countries
- states
- cities
- neighborhoods
- location.repository
- enrichment
- normalização
- region-account
- city readiness
- world service

O núcleo já havia sido concebido. Problema não era visão. Era sincronização/runtime/materialização.

### Problema central: governança de schema

```
migration existe
↓
não roda
↓
código assume que rodou
↓
fallback improvisado
↓
runtime híbrido
↓
módulos divergem
```

Problema clássico de drift entre migrations e runtime, não de ontologia inexistente.

### Location Core deve virar domínio protegido

Não pode mais ser "infra opcional". Não pode depender de "minimal installations". Não pode existir parcialmente.

Porque bank, groups, marketplace, rides, region funds dependem.

**Location Core agora é infraestrutura soberana.** Mesmo nível de Identity, Authority, Ledger.

### Insight mais importante

Sistema já escolheu implicitamente o modelo correto: **território por IDs**, NÃO território por strings livres.

O runtime híbrido mascarou isso. Mas arquiteturalmente a decisão já havia sido tomada.

## Direção prática

### NÃO fazer

- adicionar `companies.city TEXT`
- expandir JSONB territorial
- criar mais snapshots livres
- permitir novos writers territoriais

### FAZER

- estabilizar Location Core existente
- reconciliar migrations
- definir schema final real
- materializar world tables corretamente
- definir contratos obrigatórios
- migrar módulos progressivamente

## Leitura final

Não foi descoberto "um problema novo". Foi descoberto:

> um domínio fundacional parcialmente enterrado pelo Genesis/refatoração.

Notícia muito melhor do que começar do zero. Porque significa:
- o pensamento arquitetural correto já existia
- só perdeu consistência operacional ao longo do tempo

Trabalho deixa de ser "inventar arquitetura" e vira "reconciliar arquitetura com runtime". Muito mais seguro, mais rápido, menos arriscado.
