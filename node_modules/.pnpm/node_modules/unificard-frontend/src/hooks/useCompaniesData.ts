import { listCompanies } from '../api/companies';
import { validateBrazilianPhone } from '../utils/validation';
import { isCellPhone, formatBrazilianPhone } from '../utils/phone';

interface PhoneData {
  id: string;
  type: 'fixo' | 'celular';
  countryCode: string;
  areaCode: string;
  number: string;
}

export function useCompaniesData(
  setIsLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  setCompanies: (companies: any[]) => void
) {
  const loadCompanies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCompanies();
      setCompanies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar empresas');
    } finally {
      setIsLoading(false);
    }
  };

  const validatePhones = (phones: PhoneData[], setPhoneErrors: (errors: Record<string, string>) => void): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;
    
    phones.forEach(phone => {
      if (!phone.number || phone.number.trim() === '') {
        return;
      }
      
      if (phone.countryCode === '55') {
        const validation = validateBrazilianPhone(phone.areaCode, phone.number);
        if (!validation.valid) {
          errors[phone.id] = validation.error || 'Telefone inválido';
          isValid = false;
        } else {
          const isCell = isCellPhone(phone.areaCode, phone.number);
          
          if (phone.type === 'celular' && !isCell) {
            errors[phone.id] = 'Celular deve ter 9 dígitos e começar com 9';
            isValid = false;
          } else if (phone.type === 'fixo' && isCell) {
            errors[phone.id] = 'Telefone fixo deve ter 8 dígitos';
            isValid = false;
          }
        }
      }
    });
    
    setPhoneErrors(errors);
    return isValid;
  };
  
  const formatPhonesForBackend = (phones: PhoneData[]): string[] => {
    return phones
      .filter(p => p.number && p.number.trim() !== '')
      .map(p => {
        if (p.countryCode === '55') {
          return formatBrazilianPhone(p.areaCode, p.number);
        }
        return `+${p.countryCode} ${p.areaCode} ${p.number}`;
      });
  };

  return {
    loadCompanies,
    validatePhones,
    formatPhonesForBackend,
  };
}

