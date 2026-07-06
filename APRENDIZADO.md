# APRENDIZADO — Contexto Arquitetural do Compositor Universal

**Data:** 2026-07-05  
**Participantes:** Clayton, Claude  
**Status:** Conversação em andamento — este arquivo documenta aprendizados estruturais que orientam todas as decisões subsequentes.

---

## Tese Central: UnifiCard é Autogestão Econômica Unificada

UnifiCard não é um super-app, não é um marketplace, não é uma rede social. É uma **ferramenta de autogestão econômica e social** que devolve recursos (dinheiro, poder, governança) à região onde as pessoas atuam, em vez de extrair pra corporações centralizadas.

**O diferencial:** 
- Meta/Google/TikTok extraem atenção e a monetizam em Wall Street.
- Uber/Airbnb/Amazon tomam intermediação e ficam com a margem.
- UnifiCard: tudo que gera valor fica na região, governado por quem vive lá. Você não é "user", é **actor** com direito de voto em decisões que afetam sua comunidade.

---

## O Compositor como Portal Unificado

O compositor (a tela onde um actor **cria um ato**) é o teste de ouro da arquitetura. Porque nele convergem:

### 1. **Actor em Contexto Operante**
- Mesmo actor pode estar em modo **consumidor** (procurando serviço) ou **operador** (oferecendo).
- Mesma pessoa pode ser **Pessoa Física** (individual) ou **Empresa** (juridicamente).
- Quando está num desses modos, a tela muda de cara — mas a identidade econômica permanece una (um saldo, um ledger, uma reputação).

### 2. **Papel/Permissão dentro do Contexto**
O actor não está só "operando uma empresa" — está operando **um papel específico** naquela empresa.
- **Actor A em Empresa X como RH** → pode criar Vagas, Treinamentos, Enquetes de Seleção.
- **Actor A em Empresa X como Warehouse** → pode criar MovimentaçõesInventário, RelatoriosDano.
- **Mesmo Actor A, Empresa Y, Papel Finance** → pode criar Invoices, PurchaseOrders.

**Implicação crítica:** o compositor **não mostra uma lista fixa de tipos de ato**. Ele pergunta ao backend: "Quais tipos de atos este [actor, empresa, papel] pode iniciar?" E mostra só aqueles — não por UI trick, mas porque *literalmente não existem outros* pra esse papel.

### 3. **Tipos de Ato e Suas Consequências**
Um tipo de ato não é um "tipo de post". É a **porta de entrada para um domínio operacional real:**

- **Vaga** → entrada no módulo de RH/recrutamento; cria opportunity que pode virar contratação; impacta `company_users`.
- **Evento** → entrada no módulo de agenda/eventos; cria marco temporal que gera convocação; impacta `unified_availability`.
- **Oferta de Serviço** → entrada no marketplace; cria product_offer viva; impacta `services` + `tenant_products`.
- **Enquete/Voto** → entrada no módulo de governança; resultado de voto é operacional (aloca fundo regional, muda política); impacta `governance_proposals`.
- **Oportunidade** (termo genérico) → qualquer ato que abre uma possibilidade de troca econômica ou coordenação social.

Todos os tipos compartilham **eixos estruturais**, não cada um é um sistema à parte.

---

## Os 5 Eixos Estruturais do Compositor

Qualquer tipo de ato (Vaga, Evento, Oferta, Enquete, etc.) é uma **combinação destes eixos**:

### **Eixo 1: Quem Publica**
- Actor + seu papel/capacidade ativa no contexto
- Resolve via `canRepresentActor(tenantId, userId, actorId)` + verificação de role específico no contexto
- Nunca é "actor genérico", é "actor EM um papel" (RH, Vendedor, Financeiro, Consumidor)

### **Eixo 2: Contexto Operante**
- **Gestão interna** (treinamento, escala, evento interno) — coordenação de quem já está dentro
- **Vitrine externa** (propaganda, venda, vaga pública) — comunicação de fora pra dentro
- **Cadeia de suprimento** (compra, fornecedor) — fluxo transacional actor-a-actor específico

O mesmo tipo de ato pode mudar cara conforme o contexto (ex.: "Evento" pode ser interno-só ou público, dependendo de quem posta e em qual modo).

### **Eixo 3: Mecânica de Destino**
- **Broadcast a segmento** — um-para-muitos, resolvido por "para quem ver"
  - Público geral / Amigos / Funcionários / Fornecedores / Clientes
  - **Para PF:** grafo social (amigos, próximos, exceções)
  - **Para PJ:** papel funcional (funcionários/colaboradores/fornecedores/clientes/interessados)
- **Relação direct actor-a-actor** — transação com contraparte específica já identificada
  - Não é sobre visibilidade, é sobre fluxo estruturado (ordem de compra, candidatura, proposta)

### **Eixo 4: Consequência Real / Impacto Econômico**
- Que domínio do sistema é acionado? (marketplace, RH, governança, eventos, social)
- Qual ledger é afetado? (user_wallet, company_wallet, regional_fund, escrow)
- **Retorno à região?** — parte do impacto econômico volta pro fundo regional (decisão soberana: voluntária vs. sistêmica)

### **Eixo 5: Ciclo de Vida**
- Tem prazo de validade? (Vaga: até X dias ou até preenchimento; Evento: até data; Enquete: até votação fechar)
- Tem etapas/status? (aberto → em andamento → preenchido/fechado)
- Ou é instantâneo? (um voto é um voto, finalizado)
- **Quem define o prazo?** — o criador (no ato de criar), ou o sistema por regra?

---

## O Princípio Inviolável: Uma Fonte de Verdade

**A arquitetura aguenta sem criar fontes paralelas de verdade.**

Isso significa:

- **Permissões** — sempre resolvidas no backend, nunca cache no localStorage que fica fora de sync
- **Enumeração de tipos** — sempre do servidor ("qual é seu papel? eis os atos que você pode fazer"), nunca hardcoded na UI
- **Saldo/Ledger** — uma única fonte (DB), nunca duplicado em cache de cliente
- **Autoridade** — gravada UMA VEZ por ato, no banco, nunca em arquivo local que pode divergir
- **Projeção visual** — apenas **projeção**, nunca decisão. Frontend mostra o que backend garante, não inventa regras.

Se o compositor conseguir manter isso (resolver permissões sempre no servidor, enumerar tipos sempre do servidor, gravar sempre uma vez, nunca cache que seja verdade), então **todos os outros domínios podem copiar o padrão**: governança, compra, agenda, social. Tudo usa a mesma arquitetura sem risco de fragmentação.

---

## Próximas Etapas

1. **Mapear formalmente:** qual é a estrutura de [Role em Company] → [Tipos de Ato permitidos]?
   - Já existe um substrato pra isso no backend, ou precisa ser construído?
   
2. **Validar os eixos:** os 5 eixos cobrem todos os casos de uso, ou faltam dimensões?

3. **Desenhar a API do compositor:**
   - GET `/composer/available-actions?actorId=X&companyId=Y&role=RH` → retorna `["Vaga", "Treinamento", "Enquete"]`
   - POST `/composer/action` → cria o ato, atomicamente, no domínio certo

4. **Frontend tira daí:** mostra só aquilo que o servidor enumera, nunca inventa.

---

---

## O Princípio Econômico Fundamental: Dinheiro Dentro ou Dinheiro Fora

**Não existem abstrações de "Modo Consumir" e "Modo Operar".**

Na vida real, só existe uma verdade econômica:
- **Dinheiro sai do bolso** (você gasta)
- **Dinheiro entra no bolso** (você recebe)
- **Sem transação de dinheiro** (coordenação / social puro)

As palavras "consumir" e "operar" são tranquilas, linguisticamente palatáveis. Mas o **substrato é econômico**, não semântico.

**Implicação arquitetural:**

Um tipo de ato não deve ser classificado por nome ("Vaga", "Evento", "Oferta"). Deve ser classificado por **qual fluxo econômico ele gera:**

### **Categoria 1: Fluxo de Saída (Dinheiro Sai)**
O actor está gastando, pagando, investindo. Exemplos:
- Procura de Serviço ("procuro eletricista")
- Procura de Produto ("quero sofá vermelho")
- Procura de Ajuda Paga ("alguém cobra pra me ajudar a mudar?")
- Pedido de Locação ("procuro apartamento")

**Consequências reais:**
- Afeta limite de saldo (ele pode gastar quanto?)
- Requer verificação de fundos
- Gera débito no ledger pessoal

### **Categoria 2: Fluxo de Entrada (Dinheiro Entra)**
O actor está oferecendo, recebendo, gerando receita. Exemplos:
- Oferta de Serviço ("ofereço aula de inglês")
- Venda de Produto ("vendo artesanato")
- Vaga / Contratação ("preciso de alguém")
- Aluguel de Espaço ("aluga meu estúdio")

**Consequências reais:**
- Afeta receita do ledger pessoal
- Gera imposto/contribuição ao fundo regional
- Entra no histórico de reputação/confiabilidade
- Pode ter verificação de capacidade (você tem autoridade pra oferecer isso?)

### **Categoria 3: Fluxo Social Puro (Sem Transação)**
Coordenação, networking, expressão. Nenhuma transação de dinheiro. Exemplos:
- Post Social ("foto minha, comentário, story")
- Match Social ("procuro alguém pra sair" — se PURO, sem pagamento envolvido)
- Enquete de Interesse ("alguém quer montar grupo de corrida?")
- Interesse Declarado ("gosto disso")

**Consequências reais:**
- Não afeta ledger
- Afeta apenas grafo social / descoberta
- Pode gerar cruzamento de interesses (recomendação)

**A diferença crítica:**

Um ato "procuro companhia pra sair" é **ambíguo sem resolver a categoria econômica:**
- Se for **Fluxo Social Puro** (só match, sem dinheiro) → não é consumir nem operar, é coordenação social
- Se for **Fluxo de Saída** (ele vai pagar pra alguém ser companhia, tipo sugar dating) → é gasto real, afeta saldo
- Se for **Fluxo de Entrada** (ele cobra pra ser companhia) → é receita, afeta imposto

**No compositor:**

A pergunta não é "qual tipo de post é esse?"  
A pergunta é: **"este ato causa saída de dinheiro, entrada de dinheiro, ou é puro social?"**

A resposta a essa pergunta determina:
- Quais verificações rodar
- Qual ledger é afetado
- Quem vê (visibilidade)
- Qual ciclo de vida
- Quais permissões são necessárias

---

## Caso de Uso Concreto: Pessoa Física em Fluxo de Entrada (Dinheiro Entra)

**O que uma Pessoa Física pode POSTAR quando está em fluxo de entrada (gerando receita)?**

1. **Oferta de Serviço** — seus próprios serviços (aula, conserto, consultoria). Ledger pessoal. Destino: público/segmentado.
2. **Venda de Produto** — seus próprios produtos (artesanato, foto, design). Ledger pessoal. Destino: público/segmentado.
3. **Evento** — workshop, aula, show que ela organiza. Ledger pessoal + impacto regional. Destino: público/convites.
4. **Agendamento** — sua disponibilidade (segunda 14-18h). Substrato de reserva. Destino: broadcast de slots.
5. **Post Social** — conteúdo, portfólio, experiência, update. Sem transação direta. Destino: rede social.
6. **Currículo** — suas habilidades, experiência, formação. **Substrato descobrível** — entra num índice de "quem pode fazer o quê na região".
7. **Candidatura a Vaga** — se vê uma vaga (postada por empresa ou outra PF), ela se candidata. Ato dela, não "tipo que posta".
8. **Projeto para Comunidade** — proposta de estrutura permanente ("quero organizar uma biblioteca no bairro"). Requer validação comunitária antes de executar.
9. **Enquete de Validação** — "vocês topam apoiar esse projeto?" (parte da jornada do projeto, não isolado).

**O eixo revolucionário — A Cadeia do Projeto:**

```
Ideia (Post Projeto)
  ↓ [actor cria, posta ideia]
Enquete (Validação de Interesse)
  ↓ [comunidade vota "topar?" — necessário quórum/maioria]
Votação (Deliberação Democrática)
  ↓ [se enquete passa, vai a votação formal de alocação]
Alocação de Fundo Regional (Recurso Real)
  ↓ [aprovado: dinheiro real é alocado ao projeto]
Grupo/Estrutura Criada (Execução)
  ↓ [actor vira operador de recurso regional, cria grupo]
```

**Por que isso é radicalmente diferente:**
- Uma pessoa física **sozinha, sem ter criado grupo antes**, pode postar uma ideia, validar interesse comunitário, ir a votação democrática e obter alocação de fundo regional.
- **Não precisa pedir permissão a ninguém.** É autogestão verdadeira: comunidade aprova, fundo flui, execução acontece.
- A pessoa vira **operadora de recurso público** legitimada por votação, não por cargo ou posição.

**Eixos aplicados à Cadeia do Projeto:**
- **Quem:** Pessoa Física (qualquer uma)
- **Contexto:** Governança Comunitária / Autogestão
- **Destino:** Broadcast pra população local (enquete e votação abertas)
- **Consequência:** Alocação de dinheiro real (fundo regional) + autoridade de executar
- **Ciclo de Vida:** Enquete (X dias) → Votação (Y dias) → Alocação → Execução contínua

---

## Lições Aprendidas (Dessa Conversa e das Anteriores)

- **Actor como unidade operacional soberana** é a fundação. Tudo mais é projeção dele.
- **Contexto muda a face, mas não a identidade.** Mesma pessoa em modo operador vs consumidor vs RH vs financeiro = mesma identidade econômica, mesma verdade de fundo.
- **Eixos são mais poderosos que enum de tipos.** Se você acerta os eixos, ganha combinatória infinita (nenhum novo "tipo" exige código novo, é só nova combinação de eixos).
- **Unificação significa zero fontes paralelas de verdade.** Cada domínio (RH, marketplace, governança, social) é uma face, não um sistema. Tudo aponta pro mesmo backend, mesmo ledger, mesma autoridade.
- **Economia descentralizada não é anarquia.** É **autogestão precisa**: cada região governa seu fundo, cada empresa governa suas permissões, cada ator governa seu perfil. Tudo visível, rastreável, transferível.
- **Projeto > Grupo, não Grupo > Projeto.** Uma pessoa comum pode gerar uma ideia que vira votação que aloca dinheiro (fluxo econômico real). Se houver apoio, daí cria a estrutura permanente (grupo). A legitimidade vem da votação, não da hierarquia.
- **Dinheiro dentro ou fora, não abstrações.** "Consumir" e "operar" são palavras tranquilas, mas o substrato é econômico: dinheiro sai do bolso, entra no bolso, ou é puro social? Esta pergunta determina autorização, ledger, imposto, visibilidade. A categoria econômica é mais fundamental que o tipo de ato.

---

**Próxima conversa:** investigar o substrato de permissões/roles que já existe vs. o que falta, e começar a desenhar a API do compositor pra garantir que nenhum tipo de ato cria fonte paralela de verdade.
