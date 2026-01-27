# 🎭 Modo de Atuação do Feed

## Conceito Oficial

**O seletor no HeaderGlobal define o "Modo de Atuação do Feed".**
Não é só quem publica. É **como o mundo inteiro se comporta**.

## 🧠 Fonte Única da Verdade

```ts
ActiveActorContext
```

Define:
- `activeActor.actor_type` → `'user' | 'page'`
- `activeActor.actor_id`
- `activeActor.permissions` (futuro)

## 🎭 Dois Modos, Um Sistema

### 👤 MODO PESSOA FÍSICA (CPF)

**Quando:** `activeActor.actor_type === 'user'`

**Feed prioriza:**
- Conteúdo social
- Pessoas
- Grupos abertos
- Impacto individual

**Ações disponíveis:**
- Curtir como pessoa
- Comentar como pessoa
- Entrar em grupos como pessoa

**Linguagem do sistema:**
- "Você apoiou…"
- "Sua participação gerou impacto…"

📌 **Tudo é pessoal, social e cidadão.**

---

### 🏢 MODO PESSOA JURÍDICA (CNPJ)

**Quando:** `activeActor.actor_type === 'page'`

**Feed prioriza:**
- Grupos institucionais
- Projetos
- Votações
- Impacto coletivo

**Ações disponíveis:**
- Postar como empresa
- Apoiar projetos
- Entrar em grupos como entidade

**Linguagem do sistema:**
- "Empresa X apoiou…"
- "A organização gerou impacto…"

📌 **Tudo é institucional, estratégico e público.**

---

## 🔁 O Que Muda Automaticamente

Quando `activeActor` muda, **tudo isso muda junto**:

✅ **Implementado:**
- Autor de posts → Sempre usa `activeActor.actor_id`
- Feed recarrega → Evento `active-actor-changed`
- Composer mostra ator → Indicador informativo

⏳ **Pendente:**
- Tipo de feed carregado → Precisa filtrar por `actor_type`
- Tipos de ação disponíveis → Precisa validar permissões
- Texto da UI → Precisa adaptar linguagem
- Impacto contabilizado → Precisa separar por ator
- Regras de votação → Precisa validar por tipo
- Permissões → Precisa implementar sistema

---

## ❌ O Que NÃO Pode Existir

- ❌ Feed "neutro"
- ❌ Post perguntando "publicar como?"
- ❌ Toggle dentro do feed
- ❌ Ação que não sabe quem está atuando

---

## ✅ O Que É Permitido

- ✅ Indicador visual discreto: "Publicando como **Empresa X**"
- ✅ Feed reagir automaticamente ao trocar ator
- ✅ Cache separado por ator (futuro)

---

## 🛠️ Próximos Passos

1. **Diferenças exatas de feed PF vs PJ**
   - Backend precisa receber `actor_type` no `getSocialFeed`
   - Filtrar/priorizar conteúdo baseado no tipo
   - Implementar lógica de priorização diferente

2. **Regras de impacto por ator**
   - Impacto individual vs coletivo
   - Contabilização separada
   - Ledger por ator

3. **Ações reais com saldo**
   - Curtir gera impacto (com saldo)
   - Post gera evento no feed
   - Entrar em grupo gera rastro social

---

## 🧠 Frase que Define o Produto

> **No Unificard, você não posta. Você atua.**


























