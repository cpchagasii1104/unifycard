# Override de Acesso Total — Usuários de Teste

## 🎯 Objetivo

Conceder **acesso ilimitado ao sistema** (empresas, grupos, eventos, páginas, permissões avançadas) **apenas** para **usuários específicos**, identificados por `user_id` **apenas no banco**, **sem criar role global**, **sem afetar novos usuários** e **sem quebrar regras estruturais do sistema**.

Esse override é **exclusivo para testes** e deve ser **facilmente removível no futuro**.

---

## ⚠️ REGRA ABSOLUTA

* ❌ NÃO usar CPF em regras de código
* ❌ NÃO criar role `admin`, `superuser` ou similares
* ❌ NÃO liberar permissões globalmente
* ❌ NÃO burlar impacto, ledger ou auditoria
* ❌ NÃO usar email ou nome como critério

✅ O override **só pode ser feito por `user_id`**.

---

## 🧱 Como Adicionar um Usuário de Teste

### ETAPA 1 — Resolver o USER_ID (BANCO)

Rodar **uma única vez** no banco:

```sql
SELECT id, name, cpf
FROM users
WHERE cpf = '03132549908';
```

Copiar o `id` retornado.

> Exemplo fictício (substitua pelo real):

```txt
USER_ID = "9f2c3b7a-4a1e-4c9e-bd12-8b3d9a4d1234"
```

⚠️ A PARTIR DAQUI, O CPF **NÃO É MAIS USADO**.

---

### ETAPA 2 — Adicionar na Allowlist

Editar o arquivo:

```ts
// backend/src/config/testOverrideUsers.ts

export const TEST_OVERRIDE_USER_IDS: string[] = [
  '9f2c3b7a-4a1e-4c9e-bd12-8b3d9a4d1234' // Clayton Pereira Chagas
];
```

---

## 🔐 O Que o Override Permite

### Para Usuários de Teste:

* ✅ Acesso total ao sistema
* ✅ Pode testar todos os fluxos
* ✅ Pode criar e acessar qualquer entidade
* ✅ Pode simular cenários reais
* ✅ Bypass de limites (ex: 3 empresas PROVISIONAL)
* ✅ Bypass de validações de ownership
* ✅ Bypass de permissões de reputação

### Para Qualquer Outro Usuário:

* ✅ Sistema funciona **exatamente como projetado**
* ✅ Reputação, validação e restrições intactas

---

## 🚫 O Que o Override NÃO Permite

Mesmo com override:

* ✅ Impacto continua sendo registrado
* ✅ Ledger continua obrigatório
* ✅ Auditoria continua ativa
* ✅ Logs e eventos continuam sendo gravados
* ❌ Nada entra "por fora" do sistema

👉 É **supervisão total**, não corrupção de dados.

---

## 🧱 Pontos de Aplicação

O override está aplicado em:

1. **Empresas:**
   - `listCompanies()`: Retorna todas as empresas (sem filtro de ownership)
   - `getCompanyById()`: Ignora verificação de ownership
   - `createCompany()`: Bypassa limite de 3 empresas PROVISIONAL

2. **Grupos:** (a implementar)
   - `listGroups()`: Retorna todos os grupos
   - `getUserGroups()`: Retorna todos os grupos
   - `getGroup()`: Ignora verificação de membership

3. **Eventos Culturais:** (a implementar)
   - `createCulturalEvent()`: Bypassa validações de permissão
   - `listCulturalEvents()`: Retorna todos os eventos

4. **Posts e Feed:** (a implementar)
   - `createPost()`: Bypassa validações de permissão
   - `getFeed()`: Retorna feed completo

---

## 🧠 Remover Override

Para remover o override:

1. Abrir `backend/src/config/testOverrideUsers.ts`
2. Remover o `user_id` da lista
3. Salvar

O sistema volta ao comportamento normal **imediatamente**.

---

## 📌 Notas Importantes

* O override é **centralizado** em `isTestOverrideUser()`
* Fácil de remover (apenas editar array)
* Nenhum efeito colateral
* Nenhuma brecha aberta
* Totalmente auditável (logs continuam funcionando)

---

## 🧠 Frase-Guia

> **"Override de teste é bisturi, não marreta."**













