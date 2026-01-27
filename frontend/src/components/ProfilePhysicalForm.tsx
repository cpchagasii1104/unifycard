type LifeDomain = 
  | 'atividades_e_praticas'
  | 'lazer_e_entretenimento'
  | 'leitura_e_conteudo'
  | 'musica_e_cultura'
  | 'gastronomia_e_consumo'
  | 'habitos_e_rotinas'
  | 'experiencias_viagens_e_eventos';

type InterestState = 'gosto' | 'pratico_as_vezes' | 'pratico_regularmente';

type ConceptId = string;

interface ConceptDefinition {
  conceptId: ConceptId;
  label: string;
  domain: LifeDomain;
}

interface UserInterest {
  conceptId: ConceptId;
  label: string;
  state: InterestState;
  domain: LifeDomain;
  isCustom: boolean;
}

interface PhysicalProfileData {
  interests: UserInterest[];
  habits: {
    smoking: 'não_fumo' | 'ocasionalmente' | 'regularmente' | null;
    drinking: 'não_bebo' | 'socialmente' | 'regularmente' | null;
  };
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

interface LifeDomainConfig {
  id: LifeDomain;
  label: string;
  icon?: string;
}

interface ProfilePhysicalFormProps {
  error: string | null;
  activeDomain: LifeDomain | null;
  setActiveDomain: (domain: LifeDomain | null) => void;
  profileData: PhysicalProfileData;
  lifestyle: any;
  customInterestInput: Record<LifeDomain, string>;
  setCustomInterestInput: (input: Record<LifeDomain, string>) => void;
  isSaving: boolean;
  LIFE_DOMAINS: LifeDomainConfig[];
  getInterestsByDomain: (domain: LifeDomain) => UserInterest[];
  getConceptsByDomain: (domain: LifeDomain) => ConceptDefinition[];
  isConceptSelected: (conceptId: ConceptId) => boolean;
  updateInterestState: (conceptId: ConceptId, state: InterestState) => void;
  removeInterest: (conceptId: ConceptId) => void;
  addPredefinedInterest: (concept: ConceptDefinition, state: InterestState) => void;
  addCustomInterest: (domain: LifeDomain, state: InterestState) => void;
  updateHabits: (field: 'smoking' | 'drinking', value: PhysicalProfileData['habits']['smoking'] | PhysicalProfileData['habits']['drinking']) => void;
  updateWeeklyRoutine: (routine: PhysicalProfileData['weeklyRoutine']) => void;
  toggleGoal: (goal: 'estética' | 'bem_estar' | 'condicionamento') => void;
  setLifestyle: (lifestyle: any) => void;
  handleSave: () => void;
}

export default function ProfilePhysicalForm({
  error,
  activeDomain,
  setActiveDomain,
  profileData,
  lifestyle,
  customInterestInput,
  setCustomInterestInput,
  isSaving,
  LIFE_DOMAINS,
  getInterestsByDomain,
  getConceptsByDomain,
  isConceptSelected,
  updateInterestState,
  removeInterest,
  addPredefinedInterest,
  addCustomInterest,
  updateHabits,
  updateWeeklyRoutine,
  toggleGoal,
  setLifestyle,
  handleSave,
}: ProfilePhysicalFormProps) {
  return (
    <div className="profile-physical">
      <h2>Interesses e Gostos</h2>
      <p className="section-description" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        Espaço para declarar interesses, gostos e práticas do seu dia a dia.
        Essas informações servem apenas para sugestões e descobertas.
        Elas não definem quem você é nem determinam decisões no sistema.
      </p>

      {error && <div className="error-message">{error}</div>}

      {/* Navegação por Domínios */}
      <div className="domains-navigation" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveDomain(null)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: activeDomain === null ? '#3b82f6' : '#e5e7eb',
              color: activeDomain === null ? 'white' : '#374151',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Todos
          </button>
          {LIFE_DOMAINS.map((domain) => (
            <button
              key={domain.id}
              type="button"
              onClick={() => setActiveDomain(domain.id)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: activeDomain === domain.id ? '#3b82f6' : '#e5e7eb',
                color: activeDomain === domain.id ? 'white' : '#374151',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              {domain.label}
            </button>
          ))}
        </div>
      </div>

      {/* Domínios de Vida */}
      {LIFE_DOMAINS.map((domain) => {
        // Filtrar por domínio ativo (se houver seleção)
        if (activeDomain !== null && activeDomain !== domain.id) {
          return null;
        }

        const domainInterests = getInterestsByDomain(domain.id);
        const domainConcepts = getConceptsByDomain(domain.id);

        return (
          <div key={domain.id} className="domain-section" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{domain.label}</h3>
            
            {/* Interesses Selecionados do Domínio */}
            {domainInterests.length > 0 && (
              <div className="selected-interests" style={{ marginBottom: '1rem' }}>
                {domainInterests.map((interest) => (
                  <div key={interest.conceptId} className="interest-chip" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '0.5rem 1rem',
                    margin: '0.25rem',
                    backgroundColor: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '1.5rem',
                  }}>
                    <span style={{ marginRight: '0.5rem' }}>{interest.label}</span>
                    <select
                      value={interest.state}
                      onChange={(e) => updateInterestState(interest.conceptId, e.target.value as InterestState)}
                      style={{ marginRight: '0.5rem', padding: '0.25rem', fontSize: '0.875rem' }}
                    >
                      <option value="gosto">Gosto</option>
                      <option value="pratico_as_vezes">Pratico às vezes</option>
                      <option value="pratico_regularmente">Pratico regularmente</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeInterest(interest.conceptId)}
                      style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Conceitos Pré-definidos */}
            {domainConcepts.length > 0 && (
              <div className="predefined-concepts" style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Selecione interesses:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {domainConcepts.map((concept) => {
                    const isSelected = isConceptSelected(concept.conceptId);

                    if (isSelected) {
                      return null; // Já está na lista de selecionados
                    }

                    return (
                      <button
                        key={concept.conceptId}
                        type="button"
                        onClick={() => addPredefinedInterest(concept, 'gosto')}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#e5e7eb',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                        }}
                      >
                        + {concept.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Digitação Livre */}
            <div className="custom-interest-input" style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Ou digite um interesse:</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={customInterestInput[domain.id]}
                  onChange={(e) => setCustomInterestInput({ ...customInterestInput, [domain.id]: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && customInterestInput[domain.id].trim()) {
                      e.preventDefault();
                      addCustomInterest(domain.id, 'gosto');
                    }
                  }}
                  placeholder={`Digite um interesse em ${domain.label.toLowerCase()}...`}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                />
                <select
                  value="gosto"
                  onChange={(e) => {
                    if (customInterestInput[domain.id].trim()) {
                      addCustomInterest(domain.id, e.target.value as InterestState);
                    }
                  }}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
                >
                  <option value="gosto">Gosto</option>
                  <option value="pratico_as_vezes">Pratico às vezes</option>
                  <option value="pratico_regularmente">Pratico regularmente</option>
                </select>
              </div>
            </div>
          </div>
        );
      })}

      {/* Hábitos */}
      <div className="habits-section" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3>Hábitos</h3>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Declare seus hábitos. Tudo é opcional e declarativo.
        </p>

        <div className="habits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="habit-field">
            <label htmlFor="smoking">Fumo</label>
            <select
              id="smoking"
              value={profileData.habits.smoking || ''}
              onChange={(e) => updateHabits('smoking', e.target.value as PhysicalProfileData['habits']['smoking'] || null)}
            >
              <option value="">Prefiro não informar</option>
              <option value="não_fumo">Não fumo</option>
              <option value="ocasionalmente">Ocasionalmente</option>
              <option value="regularmente">Regularmente</option>
            </select>
          </div>

          <div className="habit-field">
            <label htmlFor="drinking">Bebidas Alcoólicas</label>
            <select
              id="drinking"
              value={profileData.habits.drinking || ''}
              onChange={(e) => updateHabits('drinking', e.target.value as PhysicalProfileData['habits']['drinking'] || null)}
            >
              <option value="">Prefiro não informar</option>
              <option value="não_bebo">Não bebo</option>
              <option value="socialmente">Socialmente</option>
              <option value="regularmente">Regularmente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Rotina Semanal */}
      <div className="routine-section" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3>Rotina Semanal</h3>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Declare sua rotina semanal de atividades físicas. Tudo é opcional e declarativo.
        </p>

        <div className="routine-options" style={{ display: 'flex', gap: '1rem' }}>
          {(['leve', 'moderada', 'intensa'] as const).map((routine) => (
            <label key={routine} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="weeklyRoutine"
                value={routine}
                checked={profileData.weeklyRoutine === routine}
                onChange={() => updateWeeklyRoutine(routine)}
                style={{ marginRight: '0.5rem' }}
              />
              <span style={{ textTransform: 'capitalize' }}>{routine}</span>
            </label>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="radio"
              name="weeklyRoutine"
              value=""
              checked={profileData.weeklyRoutine === null}
              onChange={() => updateWeeklyRoutine(null)}
              style={{ marginRight: '0.5rem' }}
            />
            <span>Prefiro não informar</span>
          </label>
        </div>
      </div>

      {/* Objetivos Físicos */}
      <div className="goals-section" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3>Objetivos Físicos</h3>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Selecione seus objetivos físicos (pode selecionar múltiplos). Tudo é opcional e declarativo.
        </p>

        <div className="goals-options" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {(['estética', 'bem_estar', 'condicionamento'] as const).map((goal) => (
            <label key={goal} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={profileData.goals.includes(goal)}
                onChange={() => toggleGoal(goal)}
                style={{ marginRight: '0.5rem' }}
              />
              <span style={{ textTransform: 'capitalize' }}>
                {goal === 'estética' ? 'Estética' :
                 goal === 'bem_estar' ? 'Bem-Estar' :
                 'Condicionamento'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Estilo de Vida (mantido para compatibilidade) */}
      <div className="lifestyle-section" style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3>Estilo de Vida</h3>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Informações adicionais de estilo de vida. Tudo é opcional e declarativo.
        </p>
        <div className="lifestyle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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
      <div className="form-actions" style={{ marginTop: '2rem' }}>
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Salvando...' : 'Salvar Interesses e Gostos'}
        </button>
      </div>
    </div>
  );
}



