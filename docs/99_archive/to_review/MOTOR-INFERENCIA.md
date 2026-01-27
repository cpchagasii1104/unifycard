# Motor de Inferência entre Trilhas

## 🎯 Objetivo

Observar padrões entre as trilhas (Físico, Aprendizado, Profissional) e gerar sugestões contextuais **sem forçar ações do usuário**.

## 🧠 Princípios

1. **Observação, não imposição**: O sistema observa padrões, não força decisões
2. **Sugestões opcionais**: Todas as sugestões são dismissíveis
3. **Mapeamento por afinidade**: Usa semântica, não IDs diretos
4. **Priorização inteligente**: Sugestões mais relevantes aparecem primeiro

## 📊 Estados do Usuário

| Estado | Físico | Aprendizado | Profissional | Descrição |
|--------|--------|-------------|--------------|-----------|
| `explorer` | ✅ | ❌ | ❌ | Apenas atividades de prazer |
| `curious` | ✅ | ✅ | ❌ | Prazer + aprendizado |
| `in_transition` | ❌/✅ | ✅ | ❌ | Aprendizado ativo, sem profissão |
| `professional_training` | ❌ | ✅ | ✅ | Aprendizado + profissão |
| `professional_stable` | ❌ | ❌ | ✅ | Apenas profissão |
| `at_risk` | ❌ | ❌ | ✅ (intenso) | Profissional sem prazer |

## 🔄 Regras de Inferência

### REGRA A: Físico → Aprendizado

**Condição:**
- Usuário marca Físico em uma categoria
- Não possui Aprendizado relacionado

**Ação:**
- Sugerir (1 vez, suave): "Quer aprender mais sobre isso?"

**Exemplo:**
- Físico: Criar & Expressar → Fotografia
- Sugestão: Aprendizado → Fotografia

### REGRA B: Aprendizado → Profissional

**Condição:**
- Usuário marca Aprendizado
- Progresso = Intermediário ou Avançado
- Nenhuma profissão cadastrada relacionada

**Ação:**
- CTA não invasivo: "Você já pensou em usar isso profissionalmente?"

**Exemplo:**
- Aprendizado: Fotografia (Intermediário)
- Sugestão: Profissional → Fotógrafo

### REGRA C: Profissional sem Físico

**Condição:**
- Profissional preenchido
- Físico vazio ou abandonado

**Ação:**
- Sugerir conteúdos/interesses
- **Nunca mencionar "burnout"**
- Linguagem: "O que você gosta de fazer fora do trabalho?"

### REGRA D: Aprendizado Estagnado

**Condição:**
- Aprendizado cadastrado
- Nenhuma atualização por X tempo

**Ação:**
- Oferecer: conteúdo, comunidade, retomada leve
- **Nunca cobrança**

## 🗺️ Mapeamento de Afinidade

O sistema usa mapeamento semântico entre categorias de diferentes contextos:

```typescript
{
  physicalCategory: 'criar-expressar',
  learningCategories: ['fotografia-aprendizado', 'desenho-ilustracao'],
  professionalCategories: ['fotografo', 'designer']
}
```

Isso permite:
- ✅ Sugestões inteligentes
- ✅ Zero hard-coding
- ✅ Evolução contínua

## 🚀 API

### GET /profile/inference

Retorna inferências completas:
- Estado do usuário
- Sugestões contextuais
- Insights

**Resposta:**
```json
{
  "ok": true,
  "data": {
    "userState": "curious",
    "suggestions": [
      {
        "id": "physical_to_learning_xxx",
        "type": "physical_to_learning",
        "title": "Quer aprender mais sobre isso?",
        "message": "Você gosta de \"Fotografia\". Que tal explorar isso como aprendizado?",
        "actionLabel": "Ver temas de aprendizado",
        "categoryId": "...",
        "categoryName": "Fotografia",
        "priority": 7,
        "dismissible": true
      }
    ],
    "insights": {
      "hasPhysicalWithoutLearning": true,
      "hasLearningWithoutProfessional": false,
      "hasProfessionalWithoutPhysical": false,
      "learningStagnant": false
    }
  }
}
```

### GET /profile/inference/snapshot

Retorna snapshot do perfil (para debug/analytics):
- Dados completos das 3 trilhas
- Estado detectado

## 🔒 Regras de Governança

1. **Nunca forçar ações**: Todas as sugestões são opcionais
2. **Não bloquear fluxo**: Sugestões não impedem uso do sistema
3. **Não repetir**: Sistema rastreia sugestões já mostradas
4. **Linguagem humana**: Mensagens não parecem algorítmicas

## 📈 Próximos Passos

- [ ] Detecção de aprendizado estagnado (baseado em tempo)
- [ ] Cache de sugestões para performance
- [ ] Analytics de aceitação de sugestões
- [ ] Expansão do mapeamento de afinidade
- [ ] Integração com feed e matching


























