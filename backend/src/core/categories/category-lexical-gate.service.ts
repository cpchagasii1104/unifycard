// src/core/categories/category-lexical-gate.service.ts
// ETAPA 1: Bloqueio léxico seguro (0-2ms)
// Validação por palavra completa, nunca substring

interface LexicalGateResult {
  decision: 'ALLOW' | 'DENY';
  reasonCode?: string;
  normalized?: string;
}

class CategoryLexicalGateService {
  // Blacklist explícita (palavras completas)
  private readonly BLACKLIST: Set<string> = new Set([
    // Sexual explícito
    'punheteiro', 'punheta', 'masturbação', 'masturbacao', 'sexo', 'pornografia',
    'prostituta', 'prostituto', 'garota de programa', 'garoto de programa',
    'escort', 'acompanhante', 'puta', 'puto', 'vadia', 'viado', 'bicha',
    'cafetão', 'cafetao', 'lenocínio', 'lenocinio',
    // Crimes
    'ladrão', 'ladrao', 'roubo', 'assalto', 'traficante', 'traficar', 'drogas',
    'homicídio', 'homicidio', 'assassinato', 'estelionato', 'fraude', 'corrupção',
    'corrupcao', 'contrabando', 'pirataria', 'pirata', 'hacker criminoso',
    'golpista', 'estelionatário', 'estelionatario',
    // Violência e ódio
    'nazista', 'fascista', 'racista', 'xenófobo', 'xenofobo', 'homofóbico',
    'homofobico', 'misógino', 'misogino', 'terrorista', 'terrorismo',
    'assassino de aluguel', 'matador', 'sicário', 'sicario',
  ]);

  // Whitelist para exceções legítimas
  private readonly WHITELIST: Set<string> = new Set([
    'sexólogo', 'sexologo', 'sexóloga', 'sexologa', // Profissão legítima
    'penalista', // Advogado criminalista
    'analista de tráfego', 'analista de trafego', // Marketing digital
    'analista de tráfego pago', 'analista de trafego pago',
  ]);

  /**
   * Normaliza input para comparação
   */
  private normalizeInput(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();
  }

  /**
   * Divide texto em palavras (split por whitespace)
   */
  private splitWords(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Verifica se alguma palavra completa está na blacklist
   */
  private checkBlacklist(normalizedInput: string, words: string[]): { blocked: boolean; reasonCode?: string } {
    // Verificar match exato primeiro
    if (this.BLACKLIST.has(normalizedInput)) {
      return { blocked: true, reasonCode: 'BLACKLIST_EXACT_MATCH' };
    }

    // Verificar cada palavra completa
    for (const word of words) {
      if (this.BLACKLIST.has(word)) {
        return { blocked: true, reasonCode: 'BLACKLIST_WORD_MATCH' };
      }
    }

    // Verificar frases completas na blacklist
    for (const blocked of this.BLACKLIST) {
      if (normalizedInput === blocked || normalizedInput.includes(` ${blocked} `) || 
          normalizedInput.startsWith(`${blocked} `) || normalizedInput.endsWith(` ${blocked}`)) {
        return { blocked: true, reasonCode: 'BLACKLIST_PHRASE_MATCH' };
      }
    }

    return { blocked: false };
  }

  /**
   * Verifica se está na whitelist (sobrescreve blacklist)
   * FASE 3.7.1: Hardening - Match exato ou n-gram completo, NUNCA substring
   * REGRA: Apenas comparação exata de palavras/frases completas
   */
  private checkWhitelist(normalizedInput: string): boolean {
    // 1. Match exato do input completo
    if (this.WHITELIST.has(normalizedInput)) {
      return true;
    }

    // 2. Match por frases completas (n-gramas de 2 a 5 palavras)
    // Divide o input em palavras
    const words = normalizedInput.split(/\s+/).filter(w => w.length > 0);
    
    // Gera n-gramas de 2 a 5 palavras e verifica match exato na whitelist
    for (let i = 0; i < words.length; i++) {
      for (let len = 2; len <= 5 && i + len <= words.length; len++) {
        // Cria frase completa de 'len' palavras consecutivas
        const phrase = words.slice(i, i + len).join(' ');
        // Verifica match exato (não substring)
        if (this.WHITELIST.has(phrase)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Valida entrada léxica
   * Performance: 0-2ms (apenas comparações em memória)
   */
  validate(input: string): LexicalGateResult {
    const normalized = this.normalizeInput(input);
    const words = this.splitWords(input);

    // 1. Verificar whitelist primeiro (sobrescreve blacklist)
    if (this.checkWhitelist(normalized)) {
      return {
        decision: 'ALLOW',
        normalized,
      };
    }

    // 2. Verificar blacklist
    const blacklistCheck = this.checkBlacklist(normalized, words);
    if (blacklistCheck.blocked) {
      return {
        decision: 'DENY',
        reasonCode: blacklistCheck.reasonCode || 'BLACKLIST_MATCH',
        normalized,
      };
    }

    // 3. Permitir se passou todas as verificações
    return {
      decision: 'ALLOW',
      normalized,
    };
  }
}

export const categoryLexicalGateService = new CategoryLexicalGateService();
export type { LexicalGateResult };















