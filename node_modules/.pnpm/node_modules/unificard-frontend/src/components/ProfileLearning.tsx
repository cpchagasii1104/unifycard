// src/components/ProfileLearning.tsx
// Componente de perfil de aprendizado/trilha - "O Que Você Está Aprendendo"

import { useState, useEffect, useRef } from 'react';
import { CategoryContext } from '@unificard/contracts';
import {
  getLearningProfile,
  updateLearningProfile,
} from '../api/learning';
import {
  getCategoryTree,
  autocompleteCategories,
  createCategoryWithAI,
  suggestCategoryPath,
  type CategoryTree,
  type Category,
  type CategoryAutocompleteResult,
  type CategoryPathSuggestion,
} from '../api/categories';
import './ProfileLearning.css';

interface SelectedLearning {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  details: string[];
  notes: string;
  progress: 'beginner' | 'intermediate' | 'advanced' | null;
}

export default function ProfileLearning() {
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
  const [_userPlan, setUserPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [categorySuggestion, setCategorySuggestion] = useState<CategoryPathSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [selectedLearnings, setSelectedLearnings] = useState<SelectedLearning[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    
    // FEATURE FLAG: Inicializar Web Speech API apenas se feature habilitada (versão paga)
    // Nota: handleSearch será definido depois, mas será chamado apenas quando usuário falar
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAssistEnabled]); // Recriar quando feature flag mudar

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Buscar categorias de aprendizado (usando o mesmo sistema de categorias)
      const tree = await getCategoryTree();
      setCategoryTree(tree);

      // Buscar perfil de aprendizado
      const profile = await getLearningProfile().catch(() => ({
        globalUserId: '',
        learnings: [],
        preferences: {},
        metadata: {},
      }));

      // Converter aprendizados do perfil para formato local
      const preferencesObj = profile.preferences as { [categoryId: string]: { details?: string[]; notes?: string; progress?: 'beginner' | 'intermediate' | 'advanced' | null } } || {};
      setSelectedLearnings(
        profile.learnings.map((learning) => ({
          categoryId: learning.categoryId,
          categoryName: learning.categoryName,
          categoryPath: learning.categoryPath,
          details: preferencesObj[learning.categoryId]?.details || [],
          notes: preferencesObj[learning.categoryId]?.notes || '',
          progress: preferencesObj[learning.categoryId]?.progress || null,
        }))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      console.error('Erro completo:', err);
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

    // Converter para Category e adicionar como learning
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
    
    addLearning(category);
    setSearchTerm('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
    setSearchFieldError(null); // Limpar erro ao selecionar
  };

  const handleSuggestCategory = async () => {
    if (!searchTerm.trim()) {
      setSuggestionError('Digite o nome do tema de aprendizado que deseja sugerir');
      return;
    }

    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const suggestion = await suggestCategoryPath(searchTerm.trim(), 'learning' as CategoryContext);
      setCategorySuggestion(suggestion);
      setShowSuggestionModal(true);
    } catch (err) {
      console.error('Erro ao sugerir categoria:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao sugerir categoria';
      setSuggestionError(errorMessage);
      if (errorMessage.includes('não permitido') || errorMessage.includes('inválido')) {
        alert(errorMessage);
      }
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCreateWithAI = async (parentId?: string | null) => {
    if (!searchTerm.trim()) {
      alert('Digite ou fale o nome do tema de aprendizado que deseja criar');
      return;
    }

    setIsCreatingWithAI(true);
    try {
      const result = await createCategoryWithAI(searchTerm.trim(), 'learning' as CategoryContext, parentId);
      
      if (result.created && result.category) {
        // Fechar modal
        setShowSuggestionModal(false);
        setCategorySuggestion(null);
        
        // Mostrar feedback
        if (result.requiresApproval) {
          alert(`📋 ${result.message || `Sua sugestão "${result.category.name}" foi enviada para análise!\n\nO tema será revisado e poderá aparecer no sistema em breve.`}`);
        } else {
          alert(`✅ Tema "${result.category.name}" criado com sucesso!`);
        }
        
        // Recarregar árvore de categorias
        const tree = await getCategoryTree();
        setCategoryTree(tree);
        
        // Adicionar automaticamente se for nível 2 (tema) e já aprovado
        if (result.category.level === 2 && !result.requiresApproval) {
          addLearning(result.category);
        } else {
          // Se não for tema ou precisa aprovação, fazer busca para encontrar
          await handleSearch(searchTerm);
        }
        setSearchTerm('');
      } else if (result.existingCategory) {
        setShowSuggestionModal(false);
        alert(`Tema "${result.existingCategory.name}" já existe!`);
        // Adicionar automaticamente se for nível 2
        if (result.existingCategory.level === 2) {
          addLearning(result.existingCategory);
        } else {
          await handleSearch(searchTerm);
        }
        setSearchTerm('');
      }
    } catch (err) {
      console.error('Erro ao criar categoria via IA:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria via IA';
      
      if (errorMessage.includes('❌')) {
        alert(`🚫 ${errorMessage.replace('❌ ', '')}\n\nEste termo não pode ser cadastrado.`);
      } else if (errorMessage.includes('não permitido') || errorMessage.includes('inválido') || errorMessage.includes('Tags HTML') || errorMessage.includes('URLs')) {
        alert(`❌ ${errorMessage}\n\nPor favor, use apenas letras, espaços e hífens.`);
      } else {
        alert(`❌ ${errorMessage}`);
      }
    } finally {
      setIsCreatingWithAI(false);
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

  const isLearningSelected = (categoryId: string): boolean => {
    return selectedLearnings.some((s) => s.categoryId === categoryId);
  };

  const addLearning = (category: Category) => {
    if (isLearningSelected(category.categoryId)) {
      return;
    }

    if (category.level !== 2) {
      alert('Por favor, selecione um tema de aprendizado específico. Navegue pelas subcategorias para encontrar temas.');
      return;
    }

    setSelectedLearnings([
      ...selectedLearnings,
      {
        categoryId: category.categoryId,
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
      await updateLearningProfile({
        learnings: selectedLearnings.map((s) => s.categoryId),
        preferences: selectedLearnings.reduce((acc, learning) => {
          acc[learning.categoryId] = {
            details: learning.details,
            notes: learning.notes || undefined,
            progress: learning.progress || undefined,
          };
          return acc;
        }, {} as Record<string, { details?: string[]; notes?: string; progress?: 'beginner' | 'intermediate' | 'advanced' | null }>),
      });

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

  return (
    <div className="profile-learning">
      <h2>O Que Você Está Aprendendo</h2>
      <p className="section-description">
        <strong>O que você está aprendendo ou gostaria de aprender?</strong> Conte-nos sobre os temas 
        que você está explorando, melhorando ou querendo conhecer. Isso nos ajuda a entender sua direção.
      </p>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem', fontStyle: 'italic' }}>
        💡 Dica: Aqui não é sobre trabalho ou hobby. É sobre o que você está tentando aprender, melhorar ou explorar com intenção.
      </p>

      {error && <div className="error-message">{error}</div>}

      {/* Busca Inteligente com Autocomplete */}
      <div className="search-section">
        <label htmlFor="learning-search">
          O que você está aprendendo ou gostaria de aprender?
        </label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          Digite o nome do tema de aprendizado e selecione uma opção da lista.
        </p>
        <div className="search-input-wrapper">
          <input
            id="learning-search"
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
                handleSearch(searchTerm);
              }
            }}
            onBlur={() => {
              setTimeout(() => {
                setShowAutocomplete(false);
                // Validar se há texto mas nenhuma seleção
                if (searchTerm.trim().length > 0 && selectedLearnings.length === 0) {
                  setSearchFieldError('Selecione um tema de aprendizado da lista.');
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
                  setSearchFieldError('Selecione um tema de aprendizado da lista.');
                }
              }
            }}
            placeholder="Ex: programação, fotografia, culinária, design..."
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
          
          {/* Dropdown de Autocomplete */}
          {showAutocomplete && autocompleteResults.length > 0 && (
            <div className="autocomplete-dropdown">
              {autocompleteResults.map((result) => (
                <div
                  key={result.id}
                  className="autocomplete-item"
                  onClick={() => handleSelectAutocomplete(result)}
                  onMouseDown={(e) => e.preventDefault()}
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

        {/* Sugerir criação se não encontrou resultados */}
        {searchTerm.trim().length >= 2 && 
         !autocompleteError && 
         autocompleteResults.length === 0 && 
         !isSearching && 
         !showAutocomplete && (
          <div className="ai-create-suggestion">
            <p>Nenhum tema encontrado para "{searchTerm}"</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Não encontrou seu tema? Solicite a inclusão abaixo.
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
              .filter((category) => category.level === 2)
              .map((category) => {
                const pathDisplay = category.path.length > 0
                  ? category.path.join(' > ') + ' > ' + category.name
                  : category.name;
                const isSelected = isLearningSelected(category.categoryId);

                return (
                  <div
                    key={category.categoryId}
                    className={`search-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => !isSelected && addLearning(category)}
                  >
                    <div className="result-path">{pathDisplay}</div>
                    {isSelected ? (
                      <span className="learning-badge">✓ Já adicionado</span>
                    ) : (
                      <button className="add-button-small">+ Adicionar</button>
                    )}
                  </div>
                );
              })}
            {searchResults.filter((c) => c.level === 2).length === 0 && searchResults.length > 0 && (
              <div className="search-no-results">
                <p>Nenhum tema de aprendizado encontrado. Tente buscar por termos mais específicos.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Árvore de Categorias */}
      <div className="categories-section">
        <h3>Ou navegue pelas categorias:</h3>
        {categoryTree.length > 0 ? (
          <div className="category-tree">
            {renderCategoryTree(categoryTree)}
          </div>
        ) : (
          <div className="empty-state">
            <p>Nenhuma categoria disponível no momento.</p>
          </div>
        )}
      </div>

      {/* Temas de Aprendizado Selecionados */}
      {selectedLearnings.length > 0 && (
        <div className="selected-learnings-section">
          <h3>O Que Você Está Aprendendo ({selectedLearnings.length})</h3>
          <div className="selected-learnings-list">
            {selectedLearnings.map((learning) => (
              <div key={learning.categoryId} className="selected-learning-card">
                <div className="learning-header">
                  <div className="learning-info">
                    <h4>{learning.categoryName}</h4>
                    <p className="learning-path">{learning.categoryPath.join(' > ')}</p>
                  </div>
                  <button
                    className="remove-learning-button"
                    onClick={() => removeLearning(learning.categoryId)}
                    title="Remover"
                  >
                    ×
                  </button>
                </div>
                <div className="learning-fields">
                  <div className="progress-select-group">
                    <label>Nível de Progresso</label>
                    <select
                      value={learning.progress || ''}
                      onChange={(e) => updateLearning(learning.categoryId, 'progress', e.target.value as 'beginner' | 'intermediate' | 'advanced' | null || null)}
                      className="progress-select"
                    >
                      <option value="">Selecione...</option>
                      <option value="beginner">Iniciante</option>
                      <option value="intermediate">Intermediário</option>
                      <option value="advanced">Avançado</option>
                    </select>
                  </div>
                  <div className="notes-input-group">
                    <label>Observações</label>
                    <textarea
                      value={learning.notes}
                      onChange={(e) => updateLearning(learning.categoryId, 'notes', e.target.value)}
                      placeholder="Observações sobre este aprendizado..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Salvando...' : 'Salvar Perfil de Aprendizado'}
        </button>
      </div>

      {/* Modal de Sugestão de Categoria */}
      {showSuggestionModal && categorySuggestion && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sugerir Novo Tema de Aprendizado</h3>
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
                  <strong>Tema sugerido:</strong> "{categorySuggestion.leafName}"
                </p>
                
                {categorySuggestion.suggestedRoot && categorySuggestion.suggestedParent && (
                  <div className="suggestion-path">
                    <p className="path-label">Caminho sugerido:</p>
                    <div className="path-display">
                      <span className="path-root">{categorySuggestion.suggestedRoot.name}</span>
                      <span className="path-arrow">→</span>
                      <span className="path-parent">{categorySuggestion.suggestedParent.name}</span>
                      <span className="path-arrow">→</span>
                      <span className="path-leaf">{categorySuggestion.leafName}</span>
                    </div>
                  </div>
                )}

                {categorySuggestion.leafDescription && (
                  <p className="suggestion-description">{categorySuggestion.leafDescription}</p>
                )}

                <div className="suggestion-confidence">
                  <p>Confiança: {Math.round((categorySuggestion.confidence || 0) * 100)}%</p>
                  {categorySuggestion.reasoning && (
                    <p className="suggestion-reasoning">{categorySuggestion.reasoning}</p>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => handleCreateWithAI(categorySuggestion.suggestedParent?.id)}
                  disabled={isCreatingWithAI}
                  className="create-button"
                >
                  {isCreatingWithAI ? 'Criando...' : '✨ Criar com IA'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestionModal(false);
                    setCategorySuggestion(null);
                  }}
                  className="cancel-button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


