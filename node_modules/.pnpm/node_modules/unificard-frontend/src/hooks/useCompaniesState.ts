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
  const [validationModalCompany, setValidationModalCompany] = useState<{ id: string; name: string } | null>(null);
  
  const [formData, setFormData] = useState<CreateCompanyInput>({
    cnpj: '',
    role: 'owner',
    fetchFromRevenue: true,
    domains: ['market'],
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
    validationModalCompany,
    setValidationModalCompany,
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



