# Checklist de Smoke Test - Grupos

## Pré-requisitos

1. Backend rodando (`npm run dev`)
2. Frontend rodando (`npm run dev`)
3. Seed executado com sucesso (`npm run seed:dev-groups`)

## Credenciais de Teste

- **Usuário Owner:**
  - Email: `user_owner@unificard.local`
  - Senha: `123456`

- **Usuário Member:**
  - Email: `user_member@unificard.local`
  - Senha: `123456`

---

## Teste 1: Login e Visualização de Grupos

### Como usuário_owner:

1. ✅ Fazer login com `user_owner@unificard.local`
2. ✅ Verificar que aparece na lista "Meus Grupos":
   - Grupo Público de Teste
   - Grupo Privado de Teste
   - Grupo Secreto de Teste
3. ✅ Clicar em cada grupo e verificar:
   - Nome correto
   - Descrição correta
   - Visibilidade correta (público/privado/secreto)
   - Categoria atribuída

---

## Teste 2: Feed de Grupo Público

### Como user_member:

1. ✅ Fazer login com `user_member@unificard.local`
2. ✅ Acessar o grupo público (deve aparecer na lista)
3. ✅ Verificar que o feed do grupo mostra:
   - Post criado pelo owner: "Este é um post de teste no grupo público!"
4. ✅ Verificar que pode criar novo post no grupo
5. ✅ Verificar que o post aparece no feed do grupo

---

## Teste 3: Solicitação de Entrada em Grupo Privado

### Como user_member:

1. ✅ Tentar acessar o grupo privado
2. ✅ Verificar que aparece botão "Solicitar Entrada" (não "Entrar")
3. ✅ Clicar em "Solicitar Entrada"
4. ✅ Verificar que aparece mensagem de sucesso
5. ✅ Verificar que status muda para "Solicitação Pendente"

### Como user_owner:

1. ✅ Fazer login com `user_owner@unificard.local`
2. ✅ Acessar o grupo privado
3. ✅ Ir na aba "Membros" ou "Solicitações"
4. ✅ Verificar que aparece solicitação de `user_member`
5. ✅ Clicar em "Aprovar"
6. ✅ Verificar que `user_member` agora é membro

### Como user_member (após aprovação):

1. ✅ Fazer login novamente
2. ✅ Verificar que agora pode acessar o grupo privado
3. ✅ Verificar que pode ver o feed do grupo privado
4. ✅ Verificar que pode criar posts no grupo privado

---

## Teste 4: Convite para Grupo Secreto

### Como user_owner:

1. ✅ Acessar o grupo secreto
2. ✅ Ir na aba "Convites" ou "Membros"
3. ✅ Verificar que existe convite pendente para `user_member`
4. ✅ Verificar status do convite: "pending"

### Como user_member:

1. ✅ Fazer login com `user_member@unificard.local`
2. ✅ Ir na página de "Convites" ou "Inbox"
3. ✅ Verificar que aparece convite do grupo secreto
4. ✅ Clicar em "Aceitar Convite"
5. ✅ Verificar que agora pode acessar o grupo secreto
6. ✅ Verificar que aparece como membro do grupo

---

## Teste 5: Feed Global vs Feed de Grupo

### Como user_member:

1. ✅ Acessar feed global (página inicial)
2. ✅ Verificar que aparece:
   - ✅ Post do grupo público (visível)
   - ❌ Post do grupo privado (NÃO deve aparecer - não é membro ainda ou grupo é privado)
   - ❌ Post do grupo secreto (NÃO deve aparecer - grupo secreto nunca vaza)
3. ✅ Acessar feed do grupo público
4. ✅ Verificar que aparece apenas posts do grupo público

---

## Teste 6: Evento Vinculado a Grupo

### Como user_owner:

1. ✅ Acessar o grupo público
2. ✅ Verificar que aparece evento: "Evento de Teste no Grupo Público"
3. ✅ Clicar no evento e verificar:
   - Título correto
   - Descrição correta
   - Data/hora futura (7 dias)
   - Vinculado ao grupo público

### Como user_member:

1. ✅ Acessar o grupo público
2. ✅ Verificar que também vê o evento
3. ✅ Verificar que pode interagir com o evento

---

## Teste 7: Validações de Governança

### Como user_member (sem ser membro do privado):

1. ✅ Tentar criar post no grupo privado
2. ✅ Verificar que é bloqueado (mensagem de erro clara)

### Como user_member (sem ser membro do secreto):

1. ✅ Tentar acessar grupo secreto diretamente pela URL
2. ✅ Verificar que é bloqueado (404 ou acesso negado)

### Como user_owner:

1. ✅ Tentar criar segundo convite para user_member no grupo secreto
2. ✅ Verificar que é bloqueado (convite já existe)

---

## Teste 8: Categorias e Localização

### Como user_owner:

1. ✅ Acessar qualquer grupo
2. ✅ Verificar que categoria está atribuída corretamente
3. ✅ Verificar que localização (nacional) está correta
4. ✅ Tentar editar grupo e verificar:
   - Categoria não pode ser alterada (imutável)
   - Localização pode ser alterada (se permitido)

---

## Resultado Esperado

✅ **Todos os testes devem passar sem erros**

❌ **Se algum teste falhar:**
- Anotar qual teste falhou
- Anotar mensagem de erro (se houver)
- Verificar logs do backend
- Verificar console do browser

---

## Notas

- Seed é idempotente: pode rodar múltiplas vezes sem quebrar
- Dados são criados no tenant DEV: `fbe13b78-4516-493d-905a-363796aea1d1`
- Todos os usuários têm senha: `123456`
- Todos os grupos têm scope: `national`




