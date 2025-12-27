# 📰 VALIDAÇÃO UX DO FEED COM EVENTOS CULTURAIS
## FASE 16 — Opção 1: Validação de UX

---

## 🎯 OBJETIVO

Validar como o feed se comporta visual e funcionalmente quando **eventos culturais** entram em cena. Isso vira **critério de aceite** para tudo que vem depois.

---

## 🧠 REGRA-MÃE DO FEED (REFORÇADA)

> **O feed é único, mas o cartão (card) muda conforme o tipo de conteúdo e o ator ativo.**

Evento cultural **não é post comum** — ele é um **post enriquecido**.

---

## 📰 TIPOS DE CARDS NO FEED (OFICIAL)

### 1️⃣ Card Social (Post Comum)

**Estrutura:**
- Autor (PF / PJ / PAC) — avatar + nome
- Texto / mídia
- Ações: Curtir · Comentar · Compartilhar
- Timestamp
- Engajamento (contadores)

**Priorização:**
- Baseada em relevância social (amigos, grupos, páginas)
- Engajamento (curtidas, comentários, compartilhamentos)
- Recência

---

### 2️⃣ **Card de Evento Cultural (PAC)** ⭐️ NOVO

**Estrutura obrigatória:**

#### Cabeçalho
- 🎭 **Criador (PAC):** Avatar + nome do perfil cultural (ex: "Banda Rock Nacional")
- 📍 **Local (PAC):** Nome do bar/casa/círculo (se confirmado) — badge "Confirmado"
- 🗓️ **Data/Hora:** Formato legível (ex: "25/12/2025 às 20h")
- 🎪 **Tipo de Evento:** Badge (SHOW, OFICINA, FESTIVAL, etc.)

#### Corpo
- **Título do evento** (destaque)
- **Descrição** (truncada se muito longa, com "Ver mais")
- **Status visual:**
  - DRAFT → badge cinza "Rascunho"
  - PUBLISHED → badge azul "Publicado"
  - CONFIRMED → badge verde "Confirmado"
  - COMPLETED → badge verde escuro "Aconteceu"

#### Split Percentual (Sempre Visível)
- **"Distribuição de Impacto:"**
  - Lista compacta: "60% Artista | 20% Local | 10% Região | 10% Fundo"
  - Ou visual: barras horizontais pequenas
- 🌱 **Impacto Regional:** "X% volta para sua região" (se aplicável)

#### Rodapé
- ❤️ **Curtir** (gera impacto)
- 💬 **Comentar**
- 🔁 **Compartilhar** (peso alto na priorização)
- 👀 **Ver detalhes** (abre modal/página completa)
- 📌 **Salvar** (opcional, Fase futura)

**Regras visuais:**
- Card **maior** que post comum (mas não exagerado)
- Borda sutil ou background diferenciado
- Ícones claros e consistentes
- **Nada de "Comprar ingresso" ainda** (Fase 18)

---

## 🎛️ PRIORIDADE VISUAL (FEED ADAPTATIVO)

### 👤 Ator Ativo: **Pessoa Física (PF)**

**Eventos sobem se:**
- ✅ Próximos geograficamente (mesma cidade/região)
- ✅ Com impacto regional alto
- ✅ Curtidos/compartilhados por amigos
- ✅ De grupos que o usuário participa
- ✅ Tipo de evento alinhado com histórico (ex: se curte shows, shows sobem)

**Sensação desejada:**
> "Tem coisa acontecendo perto de mim."

**Card adaptado:**
- Destaque para **localização** e **data**
- Badge "Próximo de você" se aplicável
- Contador "X amigos vão" (se implementado)

---

### 🎭 Ator Ativo: **PAC (Artista / Banda)**

**Eventos sobem se:**
- ✅ De outros artistas (circuito cultural)
- ✅ Casas confirmando eventos (oportunidades)
- ✅ Eventos procurando artista/banda
- ✅ Eventos com bom engajamento
- ✅ Eventos de mesmo tipo cultural

**Sensação desejada:**
> "Tem circuito rolando."

**Card adaptado:**
- Destaque para **criador (outro PAC)**
- Badge "Oportunidade" se evento está procurando artista
- Contador "X pessoas interessadas"

---

### 🏢 Ator Ativo: **Bar / Casa (PAC)**

**Eventos sobem se:**
- ✅ Procurando local (oportunidade de hospedar)
- ✅ Com bom engajamento (público garantido)
- ✅ De artistas recorrentes
- ✅ Datas próximas disponíveis
- ✅ Tipo de evento compatível com o espaço

**Sensação desejada:**
> "Aqui dá pra programar agenda."

**Card adaptado:**
- Destaque para **"Procurando local"** se aplicável
- Badge "Confirmar local" (ação rápida)
- Contador "X pessoas interessadas"

---

## 👥 GRUPOS + FEED (UX FECHADA)

### Post de Evento dentro de Grupo

**Comportamento:**
- ✅ **Forte para membros:** Aparece no topo do feed do grupo
- ✅ **Fraco fora:** Não aparece no feed geral (a menos que compartilhado)

**Card no grupo:**
- Badge "No grupo [Nome]"
- Ações: Curtir · Comentar · Compartilhar (escapa do grupo)

---

### Compartilhamento de Evento

**Quando alguém compartilha:**
- ✅ Evento "escapa" do grupo/página
- ✅ Entra no feed geral como:
  > **"Compartilhado por [Fulano] do grupo [X]"**
- ✅ Mantém link para o evento original
- ✅ Priorização alta (compartilhar = sinal forte)

**Card compartilhado:**
- Header adicional: "Compartilhado por [Nome]"
- Evento original visível abaixo
- Ações: Curtir · Comentar · Compartilhar novamente

---

## 📄 PÁGINAS + FEED

### Página de Banda/Bar/Casa

**Feed próprio:**
- ✅ Cronológico (eventos + posts da página)
- ✅ Visível para seguidores
- ✅ Compartilhável para feed geral

**Feed geral:**
- ✅ Priorização por:
  - Engajamento (curtidas, comentários, compartilhamentos)
  - Contexto (relevância para o ator ativo)
  - Recência (mas não é o único fator)

**Regra:**
- Página = **fonte** (cria conteúdo)
- Feed = **distribuição inteligente** (prioriza por contexto)

---

## ❤️ ENGAJAMENTO — PESOS (SILENCIOSOS)

**Peso lógico (já alinhado com backend):**

| Ação | Peso | Impacto |
|------|------|---------|
| Curtir | +1 | Priorização baixa |
| Comentar | +2 | Priorização média |
| Compartilhar | +5 | Priorização alta |
| Compartilhar de grupo | +7 | Priorização muito alta |

**Regra:**
- ❌ **Não é gamificação visível** (sem scores, sem badges de "power user")
- ✅ **É priorização silenciosa** (conteúdo sobe/desce no feed)

---

## ✅ CHECKLIST DE VALIDAÇÃO UX

### Antes de seguir para qualquer outra fase, o feed precisa responder "sim" para:

#### 1. Visibilidade e Atenção
- [ ] Um evento cultural **chama atenção visualmente** sem parecer anúncio?
- [ ] O card de evento é **diferente o suficiente** de um post comum?
- [ ] O card não é **muito grande** (não domina o feed)?
- [ ] O card não é **muito pequeno** (não passa despercebido)?

#### 2. Clareza de Informação (2 segundos)
- [ ] Dá pra entender **quem toca** em 2 segundos?
- [ ] Dá pra entender **onde** em 2 segundos?
- [ ] Dá pra entender **quando** em 2 segundos?
- [ ] Dá pra entender **qual o impacto** em 2 segundos?
- [ ] O split percentual é **visível mas não polui**?

#### 3. Ações e Interação
- [ ] As ações (Curtir, Compartilhar, Ver detalhes) são **claras**?
- [ ] Compartilhar um evento **faz ele viajar** pelo feed?
- [ ] Compartilhar de grupo **escapa corretamente** para feed geral?
- [ ] As ações geram **feedback visual imediato**?

#### 4. Adaptação por Ator Ativo
- [ ] PF, artista e bar **veem o mesmo evento com sentidos diferentes**?
- [ ] A priorização visual **reflete o contexto** do ator ativo?
- [ ] O card **adapta informações** conforme o ator (ex: PF vê "Próximo de você")?

#### 5. Integração com Grupos e Páginas
- [ ] Evento postado em grupo **aparece forte para membros**?
- [ ] Evento compartilhado de grupo **aparece no feed geral**?
- [ ] Página de banda/bar **tem feed próprio**?
- [ ] Posts de página **entram no feed geral** com priorização correta?

#### 6. Performance e Responsividade
- [ ] O feed **carrega rápido** mesmo com muitos eventos?
- [ ] O card de evento **funciona bem em mobile**?
- [ ] As imagens/ícones **não quebram o layout**?

---

## 🔜 PRÓXIMOS PASSOS (APÓS VALIDAÇÃO)

1. ✅ **Opção 1 — Feed** (agora)
2. 🟡 **Opção 2 — Descoberta** (filtros, mapas, listas)
3. 🟢 **Fase 17 — Presença** (check-in, impacto real)
4. 🔵 **Fase 18 — Financeiro** (ingressos, escrow, split)

---

## 📌 IMPLEMENTAÇÃO TÉCNICA (REFERÊNCIA)

### Backend (Já implementado - Fase 16)
- ✅ `cultural_events` table
- ✅ `cultural_profiles` table
- ✅ Endpoints: `/cultural/events`, `/cultural/profiles`
- ✅ Integração com impacto e auditoria

### Frontend (A implementar)
- ⏳ Componente `CulturalEventCard.tsx`
- ⏳ Integração no `SocialFeed2.tsx`
- ⏳ Adaptação visual por `activeActor`
- ⏳ Ações de compartilhamento

---

## 🧠 FRASE FINAL

> **O feed não é só uma lista. É o motor de descoberta cultural do sistema.**

Se o feed estiver certo, tudo o resto funciona sozinho.













