# IDENTIDADE INSTITUCIONAL - UnifyCard
## Decisão Necessária para Destravar o Sistema

**Data:** 12 de Janeiro de 2026  
**Status:** RASCUNHO PARA DECISÃO  
**Objetivo:** Definir identidade antes do próximo commit  

---

## CONTEXTO (SEM FLOREIO)

### Sistema está:
- ✅ Tecnicamente fechado (95%)
- ✅ Eticamente blindado (100%)
- ✅ Arquiteturalmente coerente
- ❌ Institucionalmente indefinido

### O que acontece se continuar codando:
- Features viram vetores de captura
- Decisões técnicas contradizem governança futura
- Sistema trai os próprios princípios por omissão

### Leitura independente (2ª IA):
> "O sistema está mais maduro que a organização que vai usá-lo.
> Isso é raro — e perigoso, se ignorado."

**Conclusão:** Próximo commit é em GOVERNANÇA, não em TypeScript.

---

## 3 DECISÕES QUE DESTRAVAM TUDO

### Decisão 1: QUEM MANDA QUANDO DÁ CONFLITO?

**Cenário real:**
```
Comunidade A quer taxa 2%
Comunidade B quer taxa 5%
Desenvolvedor quer adicionar feature que muda economia
Investidor quer pivot para crescimento rápido

Quem decide?
```

**Opções:**

**A) Fundação (sem fins lucrativos)**
```
Estrutura:
- Conselho eleito pela comunidade
- Estatuto que não pode ser mudado sem voto
- Patrimônio separado da operação

Pros:
✅ Difícil de capturar
✅ Longevidade garantida
✅ Transparência forçada

Contras:
❌ Complexo de criar no Brasil
❌ Lento para decisões
❌ Precisa capital inicial grande

Viabilidade: MÉDIA (6-12 meses para estruturar)
```

**B) Cooperativa**
```
Estrutura:
- Membros são donos (1 voto = 1 pessoa)
- Assembleia decide grandes mudanças
- Sobras distribuídas proporcionalmente

Pros:
✅ Modelo jurídico conhecido no Brasil
✅ Alinhamento natural com valores
✅ Propriedade compartilhada

Contras:
❌ Decisões lentas
❌ Difícil escalar rapidamente
❌ Requer quórum para tudo

Viabilidade: ALTA (estruturar em 3-4 meses)
```

**C) Empresa com Estatuto Blindado**
```
Estrutura:
- LTDA/SA com cláusula de missão social
- Estatuto impede mudança de propósito
- Conselho com assentos comunitários
- Pode ser vendida APENAS para cooperativa/fundação

Pros:
✅ Rápido de criar (1-2 semanas)
✅ Flexível operacionalmente
✅ Atrativo para investidores conscientes
✅ Sistema JÁ está blindado tecnicamente

Contras:
❌ Risco de pressão para desvio
❌ Precisa blindagem legal forte
❌ Confiança depende do estatuto

Viabilidade: ALTA (estruturar em 1 mês)
```

**D) Híbrido (Empresa → Cooperativa → Fundação)**
```
Estrutura:
Ano 0-2: Empresa blindada
         - Estatuto com missão social imutável
         - Observabilidade passiva mandatória no código
         - Taxa administrativa limitada (ex: 3% máximo)
         - Conselho com representação comunitária
         - Código aberto e auditável

Ano 2-5: Transição para Cooperativa
         - Criação da Cooperativa UnifyCard
         - Transferência progressiva de propriedade
         - Empresa opera sob licença da Cooperativa
         - Código e marca detidos pela Cooperativa

Ano 5+:  Fundação de Bem Público
         - Criação da Fundação UnifyCard
         - Cooperativa transfere ativos para Fundação
         - Governança 100% comunitária
         - Impossível de capturar

Pros:
✅ Viabiliza lançamento rápido (empresa)
✅ Transição planejada (cooperativa)
✅ Proteção de longo prazo (fundação)
✅ Precedentes: Ethereum, Signal, Blender
✅ Sistema técnico JÁ suporta isso

Contras:
⚠️ Requer clareza EXTREMA agora
⚠️ Risco de "nunca descentralizar"
⚠️ Precisa milestone claros e públicos

Viabilidade: ALTA (empresa em 1 mês, roadmap em 2 meses)
```

**RECOMENDAÇÃO: D (HÍBRIDO)**

Por quê?
1. Lançamento rápido (viabilidade imediata)
2. Alinhamento de longo prazo (cooperativa → fundação)
3. Sistema técnico já está preparado (blindagens no código)
4. Precedentes de sucesso (Ethereum, Signal, Blender)

---

### Decisão 2: QUEM CONTROLA A TAXA ADMINISTRATIVA?

**Cenário real:**
```
Sistema cobra 3% em cada transação.
Esse dinheiro vai para:
- Infraestrutura (servidores, desenvolvimento)
- Fundo Regional (impacto social)
- Sustentabilidade de longo prazo

Mas... quem decide que é 3%?
E se alguém quiser mudar para 10%?
```

**Opções:**

**A) Taxa Fixa no Código**
```
Definição:
- Taxa = 3% (hardcoded)
- Para mudar, precisa alterar código
- Pull request público + aprovação comunitária

Pros:
✅ Transparente
✅ Difícil de manipular
✅ Auditável

Contras:
❌ Inflexível
❌ Não adapta a contextos regionais
❌ Pode não ser sustentável

Exemplo: Bitcoin (taxa de mineração fixa)
```

**B) Taxa Votável**
```
Definição:
- Taxa inicial = 3%
- Comunidade pode propor mudança
- Votação pública decide
- Limite máximo = 5% (no estatuto)

Pros:
✅ Flexível
✅ Democrático
✅ Adapta ao contexto

Contras:
❌ Pode ser manipulada por maioria
❌ Decisões lentas
❌ Conflito de interesses

Exemplo: DAOs (organizações autônomas descentralizadas)
```

**C) Taxa Regional**
```
Definição:
- Cada região/comunidade define sua taxa
- Range: 2% a 5%
- Sistema respeita a escolha local

Pros:
✅ Adaptável
✅ Respeita contexto local
✅ Incentiva experimentação

Contras:
❌ Complexo de implementar
❌ Pode criar fragmentação
❌ Difícil de auditar

Exemplo: Cooperativas regionais de crédito
```

**D) Taxa Escalonada (RECOMENDADO)**
```
Definição:
Ano 0-2: Taxa fixa 3%
         - Foco em sustentabilidade
         - Sem margem de lucro
         - 100% reinvestido (infraestrutura + fundo regional)

Ano 2-5: Taxa votável (range 2-4%)
         - Cooperativa pode ajustar
         - Votação trimestral
         - Limite máximo no estatuto

Ano 5+:  Taxa regional (range 1-3%)
         - Cada comunidade decide
         - Fundação define limites
         - Transparência total

Regras imutáveis (no estatuto):
- Taxa NUNCA pode ser > 5%
- Distribuição transparente obrigatória
- Mínimo 30% para Fundo Regional sempre

Pros:
✅ Evolui com o sistema
✅ Começa simples, complexifica com maturidade
✅ Protege contra captura em cada fase
✅ Precedente: Linux Foundation (governance evolving)

Contras:
⚠️ Requer planejamento claro agora
⚠️ Milestones precisam ser públicos

Viabilidade: ALTA
```

**RECOMENDAÇÃO: D (ESCALONADA)**

Por quê?
1. Fase 1 (empresa): Taxa fixa simples (3%)
2. Fase 2 (cooperativa): Votação democrática (2-4%)
3. Fase 3 (fundação): Autonomia regional (1-3%)
4. Proteção sempre: Limite 5% no estatuto imutável

---

### Decisão 3: QUEM É O PRIMEIRO USUÁRIO REAL?

**Cenário real:**
```
Sistema está pronto.
Mas... para quem?

Lançar para "todo mundo" = morrer afogado
Lançar para "nicho errado" = não validar hipótese
Lançar para "nicho certo" = tração + aprendizado
```

**Critérios para primeiro usuário:**

```
✅ DEVE TER:
1. Problema claro que UnifyCard resolve
2. Comunidade organizada (50-200 pessoas)
3. Eventos/atividades regulares
4. Economia local existente (mesmo que informal)
5. Liderança que entende tecnologia social
6. Disposição para feedback constante

❌ NÃO PODE TER:
1. Expectativa de app "pronto" (é piloto!)
2. Estrutura muito complexa (prefeitura inteira)
3. Resistência a mudanças
4. Dependência crítica imediata (não dá para falhar)
```

**Opções:**

**A) Coletivo Cultural**
```
Exemplo: Coletivo de artistas, produtores culturais

Pros:
✅ Comunidade engajada
✅ Eventos frequentes
✅ Economia criativa ativa
✅ Abertos a experimentação
✅ Networking forte

Contras:
❌ Pode ser informal demais
❌ Recursos limitados
❌ Tecnologia pode não ser prioridade

Tamanho ideal: 80-150 pessoas
Duração piloto: 3-6 meses

Exemplo real: Coletivo de teatro/música em bairro
```

**B) ONG com Comunidade**
```
Exemplo: ONG que atende comunidade específica

Pros:
✅ Estrutura formal
✅ Comunidade definida
✅ Atividades recorrentes
✅ Impacto social claro
✅ Relatórios já existem (facilita medir)

Contras:
❌ Pode ter burocracia
❌ Decisões lentas
❌ Dependência de doações

Tamanho ideal: 100-200 pessoas
Duração piloto: 6-12 meses

Exemplo real: ONG de educação popular
```

**C) Bairro/Comunidade Organizada**
```
Exemplo: Associação de moradores, coletivo de bairro

Pros:
✅ Economia local real
✅ Eventos comunitários
✅ Necessidade clara (organização)
✅ Potencial de escala
✅ Validação completa do conceito

Contras:
❌ Mais complexo de coordenar
❌ Expectativas podem ser altas
❌ Política local pode interferir

Tamanho ideal: 150-300 pessoas
Duração piloto: 6-12 meses

Exemplo real: Bairro com feira orgânica + eventos culturais
```

**D) Rede de Profissionais/Freelancers (RECOMENDADO)**
```
Exemplo: Rede de desenvolvedores, designers, consultores

Pros:
✅ Entende tecnologia
✅ Feedback qualificado
✅ Economia ativa (prestação de serviços)
✅ Eventos/workshops frequentes
✅ Network effect natural
✅ Pode evangelizar depois

Contras:
⚠️ Pode não representar "público final"
⚠️ Expectativas técnicas altas
⚠️ Menos "impacto social" visível

Tamanho ideal: 100-200 pessoas
Duração piloto: 3-6 meses

Exemplo real: Comunidade tech de cidade média
```

**RECOMENDAÇÃO: D (REDE DE PROFISSIONAIS) seguido de C (BAIRRO)**

Por quê?
1. Piloto 1 (3-6 meses): Rede tech
   - Validação técnica
   - Feedback qualificado
   - Correções rápidas
   - Evangelização

2. Piloto 2 (6-12 meses): Bairro/Comunidade
   - Validação de impacto social
   - Economia local real
   - Diversidade de uso
   - Modelo completo testado

---

## DOCUMENTOS A PRODUZIR (AGORA)

### 1. IDENTIDADE_INSTITUCIONAL.md
```markdown
# Identidade Institucional - UnifyCard

## Missão
Prover infraestrutura social ética e descentralizada 
para comunidades organizarem sua economia local.

## Valores
1. Transparência: Código aberto, dados auditáveis
2. Autonomia: Comunidades decidem seu próprio destino
3. Neutralidade: Sistema não julga, não otimiza, não manipula
4. Sustentabilidade: Modelo econômico de longo prazo
5. Acessibilidade: Tecnologia para todos, não só especialistas

## Modelo Escolhido
Híbrido (Empresa → Cooperativa → Fundação)

Ano 0-2: Empresa com estatuto blindado
Ano 2-5: Cooperativa com governança comunitária
Ano 5+: Fundação de bem público

## Roadmap Institucional
[Milestones públicos e mensuráveis]

## Blindagens Permanentes
- Observabilidade passiva (O-01 a O-06)
- Taxa administrativa ≤ 5%
- Código aberto e auditável
- Mínimo 30% para Fundo Regional
- Transição irreversível para fundação
```

### 2. GOVERNANCA_INICIAL.md
```markdown
# Governança Inicial - UnifyCard

## Fase 1: Empresa (Ano 0-2)

### Estrutura de Decisão
- Conselho: 5 membros
  - 2 fundadores
  - 2 representantes comunitários (eleitos)
  - 1 especialista independente

### Decisões Requerem
- Operacionais: Maioria simples
- Estratégicas: 4 de 5 votos
- Mudança de missão: IMPOSSÍVEL (estatuto)

### Assembleia Comunitária
- Frequência: Trimestral
- Poder: Consultivo no início, deliberativo após ano 1
- Quórum: 30% dos usuários ativos

### Taxa Administrativa
- Ano 0-2: 3% fixa
- Distribuição: 
  - 40% Infraestrutura
  - 30% Fundo Regional
  - 20% Desenvolvimento
  - 10% Reserva emergencial

### Transparência Obrigatória
- Relatórios trimestrais públicos
- Código-fonte sempre aberto
- Decisões documentadas publicamente

## Fase 2: Cooperativa (Ano 2-5)
[A ser detalhado no ano 1]

## Fase 3: Fundação (Ano 5+)
[A ser detalhado no ano 3]
```

### 3. REGRAS_ECONOMICAS.md
```markdown
# Regras Econômicas - UnifyCard

## Taxa Administrativa

### Fase Atual (Empresa - Ano 0-2)
- Taxa: 3% fixa sobre transações
- Limite máximo: 5% (estatuto imutável)
- Não se aplica a: Doações, repasses de fundo regional

### Distribuição (Fase 1)
```
Transação de R$ 100,00:
├─ R$ 3,00 (taxa administrativa)
│  ├─ R$ 1,20 (40%) → Infraestrutura
│  ├─ R$ 0,90 (30%) → Fundo Regional
│  ├─ R$ 0,60 (20%) → Desenvolvimento
│  └─ R$ 0,30 (10%) → Reserva
└─ R$ 97,00 → Destinatário
```

### Fundo Regional (Obrigatório)
- Mínimo: 30% da taxa (sempre)
- Governança: Comunitária
- Uso: Projetos de impacto local
- Transparência: 100% auditável

### Transição de Fases
Ano 2: Assembleia vota range (2-4%)
Ano 5: Comunidades definem local (1-3%)

## Moeda (MFI Coins)
- Tipo: Moeda comunitária digital
- Paridade: 1 MFI = R$ 1 (fase inicial)
- Conversibilidade: Sim (com taxa conversão)
- Limite emissão: Baseado em lastro real

## Splits de Pagamento
- Tecnicamente possível
- Politicamente definido pela comunidade
- Exemplo: Evento pode ter split com espaço, artistas, produção
```

---

## PRÓXIMOS PASSOS CONCRETOS

### Semana 1 (AGORA)
```
[ ] Decidir modelo institucional (A/B/C/D)
    Recomendação: D (Híbrido)

[ ] Decidir taxa administrativa (A/B/C/D)
    Recomendação: D (Escalonada, começa 3%)

[ ] Decidir primeiro usuário (A/B/C/D)
    Recomendação: D → C (Tech primeiro, depois bairro)
```

### Semana 2
```
[ ] Escrever IDENTIDADE_INSTITUCIONAL.md final
[ ] Escrever GOVERNANCA_INICIAL.md final
[ ] Escrever REGRAS_ECONOMICAS.md final
[ ] Revisar com jurídico (se híbrido)
```

### Semana 3-4
```
[ ] Estruturar empresa (se híbrido)
[ ] Criar estatuto com blindagens
[ ] Definir conselho inicial
[ ] Publicar documentos (transparência)
```

### Mês 2
```
[ ] Congelar core do código
[ ] Aumentar cobertura de testes
[ ] Hardening de segurança
[ ] Preparar ambiente de piloto
```

### Mês 3
```
[ ] Recrutar primeiro usuário (rede tech)
[ ] Onboarding assistido
[ ] Ciclo de feedback semanal
[ ] Correções de UX
```

### Mês 4-6
```
[ ] Avaliar piloto 1
[ ] Recrutar segundo usuário (bairro)
[ ] Piloto 2 com aprendizados
[ ] Preparar lançamento público
```

---

## REGRAS DE DECISÃO

### Para avançar, precisa responder:

**Q1:** Qual modelo institucional? (A/B/C/D)

**Q2:** Qual modelo de taxa? (A/B/C/D)

**Q3:** Quem é o primeiro usuário? (A/B/C/D)

### Depois de responder:
1. Produzir 3 documentos finais
2. Congelar código core
3. Preparar piloto

### NÃO FAZER antes de decidir:
- ❌ Adicionar features (jobs, marketplace, etc)
- ❌ Mudanças arquiteturais grandes
- ❌ Commits que afetam economia
- ❌ Anúncio público

---

## CHECKLIST DE VALIDAÇÃO

### Antes de continuar código:
- [ ] Modelo institucional definido e documentado
- [ ] Governança inicial clara e publicada
- [ ] Regras econômicas explícitas
- [ ] Primeiro usuário identificado
- [ ] Roadmap de transição público
- [ ] Conselho inicial formado
- [ ] Estatuto registrado (se empresa)

### Só então:
- [ ] Voltar ao código
- [ ] Completar gaps técnicos (testes, hardening)
- [ ] Preparar piloto
- [ ] Lançar

---

**Status:** AGUARDANDO DECISÃO  
**Próximo commit:** GOVERNANÇA (não TypeScript)  
**Tempo estimado:** 1-2 semanas para documentos + estrutura inicial  

**Sem isso, qualquer feature nova é ruído.** 🎯
