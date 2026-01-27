# 📐 GUIA DE ESCALABILIDADE - UNIFICARD
## Preparação para Novos Módulos

---

## 🎯 VISÃO GERAL

O Unificard está crescendo rapidamente (563 arquivos, ~97k linhas). Para garantir que novos módulos sejam adicionados de forma sustentável, este guia estabelece padrões e práticas recomendadas.

---

## 📦 1. ESTRUTURA PADRÃO DE MÓDULO

### Template para Novo Módulo
```
src/modules/{nome-modulo}/
├── {nome}.module.ts           # Registro do módulo
├── {nome}.routes.ts           # Rotas (máx. 300 linhas)
├── {nome}.service.ts          # Lógica de negócio
├── {nome}.repository.ts       # Acesso a dados
├── {nome}.types.ts            # Interfaces/tipos
├── {nome}.schemas.ts          # Validação Zod
├── {nome}.constants.ts        # Constantes
└── sub-rotas/                 # Se necessário dividir
    ├── feature-a.routes.ts
    └── feature-b.routes.ts
```

### Exemplo: Módulo de Notificações Push
```
src/modules/push-notifications/
├── push.module.ts
├── push.routes.ts
├── push.service.ts
├── push.repository.ts
├── push.types.ts
├── push.schemas.ts
├── providers/
│   ├── firebase.provider.ts
│   └── apns.provider.ts
└── templates/
    └── notification-templates.ts
```

---

## 🔌 2. PADRÃO DE REGISTRO DE MÓDULO

### Template de Module
```typescript
// src/modules/{nome}/{nome}.module.ts
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { nomeRoutes } from './{nome}.routes';

const nomeModule: FastifyPluginAsync = async (fastify) => {
  // Registrar serviços como decoradores se necessário
  // fastify.decorate('nomeService', nomeService);
  
  // Registrar rotas
  await fastify.register(nomeRoutes);
};

export default fp(nomeModule, {
  name: '{nome}-module',
  dependencies: ['auth-plugin', 'tenant-plugin'], // dependências
});
```

### Registro no Server
```typescript
// server.ts - Adicionar no array de imports dinâmicos
const nomeModule = await import('./modules/{nome}/{nome}.module');
await protectedScope.register(nomeModule.default, { prefix: '/api/{nome}' });
```

---

## 📏 3. LIMITES DE TAMANHO

### Regras de Ouro
| Elemento | Máximo | Ação se Exceder |
|----------|--------|-----------------|
| Arquivo de rotas | 300 linhas | Dividir em sub-rotas |
| Arquivo de serviço | 500 linhas | Extrair sub-serviços |
| Componente React | 400 linhas | Compor com sub-componentes |
| Função | 50 linhas | Extrair helpers |
| Parâmetros de função | 4 | Usar objeto de opções |

### Quando Dividir Rotas
```typescript
// ANTES (ruim - 800+ linhas)
// users.routes.ts com tudo junto

// DEPOIS (bom)
// users/
// ├── users.routes.ts (index, registra sub-rotas)
// ├── profile.routes.ts (~150 linhas)
// ├── settings.routes.ts (~150 linhas)
// └── preferences.routes.ts (~150 linhas)
```

---

## 🔐 4. PADRÃO DE SEGURANÇA PARA NOVOS MÓDULOS

### Checklist de Segurança
```typescript
// Todo novo módulo DEVE ter:

// 1. Validação de entrada com Zod
const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

// 2. Verificação de tenant
if (!req.tenant) {
  return reply.status(400).send({ error: 'Tenant required' });
}

// 3. Verificação de usuário
if (!req.user) {
  return reply.status(401).send({ error: 'Not authenticated' });
}

// 4. Log estruturado
fastify.log.info({
  action: 'create_resource',
  userId: req.user.id,
  tenantId: req.tenant.id,
  resourceId: result.id,
}, 'Resource created');
```

### Template de Migration com RLS
```sql
-- migrations/XXX_{nome}_system.sql

-- Tabela principal
CREATE TABLE IF NOT EXISTS {nome} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  -- campos específicos
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS obrigatório
ALTER TABLE {nome} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "{nome}_tenant_isolation" ON {nome}
  USING (tenant_id = current_setting('app.current_tenant', true)::UUID);

-- Índices
CREATE INDEX idx_{nome}_tenant ON {nome}(tenant_id);
CREATE INDEX idx_{nome}_created ON {nome}(created_at DESC);
```

---

## 🧪 5. PADRÃO DE TESTES

### Estrutura de Testes para Módulo
```
tests/
├── unit/
│   └── modules/{nome}/
│       ├── {nome}.service.test.ts
│       └── {nome}.repository.test.ts
└── integration/
    └── {nome}.test.ts
```

### Template de Teste de Integração
```typescript
// tests/integration/{nome}.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { buildApp } from '../../src/server';
import type { FastifyInstance } from 'fastify';

describe('{Nome} Module', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeAll(async () => {
    app = await buildApp();
    // Setup: criar tenant, usuário, obter token
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/{nome}', () => {
    it('should create resource', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/{nome}',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'x-tenant-id': 'test-tenant-id',
        },
        payload: { /* dados */ },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toHaveProperty('id');
    });

    it('should reject without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/{nome}',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
```

### Cobertura Mínima por Módulo
- **Services**: 80%
- **Repositories**: 70%
- **Routes**: Pelo menos 1 teste happy path + 1 erro

---

## 📊 6. PADRÃO DE LOGGING

### Substituir Console por Logger
```typescript
// ❌ EVITAR
console.log('Creating user:', userData);
console.error('Failed:', error);

// ✅ USAR
fastify.log.info({ userData }, 'Creating user');
fastify.log.error({ error }, 'User creation failed');
```

### Níveis de Log
| Nível | Uso |
|-------|-----|
| `trace` | Debug detalhado (desligado em prod) |
| `debug` | Informações de desenvolvimento |
| `info` | Operações normais importantes |
| `warn` | Situações anormais mas recuperáveis |
| `error` | Erros que precisam de atenção |
| `fatal` | Erros críticos que param o sistema |

---

## 🔄 7. PADRÃO DE MIGRATIONS

### Nomenclatura
```
{NNN}_{nome_descritivo}.sql

Exemplos:
089_push_notifications.sql
090_push_notification_templates.sql
091_push_notification_preferences.sql
```

### Regras
1. **Sempre idempotente**: Use `IF NOT EXISTS`, `IF EXISTS`
2. **Sempre reversível**: Tenha plano de rollback
3. **Pequenas e focadas**: Uma feature por migration
4. **RLS obrigatório**: Para tabelas com dados de tenant

---

## 🎨 8. PADRÃO DE COMPONENTES FRONTEND

### Estrutura de Componente
```
components/{NomeFeature}/
├── index.tsx              # Export principal
├── {Nome}Container.tsx    # Lógica/estado
├── {Nome}View.tsx         # Apresentação
├── {Nome}.css             # Estilos
├── {Nome}.types.ts        # Tipos
├── hooks/
│   └── use{Nome}.ts       # Hooks customizados
└── components/
    ├── {Nome}Header.tsx
    ├── {Nome}List.tsx
    └── {Nome}Item.tsx
```

### Regra de Composição
```typescript
// ❌ EVITAR - Componente monolítico
function MegaComponent() {
  // 1000+ linhas de lógica e JSX misturados
}

// ✅ USAR - Composição
function FeatureContainer() {
  const { data, actions } = useFeatureLogic();
  return <FeatureView data={data} {...actions} />;
}

function FeatureView({ data, onAction }) {
  return (
    <div>
      <FeatureHeader />
      <FeatureList items={data.items} onItemClick={onAction} />
      <FeatureFooter />
    </div>
  );
}
```

---

## 📋 9. CHECKLIST PARA NOVO MÓDULO

### Antes de Começar
- [ ] Definir escopo claro do módulo
- [ ] Verificar se não há sobreposição com módulos existentes
- [ ] Desenhar diagrama de dependências
- [ ] Estimar número de endpoints

### Durante Desenvolvimento
- [ ] Criar migration com RLS
- [ ] Implementar service com tipos corretos
- [ ] Criar schemas Zod para validação
- [ ] Usar logger em vez de console
- [ ] Manter arquivos < 300 linhas
- [ ] Escrever testes de integração

### Antes de Merge
- [ ] Zero erros TypeScript
- [ ] Testes passando
- [ ] Documentação atualizada
- [ ] Code review aprovado
- [ ] Migration testada em staging

---

## 📚 10. MÓDULOS PLANEJADOS - PREPARAÇÃO

### Módulos em Roadmap
| Módulo | Dependências | Prioridade | Complexidade |
|--------|--------------|------------|--------------|
| Push Notifications | identity, events | Alta | Média |
| Real-time Chat | social, notify | Média | Alta |
| Analytics Dashboard | economy, events | Média | Média |
| Marketplace | catalog, economy | Alta | Alta |
| Loyalty Program | economy, profile | Baixa | Média |

### Preparação Necessária
1. **Push Notifications**
   - Integrar Firebase/APNs
   - Criar tabela device_tokens
   - Implementar queue de envio

2. **Real-time Chat**
   - Configurar WebSocket (Fastify-WS)
   - Criar tabela chat_messages
   - Implementar presença

3. **Analytics Dashboard**
   - Definir métricas principais
   - Criar tabelas agregadas
   - Implementar cron de agregação

---

*Guia criado como complemento da Auditoria de Dezembro/2024*
