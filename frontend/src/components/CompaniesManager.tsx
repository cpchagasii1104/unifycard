// frontend/src/components/CompaniesManager.tsx
// Componente para gerenciar empresas (PJ)

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createCompany,
  deleteCompany,
  fetchCNPJFromRevenue,
  uploadCompanyDocument,
  type CreateCompanyInput,
  type CompanyUserRole,
} from '../api/companies';
import { formatCNPJ, maskCNPJ, cleanCNPJ } from '../utils/cnpj';
import { useAddressResolver } from '../hooks/useAddressResolver';
import { useCompaniesState } from '../hooks/useCompaniesState';
import { useCompaniesData } from '../hooks/useCompaniesData';
import CompaniesManagerForm from './CompaniesManagerForm';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import './CompaniesManager.css';

export function CompaniesManager() {
  const navigate = useNavigate();
  const { activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  // "Minhas empresas" é semântica do user logado; quando actor é page/group/channel,
  // ausência é esperada (não mostrar empresas alheias do user logado a partir de outro contexto).
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="empresas" />;
  }

  const state = useCompaniesState();
  const {
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
  } = state;

  const { loadCompanies, validatePhones, formatPhonesForBackend } = useCompaniesData(setIsLoading, setError, setCompanies);
  
  // 🔴 MIGRAÇÃO: Usar hook canônico useAddressResolver (SSOT)
  const { address, loading: cepResolverLoading, error: cepResolverError, setCep: setCepResolver, resolve: resolveCep } = useAddressResolver();
  
  // 🔴 MIGRAÇÃO: Sincronizar loading e error do hook canônico
  useEffect(() => {
    setCepLoading(cepResolverLoading);
  }, [cepResolverLoading, setCepLoading]);
  
  useEffect(() => {
    if (cepResolverError) {
      setCepMessage(cepResolverError);
      setTimeout(() => setCepMessage(null), 5000);
    }
  }, [cepResolverError, setCepMessage]);
  
  // 🔴 MIGRAÇÃO: Preencher campos quando address do hook canônico mudar
  useEffect(() => {
    if (address) {
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          address: address.logradouro || prev.address?.address || '',
          neighborhood: address.bairro || prev.address?.neighborhood || '',
          city: address.localidade || prev.address?.city || '',
          state: address.uf || prev.address?.state || '',
          country: 'BR',
        },
      }));
      setCepMessage('Endereço preenchido automaticamente. Confira se está correto.');
      setTimeout(() => setCepMessage(null), 5000);
    }
  }, [address, setFormData, setCepMessage]);
  
  const addressFieldsTouched = useRef<Set<string>>(new Set());
  
  interface PhoneData {
    id: string;
    type: 'fixo' | 'celular';
    countryCode: string;
    areaCode: string;
    number: string;
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleCNPJChange = async (value: string) => {
    const masked = maskCNPJ(value);
    setFormData({ ...formData, cnpj: masked });
    setFormErrors({ ...formErrors, cnpj: '' });

    const clean = cleanCNPJ(masked);
    if (clean.length === 14) {
      // 🔴 Validar APENAS formato (14 dígitos) - não bloquear
      if (clean.length !== 14) {
        setFormErrors({ ...formErrors, cnpj: 'CNPJ deve ter 14 dígitos' });
        return;
      }

      // 🔴 Buscar dados da Receita Federal via backend (OPCIONAL - não bloqueia)
      setIsFetchingCNPJ(true);
      setFormErrors({ ...formErrors, cnpj: '' });
      try {
        const response = await fetchCNPJFromRevenue(masked);
        // 🔴 Backend agora retorna { ok: true, data } ou { ok: false, message }
        if (response && (response as any).ok && (response as any).data) {
          const data = (response as any).data;
          setRevenueData(data);
          
          // Auto-preenchimento
          setFormData(prev => ({
            ...prev,
            cnpj: masked,
            companyName: data.razao_social || prev.companyName,
            tradeName: data.nome_fantasia || prev.tradeName || '',
            address: {
              ...prev.address,
              cep: data.cep?.replace(/\D/g, '') || prev.address?.cep,
              address: `${data.tipo_logradouro || ''} ${data.logradouro || ''}`.trim() || prev.address?.address,
              addressNumber: data.numero || prev.address?.addressNumber,
              complement: data.complemento || prev.address?.complement,
              neighborhood: data.bairro || prev.address?.neighborhood,
              city: data.municipio || prev.address?.city,
              state: data.uf || prev.address?.state,
              country: 'BR',
            },
            contact: {
              ...prev.contact,
              // 🔴 Telefone será preenchido via phones array (não usar contact.phone diretamente)
              email: data.email || prev.contact?.email,
            },
            activity: {
              mainActivityCode: data.atividade_principal?.[0]?.code || prev.activity?.mainActivityCode,
              mainActivityDescription: data.atividade_principal?.[0]?.text || prev.activity?.mainActivityDescription,
              secondaryActivities: data.atividades_secundarias?.map((a: any) => ({
                code: a.code,
                description: a.text,
              })) || prev.activity?.secondaryActivities,
            },
          }));

          // 🔴 Preencher telefone se vier da Receita
          if (data.telefone) {
            // Tentar extrair DDD e número do telefone da Receita
            const phoneMatch = data.telefone.match(/(\d{2})\s*(\d{4,5}[-.]?\d{4})/);
            if (phoneMatch) {
              const [, areaCode, number] = phoneMatch;
              const cleanNumber = number.replace(/\D/g, '');
              // Detectar tipo: 9 dígitos = celular, 8 dígitos = fixo
              const phoneType = cleanNumber.length === 9 && cleanNumber.startsWith('9') ? 'celular' : 'fixo';
              
              // Atualizar primeiro telefone ou criar se não existir
              setPhones(prevPhones => {
                if (prevPhones.length > 0) {
                  return prevPhones.map((p, idx) => 
                    idx === 0 
                      ? { ...p, areaCode, number: cleanNumber, type: phoneType }
                      : p
                  );
                } else {
                  return [{
                    id: '1',
                    type: phoneType,
                    countryCode: '55',
                    areaCode,
                    number: cleanNumber,
                  }];
                }
              });
            }
          }
          
          // 🔴 MIGRAÇÃO: Se tem CEP da Receita, atualizar hook canônico com origem 'backend'
          // NUNCA chamar resolve() - CEP do backend não deve disparar busca
          if (data.cep) {
            const cleanCep = data.cep.replace(/\D/g, '');
            if (cleanCep.length === 8) {
              setCepResolver(cleanCep, 'backend');
            }
          }
        } else {
          // 🔴 Mensagem neutra - não bloqueia cadastro
          console.warn('Não foi possível buscar dados da Receita Federal. Você pode preencher manualmente.');
          // Não definir erro - permite continuar
        }
      } catch (err) {
        // 🔴 Erro não bloqueia - apenas loga
        console.warn('Erro ao buscar CNPJ (não bloqueante):', err);
        // Não definir erro - permite continuar
      } finally {
        setIsFetchingCNPJ(false);
      }
    }
  };

  // 🔴 MIGRAÇÃO: HANDLER DE MUDANÇA DE CEP - delega ao hook canônico
  const handleCEPChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, cep: clean },
    }));
    
    // 🔴 MIGRAÇÃO: Atualizar hook canônico com origem 'user' (não dispara busca)
    setCepResolver(clean, 'user');
    
    // 🔴 MIGRAÇÃO: Se completar 8 dígitos DURANTE onChange, chamar resolve() explicitamente
    if (clean.length === 8) {
      resolveCep();
    }
  };
  
  // 🔴 HANDLERS para marcar campos como "tocados" manualmente
  const handleAddressFieldChange = (field: string, value: string) => {
    // Marcar campo como tocado manualmente
    addressFieldsTouched.current.add(field);
    
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setError(null);
    setSuccess(null);

    // 🔴 Validações mínimas - apenas formato de CNPJ e nome obrigatório
    const errors: Record<string, string> = {};
    if (!formData.cnpj || cleanCNPJ(formData.cnpj).length !== 14) {
      errors.cnpj = 'CNPJ deve ter 14 dígitos';
    }

    if (!formData.companyName || formData.companyName.trim().length === 0) {
      errors.companyName = 'Razão Social é obrigatória';
    }

    // F-PJ-DOMAIN-SELECTOR-NEUTRALIZE (DECISION-0102): domínio de atuação NÃO é livre escolha do frontend
    // (deriva de CONCEPT + evidência fiscal, governado pelo backend). Validação de `domains` removida —
    // a criação não trava mais por "área de atuação"; o payload não envia `domains`.

    // 🔴 Validar telefones
    if (!validatePhones(phones, setPhoneErrors)) {
      errors.phones = 'Verifique os telefones informados';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // 🔴 Validar website se preenchido
    if (formData.contact?.website && formData.contact.website.trim().length > 0) {
      const website = formData.contact.website.trim();
      const hasDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)+/i.test(website);
      if (!hasDomain) {
        setFormErrors({ ...formErrors, website: 'URL inválida' });
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(true);
    try {
      // 🔴 Formatar telefones e incluir no formData
      const formattedPhones = formatPhonesForBackend(phones);
      const phoneString = formattedPhones.length > 0 ? formattedPhones.join('; ') : undefined;
      
      // 🔴 Normalizar website: adicionar https:// se não tiver protocolo
      let normalizedWebsite = formData.contact?.website?.trim();
      if (normalizedWebsite && normalizedWebsite.length > 0) {
        if (!/^https?:\/\//i.test(normalizedWebsite)) {
          normalizedWebsite = `https://${normalizedWebsite}`;
        }
      }
      
      // 🔴 Normalizar CNPJ: remover formatação antes de enviar
      const normalizedCNPJ = cleanCNPJ(formData.cnpj);
      
      const companyData: CreateCompanyInput = {
        ...formData,
        cnpj: normalizedCNPJ, // Enviar apenas números
        contact: {
          ...formData.contact,
          phone: phoneString,
          website: normalizedWebsite || undefined,
        },
      };
      
      const result = await createCompany(companyData);
      setSuccess('Empresa cadastrada com sucesso!');
      setShowAddForm(false);
      resetForm();
      loadCompanies();
      
      // 🔴 CRÍTICO: Recarregar contexto global para empresa aparecer no seletor
      window.dispatchEvent(new CustomEvent('company-changed'));
      
      // Redirecionar para onboarding se empresa foi criada
      if (result && result.company && result.company.companyId) {
        setTimeout(() => {
          navigate(`/empresas/${result.company.companyId}/onboarding`);
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar empresa');
    } finally {
      setIsSaving(false);
    }
  };

  // 🔴 HANDLERS PARA TELEFONES
  const addPhone = () => {
    if (phones.length < 3) {
      setPhones([
        ...phones,
        { id: Date.now().toString(), type: 'celular', countryCode: '55', areaCode: '41', number: '' },
      ]);
    }
  };
  
  const removePhone = (phoneId: string) => {
    if (phones.length > 1) {
      setPhones(phones.filter(p => p.id !== phoneId));
      // Limpar erro do telefone removido
      const newErrors = { ...phoneErrors };
      delete newErrors[phoneId];
      setPhoneErrors(newErrors);
    }
  };
  
  const updatePhone = (phoneId: string, field: keyof PhoneData, value: string) => {
    setPhones(phones.map(p => 
      p.id === phoneId ? { ...p, [field]: value } : p
    ));
    
    // Limpar erro ao editar
    if (phoneErrors[phoneId]) {
      const newErrors = { ...phoneErrors };
      delete newErrors[phoneId];
      setPhoneErrors(newErrors);
    }
  };
  
  
  const resetForm = () => {
    // 🔴 MIGRAÇÃO: Resetar hook canônico
    setCepResolver('', 'user');
    addressFieldsTouched.current.clear();
    setCepLoading(false);
    setCepMessage(null);
    
    // 🔴 Resetar telefones
    setPhones([{ id: '1', type: 'celular', countryCode: '55', areaCode: '41', number: '' }]);
    setPhoneErrors({});
    
    setFormData({
      cnpj: '',
      role: 'owner',
      fetchFromRevenue: true,
    });
    setRevenueData(null);
    setFormErrors({});
  };

  const handleDelete = async (companyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta empresa?')) {
      return;
    }

    try {
      await deleteCompany(companyId);
      setSuccess('Empresa removida com sucesso!');
      loadCompanies();
      
      // 🔴 CRÍTICO: Recarregar contexto global para empresa desaparecer do seletor
      window.dispatchEvent(new CustomEvent('company-changed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover empresa');
    }
  };

  const handleUploadDocument = async (companyId: string, file: File) => {
    setUploadingCompanyId(companyId);
    setError(null);
    setSuccess(null);

    try {
      // Validar tipo de arquivo
      if (file.type !== 'application/pdf') {
        setError('Apenas arquivos PDF são aceitos');
        return;
      }

      // Validar tamanho (10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('Arquivo muito grande. Tamanho máximo: 10MB');
        return;
      }

      const result = await uploadCompanyDocument(companyId, file);
      
      if (result.ok) {
        setSuccess(result.message || 'Comprovante enviado com sucesso. Validação pendente.');
        loadCompanies(); // Recarregar para atualizar status
      } else {
        setError(result.message || 'Erro ao fazer upload do comprovante');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload do comprovante');
    } finally {
      setUploadingCompanyId(null);
    }
  };

  const handleFileInputChange = (companyId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadDocument(companyId, file);
    }
    // Reset input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="companies-manager">
        <div className="loading">Carregando empresas...</div>
      </div>
    );
  }

  return (
    <CompaniesManagerForm
      error={error}
      success={success}
      showAddForm={showAddForm}
      setShowAddForm={setShowAddForm}
      isFetchingCNPJ={isFetchingCNPJ}
      isSaving={isSaving}
      uploadingCompanyId={uploadingCompanyId}
      formData={formData}
      setFormData={setFormData}
      revenueData={revenueData}
      formErrors={formErrors}
      setFormErrors={setFormErrors}
      cepLoading={cepLoading}
      cepMessage={cepMessage}
      phones={phones}
      phoneErrors={phoneErrors}
      setPhoneErrors={setPhoneErrors}
      companies={companies}
      handleCNPJChange={handleCNPJChange}
      handleCEPChange={handleCEPChange}
      handleAddressFieldChange={handleAddressFieldChange}
      handleSubmit={handleSubmit}
      addPhone={addPhone}
      removePhone={removePhone}
      updatePhone={updatePhone}
      resetForm={resetForm}
      handleDelete={handleDelete}
      handleFileInputChange={handleFileInputChange}
      loadCompanies={loadCompanies}
      navigate={navigate}
    />
  );
}

