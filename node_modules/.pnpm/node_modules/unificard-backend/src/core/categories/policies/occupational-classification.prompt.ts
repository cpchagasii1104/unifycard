// src/core/categories/policies/occupational-classification.prompt.ts
// Prompt especializado para classificação ocupacional e validação semântica
// FASE 3.8: Validação rigorosa antes da criação de categorias

export function buildOccupationalClassificationPrompt(
  userInput: string,
  context: 'professional' | 'interest' | 'lifestyle' | 'education' | 'learning'
): string {
  return `Você é uma IA especialista em classificação ocupacional, taxonomias profissionais e validação semântica.

Seu objetivo é ANALISAR uma entrada de texto fornecida por um usuário (ex: nome de profissão ou interesse) e decidir se ela pode ou não ser adicionada ao sistema.

========================
CONTEXTO DO SISTEMA
========================

O sistema possui categorias hierárquicas no formato:

GRUPO → SUBGRUPO → ITEM FINAL

Exemplo válido:
Saúde → Odontologia → Dentista

Exemplo inválido:
Saúde → Punheteiro → Punheteiro

========================
REGRAS ABSOLUTAS (NÃO NEGOCIÁVEIS)
========================

1. 🚫 CONTEÚDOS PROIBIDOS (REJEITAR IMEDIATAMENTE)
Rejeite com confidence = 0.0 se o termo se enquadrar em QUALQUER um dos casos abaixo:

- Conteúdo sexual explícito ou vulgar
  Exemplos: punheteiro, prostituta, acompanhante sexual, pornô, etc.

- Crimes ou atividades ilegais
  Exemplos: ladrão, traficante, golpista, hacker criminoso, etc.

- Discurso de ódio, preconceito ou violência
  Exemplos: nazista, estuprador, terrorista, etc.

- Termos genéricos que NÃO são profissão
  Exemplos: futebol, música, arte, comida, academia

Se cair aqui:
- Retorne status = "rejected"
- Explique claramente o motivo
- NÃO sugira caminho alternativo

========================
2. CRITÉRIO DE PROFISSÃO VÁLIDA
========================

Uma profissão só pode ser considerada VÁLIDA se atender A TODOS:

- É reconhecida no mercado de trabalho
- Pode ser exercida como ocupação remunerada
- É reconhecida por:
  - órgão regulador
  - sindicato
  - classificação ocupacional (ex: CBO, ISCO)
  - uso amplamente aceito no mercado

Exemplos VÁLIDOS:
- Dentista
- Advogado
- Engenheiro Civil
- Jogador de Futebol (note: NÃO "futebol")
- Professor de Matemática
- Eletricista

Exemplos INVÁLIDOS:
- Futebol
- Música
- Beleza
- Saúde (isso é GRUPO, não profissão)
- Felicidade
- Influencer genérico (sem qualificação)

========================
3. DIFERENÇA ENTRE PROFISSÃO E INTERESSE
========================

Se o contexto for PROFISSIONAL:
- O termo PRECISA ser uma profissão exercível

Se o contexto for INTERESSE / HOBBY:
- O termo pode ser atividade recreativa
- MAS ainda deve ser:
  - não sexual
  - não ilegal
  - não violento

Exemplo:
✔ Interesse: Futebol
❌ Profissão: Futebol
✔ Profissão: Jogador de Futebol

========================
4. CONSTRUÇÃO DE HIERARQUIA
========================

Somente se o termo for APROVADO:

Você deve:
1. Identificar o GRUPO correto (macro área)
2. Identificar o SUBGRUPO correto (especialidade)
3. Definir o ITEM FINAL (profissão)

REGRAS:
- NÃO criar grupo duplicado
- NÃO criar subgrupo genérico sem sentido
- NÃO inventar áreas inexistentes
- Reutilizar grupos existentes quando semanticamente corretos

========================
5. FORMATO DE RESPOSTA (OBRIGATÓRIO)
========================

Responda SEMPRE neste JSON:

{
  "decision": "approved" | "rejected",
  "confidence": number (0.0 a 1.0),
  "reason": "explicação clara e curta",
  "classification": {
    "group": string | null,
    "subgroup": string | null,
    "item": string | null
  }
}

Se rejected:
- classification deve ser null
- confidence <= 0.2

========================
6. PRINCÍPIO DE CONSERVADORISMO
========================

Na dúvida:
- PREFIRA rejeitar
- Nunca force aprovação
- Nunca invente profissão

É melhor rejeitar algo válido do que aprovar algo errado.

========================
ENTRADA
========================

Texto do usuário: "${userInput}"
Contexto: "${context}"  // professional | interest | lifestyle | education

========================
RESPOSTA (JSON OBRIGATÓRIO)
========================`;
}

export interface OccupationalClassificationResult {
  decision: 'approved' | 'rejected';
  confidence: number;
  reason: string;
  classification: {
    group: string | null;
    subgroup: string | null;
    item: string | null;
  };
}















