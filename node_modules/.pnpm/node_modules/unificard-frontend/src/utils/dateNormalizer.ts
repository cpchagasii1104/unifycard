// src/utils/dateNormalizer.ts
// Utilitários para normalização de datas de nascimento

/**
 * Converte data de nascimento para formato ISO (YYYY-MM-DD)
 * Aceita formatos: DD/MM/YYYY ou YYYY-MM-DD
 * @param input - Data no formato DD/MM/YYYY ou YYYY-MM-DD
 * @returns Data no formato YYYY-MM-DD ou null se inválida
 * @example
 * parseBirthdateToISO("03/09/1953") // "1953-09-03"
 * parseBirthdateToISO("1953-09-03") // "1953-09-03"
 */
export function parseBirthdateToISO(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();
  
  if (!trimmed) {
    return null;
  }

  // Se já está no formato YYYY-MM-DD, validar e retornar
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    
    // Validar valores
    if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      // Validar data real (ex: 31/02 não existe)
      const date = new Date(yearNum, monthNum - 1, dayNum);
      if (date.getFullYear() === yearNum && date.getMonth() === monthNum - 1 && date.getDate() === dayNum) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  }

  // Tentar converter de DD/MM/YYYY para YYYY-MM-DD
  const ddMMyyyyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMMyyyyMatch) {
    const [, day, month, year] = ddMMyyyyMatch;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    // Validar valores
    if (yearNum >= 1900 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
      // Validar data real (ex: 31/02 não existe)
      const date = new Date(yearNum, monthNum - 1, dayNum);
      if (date.getFullYear() === yearNum && date.getMonth() === monthNum - 1 && date.getDate() === dayNum) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  }

  // Formato não reconhecido
  return null;
}

/**
 * Formata data ISO para exibição brasileira (DD/MM/YYYY)
 * @param iso - Data no formato YYYY-MM-DD
 * @returns Data no formato DD/MM/YYYY ou string vazia se inválida
 * @example
 * formatISOToBR("1953-09-03") // "03/09/1953"
 */
export function formatISOToBR(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string') {
    return '';
  }

  const trimmed = iso.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  return '';
}




