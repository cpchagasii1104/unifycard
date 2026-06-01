// src/components/ProfilePhysicalForm.tsx
// Fatia 4c (DECISION-0067): seção de Interesses navega a árvore real scope='interest' (C1) — o catálogo
// hardcoded por domínios foi removido. Hábitos/Rotina/Objetivos/Estilo de Vida permanecem LEGADOS (intocados).
import type { CategoryTree } from '../api/categories';
import type { SelectedInterest } from '../hooks/useProfilePhysicalState';

interface PhysicalProfileData {
  interests: any[];
  habits: {
    smoking: 'não_fumo' | 'ocasionalmente' | 'regularmente' | null;
    drinking: 'não_bebo' | 'socialmente' | 'regularmente' | null;
  };
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

interface ProfilePhysicalFormProps {
  error: string | null;
  interestError: string | null;
  profileData: PhysicalProfileData;
  lifestyle: any;
  isSaving: boolean;
  interestTree: CategoryTree[];
  selectedInterests: SelectedInterest[];
  isInterestSelected: (categoryId: string) => boolean;
  removeInterest: (categoryId: string) => void;
  renderInterestTree: (categories: CategoryTree[], level?: number) => JSX.Element[];
  updateHabits: (field: 'smoking' | 'drinking', value: PhysicalProfileData['habits']['smoking'] | PhysicalProfileData['habits']['drinking']) => void;
  updateWeeklyRoutine: (routine: PhysicalProfileData['weeklyRoutine']) => void;
  toggleGoal: (goal: 'estética' | 'bem_estar' | 'condicionamento') => void;
  setLifestyle: (lifestyle: any) => void;
  handleSave: () => void;
}

export default function ProfilePhysicalForm({
  error,
  interestError,
  profileData,
  lifestyle,
  isSaving,
  interestTree,
  selectedInterests,
  removeInterest,
  renderInterestTree,
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

      {/* Interesses — árvore real scope='interest' (C1) */}
      <div className="interests-section" style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Interesses</h3>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Navegue pelas categorias e adicione os interesses que combinam com você.
        </p>

        {interestError && (
          <div className="interest-error" style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {interestError}
          </div>
        )}

        {/* Interesses Selecionados (binário) */}
        {selectedInterests.length > 0 && (
          <div className="selected-interests" style={{ marginBottom: '1rem' }}>
            {selectedInterests.map((interest) => (
              <div key={interest.categoryId} className="interest-chip" style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                margin: '0.25rem',
                backgroundColor: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '1.5rem',
              }}>
                <span
                  style={{ marginRight: '0.5rem' }}
                  title={interest.categoryPath.length > 0 ? interest.categoryPath.join(' > ') + ' > ' + interest.categoryName : interest.categoryName}
                >
                  {interest.categoryName}
                </span>
                <button
                  type="button"
                  onClick={() => removeInterest(interest.categoryId)}
                  style={{ padding: '0.25rem', border: 'none', background: 'none', cursor: 'pointer' }}
                  aria-label={`Remover ${interest.categoryName}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Árvore de Interesses */}
        <div className="interest-tree">
          {interestTree.length > 0 ? (
            renderInterestTree(interestTree)
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Nenhuma categoria de interesse disponível no momento.</p>
          )}
        </div>
      </div>

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
