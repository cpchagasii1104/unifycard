// src/utils/dateNormalizer.ts
// Utilitário para normalização de datas de nascimento no backend

/**
 * Normaliza data de nascimento para formato ISO (YYYY-MM-DD)
 * Aceita formatos: DD/MM/YYYY ou YYYY-MM-DD
 * Faz parser manual (split) para evitar problemas de timezone
 * @param input - Data no formato DD/MM/YYYY ou YYYY-MM-DD
 * @returns Data no formato YYYY-MM-DD
 * @throws Error com statusCode 400 se formato inválido
 * @example
 * normalizeBirthdate("03/09/1953") // "1953-09-03"
 * normalizeBirthdate("1953-09-03") // "1953-09-03"
 */
export function normalizeBirthdate(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') {
    const error = new Error('Data de nascimento é obrigatória');
    (error as any).statusCode = 400;
    throw error;
  }

  const trimmed = input.trim();
  
  if (!trimmed) {
    const error = new Error('Data de nascimento não pode estar vazia');
    (error as any).statusCode = 400;
    throw error;
  }

  // Se já está no formato YYYY-MM-DD, validar e retornar
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    
    // Validar valores
    if (yearNum < 1900 || yearNum > 2100) {
      const error = new Error(`Ano inválido: ${yearNum}. Deve estar entre 1900 e 2100`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (monthNum < 1 || monthNum > 12) {
      const error = new Error(`Mês inválido: ${monthNum}. Deve estar entre 1 e 12`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (dayNum < 1 || dayNum > 31) {
      const error = new Error(`Dia inválido: ${dayNum}. Deve estar entre 1 e 31`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    // Validar data real (ex: 31/02 não existe)
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
      const error = new Error(`Data inválida: ${trimmed}. Verifique se a data existe (ex: 31/02 não existe)`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    return `${year}-${month}-${day}`;
  }

  // Tentar converter de DD/MM/YYYY para YYYY-MM-DD (parser manual)
  const ddMMyyyyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMMyyyyMatch) {
    const [, day, month, year] = ddMMyyyyMatch;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    // Validar valores
    if (yearNum < 1900 || yearNum > 2100) {
      const error = new Error(`Ano inválido: ${yearNum}. Deve estar entre 1900 e 2100`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (monthNum < 1 || monthNum > 12) {
      const error = new Error(`Mês inválido: ${monthNum}. Deve estar entre 1 e 12`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    if (dayNum < 1 || dayNum > 31) {
      const error = new Error(`Dia inválido: ${dayNum}. Deve estar entre 1 e 31`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    // Validar data real (ex: 31/02 não existe)
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (date.getFullYear() !== yearNum || date.getMonth() !== monthNum - 1 || date.getDate() !== dayNum) {
      const error = new Error(`Data inválida: ${trimmed}. Verifique se a data existe (ex: 31/02 não existe)`);
      (error as any).statusCode = 400;
      throw error;
    }
    
    return `${year}-${month}-${day}`;
  }

  // Formato não reconhecido
  const error = new Error(`Formato de data inválido: "${trimmed}". Use DD/MM/YYYY ou YYYY-MM-DD (ex: 03/09/1953 ou 1953-09-03)`);
  (error as any).statusCode = 400;
  throw error;
}




