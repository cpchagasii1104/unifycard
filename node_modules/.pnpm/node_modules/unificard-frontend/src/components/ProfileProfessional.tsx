// src/components/ProfileProfessional.tsx
// Componente de perfil profissional com seleção hierárquica de categorias

import { useState, useEffect } from 'react';
import { CategoryContext } from '@unificard/contracts';
import {
  getCategoryTree,
  autocompleteCategories,
  getProfessionalProfile,
  updateProfessionalProfile,
  createCategoryWithAI,
  suggestCategoryPath,
  type CategoryTree,
  type Category,
  type CategoryAutocompleteResult,
  type AvailabilitySchedule,
  type EducationEntry,
  type CategoryPathSuggestion,
  type ComboDiscountRule,
} from '../api/categories';
import { type UserPlan } from '../config/features';
import {
  sanitizeString,
  sanitizeText,
  validateMonetaryValue,
  validateYearsExperience,
  validateEducationEntry,
} from '../utils/validation';
import AvailabilityScheduleComponent from './AvailabilityScheduleEnhanced';
import EducationSection from './EducationSection';
import PredefinedServicesManager from './PredefinedServicesManager';
import ComboDiscountRulesManager from './ComboDiscountRulesManager';
import './ProfileProfessional.css';

type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
type ServiceType = 'service' | 'product';

interface PredefinedService {
  serviceId: string;
  name: string;
  description?: string;
  basePrice: number;
  discountPercentage?: number; // 0-100
  finalPrice: number;
  isActive: boolean;
}

interface SelectedSkill {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
  hourlyRate: number | null;
  pricingType: PricingType; // 'hourly' = por hora, 'daily' = por dia, 'weekly' = por semana, 'monthly' = por mês, 'quote' = solicitar orçamento primeiro
  serviceType: ServiceType; // 'service' = serviço, 'product' = produto
  chargeVisit: boolean; // Se cobra visita para orçamento
  visitPrice: number | null; // Preço da visita (se chargeVisit = true)
  predefinedServices: PredefinedService[]; // Serviços pré-definidos com valores fixos
  comboDiscountRules: ComboDiscountRule[]; // Regras de desconto para combos
}

export default function ProfileProfessional() {
  const [categoryTree, setCategoryTree] = useState<CategoryTree[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Category[]>([]);
  const [autocompleteResults, setAutocompleteResults] = useState<CategoryAutocompleteResult[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState<string | null>(null);
  const [isCreatingWithAI, setIsCreatingWithAI] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  // Feature flag para microfone (versão paga)
  const [_userPlan, setUserPlan] = useState<UserPlan>('free');
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategoryPathSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [bio, setBio] = useState('');
  const [education, setEducation] = useState<EducationEntry[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [skillErrors, setSkillErrors] = useState<Record<string, string>>({});
  const [userAge, setUserAge] = useState<number | undefined>(undefined);
  const [newlyAddedSkillId, setNewlyAddedSkillId] = useState<string | null>(null);
  const [searchFieldError, setSearchFieldError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    
    // Carregar features do usuário (versão paga)
    (async () => {
      try {
        const { getUserPlan, getUserFeatures } = await import('../config/features');
        const plan = await getUserPlan();
        const features = await getUserFeatures();
        setUserPlan(plan);
        setAiAssistEnabled(features.aiAssistEnabled);
      } catch (err) {
        console.error('Erro ao carregar features do usuário:', err);
        // Em caso de erro, assumir free (mais restritivo)
        setUserPlan('free');
        setAiAssistEnabled(false);
      }
    })();
    
    // Carregar idade do usuário para validação
    (async () => {
      try {
        const { getIdentityProfile } = await import('../api/identity');
        const identity = await getIdentityProfile();
        if (identity?.global?.birthdate) {
          const birthDate = new Date(identity.global.birthdate);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const dayDiff = today.getDate() - birthDate.getDate();
          const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
          if (actualAge > 0 && actualAge < 120) {
            setUserAge(actualAge);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar idade do usuário:', err);
      }
    })();
    
    // FEATURE FLAG: Inicializar Web Speech API apenas se feature habilitada (versão paga)
    if (aiAssistEnabled && typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'pt-BR';
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchTerm(transcript);
        handleSearch(transcript);
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        setIsRecording(false);
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      // Se feature não habilitada, não inicializar
      setRecognition(null);
    }
  }, [aiAssistEnabled]); // Recriar quando feature flag mudar

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Verificar se tenant está disponível antes de carregar
      const { getTenantId } = await import('../config/auth');
      const tenantId = getTenantId();
      
      if (!tenantId) {
        throw new Error('Tenant ID não encontrado. Por favor, faça login novamente.');
      }

      const [tree, profile] = await Promise.all([
        getCategoryTree().catch((err) => {
          console.error('Erro ao carregar categorias:', err);
          const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
          
          // Mensagem mais clara para erro de tenant
          if (errorMsg.includes('Missing tenant ID') || errorMsg.includes('tenant')) {
            throw new Error('Erro de autenticação: Tenant ID não encontrado. Por favor, faça login novamente.');
          }
          
          throw new Error(`Erro ao carregar categorias: ${errorMsg}`);
        }),
        getProfessionalProfile().catch((err) => {
          console.error('Erro ao carregar perfil profissional:', err);
          // Não falha se o perfil não existir ainda
          return { globalUserId: '', skills: [], education: [], bio: null, availability: null };
        }),
      ]);

      console.log('Categorias carregadas:', tree.length);
      setCategoryTree(tree);
      setBio(profile.bio || '');
      setAvailability(profile.availability || null);
      setEducation(profile.education || []);
      setSelectedSkills(
        profile.skills.map((s) => ({
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          categoryPath: s.categoryPath,
          skillLevel: s.skillLevel,
          yearsExperience: s.yearsExperience,
          hourlyRate: s.hourlyRate,
          pricingType: s.pricingType || 'hourly',
          serviceType: (s as any).serviceType || 'service',
          chargeVisit: (s as any).chargeVisit || false,
          visitPrice: (s as any).visitPrice || null,
          predefinedServices: (s as any).predefinedServices || [],
          comboDiscountRules: (s as any).comboDiscountRules || [],
        }))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      
      // Mensagens mais claras para erros comuns
      if (errorMessage.includes('tenant') || errorMessage.includes('Tenant') || errorMessage.includes('Missing tenant ID')) {
        setError('Erro de autenticação: Tenant ID não encontrado. Por favor, faça login novamente.');
      } else if (errorMessage.includes('Não autenticado') || errorMessage.includes('401')) {
        setError('Sessão expirada. Por favor, faça login novamente.');
      } else {
        setError(errorMessage);
      }
      
      console.error('Erro completo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce para autocomplete
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);
    
    // Limpar timeout anterior
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (term.length < 1) {
      setSearchResults([]);
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      return;
    }

    // Se termo tem 1+ caractere, usar autocomplete
    if (term.length >= 1) {
      setIsSearching(true);
      setAutocompleteError(null); // Limpar erro anterior
      
      // Debounce: aguardar 300ms antes de buscar
      const timeout = setTimeout(async () => {
        try {
          // DIAGNÓSTICO TEMPORÁRIO: Log antes da chamada
          console.debug('[ProfileProfessional] term=', term);
          
          const results = await autocompleteCategories(term, 'professional' as CategoryContext, undefined, 20);
          
          // DIAGNÓSTICO TEMPORÁRIO: Log resultados
          console.debug('[ProfileProfessional] results=', results.length);
          
          setAutocompleteResults(results);
          setAutocompleteError(null); // Sucesso: limpar erro
          
          // Mostrar dropdown se houver resultados
          if (results.length > 0) {
            setShowAutocomplete(true);
          } else {
            setShowAutocomplete(false);
          }
          
          // Também manter searchResults para compatibilidade
          setSearchResults(results.map(r => ({
            categoryId: r.id,
            parentId: null,
            name: r.name,
            slug: r.slug,
            description: null,
            level: r.level,
            path: r.path,
            createdAt: '',
            updatedAt: '',
          })));
        } catch (err: any) {
          // DIAGNÓSTICO: Log erro completo
          console.error('[ProfileProfessional] ERRO:', {
            message: err?.message,
            code: err?.code,
            stack: err?.stack
          });
          
          // REGRA CLARA: Erro ≠ ausência de dado
          // Mostrar erro real, não fingir que não há resultados
          const errorMessage = err?.message || 'Erro ao buscar sugestões. Verifique sua conexão e tente novamente.';
          setAutocompleteError(errorMessage);
          setAutocompleteResults([]);
          setSearchResults([]);
          setShowAutocomplete(false);
        } finally {
          setIsSearching(false);
        }
      }, 300);
      
      setSearchTimeout(timeout);
    } else {
      // Se termo está vazio, limpar resultados
      setAutocompleteResults([]);
      setSearchResults([]);
      setShowAutocomplete(false);
      setAutocompleteError(null);
      setIsSearching(false);
    }
  };

  const handleSelectAutocomplete = (result: CategoryAutocompleteResult) => {
    // Validar que é uma profissão (nível 2)
    if (result.level !== 2) {
      setSearchFieldError('Por favor, selecione uma profissão específica da lista.');
      return;
    }

    // Converter para Category e adicionar como skill
    const category: Category = {
      categoryId: result.id,
      parentId: null,
      name: result.name,
      slug: result.slug,
      description: null,
      level: result.level,
      path: result.path,
      createdAt: '',
      updatedAt: '',
    };
    
    addSkill(category);
    setSearchTerm('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    setSearchFieldError(null); // Limpar erro ao selecionar
  };

  const handleSuggestCategory = async () => {
    if (!searchTerm.trim()) {
      setSuggestionError('Digite o nome da profissão que deseja sugerir');
      return;
    }

    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const suggestion = await suggestCategoryPath(searchTerm.trim(), 'professional' as CategoryContext);
      setCategorySuggestion(suggestion);
      setShowSuggestionModal(true);
    } catch (err) {
      console.error('Erro ao sugerir categoria:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao sugerir categoria';
      setSuggestionError(errorMessage);
      // Se for erro de validação, mostrar no modal também
      if (errorMessage.includes('não permitido') || errorMessage.includes('inválido')) {
        alert(errorMessage);
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCreateWithAI = async (parentId?: string | null) => {
    if (!searchTerm.trim()) {
      alert('Digite ou fale o nome da categoria que deseja criar');
      return;
    }

    setIsCreatingWithAI(true);
    try {
      const result = await createCategoryWithAI(searchTerm.trim(), 'professional' as CategoryContext, parentId);
      
      if (result.created && result.category) {
        // Fechar modal
        setShowSuggestionModal(false);
        setCategorySuggestion(null);
        
        // Mostrar feedback claro sobre aprovação
        if (result.requiresApproval) {
          // FASE 3.8: Mensagem específica para REVIEW
          alert(`📋 ${result.message || `Sua sugestão "${result.category.name}" foi enviada para análise!\n\nA profissão será revisada e poderá aparecer no sistema em breve.`}`);
        } else {
          alert(`✅ Categoria "${result.category.name}" criada com sucesso!`);
        }
        
        // Recarregar árvore de categorias
        const tree = await getCategoryTree();
        setCategoryTree(tree);
        
        // Adicionar automaticamente se for nível 2 (profissão) e já aprovada
        if (result.category.level === 2 && !result.requiresApproval) {
          addSkill(result.category);
        } else {
          // Se não for profissão ou precisa aprovação, fazer busca para encontrar
          await handleSearch(searchTerm);
        }
        setSearchTerm('');
      } else if (result.existingCategory) {
        setShowSuggestionModal(false);
        setCategorySuggestion(null);
        alert(`Categoria "${result.existingCategory.name}" já existe!`);
        // Adicionar automaticamente se for nível 2
        if (result.existingCategory.level === 2) {
          addSkill(result.existingCategory);
        } else {
          await handleSearch(searchTerm);
        }
        setSearchTerm('');
      }
    } catch (err) {
      console.error('Erro ao criar categoria via IA:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria via IA';
      
      // FASE 3.8: Mensagens específicas para política de admissão
      if (errorMessage.includes('❌')) {
        // Erro de bloqueio da política
        alert(`🚫 ${errorMessage.replace('❌ ', '')}\n\nEste termo não pode ser cadastrado como profissão.`);
      } else if (errorMessage.includes('não permitido') || errorMessage.includes('inválido') || errorMessage.includes('Tags HTML') || errorMessage.includes('URLs')) {
        alert(`❌ ${errorMessage}\n\nPor favor, use apenas letras, espaços e hífens.`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setIsCreatingWithAI(false);
    }
  };

  const startRecording = () => {
    if (!recognition) {
      alert('Reconhecimento de voz não está disponível no seu navegador');
      return;
    }

    setIsRecording(true);
    recognition.start();
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
      setIsRecording(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const isSkillSelected = (categoryId: string): boolean => {
    return selectedSkills.some((s) => s.categoryId === categoryId);
  };

  const addSkill = (category: Category) => {
    if (isSkillSelected(category.categoryId)) {
      return;
    }

    // Só permite adicionar profissões (nível 2 = terceiro nível na hierarquia)
    // Nível 0 = Grande área, Nível 1 = Subcategoria, Nível 2 = Profissão
    if (category.level !== 2) {
      alert('Por favor, selecione uma profissão específica. Navegue pelas subcategorias para encontrar profissões.');
      return;
    }

    const newSkill: SelectedSkill = {
      categoryId: category.categoryId,
      categoryName: category.name,
      categoryPath: category.path,
      skillLevel: 3, // Default: intermediário
      yearsExperience: 0,
      hourlyRate: null, // Valor será definido pelo usuário
      pricingType: 'hourly', // Default: cobrança por hora
      serviceType: 'service', // Default: serviço
      chargeVisit: false, // Default: não cobra visita
      visitPrice: null,
      predefinedServices: [], // Sem serviços pré-definidos inicialmente
      comboDiscountRules: [], // Sem regras de desconto inicialmente
    };

    setSelectedSkills([...selectedSkills, newSkill]);
    setSearchTerm('');
    setSearchResults([]);
    setSearchFieldError(null); // Limpar erro ao adicionar profissão
    
    // Marcar como recém-adicionado para destacar e focar no campo de taxa horária
    setNewlyAddedSkillId(category.categoryId);
    
    // Focar no campo de taxa horária após um pequeno delay para garantir renderização
    setTimeout(() => {
      const hourlyRateInput = document.getElementById(`hourly-rate-${category.categoryId}`) as HTMLInputElement;
      if (hourlyRateInput) {
        hourlyRateInput.focus();
        hourlyRateInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Remover o destaque após alguns segundos
      setTimeout(() => {
        setNewlyAddedSkillId(null);
      }, 3000);
    }, 100);
  };

  const removeSkill = (categoryId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.categoryId !== categoryId));
  };

  const updateSkill = (categoryId: string, field: 'skillLevel' | 'yearsExperience' | 'hourlyRate' | 'pricingType' | 'serviceType' | 'chargeVisit' | 'visitPrice', value: number | null | PricingType | ServiceType | boolean) => {
    const updated = selectedSkills.map((s) =>
      s.categoryId === categoryId ? { ...s, [field]: value } : s
    );
    setSelectedSkills(updated);

    // Validação em tempo real
    const skill = updated.find(s => s.categoryId === categoryId);
    if (skill) {
      if (field === 'hourlyRate' && value !== null && typeof value === 'number') {
        const validation = validateMonetaryValue(value);
        if (!validation.valid) {
          setSkillErrors({ ...skillErrors, [categoryId]: validation.error || 'Valor inválido' });
          return;
        }
      }
      
      if (field === 'yearsExperience' && typeof value === 'number') {
        const validation = validateYearsExperience(value, userAge);
        if (!validation.valid) {
          setSkillErrors({ ...skillErrors, [categoryId]: validation.error || 'Anos de experiência inválidos' });
          return;
        }
      }
      
      // Remover erro se validação passou
      const newErrors = { ...skillErrors };
      delete newErrors[categoryId];
      setSkillErrors(newErrors);
    }
  };

  const renderCategoryTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.categoryId);
      const isSelected = isSkillSelected(category.categoryId);
      const pathDisplay = category.path.length > 0 
        ? category.path.join(' > ') + ' > ' + category.name
        : category.name;

      return (
        <div key={category.categoryId} className="category-item" style={{ paddingLeft: `${level * 1.5}rem` }}>
          <div className="category-header">
            {hasChildren && (
              <button
                className="expand-button"
                onClick={() => toggleCategory(category.categoryId)}
                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span className="expand-spacer" />}
            <span className="category-name" title={pathDisplay}>
              {category.name}
            </span>
            {isSelected ? (
              <span className="skill-badge selected">✓ Selecionada</span>
            ) : category.level === 2 ? (
              <button
                className="add-skill-button"
                onClick={() => addSkill(category)}
                title={`Adicionar ${category.name}`}
              >
                + Adicionar
              </button>
            ) : (
              <span className="category-hint">Navegue para ver profissões</span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="category-children">
              {renderCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSkillErrors({});
    setSearchFieldError(null);

    // Validações antes de salvar
    const errors: string[] = [];
    const newSkillErrors: Record<string, string> = {};

    // VALIDAÇÃO OBRIGATÓRIA: Pelo menos uma profissão deve estar selecionada
    if (selectedSkills.length === 0) {
      setError('Selecione pelo menos uma profissão da lista antes de salvar.');
      setIsSaving(false);
      return;
    }

    // VALIDAÇÃO: Se há texto no campo de busca mas nenhuma profissão selecionada, bloquear
    if (searchTerm.trim().length > 0 && selectedSkills.length === 0) {
      setSearchFieldError('Selecione uma profissão da lista. Não é possível salvar apenas texto digitado.');
      setError('Selecione uma profissão da lista antes de salvar.');
      setIsSaving(false);
      return;
    }

    // Validar skills
    for (const skill of selectedSkills) {
      if (skill.hourlyRate !== null && (skill.pricingType === 'hourly' || skill.pricingType === 'daily' || skill.pricingType === 'weekly' || skill.pricingType === 'monthly')) {
        const valueValidation = validateMonetaryValue(skill.hourlyRate);
        if (!valueValidation.valid) {
          newSkillErrors[skill.categoryId] = valueValidation.error || 'Valor inválido';
          const pricingLabel = skill.pricingType === 'hourly' ? 'hora' : skill.pricingType === 'daily' ? 'dia' : skill.pricingType === 'weekly' ? 'semana' : 'mês';
          errors.push(`Valor por ${pricingLabel} de ${skill.categoryName}`);
        }
      }

      const yearsValidation = validateYearsExperience(skill.yearsExperience, userAge);
      if (!yearsValidation.valid) {
        newSkillErrors[skill.categoryId] = yearsValidation.error || 'Anos de experiência inválidos';
        errors.push(`Anos de experiência de ${skill.categoryName}`);
      }
    }

    // Validar educação
    for (let i = 0; i < education.length; i++) {
      const edu = education[i];
      const eduValidation = validateEducationEntry(edu);
      if (!eduValidation.valid) {
        errors.push(`Formação ${i + 1}: ${eduValidation.errors.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      setSkillErrors(newSkillErrors);
      setError(`Por favor, corrija os seguintes erros: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      setIsSaving(false);
      return;
    }

    try {
      // Sanitizar dados antes de enviar
      const sanitizedBio = bio ? sanitizeText(bio, 5000) : null;
      
      const sanitizedEducation = education.map((edu) => ({
        educationId: edu.educationId,
        level: edu.level,
        institution: sanitizeString(edu.institution, 200),
        course: edu.course ? sanitizeString(edu.course, 200) : undefined,
        field: edu.field ? sanitizeString(edu.field, 200) : undefined,
        startDate: edu.startDate,
        endDate: edu.endDate,
        isCompleted: edu.isCompleted,
        description: edu.description ? sanitizeText(edu.description, 1000) : undefined,
      }));

      const sanitizedSkills = selectedSkills.map((s) => ({
        categoryId: s.categoryId,
        skillLevel: s.skillLevel,
        yearsExperience: s.yearsExperience,
        hourlyRate: s.hourlyRate,
        pricingType: s.pricingType,
        serviceType: s.serviceType,
        chargeVisit: s.chargeVisit,
        visitPrice: s.visitPrice,
        predefinedServices: s.predefinedServices.map(ps => ({
          serviceId: ps.serviceId,
          name: ps.name,
          description: ps.description,
          basePrice: ps.basePrice,
          discountPercentage: ps.discountPercentage,
          isActive: ps.isActive,
        })),
        comboDiscountRules: s.comboDiscountRules.map(rule => ({
          ruleId: rule.ruleId,
          minServices: rule.minServices,
          discountPercentage: rule.discountPercentage,
          description: rule.description,
          isActive: rule.isActive,
        })),
      }));

      await updateProfessionalProfile({
        skills: sanitizedSkills,
        education: sanitizedEducation,
        bio: sanitizedBio,
        availability: availability,
      });

      alert('Perfil profissional atualizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-professional">
        <h2>Informações Profissionais</h2>
        <div className="loading">Carregando categorias...</div>
      </div>
    );
  }

  return (
    <div className="profile-professional">
      <h2>Informações Profissionais</h2>

      {error && <div className="error-message">{error}</div>}
      
      <p className="section-description">
        Configure primeiro sua agenda unificada, depois adicione suas profissões e configure como deseja trabalhar.
      </p>

      {/* Agenda Unificada - PRIMEIRO */}
      <div className="availability-section-first">
        <h3>📅 Agenda Unificada (Configure Primeiro)</h3>
        <p className="section-hint">
          Sua agenda é unificada para todas as profissões. Quando você bloqueia um horário, ele fica indisponível para todas as suas profissões.
        </p>
        <AvailabilityScheduleComponent
          availability={availability}
          onChange={(newAvailability) => setAvailability(newAvailability)}
        />
      </div>

      <div className="section-divider"></div>

      {/* Busca Inteligente com Autocomplete */}
      <div className="search-section">
        <label htmlFor="category-search">
          Buscar e Selecionar Profissão <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          Digite o nome da profissão e selecione uma opção da lista. Não é possível salvar apenas texto digitado.
        </p>
        <div className="search-input-wrapper">
          <input
            id="category-search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              handleSearch(value);
              // Limpar erro quando usuário começar a digitar novamente
              if (searchFieldError && value.trim().length > 0) {
                setSearchFieldError(null);
              }
            }}
            onFocus={() => {
              if (searchTerm.length >= 1 && autocompleteResults.length > 0) {
                setShowAutocomplete(true);
              } else if (searchTerm.length >= 2) {
                // Se tem 2+ caracteres, buscar e mostrar
                handleSearch(searchTerm);
              }
            }}
            onBlur={() => {
              // Delay para permitir clique no dropdown
              setTimeout(() => {
                setShowAutocomplete(false);
                // Validar se há texto mas nenhuma seleção
                if (searchTerm.trim().length > 0 && selectedSkills.length === 0) {
                  setSearchFieldError('Selecione uma profissão da lista.');
                }
              }, 200);
            }}
            onKeyPress={(e) => {
              // Bloquear Enter se não houver seleção válida
              if (e.key === 'Enter') {
                e.preventDefault();
                if (autocompleteResults.length > 0) {
                  // Se há resultados, selecionar o primeiro
                  handleSelectAutocomplete(autocompleteResults[0]);
                } else if (searchTerm.trim().length >= 2 && !isSearching) {
                  // Se não há resultados mas tem texto, sugerir criação
                  handleSuggestCategory();
                } else {
                  setSearchFieldError('Selecione uma profissão da lista.');
                }
              }
            }}
            placeholder="Busque e selecione uma profissão da lista..."
            className={`search-input ${searchFieldError ? 'error' : ''}`}
            autoComplete="off"
          />
          <div className="search-actions">
            {/* FEATURE FLAG: Microfone apenas para usuários PRO/Enterprise */}
            {aiAssistEnabled && recognition && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`mic-button ${isRecording ? 'recording' : ''}`}
                title={isRecording ? 'Parar gravação' : 'Falar (Recurso PRO)'}
              >
                🎤
              </button>
            )}
            {!aiAssistEnabled && (
              <button
                type="button"
                className="mic-button"
                disabled
                title="Recurso disponível apenas na versão PRO"
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                🎤
              </button>
            )}
            {isSearching && <span className="search-loading">Buscando...</span>}
            {isCreatingWithAI && <span className="search-loading">Criando com IA...</span>}
          </div>
          
          {/* Dropdown de Autocomplete - CORRIGIDO: z-index alto e posicionamento */}
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className="autocomplete-dropdown">
              {autocompleteResults.map((result) => (
                <div
                  key={result.id}
                  className="autocomplete-item"
                  onClick={() => handleSelectAutocomplete(result)}
                  onMouseDown={(e) => e.preventDefault()} // Prevenir blur antes do clique
                >
                  <div className="autocomplete-item-name">{result.name}</div>
                  <div className="autocomplete-item-path">{result.fullPathLabel}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Mensagem de erro do autocomplete */}
        {autocompleteError && (
          <div className="autocomplete-error" style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '0.375rem',
            color: '#dc2626',
            fontSize: '0.875rem'
          }}>
            <strong>⚠️ Erro ao buscar autocomplete:</strong> {autocompleteError}
            <br />
            <small>Verifique sua conexão, tenant ID e tente novamente.</small>
          </div>
        )}

        {/* Mensagem de erro de validação do campo de busca */}
        {searchFieldError && (
          <div className="search-field-error" style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '0.375rem',
            color: '#92400e',
            fontSize: '0.875rem'
          }}>
            <strong>⚠️ {searchFieldError}</strong>
          </div>
        )}

        {/* REGRA FINAL: Mostrar "Sugerir Profissão" APENAS se:
            - Termo tem 2+ caracteres
            - NÃO houve erro (erro ≠ ausência de dado)
            - Autocomplete retornou 0 resultados (legítimos)
            - NÃO está buscando
            - NÃO está mostrando dropdown
            CRÍTICO: Se há erro, mostrar erro. Não sugerir criação quando há problema de rede/auth. */}
        {searchTerm.trim().length >= 2 && 
         !autocompleteError && 
         autocompleteResults.length === 0 && 
         !isSearching && 
         !showAutocomplete && (
          <div className="ai-create-suggestion">
            <p>Nenhuma profissão encontrada para "{searchTerm}"</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Não encontrou sua profissão? Solicite a inclusão abaixo.
            </p>
            <button
              type="button"
              onClick={handleSuggestCategory}
              disabled={isSuggesting || isCreatingWithAI}
              className="ai-create-button"
            >
              {isSuggesting ? 'Analisando...' : '📋 Solicitar Inclusão'}
            </button>
            {suggestionError && (
              <p className="error-message" style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {suggestionError}
              </p>
            )}
          </div>
        )}

        {/* Ocultar search-results antigo se autocomplete estiver ativo */}
        {searchResults.length > 0 && !showAutocomplete && (
          <div className="search-results">
            {searchResults
              .filter((category) => category.level === 2) // Só mostra profissões (nível 2)
              .map((category) => {
                const pathDisplay = category.path.length > 0
                  ? category.path.join(' > ') + ' > ' + category.name
                  : category.name;
                const isSelected = isSkillSelected(category.categoryId);

                return (
                  <div
                    key={category.categoryId}
                    className={`search-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => !isSelected && addSkill(category)}
                  >
                    <div className="result-path">{pathDisplay}</div>
                    {isSelected ? (
                      <span className="skill-badge">✓ Já adicionada</span>
                    ) : (
                      <button className="add-button-small">+ Adicionar</button>
                    )}
                  </div>
                );
              })}
            {searchResults.filter((c) => c.level === 2).length === 0 && searchResults.length > 0 && (
              <div className="search-no-results">
                <p>Nenhuma profissão encontrada. Tente buscar por termos mais específicos.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Árvore de Categorias */}
      {categoryTree.length > 0 && (
        <div className="categories-section">
          <h3>Ou navegue pelas categorias:</h3>
          <div className="category-tree">
            {renderCategoryTree(categoryTree)}
          </div>
        </div>
      )}
      
      {categoryTree.length === 0 && !isLoading && (
        <div className="empty-state">
          <p>Nenhuma categoria disponível no momento.</p>
          <p className="empty-hint">Tente usar a busca acima para encontrar profissões.</p>
        </div>
      )}

      {/* Skills Selecionadas */}
      {selectedSkills.length > 0 && (
        <div className="selected-skills-section">
          <h3>Suas Profissões e Habilidades ({selectedSkills.length})</h3>
          <div className="selected-skills-list">
            {selectedSkills.map((skill) => {
              const isNewlyAdded = newlyAddedSkillId === skill.categoryId;
              return (
                <div 
                  key={skill.categoryId} 
                  className={`selected-skill-card ${isNewlyAdded ? 'newly-added' : ''}`}
                >
                  <div className="skill-header">
                    <div className="skill-info">
                      <h4>{skill.categoryName}</h4>
                      <p className="skill-path">{skill.categoryPath.join(' > ')}</p>
                    </div>
                    <button
                      className="remove-skill-button"
                      onClick={() => removeSkill(skill.categoryId)}
                      title="Remover"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="skill-fields">
                    <div className="skill-field">
                      <label>Nível de Proficiência</label>
                      <select
                        value={skill.skillLevel}
                        onChange={(e) =>
                          updateSkill(skill.categoryId, 'skillLevel', parseInt(e.target.value))
                        }
                      >
                        <option value={1}>Iniciante</option>
                        <option value={2}>Básico</option>
                        <option value={3}>Intermediário</option>
                        <option value={4}>Avançado</option>
                        <option value={5}>Expert</option>
                      </select>
                    </div>
                    <div className="skill-field">
                      <label>Anos de Experiência</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={skill.yearsExperience}
                        onChange={(e) =>
                          updateSkill(skill.categoryId, 'yearsExperience', parseInt(e.target.value) || 0)
                        }
                        className={skillErrors[skill.categoryId]?.includes('experiência') ? 'error' : ''}
                      />
                      {skillErrors[skill.categoryId]?.includes('experiência') && (
                        <span className="field-error">{skillErrors[skill.categoryId]}</span>
                      )}
                      {userAge && (
                        <p className="field-hint">Máximo recomendado: {Math.max(0, userAge - 16)} anos</p>
                      )}
                    </div>
                    <div className="skill-field">
                      <label>Tipo: Serviço ou Produto *</label>
                      <select
                        value={skill.serviceType}
                        onChange={(e) =>
                          updateSkill(skill.categoryId, 'serviceType', e.target.value as ServiceType)
                        }
                      >
                        <option value="service">Serviço</option>
                        <option value="product">Produto</option>
                      </select>
                      <p className="field-hint">
                        {skill.serviceType === 'service'
                          ? 'Você presta um serviço (ex: conserto, instalação, limpeza)'
                          : 'Você vende um produto físico'}
                      </p>
                    </div>

                    {skill.serviceType === 'service' && (
                      <>
                        <div className="skill-field">
                          <label>Tipo de Cobrança *</label>
                          <select
                            value={skill.pricingType}
                            onChange={(e) =>
                              updateSkill(skill.categoryId, 'pricingType', e.target.value as PricingType)
                            }
                          >
                            <option value="hourly">Cobrança por Hora</option>
                            <option value="daily">Cobrança por Dia</option>
                            <option value="weekly">Cobrança por Semana</option>
                            <option value="monthly">Cobrança por Mês</option>
                            <option value="quote">Solicitar Orçamento Primeiro</option>
                          </select>
                          <p className="field-hint">
                            {skill.pricingType === 'hourly'
                              ? 'Você cobra um valor fixo por hora trabalhada'
                              : skill.pricingType === 'daily'
                              ? 'Você cobra um valor fixo por dia trabalhado'
                              : skill.pricingType === 'weekly'
                              ? 'Você cobra um valor fixo por semana trabalhada'
                              : skill.pricingType === 'monthly'
                              ? 'Você cobra um valor fixo por mês trabalhado'
                              : 'Você precisa fazer um orçamento antes de aceitar o serviço'}
                          </p>
                        </div>

                        {(skill.pricingType === 'hourly' || skill.pricingType === 'daily' || skill.pricingType === 'weekly' || skill.pricingType === 'monthly') && (
                          <div className={`skill-field ${isNewlyAdded ? 'highlight-field' : ''}`}>
                            <label>
                              {skill.pricingType === 'hourly' && 'Valor por Hora (R$)'}
                              {skill.pricingType === 'daily' && 'Valor por Dia (R$)'}
                              {skill.pricingType === 'weekly' && 'Valor por Semana (R$)'}
                              {skill.pricingType === 'monthly' && 'Valor por Mês (R$)'}
                              {isNewlyAdded && <span className="required-indicator"> *</span>}
                            </label>
                            <input
                              id={`hourly-rate-${skill.categoryId}`}
                              type="number"
                              step="0.01"
                              min="0"
                              max="999999.99"
                              value={skill.hourlyRate || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseFloat(e.target.value) : null;
                                updateSkill(skill.categoryId, 'hourlyRate', value);
                              }}
                              placeholder="0.00"
                              className={skillErrors[skill.categoryId]?.includes('Valor') ? 'error' : ''}
                              required={isNewlyAdded}
                            />
                            {skillErrors[skill.categoryId]?.includes('Valor') && (
                              <span className="field-error">{skillErrors[skill.categoryId]}</span>
                            )}
                            <p className="field-hint">
                              {isNewlyAdded 
                                ? `💡 Defina o valor ${skill.pricingType === 'hourly' ? 'por hora' : skill.pricingType === 'daily' ? 'por dia' : skill.pricingType === 'weekly' ? 'por semana' : 'por mês'} para esta profissão. Ex: cortador de grama pode ter um valor diferente de manicure.`
                                : `Valor específico para esta profissão (máx: R$ 999.999,99)`
                              }
                            </p>
                          </div>
                        )}

                        {skill.pricingType === 'quote' && (
                          <div className="skill-field">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={skill.chargeVisit}
                                onChange={(e) => {
                                  updateSkill(skill.categoryId, 'chargeVisit', e.target.checked);
                                  if (!e.target.checked) {
                                    updateSkill(skill.categoryId, 'visitPrice', null);
                                  }
                                }}
                              />
                              <span>Cobrar pela visita para fazer orçamento</span>
                            </label>
                            {skill.chargeVisit && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <label>Preço da Visita (R$)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="999999.99"
                                  value={skill.visitPrice || ''}
                                  onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : null;
                                    updateSkill(skill.categoryId, 'visitPrice', value);
                                  }}
                                  placeholder="0.00"
                                />
                                <p className="field-hint">
                                  Valor que você cobra pela visita para fazer o orçamento. O mercado é livre - você decide se cobra ou não.
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Serviços Pré-definidos */}
                        <div className="predefined-services-wrapper">
                          <PredefinedServicesManager
                            services={skill.predefinedServices}
                            onChange={(newServices) => {
                              const updated = selectedSkills.map((s) =>
                                s.categoryId === skill.categoryId
                                  ? { ...s, predefinedServices: newServices }
                                  : s
                              );
                              setSelectedSkills(updated);
                            }}
                            categoryName={skill.categoryName}
                          />
                        </div>

                        {/* Regras de Desconto para Combos */}
                        <div className="combo-discount-rules-wrapper">
                          <ComboDiscountRulesManager
                            rules={skill.comboDiscountRules}
                            onChange={(newRules) => {
                              const updated = selectedSkills.map((s) =>
                                s.categoryId === skill.categoryId
                                  ? { ...s, comboDiscountRules: newRules }
                                  : s
                              );
                              setSelectedSkills(updated);
                            }}
                            categoryName={skill.categoryName}
                          />
                        </div>
                      </>
                    )}

                    {skill.serviceType === 'product' && (
                      <div className="skill-field">
                        <p className="field-hint">
                          Para produtos, você pode definir preços específicos quando criar anúncios ou ofertas.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formação e Educação */}
      <div className="education-section-wrapper">
        <EducationSection
          education={education}
          onChange={(newEducation) => setEducation(newEducation)}
        />
      </div>

      {/* Bio */}
      <div className="additional-info-section">
        <h3>Informações Adicionais</h3>
        <div className="form-group">
          <label htmlFor="bio">Biografia Profissional</label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Descreva sua experiência profissional, especialidades, etc."
            rows={4}
          />
        </div>
      </div>

      {/* Botão Salvar */}
      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Salvando...' : 'Salvar Perfil Profissional'}
        </button>
      </div>

      {/* Modal de Sugestão de Categoria */}
      {showSuggestionModal && categorySuggestion && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sugerir Nova Profissão</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowSuggestionModal(false);
                  setCategorySuggestion(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="suggestion-info">
                <p className="suggestion-text">
                  <strong>Profissão sugerida:</strong> "{categorySuggestion.leafName}"
                </p>
                
                {categorySuggestion.suggestedRoot && categorySuggestion.suggestedParent && (
                  <div className="suggestion-path">
                    <p className="path-label">Caminho sugerido:</p>
                    <div className="path-display">
                      <span className="path-root">{categorySuggestion.suggestedRoot.name}</span>
                      <span className="path-separator">›</span>
                      <span className="path-parent">{categorySuggestion.suggestedParent.name}</span>
                      <span className="path-separator">›</span>
                      <span className="path-leaf">{categorySuggestion.leafName}</span>
                    </div>
                  </div>
                )}

                {categorySuggestion.leafDescription && (
                  <p className="suggestion-description">
                    {categorySuggestion.leafDescription}
                  </p>
                )}

                <div className="suggestion-confidence">
                  <p>
                    <strong>Confiança da análise:</strong>{' '}
                    <span className={`confidence-badge ${categorySuggestion.confidence >= 0.6 ? 'high' : 'low'}`}>
                      {Math.round(categorySuggestion.confidence * 100)}%
                    </span>
                  </p>
                </div>

                {categorySuggestion.requiresReview && (
                  <div className="review-warning">
                    <p>⚠️ Esta sugestão requer revisão manual antes de ser aprovada.</p>
                  </div>
                )}

                <div className="approval-info">
                  <p>
                    <strong>📋 Importante:</strong>
                  </p>
                  <ul>
                    <li>A profissão <strong>não aparecerá imediatamente</strong> no sistema</li>
                    <li>Ela será <strong>revisada pela equipe</strong> antes da aprovação</li>
                    <li>Você receberá uma notificação quando for aprovada</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowSuggestionModal(false);
                  setCategorySuggestion(null);
                }}
                disabled={isCreatingWithAI}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleCreateWithAI(categorySuggestion.suggestedParent?.id || null)}
                disabled={isCreatingWithAI}
              >
                {isCreatingWithAI ? 'Enviando...' : '✓ Enviar para Aprovação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

