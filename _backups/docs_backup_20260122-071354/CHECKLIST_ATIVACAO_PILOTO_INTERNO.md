# CHECKLIST DE ATIVAÇÃO - PILOTO INTERNO
## UnifyCard - Produção Constante

**Data:** 12 de Janeiro de 2026  
**Modo:** Ativação Controlada  
**Objetivo:** Piloto interno com 5-10 pessoas reais  
**Status:** EXECUTÁVEL  

---

## 🎯 PRINCÍPIOS DE ATIVAÇÃO

### Não É Piloto Externo
```
❌ Não é lançamento público
❌ Não é marketing
❌ Não é validação de mercado
✅ É validação de CONTRATO INSTITUCIONAL
✅ É detecção de ERRO HUMANO
✅ É geração de BACKLOG REAL
```

### Ciclo de Aprendizado
```
USO REAL → ERRO → MÉTRICA → AJUSTE → TESTE → DOCUMENTO
```

**Nada entra fora deste ciclo.**

---

## 📋 PRÉ-REQUISITOS TÉCNICOS

### P0 - Bloqueadores (CRÍTICO)

```
[ ] Bug do middleware corrigido
    - action-context.middleware.ts sem 'publish_feed' hardcoded
    - requirePermission guard implementado
    - Rotas críticas protegidas
    Status: ⚠️ PENDENTE (1-2 dias)

[ ] Mapa de permissions integrado
    - permission-keys.ts criado
    - PERMISSION_CAPABILITIES sincronizado
    - Enum no código atualizado
    Status: ⚠️ PENDENTE (1 dia)

[ ] Migrations rodadas
    - Migration 154 (actor_registry)
    - Migration 155 (actor_delegations)
    - Bank migrations (130-133)
    Status: ✅ PRONTAS

[ ] Sistema buildando
    - Backend compila sem erros
    - Frontend compila sem erros
    - Tests passing (core)
    Status: ❓ VERIFICAR
```

**SEM ISSO → NÃO ATIVA**

---

### P1 - Infraestrutura Mínima

```
[ ] Ambiente isolado
    - Database separado (piloto_db)
    - Backend rodando local ou staging
    - Frontend rodando local ou staging
    - Não usar produção ainda

[ ] Backup automático
    - Backup diário da DB
    - Rollback possível em <5min
    - Script de reset pronto

[ ] Logs estruturados
    - Winston configurado
    - Logs de autorização habilitados
    - Logs de Bank habilitados
    - Erros capturados com stack trace

[ ] Monitoramento básico
    - Health check endpoint (/health)
    - Uptime monitoring (ping a cada 1min)
    - Alert se down >5min
```

---

## 👥 PARTICIPANTES DO PILOTO

### Perfil Ideal (5-10 pessoas)

```
Requisitos:
✅ Conhecem o projeto
✅ Entendem que é TESTE
✅ Podem reportar bugs claramente
✅ Disponíveis diariamente (15-30min)
✅ Não esperam sistema perfeito

Evitar:
❌ Pessoas que não entendem teste
❌ Pessoas sem tempo
❌ Pessoas que vão criticar UX prematuramente
```

### Composição Ideal

```
2 pessoas: Fundadores/Core Team
  → Testam tudo
  → Criam entidades (empresas, eventos, grupos)
  → Fazem delegações

3 pessoas: "Funcionários"
  → Recebem delegações
  → Agem em nome de empresa
  → Testam ownership vs delegation

2 pessoas: "Usuários comuns"
  → Publicam posts
  → Participam de eventos
  → Usam serviços

1 pessoa: "Prestador"
  → Oferece serviço
  → Recebe agendamentos
  → Testa economia

1-2 pessoas: "Admin/Observadores"
  → Não usam ativamente
  → Monitoram métricas
  → Detectam padrões
```

---

## 🧩 MÓDULOS A ATIVAR

### ✅ ATIVAR (Core Mínimo)

#### 1. Auth & Users
```
✅ Login/Logout
✅ Register
✅ Profile
✅ Avatar upload
Status: JÁ FUNCIONA
```

#### 2. Feed (Social)
```
✅ Publicar posts
✅ Comentários
✅ Reações
✅ Feed cronológico
Status: JÁ FUNCIONA
```

#### 3. Bank (Wallet)
```
✅ Ver saldo (GET /bank/balance)
✅ Ver extrato (GET /bank/statement)
✅ Transferência P2P (simulada por enquanto)
Status: ROTAS PRONTAS (validar UX)
```

#### 4. Companies (Delegação)
```
✅ Criar empresa
✅ Adicionar membros
✅ Criar delegações (scopes explícitos)
✅ "Atuando como" empresa
Status: MIGRATIONS PRONTAS (validar fluxo)
```

#### 5. ESCOLHER UM: Events OU Services

**Opção A: Events**
```
✅ Criar evento
✅ Publicar evento
✅ Ingressos (ocupancy)
✅ Check-in (QR code)
✅ Dashboard organizador
✅ Pagamento via Bank (simulado)
Status: JÁ FUNCIONA
```

**Opção B: Services**
```
✅ Oferecer serviço
✅ Disponibilidade
✅ Bookings
✅ Aceitar/Recusar
✅ Pagamento via Bank (simulado)
Status: BACKEND OK, UI FRACA
```

**Recomendação: EVENTS** (UX melhor, fluxo mais completo)

#### 6. Groups (Alocação)
```
✅ Criar grupo
✅ Adicionar membros
✅ Posts do grupo
✅ Eventos do grupo
✅ Votações (se necessário)
Status: JÁ FUNCIONA
```

---

### ❌ NÃO ATIVAR (Ainda)

```
❌ Rides (sem UI)
❌ Work/Jobs (sem UI)
❌ Catalog/Marketplace (incompleto)
❌ Dispatch (sem UI)
❌ Care/Cultural (sem UI)
❌ Pagamentos reais (PIX) → só depois do piloto interno
```

**Motivo:** Distrações. Foco no contrato institucional.

---

## 🔧 CONFIGURAÇÃO TÉCNICA

### Environment Variables

```bash
# Database (isolado)
DATABASE_URL=postgresql://user:pass@localhost:5432/unifycard_piloto

# JWT
JWT_SECRET=<gerar novo secret para piloto>
JWT_EXPIRES_IN=7d

# Environment
NODE_ENV=staging
PORT=3000

# Features flags
ENABLE_REAL_PAYMENTS=false
ENABLE_PIX=false
ENABLE_RIDES=false
ENABLE_MARKETPLACE=false

# Logs
LOG_LEVEL=debug
LOG_AUTH=true
LOG_BANK=true

# Rate limits (relaxado para teste)
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=60000

# Upload
MAX_FILE_SIZE=10485760 # 10MB
UPLOAD_DIR=./uploads_piloto
```

---

### Seed Data (Script)

**Arquivo:** `seeds/piloto-interno.seed.ts`

```typescript
/**
 * SEED PARA PILOTO INTERNO
 * Cria estrutura mínima para teste
 * 
 * Executar:
 * npm run seed:piloto
 */

import { runMigrations } from '../migrations/runner';
import { createTenant } from '../src/core/tenant/tenant.service';
import { createUser } from '../src/modules/auth/auth.service';
import { actorRepository } from '../src/modules/social/actor.repository';
import { bankIntegrationService } from '../src/modules/bank/bank-integration.service';

async function seedPilotoInterno() {
  console.log('🌱 Iniciando seed do piloto interno...');

  // 1. Rodar migrations
  console.log('📦 Rodando migrations...');
  await runMigrations();

  // 2. Criar tenant
  console.log('🏢 Criando tenant...');
  const tenant = await createTenant({
    name: 'UnifyCard Piloto',
    slug: 'piloto',
    subdomain: 'piloto',
  });

  // 3. Criar usuários
  console.log('👥 Criando usuários...');
  
  const founder1 = await createUser({
    tenantId: tenant.id,
    email: 'founder1@piloto.unify',
    password: 'Piloto2026!',
    name: 'João Fundador',
    role: 'admin',
  });

  const founder2 = await createUser({
    tenantId: tenant.id,
    email: 'founder2@piloto.unify',
    password: 'Piloto2026!',
    name: 'Maria Co-fundadora',
    role: 'admin',
  });

  const employee1 = await createUser({
    tenantId: tenant.id,
    email: 'func1@piloto.unify',
    password: 'Piloto2026!',
    name: 'Pedro Funcionário',
    role: 'user',
  });

  const employee2 = await createUser({
    tenantId: tenant.id,
    email: 'func2@piloto.unify',
    password: 'Piloto2026!',
    name: 'Ana Funcionária',
    role: 'user',
  });

  const user1 = await createUser({
    tenantId: tenant.id,
    email: 'user1@piloto.unify',
    password: 'Piloto2026!',
    name: 'Carlos Usuário',
    role: 'user',
  });

  const user2 = await createUser({
    tenantId: tenant.id,
    email: 'user2@piloto.unify',
    password: 'Piloto2026!',
    name: 'Julia Usuária',
    role: 'user',
  });

  const provider = await createUser({
    tenantId: tenant.id,
    email: 'prestador@piloto.unify',
    password: 'Piloto2026!',
    name: 'Ricardo Prestador',
    role: 'user',
  });

  // 4. Criar actors para todos
  console.log('🎭 Criando actors...');
  const actors = await Promise.all([
    actorRepository.findOrCreateUserActor(tenant.id, founder1.id),
    actorRepository.findOrCreateUserActor(tenant.id, founder2.id),
    actorRepository.findOrCreateUserActor(tenant.id, employee1.id),
    actorRepository.findOrCreateUserActor(tenant.id, employee2.id),
    actorRepository.findOrCreateUserActor(tenant.id, user1.id),
    actorRepository.findOrCreateUserActor(tenant.id, user2.id),
    actorRepository.findOrCreateUserActor(tenant.id, provider.id),
  ]);

  // 5. Dar saldo inicial (MFI virtual)
  console.log('💰 Creditando saldo inicial...');
  await Promise.all([
    bankIntegrationService.depositFunds(tenant.id, founder1.id, 100000, 'BRL'), // R$ 1.000
    bankIntegrationService.depositFunds(tenant.id, founder2.id, 100000, 'BRL'),
    bankIntegrationService.depositFunds(tenant.id, employee1.id, 50000, 'BRL'), // R$ 500
    bankIntegrationService.depositFunds(tenant.id, employee2.id, 50000, 'BRL'),
    bankIntegrationService.depositFunds(tenant.id, user1.id, 20000, 'BRL'), // R$ 200
    bankIntegrationService.depositFunds(tenant.id, user2.id, 20000, 'BRL'),
    bankIntegrationService.depositFunds(tenant.id, provider.id, 10000, 'BRL'), // R$ 100
  ]);

  // 6. Criar empresa
  console.log('🏢 Criando empresa...');
  const company = await createCompany({
    tenantId: tenant.id,
    name: 'UnifyCard Labs',
    ownerId: founder1.id,
    metadata: {
      type: 'startup',
      size: 'small',
    },
  });

  // 7. Criar actor registry para empresa
  console.log('🎭 Registrando empresa como actor...');
  const companyActor = await actorRepository.createInstitutionalActor(tenant.id, {
    entityType: 'company',
    entityId: company.id,
    capabilities: {
      can_publish_feed: true,
      can_receive_funds: true,
      can_hold_assets: true,
      can_delegate: true,
    },
  });

  // 8. Adicionar funcionários à empresa
  console.log('👔 Adicionando funcionários...');
  await Promise.all([
    addCompanyMember(tenant.id, company.id, employee1.id, 'member'),
    addCompanyMember(tenant.id, company.id, employee2.id, 'member'),
  ]);

  // 9. Criar delegações
  console.log('🔑 Criando delegações...');
  await Promise.all([
    createDelegation({
      tenantId: tenant.id,
      userActorId: actors[2].actor_id, // employee1
      institutionalActorId: companyActor.actor_id,
      scopes: ['publish_feed', 'create_events'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
    }),
    createDelegation({
      tenantId: tenant.id,
      userActorId: actors[3].actor_id, // employee2
      institutionalActorId: companyActor.actor_id,
      scopes: ['publish_feed'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }),
  ]);

  // 10. Criar grupo
  console.log('👥 Criando grupo...');
  const group = await createGroup({
    tenantId: tenant.id,
    name: 'Comunidade Piloto',
    creatorId: founder1.id,
    visibility: 'public',
  });

  // 11. Adicionar membros ao grupo
  console.log('👥 Adicionando membros ao grupo...');
  await Promise.all([
    addGroupMember(tenant.id, group.id, founder2.id, 'admin'),
    addGroupMember(tenant.id, group.id, employee1.id, 'member'),
    addGroupMember(tenant.id, group.id, user1.id, 'member'),
    addGroupMember(tenant.id, group.id, user2.id, 'member'),
  ]);

  console.log('✅ Seed concluído!');
  console.log('\n📊 Resumo:');
  console.log(`  Tenant: ${tenant.name}`);
  console.log(`  Usuários: 7`);
  console.log(`  Empresa: ${company.name}`);
  console.log(`  Grupo: ${group.name}`);
  console.log('\n🔑 Credenciais de acesso:');
  console.log(`  Fundador 1: founder1@piloto.unify / Piloto2026!`);
  console.log(`  Fundador 2: founder2@piloto.unify / Piloto2026!`);
  console.log(`  Funcionário 1: func1@piloto.unify / Piloto2026!`);
  console.log(`  Funcionário 2: func2@piloto.unify / Piloto2026!`);
  console.log(`  Usuário 1: user1@piloto.unify / Piloto2026!`);
  console.log(`  Usuário 2: user2@piloto.unify / Piloto2026!`);
  console.log(`  Prestador: prestador@piloto.unify / Piloto2026!`);
}

// Executar
seedPilotoInterno()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  });
```

---

### Script de Reset

**Arquivo:** `scripts/reset-piloto.sh`

```bash
#!/bin/bash

# RESET DO PILOTO INTERNO
# ATENÇÃO: Apaga TUDO e recria do zero

set -e

echo "🚨 RESET DO PILOTO INTERNO"
echo "Este script vai APAGAR TUDO e recriar."
read -p "Tem certeza? (digite 'sim'): " confirm

if [ "$confirm" != "sim" ]; then
  echo "❌ Cancelado."
  exit 0
fi

# 1. Dropar database
echo "🗑️  Dropando database..."
psql -U postgres -c "DROP DATABASE IF EXISTS unifycard_piloto;"

# 2. Criar database
echo "📦 Criando database..."
psql -U postgres -c "CREATE DATABASE unifycard_piloto;"

# 3. Rodar migrations
echo "📦 Rodando migrations..."
npm run migrate:up

# 4. Rodar seed
echo "🌱 Rodando seed..."
npm run seed:piloto

echo "✅ Reset concluído!"
echo "Sistema pronto para uso."
```

**Executar:**
```bash
chmod +x scripts/reset-piloto.sh
./scripts/reset-piloto.sh
```

---

## 📊 MÉTRICAS MÍNIMAS (Observação)

### Durante o Piloto, Observar:

#### 1. Autorização
```
Métrica: Tentativas de ação negadas
Onde: Logs de authorizationService.canActAs()
O que buscar:
  - User tentou fazer algo que não pode
  - Delegação faltando scopes
  - Capability ausente no registry
Ação: Ajustar delegações OU identificar UX confusa
```

#### 2. Delegação ("Atuando como")
```
Métrica: Uso de x-acting-actor-id
Onde: Logs de action-context.middleware
O que buscar:
  - Usuários esquecem de "atuar como empresa"
  - Confusão sobre "quem sou eu agora"
  - Posts/eventos criados como PF quando deveria ser empresa
Ação: Melhorar UX de "selector de actor"
```

#### 3. Bank (Transações)
```
Métrica: Transações criadas vs falhadas
Onde: bank_ledger, bank_transactions
O que buscar:
  - Saldo insuficiente
  - Transferências falhadas
  - Splits incorretos
Ação: Validar lógica de split, verificar saldo inicial
```

#### 4. Erros Humanos
```
Métrica: Rotas 403 (Forbidden)
Onde: Logs HTTP
O que buscar:
  - Padrão de erros repetidos
  - Rotas que deveriam ser públicas mas estão protegidas
  - Permissions ausentes
Ação: Ajustar requirePermission() ou adicionar permission no mapa
```

#### 5. Performance
```
Métrica: Response time > 1s
Onde: Logs HTTP
O que buscar:
  - Rotas lentas (banco de dados?)
  - Queries N+1
  - Middleware pesado
Ação: Otimizar queries específicas
```

---

## 🔄 FLUXOS A TESTAR

### Fluxo 1: Delegação Básica

```
Fundador 1:
1. Login como founder1@piloto.unify
2. Vai em "Minha Empresa" (UnifyCard Labs)
3. Vê que func1@piloto tem delegação com scopes [publish_feed, create_events]

Funcionário 1:
1. Login como func1@piloto.unify
2. No seletor de actor, escolhe "UnifyCard Labs" (empresa)
3. Publica post → deve aparecer "publicado por UnifyCard Labs"
4. Cria evento → deve aparecer "organizado por UnifyCard Labs"
5. Tenta transferir dinheiro da empresa → deve NEGAR (sem manage_financial)

Validação:
✅ Post aparece como empresa
✅ Evento aparece como empresa
✅ Transferência negada com reason claro
```

---

### Fluxo 2: Economia Passiva

```
Usuário 1:
1. Login como user1@piloto.unify
2. Vai em Wallet
3. Vê saldo inicial: R$ 200,00
4. Vê extrato vazio

Fundador 1:
1. Cria evento com ingresso R$ 50,00
2. Publica evento

Usuário 1:
1. Compra ingresso (R$ 50,00)
2. Wallet agora mostra: R$ 150,00
3. Extrato mostra: "-R$ 50,00 - Ingresso - Evento X"

Fundador 1:
1. Wallet da empresa mostra: +R$ 48,50 (97% de R$ 50)
2. Extrato mostra: "+R$ 48,50 - Ingresso vendido - Evento X"

Sistema:
1. Fundo regional recebeu: R$ 0,45 (30% de 3%)
2. Fee recebeu: R$ 0,60 (40% de 3%)
3. Reserve recebeu: R$ 0,30 (20% de 3%)
4. Dev recebeu: R$ 0,15 (10% de 3%)

Validação:
✅ Split aconteceu automaticamente
✅ Saldos batem (soma = R$ 50)
✅ Taxa = 3% exato
✅ Distribuição correta da taxa
```

---

### Fluxo 3: Grupo & Votação

```
Fundador 1:
1. Vai em "Comunidade Piloto"
2. Cria votação: "Devemos fazer um evento mensal?"
3. Opções: Sim / Não

Membros:
1. user1, user2, func1 votam
2. Votação encerra

Fundador 1:
1. Vê resultado: X votos Sim, Y votos Não
2. Gráfico de distribuição

Validação:
✅ Apenas membros votam
✅ Votos anônimos (não aparece quem votou)
✅ Resultado claro
```

---

## 🚨 PROBLEMAS ESPERADOS

### Tipo 1: UX de "Atuando como"

```
Problema: Usuário esquece de trocar actor
Sintoma: Post aparece como PF quando queria empresa
Solução: Selector mais visível + tooltip
```

### Tipo 2: Delegação Confusa

```
Problema: Funcionário não sabe que tem delegação
Sintoma: Nunca usa empresa, sempre usa PF
Solução: Onboarding explicando delegações
```

### Tipo 3: Saldo Zerado

```
Problema: Usuário gasta tudo, não consegue fazer nada
Sintoma: Todas transações negadas com "saldo insuficiente"
Solução: Reset parcial OU aviso de saldo baixo
```

### Tipo 4: Permissions Faltando

```
Problema: Ação deveria funcionar mas dá 403
Sintoma: Logs mostram permission ausente
Solução: Adicionar permission ao mapa v1.1
```

---

## 📋 CHECKLIST DE VALIDAÇÃO DIÁRIA

### Durante Piloto (Diário)

```
[ ] Sistema está UP (health check)
[ ] Nenhum erro 500 nos logs
[ ] Backup foi feito
[ ] Participantes usaram (mínimo 1 ação cada)
[ ] Ler logs de autorização (denied actions)
[ ] Ler logs de Bank (transações)
[ ] Perguntar aos participantes: "Travou em algum ponto?"
```

### Ao Final do Piloto (1-2 semanas)

```
[ ] Todos fluxos testados
[ ] Lista de problemas reais gerada
[ ] Lista de UX confusa gerada
[ ] Métricas coletadas
[ ] Decisão: continuar, ajustar, ou pivotar
```

---

## 🎯 CRITÉRIOS DE SUCESSO

### Mínimo Aceitável

```
✅ 5+ pessoas usaram
✅ 3+ delegações funcionaram
✅ 10+ posts publicados
✅ 1+ evento criado
✅ 5+ transações no Bank
✅ Zero crashes
✅ Zero data loss
```

### Ideal

```
✅ Usuários entenderam "atuando como"
✅ Nenhuma confusão sobre permissões
✅ Economia fez sentido (splits claros)
✅ Backlog real gerado (5-10 itens)
✅ Participantes querem continuar usando
```

---

## 🔄 APÓS O PILOTO

### Se Sucesso (Continuar)

```
1. Incorporar feedback (ajustes pequenos)
2. Adicionar PIX (pagamentos reais)
3. Preparar piloto externo (50-100 pessoas)
4. Definir governança (assembleia, votações)
```

### Se Falha (Ajustar)

```
1. Identificar causa raiz (UX? Contrato? Bugs?)
2. Ajustar e resetar (novo piloto interno)
3. Não prosseguir até resolver
```

### Se Confusão (Pivotar)

```
1. Contrato institucional está errado?
2. Delegação é muito complexa?
3. Economia não faz sentido?
4. Repensar decisões estruturais
```

---

## 📊 DASHBOARD DE OBSERVAÇÃO

### Métricas Simples (Google Sheets)

```
Colunas:
- Data
- Usuário
- Ação (post, evento, transferência)
- Ator (PF ou empresa)
- Resultado (sucesso, 403, 500)
- Comentário (se houve problema)

Atualização: Diária
Responsável: Admin/Observador
```

---

## 🎯 STATUS FINAL DO CHECKLIST

```
Pré-requisitos:
[ ] P0 - Bug middleware corrigido
[ ] P0 - Mapa permissions integrado
[ ] P0 - Migrations rodadas
[ ] P0 - Sistema buildando
[ ] P1 - Ambiente isolado
[ ] P1 - Backup automático
[ ] P1 - Logs estruturados
[ ] P1 - Monitoramento básico

Participantes:
[ ] 5-10 pessoas identificadas
[ ] Expectativas alinhadas (é teste!)
[ ] Disponibilidade confirmada

Configuração:
[ ] Environment variables
[ ] Seed rodado
[ ] Script de reset testado

Módulos:
[ ] Auth ✅
[ ] Feed ✅
[ ] Bank ✅
[ ] Companies ✅
[ ] Events ✅ (escolhido)
[ ] Groups ✅

Fluxos a testar:
[ ] Delegação básica
[ ] Economia passiva
[ ] Grupo & votação

Observação:
[ ] Dashboard de métricas criado
[ ] Checklist diário definido
[ ] Critérios de sucesso claros
```

---

**PRÓXIMO PASSO: Corrigir P0 (bug middleware) → Rodar seed → ATIVAR** 🚀

---

**Este checklist é a ponte entre código pronto e uso real. Sem atalhos. Sem inventar. Apenas ativação disciplinada.** ✅
