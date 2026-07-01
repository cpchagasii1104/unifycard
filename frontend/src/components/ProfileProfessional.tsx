// src/components/ProfileProfessional.tsx
// Componente de perfil profissional com seleção hierárquica de categorias

import { useState, useEffect, useRef } from 'react';
import { CategoryContext } from '@unificard/contracts';
import {
  autocompleteCategories,
  getCategoryTree,
  getCategoryChildren,
  createCategoryWithAI,
  suggestCategoryPath,
  type Category,
  type CategoryTree,
  type CategoryAutocompleteResult,
  type CategoryPathSuggestion,
} from '../api/categories';
import {
  updateProfessionalBioC1,
  declareProfessionalConceptC1,
  updateProfessionalConceptC1,
  retireProfessionalConceptC1,
  searchProfessionalConceptCandidates,
  type ProfessionalConceptCandidate,
} from '../api/professionalC1';
import type { ProfessionalInitialSnapshot } from '../hooks/useProfessionalCategories';
import { type UserPlan } from '../config/features';
import {
  sanitizeText,
  validateYearsExperience,
} from '../utils/validation';
import { normalizeCategoryLabel, normalizeCategoryPath } from '../utils/categoryLabelNormalizer';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import { useProfileProfessionalState } from '../hooks/useProfileProfessionalState';
import { useProfessionalCategories } from '../hooks/useProfessionalCategories';
import ProfileProfessionalForm from './ProfileProfessionalForm';
import './ProfileProfessional.css';

// A3.2 tab-only / C1: aba Profissional declara competências por CONCEPT (sem preço/serviço/availability).
interface SelectedSkill {
  categoryId: string;              // chave de UI/dedupe (= categoria L2 selecionada)
  conceptId: string;               // identidade semântica/CONCEPT (declaração C1)
  sourceCategoryId: string | null; // breadcrumb de navegação
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
}

export default function ProfileProfessional() {
  const { sessionReady, activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="profissional" />;
  }
  
  // Estados extraídos para hook
  const state = useProfileProfessionalState();
  const {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    autocompleteResults,
    setAutocompleteResults,
    showAutocomplete,
    setShowAutocomplete,
    isSearching,
    setIsSearching,
    autocompleteError,
    setAutocompleteError,
    isCreatingWithAI,
    setIsCreatingWithAI,
    isRecording,
    setIsRecording,
    selectedSkills,
    setSelectedSkills,
    expandedCategories,
    setExpandedCategories,
    bio,
    setBio,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    skillErrors,
    setSkillErrors,
    newlyAddedSkillId,
    setNewlyAddedSkillId,
    searchFieldError,
    setSearchFieldError,
    loadingChildren,
    setLoadingChildren,
  } = state;

  // F-SERVICE-PROFESSIONAL-CAPABILITY-ALIAS-SELECTOR-SLICE-A — fallback advisory quando a busca de
  // CATEGORIA não entende o termo humano ("barbeiro"): a ponte de alias projeta concept(s) candidatos.
  // Estado LOCAL (não persiste, não é verdade) — o usuário desambigua e escolhe 1; nada auto-declara.
  const [aliasConceptResults, setAliasConceptResults] = useState<ProfessionalConceptCandidate[]>([]);
  const [aliasSearching, setAliasSearching] = useState(false);

  // Feature flag para microfone (versão paga)
  const [_userPlan, setUserPlan] = useState<UserPlan>('free');
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategoryPathSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number | undefined>(undefined);

  // 🔴 Guard para evitar chamadas duplicadas (React.StrictMode em DEV)
  const hasLoadedRef = useRef(false);

  // Snapshot inicial do C1 (para o save granular: novo/alterado/removido).
  const [initialSnapshot, setInitialSnapshot] = useState<ProfessionalInitialSnapshot>({ concepts: [], bio: '' });

  // Hook de categorias
  const {
    categoryTree,
    setCategoryTree,
    filterProfessionalCategories,
    loadData: loadCategoriesData,
    findCategoryById,
    updateTreeWithChildren,
  } = useProfessionalCategories(setIsLoading, setError, setBio, setSelectedSkills, setInitialSnapshot);

  useEffect(() => {
    // GUARD: Não fazer chamadas de API antes de sessionReady
    if (!sessionReady) {
      setIsLoading(false);
      return;
    }
    // 🔴 Executar apenas uma vez no mount real (não em hidratação duplicada)
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    loadCategoriesData();
    
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
  }, [sessionReady, aiAssistEnabled]); // Re-executar quando sessionReady mudar para true

  // REMOVIDO: filterProfessionalCategories e loadData movidos para useProfessionalCategories hook

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
      setAliasConceptResults([]);
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
            // Categoria entendeu o termo → não precisa da ponte de alias.
            setAliasConceptResults([]);
          } else {
            setShowAutocomplete(false);
            // Fallback advisory: a taxonomia de CATEGORIA não entende "barbeiro", mas a ponte de alias
            // pode apontar concept(s). READ-ONLY, só projeta candidatos p/ o usuário ESCOLHER (nada
            // é declarado aqui). Miss → [] honesto (aí o bloco "Solicitar Inclusão" reaparece).
            if (term.trim().length >= 2) {
              try {
                setAliasSearching(true);
                const candidates = await searchProfessionalConceptCandidates(term.trim());
                setAliasConceptResults(candidates);
              } catch (aliasErr) {
                console.warn('[ProfileProfessional] alias concept-search falhou:', aliasErr);
                setAliasConceptResults([]);
              } finally {
                setAliasSearching(false);
              }
            } else {
              setAliasConceptResults([]);
            }
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
          // Tratar erro 429 (rate limit) silenciosamente - não quebrar UI
          if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
            console.warn('[ProfileProfessional] Rate limit atingido no autocomplete');
            setAutocompleteResults([]);
            setSearchResults([]);
            setShowAutocomplete(false);
            setAliasConceptResults([]);
            setAutocompleteError(null); // Não mostrar erro para rate limit
            setIsSearching(false);
            return;
          }
          
          // DIAGNÓSTICO: Log erro completo (apenas para erros reais)
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
          setAliasConceptResults([]);
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

    // Converter para Category e adicionar como skill (conceptId vem do backend, não inventado).
    const category: Category = {
      categoryId: result.id,
      parentId: null,
      name: result.name,
      slug: result.slug,
      description: null,
      level: result.level,
      path: result.path,
      conceptId: result.conceptId ?? null,
      createdAt: '',
      updatedAt: '',
    };

    addSkill(category);
    setSearchTerm('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    setAliasConceptResults([]);
    setSearchFieldError(null); // Limpar erro ao selecionar
  };

  // F-SERVICE-PROFESSIONAL-CAPABILITY-ALIAS-SELECTOR-SLICE-A — DESAMBIGUAÇÃO: o usuário escolheu
  // EXATAMENTE 1 concept candidato vindo da ponte de alias. NUNCA first-match, NUNCA declara N: só
  // dispara ao clique. O concept_id continua sendo a identidade; sourceCategoryId=null (veio de alias,
  // não de navegação por categoria). Persistência real acontece no handleSave (POST declareConcept)
  // sob a autoridade do fluxo existente — alias NÃO concede permissão.
  const addSkillFromConcept = (candidate: ProfessionalConceptCandidate) => {
    // Dedupe por conceptId (identidade), não por categoryId sintético.
    if (selectedSkills.some((s) => s.conceptId === candidate.conceptId)) {
      setSearchTerm('');
      setAliasConceptResults([]);
      setSearchFieldError(null);
      return;
    }
    const label = candidate.displayName ?? candidate.slug;
    const syntheticKey = `concept:${candidate.conceptId}`; // chave de UI (sem categoria de origem)
    const newSkill: SelectedSkill = {
      categoryId: syntheticKey,
      conceptId: candidate.conceptId,
      sourceCategoryId: null, // origem = alias, não navegação de categoria → sem breadcrumb
      categoryName: label,
      categoryPath: [],
      skillLevel: 3, // Default: intermediário (igual ao fluxo de categoria)
      yearsExperience: 0,
    };
    setSelectedSkills([...selectedSkills, newSkill]);
    setSearchTerm('');
    setSearchResults([]);
    setAliasConceptResults([]);
    setSearchFieldError(null);
    setNewlyAddedSkillId(syntheticKey);
    setTimeout(() => setNewlyAddedSkillId(null), 3000);
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
          alert(`📋 ${result.message || `Sua sugestão "${normalizeCategoryLabel(result.category.name)}" foi enviada para análise!\n\nA profissão será revisada e poderá aparecer no sistema em breve.`}`);
        } else {
          alert(`✅ Categoria "${normalizeCategoryLabel(result.category.name)}" criada com sucesso!`);
        }
        
        // Recarregar árvore de categorias
        const tree = await getCategoryTree('professional');
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
        alert(`Categoria "${normalizeCategoryLabel(result.existingCategory.name)}" já existe!`);
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

  const toggleCategory = async (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
      setExpandedCategories(newExpanded);
    } else {
      newExpanded.add(categoryId);
      setExpandedCategories(newExpanded);

      // 🔴 CARREGAMENTO SOB DEMANDA: Se a categoria não tem children carregados, buscar
      const category = findCategoryById(categoryTree, categoryId);
      if (category && (!category.children || category.children.length === 0) && category.level < 2) {
        console.log(`[toggleCategory] Categoria ${category.name} não tem children, buscando...`);
        setLoadingChildren(prev => new Set(prev).add(categoryId));

        try {
          // Contexto profissional EXPLÍCITO: sem ele o backend não surfaça conceptId (OPÇÃO B),
          // e a folha chega sem conceptId — a trava C1 do addSkill bloquearia a declaração.
          const children = await getCategoryChildren(categoryId, 'professional');
          console.log(`[toggleCategory] Children carregados para ${category.name}:`, {
            count: children.length,
            sample: children.slice(0, 3).map(c => ({ name: c.name, level: c.level, scope: c.scope })),
            allScopes: children.map(c => c.scope),
            professionalCount: children.filter(c => c.scope === 'professional').length,
          });

          if (children.length > 0) {
            // Atualizar a árvore com os children carregados
            setCategoryTree(prevTree => updateTreeWithChildren(prevTree, categoryId, children));
          }
        } catch (error) {
          console.error('[toggleCategory] Erro ao carregar children:', error);
        } finally {
          setLoadingChildren(prev => {
            const next = new Set(prev);
            next.delete(categoryId);
            return next;
          });
        }
      }
    }
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

    // TRAVA C1: declaração exige concept_id real vindo do backend. Sem fallback para categoryId,
    // sem inventar conceito. Se a categoria não traz conceptId, bloquear com mensagem honesta.
    if (!category.conceptId) {
      setSearchFieldError(
        'Esta profissão ainda não está vinculada a um conceito no sistema e não pode ser declarada agora.'
      );
      return;
    }

    const newSkill: SelectedSkill = {
      categoryId: category.categoryId,
      conceptId: category.conceptId,
      sourceCategoryId: category.categoryId, // breadcrumb de origem da seleção
      categoryName: category.name,
      categoryPath: category.path,
      skillLevel: 3, // Default: intermediário
      yearsExperience: 0,
    };

    setSelectedSkills([...selectedSkills, newSkill]);
    setSearchTerm('');
    setSearchResults([]);
    setAliasConceptResults([]);
    setSearchFieldError(null); // Limpar erro ao adicionar profissão

    // Destacar a competência recém-adicionada por alguns segundos.
    setNewlyAddedSkillId(category.categoryId);
    setTimeout(() => setNewlyAddedSkillId(null), 3000);
  };

  const removeSkill = (categoryId: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s.categoryId !== categoryId));
  };

  const updateSkill = (categoryId: string, field: 'skillLevel' | 'yearsExperience', value: number) => {
    const updated = selectedSkills.map((s) =>
      s.categoryId === categoryId ? { ...s, [field]: value } : s
    );
    setSelectedSkills(updated);

    // Validação em tempo real (só anos de experiência permanece no C1).
    if (field === 'yearsExperience') {
      const validation = validateYearsExperience(value, userAge);
      if (!validation.valid) {
        setSkillErrors({ ...skillErrors, [categoryId]: validation.error || 'Anos de experiência inválidos' });
        return;
      }
    }
    const newErrors = { ...skillErrors };
    delete newErrors[categoryId];
    setSkillErrors(newErrors);
  };

  const renderCategoryTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    // 🔴 DIAGNÓSTICO: Log para verificar renderização recursiva
    if (level === 0) {
      console.log('[renderCategoryTree] Renderizando raízes:', {
        count: categories.length,
        categories: categories.map(c => ({
          name: c.name,
          level: c.level,
          childrenCount: c.children?.length || 0,
        })),
      });
    }

    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.categoryId);
      const isSelected = isSkillSelected(category.categoryId);
      const isLoadingChildren = loadingChildren.has(category.categoryId);
      const pathDisplay = category.path.length > 0
        ? normalizeCategoryPath([...category.path, category.name], ' > ')
        : normalizeCategoryLabel(category.name);

      // Categorias de nível 0 e 1 podem ter filhos mesmo que não estejam carregados ainda
      const canHaveChildren = category.level < 2;
      const showExpandButton = hasChildren || canHaveChildren;

      // 🔴 DIAGNÓSTICO: Log para TODAS as categorias renderizadas (incluindo level 2)
      if (category.level <= 2) {
        console.log(`[renderCategoryTree] Categoria level ${category.level}:`, {
          name: category.name,
          level: category.level,
          scope: category.scope,
          hasChildren,
          canHaveChildren,
          showExpandButton,
          childrenCount: category.children?.length || 0,
          isExpanded,
          isLoadingChildren,
          willRenderChildren: hasChildren && isExpanded,
          childrenSample: category.children?.slice(0, 3).map(c => ({ name: c.name, level: c.level, scope: c.scope })) || [],
        });
      }

      // Determinar microcopy baseado no nível da categoria
      // Nível 0 = Setor macro, Nível 1 = Subsetor, Nível 2 = Profissão (selecionável)
      const getLevelHint = () => {
        if (isLoadingChildren) {
          return 'Carregando...';
        }
        if (category.level === 0) {
          return 'Expanda para ver subsetores';
        }
        if (category.level === 1) {
          return 'Expanda para ver profissões';
        }
        return ''; // Nível 2 não precisa de hint (tem botão Adicionar)
      };

      return (
        <div key={category.categoryId} className="category-item">
          <div 
            className="category-header"
            onClick={() => showExpandButton && toggleCategory(category.categoryId)}
          >
            {showExpandButton && (
              <button
                className="expand-button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCategory(category.categoryId);
                }}
                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                disabled={isLoadingChildren}
              >
                {isLoadingChildren ? '⏳' : isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!showExpandButton && <span className="expand-spacer" />}
            <span className="category-name" title={pathDisplay}>
              {normalizeCategoryLabel(category.name)}
            </span>
            {isSelected ? (
              <span className="skill-badge selected">✓ Selecionada</span>
            ) : category.level === 2 ? (
              <button
                className="add-skill-button"
                onClick={(e) => {
                  e.stopPropagation();
                  addSkill(category);
                }}
                title={`Adicionar ${normalizeCategoryLabel(category.name)}`}
              >
                + Adicionar
              </button>
            ) : (
              <span className="category-hint">{getLevelHint()}</span>
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

    // Validação (C1): só anos de experiência (skillLevel é select 1..5).
    const errors: string[] = [];
    const newSkillErrors: Record<string, string> = {};
    for (const skill of selectedSkills) {
      const yearsValidation = validateYearsExperience(skill.yearsExperience, userAge);
      if (!yearsValidation.valid) {
        newSkillErrors[skill.categoryId] = yearsValidation.error || 'Anos de experiência inválidos';
        errors.push(`Anos de experiência de ${normalizeCategoryLabel(skill.categoryName)}`);
      }
    }
    if (errors.length > 0) {
      setSkillErrors(newSkillErrors);
      setError(`Por favor, corrija os seguintes erros: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`);
      setIsSaving(false);
      return;
    }

    try {
      // Save GRANULAR C1 (sem PUT-bundle): diff vs snapshot inicial.
      const initialByConcept = new Map(initialSnapshot.concepts.map((c) => [c.conceptId, c]));
      const currentConceptIds = new Set(selectedSkills.map((s) => s.conceptId));

      // Novo → POST (concept_id real + source_category_id breadcrumb). Alterado → PATCH (campo material).
      for (const skill of selectedSkills) {
        const prev = initialByConcept.get(skill.conceptId);
        if (!prev) {
          await declareProfessionalConceptC1({
            conceptId: skill.conceptId,
            sourceCategoryId: skill.sourceCategoryId,
            skillLevel: skill.skillLevel,
            yearsExperience: skill.yearsExperience,
          });
        } else if (prev.skillLevel !== skill.skillLevel || prev.yearsExperience !== skill.yearsExperience) {
          await updateProfessionalConceptC1(skill.conceptId, {
            skillLevel: skill.skillLevel,
            yearsExperience: skill.yearsExperience,
          });
        }
      }

      // Removido → DELETE (desativação lógica).
      for (const prev of initialSnapshot.concepts) {
        if (!currentConceptIds.has(prev.conceptId)) {
          await retireProfessionalConceptC1(prev.conceptId);
        }
      }

      // Bio → PUT só se mudou.
      const sanitizedBio = bio ? sanitizeText(bio, 5000) : null;
      if ((sanitizedBio || '') !== (initialSnapshot.bio || '')) {
        await updateProfessionalBioC1(sanitizedBio);
      }

      // Atualizar snapshot para refletir o estado salvo (evita reenvio em saves seguintes).
      setInitialSnapshot({
        concepts: selectedSkills.map((s) => ({
          conceptId: s.conceptId,
          skillLevel: s.skillLevel,
          yearsExperience: s.yearsExperience,
        })),
        bio: sanitizedBio || '',
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
        <h2>Área de atuação profissional</h2>
        <div className="loading">Carregando categorias...</div>
      </div>
    );
  }

  return (
    <ProfileProfessionalForm
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      searchResults={searchResults}
      autocompleteResults={autocompleteResults}
      showAutocomplete={showAutocomplete}
      setShowAutocomplete={setShowAutocomplete}
      isSearching={isSearching}
      autocompleteError={autocompleteError}
      isCreatingWithAI={isCreatingWithAI}
      isRecording={isRecording}
      aiAssistEnabled={aiAssistEnabled}
      recognition={recognition}
      searchFieldError={searchFieldError}
      setSearchFieldError={setSearchFieldError}
      handleSearch={handleSearch}
      handleSelectAutocomplete={handleSelectAutocomplete}
      aliasConceptResults={aliasConceptResults}
      aliasSearching={aliasSearching}
      addSkillFromConcept={addSkillFromConcept}
      handleSuggestCategory={handleSuggestCategory}
      isSuggesting={isSuggesting}
      suggestionError={suggestionError}
      categoryTree={categoryTree}
      isLoading={isLoading}
      selectedSkills={selectedSkills}
      newlyAddedSkillId={newlyAddedSkillId}
      skillErrors={skillErrors}
      userAge={userAge}
      bio={bio}
      setBio={setBio}
      isSaving={isSaving}
      handleSave={handleSave}
      isSkillSelected={isSkillSelected}
      addSkill={addSkill}
      removeSkill={removeSkill}
      updateSkill={updateSkill}
      renderCategoryTree={(categories) => renderCategoryTree(categories)}
      showSuggestionModal={showSuggestionModal}
      setShowSuggestionModal={setShowSuggestionModal}
      categorySuggestion={categorySuggestion}
      setCategorySuggestion={setCategorySuggestion}
      handleCreateWithAI={handleCreateWithAI}
      startRecording={startRecording}
      stopRecording={stopRecording}
    />
  );
}

