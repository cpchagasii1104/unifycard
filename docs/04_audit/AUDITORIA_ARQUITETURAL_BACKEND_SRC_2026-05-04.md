# Auditoria Arquitetural Backend SRC - 2026-05-04

## Escopo

Auditoria read-only da arquitetura em `backend/src`, focada apenas em estrutura, dependencias internas e sinais de acoplamento. Nenhum arquivo de codigo foi movido, renomeado ou editado durante o diagnostico.

O objetivo foi responder:

- Como `core/`, `modules/`, `services/` e pastas raiz se relacionam hoje.
- Onde existem redundancias estruturais reais.
- Onde ha violacao de fronteira arquitetural.
- Quais areas devem ser corrigidas antes de novas features/dados.

## Contexto decisivo

O sistema ainda esta vazio: sem usuarios, sem dados reais e sem producao. Isso muda a estrategia.

Em um sistema vivo, a recomendacao seria remediacao lenta, faseada e conservadora. Aqui, a janela correta e outra: fechar o diagnostico e executar a correcao arquitetural agora, antes de cadastrar dados e antes de ampliar funcionalidades.

## Resumo executivo

O problema principal nao e "pastas duplicadas". As duplicidades sao sintomas de uma arquitetura ainda nao estabilizada.

Achados centrais:

1. `core/` nao e dominio puro hoje.
2. Existem 58 imports de `core/*` para `modules/*`.
3. Ha pelo menos um par homonimo com acoplamento bidirecional: `core/events` <-> `modules/events`.
4. `core/` contem SQL bruto, rotas Fastify, modulos runtime e repositorios.
5. `modules/social/actor.repository.ts` e a engine real de actor, mas WRITE runtime fora do writer canonico nao foi confirmado.
6. `src/scripts/` entra no build TypeScript e aparece em `dist/scripts`.
7. Varios grupos tem pastas com zero importadores externos de producao, bons candidatos a revisao/remocao.

Veredito: a separacao `core/` vs `modules/` colapsou conceitualmente. Antes de mover pastas, e preciso decidir se `core/` sera repurificado, renomeado para uma camada de plataforma/shared, ou absorvido em uma organizacao por dominio unico.

## Numeros principais

Recorte de producao usado na auditoria:

- Arquivos `.ts` de producao analisados: 1591
- Arquivos de teste: 18
- Arquivos em `src/scripts`: 79
- Excluidos do recorte runtime: `__tests__`, `*.spec.ts`, `*.test.ts`, `src/scripts`

Core vs modules:

- Imports `core/* -> modules/*`: 58
- Arquivos em `core/` com inversoes: 32
- Pares bidirecionais homonimos: `events`
- Sinais de impureza em `core/`: 681 ocorrencias em 250 arquivos

Observacao: os sinais de impureza incluem algum ruido de regex, mas o padrao geral e forte e consistente: `core/` contem SQL, HTTP runtime e repositorios.

## Achado A - Identity

### Estado atual

`modules/identity/actor-writer.service.ts` e o writer canonico esperado:

- `ensureUserActor`
- `ensurePageActor`
- Delegacao para `repo.findOrCreateUserActor`
- Delegacao para `repo.findOrCreatePageActor`

`modules/social/actor.repository.ts` e a engine real de actor:

- Faz `INSERT INTO actors`
- Expoe `findOrCreateUserActor`
- Expoe `findOrCreatePageActor`

### Resultado do corte final

Importadores diretos de `modules/social/actor.repository.ts`:

- Total: 22
- Runtime de producao, excluindo scripts/testes: 17
- Scripts: 5

Classificacao:

- WRITE runtime fora do writer: 0
- READ/TYPE_ONLY runtime fora do writer: 17
- WRITE em scripts: 4 arquivos

### Interpretacao

Nao ha evidencia de criacao paralela de actor em runtime de producao. Isso evita uma PARADA.

Mas ha dois debitos reais:

- D-IDENTITY-1: `src/scripts/` entra no build e aparece em `dist/scripts`.
- D-IDENTITY-2: 17 arquivos fazem READ direto em `modules/social/actor.repository.ts`, vazando a fronteira de identity/social.

### Recomendacao

1. Excluir ou segregar `src/scripts/` do build de producao.
2. Criar um read-port/read-service canonico para actor.
3. Migrar os 17 importadores READ para esse port.
4. Depois disso, decidir se a engine real de actor fica em `modules/social` como implementacao privada ou se sera movida para `modules/identity/internal`.

Nao mover agora sem antes criar a fronteira publica correta.

## Achado B - Core vs Modules

### Evidencia

Foram encontrados 58 imports de `core/*` para `modules/*`.

Exemplos fortes:

- `core/actors/actor.helpers.ts -> modules/identity/actor-writer.service`
- `core/checkout/event-organizer-resolver.ts -> modules/social/actor.repository`
- `core/checkout/checkout.routes.ts -> modules/events/*`
- `core/economy/account.service.ts -> modules/bank/*`
- `core/economy/transaction.service.ts -> modules/bank/*`
- `core/events/event-economy.service.ts -> modules/bank`
- `core/events/event-payment-execution.service.ts -> modules/bank`
- `core/intent/intent-execute.routes.ts -> modules/marketplace/*`
- `core/sagas/* -> modules/orders / modules/bank`
- `core/unifybank/* -> modules/bank / modules/identity / modules/risk-identity`

### Interpretacao

Se a regra desejada for "`core/` e dominio puro e nunca depende de `modules/`", ela esta quebrada.

Na pratica, `core/` hoje funciona como uma mistura de:

- dominio compartilhado
- plataforma runtime
- rotas HTTP
- repositorios SQL
- orquestradores
- servicos de negocio
- codigo legado

### Recomendacao

Antes de qualquer reorganizacao, escolher uma das tres estrategias:

1. Repurificar `core/`
   - `core/` vira dominio/ports/contratos.
   - HTTP, SQL, repositorios e adapters saem de `core/`.
   - Mais correto arquiteturalmente, mais trabalho.

2. Renomear `core/` para `platform/` ou `shared/`
   - Aceita a realidade atual.
   - Menos movimento inicial.
   - Perde a promessa de dominio puro.

3. Organizar por dominio unico
   - Fundir a ideia de `core/` e `modules/` em dominios verticais.
   - Mais agressivo.
   - Pode ser adequado porque o sistema ainda esta vazio.

Veredito recomendado: decidir explicitamente antes de mover arquivos.

## Achado C - Events

### Estrutura viva

- `services/events`: 2 arquivos, 0 importadores externos
- `core/events`: 40 arquivos, 57 importadores externos
- `modules/events`: 44 arquivos, 7 importadores externos

### Cross-links

- `services/events -> modules/events`
- `core/events -> modules/events`
- `modules/events -> core/events`

### Interpretacao

`events` e o caso mais claro de tres camadas sobrepostas. Tambem e o unico par homonimo com acoplamento bidirecional confirmado entre `core/events` e `modules/events`.

### Recomendacao

Tratar `events` como primeiro dominio apos Identity/Core decision.

Possivel ordem:

1. Remover ou migrar `services/events`, se confirmado que nao e registrado por mecanismo indireto.
2. Quebrar o ciclo `core/events <-> modules/events`.
3. Definir se `core/events` e dominio/contrato e `modules/events` e adapter, ou se tudo vira dominio unico.

## Achado D - Financeiro

### Estrutura viva

- `modules/bank`: 35 arquivos, 38 importadores externos
- `core/bank`: 9 arquivos, 14 importadores externos
- `core/economy`: 23 arquivos, 10 importadores externos
- `core/unifybank`: 15 arquivos, 0 importadores externos diretos como pasta
- `modules/payments`: 13 arquivos, 8 importadores externos
- `modules/payout`: 5 arquivos, 0 importadores externos
- `modules/payouts`: 1 arquivo, usado por `workers/payout-worker`
- `modules/treasury`: 3 arquivos, 4 importadores externos
- `modules/treasury-split`: 2 arquivos, 1 importador externo

### Cross-links relevantes

- `modules/bank -> core/bank`
- `core/economy -> modules/bank`
- `core/unifybank -> modules/bank`
- `modules/treasury-split -> modules/treasury`
- `modules/treasury-split -> modules/bank`

### Interpretacao

`modules/bank` e o centro vivo do financeiro. `core/economy` e `core/unifybank` dependem de `modules/bank`, o que reforca a inversao `core -> modules`.

`modules/payout` singular parece suspeito: zero importadores externos. `modules/payouts` plural e pequeno, mas e usado por worker.

### Recomendacao

Financeiro precisa de decisao propria:

- Definir SSOT financeiro real.
- Preservar `modules/bank` se ele e a engine viva.
- Revisar `core/economy` e `core/unifybank` como candidatos a migracao/renomeacao.
- Auditar `payout` vs `payouts` antes de consolidar.

## Achado E - Social e Comunicacao

### Estrutura viva

- `modules/social`: 55 arquivos, 22 importadores externos
- `core/social`: 10 arquivos, 27 importadores externos
- `modules/social-actions`: 7 arquivos, 6 importadores externos
- `modules/social-chat`: 7 arquivos, 1 importador externo
- `modules/live-chat`: 9 arquivos, 0 importadores externos
- `modules/inbox`: 6 arquivos, 1 importador externo

### Cross-links

- `modules/social -> modules/social-actions`
- `modules/social -> core/social`
- `modules/social-chat -> modules/social-actions`
- `modules/live-chat -> modules/social`
- `modules/inbox -> modules/social`

### Interpretacao

`modules/social` e hub vivo. Comunicacao esta fragmentada, mas nao totalmente morta.

`modules/live-chat` tem zero importadores externos; pode ser modulo nao registrado, legado ou feature desconectada.

### Recomendacao

Nao fundir tudo automaticamente. Primeiro separar:

- social graph / actors
- chat/mensageria
- inbox/projecao
- actions/interacoes

Depois decidir se `live-chat`, `social-chat` e `inbox` viram subdominios de comunicacao.

## Achado F - Work

### Estrutura viva

- `modules/work`: 22 arquivos, 8 importadores externos
- `modules/work-instant`: 12 arquivos, 1 importador externo

### Cross-links

- `modules/work -> modules/work-instant`
- `modules/work-instant -> modules/work`

### Interpretacao

`work` e `work-instant` sao bidirecionais. Isso indica dominio unico partido em duas pastas, nao duas fronteiras independentes.

### Recomendacao

Consolidar conceitualmente como um unico dominio `work`, mantendo `instant` como subdominio interno se a feature for preservada.

## Achado G - Risk

### Estrutura viva

- `modules/risk`: usado por `workers/risk-analysis-worker`
- `modules/risk-command-center`: 0 importadores externos
- `modules/risk-identity`: 8 importadores externos

### Interpretacao

`risk-identity` e vivo e conectado com authority, bank, social/work payment e workers.

`risk-command-center` parece candidato a revisao por desconexao.

### Recomendacao

Preservar `risk-identity`. Auditar `risk-command-center` antes de remover.

## Achado H - Orders

### Estrutura viva

- `modules/orders`: usado por `core/sagas` e `workers/saga-timeout-worker`
- `modules/my-orders`: 0 importadores externos

### Interpretacao

`modules/orders` e vivo como suporte de saga. `modules/my-orders` parece orfao ou nao registrado.

### Recomendacao

Auditar se `my-orders` e API nao registrada. Se nao houver registro indireto, candidato a remocao ou recriacao futura como read model.

## Achado I - Reporting

### Estrutura viva

- `modules/reporting`: 1 importador externo
- `modules/reports`: 1 importador externo
- `core/reporting`: 0 importadores externos

### Interpretacao

Tres ilhas com baixo acoplamento. Isso sugere duplicacao historica, nao separacao madura.

### Recomendacao

Escolher um unico nome canonico depois da decisao `core/modules`. Provavel alvo: um dominio `reporting` unico.

## Achado J - Pastas raiz vs core

### Estrutura viva

- `plugins` raiz: vivo, importado por `app.builder.ts` e `server-TESTE.ts`
- `utils` raiz: vivo
- `config` raiz: vivo via `utils`

### Suspeitos

- `jobs`: 0 importadores externos
- `core/jobs`: 0 importadores externos
- `core/plugins`: 0 importadores externos
- `core/utils`: 0 importadores externos

### Interpretacao

As pastas raiz nao sao todas legado. `plugins`, `utils` e `config` tem uso real.

O problema maior esta nos pares raiz/core com funcoes parecidas e baixa importacao.

## Candidatos a remocao/revisao

Nao remover sem confirmar registro indireto em app builder, rotas dinamicas ou workers.

Alta prioridade de revisao:

- `services/events`
- `modules/my-orders`
- `modules/payout`
- `modules/risk-command-center`
- `core/reporting`
- `jobs`
- `core/jobs`
- `core/plugins`
- `core/utils`
- `modules/live-chat`

Candidatos pontuais indicados por zero importadores:

- `modules/payments/payment-link.routes.ts`
- `modules/payments/pix.routes.ts`
- `modules/treasury/treasury-account.controller.ts`
- `modules/social/reputation.service.ts`
- `modules/social/social-action-tracking.service.ts`
- `modules/social/social-groups-light.routes.ts`
- `modules/social/social-relationships.routes.ts`
- `modules/social/social-targeting.service.ts`
- `modules/work/work.events.ts`
- `modules/reports/reports.routes.ts`
- `core/config/env-validation.ts`
- `core/config/feature-flags.service.ts`

## Decisao arquitetural pendente

Antes de executar movimentos, escolher uma direcao:

### Opcao A - Repurificar core

`core/` deve conter:

- contratos
- tipos canonicos
- ports
- regras puras
- politicas de dominio

Nao deve conter:

- Fastify routes
- SQL bruto
- repositorios concretos
- imports de `modules/*`
- workers

Vantagem: arquitetura mais limpa.

Custo: alto, exige remediar 58 inversoes e separar SQL/HTTP.

### Opcao B - Renomear core para platform/shared

Aceita que `core/` e uma camada de runtime/plataforma compartilhada.

Vantagem: menor custo inicial.

Custo: abandona a promessa de dominio puro e precisa documentar isso claramente.

### Opcao C - Dominio unico

Organizar por dominios verticais e dissolver a separacao `core/modules`.

Vantagem: pode simplificar muito enquanto o sistema esta vazio.

Custo: maior refactor estrutural, mas janela atual favorece isso.

## Recomendacao final

Como o sistema esta vazio, a recomendacao e corrigir arquitetura agora, antes de dados e usuarios.

Ordem sugerida:

1. Decidir entre A, B ou C.
2. Corrigir build: tirar `src/scripts` do build de producao.
3. Fechar Identity:
   - criar read-port de actor
   - migrar READs diretos
   - manter writer canonico como unica fronteira WRITE
4. Resolver `events`:
   - remover/migrar `services/events`
   - quebrar ciclo `core/events <-> modules/events`
5. Resolver financeiro:
   - consolidar SSOT bank/economy/unifybank
   - revisar `payout` vs `payouts`
6. Consolidar dominios fragmentados:
   - work/work-instant
   - reporting/reports/core-reporting
   - social/chat/inbox/live-chat
7. Remover codigo morto confirmado.
8. So entao reorganizar pastas em massa.

## Status

Auditoria concluida para `backend/src`.

Proximo passo recomendado: decisao arquitetural explicita sobre `core/` antes de qualquer movimento.

