// backend/src/core/kyc/kyc.validators.ts
// SPRINT 84: KYC BÁSICO + DADOS OBRIGATÓRIOS FISCAIS

import { normalizeCpf, validateCpf } from '../../utils/cpf.validator';

/**
 * Resultado de validação
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida CPF com dígito verificador
 */
export function validateCPF(cpf: string): ValidationResult {
  const errors: string[] = [];
  const normalized = normalizeTaxId(cpf);

  if (normalized.length !== 11) {
    errors.push('CPF deve ter 11 dígitos');
    return { valid: false, errors };
  }

  if (!validateCpf(normalized)) {
    errors.push('CPF inválido (dígitos verificadores incorretos)');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida CNPJ com dígito verificador
 */
export function validateCNPJ(cnpj: string): ValidationResult {
  const errors: string[] = [];
  const normalized = normalizeTaxId(cnpj);

  if (normalized.length !== 14) {
    errors.push('CNPJ deve ter 14 dígitos');
    return { valid: false, errors };
  }

  // Verifica se todos os dígitos são iguais (formato inválido óbvio)
  if (/^(\d)\1+$/.test(normalized)) {
    errors.push('CNPJ inválido (todos os dígitos são iguais)');
    return { valid: false, errors };
  }

  // Validação dos dígitos verificadores
  let length = normalized.length - 2;
  let numbers = normalized.substring(0, length);
  const digits = normalized.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    errors.push('CNPJ inválido (primeiro dígito verificador incorreto)');
    return { valid: false, errors };
  }

  length = length + 1;
  numbers = normalized.substring(0, length);
  sum = 0;
  pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    errors.push('CNPJ inválido (segundo dígito verificador incorreto)');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida email
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];

  if (!email || email.trim().length === 0) {
    errors.push('Email é obrigatório');
    return { valid: false, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Email inválido');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Valida telefone
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];

  if (!phone || phone.trim().length === 0) {
    errors.push('Telefone é obrigatório');
    return { valid: false, errors };
  }

  // Remove caracteres não numéricos para validação
  const normalized = normalizePhone(phone);
  
  // Telefone deve ter pelo menos 10 dígitos (fixo) ou 11 dígitos (celular)
  if (normalized.length < 10 || normalized.length > 11) {
    errors.push('Telefone deve ter 10 ou 11 dígitos');
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Normaliza tax_id (CPF/CNPJ) removendo formatação
 */
export function normalizeTaxId(value: string): string {
  if (!value) {
    return '';
  }
  return value.replace(/\D/g, '');
}

/**
 * Normaliza telefone removendo formatação
 */
export function normalizePhone(value: string): string {
  if (!value) {
    return '';
  }
  return value.replace(/\D/g, '');
}

/**
 * Valida se tax_id é CPF ou CNPJ baseado no tamanho
 */
export function validateTaxId(taxId: string, type: 'PERSON' | 'COMPANY'): ValidationResult {
  if (type === 'PERSON') {
    return validateCPF(taxId);
  } else {
    return validateCNPJ(taxId);
  }
}





