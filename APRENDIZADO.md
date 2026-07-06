# APRENDIZADO — Contexto Arquitetural do Compositor Universal

**Data:** 2026-07-05  
**Participantes:** Clayton, Claude  
**Status:** Conversação em andamento — este arquivo documenta aprendizados estruturais que orientam todas as decisões subsequentes.

---

## Tese Central: UnifiCard é Autogestão Econômica Unificada

UnifiCard não é um super-app, não é um marketplace, não é uma rede social. É uma **ferramenta de autogestão econômica e social** que devolve recursos (dinheiro, poder, governança) à região onde as pessoas atuam, em vez de extrair pra corporações centralizadas.

**O diferencial:** 
- Meta/Google/TikTok extraem atenção e a monetizam em Wall Street.
- Uber/Airbnb/Amazon tomam intermediação e ficam com a margem.
- UnifiCard: tudo que gera valor fica na região, governado por quem vive lá. Você não é "user", é **actor** com direito de voto em decisões que afetam sua comunidade.

---

## O Compositor como Portal Unificado

O compositor (a tela onde um actor **cria um ato**) é o teste de ouro da arquitetura. Porque nele convergem:

### 1. **Actor em Contexto Operante**
- Mesmo actor pode estar em modo **consumidor** (procurando serviço) ou **operador** (oferecendo).
- Mesma pessoa pode ser **Pessoa Física** (individual) ou **Empresa** (juridicamente).
- Quando está num desses modos, a tela muda de cara — mas a identidade econômica permanece una (um saldo, um ledger, uma reputação).

### 2. **Papel/Permissão dentro do Contexto**
O actor não está só "operando uma empresa" — está operando **um papel específico** naquela empresa.
- **Actor A em Empresa X como RH** → pode criar Vagas, Treinamentos, Enquetes de Seleção.
- **Actor A em Empresa X como Warehouse** → pode criar MovimentaçõesInventário, RelatoriosDano.
- **Mesmo Actor A, Empresa Y, Papel Finance** → pode criar Invoices, PurchaseOrders.

**Implicação crítica:** o compositor **não mostra uma lista fixa de tipos de ato**. Ele pergunta ao backend: "Quais tipos de atos este [actor, empresa, papel] pode iniciar?" E mostra só aqueles — não por UI trick, mas porque *literalmente não existem outros* pra esse papel.

### 3. **Tipos de Ato e Suas Consequências**
Um tipo de ato não é um "tipo de post". É a **porta de entrada para um domínio operacional real:**

- **Vaga** → entrada no módulo de RH/recrutamento; cria opportunity que pode virar contratação; impacta `company_users`.
- **Evento** → entrada no módulo de agenda/eventos; cria marco temporal que gera convocação; impacta `unified_availability`.
- **Oferta de Serviço** → entrada no marketplace; cria product_offer viva; impacta `services` + `tenant_products`.
- **Enquete/Voto** → entrada no módulo de governança; resultado de voto é operacional (aloca fundo regional, muda política); impacta `governance_proposals`.
- **Oportunidade** (termo genérico) → qualquer ato que abre uma possibilidade de troca econômica ou coordenação social.

Todos os tipos compartilham **eixos estruturais**, não cada um é um sistema à parte.

---

## Os 5 Eixos Estruturais do Compositor

Qualquer tipo de ato (Vaga, Evento, Oferta, Enquete, etc.) é uma **combinação destes eixos**:

### **Eixo 1: Quem Publica**
- Actor + seu papel/capacidade ativa no contexto
- Resolve via `canRepresentActor(tenantId, userId, actorId)` + verificação de role específico no contexto
- Nunca é "actor genérico", é "actor EM um papel" (RH, Vendedor, Financeiro, Consumidor)

### **Eixo 2: Contexto Operante**
- **Gestão interna** (treinamento, escala, evento interno) — coordenação de quem já está dentro
- **Vitrine externa** (propaganda, venda, vaga pública) — comunicação de fora pra dentro
- **Cadeia de suprimento** (compra, fornecedor) — fluxo transacional actor-a-actor específico

O mesmo tipo de ato pode mudar cara conforme o contexto (ex.: "Evento" pode ser interno-só ou público, dependendo de quem posta e em qual modo).

### **Eixo 3: Mecânica de Destino**
- **Broadcast a segmento** — um-para-muitos, resolvido por "para quem ver"
  - Público geral / Amigos / Funcionários / Fornecedores / Clientes
  - **Para PF:** grafo social (amigos, próximos, exceções)
  - **Para PJ:** papel funcional (funcionários/colaboradores/fornecedores/clientes/interessados)
- **Relação direct actor-a-actor** — transação com contraparte específica já identificada
  - Não é sobre visibilidade, é sobre fluxo estruturado (ordem de compra, candidatura, proposta)

### **Eixo 4: Consequência Real / Impacto Econômico**
- Que domínio do sistema é acionado? (marketplace, RH, governança, eventos, social)
- Qual ledger é afetado? (user_wallet, company_wallet, regional_fund, escrow)
- **Retorno à região?** — parte do impacto econômico volta pro fundo regional (decisão soberana: voluntária vs. sistêmica)

### **Eixo 5: Ciclo de Vida**
- Tem prazo de validade? (Vaga: até X dias ou até preenchimento; Evento: até data; Enquete: até votação fechar)
- Tem etapas/status? (aberto → em andamento → preenchido/fechado)
- Ou é instantâneo? (um voto é um voto, finalizado)
- **Quem define o prazo?** — o criador (no ato de criar), ou o sistema por regra?

---

## O Princípio Inviolável: Uma Fonte de Verdade

**A arquitetura aguenta sem criar fontes paralelas de verdade.**

Isso significa:

- **Permissões** — sempre resolvidas no backend, nunca cache no localStorage que fica fora de sync
- **Enumeração de tipos** — sempre do servidor ("qual é seu papel? eis os atos que você pode fazer"), nunca hardcoded na UI
- **Saldo/Ledger** — uma única fonte (DB), nunca duplicado em cache de cliente
- **Autoridade** — gravada UMA VEZ por ato, no banco, nunca em arquivo local que pode divergir
- **Projeção visual** — apenas **projeção**, nunca decisão. Frontend mostra o que backend garante, não inventa regras.

Se o compositor conseguir manter isso (resolver permissões sempre no servidor, enumerar tipos sempre do servidor, gravar sempre uma vez, nunca cache que seja verdade), então **todos os outros domínios podem copiar o padrão**: governança, compra, agenda, social. Tudo usa a mesma arquitetura sem risco de fragmentação.

---

## Próximas Etapas

1. **Mapear formalmente:** qual é a estrutura de [Role em Company] → [Tipos de Ato permitidos]?
   - Já existe um substrato pra isso no backend, ou precisa ser construído?
   
2. **Validar os eixos:** os 5 eixos cobrem todos os casos de uso, ou faltam dimensões?

3. **Desenhar a API do compositor:**
   - GET `/composer/available-actions?actorId=X&companyId=Y&role=RH` → retorna `["Vaga", "Treinamento", "Enquete"]`
   - POST `/composer/action` → cria o ato, atomicamente, no domínio certo

4. **Frontend tira daí:** mostra só aquilo que o servidor enumera, nunca inventa.

---

---

## O Princípio Econômico Fundamental: Dinheiro Dentro ou Dinheiro Fora

**Não existem abstrações de "Modo Consumir" e "Modo Operar".**

Na vida real, só existe uma verdade econômica:
- **Dinheiro sai do bolso** (você gasta)
- **Dinheiro entra no bolso** (você recebe)
- **Sem transação de dinheiro** (coordenação / social puro)

As palavras "consumir" e "operar" são tranquilas, linguisticamente palatáveis. Mas o **substrato é econômico**, não semântico.

**Implicação arquitetural:**

Um tipo de ato não deve ser classificado por nome ("Vaga", "Evento", "Oferta"). Deve ser classificado por **qual fluxo econômico ele gera:**

### **Categoria 1: Fluxo de Saída (Dinheiro Sai)**
O actor está gastando, pagando, investindo. Exemplos:
- Procura de Serviço ("procuro eletricista")
- Procura de Produto ("quero sofá vermelho")
- Procura de Ajuda Paga ("alguém cobra pra me ajudar a mudar?")
- Pedido de Locação ("procuro apartamento")

**Consequências reais:**
- Afeta limite de saldo (ele pode gastar quanto?)
- Requer verificação de fundos
- Gera débito no ledger pessoal

### **Categoria 2: Fluxo de Entrada (Dinheiro Entra)**
O actor está oferecendo, recebendo, gerando receita. Exemplos:
- Oferta de Serviço ("ofereço aula de inglês")
- Venda de Produto ("vendo artesanato")
- Vaga / Contratação ("preciso de alguém")
- Aluguel de Espaço ("aluga meu estúdio")

**Consequências reais:**
- Afeta receita do ledger pessoal
- Gera imposto/contribuição ao fundo regional
- Entra no histórico de reputação/confiabilidade
- Pode ter verificação de capacidade (você tem autoridade pra oferecer isso?)

### **Categoria 3: Fluxo Social Puro (Sem Transação)**
Coordenação, networking, expressão. Nenhuma transação de dinheiro. Exemplos:
- Post Social ("foto minha, comentário, story")
- Match Social ("procuro alguém pra sair" — se PURO, sem pagamento envolvido)
- Enquete de Interesse ("alguém quer montar grupo de corrida?")
- Interesse Declarado ("gosto disso")

**Consequências reais:**
- Não afeta ledger
- Afeta apenas grafo social / descoberta
- Pode gerar cruzamento de interesses (recomendação)

**A diferença crítica:**

Um ato "procuro companhia pra sair" é **ambíguo sem resolver a categoria econômica:**
- Se for **Fluxo Social Puro** (só match, sem dinheiro) → não é consumir nem operar, é coordenação social
- Se for **Fluxo de Saída** (ele vai pagar pra alguém ser companhia, tipo sugar dating) → é gasto real, afeta saldo
- Se for **Fluxo de Entrada** (ele cobra pra ser companhia) → é receita, afeta imposto

**No compositor:**

A pergunta não é "qual tipo de post é esse?"  
A pergunta é: **"este ato causa saída de dinheiro, entrada de dinheiro, ou é puro social?"**

A resposta a essa pergunta determina:
- Quais verificações rodar
- Qual ledger é afetado
- Quem vê (visibilidade)
- Qual ciclo de vida
- Quais permissões são necessárias

---

## 🔴 LEI DE NAVEGAÇÃO UNIVERSAL: Frontend Nunca Cria Verdade

**O Frontend é PROJEÇÃO. Nunca DECISÃO.**

Isso vale para TUDO: permissões, limites, enumeração de atos, audiência permitida, categoria econômica, SSOT do dinheiro.

### **O que Frontend PODE fazer:**

✅ **Mostrar** o que Backend permitiu (permissões resolvidas no servidor)
✅ **Renderizar** atos baseado no que Backend enumerou (GET /composer/available-actions respondido pelo servidor)
✅ **Projetar** dados que Backend garantiu (ledger consultado do servidor, não cache)
✅ **Degradar UX** se Backend bloquear (botão desabilitado, mensagem clara)
✅ **Confiar** em dados do servidor (nunca questionar, nunca fazer workaround)
✅ **Validação UX** (verificação local pra feedback imediato, mas nunca como decisão real)

### **O que Frontend NÃO PODE fazer:**

❌ **Decidir** se alguém tem permissão (sempre perguntar ao servidor)
❌ **Calcular** limite de gasto (sempre verificar no servidor)
❌ **Enumerar** atos sem Backend confirmar (nunca hardcodificar lista de atos)
❌ **Cache de permissões** que seja verdade (cache é hint, não autoridade)
❌ **Workaround** quando backend rejeita (nunca tentar contornar 403)
❌ **Confiar em localStorage** como fonte de verdade (sempre verificar com servidor)
❌ **Simular autorização** ("se o usuário não vê X, então não pode fazer Y")

### **Checklist Obrigatório Antes de Codar Frontend:**

1. **Estou criando uma nova fonte de verdade?** 
   - ❌ Se sim, PARE. Isso não é permitido.
   - ✅ Se não, continue.

2. **Quem é soberano sobre esta decisão?**
   - Permissão? → Backend (via `canRepresentActor` + role checks)
   - Limite de gasto? → Backend (via `checkSpendingAuthority`)
   - Qual ato posso criar? → Backend (via `GET /composer/available-actions`)
   - Se dois clientes conseguem responder diferentemente, há um problema na arquitetura.

3. **Isso é projeção ou decisão?**
   - Projeção: "Mostro o que o servidor garantiu"
   - Decisão: "Eu decido baseado em lógica local"
   - ❌ Se é decisão, PARE. Não é permitido.

4. **Estou usando cache como verdade?**
   - ❌ Cache local é hint, não verdade. Sempre verificar com servidor em cada ação crítica.
   - ✅ Cache é OK pra UX (render rápido), mas SEMPRE validar com servidor antes de commit.

### **Padrão Correto: Sempre Backend First**

```
Frontend quer saber: "Marina pode criar Procura Fornecedor?"

❌ ERRADO:
  if (localStorage.permissions.includes('warehouse:create')) {
    showCreateButton()
  }

✅ CORRETO:
  GET /composer/available-actions?actor=marina&role=warehouse
  → Backend responde: ["Procurar Fornecedor", "Registrar Entrada", ...]
  → Frontend renderiza APENAS essas opções
  → Nenhuma lógica local de permissão
```

---

### **Exemplo Crítico: Limite de Gasto**

Marina quer postar "Procurar Fornecedor — R$ 60.000" (acima do limite R$ 50.000).

❌ **ERRADO (Frontend decide):**
```javascript
if (amount > 50000) {
  disableButton() // Frontend bloqueou
}
// Mas se Marina conseguir contornar (dev tools), upload funciona?
// Inconsistência! Duas fontes de verdade.
```

✅ **CORRETO (Backend é soberano):**
```javascript
// Frontend mostra interface normalmente
// Marina preenche e envia ao Backend

POST /composer/action
  { action: "Procurar Fornecedor", amount: 60000, ... }

// Backend valida:
if (amount > warehouse_limit) {
  return 403 {
    code: 'SPENDING_LIMIT_EXCEEDED',
    message: 'Limite é R$ 50.000. Precisa de aprovação.',
    options: ['reduce', 'request_approval', 'split']
  }
}

// Frontend renderiza a resposta:
if (response.code === 'SPENDING_LIMIT_EXCEEDED') {
  showOptions(response.options)
}
// Se alguém tentar contornar? Sempre vai bater no Backend.
// Uma única fonte de verdade.
```

---

### **Por que isso importa:**

1. **Segurança:** Se Frontend decide permissão, alguém pode contornar (dev tools, man-in-the-middle).
2. **Consistência:** Se duas fontes de verdade existem, eventualmente divergem (cache desatualiza, bug local, etc).
3. **Auditoria:** Se alguém pergunta "quem criou essa vaga?", precisa saber: "Marina, com papel RH_MANAGER, com limite R$ 50.000, aprovado via servidor". Se Frontend teve participação em autorizar, audit trail fica confuso.
4. **SSOT do Dinheiro:** Tudo que impacta ledger precisa ser 100% verificado no backend. Frontend nunca toca nisso.

---

### **Integração com Estrutura de Departamentos**

Quando Marina abre o Compositor:

```
Frontend faz: GET /composer/available-actions?dept=warehouse&actor=marina

Backend responde:
{
  available_actions: ["Procurar Fornecedor", "Registrar Entrada", ...],
  spending_limits: {
    "Procurar Fornecedor": 50000,
    "Registrar Entrada": null (sem limite)
  },
  approval_required_above: 30000,
  audiences: ["B2B_PRIVADO", "INTERNO"]
}

Frontend renderiza:
  - Form pra "Procurar Fornecedor" (porque Backend disse que pode)
  - Aviso: "Limite R$ 50.000, acima disso precisa aprovação"
  - NUNCA bloqueia antes de enviar (deixa Backend bloquear, se necessário)

Marina preenche, clica "Enviar"

Backend valida NOVAMENTE:
  ✓ Marina ainda pode fazer isso? (permissão pode ter mudado)
  ✓ Saldo ainda permite? (outro ato pode ter consumido limite)
  ✓ Categoria econômica bate? (auditoria)
  
Se tudo ✓: grava no ledger
Se algum ✗: retorna 403 com razão exata
```

---

## 🔴 PRINCÍPIO FUNDACIONAL: O Dinheiro tem Uma Única Fonte de Verdade

**O sistema inteiro foi construído sobre isto:**

Não existe múltiplas "versões" de quanto cada ator tem, deve ou recebe. Existe UM banco de dados. Uma tabela. Uma verdade.

**Por quê isto importa:**

Se o dinheiro tivesse múltiplas fontes de verdade:
- Pessoa Física vê que tem R$ 500, mas Backend tem R$ 300 → quem está certo?
- Grupo arrecada R$ 1000, mas Admin vê R$ 800 → divergência, desconfiança
- Evento faz split entre Venue + Banda, mas cada um recebe número diferente → fraude, conflito
- Cache local do celular fica fora de sync com banco → pessoa gasta dinheiro que já foi gasto

**Toda a visão desmorona.**

---

### **A Arquitetura é Construída pra Garantir SSOT do Dinheiro**

Cada decisão arquitetural reforça isto:

1. **Um banco de dados de ledger** (não múltiplos caches, não localStorage, não "calcula depois")
2. **Transações atômicas** (split é gravado tudo ou nada, não parcial)
3. **Imutabilidade** (ninguém consegue editar histórico, só consultar)
4. **Backend calcula, Frontend projeta** (servidor é verdade, cliente é espelho)
5. **Verificação em tempo real** (antes de permitir gasto, verifica saldo; não "tenta depois")

**Isso permite tudo que descrevemos:**

- ✅ **Pessoa Física** com ledger pessoal → porque dinheiro é SSOT
- ✅ **Empresa** com ledger empresarial → porque dinheiro é SSOT
- ✅ **Banda** vendendo ingressos com comissão → porque split é SSOT, calculado uma vez
- ✅ **Grupo** arrecadando transparente → porque ledger é consultável, ninguém altera
- ✅ **Evento Compartilhado** com split dinâmico → porque cada venda é registrada atomicamente, ambos veem número idêntico
- ✅ **Múltiplos atores economicamente ligados** (Venue + Banda + Influencer) → porque o split é calculado por origem, ninguém consegue roubar comissão do outro

**Sem SSOT do dinheiro, nenhum disso funciona.**

---

## Caso de Uso Avançado: Evento Compartilhado com Split Dinâmico

**O Problema que resolve:**

Normalmente (Ticketmaster, Sympla): venue cria evento, vende ingresso, artista promove de graça ou recebe cachê fixo. Margem fica com plataforma centralizada.

**O Modelo UnifiCard:**

Um evento é uma **entidade compartilhada** entre múltiplos atores (venue + banda + possivelmente influencers), cada um com autoridade pra vender ingressos **da mesma página**, e cada venda gera uma **comissão rastreável por origem**.

### **Estrutura de um Evento Compartilhado**

```
Evento {
  id: event_uuid,
  primary_actor: venue_id (quem criou/locação),
  participants: [banda_id, outro_artista_id, influencer_id],
  
  split_config: {
    venue_base_share: 60%,           # receita por locação
    artist_commission_per_ticket: 15%, # % por cada ticket vendido pela banda
    influencer_commission: 10%,        # % por cada ticket vendido por influencer
    platform_fee: 5%
  },
  
  sales_tracking: [
    { 
      ticket_id, 
      vendor_actor_id,  # quem vendeu (venue, banda, influencer)
      customer_actor_id,
      purchased_at,
      commission_calculated: true
    }
  ]
}
```

### **Fluxo Econômico Completo**

```
1. CRIAÇÃO
   Venue cria evento ("Banda X toca aqui tal data")
   ↓
2. ACORDO
   Venue autoriza Banda a participar da divulgação e venda
   Estabelece split_config (banda ganha 15% por ingresso que ela vender)
   ↓
3. DIVULGAÇÃO MULTI-CANAL
   Venue posta no seu perfil → seus seguidores veem
   Banda posta divulgação → seus seguidores veem
   Sistema rastreia origem (qual ator gerou a venda)
   ↓
4. VENDA RASTREADA
   Cliente vê divulgação da Banda → compra pelo link dela
   Sistema registra: vendor_actor_id = banda_id
   ↓
5. SETTLEMENT (Liquidação)
   Ingresso vendido → dinheiro entra em event_ledger
   Sistema calcula split automático:
     - Venue: 60% (locação)
     - Banda: 15% (comissão, porque DELA foi a venda)
     - Platform: 5%
   ↓
6. DEPOSIÇÃO NOS LEDGERS
   band_wallet += comissão_calculada
   venue_wallet += receita_base
   regional_fund += imposto (calculado por ator)
```

### **Por que isso é Revolucionário**

1. **Incentivo Alinhado:** Banda não promove de graça. Quanto mais vender via seguidores dela, mais ganha. Venue também ganha com a base de vendas dela.

2. **Atribuição de Crédito Real:** Sistema sabe QUEM trouxe cada cliente. "Este ingresso veio da divulgação da Banda" → comissão vai pra Banda.

3. **Múltiplos Vendedores, Uma Página:** Não é "evento da venue" + "promoção da banda" em lugares separados. É **UM evento**, ambos vendendo, ambos ganhando.

4. **Economia Regional Intacta:** Toda receita fica na região. Banda ganha. Venue ganha. Nenhuma margem vai pra São Francisco.

5. **Problema Social Resolvido:** Um bar em bairro pobre pode não ter público. Uma banda pode ter 10k seguidores. Sistema incentiva a banda a divulgar (ganha comissão), e o bar fica cheio. Todos ganham.

### **Implicações no Compositor**

Quando uma Banda já tem um evento acordado com um Venue:

**Tipo de Ato: "Divulgação de Evento Participante" (Fluxo de Entrada)**

- **Ator:** Banda (com autoridade restrita **só a este evento**, não autoridade geral de vender ingressos)
- **Categoria Econômica:** Fluxo de Entrada (banda ganha comissão)
- **Eixo 1 (Quem):** Banda, papel = "participant_in_event"
- **Eixo 2 (Contexto):** Vitrine externa (divulgação comercial)
- **Eixo 3 (Destino):** Broadcast aos seguidores da Banda
- **Eixo 4 (Consequência):** Venda de ingresso rastreada por origem → comissão
- **Eixo 5 (Ciclo):** Aberto até data do evento

**O que a Banda posta:**
- Fotos + descrição do evento
- Chamada pra seguidores ("venham, comprem ingresso pelo meu link")
- Cada link que a Banda gera é único → rastreia venda dela

**Autorização necessária:**
- Só pode postar divulgação de eventos que ela é `participant` autorizado
- Backend verifica: `participant in event.participants and event.split_config.artist_commission > 0`

### **Cálculo de Comissão e Settlement**

Após evento:
```
tickets_sold_by_banda = 50
price_per_ticket = 100 reais
split_artist_commission = 15%

artist_commission = 50 * 100 * 0.15 = 750 reais

bank_transaction {
  event_id,
  vendor_actor_id: banda_id,
  amount_cents: 75000,
  type: 'commission',
  description: 'Comissão por vendas de ingressos — Evento X'
}

band_wallet.balance += 750 reais
```

Imposto é calculado sobre a comissão (não sobre a venda bruta), porque a banda só recebeu aquele valor.

### **Extensão: Influencers também Vendem**

O mesmo modelo funciona pra influencers:
```
Evento {
  participants: [banda_id, influencer_id],
  split_config: {
    artist_commission: 15%,
    influencer_commission: 10%
  }
}
```

Influencer ganha menos (10% vs 15% da banda), porque bandas têm interesse material no evento (vão tocar), influencers não. Mas ainda ganham.

### **⚠️ RESTRIÇÃO CRÍTICA: SSOT do Dinheiro e Split**

**O split NÃO é mágica no frontend ou cálculo posterior.**

O split é um **contrato gravado atomicamente no banco de dados**, a Source of Truth do dinheiro:

**Onde e Como o Split é Gravado (SSOT Único):**

```
bank_transactions {
  id: uuid,
  ticket_sale_id: ticket_uuid,
  vendor_actor_id: banda_id,        # quem vendeu
  gross_amount_cents: 10000,        # preço integral
  
  splits: [
    {
      recipient_actor_id: venue_id,
      amount_cents: 6000,
      reason: 'venue_base_share',
      wallet_destination: venue_wallet
    },
    {
      recipient_actor_id: banda_id,
      amount_cents: 1500,
      reason: 'artist_commission_from_vendor',
      wallet_destination: band_wallet
    },
    {
      recipient_actor_id: regional_fund,
      amount_cents: 500,
      reason: 'platform_fee',
      wallet_destination: regional_fund
    }
  ],
  
  status: 'settled',    # ⚠️ ATOMIC — não é "calculating", é "settled"
  settled_at: timestamp,
  created_at: timestamp
}
```

**Regras Invioláveis:**

1. **Split é calculado UMA VEZ, no backend, no momento da venda** — não depois, não no frontend.
2. **Split é gravado atomicamente** — tudo ou nada. Não pode haver transação parcial (venue recebe mas banda não).
3. **Split é SSOT** — não existe em nenhum outro lugar. Cada actor consulta a mesma tabela.
4. **Cada actor vê seu lado** — `GET /actor/{actor_id}/ledger` consulta `bank_transactions WHERE splits[].recipient_actor_id = actor_id`. Read-only, nunca editável.
5. **Verificação no Backend, sempre** — nunca é "o frontend calcula e mostra quanto você ganha". Backend calcula, grava, frontend apenas PROJETA o número.

**O que NÃO PODE SER:**

❌ Frontend calcula split e mostra "você ganhou 1500"  
❌ Backend tem número diferente "você ganhou 1200"  
❌ Split é recalculado depois (pode divergir)  
❌ Split fica em cache local do cliente (pode ficar fora de sync)  
❌ Dois atores veem números diferentes da mesma venda  

**O que TEM QUE SER:**

✅ Backend: evento criado, split_config gravado (imutável)  
✅ Backend: ingresso vendido → calcular split → gravar bank_transactions atomicamente  
✅ Todos: consultam mesma SSOT, veem mesmo número  
✅ Frontend: apenas projeta o que backend garante  

**Implicação no Compositor:**

Quando a Banda posta divulgação de evento e uma venda acontece:
- Sistema verifica `event.split_config` (é autorizado? Banda ganha X%?)
- Calcula split: `venue_share = gross * 0.60`, `band_commission = gross * 0.15`, etc.
- Grava bank_transaction com splits[] preenchido
- Ambos consultam e veem o mesmo número

**Sem exceção. Sem "calcularemos depois". Sem frontend decidindo.**

---

## Caso de Uso Estrutural: Grupo como Ator Econômico Coletivo (Economia Solidária)

**Exemplos reais:**
- Grupo de cuidadores de animais de rua do bairro X
- Torcida organizada Y
- Coletivo de mulheres artesãs
- Comunidade de pessoas deficientes
- Horta comunitária

**Grupo é um ATOR** (como Pessoa Física, Empresa, Banda), mas coletivo:
- Tem múltiplos membros (com papéis: Admin, Treasurer, Member, Volunteer)
- Tem propósito/causa
- **Tem seu próprio ledger e wallet** ← SSOT do dinheiro do grupo
- Pode arrecadar (venda, doação) e gastar (em prol da causa)
- Transparência total — qualquer membro consulta o ledger

### **Tipos de Atos que um Grupo pode POSTAR**

**Fluxo de Entrada (Arrecada):**

1. **Venda de Merchandise** — "Camiseta da torcida" / "Adesivo do grupo"
   - Quem pode postar: Member+ (com permissão `products:create`)
   - Ledger: group_wallet (100% vai pro grupo, não pro vendedor individual)
   - SSOT: Quando ingresso é vendido → `group_ledger` registra: "R$ X arrecadado com vendas"
   - Todos os membros veem o mesmo número (transparência total)

2. **Evento de Arrecadação** — "Show beneficente" / "Bazar arrecadação"
   - Quem pode postar: Admin+
   - Ledger: group_wallet
   - Pode ter split (ex: banda doa 30%, grupo fica 70%)

3. **Pedido de Doação** — "Arrecadando pra ração" / "Precisamos de R$ 2000"
   - Quem pode postar: Admin+
   - Ledger: group_wallet (doações diretas)
   - Transparência: "Já arrecadamos R$ 1200 de R$ 2000. Veja histórico completo de gastos anteriores"

**Fluxo de Saída (Gasta em prol da causa):**

1. **Procura de Produto/Serviço** — "Precisamos comprar ração urgente" / "Procuramos veterinário"
   - Quem pode postar: Treasurer+ (verifica orçamento)
   - Ledger: group_wallet (despesa, quando alguém responder e grupo aceitar)
   - Verificação: Backend valida saldo suficiente

2. **Procura de Voluntário** — "Precisamos de alguém pra cuidar de X animal"
   - Quem pode postar: Member+
   - Ledger: Nenhum (social puro, coordenação)

**Fluxo Social Puro:**

1. **Post de Impacto** — "Fotos dos animais resgatados hoje"
   - Quem pode postar: Member+
   - Ledger: Nenhum
   - Função: Conexão emocional, transparência, mobilização

2. **Enquete Interna** — "Qual ração vocês preferem?"
   - Quem pode postar: Member+
   - Destino: Membros (broadcast fechado)
   - Ledger: Nenhum (mas resultado informa decisão de compra)

### **SSOT do Grupo: Transparência como Garantia de Confiança**

Quando grupo arrecada R$ 1000 com venda de camiseta:

```
group_ledger entry {
  id: uuid,
  group_id: group_uuid,
  type: 'income',
  description: 'Venda camisetas',
  amount_cents: 100000,
  
  status: 'settled',  # ⚠️ ATOMIC, não "calculating"
  created_at: timestamp
  # IMUTÁVEL — qualquer membro consulta, ninguém altera
}

GET /group/{group_id}/ledger
→ Todos os membros veem:
   "R$ 5000 arrecadado com vendas"
   "R$ 3000 doações"
   "R$ 2000 gasto com ração"
   "R$ 1000 gasto com medicamento"
   "Saldo atual: R$ 5000"

→ Ninguém consegue discordar
→ Confiança é construída em números, não em promessas
```

### **Papel e Permissões no Grupo**

| Papel | Criar Evento | Criar Produto | Aprovar Gasto | Ver Ledger |
|-------|------|---------|----------|---------|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Treasurer | ❌ | ❌ | ✅ | ✅ |
| Member | ❌ | ✅ | ❌ | ✅ |
| Volunteer | ❌ | ❌ | ❌ | ❌ (privado) |

**Regra crítica:** Todos consultam, ninguém consegue editar (imutável).

### **Por que isso é Revolucionário**

1. **Sem intermediário com margem** — Grupo vende camiseta, 100% vai pro causa. Não é Mercado Livre tirando 20%.

2. **Transparência operacional** — Membro sabe exatamente quanto grupo tem, quanto gastou, pra quê. Porque o dinheiro é SSOT.

3. **Economia solidária operacionalizada** — Grupo é um ator econômico real. Pessoa deficiente que não consegue trabalho formal cria grupo, arrecada, vira operadora de ativo econômico.

4. **Governança que é material** — "Votamos usar R$ 500 pra ração Y" — esse voto é operacional, afeta o ledger real, não é decorativo.

5. **Múltiplos grupos podem cooperar** — Grupo A + Grupo B fazem evento juntos, split automático, cada um arrecada transparente.

---

---

## Caso de Uso Crítico: Canal Nativo UnifiCard (Infraestrutura Descentralizada de Criador)

**⚠️ CRÍTICO:** Canal NÃO é integração com YouTube/TikTok/Meta. Criador **cria canal DENTRO de UnifiCard**, monetiza ali, economia fica 100% na região.

### **Diferença Radical vs YouTube/TikTok**

| Aspecto | YouTube/TikTok | UnifiCard Canal |
|--------|---------|---------|
| **Monetização** | Ads (algoritmo opaco, plataforma tira 30-55%) | Direto com audiência (criador controla) |
| **Receita** | Plataforma dita regras | 100% pro criador (menos imposto regional) |
| **Economia** | Margem vai pra Silicon Valley | **Fica 100% na região** |
| **Transparência** | Black box | **SSOT**, consultável por todos |
| **Integração** | Isolado (YouTube é YouTube) | **Integrado** (canal + evento + grupo + banda) |
| **Função Social** | Voluntária (fora da plataforma) | **Operacional** (ledger comprova) |
| **Confiança** | "Promessa de criador" | **Dados verificáveis** (SSOT) |
| **Risco** | Desmonetização arbitrária | Nenhum (economia descentralizada) |

---

### **Como Criador Ganha Dinheiro (dentro UnifiCard)**

**Tipo 1: Venda de Produto Exclusivo**
- Ebook, curso, guia, conteúdo pago
- 100% da venda → channel_wallet
- Criador consulta: "Vendi R$ 5000 em ebooks este mês"

**Tipo 2: Doação/Tipping de Seguidores**
- Button: "Apoie este criador" (R$ 5/10/20)
- Dinheiro → channel_wallet direto
- Criador pode publicar: "Vocês arrecadaram R$ 2000, usarei pra criar vídeos melhores"

**Tipo 3: Conteúdo Pago (Inscrição Recorrente)**
- "Acesso exclusivo por R$ 9.99/mês"
- Inscritor vê conteúdo premium do canal
- Receita recorrente → channel_wallet

**Tipo 4: Patrocínio/Sponsorship**
- Marca paga criador pra anunciar no canal
- "Este vídeo é patrocinado por Marca X"
- Dinheiro → channel_wallet
- Sistema rastreia: "R$ 5000 de patrocínio este mês"

**Tipo 5: Evento do Canal**
- Live ao vivo, workshop, meet and greet
- Audiência paga pra participar
- 500 pessoas × R$ 20 = R$ 10000 → channel_wallet

**Tipo 6: Comissão de Venda (Afiliado Evoluído)**
- Criador recomenda Produto/Serviço dentro UnifiCard
- Usuário compra via link do criador
- Sistema rastreia automaticamente quem trouxe
- Comissão (ex: 10%) → channel_wallet
- Criador consulta: "Ganhei R$ 500 com recomendações"

**Tipo 7: Parceria com Evento/Artista**
- Criador promove show de banda
- Faz live no canal, vende ingressos
- Split automático: criador 30%, banda 60%, plataforma 10%
- Ambos recebem número idêntico (SSOT)

**Tipo 8: Arrecadação Beneficente**
- Criador faz live: "Vendo ebook, 100% vai pro Grupo de Cuidadores"
- Audiência compra
- Dinheiro → group_wallet direto
- Ou criador pega comissão (ex: 10%) se oferecer serviço de mobilização

---

### **Como Criador Ajuda a Sociedade (Operacionalmente, não voluntariamente)**

**Modelo 1: Dedicação de Receita (Transparente)**
```
Criador de conteúdo sobre deficiência:
  - Arrecada R$ 10000/mês (vendas + doações + patrocínio)
  - Decide: 30% vai pro Grupo de Pessoas com Deficiência
  - R$ 3000 são gravados em group_ledger (SSOT, imutável)
  
  Seguidores consultam:
    "R$ 3000 realmente entraram no grupo este mês.
     Confio porque isso é rastreável, não promessa."
```

**Modelo 2: Amplificação de Voz (Com Rastreamento)**
```
Criador com 100k seguidores sobre animais:
  - Conhece Grupo de Cuidadores com 100 membros
  - Posta sobre trabalho deles 3x/semana
  - Audiência descobre, alguns se tornam doadores
  - Grupo ganha R$ 5000/mês, rastreável (canal foi origem)
  
  Resultado operacional:
    "Meu conteúdo trouxe 50 novos doadores.
     Grupo arrecada R$ 5000 mensais extras.
     Tudo documentado no ledger."
```

**Modelo 3: Educação Acessível (Subsidio Comunitário)**
```
Criador sobre programação:
  - Vende curso completo por R$ 99 (R$ 5000/mês)
  - Cria versão gratuita pra comunidade de baixa renda
  - Venda subsidia free tier
  - Democratiza conhecimento
  
  Ledger mostra:
    "100 pessoas estudaram grátis este mês.
     Subsídio total: R$ 800 (meu lucro pessoal cobriu)."
```

**Modelo 4: Mobilização Transparente (Impacto Rastreável)**
```
Criador sobre saúde mental:
  - Descobre pesquisa urgente que precisa de R$ 50000
  - Faz live beneficente
  - Audiência doa R$ 50000
  - Dinheiro → pesquisador direto
  
  Transparência operacional:
    "Este R$ foi alocado assim. Avaliação de impacto
     será publicada aqui. Vocês podem acompanhar resultado."
```

**Modelo 5: Curadora de Comunidade (Jornalismo Social)**
```
Criador é jornalista social:
  - Posta histórias de impacto (sem ganho direto)
  - Audiência descobre grupos/pessoas
  - Seguidores canalizam apoio direto
  - Criador não ganha, mas é agente mobilizador
  
  Função operacional:
    "Posso ver quanto impacto meu conteúdo tem.
     5 grupos foram descobertos por meus posts.
     Cada um recebeu doações mensuradas."
```

---

### **Estrutura Técnica: Canal como Ator**

```
Canal {
  id: channel_uuid,
  creator_id: user_id,
  name: "Tech Reviews BR",
  actor_id: channel_actor_id,  # ← é um ATOR
  
  followers: 100000,
  
  channel_wallet: {
    balance_cents: 500000,
    currency: 'BRL'
  },
  
  channel_ledger: [
    { type: 'income', source: 'product_sales', amount: 200000, date },
    { type: 'income', source: 'sponsorship', amount: 150000, date },
    { type: 'income', source: 'tips', amount: 50000, date },
    { type: 'expense', description: 'Editor freelancer', amount: 30000, date },
    { type: 'beneficence', destination: 'group_uuid', amount: 50000, date }
  ]
}
```

**SSOT do Canal:**
- Todos os ganhos são gravados uma vez (imutável)
- Criador + seguidores consultam, ninguém consegue alterar
- Transparência é garantia, não promessa

---

### **Visão Integrada: Criador é Operador Econômico + Agente Social**

```
Criador X (educação financeira):
  
  RECEITA:
    - Venda de cursos: R$ 10000/mês
    - Doações de seguidores: R$ 2000/mês
    - Patrocínios: R$ 5000/mês
    - Recomendações (afiliado): R$ 1000/mês
    Total: R$ 18000/mês
  
  GASTOS:
    - Equipamento: R$ 2000/mês
    - Imposto regional (10%): R$ 1800/mês
    - Editor freelancer: R$ 3000/mês
    Subtotal: R$ 6800/mês
  
  ALOCAÇÃO BENEFICENTE:
    - Grupo de Educadores: R$ 5000/mês (30% da receita)
  
  LUCRO PESSOAL:
    - R$ 6200/mês (após todos os gastos e doações)
  
  ---
  
  LEDGER DO GRUPO (que recebe R$ 5000/mês):
    - Receita do Criador X: R$ 5000
    - Receita de outros doadores: R$ 2000
    - Total arrecadado: R$ 7000
    - Investido em educação comunitária: R$ 7000
    - Saldo: R$ 0 (tudo é investido na causa)
  
  ---
  
  RESULTADO OPERACIONAL:
    
    Criador:
      "Sou economicamente viável. Ganho bem, ajudo comunidade,
       tudo é rastreável. Confiança é construída em dados."
    
    Seguidores:
      "Vejo exatamente quanto ele ganha, quanto ajuda, quanto fica.
       Confio porque é transparente. Posso verificar ledger."
    
    Grupo:
      "Recebemos R$ 5000 mensais de um criador que acredita
       na nossa causa. Economicamente sustentável."
    
    Sociedade:
      "Economia ficou 100% na região. Nenhuma margem
       foi extraída por corporação centralizada."
```

---

### **Por que Criador é Incentivado a Ajudar (estruturalmente)**

1. **Transparência força responsabilidade** — ledger é consultável. Mentir é impossível.
2. **Impacto social gera reputação** — mais reputação = mais seguidores = mais receita.
3. **Sistema não cria conflito** — economia e impacto social são **alinhados**, não competem.
4. **Tudo é rastreável** — ninguém consegue roubar, ninguém consegue mentir.
5. **Economia regional fica intacta** — criador + grupo + audiência ganham; ninguém em São Francisco lucra.

---

---

## 🟡 Estrutura Operacional de Empresa: Departamentos e Seus Atos

**⚠️ ESBOÇO — Será refinado conforme a operação se consolidar.**

O Compositor **não é genérico**. Muda de cara dependendo de qual **departamento** está usando, qual **ato** quer criar, qual **audiência** quer atingir, qual **limite de gasto** tem.

---

### **Departamentos Principais e Mapeamento de Atos**

#### **1. RH (Recursos Humanos)**

**Atos permitidos:**
- **Vaga** (público) — recrutar novo funcionário
- **Treinamento Interno** (interno) — capacitação
- **Comunicado de Política** (interno) — alinhamento RH
- **Enquete de Engagement** (interno) — feedback de funcionários
- **Procura Fornecedor RH** (B2B) — consultoria, recrutadora

**Audiência permitida:**
- Público geral (vagas abertas)
- Funcionários internos (treinamento, política)
- Fornecedores RH (B2B, privado)

**Categoria econômica:**
- Vaga: ENTRADA (empresa gasta pra contratar)
- Treinamento: ENTRADA (empresa gasta pra capacitar)
- Fornecedor RH: ENTRADA (empresa gasta pra recrutar)

**Limites de gasto (por ato):**
- Vaga: até R$ 50.000 (acima, precisa aprovação Finance)
- Treinamento: até R$ 20.000/mês
- Fornecedor RH: até R$ 100.000
- Aprovação obrigatória acima de: R$ 50.000

---

#### **2. Estoque/Warehouse/Logística**

**Atos permitidos:**
- **Procura Fornecedor** (B2B) — comprar matéria-prima, produtos
- **Registra Entrada de Produto** (interno) — recebimento
- **Movimentação de Inventário** (interno) — transferência entre locais
- **Alerta de Stock Baixo** (interno, urgente) — falta de estoque
- **Descarte/Devolução** (interno) — produto danificado, obsoleto

**Audiência permitida:**
- Fornecedores (B2B, privado)
- Equipe interna (coordenação logística)
- Financeiro (quando há gasto)

**Categoria econômica:**
- Procura Fornecedor: SAÍDA (empresa gasta pra adquirir)
- Movimentação: SOCIAL (coordenação interna, sem transação)
- Alerta Stock: SOCIAL (aviso interno)
- Descarte: SAÍDA (perda, registrada no ledger)

**Limites de gasto:**
- Fornecedor até R$ 50.000 (acima, precisa aprovação Finance)
- Descarte até R$ 10.000
- Aprovação obrigatória acima de: R$ 30.000

**Integração operacional (fluxo real):**
```
Warehouse posta: "Procuro fornecedor de parafusos — 1000 un — R$ 5000"
  ↓
Entra em requisition_queue
  ↓
Finance recebe notificação (informacional, não bloqueadora)
  ↓
Se Warehouse ultrapassa limite (ex: R$ 60.000):
  → Sistema retorna 403: "Limite é R$ 50.000. Precisa aprovação Finance."
  ↓
Finance aprova/rejeita na fila
  ↓
Se aprovado: Fornecedor recebe convite pra responder
  ↓
Warehouse aceita proposta → purchase_order é gravada no ledger
```

---

#### **3. Financeiro/Tesouraria**

**Atos permitidos:**
- **Aprova/Rejeita Gasto** (interno) — validação de requisições
- **Negocia Pagamento** (B2B, privado) — com fornecedor
- **Comunicado de Política Salarial** (interno) — salários, benefícios
- **Relatório de Fluxo de Caixa** (interno, C-level) — situação financeira
- **Procura Empréstimo** (B2B, bank) — capital de giro
- **Controle de Budget/Alerta de Overspend** (interno) — monitoramento

**Audiência permitida:**
- Fornecedores (B2B, privado — negociação)
- Equipe interna (comunicados)
- C-level (relatórios executivos)
- Bancos/credores (B2B)

**Categoria econômica:**
- Aprovação: SOCIAL (decisão, não transação direta)
- Negociação: SAÍDA (empresa negocia gasto)
- Empréstimo: ENTRADA (capital entra no caixa)
- Relatório: SOCIAL (informação)

**Limites de gasto:**
- Aprovação: ilimitado (pode rejeitar qualquer gasto)
- Negociação de pagamento: até R$ 500.000
- Empréstimo: até R$ 1.000.000 (acima, precisa board vote)
- Aprovação obrigatória acima de: nenhum (Finance aprova tudo)

**Integração operacional:**
```
Warehouse/RH/Vendas postam ato com gasto
  ↓
Se abaixo de limite do departamento:
  → Grava direto, Finance é notificado (informacional)
  
Se acima de limite do departamento:
  → Vai pra fila de Finance (bloqueadora)
  → Finance recebe notificação (ação requerida)
  → Finance pode:
       ✓ Aprovar (gasto segue)
       ✗ Rejeitar (volta pro departamento)
       ? Sugerir alternativa
```

---

#### **4. Administrativo/Compliance**

**Atos permitidos:**
- **Comunicado Geral** (público/interno) — informações da empresa
- **Atualização de Dados Empresa** (público) — mudança endereço, contato, CNPJ
- **Documentação/Conformidade** (interno) — regulatório, ISO, LGPD, auditoria
- **Contrato com Terceiro** (B2B, privado) — formalização legal
- **Política Corporativa** (interno) — código de ética, COE, compliance

**Audiência permitida:**
- Público (informações gerais, atualizações cadastrais)
- Funcionários (políticas internas)
- Órgãos reguladores (quando necessário, conformidade)
- Parceiros comerciais (contratos)

**Categoria econômica:**
- Comunicado: SOCIAL (informação)
- Conformidade: SAÍDA (empresa gasta pra estar em conformidade)
- Contrato: entrada/saída (depende se compra ou vende)

**Limites de gasto:**
- Conformidade: até R$ 20.000/mês
- Contrato terceiro: até R$ 50.000
- Aprovação obrigatória acima de: R$ 10.000

---

#### **5. Vendas/Comercial**

**Atos permitidos:**
- **Oferta de Produto** (público) — publicidade, catálogo vivo
- **Promoção/Desconto** (público) — campanha comercial, limite de desconto
- **Proposta Comercial** (B2B, cliente específico) — preço customizado
- **Negociação** (B2B, privado) — com cliente, parceiro, distribuidor
- **Procura Parceiro Vendas** (B2B) — distribuidor, revendedor, afiliado

**Audiência permitida:**
- Público geral (ofertas, promoções)
- Clientes específicos (propostas personalizadas)
- Parceiros comerciais (B2B)

**Categoria econômica:**
- Oferta: ENTRADA (empresa ganha com venda)
- Promoção: SAÍDA (empresa reduz margem)
- Proposta: ENTRADA (empresa oferecendo)
- Parceria: ENTRADA/SAÍDA (depende se é venda ou comissão)

**Limites de gasto/desconto:**
- Promoção: até 20% desconto (acima, precisa aprovação C-level)
- Comissão oferecida: até 15%
- Parceria comercial: até R$ 100.000
- Aprovação obrigatória acima de: 25% desconto ou R$ 50.000

**Integração operacional:**
```
Vendedor posta: "Promoção 15% em Produto X — válida até 2026-07-10"
  ↓
Sistema valida: "15% desconto está dentro do limite? SIM"
  ↓
Promoção fica ativa, preço atualizado no marketplace
  ↓
Finance rastreia: "Margem reduzida 15% em Produto X — impacto: -R$ 2000"
  ↓
Se Vendedor tentar 30% desconto:
  → 403 Forbidden: "Descontos acima de 20% precisam de aprovação.
    Solicitando a seu gerente..."
```

---

#### **6. Operações/Produção**

**Atos permitidos:**
- **Planejamento de Produção** (interno) — agenda de fabricação
- **Alerta de Qualidade** (interno) — defeito, retrabalho, parada
- **Agenda de Produção** (interno) — turnos, capacidade, manutenção
- **Procura Terceirizador** (B2B) — overflow de produção
- **Manutenção de Máquina** (interno) — parada programada, reparo

**Audiência permitida:**
- Equipe interna (coordenação produção)
- Estoque (entradas/saídas, planejamento)
- Fornecedores (terceirização)
- Manutenção (preventiva)

**Categoria econômica:**
- Planejamento: SOCIAL (coordenação)
- Alerta qualidade: SOCIAL (aviso)
- Terceirização: SAÍDA (empresa gasta com terceiro)
- Manutenção: SAÍDA (empresa investe em máquina)

**Limites de gasto:**
- Terceirização: até R$ 50.000
- Manutenção: até R$ 30.000
- Aprovação obrigatória acima de: R$ 20.000

---

### **Fluxo do Compositor Estruturado por Departamento**

**Cenário 1: Marina (Warehouse Manager) abre o Compositor**

```
1. SELETOR DE ATOR:
   "Representando: Empresa X (Departamento: Warehouse)"

2. CONFIRMAÇÃO DE PAPEL:
   "Seu papel: WAREHOUSE_MANAGER"
   
3. ENUMERAÇÃO DE ATOS:
   Backend responde: GET /composer/available-actions?dept=warehouse
   Mostra:
     ✓ Procurar Fornecedor
     ✓ Registrar Entrada de Produto
     ✓ Movimentação de Inventário
     ✓ Alerta de Stock Baixo
     ✗ Postar Vaga (invisível — isso é RH)
     ✗ Oferta de Produto (invisível — isso é Vendas)

4. CRIAÇÃO:
   Marina seleciona: "Procurar Fornecedor"
   Preenche:
     - Item: "Parafuso M10"
     - Quantidade: 1000
     - Orçamento: R$ 5000
     - Urgência: Normal
   
5. VERIFICAÇÃO (Backend):
     ✓ Marina pode criar "Procurar Fornecedor"? SIM
     ✓ Audiência B2B permitida? SIM
     ✓ Limite de R$ 50.000? SIM, sua requisição é R$ 5000
     ✓ Precisa aprovação? NÃO (abaixo de R$ 30.000)
   
6. GRAVA:
   warehouse_ledger {
     action: 'procura_fornecedor',
     amount: 500000,  # R$ 5000 em centavos
     department: 'warehouse',
     posted_by: marina_id,
     audience: 'b2b_privado',
     approval_required: false,
     status: 'ativa'
   }
   
   Finance recebe notificação (informacional, não bloqueadora)
```

**Cenário 2: João (RH Manager) abre o Compositor**

```
1. SELETOR DE ATOR:
   "Representando: Empresa X (Departamento: RH)"

2. CONFIRMAÇÃO DE PAPEL:
   "Seu papel: RH_MANAGER"
   
3. ENUMERAÇÃO DE ATOS:
   Backend responde: GET /composer/available-actions?dept=rh
   Mostra:
     ✓ Postar Vaga
     ✓ Treinamento Interno
     ✓ Comunicado de Política
     ✗ Procurar Fornecedor (invisível — isso é Warehouse)
     ✗ Oferta de Produto (invisível — isso é Vendas)

4. CRIAÇÃO:
   João seleciona: "Postar Vaga"
   Preenche:
     - Cargo: "Desenvolvedor Senior"
     - Salário: R$ 15.000/mês
     - Descrição: [...]
     - Audiência: Público Geral
   
5. VERIFICAÇÃO (Backend):
     ✓ João pode criar "Postar Vaga"? SIM
     ✓ Audiência Público permitida? SIM
     ✓ Limite de R$ 50.000? SIM, vaga é R$ 15.000
     ✓ Precisa aprovação? NÃO
   
6. GRAVA:
   company_ledger {
     action: 'vaga_criada',
     amount: 1500000,  # R$ 15.000/mês
     department: 'rh',
     posted_by: joao_id,
     audience: 'publico',
     approval_required: false,
     status: 'ativa'
   }
   
   Vaga aparece no marketplace UnifiCard
```

**Cenário 3: Marina tenta R$ 60.000 (acima do limite)**

```
4. CRIAÇÃO:
   Marina seleciona: "Procurar Fornecedor"
   Preenche:
     - Item: "Motor Industrial"
     - Orçamento: R$ 60.000
   
5. VERIFICAÇÃO (Backend):
     ✓ Marina pode criar "Procurar Fornecedor"? SIM
     ✓ Audiência B2B permitida? SIM
     ✗ Limite de R$ 50.000? NÃO — você quer R$ 60.000
     ✗ Precisa aprovação? SIM
   
6. RESPOSTA (403 + Instruções):
   "Sua requisição de R$ 60.000 excede o limite de R$ 50.000.
    
    Opções:
    (a) Reduzir para R$ 50.000 (máximo sem aprovação)
    (b) Solicitar aprovação a seu gerente Finance
    (c) Dividir em 2 requisições de R$ 30.000 cada (ambas precisam aprovação)
    
    Solicitando aprovação de Finance..."
   
   → Requisição entra em approval_queue
   → Finance é notificado (ação requerida)
   → Finance aprova/rejeita
```

---

### **Matriz de Permissões: Resumida**

| Departamento | Pode Criar | Audiência | Limite Base | Requer Aprovação Acima |
|---|---|---|---|---|
| **RH** | Vaga, Treinamento, Comunicado | Público, Interno, RH B2B | R$ 50.000 | R$ 50.000 |
| **Warehouse** | Procura Fornecedor, Entrada, Movimentação | B2B, Interno | R$ 50.000 | R$ 30.000 |
| **Finance** | Aprova Gasto, Negocia, Empréstimo | B2B, Interno, C-level | Ilimitado | Acima R$ 1.000.000 |
| **Admin** | Comunicado, Contrato, Conformidade | Público, Interno, B2B | R$ 50.000 | R$ 10.000 |
| **Vendas** | Oferta, Promoção, Proposta | Público, B2B, Cliente específico | Até 20% desconto | Acima 25% desconto |
| **Operações** | Planejamento, Alerta Qualidade, Terceirização | Interno, B2B | R$ 50.000 | R$ 20.000 |

---

### **Princípios Estruturais**

1. **Compositor muda de cara por departamento** — cada um vê APENAS seus atos
2. **Limites são por departamento, não genéricos** — RH tem limite diferente de Warehouse
3. **Aprovação é cascata** — Finance sempre aprova gastos acima de threshold
4. **Integração operacional é real** — requisição não é isolada, entra em fila, tem workflow
5. **SSOT do dinheiro é registrado por departamento** — rastreia quem gastou, quanto, com que autoridade
6. **Atos são estruturados, não livres** — você posta o que sua autoridade permite, não o que quer

---

**⚠️ NOTA DE REFINAMENTO:**

Essa estrutura é **esboço inicial**. Conforme a operação real do UnifiCard consolidar, será necessário:
- Validar se 6 departamentos são suficientes (ou se faltam: Marketing, Suporte ao Cliente, etc.)
- Refinar matriz de permissões com base em casos reais
- Definir se alguns atos devem estar em múltiplos departamentos
- Especificar workflows de aprovação (Finance > C-level? Em paralelo? Sequencial?)
- Mapear integrações com outros módulos (ledger, inventory, HR, sales)

Isso será refinado conforme **a primeira operação real** de empresa rodar no sistema.

---

## Caso de Uso Concreto: Pessoa Física em Fluxo de Entrada (Dinheiro Entra)

**O que uma Pessoa Física pode POSTAR quando está em fluxo de entrada (gerando receita)?**

1. **Oferta de Serviço** — seus próprios serviços (aula, conserto, consultoria). Ledger pessoal. Destino: público/segmentado.
2. **Venda de Produto** — seus próprios produtos (artesanato, foto, design). Ledger pessoal. Destino: público/segmentado.
3. **Evento** — workshop, aula, show que ela organiza. Ledger pessoal + impacto regional. Destino: público/convites.
4. **Agendamento** — sua disponibilidade (segunda 14-18h). Substrato de reserva. Destino: broadcast de slots.
5. **Post Social** — conteúdo, portfólio, experiência, update. Sem transação direta. Destino: rede social.
6. **Currículo** — suas habilidades, experiência, formação. **Substrato descobrível** — entra num índice de "quem pode fazer o quê na região".
7. **Candidatura a Vaga** — se vê uma vaga (postada por empresa ou outra PF), ela se candidata. Ato dela, não "tipo que posta".
8. **Projeto para Comunidade** — proposta de estrutura permanente ("quero organizar uma biblioteca no bairro"). Requer validação comunitária antes de executar.
9. **Enquete de Validação** — "vocês topam apoiar esse projeto?" (parte da jornada do projeto, não isolado).

**O eixo revolucionário — A Cadeia do Projeto:**

```
Ideia (Post Projeto)
  ↓ [actor cria, posta ideia]
Enquete (Validação de Interesse)
  ↓ [comunidade vota "topar?" — necessário quórum/maioria]
Votação (Deliberação Democrática)
  ↓ [se enquete passa, vai a votação formal de alocação]
Alocação de Fundo Regional (Recurso Real)
  ↓ [aprovado: dinheiro real é alocado ao projeto]
Grupo/Estrutura Criada (Execução)
  ↓ [actor vira operador de recurso regional, cria grupo]
```

**Por que isso é radicalmente diferente:**
- Uma pessoa física **sozinha, sem ter criado grupo antes**, pode postar uma ideia, validar interesse comunitário, ir a votação democrática e obter alocação de fundo regional.
- **Não precisa pedir permissão a ninguém.** É autogestão verdadeira: comunidade aprova, fundo flui, execução acontece.
- A pessoa vira **operadora de recurso público** legitimada por votação, não por cargo ou posição.

**Eixos aplicados à Cadeia do Projeto:**
- **Quem:** Pessoa Física (qualquer uma)
- **Contexto:** Governança Comunitária / Autogestão
- **Destino:** Broadcast pra população local (enquete e votação abertas)
- **Consequência:** Alocação de dinheiro real (fundo regional) + autoridade de executar
- **Ciclo de Vida:** Enquete (X dias) → Votação (Y dias) → Alocação → Execução contínua

---

## Lições Aprendidas (Dessa Conversa e das Anteriores)

- **Actor como unidade operacional soberana** é a fundação. Tudo mais é projeção dele.
- **Contexto muda a face, mas não a identidade.** Mesma pessoa em modo operador vs consumidor vs RH vs financeiro = mesma identidade econômica, mesma verdade de fundo.
- **Eixos são mais poderosos que enum de tipos.** Se você acerta os eixos, ganha combinatória infinita (nenhum novo "tipo" exige código novo, é só nova combinação de eixos).
- **Unificação significa zero fontes paralelas de verdade.** Cada domínio (RH, marketplace, governança, social) é uma face, não um sistema. Tudo aponta pro mesmo backend, mesmo ledger, mesma autoridade.
- **Economia descentralizada não é anarquia.** É **autogestão precisa**: cada região governa seu fundo, cada empresa governa suas permissões, cada ator governa seu perfil. Tudo visível, rastreável, transferível.
- **Projeto > Grupo, não Grupo > Projeto.** Uma pessoa comum pode gerar uma ideia que vira votação que aloca dinheiro (fluxo econômico real). Se houver apoio, daí cria a estrutura permanente (grupo). A legitimidade vem da votação, não da hierarquia.
- **Dinheiro dentro ou fora, não abstrações.** "Consumir" e "operar" são palavras tranquilas, mas o substrato é econômico: dinheiro sai do bolso, entra no bolso, ou é puro social? Esta pergunta determina autorização, ledger, imposto, visibilidade. A categoria econômica é mais fundamental que o tipo de ato.

---

## 🟡 Análise de Gaps Críticos (Para Refinamento por Outro Modelo)

**Status:** Documento está sólido em visão de alto nível, mas frágil em detalhes de implementação. Gaps abaixo precisam ser resolvidos antes da arquitetura de BD/API.

---

### **Gap 1: Tenancy Model Não Está Claro (🔴 CRÍTICA)**

**O Problema:**
- Um `user` pode representar múltiplos actors simultaneamente? (ex: João é Pessoa Física AND funcionário de Empresa X AND sócio de Empresa Y)
- Estrutura de dados: `users → actors → tenants` — qual é a relação exata?
- Quando João abre Compositor, como escolhe qual contexto atua?
- `tenantId` nas queries é sempre derivável de `actorId`, ou há ambiguidade?

**Impacto:** Sem entender a hierarquia, não dá pra desenhar schema do banco.

**Próxima etapa:** Desenhar diagrama ER claro de `global_users` → `actors` → `tenants` com exemplos concretos (João PF + funcionário + sócio).

---

### **Gap 2: Onboarding / Invitations — Fluxo Exato (🔴 CRÍTICA)**

**O Problema:**
- Quando uma empresa quer contratar novo funcionário: quem inicia o convite?
- Frontend posta "Vaga" → João se "candidata"? Ou RH convida direto?
- Quando João é aceito, como é criada relação `company_users(company_id, user_id, role)`?
- É imediato ou precisa de aprovação?
- **Quem cria a entrada no ledger?** "João foi adicionado à Empresa X como RH" — é um ato? Quem a cria?

**Impacto:** Primeiro ato de qualquer pessoa. Sem spec, não dá pra começar.

**Próxima etapa:** Documentar fluxo completo: Frontend invite → Backend accept → ledger entry → role ativado.

---

### **Gap 3: Ledger Architecture — Uma Tabela ou Múltiplas? (🔴 CRÍTICA)**

**O Problema:**
Documento menciona:
- `bank_transactions` (split)
- `group_ledger` (grupo)
- `warehouse_ledger` (warehouse)
- `company_ledger` (empresa)
- `channel_ledger` (canal)

**São tabelas separadas** (múltiplas SSOT?) **ou uma única tabela com `ledger_type` field?**

Se separadas:
- Como se queries "quanto eu ganhei em TUDO" atomicamente?
- Múltiplas "sources of truth" = violação de SSOT?

Se unificada:
- Schema fica complexo
- Mas SSOT garantida

**Impacto:** Decide toda a arquitetura de BD.

**Próxima etapa:** Propor schema PostgreSQL: 1 tabela `ledger_entries` com `type`, `actor_id`, `amount`, `category` ou múltiplas com `ledger_master` unificadora?

---

### **Gap 4: Snapshots de Permissão no Momento do Ato (🔴 CRÍTICA)**

**O Problema:**
- Marina posta Vaga de R$ 15.000 com `role=RH_MANAGER, limit=50k` em 2026-07-05
- Em 2026-08-05, Marina é rebaixada para `role=WAREHOUSE, limit=5k`
- **A vaga de R$ 15.000 fica válida ou é "revogada retroativamente"?**
- **Ledger precisa guardar:** `role_at_posting`, `limit_at_posting`, `permissions_snapshot`?

**Impacto:** Auditoria temporal — se Marina perder autoridade depois, seus atos de antes ainda são válidos? Resposta afeta ledger schema e auditoria.

**Próxima etapa:** Definir política: "Permissões são vinculadas ao MOMENTO do ato, snapshot é imutável no ledger."

---

### **Gap 5: Cascata de Aprovação — Rastreabilidade Completa (🔴 CRÍTICA)**

**O Problema:**
- Marina posta Vaga de R$ 60.000 (> limite R$ 50.000)
- Vai pra Finance em `approval_queue`
- Finance aprova
- **Quem aprova Finance?** Se aprovação > R$ 100.000, vai pra C-level?
- **Ledger entry criada:** Quando? (no POST de Marina ou no APPROVE de Finance?)
- **Rastreabilidade:** Marina requisitou (10:00) → Finance aprovou (10:30) → C-level não precisa — tudo no ledger?

**Impacto:** LGPD/auditoria exigem trilha completa. Sem spec, auditoria fica cega.

**Próxima etapa:** Especificar `approval_queue` schema + sequência de validações + como cada nível é registrado.

---

### **Gap 6: Governance/Voting — Quem Pode Votar? (🔴 CRÍTICA)**

**O Problema:**
- Pessoa Física posta Projeto ("Biblioteca comunitária no bairro X")
- Enquete: "Vocês topam?" — **quem pode responder?** (Todos? Só da região? Só interessados?)
- Votação: "Alocamos R$ 50.000?" — quem vota? (assembly regional?)
- **Ledger:** Cada voto é registrado? Anônimo ou rastreável?
- **Spam:** Como evita 1 pessoa votar 1000x?

**Impacto:** Votação é core de autogestão. Sem spec, todo o fluxo de Projeto é vago.

**Próxima etapa:** Spec de Governance — quórum, votantes elegíveis, anti-spam, audit trail de votos, decisão threshold.

---

### **Gap 7: Cross-Actor Workflows — Quem Cria Ledger Entry? (🔴 CRÍTICA)**

**O Problema:**
- RH posta Vaga. João se candidata.
- **Candidatura é "ato" de João?** (`POST /composer/action { type: "Candidatura", vaga_id }`)
- **Ou é efeito lateral?** (Vaga existe, João escreve em `candidates` table, sem ledger entry)
- Se for ato: quem autoriza João a fazer isso?
- **Ledger:** Quando criada? (no POST de candidatura ou no ACCEPT da candidatura?)

**Impacto:** Ambiguidade em "atos primários vs side effects" afeta design de workflows.

**Próxima etapa:** Desenhar matriz: quais eventos geram ledger entries vs não.

---

### **Gap 8: Tenancy Isolation / Cross-Tenant Security (🔴 CRÍTICA)**

**O Problema:**
- João (funcionário Empresa A) não consegue ver Empresa B?
- João não consegue votar em Projeto de outra região?
- Documento menciona `tenantId` em queries, mas **onde exatamente é validado?**
- **RLS (Row-Level Security):** quais tabelas, quais queries, quais edge cases?

**Impacto:** Breach isolacional = falha de segurança crítica.

**Próxima etapa:** Spec de RLS — por tabela, por operação (SELECT/INSERT/UPDATE/DELETE), edge cases.

---

### **Gap 9: Frontend Validation vs Backend Validation (🟠 ALTA)**

**O Problema:**
- Documento diz "Frontend nunca valida", mas na prática:
  - Frontend sabe limites pra mostrar "Limite: R$ 50.000"? (de quê? API? Cache?)
  - Frontend mostra "Promoção 15%" vs "Promoção 30%" — como sabe? (localStorage? API call cada um?)
- **Se frontend caches permissões:** violação de "nunca valida"
- **Se frontend chama API pra cada validação:** N+1, lento

**Impacto:** Caching policy resolve trade-off entre performance e SSOT.

**Próxima etapa:** Definir: quais dados podem ser cacheados (ex: role enumeration) vs nunca (ex: saldo).

---

### **Gap 10: Soft vs Hard Deletes — Auditoria (🟠 ALTA)**

**O Problema:**
- Vaga é criada, depois cancelada.
- **Deleted = true** (soft delete, auditável) **ou realmente deletado** (hard delete)?
- **Impacto ledger:** Marina criou vaga (R$ 15.000 gasto), cancelou — entra "débito reverso"?
- **Candidatos:** Status fica "candidatura_canceled_due_to_vaga_removal"?

**Impacto:** Auditoria exige soft deletes. Sem spec, histórico fica incompleto.

**Próxima etapa:** Política de deletions — soft vs hard, marques de "canceled_at", impacto em ledger, reversal logic.

---

### **Gap 11: Latency / Async — SSOT em Operação (🟠 ALTA)**

**O Problema:**
- Marina posta Vaga, entra em `approval_queue`, ela sai do app
- **Vaga é "live"** enquanto aguarda aprovação? (Finance vê candidaturas?)
- **Ou é "draft"** até aprovação?
- **SSOT:** Se é "draft", quantas versões existe? (Marina em draft, Finance vê draft, estão synced?)
- **Ledger:** Quando criada — no POST (Marina) ou no APPROVE (Finance)?

**Impacto:** Async workflows afetam latência, versionamento, consistency.

**Próxima etapa:** Spec de state machine para atos em approval — estados transitórios, quando ledger entry é criada.

---

### **Gap 12: Error Response Schema — UX (🟡 MÉDIA)**

**O Problema:**
- Marina tenta postar Vaga de R$ 60.000, backend retorna 403
- Frontend precisa diferenciar:
  - "Você NUNCA pode criar vagas" (educativo)
  - "Você pode, mas precisa aprovação" (actionable)
  - "Você excedeu limite, mas pode splittar em 2" (sugestivo)

**Impacto:** Sem spec de erro, UX fica genérica.

**Próxima etapa:** Desenhar error response schema: `{ code, message, reason, actionable_options, contact }`.

---

## **Matriz de Prioridade**

| Gap | Prioridade | Bloqueador Para | Responsável |
|-----|-----------|-----------------|-----------|
| Tenancy model | 🔴 CRÍTICA | BD schema, API design | Arquitetor |
| Onboarding flow | 🔴 CRÍTICA | First user journey | Product + Eng |
| Ledger architecture | 🔴 CRÍTICA | BD design, SSOT garantia | BD architect |
| Approval audit trail | 🔴 CRÍTICA | LGPD compliance | Compliance + Eng |
| Governance spec | 🔴 CRÍTICA | Projeto feature | Product |
| Tenancy RLS | 🔴 CRÍTICA | Security, BD layer | Security + BD |
| Cross-actor workflows | 🔴 CRÍTICA | Workflows design | Product + Eng |
| Frontend caching policy | 🟠 ALTA | Performance + SSOT | Eng + Frontend |
| Soft vs hard deletes | 🟠 ALTA | Auditoria, migrations | Eng |
| Latency / async | 🟠 ALTA | State machine design | Architect |
| Error schema | 🟡 MÉDIA | UX, API contract | Eng + Frontend |

---

**Próxima conversa:** investigar o substrato de permissões/roles que já existe vs. o que falta, desenhar a API do compositor pra garantir que nenhum tipo de ato cria fonte paralela de verdade, e resolver os 12 gaps acima com profundidade.
