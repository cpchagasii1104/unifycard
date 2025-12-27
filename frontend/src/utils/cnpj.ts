// frontend/src/utils/cnpj.ts
// Utilitários para CNPJ

/**
 * Remove formatação do CNPJ
 */
export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

/**
 * Formata CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string): string {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Valida CNPJ
 */
export function validateCNPJ(cnpj: string): { valid: boolean; error?: string } {
  const clean = cleanCNPJ(cnpj);
  
  if (clean.length !== 14) {
    return { valid: false, error: 'CNPJ deve ter 14 dígitos' };
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(clean)) {
    return { valid: false, error: 'CNPJ inválido' };
  }

  // Validação dos dígitos verificadores
  let length = clean.length - 2;
  let numbers = clean.substring(0, length);
  const digits = clean.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return { valid: false, error: 'CNPJ inválido' };
  }

  length = length + 1;
  numbers = clean.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return { valid: false, error: 'CNPJ inválido' };
  }

  return { valid: true };
}

/**
 * Aplica máscara de CNPJ enquanto digita
 */
export function maskCNPJ(value: string): string {
  const clean = cleanCNPJ(value);
  if (clean.length <= 2) return clean;
  if (clean.length <= 5) return clean.replace(/^(\d{2})(\d+)$/, '$1.$2');
  if (clean.length <= 8) return clean.replace(/^(\d{2})(\d{3})(\d+)$/, '$1.$2.$3');
  if (clean.length <= 12) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, '$1.$2.$3/$4');
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d+)$/, '$1.$2.$3/$4-$5');
}


