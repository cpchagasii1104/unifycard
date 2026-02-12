// src/utils/dateUtils.ts
// Utilitários para manipulação de datas

/**
 * Converte qualquer formato de data para ISO (yyyy-MM-dd)
 * Suporta: dd/MM/yyyy, yyyy-MM-dd, Date object, ISO string
 * @param dateInput - Data em qualquer formato válido
 * @returns Data no formato yyyy-MM-dd ou string vazia se inválida
 * @example
 * toISODate("03/09/1953") // "1953-09-03"
 * toISODate("1953-09-03") // "1953-09-03"
 * toISODate(new Date("1953-09-03")) // "1953-09-03"
 */
export function toISODate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) {
    return '';
  }

  // Se for objeto Date, converter para YYYY-MM-DD usando UTC
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      console.warn('[dateUtils] Data inválida (Date object):', dateInput);
      return '';
    }
    const year = dateInput.getUTCFullYear();
    const month = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateInput.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Se for string, processar
  if (typeof dateInput !== 'string') {
    console.warn('[dateUtils] Tipo de data inválido:', typeof dateInput);
    return '';
  }

  const trimmed = dateInput.trim();
  
  // Se já está no formato yyyy-MM-dd, retornar diretamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Tentar converter de dd/MM/yyyy para yyyy-MM-dd
  const ddMMyyyyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ddMMyyyyMatch) {
    const [, day, month, year] = ddMMyyyyMatch;
    // Validar que os valores são válidos
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
      return `${year}-${month}-${day}`;
    }
  }

  // Tentar extrair de ISO string (com timezone)
  const isoMatch = trimmed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0]; // Retorna YYYY-MM-DD
  }

  // Se não conseguiu converter, retornar string vazia
  console.warn('[dateUtils] Formato de data inválido:', dateInput);
  return '';
}

/**
 * @deprecated Use toISODate instead
 * Converte data do formato dd/MM/yyyy para yyyy-MM-dd (ISO)
 */
export function parseDateToISO(dateString: string): string {
  return toISODate(dateString);
}

/**
 * Converte data do formato yyyy-MM-dd para dd/MM/yyyy
 * @param dateString - Data no formato yyyy-MM-dd (ex: "1953-09-03")
 * @returns Data no formato dd/MM/yyyy (ex: "03/09/1953") ou string vazia se inválida
 * @example
 * formatDateToBR("1953-09-03") // "03/09/1953"
 * formatDateToBR("2000-12-31") // "31/12/2000"
 */
export function formatDateToBR(dateString: string): string {
  if (!dateString || typeof dateString !== 'string') {
    return '';
  }

  const trimmed = dateString.trim();
  
  // Se já está no formato dd/MM/yyyy, retornar diretamente
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // Tentar converter de yyyy-MM-dd para dd/MM/yyyy
  const yyyyMMddMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (yyyyMMddMatch) {
    const [, year, month, day] = yyyyMMddMatch;
    return `${day}/${month}/${year}`;
  }

  // Se não conseguiu converter, retornar string vazia
  console.warn('[dateUtils] Formato de data inválido:', dateString);
  return '';
}

