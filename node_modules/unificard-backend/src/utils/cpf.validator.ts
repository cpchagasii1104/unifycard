/**
 * Utilitário de validação de CPF
 * Implementa algoritmo oficial de validação de CPF brasileiro
 * 
 * Regras:
 * - CPF deve ter 11 dígitos (apenas números)
 * - Validação de dígitos verificadores
 * - Rejeita CPFs conhecidos como inválidos (111.111.111-11, etc)
 */

/**
 * Normaliza CPF removendo caracteres não numéricos
 */
export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida se o CPF tem formato correto (11 dígitos)
 */
function hasValidLength(cpf: string): boolean {
  return cpf.length === 11;
}

/**
 * Valida se o CPF não é uma sequência de números repetidos
 * Ex: 111.111.111-11, 000.000.000-00, etc
 */
function isNotRepeatedSequence(cpf: string): boolean {
  const firstDigit = cpf[0];
  return !cpf.split('').every(digit => digit === firstDigit);
}

/**
 * Calcula o dígito verificador do CPF
 * @param cpf - CPF sem os dois últimos dígitos
 * @param position - Posição do dígito verificador (9 ou 10)
 */
function calculateVerifierDigit(cpf: string, position: number): number {
  let sum = 0;
  const weight = position + 1;
  
  for (let i = 0; i < position; i++) {
    sum += parseInt(cpf[i]) * (weight - i);
  }
  
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida os dígitos verificadores do CPF
 */
function hasValidVerifierDigits(cpf: string): boolean {
  const first9Digits = cpf.substring(0, 9);
  
  const firstVerifier = calculateVerifierDigit(first9Digits, 9);
  const secondVerifier = calculateVerifierDigit(first9Digits + firstVerifier, 10);
  
  return (
    parseInt(cpf[9]) === firstVerifier &&
    parseInt(cpf[10]) === secondVerifier
  );
}

/**
 * Valida CPF completo usando algoritmo oficial
 * 
 * @param cpf - CPF a ser validado (pode conter formatação)
 * @returns true se CPF é válido, false caso contrário
 */
export function validateCpf(cpf: string): boolean {
  const normalized = normalizeCpf(cpf);
  
  if (!hasValidLength(normalized)) {
    return false;
  }
  
  if (!isNotRepeatedSequence(normalized)) {
    return false;
  }
  
  if (!hasValidVerifierDigits(normalized)) {
    return false;
  }
  
  return true;
}

/**
 * Valida CPF e lança erro se inválido
 * 
 * @param cpf - CPF a ser validado (pode conter formatação)
 * @throws Error se CPF for inválido
 */
export function validateCpfOrThrow(cpf: string): void {
  const normalized = normalizeCpf(cpf);
  
  if (!hasValidLength(normalized)) {
    throw new Error('CPF deve conter 11 dígitos');
  }
  
  if (!isNotRepeatedSequence(normalized)) {
    throw new Error('CPF inválido: sequência de números repetidos não é permitida');
  }
  
  if (!hasValidVerifierDigits(normalized)) {
    throw new Error('CPF inválido: dígitos verificadores incorretos');
  }
}

/**
 * Mascara CPF para exibição (000.000.000-00)
 */
export function maskCpf(cpf: string): string {
  const normalized = normalizeCpf(cpf);
  if (normalized.length !== 11) {
    return cpf; // Retorna original se não tiver 11 dígitos
  }
  return `${normalized.substring(0, 3)}.${normalized.substring(3, 6)}.${normalized.substring(6, 9)}-${normalized.substring(9, 11)}`;
}

/**
 * Sanitiza CPF para logs (mostra apenas primeiros 3 dígitos)
 */
export function sanitizeCpfForLog(cpf: string): string {
  const normalized = normalizeCpf(cpf);
  if (normalized.length !== 11) {
    return '***';
  }
  return `${normalized.substring(0, 3)}***`;
}
