# DESIGN SYSTEM CANÔNICO — UNIFICARD

Status: NON-NORMATIVE  
Autoridade: DERIVADA de PADRAO_FRONTEND_CANONICO.md  
Nível hierárquico: Igual ao PADRAO_FRONTEND_CANONICO.md  
Escopo: Visual e estrutural (UI)

---

## RELAÇÃO COM DOCUMENTOS SUPERIORES

Este documento é extensão organizacional de:
- **PADRAO_FRONTEND_CANONICO.md** — Define que frontend é camada derivada
- **ARQUETIPOS_PAGINA_CANONICOS.md** — Define os arquétipos estruturais permitidos
- **CORE_IMUTAVEL.md** — Define o que nunca muda no sistema

Este documento NÃO substitui nenhum contrato superior.  
Qualquer conflito é resolvido pelos documentos de nível mais alto.

---

## PRINCÍPIOS INQUEBRÁVEIS

- NÃO cria regra de negócio
- NÃO cria decisão
- NÃO valida tempo
- NÃO valida permissões
- NÃO altera Core
- Frontend é CAMADA DERIVADA

Identidade visual é apenas **aparência e organização**, nunca lógica ou regra.

---

## DESIGN SYSTEM POR ARQUÉTIPO

### 1️⃣ HOME / DISCOVERY PAGE

#### Objetivo Visual da Página
Apresentar múltiplas opções de exploração em um único espaço. O usuário deve sentir que pode descobrir diferentes caminhos sem pressão para escolher um específico.

#### O Que o Usuário Deve Entender ao Entrar
"Estou em um lugar onde posso ver o que está acontecendo e escolher para onde ir. Nada está me forçando a fazer algo específico."

#### Elementos Visuais Obrigatórios
- Múltiplos blocos independentes de conteúdo
- Navegação clara entre seções
- Indicadores visuais de que cada bloco é clicável
- Espaçamento generoso entre blocos
- Hierarquia visual que não privilegia nenhum caminho específico

#### Elementos Visuais Proibidos
- CTAs forçados ou destacados demais
- Mensagens que sugerem ação obrigatória
- Blocos que desaparecem ou mudam baseado em comportamento
- Indicadores de "você deve fazer isso agora"
- Progresso ou completude forçada

#### Tipos de Componentes Permitidos
- Cards de conteúdo navegáveis
- Listas horizontais e verticais
- Imagens e ícones descritivos
- Títulos e subtítulos informativos
- Links e botões de navegação (não ação)
- Filtros visuais (não lógicos)

#### Tipos de Componentes Proibidos
- Wizards ou fluxos obrigatórios
- Validações que bloqueiam visualização
- Componentes que inferem intenção do usuário
- Alertas que exigem ação imediata
- Formulários que impedem navegação

---

### 2️⃣ CATEGORY / COLLECTION PAGE

#### Objetivo Visual da Página
Organizar visualmente entidades por agrupamento descritivo. O usuário deve entender que categorias são apenas formas de organizar, não regras que afetam comportamento.

#### O Que o Usuário Deve Entender ao Entrar
"Estou vendo uma organização visual de coisas. Posso explorar por categoria, mas isso não muda o que posso fazer."

#### Elementos Visuais Obrigatórios
- Navegação clara entre categorias
- Visualização consistente de entidades dentro de cada categoria
- Indicadores de quantidade por categoria
- Formas de voltar ou mudar de categoria facilmente

#### Elementos Visuais Proibidos
- Categorias que mudam comportamento ou permissões
- Hierarquia visual que sugere importância por categoria
- Mensagens que indicam que categoria define regra
- Bloqueios visuais baseados em categoria

#### Tipos de Componentes Permitidos
- Tabs ou abas de navegação
- Grids e listas de entidades
- Filtros visuais por categoria
- Breadcrumbs de navegação
- Contadores de quantidade

#### Tipos de Componentes Proibidos
- Componentes que validam categoria como regra
- Filtros que bloqueiam acesso
- Componentes que inferem categoria do usuário
- Validações baseadas em categoria

---

### 3️⃣ ENTITY LISTING PAGE

#### Objetivo Visual da Página
Apresentar múltiplas entidades do mesmo tipo de forma que permita comparação visual e escolha informada. O usuário deve sentir que está vendo opções, não sendo direcionado.

#### O Que o Usuário Deve Entender ao Entrar
"Estou vendo uma lista de coisas similares. Posso comparar e escolher qual ver em detalhes. Nada está decidido ainda."

#### Elementos Visuais Obrigatórios
- Lista ou grid homogêneo de entidades
- Informações comparáveis entre entidades
- Navegação clara para detalhes de cada entidade
- Filtros e ordenação visual (não lógica)
- Indicadores de estado quando aplicável

#### Elementos Visuais Proibidos
- Destaques que sugerem escolha obrigatória
- Ordenação que não pode ser alterada
- Filtros que bloqueiam visualização
- Mensagens que forçam ação
- Decisões automáticas baseadas na lista

#### Tipos de Componentes Permitidos
- Cards de entidade navegáveis
- Tabelas comparativas
- Filtros e ordenação visual
- Paginação ou scroll infinito
- Badges e indicadores de estado
- Busca visual

#### Tipos de Componentes Proibidos
- Componentes que executam decisão
- Validações que impedem visualização
- Componentes que inferem intenção
- Ações automáticas baseadas em seleção
- Wizards de escolha obrigatória

---

### 4️⃣ ENTITY DETAIL PAGE

#### Objetivo Visual da Página
Apresentar informações completas sobre uma única entidade de forma clara e organizada. O usuário deve entender o estado atual e ter acesso a ações explícitas quando aplicável.

#### O Que o Usuário Deve Entender ao Entrar
"Estou vendo detalhes completos de uma coisa específica. Posso entender seu estado e, se houver ações disponíveis, elas estarão claramente indicadas."

#### Elementos Visuais Obrigatórios
- Informações principais em destaque
- Seções organizadas de detalhes
- Estado atual claramente visível
- CTAs explícitos para ações (quando aplicável)
- Navegação para voltar ou relacionadas

#### Elementos Visuais Proibidos
- Ações automáticas sem confirmação
- Decisões implícitas baseadas em visualização
- Validações que bloqueiam visualização
- Mensagens que forçam ação imediata
- Estados que mudam automaticamente

#### Tipos de Componentes Permitidos
- Cards de informação
- Tabelas de detalhes
- Badges de estado
- Botões de ação explícitos
- Imagens e mídia descritiva
- Links de navegação
- Timeline ou histórico visual

#### Tipos de Componentes Proibidos
- Componentes que executam ação automaticamente
- Validações que impedem leitura
- Componentes que inferem intenção
- Ações ocultas ou implícitas
- Wizards de confirmação obrigatória

---

### 5️⃣ ACTION / CHECKOUT PAGE

#### Objetivo Visual da Página
Apresentar uma decisão humana explícita de forma clara e consciente. O usuário deve entender exatamente o que está fazendo e qual o impacto da ação.

#### O Que o Usuário Deve Entender ao Entrar
"Estou prestes a fazer uma ação específica. Vejo claramente o que vai acontecer e preciso confirmar conscientemente."

#### Elementos Visuais Obrigatórios
- Resumo claro do que será feito
- Impacto visível da ação
- Confirmação explícita obrigatória
- Opção clara de cancelar
- Informações relevantes para a decisão

#### Elementos Visuais Proibidos
- Confirmações automáticas
- Ações ocultas ou implícitas
- Decisões inferidas de estado
- Validações que forçam ação
- Wizards que pulam confirmação

#### Tipos de Componentes Permitidos
- Formulários de confirmação
- Resumos visuais de impacto
- Botões de confirmação e cancelamento
- Alertas informativos
- Campos de entrada quando necessário
- Checkboxes de confirmação explícita

#### Tipos de Componentes Proibidos
- Componentes que executam sem confirmação
- Validações que forçam ação
- Componentes que inferem intenção
- Ações automáticas
- Wizards que pulam etapas

---

### 6️⃣ ENTITY DECLARATION / CREATION PAGE

#### Objetivo Visual da Página
Permitir declaração progressiva de intenção sem pressão ou obrigatoriedade. O usuário deve sentir que pode preencher no seu ritmo e salvar como rascunho a qualquer momento.

#### O Que o Usuário Deve Entender ao Entrar
"Estou declarando minha intenção de criar algo. Posso preencher no meu ritmo, salvar como rascunho, e nada é obrigatório até eu decidir finalizar."

#### Elementos Visuais Obrigatórios
- Campos de entrada organizados
- Botão de salvar rascunho sempre visível
- Indicação clara de campos opcionais
- Possibilidade de navegar sem perder dados
- Feedback visual de salvamento

#### Elementos Visuais Proibidos
- Wizards obrigatórios com etapas fixas
- Validações que bloqueiam progresso
- Campos obrigatórios que impedem salvamento
- Mensagens que forçam completude
- Decisões automáticas baseadas em preenchimento

#### Tipos de Componentes Permitidos
- Formulários progressivos
- Campos de entrada opcionais
- Botões de salvar rascunho
- Seções colapsáveis
- Indicadores de progresso (informativo, não obrigatório)
- Validação visual (não bloqueante)

#### Tipos de Componentes Proibidos
- Wizards com etapas obrigatórias
- Validações que bloqueiam salvamento
- Componentes que inferem intenção
- Decisões automáticas
- Campos que desaparecem baseado em preenchimento

---

### 7️⃣ DRAFT / MANAGEMENT PAGE

#### Objetivo Visual da Página
Apresentar estado atual, histórico e opções de gestão de forma informativa. O usuário deve entender o que está acontecendo e ter acesso a ações explícitas quando necessário.

#### O Que o Usuário Deve Entender ao Entrar
"Estou vendo o estado atual e histórico de algo que estou gerenciando. Posso ver o que aconteceu e, se houver ações disponíveis, elas estarão claras."

#### Elementos Visuais Obrigatórios
- Estado atual claramente visível
- Histórico ou timeline de eventos
- Informações organizadas por seção
- CTAs explícitos para ações (quando aplicável)
- Indicadores de status e progresso

#### Elementos Visuais Proibidos
- Ações automáticas sem confirmação
- Decisões implícitas baseadas em estado
- Validações que bloqueiam visualização
- Mensagens que forçam ação imediata
- Estados que mudam automaticamente

#### Tipos de Componentes Permitidos
- Cards de estado
- Timeline ou histórico visual
- Tabelas de informações
- Badges de status
- Botões de ação explícitos
- Gráficos e visualizações informativas

#### Tipos de Componentes Proibidos
- Componentes que executam ação automaticamente
- Validações que impedem visualização
- Componentes que inferem intenção
- Ações ocultas ou implícitas
- Decisões automáticas baseadas em estado

---

## IDENTIDADE VISUAL POR MÓDULO

### MARKETPLACE
**Referência Visual:** Estilo Mercado Livre

#### Ritmo Visual
- Navegação rápida e direta
- Múltiplas opções visíveis simultaneamente
- Comparação facilitada entre produtos
- Densidade de informação média-alta

#### Densidade de Informação
- Múltiplos produtos por tela
- Informações essenciais sempre visíveis
- Detalhes expandíveis quando necessário
- Filtros e ordenação sempre acessíveis

#### Foco do Olhar
- Produtos e ofertas em destaque
- Preços e disponibilidade claramente visíveis
- Imagens de produtos como elemento principal
- Informações de loja secundárias

#### Hierarquia de CTA
1. **Primário:** Ver detalhes do produto
2. **Secundário:** Adicionar ao carrinho (visual)
3. **Terciário:** Filtrar, ordenar, comparar
4. **Ação Explícita:** Ir para checkout (página dedicada)

---

### FOOD / SERVIÇOS
**Referência Visual:** Estilo iFood

#### Ritmo Visual
- Foco em escolha rápida e prática
- Informações essenciais imediatamente visíveis
- Fluxo linear de descoberta para ação
- Densidade de informação média

#### Densidade de Informação
- Serviços e ofertas em cards organizados
- Informações de disponibilidade sempre visíveis
- Detalhes expandíveis quando necessário
- Filtros por categoria e localização

#### Foco do Olhar
- Serviços e ofertas em destaque
- Disponibilidade e horários claramente visíveis
- Imagens descritivas como elemento principal
- Informações de prestador secundárias

#### Hierarquia de CTA
1. **Primário:** Ver detalhes do serviço
2. **Secundário:** Agendar ou solicitar (visual)
3. **Terciário:** Filtrar, buscar, comparar
4. **Ação Explícita:** Confirmar agendamento (página dedicada)

---

### MOBILITY / AGENDA
**Referência Visual:** Estilo Uber

#### Ritmo Visual
- Foco em ação imediata quando necessário
- Estado atual sempre visível
- Navegação temporal clara
- Densidade de informação baixa-média

#### Densidade de Informação
- Agenda e compromissos em formato temporal
- Informações essenciais por compromisso
- Detalhes expandíveis quando necessário
- Filtros por data e tipo

#### Foco do Olhar
- Compromissos e agenda em destaque
- Tempo e localização claramente visíveis
- Calendário ou timeline como elemento principal
- Informações de contexto secundárias

#### Hierarquia de CTA
1. **Primário:** Ver detalhes do compromisso
2. **Secundário:** Declarar disponibilidade (visual)
3. **Terciário:** Filtrar, navegar temporalmente
4. **Ação Explícita:** Confirmar ação de agenda (página dedicada)

---

### EVENTOS
**Referência Visual:** Declaração progressiva

#### Ritmo Visual
- Foco em criação e organização sem pressão
- Fluxo progressivo e editável
- Possibilidade de pausar e retomar
- Densidade de informação baixa

#### Densidade de Informação
- Informações organizadas por seção
- Campos opcionais claramente marcados
- Rascunhos sempre salvos
- Detalhes expandíveis quando necessário

#### Foco do Olhar
- Formulário de criação em destaque
- Informações essenciais sempre visíveis
- Indicadores de progresso (informativo)
- Ações de salvamento sempre acessíveis

#### Hierarquia de CTA
1. **Primário:** Salvar como rascunho
2. **Secundário:** Preencher campos (opcional)
3. **Terciário:** Visualizar preview, navegar
4. **Ação Explícita:** Publicar evento (página dedicada)

---

## COMPONENTES PROIBIDOS GLOBALMENTE

### Wizards Obrigatórios
Nenhum wizard pode ser obrigatório ou impedir navegação. Wizards são permitidos apenas como guia visual opcional, nunca como fluxo forçado.

### Validações Decisórias
Nenhuma validação visual pode criar regra de negócio ou bloquear acesso. Validações são apenas feedback visual, nunca decisão.

### Componentes que Inferem Intenção
Nenhum componente pode inferir intenção do usuário baseado em comportamento, estado ou categoria. Componentes apenas exibem opções, nunca decidem.

### Ações Automáticas
Nenhum componente pode executar ação automaticamente sem confirmação explícita do usuário. Todas as ações devem ser conscientes e confirmadas.

### Bloqueios Visuais Baseados em Regra
Nenhum componente pode bloquear visualização baseado em regra de negócio, permissão ou validação. Bloqueios são apenas informativos, nunca executivos.

---

## SEÇÃO FINAL

### Declarações Explícitas

Este documento:
- **NÃO autoriza nenhuma ação** — Apenas define aparência e organização visual
- **NÃO cria regra** — Identidade visual é apenas estética, nunca lógica
- **NÃO substitui contratos superiores** — Em caso de conflito, documentos de nível mais alto prevalecem
- **NÃO valida negócio** — Visual não cria verdade, apenas apresenta informação
- **NÃO valida tempo** — Visual não cria verdade temporal, apenas exibe informação temporal

### Resolução de Conflitos

Qualquer conflito entre este documento e documentos superiores é resolvido pelos documentos de nível mais alto, na seguinte ordem:

1. **CORE_IMUTAVEL.md** — Define o que nunca muda
2. **PADRAO_FRONTEND_CANONICO.md** — Define que frontend é camada derivada
3. **ARQUETIPOS_PAGINA_CANONICOS.md** — Define arquétipos estruturais
4. **Este documento** — Define apenas aparência e organização visual

### Limites de Autoridade

Este documento tem autoridade apenas sobre:
- Aparência visual de páginas
- Organização de elementos na tela
- Hierarquia visual de informação
- Identidade estética por módulo

Este documento **NÃO tem autoridade** sobre:
- Regras de negócio
- Decisões do sistema
- Validações lógicas
- Permissões e acesso
- Comportamento funcional

---

FIM DO DOCUMENTO
