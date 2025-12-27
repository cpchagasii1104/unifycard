# 🎯 PILOTO REAL — CHECKLIST OPERACIONAL

**Data de início:** _______________  
**Duração prevista:** 7-14 dias (ou até 3 eventos completos)  
**Operador:** Clayton Pereira Chagas (override ativo)  
**Objetivo:** Observar comportamento real, identificar fricções, validar UX de eventos

---

## 📋 FASE 1 — PREPARAÇÃO (ANTES DO PILOTO)

### ✅ Checklist Técnico

- [ ] **Backend rodando estável**
  - [ ] Health check: `GET /health` retorna 200
  - [ ] Logs sem erros críticos
  - [ ] Banco de dados migrado e consistente

- [ ] **Frontend acessível**
  - [ ] URL de acesso definida e testada
  - [ ] Login funcionando (Clayton + usuários de teste)
  - [ ] Feed carregando corretamente

- [ ] **Override de teste ativo**
  - [ ] `backend/src/config/testOverrideUsers.ts` contém `user_id` do Clayton
  - [ ] Verificado: Clayton consegue criar empresas, grupos, eventos sem restrições

- [ ] **Eventos preparados**
  - [ ] 2-3 eventos criados no sistema (status: PUBLISHED)
  - [ ] Eventos têm: título, descrição, data/hora, local (PAC), split de receita
  - [ ] Eventos aparecem no feed corretamente

### ✅ Checklist Operacional

- [ ] **Usuários de teste identificados**
  - [ ] Lista de 20-200 pessoas por evento
  - [ ] Credenciais de acesso preparadas (ou fluxo de registro testado)
  - [ ] Instruções básicas enviadas (opcional, para não viciar)

- [ ] **Eventos reais selecionados**
  - [ ] Preferência: bar com música ao vivo, casa noturna, ou evento recorrente
  - [ ] Eventos têm data/hora real nos próximos 7-14 dias
  - [ ] Organizadores/parceiros cientes do piloto

- [ ] **Canais de observação preparados**
  - [ ] Logs do backend configurados (nível INFO+)
  - [ ] Analytics básico (se disponível) ou logs manuais
  - [ ] Canal de feedback (WhatsApp, email, ou similar)

---

## 📊 FASE 2 — EXECUÇÃO (DURANTE O PILOTO)

### 🚫 REGRA ABSOLUTA: NÃO MEXER NO CÓDIGO

Durante o piloto:
- ❌ **Não refatorar feed**
- ❌ **Não mudar pesos de priorização**
- ❌ **Não adicionar features novas**
- ❌ **Não "corrigir" por ansiedade**
- ❌ **Não ajustar UI baseado em suposição**

**Tudo que parecer estranho → ANOTAR, não alterar.**

### 👀 O QUE OBSERVAR (FRAMEWORK DE LEITURA)

#### 1️⃣ ENTENDIMENTO (Sem explicação)

**Perguntas-chave:**
- As pessoas entendem o evento no feed sem explicação?
- O card chama atenção naturalmente?
- O que elas perguntam primeiro?

**Como observar:**
- [ ] Anotar perguntas recebidas (WhatsApp, email, presencial)
- [ ] Observar tempo até primeiro clique/interação
- [ ] Registrar confusões recorrentes

**Métricas simples:**
- Tempo médio até primeiro clique no evento
- Taxa de perguntas sobre "o que é isso?"
- Taxa de abandono na primeira visualização

---

#### 2️⃣ COMPORTAMENTO (Ações naturais)

**Perguntas-chave:**
- Compartilham sem incentivo?
- Comentam?
- Clicam para ver detalhes?
- Curtem eventos?

**Como observar:**
- [ ] Contar shares/compartilhamentos
- [ ] Contar comentários (se houver)
- [ ] Contar cliques em "Ver detalhes"
- [ ] Contar reações (likes)

**Métricas simples:**
- Taxa de compartilhamento (shares / visualizações)
- Taxa de clique em detalhes (cliques / visualizações)
- Taxa de reação (likes / visualizações)
- Taxa de comentário (comentários / visualizações)

---

#### 3️⃣ RETORNO (Engajamento contínuo)

**Perguntas-chave:**
- Voltam no app depois do evento?
- Olham outros eventos?
- Interagem com outros conteúdos?

**Como observar:**
- [ ] Verificar logins pós-evento (24h, 48h, 7 dias)
- [ ] Contar visualizações de outros eventos
- [ ] Contar interações com feed geral

**Métricas simples:**
- Taxa de retorno (logins pós-evento / participantes)
- Taxa de exploração (outros eventos visualizados)
- Taxa de engajamento geral (ações / visualizações)

---

#### 4️⃣ FRICÇÕES (Onde param?)

**Perguntas-chave:**
- Onde param?
- Onde perguntam?
- Onde travam?
- O que não funciona como esperado?

**Como observar:**
- [ ] Anotar pontos de abandono (logs de navegação)
- [ ] Registrar erros reportados
- [ ] Anotar feedback negativo
- [ ] Identificar padrões de confusão

**Métricas simples:**
- Taxa de abandono por tela (abandonos / acessos)
- Taxa de erro reportado (erros / usuários)
- Tempo médio até abandono

---

### 📝 TEMPLATE DE ANOTAÇÃO DIÁRIA

**Data:** _______________  
**Evento:** _______________  
**Participantes estimados:** _______________

**Entendimento:**
- Perguntas recebidas: _______________
- Confusões identificadas: _______________
- Tempo até primeiro clique: _______________

**Comportamento:**
- Shares: _______________
- Cliques em detalhes: _______________
- Reações: _______________
- Comentários: _______________

**Retorno:**
- Logins pós-evento (24h): _______________
- Visualizações de outros eventos: _______________

**Fricções:**
- Pontos de abandono: _______________
- Erros reportados: _______________
- Feedback negativo: _______________

**Observações gerais:**
_______________
_______________

---

## 📈 FASE 3 — ANÁLISE (APÓS O PILOTO)

### ✅ Checklist de Consolidação

- [ ] **Dados coletados**
  - [ ] Todas as anotações diárias consolidadas
  - [ ] Métricas simples calculadas
  - [ ] Logs do backend revisados

- [ ] **Padrões identificados**
  - [ ] Fricções recorrentes
  - [ ] Comportamentos inesperados
  - [ ] Oportunidades de melhoria

- [ ] **Decisões tomadas**
  - [ ] O que ajustar na Fase 17 (Check-in QR)
  - [ ] O que ajustar no feed
  - [ ] O que ajustar na UX geral

### 🎯 PRÓXIMOS PASSOS (BASEADOS EM DADOS REAIS)

Com os dados do piloto, definir:

1. **Fase 17 — Check-in QR**
   - Modal certo (baseado em onde pessoas param)
   - Mensagem certa (baseado em perguntas recebidas)
   - Timing certo (baseado em comportamento observado)
   - Fluxo certo (baseado em fricções identificadas)

2. **Ajustes no Feed**
   - Priorização (se necessário)
   - Visual (se necessário)
   - Interações (se necessário)

3. **Ajustes na UX Geral**
   - Onboarding (se necessário)
   - Navegação (se necessário)
   - Feedback (se necessário)

---

## 🧠 FRASE-GUIA DO PILOTO

> **Não estamos testando se funciona.  
> Estamos aprendendo como pessoas reais usam.**

---

## 📌 CONTATOS E RECURSOS

**Operador:** Clayton Pereira Chagas  
**Canal de feedback:** _______________  
**Logs do backend:** `backend/logs/`  
**Analytics (se disponível):** _______________

---

**Última atualização:** _______________













