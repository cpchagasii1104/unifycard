# CONTRATO DE GRUPOS — UnifiCard v2.0

> **Este documento é LEI.**
> Qualquer implementação que contradiga este contrato é BUG por definição.

**Data:** 2026-05-31
**Status:** TEXTO RATIFICADO POR OPUS + CHATGPT — AGUARDANDO AVAL FINAL DE CLAYTON PARA PROMULGAÇÃO COMO VIGENTE. (As decisões de conteúdo já são de Clayton; falta apenas o aval sobre o texto final antes de promover a VIGENTE e revogar os pontos do V1.)
**Versão:** 2.0
**Branch de referência:** rescue-structural
**Substituirá:** CONTRATO_GRUPOS_V1.md (v1.0, 2025-12-30) nos pontos explicitamente revogados na §REVOGAÇÕES, **após promulgação como VIGENTE**.
**Referencia:** DECISION-0046 (actor_wallet canônico), BANK_SEMANTICS.md (account_type / receivables), COE-2 (groups.owner_actor_id NOT NULL), CONTRATO_GRUPOS_V1 (base não-revogada).

---

## 📜 DECLARAÇÃO DE PROPÓSITO

Grupos são **atores econômicos coletivos** com camada social por cima — princípio herdado e mantido do V1.

A mudança estrutural do V2 sobre o V1 é uma só, e dela decorre tudo: **o dinheiro de um grupo deixa de viver em uma conta única e passa a viver em dois bolsos separados por natureza econômica.** O V1 previa uma conta de grupo (`owner_type='group'`) recebendo o split. O V2 reconhece que o dinheiro de um grupo tem duas naturezas distintas que não podem se misturar, e exige que o sistema preserve essa separação.

---

## 🧱 AS TRÊS CAMADAS DESTE CONTRATO

Este contrato é deliberadamente organizado em três camadas, e a distinção entre elas é vinculante. Confundi-las é o erro que este documento existe para impedir.

- **CAMADA 1 — PRINCÍPIOS VINCULANTES.** Lei agora. Decisões de natureza, propósito e restrição do dinheiro de grupo. Não dependem de mecanismo para serem verdadeiras; qualquer código que as contrarie é BUG.
- **CAMADA 2 — MECANISMO MVP v1.** O que a primeira implementação deve entregar, e apenas isso. Estrita ao que o sistema consegue executar hoje. Nada aqui pode exigir mecanismo inexistente.
- **CAMADA 3 — FRENTE FUTURA.** Princípios já decididos cujo mecanismo ainda não existe. Listados para que a v1 não os implemente por engano nem os bloqueie por omissão.

Regra de leitura: **um princípio da Camada 1 vale mesmo que seu mecanismo esteja na Camada 3.** Exemplo: "dinheiro comunitário nunca vira propriedade do admin" é lei agora (Camada 1), mesmo que o mecanismo de governança que o protege em todos os casos só exista no futuro (Camada 3). Na v1, o princípio é honrado pela ausência de qualquer caminho que o viole, não pela presença de um mecanismo que o garanta.

---

## CAMADA 1 — PRINCÍPIOS VINCULANTES

### 1.1 Dois bolsos por grupo

Todo grupo, como actor econômico, possui dois bolsos separados por natureza, e o sistema NUNCA os mistura:

- **Bolso operacional** — recebe receita própria do grupo dentro da plataforma (venda de produtos, eventos, serviços, atividades comerciais do grupo).
- **Bolso comunitário** — recebe exclusivamente a fração de split comunitário derivada da participação dos usuários naquele grupo.

A separação por natureza é o coração deste contrato. Dinheiro operacional e dinheiro comunitário têm regras de uso, visibilidade e fim-de-vida diferentes. Um bolso jamais financia o que é do outro, e uma leitura jamais soma os dois sem distinguir.

### 1.2 Natureza do bolso comunitário

O bolso comunitário é **restrito, coletivo, transparente, não-discricionário e não-sacável livremente.** Estas cinco qualidades são lei:

- **Restrito:** só pode financiar finalidades coletivas do grupo.
- **Coletivo:** pertence ao grupo como entidade, nunca a um indivíduo.
- **Transparente:** seu saldo e seu uso são visíveis aos membros (forma na §2.6).
- **Não-discricionário:** nenhum admin tem poder livre sobre ele.
- **Não-sacável livremente:** não vira saque externo genérico (detalhe na §1.4).

### 1.3 Saldo comunitário é coletivo no tempo

O dinheiro que entra no bolso comunitário entrou como contribuição coletiva, não como depósito individual reembolsável. Decorre disto, como lei:

- **Saldo passado é coletivo.** Não há direito individual sobre ele.
- **A saída de um usuário não gera direito** sobre o saldo comunitário acumulado enquanto ele era membro. Esse saldo permanece no grupo.
- **Formalização jurídica do grupo** (virar associação, empresa) **não transforma o fundo comunitário em patrimônio livre da nova pessoa jurídica.** A trava comunitária sobrevive à mudança de forma.
- **Banimento ou fraude não pode beneficiar os responsáveis.** Saldo comunitário de grupo banido por fraude jamais retorna a quem fraudou.

### 1.4 Gasto comunitário externo é trilho financeiro próprio

Quando o bolso comunitário paga um fornecedor externo (gráfica, reforma, material), isso é um **trilho de pagamento próprio** — distinto de tudo que já existe no sistema:

- **NÃO reutiliza** o `payout_requests` do seller (trilho exclusivo do vendedor).
- **NÃO é** saque livre.
- **NÃO é** o payout comum de `actor_wallet`.

Quando este trilho for implementado, será **frente financeira própria, com RATIFICAÇÃO TRIPLA** (Opus + ChatGPT + Clayton), porque é escrita em código que move dinheiro coletivo para fora da plataforma.

### 1.5 Admin nunca tem poder livre sobre dinheiro comunitário

O admin do grupo não dispõe livremente do bolso comunitário. Todo gasto exige finalidade coletiva, justificativa, evidência e registro em ledger, e é visível aos membros. É **proibido**, em qualquer versão:

- saque livre para admin;
- distribuição para membros;
- transferência sem finalidade coletiva;
- pagamento a membro ou admin sem contraprestação real e registrada;
- uso do bolso comunitário como receita operacional comum.

### 1.6 Rastreabilidade interna forte, exposição agregada

O sistema **rastreia internamente** a origem do dinheiro comunitário de forma forte — por transação e por usuário pagador — para auditoria, investigação e decisões futuras justas. Mas **expõe aos membros** apenas a forma agregada: saldo, entradas por período/transação e usos, **sem identificar quanto cada pessoa contribuiu individualmente.** Rastrear não é expor; a privacidade financeira do contribuinte individual é preservada por padrão.

---

## CAMADA 2 — MECANISMO MVP v1

Esta camada define o que a primeira implementação entrega. Nada aqui depende de mecanismo inexistente. O que foi decidido em princípio mas ainda não tem máquina está na Camada 3, não aqui.

### 2.1 Os dois bolsos como contas

- **Bolso operacional = `actor_wallet` do group-actor.** Coerente com DECISION-0046 (qualquer actor econômico recebe receita própria em `actor_wallet`).
  - Forma: `owner_type='actor'`, `owner_id='${groupActorId}:actor_wallet'`, `account_type='actor_wallet'`.
- **Bolso comunitário = account_type dedicado.** Nome funcional ratificado: **`group_community_fund`**, **sujeito à validação de nomenclatura canônica antes de qualquer migration** (ver §DECISÕES PENDENTES — há colisão a resolver: já existe um treasury type `community_fund` de plataforma, distinto do fundo de grupo).
  - Forma provável: `owner_type='actor'`, `owner_id='${groupActorId}:group_community_fund'`, `account_type='group_community_fund'`.

### 2.2 Roteamento do split comunitário — cadeia de quatro estágios

O split comunitário NÃO é um lookup de conta. É uma máquina de decisão de quatro estágios, executada nesta ordem:

1. **Membership** — o usuário pagador é membro do grupo? Fonte canônica de vínculo: **`group_members`** (substrato vivo). `user_active_groups` (citado no V1) fica como read-model futuro, não SSOT obrigatório. `user_group_allocations` NÃO é fonte do split comunitário (modelo PUSH/declarativo, natureza econômica diferente; tratar como dívida a aposentar ou reclassificar).
2. **Elegibilidade** — o grupo é elegível? (critérios em §2.3).
3. **Prioridade** — se o usuário participa de múltiplos grupos elegíveis, aplica-se a prioridade declarada pelo usuário (§2.4).
4. **Fallback** — se não há grupo elegível, OU se há múltiplos sem prioridade declarada, a fração comunitária vai para o **fundo regional da REGIÃO DO USUÁRIO pagador** (não a região do grupo).

Distinção vinculante: o fallback dispara por **ausência de vínculo elegível** (regra de negócio), NUNCA por falha de lookup (acidente técnico). O comportamento atual do split engine — remanescente matemático cai em `regional_fund` genérico — não satisfaz esta regra e deve ser corrigido na frente de implementação.

### 2.3 Elegibilidade mínima v1

Na v1, um grupo é elegível para receber split comunitário se cumprir os itens 1–5:

1. o usuário pagador é membro ativo do grupo;
2. o grupo está ativo;
3. o grupo tem responsável civil válido;
4. o grupo não está banido, bloqueado ou em fraude;
5. o grupo não está dissolvido.

O critério de "mínimo operacional definido pelo sistema" e os critérios de atividade do V1 (≥5 membros, 1 post/mês ou 1 evento/trimestre) **ficam SUSPENSOS na v1** e movem-se para a Camada 3. Na v1, elegibilidade = itens 1–5, sem critério vazio.

### 2.4 Múltiplos grupos elegíveis

Se o usuário participa de mais de um grupo elegível, ele pode declarar um **grupo prioritário**; a fração comunitária vai para o bolso comunitário do grupo prioritário ativo. Se não houver prioridade declarada, a fração vai para o **fundo regional da região do usuário** (o sistema não escolhe grupo arbitrariamente). Esta regra vale também quando os grupos elegíveis estão em regiões diferentes: prevalece a prioridade do usuário; sem prioridade, fundo regional da região do usuário.

O conceito de "grupo prioritário do usuário" é dado novo (schema + UI) e sua materialização é frente de implementação; o princípio de roteamento, porém, é v1. **Regra dura para a v1:** enquanto não existir UI/schema de prioridade, o usuário com múltiplos grupos elegíveis e sem prioridade registrada cai no fallback regional da região do usuário. A v1 NÃO inventa prioridade automática nem escolhe grupo por critério implícito.

### 2.5 Trilho mínimo de gasto auditável

O bolso comunitário, na v1, **recebe e também gasta** — por um trilho mínimo auditável, sem voto formal. Os oito passos:

1. um admin ou responsável **com authority de grupo válida** propõe o gasto (o mecanismo exato de role/verificação de authority será definido na frente de implementação — ver §DECISÕES PENDENTES; a v1 não inventa o critério, exige que ele exista);
2. informa a finalidade coletiva;
3. informa o beneficiário/fornecedor;
4. registra justificativa;
5. anexa evidência quando aplicável;
6. o pagamento é executado pelo trilho financeiro controlado (§1.4 — trilho próprio, ratificação tripla na implementação);
7. o ledger registra;
8. os membros conseguem ver o uso do dinheiro comunitário.

Fornecedor externo pode ser pago desde que o gasto tenha finalidade comunitária (reforma de sede, bandeiras, material de evento, serviço gráfico, estrutura de ação coletiva, projeto do grupo). Permanecem proibidos todos os usos da §1.5.

### 2.6 Statement / visibilidade na v1

O statement do grupo exibe os dois bolsos **separados**, e quando útil o total com breakdown — nunca somando sem detalhar, nunca escondendo a natureza. Na v1, mostra: saldo operacional, saldo comunitário, entradas e gastos. A visibilidade segue: **membro ativo** vê saldo comunitário e usos; **admin** vê e propõe/opera conforme authority; **não-membro** não vê por padrão.

A superfície de leitura do bolso comunitário (saldo + ledger de uso visível aos membros) não existe hoje e é parte da entrega da v1.

### 2.7 Fim-de-vida — o que a v1 executa

Os princípios de fim-de-vida (§3 abaixo) são lei. A v1 executa os casos cujo mecanismo já é simples:

- **Inelegibilidade temporária:** saldo passado permanece no bolso comunitário; novos splits vão ao fundo regional até a elegibilidade voltar.
- **Dissolução voluntária / banimento por fraude / ausência de responsável civil:** o saldo comunitário NUNCA vai para admin ou membro. A v1 deve suportar bloqueio/congelamento preventivo de saída quando necessário, com destino padrão de congelamento ou fundo regional conforme o caso; a destinação final complexa (alternativa por governança, redistribuição) fica para a Camada 3.

---

## CAMADA 3 — FRENTE FUTURA

Estes pontos têm o **princípio decidido** mas o **mecanismo inexistente**. A v1 não os implementa; o V2 os registra para que não sejam implementados por engano nem bloqueados por omissão.

- **Governança formal de gasto** (proposta + voto coletivo dos membros). Princípio decidido (§1.5: gasto relevante não é discricionário); mecanismo de proposta+voto não existe. Na v1, o trilho mínimo auditável (§2.5) substitui o voto, sem violar o princípio.
- **Híbrida por valor** — trilho simplificado abaixo de um limite X, voto acima de X. **O limite X não é fixado agora** (decisão de Clayton adiada explicitamente). Não introduzir limite vazio.
- **Projetos / campanhas vinculadas ao fundo comunitário.** O statement do V2 v1 mostra saldo + entradas + gastos; "projetos vinculados" é camada futura.
- **Prioridade de grupo do usuário** como schema + UI (o princípio de roteamento por prioridade é v1; a materialização do dado e da interface é futura).
- **Critérios progressivos de atividade / mínimo operacional** (≥5 membros, post mensal, evento trimestral) — suspensos na v1, retornam aqui.
- **Cálculo de "origem dominante"** do dinheiro comunitário (depende de rastreabilidade por usuário pagador, que existe internamente em §1.6, mas a computação do dominante é futura).
- **Processo de cisão e fusão** de grupos (destino do saldo comunitário).
- **Processo de saldo congelado** antes de a governança formal existir.

---

## ⚰️ FIM-DE-VIDA E MUDANÇA DO GRUPO (Q11)

Princípio geral, vinculante (Camada 1): **o saldo comunitário segue a finalidade coletiva — nunca o admin, nunca o membro individual.** Os destinos por caso:

### Inelegibilidade temporária
Saldo passado permanece; novos splits vão ao fundo regional até recuperar elegibilidade. *(Camada 2 — executável na v1.)*

### Inatividade / DORMANT
Saldo congela por um período de recuperação. Recupera atividade → saldo permanece no grupo. Não recupera após prazo → fundo regional. **Pendente:** a região de destino — região principal do grupo OU origem dominante dos contribuintes — não está fixada; o V2 não escolhe entre as duas por "ou" (ver §DECISÕES PENDENTES). *(Princípio Camada 1; precedência e cálculo de origem dominante Camada 3.)*

### Dissolução voluntária
Saldo NÃO vai para admin nem membros. Destino padrão: **fundo regional**. Destinação alternativa para outro grupo/projeto elegível, se decidida, exige governança. *(Princípio Camada 1; destinação por governança Camada 3.)*

### Banimento por fraude/risco
Saldo congela para investigação, depois fundo regional. Fraude não beneficia o grupo nem seus responsáveis. *(Princípio Camada 1; congelamento simples na v1.)*

### Ausência de responsável civil
Saldo congela até regularização. Sem regularização → fundo regional. *(Princípio Camada 1; congelamento simples na v1.)*

### Mudança estrutural (grupo muda sem morrer)
Por subcaso — todos sob o princípio "saldo segue finalidade coletiva, nunca apropriação individual":
- **Fusão:** saldo pode seguir para o grupo sucessor, se houver continuidade e responsável civil válido.
- **Cisão:** saldo **congela até decisão/governança**; não dividir automaticamente sem regra. *(Processo Camada 3.)*
- **Troca de responsável civil:** saldo segue o grupo, exige reconfirmação/registro.
- **Mudança de região principal:** saldo passado mantém rastreabilidade; novos fluxos usam a nova região após atualização.
- **Formalização jurídica:** saldo mantém a trava comunitária; não vira patrimônio livre da nova PJ (§1.3).

---

## ❓ DECISÕES PENDENTES (Clayton NÃO decidiu — não inventar na implementação)

1. **Nomenclatura final do account_type comunitário.** Funcional: `group_community_fund`. Há colisão a resolver: `community_fund` já existe como treasury type de plataforma (`regional_fund`/`community_fund`/`system_reserve`/`governance_pool`), distinto do fundo de grupo. A validação canônica deve garantir que o nome do bolso de grupo não colida nem confunda com o treasury de plataforma.
2. **Authority exata de quem propõe gasto** (§2.5 passo 1). É o `owner_actor_id` do grupo (COE-2)? Um role específico em `group_members`? Definição na frente de implementação; a v1 exige authority válida, não inventa o critério.
3. **Precedência região-do-grupo vs origem-dominante** no destino de saldo DORMANT (§Fim-de-vida).
4. **Processo de saldo congelado em cisão** antes de a governança formal existir (§Fim-de-vida / Camada 3).
5. **Percentual do split comunitário.** O V1 fixava 5% total (até 3% grupos, mínimo 2% fundo regional; 1% por grupo, máx 3). O V2 não confirmou nem revisou esse número. Mantém-se o do V1 como herança até decisão explícita, mas registra-se como pendente de reconfirmação sob o modelo de dois bolsos.

---

## 🔄 REVOGAÇÕES E EMENDAS AO V1

O V2 revoga ou emenda os seguintes pontos do CONTRATO_GRUPOS_V1; o restante do V1 permanece vigente.

- **Conta única de grupo (`owner_type='group'`)** → REVOGADA. Substituída por dois bolsos (§1.1). O `owner_type='group'` do V1 era anti-canônico (o Bank usa `owner_type='actor'` para wallets); o dinheiro de grupo vive como `actor_wallet` (operacional) e `group_community_fund` (comunitário), ambos `owner_type='actor'` sob composite por `actor_id`.
- **`user_active_groups` como substrato do split** → SUPERADO. A fonte de vínculo é `group_members` (§2.2); `user_active_groups` fica como possível read-model futuro.
- **Critérios de elegibilidade do V1 §4 (≥5 membros, atividade)** → SUSPENSOS na v1 (§2.3), retornam na Camada 3. Os itens estruturais (responsável civil, não-banido, não-dissolvido) tornam-se a elegibilidade mínima v1.
- **"Como Grupo Gasta" do V1 §5** → EMENDADO. O V1 permitia gasto sem definir trilho; o V2 define o trilho mínimo auditável (§2.5) e classifica o gasto externo como trilho financeiro próprio com ratificação tripla (§1.4).

Pontos do V1 MANTIDOS: grupo como actor econômico coletivo; `actor_type='group'`; grupo não saca livremente; ciclo de status (DRAFT/INFORMAL/VERIFIED/DORMANT/BANNED); roles (admin/moderator/member); categorias de grupo; transparência aos membros (agora detalhada em §1.6 e §2.6).

---

## 📌 SÍNTESE VINCULANTE

1. Grupo tem dois bolsos: operacional (`actor_wallet`) e comunitário (`group_community_fund`, nome a validar).
2. Receita própria → operacional. Split comunitário → comunitário.
3. Split comunitário roteia por: membership (`group_members`) → elegibilidade mínima (itens 1–5) → prioridade do usuário se múltiplos → fallback regional da região do usuário.
4. Fallback dispara por ausência de vínculo elegível, nunca por falha de lookup.
5. Membros veem o bolso comunitário de forma agregada; origem individual é interna, não exposta.
6. Admin não tem poder livre; todo gasto é auditável, com finalidade coletiva, justificativa, evidência, ledger e visibilidade.
7. v1 recebe E gasta por trilho mínimo auditável; voto formal e limite por valor são futuros.
8. Fornecedor externo pode ser pago com finalidade comunitária; saque livre e pagamento sem contraprestação são proibidos.
9. Saldo comunitário é coletivo: passado fica no grupo, não há direito individual, formalização não o libera, fraude não o beneficia.
10. Fim-de-vida: destino padrão é congelamento ou fundo regional conforme o caso; nunca admin ou membro.
11. Gasto comunitário externo é trilho financeiro próprio — frente com ratificação tripla.
12. O que tem princípio decidido mas mecanismo inexistente está na Camada 3 e a v1 não o implementa nem o bloqueia.
