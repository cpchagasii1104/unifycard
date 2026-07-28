# Plano de recuperação do UnifiCard

## 🔒 Protocolo de reancoragem — LER ISTO PRIMEIRO, sempre, antes de qualquer outra coisa

Se você (IA) está lendo este documento após uma compactação de contexto, no início de uma sessão nova, ou só para retomar o trabalho, siga esta ordem antes de fazer qualquer análise nova:

0. **Se existe o Anexo C (Consolidação), ele é a fonte de verdade priorizada — leia-o PRIMEIRO.** A varredura sequencial (Rodadas 0-10) foi ENCERRADA em 2026-07-20 e consolidada no Anexo C (registro único de achados FIND-NNN, causas-raiz ROOT-NNN, matriz de cobertura, filas, ranking, pacotes de handoff AUDIT-001..006). A fase atual NÃO é mais "próximo item da varredura" — é "abrir um pacote de handoff de auditoria profunda read-only", escolhido por Clayton. As Rodadas 0-10 abaixo são o material bruto de origem; o Anexo C é o índice priorizado. Não recomece a varredura sequencial sem Clayton pedir.
1. (Histórico, se ainda em varredura) Vá para **"Rodada 0 — detalhe por item"** (dentro do Anexo B) e leia a tabela de checklist.
2. NÃO refaça achados já registrados nas seções anteriores (Anexo A, itens já concluídos da Rodada 0). Trate-os como verdade estabelecida — a menos que o código tenha mudado desde então (aí sim, reverifique).
3. Trabalhe **um item por vez**, não uma rodada inteira. Uma resposta = um item da lista. Isso não é preguiça, é o método: quando tentamos fechar `/api/events` inteiro de uma vez (Anexo A), só ficou confiável porque foi feito arquivo por arquivo — tentar tudo de uma tacada só produz achado por aparência, não por prova.
4. Ao terminar um item: registre o achado **só neste documento** (não em memória externa, não em outro arquivo), marque o item como concluído na tabela de checklist, e **PARE** — não avance para o próximo item sozinha.
5. A palavra-gatilho do Clayton para avançar é **"próximo"**. Só quando ele disser isso você segue para o próximo item da sequência — nunca pule itens, nunca pule rodadas, nunca antecipe.
6. Se um achado tocar autoridade, dinheiro, identidade, concorrência ou SSOT, classifique como candidato a `AUDITORIA PROFUNDA` (ver Anexo B.2) e não tente resolvê-lo ou aprofundá-lo sozinha dentro desta varredura — só mapeie e siga.
7. Esta fase é levantamento, não remediação. Nunca corrija código, nunca abra migration, nunca feche/reative feature flag nesta passagem — só leia e classifique.
8. **Antes de abrir um item, declare seu denominador** (objetivo, universo a cobrir, método de descoberta, critério de conclusão, fora do escopo) — ver B.6. Ao terminar, diga explicitamente se o denominador foi fechado ou não.
9. **Todo achado leva um grau de confiança** (`PROVADO` / `FORTEMENTE INDICADO` / `SUSPEITO` / `NÃO AUDITADO` / `REFUTADO`) — não deixe uma leitura estática virar alegação sobre efeito em runtime sem dizer que essa parte não foi auditada. Ver B.7.
10. **Trava de risco crítico vivo:** se um achado demonstrar risco crítico, vivo e explorável envolvendo dinheiro, autoridade, identidade, vazamento sensível ou corrupção de estado — PARE a varredura e reporte para Clayton decidir contenção emergencial vs. continuidade, antes de seguir para o próximo item. Isso não autoriza correção solo. Ver B.8.
11. **Escalonamento de modelo:** se o achado exigir julgar dois SSOTs plausíveis, autoridade indireta, múltiplos writers, transação distribuída, concorrência, reversão, RLS, cálculo financeiro, conflito normativo, ou mais de duas interpretações plausíveis — pare, registre o pacote, e sinalize que aquele ponto pede um modelo mais avançado (Opus/Fable) em vez de forçar julgamento com Sonnet. Ver B.9.
12. **Registre o HEAD do commit no início de cada item** (não precisa ser por achado individual). Se o HEAD mudar entre sessões, achados de itens concluídos antes do novo HEAD tocar os mesmos arquivos devem ser marcados `STALE` e reverificados, não assumidos.

---

O sistema **não deve continuar pela estratégia de “pegar a próxima DT aberta”**. Isso mantém o projeto reativo.

A nova estratégia será:

> **Reconstruir a verdade atual → mapear os eixos soberanos → verificar as comunicações entre eles → reduzir a superfície viva → somente então corrigir famílias de causas-raiz.**

A frente de autoridade empresarial terminou selada, com runner 200/200, gates financeiros reconciliados, `Δbank=0` e PORTA 01 fechada. Isso é uma base positiva, mas não prova a saúde do restante do sistema. 

## Diagnóstico inicial

Os arquivos atualizados mostram quatro problemas sistêmicos.

### 1. O cartório virou memória, não painel executivo

O `REMEDIATION_DT_LOG` preserva corretamente o histórico, mas mistura:

* estados atuais;
* estados superados;
* reprovações;
* remediações;
* selos;
* observações futuras;
* DTs abertas, congeladas e parcialmente corrigidas.

Por ser append-only, a mesma frente aparece várias vezes com estados diferentes. Isso é bom para auditoria histórica, mas ruim para dirigir o projeto diariamente.

O `dividatecnica.md` também ainda carrega uma estratégia anterior de lotes, ao mesmo tempo que recebe atualizações recentes. Portanto, ele deve continuar como evidência e rastreador, mas **não deve ser automaticamente considerado o novo plano mestre**.

### 2. O runtime está amplo demais

O bootstrap atual registra muitas superfícies simultaneamente. Há, por exemplo:

* feed contextual e feed legado;
* três conjuntos relacionados a eventos sob `/api/events`;
* o mesmo `unifybankModule` registrado sob `/bank` e `/admin`;
* módulos de ledger, payout, invoicing, reporting, risk e policy registrados no mesmo processo;
* comentários no próprio código admitindo possíveis conflitos de rotas.

Isso não significa que todos estejam quebrados. Significa que **o universo vivo ainda não está claramente delimitado**.

### 3. Ainda existem fronteiras estruturais abertas

Duas delas já aparecem explicitamente nos arquivos:

* partes de `core/unifybank`, donation e governança regional ainda acessam `bank_*` diretamente;
* o perfil de migrations possui itens ignorados e existe divergência entre objetos presentes no banco de desenvolvimento e o registry de migrations.

Essas duas famílias são mais importantes do que dezenas de bugs de interface, porque afetam a confiabilidade das provas.

### 4. Alguns agregados não são entradas confiáveis

O arquivo consolidado de decisões começa com saída de terminal, prompts repetidos e conteúdo de sessões. Ele serve para busca arqueológica, mas não deve ser entregue integralmente à auditora como se fosse um corpus decisório limpo. 

A futura IA deve localizar e ler as decisões individuais relevantes.

---

# Objetivo do programa

Não será “zerar todas as DTs”.

O sistema será considerado novamente **no trilho** quando:

1. houver um estado executivo atual derivável sem interpretação manual;
2. existir apenas uma frente material ativa;
3. todos os módulos vivos, rotas e workers estiverem inventariados;
4. cada verdade tiver SSOT, writers e readers conhecidos;
5. os contratos entre eixos estiverem explícitos;
6. fresh install, upgrade e banco de desenvolvimento estiverem reconciliados;
7. o runner realmente executar todos os gates críticos;
8. as principais jornadas transversais forem reproduzíveis;
9. cada nova frente reduzir mais complexidade do que acrescenta.

A regra de fundo continua sendo a da Lei de Coerência:

> pilares definem suas lógicas; SSOTs decidem o estado; módulos compõem; navegação apenas organiza. 

---

# Programa em seis fases

## Fase 0 — STOP e fotografia imutável

Antes de qualquer correção:

* congelar novas frentes materiais;
* registrar HEAD, branch e working tree;
* registrar versões de Node, PostgreSQL e dependências;
* exportar lista real de migrations;
* comparar migrations do disco, registry e objetos físicos;
* executar runner, typecheck e gates financeiros;
* inventariar rotas, workers, jobs e módulos efetivamente carregados;
* capturar estado do Bank sem movimentar dinheiro;
* manter PORTA 01 fechada.

**Saída:** `SYSTEM_BASELINE_YYYY-MM-DD`.

Essa fase não decide arquitetura e não corrige nada. Ela apenas impede que a auditoria analise um alvo em movimento.

## Fase 1 — Recuperar a auditabilidade

Criar uma projeção limpa, derivada dos documentos existentes:

```text
CURRENT_SYSTEM_STATE.json
FRONTS_CURRENT_STATE.json
DT_CURRENT_STATE.json
DECISIONS_CURRENT_INDEX.json
MIGRATION_STATE.json
RUNNER_MANIFEST.json
RUNTIME_SURFACE.json
```

Cada frente terá somente um estado atual:

* `SEALED`
* `ACTIVE`
* `BLOCKED`
* `DORMANT`
* `CONTAINED`
* `SUPERSEDED`
* `OPEN_DECISION`
* `OPEN_MATERIAL`

O cartório histórico continua intocado. A nova estrutura será um **read model descartável do cartório**, não uma segunda fonte soberana.

Aqui também será criado o manifesto real do runner:

```text
gate
arquivo
família de risco
está no runner?
negative proof?
mutation?
E2E?
última reprodução
```

Isso impede outro caso de “runner verde” que não continha um gate crítico.

## Fase 2 — Auditoria dos substratos soberanos

Uma única instância avançada começa a auditoria, eixo por eixo.

A ordem será:

1. **Identity**
2. **Actor**
3. **Authority**
4. **Time**
5. **State e Event**
6. **Money e Fiscal**
7. **Resource e Inventory**
8. **Territory**
9. **Coordination**
10. **Publication e Projection**
11. **CONCEPT, TREE, CONTEXT e INTENT**

O protocolo já exige bootstrap mínimo, domínio declarado, leitura modular e prova de suficiência; a auditora deve seguir isso, em vez de carregar toda a normativa de uma vez. 

Para cada eixo será produzida uma ficha:

```text
Verdade governada
SSOT
Schema material
Writer ou writers autorizados
Readers autorizados
Read models
Vocabulário
Lifecycle
Invariantes
Transações e locks
Eventos emitidos
Dependências recebidas
Dependências fornecidas
Superfícies paralelas
Achados comprovados
Itens ainda não auditados
```

O SSOT decide; módulos e projeções não podem corrigir ou reinterpretar sua verdade. 

## Fase 3 — Auditoria das comunicações entre eixos

Depois de auditar internamente cada eixo, a instância verificará as setas entre eles.

Exemplos:

```text
Identity → Actor
Actor → Authority
Authority → State mutation
Time → Authority/lifecycle
State → Money obligation
Territory → Economic policy
Economic policy → Bank
Bank → Event/audit
CONCEPT → Product projection
TREE/CONTEXT → Navigation only
```

Cada seta terá um contrato:

* quem produz;
* quem consome;
* quais dados atravessam;
* quem toma a decisão;
* se exige snapshot;
* se exige mesma transação;
* o que acontece em falha;
* o que é proibido transportar.

Exemplo:

```text
Territory → Economic
Pode entregar: jurisdiction resolvida e versionada.
Não pode entregar: percentual financeiro ou instrução de ledger.
```

```text
Economic → Bank
Pode entregar: instrução econômica resolvida e reconciliável.
Não pode entregar: SQL, saldo calculado ou decisão territorial improvisada.
```

Essa fase encontrará os defeitos que auditorias isoladas não encontram: duas partes corretas internamente, mas conectadas de forma errada.

## Fase 4 — Auditoria da topologia viva

Essa será uma frente própria, porque o `app.builder.ts` indica um problema potencial de alcance e composição.

A auditora classificará toda superfície registrada:

* `CANONICAL_LIVE`
* `LEGACY_LIVE`
* `DORMANT_REGISTERED`
* `CONTAINED`
* `GHOST`
* `DUPLICATE`
* `ADMIN_ONLY`
* `TEST_ONLY`
* `UNREACHABLE`
* `UNKNOWN`

Ela verificará:

* rotas duplicadas ou sobrepostas;
* módulos registrados em mais de um prefixo;
* `try/catch` que transforma falha estrutural em boot parcial;
* workers que iniciam sem gate;
* feature flag tratada como autoridade;
* módulos dormentes registrados como se fossem vivos;
* caminhos legados que ainda alcançam writers;
* código morto protegido apenas por comentário;
* rotas 410/501 realmente inacessíveis aos writers;
* fronteiras `core` versus `modules`.

O resultado esperado não é “corrigir tudo”, mas definir o **runtime mínimo legítimo**.

## Fase 5 — Migrations, banco e provas

O agregado atual chega à série de migrations de 19 de julho, incluindo catálogo de permissões e proteção de isolamento para exclusividade membership×delegação. 

A auditoria deverá reconciliar quatro estados:

```text
Arquivos de migration
Registry schema_migrations
Objetos físicos do banco
Modelo esperado pelas aplicações
```

Serão testados:

* instalação fresh;
* upgrade desde baseline escolhido;
* no-op posterior;
* migrations ignoradas;
* migrations latentes;
* objetos sem registry;
* registry sem objeto;
* checksum divergente;
* comportamento sob rollback;
* banco efêmero versus desenvolvimento;
* funções e triggers substituídos por migrations posteriores.

Nenhum trabalho de produto deve continuar enquanto o banco de desenvolvimento não puder ser explicado de forma determinística.

## Fase 6 — Jornadas transversais e plano material

Somente após as cinco fases anteriores serão escolhidas jornadas.

Primeiras jornadas recomendadas:

### Jornada A — Pessoa e empresa

```text
Identity → Actor PF → criação de empresa → Actor page
→ gestor inicial → convite → aceite → grants
→ publicação em nome da empresa
```

Testa identidade, Actor, autoridade, lifecycle, evento e projeção.

### Jornada B — Serviço sem dinheiro

```text
prestador publica serviço → cliente manifesta intenção
→ disponibilidade → compromisso → confirmação
→ conclusão → projeção
```

Testa semântica, recurso, tempo, authority, state e coordination sem abrir o Bank.

### Jornada C — composição econômica dormente

```text
operação comercial simulada
→ policy econômica
→ território
→ fiscal provision
→ instrução Bank
→ rollback integral
```

Executada somente em banco efêmero, mantendo PORTA 01 fechada.

### Jornada D — reversão

```text
estado confirmado → obrigação econômica → lançamento simulado
→ reversão total → eventos → projeção
```

Testa idempotência, atomicidade, snapshots e não recomputação.

---

# Como as correções serão organizadas

Os achados não virarão centenas de novas frentes.

Eles serão agrupados em cinco classes:

| Classe     | Tratamento                                                |
| ---------- | --------------------------------------------------------- |
| `REMOVE`   | Caminho paralelo, legado ou sem necessidade               |
| `CONVERGE` | Duas casas respondendo à mesma pergunta                   |
| `HARDEN`   | Casa correta com falha de segurança ou atomicidade        |
| `PROVE`    | Desenho parece correto, mas falta prova reproduzível      |
| `DECIDE`   | Existe questão institucional que só Clayton pode resolver |

A prioridade será calculada por:

```text
alcance vivo
× transversalidade
× risco de autoridade/dinheiro
× ausência de contenção
× quantidade de dependentes
```

Não por antiguidade da DT nem facilidade de implementação.

---

# Regras para não voltar ao ciclo

1. **Uma única frente material por vez.**
2. **Primeira instância descobre; segunda tenta falsificar.**
3. Paralelismo somente após o denominador estar fechado.
4. A executora nunca sela o próprio trabalho.
5. Segunda remediação da mesma família invalida o Gate original: volta-se ao Gate.
6. Uma frente não pode criar mais writers, vocabulários ou caminhos vivos do que elimina.
7. “Dormente” precisa ser provado por reachability, não declarado em comentário.
8. Guard só conta quando está no runner canônico.
9. Teste só conta quando parte de estado reproduzível.
10. Relatório precisa registrar tanto o que foi provado quanto o que não foi examinado.

---

# Primeiro ato recomendado

O próximo ato não é corrigir `DT-UNIFYBANK`, migrations ou o bootstrap.

É abrir:

> **GATE GLOBAL READ-ONLY — AUDITABILIDADE, TOPOLOGIA VIVA E MAPA DOS SUBSTRATOS SOBERANOS**

Executado por uma única instância avançada, sem alterações, commits, migrations ou selos.

As entregas obrigatórias serão:

```text
01_BASELINE_VERIFICAVEL.md
02_MAPA_DOS_EIXOS.md
03_CONTRATOS_ENTRE_EIXOS.md
04_TOPOLOGIA_RUNTIME.md
05_ESTADO_DE_MIGRATIONS.md
06_MANIFESTO_REAL_DOS_GATES.md
07_ACHADOS_COMPROVADOS.md
08_ALEGACOES_NAO_REPRODUZIDAS.md
09_PRIORIZACAO_POR_CAUSA_RAIZ.md
10_PLANO_MATERIAL_DE_RECUPERACAO.md
EXECUTIVE_ONE_PAGE.md
```

Esse Gate ainda não declarará o sistema saudável. Ele produzirá o primeiro mapa confiável a partir do qual as correções deixam de ser voltas e passam a ser uma sequência de convergência.

**O plano, portanto, é: parar → tornar auditável → auditar eixos → auditar setas → reduzir runtime → reconciliar banco → provar jornadas → corrigir famílias.**

---

# Anexo A — Topologia viva, rodada 1 (2026-07-20)

Checkpoint conjunto entre duas instâncias de IA (mediado por Clayton) para validar o "Primeiro ato recomendado" (Gate Global Read-Only) antes de abri-lo formalmente. Escopo desta rodada: `unifybankModule` (`/bank`+`/admin`) e o denominador completo de `/api/events`. Nada foi corrigido — só lido e classificado. Handlers de `economic/v2` NÃO foram abertos (decisão explícita de checkpoint — pertencem à onda futura State→Money).

## A.1 — Achados comprovados

1. **Duplicação viva de superfície do UnifyBank.** `core/unifybank/unifybank.module.ts` é registrado 2x em `app.builder.ts` (`/bank` e `/admin`, linhas 510-511). Fastify executa o corpo do plugin por inteiro a cada registro de topo — os comentários internos do módulo ("registradas em X quando prefix=Y") descrevem um comportamento condicional que o Fastify não tem. Resultado: `test-currency`, `bank-http` (`/transactions/simple`, `/transactions/split`), `transparency`, `transparency-admin`, `regional-fund` governance, `user-group-allocation` e 4 rotas de métricas + `bank-balance-consolidation` ficam expostas duas vezes, mesmo handler, sob `/bank/*` e `/admin/*`. Não é colisão de rota (paths finais diferentes) — é aliasing de domínio comprovado. Mitigante: `POST /transactions/simple|split` não move dinheiro mais (DECISION-0128: virou request-only, cria `approval_request`).
2. **Acesso a `bank_*` fora de `modules/bank` é só leitura.** `donation.service.ts`, `regional-fund-governance.service.ts`, `core/reconciliation/reconciliation.service.ts`, `core/reconciliation/financial-reconciliation.ts` e `core/observability/ledger-integrity-monitor.ts` fazem só `SELECT`/`JOIN` em `bank_accounts`/`bank_ledger`/`bank_transactions` — zero escrita. `donation.routes` está desmontada (HOLD, DECISION-0165 Fase 1B); reachability interna completa de `donation.service.ts` não verificada.
3. **Nesting recorrente `/events/events` dentro do prefixo `/api/events`.** Dois arquivos escrevem o segmento `/events` literal no path apesar de já montados sob `/api/events`:
   - `events.routes.ts:776` — `GET '/events/:id/occupancy/stats'` → serve em `/api/events/events/:id/occupancy/stats`. Único caller (`OccupancyDashboard.tsx`) chama `apiFetch('/events/:id/occupancy/stats')` **sem `/api`** (confirmado: `apiFetch` em `client.ts` faz `url = API_BASE_URL + path`, zero normalização) — e esse componente **não tem nenhum importador no frontend**. Classificação: `ORPHANED_REGISTERED_ROUTE` + `DEAD_FRONTEND_CALLER`. Candidato natural a `REMOVE`, não corrigir agora.
   - `event-rfq.routes.ts` (10 endpoints de RFQ, feature flag `FEATURE_RFQ_ENABLED` fail-open — habilitada por padrão) → serve em `/api/events/events/:eventId/rfqs...`. `frontend/src/api/event-rfq.ts` chama `apiFetch('/events/:eventId/rfqs...')`, mesmo bug (sem `/api`). Mas `EventPage.tsx` **importa e renderiza** `EventRFQCreateModal` + `EventRFQQuotesView` — jornada viva. Classificação: **`LIVE_ROUTE_PREFIX_DEFECT` confirmado** — criação/consulta de RFQ indisponível hoje sob config default. Risco financeiro direto: não demonstrado (não foi lido o handler).
4. **Quatro registros paralelos de "criar evento" sob o mesmo prefixo `/api/events`:**
   - `POST /api/events` (raiz — `core/events/event.routes.ts:511`, path literal `'/'`)
   - `POST /api/events/create` (`events.routes.ts:31` — comentário no próprio código diz "endpoint canônico")
   - `POST /api/events/events` (`events-sprint76.routes.ts:61`, nesting)
   - `POST /api/events/v2/create` (`core/events/event.routes.ts:2303`)
   Frontend só chama `/api/events/create` (`api/events.ts`) e `/api/events/v2/create` (`api/events-v2.ts`). As outras duas (raiz `/` e `/events` do sprint76) não têm caller frontend conhecido nesta rodada.
5. **`economic/v2` embutido dentro do domínio de Eventos.** `core/events/event.routes.ts` (3459 linhas) contém, no mesmo arquivo do lifecycle de evento (v1+v2: draft/declare/publish/activate/end/cancel/availability/commitments), um subsistema financeiro completo: `/:eventId/economic/v2/{advance,custody,split,payment/authorize,payment/revoke,payment/execute,refund,chargeback,chargeback/resolve}`. Autorizar/executar/revogar/estornar dinheiro e chargeback está fisicamente no arquivo de rotas de Eventos, não em `modules/bank`. **Handlers NÃO lidos** — localização física é sinal forte de fronteira ruim, não prova de execução financeira indevida (pode delegar corretamente ao Bank). Classificação: `CROSS_AXIS_UNVERIFIED` — candidato prioritário para a onda State→Money.
6. **Disciplina de contenção já praticada pela própria equipe (achado positivo):**
   - `event-lifecycle.routes.ts:95` e `events-sprint76.routes.ts:114-141` — ambos comentaram/removeram manualmente uma rota `/:id/publish` duplicada, citando explicitamente `core/events/event.routes.ts` linhas 391 e 1019 como a canônica. Prova de que colisões já detectadas são resolvidas.
   - `organizers.routes.ts` — todo o cluster de billing/subscription (`/:id/plan`, `/:id/subscribe`, `/:id/subscription`, `/:id/subscription/cancel`, `/:id/subscribe/stripe`, `/webhooks/stripe`) está **CONTIDO deliberadamente**: retorna 501 `ORGANIZER_BILLING_SCHEMA_GHOST_CONTAINED` antes de qualquer service/sink (colunas `event_organizers.plan`/`organizer_subscriptions.*` são schema-ghost — nunca existiram fisicamente); o webhook Stripe virou no-op 200 para não disparar retry storm. Comentário cita DECISION-0113/R8K. Modelo de contenção correto — nada a corrigir.
7. **Duas rotas com kill-switch financeiro sempre-erro, mas ainda registradas e chamadas pelo frontend:** `eventsEconomyRoutes` (`GET /:eventId/economy`) e `eventsClosureRoutes` (`GET /:eventId/closure-summary`) fazem a query real de dados, mas terminam com `throw new Error('LEGACY_FINANCIAL_PATH_DISABLED: ... Financial decision outside Bank is forbidden')` incondicional — sempre 500. `frontend/api/events.ts` ainda chama essas duas rotas esperando 200. Classificação: `CONTAINED` (kill-switch institucional, não bug de nesting) — mas o frontend não foi atualizado para refletir isso; UI provavelmente quebra silenciosamente nesse ponto.

## A.2 — Achados suspeitos (não comprovados)

- `events-sprint76.routes.ts`: `POST/GET /events`, `GET /events/:id`, `POST /events/:id/tickets`, `POST /tickets/:id/{reserve,pay,cancel}`, `POST /checkin/:ticketSaleId`, `POST /checkout/:ticketSaleId` — nenhum caller frontend encontrado. `REGISTERED_PARALLEL_EVENT_SURFACE` + `CALLER_NOT_FOUND` + `INTERNAL_REACHABILITY_UNVERIFIED` (scripts/workers/testes internos não checados).
- `frontend/src/api/presence.ts` (`/presence/rsvp/confirm|cancel`, `/presence/rsvp/:id/visibility`) parece ser um SEGUNDO sistema de RSVP/presença, fora de `/api/events`, não cruzado com `event-rsvp.service`. Não investigado — pode ser domínio diferente (presença social genérica) ou duplicação conceitual.
- `event.routes.ts` e `events-rsvp.routes.ts`/`events-spec.routes.ts` usam `(request as any).tenant_id`/`user_id` (snake_case, cast solto) em vez de `req.tenant.id`/`req.user.id` (padrão no resto do arquivo). Pode indicar middleware/contrato de request diferente nesses três arquivos — não investigado a fundo.

## A.3 — Não auditado nesta rodada

- Autoridade/guard linha-a-linha de cada handler listado (foi feita leitura rasa: presença ou ausência de checagem visível, não verificação de corretude).
- SQL e writers dos grupos RSVP/spec além do que apareceu na leitura direta dos arquivos (não foi perseguido em profundidade).
- Semântica financeira de `economic/v2` (autoridade, atomicidade, idempotência, reversão, se `execute` de fato executa ou só solicita).
- `eventLifecycleRoutes` (POST `/:id/tickets`, `/checkin`, `/:id/consumption`) e `eventRFQRoutes` internos além do path-mismatch já provado — authority/writer não mapeados.
- Reachability interna (scripts/workers/testes) de tudo marcado `CALLER_NOT_FOUND`.

## A.4 — Tabela rasa: RSVP · economy · closure · state-history · organizers

| Grupo | Método + path final | Origem | Guard aparente | Flag/porta | Caller frontend | Reachability | R/W |
|---|---|---|---|---|---|---|---|
| RSVP | `POST /api/events/:id/rsvp` | `events-rsvp.routes.ts` | `tenant_id`/`user_id` via `(request as any)`, sem canViewEvent | nenhuma | `api/event-rsvp.ts` (match exato) | LIVE | write |
| RSVP | `GET /api/events/:id/rsvp/status` | idem | `canViewEvent` | nenhuma | `api/event-rsvp.ts` | LIVE | read |
| RSVP | `GET /api/events/:id/rsvp/counts` | idem | `canViewEvent` | nenhuma | `api/event-rsvp.ts` | LIVE | read |
| RSVP | `DELETE /api/events/:id/rsvp` | idem | só `tenant_id` presente | nenhuma | `api/event-rsvp.ts` | LIVE | write |
| Economy | `GET /api/events/:eventId/economy` | `events-economy.routes.ts` | auth+tenant | nenhuma | `api/events.ts` (espera 200) | **CONTAINED (sempre 500, kill-switch)** | read (nominal) |
| Closure | `GET /api/events/:eventId/closure-summary` | `events-closure.routes.ts` | auth+tenant | nenhuma | `api/events.ts` (espera 200) | **CONTAINED (sempre 500, kill-switch)** | read (nominal) |
| State-history | `GET /api/events/:eventId/state-history` | `events-state-history.routes.ts` | `canViewEvent` | nenhuma | `api/events.ts` (match exato) | LIVE | read |
| EventSpec | `POST /api/events/event-specs` | `events-spec.routes.ts` | `tenant_id` cast | nenhuma | não checado nesta rodada | `CALLER_UNVERIFIED` | write |
| EventSpec | `GET /api/events/event-specs/:specId` | idem | `tenant_id` cast | nenhuma | não checado | `CALLER_UNVERIFIED` | read |
| EventSpec | `PATCH /api/events/event-specs/:specId/incremental` | idem | `tenant_id`+`user_id` cast | nenhuma | não checado | `CALLER_UNVERIFIED` | write |
| EventSpec | `POST /api/events/event-specs/:specId/close` | idem | `tenant_id`+`user_id` cast | nenhuma | não checado | `CALLER_UNVERIFIED` | write |
| EventSpec | `GET /api/events/event-specs` | idem | `tenant_id` cast + `canRepresentActor` se filtrar por actor | nenhuma | não checado | `CALLER_UNVERIFIED` | read |
| Organizers | `POST /api/events/organizers/create` | `organizers.routes.ts` | `resolveRequesterGlobalUserId` (bind real, guard `audit-organizers-actor-authority-bind.mjs`) | nenhuma | não checado nesta rodada | `CALLER_UNVERIFIED` | write |
| Organizers | `POST /api/events/organizers/:id/add-member` | idem | idem | nenhuma | não checado | `CALLER_UNVERIFIED` | write |
| Organizers | `POST /api/events/organizers/link-event/:eventId` | idem | idem | nenhuma | não checado | `CALLER_UNVERIFIED` | write |
| Organizers | `GET /api/events/organizers` | idem | auth+tenant | nenhuma | não checado | `CALLER_UNVERIFIED` | read |
| Organizers | `GET /api/events/organizers/:id` | idem | auth+tenant | nenhuma | não checado | `CALLER_UNVERIFIED` | read |
| Organizers | `GET /api/events/organizers/plans` | idem | auth | nenhuma | `api/events.ts` (match exato) | LIVE | read |
| Organizers | `GET /api/events/organizers/:id/plan` | idem | — | schema-ghost | `api/events.ts` (espera dado real) | **CONTAINED (501 declarado)** | read (nominal) |
| Organizers | `POST /api/events/organizers/:id/subscribe` | idem | — | schema-ghost | `api/events.ts` | **CONTAINED (501 declarado)** | write (nominal) |
| Organizers | `POST /api/events/organizers/:id/subscription/cancel` | idem | — (route original não tinha autoridade nenhuma) | schema-ghost | `api/events.ts` | **CONTAINED (501 declarado)** | write (nominal) |
| Organizers | `GET /api/events/organizers/:id/subscription` | idem | — | schema-ghost | `api/events.ts` | **CONTAINED (501 declarado)** | read (nominal) |
| Organizers | `POST /api/events/organizers/:id/subscribe/stripe` | idem | — | schema-ghost | não checado | **CONTAINED (501 declarado)** | write (nominal) |
| Organizers | `POST /api/events/organizers/webhooks/stripe` | idem | — | schema-ghost | Stripe (externo) | **CONTAINED (no-op 200)** | write (nominal) |

Nota: as linhas `CONTAINED` de organizers são achado positivo (contenção institucional documentada, DECISION-0113/R8K) — não confundir com os `CONTAINED` de economy/closure, que são kill-switch sem aviso claro ao frontend.

## A.5 — Decisão pendente (Clayton)

Denominador de `/api/events` fechado como topologia (rotas + métodos + origem + guard aparente + caller + R/W mapeados; autoridade fina e SQL completo ficam para a onda de eixo). Handlers de `economic/v2` NÃO foram abertos nesta rodada.

Opções para a próxima rodada:
1. Completar a topologia global para outros prefixos (`/bank`, `/companies`, `/marketplace`, etc.) antes de qualquer correção.
2. Corrigir o defeito vivo de RFQ isoladamente (prefix mismatch nos dois lados).
3. Abrir a primeira onda profunda em `economic/v2` (autoridade, atomicidade, idempotência, reversão).
4. Investigar e reduzir primeiro as superfícies paralelas de Eventos (4 criações de evento, sprint76 órfão, economy/closure kill-switch sem aviso ao frontend).

Recomendação registrada (2ª IA): não corrigir ainda; seguir a topologia global por mais alguns entrypoints críticos para descobrir se Eventos é exceção ou padrão sistêmico do resto do runtime. Decisão final é do Clayton.

**Decisão do Clayton (2026-07-20): substituir o método de varredura.** Em vez de continuar por prefixo de rota (`/api/events`, `/bank`, etc.), as próximas rodadas seguem **jornadas causais completas** (frontend → rota → autoridade → service → schema → evento → projeção), na sequência do Anexo B. Cada rodada é pequena, fechada, e termina em checkpoint — nunca abre a próxima sozinha. Ver Anexo B para a metodologia e a fila de rodadas.

---

# Anexo B — Metodologia de varreduras cruzadas por jornada (a partir de 2026-07-20)

Substitui, para as próximas rodadas, a varredura por prefixo de rota usada no Anexo A (que continua válida como precedente/prova de conceito — foi ela que descobriu os achados do Anexo A e mostrou que o método funciona). Daqui em diante, cada rodada é **uma jornada causal completa**, pequena e fechada, não um prefixo de rota inteiro.

## B.1 — Três papéis sequenciais (não misturar numa mesma rodada)

1. **Instância varredora** — percorre uma jornada de ponta a ponta (`frontend → API final → plugins/contexto → autoridade aparente → service → repository → schema → evento/read model → frontend novamente`). Só identifica, classifica e prova alcance. Não corrige.
2. **Instância auditora especializada** — recebe só os achados de uma rodada que tocam identidade, Actor, autoridade, dinheiro, tempo, estado, atomicidade, concorrência, múltiplos writers, SSOT ou migrations. Aprofunda só aquela família.
3. **Instância executora** — recebe só um pacote já decidido (causa-raiz conhecida, escopo positivo/negativo, arquivos permitidos, critério de PASS, provas exigidas). Não pode declarar o próprio selo.

Motivo da separação: evita que quem encontra o problema já molde a leitura para justificar a solução que acabou de imaginar.

## B.2 — Quatro filas de destino para cada achado

| Fila | Quando usar |
|---|---|
| `CORREÇÃO DIRETA` | Defeito localizado, contrato claro, sem decisão institucional, sem tocar eixo soberano |
| `AUDITORIA PROFUNDA` | Autoridade, dinheiro, identidade, lifecycle, concorrência, múltiplos writers ou SSOT incerto |
| `REMOÇÃO/CONTENÇÃO` | Código órfão, ghost, superfície paralela, frontend chamando rota aposentada |
| `INVESTIGAÇÃO ADICIONAL` | Reachability ou efeito real ainda não demonstrado |

Exemplo já classificado no Anexo A: RFQ → candidato a `CORREÇÃO DIRETA` (defeito de contrato localizado); `economic/v2` → `AUDITORIA PROFUNDA` (State→Money).

## B.3 — Fila de rodadas (cada uma é seu próprio checkpoint; nenhuma abre a próxima sozinha)

| # | Rodada | Escopo | Status |
|---|---|---|---|
> 🔴 **TABELA RECONCILIADA EM 2026-07-28 — a versão anterior estava FALSA.** Ela marcava 9 das 11 rodadas como `PENDENTE` enquanto o próprio corpo deste documento, ~100 linhas abaixo, registra a Rodada 0 **CONCLUÍDA** (10/10 itens, 2026-07-20) e as Rodadas 1-10 fechadas por checkpoint. Uma instância nova que lesse só a tabela reabriria ~2000 linhas de trabalho já feito. **Este era o artefato mais perigoso do documento.**

| # | Rodada | Escopo | Status REAL (2026-07-28) |
|---|---|---|---|
| 0 | Base transversal | Entrypoints, plugins, auth, tenant, action context, rotas, jobs/workers, feature flags, gates/runner, migrations | ✅ **CONCLUÍDA (10/10 itens, 2026-07-20)** — produziu ROOT-001..004 |
| 1 | Cadastro, login e nascimento da identidade | registro → autenticação → identidade global → user tenant-scoped → Actor PF → sessão → contexto | 🟡 **PARCIAL — fechada por checkpoint** (não é "não iniciada") |
| 2 | Actor e projeção mínima de perfil | identity → Actor resolvido → Actor ativo → perfil/read model → troca de Actor → projeção | 🟡 **PARCIAL — fechada por checkpoint** (FIND-015) |
| 3 | Código de indicação (sem dinheiro) | geração → titular → compartilhamento → cadastro → validação → atribuição → idempotência | 🟡 **PARCIAL — fechada por checkpoint** (FIND-016) |
| 4 | Autoridade e permissões | Identity → Actor → vínculo → capability/grant → operação → revalidação → evento | 🟡 **PARCIAL** (FIND-017; ⚠️ o número **"152 callers"** citado adiante está **REFUTADO** — o real é **126 arquivos / 570 ocorrências**, rederivado do zero pelo AUDIT-004) |
| 5 | Criação e ciclo de empresa | PF responsável → dados fiscais → empresa → Actor page → gestor → capabilities → convite → revogação | 🟡 **PARCIAL — fechada por checkpoint** |
| 6 | Criação e ciclo de grupos | Actor criador → grupo → Group Actor → membership → convite → authority → delegação → saída | 🟡 **PARCIAL** (FIND-018, FIND-019) |
| 7 | Perfil completo, página do Actor e compositor | Actor → capabilities → blocos → página universal → compositor → intents → publicação | 🟡 **PARCIAL — fechada por checkpoint** |
| 8 | Busca, categorias e navegação | consulta → intenção → contexto → TREE → CONCEPT → resultado | 🟡 **PARCIAL — fechada por checkpoint** |
| 9 | Jornadas operacionais | publicação → descoberta → intenção → autoridade → disponibilidade → estado → evento → consequência | 🟡 **PARCIAL** — Eventos mapeado (Anexo A); faltam serviço/produto/locação/demanda/agenda fim-a-fim |
| 10 | Dinheiro, fiscal, território e indicação financeira | fato → obrigação → policy → território → fiscal → Bank → ledger/split → projeção → reversão | 🟡 **PARCIAL — 5 passos feitos, PAUSADA por decisão de escopo.** ⚠️ Muito trabalho posterior (27-28/07) NÃO está refletido nos FINDs |

**⚠️ O QUE ESTE DOCUMENTO NÃO SABE (última edição substantiva: 2026-07-21):**
- **AUDIT-004 rodou em 21/07 e achou RISCO CRÍTICO VIVO** — personificação de actor em `services.routes.ts` availability: qualquer usuário autenticado editava a agenda de **outro** ator (violação do Artigo I). **Contido e selado em 22/07** (`canRepresentActor` fail-closed, `services.routes.ts:314-333`). **§C.6 ainda descreve AUDIT-004 como "fechado, aguardando GO" — está errado.**
- **DECISION-0190 foi IMPLEMENTADA em código em 27/07** (`a0fdbd9e9`): 8 rotas `economic/v2` retornam `501` como primeira instrução, com guard no runner. **Fecha FIND-020, FIND-021 e FIND-022**, que o §C.1 ainda marca como abertos/"sob decisão Clayton".
- **Sessão de 27-28/07:** conservação de centavo provada e guardada · transparência regional (que **nunca funcionara** — estourava erro) corrigida · motor legado de split cercado por tripwire · painel econômico com acesso real · 3 DECISIONs (0192/0193/0194) **reprovadas em 2 auditorias independentes** · e um **STOP vivo** por corrupção silenciosa multi-base no split.
- **ROOT-003 reconciliado:** "84 guards fora do runner" ≠ "84 sem execução" — 77 rodam via agregadores fail-closed. Classificação final `PARTIALLY_RESOLVED_AND_CONTAINED` (selos `fe13af59f`, `229f86f87`). Runner hoje: **225** comandos.

**Consultar o CARTÓRIO (`REMEDIATION_DT_LOG.md`, topo), não este documento, para o estado de 2026-07-22 em diante.**

## B.4 — Formato obrigatório de cada rodada

Tabela por etapa da jornada:

```text
JORNADA · ETAPA · FRONTEND CALLER · ROTA FINAL · PLUGIN/ENTRYPOINT · ACTOR DO CALLER
AUTHORITY · SERVICE · WRITER/READER · SSOT · TABELAS · EVENTO
FEATURE FLAG/PORTA · REACHABILITY · CLASSIFICAÇÃO · PROVA · NÃO AUDITADO
```

E cinco blocos de fechamento: **achados comprovados · suspeitas · contratos quebrados · handoffs para auditoria profunda · candidatos a correção localizada.**

## B.5 — Regra de checkpoint

Nenhuma rodada abre a seguinte sozinha. Ao fim de cada uma, Clayton recebe: mapa da jornada, riscos vivos, defeitos de produto, riscos estruturais, superfícies paralelas, tamanho estimado de auditoria profunda, correções possíveis, partes não verificadas. Só então decide: continuar varredura, aprofundar uma família, ou autorizar uma correção.

**Decisão do Clayton (2026-07-20):** começar pela Rodada 0, um item por vez, sem tentar fechar a rodada inteira de uma vez. Cada item = uma resposta, registrada abaixo, com checkpoint antes do próximo. Gatilho para avançar: Clayton diz **"próximo"**.

## B.6 — Denominador declarado (a partir do item 4)

Todo item, antes de ler qualquer arquivo, declara:

```text
OBJETIVO: o que este item quer responder
DENOMINADOR: lista do universo que pretende cobrir (não apenas "o arquivo X")
MÉTODO DE DESCOBERTA: grep/read/trace — como as peças do denominador serão encontradas
CRITÉRIO DE CONCLUSÃO: o que precisa ser verdade para dizer "fechado"
FORA DE ESCOPO: o que este item deliberadamente não cobre (vira item/rodada própria)
```

E termina com uma destas duas frases, literalmente:
- *"Examinei N de N superfícies do denominador — fechado."*
- *"Encontrei N superfícies, mas não posso provar que o denominador está fechado"* (+ motivo).

Item = **um denominador pequeno e fechável**, não necessariamente um arquivo. Um arquivo de 3000 linhas (ex. `core/events/event.routes.ts`) não vira "um item" só por estar num arquivo só; um denominador pequeno (ex. Tenant) é um item mesmo que toque 6 arquivos.

## B.7 — Grau de confiança por achado

Todo achado leva um destes graus, ao lado da classificação (`ORPHANED_REGISTERED_ROUTE`, `CONTAINED`, etc.):

| Grau | Significado |
|---|---|
| `PROVADO` | caminho e efeito demonstrados diretamente pela leitura/grep |
| `FORTEMENTE INDICADO` | evidência consistente, falta uma confirmação (ex. reachability externa) |
| `SUSPEITO` | padrão estranho, efeito não demonstrado |
| `NÃO AUDITADO` | explicitamente fora do escopo deste item |
| `REFUTADO` | suspeita examinada e descartada com evidência |

Separar sempre "o que a leitura estática prova" de "o que isso causa em runtime/produção" — a segunda parte é quase sempre `NÃO AUDITADO` nesta fase (não temos deploy/execução real neste repo — ver item 1), e isso deve ficar dito, não implícito.

## B.8 — Trava de risco crítico vivo

Se um achado demonstrar (não suspeitar — demonstrar) risco crítico, vivo e explorável envolvendo dinheiro, autoridade, identidade, vazamento de dado sensível ou corrupção de estado: **parar a varredura**, registrar o achado com todo o contexto, e esperar Clayton decidir entre contenção emergencial e continuidade — antes de abrir o próximo item. Não corrige sozinha em nenhuma hipótese. Teste de calibração já aplicado: o vazamento de e-mail em log (item 3, achado 4) NÃO dispara esta trava — é `PROVADO` como leitura estática, mas "chega a ambiente exposto" é `NÃO AUDITADO` (sem deploy configurado neste repo). Fica na fila `DECIDE` normal.

## B.9 — Escalonamento de modelo (Sonnet vs. avançado)

Regra própria de trabalho, não apenas para esta rodada: Sonnet segue lendo/classificando/mapeando (busca, inventário, rastreio de import, cálculo de path final, cruzamento frontend/backend, tabela de reachability) — é o trabalho predominante desta fase. Parar e sinalizar necessidade de modelo mais avançado (Opus/Fable) quando o achado exigir julgar: dois SSOTs aparentemente válidos · autoridade indireta · múltiplos writers · transação distribuída · concorrência · reversão · RLS · cálculo financeiro · conflito entre norma e material · denominador que não fecha · mais de duas interpretações plausíveis igualmente defensáveis. Nesses casos: registrar o pacote (achado + evidência + por que a decisão é ambígua) na fila `AUDITORIA PROFUNDA` e seguir sem tentar resolver.

## B.10 — Registro de causas-raiz transversais

Quando o mesmo padrão de sintoma aparecer em mais de uma jornada/item (ex.: "tenant implícito" aparecendo em Cadastro, Empresa, Grupo e Evento), ele NÃO vira uma dívida por ocorrência — vira uma entrada aqui, com todas as ocorrências linkadas ao mesmo item:

```text
CAUSA-RAIZ: <nome curto>
SINTOMA: <o que se observa em cada ocorrência>
PRIMEIRA OCORRÊNCIA: <item/rodada + arquivo>
OUTRAS OCORRÊNCIAS: <lista, conforme aparecem>
STATUS: aberto | agrupado | enviado para fila X
```

**CAUSA-RAIZ-001: ausência de "tenant-loop" seguro para workers em background**
```text
SINTOMA: worker default-off citando explicitamente falta de mecanismo para iterar múltiplos tenants sob RLS sem claim cross-tenant.
PRIMEIRA OCORRÊNCIA: Item 1 (Entrypoints), backend/BOOT.ts — Settlement Worker e Release Worker, DEFAULT-OFF.
OUTRAS OCORRÊNCIAS: backend/BOOT.ts — Financial Alert Worker, Financial Metrics Worker, Risk Analysis Worker, SLA Monitor Worker, Governance Funding Commitment Worker (todas citam "#34 tenant-loop" explicitamente, 9 ocorrências no arquivo).
STATUS: aberto — não é 6-7 dormências isoladas, é 1 causa-raiz transversal. Candidato natural a virar o próprio item 7 (Jobs e workers) ou handoff direto para AUDITORIA PROFUNDA de Tenant×Concorrência.
```

**CAUSA-RAIZ-002: não existe build de produção verificado — só o caminho dev (tsx) roda a aplicação real**
```text
SINTOMA: peças do "caminho de produção" existem nominalmente mas não se conectam entre si.
PRIMEIRA OCORRÊNCIA: Item 1 — `npm start` → `node dist/server.js` → só reexporta `buildApp`, nunca chama `startServer()`/`.listen()`.
OUTRAS OCORRÊNCIAS: Item 7 — `backend/BOOT.ts` (entrypoint real) está FORA do projeto TypeScript (`tsconfig.json`: `rootDir: "./src"`, `include: ["src/**/*"]` — BOOT.ts fica no root do backend, fora de `src/`). `dist/BOOT.js` existe mas está VAZIO (0 bytes, datado de 2026-07-15 — 4 dias mais velho que o `BOOT.ts` fonte de 28KB, 2026-07-19) — artefato morto, não compilação real.
EFEITO COLATERAL CONCRETO: por BOOT.ts nunca ser type-checked, ele chama `isFinancialWorkerEnabled('ENABLE_TREASURY_DISTRIBUTION_WORKER')` e `isFinancialWorkerEnabled('ENABLE_TREASURY_SPLIT_WORKER')` — duas strings que NÃO existem no union type `FinancialWorkerFlag` (`financial-worker-gate.ts`, só lista 10 flags, sem essas 2). Isso seria erro de compilação em qualquer arquivo dentro de `src/`, mas passa despercebido porque BOOT.ts nunca é verificado. Confirmado rodando `npm run typecheck` (via `npm run`, não `npx tsc` direto — `npx tsc` sem instalação prévia cai num pacote placeholder) — resultado: `EXIT:0`, zero erros, porque BOOT.ts simplesmente não é examinado.
STATUS: aberto. O arquivo mais crítico do backend (único entrypoint, faz todos os fail-closed de boot) roda sem NENHUMA rede de segurança de tipo. Neste caso específico o efeito em runtime é nulo (comparação de string simples, `process.env[flag] === 'true'`, funciona igual não importa o tipo) — mas é sorte de desenho, não garantia.
```

**CAUSA-RAIZ-003: "runner verde" não inclui todos os guards existentes — exatamente o risco que a Fase 1 do plano original previu**
```text
SINTOMA: guard escrito e presente no disco, mas nunca executado pelo runner canônico nem por nenhum script individual.
PRIMEIRA OCORRÊNCIA: Item 9 (Gates e runner) — `scripts/run-regression-guards.mjs` (o "runner", confirmado: 200 comandos na lista, batendo com o número "runner 200/200" citado na memória/cartório do projeto) só chama 197 dos 281 arquivos `audit-*.mjs`/`.ts` que existem em `backend/scripts/`.
OUTRAS OCORRÊNCIAS: 84 guards órfãos, dos quais 83 não têm NENHUM script npm individual (só `tsx`/`node` manual) — incluem `audit-actor-impersonation-writes.mjs` (65 linhas, relevante DIRETAMENTE ao achado do item 5 — actionContext sem enforcement central), `audit-group-b-financial-workers-tenant-loop-rls.mjs` (relevante DIRETAMENTE à CAUSA-RAIZ-001, tenant-loop), `audit-service-order-confirm-terms-financial-flag-failclosed.mjs` (relevante DIRETAMENTE ao incidente já documentado no item 3/8, F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX), mais guards de RLS financeiro (`audit-group-a-financial-tables-rls.mjs`, `audit-payment-intents-governance-funding-rls.mjs`, `audit-rls-policy-guc-canonical.mjs`), firewall financeiro (`audit-rides-financial-firewall.mjs`, `audit-bank-transaction-sink-firewall.mjs`) e anti-revival (`audit-regional-fund-legacy-credit-antirevival-guard.mjs`, `audit-treasury-split-superseded-antirevival-guard.mjs`).
STATUS: aberto — é o achado mais grave da Rodada 0 até agora. "Runner 200/200 verde" é uma alegação verdadeira sobre 197 guards e uma alegação FALSA implícita sobre "o sistema está coberto" — 84 guards reais, incluindo pelo menos 3 que tocam diretamente achados já registrados nesta rodada, não fazem parte dessa contagem. Confirma literalmente o medo do `PLANO_RECUPERACAO.md` original (Fase 1: "impedir outro caso de 'runner verde' que não continha um gate crítico").
```

**CAUSA-RAIZ-004: personificação de actor (impersonation) é risco REAL já provado, corrigido múltiplas vezes, com regra de regressão escrita — mas essa regra não roda no runner canônico**
```text
SINTOMA: rota que executa write "como se fosse" outro actor a partir só do actionContext.actorId client-declared, sem provar canRepresentActor/canActAs antes.
PRIMEIRA OCORRÊNCIA: Item 5 (Action Context) — middleware valida só forma, autoridade real fica a cargo de cada rota individualmente; 152 consumidores de actionContext.actorId vs 246 chamadas a canRepresentActor, sem prova de cobertura 1:1.
OUTRAS OCORRÊNCIAS: Rodada 4 passo 1 — `scripts/audit-actor-impersonation-writes.mjs` (órfão do runner, achado no item 9/CAUSA-RAIZ-003) documenta 5 handlers onde essa EXATA vulnerabilidade já foi encontrada e corrigida de verdade (2026-07-04, DT-AUTHORITY-REGUA-PELA-METADE): `identity POST /update` (editava identidade civil de OUTRA pessoa — severidade HIGH), `social POST /posts/:id/reactions`+`/comments` (reagir/comentar como outro actor — MEDIUM), `feed POST /action` (gravar ação sob globalUserId de outro — LOW), `me-active-location` (2 handlers), `social-inbox` (2 handlers).
STATUS: aberto. Não é mais hipótese — é uma classe de vulnerabilidade PROVADA historicamente real neste código, com pelo menos 3 severidades distintas já encontradas e corrigidas, e uma regra de regressão específica escrita para nunca deixar voltar — mas essa regra está entre os 84 guards que o runner canônico não executa. Enquanto isso não mudar, uma regressão num desses 5 handlers (ou um handler NOVO com o mesmo erro, entre os 152 arquivos ainda não auditados) não seria pega automaticamente por `npm run validate:regression-guards`.
```

## Rodada 0 — detalhe por item

Checklist (ordem fixa; não pular):

- [x] **1. Entrypoints do backend** — concluído 2026-07-20 (achados abaixo)
- [x] **2. Plugins globais** — concluído 2026-07-20 (achados abaixo)
- [x] **3. Autenticação** — concluído 2026-07-20 (achados abaixo)
- [x] **4. Tenant** — concluído 2026-07-20 (achados abaixo)
- [x] **5. Action context** — concluído 2026-07-20 (achados abaixo)
- [x] **6. Registro final de rotas** — concluído 2026-07-20 (achados abaixo)
- [x] **7. Jobs e workers** — concluído 2026-07-20 (achados abaixo)
- [x] **8. Feature flags** — concluído 2026-07-20 (achados abaixo)
- [x] **9. Gates e runner** — concluído 2026-07-20 (achados abaixo)
- [x] **10. Migrations e estado de banco** — concluído 2026-07-20 (achados abaixo) — **RODADA 0 COMPLETA**

### Item 1 — Entrypoints do backend (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`. Retrofit 2026-07-20: achados abaixo lidos antes da regra B.7 (grau de confiança) existir — tratar como `PROVADO` por leitura direta de arquivo, exceto onde o próprio texto já diz "não confirmado"/"suspeito" (achado 3, sobre `npm start`).

**Achados comprovados:**

1. **Único entrypoint real de execução completa é `backend/BOOT.ts`** (raiz do backend, fora de `src/` — o próprio arquivo se autodeclara "ÚNICO ENTRYPOINT DO BACKEND" no comentário de topo). Usado por `npm run dev` (`tsx watch BOOT.ts`). Sequência: `loadBackendEnv` → `assertSensitivePermissionsHaveCapabilityMapping` (fail-closed) → `assertCompanyPolicyRegistryExhaustive` (fail-closed, DECISION-0189 R3) → `validateEnv` (fail-closed) → `startServer()`, que faz: schema guard fail-die → DB check (não bloqueante) → DB role/RLS preflight fail-closed → digest do catálogo de permissões empresariais fail-closed (DECISION-0189 R16) → `buildApp()` (`app.builder.ts`) → `registerCoreHandlers` (não bloqueante) → checagem de porta em uso → `app.listen()` → ~20 workers em sequência.
2. **`backend/src/server.ts` (2 linhas) não é o entrypoint de produção — e o próprio código diz isso.** Comentário: *"Re-export para testes e devtools. Entrypoint de produção: BOOT.ts na raiz do backend."* Só reexporta `buildApp`.
3. **Mas `package.json` aponta `"main"` e `"start"` para esse mesmo arquivo não-entrypoint.** `"main": "dist/server.js"`, `"start": "node dist/server.js"` — o script com o nome convencional de produção (`npm start`) roda o compilado de `src/server.ts`, que só define `export { buildApp }` e nunca chama `startServer()`/`.listen()`. Rodar `node dist/server.js` hoje constrói o app Fastify em memória e encerra o processo sem nunca escutar porta nenhuma — sem erro, sem log, silencioso. **Não encontrei nenhum Dockerfile, render.yaml, railway.json/toml, fly.toml, Procfile ou ecosystem.config no repo** que aponte para outro entrypoint em produção — ou seja, não há hoje nenhuma peça de infra-as-code que contorne esse `npm start` quebrado. Classificação: `SUSPEITO, não comprovado como incidente real` — não sei se alguém de fato usa `npm start`/`dist/server.js` para subir isto hoje, ou se na prática sempre se roda via `BOOT.ts`/`tsx` mesmo em produção. Mas, como está nomeado e documentado, o script "start" convencional não cumpre o que promete.
4. **`backend/src/server-TESTE.ts` (135 linhas) é lixo de debug abandonado**, não um entrypoint válido — comentário de topo: "TESTE BINÁRIO - Identificar qual import trava" (script manual para descobrir import que travava o boot, feito passo a passo com `console.log`). Não é referenciado por nenhum script/config — só aparece por acidente num arquivo de cache de guard (`.cache/guard-financial-regression.json`), não como chamada real. Candidato a `REMOVE`.
5. **`backend/docker-compose.yml` só sobe Postgres + Redis** (dependências de infra) — não define um serviço para o próprio backend, e não há Dockerfile para ele. Confirma que não existe um "segundo entrypoint" de deploy escondido em container; também confirma que subir o backend em si não está capturado como infra-as-code neste repo — é operação manual.

**Não auditado neste item:** o que exatamente decide se alguém roda `npm start` vs `npm run dev` em cada ambiente (não há CI/CD nem doc de deploy neste repo para checar); se há algum processo externo ao repo (ex. serviço systemd, PM2 fora do repo, painel de hosting) que já contorna isso rodando `BOOT.ts` diretamente.

**Fila de destino:** `REMOÇÃO/CONTENÇÃO` para `server-TESTE.ts` (remover); `INVESTIGAÇÃO ADICIONAL` para o `npm start`/`dist/server.js` quebrado (confirmar com Clayton se é usado antes de classificar como `CORREÇÃO DIRETA`).

---

### Item 2 — Plugins globais (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`. Retrofit: achados 1, 2, 5 = `PROVADO` (leitura direta + grep de registro). Achados 3 e 4 (plugins nunca registrados) = `PROVADO` que não estão registrados; a UTILIDADE de religá-los é `FORTEMENTE INDICADO`, não `PROVADO` (não avaliei custo/risco de religar).

**Achados comprovados:**

1. **Plugins globais realmente ativos, registrados no topo de `app.builder.ts` antes de qualquer módulo de domínio:** `@fastify/sensible` (sem opções) → `errorHandlerPlugin` (custom) → `@fastify/cors` (`origin` = `CORS_ORIGIN` do env, ou `true` — libera qualquer origem — quando `NODE_ENV !== 'production'`; `credentials: true`) → `@fastify/helmet` (sem opções customizadas, defaults puros) → `@fastify/rate-limit` (5000/min em dev com `skipOnError` e uma lista fixa de rotas de bootstrap isentas; 100/min em produção) → `@fastify/static` (serve `/uploads/` a partir da pasta local `uploads/`).
2. **`errorHandlerPlugin` é o único ponto canônico de erro/404** — envelope `{error, meta}` (§9.5), esconde stack trace em produção, trata `IdempotencyMismatchError` como 409 especial, deriva `requestId`/`correlationId` de `(request as any).requestId ?? request.id`.
3. **`request-id.plugin.ts` existe, está bem construído, mas NUNCA é registrado em `app.builder.ts` nem importado em nenhum outro lugar do código.** Ele geraria `requestId`/`correlationId` reais a partir do header `x-request-id` (ou UUID) e os ecoaria na resposta. Como não está plugado, o fallback `?? request.id` do `errorHandlerPlugin` sempre cai no `request.id` NATIVO do Fastify — um contador incremental por processo, não correlacionável entre reinícios nem entre serviços. Efeito colateral confirmado: pelo menos `bank-http.routes.ts` (visto na rodada anterior) reimplementa manualmente sua própria versão local (`bankHttpReqId()`) do mesmo fallback, em vez de depender de um plugin central — rastreamento de requisição está fragmentado, não é SSOT.
4. **`observation-mode.plugin.ts` existe, também nunca é registrado, e é um achado relevante para o PRÓPRIO plano de recuperação.** Ele foi construído para interceptar `fastify.register()` e BLOQUEAR o registro de novos módulos/rotas quando `observationModeService.isEnabled()` — ou seja, já existe no código um mecanismo pronto de "congelar novos registros em runtime", que é exatamente a capacidade que a Fase 0 do plano original ("congelar novas frentes materiais") pediria. Hoje está desconectado — não tem efeito nenhum. Não abri `observation-mode.service.ts` em profundidade (fora do escopo deste item); só confirmo que o plugin existe, é funcionalmente coerente, e está inerte.
5. **`@fastify/multipart` está instalado mas NÃO é global — e isso está correto, não é falha.** Não é registrado em `app.builder.ts`; é registrado localmente, com limites próprios, em 4 pontos: `companies.routes.ts` (upload de documento KYB), `media-assets.routes.ts` (mídia canônica), `assistant.module.ts` (áudio) e `groups.module.ts` (imagem de grupo — `groups.routes.ts` herda por estar no mesmo escopo). Encapsulamento correto do Fastify: cada domínio define seu próprio limite de tamanho/arquivo em vez de um limite global genérico.

**Não auditado neste item:** `authPlugin`, `tenantPlugin`, `actionContextPlugin`, `rbacPlugin` — todos registrados dentro do `protectedScope`, mas cada um tem item próprio nesta rodada (3, 4, 5) e será aberto lá, não aqui. `observation-mode.service.ts` (o serviço por trás do plugin inerte) não foi lido.

**Fila de destino:** `INVESTIGAÇÃO ADICIONAL` para `request-id.plugin.ts` (confirmar se vale religar — resolveria a fragmentação de rastreamento) e para `observation-mode.plugin.ts` (confirmar se é candidato a virar o mecanismo real da Fase 0 do plano, em vez de inventar um novo). Nenhum item desta rodada foi para `CORREÇÃO DIRETA` — são achados de "capacidade pronta mas desconectada", não bugs ativos.

---

### Item 3 — Autenticação (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`. Retrofit: achados 1, 2, 3, 6, 7, 8 = `PROVADO`. Achado 4 (PII em log) = `PROVADO` que o log ocorre sem máscara; se esse log chega a um ambiente exposto/observável por terceiros = `NÃO AUDITADO` (ver B.8 — não dispara trava de risco vivo por esse motivo). Achado 5 (CPF enumerável) = `PROVADO` que o endpoint é público e responde `exists`; risco de exploração real = `FORTEMENTE INDICADO`, não medido.

**Achados comprovados:**

1. **Baseline criptográfico confirmado saudável, sem achado:** senha com `bcrypt` (cost 10); `JWT_SECRET` obrigatório via env — o módulo **lança exceção no load** se ausente (fail-closed real, não fallback silencioso); access token 15min, refresh token 7 dias — valores dentro do razoável.
2. **`authPlugin` (roda só no escopo protegido) é o único ponto de verificação de Bearer token.** Exige header `Authorization: Bearer`, valida via `authService.verifyAccessToken` (já valida `tenantId`+`tokenVersion` internamente), e faz 3 checagens redundantes-mas-explícitas de shape do payload antes de montar `req.user`. Decisão de design correta e documentada: **o JWT é a única fonte de verdade para `tenantId`** — se o header `x-tenant-id` do cliente divergir do JWT, o plugin só **avisa** (log warn) e segue com o valor do JWT, nunca do header. `authPlugin` não define `req.tenant` (isso é do `tenantPlugin`, item 4) — só injeta `req.user`.
3. **Rate limiting real e explícito em `/auth/register`, `/login`, `/refresh`, `/check-cpf`, `/check-referral`** via `authRateLimitService`, com log de abuso (`🚫 [AUTH] Rate limit excedido`) incluindo IP extraído. Mas **todos os 5 pontos são fail-open no erro do próprio rate limiter**: se o serviço de rate limit falhar (ex. Redis fora do ar), o código loga warn e **segue sem aplicar limite nenhum**. Tradeoff documentado no próprio comentário ("não quebrar fluxo"), não é bug silencioso — mas significa que a proteção de força bruta desaparece inteira sob degradação do rate limiter, sem alarme forte disso acontecer.
4. **Achado de maior severidade — PII em log nível `info`, em TODA requisição autenticada, sem mascaramento.** `auth.plugin.ts` (que roda no preHandler de toda rota protegida, não só rotas de auth) loga DUAS vezes por requisição, em `info`: uma vez com `headerTenantId, jwtTenantId, jwtUserId` ("Validação de tenant") e outra com `userId, tenantId, email` ("Autenticação validada com sucesso") — **o email vai em texto puro, sem máscara**. Isso contrasta com `auth.routes.ts` (register/login/refresh), que mascara consistentemente (`email.substring(0,3) + '***'`) em todos os seus próprios logs. Ou seja: o código sabe mascarar PII em log e faz isso nas rotas de auth — mas o plugin que roda em TODA chamada autenticada da API inteira loga o email cru, com volume muito maior (uma vez por request, não só por tentativa de login). É tema institucional adjacente à DECISION-0071 (dados sensíveis) — mas não é o mesmo escopo: DECISION-0071 cobre campos de lifestyle/saúde no blob de perfil, não logging operacional nem endpoints de auth. Registro aqui como achado próprio de higiene de log, não como extensão daquela decisão.
5. **`GET /auth/check-cpf` é público (sem token) e responde `{exists: boolean}` para qualquer CPF consultado**, rate-limited mas não autenticado — permite enumeração de CPF (dado sensível, CPF é identificador fiscal brasileiro) por quem tiver paciência de rodar sob o limite de rate. Padrão comum em fluxos de onboarding (UX de "esse CPF já existe"), mas vale registrar como característica de exposição de dado, não como bug. Mesmo tema institucional adjacente à DECISION-0071 mencionado no achado 4 (dado sensível exposto), mas fora do escopo literal daquela decisão.
6. **`check-referral` e o próprio fluxo de registro resolvem o tenant institucional (`unificard-inicial`) sempre server-side**, ignorando por desenho qualquer `x-tenant-id` vindo do cliente nesses pontos — consistente com o mesmo padrão de "subject/tenant nunca vem do cliente" já visto em `organizers.routes.ts` (rodada anterior) e no próprio `authPlugin`.
7. **Blocos de "schema guard" (checagem de coluna `token_version`) aparecem comentados, de forma idêntica, em `/register`, `/login` e `/refresh`**, com nota explícita de que a validação de schema foi movida para o boot (`BOOT.ts` → `schema-guard`). Não é código morto silencioso — está comentado com razão declarada e é consistente com o que o item 1 já confirmou (schema guard roda no `startServer()`).
8. **WebAuthn (step-up authentication) existe como subsistema próprio** (`webauthn.routes.ts`/`.service.ts`/`.repository.ts`, registrado em `/auth/webauthn`, SPRINT 36.3) — não aberto em profundidade nesta rodada (fora do escopo de "autenticação básica"; fica como não auditado).

**Não auditado neste item:** internals de `authService` além do que foi confirmado acima (rotação de refresh token, geração de `tokenVersion`, fluxo completo de `register`/`login` no service); WebAuthn em profundidade; `authRateLimitService` internals (onde ele guarda estado — Redis? memória? banco?).

**Fila de destino:** `AUDITORIA PROFUNDA`/`DECIDE` para o achado 4 (PII em log) e achado 5 (CPF enumerável) — tema institucional adjacente à DECISION-0071 (dados sensíveis), mas escopo distinto (logging operacional e endpoint de auth, não campos de lifestyle/saúde no blob de perfil); não são "bugs isolados", são decisão institucional de mascaramento de log e exposição de dado fiscal. `INVESTIGAÇÃO ADICIONAL` para confirmar onde `authRateLimitService` guarda estado (determina o real risco do fail-open do achado 3).

---

### Item 4 — Tenant (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender como o sistema resolve "qual tenant" em cada situação, e se há mais de uma fonte de verdade para isso.
DENOMINADOR: tenantPlugin; tenant.service.ts; origens de tenant_id (JWT, header x-tenant-id, resolução fixa institucional); quantos tenants existem de fato; rotas públicas que escolhem tenant sem auth; jobs/workers sem request HTTP.
MÉTODO: leitura direta de tenant.plugin.ts + grep de slugs/UUIDs de tenant conhecidos + cruzamento com achados do item 1 (workers).
CRITÉRIO DE CONCLUSÃO: listar todas as origens de tenant_id encontradas e dizer se são consistentes ou conflitantes.
FORA DE ESCOPO: corretude de RLS por tabela (Rodada 10); autoridade dentro do tenant (item 5/Rodada 4); tenant_contexts de categoria (mais próximo da Rodada 8).
```
**Examinei 6 de 6 superfícies do denominador — fechado**, com uma ressalva: não medi se o `tenant.routes.ts` órfão (achado 5) é chamado por algum script interno.

**Achados comprovados:**

1. **`PROVADO` — `tenantPlugin` tem fonte única real e correta.** Decodifica o JWT (redundante com `authPlugin`, que já validou — aqui só `jwt.decode` sem verificar de novo) e usa **exclusivamente** `payload.tenantId`. Comentário explícito: *"Header x-tenant-id NÃO é fonte de verdade"*. Hard boundary: nunca roda em `/auth/*` — se acontecer por engano, faz early-return silencioso com log de "VIOLAÇÃO DE FRONTEIRA" (defesa em profundidade, não crash).
2. **`PROVADO` — exceção de DEV documentada (SPRINT 30):** sem `tenantId` no JWT em ambiente não-produção não quebra — devolve mensagem amigável ou redireciona pro frontend, dependendo se a rota parece API ou navegador. Em produção é sempre rígido (400, sem exceção). Não é brecha de produção; é UX de desenvolvimento.
3. **`PROVADO` — existem DOIS "tenants de sistema" diferentes, não relacionados:** `unificard-inicial` (slug citado em 18 arquivos — é o tenant operacional institucional real; todo cadastro orgânico cai nele, sempre resolvido server-side, nunca por header do cliente) e `system-tenant` (UUID fixo `a0000001-...`, usado só por scripts que precisam ler categorias — comentário próprio: *"Scripts NUNCA leem categorias sem tenant e context"*). Não são a mesma entidade — servem propósitos diferentes. Implicação prática: o sistema está desenhado para multi-tenant, mas hoje, na prática, o cadastro orgânico sempre resolve para o MESMO tenant institucional — não há evidência nesta rodada de multi-tenant real em uso (não confirmado quantos tenants existem fisicamente no banco — isso exigiria consulta ao banco, fora do método desta rodada).
4. **`PROVADO` — achado transversal que reclassifica parte do item 1: ver CAUSA-RAIZ-001 no registro B.10.** Pelo menos 6 workers (Settlement, Release, Financial Alert, Financial Metrics, Risk Analysis, SLA Monitor, Governance Funding Commitment) citam a mesma causa raiz — ausência de "tenant-loop" seguro sob RLS — não são 6 achados isolados, é 1 causa com 6 sintomas.
5. **`PROVADO` — `tenant.module.ts`/`tenant.routes.ts` (endpoint `POST /:tenantId/set-region`) não está registrado em `app.builder.ts`.** Mesmo padrão do item 2 (capacidade existente, desconectada do runtime HTTP). `FORTEMENTE INDICADO`, não `PROVADO`: não sei se é chamado por outro caminho (script de bootstrap de tenant, por exemplo) — não verificado.
6. **`NÃO AUDITADO` — `tenant_contexts`** (delegação de autoridade de LEITURA de categoria por contexto: professional/interest/education/hobby/learning/health/company/lifestyle/group, via `tenant-context-bootstrap.service.ts`) é um mecanismo mais estreito e separado do que "qual é o tenant" — mais próximo da Rodada 8 (busca/categorias). Só confirmei que existe e o que faz superficialmente; não abri em profundidade (fora do denominador declarado).
7. **`PROVADO` — tabela `tenants` explicitamente NÃO usa RLS** (comentário no código: "tabela de sistema") — coerente, não bug (não faz sentido RLS numa tabela que define os próprios tenants).

**Não auditado neste item:** quantos tenants existem fisicamente no banco hoje (exigiria query, não leitura de código); `tenant-context-permission.service.ts` em profundidade; se `tenant.routes.ts` órfão tem algum caller script.

**Fila de destino:** `CORREÇÃO DIRETA`/`INVESTIGAÇÃO ADICIONAL` para `tenant.routes.ts` órfão (mesmo tratamento do achado similar no item 2). O achado principal (CAUSA-RAIZ-001, tenant-loop) já está registrado em B.10 e aponta para `AUDITORIA PROFUNDA` futura (provavelmente dentro do item 7 — Jobs e workers — ou da Rodada 4/10).

---

### Item 5 — Action context (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que é "actionContext", de onde vem, e como (se) sua autoridade é verificada antes de ser usada.
DENOMINADOR: action-context.plugin.ts; middleware real por trás dele; origem do actorId (client-declared vs server-resolved); padrão de validação (canRepresentActor) — centralizado ou ad-hoc; origem no frontend.
MÉTODO: leitura direta do plugin + middleware + grep de contagem (não leitura individual) dos consumidores; leitura do ponto único do frontend que monta o header.
CRITÉRIO DE CONCLUSÃO: dizer se existe um único ponto que transforma "hint do cliente" em "autoridade validada", ou se isso é decidido rota por rota.
FORA DE ESCOPO: authority/capability/grants em si (item 4 da Rodada 4); aqui só o mecanismo de transporte, não a lógica de permissão em cada rota.
```
**Examinei o mecanismo central (plugin + middleware + origem frontend) — fechado.** NÃO examinei individualmente os 152 arquivos que consomem `actionContext.actorId` (isso extrapolaria o denominador declarado — vira handoff, ver abaixo).

**Achados comprovados:**

1. **`PROVADO` — `actionContextPlugin` é wrapper fino; a lógica real está em `action-context.middleware.ts`.** Aplica-se só depois de `auth-plugin`+`tenant-plugin` (dependência declarada explicitamente no `fp()`), com 2 exceções documentadas e estreitas: `GET /social/actors/available` (bootstrap — listar actors antes de escolher um) e `GET /groups/mine` (autoescopado por `req.user.userId` do JWT).
2. **`PROVADO` — achado central deste item: o middleware, por doutrina escrita, valida só FORMA, não AUTORIDADE.** Comentário literal no código: *"Middleware propaga contexto. Middleware NÃO infere autoridade."* Ele aceita `actorId` de header (`x-action-context`), body ou query, e só garante que `actorId`/`intent`/`source`/`scope` estão presentes e que `scope` contém o `tenantId` — não verifica se o usuário autenticado PODE de fato agir como aquele `actorId`. Isso está correto por desenho (é a mesma doutrina DECISION-0113 já vista em vários lugares: "actorId de cliente = hint, não autoridade"), mas **isso empurra a responsabilidade da checagem real (`canRepresentActor`) para CADA rota individualmente**, sem enforcement central.
3. **`FORTEMENTE INDICADO`, não `PROVADO` — não há garantia de que todo consumidor faz a checagem.** Contagem: 152 arquivos referenciam `actionContext.actorId`/`req.actionContext`; 246 arquivos chamam `canRepresentActor` em algum lugar. Os números não provam cobertura 1:1 (não são o mesmo conjunto necessariamente) — só mostram que a checagem é ampla, não que é universal. **Uma única rota que esqueça de chamar `canRepresentActor` depois de ler `actionContext.actorId` é, por desenho do próprio middleware, um buraco de personificação de actor sem rede de segurança automática.** Isso não foi refutado nem confirmado — é candidato direto a `AUDITORIA PROFUNDA`.
4. **`PROVADO` — no frontend, a origem do `actorId` é centralizada em um único ponto** (`frontend/src/api/client.ts`, dentro de `apiFetch`): lê de `localStorage.getItem(ACTOR_STORAGE_KEY)` (chave `unificard_active_actor_id`), não é montado ad-hoc em cada chamada. Em DEV, se faltar actor numa rota não isenta, lança exceção dura; em PROD, só loga erro e segue — mas isso é seguro, porque o middleware do backend exige o campo de qualquer forma (400 se ausente), então o "continuar" do frontend em prod não pula a validação, só desloca o erro pro backend.

**Não auditado neste item:** os 152 consumidores individuais de `actionContext.actorId` (verificar caso a caso se cada um valida `canRepresentActor` antes de usar — isso é auditoria de superfície grande, não cabe no denominador deste item).

**Fila de destino:** `AUDITORIA PROFUNDA` para o achado 3 — superfície grande (152 arquivos), envolve autoridade indireta e múltiplos pontos de decisão, exatamente o perfil que a regra B.9 pede para escalar a um modelo mais avançado em vez de tentar fechar com leitura rasa em Sonnet. Não é bug comprovado — é uma pergunta estrutural em aberto ("todo consumidor valida?") que precisa de uma auditoria dedicada, não de uma checagem por amostragem.

---

### Item 6 — Registro final de rotas (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: inventariar todo prefixo/módulo registrado em app.builder.ts e achar outras colisões de prefixo além da já confirmada (unifybank em /bank+/admin).
DENOMINADOR: toda chamada .register(...) em app.builder.ts, pública e protegida, com prefixo final (ou ausência de prefixo).
MÉTODO: releitura completa de app.builder.ts, agrupamento por prefixo.
CRITÉRIO DE CONCLUSÃO: lista prefixo→módulo(s), com todo prefixo compartilhado por 2+ módulos identificado nominalmente.
FORA DE ESCOPO: abrir o conteúdo de cada módulo para provar colisão real de método+path (isso é o que já foi feito para /bank+/admin+/api/events no Anexo A, e fica como handoff para os demais).
```
**Examinei 100+ de 100+ registros do arquivo — fechado** para o nível "prefixo declarado"; NÃO fechado para "colisão real de método+path" em cada prefixo compartilhado (isso exigiria abrir cada módulo, como fizemos no Anexo A — fica de handoff).

**Achados comprovados:**

1. **`PROVADO` — `app.builder.ts` registra bem mais de 100 módulos/rotas** (contagem aproximada, entre escopo público e protegido) — confirma objetivamente o diagnóstico inicial do próprio `PLANO_RECUPERACAO.md` ("o runtime está amplo demais"), não é impressão.
2. **`PROVADO` — pelo menos 10 prefixos, além dos já confirmados no Anexo A, têm 2 ou mais módulos diferentes registrados no mesmo prefixo:**

| Prefixo | Módulos registrados | Contagem | Status |
|---|---|---|---|
| `/bank` + `/admin` | `unifybankModule` (×2) + `categoryReviewModule` (`/admin`) | 3 | **verificado no Anexo A** — unifybank duplicado confirmado; categoryReview sem colisão |
| `/api/events` | `eventLifecycleRoutes` + `eventsModule` + `eventModule` | 3 | **verificado no Anexo A** — sem colisão atual, 1 histórica já corrigida |
| `/actors` | `actorCapabilitiesRoutes` + `recentCounterpartsRoutes` + `homeFeedRoutes` + `profileInferenceRoutes` + `actorTerritorialAddressRoutes` | **5** | não verificado — maior densidade de compartilhamento de prefixo do runtime inteiro |
| `/marketplace` | `marketplacePublicRoutes` (público) + `marketplaceOfferingsRoutes` + `marketplaceCanonicalSearchRoutes` + `marketplaceModule`/`marketplace.routes` (+ possivelmente `marketplaceCategoriesRoutes`/`marketplaceSearchRoutes`/`marketplaceContextualRoutes`/`storeOnboardingRoutes`, registrados sem prefixo explícito — path interno pode já começar com `/marketplace`) | 4-8 | não verificado — segunda maior densidade |
| `/admin/pilot` | `pilotEventsModule` + `pilotInvitesModule` + `pilotHumanObservationModule` + `institutionalMemoryModule` | 4 | não verificado |
| `/reports` | `core/reporting` (público — denúncias) + `modules/reports` (protegido — relatórios operacionais) | 2 | não verificado — **domínios semanticamente não relacionados** (denúncia vs relatório operacional) compartilhando o mesmo prefixo; maior risco de confusão do lote, mesmo que método+path não colidam |
| `/social` | `socialModule` + `socialRelationshipsRoutes` | 2 | não verificado |
| `/companies` | `companiesModule` + `companyTemplatesRoutes` | 2 | não verificado |
| `/navigation` | `navigationRoutes` + `moduleProjectionRoutes` | 2 | não verificado |
| `/services` | `serviceOfferingsRoutes` + `servicesModule` | 2 | não verificado |
| `/economy` | `economyModule` + `economyOverviewModule` | 2 | não verificado |
| `/intent` | `intentDraftRoutes` + `intentExecuteRoutes` | 2 | não verificado |

3. **`PROVADO` — evidência histórica direta de que `/internal` já foi ponto real de colisão evitada manualmente.** 8 controllers financeiros/observabilidade (`financial-simulator`, `financial-dashboard`, `financial-operations-panel`, `financial-audit-export`, `financial-dispute`, `financial-freeze`, `governance-proposal`, `treasury-account`) compartilham `/internal`. Comentário no próprio `app.builder.ts`: *"financial-observability e financial-health não são registrados aqui — mesmas rotas em financial-operations-panel (evita FST_ERR_DUPLICATED_ROUTE)"* — ou seja, o time já removeu 2 registros concorrentes para não quebrar o boot. Prova direta de que este padrão (muitos módulos, um prefixo) já gerou pelo menos um incidente real de boot, corrigido.
4. **`FORTEMENTE INDICADO` — mais de 25 módulos são registrados SEM opção de prefixo** (`await protectedScope.register(modulo.default)`, sem `{ prefix: ... }`), o que significa que cada um desses arquivos declara seus próprios paths completos internamente. Isso torna mais difícil responder "o que vive sob X" só olhando `app.builder.ts` — é preciso abrir cada arquivo para saber onde ele realmente responde. Não é bug, é característica que aumenta o custo de qualquer auditoria futura de topologia.

**Não auditado neste item:** colisão real de método+path em qualquer um dos 10 prefixos da tabela acima (só `/bank`+`/admin` e `/api/events` foram abertos e provados no Anexo A); os paths internos dos ~25+ módulos sem prefixo.

**Fila de destino:** `INVESTIGAÇÃO ADICIONAL` para toda a tabela de prefixos compartilhados não verificados — mesmo método do Anexo A (abrir cada módulo, listar paths finais, comparar). Prioridade sugerida por densidade: `/actors` (5) e `/marketplace` (4-8) primeiro, depois `/admin/pilot` (4), depois os pares. `/reports` merece atenção mesmo sendo só 2, por serem domínios não relacionados. Nenhum destes vira `CORREÇÃO DIRETA` sem antes provar colisão real — hipótese, não conclusão.

---

### Item 7 — Jobs e workers (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: consolidar o inventário de workers (parcialmente levantado no item 1) e achar workers que existem como arquivo mas nunca são chamados.
DENOMINADOR: todos os arquivos em backend/src/workers/; comparação com o que BOOT.ts realmente inicia; mecanismo de gate (isFinancialWorkerEnabled); qualquer entrypoint de worker separado do servidor HTTP.
MÉTODO: listar arquivos em workers/, cruzar com os já identificados no item 1, ler o gate central, checar tipo/typecheck do BOOT.ts.
CRITÉRIO DE CONCLUSÃO: todo arquivo de worker classificado como (a) sempre iniciado, (b) iniciado sob flag, (c) nunca iniciado.
FORA DE ESCOPO: lógica interna de cada worker — fica para auditoria profunda por família (Rodada 10, dinheiro).
```
**Examinei 25 de 25 arquivos em `backend/src/workers/` — fechado.**

**Achados comprovados:**

1. **`PROVADO` — 24 dos 25 arquivos de worker são de fato iniciados por `BOOT.ts`** (11 sempre-on: Payment, Idempotency Cleanup, Event Outbox, Handler Failure, Saga Timeout, Reconciliation Scheduled, Reconciliation Engine, Risk Identity Reconcile, Ledger Snapshot, Governance Execution, Governance Financial Action, Governance Funding; 12 sob flag fail-closed estrita: Settlement, Release, Payout, Reversal, Bank Settlement, Financial Alert, Financial Metrics, Risk Analysis, SLA Monitor, Treasury Distribution, Treasury Split, Governance Funding Commitment).
2. **`PROVADO` — o único arquivo não iniciado (`payout-worker.ts`) está deliberadamente tombstoned, não órfão silencioso.** Comentário em `BOOT.ts`: *"O worker LEGADO seller_available→seller_payout está TOMBSTONED (payout-worker.ts) e não é mais iniciado"* — substituído por `actor-wallet-payout-worker.ts`. Igual ao padrão de disciplina já visto em `organizers.routes.ts` (item 3) e nos comentários de remoção de rota duplicada (Anexo A) — a equipe documenta quando desliga algo de propósito.
3. **`PROVADO` — `financial-worker-gate.ts` é um gate genuinamente fail-closed:** só a string exata `'true'` habilita; ausente/vazio/`'TRUE'`/`'1'`/`'yes'` = OFF; sem auto-enable por `NODE_ENV`; sem bypass. Comentário explícito distingue esse gate do `isFeatureEnabled` genérico (que é fail-OPEN por padrão, visto no item 3/RFQ) — dois mecanismos de flag DIFERENTES no mesmo código, com polaridade oposta e propósito declarado (dinheiro vs. feature normal). Não confundir um com o outro é importante e está bem documentado.
4. **`PROVADO` — achado maior deste item: `backend/BOOT.ts` está FORA do projeto TypeScript e roda sem nenhuma rede de segurança de tipo.** `tsconfig.json` declara `rootDir: "./src"` e `include: ["src/**/*", ...]` — `BOOT.ts` vive no root do backend, fora de `src/`, logo nunca é compilado nem type-checked por `npm run typecheck`/`npm run build`. Prova concreta do efeito: `BOOT.ts` chama `isFinancialWorkerEnabled('ENABLE_TREASURY_DISTRIBUTION_WORKER')` e `isFinancialWorkerEnabled('ENABLE_TREASURY_SPLIT_WORKER')` — duas strings que **não existem** no union type `FinancialWorkerFlag` (que só declara 10 flags). Isso seria erro de compilação garantido em qualquer arquivo dentro de `src/`. Rodei `npm run typecheck` para confirmar: `EXIT:0`, zero erros — porque `BOOT.ts` nunca é examinado. Efeito em runtime é nulo neste caso (o gate faz comparação de string pura, funciona independente do tipo) — mas é sorte de desenho, não garantia; um erro de tipo mais grave em `BOOT.ts` passaria despercebido do mesmo jeito.
5. **`PROVADO` — `dist/BOOT.js` existe mas é um artefato morto: 0 bytes, datado de 2026-07-15**, 4 dias mais velho que o `BOOT.ts` fonte atual (28KB, 2026-07-19). Não é uma compilação real — é resíduo de algum processo anterior (consistente com o achado 4: `BOOT.ts` nunca é de fato compilado por este `tsconfig`). Ver CAUSA-RAIZ-002 em B.10: junto com o achado do item 1 (`dist/server.js` não chama `startServer()`), confirma que **não existe hoje um caminho de build de produção verificado** — só `npm run dev` (`tsx watch BOOT.ts`, execução direta do fonte) roda a aplicação real e completa.

**Não auditado neste item:** lógica interna de cada worker (o que cada um efetivamente faz, se está correto); se algum worker roda fora do processo do servidor HTTP (ex. processo separado/cron externo) — não encontrado nenhuma evidência disso, mas não foi buscado ativamente fora de `BOOT.ts`.

**Fila de destino:** `DECIDE`/`AUDITORIA PROFUNDA` para CAUSA-RAIZ-002 (ausência de build de produção verificado) — é uma decisão institucional (trazer `BOOT.ts` para dentro de `src/`? manter fora e aceitar zero type-safety? consertar `dist/server.js`?), não um bug de uma linha. `REMOÇÃO/CONTENÇÃO` para o artefato morto `dist/BOOT.js` (0 bytes) — candidato a limpeza trivial, mas não fiz (fase é levantamento, não correção).

---

### Item 8 — Feature flags (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: inventariar todo mecanismo de feature flag no backend e sua polaridade padrão (fail-open vs fail-closed) — já vimos 2 polaridades opostas nos itens 3 e 7.
DENOMINADOR: core/features/feature-flags.ts (item 3); workers/financial-worker-gate.ts (item 7); core/config/feature-flags.service.ts (citado em app.builder.ts, arquivo/nome diferente); core/config/observation-mode.service.ts (item 2).
MÉTODO: grep por arquivos "*feature-flag*"/"*observation-mode*"; ler cada um; comparar convenção de parsing de string→boolean.
CRITÉRIO DE CONCLUSÃO: lista de todo mecanismo de flag encontrado, com polaridade e convenção de string.
FORA DE ESCOPO: qual flag está ligada hoje no ambiente real (depende do .env, não do código).
```
**Examinei 4 de 4 arquivos de flag encontrados — fechado.**

**Achados comprovados:**

1. **`PROVADO` — existem 4 arquivos de mecanismo de flag, sem registro único, sem convenção compartilhada de parsing:**

| Arquivo | Flags | Polaridade padrão | Convenção de string |
|---|---|---|---|
| `core/features/feature-flags.ts` → `isFeatureEnabled` | RFQ, BUNDLES, MESSAGING | **fail-OPEN** (ausente = true) | `.toLowerCase() === 'true'` (case-insensitive) |
| `core/features/feature-flags.ts` → `isFinancialEnabled` | FEATURE_FINANCIAL_ENABLED | fail-CLOSED | `=== 'true'` exato (case-sensitive) |
| `workers/financial-worker-gate.ts` → `isFinancialWorkerEnabled` | 12 flags de worker (item 7) | fail-CLOSED | `=== 'true'` exato — mesma convenção do item acima, mas implementação separada, não reaproveitada |
| `core/config/observation-mode.service.ts` → `isEnabled` | OBSERVATION_MODE | fail-CLOSED | `=== 'true'` exato — terceira implementação independente da mesma convenção |
| `core/config/staging.config.ts` → `fundVisibilityEnabled` | FUND_VISIBILITY_ENABLED | fail-OPEN, mas por **negação**: `!== 'false'` (só a string `'false'` desliga; `'FALSE'`/`'0'`/`'no'` NÃO desligam) | inversa, única no lote |
| `core/config/staging.config.ts` → `procurementCampaignEnabled` | ENABLE_PROCUREMENT_CAMPAIGN | fail-CLOSED | aceita `'true'` OU `'1'` — mais permissivo que os outros fail-closed |

Ou seja: **3 convenções de string diferentes** (`.toLowerCase()==='true'` case-insensitive; `==='true'` exato; `!=='false'` invertido; aceitar `'true'` ou `'1'`) espalhadas em 4 arquivos, nenhum reaproveitando parsing do outro. Isso bate exatamente com a preocupação original do `PLANO_RECUPERACAO.md` (Fase 4: "feature flag tratada como autoridade").
2. **`PROVADO` — a polaridade fail-open vs fail-closed parece deliberada, não acidental, e é coerente por família:** tudo que é dinheiro (`isFinancialEnabled`, os 12 workers) é fail-closed estrito; tudo que é produto/UI (RFQ, Bundles, Messaging, fund visibility) é fail-open; `OBSERVATION_MODE` (freeze estrutural) é fail-closed. O comentário do item 3 (`F-SERVICE-ORDER-CONFIRM-TERMS-DEFAULT-ON-FLAG-FIX`) já documenta um incidente real causado por essa distinção não ter sido respeitada uma vez — a disciplina existe porque já doeu, não é acidente.
3. **`FORTEMENTE INDICADO` — nenhum dos 4 arquivos referencia os outros 3.** Não há um "catálogo de flags" único, nem uma função utilitária compartilhada de parse boolean de env var. Cada arquivo resolve string→boolean à sua própria maneira. Isso não é um bug funcional (cada um funciona isoladamente, testado no item correspondente) — é um risco de manutenção: um novo flag pode escolher a convenção errada por não saber que já existem 3 outras.
4. **`NÃO AUDITADO` — se existe algum outro flag "fantasma"** (lido diretamente via `process.env.ALGO === 'x'` inline em algum arquivo de rota, fora destes 4 arquivos centrais) — não foi buscado de forma exaustiva no código inteiro (seria grep genérico em `process.env` por todo o repo, fora do denominador declarado desta rodada).

**Não auditado neste item:** valores reais configurados no `.env` de desenvolvimento/produção (fora do escopo — é config, não código); busca exaustiva por flags inline fora dos 4 arquivos centrais.

**Fila de destino:** `HARDEN`/`CONVERGE` — não é correção urgente, mas é candidato natural a convergência futura (um único parser de boolean-env compartilhado, um catálogo único de flags) quando a fase de correção chegar. Nenhum achado aqui é `AUDITORIA PROFUNDA` — é tudo `PROVADO` por leitura direta, sem ambiguidade de autoridade/dinheiro/concorrência.

---

### Item 9 — Gates e runner (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que é "o runner" citado no cartório do projeto (ex. "runner 200/200"), e se ele de fato inclui todos os guards existentes ou se há gaps silenciosos.
DENOMINADOR: script/comando "runner"; lista de arquivos audit-*.mjs/.ts em backend/scripts/; lista de validate-pipeline-e2e-*/e2e-*/smoke-* em backend/src/scripts/; comparação "existe no disco" vs "está na lista executada".
MÉTODO: grep em package.json; leitura de run-regression-guards.mjs; diff entre arquivos referenciados e arquivos no disco; checagem se órfãos têm script npm individual.
CRITÉRIO DE CONCLUSÃO: saber se a lista do runner é igual, menor ou maior que o conjunto real de guards no disco, com números exatos.
FORA DE ESCOPO: rodar o runner de fato; corretude interna de cada guard individual.
```
**Examinei 281 de 281 arquivos `audit-*` em `backend/scripts/` — fechado, com números exatos.**

**Achados comprovados:**

1. **`PROVADO` — "o runner" = `backend/scripts/run-regression-guards.mjs`, chamado por `npm run validate:regression-guards`.** Confirmado por contagem: a lista `CMDS` tem exatamente **200 comandos** — número que bate com "runner 200/200" já citado na memória/cartório do projeto. Comentário do próprio arquivo explica por que existe como `.mjs` sequencial em vez de uma corrente `&&` inline: *"a corrente '&&' inline estourou o limite de linha do cmd.exe (Windows ~8191 chars)"* — origem prática, não arquitetural.
2. **`PROVADO` — 84 dos 281 guards `audit-*.mjs`/`.ts` que existem em `backend/scripts/` NÃO estão na lista do runner.** Ver `CAUSA-RAIZ-003` em B.10 — é o achado mais grave desta rodada. Amostra dos órfãos mais relevantes (cruzando com achados já registrados nesta mesma rodada): `audit-actor-impersonation-writes.mjs` (toca item 5 — actionContext sem enforcement central), `audit-group-b-financial-workers-tenant-loop-rls.mjs` (toca CAUSA-RAIZ-001 — tenant-loop), `audit-service-order-confirm-terms-financial-flag-failclosed.mjs` (o MESMO incidente documentado no comentário de `isFinancialEnabled`, item 3/8), mais guards de RLS financeiro, firewall financeiro e anti-revival (lista completa nos 84 nomes, registrada em B.10).
3. **`PROVADO` — 83 desses 84 órfãos não têm NENHUM script npm individual** (só executáveis via `tsx`/`node` manual, sabendo o nome exato do arquivo). Só 1 (`audit-actor-writer-boundaries.mjs`) tem script próprio (`validate:actor-writer-boundaries`) — mas mesmo esse não entra na contagem "200/200" por não estar na lista batch.
4. **`PROVADO` — categoria diferente e maior, não confundir com os guards: `backend/src/scripts/` tem 323 arquivos `validate-pipeline-e2e-*.ts`/`e2e-*.ts`/`smoke-*.ts`.** Estes são scripts de validação E2E nomeados por feature/decisão (ex. `validate-pipeline-e2e-pj-kyb-gate.ts`), tipicamente com seu próprio script `npm run validate:xxx`/`e2e:xxx` individual, e não fazem parte do `run-regression-guards.mjs` (que só chama `scripts/audit-*`). Padrão coerente com o que a memória do projeto já documenta: são prova pontual de uma frente no momento do selo, não regressão contínua — não é o mesmo tipo de gap que os 84 guards órfãos (que SÃO guards de regressão, feitos pra rodar sempre, mas não rodam).

**Não auditado neste item:** se os 84 guards órfãos ainda são semanticamente válidos (podem ter sido superados por um guard mais novo já na lista, com nome diferente, cobrindo a mesma preocupação) — isso exigiria ler cada um; se os 323 scripts E2E têm sua própria taxa de cobertura (quantos têm script npm vs quantos são só arquivo solto) — não contado.

**Fila de destino:** `AUDITORIA PROFUNDA`/`DECIDE` para `CAUSA-RAIZ-003` inteira — decidir, guard por guard nos 84, se: (a) ainda é válido e deve entrar na lista do runner, (b) foi superado por outro guard já presente, ou (c) é código morto de uma frente já fechada. Não é `CORREÇÃO DIRETA` — adicionar 84 linhas ao runner sem verificar cada uma poderia quebrar o boot verde atual com falsos positivos de guards desatualizados.

---

### Item 10 — Migrations e estado de banco (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o mecanismo de migrations (runner, registry) e o volume real de arquivos, sem reconciliar contra banco vivo.
DENOMINADOR: backend/migrations/ (contagem); backend/migrations_archive/; migrate.ts (runner); migration-runner-core.ts (registry/perfil); lista documentada de migrations ignoradas.
MÉTODO: contagem de arquivos; leitura de migrate.ts e migration-runner-core.ts.
CRITÉRIO DE CONCLUSÃO: quantidade de migrations, mecanismo de "já rodou", evidência de divergência sem precisar de banco real.
FORA DE ESCOPO: comparar contra banco de desenvolvimento real — fica para a Fase 5 do plano original (rodada própria, banco efêmero, fresh install/upgrade/rollback). NÃO AUDITADO aqui, deliberadamente.
```
**Examinei o mecanismo (runner + registry + perfil) — fechado.** NÃO examinei o estado real de nenhum banco (fora de escopo por desenho deste item).

**Achados comprovados:**

1. **`PROVADO` — 533 arquivos em `migrations/`, 313 em `migrations_archive/`** (arquivadas/superadas, nunca promovidas — já vimos exemplo concreto disso no item 4: `0382_health_relational_model.sql`, referenciado na memória do projeto sobre DECISION-0071).
2. **`PROVADO` — registry único: tabela `schema_migrations`**, gerida por `migrate.ts` (runner produtivo, 479 linhas) usando primitivas compartilhadas de `migration-runner-core.ts`. O próprio arquivo declara a semântica: descobre pendentes → valida sequência → aplica TODAS em ordem → falha em qualquer erro → só declara sucesso com pendências = 0. Comentário explícito proíbe qualquer stop-before/skip por variável de ambiente arbitrária no caminho produtivo (histórico: um hook `MIGRATION_STOP_BEFORE` foi removido por permitir schema parcial com exit 0 em produção — F-MIGRATION-RUNNER-TEST-HOOK-ISOLATION-CLOSURE).
3. **`PROVADO` — "migrations ignoradas" existe, é pequeno, versionado e bem documentado — não é gap misterioso:** `IGNORED_MIGRATIONS` (2 arquivos: `046_company_status_and_documents.sql`, inconsistência histórica de baseline; `20260713140000_neighborhood_alias_first_governed_flow.sql`, dormente por desenho — bate exatamente com a memória do projeto sobre a frente N1/Neighborhood, confirmando consistência entre código e registro histórico) + `LATENT_MODULE_MIGRATIONS` (11 arquivos: módulos Rides e Work-Instant, excluídos só sob o profile padrão `CORE_ONLY`, incluídos se `MIGRATION_PROFILE=FULL`). Achado positivo: ao contrário de vários outros itens desta rodada, este mecanismo tem disciplina clara — nenhum "SKIP silencioso sem explicação".
4. **`PROVADO` — `migrations/AUDITORIA_MIGRATIONS_COMPLETA.txt` (1352 linhas) NÃO é uma auditoria — é um dump bruto de todo o conteúdo SQL concatenado**, mesmo padrão do `02_decisions_FULL.txt` já visto no início desta investigação (arquivo com nome de "auditoria completa" que na verdade é material bruto, não análise). Não usar como se fosse conclusão pronta.

**Não auditado neste item (deliberadamente, por desenho):** se `schema_migrations` no banco de desenvolvimento real bate com os 533−11−2=520 arquivos esperados sob profile `CORE_ONLY`; se há objetos físicos no banco sem registro correspondente ou vice-versa; comportamento de fresh install/upgrade/rollback. Tudo isso é a Fase 5 do plano original — merece rodada própria com banco efêmero, não um item de leitura estática.

**Fila de destino:** `PROVE` — a reconciliação real (arquivo × registry × banco físico × esperado pela aplicação) precisa de execução contra banco (efêmero, per o plano original), não de leitura. Nenhum achado aqui vai para `AUDITORIA PROFUNDA` de autoridade/dinheiro — é tudo mecanismo, bem documentado, sem achado grave.

---

## 🏁 Rodada 0 — CONCLUÍDA (2026-07-20)

Todos os 10 itens fechados. `HEAD` em todos: `368eb72cd` (branch `rescue-structural`).

**As 3 causas-raiz transversais registradas (ver B.10 para o detalhe completo):**
- **CAUSA-RAIZ-001** — ausência de "tenant-loop" seguro: 6+ workers financeiros default-off pela mesma razão.
- **CAUSA-RAIZ-002** — não existe build de produção verificado: `dist/server.js` não liga o servidor: `BOOT.ts` (entrypoint real) fica fora do projeto TypeScript e `dist/BOOT.js` é artefato morto de 0 bytes.
- **CAUSA-RAIZ-003** — "runner 200/200" não inclui 84 dos 281 guards existentes, incluindo guards que tocam diretamente 3 outros achados desta mesma rodada (actionContext, tenant-loop, e o incidente de flag fail-open já documentado).

**Achados avulsos mais relevantes fora das causas-raiz:** duplicação viva do UnifyBank (`/bank`+`/admin`); RFQ com contrato frontend/backend quebrado (`LIVE_ROUTE_PREFIX_DEFECT`); PII de e-mail em log sem máscara em toda requisição autenticada; ao menos 10 prefixos de rota compartilhados por 2+ módulos, não verificados; 4 mecanismos de feature flag sem catálogo único; 2 plugins prontos e desconectados (`request-id`, `observation-mode` — este último é candidato natural ao mecanismo de "freeze" que a Fase 0 do plano original pedia).

**O que NÃO foi feito nesta rodada (por desenho, não por esquecimento):** nenhuma correção; nenhuma leitura de handler de `economic/v2`; nenhuma conexão a banco de dados real; nenhuma auditoria de autoridade fina (isso é Rodada 4).

### Próxima decisão humana

A Rodada 0 (Base transversal) está fechada. Conforme a regra de checkpoint (B.5), esta rodada não abre a próxima sozinha. Opções para Clayton:
1. Seguir para a **Rodada 1** (Cadastro, login e nascimento da identidade) — ordem original recomendada.
2. Abrir uma rodada dedicada a **resolver as 3 causas-raiz** desta rodada antes de seguir adiante (ex.: decidir o que fazer com os 84 guards órfãos, ou com o build de produção quebrado) — ainda como levantamento/decisão, não correção.
3. Priorizar a verificação dos **10 prefixos de rota compartilhados não verificados** (item 6) com o mesmo método usado no Anexo A.
4. Alguma outra prioridade que Clayton julgue mais urgente.

---

**Decisão do Clayton (2026-07-20):** disse "próximo" sem escolher explicitamente uma das 4 opções — interpretei como seguir a recomendação original (Rodada 1) e sinalizei essa interpretação antes de agir, para permitir correção imediata se fosse outra a intenção.

---

# Rodada 1 — Cadastro, login e nascimento da identidade

Jornada tratada em passos pequenos, um de cada vez (mesma disciplina da Rodada 0), não como um item monolítico.

## Passo 1 — Registro: da requisição até o commit no banco (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que acontece dentro de authService.register() (marcado como não auditado no item 3) até o commit no banco.
DENOMINADOR: auth.service.ts método register(); tabelas afetadas (global_users, users, profiles, identities, actors, user_referral_links); atomicidade; comportamento em falha parcial.
MÉTODO: leitura direta do método register() do início ao fim.
CRITÉRIO DE CONCLUSÃO: descrever a cadeia completa registro→identidade→tenant→Actor→resposta e dizer se é atômica.
FORA DE ESCOPO: login/refresh/logout (já cobertos no item 3); Actor em profundidade (próximo passo desta rodada).
```
**Examinei o método `register()` do início ao fim — fechado.**

**Achados comprovados:**

1. **`PROVADO` — achado positivo, sem ressalva: o nascimento de identidade é genuinamente atômico, com fronteira clara entre "requisito de nascimento" e "dado progressivo".** Dentro de UMA transação (`withTransaction`): `global_users` UPSERT por CPF (SSOT civil, compartilhado entre tenants) → checagem de CPF-claim fail-closed e concorrência-segura (linha travada até commit; "não dependemos de 23505, código morto") → `users` INSERT (409 se e-mail duplicado) → `profiles` INSERT com CPF (409 se CPF duplicado) → `identityService.ensureIdentityRowForGlobalUserTx` → `ensureUserActorTx` (nascimento do Actor — falha aqui é ROLLBACK total, comentário explícito "sem órfão") → aplicação do vínculo de indicação (se houver código), também dentro da mesma transação (DECISION-0119 D2: "não pode existir indicado sem vínculo"). Token só é gerado **depois** do commit.
2. **`PROVADO` — tenant é resolvido 100% server-side, consistente com o item 4.** O parâmetro `tenantId` (vindo do header `x-tenant-id`) é explicitamente descartado (`void tenantId`) — sempre resolve para `unificard-inicial`. Comentário cita DECISION-0115 D1 e nomeia até a frente futura para convite cross-tenant (`F-C1-TENANT-INVITE-RESOLUTION`, ainda sem substrato).
3. **`PROVADO` — validações pré-transação corretas (zero escrita antes de saber que vai dar certo):** e-mail duplicado, CPF ausente/inválido, código de indicação inválido — todas checadas e podem devolver erro ANTES de abrir a transação. PILOT_MODE (convite obrigatório) também é gate pré-escrita.
4. **`PROVADO` — pós-commit é deliberadamente best-effort, e o código diz isso explicitamente:** perfil progressivo (fullName/birthdate/gender), aceite de convite piloto, geração do código de indicação PRÓPRIO do novo usuário (legado + actor-scoped) — todos em `try/catch` com log de warning, não derrubam a resposta de sucesso. Comentário: "nascimento já é COMPLETO e atômico" antes desse trecho rodar — ou seja, o código já documenta a fronteira que author está desenhando de propósito, não por acidente.
5. **`NÃO AUDITADO` — o conteúdo de `ensureUserActorTx` e `identityService.ensureIdentityRowForGlobalUserTx`** (o que exatamente cada um grava) fica para o próximo passo desta rodada ("Actor PF").

**Não auditado neste passo:** corpo de `ensureUserActorTx`/`ensureIdentityRowForGlobalUserTx`; o que acontece no lado do frontend após receber o token (próximo passo, "primeiro acesso"); duplicação de identidade por caminhos alternativos de cadastro (ex. login social, se existir — não buscado).

**Fila de destino:** nenhum achado grave — é o primeiro passo desta rodada com resultado majoritariamente positivo. `NÃO AUDITADO` (achado 5) alimenta diretamente o próximo passo, não é handoff para fila de correção.

---

**Próxima ação (concluída):** o passo seguinte já nasceu como a primeira pergunta da Rodada 2 (Actor) — ver abaixo, para manter o documento alinhado com a sequência de rodadas do Anexo B.3.

---

# Rodada 2 — Actor e projeção mínima de perfil

## Passo 1 — O nascimento do Actor (`ensureUserActorTx`/`ensureIdentityRowForGlobalUserTx`) (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que ensureUserActorTx e ensureIdentityRowForGlobalUserTx gravam de fato, e a relação entre user_id, global_user_id e actor_id.
DENOMINADOR: modules/identity/actor-writer.service.ts; core/identity/identity.service.ts (ensureIdentityRowForGlobalUserTx).
MÉTODO: leitura direta dos dois arquivos/métodos.
CRITÉRIO DE CONCLUSÃO: descrever o que cada um grava e explicar a relação entre os 3 IDs.
FORA DE ESCOPO: troca de Actor, múltiplos actors por pessoa, capabilities (Rodada 4 — Autoridade).
```
**Examinei os dois arquivos/métodos declarados — fechado.**

**Achados comprovados:**

1. **`PROVADO` — `actor-writer.service.ts` é, por autodeclaração, o WRITER ÚNICO de actors** ("§4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD" — comentário de topo: *"Toda criação de actor passa por aqui. Nenhum módulo de produto chama actor.repository diretamente"*). Confirma na prática a doutrina já registrada na memória do projeto (Actor = unidade soberana). Delega para `socialPortsRegistry.getActorRepository()` — padrão ports/adapter, com uma dívida técnica CONSCIENTE e documentada no próprio arquivo (acoplamento com o módulo `social` como "engine", resolução prevista em RFC futura) — não é dívida escondida.
2. **`PROVADO` — existem 3 tipos de Actor, cada um com âncora civil humana obrigatória por desenho:** `ensureUserActor`/`ensureUserActorTx` (Actor humano/PF); `ensurePageActor`/`ensurePageActorTx` (Actor de empresa — exige `responsibleActorId`, comentário: *"nenhuma empresa existe sem âncora humana §4.8.2"*); `ensureGroupActor` (Actor de grupo — exige `responsible_actor_id = groups.owner_actor_id`). Todos idempotentes (seguro chamar de novo) e cada um tem variante transacional (`*Tx`, recebe o client do chamador) e não-transacional (abre sua própria query) — mesmo padrão usado no nascimento atômico do passo 1.
3. **`PROVADO` — `ensureIdentityRowForGlobalUserTx` grava em `identities` (chave `global_user_id`), derivando `tax_id`/`tax_id_type='cpf'` do CPF do global_user, com `kyc_status='pending'`/`kyc_level='none'` como default.** Idempotente (`ON CONFLICT DO NOTHING` + pre-check). Existe uma versão NÃO-transacional privada (`ensureIdentityRowForGlobalUser`) com a MESMA lógica SQL duplicada (usa `pool.query` direto em vez do client da transação) — não é bug, mas é duplicação de manutenção: se a regra mudar, precisa mudar nos dois lugares.
4. **`PROVADO` — resposta à pergunta central do denominador: `actor_id` e `user_id` são o MESMO valor para o Actor humano, por desenho de schema.** Comentário direto no código: *"Garante actors no schema Genesis (id = users.id, actor_human, FK identities)"* — ou seja, `actors.id = users.id` para o Actor de uma pessoa física; `global_user_id` é um terceiro identificador, deliberadamente diferente e compartilhado entre tenants (a identidade civil), enquanto `user_id`/`actor_id` são por-tenant. Isso explica por que tantos trechos já vistos nas rodadas anteriores (`req.user.id` usado como alias, `actionContext.actorId`, `globalUserId` sempre resolvido à parte) tratam esses 3 conceitos com tanto cuidado — eles realmente não são intercambiáveis, exceto no caso específico `actor_id === user_id` do Actor humano.

**Não auditado neste passo:** implementação de `findOrCreateUserActorTx` dentro do repository (a query SQL real de criação de actor); o que acontece quando uma pessoa tem múltiplos actors (troca de contexto) — isso é o próximo fio natural desta rodada.

**Fila de destino:** nenhum achado grave. `CONVERGE`/nota de manutenção leve para a duplicação de lógica entre `ensureIdentityRowForGlobalUserTx` e `ensureIdentityRowForGlobalUser` (mesma regra, dois lugares) — não urgente, registrar para quando a fase de correção chegar.

---

## Passo 2 — Actor ativo no contexto e troca de Actor (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender como o sistema resolve "qual Actor está ativo" e como a troca funciona — é estado no servidor ou só client-side?
DENOMINADOR: GET /social/actors/available; POST /social/actors/switch; SessionProvider.tsx (onde ACTOR_STORAGE_KEY é de fato escrito).
MÉTODO: leitura direta dos 2 handlers + trecho relevante do SessionProvider.
CRITÉRIO DE CONCLUSÃO: descrever de onde vem a lista de actors e como a troca realmente acontece.
FORA DE ESCOPO: capabilities/autoridade de cada actor (Rodada 4).
```
**Examinei os 2 handlers + o bootstrap do frontend — fechado.**

**Achados comprovados:**

1. **`PROVADO` — achado positivo: `GET /social/actors/available` já teve exatamente o tipo de vulnerabilidade que o item 5 (Action Context) apontou como risco teórico — e já foi CORRIGIDA.** Comentário no código (`F-SOCIAL-ACTORS-AVAILABLE-DEAD-HINT-BRANCH-HYGIENE`): existia um branch morto que decidia o "subject" da listagem pelo `actionContext.actorId` (hint do cliente) — o que vazaria os actors/empresas de OUTRO usuário (cross-user leak). Foi removido; hoje o subject é ancorado incondicionalmente em `req.user.id` (servidor), fail-closed por construção. Isso é evidência concreta de que o item 5 estava certo em marcar "autoridade indireta via actionContext" como risco real de categoria — aqui já mordeu uma vez e foi corrigido.
2. **`PROVADO` — NÃO existe estado de "actor atual" no servidor. É 100% client-side, por request.** `POST /social/actors/switch` é só um evento de AUDITORIA (*"Registra troca de Actor ativo... NÃO é feed, NÃO é visível ao usuário final"*) — não é o mecanismo de autoridade; ele só registra que uma troca aconteceu, para fins de log/segurança. O "Actor ativo" de verdade é o valor em `localStorage['unificard_active_actor_id']` no navegador, reenviado a cada request via header `x-action-context` (já visto no item 5) — o backend nunca guarda "qual actor este usuário está usando agora" entre requisições.
3. **`PROVADO` — sequência de bootstrap do frontend é: tenant → actors disponíveis → perfil**, nessa ordem (comentário explícito em `SessionProvider.tsx`: *"FASE 2 (Contexto): Carregando actors disponíveis... ActionContext no backend exige actorId: só após esta fase localStorage[...] fica definido"*). `Login.tsx` limpa o `localStorage` do actor ativo no login (evita herdar actor de sessão anterior/outro usuário no mesmo navegador).

**Não auditado neste passo:** lógica exata de qual actor é auto-selecionado quando há mais de um disponível (não lido em profundidade); o que acontece se `POST /social/actors/switch` nunca for chamado (a troca funciona sem ele, já que é só auditoria — mas não confirmei se algum outro código depende dele para algo funcional).

**Fila de destino:** nenhum achado grave — mais um passo desta rodada com resultado majoritariamente positivo, incluindo confirmação de que a preocupação do item 5 já se provou real (e já foi corrigida) em pelo menos um ponto concreto.

---

## Rodada 2 — encerrada por ora

Os dois passos desta rodada (nascimento do Actor + Actor ativo/troca) cobrem o essencial de "quem está agindo" sem entrar em capabilities/autoridade (isso é a Rodada 4, deliberadamente). Página completa do Actor, compositor e projeção de perfil ficam para a Rodada 7 (mais adiante na fila do Anexo B).

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada do Anexo B.3 (Rodada 3).

---

# Rodada 3 — Código de indicação (primeira metade, sem dinheiro)

## Passo 1 — Geração e persistência do código (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender como o código de indicação nasce e é persistido — confirmar se são dois sistemas paralelos (legado × actor-scoped) ou se um é wrapper do outro.
DENOMINADOR: referral.service.ts (geração/criação); coexistência legado (users.referral_code) × actor-scoped (actor_referral_codes, DECISION-0139); constraints de unicidade no banco (via migrations).
MÉTODO: leitura direta de referral.service.ts + grep de UNIQUE nas migrations relevantes.
CRITÉRIO DE CONCLUSÃO: descrever formato/geração/persistência e confirmar se há 2 sistemas paralelos de fato.
FORA DE ESCOPO: aplicação do vínculo A→B (já visto na Rodada 1); resolver público (já visto no item 3); recompensa/comissão/split (Rodada 10).
```
**Examinei `referral.service.ts` + as migrations relevantes de unicidade — fechado.**

**Achados comprovados:**

1. **`PROVADO` — confirmam-se DOIS sistemas paralelos reais e coexistentes por decisão institucional (DECISION-0139), não por acidente:**
   - **Legado**: `getOrCreateReferralCode` gera um código de 8 caracteres hex (`crypto.randomBytes(4)`), checa unicidade em loop (até 10 tentativas via SELECT), depois faz `UPDATE users SET referral_code = $2` — persistido em `users.referral_code`.
   - **Canônico actor-scoped**: `actor_referral_codes`, gerido por `actor-referral-code.service.ts` (não lido em profundidade nesta rodada), com dono econômico (`owner_actor_id`) em vez de apenas `user_id`.
2. **`FORTEMENTE INDICADO` — o caminho legado tem uma janela de corrida real, sem rede de segurança no banco.** Confirmei via `migrations/0066_profile_support_tables.sql`: `ADD COLUMN IF NOT EXISTS referral_code TEXT` — **sem UNIQUE**. O padrão em `getOrCreateReferralCode` é check-then-update (SELECT de unicidade, depois UPDATE separado, sem transação/lock entre os dois) — em tese, duas requisições concorrentes podem gerar o mesmo candidato antes de qualquer uma escrever, resultando em dois usuários com o mesmo código legado, sem constraint que rejeite isso. Severidade prática: BAIXA — o espaço de 4 bytes aleatórios (~4 bilhões de combinações) torna colisão real extremamente improvável, mesmo sob carga; não atinge a régua de "crítico, vivo e explorável" da trava B.8, mas é `HARDEN` real (falta `UNIQUE` + tratamento de `23505`, ou um `UPSERT` atômico).
3. **`PROVADO` — o sistema canônico é mais bem protegido no banco:** `actor_referral_codes` tem DOIS índices únicos reais (`migrations/20260617120000_actor_referral_codes_and_actor_links.sql`): um por `(tenant_id, code)` e outro garantindo só um código ATIVO por dono (`idx_actor_referral_codes_one_active_per_owner`). O sistema mais novo corrigiu exatamente a lacuna que o legado tem.
4. **`PROVADO` — o resolver público (`resolveReferralCodeCandidate`, já visto no item 3) e o writer transacional (`applyReferralCodeTx`, já visto na Rodada 1) checam na MESMA ORDEM: actor-scoped primeiro, legado depois** — consistência real entre leitura e escrita, comentário explícito confirma isso ("mesma ordem do writer soberano"). Também fail-closed contra `actor_system` como dono econômico válido, checado via JOIN mesmo que uma linha "crua" tente burlar isso.

**Não auditado neste passo:** `actor-referral-code.service.ts` em profundidade (como o código actor-scoped é de fato gerado — só vi que existe e tem constraints melhores); se o código legado algum dia será migrado/aposentado.

**Fila de destino:** `HARDEN` (não urgente) para a falta de `UNIQUE` em `users.referral_code` — achado 2. Nenhum achado grave o suficiente para `AUDITORIA PROFUNDA` ou trava de risco vivo.

---

## Passo 2 — Entrada no cadastro, atribuição, idempotência e antiautoindicação (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: terminar de ler applyReferralCodeTx e confirmar com evidência direta (não só comentário) antiautoindicação e idempotência.
DENOMINADOR: resto de applyReferralCodeTx (referral.service.ts, a partir de onde parou no passo 1); schema/constraints de user_referral_links.
MÉTODO: leitura direta do restante do método + grep da migration de user_referral_links.
CRITÉRIO DE CONCLUSÃO: confirmar mecanismo de antiautoindicação e idempotência com código/schema, não com comentário.
FORA DE ESCOPO: recompensa/comissão/split (Rodada 10).
```
**Examinei o restante do método + a migration da tabela — fechado, com evidência de schema, não só de comentário.**

**Achados comprovados:**

1. **`PROVADO` — antiautoindicação tem defesa em profundidade real, confirmada em dois níveis independentes:** checagem explícita no código (`if (referrerUserId === referredUserId) throw`) **E** constraint física no banco (`migrations/20260613120000_user_referral_links.sql`: `CONSTRAINT chk_user_referral_links_no_self CHECK (referrer_user_id <> referred_user_id)`). Não é alegação de comentário — confirmei a migration com o `CHECK` real.
2. **`PROVADO` — idempotência também é real no schema, não só no `ON CONFLICT` do código:** `CONSTRAINT uq_user_referral_links_referred UNIQUE (tenant_id, referred_user_id)` — é essa constraint que torna o `ON CONFLICT (tenant_id, referred_user_id) DO NOTHING` válido e efetivo (um único vínculo de indicação por indicado, por tenant, garantido no banco).
3. **`PROVADO` — resolução do `referrerUserId` cobre os dois substratos corretamente:** se actor-scoped, resolve o humano por trás do dono (`owner.user_id` ou, se for page/group, o `responsible_actor_id`); se legado, busca por `users.referral_code` e depois localiza o actor humano correspondente. Se nenhum dos dois resolver um humano rastreável → `throw` (fail-closed, sem inventar dono).
4. **`PROVADO` — fail-closed pós-insert: o código reconsulta `user_referral_links` logo após o INSERT** para confirmar que o vínculo realmente existe, e lança erro (rollback total da transação de nascimento) se não existir — proteção explícita contra falha silenciosa (ex. tabela ausente, trigger bloqueando).
5. **`PROVADO` — `user_referral_links` tem RLS não só habilitado mas FORÇADO** (`FORCE ROW LEVEL SECURITY`, migration `20260625120000_rls_force_referral_civil.sql`) — isolamento de tenant mais rígido que o padrão (força até para o dono da tabela).
6. **`NÃO AUDITADO` — existe uma segunda porta de entrada para aplicar código de indicação:** comentário no código aponta `POST /referral/apply` (pós-cadastro, não-transacional, abre sua própria transação e delega para o mesmo writer `applyReferralCodeTx`). Não fui ler essa rota nesta passagem — mas o writer sendo o mesmo (reaproveitado, não duplicado) é um bom sinal preliminar.

**Não auditado neste passo:** a rota `POST /referral/apply` em si (quem pode chamá-la, quando, se tem as mesmas proteções de pré-validação do fluxo de registro).

**Fila de destino:** nenhum achado grave — este passo é inteiramente positivo. Antiautoindicação e idempotência são reais, testáveis no schema, com defesa em profundidade (app + banco), não apenas alegação de comentário.

---

## Rodada 3 — primeira metade concluída

Cobrimos geração/persistência (passo 1) e aplicação/atribuição (passo 2) do código de indicação, sem tocar recompensa/comissão (isso é Rodada 10, dinheiro, propositalmente). Resultado geral desta rodada: um dos mecanismos mais bem protegidos encontrados até agora nesta investigação — dois sistemas paralelos coexistindo por decisão (não por acidente), com o mais novo corrigindo lacunas do legado, e proteções reais no banco (CHECK, UNIQUE, RLS forçado), não só em comentário.

**Decisão:** Clayton disse "próximo" sem escolher — segui para a Rodada 4, dado que havia 2 pendências reais esperando lá.

---

# Rodada 4 — Autoridade e permissões

## Passo 1 — `canRepresentActor` e o guard órfão de personificação (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que canRepresentActor de fato verifica, e o que o guard órfão audit-actor-impersonation-writes.mjs (achado no item 9) realmente testa — ele pode responder a pergunta em aberto do item 5.
DENOMINADOR: authorizationService.canRepresentActor; scripts/audit-actor-impersonation-writes.mjs.
MÉTODO: leitura direta dos dois arquivos.
CRITÉRIO DE CONCLUSÃO: descrever a lógica real de canRepresentActor e o que o guard órfão verifica de fato.
FORA DE ESCOPO: CRUD completo de capability/grant; revogação/vigência (próximos passos desta rodada).
```
**Examinei os dois arquivos — fechado, e este passo conecta diretamente 3 achados de rodadas anteriores.**

**Achados comprovados:**

1. **`PROVADO` — `canRepresentActor` é um resolver de autoridade real, com 5 fontes em ordem fixa, fail-closed por padrão:** (1) ownership direto (actor humano = próprio user); (2) empresa, via `canManageCompany` canônico (com nota explícita de que o check legado `checkOwnership` era incompleto — ignorava `role='owner'`); (3) grupo, via ownership de `groups`; (4) "registry-bônus" para entidades sem coluna própria no actor (ex. events); (5) delegação ativa **só** com escopo FULL (`scopes` inclui `'*'`). Input inválido (tenant/user/actor vazio) → `false` direto.
2. **`PROVADO` — a fonte 5 (delegação) já teve um bug de escopo real, documentado e corrigido no próprio código:** comentário explícito diz que ANTES, qualquer delegação ativa retornava `true` aqui, tornando um delegado de escopo estreito (ex. só `post:create`) super-privilegiado em TODA rota gated por `canRepresentActor`. Corrigido para exigir `scopes.includes('*')`. Hoje "latente" (0 delegações ativas no ambiente, per comentário) — ou seja, o bug já não pode ser explorado no estado atual dos dados, mas a lição está registrada.
3. **`PROVADO` — achado que conecta 3 rodadas anteriores: `audit-actor-impersonation-writes.mjs` (órfão do runner, item 9) documenta que personificação de actor via `actionContext.actorId` NÃO é risco teórico — já foi encontrada de verdade, em 2026-07-04 (DT-AUTHORITY-REGUA-PELA-METADE), em pelo menos 5 handlers:** `identity POST /update` (editava a identidade CIVIL de outra pessoa — severidade HIGH), `social POST /posts/:id/reactions`+`/comments` (reagir/comentar COMO outro actor — MEDIUM), `feed POST /action` (gravar ação sob o `globalUserId` de outro — LOW), mais `me-active-location` e `social-inbox` (2 handlers cada). Todos foram corrigidos, e o guard é a trava de regressão — só que essa trava está entre os 84 guards que o runner não executa (CAUSA-RAIZ-003). Registrado como **CAUSA-RAIZ-004** em B.10.
4. **`PROVADO` — o guard também documenta uma evolução de desenho real, não só uma correção:** o gate de `social reactions/comments` inicialmente usava `canRepresentActor` (representação ampla), mas foi TROCADO por `canActAs(..., 'interact_feed')` (DECISION-0189B D4/D5) porque a representação ampla "sombreava" grants finos — um gestor conseguia personificar enquanto um membro com grant estreito era barrado. O guard hoje falha se o código VOLTAR ao padrão antigo (mais fraco) — está protegendo contra regressão de design, não só contra bug.

**Não auditado neste passo:** os outros 147 arquivos que consomem `actionContext.actorId` além dos 5 já cobertos por este guard específico (a pergunta central do item 5 continua parcialmente aberta — agora sabemos que o padrão de risco é real e já mordeu 5 vezes, mas não sabemos se há uma 6ª ocorrência não corrigida em algum lugar).

**Fila de destino:** `DECIDE`/`AUDITORIA PROFUNDA` de prioridade alta — ligar `audit-actor-impersonation-writes.mjs` ao runner canônico é candidato a `CORREÇÃO DIRETA` rápida e de baixo risco (é só adicionar a chamada a uma lista, não muda comportamento). Já a pergunta maior — "existe uma 6ª ocorrência não corrigida entre os 152 consumidores?" — é auditoria de superfície grande, mesma natureza do achado 3 do item 5, e deveria usar como MODELO o próprio método deste guard (grep estrutural de presença do call de autoridade) em vez de leitura manual arquivo por arquivo.

---

**Decisão:** Clayton disse "próximo" sem escolher — dado que a fase é levantamento e não correção (regra fixa desde o início), segui mapeando (opção "continuar a Rodada 4"), não fiz nenhuma correção.

## Passo 2 — Capability/grant: modelo, escrita e revogação (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o que é uma "capability"/"grant" concretamente — schema, writer, canActAs, revogação e vigência.
DENOMINADOR: authorizationService.canActAs; modules/authority/actor-capability-grant.service.ts (grant/list/revoke/hasCapabilityGrant).
MÉTODO: leitura direta dos dois arquivos.
CRITÉRIO DE CONCLUSÃO: descrever o ciclo de vida de um grant com evidência de código.
FORA DE ESCOPO: função DB fn_grant/fn_revoke (SQL/migration, um nível abaixo); catálogo completo de permission keys.
```
**Examinei os dois arquivos declarados — fechado.**

**Achados comprovados — este passo foi o mais maduro de toda a investigação até agora:**

1. **`PROVADO` — separação de eixos explícita e limpa, documentada no próprio código (DECISION-0113/0134):** REPRESENTAÇÃO (`canRepresentActor` — "posso vestir este actor?") ≠ CAPABILITY GRANT (`hasCapabilityGrant` — "este actor recebeu esta capability neste escopo?") ≠ OWNER (autoridade nativa do dono; grant é aditivo só para não-donos). Três perguntas diferentes, não confundidas.
2. **`PROVADO` — `canActAs` (o resolver fino, por `PermissionKey`) tem uma trava terminal explícita para dinheiro:** `PORTA_HOLD_KEYS` — lista fixa de chaves sensíveis financeiras que são **DENY para QUALQUER actor**, incondicionalmente, "nem self/ownership as concede" — estrutural, não depende de tabela. Isso é a materialização em código da "PORTA 01 fechada" já citada extensivamente na memória do projeto — não é só política, é enforcement real, no caminho de decisão, antes de qualquer outra checagem.
3. **`PROVADO` — existe um mecanismo de "quarentena de autoridade" que sobrepõe representação:** `assertScopeAuthorityNotQuarantined` — mesmo que alguém PROVE que pode representar um actor de escopo, se esse actor (ou sua âncora humana) estiver efetivamente bloqueado (`atl_blocked_actors`, via `isActorEffectivelyBlocked`, primitivo compartilhado com o "offering-activation-gate"), a autoridade fica CONGELADA para conceder/revogar capability. Comentário explícito: "representação ≠ autoridade-ativa". Fail-closed, checado ANTES de qualquer escrita.
4. **`PROVADO` — allowlist explícita separa capabilities normais de financeiras:** `assertNonFinancialAllowlisted` rejeita (403) qualquer `capabilityKey` fora de `ACTOR_SCOPED_CAPABILITY_KEYS`, com mensagem explícita: *"Financeiro é CRITICAL e exige frente própria (3 paralelas)"* — o time sabe que capability financeira é uma categoria à parte e cercou isso deliberadamente, não por esquecimento.
5. **`PROVADO` — defesa em profundidade com papéis claros:** `assertActorInTenant` é checagem de SERVIÇO (mensagem de erro melhor), explicitamente NÃO a barreira principal — a barreira real é a função de banco `fn_grant`/`fn_revoke` (não lida nesta passagem, ver "não auditado"). `resolveResponsibleHumanActorId` sempre resolve server-side (`actors.user_id = userId`), nunca recebe isso do cliente — mesmo padrão visto em toda a investigação até agora.
6. **`FORTEMENTE INDICADO` — criação/revogação de grant é atômica e auditável por desenho:** comentário descreve escrita via "FUNÇÕES CANÔNICAS transacionais" que exigem 5 elos por operação (actor representado, conta executora, actor humano responsável, key/grant usado, momento — DECISION-0171 §6.1-D), com evento append-only, e idempotência via `UNIQUE` parcial em `(tenant, grantee, capability, scope) WHERE active`. Marco `FORTEMENTE INDICADO` e não `PROVADO` porque não abri a função de banco em si (fora do denominador declarado) — só o comentário e a chamada no service.

**Não auditado neste passo:** a função de banco `fn_grant`/`fn_revoke` em si (SQL/migration); `hasCapabilityGrant` (o primitivo de enforcement, "DEFINIDO agora, NÃO aplicado a rota de negócio neste Slice" — ou seja, existe mas talvez ainda não seja chamado em produção; vale investigar depois); catálogo completo de `PermissionKey`/`PORTA_HOLD_KEYS`.

**Fila de destino:** nenhum achado grave. Este é o segundo passo consecutivo majoritariamente positivo na Rodada 4 (depois do passo 1, que trouxe o achado grave via CAUSA-RAIZ-004, mas cujo mecanismo central — `canRepresentActor` — também é sólido). `INVESTIGAÇÃO ADICIONAL` leve para confirmar se `hasCapabilityGrant` já está de fato em uso em alguma rota de negócio (o comentário sugere que não, no momento em que foi escrito).

---

**Decisão:** Clayton disse "próximo" sem escolher — continuei mapeando (revogação/vigência), sem corrigir nada.

## Passo 3 — Revogação e vigência do grant (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender como revoke() funciona e se existe vigência temporal (expiração automática) ou só revogação manual.
DENOMINADOR: revoke()/list()/hasCapabilityGrant() (resto do service, não lido no passo 2).
MÉTODO: leitura direta do restante do arquivo.
CRITÉRIO DE CONCLUSÃO: descrever revogação e confirmar se há expiração automática por tempo.
FORA DE ESCOPO: delegação (objeto diferente de capability grant).
```
**Examinei o restante do arquivo (grant/list/revoke/hasCapabilityGrant completos) — fechado.**

**Achados comprovados:**

1. **`PROVADO` — conceder e revogar exigem a MESMA base de autoridade, simétrica:** ambos exigem que quem age (concedente ou revogador) REPRESENTE o `scope_actor` (`canRepresentActor`) — autoridade vem de quem controla o escopo, não de quem é o grantee. Ambos passam pela mesma checagem de quarentena (`assertScopeAuthorityNotQuarantined`) antes de escrever.
2. **`PROVADO` — `reason` de revogação é campo PRÓPRIO, nunca sobrescreve o `reason` original da concessão** — comentário explícito confirma, e o código exige `reason.trim()` não-vazio antes de revogar (403 se ausente). Trilha de auditoria preserva os dois motivos separadamente.
3. **`PROVADO` — vigência temporal existe como campo de primeira classe:** `grant()` aceita `validUntil` (opcional, `null` = sem expiração). Confirma que grants PODEM ser temporários por desenho, não só permanentes-até-revogação-manual.
4. **`PROVADO` (upgrado de `FORTEMENTE INDICADO` no passo 2) — `hasCapabilityGrant` está confirmado, pelo próprio comentário do código, como NÃO aplicado a nenhuma rota de negócio ainda:** *"PRIMITIVO DE ENFORCEMENT (DEFINIDO agora; NÃO aplicado a nenhuma rota de negócio neste Slice)"*. Usa `findActive` (implica que a filtragem por `validUntil`/status ativo acontece no repository, não lido nesta passagem). Isso é DIFERENTE dos plugins órfãos da Rodada 0 (`request-id`, `observation-mode`) — aqueles foram esquecidos; este é construído-antes-do-uso, deliberadamente, com um gate de decisão de produto nomeado (`DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION`) para quando for ligado.

**Não auditado neste passo:** `actorCapabilityGrantRepository` (a função DB `fn_grant`/`fn_revoke`, e a query exata de `findActive` que decide o que conta como "ativo" — vigência + status); onde/se `DT-CALENDAR-OPERATOR-GRANT-AUTHORITY-DECISION` já foi decidida.

**Fila de destino:** nenhum achado grave — terceiro passo consecutivo desta rodada com resultado positivo. Nenhuma nova causa-raiz.

---

## Rodada 4 — checkpoint (não é fechamento; mecanismo central já bem mapeado)

Três passos cobriram: `canRepresentActor` (representação, 5 fontes) + o achado grave conectando 3 rodadas (`CAUSA-RAIZ-004`, personificação já provada real e não coberta pelo runner) + `canActAs`/`PORTA_HOLD` (permissão fina + trava de dinheiro) + ciclo de vida completo de capability grant (criar/listar/revogar/vigência). O mecanismo central de autoridade está bem entendido agora — sólido, fail-closed, com boas práticas (allowlist financeira separada, quarentena de autoridade, defesa em profundidade). Falta desta rodada, se Clayton quiser aprofundar mais tarde: catálogo completo de `PermissionKey`/roles legadas, delegação em detalhe, e a função DB `fn_grant`/`fn_revoke`.

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada (Rodada 5, Empresa).

---

# Rodada 5 — Criação e ciclo de empresa

Atenção: parte da autoridade empresarial já está SELADA (DECISION-0189D, campanha F-COMPANY-ACCESS-AUTHORITY, ver memória do projeto). O selo NÃO é reaberto aqui — esta rodada só verifica, por composição, se o nascimento da empresa se conecta corretamente a esse selo.

## Passo 1 — Nascimento da empresa: fiscal-first, DRAFT, atomicidade (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o nascimento de uma empresa (Actor PJ) e verificar, por composição, a ligação com a autoridade já selada (DECISION-0189D) e com o writer de page-actor já visto na Rodada 2.
DENOMINADOR: companies.service.ts → createCompany().
MÉTODO: leitura direta do método (grande — 400+ linhas — leitura seletiva por trecho relevante).
CRITÉRIO DE CONCLUSÃO: descrever a cadeia de nascimento e confirmar atomicidade, sem reabrir a partição de autoridade já selada.
FORA DE ESCOPO: partição fina de membership (SELADA, não reabrir); convite/aceite de gestor adicional (próximo passo).
```
**Examinei o método completo (seletivamente, por trecho) — fechado para o objetivo declarado.**

**Achados comprovados:**

1. **`PROVADO` — nascimento é atômico, mesmo padrão da Rodada 1 (PF):** `withTransaction` engloba `INSERT INTO companies` → `INSERT INTO company_users` → `ensurePageActorTx` (o MESMO writer de page-actor já visto na Rodada 2, reaproveitado, não duplicado). Confirma por composição que Rodada 2 e Rodada 5 se conectam corretamente.
2. **`PROVADO` — empresa nasce sempre em `DRAFT`, nunca ativa de imediato.** Prefill de dados da Receita Federal é explicitamente best-effort/não-bloqueante e NÃO promove o lifecycle — só `activateCompanyOperationally` (não lido nesta passagem) faz isso depois. CNPJ é validado na borda (dígito verificador local, sem chamada externa) ANTES de reservar qualquer identidade fiscal.
3. **`PROVADO` — actor humano do criador NUNCA é criado/reparado aqui — só lido.** Comentário explícito: *"a pessoa humana JÁ NASCE com identity+actor (C1). A criação de empresa NÃO cria nem repara actor humano"* — ausência é erro estrutural honesto (`COMPANY_CREATOR_ACTOR_MISSING`), não fallback silencioso. Consistente com a doutrina de âncora civil já vista na Rodada 2.
4. **`PROVADO` — verificação por composição com o selo DECISION-0189D deu certo:** o criador da empresa SEMPRE recebe `can_manage_company=true` **server-side**, independente do `role` escolhido no formulário e SEM confiar em `input.permissions.canManageCompany` do cliente — comentário nomeia o motivo (`F-PJ-CREATOR-INITIAL-AUTHORITY-ENFORCED`, evita "empresa órfã de gestor"). Os flags reais gravados passam por `softBlockService.validateFlags` contra o `SET_V1` (conjunto fechado da DECISION-0189 §2.4) — ou seja, o nascimento da empresa usa a MESMA validação da partição já selada, não uma paralela. Não reabri o selo; só confirmei que ele é respeitado aqui.
5. **`PROVADO` — anti-fraude real: máximo de 3 empresas em DRAFT/PROVISIONAL por CPF (`global_user_id`)** antes de exigir KYB de uma existente. Existe um bypass documentado (`isTestOverrideUser`) — não investigado a fundo (fora do denominador), mas é um override nomeado, não um esquecimento silencioso.

**Não auditado neste passo:** `activateCompanyOperationally` (o que de fato promove DRAFT→PROVISIONAL); `isTestOverrideUser` (quem pode ser esse override e como é decidido); convite/aceite de gestor adicional além do criador.

**Fila de destino:** nenhum achado grave. Verificação por composição com o selo DECISION-0189D deu resultado positivo — não há sinal de contradição entre o que já foi selado e o que o nascimento da empresa realmente faz.

---

## Passo 2 — Convite, aceite e revogação de gestor adicional (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o ciclo convite→aceite→revogação de gestor/membro adicional, verificando por composição com o selo já existente (DECISION-0189 F5), sem reabrir.
DENOMINADOR: company-access-invitations.routes.ts inteiro (criar, listar, revogar, lookup, aceitar, recusar).
MÉTODO: leitura direta do arquivo completo (262 linhas).
CRITÉRIO DE CONCLUSÃO: descrever o ciclo completo e confirmar autoridade correta em cada etapa.
FORA DE ESCOPO: reabrir a partição fina de permissões já selada.
```
**Examinei o arquivo completo — fechado.**

**Achados comprovados:**

1. **`PROVADO` — distinção fina e deliberada entre AUTORIA e AUTORIDADE, documentada explicitamente (DECISION-0189D §1.3):** `requireRepresentsActingActor` primeiro tenta `canRepresentActor` (governança plena); se falhar, cai para uma checagem MAIS ESTREITA e específica deste ciclo — membership ativa na empresa (`company_users.member_status='active'`) já basta como "autoria" para participar do fluxo de convite, mas a AUTORIDADE fina real (`manage_members`) é decidida separadamente, no service, via `invokerUserId` (server-side). O comentário é explícito sobre por que não alargaram `canRepresentActor` em si (evitaria sombrear membros finos em TODOS os outros callers) — é uma exceção estreita e justificada, não um afrouxamento geral.
2. **`PROVADO` — criação de convite tem defesa em profundidade nas permission keys:** a rota valida shape contra `COMPANY_CATALOG_KEYS` (anti-lixo, comentário confirma que o service revalida "contra o catálogo + tetos" de novo) — duas camadas, não confia só na borda.
3. **`PROVADO` — listar a fila de convites exige `canActAs(..., 'manage_members')` explícito** — não é liberado por membership simples, ao contrário da criação/revogação (achado 1). Duas superfícies do mesmo arquivo com bases de autoridade DIFERENTES e conscientes (autoria estreita para agir no ciclo vs. permissão fina para LER a fila de gestão).
4. **`PROVADO` — o endpoint `/lookup` (diretório por código de indicação) usa um rate limiter FAIL-CLOSED PRÓPRIO, deliberadamente diferente do rate limiter fail-open de `auth.routes` (item 3/8).** Comentário cita "R15" e explica a escolha — reconhecimento explícito, dentro do próprio código, de que o rate limiter padrão do sistema é fail-open e que este endpoint específico precisava de outra política. Reforça o achado do item 8 (múltiplas convenções de flag/limite) — aqui a divergência é justificada e documentada, não acidental.
5. **`PROVADO` — aceite/recusa de convite (`invitationAcceptanceRoutes`) confirma exatamente o que a memória do projeto já registrava: "token é o endereço; Identity do caller é a autoridade".** Único input é o token (regex `^[0-9a-f]{64}$`, validação estrita de shape); a autoridade é simplesmente "quem está autenticado" (`userId` do JWT) — sem `actionContext`/representação, porque aceitar um convite é sempre "como eu mesmo", não como outro actor. Desenho minimalista, sem complexidade desnecessária.
6. **`PROVADO` — resposta de criação de convite tem `Cache-Control: no-store` explícito** porque contém o token em claro uma única vez — boa prática de higiene, consistente com o comentário de topo do arquivo ("NUNCA logam token em claro").

**Não auditado neste passo:** internals de `companyAccessInvitationsService` (criação/revogação/aceite/recusa em si — só vi a camada de rota); o catálogo `COMPANY_CATALOG_KEYS` e os "tetos" mencionados.

**Fila de destino:** nenhum achado grave. Mais um passo desta rodada com resultado positivo — inclusive um exemplo de exceção de autoridade bem-raciocinada e bem-documentada (achado 1), e uma divergência de rate-limit justificada por escrito (achado 4), não uma inconsistência acidental.

---

## Rodada 5 — encerrada por ora

Nascimento (passo 1) e convite/aceite/revogação (passo 2) cobrem o essencial do ciclo de empresa sem reabrir a autoridade já selada (DECISION-0189D). Resultado: mais uma rodada majoritariamente positiva, com boa disciplina de separação autoria/autoridade.

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada (Rodada 6, Grupos).

---

# Rodada 6 — Criação e ciclo de grupos

Atenção: parte deste domínio também já está SELADA (F-ORGANIZATIONAL-ACTOR-COMPOSITION, DECISION-0186/0187/0188, ver memória do projeto) — as "casas" `group_actor_memberships` e `group_institutional_bindings` estão seladas mas DORMENTES (não cutover ainda). O caminho VIVO de membership hoje é o mais antigo (`groups.service.ts`/`groups.repository.ts`), não os arquivos novos. Não reabrir o selo — só mapear o que está vivo.

## Passo 1 — Nascimento do grupo e Group Actor (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o nascimento de um grupo (Group Actor), já vimos ensureGroupActor de relance na Rodada 2. Verificar atomicidade e âncora civil, mesmo padrão de PF/empresa.
DENOMINADOR: groups.service.ts → createGroup().
MÉTODO: leitura direta do método.
CRITÉRIO DE CONCLUSÃO: descrever a cadeia de nascimento e confirmar (ou não) atomicidade.
FORA DE ESCOPO: delegação institucional (próximo passo); publicação em nome do grupo (rodada de operações).
```
**Examinei o método declarado — fechado, com um achado real de divergência.**

**Achados comprovados:**

1. **`PROVADO` — âncora civil obrigatória, mesmo padrão de empresa/PF:** `ensureUserActor(tenantId, ownerUserId)` resolve o actor humano do criador ANTES de tudo (§4.8.1), e `groupCreationPolicy.canCreateGroup` é checado contra esse actor (não contra o `userId` cru).
2. **`FORTEMENTE INDICADO` — divergência real do padrão atômico visto em PF (Rodada 1) e Empresa (Rodada 5): o nascimento do grupo NÃO é uma transação única.** `groupsRepository.create(...)` roda primeiro (sua própria transação/statement), e SÓ DEPOIS `ensureGroupActor(...)` roda — com comentário explícito confirmando a separação: *"NÃO chamar dentro de transação ativa (tem TX interna própria)"*. Diferente do padrão visto em `ensureUserActorTx`/`ensurePageActorTx` (Rodada 1/5), que recebem o client da transação do chamador para compor atomicamente — aqui é usada a variante NÃO-transacional (`ensureGroupActor`, não `ensureGroupActorTx` — nem sequer existe essa variante Tx, per Rodada 2). Se `ensureGroupActor` falhar depois do grupo já criado, o grupo fica órfão de actor, sem rollback automático. Marco `FORTEMENTE INDICADO` (não `PROVADO` como bug) porque `ensureGroupActor` é idempotente por desenho — é PLAUSÍVEL que a intenção seja "self-healing" numa chamada futura, mas não vi nenhum código que de fato tente essa cura depois. Severidade: não é `crítico/vivo/explorável` (não é autoridade nem dinheiro, é integridade referencial num caminho raro de falha) — não dispara a trava B.8, mas é candidato real a `HARDEN`.
3. **`PROVADO` — intenção financeira é só metadata/anúncio, não abre o Bank aqui.** Se `hasFinancialIntent`, o código explicitamente NÃO cria conta agora — só loga que a conta será criada "automaticamente na primeira transação via Unify Bank" (lazy, fora deste fluxo). Grupo sem intenção financeira não toca o Bank de forma nenhuma.
4. **`PROVADO` — validações de localização/categoria acontecem ANTES da escrita** (hierarquia país/estado/cidade, categoria com `scope='group'` — nota explícita de que categorias de grupo NÃO usam a tabela legada `group_categories`).

**Não auditado neste passo:** o resto de `createGroup` (criação do post de anúncio no feed, linha 258+); `group-actor-membership.service.ts`/`group-institutional-binding.service.ts` (as casas seladas-mas-dormentes — não reabrir, mas vale confirmar noutra hora que "dormente" ainda é verdade, per a lei "dormente precisa ser provado por reachability").

**Fila de destino:** `HARDEN` para o achado 2 (nascimento do grupo não-atômico) — não urgente, mas é uma divergência real e concreta do padrão de atomicidade que o resto do sistema segue. Vale registrar para quando a fase de correção chegar, com a pergunta: "isso foi decisão consciente (grupo é menos crítico que empresa) ou lacuna não percebida?"

---

## Passo 2 — Membership, convite e entrada em grupo (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o ciclo convite→entrada no caminho VIVO (groups.service.ts), sem tocar a casa selada-dormente group_actor_memberships.
DENOMINADOR: groups.service.ts createInvite (linha 634) + requesterMatchesOwnerActor (autoridade usada em ~9 métodos do arquivo).
MÉTODO: leitura direta.
CRITÉRIO DE CONCLUSÃO: descrever convite→entrada e quem tem autoridade para convidar.
FORA DE ESCOPO: group_actor_memberships/group_institutional_binding (selado, dormente); delegação institucional.
```
**Examinei os dois pontos declarados — fechado, com um achado que merece escalonamento (B.9).**

**Achados comprovados:**

1. **`PROVADO` — convite tem validações corretas de negócio:** exige grupo ativo, exige owner/admin, rejeita convidar quem já é membro, rejeita convite duplicado pendente, expira em 7 dias por padrão.
2. **`PROVADO` — `groups.service.ts` usa uma autoridade TOTALMENTE PARALELA à `authorizationService` estudada na Rodada 4.** Grep confirma: ZERO referências a `authorizationService`/`canRepresentActor`/`canActAs` no arquivo inteiro. Toda checagem de "é owner ou admin" passa por `requesterMatchesOwnerActor` (privado, usado em pelo menos 9 métodos) + `groupsRepository.isUserAdminOrOwner` — um sistema de autoridade próprio do módulo Groups, não integrado ao canônico.
3. **`FORTEMENTE INDICADO`, candidato a `AUDITORIA PROFUNDA` — `requesterMatchesOwnerActor` usa uma função de ESCRITA (`ensureUserActor`, find-or-create) dentro de uma checagem de autoridade que deveria ser só leitura, testando múltiplos candidatos de ID:** o método recebe `primaryUserId` + opcionalmente `userContext.globalUserId`/`userContext.id`, monta uma lista `[primaryUserId, globalUserId, id]` (deduplicada), e para CADA candidato chama `ensureUserActor(tenantId, candidate)` — tratando o candidato como se fosse sempre um `userId` (a função espera `users.id`, não `global_user_id`), comparando o `actor_id` resultante contra o dono do grupo. Dois problemas concretos:
   - `ensureUserActor` é find-or-CREATE (confirmado na Rodada 2: "idempotente... garante que existe"). Usar uma função com capacidade de ESCREVER dentro de uma checagem de AUTORIDADE (que deveria ser side-effect-free) é uma inversão de responsabilidade — checar "quem pode fazer X" não deveria, por si só, poder criar linhas novas em `actors`.
   - Misturar `userId`/`global_user_id`/`id` como candidatos intercambiáveis para a MESMA função (que espera só `userId`) é exatamente a classe de confusão que a Rodada 2 already identificou como perigosa (os 3 IDs não são a mesma coisa, exceto no caso específico actor_id=user_id do humano) — e é a MESMA classe de erro que `audit-actor-impersonation-writes.mjs` (Rodada 4) foi escrito para prevenir, só que em OUTROS 5 handlers, não neste.
   Não escalono para `PROVADO`/vulnerabilidade confirmada porque não verifiquei se algum desses IDs é, na prática, controlável pelo cliente de um jeito que produza colisão real — isso exige rastrear a origem de `userContext.globalUserId`/`.id` até a rota (não feito nesta passagem) e é exatamente o tipo de julgamento (autoridade indireta, múltiplas interpretações plausíveis) que a regra B.9 pede para escalar a um modelo mais avançado em vez de concluir com leitura Sonnet.
4. **`PROVADO` — aceite de convite é restrito ao próprio convidado** (comentário: "Apenas o usuário convidado pode aceitar" — não li o corpo do método, só o contrato declarado).

**Não auditado neste passo:** corpo do método de aceite de convite; origem de `userContext.globalUserId`/`.id` nas rotas que chamam `groups.service.ts` (necessário para resolver a escalação do achado 3); se `group-actor-membership.service.ts` (selado-dormente) está de fato planejado para SUBSTITUIR esse mecanismo paralelo algum dia (cutover), o que explicaria por que o canônico não foi usado aqui ainda.

**Fila de destino:** `AUDITORIA PROFUNDA` de prioridade alta para o achado 3 — recomendo modelo mais avançado (Opus/Fable, per B.9) dado que envolve autoridade indireta + função de escrita dentro de checagem de autoridade + confusão de tipos de ID, categorias que a regra de escalonamento lista explicitamente. `DECIDE`/`CONVERGE` para o achado 2 (Groups tem autoridade paralela à canônica) — perguntar a Clayton se isso é dívida técnica consciente (aguardando o cutover da casa selada-dormente) ou lacuna não percebida.

---

## Rodada 6 — encerrada por ora

Nascimento (passo 1, achado de não-atomicidade) e membership/convite (passo 2, achado de autoridade paralela + candidato a auditoria profunda) — esta rodada trouxe os achados mais concretos desde o CAUSA-RAIZ-004. Diferente das Rodadas 4 e 5 (autoridade empresarial, bem integrada e madura), Grupos parece ser um domínio mais antigo, ainda não integrado ao sistema canônico de autoridade.

**Decisão:** Clayton disse "próximo" — como rastrear a origem do `userContext` ainda é levantamento factual (não o julgamento final de exploração), continuei antes de decidir se precisa escalar.

## Passo 3 — Rastreamento da origem de `userContext` (refinamento do achado 3, concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: descobrir se requesterMatchesOwnerActor (achado 3 do passo 2) é a ÚNICA barreira de autoridade nas rotas de grupo, ou se há um gate anterior mais forte.
DENOMINADOR: groups.routes.ts — todos os pontos que constroem userContext e chamam requireGroupOwnerOrPermission.
MÉTODO: grep de todos os call sites de requireGroupOwnerOrPermission + createInvite; leitura da própria função.
CRITÉRIO DE CONCLUSÃO: confirmar se as rotas mutáveis têm um preHandler de autoridade real ANTES de chegar no service, e se esse preHandler usa canRepresentActor corretamente.
FORA DE ESCOPO: nenhum — este passo fecha a dúvida em aberto do passo 2.
```
**Examinei todos os 9 call sites de `requireGroupOwnerOrPermission` + a função em si — fechado, achado recalibrado com evidência.**

**Achados comprovados:**

1. **`PROVADO` — a barreira REAL é `requireGroupOwnerOrPermission`, um preHandler de rota, e ela está CORRETA hoje.** Usa `authorizationService.canRepresentActor(tenantId, req.user.userId, group.ownerActorId)` — autoridade derivada do usuário AUTENTICADO server-side, não do `actionContext.actorId` declarado. E o comentário no código confirma que isso é uma CORREÇÃO já aplicada de um bug real: *"DECISION-0113 / Z2 (F-AUTHORITY-Z2-R1): a AUTORIDADE vem do USUÁRIO AUTENTICADO... NUNCA do actorId declarado... Antes, userIdForCheck derivava do actorId declarado (spoofável)... bypass corrigido aqui."* — ou seja, EXATAMENTE o tipo de bug que eu suspeitava já existiu aqui, e já foi corrigido, no nível da rota.
2. **`PROVADO` — todas as rotas mutáveis de grupo que encontrei (8 pontos: update ×5, delete ×1, leitura de convites ×1, e o ponto imediatamente anterior à criação de convite) chamam `requireGroupOwnerOrPermission` como preHandler ANTES de chegar em `updateGroup`/`createInvite`/etc.** Isso significa que, na prática, o `userContext` frouxo (achado 3 do passo 2, com `globalUserId=id=actionContext.actorId`) chega em `requesterMatchesOwnerActor` DEPOIS que a autoridade real já foi provada corretamente pelo preHandler — é uma checagem SECUNDÁRIA e provavelmente redundante nas rotas atuais, não a única linha de defesa.
3. **`FORTEMENTE INDICADO` — reclassificação do achado 3 do passo 2: de "risco vivo provável" para "camada interna de defesa-em-profundidade desatualizada, sem exploração confirmada pelas rotas atuais".** O `requesterMatchesOwnerActor` dentro do service CONTINUA com o padrão frouxo (função de escrita + mistura de tipos de ID) e NÃO foi atualizado quando o preHandler da rota foi corrigido (achado 1) — é um caso concreto de "a correção aconteceu na borda, mas não se propagou para dentro". Risco residual real: se qualquer chamador FUTURO dos métodos de `groups.service.ts` pular o preHandler `requireGroupOwnerOrPermission` (ex. um script interno, uma nova rota, um worker), a camada interna frouxa passaria a ser a ÚNICA defesa — e essa falharia.

**Não auditado neste passo:** se existe algum caller de `groups.service.ts` fora de `groups.routes.ts` (scripts internos, outros módulos) que pule o preHandler.

**Fila de destino:** `HARDEN` (não mais `AUDITORIA PROFUNDA` de emergência) — atualizar `requesterMatchesOwnerActor` para usar `authorizationService.canRepresentActor` (like `requireGroupOwnerOrPermission` já faz), removendo a dependência de `ensureUserActor` (escrita) e de `userContext.globalUserId`/`.id` client-controláveis. Não é urgente pelas rotas de hoje, mas é dívida real e concreta — a correção de 2026 no preHandler nunca chegou ao service.

---

## Rodada 6 — encerrada, achado recalibrado com evidência completa

O achado do passo 2 foi verificado e recalibrado no passo 3: não é uma vulnerabilidade ativa hoje (a rota protege corretamente), mas é uma camada interna desatualizada que replica um padrão já sabido como perigoso. Isso é exatamente o tipo de disciplina que o método pede — não parar em "parece perigoso", ir até "verifiquei e aqui está o que realmente acontece".

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada (Rodada 7, Perfil/página do Actor).

---

# Rodada 7 — Perfil completo, página do Actor e compositor

## Passo 1 — Contrato da página universal do Actor (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: confirmar se a página do Actor é uma casca universal com blocos condicionais (doutrina do projeto) ou bifurcada por vertical/tipo de actor.
DENOMINADOR: modules/actor-page/actor-page.routes.ts + actor-page.service.ts (getContract).
MÉTODO: leitura direta do contrato.
CRITÉRIO DE CONCLUSÃO: confirmar universal-com-blocos vs. bifurcado-por-vertical, com evidência de código.
FORA DE ESCOPO: compositor (próximo passo); capabilities em si (já coberto na Rodada 4).
```
**Examinei rota + service — fechado, confirmado com evidência.**

**Achados comprovados:**

1. **`PROVADO` — confirma a doutrina: é uma casca ÚNICA, `blocks[]` construído condicionalmente, não uma página por vertical.** `getContract` monta um array `blocks` via `.push()` condicional (location, connections, produtos/agenda, etc.) — mesmo endpoint (`GET /actor-page/:actorId?mode=`) para qualquer tipo de actor; o que muda é QUAIS blocos entram, não a rota nem o contrato base.
2. **`PROVADO` — um dos handlers mais disciplinados desta investigação inteira quanto a "hint ≠ autoridade":** modo `operating` (gerenciar a própria página) exige `canRepresentActor` fail-closed, 403 em deny. Modo `consuming` (ver a página de outro) resolve o "viewer efetivo" com precedência EXPLÍCITA: o `actionContext.actorId` declarado só é aceito se `canRepresentActor` provar representação; se não provado, cai no actor humano canônico do PRÓPRIO principal (leitura pura, sem `ensure`/criação) — nunca usa o hint cru. Comentário explica o motivo: evitar que alguém enumere relação/fato de negócio entre pares arbitrários (X, alvo) usando um `actorId` declarado não-provado.
3. **`PROVADO` — distinção correta entre "deny" e "erro de infraestrutura":** falha real (`throw`) NUNCA vira `false`/403/página neutra — sobe como 5xx explícito. Só o `false` legítimo de `canRepresentActor` (actor inexistente/não representável) vira 403. Essa distinção evita que uma falha técnica seja mascarada como "sem permissão".
4. **`PROVADO` — módulo é genuinamente read-only**, como o comentário de topo promete: nenhuma escrita, nenhum `ensure`/criação de actor no caminho de leitura.

**Não auditado neste passo:** `hydrateBlock` e cada tipo de bloco individualmente (o que cada um expõe exatamente); o compositor (próximo passo desta rodada).

**Fila de destino:** nenhum achado grave — este é o handler mais bem escrito que li nesta investigação inteira em termos de disciplina de autoridade (hint vs prova, deny vs erro). Serve como referência positiva de comparação para o achado da Rodada 6 (`requesterMatchesOwnerActor`), que deveria seguir o mesmo padrão.

---

## Passo 2 — Compositor: vocabulário e autoridade (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: entender o contrato do compositor — quais "atos" ele permite criar, e se o vocabulário vem de fonte governada ou é inventado localmente.
DENOMINADOR: modules/composer/composer.routes.ts + composer.service.ts (getContract).
MÉTODO: leitura direta.
CRITÉRIO DE CONCLUSÃO: descrever de onde vêm os "atos criáveis" e se dependem de capability real do actor.
FORA DE ESCOPO: execução de cada ato individual.
```
**Examinei rota + service — fechado, achado limpo: NÃO inventa vocabulário.**

**Achados comprovados:**

1. **`PROVADO` — rota exige `canRepresentActor` fail-closed em AMBOS os modos** (diferente do actor-page, onde `consuming` era leitura pública) — comentário explica o motivo: o compositor ESCREVE em nome do actor, então "enumerar o que posso criar como X" já exige poder representar X, mesmo só para ler o contrato.
2. **`PROVADO` — zero vocabulário inventado: o compositor itera o enum canônico `ActorIntent` (SSOT único, `INTENTS_ACTOR_CONTRATO.md`) e delega "posso criar isto?" ao MESMO validador central (`actorIntentsService.validateIntent`) usado pelo endpoint real de escrita (`social-2.0`).** Comentário confirma a garantia: *"compositor e social-2.0... SEMPRE respondem igual — Lei de Coerência §5"*. O único conhecimento local é projeção de UX (rótulo, ícone, deeplink, em quais modos faz sentido) — nunca identidade nem autoridade do intent.
3. **`PROVADO` — disciplina anti-fantasma explícita:** intents que existem no enum mas ainda não têm superfície de composição (`ANNOUNCE_JOB`/`REQUEST_HELP`-variantes/`SEND_CTA`/`RECEIVE_PAYMENT`, per comentário) simplesmente NÃO aparecem no contrato — "o cliente não finge que existem". Mesma disciplina que vimos faltando em outros lugares desta investigação (rotas registradas sem função real).
4. **`PROVADO` — `enabled`/`gatedBy` vêm do veredito do validador central**, não de heurística local — se `validateIntent` nega, o contrato expõe o motivo (`requiredCapability`/`reason`) para a UI explicar por que a ação está desabilitada, sem o compositor reimplementar a lógica de autoridade.

**Não auditado neste passo:** `actorIntentsService.validateIntent` em si (o validador central — não abri, só confirmei que é reaproveitado); os 8 `targetComposer` individuais (post/booking/service/product/event/demand/project/vote) — cada um é sua própria superfície de escrita, fora do escopo do compositor em si.

**Fila de destino:** nenhum achado grave. Segundo passo consecutivo desta rodada com resultado exemplar — mesmo padrão de disciplina do passo 1 (actor-page), aqui aplicado a vocabulário em vez de autoridade de leitura.

---

## Rodada 7 — encerrada por ora

Página do Actor (passo 1) e compositor (passo 2) confirmam, com evidência direta de código, duas doutrinas centrais do projeto que até agora só existiam como afirmação na memória: "casca universal, não página por vertical" e "compositor não inventa vocabulário". Dois dos handlers mais bem escritos de toda a investigação.

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada (Rodada 8, Busca/Navegação).

---

# Rodada 8 — Busca, categorias e navegação

## Passo 1 — Busca federada (omnibox) (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: verificar se a busca federada (GET /search) de fato "federa readers canônicos, zero verdade paralela" (comentário já visto no item 6) ou reimplementa queries próprias.
DENOMINADOR: modules/search/search-omni.service.ts (searchOmni).
MÉTODO: leitura direta.
CRITÉRIO DE CONCLUSÃO: confirmar se cada seção da busca chama um serviço/reader já existente, e se há proteção contra vazamento de PII na única parte nova (busca de identidade).
FORA DE ESCOPO: navegação/categorias/TREE-CONCEPT (próximo passo).
```
**Examinei o service completo — fechado, confirmado com evidência forte.**

**Achados comprovados:**

1. **`PROVADO` — confirma integralmente a alegação: cada seção reusa um reader canônico já existente, nenhuma verdade paralela.** Serviços → `servicesDiscoveryService.searchByTerm`; produtos → `searchCanonicalItems` (comentário garante: "mesmo SELECT da rota /catalog/items/search"); eventos → `eventsService.searchEvents` (piso de discovery + `discoveryUserId` server-side, DECISION-0113); grupos → `groupsService.listGroups` + filtro EM MEMÓRIA (comentário explícito: "não nasce 2º SQL de grupos"). Só identidade (pessoas/empresas) é reader NOVO, porque nenhum existia — e é anti-PII por construção (só `id/display_name/slug/avatar_url/bio/actor_type`, nunca `user_id/global_user_id/external_id/kyc_*/metadata`).
2. **`PROVADO` — tese de design documentada e datada (aprovada por Clayton 2026-07-03): QUEM (identidade) e O QUÊ (oferta) nunca se misturam** — são pistas com semânticas diferentes, cada uma resolvida pelo seu reader com seus próprios gates. Busca é PROJEÇÃO, não verdade nova — a mesma doutrina "frontend/busca não cria verdade" já vista em outros lugares, aqui aplicada com evidência de código, não só afirmação.
3. **`PROVADO` — fail-soft transparente por seção:** se uma seção falhar (ex. `services` derruba), as outras continuam, e a falha aparece nomeada em `sectionErrors` — nunca silenciosa. Termo curto (<2 chars) retorna vazio honesto em vez de escanear o banco com `%a%`.
4. **`PROVADO` — a única extensão cross-tenant (identidade "global", via vitrine `public_profiles`) é deliberada e opt-in:** só aparece o que o próprio dono publicou explicitamente (`POST /public-profiles/publish`, gated por `canRepresentActor`) — não é vazamento, é vitrine por escolha, com dedupe correto (local sempre vence sobre global, evitando duplicata do mesmo actor).

**Não auditado neste passo:** `publicProfileRepository.searchGlobalPublic` em si (a query da vitrine cross-tenant, não lida — só a chamada); `rentableResourceService.searchByText`.

**Fila de destino:** nenhum achado grave. Confirma, com evidência forte, que o risco citado no Anexo B para esta rodada ("busca retornando identidades incompatíveis", "verdade paralela") NÃO se materializou aqui.

---

## Passo 2 — Navegação: fechando a pendência `/navigation` do item 6 (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: verificar a colisão de prefixo /navigation (navigationRoutes + moduleProjectionRoutes, pendência do item 6) e o risco de "slug decidindo regra" (Anexo B).
DENOMINADOR: core/navigation/navigation.routes.ts + module-projection.routes.ts.
MÉTODO: leitura direta, comparação de paths finais.
CRITÉRIO DE CONCLUSÃO: confirmar colisão real ou não; checar se N1/N2 são usados como lookup governado ou como regra de negócio inline.
FORA DE ESCOPO: TREE/CONCEPT em profundidade; categorias em si.
```
**Examinei os dois arquivos — fechado, pendência do item 6 resolvida.**

**Achados comprovados:**

1. **`PROVADO` — a pendência do item 6 (`/navigation` compartilhado por 2 módulos) está RESOLVIDA: sem colisão.** `navigation.routes.ts` registra `GET /n1`, `GET /n2`, `GET /offers`; `module-projection.routes.ts` registra `GET /modules` — quatro paths finais totalmente distintos (`/navigation/n1`, `/navigation/n2`, `/navigation/offers`, `/navigation/modules`). Mesmo padrão já confirmado para `/bank`+`categoryReviewModule` no Anexo A: prefixo compartilhado, zero colisão real.
2. **`PROVADO` — N1 é usado como chave de lookup contra tabela governada, não como regra de negócio inline:** `GET /n2` exige `n1`+`context`+`domain`, valida `domain` contra um allowlist local pequeno (`ALLOWED_N1_DOMAINS`, 3 valores), e verifica a existência do `context` contra `context_nodes` (ativo, não-depreciado) ANTES de resolver. Não vi nenhum `if slug === X then <regra especial>` — o slug é chave de busca, a REGRA vem da tabela.

**Não auditado neste passo:** o restante de `navigation.routes.ts` (handler de `/offers`, linha 148+); TREE/CONCEPT em profundidade (fica para uma passagem futura desta rodada, se Clayton quiser).

**Fila de destino:** nenhum achado grave. Fecha definitivamente a pendência do item 6 para o prefixo `/navigation` — pode ser marcada como resolvida na tabela daquele item.

---

## Rodada 8 — encerrada por ora

Busca federada (passo 1) e navegação (passo 2) não confirmaram nenhum dos riscos que o Anexo B listava para esta rodada. Mais uma rodada limpa.

**Decisão:** Clayton disse "próximo" sem escolher — segui a ordem recomendada (Rodada 9, Jornadas operacionais, começando por Serviço já que Eventos já tem mapa no Anexo A).

---

# Rodada 9 — Jornadas operacionais

## Passo 1 — Serviço: publicação de oferta (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: mapear publicação→autoridade→persistência de uma oferta de serviço, como amostra da família "jornadas operacionais" (Eventos já mapeado no Anexo A).
DENOMINADOR: service-offerings.routes.ts (POST /offerings) + service-offering.service.ts (createOffering).
MÉTODO: leitura direta.
CRITÉRIO DE CONCLUSÃO: descrever publicação→autoridade→persistência e comparar com o padrão canônico (canRepresentActor).
FORA DE ESCOPO: booking/disponibilidade completo; dinheiro (Rodada 10).
```
**Examinei rota + service — fechado.**

**Achados comprovados:**

1. **`PROVADO` — autoridade correta e canônica, integrada com `authorizationService`:** `createOffering` chama `canRepresentActor(tenantId, userId, providerActorId)` — mesma função central estudada na Rodada 4, `userId` vindo de `req.user.userId` (server-side). Update e criação de disponibilidade repetem a mesma checagem contra o dono real da oferta, não contra o que o cliente declarou. Diferente do padrão desatualizado achado na Rodada 6 (Grupos) — aqui está alinhado com o canônico.
2. **`PROVADO` — vocabulário de serviço é controlado, não texto livre:** `canonicalServiceId` é validado contra `canonicalServiceService.requireActiveForTenant` — precisa existir e estar ativo no catálogo canônico do tenant, mesma disciplina "vocabulário controlado" já vista na busca (Rodada 8) e no compositor (Rodada 7).
3. **`PROVADO` — comentário de topo confirma money-free por desenho:** *"Disponibilidade via Unified Availability... Booking transacional e pagamento FORA. Zero Bank writer."* — a oferta em si não move dinheiro; isso fica para trilhos separados (booking/pagamento), fora deste arquivo.

**Não auditado neste passo:** booking/disponibilidade em si (`Unified Availability`, mencionado mas não aberto); os outros ~10 arquivos do módulo services (order, bundle, payment-request/execution — esses últimos claramente tocam dinheiro, ficam para a Rodada 10).

**Fila de destino:** nenhum achado grave. Confirma que o padrão de autoridade canônico (Rodada 4) está bem propagado neste domínio — ao contrário de Grupos.

---

## Passo 2 — Unified Availability: reaproveitamento real entre famílias (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: confirmar se o sistema de disponibilidade é de fato compartilhado entre famílias (serviço/locação/evento/perfil) ou se cada uma reimplementa a própria.
DENOMINADOR: core/availability — estrutura de arquivos + quem importa de fato.
MÉTODO: leitura estrutural + grep de imports cruzados.
CRITÉRIO DE CONCLUSÃO: confirmar reaproveitamento real com evidência de import, não só comentário.
FORA DE ESCOPO: lógica interna de conflito de horário.
```
**Examinei estrutura + imports cruzados — fechado.**

**Achados comprovados:**

1. **`PROVADO` — reaproveitamento real, confirmado por import cruzado, não só comentário:** `@core/availability` é importado por 4 módulos de feature diferentes — `actor-page`, `events`, `profile`, `services`. Não é "calendário paralelo" por família, é o mesmo substrato.
2. **`PROVADO` — existe um arquivo dedicado só para autoridade de disponibilidade** (`availability-owner-authority.ts`) — separado da lógica de disponibilidade em si, sinal de que "quem é dono deste horário" foi modelado como preocupação própria. Consistente com o guard `audit-availability-owner-authority.mjs`, que confirmei no item 9 estar DENTRO dos 197 guards que o runner efetivamente roda (não é um dos 84 órfãos).

**Não auditado neste passo:** lógica interna de detecção de conflito; `weekly-template-materializer.service.ts` (agenda recorrente, não aberto).

**Fila de destino:** nenhum achado grave.

---

## Checkpoint de meio de sessão (não é fim de rodada)

Cobrimos muito território nesta sessão: Rodada 0 completa (10 itens) + Rodadas 1-9 (parciais, cada uma com 1-2 passos). O `PLANO_RECUPERACAO.md` já é um documento grande e denso. Antes de continuar mais fundo (Rodada 9 tem ainda produto/locação/demanda; Rodada 10 é dinheiro — a maior e mais sensível, com `economic/v2` esperando desde a Rodada 0), vale um checkpoint explícito com Clayton sobre ritmo e prioridade, em vez de simplesmente seguir a ordem numérica por inércia.

**Decisão:** Clayton disse "próximo" — fui direto na pergunta mais aguardada desde a Rodada 0: `economic/v2/payment/execute` executa dinheiro de verdade?

---

# Rodada 10 — Dinheiro, fiscal, território e indicação financeira

## Passo 1 — `economic/v2/payment/execute`: executa ou só simula? (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: responder a pergunta pendente desde a Rodada 0 — o handler executa dinheiro de verdade ou só cria/roda solicitação (mesmo padrão request-only de DECISION-0128 já visto em bank-http.routes.ts)?
DENOMINADOR: core/events/event.routes.ts, handler POST /:eventId/economic/v2/payment/execute (linha ~3070).
MÉTODO: leitura direta do handler.
CRITÉRIO DE CONCLUSÃO: responder objetivamente "executa" ou "só simula" — fato observável, não julgamento sobre correção do cálculo.
FORA DE ESCOPO: julgar se o cálculo financeiro está correto, atomicidade fina, reversão — se eu chegar nisso, paro e sinalizo escalonamento (B.9).
```
**Examinei o handler completo — fechado, resposta clara e definitiva.**

**Achados comprovados:**

1. **`PROVADO` — o endpoint é TRAVADO a sandbox, explicitamente, no corpo da requisição:** exige `sandbox_mode: true` obrigatório; se não for exatamente `true`, devolve 400 com a mensagem literal *"sandbox_mode=true is required. No real money will be moved."* — ou seja, **hoje este caminho não pode mover dinheiro real por este endpoint**, só simular execução em ambiente sandbox. Isso reclassifica boa parte do risco de `CAUSA-RAIZ` levantado no Anexo A/Rodada 0: não é "dinheiro real escondido no domínio de Eventos", é "simulação de pagamento sandbox dentro do domínio de Eventos" — ainda uma questão de fronteira arquitetural (por que está em `event.routes.ts`, não em `modules/bank`), mas severidade bem menor do que "execução financeira viva".
2. **`PROVADO` — mesmo sendo sandbox, tem disciplina de produção real:** exige confirmação explícita (`confirmation: true`); checa se há chargeback ativo que CONGELA execuções (`hasFrozenExecutions`, fail-closed 403); valida que a autorização existe, pertence ao EVENTO correto (anti cross-event) e está EXATAMENTE no status `'authorized'` antes de prosseguir — não aceita autorização em qualquer outro estado.
3. **`PROVADO` — resolve o actor representado via helper próprio (`resolveRepresentedActor`)**, não confia direto em `actionContext.actorId` — consistente com o padrão de autoridade que vimos em outros handlers bem escritos (Rodada 7). Não abri o helper em si (fora do denominador declarado).

**Não auditado neste passo (deliberadamente, per B.9):** `eventPaymentExecutionService.executePayment` em si — o que ele realmente grava mesmo em modo sandbox (ledger sandbox? tabela separada?); atomicidade/reversão; se existe algum OUTRO caminho (sem `sandbox_mode`) que de fato mova dinheiro real para eventos. Esses pontos tocam cálculo financeiro/atomicidade — ficam para uma auditoria profunda dedicada, possivelmente com modelo mais avançado.

**Fila de destino:** `PROVE`/`AUDITORIA PROFUNDA` (não urgente, severidade rebaixada) — confirmar que NÃO existe nenhum caminho paralelo sem o gate `sandbox_mode` que alcance execução real; se confirmado, `economic/v2` deixa de ser candidato a `CAUSA-RAIZ` grave e vira só `HARDEN` de fronteira (mover para `modules/bank` por organização, não por segurança).

---

**Decisão:** Clayton disse "próximo" para confirmar ausência de caminho paralelo sem `sandbox_mode`. A investigação levou a um achado que ativa a trava B.8.

## Passo 2 — 🔴 CORREÇÃO DO PASSO 1 + TRAVA B.8 ACIONADA (concluído 2026-07-20, PARANDO A VARREDURA DESTA RODADA)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: confirmar que NÃO existe caminho que chame eventPaymentExecutionService.executePayment sem sandbox_mode=true, e o que sandbox_mode de fato controla DENTRO do serviço.
DENOMINADOR: event-payment-execution.service.ts (executePayment completo) + grep de todos os callers do serviço.
MÉTODO: leitura direta + grep de call sites + grep de todo uso da variável sandbox_mode dentro do método.
CRITÉRIO DE CONCLUSÃO: listar todo caller e confirmar o efeito real de sandbox_mode no ledger.
FORA DE ESCOPO: nada — este passo precisou ir até o fim para responder com segurança.
```

**Achado que corrige o passo 1 (correção pública e explícita, não silenciosa):**

**`PROVADO` — o passo 1 estava INCOMPLETO. A leitura da ROTA sozinha (que exige `sandbox_mode: true` e diz "No real money will be moved") deu uma falsa sensação de segurança. Lendo o SERVICE que a rota chama, o próprio código documenta o oposto do que a mensagem ao usuário sugere:**

- Comentário de topo do arquivo: *"sandbox_mode controla integração externa; ledger SEMPRE real."*
- Docstring do método: *"sandbox_mode apenas controla integração externa; ledger sempre real."*
- Confirmado por grep de TODO uso da variável `sandbox_mode` dentro do método: ela é usada só como **metadado/rótulo** — entra no payload de idempotência, é logada, e decide a STRING de resposta (`status: sandbox_mode ? 'simulated' : 'executed'`, mensagem `'Execução em sandbox'` vs `'Pagamento executado'`). **Ela NUNCA aparece como condicional (`if (!sandbox_mode) {...}`) em volta da escrita real no ledger** (`bankTransactionService`, contas reais via `bankPortsRegistry.getBankAccount()`, valor de `custody.amount_cents` real).
- Chamador único confirmado por grep: só a rota HTTP já vista (nenhum outro caller deste service específico — os outros `executePayment` encontrados no grep são de um serviço DIFERENTE, `modules/marketplace/payment-execution.service.ts`, não relacionado).

**Leitura honesta do que isso PODE significar (fato observado, não veredito de exploração):** hoje, quem chama este endpoint com `sandbox_mode: true` (o único valor que a rota aceita) recebe de volta `status: 'simulated'`/"Execução em sandbox" — uma resposta que sugere que nada real aconteceu — enquanto o código do próprio serviço documenta que o ledger é escrito de verdade, sempre, independente do valor de `sandbox_mode`. Ou seja: o rótulo da resposta e o efeito real podem estar DESALINHADOS.

**Por que isso aciona a trava B.8 (não é só mais um achado `HARDEN`):** é sobre dinheiro; é demonstrado por leitura direta de dois comentários explícitos do próprio time + confirmação por grep (não é suspeita nem inferência); e a ROTA promete ao chamador algo ("no real money will be moved") que o SERVICE por trás parece contradizer. Não tenho, nesta leitura estática, confirmação de que o caminho é ALCANÇÁVEL na prática hoje (exigiria uma autorização + custódia reais em estado `'authorized'`/`'active'` já existentes — não rastreei como esse estado nasce), nem prova de que o valor realmente debitado/creditado está correto — mas o **fato do código** (rota promete uma coisa, service documenta e implementa outra) é `PROVADO`, não `SUSPEITO`.

**Parando a varredura desta rodada aqui, conforme B.8.** Não vou prosseguir tentando determinar sozinho se isso é explorável — isso envolve exatamente os critérios de escalonamento da B.9 (cálculo financeiro, atomicidade, cadeia authorize→custody→execute que não rastreei até a origem). Registro o achado com todo o contexto e aguardo Clayton decidir entre:
1. Contenção emergencial (ex.: desativar a rota, ou forçar auditoria imediata do que "ledger sempre real" realmente grava e sob quais condições é alcançável);
2. Continuidade da varredura, aceitando o achado como registrado para tratamento na fase de correção, se Clayton avaliar que o caminho não é alcançável hoje (ex. nenhuma autorização real chega a existir ainda).

**Fila de destino:** acima de `AUDITORIA PROFUNDA` normal — este é candidato a tratamento prioritário, com recomendação de escalonamento a modelo mais avançado (B.9) para resolver a cadeia completa `authorize → custody → execute` e confirmar reachability real, antes de qualquer decisão de contenção ou de "não é urgente".

---

**Decisão:** Clayton disse "próximo" após o STOP. Interpretei como "continue o levantamento factual de alcançabilidade, sem contenção de código" — não é a mesma coisa que autorizar correção; nenhum código foi tocado.

## Passo 3 — Alcançabilidade real de `economic/v2` (concluído 2026-07-20, ainda sob a trava B.8)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: determinar se o caminho authorize→execute de economic/v2 é alcançável hoje na prática (frontend? feature flag? pré-requisitos reais?), para dar a Clayton dado suficiente para decidir contenção vs. continuidade.
DENOMINADOR: registro de economic/v2 em app.builder.ts (flag?); frontend inteiro (qualquer chamador de economic/v2); handler de /payment/authorize (pré-requisitos).
MÉTODO: grep de feature flag na registração; grep exaustivo no frontend; leitura do handler de authorize.
CRITÉRIO DE CONCLUSÃO: responder objetivamente se há hoje algum caminho de produto que alcance execute com dinheiro real.
FORA DE ESCOPO: corretude do valor calculado; ainda não decido "é seguro" — só reúno o fato de alcançabilidade.
```

**Achados comprovados:**

1. **`PROVADO` — `economic/v2` está registrado SEM nenhum feature flag condicional** (diferente do RFQ, que tem `isRFQEnabled()` — item 3). O módulo inteiro (`eventModule`/`event.routes.ts`) é sempre carregado no boot.
2. **`PROVADO` — ZERO chamador no frontend para toda a família `economic/v2`** (custody, split, authorize, execute, refund, chargeback) — busca exaustiva no frontend não encontrou nenhuma referência. O frontend SÓ chama outros endpoints v2 do domínio de eventos (`v2/declare`, `v2/time-windows`, `v2/summary`) — nenhum deles financeiro. **Nenhuma jornada de produto real, hoje, alcança este código.**
3. **`PROVADO` — `authorize` (o passo antes de `execute`) NÃO tem gate de sandbox_mode nenhum**, e cria uma autorização real (status `'authorized'`) desde que receba um `custody_id`+`split_id` válidos — mas esses IDs precisam já existir (criados por endpoints anteriores da mesma cadeia, `/custody` e `/split`, também sem chamador de frontend).

**Avaliação honesta, sem forçar conclusão além do que foi provado:** o achado do passo 2 (rota promete "sandbox", serviço documenta "ledger sempre real") continua sendo um **defeito de código real e comprovado** — não foi refutado. O que MUDA aqui é o risco PRÁTICO imediato: não há hoje nenhuma superfície de produto (frontend) que leve um usuário comum a essa cadeia. Alcançar isso exigiria chamar a API diretamente (Postman/script) com autenticação válida, `actionContext` válido, e — antes de tudo — conseguir criar uma `custody` real (que provavelmente exige dinheiro de verdade já em custódia/escrow, não confirmado nesta passagem). Ou seja: **não é uma vulnerabilidade explorável por um usuário comum através do produto hoje**, mas é código vivo, registrado, alcançável via API direta por qualquer principal autenticado do tenant, com uma mensagem de segurança (rota) que contradiz o comportamento documentado (serviço).

**Recomendação (não é decisão minha, é para Clayton avaliar):** dado que (a) o código está vivo e alcançável via API, (b) não há frontend usando, e (c) a contradição rota↔serviço é real — a opção mais proporcional entre as duas oferecidas no passo 2 parece ser **não é necessário contenção de emergência HOJE** (não há jornada de produto ativa expondo isso a usuários reais), **mas o achado deveria ir para o topo da fila de correção** (corrigir a mensagem da rota OU corrigir o serviço para de fato respeitar `sandbox_mode`, o que for a intenção correta — isso é decisão de produto/segurança, não escolha técnica arbitrária). Fica com Clayton confirmar se concorda com essa leitura antes de eu prosseguir.

**Fila de destino:** mantido como topo de prioridade para `AUDITORIA PROFUNDA`/`DECIDE`, rebaixado de "possível emergência" para "correção prioritária sem usuários expostos hoje" — mudança sustentada por evidência de reachability, não por suposição.

---

**Confirmação:** Clayton disse "próximo" novamente, aceitando a leitura (sem contenção emergencial; registrar como prioridade de correção). **Trava B.8 encerrada para este achado específico** — segue registrado como prioridade máxima na fila de correção, varredura retomada.

## Passo 4 — o mesmo padrão se repete em refund/chargeback? (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: verificar se o mesmo padrão do passo 2 (rota promete "sandbox/não real", service documenta "sempre real") se repete nos vizinhos diretos refund e chargeback.
DENOMINADOR: handlers /economic/v2/refund e /economic/v2/chargeback em event.routes.ts + seus services.
MÉTODO: grep de "sandbox" nos services correspondentes.
CRITÉRIO DE CONCLUSÃO: confirmar se o padrão se repete, é diferente, ou esses endpoints nem têm o conceito de sandbox.
FORA DE ESCOPO: corretude do cálculo de estorno em si.
```

**Achados comprovados:**

1. **`PROVADO` — refund e chargeback NÃO têm o parâmetro `sandbox_mode` na Body schema** (confirmado no Anexo A/item 6 original: os schemas desses handlers não incluem esse campo) — ou seja, o padrão específico do passo 2 (rota exige sandbox, service ignora) não se repete literalmente ali, porque esses endpoints nunca prometeram sandbox nenhum. **Isso não é uma boa notícia isolada** — significa que refund/chargeback, se alcançáveis, agem sobre dinheiro sem NENHUMA barreira de rótulo "sandbox" nem real, desde o início — mesma característica de "zero chamador de frontend" (confirmado no passo 3, busca exaustiva cobriu toda a família).

**Não auditado neste passo:** o corpo dos services de refund/chargeback em si (só confirmei ausência do campo `sandbox_mode` no contrato, não abri a lógica interna — ficaria mais fundo em cálculo financeiro, fora do escopo apropriado para Sonnet sem escalonamento).

**Fila de destino:** mantém-se no mesmo grupo prioritário do achado do passo 2 — `economic/v2` inteiro (custody/split/authorize/execute/refund/chargeback) é hoje: código vivo, sem feature flag, sem chamador de frontend, com pelo menos um defeito comprovado de rótulo↔efeito (execute) e nenhuma barreira de sandbox nos demais. Recomendo tratar a família INTEIRA como um único pacote de auditoria profunda/decisão, não item por item.

---

## Rodada 10 — pausada aqui por decisão de escopo (não por trava B.8 — essa já foi resolvida)

Chegamos ao ponto mais importante da investigação: a família `economic/v2` precisa de uma decisão de produto/segurança (não mais levantamento) antes de prosseguir com mais detalhe nela. O resto da Rodada 10 (fiscal, território, indicação financeira, Bank propriamente dito) ainda não foi tocado nesta sessão.

**Decisão:** Clayton disse "próximo" — segui para outra frente da Rodada 10 (contrato Território→Bank), deixando `economic/v2` registrado como pacote de decisão pendente.

## Passo 5 — Contrato Território → Bank (fundo regional) (concluído 2026-07-20)

`HEAD: 368eb72cd (branch rescue-structural)`.

**Denominador declarado:**
```text
OBJETIVO: verificar se o contrato Território→Bank respeita a regra do plano original (Fase 3): território entrega só jurisdição resolvida e versionada, nunca percentual financeiro.
DENOMINADOR: regional-fund-governance.service.ts — resolveRegionId.
MÉTODO: leitura direta.
CRITÉRIO DE CONCLUSÃO: confirmar se a resolução territorial devolve só identificador de jurisdição, sem decidir valor/percentual.
FORA DE ESCOPO: cálculo do split em si.
```
**Examinei `resolveRegionId` — fechado, contrato respeitado.**

**Achados comprovados:**

1. **`PROVADO` — território entrega só identificador de jurisdição, exatamente como a regra pede:** `resolveRegionId` retorna um `stateId` (via `tenant.cityId → worldService.getCityFullPath → state.stateId`) — nenhum percentual, nenhum valor, nenhuma instrução de ledger. Fail-closed em produção: se o tenant não tiver `cityId` configurado, lança erro explícito (*"Região não encontrada... Configure cityId no tenant"*) em vez de assumir uma região default silenciosa. O único fallback (`region-${tenantId}` fictício) é explicitamente gated a `NODE_ENV=test`.
2. **`PROVADO` — o resto do arquivo (`regional-fund-governance.service.ts`) é sobre GOVERNANÇA (propostas, votação, execução de proposta), não sobre cálculo financeiro** — grep por `percent`/`split` não encontrou nada nesse arquivo; a decisão de quanto/como mover dinheiro fica em outro lugar (fora do escopo deste passo).

**Não auditado neste passo:** o restante da cadeia de governança (proposta→voto→execução, `executeProposal`/`transferWithClient`, linha 484+ — esses SIM tocam `bankAccount`/transferência, ficariam para uma auditoria financeira própria).

**Fila de destino:** nenhum achado grave — contrato Território→Bank confirmado como corretamente contido.

---

## Sessão — panorama consolidado (checkpoint real desta vez)

Esta sessão cobriu: Rodada 0 completa (10 itens) + Rodadas 1 a 10 (parciais, 1-5 passos cada). O documento tem **4 causas-raiz transversais atualmente registradas** (B.10: ROOT-001 tenant-loop, ROOT-002 build de produção, ROOT-003 runner incompleto, ROOT-004 personificação por actionContext), 1 achado de segurança real sob decisão de Clayton (`economic/v2`), 1 achado de autoridade desatualizada rebaixado a HARDEN (Grupos), e uma dúzia de achados menores de `HARDEN`/`CONVERGE`/`INVESTIGAÇÃO ADICIONAL` espalhados pelos passos. O padrão geral: a maior parte do sistema (autenticação, autoridade central, empresa, página do Actor, compositor, busca, navegação, serviços, território) está mais madura e bem construída do que a Rodada 0 sozinha sugeria — as exceções reais e concretas são poucas, mas específicas.

**Correção de precisão (2026-07-20, pós-consolidação):** o contrato Território→Bank (passo 5) provou o LADO PRODUTOR (`resolveRegionId` só entrega jurisdição, não decide valor) — mas o lado CONSUMIDOR/EXECUÇÃO (`executeProposal`/`transferWithClient`) NÃO foi auditado. O contrato transversal completo está `PARCIAL`, não fechado. Registrado corretamente no Anexo C.

**Decisão do Clayton (2026-07-20):** parar a varredura sequencial, NÃO abrir correções, iniciar fase read-only de **consolidação e priorização** — o passo intermediário entre levantamento e correção. Resultado dessa fase = Anexo C (seis artefatos). Ver abaixo.

---

# Anexo C — Consolidação read-only (2026-07-20)

Fase intermediária entre levantamento e correção. Missão exclusivamente documental: reorganizar o que as Rodadas 0-10 produziram cronologicamente numa forma priorizável. `HEAD` de todo o levantamento: `368eb72cd` (branch `rescue-structural`). NENHUM código foi alterado nesta fase. NENHUMA correção material foi aberta.

## C.1 — Registro único de achados (FIND-NNN)

Cada achado com: título · origem · classificação · confiança · fila · causa-raiz · status. Prova/arquivos detalhados vivem no passo de origem (referenciado). `PROV`=PROVADO, `FI`=FORTEMENTE INDICADO, `SUS`=SUSPEITO.

| ID | Título | Origem | Confiança | Fila | Root | Status |
|---|---|---|---|---|---|---|
| FIND-001 | `npm start`→`dist/server.js` não sobe o servidor (só reexporta buildApp) | R0/item1 | FI | PROVA_RUNTIME_BANCO | ROOT-002 | aberto |
| FIND-002 | `server-TESTE.ts` = debug morto, sem referência | R0/item1 | PROV | REMOÇÃO_CONTENÇÃO | — | aberto |
| FIND-003 | `request-id.plugin` construído mas nunca registrado → rastreamento fragmentado | R0/item2 | PROV | CORREÇÃO_DIRETA | — | aberto |
| FIND-004 | `observation-mode.plugin` pronto mas inerte (= mecanismo de freeze da Fase 0 do plano) | R0/item2 | PROV | DECIDE→CORREÇÃO_DIRETA | — | aberto |
| FIND-005 | PII (e-mail cru) em log `info` a cada request autenticado | R0/item3 | PROV (efeito prod=NÃO AUD.) | CORREÇÃO_DIRETA | — | aberto |
| FIND-006 | `GET /auth/check-cpf` público permite enumeração de CPF | R0/item3 | PROV (exploração=FI) | DECIDE | — | aberto |
| FIND-007 | Rate-limit de auth é fail-open sob falha do limitador (5 endpoints) | R0/item3 | PROV | AUDITORIA_PROFUNDA | — | aberto |
| FIND-008 | 10+ prefixos de rota compartilhados por 2+ módulos, colisão real NÃO verificada | R0/item6 | SUS | INVESTIGAÇÃO/PROVA_RUNTIME | — | parcial (2 verificados) |
| FIND-009 | `/internal` colisão histórica real já evitada manualmente (prova de que o padrão quebra boot) | R0/item6 | PROV | — (contexto) | — | informativo |
| FIND-010 | 4 mecanismos de feature flag, 3 convenções de string, sem catálogo/parser único | R0/item8 | PROV | HARDEN/CONVERGE | — | aberto |
| FIND-011 | 323 scripts E2E `validate-pipeline-*` = prova pontual, não regressão contínua | R0/item9 | PROV | INVESTIGAÇÃO | ROOT-003 | aberto |
| FIND-012 | `AUDITORIA_MIGRATIONS_COMPLETA.txt` é dump bruto, não auditoria | R0/item10 | PROV | — (contexto) | — | informativo |
| FIND-013 | Dois "tenants de sistema" distintos (`unificard-inicial` vs `system-tenant`) | R0/item4 | PROV | — (contexto) | — | informativo |
| FIND-014 | `tenant.routes.ts` (set-region) órfão, não registrado | R0/item4 | FI | REMOÇÃO_CONTENÇÃO/INVESTIGAÇÃO | — | aberto |
| FIND-015 | Lógica de `identities` duplicada (Tx e não-Tx, mesma regra) | R2/passo1 | PROV | CONVERGE | — | aberto |
| FIND-016 | `users.referral_code` sem UNIQUE no banco (janela de corrida) | R3/passo1 | FI | HARDEN | — | aberto |
| FIND-017 | `hasCapabilityGrant` definido mas ainda não aplicado a rota de negócio | R4/passo2-3 | PROV | INVESTIGAÇÃO | — | aberto (by design) |
| FIND-018 | Nascimento de grupo NÃO-atômico (grupo criado antes do Group Actor, sem rollback) | R6/passo1 | FI | HARDEN | — | aberto |
| FIND-019 | `requesterMatchesOwnerActor` = autoridade paralela ao canônico + escrita em checagem + confusão de IDs; rota real protege hoje | R6/passo2-3 | FI | HARDEN | ROOT-004 (parente) | aberto |
| FIND-020 | 🔴 `economic/v2/payment/execute`: rota promete "sandbox" mas service documenta "ledger sempre real" | R10/passo2 | PROV | AUDITORIA_CRÍTICA | — | ✅ **FECHADO POR SELO+MATERIAL (reconciliado 2026-07-28)** — DECISION-0190 selada e IMPLEMENTADA em `a0fdbd9e9`: 501 como 1ª instrução em 8 rotas + guard no runner |
| FIND-021 | `economic/v2` inteiro: sem feature flag, zero caller frontend, alcançável só via API direta | R10/passo3 | PROV | AUDITORIA_CRÍTICA | — | ✅ **FECHADO POR SELO+MATERIAL (mesma frente, reconciliado 2026-07-28)** |
| FIND-022 | refund/chargeback: sem `sandbox_mode` nenhum (não prometem nada, mas agem sobre dinheiro) | R10/passo4 | PROV | AUDITORIA_CRÍTICA | — | ✅ **FECHADO POR SELO+MATERIAL (refund/chargeback estão entre as 8 rotas contidas)** |
| FIND-023 | Contrato Território→Bank: produtor provado correto, consumidor/execução NÃO auditado | R10/passo5 | PROV (produtor) / NÃO AUD (consumidor) | PROVA_RUNTIME/AUDITORIA_PROFUNDA | — | parcial |
| FIND-024 | RFQ: contrato frontend/backend incompatível (prefix `/api` mismatch nos 2 lados), jornada viva | Anexo A | PROV | CORREÇÃO_DIRETA | — | aberto |
| FIND-025 | UnifyBank aliasado em `/bank`+`/admin` (mesmo plugin 2x, todas as rotas duplicadas) | Anexo A | PROV | HARDEN/DECIDE | — | aberto |
| FIND-026 | `occupancy/stats` órfão nos dois lados (rota mal-nomeada + componente frontend sem importador) | Anexo A | PROV | REMOÇÃO_CONTENÇÃO | — | aberto |
| FIND-027 | economy/closure de eventos: kill-switch sempre-500, frontend ainda chama esperando 200 | Anexo A | PROV | CORREÇÃO_DIRETA | — | aberto |
| FIND-028 | Acessos a `bank_*` fora de `modules/bank` = só leitura (reclassificado, severidade baixa) | R0/diag + Anexo A | PROV | INVESTIGAÇÃO | — | aberto (baixo) |

Achados POSITIVOS (não vão para fila; registrados para não re-auditar): nascimento PF atômico (R1); writer único de Actors (R2); `/social/actors/available` já corrigiu vazamento cross-user (R2); antiautoindicação+idempotência de referral provados no schema (R3); `canRepresentActor`/`canActAs`/PORTA_HOLD/quarentena de autoridade (R4); nascimento de empresa atômico + composição correta com selo 0189D (R5); página do Actor universal + compositor sem vocabulário inventado (R7); busca federada zero-verdade-paralela (R8); serviço com autoridade canônica + Unified Availability compartilhada (R9); território produtor correto (R10).

## C.2 — Registro único de causas-raiz (ROOT-NNN)

**ROOT-001 — Ausência de tenant-loop seguro para workers sob RLS**
Sintomas: 6+ workers financeiros DEFAULT-OFF pela mesma razão. Superfícies: Settlement, Release, Financial Alert/Metrics/Risk/SLA, Governance Funding Commitment. Risco: financeiro se religados sem resolver. Contenção atual: default-off estrito (fail-closed). Auditoria necessária: como um worker itera múltiplos tenants sob RLS sem claim cross-tenant. Fechada quando: existir um padrão canônico de tenant-loop provado e os workers puderem religar com segurança.

**ROOT-002 — Não existe build de produção verificado**
Sintomas: peças do caminho de produção não se conectam. Achados: FIND-001 (`npm start` não sobe), + `BOOT.ts` fora do `tsconfig` (nunca type-checked; flags de tesouraria fora do union passam despercebidas) + `dist/BOOT.js` morto (0 bytes). Risco: qualquer alegação futura de "build passou" é não-confiável; erro de tipo no arquivo mais crítico passa silencioso. Contenção atual: nenhuma (roda só via `tsx` em dev). Auditoria: decidir trazer `BOOT.ts` para `src/` vs. type-check dedicado vs. consertar `dist/server.js`. Fechada quando: houver um caminho de produção type-checked e um `npm start`/`build` que de fato suba o servidor real.

**ROOT-003 — Runner canônico não inclui todos os guards existentes**
Sintomas: "runner 200/200 verde" ≠ "sistema coberto". Achados: FIND-011; 84 de 281 guards `audit-*` fora da lista do runner, incluindo guards que tocam ROOT-004, ROOT-001 e o incidente de flag fail-open. Risco: uma regressão em área "protegida por guard" não é pega. Contenção atual: nenhuma. Auditoria: triar cada um dos 84 (válido→entrar / superado / obsoleto→remover / prova pontual). **NÃO adicionar os 84 cegamente** (falsos positivos de guards desatualizados quebrariam o verde). Fechada quando: cada guard tiver destino decidido e o runner refletir a cobertura real.

**ROOT-004 — Personificação de actor via `actionContext.actorId` sem enforcement central**
Sintomas: write "como" outro actor a partir do hint client-declared sem provar representação. Achados: FIND-019 (parente em Grupos); classe JÁ PROVADA real e corrigida em 5 handlers (2026-07-04, `audit-actor-impersonation-writes.mjs` — inclui edição de identidade civil de outro, HIGH). Superfícies: 152 arquivos consomem `actionContext.actorId`; cobertura 1:1 com `canRepresentActor` NÃO provada. Risco: uma 6ª ocorrência não corrigida entre os 152 seria personificação real. Contenção atual: middleware valida forma; cada rota deveria checar autoridade (a maioria checa; não todas comprovadamente); o guard de regressão existe mas está entre os 84 fora do runner (interseção com ROOT-003). Auditoria: fechar o denominador dos 152 por análise ESTRUTURAL automatizada (modelo do próprio guard), não leitura manual. Fechada quando: todo consumidor provadamente checa `canRepresentActor`/`canActAs` antes do write, e a trava roda no runner.

## C.3 — Matriz de cobertura

"Passar por uma rodada" ≠ "domínio integralmente auditado".

| Rodada / Domínio | Cobertura estática | Runtime executado | Banco reconciliado | Autoridade fina | Dinheiro | Estado |
|---|---|---|---|---|---|---|
| R0 Base transversal | alta | não | não | N/A | N/A (só topologia) | mapeada |
| R1 Cadastro/identidade | alta | não | não | parcial | N/A | parcial |
| R2 Actor/perfil mínimo | alta | não | não | parcial | N/A | parcial |
| R3 Indicação (não-fin.) | alta | não | não | parcial | fora (Rodada 10) | parcial |
| R4 Autoridade | média-alta | não | não | parcial (central sim, 152 callers não) | PORTA_HOLD visto | parcial |
| R5 Empresa | média | não | não | parcial (composição c/ 0189D ok) | N/A | parcial |
| R6 Grupos | média | não | não | parcial (achado FIND-019) | N/A | parcial |
| R7 Página/compositor | média | não | não | boa (exemplar) | N/A | parcial |
| R8 Busca/navegação | média | não | não | parcial | N/A | parcial |
| R9 Operações (serviço) | baixa-média (só serviço; produto/locação/demanda NÃO) | não | não | parcial | fora | parcial |
| R10 Money/Fiscal/Território | baixa-parcial | não | não | parcial | **parcial crítica (economic/v2)** | parcial |

Nenhuma linha tem "Banco reconciliado" nem "Runtime executado" — essas são a Fila `PROVA_RUNTIME_BANCO` (C.4), fora do alcance de leitura estática por construção.

## C.4 — Filas finais (cinco operacionais + uma soberana)

Ajuste de precisão (Clayton): são **cinco filas operacionais** + **uma fila soberana `DECIDE`** (institucional, só Clayton resolve — não é operacional).

- **AUDITORIA_CRÍTICA** (dinheiro/autoridade com contradição ou efeito real comprovado): FIND-020, FIND-021, FIND-022 (pacote `economic/v2`).
- **AUDITORIA_PROFUNDA** (autoridade/concorrência/múltiplos writers/SSOT incerto, precisa modelo avançado): ROOT-004 (denominador 152 callers), FIND-007, FIND-023 (consumidor Território→Bank).
- **CORREÇÃO_DIRETA** (defeito localizado, contrato claro, sem decisão institucional): FIND-003, FIND-005, FIND-024, FIND-027; + FIND-004 após decisão.
- **REMOÇÃO_CONTENÇÃO** (órfão/ghost/frontend chamando rota aposentada): FIND-002, FIND-014, FIND-026.
- **PROVA_RUNTIME_BANCO** (não resolvível por leitura estática — exige banco efêmero/execução): reconciliação migrations×registry×físico (item 10), FIND-001/ROOT-002 (build real), FIND-008 (colisão real de prefixos), reachability interna dos órfãos, comportamento do ledger sandbox×real.

`DECIDE` (institucional, só Clayton): FIND-006 (CPF enumerável), FIND-025 (aliases UnifyBank), FIND-004 (religar observation-mode), destino dos 84 guards (ROOT-003).

## C.5 — Ranking de prioridade

Fórmula: `risco soberano × reachability × capacidade de efeito × ausência de contenção × transversalidade × confiabilidade atual das provas`. NÃO por antiguidade nem por volume de texto.

1. **`economic/v2` (FIND-020/021/022)** — risco soberano (dinheiro) + contradição comprovada + alcançável via API + sem contenção de código. Mitigado por: zero caller frontend (reachability de produto baixa). → topo, mas sem pânico.
2. **ROOT-003 (runner incompleto)** — transversal + afeta a CONFIABILIDADE de todas as provas futuras. Precisa ser resolvido antes de usar qualquer suíte como prova de correção.
3. **ROOT-002 (build de produção)** — afeta toda alegação futura de build/deploy; o arquivo mais crítico não é type-checked.
4. **ROOT-004 (personificação)** — classe já provada real; alta transversalidade (152 callers); trava existe mas não roda (interseção com ROOT-003).
5. **ROOT-001 (tenant-loop)** — risco financeiro só se workers religados; contido hoje por default-off (menor urgência imediata, mas bloqueia habilitar workers).
6. **Correções localizadas** (FIND-024 RFQ, FIND-005 log, FIND-006 CPF pós-decisão, FIND-018 grupo não-atômico, FIND-019 authority Grupos, FIND-010 flags, FIND-003 request-id, FIND-002/014/026 órfãos, FIND-027 frontend×contido, FIND-025 aliases) — depois dos estruturais.

## C.6 — ⚠️ **DESATUALIZADO: AUDIT-004 JÁ RODOU (2026-07-21), achou RISCO CRÍTICO VIVO e foi CONTIDO E SELADO (2026-07-22). Não é mais "aguardando GO".** — Pacotes de handoff

**Campos fixos obrigatórios de todo pacote** (Clayton): `BASE/HEAD · MODO · DENOMINADOR · ARQUIVOS INICIAIS · ESCOPO POSITIVO · ESCOPO NEGATIVO · PROVAS EXIGIDAS · CRITÉRIO PASS · CRITÉRIO FAIL · CRITÉRIO STOP · FORMATO DE SAÍDA · DEPENDÊNCIAS DE OUTROS PACOTES`.

**PACOTE AUDIT-001 — `economic/v2` (AUDITORIA_CRÍTICA, modelo avançado)**
- BASE/HEAD: `368eb72cd`.
- MODO: read-only (nenhuma escrita de código; pode SOLICITAR provas de ledger ao AUDIT-006).
- **PERGUNTA PRIMÁRIA (neutra, sem viés de solução — só fatos):** a cadeia `custody → split → authorize → execute → refund → chargeback` preserva autoridade, fronteira Bank, atomicidade, idempotência, conservação, reversão, e correspondência entre contrato externo (rota) e efeito real (service/ledger)?
- **SÓ APÓS o veredito da pergunta primária**, avaliar SOLUÇÃO: contenção da rota; correção do significado de `sandbox_mode`; retirada do runtime; transferência da superfície para `modules/bank`; ou permanência em Eventos só como orquestração. (Não perguntar "deve mover para Bank?" antes de fechar os fatos — induz busca de solução arquitetural prematura.)
- DENOMINADOR: os 9 handlers `economic/v2/*` (advance/custody/split/payment.authorize/revoke/execute/refund/chargeback/chargeback.resolve) + seus services + tabelas/contas tocadas.
- ARQUIVOS INICIAIS: `core/events/event.routes.ts` (linhas ~2563-3459), `event-payment-execution.service.ts`, `event-payment-prepared.service.ts`, `event-custody.service.ts`, `event-refund-chargeback.service.ts`.
- ESCOPO POSITIVO: autoridade por endpoint; origem/validade de `custody`/`split`; contas tocadas; ledger real vs. sandbox de fato; atomicidade; idempotência (`withIdempotency`); rollback/reversão; exposição por API direta; PORTA/HOLD; estado de banco para alcançar `execute`.
- ESCOPO NEGATIVO: não corrigir nada; não decidir arquitetura antes do veredito de fatos.
- PROVAS EXIGIDAS: para cada elo, o efeito real no ledger (ou ausência dele) sob `sandbox_mode=true`; se existe caminho a `execute` sem passar por autorização real.
- PASS: fatos fechados com correspondência contrato↔efeito comprovada (segura ou insegura, mas provada). FAIL: incapacidade de provar o efeito no ledger por leitura → escalar para AUDIT-006 (teste dirigido em banco efêmero). STOP: se descobrir efeito financeiro real alcançável por produto (não só API) → trava B.8 imediata.
- SAÍDA: mapa da cadeia + writers/tabelas + autoridade por endpoint + veredito de contenção SIM/NÃO + recomendação de solução (pós-fatos).
- DEPENDÊNCIAS: pode consumir provas de ledger do AUDIT-006 (não bloqueante para a leitura inicial).

**PACOTE AUDIT-002 — Destino dos guards fora do runner (AUDITORIA_PROFUNDA/DECIDE, modelo intermediário)**
- BASE/HEAD: `368eb72cd`. MODO: read-only, classificatório.
- **DENOMINADOR (reconciliado nesta sessão, não é "simplesmente 84"):** `comandos únicos executados × guards únicos existentes × equivalências/substituições`. Resultado da reconciliação real (2026-07-20):
  - Runner: **200 comandos, todos únicos (0 duplicados)** = **197 guards `audit-*`** + **3 guards de nome diferente** (`guard-financial-regression.ts`, `sql-regression-lint.ts`, `check-migration-numbering.js` — são guards, não `audit-*`).
  - Disco: **281 arquivos `audit-*.mjs`/`.ts`**. No runner: 197 únicos. → **84 ausências**.
  - Equivalência `.mjs`/`.ts`: **0 pares** (nenhum guard existe como os dois → nenhum órfão é "coberto" por gêmeo).
  - Cobertura indireta: **0** dos 84 é lib importada por um guard que está no runner (checado). Nota: `audit-actor-authority-boundary.mjs` é guard E lib compartilhada (importado por 5 guards de payout/bank), mas ELE está no runner — não é órfão.
  - **Conclusão da reconciliação: os 84 são guards standalone reais, sem cobertura direta nem indireta. O número "84" está CONFIRMADO após o denominador completo, não assumido.**
- ESCOPO POSITIVO: classificar cada um dos 84 em {válido→entra / superado por outro já presente / duplicado / obsoleto→remove/arquiva / prova pontual (nunca deveria ser regressão)}.
- ESCOPO NEGATIVO: **NÃO adicionar os 84 cegamente ao runner** (falsos positivos de guards desatualizados quebram o verde); não remover nada ainda.
- PASS: cada um dos 84 com destino decidido + conjunto mínimo recomendado para o runner + lista a remover/arquivar. STOP: se algum órfão revelar uma vulnerabilidade viva não corrigida → vira FIND novo + possível trava B.8.
- SAÍDA: tabela `guard → classificação → ação` + conjunto mínimo do runner. DEPENDÊNCIAS: independente (não precisa de AUDIT-001 nem de banco).

**PACOTE AUDIT-003 — Caminho de produção (PROVA_RUNTIME_BANCO)**
Pergunta: existe (ou como criar) um caminho de build+start type-checked que suba o servidor real?
Provas já existentes: `BOOT.ts` fora do `tsconfig`; `dist/BOOT.js` 0 bytes; `npm start`→`dist/server.js` só reexporta; flags de tesouraria fora do union passam sem erro.
Ainda precisa provar: qual comando/ambiente sobe produção hoje de fato (systemd/PM2/hosting externo?); custo de trazer `BOOT.ts` para `src/`.

**PACOTE AUDIT-004 — Denominador de personificação (AUDITORIA_PROFUNDA, análise estrutural)**
Pergunta: todos os 152 consumidores de `actionContext.actorId` provam `canRepresentActor`/`canActAs` antes de write?
Provas já existentes: 152 consumidores vs. 246 chamadas a `canRepresentActor`; 5 handlers já corrigidos; guard de regressão existe (fora do runner).
Ainda precisa provar: por análise ESTRUTURAL automatizada (não leitura manual), quais consumidores fazem write sem checagem antes. Reusar o método do próprio `audit-actor-impersonation-writes.mjs`.

**PACOTE AUDIT-005 — Tenant-loop e workers (AUDITORIA_PROFUNDA/PROVA_RUNTIME)**
Pergunta: como um worker itera múltiplos tenants sob RLS sem claim cross-tenant, e quais dos workers dormentes podem religar com segurança depois disso?
Provas já existentes: 6+ workers default-off citando a mesma razão; `financial-worker-gate` fail-closed.
Ainda precisa provar: desenho canônico de tenant-loop; por worker, o efeito real (move dinheiro? só lê?) e o pré-requisito de RLS.

**PACOTE AUDIT-006 — Reconciliação de banco (ambiente isolado — NÃO é read-only)**
- **Classificação corrigida (Clayton): NÃO é "read-only" — aplicar migrations/testar rollback ESCREVE em banco.** Classificação correta: `NON-MATERIAL · ISOLATED-EXECUTION · EPHEMERAL-DATABASE · ZERO-WRITE-TO-SHARED-DB · ZERO-CODE-CHANGE`.
- **AUTORIZADO AGORA: apenas o PREFLIGHT** (não a execução completa). Execução completa espera o primeiro checkpoint conjunto.
- Preflight (fatos read-only já colhidos nesta sessão, 2026-07-20): HEAD `368eb72cd`; Node **v22.16.0**; PostgreSQL alvo **15-alpine** (docker-compose); `pg` **^8.11.3**; TypeScript **^5.9.3**; perfil default de migration **CORE_ONLY** (`FULL` opcional via env); 533 migrations em disco, 313 arquivadas, `IGNORED` (2) + `LATENT` (11) documentados.
- Preflight AINDA a fazer (antes de qualquer execução): criar banco efêmero EXCLUSIVO; **confirmar impossibilidade de conexão com `unificard_dev`/produção** (garantia ZERO-WRITE-TO-SHARED-DB); definir snapshots antes/depois; preparar os 4 denominadores (arquivos · registry `schema_migrations` · objetos físicos · modelo esperado pela aplicação).
- Execução completa (SÓ após checkpoint): fresh install · upgrade desde baseline · no-op posterior · rollback · migrations ignoradas/latentes · objetos sem registry · registry sem objeto · checksum divergente.
- DEPENDÊNCIAS: fornece ambiente de falsificação runtime para AUDIT-001 (teste dirigido de ledger). SAÍDA do preflight: ambiente isolado demonstrado + baseline reproduzível + garantia de zero contato com bancos compartilhados.

## C.8 — Decisão de lançamento e coordenação (2026-07-20)

**Decisão do Clayton:** abrir **AUDIT-001** como trilha soberana principal (modelo avançado); em paralelo controlado, **AUDIT-002 integral** (modelo intermediário) e **apenas o preflight de AUDIT-006**. AUDIT-003/004/005 permanecem fechados. Nenhuma correção material até o primeiro checkpoint conjunto.

```
AUDIT-001 (soberana, modelo avançado)
   ├── pode solicitar provas isoladas ao AUDIT-006
   └── não depende do runner para a leitura inicial
AUDIT-002 (confiabilidade das provas, intermediário)
   └── precisa fechar antes de qualquer correção futura usar "runner verde" como evidência
AUDIT-006 (laboratório de execução — só preflight autorizado)
   ├── serve migrations/banco
   └── fornece ambiente de falsificação runtime ao AUDIT-001
```
Relatórios SEPARADOS — uma instância não edita a conclusão da outra.

**Progresso já registrado nesta sessão (instância atual, faixa intermediária):**
- AUDIT-002: denominador reconciliado por completo (ver pacote acima) — primeiro entregável do pacote FEITO. Falta a classificação individual dos 84.
- AUDIT-006 preflight: fatos de versão/perfil/volume colhidos (read-only). Falta a criação do banco efêmero isolado + garantia de não-conexão a bancos compartilhados — isso eu NÃO fiz sem GO explícito, por escrever no ambiente.
- AUDIT-001: é trilha soberana de modelo avançado — não a executei; deixei o pacote pronto (campos fixos + pergunta neutra) para uma instância avançada abrir.

**CHECKPOINT OBRIGATÓRIO — a primeira onda para quando os três entregarem:**
- AUDIT-001: mapa da cadeia financeira · writers/tabelas · autoridade por endpoint · efeitos de sandbox · veredito de contenção.
- AUDIT-002: denominador reconciliado (✅ feito) · classificação de cada guard · conjunto mínimo p/ runner · lista a remover/arquivar.
- AUDIT-006 preflight: ambiente isolado demonstrado · baseline reproduzível · plano fresh/upgrade/rollback · garantia zero-contato com bancos compartilhados.
Só então decidir: (1) AUDIT-006 executa integral; (2) AUDIT-001 precisa de teste dirigido no banco; (3) contenção emergencial precede o resto; (4) abrir AUDIT-003/004/005.

## C.9 — Execução dos GOs (2026-07-20)

### AUDIT-006-PREFLIGHT — 🔴 STOP (não executado, por ausência de pré-condição de ambiente)

`HEAD: 368eb72cd`. Resultado: **STOP acionado pelas próprias regras do GO, ANTES de qualquer escrita ou conexão.**

Motivo: o GO exige "instância PostgreSQL nova e descartável" com container/rede/volume/credenciais exclusivos. Verificação de ambiente (2026-07-20): **nenhum runtime de container disponível** — `docker`, `podman`, `nerdctl`, `docker-compose` todos ausentes. A única instância PostgreSQL alcançável está escutando em `0.0.0.0:5432` — que é exatamente a porta/servidor do ambiente COMPARTILHADO (dev, per `docker-compose.yml`). 

Ação tomada: **nenhuma conexão, nenhuma escrita, nenhum acesso ao Postgres da 5432.** As condições de STOP do GO 2 aplicam-se diretamente ("aparecer host/porta/database associado a ambiente compartilhado"; "houver dúvida sobre qual servidor recebeu a conexão"). Sem container runtime, é impossível provar isolamento de uma instância nova — e improvisar sobre o servidor compartilhado violaria `ZERO-WRITE-TO-SHARED-DB` e a proibição explícita de acessar `unificard_dev`.

Confirmação literal: **ZERO WRITE TO SHARED DATABASES** (nenhuma conexão foi sequer aberta).

Recomendação para desbloquear AUDIT-006 (preflight e, depois, integral): instalar um runtime de container (Docker Desktop / Podman) OU prover explicitamente a Clayton uma connection string de um servidor PostgreSQL comprovadamente descartável e isolado (não o da 5432). Até lá, AUDIT-006 permanece bloqueado — corretamente, por desenho do próprio GO.

## C.7 — Recomendação de sequência e paralelismo (read-only)

Depois desta consolidação, a investigação passa a ser **risk-driven, não pela ordem numérica das rodadas**. Não vale re-ler áreas já provadas maduras (página do Actor, compositor). Vale ainda mapear: banco×migrations, cadeia financeira restante (refund/chargeback/reversão/fiscal/indicação financeira), consumidor de Território→Bank, produto/locação/demanda ainda não percorridos, callers internos dos órfãos, prefixos compartilhados COM writers/autoridade.

Paralelismo permitido AGORA (todos read-only, pacotes fechados, nenhum corrige material): AUDIT-001 (modelo avançado) ∥ AUDIT-002 (intermediário) ∥ AUDIT-006 (ambiente isolado) ∥ organização contínua deste registro. Regra material inalterada: **uma frente material por vez** — e só depois que os pacotes produzirem vereditos fechados.

**Próxima ação:** aguardando Clayton escolher qual pacote de handoff (AUDIT-001..006) abrir primeiro, ou autorizar paralelismo read-only. Nenhuma correção material até vereditos fechados.

## C.10 — AUDIT-002 · Classificação dos 84 guards (2026-07-20)

`HEAD: 368eb72cd`. MODO: read-only (nenhum guard foi EXECUTADO; classificação estática pela leitura do corpo/cabeçalho — o GO permite e, para os 17 que casaram o screen grosseiro de escrita, EXIGE). Denominador reconfirmado = 84 no início.

**Screen de segurança de execução (pré-requisito do GO):** 17 dos 84 casaram um grep grosseiro por `INSERT/UPDATE/.query(/fetch/spawn`. Inspeção dos cabeçalhos mostra que a maioria é **guard estático que LÊ migrations e procura por esses padrões como texto** (não executa) ou **harness de mutação que se auto-declara "não toca DB"**. Nenhum guard foi executado nesta fase — classificação 100% estática, então o risco de escrita é ZERO por construção.

### Resumo numérico (fecha exatamente 84)

| Classificação | Qtd |
|---|---|
| `ACTIVE_VALID` | 77 |
| `ONE_SHOT_PROOF` | 6 |
| `SUPERSEDED_EXPLICIT` | 1 |
| `DUPLICATE_EQUIVALENT` | 0 |
| `OBSOLETE_DEAD_SCOPE` | 0 |
| `BROKEN_OR_STALE` | 0 |
| `AMBIGUOUS_ESCALATE` | 0 |
| **TOTAL** | **84** |

**Nota de confiança honesta (GO FAIL guard):** a classificação usa a finalidade REAL declarada no corpo de cada guard (leitura, não nome) + a DECISION/frente de origem identificável. NÃO foi verificado individualmente, para os 77 `ACTIVE_VALID`, se (a) a superfície protegida ainda existe byte-a-byte no HEAD atual, nem (b) se algum guard JÁ presente no runner cobre o mesmo invariante. Por isso a recomendação dos 77 é **CANDIDATO A INTEGRAÇÃO**, não "adicionar" — cada um exige uma confirmação de superfície-viva + não-duplicação ANTES de entrar no runner (respeita o ESCOPO NEGATIVO "não adicionar os 84 cegamente"). Confiança por linha: `A`=alta (auto-declarado), `M`=média (finalidade clara, superfície não reconfirmada).

### Os 6 `ONE_SHOT_PROOF` (confiança ALTA — auto-declarados; corretamente FORA do runner)

Cinco são HARNESSES de mutação que provam que OUTRO guard morde; vários literalmente escrevem "NÃO é um guard, NÃO entra no runner, NÃO ocupa a posição 186". O sexto é um script de preparação one-time.

| Guard | Evidência (auto-declaração) | Recomendação |
|---|---|---|
| audit-b-city-regional-treasury-grant-substrate-mutations.mjs | "HARNESS de mutações do guard 187... Não toca DB" | manter fora do runner |
| audit-fiscal-tax-reserve-bank-substrate-mutations.mjs | "NÃO é guard, NÃO entra no runner, NÃO ocupa a posição 186" | manter fora |
| audit-governed-vocabulary-manifest-mutations.mjs | "NÃO é um guard, NÃO entra no runner (run-regression-guards.mjs)" | manter fora |
| audit-group-actor-membership-foundation-mutations.mjs | "HARNESS de mutações do guard 189... Não toca DB" | manter fora |
| audit-group-institutional-binding-mutations.mjs | "HARNESS de mutações do guard 188... Não toca DB" | manter fora |
| audit-ownership-financial-phase1.ts | "FASE 1 — AUDITORIA E PREPARAÇÃO... SOMENTE LEITURA" (prep one-time, não regressão) | arquivar ou manter fora |

### O 1 `SUPERSEDED_EXPLICIT` (confiança MÉDIA-ALTA — auto-declarado)

| Guard | Evidência | Sucessor | Recomendação |
|---|---|---|---|
| audit-crm-myorders-route-prefix-contract.mjs | Auto-declara MOOT: módulo `crm.*` REMOVIDO, "a checagem de prefixo não faz mais sentido (nada chama mais /crm/)" | audit-crm-projection-suppliers-reconciliation.mjs (guarda a remoção) | remover/arquivar |

### Os 77 `ACTIVE_VALID` (confiança MÉDIA — finalidade viva declarada; CANDIDATO a integração pós-confirmação)

Subconjunto de **ALTA PRIORIDADE de integração** (financeiro/RLS/autoridade — tocam risco soberano e/ou causas-raiz já registradas):

| Guard | Invariante protegido | Nota de prioridade |
|---|---|---|
| audit-actor-impersonation-writes.mjs | personificação via actionContext (5 handlers) | **ROOT-004** — integrar prioritário |
| audit-event-lifecycle-authority.mjs | BOLA/IDOR no lifecycle de evento (resolveRepresentedActor) | família ROOT-004 |
| audit-social-actors-available-self-anchored.mjs | subject da listagem = principal server-side (vazamento cross-user) | confirmado vivo na R2 |
| audit-service-order-confirm-terms-financial-flag-failclosed.mjs | flag financeira fail-closed | o incidente citado no item 3/8 |
| audit-bank-transaction-sink-firewall.mjs | firewall no sink financeiro (≥18 módulos) | dinheiro |
| audit-rides-financial-firewall.mjs | firewall money-sink de rides | dinheiro |
| audit-b2b-payment-intent-antirevival-guard.mjs | trilho de escrita financeira paralelo contido | dinheiro |
| audit-treasury-split-superseded-antirevival-guard.mjs | 2º motor de split anti-revival | dinheiro |
| audit-regional-fund-legacy-credit-antirevival-guard.mjs | ledger paralelo anti-revival | dinheiro |
| audit-subscriptions-run-due-http-containment.mjs | executePayment sem auth contido | dinheiro + autoridade |
| audit-venue-pay-money-hold-containment.mjs | rota pública → executePayment contida | dinheiro + autoridade |
| audit-guc-tenant-context-transaction-scope-fix.mjs | GUC de tenant sob RLS (fail-closed quebrado) | RLS/isolamento |
| audit-guc-cross-context-reset-on-reuse.mjs | vazamento cross-tenant por GUC stale | RLS/isolamento |
| audit-raw-pool-rls-access-stale-guc-fix.mjs | pool cru herda GUC stale sob RLS | RLS/isolamento |
| audit-rls-policy-guc-canonical.mjs | policy RLS com GUC errado = quebra-fechada silenciosa | RLS/isolamento |
| audit-payment-intents-governance-funding-rls.mjs | 2 tabelas fora do RLS (cross-tenant SELECT/UPDATE) | RLS/isolamento |
| audit-group-a-financial-tables-rls.mjs | RLS+FORCE em 15 tabelas financeiras | RLS (tem E2E-twin) |
| audit-group-b-financial-workers-tenant-loop-rls.mjs | 4 workers claim cross-tenant → tenant-loop | **ROOT-001** |
| audit-catalog-rls-scoped-isolation.mjs | RLS em canonical_services | RLS |
| audit-circuit-breaker-tenant-context-fix.mjs | breaker lido sem tenant-context (fail-open) | dinheiro + RLS |

Restante `ACTIVE_VALID` (invariante vivo declarado, prioridade normal; CANDIDATO a integração pós-confirmação de superfície):
audit-actor-available-group-coverage · audit-actor-mode-surface-clarity-slice · audit-actor-page-contract · audit-actor-relationship-boundary · audit-actor-type-vocabulary-freeze · audit-actor-writer-boundaries (tem npm-script próprio) · audit-audience-single-source · audit-availability-conflict-detection-materialized · audit-available-actor-user-id-misuse · audit-category-input-audit-schema-ghost-fix · audit-cbo-matcher-dormant-landmine-removal · audit-checkout-event-ticket-legacy-schema-ghost-containment · audit-company-activation-kyc-gate · audit-company-agenda-real-wiring · audit-company-metadata-ghost-cleanup · audit-composer-contract · audit-core-feed-batch-post-id-column-fix · audit-crm-projection-suppliers-reconciliation · audit-cultural-checkin-target-actor-type-derived · audit-cultural-checkin-target-authority · audit-delegation-scope-containment · audit-demand-orchestration-boundary · audit-discovery-has-availability-canonical-filter · audit-erp-composed-view · audit-event-reservations-mislabeled-fk-containment · audit-event-rfq-legacy-availability-antirevival-guard · audit-event-settlement-ghost-containment · audit-fiscal-canonical-house · audit-getcompany-response-unwrap-fix · audit-governed-vocabulary-manifest · audit-helpers-dual-implementation-unified · audit-hobby-matcher-dirname-esm-fix · audit-jwt-payload-decode-frontend · audit-l5-frozen-modules-ghost-containment · audit-legacy-service-availability-endpoint-containment · audit-legacy-service-availability-feed-badge-containment · audit-legacy-service-availability-reader-containment · audit-location-authority-classification · audit-marketplace-domain-n0-mapping · audit-provider-availability-readers-canonical · audit-public-profile-discovery-contract · audit-r2-delegation-writer-governed · audit-regional-fund-governance-schema-ghost-containment · audit-regional-fund-pf-resolver · audit-rental-hardening-constraints · audit-rental-resource-surface-contract · audit-schema-authority-classification · audit-search-omni-federation-contract · audit-service-booking-requested-effect-emission · audit-service-discovery-future-availability-slice-b · audit-service-feed-getpost-column-fix · audit-social-post-visibility-read-enforcement · audit-suppliers-identity-boundary · audit-support-ticket-business-fact-gate · audit-unread-counts-feed-visibility-fix · audit-user-group-allocations-silent-call-fix · audit-vehicle-fields-governed.

### Conjuntos finais

- **CANDIDATO A INTEGRAÇÃO ao runner:** os 77 `ACTIVE_VALID` (20 de alta prioridade + 57 de prioridade normal), cada um pendente de confirmação superfície-viva + não-duplicação. Começar pelos 20 de alta prioridade.
- **CANDIDATO A REMOÇÃO/ARQUIVO:** audit-crm-myorders-route-prefix-contract (superseded) + audit-ownership-financial-phase1.ts (prep one-time).
- **MANTER FORA do runner (correto por desenho):** os 5 harnesses de mutação.
- **AMBIGUIDADES para modelo avançado / Clayton:** nenhuma linha bloqueou a classificação. A confirmação de superfície-viva dos 77 é trabalho de segunda passada (pode ser Sonnet), não escalonamento a modelo avançado.

### Recomendação de fechamento do pacote AUDIT-002

O denominador está reconciliado e os 84 têm classificação individual fundamentada na finalidade declarada. O que FALTA para o pacote virar ação (fora do escopo desta fase read-only): (1) por guard `ACTIVE_VALID`, confirmar que a superfície ainda existe e que nenhum guard do runner já cobre; (2) só então propor o conjunto mínimo a integrar. **NÃO adicionar os 77 cegamente** — o próprio ROOT-003 nasceu de guards que não acompanharam o código. Adicionar um guard desatualizado quebraria o verde com falso positivo. A segunda passada de confirmação é o próximo entregável natural, quando Clayton autorizar.

## C.11 — AUDIT-001 · Auditoria crítica read-only de `economic/v2` (2026-07-20)

`HEAD: 368eb72cd · branch rescue-structural · working tree NÃO-STALE` (untracked fora do denominador). Nenhum código/doc/migration/banco alterado. Nenhuma conexão a banco.

**Documentos lidos e vigência:** `docs/01_normative/00_AGENT_PROTOCOL.md` (§2.3.2 fronteira financeira, §8 leitura obrigatória financeira — CANÔNICO/vigente); `docs/01_normative/SSOT_EXCLUSIVE_BANK_RULE.md` (CANÔNICO/vigente — critério de fronteira). `SSOT_CONTRACT/SSOT_REGISTRY/PROHIBITED_STRUCTURES` não relidos integralmente (a regra de fronteira operante — escrita financeira só via Bank — já está fechada por SSOT_EXCLUSIVE_BANK_RULE + protocolo §2.3.2). **Suficiência normativa: SUFICIENTE** para o veredito factual da fronteira.

### 1. Resumo executivo

A cadeia `custody→split→authorize→execute→revoke→refund→chargeback` está **CONTIDA** por um firewall soberano default-off no sink do Bank, e a fronteira Bank é **respeitada** (a camada de Eventos nunca escreve `bank_*` em SQL cru — delega ao `bankTransactionService`). PORÉM há um **defeito real de contrato/rótulo**: a rota `payment/execute` exige `sandbox_mode=true` e diz "No real money will be moved", mas `sandbox_mode` é **cosmético** — não condiciona a escrita no ledger; a única coisa que impede o movimento real é o firewall do sink (`BANK_TRANSACTION_SINK_FIREWALL_ENABLED`, default-off, fail-closed 403), NÃO o `sandbox_mode`. Veredito: **VIVO COM DEFEITO** (contido hoje; perigoso no dia em que a PORTA-1 abrir o sink, se alguém confiar no `sandbox_mode` como proteção). FIND-020 CONFIRMADO como defeito de contrato; FIND-021 reclassificado (contido por firewall, não só "sem frontend").

### 2. Denominador e cobertura

Lidos integralmente: rota `event.routes.ts` (helpers de autoridade + handlers economic/v2), `event-custody.service.ts`, `event-payment-prepared.service.ts` (authorize/revoke), `event-payment-execution.service.ts` (execute), `event-split-declarative.service.ts`, `event-refund-chargeback.service.ts` (grep de dinheiro), `bank-transaction-sink-firewall.ts`, `idempotency-tracker.ts` (withIdempotency), `event-custody`/authorization tabelas. **Denominador de writers de dinheiro FECHADO:** grep exaustivo em `src/core/events/` → o ÚNICO caller do sink do Bank é `event-payment-execution.service.ts:105` (`createSimpleTransaction`). Nenhum outro caminho (refund/chargeback/split/custody/authorize NÃO tocam Bank). As demais menções a `transferService.transfer()` em `core/events/` são arquivos `.md` de checkpoint histórico, não código vivo.

### 3. Mapa da cadeia (efeito real por etapa)

| Etapa | Escreve o quê | Toca dinheiro? |
|---|---|---|
| custody (`createCustody`) | INSERT `event_custody` (fora de bank_*) + outbox `event.custody.created` | **NÃO** — só registra `amount_cents` declarado; NÃO financia escrow |
| split (`calculateSplit`) | persiste split declarativo (valida %≤100, bps≤10000) | **NÃO** |
| authorize (`authorizePayment`) | INSERT `event_payment_authorization` status='authorized' + outbox | **NÃO** |
| **execute** (`executePayment`) | `bankTransactionService.createSimpleTransaction` (escrow→owner, type 'release') + `releaseCustody` | **SIM — único ponto**; atrás do firewall default-off |
| revoke (`revokeAuthorization`) | UPDATE authorization status='revoked' | **NÃO** |
| refund / chargeback / resolve | estado + evento (serviço sem nenhum import de Bank) | **NÃO** |

### 4. Matriz endpoint × autoridade × writer × transação

Todos os 9 handlers: auth via `req.user` + `resolveRepresentedActor(tenant, req.user.userId, actionContext.actorId)` que **prova `canRepresentActor` fail-closed (ForbiddenError)** — `PROVADO` (event.routes.ts:186-212; 23 usos). Tenant server-side. Writer de dinheiro: só execute (via Bank service). Transação: cada service usa `getClientWithTenant` + `BEGIN/COMMIT/ROLLBACK` próprios (custody, authorize) — atômicos por operação; execute usa `withIdempotency` (2 blocos separados: ledger release + custody release).

**Achado de autoridade (`FORTEMENTE INDICADO`):** `canRepresentActor` prova que o caller representa o *actor que age* — **não** que ele é o *dono econômico da custódia* (`economic_owner_id`) nem que tem autoridade sobre os fundos. O modelo é representação-do-ator, não propriedade-do-objeto-econômico. Contido hoje pelo firewall; relevante quando PORTA-1 abrir.

### 5. Matriz de estados e transições

- custody: `active → released` (execute) | `active → reverted` (revert) | `active → cancelled`. Transição por `UPDATE ... WHERE id AND tenant` sem versão/lock otimista; guarda por `status !== 'active'` (check-then-update).
- authorization: `authorized → revoked | executed | cancelled`. **Achado (`PROVADO`): execute NÃO transiciona a authorization para 'executed'** — ela permanece 'authorized' após execução bem-sucedida. A proteção contra re-execução vem SÓ do `withIdempotency` (chave = authorization_id) + do custody virar 'released'. Sequencial: seguro (idempotency retorna cache; custody não-active barra). Concorrente: ver §9.

### 6. Tabelas e contas

Tabelas próprias (fora de bank_*): `event_custody`, `event_payment_authorization`, split declarativo, `event_outbox`, `event_idempotency_tracking`, `event_log`. Contas financeiras: `bankPortsRegistry.getBankAccount().getSystemAccount(tenant,'escrow','BRL')` e `getOrCreateAccount(owner)` — **contas reais do Bank**, resolvidas na execução. `event_custody.amount_cents` é número declarado, NÃO um saldo do SSOT (não fere §2 do SSOT rule enquanto não for tratado como saldo gastável — e não é, até o execute).

### 7. Prova sobre `sandbox_mode`

`PROVADO` (execute service, grep de todos os usos): `sandbox_mode` entra em (a) payload do hash de idempotência, (b) `metadata` da transação, (c) string de reason do releaseCustody ('Execução em sandbox' vs 'Pagamento executado'), (d) `status` da resposta ('simulated' vs 'executed'). **NUNCA condiciona a chamada `createSimpleTransaction`** — a escrita roda igual com `sandbox_mode` true ou false. NÃO há ledger separado, NÃO há contas sandbox, NÃO há marca física que impeça saldo/ledger real. **A resposta 'simulated' NÃO corresponde ao efeito intencionado** (o código intenta ledger real). Comentário do próprio service confirma: "sandbox_mode controla integração externa; ledger sempre real". → **defeito de contrato CONFIRMADO.**

### 8. Prova de atomicidade

`PROVADO`/`FI`: custody e authorize são atômicos (BEGIN/COMMIT/ROLLBACK com outbox na MESMA tx). Execute usa DOIS blocos `withIdempotency` independentes (ledger release; depois custody release) — NÃO na mesma transação. Se o bloco 1 (ledger) sucede e o bloco 2 (custody release) falha, ficaria ledger movido + custody ainda 'active' (estado incompleto). Contido hoje (bloco 1 lança 403 no firewall antes de qualquer escrita → bloco 2 nunca roda → sem estado parcial). Latente quando PORTA-1 abrir.

### 9. Prova de idempotência

`PROVADO`: `withIdempotency` é **check-then-act NÃO-atômico** — `checkIdempotency` (SELECT) → roda handler → `recordIdempotencySuccess` (INSERT ON CONFLICT). O `ON CONFLICT (tenant, event_id, handler_name)` protege a LINHA de tracking, mas o claim ocorre DEPOIS do handler. Replay SEQUENCIAL: seguro (retorna `result_data` cacheado). **Concorrência: vetor TOCTOU de dupla execução** — duas chamadas simultâneas com o mesmo authorization_id ambas passam o check antes de qualquer record, ambas rodam o handler (ledger). Chave inclui tenant+event_id(=authorization_id)+handler+payload-hash (boa granularidade), mas o claim não é atômico. Contido hoje pelo firewall; quando PORTA-1 abrir, depende de o Bank-layer (`createSimpleTransaction`, `eventId: authorization_id`) ter idempotência/lock próprios — **NÃO AUDITADO (Bank-interno)**.

### 10. Prova de conservação

`NÃO AUDITADO` no nível de efeito real (contido pelo firewall). Observação factual: `createCustody` NÃO financia o escrow (nenhum débito), mas `execute` faz `release` de `custody.amount_cents` do escrow para o owner. Se o Bank NÃO validar saldo do escrow, seria criação de centavos (owner creditado a partir de escrow não financiado) — conservação violada. Se validar, o release falharia por saldo. **Qual dos dois = responsabilidade do Bank** (fronteira correta: Eventos delega). Split valida soma≤100 (conservação declarativa OK no split). O valor executado vem de `custody.amount_cents` (snapshot da custódia), não recalculado — bom.

### 11. Prova de reversão

`FI`: refund/chargeback/revoke são estado+evento, SEM movimento de dinheiro (serviços sem Bank). Portanto NÃO "desfazem" nenhum ledger — porque nenhum ledger real existe hoje (firewall). `execute` checa `hasFrozenExecutions` (chargeback congela execução, 403) ANTES de executar — mas essa checagem é uma query separada, não uma trava transacional (ver §ESTADO). Vínculo imutável original↔reversão e dupla-reversão: NÃO AUDITADO em profundidade (sem efeito financeiro hoje, baixa prioridade até PORTA-1).

### 12. Reachability real

`PROVADO`: `economic/v2` registrado SEM feature flag (sempre no boot); ZERO caller frontend (busca exaustiva); alcançável via API direta por qualquer principal autenticado que consiga `canRepresentActor` de algum actor + criar custody/split/authorize (os próprios endpoints criam esse estado). **PORÉM o efeito de dinheiro é CONTIDO por firewall soberano default-off** (`assertBankTransactionSinkFirewallEnabled`, fail-closed 403 antes de qualquer ledger). "Contido", não apenas "invisível": mesmo chamando a cadeia inteira por API direta hoje, o execute lança 403 no sink. Pré-requisitos de estado (custody active + split calculated + authorization authorized) são criáveis pelos próprios endpoints, mas todos param no firewall na hora de mover dinheiro.

### 13. Guards e testes existentes

`audit-bank-transaction-sink-firewall.mjs` protege o firewall que contém esta cadeia — e ele é um dos **84 guards FORA do runner** (AUDIT-002, classificado ACTIVE_VALID alta prioridade). `audit-event-economic-authority-binding.mjs` ESTÁ no runner (200). `audit-event-settlement-ghost-containment` (fora do runner) contém tabela vizinha. Testes E2E: `validate-pipeline-e2e-camada1-dmoney.ts` e afins (prova pontual, não regressão contínua). **A contenção desta cadeia depende de um guard que hoje não roda no runner canônico** — interseção direta com ROOT-003.

### 14. Achados numerados

- **AUD001-F1 (`PROVADO`):** `sandbox_mode` é cosmético; não gateia o ledger write. Rota promete "no real money"; a proteção real é o firewall do sink, não o `sandbox_mode`. Defeito de contrato/rótulo. (= FIND-020 confirmado.)
- **AUD001-F2 (`PROVADO`):** toda a cadeia de dinheiro está contida pelo `BANK_TRANSACTION_SINK_FIREWALL` default-off fail-closed (403 antes de qualquer ledger). Contido, não exploratável hoje. (Reclassifica FIND-021.)
- **AUD001-F3 (`PROVADO`):** fronteira Bank RESPEITADA — Eventos nunca escreve bank_* em SQL cru; único write via `bankTransactionService`. Conforme SSOT_EXCLUSIVE_BANK_RULE + protocolo §2.3.2.
- **AUD001-F4 (`PROVADO`):** `execute` não transiciona authorization→'executed'; re-execução barrada só por idempotency + custody 'released'.
- **AUD001-F5 (`PROVADO`):** `withIdempotency` é check-then-act não-atômico → TOCTOU de dupla execução concorrente (latente atrás do firewall).
- **AUD001-F6 (`FI`):** autoridade = `canRepresentActor` (representação do ator), não propriedade do `economic_owner_id` da custódia. Gap de modelo de autoridade, latente.
- **AUD001-F7 (`PROVADO`):** execute usa 2 blocos de idempotência não-transacionais entre si (ledger release + custody release) → risco de estado parcial se o 2º falhar, latente atrás do firewall.
- **AUD001-F8 (`PROVADO`):** o guard que contém tudo isto (`audit-bank-transaction-sink-firewall.mjs`) está fora do runner (ROOT-003).

### 15. Alegações refutadas

- **REFUTADO (parcial) — "CRÍTICO E REQUER CONTENÇÃO imediata":** NÃO. A cadeia já está contida por firewall soberano fail-closed. Não há caminho atualmente alcançável que mova o ledger. A trava B.8 levantada no passo-2 da Rodada 10 **NÃO se sustenta como emergência** — a passo-2 leu só a rota+service e não encontrou o firewall do sink um nível abaixo; esta auditoria o encontrou.
- **REFUTADO — "service escreve o ledger de forma incondicional e desprotegida":** o service intenta o write incondicionalmente quanto a `sandbox_mode`, mas o write é gateado pelo firewall do sink (default-off). O rótulo enganoso é real; o efeito desprotegido não é (hoje).

### 16. Itens dependentes de banco efêmero (AUDIT-006)

- Conservação real: o Bank rejeita `release` de escrow não financiado, ou cria centavos? (§10)
- Idempotência Bank-layer: `createSimpleTransaction(eventId=authorization_id)` dedupe/lock próprio contra o TOCTOU? (§9)
- Comportamento sob PORTA-1 aberta (flag='true'): a cadeia inteira executada em efêmero, com reversão integral.

### 17. VEREDITO FACTUAL: **VIVO COM DEFEITO** (contido)

Contido hoje por firewall soberano default-off (não é CRÍTICO/não requer contenção emergencial). NÃO é SEGURO/COERENTE (o contrato externo mente sobre o mecanismo de proteção). O defeito material é a **incoerência de contrato**: `sandbox_mode` sugere segurança que ele não provê; a segurança vem do firewall. Risco latente concentra-se no dia da abertura da PORTA-1 (F1, F5, F6, F7 tornam-se vivos se alguém abrir o sink confiando no sandbox).

### 18. Alternativas de tratamento (SÓ agora, separadas dos fatos)

(Não-executadas; para decisão de Clayton, após o veredito factual acima.)
1. **Correção de contrato (mínima, CORREÇÃO_DIRETA):** alinhar a resposta/rótulo — ou `sandbox_mode` de fato curto-circuita antes do write (vira sandbox real), ou a rota para de prometer "no real money" e passa a declarar que depende do firewall. Decisão de produto: qual é a intenção.
2. **Integrar `audit-bank-transaction-sink-firewall.mjs` ao runner** (via AUDIT-002) — para que a contenção que hoje segura esta cadeia não possa regredir sem o runner morder.
3. **Endereçar F5 (TOCTOU) e F6 (autoridade=representação≠propriedade) ANTES de abrir PORTA-1** — são as travas que faltam para o dia em que o sink abrir.
4. Fronteira/organização (`economic/v2` em Eventos vs. Bank): deliberadamente NÃO decidido aqui (a fronteira de ESCRITA já está correta — delega ao Bank; a discussão de mover a orquestração é secundária e fora do fato de segurança).

**Nenhuma correção material executada. Nenhum STOP de emergência disparado (contenção confirmada).**

## C.12 — AUDIT-002 Passe 2 · Vigência e equivalência dos 77 candidatos (2026-07-20)

`HEAD: 368eb72cd` (confirmado idêntico no início e no fim — runner e disco também inalterados). MODO: read-only, classificação estática. Nenhum guard foi EXECUTADO — verificação por leitura do corpo (assertions/`check()`/`readFileSync`) de cada guard + confirmação de existência/conteúdo do arquivo-alvo no HEAD atual, não por cabeçalho/nome.

### 1. Resumo numérico

| Classificação final | Qtd |
|---|---|
| `ACTIVE_VALID` | **77** |
| `SUPERSEDED_EXPLICIT` | 0 (novos nesta passada) |
| `DUPLICATE_EQUIVALENT` | 0 |
| `OBSOLETE_DEAD_SCOPE` | 0 |
| `BROKEN_OR_STALE` | 0 |
| `AMBIGUOUS_ESCALATE` | 0 |
| **TOTAL PASSE 2** | **77** |

**TOTAL AUDIT-002 UNIVERSE = 77 + 6 (ONE_SHOT_PROOF, Passe 1) + 1 (SUPERSEDED_EXPLICIT, Passe 1) = 84.**

### 2. Método aplicado (honestidade de confiança)

Para cada um dos 77: (a) extraído do corpo do guard (não do comentário) o(s) arquivo(s)-alvo real(is) via suas próprias chamadas `readFileSync`/`join`; (b) confirmada a existência de cada arquivo-alvo no HEAD atual; (c) para os guards com assertion textual explícita e verificável a baixo custo, reconfirmada a condição central (ex.: firewall ainda default-off, tabela fantasma ainda morta, wiring ainda ausente); (d) checado se algum guard do runner (197) protege a mesma superfície — nenhuma sobreposição encontrada nos 77. Confiança por guard: `A` (alta) = arquivo confirmado + assertion central reverificada; `M` (média) = arquivo confirmado, assertion aceita por leitura de header + estrutura do corpo sem reexecução de toda a lógica interna. Nenhum guard ficou só em confiança de nome/cabeçalho — todos tiveram ao menos o arquivo-alvo do corpo confirmado.

**Duas correções de rota durante o processo (transparência exigida pelo GO):**
- `audit-rls-policy-guc-canonical.mjs`: uma varredura inicial encontrou 5 migrations com GUC não-canônico (`app.tenant_id`/`app.current_tenant_id`), o que pareceria um achado grave. Leitura do CORPO do guard (não do cabeçalho) revelou que ele já trata essas 5 como `SUPERSEDED` explicitamente (política corrigida via DROP+CREATE na migration corretiva `20260706160000_fix_rls_policies_wrong_guc.sql`, confirmada existente) — falso alarme meu, resolvido pela leitura do corpo, exatamente como o GO exigiu.
- `audit-cbo-matcher-dormant-landmine-removal.mjs`: meu método padrão de "arquivo deve existir" sinalizou `cbo-matcher.service.ts` como AUSENTE. Leitura do corpo mostrou que a AUSÊNCIA do arquivo É o estado de PASS esperado (guard de anti-revival: morde se o arquivo VOLTAR a existir). Corrigido antes de classificar.

### 3. Tabela completa dos 77 (por lote)

#### LOTE 1 — Autoridade, Actor e impersonation (20)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-actor-impersonation-writes.mjs | 5 handlers provam canRepresentActor antes de write sob actor declarado | identity/social/feed/location/inbox routes | LIVE | nenhum | ACTIVE_VALID | A |
| audit-event-lifecycle-authority.mjs | resolveRepresentedActor fail-closed no lifecycle de evento | event.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-social-actors-available-self-anchored.mjs | subject da listagem ancorado em req.user.id (vazamento cross-user fechado) | social-2.0.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-actor-available-group-coverage.mjs | findAvailableActors inclui seção de grupos | actor.repository.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-actor-mode-surface-clarity-slice.mjs | pílula quem×modo no GlobalHeader (frontend UX) | GlobalHeader.tsx/Wallet.tsx/actorContextConfig.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-actor-page-contract.mjs | página do actor read-only, canRepresentActor em operating, anti-PII | actor-page.* | LIVE (confirmado exemplar na Rodada 7) | nenhum | ACTIVE_VALID | A |
| audit-actor-relationship-boundary.mjs | relação≠autoridade (nunca importa company_users/canManageCompany/bank_*) | actor-relationship.* | LIVE (reconfirmado: zero import proibido) | nenhum | ACTIVE_VALID | A |
| audit-actor-type-vocabulary-freeze.mjs | vocabulário actor_type congelado, sem novo writer de valor legado | grep amplo em src/ | LIVE | nenhum | ACTIVE_VALID | M |
| audit-actor-writer-boundaries.mjs | todo actor nasce via actor-writer.service (writer único) | grep amplo | LIVE (confirmado Rodada 2) | nenhum (tem npm-script próprio `validate:actor-writer-boundaries`) | ACTIVE_VALID | A |
| audit-available-actor-user-id-misuse.mjs | activeActor.user_id trocado por actor_id em completedBy | arquivos wizard frontend | LIVE | nenhum | ACTIVE_VALID | M |
| audit-cultural-checkin-target-actor-type-derived.mjs | actor_type sempre derivado server-side no check-in cultural | cultural.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-cultural-checkin-target-authority.mjs | alheio não-representável → 403 antes da escrita | cultural.routes.ts/cultural-event.service.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-delegation-scope-containment.mjs | delegação só concede representação com scopes inclui '\*' | authorization.service.ts | LIVE (reconfirmado Rodada 4) | nenhum | ACTIVE_VALID | A |
| audit-demand-orchestration-boundary.mjs | Δbank=0 + catraca 1:1 + RLS FORCE no motor de demanda | módulo demands | LIVE | nenhum | ACTIVE_VALID | A |
| audit-location-authority-classification.mjs | localidade operacional aponta pro Location Core canônico | manifesto próprio + migrations | LIVE | nenhum | ACTIVE_VALID | M |
| audit-public-profile-discovery-contract.mjs | publish/mine exigem canRepresentActor, actor nunca do body | public-profile.* | LIVE (reconfirmado) | nenhum | ACTIVE_VALID | A |
| audit-r2-delegation-writer-governed.mjs | grant/revoke atômicos com evento, repo não decide autoridade | company-membership-commands.service.ts | LIVE (BEGIN/COMMIT reconfirmado) | nenhum | ACTIVE_VALID | A |
| audit-schema-authority-classification.mjs | trava contra tratar cadáver/read-model/coluna-legada como fonte | manifesto schema-authority-classification.mjs | LIVE | nenhum | ACTIVE_VALID | M |
| audit-suppliers-identity-boundary.mjs | fronteira de identidade suppliers, writer único, assertActorExists | supplier.repository.ts + migration | LIVE (reconfirmado) | nenhum | ACTIVE_VALID | A |
| audit-support-ticket-business-fact-gate.mjs | Chamado gated por fato de negócio real, RLS FORCE | support-ticket.* | LIVE | nenhum | ACTIVE_VALID | M |

#### LOTE 2 — Bank, ledger, split, firewall e reversão (11)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-service-order-confirm-terms-financial-flag-failclosed.mjs | isFinancialEnabled fail-closed real, exige 'true' exato | feature-flags.ts | LIVE (reconfirmado item 3/8) | nenhum | ACTIVE_VALID | A |
| audit-bank-transaction-sink-firewall.mjs | firewall default-off no sink compartilhado do Bank | bank-transaction-sink-firewall.ts/bank-transaction.service.ts | LIVE (reconfirmado em profundidade no AUDIT-001 — é o que contém economic/v2 hoje) | nenhum | ACTIVE_VALID (prioridade máxima) | A |
| audit-rides-financial-firewall.mjs | firewall no money-sink de rides | rides-financial-firewall.ts + distribution.service.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-b2b-payment-intent-antirevival-guard.mjs | trilho de escrita financeira paralelo permanece sem importador | grep amplo em src/ | LIVE | nenhum | ACTIVE_VALID | M |
| audit-treasury-split-superseded-antirevival-guard.mjs | 2º motor de split permanece sem caller vivo fora do worker default-off | treasury-split.service.ts/worker | LIVE (reconfirmado: zero callers externos) | nenhum | ACTIVE_VALID | A |
| audit-regional-fund-legacy-credit-antirevival-guard.mjs | ledger paralelo (total_balance_cents direto) contido | grep amplo | LIVE | nenhum | ACTIVE_VALID | M |
| audit-subscriptions-run-due-http-communication.mjs (subscriptions-run-due-http-containment) | executePayment sem auth contido | subscription.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-venue-pay-money-hold-containment.mjs | rota pública→executePayment com firewall próprio | venue-financial-firewall.ts/venue.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-fiscal-canonical-house.mjs | casa fiscal única, 2 casas fantasmas continuam mortas | fiscal-profile.* + migration | LIVE (reconfirmado: company_profiles/tax_profiles zero leitura/escrita) | nenhum | ACTIVE_VALID | A |
| audit-regional-fund-governance-schema-ghost-containment.mjs | rota de fundo regional contida (tabelas ghost) | regional-fund-governance.routes.ts + feature guard | LIVE | nenhum | ACTIVE_VALID | M |
| audit-regional-fund-pf-resolver.mjs | resolver PF do fundo regional não mais fail-closed imediato | service-payment-execution.service.ts | LIVE | nenhum | ACTIVE_VALID | M |

#### LOTE 3 — RLS, tenant, GUC e workers (9)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-guc-tenant-context-transaction-scope-fix.mjs | GUC setado com BEGIN explícito (não evapora) | pool.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-guc-cross-context-reset-on-reuse.mjs | GUC resetado ao reutilizar conexão do pool | pool.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-raw-pool-rls-access-stale-guc-fix.mjs | pool cru não herda GUC stale sob RLS | actor-bank-destination.service.ts/product-offering.service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-rls-policy-guc-canonical.mjs | nenhuma CREATE POLICY nova com GUC não-canônico | varre todas migrations (com SUPERSEDED-set próprio) | LIVE (reconfirmado — ver §2) | nenhum | ACTIVE_VALID | A |
| audit-payment-intents-governance-funding-rls.mjs | RLS+FORCE nas 2 tabelas | migration 20260702150000 | LIVE | nenhum | ACTIVE_VALID | A |
| audit-group-a-financial-tables-rls.mjs | RLS+FORCE em 15 tabelas financeiras Grupo A | migration 20260702160000 | LIVE (tem E2E-twin) | nenhum | ACTIVE_VALID | A |
| audit-group-b-financial-workers-tenant-loop-rls.mjs | 4 workers convertidos a tenant-loop (ROOT-001) | migration 20260702170000 | LIVE | nenhum | ACTIVE_VALID (prioridade — ROOT-001) | A |
| audit-catalog-rls-scoped-isolation.mjs | RLS em canonical_services/canonical_catalog_events | migration 20260702130000 | LIVE | nenhum | ACTIVE_VALID | A |
| audit-circuit-breaker-tenant-context-fix.mjs | breaker lido com tenant-context (não fail-open) | financial-circuit-breaker-repository.ts | LIVE | nenhum | ACTIVE_VALID | A |

#### LOTE 4 — Migrations, schema e funções SQL (13)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-category-input-audit-schema-ghost-fix.mjs | tabela category_input_audit aplicada sem colunas fantasma | migration 20260702110000 | LIVE | nenhum | ACTIVE_VALID | A |
| audit-cbo-matcher-dormant-landmine-removal.mjs | wiring morto REMOVIDO (arquivo deve estar AUSENTE) | cbo-matcher.service.ts (ausência = PASS) | REMOVED (confirmado; comentários residuais são só texto, sem referência real) | nenhum | ACTIVE_VALID | A |
| audit-checkout-event-ticket-legacy-schema-ghost-containment.mjs | INSERT em event_tickets com colunas fantasma contido | checkout-ticket.service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-core-feed-batch-post-id-column-fix.mjs | getPostsBatch usa `id` (não `post_id` inexistente) | feed-plugin.service.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-event-reservations-mislabeled-fk-containment.mjs | coluna global_user_id mal-rotulada removida (era FK p/ actors) | migration 20260703120000 + occupancy.* | LIVE | nenhum | ACTIVE_VALID | A |
| audit-event-settlement-ghost-containment.mjs | 3 superfícies de event_settlements (tabela ghost) contidas | event-settlement.service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-helpers-dual-implementation-unified.mjs | core/db.ts delega pra core/database/pool.ts (não duplica) | db.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-hobby-matcher-dirname-esm-fix.mjs | hobby-matcher usa process.cwd() (não __dirname, ESM-safe) | hobby-matcher.service.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-l5-frozen-modules-ghost-containment.mjs | 4 módulos frozen (venue/work-instant/policy-engine/residence) contidos | varredura de TARGETS | LIVE | nenhum | ACTIVE_VALID | M |
| audit-service-feed-getpost-column-fix.mjs | getPost usa `id` (não `post_id` inexistente) | service-feed.plugin.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-unread-counts-feed-visibility-fix.mjs | contador feed sem coluna fantasma posts.visibility='PUBLIC' | feed.routes.ts/social.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-user-group-allocations-silent-call-fix.mjs | probe explícito to_regclass (não engole erro em catch mudo) | user-group-allocation.repository.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-rental-hardening-constraints.mjs | 2 constraints de hardening de locação permanecem materializadas | migration trava3_availability_overlap | LIVE | nenhum | ACTIVE_VALID | A |

#### LOTE 5 — Anti-revival, legado e superfícies contidas (11)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-event-rfq-legacy-availability-antirevival-guard.mjs | writer legado RFQ não revive availability owner_type='service' | event-rfq.routes.ts/service.ts | LIVE (defeito já mapeado no Anexo A — FIND-024, ainda vivo) | nenhum | ACTIVE_VALID | A |
| audit-legacy-service-availability-endpoint-containment.mjs | endpoint público legado contido p/ serviço canônico-bound | unified-availability.types.ts/services.routes.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-legacy-service-availability-feed-badge-containment.mjs | feed não habilita BOOK por sinal legado | service-feed.plugin.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-legacy-service-availability-reader-containment.mjs | reader de descoberta suprime summary legado | services.service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-provider-availability-readers-canonical.mjs | pending-responsibilities/impact-overview usam SSOT canônico | impact-overview.routes.ts/pending-responsibilities.routes.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-discovery-has-availability-canonical-filter.mjs | filtro has_availability mede pelo SSOT canônico | services.repository.ts/service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-crm-projection-suppliers-reconciliation.mjs | módulo crm.\* REALMENTE removido, CRM é projeção de actor_relationships | módulo crm (ausência confirmada) | REMOVED (confirmado) | nenhum | ACTIVE_VALID | A |
| audit-company-metadata-ghost-cleanup.mjs | updateCompany não monta UPDATE em coluna metadata inexistente | companies.service.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-getcompany-response-unwrap-fix.mjs | getCompany desembrulha .data (não devolve wrapper inteiro) | frontend/api/companies.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-company-agenda-real-wiring.mjs | wizard de agenda materializa no SSOT temporal real | 6 arquivos front+back | LIVE | nenhum | ACTIVE_VALID | M |
| audit-company-activation-kyc-gate.mjs | ativação operacional exige kyc_status='approved' | companies.service.ts | LIVE | nenhum | ACTIVE_VALID | A |

#### LOTE 6 — Produto, APIs e contratos frontend/backend (13)

| Guard | Objetivo real | Superfície | Estado | Runner equivalente | Classificação | Confiança |
|---|---|---|---|---|---|---|
| audit-audience-single-source.mjs | lista de plateia só nasce de /audience-options | audience-options.ts/audience.routes.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-availability-conflict-detection-materialized.mjs | detect_availability_conflicts() não é mais stub vazio | migration 20260702140000 | LIVE | nenhum | ACTIVE_VALID | A |
| audit-composer-contract.mjs | compositor projeta SSOT de intents, não inventa vocabulário | composer.service.ts | LIVE (confirmado exemplar Rodada 7) | nenhum | ACTIVE_VALID | A |
| audit-erp-composed-view.mjs | bloco ERP só em operating+company, reusa blocks já computados | actor-page.service.ts/purchase-order.repository.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-governed-vocabulary-manifest.mjs | manifesto de vocabulários bate com a fonte viva (anti-drift) | governed-vocabularies.manifest.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-jwt-payload-decode-frontend.mjs | decodeJwtPayload base64url-safe único (10 call sites) | frontend/utils/jwt.ts | LIVE (reconfirmado: helper existe) | nenhum | ACTIVE_VALID | A |
| audit-marketplace-domain-n0-mapping.mjs | mapa MarketplaceDomain→N0 bate literalmente com DECISION-0106 | marketplace-domain-n0-mapping.ts | LIVE | nenhum | ACTIVE_VALID | A |
| audit-rental-resource-surface-contract.mjs | owner de recurso alugável sempre server-side | rentable-resource.repository.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-search-omni-federation-contract.mjs | busca federada, anti-PII, zero verdade paralela | search-omni.service.ts | LIVE (confirmado exemplar Rodada 8) | nenhum | ACTIVE_VALID | A |
| audit-service-booking-requested-effect-emission.mjs | SERVICE_BOOKING_REQUESTED emitido no create booking | unified-availability.service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-service-discovery-future-availability-slice-b.mjs | discoverServices filtra por startDate/endDate futuros | services.repository.ts/service.ts | LIVE | nenhum | ACTIVE_VALID | M |
| audit-social-post-visibility-read-enforcement.mjs | posts.visibility governado por CHECK, sem valores fantasma | post-audience.house.ts/social-2.0.* | LIVE | nenhum | ACTIVE_VALID | A |
| audit-vehicle-fields-governed.mjs | veículo em locação só via combobox governado, CEP no backend | rentable-resource.repository.ts/.service.ts + frontend | LIVE | nenhum | ACTIVE_VALID | A |

**Lote 7 — Restantes: vazio** (os 77 couberam integralmente nos 6 lotes acima).

### 4. Candidatos comprovados a integração

Todos os 77 são candidatos comprovados a integração (superfície viva confirmada + invariante vigente + sem equivalente no runner). Priorização sugerida (inalterada do Passe 1, agora com confirmação individual): os 20 do Lote 1 + os 11 do Lote 2 + os 9 do Lote 3 tocam autoridade/dinheiro/RLS diretamente — prioridade de integração mais alta. Destaque: `audit-bank-transaction-sink-firewall.mjs` (contém `economic/v2`, ver AUDIT-001) e `audit-group-b-financial-workers-tenant-loop-rls.mjs` (ROOT-001) deveriam ser os dois primeiros a integrar.

### 5. Guards equivalentes ou duplicados

**Nenhum encontrado.** Os 77 protegem 77 superfícies distintas; nenhum guard do runner (197) cobre a mesma combinação de arquivo+invariante.

### 6. Guards stale ou quebrados

**Nenhum.** Zero `BROKEN_OR_STALE` nesta passada.

### 7. Guards de escopo morto

**Nenhum novo.** (O único caso do universo de 84 com escopo morto/superado continua sendo o `SUPERSEDED_EXPLICIT` já identificado no Passe 1 — `audit-crm-myorders-route-prefix-contract.mjs`, fora dos 77.)

### 8. Ambiguidades

**Nenhuma.** Zero `AMBIGUOUS_ESCALATE`. Nenhum conflito normativo exigiu modelo avançado nesta passada.

### 9. Dependências normativas

Vários guards deste passe citam DECISION-0113/0117/0156/0189 e a Lei de Coerência — consistente com o que já foi lido no AUDIT-001 (protocolo + SSOT_EXCLUSIVE_BANK_RULE). Nenhuma norma adicional precisou ser relida para fechar as classificações.

### 10. Recomendações futuras (não executadas)

1. Integrar ao runner, em ordem de prioridade: (a) Lote 2 completo (financeiro) + Lote 3 completo (RLS/tenant) — maior risco soberano; (b) Lote 1 completo (autoridade/actor); (c) Lotes 4-6 (schema/produto), risco menor mas ainda regressão real.
2. Antes de cada integração individual: rodar o guard uma vez isoladamente (fora deste pacote, com autorização própria) para confirmar que ele PASSA hoje — evitar quebrar o runner verde com um guard que, apesar de válido, acuse algo não previsto.
3. Manter os 6 `ONE_SHOT_PROOF` + 1 `SUPERSEDED_EXPLICIT` (Passe 1) fora do runner, como já decidido.

### 11. Confirmação literal

```
ZERO CODE CHANGE
ZERO RUNNER CHANGE
ZERO DATABASE ACCESS
TOTAL CLASSIFIED = 77
TOTAL AUDIT-002 UNIVERSE = 84
HEAD INALTERADO: 368eb72cd (confirmado início e fim)
```

## C.13 — AUDIT-001 · Falsificação independente (2ª instância, 2026-07-20)

`HEAD: 368eb72cd` (confirmado idêntico ao auditado; sem STALE; nenhum arquivo do denominador alterado). Read-only, zero acesso a banco. Denominador reconstruído do ZERO (grep/leitura fresca) ANTES de comparar ao relatório da 1ª auditora. Postura adversarial: tentei quebrar cada conclusão load-bearing, não resumir.

### 1. Denominador independente (reconstruído)

Cadeia: `custody → split → authorize → execute → revoke → refund → chargeback → resolve`.
- **Writers de estado:** `event_custody` (custody), split declarativo, `event_payment_authorization` (authorize/revoke), `event_outbox`, `event_idempotency_tracking`. **Writer de dinheiro:** UM — `event-payment-execution.service.ts:105` → `bankTransactionService.createSimpleTransaction` (escrow→owner).
- **Authority gates:** `resolveRepresentedActor` (route, prova `canRepresentActor` fail-closed, 23 usos).
- **Idempotency boundaries:** `withIdempotency` (event layer, chave authorization_id) + **[NOVO, não citado pela 1ª auditora] dedup por referência no Bank** (`SELECT ... reference_type+reference_id` → throw) + `lockAccounts` (lock pessimista no Bank).
- **Feature flags/PORTA:** `BANK_TRANSACTION_SINK_FIREWALL_ENABLED` (default-off, fail-closed) — a contenção soberana.
- **Callers:** reconstruí independentemente e busquei writer/caller escondido (ver §6). Resultado: os services de eventos são referenciados SÓ dentro de `src/core/events/` + a rota. Zero worker/script/handler/outbox externo.

### 2. Diferenças contra o denominador da 1ª auditora

Convergência quase total. O denominador da 1ª auditora estava **COMPLETO no eixo de callers e writers**. Duas peças que ela NÃO abriu (parou na fronteira e marcou NÃO AUDITADO) e que eu abri: (a) a idempotência/lock PRÓPRIOS do Bank; (b) a ausência de checagem de overdraft no sink. Nenhuma das duas muda o veredito, mas refinam dois achados latentes (F5 e conservação).

### 3. Conclusões CONFIRMADAS (reproduzidas independentemente)

- **Denominador de callers fechado — CONFIRMADA.** Vetor "caller esquecido/writer escondido por nome genérico" testado a fundo: os ~13 hits de `executePayment` em marketplace/PDV/subscriptions são de um service HOMÔNIMO DIFERENTE (`marketplace/payment-execution.service.ts`), NÃO o de eventos. Filtrando por símbolo específico (`eventPaymentExecutionService`/`event-payment-*`), só há referências dentro de `core/events/`. A 1ª auditora acertou: "chamador único = a rota".
- **Sem auto-execução event-driven — CONFIRMADA (achado meu que reforça).** `register-handlers.ts` NÃO registra nenhum handler para `event.payment.authorized`/`event.custody.created`/`event.payment.executed`. O caminho outbox→handler→auto-execute (o vetor mais perigoso que eu poderia ter usado para refutar) NÃO existe. A cadeia só avança por chamada HTTP explícita.
- **Fronteira Bank respeitada — CONFIRMADA.** Único write via `bankTransactionService`; zero SQL cru em `bank_*` na camada de Eventos. Conforme SSOT_EXCLUSIVE_BANK_RULE.
- **`sandbox_mode` cosmético — CONFIRMADA.** Não condiciona a escrita; só metadado/log/rótulo de resposta.
- **Contenção pelo firewall do sink — CONFIRMADA.** `assertBankTransactionSinkFirewallEnabled` default-off lança 403 antes de qualquer ledger. É a contenção real, não o `sandbox_mode`.
- **Autoridade no route via canRepresentActor — CONFIRMADA.** E o vetor "service chamável sem a rota" é MOOT: não existe caller do service fora da rota (§3 acima). Ressalva mantida abaixo (F6).

### 4. Conclusões REFUTADAS / materialmente limitadas

- **F5 (TOCTOU de dupla execução) — CONFIRMADA COM RESSALVA (superestimada pela 1ª auditora).** O relatório flagou o TOCTOU do `withIdempotency` e disse "depende de idempotência Bank-layer, NÃO AUDITADO" — mas NÃO foi ler o Bank-layer, que é onde a mitigação vive. Eu li: o Bank tem (a) dedup por `reference_type+reference_id` (SELECT→throw "already exists", linha 992-999) e (b) `lockAccounts` (lock pessimista, linha 1042). Juntos, serializam execuções concorrentes e barram a 2ª. Portanto o risco de dupla execução é MUITO menor do que F5 sugere. Não é ZERO (a concorrência-segurança do SELECT-dedup depende de UNIQUE constraint em `bank_transactions(tenant,reference_type,reference_id)` = verificação runtime/DB), mas o relatório pintou F5 como risco latente mais grave do que a evidência sustenta. → **limitação real do relatório.**

### 5. Conclusões NÃO PROVADAS (pela 1ª auditora e por mim, sem runtime)

- **Conservação — CONFIRMADA COM RESSALVA (sub-desenvolvida pelo relatório).** O relatório marcou NÃO AUDITADO (correto). Eu fui um nível mais fundo, estaticamente: `createSimpleTransactionWithAuthorship` **NÃO rejeita saldo negativo** — calcula `fromBalanceAfter = balance - amount` (linha 1102) e grava o débito mesmo se negativo, SEM `if (<0) reject`. Consequência precisa: a **partida dobrada É conservada** (débito=crédito, soma do ledger = zero → NÃO "cria centavos" no sentido contábil), mas **não há proteção de overdraft** — o escrow não financiado iria a saldo NEGATIVO num release. Se o escrow é conta de emissão/liquidez, aceitável; se é custodial real, é furo. Isso é institucional/runtime, mas a 1ª auditora poderia ter estabelecido estaticamente que "a contenção de conservação NÃO é o Bank rejeitar o release — é SÓ o firewall". → **omissão material (não-fatal) do relatório.**

### 6. Achados OMITIDOS pela 1ª auditora

1. Idempotência+lock próprios do Bank (`reference`-dedup + `lockAccounts`) — relevantes para F5, não citados.
2. Ausência de checagem de overdraft no sink — relevante para conservação, não citada.
3. `requireFinancialRiskClearanceForDebitSide` (linha 1070) existe no débito — um gate de risco adicional (não é checagem de saldo), não citado. Nenhuma dessas três muda o VEREDITO (contido por firewall); refinam latentes.

### 7. Dependências de banco/runtime (para AUDIT-006)

- Existe UNIQUE em `bank_transactions(tenant,reference_type,reference_id)`? (decide se o dedup do Bank é concorrência-seguro → fecha F5).
- O escrow pode ir a saldo negativo de fato, ou há constraint/trigger de não-negatividade? (decide o furo de conservação quando PORTA-1 abrir).
- Comportamento real da cadeia com `BANK_TRANSACTION_SINK_FIREWALL_ENABLED=true` em efêmero.

### 8. Risco de FALSO POSITIVO no relatório

Baixo-médio. O relatório NÃO declarou nada seguro sem prova; foi honesto sobre o NÃO AUDITADO. O único exagero é F5 (risco de dupla execução pintado mais grave do que a evidência do Bank-layer sustenta) — falso positivo de SEVERIDADE, não de existência.

### 9. Risco de FALSO NEGATIVO no relatório

Baixo. Testei os vetores que poderiam esconder um risco não-detectado (caller/writer escondido, auto-execução event-driven, service chamável sem rota, criação de centavos por partida dobrada) — todos NEGATIVOS. A contenção pelo firewall é real e cobre TODA a cadeia. O único "falso negativo" candidato é a ausência de overdraft (§5), que o relatório subdesenvolveu mas não negou (marcou NÃO AUDITADO).

### 10. VEREDITO sobre a qualidade do AUDIT-001: **CONFIÁVEL COM RESSALVAS**

Todas as conclusões load-bearing (contenção por firewall, fronteira Bank respeitada, sandbox cosmético, denominador de callers completo, sem auto-execução event-driven) são independentemente CONFIRMADAS. O veredito factual "VIVO COM DEFEITO (contido)" sustenta-se sob falsificação adversarial — NÃO é materialmente refutado. Ressalvas: (a) F5 superestimado (o Bank mitiga mais do que o relatório reconheceu); (b) conservação subdesenvolvida (o relatório poderia ter provado estaticamente a ausência de overdraft e que a contenção é SÓ o firewall). Ambas são refinamentos que TORNAM O QUADRO MAIS PRECISO, não que derrubam o veredito. A honestidade do relatório sobre o que não auditou é o que permitiu localizar exatamente onde os refinamentos cabiam.

### 11. Recomendação sobre o próximo ato

**Decisão sem execução + prova em banco efêmero (AUDIT-006) ANTES de qualquer abertura de PORTA-1.** Concretamente: (1) tratar o defeito de contrato (rótulo `sandbox_mode`/resposta 'simulated' vs. efeito) como CORREÇÃO_DIRETA de produto — decisão de Clayton sobre a intenção; (2) integrar `audit-bank-transaction-sink-firewall.mjs` ao runner (a contenção não pode regredir sem o runner morder); (3) resolver, em efêmero, as duas perguntas do §7 (UNIQUE de referência; não-negatividade do escrow) ANTES de abrir a PORTA-1 — são as travas que faltam. NÃO há risco crítico vivo que exija contenção humana imediata (o firewall já contém). Nenhuma correção material aberta.

```
ZERO CODE CHANGE · ZERO REPORT CHANGE · ZERO DATABASE ACCESS
HEAD 368eb72cd (inalterado) · veredito AUDIT-001: CONFIÁVEL COM RESSALVAS
```

## C.14 — GO Decisão docs-only economic/v2 · 🛑 STOP normativo · VEREDITO B (2026-07-20)

`HEAD: 368eb72cd` (branch rescue-structural; working tree sem modificações tracked; denominador inalterado — NÃO-STALE). MODO docs-only, read-first. **NENHUM documento de decisão foi criado** — um STOP normativo disparou e há reconciliação que exige autorização de Clayton antes de qualquer texto selado. NENHUM código/migration/bank/runner tocado. PORTA-1 fechada.

### 1. Leitura normativa realizada

00_AGENT_PROTOCOL §2.3.2/§8 + SSOT_EXCLUSIVE_BANK_RULE (relidos nesta sessão, canônicos/vigentes) + AUDIT-001 (C.11) + falsificação (C.13) + firewall guard + rotas/sink economic/v2. **Novo nesta rodada (o read-first exigido revelou docs que mudam o quadro):** `docs/01_normative/POLITICA_ATIVACAO_ECONOMICA_UNIFICARD.md`; `docs/01_normative/DECLARACAO_PRONTIDAO_INSTITUCIONAL_UNIFICARD.md`; `docs/03_technical/FASE_6_2_PAGAMENTO_SANDBOX.md` (=`06_technical`, idênticas) — **auto-declarada VINCULANTE, sem marcador de supersessão**; `FASE_6_ENDPOINTS_ECONOMICOS_V2.md`; `FASE_6_MANIFESTO_EXECUCAO_ECONOMICA.md`.

### 2. Fatos reproduzidos (todos confirmados)

Os 12 fatos do GO batem com AUDIT-001/C.13: família registrada e alcançável; sem caller frontend; mutação financeira só via Bank; firewall default-off fail-closed contém tudo hoje; PORTA-1 fechada; `sandbox_mode` cosmético; rota promete "No real money" enquanto o service intenta ledger real; veredito VIVO COM DEFEITO MAS CONTIDO; sem emergência; riscos latentes listados.

### 3. Fato que REFINA (quase-refutou) a premissa do GO — o achado central desta rodada

**A família economic/v2 NÃO é código órfão/não-autorizado — ela IMPLEMENTA um design VINCULANTE ainda vigente (`FASE_6_2_PAGAMENTO_SANDBOX.md`).** E o princípio desse doc está do LADO da decisão proposta, não contra:
- FASE_6_2 linha 7: "testar tudo em conjunto, **sem risco real**"; linha 43: "**nenhum dinheiro real movimentado**"; linha 66: 'UI deixa claro: "não executado"'. → o INTENTO já era zero-dinheiro-real, exatamente o "sandbox verdadeiro" que o GO propõe.
- MAS FASE_6_2 também diz (linha ~princípio): "Sandbox segue o **MESMO fluxo da produção, apenas com provedores e valores de teste**" e PASSO 4 manda o `payment/execute` RODAR em sandbox (emitir `event.payment.executed`, liberar custódia).

**Reconciliação (a causa-raiz real):** FASE_6_2 pressupôs um **SUBSTRATO sandbox** — contas de teste + provedor de teste — onde o "mesmo fluxo" rodaria com dinheiro de teste ("nenhum dinheiro REAL movimentado"). AUDIT-001 provou que esse substrato **nunca foi construído**: não há ledger/contas/tenant sandbox. Logo o código, rodando "o mesmo fluxo" sem substrato, escreve no `bank_ledger` REAL com contas REAIS (escrow/owner). O defeito não é "sandbox mente" no vácuo — é **"o substrato sandbox que FASE_6_2 pressupôs não existe, então o rótulo sandbox opera sobre o ledger real"**. Hoje isso é 100% contido pelo firewall PORTA-1 (posterior a FASE_6_2).

### 4. 🛑 STOP disparado (condição literal do GO)

O GO manda parar se "a documentação vigente já define sandbox de modo incompatível". **Disparou, mas de forma sutil:** FASE_6_2 (vinculante, não superado) concorda com o PRINCÍPIO (zero dinheiro real) porém DIVERGE no MÉTODO — ela manda `payment/execute` RODAR em sandbox (PASSO 4), enquanto a decisão proposta manda CONTER `execute` na borda (não rodar). Conter a família contradiz o roteiro PASSO 4 de FASE_6_2. Portanto a decisão proposta **não pode ser ratificada como está sem supersessão/errata explícita de FASE_6_2** — e essa supersessão é ato institucional de Clayton, não meu.

### 5. Contratos Eventos → Bank (confirmados, para registro)

Eventos: lifecycle, intenção econômica, vínculo evento↔operação, estado de domínio, eventos de domínio, `event_custody`/`event_payment_authorization` (tabelas próprias, fora de bank_*). Bank: conta, transação, ledger, saldo, lock (`lockAccounts`), idempotência financeira (dedup por reference), validação de cobertura (HOJE SEM overdraft-check — C.13 §5), reversão monetária. A fronteira de ESCRITA já está correta (Eventos delega, nunca SQL cru em bank_*). Recomendação do GP de NÃO mover o workflow para o Bank e NÃO permitir SQL financeiro cru em Eventos: **compatível e já é o estado atual** — nada a mudar aí.

### 6. VEREDITO: **B — compatível em princípio, mas exige correções docs-only antes de ratificar**

A decisão proposta é directionalmente SÓLIDA e alinhada tanto ao princípio de FASE_6_2 ("nenhum dinheiro real") quanto ao modelo posterior PORTA-1 (firewall + evento de ativação de POLITICA_ATIVACAO_ECONOMICA). NÃO é C (não é incompatível com a norma — o princípio converge). NÃO é A (não pode ser ratificada como está). Correções docs-only OBRIGATÓRIAS antes de qualquer selo:
1. **Citar e reconciliar explicitamente FASE_6_2** (vinculante, não superado) — a decisão NÃO pode redefinir "sandbox" silenciosamente contra ela.
2. **Errata/supersessão EXPLÍCITA do PASSO 4 de FASE_6_2** ("EXECUTAR PAGAMENTO (SANDBOX)") — porque conter `execute` contradiz esse roteiro. Não apagar histórico; marcar supersedido-por-esta-decisão com motivo (substrato sandbox inexistente + PORTA-1).
3. **Nomear a causa-raiz** como "ausência de substrato sandbox pressuposto por FASE_6_2", não como "sandbox_mode mente" — mais preciso e evita reescrever a intenção histórica.
4. **Reconciliar com `POLITICA_ATIVACAO_ECONOMICA`** (ativação real = evento de ativação + dupla autorização + papéis; "trocar env var NÃO é autorização") e `DECLARACAO_PRONTIDAO` ("autorizado a operar em SANDBOX indefinidamente" — presumiu substrato funcional).

### 7. Conteúdo proposto da decisão (RASCUNHO docs-only, NÃO selado, contingente à supersessão de FASE_6_2 por Clayton)

Nome sugerido: `DECISION — EVENT ECONOMIC/V2 HONEST SANDBOX & CONTAINMENT (supersede FASE_6_2 §PASSO 4)`. Núcleo: (a) "sandbox" reservado com significado estrito de zero efeito financeiro persistível **enquanto não existir substrato sandbox físico**; (b) família economic/v2 institucionalmente CONTIDA na borda até substrato+provas; (c) firewall permanece obrigatório (defesa em profundidade, contenção HTTP não o substitui e vice-versa); (d) fronteira Eventos↔Bank preservada; (e) PORTA-1 fechada, sem ativação/flag/conta/seed; (f) pré-condições a-h do GO como gate de futura ativação; (g) supersessão explícita de FASE_6_2 PASSO 4.

### 8. Perguntas do GO — respostas propostas (para Clayton confirmar)

1. Sandbox reservado = zero efeito financeiro persistível: **SIM** (mas via supersessão de FASE_6_2, não redefinição silenciosa).
2. Código de contenção: recomendo **501 Not Implemented** (a feature não existe como sandbox honesto — 501 é mais verdadeiro que 503/temporário; alinha ao padrão `l5-frozen`/`schema-ghost-containment` já usado no repo). Reservar 403 para o firewall do sink (que já usa 403).
3. Contenção alcança **toda a família** (não só execute) — custody/split/authorize criam estado que só serve ao execute; conter só o execute deixa estado órfão acumulável.
4. Estados econômicos já existentes: **preservados, nunca executados** (não apagar; não migrar; execute permanece contido).
5. Error codes canônicos: definir no material (ex. `EVENT_ECONOMIC_V2_CONTAINED`).
6. Contrato futuro Event→Bank: o já vigente (§5) — Eventos entrega instrução reconciliável, Bank é dono de ledger/lock/cobertura/reversão.
7. Pré-condições: as a-h do GO (autoridade econômica; lifecycle authorized→executed atômico; idempotência claim-antes-do-efeito; concorrência; conservação; cobertura sem saldo negativo; reversão vinculada; provas em efêmero + guards no runner).
8. Frente material única autorizável após o selo: **"F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT"** — conter a família na borda HTTP (501), preservar estado, zero abertura de PORTA-1.

### 9. Escopo da futura frente material (para o selo, não para agora)

POSITIVO: contenção HTTP fail-closed de toda a família (501) antes de criar novo estado; preservar estado existente; guard de contenção. NEGATIVO: não abrir PORTA-1; não criar sandbox financeiro; não mexer no firewall; não mover workflow p/ Bank; não SQL cru; não seed/conta/saldo; não feature flag de ativação. PROVAS: negative-proofs de que cada endpoint da família retorna contenção antes de qualquer writer; guard no runner canônico.

### 10. Riscos que permanecem bloqueados

Todos os latentes do AUDIT-001/C.13 continuam CONTIDOS pelo firewall (autoridade econômica incompleta; lifecycle authorized→executed; TOCTOU vs. dedup+lock do Bank; overdraft/escrow negativo; guard do firewall fora do runner). Nenhum vira vivo por esta decisão docs-only.

### 11. Arquivos docs-only alterados nesta rodada

APENAS este bloco (`PLANO_RECUPERACAO.md` Anexo C, §C.14). **Nenhum documento de decisão criado; REMEDIATION_DT_LOG.md e dividatecnica.md NÃO tocados** (aguardam a supersessão de FASE_6_2 por Clayton + a redação selada da decisão, que não faço sob STOP).

```
ZERO CODE CHANGE
ZERO MIGRATION
ZERO BANK WRITE
ZERO RUNNER CHANGE
PORTA-1 CLOSED
MATERIAL EXECUTION NOT AUTHORIZED
DECISION DOC NOT CREATED (STOP normativo — supersessão de FASE_6_2 exige Clayton)
VEREDITO: B
```

## C.15 — DECISION-0190 redigida (docs-only, não-selada) · 2026-07-20

`HEAD: 368eb72cd`. Seguindo o GO de supersessão estreita, foi REDIGIDA (não selada — self-seal proibido) a `DECISION-0190 — EVENT ECONOMIC/V2 · HONEST SANDBOX & CONTAINMENT`, que reconcilia a `FASE_6_2_PAGAMENTO_SANDBOX.md` com os fatos de AUDIT-001/C.13.

**Núcleo:** causa-raiz canônica `SANDBOX FINANCIAL SUBSTRATE ASSUMED BUT NOT MATERIALIZED`; supersessão ESTREITA e não-automática só do PASSO 4 (princípio de sandbox sem dinheiro real preservado); família economic/v2 institucionalmente contida com `501 EVENT_ECONOMIC_V2_SANDBOX_SUBSTRATE_NOT_IMPLEMENTED`; firewall preservado (defesa em profundidade); PORTA-1 fechada; frente material futura única `F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT` (NÃO iniciada); pré-condições a-h de futura ativação.

**Arquivos docs-only criados/alterados (append-only, histórico intocado):**
- `docs/02_decisions/DECISION_0190_EVENT_ECONOMIC_V2_HONEST_SANDBOX_AND_CONTAINMENT.md` (novo)
- `docs/03_technical/FASE_6_2_PAGAMENTO_SANDBOX.ERRATA.md` (novo, errata canônica)
- `docs/06_technical/FASE_6_2_PAGAMENTO_SANDBOX.ERRATA.md` (novo, ponteiro)
- `REMEDIATION_DT_LOG.md` (append)
- `dividatecnica.md` (append)
- este bloco (Anexo C §C.15)

Texto histórico da FASE_6_2 NÃO tocado. Nenhuma decisão anterior alterada.

**Veredito interno de suficiência da redação: A** (fecha sandbox/contenção/supersessão/fronteira/firewall/PORTA-1/pré-condições/frente material sem ambiguidade; ressalva: suficiência final depende da auditoria independente Opus 4.8 + selo soberano).

**Encaminhamento:** aguardando auditoria independente (Opus 4.8, instância separada) antes de qualquer selo. Frente material NÃO iniciada.

```
ZERO CODE CHANGE · ZERO MIGRATION · ZERO BANK WRITE · ZERO RUNNER CHANGE
PORTA-1 CLOSED · PASSO 4 SUPERSESSION PROPOSED (PENDING INDEPENDENT AUDIT AND SEAL) · FASE_6_2 PRINCIPLE PRESERVED
MATERIAL EXECUTION NOT AUTHORIZED · SELF-SEAL NOT PERMITTED
```

---

### C.16 — SELO FINAL · DECISION-0190 · VEREDITO A · OFICIALMENTE SELADA (2026-07-20)

Reauditoria independente final (Opus 4.8, instância separada da redatora e da remediação) confirmou R1 e R2 integralmente aplicadas, zero linguagem de supersessão consumada pré-selo, FASE_6_2 histórica byte-intacta, substância preservada, zero autorização material — **VEREDITO A · SELO COMPLETO DOCS-ONLY RECOMENDADO**. Clayton autorizou o registro cartorial em dois commits sequenciais: COMMIT 1 (neutro) versionou o envelope de 6 documentos ainda no estado REDIGIDA/NÃO-SELADA/PASSO 4 PROPOSED; COMMIT 2 (este) registra somente a mudança cartorial de estado nos 3 documentos permitidos (`REMEDIATION_DT_LOG.md`, `dividatecnica.md`, este bloco). **A DECISION-0190 e as duas erratas NÃO foram reeditadas neste ato.**

1. Supersessão estreita do PASSO 4: **oficialmente vigente** — `PASSO 4 NARROW SUPERSESSION OFFICIALLY EFFECTIVE AFTER DECISION-0190 SEAL`.
2. Restante da FASE_6_2 permanece vigente.
3. Princípio histórico de sandbox com zero dinheiro real preservado.
4. Causa-raiz oficial: `SANDBOX FINANCIAL SUBSTRATE ASSUMED BUT NOT MATERIALIZED`.
5. Família `economic/v2` permanece destinada à futura contenção honesta 501.
6. Firewall do Bank permanece default-off/fail-closed.
7. PORTA-1 permanece fechada.
8. Nenhuma execução financeira autorizada.
9. Nenhum sandbox financeiro implementado ou autorizado.
10. Nenhum caller de produto autorizado.
11. Frente `F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT` permanece FECHADA — exige novo GO material explícito.
12. Integração do guard do firewall ao runner segue condicionada ao fechamento do AUDIT-002.

```
DECISION-0190 OFFICIALLY SEALED
VERDICT A
COMPLETE DOCS-ONLY SEAL
PASSO 4 NARROW SUPERSESSION OFFICIALLY EFFECTIVE
FASE_6_2 PRINCIPLE PRESERVED
DECISION AND ERRATAS VERSIONED
ZERO CODE CHANGE
ZERO MIGRATION
ZERO BANK ACCESS
ZERO RUNNER CHANGE
PORTA-1 CLOSED
MATERIAL EXECUTION NOT AUTHORIZED
F-EVENT-ECONOMIC-V2-HONEST-CONTAINMENT CLOSED
```

## C.16-bis — AUDIT-002 · Reconciliação do denominador e alcançabilidade real dos guards na CI (ROOT-003 · R2) · 2026-07-20/21

`HEAD auditado: fe13af59f` (branch `rescue-structural`). Auditoria independente **Opus 4.8** — "AUDIT-002 · Reconciliação do denominador e alcançabilidade real dos guards na CI". **Veredito A — DENOMINADOR RECONCILIADO.** Zero alteração de código/migration/runner/guard durante a auditoria. Este registro é **docs-only** e **não substitui, apaga nem invalida** os achados de qualidade de F-1 a F-5 — corrige exclusivamente o **eixo de enforcement** que os acompanhava.

### O que estava descrito incorretamente

Os Passes F-1 a F-4 (e o início do F-5) descreveram "84 guards fora do runner" como **84 guards sem execução em CI**. A auditoria independente provou que isso confunde dois fatos distintos:

```
84 sem entrada nominal direta no runner
!= 84 sem execução em CI
```

O runner (`run-regression-guards.mjs`) contém **2 comandos-agregadores** (`audit-legacy-service-availability-containment-suite.mjs` e `audit-authority-residual-hygiene-suite.mjs`) que invocam, via `execFileSync` **fail-closed** (loop com `catch`->`process.exit(1)` em qualquer sub-guard que falhe), **81 sub-guards únicos** — a maioria dos quais nunca tinha entrada nominal própria no runner.

### Os quatro denominadores oficiais

| Denominador | Valor |
|---|---|
| Arquivos `audit-*` da campanha (`.mjs`/`.ts`) | **281** |
| Entradas `audit-*` diretas no runner | **197** |
| Sem entrada nominal direta | **84** |
| - dos quais, **executados por agregador fail-closed** | **77** |
| - dos quais, **executados por comando próprio de CI** (`validate:actor-writer-boundaries`) | **1** |
| - dos quais, **one-shot intencional** (harnesses de mutação + 1 ferramenta de preparação) | **6** |
| - dos quais, **ativos e válidos sem QUALQUER enforcement** | **0** |

Fecha: `77 + 1 + 6 = 84`. Cobertura contínua real: `197 diretos + 77 agregados exclusivos + 1 comando próprio = 275` de 281; `275 + 6 (one-shot, não exigíveis como contínuos) = 281`.

**Não se declara que os 281 são todos guards contínuos** — os 6 one-shot permanecem, por desenho, fora de execução recorrente. **Não se declara ROOT-003 resolvido** — ver reclassificação abaixo.

### ROOT-003 — reclassificado, não apagado

Estado anterior (Rodada 0, ainda válido como registro histórico do achado original): *"runner 200/200 verde ignora 84 de 281 guards"* — **descrição correta do sintoma, causa mal-atribuída** (lida como "84 sem enforcement").

**Estado oficial corrigido:**

```
ROOT-003 · R2 — COBERTURA EXISTE, MAS É OPACA
Classificação: PARTIALLY_RESOLVED_AND_CONTAINED
```

Justificativa: todos os guards ativos de enforcement identificados possuem cadeia fail-closed até a CI; o runner **conta comandos, não guards efetivamente executados** (200 comandos != 200 guards - são >=278 guards efetivos via 2 agregadores); **81 sub-guards ficam escondidos atrás de 2 entradas**; as listas dos agregadores são **estáticas** - um guard novo pode nascer no disco sem wiring automático a nenhuma das duas listas, sem que o total numérico (200 comandos) o revele. **Não é R4 (falso positivo integral)** — a cobertura é real, não é ilusória; o problema é de **visibilidade e anti-drift**, não de ausência.

### Matriz de dois eixos (método oficial daqui em diante)

Cada guard passa a receber **dois** rótulos independentes:

**Eixo A - Qualidade:** `ACTIVE_VALID` · `ACTIVE_BUT_INCOMPLETE` · `ONE_SHOT` · `STALE` · `SUPERSEDED`.
**Eixo B - Enforcement:** `CI_DIRECT` · `CI_AGGREGATED` · `CI_OTHER_COMMAND` · `NOT_CI_REQUIRED` · `ACTIVE_NOT_ENFORCED`.

Exemplo válido e esperado: um guard pode ser simultaneamente `ACTIVE_BUT_INCOMPLETE + CI_AGGREGATED` — roda em CI hoje, mas tem ponto cego que merece hardening. **Gap de qualidade != gap de enforcement.**

**Correção retroativa de rótulo:** onde os relatórios de F-1 a F-4 usaram `RUNNER_REQUIRED_ACTIVE`/`RUNNER_REQUIRED_P0` para um guard que se descobre `CI_AGGREGATED`/`CI_OTHER_COMMAND`, o rótulo **não é apagado** — passa a ser lido como **prioridade/visibilidade histórica** (o guard merece uma entrada própria e legível), não como ausência atual de execução.

### Os 7 residuais nomeados

| Guard | Enforcement real |
|---|---|
| `audit-actor-writer-boundaries.mjs` | `CI_OTHER_COMMAND` (npm-script próprio `validate:actor-writer-boundaries`) |
| `audit-b-city-regional-treasury-grant-substrate-mutations.mjs` | `ONE_SHOT_INTENTIONAL` (harness do guard #187, já no runner) |
| `audit-fiscal-tax-reserve-bank-substrate-mutations.mjs` | `ONE_SHOT_INTENTIONAL` (harness do guard #186, já no runner) |
| `audit-governed-vocabulary-manifest-mutations.mjs` | `ONE_SHOT_INTENTIONAL` (autodeclarado - "NÃO entra no runner") |
| `audit-group-actor-membership-foundation-mutations.mjs` | `ONE_SHOT_INTENTIONAL` (harness) |
| `audit-group-institutional-binding-mutations.mjs` | `ONE_SHOT_INTENTIONAL` (harness) |
| `audit-ownership-financial-phase1.ts` | ferramenta one-shot de auditoria/preparação — **status histórico/material não fixado aqui como fato consumado**; verificável futuramente, sem constituir gap de enforcement hoje |

### F-5 — fechamento administrativo

**`F-5: CONCLUÍDO · SUBSTANTIVAMENTE AUDITADO · DENOMINADOR RECONCILIADO`.**

20/20 guards auditados. 9 `ACTIVE_VALID`/equivalente vigente · 10 `ACTIVE_BUT_INCOMPLETE` · 1 `ONE_SHOT_PROOF`. Enforcement: 19 via `CI_AGGREGATED`; 1 (`governed-vocabulary-manifest-mutations`) `ONE_SHOT_INTENTIONAL` por desenho. Zero defeito produtivo crítico; zero guard ativo sem enforcement; nenhuma DECISION nova necessária; nenhum material executado. Achados individuais e pontos cegos de regex do relatório original do F-5 **preservados integralmente** — nenhum invalidado por esta reconciliação.

### Escopo material real futuro (substitui a formulação anterior)

"Adicionar dezenas de guards ao runner" (formulação anterior, superada) -> substituído por:
1. dar visibilidade aos sub-guards efetivamente executados (81 hoje escondidos atrás de 2 agregadores);
2. reportar **comandos** e **guards** como denominadores separados no output do runner;
3. criar proteção anti-drift para o universo de guards (novo guard no disco deve ser detectado se não estiver em nenhuma das 3 categorias de enforcement);
4. exigir que todo guard contínuo esteja declarado como direto, agregado ou comando próprio;
5. endurecer os guards `ACTIVE_BUT_INCOMPLETE` (F-1 a F-5, lista consolidada nos relatórios individuais);
6. decidir futuramente o status histórico do script `audit-ownership-financial-phase1.ts` (não decidido aqui).

**Nenhum destes 6 itens é executado neste registro.** Ficam para o envelope material futuro, sob GO próprio, após F-6/F-7.

```
ROOT-003 RECLASSIFIED - R2 - PARTIALLY_RESOLVED_AND_CONTAINED
F-5 CLOSED ADMINISTRATIVELY
DENOMINATOR: 197+77+1=275 CONTINUOUS - 6 ONE-SHOT - 281 TOTAL
ZERO CODE CHANGE - ZERO MIGRATION - ZERO RUNNER CHANGE - ZERO GUARD CHANGE
PORTA-1 CLOSED
DECISION-0191 D15 PRESERVED
F-6 NOT STARTED
```

## C.17 — AUDIT-002 · SELO DOCS-ONLY · VEREDITO A · ENCERRAMENTO ADMINISTRATIVO · 2026-07-21

`HEAD auditado: 229f86f872dd7e0a9db6647e3f08fefb7c368a2c` (branch `rescue-structural`). Fonte soberana do selo: auditoria consolidada final independente executada por **Opus 4.8**, read-only, zero alteração — **Veredito A: AUDIT-002 CONCLUÍDO E APTO A FECHAMENTO DOCS-ONLY**.

```
AUDIT-002 · SELADO · VEREDITO A · AUDITORIA CONCLUÍDA · FECHAMENTO DOCS-ONLY
```

**O selo significa "auditoria concluída". O selo NÃO significa "dívida material resolvida".**

### Denominador final

281 arquivos da campanha · 197 entrada direta no runner · 84 sem entrada nominal direta. Destes 84: `CI_AGGREGATED=77` · `CI_OTHER_COMMAND=1` · `NOT_CI_REQUIRED=6` · `ACTIVE_NOT_ENFORCED=0` · `REACHABILITY_UNRESOLVED=0`. Fecha: `77+1+6=84`; `197+77+1+6=281`. **O runner conta comandos, não guards efetivamente executados.**

### Partição final

F-1=19 · F-2=19 · F-3=6 · F-4=12 · F-5=20 · F-6=8 · F-7=0. Soma `19+19+6+12+20+8=84`. **84/84 ARQUIVOS SEM ENTRADA NOMINAL DIRETA AUDITADOS.** (Correção definitiva: o total consolidado é 84, não 64 — erro que apareceu na saída original do F-6 e foi corrigido antes deste selo.)

### Matriz final de dois eixos

**Eixo A (qualidade):** `ACTIVE_VALID=53` · `ACTIVE_BUT_INCOMPLETE=25` · `ONE_SHOT=5` · `STALE=1`. Soma `53+25+5+1=84`.
**Eixo B (enforcement):** `CI_AGGREGATED=77` · `CI_OTHER_COMMAND=1` · `NOT_CI_REQUIRED=6` · `ACTIVE_NOT_ENFORCED=0`.

`audit-ownership-financial-phase1.ts`: qualidade=`STALE`, enforcement=`NOT_CI_REQUIRED` — não é gap de enforcement; não é one-shot vigente no eixo de qualidade (o schema-alvo nunca existiu). **Gap de qualidade ≠ gap de enforcement.**

### ROOT-003

```
ROOT-003 · R2 — COBERTURA EXISTE, MAS É OPACA
Status: PARTIALLY_RESOLVED_AND_CONTAINED
```

Resíduo (não integralmente resolvido): runner conta comandos, não guards; 81 sub-guards atrás de 2 entradas; listas dos agregadores são estáticas; adição de guard novo pode ficar sem wiring (risco de drift é principalmente por **adição** invisível — a **remoção** de um sub-guard já falha fechado, confirmado na auditoria consolidada).

### Retificações oficiais (registradas, rótulos históricos preservados)

1. F-4 `event-reservations-mislabeled-fk-containment` = `ACTIVE_BUT_INCOMPLETE`.
2. Visibilidade social e audiência territorial são invariantes distintas — não fundidas automaticamente.
3. `audit-actor-writer-boundaries.mjs` = `CI_OTHER_COMMAND`.
4. Cinco harnesses de mutação = `NOT_CI_REQUIRED · ONE_SHOT`.
5. `audit-ownership-financial-phase1.ts` = `NOT_CI_REQUIRED · STALE`.
6. Total auditado = **84**, não 64.

### Audiência pública

```
DEFAULT PUBLIC = INSTITUTIONALLY_GOVERNED_DEFAULT
Fundamento: DECISION-0115 D1
```

Observação institucional não bloqueante: o default público antecede a existência da escolha consciente de audiência; não há exposição acidental comprovada; privado exige seleção explícita; Clayton poderá futuramente decidir se ausência de seleção deve continuar significando público ou se a escolha deve ser obrigatória. **Nenhuma DECISION aberta neste ato.**

### Backlog preservado (o selo NÃO fecha)

1. Os 25 `ACTIVE_BUT_INCOMPLETE`.
2. Visibilidade real da cobertura no runner.
3. Meta-guard anti-drift.
4. Eventual manifesto de alcance.
5. Contenção material `501` do economic/v2 (DECISION-0190).
6. Tenant-loop dos workers (DECISION-0191).
7. Destino do `ledger-snapshot`.
8. Revisão institucional futura do default público.

Nenhum destes itens autoriza execução automática.

### Escopo material futuro (frentes separadas, nenhuma escolhida aqui)

A. Visibilidade e anti-drift do runner.
B. Hardening P1 (migrations posteriores invisíveis; semântica stale de unread-counts).
C. Hardening P2 (regex/janelas fixas/aliases/paths/cobertura parcial).
D. Workers tenant-loop, sob DECISION-0191.
E. economic/v2, sob DECISION-0190.

**Não constitui mega-envelope. Nenhuma frente material escolhida neste selo.**

```
AUDIT-002 · FINAL DOCS-ONLY SEAL
VERDICT A
84/84 INDIRECT-ENTRY FILES AUDITED
ACTIVE_NOT_ENFORCED 0
ROOT-003 R2
ZERO CODE CHANGE
ZERO MIGRATION CHANGE
ZERO RUNNER CHANGE
ZERO GUARD CHANGE
ZERO DATABASE ACCESS
MATERIAL BACKLOG PRESERVED
PORTA-1 CLOSED
DECISION-0191 D15 PRESERVED
```
