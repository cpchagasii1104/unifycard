# TESTE DE FLUXO REAL: SERVICE ORDERS + AGENDA
## Simulação de Usuários Humanos

**Data:** 2025-01-XX  
**Objetivo:** Identificar fricções reais de UX sem sugerir novas features

---

## CENÁRIO 1: CLIENTE CRIA SERVICE ORDER

### Passo 1.1: Cliente acessa formulário de criação

**O que o usuário vê:**
- Tela "Nova Ordem de Serviço"
- Formulário com campos: ID do Serviço, ID do Funcionário, Data/Hora, etc.
- Botões: Cancelar, Criar Ordem

**O que ele entende:**
- ✅ Precisa preencher formulário
- ❌ **CONFUSÃO**: "ID do Serviço" e "ID do Funcionário" são UUIDs - usuário não sabe onde encontrar
- ❌ **FRICÇÃO**: Campos técnicos (UUID) não são amigáveis
- ❌ **FALTA**: Não há como buscar/selecionar serviço ou funcionário

**Observações:**
- Campo "ID do Serviço" exige que usuário saiba UUID de cor ou copie de outro lugar
- Campo "ID do Funcionário" exige conhecimento técnico
- Não há validação visual de se o serviço/funcionário existe
- Usuário pode errar UUID e só descobrir ao tentar criar

---

### Passo 1.2: Cliente preenche e submete

**O que o usuário vê:**
- Formulário preenchido
- Botão "Criar Ordem" clicado
- Toast: "Ordem de serviço criada com sucesso"
- Redirecionamento para página de detalhes

**O que ele entende:**
- ✅ Ordem foi criada
- ✅ Foi redirecionado para ver a ordem
- ⚠️ **AMBIGUIDADE**: Status "Rascunho" - não sabe se precisa fazer mais alguma coisa

**Observações:**
- Feedback positivo (toast + redirecionamento)
- Status "Rascunho" pode confundir - cliente pode pensar que precisa "publicar" algo

---

## CENÁRIO 2: FUNCIONÁRIO VISUALIZA ORDEM PENDENTE

### Passo 2.1: Funcionário acessa lista de ordens

**O que o usuário vê:**
- Tela "Ordens de Serviço"
- Filtro por status (Todas, Rascunho, Confirmadas, etc.)
- Lista de cards de ordens (se houver)
- Botão "Nova Ordem"

**O que ele entende:**
- ✅ Vê lista de ordens
- ⚠️ **FRICÇÃO**: Filtro padrão é "Todas" - se houver muitas ordens, precisa filtrar manualmente para ver pendentes
- ❌ **FALTA**: Não há indicação visual de quantas ordens pendentes existem
- ❌ **FALTA**: Não há badge/contador de "ordens aguardando confirmação"

**Observações:**
- Funcionário precisa saber que deve filtrar por "Rascunho" para ver pendentes
- Não há destaque visual para ordens que precisam de ação

---

### Passo 2.2: Funcionário visualiza card de ordem pendente

**O que o usuário vê:**
- Card com: "Ordem #abc12345", badge "Rascunho", Serviço (UUID parcial), Data/hora, Local (se houver)

**O que ele entende:**
- ✅ Vê que há uma ordem pendente
- ❌ **FRICÇÃO**: "Serviço: abc12345..." - não sabe qual serviço é (apenas UUID parcial)
- ❌ **FRICÇÃO**: Não vê nome do cliente, apenas UUID parcial
- ⚠️ **AMBIGUIDADE**: Não sabe se pode clicar no card (não há indicação visual clara)

**Observações:**
- Informações críticas (nome do serviço, nome do cliente) estão ausentes
- Apenas UUIDs parciais não são informativos
- Card é clicável mas não há hover state ou indicação clara

---

## CENÁRIO 3: FUNCIONÁRIO CONFIRMA ORDEM

### Passo 3.1: Funcionário acessa detalhes da ordem

**O que o usuário vê:**
- Tela de detalhes com: Status "Rascunho", Informações (IDs, datas), Localização, Descrição, Histórico
- Botão "Confirmar Ordem" (se for funcionário responsável)

**O que ele entende:**
- ✅ Vê todas as informações da ordem
- ❌ **FRICÇÃO**: Ainda vê apenas UUIDs (Serviço, Funcionário, Cliente) - não identifica pessoas/serviços
- ⚠️ **DÚVIDA**: Não sabe se há conflitos de horário antes de confirmar
- ❌ **FALTA**: Não há preview de como ficará na agenda

**Observações:**
- Informações técnicas (UUIDs) não ajudam a identificar o que é
- Não há verificação de disponibilidade antes de confirmar (pode dar erro depois)

---

### Passo 3.2: Funcionário clica em "Confirmar Ordem"

**O que o usuário vê:**
- Botão clicado
- Botão fica desabilitado ("Confirmando...")
- Toast: "Ordem confirmada com sucesso" ou erro
- Status muda para "Confirmada"
- Botão "Confirmar" desaparece, aparece "Iniciar Serviço"

**O que ele entende:**
- ✅ Ordem foi confirmada
- ✅ Próximo passo é "Iniciar Serviço"
- ⚠️ **AMBIGUIDADE**: Não sabe que evento foi criado na agenda automaticamente
- ❌ **FALTA**: Não há link direto para ver o evento na agenda

**Observações:**
- Confirmação funciona, mas não há feedback sobre criação do evento na agenda
- Funcionário pode não perceber que precisa verificar agenda

---

## CENÁRIO 4: EVENTO APARECE NA AGENDA

### Passo 4.1: Funcionário acessa agenda

**O que o usuário vê:**
- Tela "Minha Agenda"
- Controles de navegação (Mês Anterior, Nome do Mês, Próximo Mês)
- Botão "Criar Bloqueio"
- Lista de eventos (se houver)

**O que ele entende:**
- ✅ Vê agenda do mês atual
- ⚠️ **FRICÇÃO**: Se não houver eventos, vê "Nenhum evento agendado neste mês" - pode não saber que acabou de criar um
- ❌ **FALTA**: Não há indicação de que evento foi criado automaticamente

**Observações:**
- Se funcionário confirmar ordem e não verificar agenda imediatamente, pode não perceber o evento
- Não há notificação ou destaque de "novo evento criado"

---

### Passo 4.2: Funcionário visualiza evento na agenda

**O que o usuário vê:**
- Card de evento com: Título, Tipo "Ordem de Serviço", Status "Agendado", Início, Fim, Local, Link para Service Order

**O que ele entende:**
- ✅ Vê evento na agenda
- ✅ Pode clicar para ver ordem vinculada
- ⚠️ **AMBIGUIDADE**: Título do evento pode não ser descritivo (vem do backend)
- ✅ Link para Service Order funciona

**Observações:**
- Integração entre agenda e ordem funciona
- Título do evento pode ser genérico (depende do backend)

---

## CENÁRIO 5: FUNCIONÁRIO INICIA E CONCLUI SERVIÇO

### Passo 5.1: Funcionário inicia serviço

**O que o usuário vê:**
- Na página de detalhes da ordem: Botão "Iniciar Serviço"
- Clica no botão
- Toast: "Ordem iniciada"
- Status muda para "Em Andamento"
- Botão "Iniciar" desaparece, aparece "Completar Serviço"

**O que ele entende:**
- ✅ Serviço foi iniciado
- ✅ Próximo passo é "Completar Serviço"
- ✅ Feedback claro

**Observações:**
- Fluxo funciona bem
- Feedback adequado

---

### Passo 5.2: Funcionário completa serviço

**O que o usuário vê:**
- Botão "Completar Serviço" clicado
- Toast: "Ordem concluída"
- Status muda para "Concluída"
- Botões de ação desaparecem (apenas "Cancelar" se ainda permitido)

**O que ele entende:**
- ✅ Serviço foi concluído
- ✅ Processo finalizado
- ⚠️ **AMBIGUIDADE**: Não sabe se precisa fazer mais alguma coisa (ex: pagamento, avaliação)

**Observações:**
- Fluxo funciona
- Pode haver expectativa de próximos passos que não existem ainda

---

## CENÁRIO 6: CLIENTE VISUALIZA STATUS ATUALIZADO

### Passo 6.1: Cliente acessa lista de ordens

**O que o usuário vê:**
- Lista de ordens (filtrada por cliente automaticamente)
- Card da ordem com status atualizado

**O que ele entende:**
- ✅ Vê status atualizado (ex: "Confirmada", "Em Andamento", "Concluída")
- ⚠️ **FRICÇÃO**: Se filtro estiver em "Todas", precisa rolar para encontrar ordem específica
- ❌ **FALTA**: Não há notificação de mudança de status
- ❌ **FALTA**: Não há destaque visual para ordens com status atualizado

**Observações:**
- Cliente precisa verificar manualmente para ver atualizações
- Não há feedback proativo de mudanças

---

### Passo 6.2: Cliente acessa detalhes da ordem

**O que o usuário vê:**
- Status atualizado
- Histórico com timestamps de confirmação, início, conclusão
- Informações completas

**O que ele entende:**
- ✅ Vê status atual
- ✅ Vê histórico de mudanças
- ❌ **FRICÇÃO**: Ainda vê UUIDs parciais (Serviço, Funcionário) - não identifica quem é
- ⚠️ **DÚVIDA**: Não sabe se pode fazer algo (ex: avaliar, pagar)

**Observações:**
- Informações técnicas (UUIDs) não ajudam identificação
- Falta contexto sobre próximos passos possíveis

---

## RESUMO DE FRICÇÕES IDENTIFICADAS

### 🔴 CRÍTICAS (Bloqueiam uso)

1. **UUIDs em vez de nomes**
   - Cliente não sabe qual serviço está solicitando (apenas UUID)
   - Funcionário não sabe qual cliente é (apenas UUID parcial)
   - Funcionário não sabe qual serviço é (apenas UUID parcial)
   - **Impacto**: Usuário não consegue identificar o que está vendo

2. **Criação de ordem exige conhecimento técnico**
   - Campo "ID do Serviço" exige UUID
   - Campo "ID do Funcionário" exige UUID
   - Não há busca/seleção
   - **Impacto**: Usuário comum não consegue criar ordem

### 🟡 IMPORTANTES (Causam confusão)

3. **Falta de feedback sobre criação de evento na agenda**
   - Ao confirmar ordem, não há indicação de que evento foi criado
   - Funcionário pode não perceber que precisa verificar agenda
   - **Impacto**: Funcionário pode não usar agenda

4. **Falta de destaque para ordens pendentes**
   - Não há contador de ordens aguardando confirmação
   - Não há badge ou destaque visual
   - **Impacto**: Funcionário pode não perceber que há trabalho pendente

5. **Falta de verificação de disponibilidade antes de confirmar**
   - Funcionário só descobre conflito ao tentar confirmar
   - Erro pode ser técnico (não amigável)
   - **Impacto**: Experiência frustrante ao confirmar

6. **Falta de notificação de mudanças de status**
   - Cliente precisa verificar manualmente
   - Não há feedback proativo
   - **Impacto**: Cliente pode não perceber atualizações

### 🟢 MENORES (Melhorias de UX)

7. **Cards não indicam claramente que são clicáveis**
   - Falta hover state ou cursor pointer
   - **Impacto**: Usuário pode não perceber que pode clicar

8. **Filtro padrão "Todas" pode mostrar muitas ordens**
   - Funcionário precisa filtrar manualmente para ver pendentes
   - **Impacto**: Pode ser confuso encontrar o que precisa

9. **Título de evento na agenda pode ser genérico**
   - Depende do backend
   - **Impacto**: Pode não ser descritivo

---

## AJUSTES MÍNIMOS SUGERIDOS

### Prioridade 1: Resolver bloqueios críticos

1. **Substituir UUIDs por nomes (ou adicionar nomes junto)**
   - **Onde**: ServiceOrdersPage, ServiceOrderDetailPage, CreateServiceOrderPage
   - **O que**: Buscar nomes de serviços/atores via API e exibir junto com UUID
   - **Como**: Adicionar chamadas para buscar nomes (se APIs existirem) ou exibir UUID de forma mais clara

2. **Melhorar formulário de criação**
   - **Onde**: CreateServiceOrderPage
   - **O que**: Adicionar busca/seleção de serviços e funcionários (se APIs existirem)
   - **Como**: Se não houver APIs, pelo menos adicionar placeholder mais claro e validação

### Prioridade 2: Reduzir confusão

3. **Feedback sobre criação de evento**
   - **Onde**: ServiceOrderDetailPage (após confirmar)
   - **O que**: Adicionar mensagem "Evento criado na agenda" + link para agenda
   - **Como**: Após confirmar com sucesso, mostrar mensagem e botão "Ver na Agenda"

4. **Destaque para ordens pendentes**
   - **Onde**: ServiceOrdersPage
   - **O que**: Badge com contador de ordens DRAFT + filtro padrão "Rascunho" para funcionários
   - **Como**: Contar ordens DRAFT e exibir badge, ajustar filtro padrão baseado em actor_type

5. **Verificação de disponibilidade antes de confirmar**
   - **Onde**: ServiceOrderDetailPage
   - **O que**: Botão "Verificar Disponibilidade" antes de "Confirmar"
   - **Como**: Chamar checkAvailability e mostrar resultado (conflitos ou "disponível")

### Prioridade 3: Melhorias de UX

6. **Indicar cards clicáveis**
   - **Onde**: ServiceOrdersPage, CalendarPage (CSS)
   - **O que**: Adicionar cursor: pointer e hover state
   - **Como**: CSS simples

7. **Filtro inteligente padrão**
   - **Onde**: ServiceOrdersPage
   - **O que**: Se funcionário, filtrar por "DRAFT" por padrão
   - **Como**: Ajustar estado inicial baseado em actor_type

---

## OBSERVAÇÕES FINAIS

### O que funciona bem:
- ✅ Fluxo básico funciona (criar → confirmar → iniciar → completar)
- ✅ Navegação entre telas funciona
- ✅ Feedback de ações (toasts) funciona
- ✅ Integração agenda ↔ ordem funciona

### O que precisa ajuste:
- 🔴 UUIDs em vez de nomes (bloqueia uso real)
- 🟡 Falta de feedback sobre eventos criados
- 🟡 Falta de destaque para pendências
- 🟢 Melhorias visuais menores

### Limitações aceitas (fora do escopo):
- ❌ Não há busca de serviços/funcionários (requer APIs que podem não existir)
- ❌ Não há notificações automáticas (fora do escopo)
- ❌ Não há calendário visual (fora do escopo MVP)

---

**Status:** ✅ Teste concluído  
**Próximo passo:** Implementar ajustes mínimos (se aprovado)


