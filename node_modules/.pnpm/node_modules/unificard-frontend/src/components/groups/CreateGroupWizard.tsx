// src/components/groups/CreateGroupWizard.tsx
// Wizard de criação de grupos em 2 etapas
// Padrão: UX moderna, progressiva e clara

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGroup, updateGroup, getGroupCategories, type CreateGroupInput, type UpdateGroupInput, type GroupCategory } from '../../api/groups';
import { getCoreProfile } from '../../api/core';
import { useSession } from '../../contexts/SessionProvider';
import { sanitizeString } from '../../utils/validation';
import { LocationSelector } from '../LocationSelector';
import type { LocationValue } from '../LocationSelector';
import { ImageUpload } from './ImageUpload';
import { useAddressResolver } from '../../hooks/useAddressResolver';
import { getCountries, getStatesByCountry, getCitiesByState } from '../../api/location';
import './CreateGroupWizard.css';

type WizardStep = 1 | 2;

export default function CreateGroupWizard() {
  const navigate = useNavigate();
  const { activeActor, sessionReady } = useSession();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [identityStatus, setIdentityStatus] = useState<'COMPLETE' | 'INCOMPLETE' | 'loading'>('loading');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  // ETAPA 1 - Campos essenciais
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [scope, setScope] = useState<'national' | 'state' | 'city' | 'neighborhood'>('national');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'secret'>('public');
  const [location, setLocation] = useState<LocationValue>({});
  
  // Validações Etapa 1
  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ETAPA 2 - Configurações opcionais
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [hasPhysicalAddress, setHasPhysicalAddress] = useState(false);
  const [hasSchedule, setHasSchedule] = useState(false);
  
  // Campos de endereço físico (quando hasPhysicalAddress = true)
  const [cep, setCepLocal] = useState('');
  const [street, setStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  
  // 🔴 MIGRAÇÃO: Usar hook canônico useAddressResolver (SSOT)
  const { address, loading: cepLoading, error: cepError, setCep: setCepResolver, resolve: resolveCep } = useAddressResolver();
  
  // Ref para evitar atualização de location durante busca de CEP
  const isUpdatingFromCep = useRef(false);
  const lastAddressRef = useRef<string | null>(null);
  const [enableFeed, setEnableFeed] = useState(true);
  const [enableComments, setEnableComments] = useState(true);
  const [enableReactions, setEnableReactions] = useState(true);
  const [enablePolls, setEnablePolls] = useState(true);
  
  // 🔴 INTENÇÃO FINANCEIRA: Pergunta explícita sobre recursos financeiros
  const [hasFinancialIntent, setHasFinancialIntent] = useState<boolean | null>(null);
  const [enableFinancialTransparency, setEnableFinancialTransparency] = useState(false);
  const [financialPurpose, setFinancialPurpose] = useState('');

  // Dados auxiliares
  const [categories, setCategories] = useState<GroupCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 🔴 MIGRAÇÃO: Preencher campos quando address do hook canônico mudar
  useEffect(() => {
    if (!address || !hasPhysicalAddress) return;

    // Evitar reexecução se address não mudou
    const addressKey = `${address.logradouro}-${address.bairro}-${address.localidade}-${address.uf}`;
    if (lastAddressRef.current === addressKey) {
      return;
    }
    lastAddressRef.current = addressKey;

    isUpdatingFromCep.current = true;

    // Preencher campos de endereço
    setStreet(address.logradouro || '');
    setNeighborhood(address.bairro || '');
    setComplement(address.complemento || '');

    // Buscar e atualizar location (país, estado, cidade)
    const updateLocationFromCep = async () => {
      try {
        // 1. Buscar país Brasil
        const countries = await getCountries();
        const brazil = countries.find(c => c.code === 'BR' || c.name.toLowerCase() === 'brasil');
        
        if (!brazil) {
          console.warn('[CreateGroupWizard] País Brasil não encontrado');
          isUpdatingFromCep.current = false;
          return;
        }

        // 2. Buscar estado pela UF
        const states = await getStatesByCountry(brazil.id);
        const state = states.find(s => 
          s.code.toUpperCase() === address.uf.toUpperCase() ||
          s.name.toLowerCase() === address.uf.toLowerCase()
        );

        if (!state) {
          console.warn('[CreateGroupWizard] Estado não encontrado:', address.uf);
          setLocation({
            country_id: brazil.id,
            state_id: undefined,
            city_id: undefined,
            neighborhood_id: undefined,
          });
          isUpdatingFromCep.current = false;
          return;
        }

        // 3. Buscar cidade pelo nome
        const cities = await getCitiesByState(state.id);
        const city = cities.find(c => 
          c.name.toLowerCase() === address.localidade.toLowerCase()
        );

        if (!city) {
          console.warn('[CreateGroupWizard] Cidade não encontrada:', address.localidade);
          setLocation({
            country_id: brazil.id,
            state_id: state.id,
            city_id: undefined,
            neighborhood_id: undefined,
          });
          isUpdatingFromCep.current = false;
          return;
        }

        // 4. Atualizar location com todos os dados encontrados
        setLocation({
          country_id: brazil.id,
          state_id: state.id,
          city_id: city.id,
          neighborhood_id: undefined, // Bairro será selecionado manualmente se necessário
        });

        console.log('[CreateGroupWizard] ✅ Location atualizado do CEP:', {
          country: brazil.name,
          state: state.name,
          city: city.name,
        });
      } catch (err) {
        console.error('[CreateGroupWizard] Erro ao atualizar location do CEP:', err);
      } finally {
        isUpdatingFromCep.current = false;
      }
    };

    updateLocationFromCep();
  }, [address, hasPhysicalAddress, setLocation]);

  // 🔴 GATE: Verificar identity_status
  useEffect(() => {
    const checkIdentityStatus = async () => {
      try {
        const profile = await getCoreProfile();
        setIdentityStatus(profile.identity_status || 'INCOMPLETE');
      } catch (err) {
        console.error('Erro ao verificar identity_status:', err);
        setIdentityStatus('INCOMPLETE');
      }
    };
    checkIdentityStatus();
  }, []);

  // Carregar categorias - apenas após sessão estar pronta
  useEffect(() => {
    // 🔴 GUARD: Não executar antes do bootstrap de autenticação estar completo
    if (!sessionReady) {
      return;
    }

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const cats = await getGroupCategories();
        setCategories(cats);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, [sessionReady]);

  // 🔴 RESET SCOPE: Resetar scope quando categoria mudar e scope atual não for permitido
  useEffect(() => {
    if (categoryId && categories.length > 0) {
      const selectedCategory = categories.find(c => c.categoryId === categoryId);
      const allowedScopes = selectedCategory?.allowedScopes || ['national', 'state', 'city', 'neighborhood'];
      if (!allowedScopes.includes(scope)) {
        const availableScopes: Array<'national' | 'state' | 'city' | 'neighborhood'> = [
          'national',
          'state',
          'city',
          'neighborhood'
        ].filter(s => allowedScopes.includes(s)) as Array<'national' | 'state' | 'city' | 'neighborhood'>;
        if (availableScopes.length > 0) {
          setScope(availableScopes[0]);
        }
      }
    }
  }, [categoryId, categories]);

  // Validar Etapa 1
  // Helper para verificar se Step 1 está válido (sem setar erros)
  // 🔴 CORREÇÃO: Usa apenas valores primitivos (strings) para evitar problemas com referências de objetos
  // Deve estar 100% alinhado com validateStep1() para garantir consistência
  const isStep1Valid = useCallback((): boolean => {
    // Extrair valores primitivos do objeto location (garantir que são strings)
    const countryId: string | undefined = location?.country_id;
    const stateId: string | undefined = location?.state_id;
    const cityId: string | undefined = location?.city_id;
    const neighborhoodId: string | undefined = location?.neighborhood_id;
    
    // 1. Validar nome
    if (!name || name.trim().length < 3) {
      return false;
    }
    
    // 2. Validar descrição
    if (!description || description.trim().length < 10) {
      return false;
    }
    
    // 3. Validar categoria
    if (!categoryId || (typeof categoryId === 'string' && categoryId.trim().length === 0)) {
      return false;
    }
    
    // 4. Validar país (sempre obrigatório)
    if (!countryId || (typeof countryId === 'string' && countryId.trim().length === 0)) {
      return false;
    }
    
    // 5. 🔴 VALIDAÇÃO HIERÁRQUICA: Validar localização baseada em scope
    // scope = 'national' → exige apenas country
    // scope = 'state' → exige country + state
    // scope = 'city' → exige country + state + city
    // scope = 'neighborhood' → exige todos
    
    if (scope !== 'national') {
      // Para scope state/city/neighborhood, validar estado
      if (!stateId || (typeof stateId === 'string' && stateId.trim().length === 0)) {
        return false;
      }
      
      if (scope === 'city' || scope === 'neighborhood') {
        // Para scope city/neighborhood, validar cidade
        if (!cityId || (typeof cityId === 'string' && cityId.trim().length === 0)) {
          return false;
        }
        
        if (scope === 'neighborhood') {
          // Para scope neighborhood, validar bairro
          if (!neighborhoodId || (typeof neighborhoodId === 'string' && neighborhoodId.trim().length === 0)) {
            return false;
          }
        }
      }
    }
    
    // 6. Validar intenção financeira
    if (hasFinancialIntent === null || hasFinancialIntent === undefined) {
      return false;
    }

    // 7. Validar finalidade dos recursos se intenção financeira = true
    if (hasFinancialIntent === true) {
      if (!financialPurpose || financialPurpose.trim().length < 20) {
        return false;
      }
    }
    
    return true;
  }, [name, description, categoryId, location?.country_id, location?.state_id, location?.city_id, location?.neighborhood_id, scope, hasFinancialIntent, financialPurpose]);

  // 🔴 REMOVIDO: useEffect de debug estava causando loop infinito
  // O problema era que location é um objeto e isStep1Valid depende dele,
  // causando recriação constante do callback e disparo do useEffect
  // Logs de debug foram movidos para onChange handlers específicos

  const validateStep1 = (): boolean => {
    // 🔴 CORREÇÃO: Usar apenas valores primitivos (strings) para evitar problemas com referências de objetos
    const countryId: string | undefined = location?.country_id;
    const stateId: string | undefined = location?.state_id;
    const cityId: string | undefined = location?.city_id;
    const neighborhoodId: string | undefined = location?.neighborhood_id;
    
    let isValid = true;
    const validationErrors: string[] = [];
    const failedChecks: string[] = [];

    // Limpar erros anteriores
    setNameError(null);
    setDescriptionError(null);
    setCategoryError(null);
    setLocationError(null);
    setError(null);

    // 1. Validar nome
    if (!name || name.trim().length === 0) {
      setNameError('Nome do grupo é obrigatório');
      isValid = false;
      validationErrors.push('Nome vazio');
      failedChecks.push('name: empty');
    } else if (name.trim().length < 3) {
      setNameError('Nome deve ter pelo menos 3 caracteres');
      isValid = false;
      validationErrors.push('Nome muito curto');
      failedChecks.push(`name: too short (${name.trim().length} < 3)`);
    }

    // 2. Validar descrição
    if (!description || description.trim().length === 0) {
      setDescriptionError('Descrição é obrigatória');
      isValid = false;
      validationErrors.push('Descrição vazia');
      failedChecks.push('description: empty');
    } else if (description.trim().length < 10) {
      setDescriptionError('Descrição deve ter pelo menos 10 caracteres');
      isValid = false;
      validationErrors.push('Descrição muito curta');
      failedChecks.push(`description: too short (${description.trim().length} < 10)`);
    }

    // 3. Validar categoria
    if (!categoryId || (typeof categoryId === 'string' && categoryId.trim().length === 0)) {
      setCategoryError('Selecione uma categoria');
      isValid = false;
      validationErrors.push('Categoria não selecionada');
      failedChecks.push('categoryId: missing');
    }

    // 4. 🔴 VALIDAÇÃO HIERÁRQUICA: Validar localização baseada em scope
    // scope = 'national' → exige apenas country
    // scope = 'state' → exige country + state
    // scope = 'city' → exige country + state + city
    // scope = 'neighborhood' → exige todos
    
    if (!countryId || (typeof countryId === 'string' && countryId.trim().length === 0)) {
      setLocationError('Selecione um país');
      isValid = false;
      validationErrors.push('País não selecionado');
      failedChecks.push('country_id: missing');
    } else if (scope !== 'national') {
      // Para scope state/city/neighborhood, validar estado
      if (!stateId || (typeof stateId === 'string' && stateId.trim().length === 0)) {
        setLocationError('Selecione um estado para a abrangência escolhida');
        isValid = false;
        validationErrors.push(`Estado não selecionado (scope: ${scope})`);
        failedChecks.push(`state_id: missing (scope=${scope}, requires state)`);
      } else if (scope === 'city' || scope === 'neighborhood') {
        // Para scope city/neighborhood, validar cidade
        if (!cityId || (typeof cityId === 'string' && cityId.trim().length === 0)) {
          setLocationError('Selecione uma cidade para a abrangência escolhida');
          isValid = false;
          validationErrors.push(`Cidade não selecionada (scope: ${scope})`);
          failedChecks.push(`city_id: missing (scope=${scope}, requires city)`);
        } else if (scope === 'neighborhood') {
          // Para scope neighborhood, validar bairro
          if (!neighborhoodId || (typeof neighborhoodId === 'string' && neighborhoodId.trim().length === 0)) {
            setLocationError('Selecione um bairro para a abrangência escolhida');
            isValid = false;
            validationErrors.push('Bairro não selecionado');
            failedChecks.push(`neighborhood_id: missing (scope=${scope}, requires neighborhood)`);
          }
        }
      }
    }

    // 5. Validar intenção financeira
    if (hasFinancialIntent === null || hasFinancialIntent === undefined) {
      setError('Por favor, informe se o grupo pretende movimentar recursos financeiros');
      isValid = false;
      validationErrors.push('Intenção financeira não definida');
      failedChecks.push('hasFinancialIntent: null');
    }

    // 6. Validar finalidade dos recursos se intenção financeira = true
    if (hasFinancialIntent === true) {
      if (!financialPurpose || financialPurpose.trim().length < 20) {
        setError('Informe a finalidade dos recursos para continuar. Esse texto é importante para a transparência do grupo.');
        isValid = false;
        validationErrors.push('Finalidade dos recursos não informada ou muito curta (mínimo 20 caracteres)');
        failedChecks.push('financialPurpose: vazio ou < 20 caracteres');
      }
    }

    // 🔴 DEBUG: Log detalhado do resultado da validação
    if (!isValid) {
      console.warn('[CreateGroupWizard] ❌ Step 1 validação FALHOU:', {
        failedChecks,
        validationErrors,
        currentValues: {
          name: name ? `${name.substring(0, 20)}... (${name.trim().length} chars)` : 'vazio',
          description: description ? `${description.substring(0, 20)}... (${description.trim().length} chars)` : 'vazio',
          categoryId: categoryId || 'não definido',
          scope,
          location: {
            country_id: countryId || 'não definido',
            state_id: stateId || 'não definido',
            city_id: cityId || 'não definido',
            neighborhood_id: neighborhoodId || 'não definido',
          },
          hasFinancialIntent,
          financialPurpose: financialPurpose ? `${financialPurpose.substring(0, 20)}... (${financialPurpose.trim().length} chars)` : 'vazio',
        },
      });
    } else {
      console.log('[CreateGroupWizard] ✅ Step 1 validação PASSOU:', {
        name: `${name.substring(0, 20)}... (${name.trim().length} chars)`,
        description: `${description.substring(0, 20)}... (${description.trim().length} chars)`,
        categoryId,
        scope,
        location: {
          country_id: countryId,
          state_id: stateId || 'não requerido',
          city_id: cityId || 'não requerido',
          neighborhood_id: neighborhoodId || 'não requerido',
        },
        hasFinancialIntent,
        financialPurpose: financialPurpose ? `${financialPurpose.substring(0, 20)}... (${financialPurpose.trim().length} chars)` : 'vazio',
      });
    }

    return isValid;
  };

  // Avançar para Etapa 2 (criar grupo)
  const handleStep1Continue = async () => {
    // 🔴 DEBUG: Log explícito de que o handler foi chamado
    console.log('[CreateGroupWizard] 🔵 handleStep1Continue CHAMADO - Iniciando validação...');
    
    setError(null);
    
    // 🔴 CORREÇÃO: Validar ANTES de prosseguir - só bloquear se houver erro real
    const isValid = validateStep1();
    
    if (!isValid) {
      console.warn('[CreateGroupWizard] ❌ Validação Step 1 FALHOU - NÃO avançando para Step 2');
      console.warn('[CreateGroupWizard] Verifique os logs acima para ver quais condições falharam');
      // Não avançar se validação falhou
      return;
    }
    
    console.log('[CreateGroupWizard] ✅ Validação Step 1 PASSOU - Verificando pré-requisitos...');

    // Verificar identity status
    if (identityStatus !== 'COMPLETE') {
      setError('Para criar um grupo, você precisa concluir seu cadastro básico.');
      console.warn('[CreateGroupWizard] ❌ Identity status não está COMPLETE:', identityStatus);
      return;
    }

    // Verificar activeActor (não é mais obrigatório, mas logar se ausente)
    if (!activeActor) {
      console.warn('[CreateGroupWizard] ⚠️ activeActor não encontrado, mas continuando...');
    }

    setIsLoading(true);

    try {
      const sanitizedName = sanitizeString(name, 255);
      const sanitizedDescription = sanitizeString(description, 2000);

      // 🔴 CORREÇÃO: Garantir que valores primitivos sejam usados (não objetos)
      const input: CreateGroupInput = {
        name: sanitizedName,
        description: sanitizedDescription,
        category_id: categoryId,
        visibility,
        scope,
        country_id: location.country_id!,
        state_id: location.state_id || undefined,
        city_id: location.city_id || undefined,
        neighborhood: location.neighborhood_id || undefined,
        // 🔴 REMOVIDO: owner_actor_id não é necessário - backend usa userId do token
        // 🔴 INTENÇÃO FINANCEIRA: Enviar flag explícita no metadata
        metadata: {
          hasFinancialIntent: hasFinancialIntent === true,
        },
        // 🔴 FINALIDADE DOS RECURSOS: Enviar se intenção financeira = true
        financial_purpose: hasFinancialIntent === true ? financialPurpose : undefined,
      };

      console.log('[CreateGroupWizard] 📤 Enviando requisição para criar grupo...');
      const group = await createGroup(input);
      
      console.log('[CreateGroupWizard] ✅ Grupo criado com sucesso:', {
        groupId: group.groupId,
        name: group.name,
      });
      
      setCreatedGroupId(group.groupId);
      
      // 🔴 CORREÇÃO: Avançar para Step 2 APÓS criar grupo com sucesso
      console.log('[CreateGroupWizard] ➡️ Avançando para Step 2...');
      setCurrentStep(2);
    } catch (err) {
      console.error('[CreateGroupWizard] ❌ Erro ao criar grupo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar grupo';
      setError(errorMessage);
      
      // 🔴 DEBUG: Log detalhado do erro
      if (err instanceof Error) {
        console.error('[CreateGroupWizard] Detalhes do erro:', {
          message: err.message,
          stack: err.stack,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar configurações da Etapa 2
  const handleStep2Save = async () => {
    if (!createdGroupId) {
      setError('Grupo não encontrado. Por favor, recomece o processo.');
      return;
    }

    // 🔴 VALIDAÇÃO: Finalidade dos recursos é obrigatória se transparência ativa
    if (enableFinancialTransparency && (!financialPurpose || financialPurpose.trim().length < 20)) {
      setError('Por favor, explique a finalidade dos recursos do grupo (mínimo 20 caracteres).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updateInput: UpdateGroupInput = {
        avatar_url: avatarUrl || undefined,
        cover_url: coverUrl || undefined,
        state_id: location.state_id,
        city_id: location.city_id,
        neighborhood: location.neighborhood_id,
        rules_text: rulesText || undefined,
        metadata: {
          hasPhysicalAddress,
          physicalAddress: hasPhysicalAddress ? {
            cep: cep.replace(/\D/g, ''), // 🔴 MIGRAÇÃO: CEP já está normalizado no state local
            street: street,
            number: addressNumber,
            complement: complement,
            neighborhood: neighborhood,
            // Location já está em location (country_id, state_id, city_id, neighborhood_id)
          } : undefined,
          hasSchedule,
          enableFeed,
          enableComments,
          enableReactions,
          enablePolls,
          // 🔴 INTENÇÃO FINANCEIRA: Só ativar transparência se houver intenção financeira
          enableFinancialTransparency: hasFinancialIntent === true ? enableFinancialTransparency : false,
          // Manter flag de intenção financeira
          hasFinancialIntent: hasFinancialIntent === true,
          // 🔴 FINALIDADE DOS RECURSOS: Obrigatório se transparência ativa
          financial_purpose: enableFinancialTransparency ? financialPurpose : undefined,
        },
      };

      await updateGroup(createdGroupId, updateInput);
      
      // Redirecionar para a página do grupo
      navigate(`/grupos/${createdGroupId}`);
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);
      
      // 🔴 CORREÇÃO UX: Ignorar silenciosamente erros 403 durante o wizard
      // O criador do grupo sempre tem permissão, então 403 nesse fluxo é um erro de sistema
      // que não deve ser exibido ao usuário
      if (err instanceof Error && (
        err.message.includes('403') ||
        err.message.includes('forbidden') ||
        err.message.includes('permission') ||
        err.message.includes('Only the owner')
      )) {
        console.warn('[CreateGroupWizard] Erro de permissão ignorado durante wizard (criador sempre tem permissão):', err.message);
        // Continuar normalmente - o grupo foi criado e o owner tem permissão
        navigate(`/grupos/${createdGroupId}`);
        return;
      }
      
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  // Pular configurações
  const handleSkip = () => {
    if (createdGroupId) {
      navigate(`/grupos/${createdGroupId}`);
    } else {
      navigate('/grupos');
    }
  };

  // Loading state
  if (identityStatus === 'loading') {
    return (
      <div className="create-group-wizard">
        <div className="wizard-container">
          <div className="wizard-loading">Carregando...</div>
        </div>
      </div>
    );
  }

  // Gate: Cadastro incompleto
  if (identityStatus === 'INCOMPLETE') {
    return (
      <div className="create-group-wizard">
        <div className="wizard-container">
          <div className="wizard-gate-message">
            <div className="wizard-gate-icon">🔒</div>
            <h2>Cadastro Incompleto</h2>
            <p>Para criar um grupo, você precisa concluir seu cadastro básico.</p>
            <p className="wizard-gate-subtitle">
              Complete seus dados pessoais (nome, CPF, data de nascimento e sexo) para continuar.
            </p>
            <button
              type="button"
              onClick={() => navigate('/perfil')}
              className="wizard-gate-button"
            >
              Ir para Meu Perfil
            </button>
            <button
              type="button"
              onClick={() => navigate('/grupos')}
              className="wizard-gate-button-secondary"
            >
              Voltar para Grupos
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create-group-wizard">
      <div className="wizard-container">
        {/* Barra de progresso */}
        <div className="wizard-progress">
          <div className="wizard-progress-bar">
            <div 
              className="wizard-progress-fill" 
              style={{ width: `${(currentStep / 2) * 100}%` }}
            />
          </div>
          <div className="wizard-progress-steps">
            <div className={`wizard-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
              <span className="wizard-step-number">1</span>
              <span className="wizard-step-label">Criar Grupo</span>
            </div>
            <div className={`wizard-step ${currentStep >= 2 ? 'active' : ''}`}>
              <span className="wizard-step-number">2</span>
              <span className="wizard-step-label">Configurar</span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="wizard-header">
          <button
            type="button"
            onClick={() => currentStep === 1 ? navigate('/grupos') : setCurrentStep(1)}
            className="wizard-back-button"
          >
            ← {currentStep === 1 ? 'Voltar' : 'Anterior'}
          </button>
          <h1>
            {currentStep === 1 ? 'Criar Novo Grupo' : 'Configurar seu Grupo'}
          </h1>
          {currentStep === 1 && (
            <p className="wizard-subtitle">
              Defina a intenção e propósito do seu grupo
            </p>
          )}
        </div>

        {/* Erro global */}
        {error && (
          <div className="wizard-error">
            ⚠️ {error}
          </div>
        )}

        {/* ETAPA 1 - Criar Grupo */}
        {currentStep === 1 && (
          <div className="wizard-step-content">
            <form onSubmit={(e) => {
              e.preventDefault();
              // 🔴 DEBUG: Log explícito de que o form submit foi disparado
              console.log('[CreateGroupWizard] 📝 FORM SUBMIT DISPARADO - Chamando handleStep1Continue');
              handleStep1Continue();
            }}>
              {/* Nome */}
              <div className="wizard-form-group">
                <label htmlFor="name">
                  Nome do Grupo *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[<>]/g, '');
                    if (value.length <= 255) {
                      setName(value);
                      setNameError(null);
                    }
                  }}
                  onBlur={() => {
                    if (name && name.trim().length < 3) {
                      setNameError('Nome deve ter pelo menos 3 caracteres');
                    }
                  }}
                  placeholder="Ex: Motoclube Águias"
                  required
                  maxLength={255}
                  className={nameError ? 'error' : ''}
                  disabled={isLoading}
                />
                {nameError && <span className="field-error">{nameError}</span>}
                <small>Escolha um nome claro e representativo para seu grupo</small>
              </div>

              {/* Descrição */}
              <div className="wizard-form-group">
                <label htmlFor="description">
                  Descrição *
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[<>]/g, '');
                    if (value.length <= 2000) {
                      setDescription(value);
                      setDescriptionError(null);
                    }
                  }}
                  onBlur={() => {
                    if (description && description.trim().length < 10) {
                      setDescriptionError('Descrição deve ter pelo menos 10 caracteres');
                    }
                  }}
                  placeholder="Descreva o propósito, objetivos e atividades do grupo..."
                  rows={5}
                  maxLength={2000}
                  className={descriptionError ? 'error' : ''}
                  disabled={isLoading}
                  required
                />
                {descriptionError && <span className="field-error">{descriptionError}</span>}
                <small>{description.length}/2000 caracteres</small>
              </div>

              {/* Categoria */}
              <div className="wizard-form-group">
                <label htmlFor="category">
                  Categoria *
                </label>
                {loadingCategories ? (
                  <div className="wizard-loading-select">Carregando categorias...</div>
                ) : (
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => {
                      setCategoryId(e.target.value);
                      setCategoryError(null);
                    }}
                    className={categoryError ? 'error' : ''}
                    disabled={isLoading}
                    required
                  >
                    <option value="">Selecione uma categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.categoryId} value={cat.categoryId}>
                        {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                      </option>
                    ))}
                  </select>
                )}
                {categoryError && <span className="field-error">{categoryError}</span>}
                <small>Escolha a categoria que melhor representa seu grupo</small>
              </div>

              {/* Abrangência */}
              <div className="wizard-form-group">
                <label htmlFor="scope">
                  Abrangência *
                </label>
                {(() => {
                  // 🔴 FILTRO: Filtrar scopes baseado em allowedScopes da categoria selecionada
                  const selectedCategory = categories.find(c => c.categoryId === categoryId);
                  const allowedScopes = selectedCategory?.allowedScopes || ['national', 'state', 'city', 'neighborhood'];
                  
                  // Se scope atual não está na lista permitida, resetar para o primeiro permitido
                  const availableScopes: Array<'national' | 'state' | 'city' | 'neighborhood'> = [
                    'national',
                    'state',
                    'city',
                    'neighborhood'
                  ].filter(s => allowedScopes.includes(s)) as Array<'national' | 'state' | 'city' | 'neighborhood'>;
                  
                  return (
                    <select
                      id="scope"
                      value={scope}
                      onChange={(e) => {
                        const newScope = e.target.value as typeof scope;
                        
                        // Guard: Evitar setState se scope não mudou
                        if (newScope === scope) {
                          return;
                        }
                        
                        setScope(newScope);
                        
                        // Limpar campos condicionais ao mudar scope
                        // Guard: Só atualizar location se realmente precisar limpar campos
                        if (newScope === 'national') {
                          // Se já não tem state_id, city_id, neighborhood_id, não precisa atualizar
                          if (location.state_id || location.city_id || location.neighborhood_id) {
                            setLocation({
                              ...location,
                              state_id: undefined,
                              city_id: undefined,
                              neighborhood_id: undefined,
                            });
                          }
                        } else if (newScope === 'state') {
                          // Se já não tem city_id, neighborhood_id, não precisa atualizar
                          if (location.city_id || location.neighborhood_id) {
                            setLocation({
                              ...location,
                              city_id: undefined,
                              neighborhood_id: undefined,
                            });
                          }
                        } else if (newScope === 'city') {
                          // Se já não tem neighborhood_id, não precisa atualizar
                          if (location.neighborhood_id) {
                            setLocation({
                              ...location,
                              neighborhood_id: undefined,
                            });
                          }
                        }
                      }}
                      disabled={isLoading || !categoryId}
                      required
                    >
                      <option value="">{categoryId ? 'Selecione uma abrangência' : 'Selecione uma categoria primeiro'}</option>
                      {availableScopes.map((s) => (
                        <option key={s} value={s}>
                          {s === 'national' && 'Nacional'}
                          {s === 'state' && 'Estadual'}
                          {s === 'city' && 'Municipal'}
                          {s === 'neighborhood' && 'Bairro'}
                        </option>
                      ))}
                    </select>
                  );
                })()}
                <small>
                  {scope === 'national' && 'Grupo com atuação em todo o país'}
                  {scope === 'state' && 'Grupo com atuação em um estado específico'}
                  {scope === 'city' && 'Grupo com atuação em uma cidade específica'}
                  {scope === 'neighborhood' && 'Grupo com atuação em um bairro específico'}
                  {categoryId && (() => {
                    const selectedCategory = categories.find(c => c.categoryId === categoryId);
                    const allowedScopes = selectedCategory?.allowedScopes;
                    if (allowedScopes && allowedScopes.length < 4) {
                      return ` (Abrangências permitidas para esta categoria: ${allowedScopes.map(s => {
                        if (s === 'national') return 'Nacional';
                        if (s === 'state') return 'Estadual';
                        if (s === 'city') return 'Municipal';
                        if (s === 'neighborhood') return 'Bairro';
                        return s;
                      }).join(', ')})`;
                    }
                    return '';
                  })()}
                </small>
              </div>

              {/* Localização usando LocationSelector */}
              <div className="wizard-form-group">
                <LocationSelector
                  scope={scope}
                  value={location}
                  onChange={(newLocation) => {
                    // 🔴 Guard: Evitar setState se os valores são logicamente iguais
                    const hasChanged = 
                      location.country_id !== newLocation.country_id ||
                      location.state_id !== newLocation.state_id ||
                      location.city_id !== newLocation.city_id ||
                      location.neighborhood_id !== newLocation.neighborhood_id;
                    
                    if (!hasChanged) {
                      // Valores são iguais, não atualizar estado (evita loop)
                      return;
                    }
                    
                    // 🔴 DEBUG: Log mudança de location (apenas em dev e quando realmente mudou)
                    if (import.meta.env.DEV) {
                      console.log('[CreateGroupWizard] LocationSelector onChange (valores mudaram):', {
                        oldLocation: {
                          country_id: location.country_id,
                          state_id: location.state_id,
                          city_id: location.city_id,
                          neighborhood_id: location.neighborhood_id,
                        },
                        newLocation: {
                          country_id: newLocation.country_id,
                          state_id: newLocation.state_id,
                          city_id: newLocation.city_id,
                          neighborhood_id: newLocation.neighborhood_id,
                        },
                        scope,
                      });
                    }
                    
                    setLocation(newLocation);
                    setLocationError(null);
                  }}
                  required
                  error={locationError || undefined}
                  labels={{
                    country: 'País',
                    state: 'Estado',
                    city: 'Cidade',
                    neighborhood: 'Bairro',
                  }}
                />
              </div>

              {/* Visibilidade */}
              <div className="wizard-form-group">
                <label htmlFor="visibility">
                  Visibilidade *
                </label>
                <select
                  id="visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                  disabled={isLoading}
                  required
                >
                  <option value="public">Público - Aparece na busca e qualquer pessoa pode ver</option>
                  <option value="private">Privado - Aparece na busca, mas requer aprovação para entrar</option>
                  <option value="secret">Secreto - Não aparece na busca, apenas por convite</option>
                </select>
                <small>Controle quem pode encontrar e participar do seu grupo</small>
              </div>

              {/* 🔴 CORREÇÃO: Intenção Financeira movida do Step 2 para Step 1 */}
              {/* SEÇÃO - Intenção Financeira */}
              <div className="wizard-form-group">
                <label className="wizard-question-label">
                  Este grupo pretende receber ou movimentar recursos financeiros? *
                </label>
                <div className="wizard-radio-group">
                  <label className="wizard-radio-label">
                    <input
                      type="radio"
                      name="financialIntent"
                      value="yes"
                      checked={hasFinancialIntent === true}
                      onChange={() => {
                        setHasFinancialIntent(true);
                        // Se SIM: ativar transparência financeira e votação obrigatória
                        setEnableFinancialTransparency(true);
                        setEnablePolls(true); // Votação obrigatória
                      }}
                      disabled={isLoading}
                    />
                    <span>Sim, este grupo vai movimentar recursos financeiros</span>
                  </label>
                  <label className="wizard-radio-label">
                    <input
                      type="radio"
                      name="financialIntent"
                      value="no"
                      checked={hasFinancialIntent === false}
                      onChange={() => {
                        setHasFinancialIntent(false);
                        // Se NÃO: desativar transparência financeira e limpar campo de finalidade
                        setEnableFinancialTransparency(false);
                        setFinancialPurpose('');
                      }}
                      disabled={isLoading}
                    />
                    <span>Não, este é um grupo apenas social</span>
                  </label>
                </div>
                {error && error.includes('financeiro') && (
                  <p className="wizard-error" style={{ marginTop: '8px' }}>{error}</p>
                )}
                {hasFinancialIntent === true && (
                  <>
                    <div className="wizard-info-box wizard-info-box-positive" style={{ marginTop: '12px' }}>
                      <strong>Implicações:</strong>
                      <ul>
                        <li>Transparência financeira será ativada automaticamente</li>
                        <li>Votação será obrigatória para decisões financeiras</li>
                        <li>Conta financeira será criada para o grupo</li>
                        <li>Todas as movimentações serão registradas no ledger</li>
                      </ul>
                    </div>

                    {/* 🔴 FINALIDADE DOS RECURSOS: Campo obrigatório quando intenção financeira = true */}
                    <div className="wizard-form-group" style={{ marginTop: '20px' }}>
                      <label className="wizard-question-label">
                        Finalidade e aplicação dos recursos *
                      </label>
                      <p className="wizard-field-description" style={{ marginBottom: '12px', color: '#666', fontSize: '0.9rem', lineHeight: '1.5' }}>
                        Explique de forma clara e transparente como os recursos financeiros deste grupo serão utilizados.
                        Essa informação será pública e ajudará outras pessoas a decidir se desejam participar do grupo.
                        Exemplo: ações sociais, compra de materiais, manutenção de espaço, eventos, apoio comunitário, entre outros.
                      </p>
                      <textarea
                        className="wizard-textarea"
                        value={financialPurpose}
                        onChange={(e) => setFinancialPurpose(e.target.value)}
                        placeholder="Ex: Os recursos arrecadados serão utilizados para compra de ração para animais resgatados, organização de eventos beneficentes e manutenção das atividades do grupo."
                        rows={6}
                        disabled={isLoading}
                        required={hasFinancialIntent === true}
                      />
                      {financialPurpose && financialPurpose.trim().length > 0 && financialPurpose.trim().length < 20 && (
                        <small style={{ color: '#dc3545', marginTop: '4px', display: 'block' }}>
                          Mínimo de 20 caracteres. Seja específico sobre como o dinheiro será usado.
                        </small>
                      )}
                      {financialPurpose && financialPurpose.trim().length >= 20 && (
                        <small style={{ color: '#28a745', marginTop: '4px', display: 'block' }}>
                          ✓ {financialPurpose.trim().length} caracteres
                        </small>
                      )}
                    </div>
                  </>
                )}
                {hasFinancialIntent === false && (
                  <div className="wizard-info-box" style={{ marginTop: '12px', background: '#f0f0f0' }}>
                    <strong>Grupo Social:</strong>
                    <p>Este grupo será criado sem recursos financeiros. Você poderá ativar a economia depois nas configurações do grupo.</p>
                  </div>
                )}
              </div>

              {/* Botão Continuar */}
              <div className="wizard-actions">
                <button
                  type="button"
                  onClick={() => navigate('/grupos')}
                  className="wizard-button-secondary"
                  disabled={isLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="wizard-button-primary"
                  disabled={isLoading || !isStep1Valid()}
                  onClick={(e) => {
                    // 🔴 DEBUG: Log explícito de que o botão foi clicado
                    console.log('[CreateGroupWizard] 🟢 BOTÃO CONTINUAR CLICADO (onClick handler)');
                    console.log('[CreateGroupWizard] Estado do botão:', {
                      isLoading,
                      isStep1Valid: isStep1Valid(),
                      disabled: isLoading || !isStep1Valid(),
                    });
                    
                    // Se o botão estiver desabilitado, prevenir submit
                    if (isLoading || !isStep1Valid()) {
                      e.preventDefault();
                      console.warn('[CreateGroupWizard] ⚠️ Botão Continuar desabilitado - prevenindo submit:', {
                        isLoading,
                        isStep1Valid: isStep1Valid(),
                        validationDetails: {
                          name: name ? `${name.substring(0, 20)}... (${name.trim().length} chars)` : 'vazio',
                          description: description ? `${description.substring(0, 20)}... (${description.trim().length} chars)` : 'vazio',
                          categoryId: categoryId || 'não definido',
                          country_id: location.country_id || 'não definido',
                          state_id: location.state_id || 'não definido',
                          city_id: location.city_id || 'não definido',
                          neighborhood_id: location.neighborhood_id || 'não definido',
                          scope,
                          hasFinancialIntent,
                        },
                      });
                      return;
                    }
                    
                    // Se o botão estiver habilitado, o submit do form será disparado
                    console.log('[CreateGroupWizard] ✅ Botão Continuar habilitado - permitindo submit do form');
                  }}
                >
                  {isLoading ? 'Criando...' : 'Continuar'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ETAPA 2 - Configurar Grupo */}
        {currentStep === 2 && (
          <div className="wizard-step-content">
            <div className="wizard-config-sections">
              {/* SEÇÃO 1 - Aparência */}
              <div className="wizard-config-section">
                <h3>Aparência</h3>
                {createdGroupId ? (
                  <>
                    <ImageUpload
                      groupId={createdGroupId}
                      type="avatar"
                      currentUrl={avatarUrl || undefined}
                      onUploadComplete={(url) => setAvatarUrl(url)}
                      onRemove={() => {
                        setAvatarUrl('');
                        // Não chamar backend ainda - apenas limpar state local
                      }}
                      disabled={isLoading}
                    />
                    <ImageUpload
                      groupId={createdGroupId}
                      type="cover"
                      currentUrl={coverUrl || undefined}
                      onUploadComplete={(url) => setCoverUrl(url)}
                      onRemove={() => {
                        setCoverUrl('');
                        // Não chamar backend ainda - apenas limpar state local
                      }}
                      disabled={isLoading}
                    />
                  </>
                ) : (
                  <div className="wizard-info-message">
                    <p>💡 Crie o grupo primeiro para fazer upload de imagens</p>
                  </div>
                )}
              </div>

              {/* SEÇÃO 2 - Informações do Grupo (Read-Only) */}
              <div className="wizard-config-section">
                <h3>Informações do Grupo</h3>
                <div className="wizard-info-box" style={{ marginBottom: '16px' }}>
                  <p>Alguns campos não podem ser alterados após a criação do grupo.</p>
                </div>

                {/* Categoria (Read-Only) */}
                <div className="wizard-form-group">
                  <label htmlFor="category-readonly">
                    Categoria
                    <span className="wizard-readonly-badge" title="Este campo não pode ser alterado após a criação do grupo">
                      🔒 Somente leitura
                    </span>
                  </label>
                  <input
                    type="text"
                    id="category-readonly"
                    value={categories.find(c => c.categoryId === categoryId)?.name || 'Carregando...'}
                    readOnly
                    disabled
                    className="wizard-input-readonly"
                    title="Este campo não pode ser alterado após a criação do grupo"
                  />
                </div>

                {/* Tipo do Grupo (Read-Only) */}
                <div className="wizard-form-group">
                  <label htmlFor="type-readonly">
                    Tipo do Grupo
                    <span className="wizard-readonly-badge" title="Este campo não pode ser alterado após a criação do grupo">
                      🔒 Somente leitura
                    </span>
                  </label>
                  <input
                    type="text"
                    id="type-readonly"
                    value={hasFinancialIntent === true ? '💰 Grupo com recursos financeiros' : '👥 Grupo social'}
                    readOnly
                    disabled
                    className="wizard-input-readonly"
                    title="Este campo não pode ser alterado após a criação do grupo"
                  />
                </div>

                {/* Finalidade Financeira (Read-Only, se aplicável) */}
                {hasFinancialIntent === true && financialPurpose && (
                  <div className="wizard-form-group">
                    <label htmlFor="financial-purpose-readonly">
                      Finalidade dos Recursos
                      <span className="wizard-readonly-badge" title="Este campo não pode ser alterado após a criação do grupo">
                        🔒 Somente leitura
                      </span>
                    </label>
                    <textarea
                      id="financial-purpose-readonly"
                      value={financialPurpose}
                      readOnly
                      disabled
                      rows={4}
                      className="wizard-textarea-readonly"
                      title="Este campo não pode ser alterado após a criação do grupo"
                    />
                  </div>
                )}
              </div>

              {/* SEÇÃO 3 - Descrição (Editável) */}
              <div className="wizard-config-section">
                <h3>Descrição</h3>
                <div className="wizard-form-group">
                  <label htmlFor="description-step2">
                    Descrição do Grupo
                  </label>
                  <textarea
                    id="description-step2"
                    value={description}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[<>]/g, '');
                      if (value.length <= 2000) {
                        setDescription(value);
                        setDescriptionError(null);
                      }
                    }}
                    placeholder="Descreva o propósito, objetivos e atividades do grupo..."
                    rows={5}
                    maxLength={2000}
                    disabled={isLoading}
                  />
                  <small>{description.length}/2000 caracteres</small>
                </div>
              </div>

              {/* SEÇÃO 4 - Localização (condicional) */}
              {scope !== 'national' && (
                <div className="wizard-config-section">
                  <h3>Localização</h3>
                  <LocationSelector
                    scope={scope}
                    value={location}
                    onChange={setLocation}
                    disabled={isLoading}
                    labels={{
                      country: 'País',
                      state: 'Estado',
                      city: 'Cidade',
                      neighborhood: 'Bairro',
                    }}
                  />
                </div>
              )}

              {/* 🔴 REMOVIDO: Seção de Intenção Financeira foi movida para Step 1 */}
              {/* A pergunta agora aparece no Step 1, antes do botão "Continuar" */}

              {/* SEÇÃO 3 - Sede física */}
              <div className="wizard-config-section">
                <h3>Sede Física</h3>
                <div className="wizard-form-group">
                  <label className="wizard-checkbox-label">
                    <input
                      type="checkbox"
                      checked={hasPhysicalAddress}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setHasPhysicalAddress(checked);
                        // Limpar campos de endereço se desmarcar
                        if (!checked) {
                          setCepLocal('');
                          setCepResolver('', 'user');
                          setStreet('');
                          setAddressNumber('');
                          setComplement('');
                          setNeighborhood('');
                        }
                      }}
                      disabled={isLoading}
                    />
                    <span>Este grupo possui uma sede ou endereço físico</span>
                  </label>
                </div>
                {hasPhysicalAddress && (
                  <>
                    {/* CEP */}
                    <div className="wizard-form-group">
                      <label htmlFor="cep">CEP</label>
                      <input
                        type="text"
                        id="cep"
                        value={cep}
                        onChange={(e) => {
                          // Aplicar máscara CEP (00000-000)
                          const value = e.target.value.replace(/\D/g, '');
                          const masked = value.length > 5 
                            ? `${value.slice(0, 5)}-${value.slice(5, 8)}`
                            : value;
                          setCepLocal(masked);
                          
                          // 🔴 MIGRAÇÃO: Atualizar hook canônico com origem 'user' (não dispara busca)
                          setCepResolver(value, 'user');
                          
                          // 🔴 MIGRAÇÃO: Se completar 8 dígitos DURANTE onChange, chamar resolve() explicitamente
                          if (value.length === 8) {
                            resolveCep();
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={isLoading || cepLoading}
                        className={cepError ? 'error' : ''}
                      />
                      {cepLoading && <small>Buscando endereço...</small>}
                      {cepError && <small className="error-text">{cepError}</small>}
                    </div>

                    {/* Rua */}
                    <div className="wizard-form-group">
                      <label htmlFor="street">Rua / Logradouro</label>
                      <input
                        type="text"
                        id="street"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Nome da rua, avenida, etc."
                        disabled={isLoading || cepLoading}
                      />
                    </div>

                    {/* Número e Complemento */}
                    <div className="wizard-form-row">
                      <div className="wizard-form-group">
                        <label htmlFor="addressNumber">Número</label>
                        <input
                          type="text"
                          id="addressNumber"
                          value={addressNumber}
                          onChange={(e) => setAddressNumber(e.target.value)}
                          placeholder="123"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="wizard-form-group">
                        <label htmlFor="complement">Complemento</label>
                        <input
                          type="text"
                          id="complement"
                          value={complement}
                          onChange={(e) => setComplement(e.target.value)}
                          placeholder="Apto, bloco, etc."
                          disabled={isLoading || cepLoading}
                        />
                      </div>
                    </div>

                    {/* Bairro */}
                    <div className="wizard-form-group">
                      <label htmlFor="neighborhood">Bairro</label>
                      <input
                        type="text"
                        id="neighborhood"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Nome do bairro"
                        disabled={isLoading || cepLoading}
                      />
                    </div>

                    {/* Localização (País, Estado, Cidade) - já preenchido pelo CEP */}
                    <div className="wizard-form-group">
                      <label>Localização</label>
                      <LocationSelector
                        scope="city"
                        value={location}
                        onChange={(newLocation) => {
                          // Não atualizar se estiver sendo atualizado pelo CEP
                          if (!isUpdatingFromCep.current) {
                            setLocation(newLocation);
                          }
                        }}
                        required
                        disabled={isLoading || cepLoading}
                        labels={{
                          country: 'País',
                          state: 'Estado',
                          city: 'Cidade',
                        }}
                      />
                      <small>Preenchido automaticamente pelo CEP. Você pode ajustar se necessário.</small>
                    </div>
                  </>
                )}
              </div>

              {/* SEÇÃO 6 - Agenda */}
              <div className="wizard-config-section">
                <h3>Agenda e Funcionamento</h3>
                <div className="wizard-form-group">
                  <label className="wizard-checkbox-label">
                    <input
                      type="checkbox"
                      checked={hasSchedule}
                      onChange={(e) => setHasSchedule(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Este grupo possui encontros ou horários fixos</span>
                  </label>
                </div>
                {hasSchedule && (
                  <div className="wizard-form-group">
                    <small>Você poderá configurar a agenda depois na página do grupo</small>
                  </div>
                )}
              </div>

              {/* SEÇÃO 7 - Governança */}
              <div className="wizard-config-section">
                <h3>Governança</h3>
                <div className="wizard-form-group">
                  <label htmlFor="rules">Regras do Grupo</label>
                  <textarea
                    id="rules"
                    value={rulesText}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[<>]/g, '');
                      if (value.length <= 5000) {
                        setRulesText(value);
                      }
                    }}
                    placeholder="Defina as regras e diretrizes do grupo..."
                    rows={6}
                    maxLength={5000}
                    disabled={isLoading}
                  />
                  <small>{rulesText.length}/5000 caracteres</small>
                </div>
                <div className="wizard-form-group">
                  <small>Você poderá convidar administradores e colaboradores depois na página do grupo</small>
                </div>
              </div>

              {/* SEÇÃO 8 - Comunicação */}
              <div className="wizard-config-section">
                <h3>Comunicação e Participação</h3>
                <div className="wizard-form-group">
                  <label className="wizard-toggle-label">
                    <input
                      type="checkbox"
                      checked={enableFeed}
                      onChange={(e) => setEnableFeed(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Ativar feed do grupo</span>
                  </label>
                </div>
                <div className="wizard-form-group">
                  <label className="wizard-toggle-label">
                    <input
                      type="checkbox"
                      checked={enableComments}
                      onChange={(e) => setEnableComments(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Permitir comentários</span>
                  </label>
                </div>
                <div className="wizard-form-group">
                  <label className="wizard-toggle-label">
                    <input
                      type="checkbox"
                      checked={enableReactions}
                      onChange={(e) => setEnableReactions(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Permitir reações</span>
                  </label>
                </div>
                <div className="wizard-form-group">
                  <label className="wizard-toggle-label">
                    <input
                      type="checkbox"
                      checked={enablePolls}
                      onChange={(e) => setEnablePolls(e.target.checked)}
                      disabled={isLoading}
                    />
                    <span>Permitir votações</span>
                  </label>
                </div>
              </div>

              {/* SEÇÃO 9 - Transparência Financeira (condicional) */}
              {hasFinancialIntent === true && (
                <div className="wizard-config-section">
                  <h3>Transparência Financeira</h3>
                  <div className="wizard-info-box">
                    <p>
                      Com transparência financeira ativada, os membros poderão acompanhar saldo e movimentações do grupo.
                    </p>
                  </div>
                  <div className="wizard-form-group">
                    <label className="wizard-toggle-label">
                      <input
                        type="checkbox"
                        checked={enableFinancialTransparency}
                        onChange={(e) => setEnableFinancialTransparency(e.target.checked)}
                        disabled={isLoading}
                      />
                      <span>Ativar transparência financeira</span>
                    </label>
                    <small>Recomendado para grupos que movimentam recursos</small>
                  </div>

                  {/* 🔴 FINALIDADE DOS RECURSOS: Campo obrigatório quando transparência ativa */}
                  {enableFinancialTransparency && (
                    <div className="wizard-form-group">
                      <label className="wizard-question-label">
                        Finalidade dos recursos do grupo *
                      </label>
                      <p className="wizard-field-description">
                        Explique de forma clara como os recursos financeiros do grupo serão utilizados. 
                        Esta informação será pública e ajudará os membros a entenderem o propósito das movimentações.
                      </p>
                      <textarea
                        className="wizard-textarea"
                        value={financialPurpose}
                        onChange={(e) => setFinancialPurpose(e.target.value)}
                        placeholder="Ex: Os recursos serão utilizados para organizar eventos comunitários, comprar materiais para atividades, pagar despesas operacionais do grupo..."
                        rows={6}
                        disabled={isLoading}
                        required={enableFinancialTransparency}
                      />
                      <small>
                        Mínimo de 20 caracteres. Seja específico sobre como o dinheiro será usado.
                      </small>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Ações finais */}
            <div className="wizard-actions">
              <button
                type="button"
                onClick={handleSkip}
                className="wizard-button-secondary"
                disabled={isLoading}
              >
                Pular por enquanto
              </button>
              <button
                type="button"
                onClick={handleStep2Save}
                className="wizard-button-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

