# Contexto do Projeto Unificard

## Visão Geral do Unificard

O Unificard é um sistema global de identidade, trabalho, serviços, economia e reputação. Ele unifica em um único ecossistema:

- **Rede social**
- **Marketplace de serviços e trabalhos (Work)**
- **Eventos e staff (Events)**
- **Mobilidade (Rides)** – futuro
- **Comércio/marketplace (Commerce)** – futuro
- **CRM** (relacionamento com clientes)
- **ERP-lite** (estoque básico, produtos, serviços)
- **Banco digital / wallet (UnifyBank)**

## Conceito Central

Cada pessoa tem um **UnifyCard ID** que funciona como:

- **Identidade pessoal**
- **Identidade profissional**
- **Identidade financeira (wallet)**
- **Identidade reputacional**

Pessoas jurídicas (empresas/tenants) também entram no sistema e se conectam a pessoas físicas.

## Eixo de Domínio (Macro)

### GEO
- País → Estado → Cidade (usamos "Cidade Nova" como modelo mental, mas o sistema é global).

### USUÁRIOS
- **Pessoa física**: consumidor, trabalhador, profissional, social.
- **Pessoa jurídica**: empresa/tenant (loja, bar, casa de show, mercado, etc.).

## Módulos Principais do Backend (Alvo Atual)

### Core (`/core`)
- **core/auth**: autenticação, sessões, tokens.
- **core/identity**: UnifyCard ID, perfis, vínculos PF↔PJ.
- **core/economy**: contas, transações, ledger, integração com gateway de pagamento (sem virar banco agora).
- **core/reviews**: avaliações genéricas.
- **core/reputation**: reputação em 3 camadas:
  - `work_reputation` → desempenho em trabalho
  - `behavior_reputation` → comportamento geral (pontualidade, comunicação etc.)
  - `credit_reputation` → confiabilidade financeira (pagamentos, crediário etc.)
- **core/notifications**: email, SMS, push.
- **core/crm**: contatos, empresas, relacionamento.
- **core/erp-lite**: produtos, serviços, estoque simples.

### Módulos (`/modules`)
- **modules/work**:
  - vagas, candidaturas, assignments, check-in/out, pagamento e avaliação de staff.
- **modules/events**:
  - eventos, escalas de staff, ligação com módulo Work.
- **modules/commerce** (futuro): catálogo de produtos, pedidos.
- **modules/rides** (já existe parcialmente): mobilidade, corridas, pricing.
- **modules/delivery** (futuro).

## Frontend (Visão de Telas)

- `/auth`: login/cadastro.
- `/dashboard`: visão geral do usuário.
- `/work`: vagas e histórico de trabalhos.
- `/events`: eventos, escalas e staff.
- `/company`: painel de empresa (tenant).
- `/wallet`: finanças do usuário.
- `/profile`: dados pessoais/profissionais, UnifyCard.
- `/admin/system`: painel de administração do ecossistema (futuro).

## Prioridades do MVP Agora

### 1) Consolidar o backend existente:
- Garantir que TypeScript compila (`tsc --noEmit`).
- Garantir que módulos atuais (especialmente Work, Economy, Reputation) funcionam.
- Organizar estrutura de pastas em:
  - `core/`
  - `modules/`

### 2) MVP funcional focado em **Work + Events** em "Cidade Nova":
- Empresa cria evento.
- Define vagas de staff via módulo Work.
- Trabalhadores se candidatam.
- Empresa aprova.
- Staff faz check-in/out.
- Pagamento registrado em Economy.
- Reputação atualizada em Reputation.

## Regras para Gerar Código

- **Linguagem backend**: TypeScript (Node.js) — reaproveitar o que já existe no projeto.
- **Banco**: PostgreSQL multi-tenant com RLS (não quebrar isso).
- **Estrutura de projeto**:
  - `/core`: coisas genéricas e reutilizáveis.
  - `/modules`: funcionalidades de negócio específicas.
- **Sempre considerar**:
  - multi-tenant (tenant/empresa sempre que for dado de negócio)
  - contexto de usuário (pessoa física vs empresa)
  - impacto em reputação e economy.

## Observações sobre a Estrutura Atual

A estrutura atual do projeto está bem alinhada com a descrição acima:

- ✅ `src/core/` contém: auth, economy, reputation, reviews, notify, rbac, tenants, config, database, db, errors, events, health, plugins, types
- ✅ `src/modules/` contém: work, rides
- ✅ `src/plugins/` contém: error-handler, rbac, tenant
- ✅ `src/shared/` contém: middleware

**Módulos mencionados que ainda não existem** (futuro):
- `core/identity` (UnifyCard ID específico)
- `core/crm`
- `core/erp-lite`
- `modules/events` (ainda não implementado)
- `modules/commerce`
- `modules/delivery`
















