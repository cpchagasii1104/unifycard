// src/utils/validation.ts
// Utilitários de validação e sanitização

/**
 * Sanitiza string removendo caracteres perigosos e limitando tamanho
 * IMPORTANTE: Mantém espaços no meio do texto, apenas remove nas bordas
 */
export function sanitizeString(value: string, maxLength: number = 255): string {
  if (typeof value !== 'string') return '';
  
  // Remove tags HTML perigosas primeiro
  let sanitized = value.replace(/[<>]/g, '');
  
  // Limita tamanho
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  // Remove espaços apenas no início e fim (trim)
  return sanitized.trim();
}

/**
 * Sanitiza texto longo (bio, descrição)
 */
export function sanitizeText(value: string, maxLength: number = 5000): string {
  if (typeof value !== 'string') return '';
  
  return value
    .trim()
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .slice(0, maxLength);
}

/**
 * Valida nome completo (mínimo 3 caracteres, máximo 100)
 */
export function validateFullName(name: string): { valid: boolean; error?: string } {
  const sanitized = sanitizeString(name, 100);
  
  if (!sanitized || sanitized.length < 3) {
    return { valid: false, error: 'Nome deve ter pelo menos 3 caracteres' };
  }
  
  if (sanitized.length > 100) {
    return { valid: false, error: 'Nome deve ter no máximo 100 caracteres' };
  }
  
  // Verifica se tem pelo menos nome e sobrenome
  const parts = sanitized.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 2) {
    return { valid: false, error: 'Digite nome e sobrenome' };
  }
  
  return { valid: true };
}

/**
 * Valida data de nascimento (idade entre 16 e 120 anos)
 */
export function validateBirthdate(birthdate: string): { valid: boolean; error?: string; age?: number } {
  if (!birthdate) {
    return { valid: false, error: 'Data de nascimento é obrigatória' };
  }
  
  // 🔴 CRÍTICO: Validar formato YYYY-MM-DD e criar Date usando UTC
  // Isso evita problemas de timezone que podem mudar o dia
  const dateMatch = birthdate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return { valid: false, error: 'Formato de data inválido. Use YYYY-MM-DD' };
  }
  
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months são 0-indexed
  const day = parseInt(dateMatch[3], 10);
  
  // Criar Date usando UTC para evitar problemas de timezone
  const date = new Date(Date.UTC(year, month, day));
  
  // Validar se a data é válida (ex: 31/02 não existe)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return { valid: false, error: 'Data inválida' };
  }
  
  // Calcular idade usando UTC
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const birthUTC = new Date(Date.UTC(year, month, day));
  
  if (birthUTC > todayUTC) {
    return { valid: false, error: 'Data de nascimento não pode ser no futuro' };
  }
  
  let age = todayUTC.getUTCFullYear() - birthUTC.getUTCFullYear();
  const monthDiff = todayUTC.getUTCMonth() - birthUTC.getUTCMonth();
  const dayDiff = todayUTC.getUTCDate() - birthUTC.getUTCDate();
  
  const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
  
  if (actualAge < 16) {
    return { valid: false, error: 'Você deve ter pelo menos 16 anos', age: actualAge };
  }
  
  if (actualAge > 120) {
    return { valid: false, error: 'Data de nascimento inválida', age: actualAge };
  }
  
  return { valid: true, age: actualAge };
}

/**
 * Valida telefone brasileiro
 */
export function validateBrazilianPhone(areaCode: string, number: string): { valid: boolean; error?: string } {
  const cleanNumber = number.replace(/\D/g, '');
  
  if (!areaCode || areaCode.length !== 2) {
    return { valid: false, error: 'DDD inválido' };
  }
  
  if (cleanNumber.length !== 9 && cleanNumber.length !== 8) {
    return { valid: false, error: 'Número deve ter 8 ou 9 dígitos' };
  }
  
  if (cleanNumber.length === 9 && !cleanNumber.startsWith('9')) {
    return { valid: false, error: 'Celular deve começar com 9' };
  }
  
  return { valid: true };
}

/**
 * Valida CEP brasileiro
 */
export function validateCEP(cep: string): { valid: boolean; error?: string } {
  const cleanCEP = cep.replace(/\D/g, '');
  
  if (cleanCEP.length !== 8) {
    return { valid: false, error: 'CEP deve ter 8 dígitos' };
  }
  
  // Verifica se não é um CEP inválido conhecido
  if (/^0{8}$/.test(cleanCEP)) {
    return { valid: false, error: 'CEP inválido' };
  }
  
  return { valid: true };
}

/**
 * Valida endereço completo
 */
export function validateAddress(address: {
  cep?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!address.cep || !validateCEP(address.cep).valid) {
    errors.push('CEP inválido');
  }
  
  if (!address.street || address.street.trim().length < 3) {
    errors.push('Logradouro deve ter pelo menos 3 caracteres');
  }
  
  if (!address.number || address.number.trim().length === 0) {
    errors.push('Número é obrigatório');
  }
  
  if (!address.neighborhood || address.neighborhood.trim().length < 2) {
    errors.push('Bairro deve ter pelo menos 2 caracteres');
  }
  
  if (!address.city || address.city.trim().length < 2) {
    errors.push('Cidade deve ter pelo menos 2 caracteres');
  }
  
  if (!address.state || address.state.trim().length !== 2) {
    errors.push('Estado deve ter 2 caracteres (ex: PR, SP)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida valor monetário (não negativo, máximo 999999.99)
 */
export function validateMonetaryValue(value: number | null | undefined): { valid: boolean; error?: string } {
  if (value === null || value === undefined) {
    return { valid: true }; // Opcional
  }
  
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Valor inválido' };
  }
  
  if (value < 0) {
    return { valid: false, error: 'Valor não pode ser negativo' };
  }
  
  if (value > 999999.99) {
    return { valid: false, error: 'Valor muito alto (máximo: R$ 999.999,99)' };
  }
  
  return { valid: true };
}

/**
 * Valida anos de experiência (0 a 50)
 */
export function validateYearsExperience(years: number, age?: number): { valid: boolean; error?: string } {
  if (typeof years !== 'number' || isNaN(years)) {
    return { valid: false, error: 'Anos de experiência inválidos' };
  }
  
  if (years < 0) {
    return { valid: false, error: 'Anos de experiência não podem ser negativos' };
  }
  
  if (years > 50) {
    return { valid: false, error: 'Anos de experiência não podem ser maiores que 50' };
  }
  
  // Se temos a idade, validar coerência
  if (age !== undefined && years > age - 16) {
    return { valid: false, error: 'Anos de experiência não podem ser maiores que sua idade menos 16' };
  }
  
  return { valid: true };
}

/**
 * Valida período de datas (início < fim)
 */
export function validateDateRange(startDate: string, endDate: string): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { valid: false, error: 'Data de início inválida' };
  }
  
  if (isNaN(end.getTime())) {
    return { valid: false, error: 'Data de fim inválida' };
  }
  
  if (start > end) {
    return { valid: false, error: 'Data de início deve ser anterior à data de fim' };
  }
  
  return { valid: true };
}

/**
 * Valida horário (formato HH:MM)
 */
export function validateTime(time: string): { valid: boolean; error?: string } {
  if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return { valid: false, error: 'Horário inválido (formato: HH:MM)' };
  }
  
  return { valid: true };
}

/**
 * Valida intervalo de horário (início < fim)
 */
export function validateTimeRange(startTime: string, endTime: string): { valid: boolean; error?: string } {
  const startValidation = validateTime(startTime);
  if (!startValidation.valid) {
    return startValidation;
  }
  
  const endValidation = validateTime(endTime);
  if (!endValidation.valid) {
    return endValidation;
  }
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (startMinutes >= endMinutes) {
    return { valid: false, error: 'Horário de início deve ser anterior ao horário de fim' };
  }
  
  // Validar duração mínima (15 minutos)
  if (endMinutes - startMinutes < 15) {
    return { valid: false, error: 'Intervalo mínimo é de 15 minutos' };
  }
  
  return { valid: true };
}

/**
 * Valida entrada de educação
 */
export function validateEducationEntry(edu: {
  level: string;
  institution: string;
  startDate?: string;
  endDate?: string | null;
  isCompleted: boolean;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!edu.institution || edu.institution.trim().length < 2) {
    errors.push('Instituição é obrigatória e deve ter pelo menos 2 caracteres');
  }
  
  if (edu.startDate) {
    const start = new Date(edu.startDate);
    if (isNaN(start.getTime())) {
      errors.push('Data de início inválida');
    } else if (start > new Date()) {
      errors.push('Data de início não pode ser no futuro');
    }
  }
  
  if (edu.isCompleted && edu.endDate) {
    const end = new Date(edu.endDate);
    if (isNaN(end.getTime())) {
      errors.push('Data de conclusão inválida');
    } else {
      if (edu.startDate) {
        const start = new Date(edu.startDate);
        if (end < start) {
          errors.push('Data de conclusão deve ser posterior à data de início');
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitiza objeto removendo propriedades undefined/null desnecessárias
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'string') {
        sanitized[key as keyof T] = sanitizeString(value, 255) as T[keyof T];
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T];
      } else {
        sanitized[key as keyof T] = value;
      }
    }
  }
  
  return sanitized;
}

