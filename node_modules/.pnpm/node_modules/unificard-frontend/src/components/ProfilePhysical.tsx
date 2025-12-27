// src/components/ProfilePhysical.tsx
// Componente de perfil físico/interesses - "Raio-X" da pessoa
// REPLICA a lógica do ProfileProfessional.tsx com context='interest'

import { useState, useEffect } from 'react';
import { CategoryContext } from '@unificard/contracts';
import {
  getPhysicalProfile,
  updatePhysicalProfile,
  type LifestyleInfo,
} from '../api/physical';
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
import './ProfilePhysical.css';

interface SelectedInterest {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  details: string[];
  notes: string;
}

export default function ProfilePhysical() {
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
  const [selectedInterests, setSelectedInterests] = useState<SelectedInterest[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // Estilo de vida
  const [lifestyle, setLifestyle] = useState<LifestyleInfo>({
    drinks: null,
    smokes: null,
    relationshipStatus: null,
    sexualOrientation: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Buscar categorias de interesses (usando o mesmo sistema de categorias)
      const tree = await getCategoryTree();
      setCategoryTree(tree);

      // Buscar perfil físico
      const profile = await getPhysicalProfile().catch(() => ({
        globalUserId: '',
        interests: [],
        lifestyle: {
          drinks: null,
          smokes: null,
          relationshipStatus: null,
          sexualOrientation: null,
        },
        preferences: {},
        metadata: {},
      }));

      setLifestyle(profile.lifestyle);
      
      // Converter interesses do perfil para formato local
      const preferencesObj = profile.preferences as { [categoryId: string]: { details?: string[]; notes?: string } } || {};
      setSelectedInterests(
        profile.interests.map((interest) => ({
          categoryId: interest.categoryId,
          categoryName: interest.categoryName,
          categoryPath: interest.categoryPath,
          details: preferencesObj[interest.categoryId]?.details || [],
          notes: preferencesObj[interest.categoryId]?.notes || '',
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

    // Se termo tem 1+ caractere, usar autocomplete com context='interest'
    if (term.length >= 1) {
      setIsSearching(true);
      setAutocompleteError(null);
      
      // Debounce: aguardar 300ms antes de buscar
      const timeout = setTimeout(async () => {
        try {
          const results = await autocompleteCategories(term, 'interest' as CategoryContext, undefined, 20);
          
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
          console.error('[ProfilePhysical] ERRO:', {
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

  const handleSelectAutocomplete = (result: CategoryAutocompleteResult) => {
    // Converter para Category e adicionar como interesse
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
    
    addInterest(category);
    setSearchTerm('');
    setAutocompleteResults([]);
    setShowAutocomplete(false);
  };

  const handleSuggestCategory = async () => {
    if (!searchTerm.trim()) {
      setSuggestionError('Digite o nome do interesse ou hobby que deseja sugerir');
      return;
    }

    setIsSuggesting(true);
    setSuggestionError(null);
    try {
      const suggestion = await suggestCategoryPath(searchTerm.trim(), 'interest' as CategoryContext);
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
      alert('Digite ou fale o nome da atividade de prazer que deseja criar');
      return;
    }

    setIsCreatingWithAI(true);
    try {
      const result = await createCategoryWithAI(searchTerm.trim(), 'interest' as CategoryContext, parentId);
      
      if (result.created && result.category) {
        // Fechar modal
        setShowSuggestionModal(false);
        setCategorySuggestion(null);
        
        // Mostrar feedback
        if (result.requiresApproval) {
          // FASE 3.8: Mensagem específica para REVIEW
          alert(`📋 ${result.message || `Sua sugestão "${result.category.name}" foi enviada para análise!\n\nO interesse será revisado e poderá aparecer no sistema em breve.`}`);
        } else {
          alert(`✅ Interesse "${result.category.name}" criado com sucesso!`);
        }
        
        // Recarregar árvore de categorias
        const tree = await getCategoryTree();
        setCategoryTree(tree);
        
        // Adicionar automaticamente se for nível 2 (interesse) e já aprovado
        if (result.category.level === 2 && !result.requiresApproval) {
          addInterest(result.category);
        } else {
          // Se não for interesse ou precisa aprovação, fazer busca para encontrar
          await handleSearch(searchTerm);
        }
        setSearchTerm('');
      } else if (result.existingCategory) {
        setShowSuggestionModal(false);
        alert(`Interesse "${result.existingCategory.name}" já existe!`);
        // Adicionar automaticamente se for nível 2
        if (result.existingCategory.level === 2) {
          addInterest(result.existingCategory);
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

  const startRecording = () => {
    if (!recognition) {
      alert('Reconhecimento de voz não está disponível no seu navegador');
      return;
    }

    // Se já estiver escutando, não fazer nada (evitar loop)
    if (isRecording) {
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

  const isInterestSelected = (categoryId: string): boolean => {
    return selectedInterests.some((s) => s.categoryId === categoryId);
  };

  const addInterest = (category: Category) => {
    if (isInterestSelected(category.categoryId)) {
      return;
    }

    if (category.level !== 2) {
      alert('Por favor, selecione um interesse específico. Navegue pelas subcategorias.');
      return;
    }

    setSelectedInterests([
      ...selectedInterests,
      {
        categoryId: category.categoryId,
        categoryName: category.name,
        categoryPath: category.path,
        details: [],
        notes: '',
      },
    ]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeInterest = (categoryId: string) => {
    setSelectedInterests(selectedInterests.filter((s) => s.categoryId !== categoryId));
  };

  const updateInterest = (categoryId: string, field: 'details' | 'notes', value: string[] | string) => {
    setSelectedInterests(
      selectedInterests.map((s) =>
        s.categoryId === categoryId ? { ...s, [field]: value } : s
      )
    );
  };

  const addDetail = (categoryId: string, detail: string) => {
    const interest = selectedInterests.find((s) => s.categoryId === categoryId);
    if (interest && !interest.details.includes(detail)) {
      updateInterest(categoryId, 'details', [...interest.details, detail]);
    }
  };

  const removeDetail = (categoryId: string, detail: string) => {
    const interest = selectedInterests.find((s) => s.categoryId === categoryId);
    if (interest) {
      updateInterest(categoryId, 'details', interest.details.filter((d) => d !== detail));
    }
  };

  const renderCategoryTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedCategories.has(category.categoryId);
      const isSelected = isInterestSelected(category.categoryId);
      const pathDisplay = category.path.length > 0 
        ? category.path.join(' > ') + ' > ' + category.name
        : category.name;
      
      const isInterest = category.level === 2 || !hasChildren;
      const showAddButton = isInterest && !isSelected;

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
              <span className="interest-badge selected">✓ Selecionado</span>
            ) : showAddButton ? (
              <button
                className="add-interest-button"
                onClick={() => addInterest(category)}
                title={`Adicionar ${category.name}`}
              >
                + Adicionar
              </button>
            ) : (
              <span className="category-hint">Navegue para ver interesses</span>
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

    try {
      await updatePhysicalProfile({
        interests: selectedInterests.map((s) => s.categoryId),
        lifestyle,
        preferences: selectedInterests.reduce((acc, interest) => {
          acc[interest.categoryId] = {
            details: interest.details,
            notes: interest.notes || undefined,
          };
          return acc;
        }, {} as Record<string, { details?: string[]; notes?: string }>),
      });

      alert('Perfil físico atualizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-physical">
        <h2>O Que Você Gosta de Fazer</h2>
        <div className="loading">Carregando atividades de prazer...</div>
      </div>
    );
  }

  return (
    <div className="profile-physical">
      <h2>Perfil Físico e Interesses</h2>
      <p className="section-description">
        Complete seu perfil de interesses e estilo de vida. Essas informações serão usadas para 
        conectar você com pessoas, empresas e eventos que combinam com você na rede social.
      </p>

      {error && <div className="error-message">{error}</div>}

      {/* Busca Inteligente com Autocomplete */}
      <div className="search-section">
        <label htmlFor="interest-search">
          O que você gosta de fazer no seu tempo livre?
        </label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          Digite o nome da atividade que te dá prazer e selecione uma opção da lista.
        </p>
        <div className="search-input-wrapper">
          <input
            id="interest-search"
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (searchTerm.length >= 1 && autocompleteResults.length > 0) {
                setShowAutocomplete(true);
              } else if (searchTerm.length >= 2) {
                handleSearch(searchTerm);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowAutocomplete(false), 200);
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && searchTerm.trim() && autocompleteResults.length === 0 && !isSearching) {
                handleSuggestCategory();
              }
            }}
            placeholder="Digite ou fale o nome do interesse ou hobby..."
            className="search-input"
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
            <small>Verifique sua conexão e tente novamente.</small>
          </div>
        )}

        {/* Sugerir criação se não encontrou resultados */}
        {searchTerm.trim().length >= 2 && 
         !autocompleteError && 
         autocompleteResults.length === 0 && 
         !isSearching && 
         !showAutocomplete && (
          <div className="ai-create-suggestion">
            <p>Nenhuma atividade encontrada para "{searchTerm}"</p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Não encontrou sua atividade de prazer? Solicite a inclusão abaixo.
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
                const isSelected = isInterestSelected(category.categoryId);

                return (
                  <div
                    key={category.categoryId}
                    className={`search-result-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => !isSelected && addInterest(category)}
                  >
                    <div className="result-path">{pathDisplay}</div>
                    {isSelected ? (
                      <span className="interest-badge">✓ Já adicionado</span>
                    ) : (
                      <button className="add-button-small">+ Adicionar</button>
                    )}
                  </div>
                );
              })}
            {searchResults.filter((c) => c.level === 2).length === 0 && searchResults.length > 0 && (
              <div className="search-no-results">
                <p>Nenhuma atividade de prazer encontrada. Tente buscar por termos mais específicos.</p>
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

      {/* Atividades de Prazer Selecionadas */}
      {selectedInterests.length > 0 && (
        <div className="selected-interests-section">
          <h3>O Que Você Gosta de Fazer ({selectedInterests.length})</h3>
          <div className="selected-interests-list">
            {selectedInterests.map((interest) => (
              <div key={interest.categoryId} className="selected-interest-card">
                <div className="interest-header">
                  <div className="interest-info">
                    <h4>{interest.categoryName}</h4>
                    <p className="interest-path">{interest.categoryPath.join(' > ')}</p>
                  </div>
                  <button
                    className="remove-interest-button"
                    onClick={() => removeInterest(interest.categoryId)}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
                <div className="interest-details">
                  <div className="detail-input-group">
                    <label>Detalhes (ex: jogos específicos, autores favoritos, etc.)</label>
                    <input
                      type="text"
                      placeholder="Digite e pressione Enter para adicionar"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const value = input.value.trim();
                          if (value) {
                            addDetail(interest.categoryId, value);
                            input.value = '';
                          }
                          e.preventDefault();
                        }
                      }}
                    />
                    {interest.details.length > 0 && (
                      <div className="details-tags">
                        {interest.details.map((detail, idx) => (
                          <span key={idx} className="detail-tag">
                            {detail}
                            <button
                              onClick={() => removeDetail(interest.categoryId, detail)}
                              className="remove-tag-button"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="notes-input-group">
                    <label>Observações</label>
                    <textarea
                      value={interest.notes}
                      onChange={(e) => updateInterest(interest.categoryId, 'notes', e.target.value)}
                      placeholder="Observações adicionais sobre esta atividade de prazer..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estilo de Vida */}
      <div className="lifestyle-section">
        <h3>Estilo de Vida</h3>
        <div className="lifestyle-grid">
          <div className="lifestyle-field">
            <label htmlFor="drinks">Bebidas Alcoólicas</label>
            <select
              id="drinks"
              value={lifestyle.drinks || ''}
              onChange={(e) => setLifestyle({ ...lifestyle, drinks: e.target.value as any || null })}
            >
              <option value="">Prefiro não informar</option>
              <option value="never">Nunca</option>
              <option value="socially">Socialmente</option>
              <option value="regularly">Regularmente</option>
            </select>
          </div>

          <div className="lifestyle-field">
            <label htmlFor="smokes">Fuma</label>
            <select
              id="smokes"
              value={lifestyle.smokes || ''}
              onChange={(e) => setLifestyle({ ...lifestyle, smokes: e.target.value as any || null })}
            >
              <option value="">Prefiro não informar</option>
              <option value="never">Nunca</option>
              <option value="occasionally">Ocasionalmente</option>
              <option value="regularly">Regularmente</option>
            </select>
          </div>

          <div className="lifestyle-field">
            <label htmlFor="relationshipStatus">Status de Relacionamento</label>
            <select
              id="relationshipStatus"
              value={lifestyle.relationshipStatus || ''}
              onChange={(e) => setLifestyle({ ...lifestyle, relationshipStatus: e.target.value as any || null })}
            >
              <option value="">Prefiro não informar</option>
              <option value="single">Solteiro(a)</option>
              <option value="dating">Namorando</option>
              <option value="in_relationship">Em relacionamento</option>
              <option value="married">Casado(a)</option>
            </select>
          </div>

          <div className="lifestyle-field">
            <label htmlFor="sexualOrientation">Orientação Sexual</label>
            <select
              id="sexualOrientation"
              value={lifestyle.sexualOrientation || ''}
              onChange={(e) => setLifestyle({ ...lifestyle, sexualOrientation: e.target.value as any || null })}
            >
              <option value="">Prefiro não informar</option>
              <option value="heterosexual">Heterossexual</option>
              <option value="homosexual">Homossexual</option>
              <option value="bisexual">Bissexual</option>
              <option value="pansexual">Pansexual</option>
              <option value="asexual">Assexual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Botão Salvar */}
      <div className="form-actions">
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Salvando...' : 'Salvar Perfil Físico'}
        </button>
      </div>

      {/* Modal de Sugestão de Categoria */}
      {showSuggestionModal && categorySuggestion && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sugerir Nova Atividade de Prazer</h3>
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
                  <strong>Interesse sugerido:</strong> "{categorySuggestion.leafName}"
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
                    <li>O interesse <strong>não aparecerá imediatamente</strong> no sistema</li>
                    <li>Ele será <strong>revisado pela equipe</strong> antes da aprovação</li>
                    <li>Você receberá uma notificação quando for aprovado</li>
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

