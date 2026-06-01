// src/components/ProfileLearning.tsx
// Componente de perfil de aprendizado/trilha - "O Que Você Está Aprendendo"

import { useEffect, useRef, useState } from 'react';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import { CategoryContext } from '@unificard/contracts';
// Fatia 4b (DECISION-0067): aba Aprendizado migrada para o C1 actor-first/concept-first.
// Legado /profile/learning (blob) NÃO é mais usado por esta aba. Criação de taxonomia pelo
// frontend (createCategoryWithAI/suggestCategoryPath) foi neutralizada (governança futura).
import {
  getLearningC1,
  declareLearningConceptC1,
  updateLearningConceptC1,
  retireLearningConceptC1,
} from '../api/learningC1';
import {
  getCategoryTree,
  autocompleteCategories,
  type CategoryTree,
  type Category,
  type CategoryAutocompleteResult,
  type CategoryPathSuggestion,
} from '../api/categories';
import { useProfileLearningState } from '../hooks/useProfileLearningState';
import { useProfileLearningLogic } from '../hooks/useProfileLearningLogic';
import ProfileLearningForm from './ProfileLearningForm';
import './ProfileLearning.css';

interface SelectedLearning {
  categoryId: string;          // breadcrumb (= source_category_id no C1)
  conceptId: string;           // identidade semântica (C1, Lei 7)
  categoryName: string;
  categoryPath: string[];
  details: string[];           // UI-local; C1 NÃO persiste
  notes: string;               // UI-local; C1 NÃO persiste
  progress: 'beginner' | 'intermediate' | 'advanced' | null;
}

// Mapeamento progress UI(string) ↔ C1(SMALLINT 1..3). Estágio de EXPLORAÇÃO, não competência.
type UiProgress = 'beginner' | 'intermediate' | 'advanced' | null;
function uiToC1Progress(p: UiProgress): number | null {
  return p === 'beginner' ? 1 : p === 'intermediate' ? 2 : p === 'advanced' ? 3 : null;
}
function c1ToUiProgress(n: number | null): UiProgress {
  return n === 1 ? 'beginner' : n === 2 ? 'intermediate' : n === 3 ? 'advanced' : null;
}
// Resolve nome/path de uma categoria pelo id na árvore carregada (breadcrumb/UI, não identidade).
function findCategoryInTree(nodes: CategoryTree[], categoryId: string): CategoryTree | null {
  for (const n of nodes) {
    if (n.categoryId === categoryId) return n;
    if (n.children) {
      const f = findCategoryInTree(n.children, categoryId);
      if (f) return f;
    }
  }
  return null;
}

export default function ProfileLearning() {
  const { activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="aprendizado" />;
  }

  const {
    categoryTree,
    setCategoryTree,
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
    _userPlan,
    setUserPlan,
    aiAssistEnabled,
    setAiAssistEnabled,
    recognition,
    setRecognition,
    showSuggestionModal,
    setShowSuggestionModal,
    categorySuggestion,
    setCategorySuggestion,
    isSuggesting,
    setIsSuggesting,
    suggestionError,
    setSuggestionError,
    selectedLearnings,
    setSelectedLearnings,
    initialLearnings,
    setInitialLearnings,
    expandedCategories,
    setExpandedCategories,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    searchFieldError,
    setSearchFieldError,
  } = useProfileLearningState();
  const { isLearningSelected: isLearningSelectedLogic } = useProfileLearningLogic();

  // 🔴 CRÍTICO: Prevenir loop de chamadas - loadData() roda apenas uma vez
  const hasLoadedRef = useRef(false);
  const { sessionReady } = useSession();

  useEffect(() => {
    // GUARD: Não fazer chamadas de API antes de sessionReady
    if (!sessionReady) {
      setIsLoading(false);
      return;
    }
    // Carregar dados apenas uma vez no mount
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

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
  }, [sessionReady]); // Re-executar quando sessionReady mudar para true

  // FEATURE FLAG: Inicializar Web Speech API apenas se feature habilitada (versão paga)
  // Separado em useEffect próprio para não causar loop
  useEffect(() => {
    if (aiAssistEnabled && typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'pt-BR';
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchTerm(transcript);
        // Disparar busca automática após receber texto da voz
        if (handleSearchRef.current) {
          handleSearchRef.current(transcript);
        }
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
  }, [aiAssistEnabled]); // Recriar apenas quando feature flag mudar

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 🔴 REGRA: Buscar categorias EXCLUSIVAMENTE de context='learning' (agora com conceptId — Fatia 4a)
      const tree = await getCategoryTree('learning');
      setCategoryTree(tree);

      // C1 actor-first: declarações vêm de /profile/learning/c1 (NÃO do blob legado).
      const c1 = await getLearningC1();

      // Converter declarações C1 → modelo local. Nome/path resolvidos via sourceCategoryId na árvore
      // (breadcrumb/UI, não identidade). progress C1(1..3) → UI(string).
      const loaded: SelectedLearning[] = c1.concepts.map((c) => {
        const cat = c.sourceCategoryId ? findCategoryInTree(tree, c.sourceCategoryId) : null;
        return {
          categoryId: c.sourceCategoryId ?? c.conceptId, // chave de UI (breadcrumb se houver)
          conceptId: c.conceptId,
          categoryName: cat?.name ?? 'Aprendizado',
          categoryPath: cat?.path ?? [],
          details: [],
          notes: '',
          progress: c1ToUiProgress(c.progress),
        };
      });
      setSelectedLearnings(loaded);
      setInitialLearnings(loaded); // snapshot para o diff granular do save
    } catch (err) {
      // 🚫 Nada de retry - falhou → UI mostra erro → fim
      const errorMessage = err instanceof Error ? err.message : 'Não foi possível carregar as categorias agora.';
      setError(errorMessage);
      console.error('[ProfileLearning] Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce para autocomplete
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // Ref para handleSearch (para uso no callback de voz)
  const handleSearchRef = useRef<((term: string) => Promise<void>) | null>(null);

  // Funções de gravação de voz
  const startRecording = () => {
    if (recognition && !isRecording) {
      try {
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Erro ao iniciar gravação:', err);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      try {
        recognition.stop();
        setIsRecording(false);
      } catch (err) {
        console.error('Erro ao parar gravação:', err);
        setIsRecording(false);
      }
    }
  };

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

    // Se termo tem 1+ caractere, usar autocomplete com context='learning'
    if (term.length >= 1) {
      setIsSearching(true);
      setAutocompleteError(null);
      
      // Debounce: aguardar 300ms antes de buscar
      const timeout = setTimeout(async () => {
        try {
          const results = await autocompleteCategories(term, 'learning' as CategoryContext, undefined, 20);
          
          setAutocompleteResults(results);
          setAutocompleteError(null);
          
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
          // Tratar erro 429 (rate limit) silenciosamente - não quebrar UI
          if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
            console.warn('[ProfileLearning] Rate limit atingido no autocomplete');
            setAutocompleteResults([]);
            setSearchResults([]);
            setShowAutocomplete(false);
            setAutocompleteError(null); // Não mostrar erro para rate limit
            setIsSearching(false);
            return;
          }
          
          console.error('[ProfileLearning] ERRO:', {
            message: err?.message,
            code: err?.code,
            stack: err?.stack
          });
          
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

  // Atualizar ref quando handleSearch mudar
  useEffect(() => {
    handleSearchRef.current = handleSearch;
  }, [handleSearch]);

  const handleSelectAutocomplete = (result: CategoryAutocompleteResult) => {
    // Validar que é um tema de aprendizado (nível 2)
    if (result.level !== 2) {
      setSearchFieldError('Por favor, selecione um tema de aprendizado específico da lista.');
      return;
    }

    // Converter para Category e adicionar como learning. conceptId surfaçado pelo autocomplete (Fatia 4a).
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

    addLearning(category);
    setSearchTerm('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    setSearchFieldError(null); // Limpar erro ao selecionar
  };

  // NEUTRALIZADO (Fatia 4b / DT-PROFILE-FRONTEND-DRIVES-TAXONOMY): o frontend NÃO cria taxonomia.
  // Sugestões de novos temas serão tratadas por governança futura (sem chamada de backend).
  const TAXONOMY_SUGGESTION_MESSAGE =
    'Sugestões de novos temas de aprendizado serão tratadas por governança futura. ' +
    'Por enquanto, selecione um tema existente da lista.';

  const handleSuggestCategory = async () => {
    setSuggestionError(TAXONOMY_SUGGESTION_MESSAGE);
  };

  const handleCreateWithAI = async (_parentId?: string | null) => {
    alert(`ℹ️ ${TAXONOMY_SUGGESTION_MESSAGE}`);
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

  const isLearningSelected = (categoryId: string): boolean => {
    return isLearningSelectedLogic(categoryId, selectedLearnings);
  };

  const addLearning = (category: Category) => {
    if (isLearningSelected(category.categoryId)) {
      return;
    }

    if (category.level !== 2) {
      alert('Por favor, selecione um tema de aprendizado específico. Navegue pelas subcategorias para encontrar temas.');
      return;
    }

    // TRAVA C1: declaração exige conceptId real surfaçado pelo backend (Fatia 4a). Sem fallback
    // conceptId ← categoryId, sem inventar conceito. Folha sem conceptId não é declarável.
    if (!category.conceptId) {
      setSearchFieldError(
        'Este tema ainda não está vinculado a um conceito no sistema e não pode ser declarado agora.'
      );
      return;
    }

    setSelectedLearnings([
      ...selectedLearnings,
      {
        categoryId: category.categoryId,
        conceptId: category.conceptId,
        categoryName: category.name,
        categoryPath: category.path,
        details: [],
        notes: '',
        progress: null,
      },
    ]);
    setSearchTerm('');
    setSearchResults([]);
    setSearchFieldError(null); // Limpar erro ao adicionar
  };

  const removeLearning = (categoryId: string) => {
    setSelectedLearnings(selectedLearnings.filter((s) => s.categoryId !== categoryId));
  };

  const updateLearning = (categoryId: string, field: 'details' | 'notes' | 'progress', value: string[] | string | 'beginner' | 'intermediate' | 'advanced' | null) => {
    setSelectedLearnings(
      selectedLearnings.map((s) =>
        s.categoryId === categoryId ? { ...s, [field]: value } : s
      )
    );
  };


  const renderCategoryTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.categoryId);
      const isSelected = isLearningSelected(category.categoryId);
      const pathDisplay = category.path.length > 0 
        ? category.path.join(' > ') + ' > ' + category.name
        : category.name;
      
      const isLearning = category.level === 2 || !hasChildren;
      const showAddButton = isLearning && !isSelected;

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
              <span className="learning-badge selected">✓ Selecionado</span>
            ) : showAddButton ? (
              <button
                className="add-learning-button"
                onClick={() => addLearning(category)}
                title={`Adicionar ${category.name}`}
              >
                + Adicionar
              </button>
            ) : (
              <span className="category-hint">Navegue para ver temas de aprendizado</span>
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
    setSearchFieldError(null);

    // VALIDAÇÃO OBRIGATÓRIA: Pelo menos um tema deve estar selecionado
    if (selectedLearnings.length === 0) {
      setError('Selecione pelo menos um tema de aprendizado da lista antes de salvar.');
      setIsSaving(false);
      return;
    }

    // VALIDAÇÃO: Se há texto no campo de busca mas nenhum tema selecionado, bloquear
    if (searchTerm.trim().length > 0 && selectedLearnings.length === 0) {
      setSearchFieldError('Selecione um tema de aprendizado da lista. Não é possível salvar apenas texto digitado.');
      setError('Selecione um tema de aprendizado da lista antes de salvar.');
      setIsSaving(false);
      return;
    }

    try {
      // Save GRANULAR no C1 (diff contra o snapshot do load): novo→POST, progress alterado→PATCH,
      // removido→DELETE (desativação lógica). conceptId é a identidade; categoryId é breadcrumb.
      // C1 NÃO persiste details/notes (DECISION-0067) — não são enviados.
      const initialByConcept = new Map(initialLearnings.map((s) => [s.conceptId, s]));
      const currentByConcept = new Map(selectedLearnings.map((s) => [s.conceptId, s]));

      // Novos: presentes agora, ausentes no snapshot → POST declare.
      for (const cur of selectedLearnings) {
        if (!initialByConcept.has(cur.conceptId)) {
          await declareLearningConceptC1({
            conceptId: cur.conceptId,
            sourceCategoryId: cur.categoryId,
            progress: uiToC1Progress(cur.progress),
          });
        }
      }
      // Progress alterado: presentes em ambos com progress diferente → PATCH.
      for (const cur of selectedLearnings) {
        const prev = initialByConcept.get(cur.conceptId);
        if (prev && prev.progress !== cur.progress) {
          await updateLearningConceptC1(cur.conceptId, { progress: uiToC1Progress(cur.progress) });
        }
      }
      // Removidos: no snapshot, ausentes agora → DELETE retire (desativação lógica).
      for (const prev of initialLearnings) {
        if (!currentByConcept.has(prev.conceptId)) {
          await retireLearningConceptC1(prev.conceptId);
        }
      }

      // Releitura do C1 → re-sincroniza o snapshot (próximo diff parte do estado real).
      const c1 = await getLearningC1();
      const refreshed: SelectedLearning[] = c1.concepts.map((c) => {
        const cat = c.sourceCategoryId ? findCategoryInTree(categoryTree, c.sourceCategoryId) : null;
        return {
          categoryId: c.sourceCategoryId ?? c.conceptId,
          conceptId: c.conceptId,
          categoryName: cat?.name ?? 'Aprendizado',
          categoryPath: cat?.path ?? [],
          details: [],
          notes: '',
          progress: c1ToUiProgress(c.progress),
        };
      });
      setSelectedLearnings(refreshed);
      setInitialLearnings(refreshed);

      alert('Perfil de aprendizado atualizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-learning">
        <h2>O Que Você Está Aprendendo</h2>
        <div className="loading">Carregando temas de aprendizado...</div>
      </div>
    );
  }

  // 🧠 UI que não quebra - Golden Path: Feed pode estar vazio, app não pode entrar em surto
  if (error && categoryTree.length === 0) {
    return (
      <div className="profile-learning">
        <h2>O Que Você Está Aprendendo</h2>
        <div className="error-message" style={{
          padding: '1.5rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#dc2626',
          marginTop: '1rem'
        }}>
          <strong>⚠️ Erro ao carregar categorias</strong>
          <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProfileLearningForm
      error={error}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      searchFieldError={searchFieldError}
      setSearchFieldError={setSearchFieldError}
      autocompleteResults={autocompleteResults}
      showAutocomplete={showAutocomplete}
      setShowAutocomplete={setShowAutocomplete}
      isSearching={isSearching}
      isCreatingWithAI={isCreatingWithAI}
      autocompleteError={autocompleteError}
      aiAssistEnabled={aiAssistEnabled}
      recognition={recognition}
      isRecording={isRecording}
      searchResults={searchResults}
      categoryTree={categoryTree}
      selectedLearnings={selectedLearnings}
      expandedCategories={expandedCategories}
      showSuggestionModal={showSuggestionModal}
      categorySuggestion={categorySuggestion}
      isSuggesting={isSuggesting}
      suggestionError={suggestionError}
      isSaving={isSaving}
      handleSearch={handleSearch}
      handleSelectAutocomplete={handleSelectAutocomplete}
      handleSuggestCategory={handleSuggestCategory}
      handleCreateWithAI={handleCreateWithAI}
      startRecording={startRecording}
      stopRecording={stopRecording}
      toggleCategory={toggleCategory}
      isLearningSelected={isLearningSelected}
      addLearning={addLearning}
      removeLearning={removeLearning}
      updateLearning={updateLearning}
      handleSave={handleSave}
      renderCategoryTree={renderCategoryTree}
      setShowSuggestionModal={setShowSuggestionModal}
      setCategorySuggestion={setCategorySuggestion}
    />
  );
}


