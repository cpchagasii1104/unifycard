# ESTRUTURA DO MENU LATERAL - DOCUMENTAÇÃO

## REGRA CANÔNICA

**O menu lateral deve aparecer em TODAS as páginas, EXCETO:**
1. `/login` - Página de login
2. `/home` - Página home (onde aparecem todos os tipos de aplicações)

## IMPLEMENTAÇÃO ATUAL

### Layouts com Menu Lateral

1. **SocialLayout** (`components/layout/SocialLayout.tsx`)
   - Menu completo: SOCIAL, CONTA, FINANCEIRO
   - Usado para a maioria das rotas do sistema
   - Rotas dentro deste layout (linhas 232-309 do App.tsx):
     - `/social`, `/feed`
     - `/grupos`, `/grupos/:id`
     - `/convites`
     - `/eventos`, `/events/:id`, `/events/new`
     - `/servicos`
     - `/votacoes`
     - `/impacto`
     - `/perfil`
     - `/empresas`
     - `/assistant`
     - `/compromissos`
     - E muitas outras...

2. **BankLayout** (`components/layout/BankLayout.tsx`)
   - Menu completo: FINANCEIRO, SOCIAL, CONTA
   - Usado para rotas financeiras
   - Rotas dentro deste layout (linhas 311-328 do App.tsx):
     - `/banco`, `/bank`, `/unifycard`
     - `/extrato`
     - `/fundo-regional`
     - `/wallet`
     - `/transaction/:id`

3. **AdminLayout** (`components/layout/AdminLayout.tsx`)
   - Menu completo: CONTA, ADMINISTRATIVO, SOCIAL
   - Usado para rotas administrativas
   - Rotas dentro deste layout (linhas 330-359 do App.tsx):
     - `/dashboard`
     - `/empresas/:companyId/onboarding`
     - `/grupos/novo`
     - `/validation`
     - `/alerts`
     - `/payouts`
     - `/invoices`
     - E outras rotas administrativas...

### Páginas SEM Menu Lateral

1. **Login** (`/login`)
   - Rota pública (linha 169-171 do App.tsx)
   - Não usa layout
   - Menu lateral NÃO aparece ✅

2. **Home** (`/home`)
   - Rota protegida (linhas 192-200 do App.tsx)
   - Não usa layout
   - Menu lateral NÃO aparece ✅

## COMPONENTE DO MENU

O menu lateral está implementado em cada layout:

- **SocialLayout**: Menu com seções SOCIAL, CONTA, FINANCEIRO
- **BankLayout**: Menu com seções FINANCEIRO, SOCIAL, CONTA
- **AdminLayout**: Menu com seções CONTA, ADMINISTRATIVO, SOCIAL

Todos os layouts incluem:
- HeaderGlobal (cabeçalho superior)
- Sidebar (menu lateral esquerdo)
- Outlet (conteúdo da página)

## VERIFICAÇÃO

✅ **Todas as rotas protegidas (exceto `/home`) estão dentro de um layout com menu**
✅ **Login não tem menu (correto)**
✅ **Home não tem menu (correto)**
✅ **Todas as outras páginas têm menu lateral**

## PRÓXIMOS PASSOS

1. Customizar cada página individualmente (conforme solicitado)
2. Padronizar o menu lateral em todas as páginas
3. Garantir consistência visual e funcional

