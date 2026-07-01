import type { Category, CategoryAutocompleteResult, CategoryTree, CategoryPathSuggestion } from '../api/categories';
import type { ProfessionalConceptCandidate } from '../api/professionalC1';
import { normalizeCategoryLabel, normalizeCategoryPath } from '../utils/categoryLabelNormalizer';

// A3.2 tab-only / C1: aba Profissional só renderiza bio + competências (conceptId/skillLevel/yearsExperience).
// Preço/serviços/availability/workers/capability/authority ficam fora (C2/C3/C4) — "em breve".
interface SelectedSkill {
  categoryId: string;
  conceptId: string;
  sourceCategoryId: string | null;
  categoryName: string;
  categoryPath: string[];
  skillLevel: number;
  yearsExperience: number;
}

interface ProfileProfessionalFormProps {
  error: string | null;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: Category[];
  autocompleteResults: CategoryAutocompleteResult[];
  showAutocomplete: boolean;
  setShowAutocomplete: (show: boolean) => void;
  isSearching: boolean;
  autocompleteError: string | null;
  isCreatingWithAI: boolean;
  isRecording: boolean;
  aiAssistEnabled: boolean;
  recognition: any | null;
  searchFieldError: string | null;
  setSearchFieldError: (error: string | null) => void;
  handleSearch: (term: string) => void;
  handleSelectAutocomplete: (result: CategoryAutocompleteResult) => void;
  // F-SERVICE-PROFESSIONAL-CAPABILITY-ALIAS-SELECTOR-SLICE-A — candidatos de concept vindos da ponte de
  // alias (fallback quando a CATEGORIA não entende o termo). O usuário escolhe 1 → addSkillFromConcept.
  aliasConceptResults: ProfessionalConceptCandidate[];
  aliasSearching: boolean;
  addSkillFromConcept: (candidate: ProfessionalConceptCandidate) => void;
  handleSuggestCategory: () => void;
  isSuggesting: boolean;
  suggestionError: string | null;
  categoryTree: CategoryTree[];
  isLoading: boolean;
  selectedSkills: SelectedSkill[];
  newlyAddedSkillId: string | null;
  skillErrors: Record<string, string>;
  userAge: number | undefined;
  bio: string;
  setBio: (bio: string) => void;
  isSaving: boolean;
  handleSave: () => void;
  isSkillSelected: (categoryId: string) => boolean;
  addSkill: (category: Category) => void;
  removeSkill: (categoryId: string) => void;
  updateSkill: (categoryId: string, field: 'skillLevel' | 'yearsExperience', value: number) => void;
  renderCategoryTree: (categories: CategoryTree[]) => JSX.Element[];
  showSuggestionModal: boolean;
  setShowSuggestionModal: (show: boolean) => void;
  categorySuggestion: CategoryPathSuggestion | null;
  setCategorySuggestion: (suggestion: CategoryPathSuggestion | null) => void;
  handleCreateWithAI: (parentId?: string | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
}

export default function ProfileProfessionalForm({
  error,
  searchTerm,
  setSearchTerm,
  searchResults,
  autocompleteResults,
  showAutocomplete,
  setShowAutocomplete,
  isSearching,
  autocompleteError,
  isCreatingWithAI,
  isRecording,
  aiAssistEnabled,
  recognition,
  searchFieldError,
  setSearchFieldError,
  handleSearch,
  handleSelectAutocomplete,
  aliasConceptResults,
  aliasSearching,
  addSkillFromConcept,
  handleSuggestCategory,
  isSuggesting,
  suggestionError,
  categoryTree,
  isLoading,
  selectedSkills,
  newlyAddedSkillId,
  skillErrors,
  userAge,
  bio,
  setBio,
  isSaving,
  handleSave,
  isSkillSelected,
  addSkill,
  removeSkill,
  updateSkill,
  renderCategoryTree,
  showSuggestionModal,
  setShowSuggestionModal,
  categorySuggestion,
  setCategorySuggestion,
  handleCreateWithAI,
  startRecording,
  stopRecording,
}: ProfileProfessionalFormProps) {
  return (
    <div className="profile-professional">
      <h2>Área de atuação profissional</h2>

      {error && <div className="error-message">{error}</div>}
      
      <p className="section-description">
        Adicione suas profissões e configure como deseja trabalhar.
      </p>

      {/* Informação sobre Agenda */}
      <div className="agenda-info-section" style={{
        padding: '1rem',
        backgroundColor: '#f0f9ff',
        border: '1px solid #bae6fd',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem'
      }}>
        <p style={{ margin: 0, color: '#0369a1' }}>
          <strong>📅 Agenda:</strong> Configure sua agenda unificada na aba <strong>Agenda</strong>. 
          Sua agenda é unificada para todas as profissões.
        </p>
      </div>

      {/* Busca Inteligente com Autocomplete */}
      <div className="search-section">
        <label htmlFor="category-search">
          Área de atuação profissional <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          Refere-se ao setor em que você presta serviços ou atua economicamente. Não descreve características pessoais.
        </p>
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
                  <div className="autocomplete-item-name">{normalizeCategoryLabel(result.name)}</div>
                  <div className="autocomplete-item-path">{normalizeCategoryLabel(result.fullPathLabel)}</div>
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

        {/* F-SERVICE-PROFESSIONAL-CAPABILITY-ALIAS-SELECTOR-SLICE-A — indicador de busca da ponte de alias
            (categoria não entendeu o termo; tentando "barbeiro" → concept). */}
        {aliasSearching && aliasConceptResults.length === 0 && !showAutocomplete && (
          <div className="search-loading" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Procurando competências para "{searchTerm}"...
          </div>
        )}

        {/* F-SERVICE-PROFESSIONAL-CAPABILITY-ALIAS-SELECTOR-SLICE-A — DESAMBIGUAÇÃO OBRIGATÓRIA.
            A busca por CATEGORIA não entendeu o termo humano, mas a ponte de alias (advisory, read-only)
            apontou concept(s). Regra dura: o usuário ESCOLHE exatamente 1 (mesmo quando há só 1 candidato,
            exige clique) — NUNCA first-match, NUNCA declara N. displayName é apresentação (fallback slug);
            concept_id é a identidade declarada. Nada é gravado aqui — só ao clicar + salvar (fluxo R3). */}
        {!showAutocomplete && aliasConceptResults.length > 0 && (
          <div className="alias-concept-disambiguation" style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: '#eff6ff',
            border: '1px solid #3b82f6',
            borderRadius: '0.375rem',
          }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#1e3a8a' }}>
              {aliasConceptResults.length === 1
                ? `Encontramos 1 competência relacionada a "${searchTerm}":`
                : `Encontramos ${aliasConceptResults.length} competências relacionadas a "${searchTerm}":`}
            </p>
            <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
              Escolha a que corresponde ao que você faz. É preciso selecionar — nada é declarado
              automaticamente.
            </p>
            <div className="alias-concept-list">
              {aliasConceptResults.map((candidate) => {
                const label = candidate.displayName ?? candidate.slug;
                const already = isSkillSelected(`concept:${candidate.conceptId}`);
                return (
                  <div
                    key={candidate.conceptId}
                    className={`search-result-item ${already ? 'selected' : ''}`}
                    onClick={() => !already && addSkillFromConcept(candidate)}
                    onMouseDown={(e) => e.preventDefault()} // prevenir blur antes do clique
                    style={{ cursor: already ? 'default' : 'pointer' }}
                  >
                    <div className="result-path">{normalizeCategoryLabel(label)}</div>
                    {already ? (
                      <span className="skill-badge">✓ Já adicionada</span>
                    ) : (
                      <button type="button" className="add-button-small">+ Selecionar</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REGRA FINAL: Mostrar "Sugerir Profissão" APENAS se:
            - Termo tem 2+ caracteres
            - NÃO houve erro (erro ≠ ausência de dado)
            - Autocomplete retornou 0 resultados (legítimos)
            - A ponte de alias TAMBÉM não achou concept (senão o usuário desambigua acima)
            - NÃO está buscando (categoria nem alias)
            - NÃO está mostrando dropdown
            CRÍTICO: Se há erro, mostrar erro. Não sugerir criação quando há problema de rede/auth. */}
        {searchTerm.trim().length >= 2 &&
         !autocompleteError &&
         autocompleteResults.length === 0 &&
         aliasConceptResults.length === 0 &&
         !aliasSearching &&
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
                  ? normalizeCategoryPath([...category.path, category.name], ' > ')
                  : normalizeCategoryLabel(category.name);
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
                      <h4>{normalizeCategoryLabel(skill.categoryName)}</h4>
                      <p className="skill-path">{normalizeCategoryPath(skill.categoryPath, ' > ')}</p>
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
                    {/* A3.2/C1: preço, serviços, disponibilidade e outras capacidades NÃO são declarados aqui. */}
                    <div className="skill-field">
                      <p className="field-hint" style={{ color: '#6b7280' }}>
                        💡 Preço, serviços ofertados e disponibilidade chegam em breve (em outra etapa).
                        Aqui você declara a competência e o nível.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                  <strong>Profissão sugerida:</strong> "{normalizeCategoryLabel(categorySuggestion.leafName)}"
                </p>
                
                {categorySuggestion.suggestedRoot && categorySuggestion.suggestedParent && (
                  <div className="suggestion-path">
                    <p className="path-label">Caminho sugerido:</p>
                    <div className="path-display">
                      <span className="path-root">{normalizeCategoryLabel(categorySuggestion.suggestedRoot.name)}</span>
                      <span className="path-separator">›</span>
                      <span className="path-parent">{normalizeCategoryLabel(categorySuggestion.suggestedParent.name)}</span>
                      <span className="path-separator">›</span>
                      <span className="path-leaf">{normalizeCategoryLabel(categorySuggestion.leafName)}</span>
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

