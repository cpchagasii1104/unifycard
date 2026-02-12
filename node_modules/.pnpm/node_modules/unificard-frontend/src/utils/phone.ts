// src/utils/phone.ts
// Utilitários para telefone: máscara e formatação

export interface CountryCode {
  code: string;
  name: string;
  flag: string;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '55', name: 'Brasil', flag: '🇧🇷' },
  { code: '1', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '351', name: 'Portugal', flag: '🇵🇹' },
  { code: '34', name: 'Espanha', flag: '🇪🇸' },
  { code: '33', name: 'França', flag: '🇫🇷' },
  { code: '49', name: 'Alemanha', flag: '🇩🇪' },
  { code: '39', name: 'Itália', flag: '🇮🇹' },
  { code: '44', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '52', name: 'México', flag: '🇲🇽' },
  { code: '54', name: 'Argentina', flag: '🇦🇷' },
];

export interface AreaCode {
  code: string;
  city: string;
  state: string;
}

export const BRAZIL_AREA_CODES: AreaCode[] = [
  { code: '11', city: 'São Paulo', state: 'SP' },
  { code: '21', city: 'Rio de Janeiro', state: 'RJ' },
  { code: '31', city: 'Belo Horizonte', state: 'MG' },
  { code: '41', city: 'Curitiba', state: 'PR' },
  { code: '47', city: 'Joinville', state: 'SC' },
  { code: '48', city: 'Florianópolis', state: 'SC' },
  { code: '51', city: 'Porto Alegre', state: 'RS' },
  { code: '61', city: 'Brasília', state: 'DF' },
  { code: '71', city: 'Salvador', state: 'BA' },
  { code: '81', city: 'Recife', state: 'PE' },
  { code: '85', city: 'Fortaleza', state: 'CE' },
  // Adicione mais códigos conforme necessário
];

/**
 * Formata número de telefone brasileiro
 */
export function formatBrazilianPhone(areaCode: string, number: string): string {
  const cleanNumber = number.replace(/\D/g, '');
  
  if (cleanNumber.length === 8) {
    // Telefone fixo: (XX) XXXX-XXXX
    return `(${areaCode}) ${cleanNumber.slice(0, 4)}-${cleanNumber.slice(4)}`;
  } else if (cleanNumber.length === 9) {
    // Celular: (XX) 9XXXX-XXXX
    return `(${areaCode}) ${cleanNumber.slice(0, 5)}-${cleanNumber.slice(5)}`;
  }
  
  return `(${areaCode}) ${cleanNumber}`;
}

/**
 * Valida se é número de celular (9 dígitos no Brasil)
 */
export function isCellPhone(_areaCode: string, number: string): boolean {
  const cleanNumber = number.replace(/\D/g, '');
  // No Brasil, celular tem 9 dígitos e começa com 9
  return cleanNumber.length === 9 && cleanNumber.startsWith('9');
}

