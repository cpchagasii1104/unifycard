import { useMemo } from 'react';
import type { EducationProfile, EducationEntry, EducationEventType, EducationType } from '../api/education';

interface ProfileEducationFormProps {
  profile: EducationProfile | null;
  error: string | null;
  showCreateForm: boolean;
  setShowCreateForm: (show: boolean) => void;
  formEventType: EducationEventType;
  setFormEventType: (type: EducationEventType) => void;
  formType: EducationType;
  setFormType: (type: EducationType) => void;
  formInstitution: string;
  setFormInstitution: (value: string) => void;
  formCourse: string;
  setFormCourse: (value: string) => void;
  formStartDate: string;
  setFormStartDate: (value: string) => void;
  formEndDate: string | null;
  setFormEndDate: (value: string | null) => void;
  formDescription: string;
  setFormDescription: (value: string) => void;
  formReason: string;
  setFormReason: (value: string) => void;
  formEducationId: string;
  setFormEducationId: (value: string) => void;
  formAuthorName: string;
  setFormAuthorName: (value: string) => void;
  formAuthorRelation: string;
  setFormAuthorRelation: (value: string) => void;
  formContext: string;
  setFormContext: (value: string) => void;
  isCreating: boolean;
  isValidEventType: (eventType: string) => eventType is EducationEventType;
  isThirdPartyEvent: (eventType: EducationEventType) => boolean;
  getEventTypeLabel: (eventType: EducationEventType) => string;
  getEventTypeColor: (eventType: EducationEventType) => string;
  formatDate: (dateStr?: string) => string;
  CANONICAL_EVENT_TYPES: readonly EducationEventType[];
  resetForm: () => void;
  handleCreateEvent: () => Promise<void>;
}

export default function ProfileEducationForm({
  profile,
  error,
  showCreateForm,
  setShowCreateForm,
  formEventType,
  setFormEventType,
  formType,
  setFormType,
  formInstitution,
  setFormInstitution,
  formCourse,
  setFormCourse,
  formStartDate,
  setFormStartDate,
  formEndDate,
  setFormEndDate,
  formDescription,
  setFormDescription,
  formReason,
  setFormReason,
  formEducationId,
  setFormEducationId,
  formAuthorName,
  setFormAuthorName,
  formAuthorRelation,
  setFormAuthorRelation,
  formContext,
  setFormContext,
  isCreating,
  isValidEventType,
  isThirdPartyEvent,
  getEventTypeLabel,
  getEventTypeColor,
  formatDate,
  CANONICAL_EVENT_TYPES,
  resetForm,
  handleCreateEvent,
}: ProfileEducationFormProps) {
  const sortedEducation = useMemo(() => {
    if (!profile || !profile.education) return [];
    
    return [...profile.education].sort((a, b) => {
      if (!a.startDate && !b.startDate) return 0;
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });
  }, [profile]);

  return (
    <div className="profile-education-container">
      <div className="profile-education-header">
        <h2>Educação</h2>
        <p className="section-description">
          <strong>Histórico educacional declarativo</strong> — estas informações são temporais e baseadas em eventos.
          <em> Não são usadas para filtros, bloqueios ou decisões automáticas.</em>
        </p>
        <p style={{ 
          fontSize: '0.75rem', 
          color: '#9ca3af', 
          marginTop: '0.5rem',
          fontStyle: 'italic',
        }}>
          ⚠️ Este módulo não calcula score, não ordena por importância e não compara formações.
        </p>
      </div>

      {error && (
        <div className="error-message" style={{
          padding: '1rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#dc2626',
          marginBottom: '1rem',
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="profile-education-actions">
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            if (showCreateForm) {
              resetForm();
            }
          }}
          className="create-event-button"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {showCreateForm ? 'Cancelar' : '+ Registrar Evento Educacional'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-event-form" style={{
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          border: '1px solid #e5e7eb',
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Criar Evento Educacional</h3>
          
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Tipo de Evento *</label>
            <select
              value={formEventType}
              onChange={(e) => {
                const newType = e.target.value as EducationEventType;
                if (isValidEventType(newType)) {
                  setFormEventType(newType);
                  if (!isThirdPartyEvent(newType)) {
                    setFormAuthorName('');
                    setFormAuthorRelation('');
                    setFormContext('');
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            >
              {CANONICAL_EVENT_TYPES.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {getEventTypeLabel(eventType)}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Apenas eventos canônicos são permitidos. Não é possível criar eventos customizados.
            </p>
          </div>

          {isThirdPartyEvent(formEventType) && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#fef3c7',
              borderRadius: '0.375rem',
              marginBottom: '1rem',
              border: '1px solid #fbbf24',
            }}>
              <strong style={{ fontSize: '0.875rem', color: '#92400e', display: 'block', marginBottom: '0.5rem' }}>
                ⚠️ Evento de Terceiro - Identificação Obrigatória
              </strong>
              <p style={{ fontSize: '0.75rem', color: '#78350f', marginBottom: '1rem' }}>
                Este tipo de evento requer identificação explícita do autor e contexto.
              </p>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Nome do Autor / Validador *</label>
                <input
                  type="text"
                  value={formAuthorName}
                  onChange={(e) => setFormAuthorName(e.target.value)}
                  placeholder="Nome da pessoa ou instituição que confirma/contesta"
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Relação com o Actor *</label>
                <input
                  type="text"
                  value={formAuthorRelation}
                  onChange={(e) => setFormAuthorRelation(e.target.value)}
                  placeholder="Ex: Professor, Coordenador, Instituição, etc."
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Contexto / Evidência *</label>
                <textarea
                  value={formContext}
                  onChange={(e) => setFormContext(e.target.value)}
                  placeholder="Descreva o contexto da confirmação/contestação/validação"
                  rows={3}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    border: '1px solid #d1d5db',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>ID da Formação (opcional - deixe vazio para criar nova)</label>
            <input
              type="text"
              value={formEducationId}
              onChange={(e) => setFormEducationId(e.target.value)}
              placeholder="edu-123"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Tipo de Educação *</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as EducationType)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            >
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
              <option value="autodidata">Autodidata</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Instituição (opcional)</label>
            <input
              type="text"
              value={formInstitution}
              onChange={(e) => setFormInstitution(e.target.value)}
              placeholder="Universidade X"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Curso / Formação (opcional)</label>
            <input
              type="text"
              value={formCourse}
              onChange={(e) => setFormCourse(e.target.value)}
              placeholder="Engenharia de Software"
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Data de Início (opcional)</label>
              <input
                type="month"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                }}
              />
            </div>

            <div className="form-group">
              <label>Data de Conclusão (opcional)</label>
              <input
                type="month"
                value={formEndDate || ''}
                onChange={(e) => setFormEndDate(e.target.value || null)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                }}
              />
            </div>
          </div>

          {(formEventType === 'educacao.abandonada' || formEventType === 'educacao.contestada') && (
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Motivo / Razão (opcional)</label>
              <textarea
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                placeholder="Motivo do abandono ou contestação"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Descrição (opcional)</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Informações adicionais"
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #d1d5db',
                resize: 'vertical',
              }}
            />
          </div>

          <div className="form-actions" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setShowCreateForm(false);
                resetForm();
              }}
              disabled={isCreating}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateEvent}
              disabled={isCreating}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                fontWeight: '500',
              }}
            >
              {isCreating ? 'Criando...' : 'Criar Evento'}
            </button>
          </div>
        </div>
      )}

      {profile && profile.education.length === 0 && !showCreateForm && (
        <div className="empty-state" style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#6b7280',
        }}>
          <p>Nenhuma formação educacional registrada ainda.</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
            Clique em "Registrar Evento Educacional" para começar.
          </p>
        </div>
      )}

      {profile && sortedEducation.length > 0 && (
        <div className="education-timeline">
          <h3 style={{ marginBottom: '1.5rem' }}>
            Linha do Tempo Educacional
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 'normal', 
              color: '#9ca3af',
              marginLeft: '0.5rem',
            }}>
              (ordenada cronologicamente, sem hierarquia)
            </span>
          </h3>
          
          {sortedEducation.map((entry: EducationEntry) => (
            <div key={entry.educationId} className="education-entry" style={{
              marginBottom: '2rem',
              padding: '1.5rem',
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
            }}>
              <div className="education-entry-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
              }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>
                    {entry.course || entry.institution || 'Formação sem nome'}
                  </h4>
                  {entry.institution && (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                      {entry.institution}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '0.375rem',
                  backgroundColor: getEventTypeColor(entry.currentStatus) + '20',
                  color: getEventTypeColor(entry.currentStatus),
                  fontSize: '0.75rem',
                  fontWeight: '500',
                }}>
                  {getEventTypeLabel(entry.currentStatus)}
                </div>
              </div>

              <div className="education-entry-details" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem',
              }}>
                <div>
                  <strong style={{ fontSize: '0.875rem', color: '#6b7280' }}>Tipo:</strong>
                  <p style={{ margin: '0.25rem 0 0 0' }}>
                    {entry.type === 'formal' ? 'Formal' : entry.type === 'informal' ? 'Informal' : 'Autodidata'}
                  </p>
                </div>
                {entry.startDate && (
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: '#6b7280' }}>Início:</strong>
                    <p style={{ margin: '0.25rem 0 0 0' }}>{formatDate(entry.startDate)}</p>
                  </div>
                )}
                {entry.endDate && (
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: '#6b7280' }}>Conclusão:</strong>
                    <p style={{ margin: '0.25rem 0 0 0' }}>{formatDate(entry.endDate)}</p>
                  </div>
                )}
              </div>

              {entry.description && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: '#374151', fontSize: '0.875rem' }}>
                    {entry.description}
                  </p>
                </div>
              )}

              {entry.events && entry.events.length > 0 && (
                <div className="education-events-history" style={{
                  marginTop: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e5e7eb',
                }}>
                  <strong style={{ fontSize: '0.875rem', color: '#6b7280' }}>Histórico de Eventos:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[...entry.events]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((event, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.25rem',
                        }}>
                          <span style={{ fontSize: '0.875rem' }}>
                            {getEventTypeLabel(event.eventType)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {new Date(event.createdAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

