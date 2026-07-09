// src/components/ProfilePhysicalForm.tsx
// F3 (DECISION-0071): "Estilo de Vida" (relationship_status/drinks/smokes) usa o SSOT Lifestyle actor-first
// (consent explícito + visibility privada). `sexualOrientation` foi REMOVIDO. Interesses = C1 (Fatia 4c).
// Rotina/Objetivos permanecem legados (não sensíveis). Hábitos (antiga seção) virou parte do Estilo de Vida SSOT.
import type { CategoryTree } from '../api/categories';
import type { SelectedInterest, LifestyleAttrsState } from '../hooks/useProfilePhysicalState';
import type { LifestyleAttributeKey } from '../api/lifestyle';

interface PhysicalProfileData {
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

interface ProfilePhysicalFormProps {
  error: string | null;
  interestError: string | null;
  profileData: PhysicalProfileData;
  lifestyleAttrs: LifestyleAttrsState;
  lifestyleConsent: boolean;
  setLifestyleConsent: (v: boolean) => void;
  lifestyleError: string | null;
  updateLifestyleAttr: (key: LifestyleAttributeKey, value: string) => void;
  isSaving: boolean;
  interestTree: CategoryTree[];
  selectedInterests: SelectedInterest[];
  isInterestSelected: (categoryId: string) => boolean;
  removeInterest: (categoryId: string) => void;
  renderInterestTree: (categories: CategoryTree[], level?: number) => JSX.Element[];
  subjectQuery: string;
  setSubjectQuery: (q: string) => void;
  subjectResults: Array<{ conceptId: string; label: string }>;
  addSubjectInterest: (subject: { conceptId: string; label: string }) => void;
  updateWeeklyRoutine: (routine: PhysicalProfileData['weeklyRoutine']) => void;
  toggleGoal: (goal: 'estética' | 'bem_estar' | 'condicionamento') => void;
  handleSave: () => void;
}

const SECTION_STYLE = { marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' } as const;

export default function ProfilePhysicalForm({
  error,
  interestError,
  profileData,
  lifestyleAttrs,
  lifestyleConsent,
  setLifestyleConsent,
  lifestyleError,
  updateLifestyleAttr,
  isSaving,
  interestTree,
  selectedInterests,
  removeInterest,
  renderInterestTree,
  subjectQuery,
  setSubjectQuery,
  subjectResults,
  addSubjectInterest,
  updateWeeklyRoutine,
  toggleGoal,
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
          Busque um assunto (futebol, sinuca, música…) ou navegue pelas categorias.
        </p>

        {/* Busca no POOL DE ASSUNTO (RFC-SHARED-SUBJECT-CONCEPT-POOL) — mesma fonte do tema de evento. */}
        <div className="interest-subject-search" style={{ marginBottom: '1rem', position: 'relative' }}>
          <input
            type="text"
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
            placeholder="Buscar assunto: futebol, sinuca, churrasco, música…"
            style={{ width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
          />
          {subjectResults.length > 0 && (
            <div className="interest-subject-results" style={{
              marginTop: '0.25rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', background: 'white',
              maxHeight: '12rem', overflowY: 'auto',
            }}>
              {subjectResults.map((s) => (
                <button key={s.conceptId} type="button" onClick={() => addSubjectInterest(s)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer' }}>
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {subjectQuery.trim().length >= 2 && subjectResults.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Não encontrei esse assunto. Nada de texto livre é salvo — é um conceito governado.
            </p>
          )}
        </div>

        {interestError && (
          <div className="interest-error" style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {interestError}
          </div>
        )}

        {selectedInterests.length > 0 && (
          <div className="selected-interests" style={{ marginBottom: '1rem' }}>
            {selectedInterests.map((interest) => (
              <div key={interest.categoryId} className="interest-chip" style={{
                display: 'inline-flex', alignItems: 'center', padding: '0.5rem 1rem', margin: '0.25rem',
                backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '1.5rem',
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

        <div className="interest-tree">
          {interestTree.length > 0 ? (
            renderInterestTree(interestTree)
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Nenhuma categoria de interesse disponível no momento.</p>
          )}
        </div>
      </div>

      {/* Estilo de Vida — SSOT actor-first (privado, com consentimento) */}
      <div className="lifestyle-section" style={SECTION_STYLE}>
        <h3 style={{ marginBottom: '0.25rem' }}>Estilo de Vida <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>🔒 Privado</span></h3>
        <p className="field-hint" style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Informações pessoais opcionais. São <strong>privadas</strong> (apenas você vê), não são usadas para
          recomendação/matching, e só são salvas com o seu consentimento explícito.
        </p>

        {lifestyleError && (
          <div className="lifestyle-error" style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {lifestyleError}
          </div>
        )}

        <div className="lifestyle-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="lifestyle-field">
            <label htmlFor="relationship_status">Status de Relacionamento</label>
            <select
              id="relationship_status"
              value={lifestyleAttrs.relationship_status || ''}
              onChange={(e) => updateLifestyleAttr('relationship_status', e.target.value)}
            >
              <option value="">Prefiro não informar</option>
              <option value="single">Solteiro(a)</option>
              <option value="dating">Namorando</option>
              <option value="in_relationship">Em relacionamento</option>
              <option value="married">Casado(a)</option>
              <option value="prefer_not_to_say">Prefiro não dizer</option>
            </select>
          </div>

          <div className="lifestyle-field">
            <label htmlFor="drinks">Bebidas Alcoólicas</label>
            <select
              id="drinks"
              value={lifestyleAttrs.drinks || ''}
              onChange={(e) => updateLifestyleAttr('drinks', e.target.value)}
            >
              <option value="">Prefiro não informar</option>
              <option value="never">Não bebo</option>
              <option value="socially">Socialmente</option>
              <option value="regularly">Regularmente</option>
              <option value="prefer_not_to_say">Prefiro não dizer</option>
            </select>
          </div>

          <div className="lifestyle-field">
            <label htmlFor="smokes">Fumo</label>
            <select
              id="smokes"
              value={lifestyleAttrs.smokes || ''}
              onChange={(e) => updateLifestyleAttr('smokes', e.target.value)}
            >
              <option value="">Prefiro não informar</option>
              <option value="never">Não fumo</option>
              <option value="occasionally">Ocasionalmente</option>
              <option value="regularly">Regularmente</option>
              <option value="prefer_not_to_say">Prefiro não dizer</option>
            </select>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '1rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={lifestyleConsent}
            onChange={(e) => setLifestyleConsent(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          <span>Consinto em declarar estas informações pessoais (privadas, apenas eu vejo).</span>
        </label>
      </div>

      {/* Rotina Semanal (legado, não sensível) */}
      <div className="routine-section" style={SECTION_STYLE}>
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

      {/* Objetivos Físicos (legado, não sensível) */}
      <div className="goals-section" style={SECTION_STYLE}>
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
                {goal === 'estética' ? 'Estética' : goal === 'bem_estar' ? 'Bem-Estar' : 'Condicionamento'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: '2rem' }}>
        <button onClick={handleSave} disabled={isSaving} className="save-button">
          {isSaving ? 'Salvando...' : 'Salvar Interesses e Gostos'}
        </button>
      </div>
    </div>
  );
}
