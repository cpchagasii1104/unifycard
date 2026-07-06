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

**Próxima conversa:** investigar o substrato de permissões/roles que já existe vs. o que falta, e começar a desenhar a API do compositor pra garantir que nenhum tipo de ato cria fonte paralela de verdade.
