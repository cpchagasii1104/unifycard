// frontend/src/components/CompaniesManager.tsx
// Componente para gerenciar empresas (PJ)

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  listCompanies,
  createCompany,
  deleteCompany,
  fetchCNPJFromRevenue,
  uploadCompanyDocument,
  type Company,
  type CreateCompanyInput,
  type RevenueFederalData,
  type CompanyUserRole,
} from '../api/companies';
import { formatCNPJ, maskCNPJ, cleanCNPJ } from '../utils/cnpj';
import { fetchCEP } from '../utils/cep';
import { COUNTRY_CODES, BRAZIL_AREA_CODES, formatBrazilianPhone, isCellPhone } from '../utils/phone';
import { validateBrazilianPhone } from '../utils/validation';
import CompanyValidationModal from './CompanyValidationModal';
import './CompaniesManager.css';

export default function CompaniesManager() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Estado do formulário de nova empresa
  const [showAddForm, setShowAddForm] = useState(false);
  const [isFetchingCNPJ, setIsFetchingCNPJ] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCompanyId, setUploadingCompanyId] = useState<string | null>(null);
  const [validationModalCompany, setValidationModalCompany] = useState<{ id: string; name: string } | null>(null);
  
  // Formulário
  const [formData, setFormData] = useState<CreateCompanyInput>({
    cnpj: '',
    role: 'owner',
    fetchFromRevenue: true,
  });
  
  const [revenueData, setRevenueData] = useState<RevenueFederalData | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // 🔴 PROTEÇÕES PARA CEP: Mesmas regras do perfil pessoal
  const isHydrating = useRef(false); // Flag para prevenir efeitos durante carregamento
  const previousCep = useRef<string>(''); // CEP anterior para detectar mudança real
  const cepSearchInProgress = useRef(false); // Evitar múltiplas buscas simultâneas
  const addressFieldsTouched = useRef<Set<string>>(new Set()); // Campos editados manualmente
  const [cepLoading, setCepLoading] = useState(false);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  
  // 🔴 TELEFONES: Estrutura para múltiplos telefones (até 3)
  interface PhoneData {
    id: string;
    type: 'fixo' | 'celular';
    countryCode: string;
    areaCode: string;
    number: string;
  }
  
  const [phones, setPhones] = useState<PhoneData[]>([
    { id: '1', type: 'celular', countryCode: '55', areaCode: '41', number: '' },
  ]);
  const [phoneErrors, setPhoneErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCompanies();
  }, []);

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
          
          // Se tem CEP, buscar endereço completo
          // 🔴 Usar handleCepSearch para manter consistência e proteções
          if (data.cep) {
            const cleanCep = data.cep.replace(/\D/g, '');
            if (cleanCep.length === 8) {
              // Atualizar CEP anterior para evitar busca duplicada
              previousCep.current = cleanCep;
              // Buscar usando a função protegida
              await handleCepSearch(cleanCep);
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

  // 🔴 BUSCA DE CEP: Função separada com proteções
  const handleCepSearch = useCallback(async (cepValue: string) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    
    // Validação mínima: só buscar se tiver 8 dígitos
    if (cleanCep.length !== 8) {
      return;
    }
    
    // 🔴 PROTEÇÃO 1: Não buscar durante hidratação
    if (isHydrating.current) {
      console.log('[CompaniesManager] ⏸️ CEP: Ignorando durante hidratação');
      return;
    }
    
    // 🔴 PROTEÇÃO 2: Não buscar se já está buscando
    if (cepSearchInProgress.current) {
      console.log('[CompaniesManager] ⏸️ CEP: Busca já em andamento');
      return;
    }
    
    // 🔴 PROTEÇÃO 3: Só buscar se CEP realmente mudou
    if (cleanCep === previousCep.current) {
      console.log('[CompaniesManager] ⏸️ CEP: Valor não mudou, ignorando');
      return;
    }
    
    // Atualizar CEP anterior
    previousCep.current = cleanCep;
    cepSearchInProgress.current = true;
    setCepLoading(true);
    setCepMessage(null);
    
    try {
      const cepData = await fetchCEP(cleanCep);
      
      if (cepData) {
        // 🔴 PROTEÇÃO 4: Não sobrescrever campos já preenchidos manualmente
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            cep: cepData.cep.replace(/\D/g, ''),
            // Só preencher se campo não foi tocado manualmente
            address: addressFieldsTouched.current.has('address') 
              ? prev.address?.address 
              : (cepData.logradouro || prev.address?.address || ''),
            neighborhood: addressFieldsTouched.current.has('neighborhood')
              ? prev.address?.neighborhood
              : (cepData.bairro || prev.address?.neighborhood || ''),
            city: addressFieldsTouched.current.has('city')
              ? prev.address?.city
              : (cepData.localidade || prev.address?.city || ''),
            state: addressFieldsTouched.current.has('state')
              ? prev.address?.state
              : (cepData.uf || prev.address?.state || ''),
            country: 'BR',
            // Número sempre manual (não preencher)
            addressNumber: prev.address?.addressNumber || '',
            complement: prev.address?.complement || '',
          },
        }));
        
        setCepMessage('Endereço preenchido automaticamente. Confira se está correto.');
        
        // Limpar mensagem após 5 segundos
        setTimeout(() => setCepMessage(null), 5000);
      }
    } catch (err) {
      // 🔴 PROTEÇÃO 5: Erro silencioso - não bloqueia cadastro
      console.warn('[CompaniesManager] Erro ao buscar CEP (não bloqueante):', err);
      setCepMessage('Não foi possível buscar o endereço automaticamente. Você pode preencher manualmente.');
      
      // Limpar mensagem após 5 segundos
      setTimeout(() => setCepMessage(null), 5000);
    } finally {
      setCepLoading(false);
      cepSearchInProgress.current = false;
    }
  }, []);
  
  // 🔴 HANDLER DE MUDANÇA DE CEP: Apenas atualiza estado, busca via useEffect
  const handleCEPChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, cep: clean },
    }));
    
    // Marcar que usuário está editando CEP manualmente
    // A busca será feita automaticamente pelo useEffect quando CEP tiver 8 dígitos
  };
  
  // 🔴 useEffect para buscar CEP automaticamente quando tiver 8 dígitos
  useEffect(() => {
    const currentCep = formData.address?.cep || '';
    const cleanCep = currentCep.replace(/\D/g, '');
    
    // 🔴 PROTEÇÃO: Não buscar durante hidratação
    if (isHydrating.current) {
      return;
    }
    
    // Só buscar se tiver 8 dígitos e não estiver em progresso
    if (cleanCep.length === 8 && !cepSearchInProgress.current) {
      handleCepSearch(cleanCep);
    }
  }, [formData.address?.cep, handleCepSearch]);
  
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

    // 🔴 Validar telefones
    if (!validatePhones()) {
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
      const formattedPhones = formatPhonesForBackend();
      const phoneString = formattedPhones.length > 0 ? formattedPhones.join('; ') : undefined;
      
      // 🔴 Normalizar website: adicionar https:// se não tiver protocolo
      let normalizedWebsite = formData.contact?.website?.trim();
      if (normalizedWebsite && normalizedWebsite.length > 0) {
        if (!/^https?:\/\//i.test(normalizedWebsite)) {
          normalizedWebsite = `https://${normalizedWebsite}`;
        }
      }
      
      const companyData: CreateCompanyInput = {
        ...formData,
        contact: {
          ...formData.contact,
          phone: phoneString,
          website: normalizedWebsite || undefined,
        },
      };
      
      await createCompany(companyData);
      setSuccess('Empresa cadastrada com sucesso!');
      setShowAddForm(false);
      resetForm();
      loadCompanies();
      
      // 🔴 CRÍTICO: Recarregar contexto global para empresa aparecer no seletor
      window.dispatchEvent(new CustomEvent('company-changed'));
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
  
  // 🔴 VALIDAR TELEFONES antes de salvar
  const validatePhones = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;
    
    phones.forEach(phone => {
      if (!phone.number || phone.number.trim() === '') {
        // Telefone vazio é permitido (opcional)
        return;
      }
      
      if (phone.countryCode === '55') {
        const validation = validateBrazilianPhone(phone.areaCode, phone.number);
        if (!validation.valid) {
          errors[phone.id] = validation.error || 'Telefone inválido';
          isValid = false;
        } else {
          // Validar tipo: celular deve ter 9 dígitos começando com 9, fixo deve ter 8 dígitos
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
  
  // 🔴 FORMATAR TELEFONES para enviar ao backend
  const formatPhonesForBackend = (): string[] => {
    return phones
      .filter(p => p.number && p.number.trim() !== '')
      .map(p => {
        if (p.countryCode === '55') {
          return formatBrazilianPhone(p.areaCode, p.number);
        }
        return `+${p.countryCode} ${p.areaCode} ${p.number}`;
      });
  };
  
  const resetForm = () => {
    // 🔴 Resetar flags de proteção
    isHydrating.current = false;
    previousCep.current = '';
    cepSearchInProgress.current = false;
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
    <div className="companies-manager">
      <div className="companies-header">
        <div className="companies-header-text">
          <h3>Minhas Empresas</h3>
          <p className="companies-description">
            Aqui você gerencia suas empresas, validações e permissões.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (!showAddForm) {
              resetForm();
            }
          }}
          className="add-company-button"
        >
          {showAddForm ? '✕ Cancelar' : '+ Adicionar Empresa'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Formulário de Nova Empresa */}
      {showAddForm && (
        <form className="company-form" onSubmit={handleSubmit}>
          <h4>Nova Empresa</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cnpj">
                CNPJ *
                {isFetchingCNPJ && <span className="loading-indicator"> 🔄 Buscando...</span>}
              </label>
              <input
                id="cnpj"
                type="text"
                value={formData.cnpj}
                onChange={(e) => handleCNPJChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={formErrors.cnpj ? 'error' : ''}
                required
              />
              {formErrors.cnpj && <span className="field-error">{formErrors.cnpj}</span>}
              <p className="field-hint">
                Digite o CNPJ e os dados serão preenchidos automaticamente da Receita Federal
              </p>
            </div>
          </div>

          {revenueData && (
            <div className="revenue-data-preview">
              <h5>✅ Dados da Receita Federal</h5>
              <div className="revenue-info">
                <p><strong>Razão Social:</strong> {revenueData.razao_social}</p>
                {revenueData.nome_fantasia && (
                  <p><strong>Nome Fantasia:</strong> {revenueData.nome_fantasia}</p>
                )}
                <p><strong>Situação:</strong> {revenueData.situacao_cadastral}</p>
                {revenueData.porte && <p><strong>Porte:</strong> {revenueData.porte}</p>}
                {revenueData.natureza_juridica && (
                  <p><strong>Natureza Jurídica:</strong> {revenueData.natureza_juridica}</p>
                )}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="companyName">Razão Social *</label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName || ''}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className={formErrors.companyName ? 'error' : ''}
                required
              />
              {formErrors.companyName && <span className="field-error">{formErrors.companyName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="tradeName">Nome Fantasia</label>
              <input
                id="tradeName"
                type="text"
                value={formData.tradeName || ''}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
              />
            </div>
          </div>

          <h5>Endereço</h5>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cep">CEP</label>
              <input
                id="cep"
                type="text"
                value={formData.address?.cep || ''}
                onChange={(e) => handleCEPChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              {cepLoading && <span className="loading-indicator" style={{ fontSize: '12px', marginLeft: '8px' }}>🔄 Buscando...</span>}
              {cepMessage && (
                <p className="field-hint" style={{ 
                  marginTop: '4px', 
                  fontSize: '12px',
                  color: cepMessage.includes('Não foi possível') ? '#856404' : '#155724',
                  backgroundColor: cepMessage.includes('Não foi possível') ? '#fff3cd' : '#d4edda',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${cepMessage.includes('Não foi possível') ? '#ffc107' : '#28a745'}`
                }}>
                  {cepMessage}
                </p>
              )}
            </div>
            <div className="form-group form-group-large">
              <label htmlFor="address">Logradouro</label>
              <input
                id="address"
                type="text"
                value={formData.address?.address || ''}
                onChange={(e) => handleAddressFieldChange('address', e.target.value)}
              />
            </div>
            <div className="form-group form-group-small">
              <label htmlFor="addressNumber">Número</label>
              <input
                id="addressNumber"
                type="text"
                value={formData.address?.addressNumber || ''}
                onChange={(e) => handleAddressFieldChange('addressNumber', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="complement">Complemento</label>
              <input
                id="complement"
                type="text"
                value={formData.address?.complement || ''}
                onChange={(e) => handleAddressFieldChange('complement', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="neighborhood">Bairro</label>
              <input
                id="neighborhood"
                type="text"
                value={formData.address?.neighborhood || ''}
                onChange={(e) => handleAddressFieldChange('neighborhood', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                type="text"
                value={formData.address?.city || ''}
                onChange={(e) => handleAddressFieldChange('city', e.target.value)}
              />
            </div>
            <div className="form-group form-group-small">
              <label htmlFor="state">UF</label>
              <input
                id="state"
                type="text"
                value={formData.address?.state || ''}
                onChange={(e) => handleAddressFieldChange('state', e.target.value)}
                maxLength={2}
              />
            </div>
          </div>

          <h5>Contato</h5>
          
          {/* 🔴 TELEFONES: Múltiplos com seleção de tipo */}
          <div className="phones-section">
            {phones.map((phone, index) => (
              <div key={phone.id} className="phone-group" style={{ marginBottom: '16px' }}>
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label htmlFor={`phone-type-${phone.id}`}>
                      {index === 0 ? 'Tipo *' : 'Tipo'}
                    </label>
                    <select
                      id={`phone-type-${phone.id}`}
                      value={phone.type}
                      onChange={(e) => updatePhone(phone.id, 'type', e.target.value as 'fixo' | 'celular')}
                      className="phone-type-select"
                    >
                      <option value="celular">Celular</option>
                      <option value="fixo">Fixo</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: '0 0 150px' }}>
                    <label htmlFor={`phone-country-${phone.id}`}>País</label>
                    <select
                      id={`phone-country-${phone.id}`}
                      value={phone.countryCode}
                      onChange={(e) => updatePhone(phone.id, 'countryCode', e.target.value)}
                      className="country-select"
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} +{country.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {phone.countryCode === '55' && (
                    <div className="form-group" style={{ flex: '0 0 200px' }}>
                      <label htmlFor={`phone-area-${phone.id}`}>DDD</label>
                      <select
                        id={`phone-area-${phone.id}`}
                        value={phone.areaCode}
                        onChange={(e) => updatePhone(phone.id, 'areaCode', e.target.value)}
                        className="area-select"
                      >
                        {BRAZIL_AREA_CODES.map((area) => (
                          <option key={area.code} value={area.code}>
                            ({area.code}) {area.city} - {area.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="form-group" style={{ flex: '1' }}>
                    <label htmlFor={`phone-number-${phone.id}`}>
                      {index === 0 ? 'Número' : 'Número'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <input
                        id={`phone-number-${phone.id}`}
                        type="tel"
                        value={phone.number}
                        onChange={(e) => {
                          const numbers = e.target.value.replace(/\D/g, '');
                          updatePhone(phone.id, 'number', numbers);
                        }}
                        onBlur={() => {
                          if (phone.countryCode === '55' && phone.number) {
                            const validation = validateBrazilianPhone(phone.areaCode, phone.number);
                            if (!validation.valid) {
                              setPhoneErrors({ ...phoneErrors, [phone.id]: validation.error || 'Telefone inválido' });
                            } else {
                              // Validar tipo
                              const isCell = isCellPhone(phone.areaCode, phone.number);
                              if (phone.type === 'celular' && !isCell) {
                                setPhoneErrors({ ...phoneErrors, [phone.id]: 'Celular deve ter 9 dígitos e começar com 9' });
                              } else if (phone.type === 'fixo' && isCell) {
                                setPhoneErrors({ ...phoneErrors, [phone.id]: 'Telefone fixo deve ter 8 dígitos' });
                              } else {
                                const newErrors = { ...phoneErrors };
                                delete newErrors[phone.id];
                                setPhoneErrors(newErrors);
                              }
                            }
                          }
                        }}
                        placeholder={phone.countryCode === '55' 
                          ? (phone.type === 'celular' ? '9XXXXXXXX' : 'XXXXXXXX')
                          : 'Número'}
                        maxLength={phone.countryCode === '55' ? (phone.type === 'celular' ? 9 : 8) : 15}
                        className={`phone-input ${phoneErrors[phone.id] ? 'error' : ''}`}
                        style={{ flex: '1' }}
                      />
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhone(phone.id)}
                          className="remove-phone-button"
                          style={{
                            marginTop: '24px',
                            padding: '8px 12px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Remover telefone"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {phoneErrors[phone.id] && (
                      <span className="field-error" style={{ display: 'block', marginTop: '4px' }}>
                        {phoneErrors[phone.id]}
                      </span>
                    )}
                    {!phoneErrors[phone.id] && phone.countryCode === '55' && phone.number && (
                      <p className="phone-hint" style={{ marginTop: '4px', fontSize: '12px', color: '#28a745' }}>
                        ✓ {phone.type === 'celular' ? 'Celular' : 'Telefone fixo'} válido
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {phones.length < 3 && (
              <button
                type="button"
                onClick={addPhone}
                className="add-phone-button"
                style={{
                  marginTop: '8px',
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                + Adicionar mais telefone
              </button>
            )}
            {formErrors.phones && (
              <span className="field-error" style={{ display: 'block', marginTop: '8px' }}>
                {formErrors.phones}
              </span>
            )}
          </div>
          
          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={formData.contact?.email || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contact: { ...formData.contact, email: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                value={formData.contact?.website || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setFormData({
                    ...formData,
                    contact: { ...formData.contact, website: value },
                  });
                  // Limpar erro ao editar
                  if (formErrors.website) {
                    const newErrors = { ...formErrors };
                    delete newErrors.website;
                    setFormErrors(newErrors);
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  // Validar apenas se preenchido
                  if (value && value.length > 0) {
                    // Aceitar URLs com ou sem protocolo
                    const hasDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)+/i.test(value);
                    
                    if (!hasDomain) {
                      setFormErrors({ ...formErrors, website: 'URL inválida' });
                    } else {
                      const newErrors = { ...formErrors };
                      delete newErrors.website;
                      setFormErrors(newErrors);
                    }
                  }
                }}
                placeholder="www.exemplo.com ou https://exemplo.com"
              />
              {formErrors.website && (
                <span className="field-error" style={{ display: 'block', marginTop: '4px' }}>
                  {formErrors.website}
                </span>
              )}
            </div>
          </div>

          <h5>Atividade</h5>
          {formData.activity?.mainActivityDescription && (
            <div className="activity-info">
              <p><strong>CNAE Principal:</strong> {formData.activity.mainActivityCode} - {formData.activity.mainActivityDescription}</p>
              {formData.activity.secondaryActivities && formData.activity.secondaryActivities.length > 0 && (
                <div>
                  <strong>CNAEs Secundários:</strong>
                  <ul>
                    {formData.activity.secondaryActivities.map((act, idx) => (
                      <li key={idx}>{act.code} - {act.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <h5>Seu Cargo na Empresa</h5>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role">Cargo *</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CompanyUserRole })}
                required
              >
                <option value="owner">Proprietário/Sócio</option>
                <option value="partner">Sócio</option>
                <option value="director">Diretor</option>
                <option value="manager">Gerente</option>
                <option value="employee">Funcionário</option>
                <option value="other">Outro</option>
              </select>
            </div>
            {formData.role === 'other' && (
              <div className="form-group">
                <label htmlFor="roleDescription">Descrição do Cargo</label>
                <input
                  id="roleDescription"
                  type="text"
                  value={formData.roleDescription || ''}
                  onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                  placeholder="Ex: Consultor, Assessor, etc."
                />
              </div>
            )}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isPrimary || false}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                />
                <span>Empresa Principal</span>
              </label>
            </div>
          </div>

          {/* Raio X da Empresa */}
          {revenueData && (
            <div className="company-xray">
              <h5>🔍 Raio X da Empresa</h5>
              <div className="xray-content">
                <div className="xray-section">
                  <h6>Informações Básicas</h6>
                  <ul>
                    <li><strong>CNPJ:</strong> {formatCNPJ(revenueData.cnpj)}</li>
                    <li><strong>Razão Social:</strong> {revenueData.razao_social}</li>
                    {revenueData.nome_fantasia && (
                      <li><strong>Nome Fantasia:</strong> {revenueData.nome_fantasia}</li>
                    )}
                    {revenueData.data_abertura && (
                      <li><strong>Data de Abertura:</strong> {new Date(revenueData.data_abertura).toLocaleDateString('pt-BR')}</li>
                    )}
                    <li><strong>Situação Cadastral:</strong> {revenueData.situacao_cadastral}</li>
                    {revenueData.porte && <li><strong>Porte:</strong> {revenueData.porte}</li>}
                    {revenueData.natureza_juridica && (
                      <li><strong>Natureza Jurídica:</strong> {revenueData.natureza_juridica}</li>
                    )}
                    {revenueData.capital_social && (
                      <li><strong>Capital Social:</strong> {revenueData.capital_social}</li>
                    )}
                  </ul>
                </div>

                <div className="xray-section">
                  <h6>Atividades (CNAE)</h6>
                  {revenueData.atividade_principal && revenueData.atividade_principal.length > 0 && (
                    <div>
                      <strong>Principal:</strong>
                      <ul>
                        {revenueData.atividade_principal.map((act, idx) => (
                          <li key={idx}>{act.code} - {act.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {revenueData.atividades_secundarias && revenueData.atividades_secundarias.length > 0 && (
                    <div>
                      <strong>Secundárias:</strong>
                      <ul>
                        {revenueData.atividades_secundarias.map((act, idx) => (
                          <li key={idx}>{act.code} - {act.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {revenueData.qsa && revenueData.qsa.length > 0 && (
                  <div className="xray-section">
                    <h6>Quadro Societário (QSA)</h6>
                    <ul>
                      {revenueData.qsa.map((socio, idx) => (
                        <li key={idx}>
                          <strong>{socio.nome}</strong> - {socio.qual}
                          {socio.pais_origem && ` (${socio.pais_origem})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="xray-note">
                💡 Essas informações serão usadas para categorizar sua empresa e conectar com os módulos ERP, CRM e outros sistemas do Unificard.
              </p>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => setShowAddForm(false)} disabled={isSaving}>
              Cancelar
            </button>
            <button type="submit" disabled={isSaving || isFetchingCNPJ} className="save-button">
              {isSaving ? 'Salvando...' : 'Salvar Empresa'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Empresas */}
      {companies.length === 0 && !showAddForm && (
        <div className="empty-state">
          <p>Você ainda não cadastrou nenhuma empresa.</p>
          <p>Clique em "Adicionar Empresa" para começar.</p>
        </div>
      )}

      {companies.length > 0 && (
        <div className="companies-list">
          {companies.map((company) => (
            <div key={company.companyId} className="company-card">
              <div className="company-card-header">
                <div className="company-info">
                  <h4>
                    {company.companyName}
                    {company.userRole.isPrimary && <span className="primary-badge-inline"> (Principal)</span>}
                  </h4>
                  <p className="company-cnpj">CNPJ: {formatCNPJ(company.cnpj)}</p>
                  {company.address.city && (
                    <p className="company-location">Localização: {company.address.city}, {company.address.state}</p>
                  )}
                </div>
              </div>

              {/* Status sempre visível */}
              <div className="company-status-section">
                {company.companyStatus === 'PROVISIONAL' && (
                  <div className="status-message status-provisional">
                    <strong>⚠️ Empresa em validação</strong>
                    <p>Complete a validação presencial para habilitar todas as funcionalidades.</p>
                  </div>
                )}
                
                {company.companyStatus === 'VERIFIED' && (
                  <div className="status-message status-validated">
                    <strong>✅ Empresa validada</strong>
                    <p>Seus dados foram verificados e aprovados.</p>
                  </div>
                )}

                {company.companyStatus === 'DRAFT' && (
                  <div className="status-message status-draft">
                    <strong>📝 Rascunho</strong>
                    <p>Cadastro ainda não finalizado.</p>
                  </div>
                )}

                {company.companyStatus === 'APPROVED' && (
                  <div className="status-message status-validated">
                    <strong>✅ Empresa aprovada</strong>
                    <p>Empresa com acesso pleno ao sistema.</p>
                  </div>
                )}

                {company.companyStatus === 'SUSPENDED' && (
                  <div className="status-message status-pending">
                    <strong>🚫 Empresa suspensa</strong>
                    <p>Esta empresa foi suspensa e não pode realizar operações.</p>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="company-actions-section">
                <div className="company-actions-left">
                  {/* FASE 12: Botão de validação presencial para PROVISIONAL */}
                  {company.companyStatus === 'PROVISIONAL' && (
                    <button
                      type="button"
                      onClick={() => setValidationModalCompany({ id: company.companyId, name: company.companyName })}
                      className="validate-button"
                      title="Validar empresa presencialmente"
                    >
                      📱 Validar presencialmente
                    </button>
                  )}
                  
                  {company.companyStatus !== 'VERIFIED' && company.companyStatus !== 'PROVISIONAL' && company.companyStatus !== 'APPROVED' && (
                    <label className="upload-button-primary">
                      {uploadingCompanyId === company.companyId ? (
                        '⏳ Enviando...'
                      ) : (
                        '📄 Enviar comprovante (PDF)'
                      )}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileInputChange(company.companyId, e)}
                        disabled={uploadingCompanyId === company.companyId}
                      />
                    </label>
                  )}
                </div>
                <div className="company-actions-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(company.companyId)}
                    className="delete-button"
                    title="Remover empresa"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FASE 12: Modal de validação presencial */}
      {validationModalCompany && (
        <CompanyValidationModal
          companyId={validationModalCompany.id}
          companyName={validationModalCompany.name}
          isOpen={!!validationModalCompany}
          onClose={() => {
            setValidationModalCompany(null);
            // Recarregar empresas após validação
            loadCompanies();
          }}
          onValidationRequested={() => {
            // Opcional: fazer algo quando QR é gerado
          }}
        />
      )}
    </div>
  );
}

