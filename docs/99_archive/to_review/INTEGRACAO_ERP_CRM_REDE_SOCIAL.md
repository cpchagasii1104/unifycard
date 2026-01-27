# INTEGRAÇÃO ERP/CRM COM EMPRESAS E REDE SOCIAL
## Visão Completa: Como transformar empresas em organizações inteligentes

**Data:** 11 de Janeiro de 2026  
**Visão:** ERP + CRM nativos que se conectam automaticamente à rede social  
**Status:** 25% estrutura básica - **75% falta implementar**  

---

## 🎯 CONCEITO REVOLUCIONÁRIO

### ERP/CRM não são sistemas separados

São **EXTENSÕES DA REDE SOCIAL** para empresas (Pages):

```
❌ ERPs tradicionais: Sistema isolado, interface complexa
✅ UnifyCard ERP: Tudo acontece no feed social da empresa

❌ CRMs tradicionais: Database de clientes separada
✅ UnifyCard CRM: Clientes são actors que interagem no feed

❌ Integração tradicional: APIs, webhooks, sincronização
✅ UnifyCard: Tudo é nativo, tempo real, automático
```

### Fluxo Natural

```
Cliente segue empresa no feed social
     ↓
Cliente comenta em post
     ↓
Sistema cria automaticamente registro CRM
     ↓
Cliente agenda serviço pelo feed
     ↓
Sistema cria automaticamente pedido de venda
     ↓
Empresa confirma e executa
     ↓
Sistema registra automaticamente no ERP
     ↓
Pagamento via MFI coins
     ↓
Split automático registrado no financeiro
     ↓
Relatórios em tempo real no dashboard
```

**TUDO sem sair do feed social!**

---

## ✅ ESTRUTURA ATUAL (25%)

### 1. EMPRESAS (Companies) ✅ 100%

**Tabela:** `companies`

```sql
companies (
  company_id UUID,
  global_user_id UUID, -- Dono da empresa
  
  -- Dados Legais
  cnpj VARCHAR(14),
  company_name TEXT,
  trade_name TEXT,
  registration_date DATE,
  
  -- Endereço
  cep, address, city, state, country,
  
  -- Contato
  phone, email, website,
  
  -- Atividade Econômica
  main_activity_code VARCHAR(10),
  main_activity_description TEXT,
  secondary_activities JSONB,
  
  -- Receita
  revenue_data JSONB,
  
  -- Status
  status VARCHAR(20), -- active, inactive, suspended, closed
  is_verified BOOLEAN,
  
  metadata JSONB
)
```

**Funcionalidades:**
- ✅ Cadastro completo de empresa
- ✅ Validação CNPJ
- ✅ Dados da Receita Federal
- ✅ Status de verificação

---

### 2. FUNCIONÁRIOS ✅ 100%

**Tabelas:** `company_employees`, `company_users`

```sql
company_employees (
  company_employee_id UUID,
  company_id UUID,
  global_user_id UUID,
  
  -- Período
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ, -- NULL = ativo
  
  -- Cargo
  role VARCHAR(20), -- owner, admin, manager, staff
  
  -- Permissões
  can_manage_schedule BOOLEAN,
  can_manage_services BOOLEAN,
  
  metadata JSONB
)

company_users (
  company_user_id UUID,
  company_id UUID,
  global_user_id UUID,
  
  -- Cargo
  role VARCHAR(50), -- owner, partner, director, manager, employee
  role_description TEXT,
  
  -- Permissões Granulares
  can_manage_company BOOLEAN,
  can_manage_financial BOOLEAN,
  can_manage_employees BOOLEAN,
  can_view_reports BOOLEAN,
  can_manage_services BOOLEAN,
  
  is_active BOOLEAN,
  is_primary BOOLEAN
)
```

**Funcionalidades:**
- ✅ Hierarquia organizacional
- ✅ Histórico de funcionários
- ✅ Permissões granulares
- ✅ Controle de acesso

---

### 3. EMPRESA COMO ACTOR ✅ 80%

**Sistema de Actors já suporta:**

```typescript
interface PageActor {
  actor_id: string;
  actor_type: 'page';
  company_id: string; // Vinculado à empresa
  
  // Capacidades
  capabilities: [
    'POST_CONTENT',      ✅
    'CREATE_EVENT',      ✅
    'CREATE_JOB',        ⚠️ Planejado
    'CREATE_PROJECT',    ✅
    'RECEIVE_FUNDS',     ✅
    'CREATE_CTA',        ✅
    'MANAGE_CONTENT'     ✅
  ];
  
  // Intents
  supportedIntents: [
    'OFFER_SERVICE',     ✅
    'OFFER_PRODUCT',     ⚠️ Parcial
    'ANNOUNCE_EVENT',    ✅
    'ANNOUNCE_JOB',      ❌
    'SEND_CTA'           ✅
  ];
}
```

**O que funciona:**
- ✅ Empresa pode postar no feed
- ✅ Empresa pode criar eventos
- ✅ Empresa pode oferecer serviços
- ✅ Empresa pode receber pagamentos
- ✅ Seguidores veem posts da empresa

---

## ❌ O QUE FALTA (75%)

### MÓDULO 1: CRM (Customer Relationship Management)

**Status:** 0% implementado

#### 1.1 Estrutura de Dados CRM

```sql
-- ============================================
-- CLIENTES (Baseado em Actors)
-- ============================================

CREATE TABLE crm_customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  -- Vinculação ao Actor
  actor_id UUID NOT NULL REFERENCES actors(actor_id),
  
  -- Origem do Cliente
  source VARCHAR(50), -- social_media, referral, direct, event, service
  source_reference_id UUID, -- ID do post, evento, etc
  
  -- Classificação
  customer_type VARCHAR(20) DEFAULT 'lead', 
    -- lead, prospect, customer, vip, inactive
  
  -- Lifecycle
  lifecycle_stage VARCHAR(20) DEFAULT 'awareness',
    -- awareness, consideration, decision, retention, advocacy
  
  -- Score
  engagement_score INTEGER DEFAULT 0, -- 0-100
  purchase_score INTEGER DEFAULT 0,   -- 0-100
  loyalty_score INTEGER DEFAULT 0,    -- 0-100
  
  -- Primeira interação
  first_contact_date TIMESTAMPTZ,
  first_contact_type VARCHAR(50), -- comment, message, follow, booking, purchase
  
  -- Última interação
  last_interaction_date TIMESTAMPTZ,
  last_interaction_type VARCHAR(50),
  
  -- Dados comerciais
  total_purchases INTEGER DEFAULT 0,
  total_revenue_cents INTEGER DEFAULT 0,
  average_ticket_cents INTEGER,
  
  -- Preferências (extraído automaticamente)
  preferred_categories JSONB DEFAULT '[]',
  preferred_products JSONB DEFAULT '[]',
  preferred_services JSONB DEFAULT '[]',
  
  -- Tags personalizadas
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INTERAÇÕES COM CLIENTES
-- ============================================

CREATE TABLE crm_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES crm_customers(customer_id),
  
  -- Tipo de interação
  interaction_type VARCHAR(50) NOT NULL,
    -- comment, message, follow, unfollow, like, share,
    -- booking, purchase, cancellation, complaint,
    -- event_attendance, service_rating, support_ticket
  
  -- Referência à ação original
  source_type VARCHAR(50), -- post, event, service, product, message
  source_id UUID,
  
  -- Conteúdo da interação
  content TEXT,
  sentiment VARCHAR(20), -- positive, neutral, negative (IA)
  
  -- Responsável pela empresa
  handled_by_user_id UUID REFERENCES global_users(global_user_id),
  
  -- Status (se aplicável)
  status VARCHAR(20), -- open, in_progress, resolved, closed
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PIPELINE DE VENDAS
-- ============================================

CREATE TABLE crm_pipelines (
  pipeline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Estágios do pipeline
  stages JSONB NOT NULL,
  -- [
  --   { name: "Lead", order: 1, probability: 10 },
  --   { name: "Qualificado", order: 2, probability: 30 },
  --   { name: "Proposta", order: 3, probability: 60 },
  --   { name: "Negociação", order: 4, probability: 80 },
  --   { name: "Fechado", order: 5, probability: 100 }
  -- ]
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE crm_deals (
  deal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES crm_pipelines(pipeline_id),
  customer_id UUID NOT NULL REFERENCES crm_customers(customer_id),
  
  -- Informações do deal
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Estágio atual
  current_stage VARCHAR(100) NOT NULL,
  current_stage_order INTEGER,
  probability INTEGER, -- 0-100
  
  -- Valor
  estimated_value_cents INTEGER,
  final_value_cents INTEGER,
  
  -- Datas
  expected_close_date DATE,
  closed_date DATE,
  
  -- Responsável
  owner_user_id UUID REFERENCES global_users(global_user_id),
  
  -- Origem
  source VARCHAR(50), -- social_post, event, referral, inbound
  source_id UUID,
  
  -- Status
  status VARCHAR(20) DEFAULT 'open', -- open, won, lost, cancelled
  lost_reason TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUTOMAÇÕES CRM
-- ============================================

CREATE TABLE crm_automations (
  automation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Trigger
  trigger_type VARCHAR(50) NOT NULL,
    -- new_follower, new_comment, new_purchase, 
    -- interaction_score_threshold, days_since_last_interaction
  trigger_config JSONB NOT NULL,
  
  -- Ações
  actions JSONB NOT NULL,
  -- [
  --   { type: "send_message", template_id: "..." },
  --   { type: "add_tag", tag: "engaged" },
  --   { type: "move_to_stage", stage: "qualified" },
  --   { type: "create_task", assignee: "..." }
  -- ]
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TAREFAS / FOLLOW-UPS
-- ============================================

CREATE TABLE crm_tasks (
  task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  
  -- Relacionamento
  customer_id UUID REFERENCES crm_customers(customer_id),
  deal_id UUID REFERENCES crm_deals(deal_id),
  
  -- Tarefa
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50), -- call, email, meeting, follow_up, reminder
  
  -- Responsável
  assigned_to_user_id UUID REFERENCES global_users(global_user_id),
  
  -- Prazo
  due_date TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  
  -- Conclusão
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID,
  completion_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

#### 1.2 Integração CRM ↔ Feed Social

**Automação total:**

```typescript
// ==========================================
// QUANDO ALGUÉM SEGUE A EMPRESA
// ==========================================

async function onUserFollowsCompany(
  companyActorId: string,
  followerActorId: string
) {
  // 1. Criar/atualizar registro CRM
  const customer = await crmService.upsertCustomer({
    companyId: company.id,
    actorId: followerActorId,
    source: 'social_media',
    customerType: 'lead',
    lifecycleStage: 'awareness',
    firstContactType: 'follow'
  });
  
  // 2. Registrar interação
  await crmService.createInteraction({
    customerId: customer.id,
    interactionType: 'follow',
    sentiment: 'positive'
  });
  
  // 3. Incrementar engagement score
  await crmService.updateCustomerScore(customer.id, {
    engagementScore: +10
  });
  
  // 4. Verificar automações
  await crmService.checkAutomations(customer.id, 'new_follower');
  
  // 5. Criar tarefa automática (se configurado)
  if (company.settings.autoTaskOnNewFollower) {
    await crmService.createTask({
      customerId: customer.id,
      title: `Follow-up novo seguidor: ${follower.name}`,
      taskType: 'follow_up',
      assignedTo: company.salesManagerId,
      dueDate: addDays(new Date(), 2)
    });
  }
}

// ==========================================
// QUANDO ALGUÉM COMENTA EM POST
// ==========================================

async function onUserCommentsOnPost(
  postId: string,
  comment: Comment
) {
  const post = await getPost(postId);
  const company = await getCompany(post.actorId);
  
  // 1. Registrar interação
  const customer = await crmService.upsertCustomer({
    companyId: company.id,
    actorId: comment.authorId,
    source: 'social_media',
    sourceReferenceId: postId
  });
  
  await crmService.createInteraction({
    customerId: customer.id,
    interactionType: 'comment',
    sourceType: 'post',
    sourceId: postId,
    content: comment.text,
    sentiment: await analyzeSentiment(comment.text) // IA
  });
  
  // 2. Atualizar scores
  await crmService.updateCustomerScore(customer.id, {
    engagementScore: +5,
    lifecycleStage: 'consideration' // Evoluir estágio
  });
  
  // 3. Se comentário negativo, criar alerta
  if (sentiment === 'negative') {
    await crmService.createTask({
      customerId: customer.id,
      title: `URGENTE: Comentário negativo de ${customer.name}`,
      taskType: 'customer_support',
      assignedTo: company.supportManagerId,
      dueDate: addHours(new Date(), 2) // 2h para responder
    });
  }
}

// ==========================================
// QUANDO ALGUÉM AGENDA SERVIÇO
// ==========================================

async function onServiceBookingCreated(
  booking: ServiceBooking
) {
  const service = await getService(booking.serviceId);
  const company = await getCompanyByService(service.id);
  
  // 1. Atualizar cliente para "customer"
  const customer = await crmService.upsertCustomer({
    companyId: company.id,
    actorId: booking.bookedByActorId,
    customerType: 'customer', // Agora é cliente de fato!
    lifecycleStage: 'decision'
  });
  
  // 2. Registrar interação
  await crmService.createInteraction({
    customerId: customer.id,
    interactionType: 'booking',
    sourceType: 'service',
    sourceId: service.id
  });
  
  // 3. Criar deal automaticamente
  const deal = await crmService.createDeal({
    customerId: customer.id,
    pipelineId: company.defaultPipelineId,
    title: `Agendamento: ${service.title}`,
    currentStage: 'Fechado',
    estimatedValueCents: service.priceCents,
    status: 'won',
    source: 'service_booking',
    sourceId: booking.id
  });
  
  // 4. Atualizar histórico comercial
  await crmService.updateCustomer(customer.id, {
    totalPurchases: customer.totalPurchases + 1,
    totalRevenueCents: customer.totalRevenueCents + service.priceCents,
    lastInteractionType: 'booking'
  });
}

// ==========================================
// QUANDO PAGAMENTO É RECEBIDO
// ==========================================

async function onPaymentReceived(
  payment: Payment
) {
  const customer = await crmService.getCustomerByActorId(
    payment.fromActorId
  );
  
  // 1. Atualizar histórico financeiro
  await crmService.updateCustomer(customer.id, {
    totalRevenueCents: customer.totalRevenueCents + payment.amountCents,
    lastInteractionType: 'purchase',
    lastInteractionDate: new Date()
  });
  
  // 2. Atualizar loyalty score
  const newLoyaltyScore = calculateLoyaltyScore({
    totalPurchases: customer.totalPurchases,
    totalRevenue: customer.totalRevenueCents,
    daysSinceFirstPurchase: daysBetween(
      customer.firstContactDate,
      new Date()
    )
  });
  
  await crmService.updateCustomerScore(customer.id, {
    loyaltyScore: newLoyaltyScore,
    purchaseScore: +20
  });
  
  // 3. Verificar se cliente virou VIP
  if (newLoyaltyScore > 80) {
    await crmService.updateCustomer(customer.id, {
      customerType: 'vip',
      tags: [...customer.tags, 'vip']
    });
    
    // Notificar equipe
    await notifyTeam({
      type: 'new_vip_customer',
      customer: customer
    });
  }
}
```

---

#### 1.3 Dashboard CRM no Feed

**Interface no feed social da empresa:**

```tsx
<CompanyFeed actorType="page">
  {/* Sidebar esquerda - Métricas CRM */}
  <LeftSidebar>
    <CRMQuickStats>
      <Stat>
        <Label>Clientes Ativos</Label>
        <Value>{stats.activeCustomers}</Value>
        <Change positive>+12% este mês</Change>
      </Stat>
      
      <Stat>
        <Label>Leads</Label>
        <Value>{stats.leads}</Value>
        <Change>{stats.leadsChange}% este mês</Change>
      </Stat>
      
      <Stat>
        <Label>Taxa Conversão</Label>
        <Value>{stats.conversionRate}%</Value>
        <Change positive>+5% este mês</Change>
      </Stat>
      
      <Stat>
        <Label>Ticket Médio</Label>
        <Value>R$ {stats.avgTicket}</Value>
      </Stat>
    </CRMQuickStats>
    
    <CRMPipelineWidget>
      <PipelineStage stage="Lead" count={23} />
      <PipelineStage stage="Qualificado" count={15} />
      <PipelineStage stage="Proposta" count={8} />
      <PipelineStage stage="Fechado" count={12} />
    </CRMPipelineWidget>
    
    <CRMTasksWidget>
      <TasksList>
        <Task urgent>
          ⚠️ Follow-up João Silva (vence hoje)
        </Task>
        <Task>
          📞 Ligar para Maria Santos
        </Task>
        <Task>
          📧 Enviar proposta para Pedro
        </Task>
      </TasksList>
      <Button onClick={() => navigate('/crm/tasks')}>
        Ver Todas
      </Button>
    </CRMTasksWidget>
  </LeftSidebar>
  
  {/* Feed Central - Com contexto CRM */}
  <CentralFeed>
    {feedItems.map(item => {
      // Cada post mostra info CRM do autor
      const customer = getCRMCustomer(item.authorId);
      
      return (
        <PostCard post={item}>
          {/* Badge CRM */}
          {customer && (
            <CustomerBadge>
              {customer.type === 'vip' && '⭐ Cliente VIP'}
              {customer.type === 'customer' && '✅ Cliente'}
              {customer.type === 'lead' && '🎯 Lead'}
              
              <CustomerQuickInfo>
                💰 {customer.totalPurchases} compras
                📊 Score: {customer.engagementScore}
              </CustomerQuickInfo>
            </CustomerBadge>
          )}
          
          {/* Ações CRM rápidas */}
          <CRMQuickActions>
            <Button onClick={() => viewCustomerProfile(customer.id)}>
              Ver Perfil CRM
            </Button>
            <Button onClick={() => createTask(customer.id)}>
              Criar Tarefa
            </Button>
            <Button onClick={() => moveToStage(customer.id)}>
              Mover no Pipeline
            </Button>
          </CRMQuickActions>
        </PostCard>
      );
    })}
  </CentralFeed>
  
  {/* Sidebar direita - Insights */}
  <RightSidebar>
    <CustomerInsights>
      <Insight>
        🔥 Top Cliente: João Silva
        R$ 12.450 em compras
      </Insight>
      
      <Insight warning>
        ⚠️ 5 clientes sem interação há 30+ dias
      </Insight>
      
      <Insight>
        🎯 3 leads prontos para abordagem
      </Insight>
    </CustomerInsights>
    
    <AIRecommendations>
      <Recommendation>
        💡 Sugestão: Criar campanha para 
        clientes inativos (23 pessoas)
      </Recommendation>
      
      <Recommendation>
        💡 João Silva tem padrão de compra 
        mensal. Enviar oferta hoje!
      </Recommendation>
    </AIRecommendations>
  </RightSidebar>
</CompanyFeed>
```

---

### MÓDULO 2: ERP (Enterprise Resource Planning)

**Status:** 10% estrutura básica

#### 2.1 Estrutura de Dados ERP

```sql
-- ============================================
-- PRODUTOS / SERVIÇOS
-- ============================================

-- JÁ EXISTE: services table
-- FALTA: Expandir para produtos físicos completo

CREATE TABLE erp_products (
  product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  -- Informações básicas
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Categoria
  category_id UUID,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Tipo
  product_type VARCHAR(20), -- physical, digital, service
  
  -- Preço
  cost_price_cents INTEGER, -- Custo
  sale_price_cents INTEGER NOT NULL, -- Preço de venda
  margin_percent NUMERIC(5,2), -- Margem
  
  -- Estoque (se físico)
  track_inventory BOOLEAN DEFAULT true,
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER, -- Estoque mínimo
  max_stock INTEGER, -- Estoque máximo
  
  -- Unidade
  unit VARCHAR(20) DEFAULT 'un', -- un, kg, l, m, etc
  
  -- Fornecedor
  supplier_id UUID,
  supplier_product_code VARCHAR(100),
  
  -- Impostos
  tax_rate NUMERIC(5,2), -- % de imposto
  ncm VARCHAR(8), -- NCM (produtos)
  
  -- Dimensões (se físico)
  weight_grams INTEGER,
  length_cm INTEGER,
  width_cm INTEGER,
  height_cm INTEGER,
  
  -- Imagens
  images JSONB DEFAULT '[]',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ESTOQUE
-- ============================================

CREATE TABLE erp_inventory_movements (
  movement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES erp_products(product_id),
  
  -- Tipo de movimentação
  movement_type VARCHAR(20) NOT NULL,
    -- purchase (compra), sale (venda), 
    -- adjustment (ajuste), return (devolução),
    -- transfer (transferência)
  
  -- Quantidade
  quantity INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  
  -- Valor unitário (no momento da movimentação)
  unit_cost_cents INTEGER,
  
  -- Referência
  reference_type VARCHAR(50), -- sales_order, purchase_order, adjustment
  reference_id UUID,
  
  -- Responsável
  created_by_user_id UUID REFERENCES global_users(global_user_id),
  
  -- Notas
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PEDIDOS DE VENDA
-- ============================================

CREATE TABLE erp_sales_orders (
  sales_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  -- Número do pedido (gerado automaticamente)
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Cliente
  customer_id UUID REFERENCES crm_customers(customer_id),
  customer_actor_id UUID NOT NULL,
  
  -- Origem
  source VARCHAR(50), -- feed_social, marketplace, direct, event
  source_reference_id UUID, -- ID do post, booking, etc
  
  -- Itens (denormalizado para performance)
  items JSONB NOT NULL,
  -- [
  --   {
  --     product_id: "...",
  --     sku: "...",
  --     name: "...",
  --     quantity: 2,
  --     unit_price_cents: 5000,
  --     subtotal_cents: 10000,
  --     discount_cents: 0,
  --     total_cents: 10000
  --   }
  -- ]
  
  -- Valores
  subtotal_cents INTEGER NOT NULL,
  discount_cents INTEGER DEFAULT 0,
  shipping_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,
  
  -- Pagamento
  payment_method VARCHAR(50), -- mfi_coins, credit_card, pix, boleto
  payment_status VARCHAR(20) DEFAULT 'pending',
    -- pending, paid, partially_paid, failed, refunded
  payment_id UUID, -- Referência ao pagamento
  
  -- Entrega
  shipping_address JSONB,
  shipping_method VARCHAR(50),
  shipping_tracking_code VARCHAR(100),
  estimated_delivery_date DATE,
  delivered_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',
    -- pending, confirmed, processing, shipped, delivered, 
    -- cancelled, refunded
  
  -- Datas
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Responsável
  created_by_user_id UUID,
  confirmed_by_user_id UUID,
  
  -- Notas
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- COMPRAS / FORNECEDORES
-- ============================================

CREATE TABLE erp_suppliers (
  supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  name VARCHAR(255) NOT NULL,
  cnpj_cpf VARCHAR(14),
  
  -- Contato
  contact_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Endereço
  address JSONB,
  
  -- Condições
  payment_terms VARCHAR(100), -- À vista, 30 dias, etc
  delivery_time_days INTEGER,
  
  -- Avaliação
  rating NUMERIC(3,2), -- 0-5
  is_active BOOLEAN DEFAULT true,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE erp_purchase_orders (
  purchase_order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES erp_suppliers(supplier_id),
  
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Itens
  items JSONB NOT NULL,
  
  -- Valores
  subtotal_cents INTEGER NOT NULL,
  tax_cents INTEGER DEFAULT 0,
  shipping_cents INTEGER DEFAULT 0,
  total_cents INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',
    -- pending, confirmed, partially_received, received, cancelled
  
  -- Datas
  expected_delivery_date DATE,
  received_at TIMESTAMPTZ,
  
  created_by_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FINANCEIRO
-- ============================================

CREATE TABLE erp_financial_accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(company_id),
  
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
    -- checking_account, savings_account, cash, 
    -- credit_card, mfi_wallet
  
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  
  -- Saldo
  current_balance_cents INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE erp_financial_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES erp_financial_accounts(account_id),
  
  -- Tipo
  transaction_type VARCHAR(20) NOT NULL, -- income, expense, transfer
  
  -- Categoria
  category VARCHAR(100), -- sales, purchases, payroll, rent, etc
  
  -- Valor
  amount_cents INTEGER NOT NULL,
  
  -- Descrição
  description TEXT NOT NULL,
  
  -- Referência (vinculado a pedidos, pagamentos, etc)
  reference_type VARCHAR(50),
  reference_id UUID,
  
  -- Data
  transaction_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, cleared, reconciled
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RELATÓRIOS / ANALYTICS
-- ============================================

CREATE TABLE erp_reports_cache (
  report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  
  report_type VARCHAR(50) NOT NULL,
    -- daily_sales, monthly_revenue, top_products,
    -- customer_lifetime_value, inventory_turnover,
    -- profit_margin, cashflow
  
  -- Período
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Dados do relatório (cache)
  report_data JSONB NOT NULL,
  
  -- Metadados
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);
```

---

#### 2.2 Integração ERP ↔ Feed Social

**Fluxo automático:**

```typescript
// ==========================================
// QUANDO POST DE PRODUTO É CRIADO NO FEED
// ==========================================

async function onProductPostCreated(post: Post) {
  const company = await getCompany(post.actorId);
  
  // Extrair dados do produto do post
  const productData = post.intentMetadata;
  
  // 1. Criar/atualizar produto no ERP
  const product = await erpService.upsertProduct({
    companyId: company.id,
    name: productData.title,
    description: post.content,
    salePriceCents: productData.priceCents,
    images: post.media,
    sku: await generateSKU(company.id),
    productType: 'physical'
  });
  
  // 2. Vincular post ao produto
  await socialService.updatePost(post.id, {
    intentMetadata: {
      ...productData,
      productId: product.id
    }
  });
  
  // 3. Atualizar estoque inicial (se informado)
  if (productData.initialStock) {
    await erpService.createInventoryMovement({
      productId: product.id,
      movementType: 'adjustment',
      quantity: productData.initialStock,
      notes: 'Estoque inicial - produto adicionado via feed'
    });
  }
}

// ==========================================
// QUANDO ALGUÉM COMPRA DO FEED
// ==========================================

async function onPurchaseFromFeed(
  postId: string,
  buyerActorId: string,
  items: CartItem[]
) {
  const post = await getPost(postId);
  const company = await getCompany(post.actorId);
  
  // 1. Criar pedido de venda no ERP
  const salesOrder = await erpService.createSalesOrder({
    companyId: company.id,
    customerActorId: buyerActorId,
    source: 'feed_social',
    sourceReferenceId: postId,
    items: items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: item.priceCents
    })),
    paymentMethod: 'mfi_coins'
  });
  
  // 2. Processar pagamento MFI
  const payment = await economyService.processPayment({
    fromActorId: buyerActorId,
    toActorId: post.actorId,
    amountCents: salesOrder.totalCents,
    description: `Pedido #${salesOrder.orderNumber}`,
    metadata: {
      salesOrderId: salesOrder.id
    }
  });
  
  // 3. Atualizar pedido com pagamento
  await erpService.updateSalesOrder(salesOrder.id, {
    paymentId: payment.id,
    paymentStatus: 'paid',
    status: 'confirmed',
    confirmedAt: new Date()
  });
  
  // 4. Baixar estoque automaticamente
  for (const item of items) {
    await erpService.createInventoryMovement({
      productId: item.productId,
      movementType: 'sale',
      quantity: -item.quantity, // Negativo = saída
      referenceType: 'sales_order',
      referenceId: salesOrder.id,
      unitCostCents: item.priceCents
    });
  }
  
  // 5. Registrar no financeiro
  await erpService.createFinancialTransaction({
    companyId: company.id,
    accountId: company.mfiWalletAccountId,
    transactionType: 'income',
    category: 'sales',
    amountCents: salesOrder.totalCents,
    description: `Venda via feed - Pedido #${salesOrder.orderNumber}`,
    referenceType: 'sales_order',
    referenceId: salesOrder.id,
    transactionDate: new Date()
  });
  
  // 6. Criar notificação no feed da empresa
  await socialService.createNotification({
    actorId: company.actorId,
    type: 'new_sale',
    title: 'Nova venda! 🎉',
    message: `Pedido #${salesOrder.orderNumber} - R$ ${salesOrder.totalCents/100}`,
    actionUrl: `/erp/orders/${salesOrder.id}`
  });
  
  // 7. Criar tarefa de envio (se produto físico)
  if (salesOrder.shippingRequired) {
    await erpService.createShippingTask({
      salesOrderId: salesOrder.id,
      assignedTo: company.shippingManagerId,
      dueDate: addDays(new Date(), 2)
    });
  }
}

// ==========================================
// ALERTA DE ESTOQUE BAIXO
// ==========================================

async function checkLowStockAlerts() {
  const products = await erpService.getProductsWithLowStock();
  
  for (const product of products) {
    const company = await getCompany(product.companyId);
    
    // 1. Criar notificação no feed da empresa
    await socialService.createNotification({
      actorId: company.actorId,
      type: 'low_stock_alert',
      title: '⚠️ Estoque baixo!',
      message: `${product.name} - Restam apenas ${product.currentStock} ${product.unit}`,
      actionUrl: `/erp/products/${product.id}`
    });
    
    // 2. Criar sugestão automática de recompra
    const suggestedQuantity = product.maxStock - product.currentStock;
    
    await erpService.createPurchaseSuggestion({
      productId: product.id,
      supplierId: product.supplierId,
      suggestedQuantity,
      reason: 'low_stock'
    });
  }
}
```

---

#### 2.3 Dashboard ERP no Feed

```tsx
<CompanyERPDashboard>
  {/* KPIs Principais */}
  <ERPMetrics>
    <Metric>
      <Label>Vendas Hoje</Label>
      <Value>R$ {metrics.salesToday}</Value>
      <Change positive>+15% vs ontem</Change>
    </Metric>
    
    <Metric>
      <Label>Pedidos Pendentes</Label>
      <Value>{metrics.pendingOrders}</Value>
      <Action onClick={() => navigate('/erp/orders?status=pending')}>
        Ver
      </Action>
    </Metric>
    
    <Metric>
      <Label>Estoque Baixo</Label>
      <Value warning>{metrics.lowStockProducts}</Value>
      <Action onClick={() => navigate('/erp/inventory/low-stock')}>
        Reabastecer
      </Action>
    </Metric>
    
    <Metric>
      <Label>Margem Média</Label>
      <Value>{metrics.avgMargin}%</Value>
    </Metric>
  </ERPMetrics>
  
  {/* Gráfico de Vendas */}
  <SalesChart>
    <LineChart data={salesData}>
      <Line dataKey="revenue" stroke="#4CAF50" />
      <Line dataKey="orders" stroke="#2196F3" />
    </LineChart>
  </SalesChart>
  
  {/* Produtos mais vendidos */}
  <TopProducts>
    <ProductRank rank={1} product="Camiseta Básica" sales={45} />
    <ProductRank rank={2} product="Calça Jeans" sales={32} />
    <ProductRank rank={3} product="Tênis Esportivo" sales={28} />
  </TopProducts>
  
  {/* Alertas */}
  <ERPAlerts>
    <Alert type="warning">
      ⚠️ 3 produtos com estoque baixo
    </Alert>
    <Alert type="info">
      💡 5 pedidos prontos para envio
    </Alert>
    <Alert type="success">
      ✅ Faturamento da semana: R$ 12.450
    </Alert>
  </ERPAlerts>
</CompanyERPDashboard>
```

---

### INTEGRAÇÃO COMPLETA: CRM + ERP + FEED

**Visão 360º do cliente:**

```tsx
<CustomerProfileInFeed customerId="abc">
  {/* Dados CRM */}
  <CRMSection>
    <CustomerHeader>
      <Avatar src={customer.avatar} />
      <n>{customer.name}</n>
      <Badge>{customer.type}</Badge> {/* VIP, Cliente, Lead */}
    </CustomerHeader>
    
    <CustomerStats>
      <Stat label="Engajamento" value={customer.engagementScore} />
      <Stat label="Compras" value={customer.purchaseScore} />
      <Stat label="Lealdade" value={customer.loyaltyScore} />
    </CustomerStats>
    
    <CustomerTimeline>
      {customer.interactions.map(interaction => (
        <TimelineItem>
          {formatInteraction(interaction)}
        </TimelineItem>
      ))}
    </CustomerTimeline>
  </CRMSection>
  
  {/* Dados ERP (Financeiro) */}
  <ERPSection>
    <PurchaseHistory>
      <PurchaseItem>
        <Date>10/01/2026</Date>
        <Order>#1234</Order>
        <Items>2 produtos</Items>
        <Total>R$ 150,00</Total>
        <Status>Entregue</Status>
      </PurchaseItem>
    </PurchaseHistory>
    
    <FinancialSummary>
      <Stat>
        <Label>Total Gasto</Label>
        <Value>R$ {customer.totalRevenue}</Value>
      </Stat>
      <Stat>
        <Label>Ticket Médio</Label>
        <Value>R$ {customer.avgTicket}</Value>
      </Stat>
      <Stat>
        <Label>Última Compra</Label>
        <Value>{formatDate(customer.lastPurchase)}</Value>
      </Stat>
    </FinancialSummary>
  </ERPSection>
  
  {/* Ações Rápidas */}
  <QuickActions>
    <Button onClick={() => sendMessage(customer.id)}>
      💬 Enviar Mensagem
    </Button>
    <Button onClick={() => createOffer(customer.id)}>
      🎁 Criar Oferta Personalizada
    </Button>
    <Button onClick={() => scheduleTask(customer.id)}>
      📅 Agendar Follow-up
    </Button>
  </QuickActions>
  
  {/* Recomendações IA */}
  <AIInsights>
    <Insight>
      💡 Cliente compra todo dia 15. 
      Envie oferta hoje!
    </Insight>
    <Insight>
      🎯 Padrão de compra: produtos premium.
      Sugerir linha VIP.
    </Insight>
  </AIInsights>
</CustomerProfileInFeed>
```

---

## 🚀 ROADMAP COMPLETO

### Fase 1: CRM Básico (6 semanas)

**Semana 1-2: Backend CRM**
- [ ] Tabelas crm_customers, crm_interactions
- [ ] APIs CRUD
- [ ] Integração automática com feed social

**Semana 3-4: Pipeline e Deals**
- [ ] Tabelas crm_pipelines, crm_deals
- [ ] Kanban de vendas
- [ ] Movimentação de stages

**Semana 5: Automações**
- [ ] crm_automations
- [ ] Triggers automáticos
- [ ] Tasks automáticas

**Semana 6: Dashboard CRM**
- [ ] Interface no feed
- [ ] Métricas em tempo real
- [ ] Relatórios básicos

### Fase 2: ERP Básico (8 semanas)

**Semana 7-8: Produtos e Estoque**
- [ ] erp_products
- [ ] erp_inventory_movements
- [ ] Alertas de estoque

**Semana 9-10: Pedidos de Venda**
- [ ] erp_sales_orders
- [ ] Integração com pagamentos MFI
- [ ] Baixa automática de estoque

**Semana 11-12: Fornecedores e Compras**
- [ ] erp_suppliers
- [ ] erp_purchase_orders
- [ ] Sugestões de recompra

**Semana 13-14: Financeiro**
- [ ] erp_financial_accounts
- [ ] erp_financial_transactions
- [ ] Reconciliação bancária

**Semana 15-16: Dashboard ERP**
- [ ] Interface no feed
- [ ] Gráficos e KPIs
- [ ] Relatórios

### Fase 3: Integração Avançada (4 semanas)

**Semana 17-18: Analytics Unificado**
- [ ] Dashboard 360º
- [ ] Visão cliente completa (CRM + ERP)
- [ ] BI básico

**Semana 19-20: Automações Avançadas**
- [ ] IA para recomendações
- [ ] Previsão de demanda
- [ ] Alertas inteligentes

**TOTAL: 20 semanas (~5 meses)**

---

## 🏆 DIFERENCIAL COMPETITIVO

### UnifyCard vs ERPs/CRMs tradicionais

| Feature | SAP | Salesforce | Totvs | **UnifyCard** |
|---------|-----|------------|-------|---------------|
| **Interface** | Desktop | Web separada | Desktop | ✅ **No feed social** |
| **CRM Social** | ❌ | ⚠️ Plugin | ❌ | ✅ **Nativo** |
| **Venda direto feed** | ❌ | ❌ | ❌ | ✅ **Sim** |
| **Cliente = Actor** | ❌ | ❌ | ❌ | ✅ **Sim** |
| **Economia integrada** | ❌ | ❌ | ❌ | ✅ **MFI Coins** |
| **Setup** | Meses | Semanas | Meses | ✅ **Minutos** |
| **Custo** | R$ 500-2000/mês | R$ 300-1500/mês | R$ 200-1000/mês | ✅ **R$ 0-100/mês** |
| **Mobile First** | ❌ | ⚠️ | ❌ | ✅ **Sim** |
| **Automação Social** | ❌ | ⚠️ | ❌ | ✅ **Total** |

**Veredito:** UnifyCard = **ERP + CRM + Rede Social em UM só lugar**

---

## ✅ CONCLUSÃO

### Status Atual
- Estrutura empresas: ✅ 100%
- Funcionários: ✅ 100%
- Company como Actor: ✅ 80%
- CRM: ❌ 0%
- ERP: ⚠️ 10%
- Integração feed: ⚠️ 25%

### O que vai REVOLUCIONAR

**1. CRM que nasce do feed social**
- Qualquer interação vira registro CRM automaticamente
- Scores calculados em tempo real
- Pipeline atualizado automaticamente

**2. ERP que vive no feed**
- Vender produto direto do post
- Estoque atualizado em tempo real
- Financeiro integrado com MFI coins

**3. Zero fricção**
- Cliente não sai do feed
- Empresa não sai do feed
- Tudo automático

**4. Preço imbatível**
- ERPs custam R$ 500-2000/mês
- UnifyCard pode ser R$ 0-100/mês
- ROI imediato

### Investimento vs Retorno

**Investimento:** 5 meses desenvolvimento  
**Retorno:** ERP/CRM que ninguém tem no mercado  

**Com este sistema:**
- Qualquer empresa pode ter ERP/CRM profissional
- Integrado nativamente à rede social
- Sem custo proibitivo
- Sem curva de aprendizado

**ESTE MÓDULO PODE VALER BILHÕES!** 💰

Empresas pagariam por um sistema onde:
- Clientes estão na rede social
- Vendas acontecem no feed
- Gestão é automática
- Custo é mínimo

**RECOMENDAÇÃO: PRIORIZAR ESTE MÓDULO!** 🚀

---

**Autor:** Sistema de Auditoria UnifyCard  
**Data:** 11/01/2026  
**Versão:** 1.0
