// src/components/EducationSection.tsx
// Componente para gerenciar educação/escolaridade

import { useState } from 'react';
import { CategoryContext } from '@unificard/contracts';
import type { EducationEntry, CategoryAutocompleteResult } from '../api/categories';
import { autocompleteCategories } from '../api/categories';
import { sanitizeString, sanitizeText, validateEducationEntry } from '../utils/validation';
import './EducationSection.css';

interface EducationSectionProps {
  education: EducationEntry[];
  onChange: (education: EducationEntry[]) => void;
}

const EDUCATION_LEVELS = [
  { value: 'elementary', label: 'Ensino Fundamental' },
  { value: 'high_school', label: 'Ensino Médio' },
  { value: 'technical', label: 'Técnico' },
  { value: 'bachelor', label: 'Graduação' },
  { value: 'master', label: 'Mestrado' },
  { value: 'phd', label: 'Doutorado' },
  { value: 'other', label: 'Outro' },
];

export default function EducationSection({ education, onChange }: EducationSectionProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string[]>>({});
  
  // Autocomplete para instituição
  const [institutionAutocomplete, setInstitutionAutocomplete] = useState<{
    index: number;
    results: CategoryAutocompleteResult[];
    show: boolean;
    term: string;
  }>({ index: -1, results: [], show: false, term: '' });
  
  // Autocomplete para curso
  const [courseAutocomplete, setCourseAutocomplete] = useState<{
    index: number;
    results: CategoryAutocompleteResult[];
    show: boolean;
    term: string;
  }>({ index: -1, results: [], show: false, term: '' });

  const addEducation = () => {
    const newEducation: EducationEntry = {
      educationId: `edu-${Date.now()}`,
      level: 'bachelor',
      institution: '',
      course: '',
      field: '',
      startDate: '',
      endDate: null,
      isCompleted: false,
      description: '',
    };
    onChange([...education, newEducation]);
    setEditingIndex(education.length);
  };

  // Debounce para autocomplete
  const [autocompleteTimeout, setAutocompleteTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleInstitutionSearch = async (index: number, term: string) => {
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }

    if (term.length < 2) {
      setInstitutionAutocomplete({ index: -1, results: [], show: false, term: '' });
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await autocompleteCategories(term, 'education' as CategoryContext, undefined, 10);
        // Sucesso: mostrar resultados se houver
        setInstitutionAutocomplete({ index, results, show: results.length > 0, term });
      } catch (err: any) {
        // REGRA CLARA: Erro ≠ ausência de dado
        // Log erro mas não quebrar UX - apenas não mostrar resultados
        console.error('Erro ao buscar autocomplete de instituição:', err);
        setInstitutionAutocomplete({ index: -1, results: [], show: false, term: '' });
        // Nota: Em produção, poderia mostrar toast/alert se necessário
      }
    }, 300);

    setAutocompleteTimeout(timeout);
  };

  const handleCourseSearch = async (index: number, term: string) => {
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }

    if (term.length < 2) {
      setCourseAutocomplete({ index: -1, results: [], show: false, term: '' });
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const results = await autocompleteCategories(term, 'education' as CategoryContext, undefined, 10);
        // Sucesso: mostrar resultados se houver
        setCourseAutocomplete({ index, results, show: results.length > 0, term });
      } catch (err: any) {
        // REGRA CLARA: Erro ≠ ausência de dado
        // Não silenciar erro, mas também não quebrar UX - apenas não mostrar resultados
        console.error('Erro ao buscar autocomplete de curso:', err);
        setCourseAutocomplete({ index: -1, results: [], show: false, term: '' });
        // Em produção, poderia mostrar toast/alert se necessário
      }
    }, 300);

    setAutocompleteTimeout(timeout);
  };

  const updateEducation = (index: number, field: keyof EducationEntry, value: any) => {
    const updated = [...education];
    
    // Sanitizar strings
    if (typeof value === 'string') {
      if (field === 'description') {
        value = sanitizeText(value, 1000);
      } else {
        value = sanitizeString(value, 200);
      }
    }
    
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);

    // Autocomplete para instituição
    if (field === 'institution' && typeof value === 'string') {
      handleInstitutionSearch(index, value);
    }

    // Autocomplete para curso
    if (field === 'course' && typeof value === 'string') {
      handleCourseSearch(index, value);
    }

    // Validação em tempo real
    const validation = validateEducationEntry(updated[index]);
    if (validation.valid) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    } else {
      setErrors((prev) => ({ ...prev, [index]: validation.errors }));
    }
  };

  const removeEducation = (index: number) => {
    const updated = education.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const formatDateForInput = (dateStr?: string): string => {
    if (!dateStr) return '';
    // Se já está no formato YYYY-MM, retorna
    if (dateStr.match(/^\d{4}-\d{2}$/)) return dateStr;
    // Se está em outro formato, tenta converter
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  return (
    <div className="education-section">
      <div className="education-header">
        <h3>Formação e Educação</h3>
        <button type="button" onClick={addEducation} className="add-education-button">
          + Adicionar Formação
        </button>
      </div>

      {education.length === 0 && (
        <div className="empty-education">
          <p>Nenhuma formação adicionada ainda.</p>
          <p className="hint">Clique em "Adicionar Formação" para começar.</p>
        </div>
      )}

      <div className="education-list">
        {education.map((edu, index) => (
          <div key={edu.educationId} className="education-card">
            <div className="education-card-header">
              <h4>
                {edu.institution || 'Nova Formação'}
                {edu.course && ` - ${edu.course}`}
              </h4>
              <button
                type="button"
                onClick={() => removeEducation(index)}
                className="remove-education-button"
                title="Remover"
              >
                ✕
              </button>
            </div>

            <div className="education-fields">
              <div className="education-field">
                <label>Nível de Escolaridade *</label>
                <select
                  value={edu.level}
                  onChange={(e) =>
                    updateEducation(index, 'level', e.target.value as EducationEntry['level'])
                  }
                  required
                >
                  {EDUCATION_LEVELS.map((level) => (
                    <option key={level.value} value={level.value}>
                      {level.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="education-field" style={{ position: 'relative' }}>
                <label>Instituição *</label>
                <input
                  type="text"
                  value={edu.institution}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  onFocus={() => {
                    if (edu.institution.length >= 2) {
                      handleInstitutionSearch(index, edu.institution);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setInstitutionAutocomplete({ index: -1, results: [], show: false, term: '' }), 200);
                    const validation = validateEducationEntry(edu);
                    if (!validation.valid) {
                      setErrors((prev) => ({ ...prev, [index]: validation.errors }));
                    }
                  }}
                  placeholder="Nome da escola, faculdade, universidade..."
                  required
                  className={errors[index]?.some((e: string) => e.includes('Instituição')) ? 'error' : ''}
                />
                {errors[index]?.some((e: string) => e.includes('Instituição')) && (
                  <span className="field-error">{errors[index].find((e: string) => e.includes('Instituição'))}</span>
                )}
                {institutionAutocomplete.show && institutionAutocomplete.index === index && institutionAutocomplete.results.length > 0 && (
                  <div className="autocomplete-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                    {institutionAutocomplete.results.map((result) => (
                      <div
                        key={result.id}
                        className="autocomplete-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          updateEducation(index, 'institution', result.name);
                          setInstitutionAutocomplete({ index: -1, results: [], show: false, term: '' });
                        }}
                      >
                        <div className="autocomplete-item-name">{result.name}</div>
                        <div className="autocomplete-item-path">{result.fullPathLabel}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(edu.level === 'bachelor' || edu.level === 'master' || edu.level === 'phd' || edu.level === 'technical') && (
                <>
                  <div className="education-field" style={{ position: 'relative' }}>
                    <label>Curso</label>
                    <input
                      type="text"
                      value={edu.course || ''}
                      onChange={(e) => updateEducation(index, 'course', e.target.value)}
                      onFocus={() => {
                        if (edu.course && edu.course.length >= 2) {
                          handleCourseSearch(index, edu.course);
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setCourseAutocomplete({ index: -1, results: [], show: false, term: '' }), 200);
                      }}
                      placeholder="Ex: Engenharia de Software, Administração..."
                    />
                    {courseAutocomplete.show && courseAutocomplete.index === index && courseAutocomplete.results.length > 0 && (
                      <div className="autocomplete-dropdown" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                        {courseAutocomplete.results.map((result) => (
                          <div
                            key={result.id}
                            className="autocomplete-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              updateEducation(index, 'course', result.name);
                              setCourseAutocomplete({ index: -1, results: [], show: false, term: '' });
                            }}
                          >
                            <div className="autocomplete-item-name">{result.name}</div>
                            <div className="autocomplete-item-path">{result.fullPathLabel}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="education-field">
                    <label>Área</label>
                    <input
                      type="text"
                      value={edu.field || ''}
                      onChange={(e) => updateEducation(index, 'field', e.target.value)}
                      placeholder="Ex: Tecnologia, Negócios, Saúde..."
                    />
                  </div>
                </>
              )}

              <div className="education-field-row">
                <div className="education-field">
                  <label>Data de Início</label>
                  <input
                    type="month"
                    value={formatDateForInput(edu.startDate)}
                    onChange={(e) => updateEducation(index, 'startDate', e.target.value || undefined)}
                  onBlur={() => {
                    const validation = validateEducationEntry(edu);
                    if (!validation.valid) {
                      setErrors((prev) => ({ ...prev, [index]: validation.errors }));
                    }
                  }}
                  className={errors[index]?.some((e: string) => e.includes('início')) ? 'error' : ''}
                />
                {errors[index]?.some((e: string) => e.includes('início')) && (
                  <span className="field-error">{errors[index].find((e: string) => e.includes('início'))}</span>
                )}
                </div>

                <div className="education-field">
                  <label>Data de Conclusão</label>
                  <input
                    type="month"
                    value={formatDateForInput(edu.endDate || undefined)}
                    onChange={(e) => updateEducation(index, 'endDate', e.target.value || null)}
                    onBlur={() => {
                      const validation = validateEducationEntry(edu);
                      if (!validation.valid) {
                        setErrors((prev) => ({ ...prev, [index]: validation.errors }));
                      }
                    }}
                    disabled={!edu.isCompleted}
                    className={errors[index]?.some((e: string) => e.includes('conclusão')) ? 'error' : ''}
                  />
                  {errors[index]?.some((e: string) => e.includes('conclusão')) && (
                    <span className="field-error">{errors[index].find((e: string) => e.includes('conclusão'))}</span>
                  )}
                </div>

                <div className="education-field-checkbox">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={edu.isCompleted}
                      onChange={(e) => {
                        updateEducation(index, 'isCompleted', e.target.checked);
                        if (e.target.checked) {
                          // Se marcou como concluído e não tem data de término, sugere data atual
                          if (!edu.endDate) {
                            const now = new Date();
                            updateEducation(
                              index,
                              'endDate',
                              `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                            );
                          }
                        } else {
                          updateEducation(index, 'endDate', null);
                        }
                      }}
                    />
                    <span>Concluído</span>
                  </label>
                </div>
              </div>

              <div className="education-field">
                <label>Descrição / Observações</label>
                <textarea
                  value={edu.description || ''}
                  onChange={(e) => updateEducation(index, 'description', e.target.value)}
                  placeholder="Informações adicionais sobre sua formação..."
                  rows={2}
                  maxLength={1000}
                />
                <p className="field-hint">{(edu.description || '').length}/1000 caracteres</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

