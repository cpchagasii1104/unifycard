import { useState } from 'react';
import type { Company, CreateCompanyInput, RevenueFederalData } from '../api/companies';

interface PhoneData {
  id: string;
  type: 'fixo' | 'celular';
  countryCode: string;
  areaCode: string;
  number: string;
}

export function useCompaniesState() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [isFetchingCNPJ, setIsFetchingCNPJ] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCompanyId, setUploadingCompanyId] = useState<string | null>(null);
  // DECISION-0096 / Presential UX 2: state `validationModalCompany` removido (modal presencial órfão deletado).

  const [formData, setFormData] = useState<CreateCompanyInput>({
    cnpj: '',
    role: 'owner',
    fetchFromRevenue: true,
    // F-PJ-DOMAIN-SELECTOR-NEUTRALIZE (DECISION-0102): `domains` removido do estado de create — domínio de
    // atuação não é livre escolha do frontend (deriva de CONCEPT + evidência fiscal, governado pelo backend).
  });
  
  const [revenueData, setRevenueData] = useState<RevenueFederalData | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  
  const [phones, setPhones] = useState<PhoneData[]>([
    { id: '1', type: 'celular', countryCode: '55', areaCode: '41', number: '' },
  ]);
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});

  return {
    companies,
    setCompanies,
    isLoading,
    setIsLoading,
    error,
    setError,
    success,
    setSuccess,
    showAddForm,
    setShowAddForm,
    isFetchingCNPJ,
    setIsFetchingCNPJ,
    isSaving,
    setIsSaving,
    uploadingCompanyId,
    setUploadingCompanyId,
    formData,
    setFormData,
    revenueData,
    setRevenueData,
    formErrors,
    setFormErrors,
    cepLoading,
    setCepLoading,
    cepMessage,
    setCepMessage,
    phones,
    setPhones,
    phoneErrors,
    setPhoneErrors,
  };
}



