# RELATÓRIO DE AUDITORIA E PLANEJAMENTO TÉCNICO - UNIFYCARD

**Data:** 17 de Dezembro de 2025  
**Versão:** 1.0  
**Auditor:** Claude (Anthropic)  
**Escopo:** Auditoria completa do sistema + Planejamento de novos requisitos

---

## 1. RESUMO EXECUTIVO

### Visão Geral
O Unificard é um projeto ambicioso e bem estruturado que implementa um "Sistema Operacional de Sociedade" - uma plataforma multi-tenant para transformação de economias locais. O sistema já possui uma base sólida com arquitetura modular, separação clara entre core e módulos de negócio, e um modelo econômico sofisticado com split de pagamentos configurável.

### Métricas Atuais
| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript (Backend) | 429 |
| Linhas de Código (Backend) | ~63.900 |
| Linhas de Código (Frontend) | ~11.500 |
| Migrations SQL | 56 |
| Módulos Core | 24 |
| Módulos Business | 10 |
| APIs/Routes | ~350+ |

### Pontuação Geral
- **Arquitetura:** 8.5/10 (excelente separação de concerns, alguns acoplamentos a resolver)
- **Segurança:** 7.5/10 (boa base, precisa de hardening em alguns pontos)
- **Escalabilidade:** 8/10 (multi-tenant sólido, cache pode melhorar)
- **Manutenibilidade:** 7/10 (dívidas técnicas identificadas, documentação boa)
- **Completude:** 6.5/10 (UnifyWork 100%, outros módulos parciais)

### Decisão Principal
**NÃO RECOMEÇAR DO ZERO.** O sistema tem fundamentos sólidos. O trabalho deve ser de consolidação, correção de dívidas técnicas e implementação dos novos requisitos.

---

## 2. ESTADO ATUAL DO SISTEMA

### 2.1 Stack Tecnológica

| Camada | Tecnologia | Versão | Status |
|--------|-----------|--------|--------|
| **Backend Framework** | Fastify | 4.29.1 | ✅ Produção |
| **Linguagem** | TypeScript | 5.3.3 | ✅ Atualizado |
| **Banco de Dados** | PostgreSQL | - | ✅ Produção |
| **ORM/Query** | Raw SQL + Pools | - | ✅ Funcional |
| **Validação** | Zod | 3.22.4 | ✅ Sólido |
| **Autenticação** | JWT | jsonwebtoken 9.0.2 | ✅ Funcional |
| **Frontend** | React + Vite | 18.2 / 5.0 | ✅ Moderno |
| **Logging** | Winston | 3.11.0 | ✅ Funcional |

### 2.2 Estrutura de Pastas

```
unificard/
├── backend/
│   ├── src/
│   │   ├── core/           # 24 módulos de infraestrutura
│   │   │   ├── ai/         # AI Engine interno
│   │   │   ├── auth/       # Autenticação JWT
│   │   │   ├── categories/ # Sistema de categorias (168KB)
│   │   │   ├── economy/    # Sistema financeiro (168KB)
│   │   │   ├── identity/   # Identidade global
│   │   │   ├── memory/     # Memory Engine
│   │   │   ├── orchestrator/ # Orquestrador de eventos
│   │   │   ├── policy/     # Policy Registry
│   │   │   ├── rbac/       # Controle de acesso
│   │   │   └── ...
│   │   ├── modules/        # 10 módulos de negócio
│   │   │   ├── work/       # UnifyWork (129KB) ✅ MVP COMPLETO
│   │   │   ├── rides/      # UnifyRides (411KB)
│   │   │   ├── social/     # Social Core (177KB)
│   │   │   ├── care/       # Care Engine
│   │   │   ├── assistant/  # IA Conversacional
│   │   │   └── ...
│   │   ├── plugins/        # Plugins Fastify
│   │   └── scripts/        # Scripts utilitários
│   └── migrations/         # 56 migrations SQL
└── frontend/
    └── src/
        ├── components/     # 25+ componentes React
        ├── api/           # Clientes de API
        └── utils/         # Utilitários
```

### 2.3 Módulos Core - Estado Detalhado

| Módulo | Estado | Completude | Observações |
|--------|--------|------------|-------------|
| **auth** | PRODUÇÃO | 100% | JWT + bcrypt + refresh tokens |
| **rbac** | PRODUÇÃO | 95% | ABAC configurável, falta audit |
| **economy** | PRODUÇÃO | 90% | Split funcional, falta moeda teste |
| **categories** | PRODUÇÃO | 85% | IA criação automática funcional |
| **identity** | PRODUÇÃO | 100% | Global identity implementado |
| **memory** | PRODUÇÃO | 80% | Memory Engine ativo |
| **orchestrator** | PARCIAL | 70% | Adapters work/rides ok |
| **policy** | PRODUÇÃO | 90% | Policy Registry sólido |
| **simulation** | FUNCIONAL | 75% | Guardrails implementados |
| **insight** | FUNCIONAL | 70% | Decision Log ativo |
| **world** | PRODUÇÃO | 100% | Geografia mundial |
| **notify** | PRODUÇÃO | 85% | Falta providers reais |

### 2.4 Módulos Business - Estado Detalhado

| Módulo | Estado | Completude | Observações |
|--------|--------|------------|-------------|
| **work** | MVP COMPLETO | 100% | Pagamento automático ✅ |
| **rides** | EM PROGRESSO | 70% | Falta integração PIX |
| **social** | EM PROGRESSO | 60% | Feed + Posts funcionais |
| **events** | PARCIAL | 40% | Estrutura base apenas |
| **groups** | FUNCIONAL | 80% | Integrado com economy |
| **care** | FUNCIONAL | 70% | Integrado com assistant |
| **assistant** | FUNCIONAL | 65% | Falta entrada de voz |
| **schedule** | PARCIAL | 50% | Agenda universal básica |
| **catalog** | PARCIAL | 40% | Estrutura base |

---

## 3. ARQUITETURA RECOMENDADA

### 3.1 Diagrama de Camadas

```
┌────────────────────────────────────────────────────────────────┐
│                         APRESENTAÇÃO                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Web App     │  │  Mobile App  │  │  POS/Cartão  │          │
│  │  (React)     │  │  (Future)    │  │  (Future)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Fastify + Plugins (auth, tenant, rbac, rate-limit)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   CORE (Hub)  │    │   MODULES     │    │  OBSERVAÇÃO   │
│               │    │   (Business)  │    │               │
│ • Economy ◀───────▶• Work         │    │ • Insight     │
│ • Identity    │    │ • Rides      │    │ • Simulation  │
│ • Categories  │    │ • Social     │    │ • Decision Log│
│ • RBAC        │    │ • Events     │    │               │
│ • Policy      │    │ • Catalog    │    │               │
│ • Memory      │    │ • Assistant  │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      EVENT BUS (Central)                        │
│  work.* │ rides.* │ economy.* │ social.* │ groups.* │ ...     │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                      PERSISTÊNCIA                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  PostgreSQL  │  │  Redis       │  │  Files/S3    │          │
│  │  (RLS)       │  │  (Cache)     │  │  (Media)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Princípios Arquiteturais (Manter)

1. **Multi-Tenant com RLS** - Cada query deve considerar tenant_id
2. **Observation-First** - Camadas observacionais NUNCA escrevem em produção
3. **Policy-Driven** - Valores de negócio vêm do PolicyRegistry
4. **Event-Driven** - Comunicação entre módulos via EventBus
5. **Split Centralizado** - Todo pagamento passa pelo SplitEngineService

### 3.3 Alterações Arquiteturais Recomendadas

#### 3.3.1 Criar Módulo UnifyBank (Novo)
```
src/core/unifybank/
├── unifybank.module.ts
├── currency/
│   ├── currency.service.ts    # Gerencia moedas (BRL, TEST_COIN)
│   ├── currency.routes.ts
│   └── currency.types.ts
├── card/
│   ├── card.service.ts        # Gerencia cartões UnifyCard
│   ├── card.routes.ts
│   └── card.types.ts
└── pos/
    ├── pos.service.ts         # Integração com máquinas
    ├── pos.routes.ts
    └── pos.types.ts
```

#### 3.3.2 Consolidar Sistema de Voz (Expandir Assistant)
```
src/modules/assistant/
├── channels/
│   ├── chat.channel.ts        # Canal texto (existe)
│   ├── voice.channel.ts       # Canal voz (NOVO)
│   └── search.channel.ts      # Canal busca (NOVO)
└── services/
    ├── transcription.service.ts  # Speech-to-Text
    └── synthesis.service.ts      # Text-to-Speech
```

---

## 4. DEFINIÇÃO DO CORE

### 4.1 Módulos que DEVEM estar no CORE

| Módulo | Justificativa |
|--------|---------------|
| **economy** | Hub financeiro central, todos usam |
| **identity** | Identidade global, transversal |
| **auth** | Segurança base |
| **rbac** | Controle de acesso |
| **policy** | Configuração de regras |
| **categories** | Taxonomia global |
| **memory** | Contexto do usuário |
| **notify** | Notificações transversais |
| **reviews** | Avaliações transversais |
| **reputation** | Score transversal |
| **world** | Geografia |
| **tenants** | Multi-tenancy |
| **config** | Configurações |
| **orchestrator** | Event routing |
| **unifybank** | **NOVO** - Sistema bancário/moeda |

### 4.2 Módulos que DEVEM ser Desacoplados (modules/)

| Módulo | Justificativa |
|--------|---------------|
| **work** | Domínio de negócio específico |
| **rides** | Domínio de negócio específico |
| **social** | Domínio de negócio específico |
| **events** | Domínio de negócio específico |
| **catalog** | Domínio de negócio específico |
| **assistant** | Camada de interface com IA |
| **care** | Engine de suporte |
| **groups** | Gestão de grupos sociais |
| **schedule** | Agenda universal |

---

## 5. DEFINIÇÃO DOS MÓDULOS PARALELOS

### 5.1 Dependências Entre Módulos

```
┌─────────────┐
│   ECONOMY   │◄─────────────────────────────────────┐
└──────┬──────┘                                      │
       │                                             │
       │ usa                                         │
       ▼                                             │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│    WORK      │───▶│   SOCIAL     │◄───│   EVENTS     │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼ usa
                   ┌──────────────┐
                   │   SCHEDULE   │
                   └──────────────┘
```

### 5.2 Ordem de Ativação por Cidade

```
1. world (geografia)
2. tenants (instância local)
3. identity (usuários)
4. economy + unifybank (financeiro)
5. categories (taxonomia)
6. rbac (permissões)
7. work (serviços)
8. rides (transporte)
9. social (rede)
10. events (eventos)
```

---

## 6. FLUXO DE IA (BUSCA, VOZ, CATEGORIAS, PLANOS)

### 6.1 Arquitetura de IA Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                      ASSISTANT GATEWAY                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │  Chat Input   │  │  Voice Input  │  │  Search Input │        │
│  │  (Texto)      │  │  (Áudio)      │  │  (Query)      │        │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘        │
│          │                  │                  │                 │
│          └──────────────────┼──────────────────┘                 │
│                             ▼                                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PLAN GATE (Verificação de Plano)             │   │
│  │  • FREE: busca básica, respostas curtas                  │   │
│  │  • PAID: assistência completa IA, voz, ações             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CARE ENGINE                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Intent      │  │  Context     │  │  Action      │          │
│  │  Detection   │  │  Builder     │  │  Executor    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MEMORY ENGINE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  User        │  │  Preferences │  │  Shortcuts   │          │
│  │  Context     │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Controle de Acesso por Plano

```typescript
// Proposta de implementação em src/core/assistant/plan-gate.service.ts

interface PlanFeatures {
  freeFeatures: {
    basicSearch: true;
    shortResponses: true;
    limitedIntents: ['search', 'info'];
    dailyLimit: 10;
  };
  paidFeatures: {
    fullAI: true;
    voiceInput: true;
    voiceOutput: true;
    allIntents: true;
    actionExecution: true;
    dailyLimit: 'unlimited';
  };
}

class PlanGateService {
  async checkAccess(
    tenantId: string, 
    userId: string, 
    feature: string
  ): Promise<{allowed: boolean; reason?: string}> {
    const userPlan = await this.getUserPlan(tenantId, userId);
    const featureAllowed = this.isFeatureAllowed(userPlan, feature);
    
    if (!featureAllowed) {
      return {
        allowed: false,
        reason: `Feature '${feature}' requires paid plan. Upgrade at /settings/plan`
      };
    }
    
    return { allowed: true };
  }
}
```

### 6.3 Entrada de Voz (Reativação)

```typescript
// Proposta de implementação em src/modules/assistant/channels/voice.channel.ts

interface VoiceChannelConfig {
  providers: {
    transcription: 'whisper' | 'google' | 'azure';
    synthesis: 'elevenlabs' | 'google' | 'azure';
  };
  languages: ['pt-BR', 'en-US', 'es-ES'];
  maxDuration: 60; // segundos
}

class VoiceChannel {
  async processVoiceInput(
    audioBuffer: Buffer,
    userContext: UserContext
  ): Promise<AssistantResponse> {
    // 1. Verificar plano
    const planCheck = await planGateService.checkAccess(
      userContext.tenantId,
      userContext.globalUserId,
      'voiceInput'
    );
    
    if (!planCheck.allowed) {
      throw new Error(planCheck.reason);
    }
    
    // 2. Transcrever
    const transcription = await transcriptionService.transcribe(audioBuffer);
    
    // 3. Processar via CARE
    return await careService.processUserMessage(
      userContext,
      { text: transcription, inputType: 'voice' }
    );
  }
}
```

---

## 7. FLUXO DE CRIAÇÃO AUTOMÁTICA DE CATEGORIAS

### 7.1 Fluxo Atual (Funcional)

O sistema já possui um fluxo robusto de criação de categorias por IA em `src/core/categories/categories.service.ts`:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENTRADA DE DADOS                              │
│  Texto do usuário (ex: "Dentista especialista em ortodontia")   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. SANITIZAÇÃO                                │
│  • Remove scripts (JavaScript, VBScript)                        │
│  • Remove SQL injection patterns                                 │
│  • Remove URLs                                                   │
│  • Remove tags HTML                                              │
│  • Limita tamanho (500 chars)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. AUTOCOMPLETE CHECK                         │
│  • Verifica se categoria já existe                              │
│  • Se existe → Retorna existente                                │
└─────────────────────────────────────────────────────────────────┘
                              │ Não existe
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. IA CLASSIFICADORA                          │
│  • suggestCategoryPath() determina:                             │
│    - Raiz sugerida (ex: "profissoes")                          │
│    - Pai sugerido (ex: "saude")                                │
│    - Nome leaf (ex: "Ortodontista")                            │
│    - Confidence score (0-1)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. GOVERNANÇA                                 │
│  • IA NUNCA pode criar categoria raiz                           │
│  • Deve ter hierarquia definida                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. AUTO-APROVAÇÃO                             │
│  • Confidence >= 0.85 → Status 'active'                         │
│  • Confidence < 0.85 → Status 'pending' (revisão humana)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    6. AUDITORIA                                  │
│  • Log completo: actorId, textHash, audioHash                   │
│  • aiSuggestion registrada                                      │
│  • aiConfidence registrada                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Melhorias Necessárias

#### 7.2.1 Fluxo de Fallback Humano
```typescript
// Proposta para src/core/categories/category-review.service.ts

interface CategoryReviewQueue {
  queueId: string;
  categoryId: string;
  originalText: string;
  sanitizedText: string;
  aiSuggestion: object;
  aiConfidence: number;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
}

class CategoryReviewService {
  // Lista categorias pendentes de revisão
  async getPendingReviews(tenantId: string, limit: number = 50) {
    return await this.repository.findPending(tenantId, limit);
  }

  // Admin aprova categoria pendente
  async approveCategory(
    tenantId: string,
    reviewerId: string,
    categoryId: string,
    notes?: string
  ) {
    await this.categoriesService.updateStatus(categoryId, 'active');
    await this.logReview(categoryId, reviewerId, 'approved', notes);
  }

  // Admin rejeita categoria pendente
  async rejectCategory(
    tenantId: string,
    reviewerId: string,
    categoryId: string,
    reason: string
  ) {
    await this.categoriesService.updateStatus(categoryId, 'rejected');
    await this.logReview(categoryId, reviewerId, 'rejected', reason);
  }

  // Admin modifica e aprova
  async modifyAndApprove(
    tenantId: string,
    reviewerId: string,
    categoryId: string,
    modifications: { name?: string; parentId?: string; keywords?: string[] }
  ) {
    await this.categoriesService.updateCategory(categoryId, modifications);
    await this.categoriesService.updateStatus(categoryId, 'active');
    await this.logReview(categoryId, reviewerId, 'modified');
  }
}
```

#### 7.2.2 Validação Semântica Adicional
```typescript
// Proposta para src/core/categories/semantic-validator.service.ts

class SemanticValidatorService {
  // Lista de termos proibidos/suspeitos
  private blacklist = [
    // Termos ofensivos
    'palavrao1', 'palavrao2',
    // Termos muito genéricos
    'coisa', 'algo', 'negócio',
    // Termos técnicos que podem ser typos
    'teste', 'debug', 'null',
  ];

  // Patterns suspeitos
  private suspiciousPatterns = [
    /\d{3,}/, // Muitos números
    /[!@#$%^&*()_+=\[\]{}|\\:";'<>?,./]{3,}/, // Muitos símbolos
    /(.)\1{3,}/, // Caracteres repetidos
  ];

  async validate(text: string): Promise<{
    valid: boolean;
    issues: string[];
    confidence: number;
  }> {
    const issues: string[] = [];

    // Check blacklist
    for (const term of this.blacklist) {
      if (text.toLowerCase().includes(term)) {
        issues.push(`Termo suspeito: "${term}"`);
      }
    }

    // Check patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(text)) {
        issues.push(`Padrão suspeito detectado`);
      }
    }

    // Check length
    if (text.length < 3) {
      issues.push('Texto muito curto');
    }

    return {
      valid: issues.length === 0,
      issues,
      confidence: 1 - (issues.length * 0.2)
    };
  }
}
```

---

## 8. FLUXO FINANCEIRO COM MOEDA FICTÍCIA

### 8.1 Estrutura do UnifyBank

```sql
-- Migration proposta: 057_unifybank_test_currency.sql

-- Tabela de moedas suportadas
CREATE TABLE currencies (
    currency_code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    decimals INT DEFAULT 2,
    is_test_currency BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir moeda de teste
INSERT INTO currencies (currency_code, name, symbol, is_test_currency) VALUES
    ('BRL', 'Real Brasileiro', 'R$', FALSE),
    ('TEST', 'Moeda de Teste Unificard', '₮', TRUE);

-- Tabela de emissão de moeda teste (apenas admin)
CREATE TABLE test_currency_emissions (
    emission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    admin_user_id UUID NOT NULL,
    target_global_user_id UUID NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões UnifyCard
CREATE TABLE unifycard_cards (
    card_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    global_user_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    card_number_hash VARCHAR(64) NOT NULL, -- Hash do número
    last_four_digits VARCHAR(4) NOT NULL,
    card_type VARCHAR(20) DEFAULT 'virtual', -- virtual, physical
    status VARCHAR(20) DEFAULT 'active',
    daily_limit DECIMAL(15,2) DEFAULT 1000.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Máquinas POS virtuais
CREATE TABLE unifycard_pos (
    pos_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    company_id UUID REFERENCES companies(company_id),
    serial_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    location_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações de POS
CREATE TABLE pos_transactions (
    pos_transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
    pos_id UUID NOT NULL REFERENCES unifycard_pos(pos_id),
    card_id UUID NOT NULL REFERENCES unifycard_cards(card_id),
    transaction_id UUID NOT NULL REFERENCES transactions(transaction_id),
    amount DECIMAL(15,2) NOT NULL,
    currency_code VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Serviço de Moeda Teste

```typescript
// Proposta para src/core/unifybank/test-currency.service.ts

class TestCurrencyService {
  // Apenas admin pode emitir moeda teste
  async emitTestCurrency(
    tenantId: string,
    adminUserId: string,
    targetGlobalUserId: string,
    amount: number,
    reason: string
  ): Promise<{ emissionId: string; newBalance: number }> {
    // 1. Verificar permissão admin
    const isAdmin = await rbacService.userHasRole(tenantId, adminUserId, 'admin');
    if (!isAdmin) {
      throw new Error('Apenas administradores podem emitir moeda de teste');
    }

    // 2. Verificar que é moeda teste
    const currency = await this.getCurrency('TEST');
    if (!currency.is_test_currency) {
      throw new Error('Operação permitida apenas para moeda de teste');
    }

    // 3. Criar conta TEST se não existir
    let account = await accountService.getAccountByGlobalUserIdAndCurrency(
      tenantId, 
      targetGlobalUserId, 
      'TEST'
    );
    
    if (!account) {
      account = await accountService.createAccount(tenantId, {
        globalUserId: targetGlobalUserId,
        currency: 'TEST',
        accountType: 'wallet'
      });
    }

    // 4. Registrar emissão
    const emission = await this.repository.createEmission({
      tenantId,
      adminUserId,
      targetGlobalUserId,
      amount,
      reason
    });

    // 5. Creditar na conta (transação tipo 'emission')
    await transactionService.credit(tenantId, {
      accountId: account.accountId,
      amount,
      type: 'emission',
      metadata: {
        emissionId: emission.emissionId,
        reason
      }
    });

    // 6. Retornar novo saldo
    const updatedAccount = await accountService.getAccount(account.accountId);
    
    return {
      emissionId: emission.emissionId,
      newBalance: updatedAccount.balance
    };
  }
}
```

### 8.3 Fluxo de Pagamento com Split

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAGAMENTO INICIADO                           │
│  Cliente paga R$ 100,00 por serviço                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SPLIT ENGINE SERVICE                         │
│  Configuração via PolicyRegistry:                                │
│  • split_worker_percentage: 0.70 (70%)                          │
│  • split_tenant_percentage: 0.15 (15%)                          │
│  • split_region_percentage: 0.10 (10%)                          │
│  • split_group_percentage: 0.05 (5%)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DISTRIBUIÇÃO (R$ 100,00)                     │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │  WORKER    │  │  TENANT    │  │  REGIÃO    │  │  GRUPOS    ││
│  │  R$ 70,00  │  │  R$ 15,00  │  │  R$ 10,00  │  │  R$ 5,00   ││
│  │  (70%)     │  │  (15%)     │  │  (10%)     │  │  (5%)      ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│        │               │               │               │        │
│        ▼               ▼               ▼               ▼        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │ Conta do   │  │ Conta do   │  │ Fundo      │  │ Contas dos ││
│  │ Profiss.   │  │ Tenant     │  │ Regional   │  │ Grupos     ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LEDGER (Double-Entry)                        │
│  4 lançamentos registrados com metadata completa                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. FLUXO DE SPLIT GLOBAL

### 9.1 Configuração Atual (Funcional)

O sistema já possui um SplitEngineService maduro em `src/core/economy/split.service.ts` que:
- Lê configurações do PolicyRegistry
- Suporta múltiplos destinos (WORKER, TENANT, REGION, GROUP)
- Registra transações no Ledger
- Emite eventos para cada split

### 9.2 Integração com Módulos

| Módulo | Integração Split | Status |
|--------|-----------------|--------|
| **work** | ✅ Implementado | Usa split em `assignment.complete()` |
| **rides** | 🔶 Parcial | Precisa integrar |
| **events** | 🔶 Parcial | Precisa integrar |
| **catalog** | ❌ Não implementado | Precisa criar |
| **social** | N/A | Não requer split direto |

### 9.3 Padronização de Integração

```typescript
// Padrão para integrar split em qualquer módulo
// Exemplo em rides/ride-completion.service.ts

async completeRide(tenantId: string, rideId: string) {
  // 1. Obter dados da corrida
  const ride = await this.rideRepository.findById(rideId);
  
  // 2. Resolver contas envolvidas
  const driverAccount = await accountService.getAccountByGlobalUserIdAndCurrency(
    tenantId, ride.driverId, 'BRL'
  );
  const tenantAccount = await accountService.getTenantAccount(tenantId);
  const regionAccount = await accountService.getRegionAccount(tenantId, ride.regionId);
  const groupAccounts = await this.resolveDriverGroupAccounts(tenantId, ride.driverId);
  const customerAccount = await accountService.getAccountByGlobalUserIdAndCurrency(
    tenantId, ride.passengerId, 'BRL'
  );

  // 3. Executar split
  const splitResult = await splitEngineService.applySplits({
    tenantId,
    amount: ride.finalPrice,
    currency: 'BRL',
    source: 'rides',
    customerAccountId: customerAccount.accountId,
    workerAccountId: driverAccount.accountId,
    tenantAccountId: tenantAccount.accountId,
    regionAccountId: regionAccount.accountId,
    groupAccountIds: groupAccounts.map(g => g.accountId),
    metadata: {
      module: 'rides',
      rideId,
      driverId: ride.driverId,
      passengerId: ride.passengerId,
      regionId: ride.regionId
    }
  });

  // 4. Emitir evento
  await eventBus.publish({
    tenantId,
    type: 'rides.payment.completed',
    payload: { rideId, splitResult }
  });

  return splitResult;
}
```

---

## 10. RISCOS TÉCNICOS

### 10.1 Riscos Críticos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Conflito de Migrations** | ALTA | ALTO | Renumerar migrations 028 e 055 |
| **Express residual** | BAIXA | MÉDIO | Remover dependência do package.json |
| **Falta de testes** | ALTA | ALTO | Implementar testes E2E |
| **Cache não implementado** | MÉDIA | MÉDIO | Adicionar Redis para categorias |

### 10.2 Riscos Moderados

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Voz sem provider** | MÉDIA | MÉDIO | Integrar Whisper/Google |
| **POS sem hardware** | ALTA | BAIXO | Simular com QR codes |
| **Escala do Social** | MÉDIA | MÉDIO | Paginar feeds, índices |

### 10.3 Dívidas Técnicas Identificadas

1. **Migrations Duplicadas:**
   - `028_catalog_canonical.sql` e `028_categories_system.sql`
   - `055_categories_ai_blindage.sql` e `055_categories_ai_validation.sql`
   - **Ação:** Consolidar e renumerar

2. **Gaps de Numeração:**
   - 007, 008 não existem (6 → 9)
   - 018 não existe (17 → 19)
   - 040, 041 não existem (39 → 42)
   - **Ação:** Documentar como "reservados" ou preencher

3. **Express no package.json:**
   - Dependência residual não utilizada
   - **Ação:** Remover `express` e `@types/express`

4. **Falta de Rate Limit por Plano:**
   - Rate limit global, não diferencia planos
   - **Ação:** Implementar rate limit dinâmico

---

## 11. PRÓXIMOS PASSOS TÉCNICOS

### 11.1 Fase 1: Consolidação (1-2 semanas)

| Tarefa | Prioridade | Esforço |
|--------|-----------|---------|
| Renumerar migrations conflitantes | P0 | 2h |
| Remover dependência Express | P0 | 30min |
| Documentar gaps de migrations | P1 | 1h |
| Criar testes E2E para work | P1 | 4h |
| Criar testes E2E para economy | P1 | 4h |

### 11.2 Fase 2: UnifyBank (2-3 semanas)

| Tarefa | Prioridade | Esforço |
|--------|-----------|---------|
| Migration 057_unifybank_test_currency.sql | P0 | 4h |
| TestCurrencyService | P0 | 8h |
| CardService (virtual) | P1 | 6h |
| POSService (virtual) | P1 | 6h |
| Rotas admin para emissão | P0 | 4h |
| Frontend admin panel | P1 | 8h |

### 11.3 Fase 3: Sistema de Voz (2-3 semanas)

| Tarefa | Prioridade | Esforço |
|--------|-----------|---------|
| Integrar provider Whisper | P0 | 8h |
| VoiceChannel no assistant | P0 | 6h |
| PlanGateService | P0 | 4h |
| Frontend componente de voz | P0 | 8h |
| Testes de integração | P1 | 4h |

### 11.4 Fase 4: Governança de Categorias (1-2 semanas)

| Tarefa | Prioridade | Esforço |
|--------|-----------|---------|
| CategoryReviewService | P0 | 6h |
| SemanticValidatorService | P1 | 4h |
| Rotas admin para revisão | P0 | 4h |
| Frontend queue de revisão | P1 | 6h |

### 11.5 Fase 5: Integrações (Contínuo)

| Tarefa | Prioridade | Esforço |
|--------|-----------|---------|
| Split em rides | P1 | 8h |
| Split em events | P2 | 6h |
| Split em catalog | P2 | 6h |
| City Readiness checks | P1 | 8h |

---

## 12. CHECKLIST DE IMPLEMENTAÇÃO

### Para cada nova funcionalidade, verificar:

- [ ] Multi-tenant considerado (tenant_id em todas queries)
- [ ] RLS habilitado nas tabelas novas
- [ ] Eventos emitidos para EventBus
- [ ] Policy Registry usado (não hardcode)
- [ ] Guardrails de observação respeitados
- [ ] Split integrado (se módulo financeiro)
- [ ] City Readiness verificado (se módulo por cidade)
- [ ] Testes E2E criados
- [ ] Documentação atualizada

---

## CONCLUSÃO

O Unificard é um projeto bem estruturado com fundamentos sólidos. A recomendação é **não recomeçar do zero**, mas sim:

1. **Consolidar** o que existe (resolver dívidas técnicas)
2. **Expandir** com novos módulos (UnifyBank, Voz)
3. **Integrar** os módulos existentes com o Split global
4. **Governar** a criação de dados (categorias, revisão humana)

O sistema está pronto para escalar, desde que as dívidas técnicas sejam resolvidas e os novos requisitos sejam implementados seguindo a arquitetura existente.

---

**Documento gerado por Claude (Anthropic)**  
**Para uso da equipe de desenvolvimento Unificard**
