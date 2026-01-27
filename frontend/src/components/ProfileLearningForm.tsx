import type { CategoryTree, Category, CategoryAutocompleteResult, CategoryPathSuggestion } from '../api/categories';

interface SelectedLearning {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  details: string[];
  notes: string;
  progress: 'beginner' | 'intermediate' | 'advanced' | null;
}

interface ProfileLearningFormProps {
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchFieldError: string | null;
  setSearchFieldError: (error: string | null) => void;
  autocompleteResults: CategoryAutocompleteResult[];
  showAutocomplete: boolean;
  setShowAutocomplete: (show: boolean) => void;
  isSearching: boolean;
  isCreatingWithAI: boolean;
  autocompleteError: string | null;
  aiAssistEnabled: boolean;
  recognition: any | null;
  isRecording: boolean;
  searchResults: Category[];
  categoryTree: CategoryTree[];
  selectedLearnings: SelectedLearning[];
  expandedCategories: Set<string>;
  showSuggestionModal: boolean;
  categorySuggestion: CategoryPathSuggestion | null;
  isSuggesting: boolean;
  suggestionError: string | null;
  isSaving: boolean;
  handleSearch: (term: string) => Promise<void>;
  handleSelectAutocomplete: (result: CategoryAutocompleteResult) => void;
  handleSuggestCategory: () => Promise<void>;
  handleCreateWithAI: (parentId?: string | null) => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  toggleCategory: (categoryId: string) => void;
  isLearningSelected: (categoryId: string) => boolean;
  addLearning: (category: Category) => void;
  removeLearning: (categoryId: string) => void;
  updateLearning: (categoryId: string, field: 'details' | 'notes' | 'progress', value: string[] | string | 'beginner' | 'intermediate' | 'advanced' | null) => void;
  handleSave: () => Promise<void>;
  renderCategoryTree: (categories: CategoryTree[], level?: number) => JSX.Element[];
  setShowSuggestionModal: (show: boolean) => void;
  setCategorySuggestion: (suggestion: CategoryPathSuggestion | null) => void;
}

export default function ProfileLearningForm({
  error,
  searchTerm,
  setSearchTerm,
  searchFieldError,
  setSearchFieldError,
  autocompleteResults,
  showAutocomplete,
  setShowAutocomplete,
  isSearching,
  isCreatingWithAI,
  autocompleteError,
  aiAssistEnabled,
  recognition,
  isRecording,
  searchResults,
  categoryTree,
  selectedLearnings,
  expandedCategories,
  showSuggestionModal,
  categorySuggestion,
  isSuggesting,
  suggestionError,
  isSaving,
  handleSearch,
  handleSelectAutocomplete,
  handleSuggestCategory,
  handleCreateWithAI,
  startRecording,
  stopRecording,
  toggleCategory,
  isLearningSelected,
  addLearning,
  removeLearning,
  updateLearning,
  handleSave,
  renderCategoryTree,
  setShowSuggestionModal,
  setCategorySuggestion,
}: ProfileLearningFormProps) {
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
                  // Se há resultados, selecionar o primeiro (se for nível 2)
                  const firstResult = autocompleteResults[0];
                  if (firstResult.level === 2) {
                    handleSelectAutocomplete(firstResult);
                  } else {
                    setSearchFieldError('Por favor, selecione um tema de aprendizado específico (nível 2) da lista.');
                  }
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



