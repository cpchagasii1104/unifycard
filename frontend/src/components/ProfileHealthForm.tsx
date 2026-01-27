import type { HealthTaxonomy, UserHealthFact, HealthSection } from '../api/health';

const SECTIONS: Array<{ id: HealthSection; label: string; description: string }> = [
  { id: 'general', label: 'Condições Gerais', description: 'Condições de saúde gerais e acompanhamento médico' },
  { id: 'vision', label: 'Visão', description: 'Saúde visual, uso de óculos/lentes, exames' },
  { id: 'dental', label: 'Odontologia', description: 'Saúde bucal, aparelhos, consultas' },
  { id: 'medications', label: 'Medicamentos', description: 'Medicamentos de uso contínuo' },
  { id: 'mobility', label: 'Mobilidade', description: 'Mobilidade e necessidades especiais' },
  { id: 'mental', label: 'Saúde Mental', description: 'Bem-estar emocional e acompanhamento' },
];

const COMMON_CONDITIONS: Record<HealthSection, string[]> = {
  vision: ['miopia', 'astigmatismo', 'hipermetropia', 'presbiopia', 'daltonismo'],
  dental: ['facetas', 'implantes-dentarios', 'proteses-dentarias', 'gengivite', 'sensibilidade-dentaria', 'bruxismo'],
  general: ['hipertensao', 'diabetes-tipo-1', 'diabetes-tipo-2', 'asma', 'alergias'],
  medications: [],
  mobility: ['usa-cadeira-rodas', 'usa-muletas', 'usa-bengala', 'usa-andador', 'limitacao-movimento'],
  mental: ['ansiedade', 'depressao', 'tdah', 'transtorno-bipolar', 'toc'],
  hearing: [],
  chronic: [],
  allergies: [],
  other: [],
};

interface ProfileHealthFormProps {
  activeSection: HealthSection;
  setActiveSection: (section: HealthSection) => void;
  taxonomies: HealthTaxonomy[];
  facts: UserHealthFact[];
  selectedConditions: Set<string>;
  factValues: Record<string, any>;
  factNotes: Record<string, string>;
  saveError: string | null;
  isSaving: boolean;
  getFactForTaxonomy: (taxonomyId: string) => UserHealthFact | undefined;
  getTaxonomyBySlug: (slug: string) => HealthTaxonomy | undefined;
  handleConditionToggle: (conditionSlug: string, checked: boolean) => Promise<void>;
  handleFactChange: (taxonomyId: string, value: any) => void;
  handleSaveFact: (taxonomy: HealthTaxonomy) => Promise<void>;
  handleDeleteFact: (factId: string) => Promise<void>;
  setIsSaving: (saving: boolean) => void;
  loadSectionData: () => Promise<void>;
  upsertHealthFact: (input: any) => Promise<void>;
  deleteHealthFact: (factId: string) => Promise<void>;
}

export default function ProfileHealthForm({
  activeSection,
  setActiveSection,
  taxonomies,
  facts,
  selectedConditions,
  factValues,
  factNotes,
  saveError,
  isSaving,
  getFactForTaxonomy,
  getTaxonomyBySlug,
  handleConditionToggle,
  handleFactChange,
  handleSaveFact,
  handleDeleteFact,
  setIsSaving,
  loadSectionData,
  upsertHealthFact,
  deleteHealthFact,
}: ProfileHealthFormProps) {
  const usesGlasses = facts.find((f) => {
    const tax = getTaxonomyBySlug('uso-oculos');
    return tax && f.taxonomyId === tax.taxonomyId && f.valueBoolean === true;
  });

  const usesContacts = facts.find((f) => {
    const tax = getTaxonomyBySlug('uso-lentes-contato');
    return tax && f.taxonomyId === tax.taxonomyId && f.valueBoolean === true;
  });

  const usesBraces = facts.find((f) => {
    const tax = getTaxonomyBySlug('uso-aparelho-ortodontico');
    return tax && f.taxonomyId === tax.taxonomyId && f.valueBoolean === true;
  });

  const renderVisionSection = () => {
    const commonConditions = COMMON_CONDITIONS.vision;
    const conditionTaxonomies = taxonomies.filter((t) => commonConditions.includes(t.slug));

    return (
      <div>
        {/* Pergunta 1: Usa óculos? */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
            1. Você usa óculos?
          </h4>
          {(() => {
            const glassesTax = getTaxonomyBySlug('uso-oculos');
            if (!glassesTax) return null;
            const fact = getFactForTaxonomy(glassesTax.taxonomyId);
            const value = fact?.valueBoolean ?? false;

            return (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (e) => {
                    setIsSaving(true);
                    try {
                      if (e.target.checked) {
                        await upsertHealthFact({ taxonomyId: glassesTax.taxonomyId, valueBoolean: true });
                      } else {
                        const existingFact = getFactForTaxonomy(glassesTax.taxonomyId);
                        if (existingFact) {
                          await deleteHealthFact(existingFact.factId);
                        }
                      }
                      await loadSectionData();
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  style={{ marginRight: '0.5rem', width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Sim, uso óculos</span>
              </label>
            );
          })()}

          {/* Pergunta 2: Usa lentes de contato? */}
          {(() => {
            const contactsTax = getTaxonomyBySlug('uso-lentes-contato');
            if (!contactsTax) return null;
            const fact = getFactForTaxonomy(contactsTax.taxonomyId);
            const value = fact?.valueBoolean ?? false;

            return (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (e) => {
                    setIsSaving(true);
                    try {
                      if (e.target.checked) {
                        await upsertHealthFact({ taxonomyId: contactsTax.taxonomyId, valueBoolean: true });
                      } else {
                        const existingFact = getFactForTaxonomy(contactsTax.taxonomyId);
                        if (existingFact) {
                          await deleteHealthFact(existingFact.factId);
                        }
                      }
                      await loadSectionData();
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  style={{ marginRight: '0.5rem', width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Sim, uso lentes de contato</span>
              </label>
            );
          })()}
        </div>

        {/* Pergunta 2: Se usa óculos ou lentes, quais condições? */}
        {(usesGlasses || usesContacts) && conditionTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              2. Quais condições visuais você tem? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {conditionTaxonomies.map((taxonomy) => {
                const isSelected = selectedConditions.has(taxonomy.slug);
                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleConditionToggle(taxonomy.slug, e.target.checked)}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Pergunta 3: Grau do óculos (se tem miopia ou astigmatismo) */}
        {(selectedConditions.has('miopia') || selectedConditions.has('astigmatismo')) && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              3. Qual o grau do seu óculos?
            </h4>
            {selectedConditions.has('miopia') && (() => {
              const tax = getTaxonomyBySlug('grau-oculos-miopia');
              if (!tax) return null;
              const fact = getFactForTaxonomy(tax.taxonomyId);
              return (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Grau de Miopia (ex: -2.5)
                  </label>
                  <input
                    type="text"
                    value={fact?.valueText || ''}
                    onChange={(e) => handleFactChange(tax.taxonomyId, e.target.value)}
                    placeholder="Ex: -2.5"
                    style={{
                      width: '100%',
                      maxWidth: '200px',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                  <button
                    onClick={() => handleSaveFact(tax)}
                    disabled={isSaving || !factValues[tax.taxonomyId]}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: factValues[tax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      cursor: factValues[tax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Salvar
                  </button>
                </div>
              );
            })()}
            {selectedConditions.has('astigmatismo') && (() => {
              const tax = getTaxonomyBySlug('grau-oculos-astigmatismo');
              if (!tax) return null;
              const fact = getFactForTaxonomy(tax.taxonomyId);
              return (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Grau de Astigmatismo
                  </label>
                  <input
                    type="text"
                    value={fact?.valueText || ''}
                    onChange={(e) => handleFactChange(tax.taxonomyId, e.target.value)}
                    placeholder="Ex: -1.0"
                    style={{
                      width: '100%',
                      maxWidth: '200px',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}
                  />
                  <button
                    onClick={() => handleSaveFact(tax)}
                    disabled={isSaving || !factValues[tax.taxonomyId]}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: factValues[tax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      cursor: factValues[tax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Salvar
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {/* Último exame */}
        {(() => {
          const examTax = getTaxonomyBySlug('ultimo-exame-visao');
          if (!examTax) return null;
          const fact = getFactForTaxonomy(examTax.taxonomyId);
          return (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                4. Quando foi seu último exame de visão?
              </h4>
              <input
                type="date"
                value={fact?.valueDate ? fact.valueDate.split('T')[0] : ''}
                onChange={(e) => handleFactChange(examTax.taxonomyId, e.target.value)}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
              <button
                onClick={() => handleSaveFact(examTax)}
                disabled={isSaving || !factValues[examTax.taxonomyId]}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: factValues[examTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: factValues[examTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                Salvar
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderDentalSection = () => {
    const commonConditions = COMMON_CONDITIONS.dental;
    const conditionTaxonomies = taxonomies.filter((t) => commonConditions.includes(t.slug));

    return (
      <div>
        {/* Pergunta 1: Usa aparelho? */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
            1. Você usa aparelho ortodôntico?
          </h4>
          {(() => {
            const bracesTax = getTaxonomyBySlug('uso-aparelho-ortodontico');
            if (!bracesTax) return null;
            const fact = getFactForTaxonomy(bracesTax.taxonomyId);
            const value = fact?.valueBoolean ?? false;

            return (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (e) => {
                    setIsSaving(true);
                    try {
                      if (e.target.checked) {
                        await upsertHealthFact({ taxonomyId: bracesTax.taxonomyId, valueBoolean: true });
                      } else {
                        const existingFact = getFactForTaxonomy(bracesTax.taxonomyId);
                        if (existingFact) {
                          await deleteHealthFact(existingFact.factId);
                        }
                      }
                      await loadSectionData();
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  style={{ marginRight: '0.5rem', width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Sim, uso aparelho ortodôntico</span>
              </label>
            );
          })()}
        </div>

        {/* Pergunta 2: Condições bucais */}
        {conditionTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              2. Quais condições bucais você tem? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {conditionTaxonomies.map((taxonomy) => {
                const isSelected = selectedConditions.has(taxonomy.slug);
                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleConditionToggle(taxonomy.slug, e.target.checked)}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Última consulta */}
        {(() => {
          const consultTax = getTaxonomyBySlug('ultima-consulta-odontologica');
          if (!consultTax) return null;
          const fact = getFactForTaxonomy(consultTax.taxonomyId);
          return (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                3. Quando foi sua última consulta odontológica?
              </h4>
              <input
                type="date"
                value={fact?.valueDate ? fact.valueDate.split('T')[0] : ''}
                onChange={(e) => handleFactChange(consultTax.taxonomyId, e.target.value)}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
              <button
                onClick={() => handleSaveFact(consultTax)}
                disabled={isSaving || !factValues[consultTax.taxonomyId]}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: factValues[consultTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: factValues[consultTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                Salvar
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderGeneralSection = () => {
    const commonConditions = COMMON_CONDITIONS.general;
    const conditionTaxonomies = taxonomies.filter((t) => commonConditions.includes(t.slug));
    
    // Taxonomias de dados físicos
    const heightTax = getTaxonomyBySlug('altura');
    const weightTax = getTaxonomyBySlug('peso');
    const bloodTypeTax = getTaxonomyBySlug('tipo-sanguineo');
    const shareConsentTax = getTaxonomyBySlug('compartilhar-perfil-relacionamento');
    
    const heightFact = heightTax ? getFactForTaxonomy(heightTax.taxonomyId) : undefined;
    const weightFact = weightTax ? getFactForTaxonomy(weightTax.taxonomyId) : undefined;
    const bloodTypeFact = bloodTypeTax ? getFactForTaxonomy(bloodTypeTax.taxonomyId) : undefined;
    const shareConsentFact = shareConsentTax ? getFactForTaxonomy(shareConsentTax.taxonomyId) : undefined;
    
    const sharesInRelationship = shareConsentFact?.valueBoolean === true;

    return (
      <div>
        {/* Dados físicos básicos */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f0f9ff' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
            Dados Físicos Básicos
          </h4>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
            Essas informações podem aparecer no seu perfil de relacionamento (se você permitir).
          </p>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Altura */}
            {heightTax && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Altura (cm)
                </label>
                <input
                  type="number"
                  min="100"
                  max="250"
                  value={heightFact?.valueNumber || factValues[heightTax.taxonomyId] || ''}
                  onChange={(e) => handleFactChange(heightTax.taxonomyId, e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Ex: 175"
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  onClick={() => handleSaveFact(heightTax)}
                  disabled={isSaving || !factValues[heightTax.taxonomyId]}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: factValues[heightTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    cursor: factValues[heightTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  Salvar
                </button>
              </div>
            )}

            {/* Peso */}
            {weightTax && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Peso (kg)
                </label>
                <input
                  type="number"
                  min="30"
                  max="300"
                  step="0.1"
                  value={weightFact?.valueNumber || factValues[weightTax.taxonomyId] || ''}
                  onChange={(e) => handleFactChange(weightTax.taxonomyId, e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Ex: 70.5"
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  onClick={() => handleSaveFact(weightTax)}
                  disabled={isSaving || !factValues[weightTax.taxonomyId]}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: factValues[weightTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    cursor: factValues[weightTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  Salvar
                </button>
              </div>
            )}

            {/* Tipo Sanguíneo */}
            {bloodTypeTax && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Tipo Sanguíneo
                </label>
                <select
                  value={bloodTypeFact?.valueText || factValues[bloodTypeTax.taxonomyId] || ''}
                  onChange={(e) => handleFactChange(bloodTypeTax.taxonomyId, e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '200px',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">Selecione...</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
                <button
                  onClick={() => handleSaveFact(bloodTypeTax)}
                  disabled={isSaving || !factValues[bloodTypeTax.taxonomyId]}
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: factValues[bloodTypeTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    cursor: factValues[bloodTypeTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                  }}
                >
                  Salvar
                </button>
              </div>
            )}

            {/* Consentimento para compartilhar no perfil de relacionamento */}
            {shareConsentTax && (heightFact || weightFact) && (
              <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '0.375rem', border: '1px solid #f59e0b' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={sharesInRelationship}
                    onChange={async (e) => {
                      setIsSaving(true);
                      try {
                        if (e.target.checked) {
                          await upsertHealthFact({ taxonomyId: shareConsentTax.taxonomyId, valueBoolean: true });
                        } else {
                          const existingFact = getFactForTaxonomy(shareConsentTax.taxonomyId);
                          if (existingFact) {
                            await deleteHealthFact(existingFact.factId);
                          }
                        }
                        await loadSectionData();
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                    disabled={isSaving}
                    style={{ marginRight: '0.75rem', marginTop: '0.25rem', width: '1.25rem', height: '1.25rem' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>
                      Permitir que altura e peso apareçam no meu perfil de relacionamento
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      Se marcado, sua altura e peso poderão ser exibidos no perfil de relacionamento para matching.
                      Você pode desmarcar a qualquer momento.
                    </span>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Condições gerais comuns */}
        {conditionTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              Quais condições de saúde você tem? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {conditionTaxonomies.map((taxonomy) => {
                const isSelected = selectedConditions.has(taxonomy.slug);
                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleConditionToggle(taxonomy.slug, e.target.checked)}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Último check-up */}
        {(() => {
          const checkupTax = getTaxonomyBySlug('ultimo-checkup');
          if (!checkupTax) return null;
          const fact = getFactForTaxonomy(checkupTax.taxonomyId);
          return (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                Quando foi seu último check-up médico?
              </h4>
              <input
                type="date"
                value={fact?.valueDate ? fact.valueDate.split('T')[0] : ''}
                onChange={(e) => handleFactChange(checkupTax.taxonomyId, e.target.value)}
                style={{
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                }}
              />
              <button
                onClick={() => handleSaveFact(checkupTax)}
                disabled={isSaving || !factValues[checkupTax.taxonomyId]}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: factValues[checkupTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: factValues[checkupTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                Salvar
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderMedicationsSection = () => {
    const takesMedications = facts.find((f) => {
      const tax = getTaxonomyBySlug('toma-medicamentos-continuos');
      return tax && f.taxonomyId === tax.taxonomyId && f.valueBoolean === true;
    });

    return (
      <div>
        {/* Pergunta 1: Toma medicamentos contínuos? */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
            1. Você toma medicamentos de uso contínuo?
          </h4>
          {(() => {
            const medTax = getTaxonomyBySlug('toma-medicamentos-continuos');
            if (!medTax) return null;
            const fact = getFactForTaxonomy(medTax.taxonomyId);
            const value = fact?.valueBoolean ?? false;

            return (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (e) => {
                    setIsSaving(true);
                    try {
                      if (e.target.checked) {
                        await upsertHealthFact({ taxonomyId: medTax.taxonomyId, valueBoolean: true });
                      } else {
                        const existingFact = getFactForTaxonomy(medTax.taxonomyId);
                        if (existingFact) {
                          await deleteHealthFact(existingFact.factId);
                        }
                      }
                      await loadSectionData();
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  style={{ marginRight: '0.5rem', width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Sim, tomo medicamentos contínuos</span>
              </label>
            );
          })()}
        </div>

        {/* Se toma medicamentos, perguntar detalhes */}
        {takesMedications && (
          <>
            {(() => {
              const nameTax = getTaxonomyBySlug('nome-medicamento');
              const dosageTax = getTaxonomyBySlug('dosagem-medicamento');
              const frequencyTax = getTaxonomyBySlug('frequencia-medicamento');
              const prescribedTax = getTaxonomyBySlug('prescrito-por');
              
              if (!nameTax || !dosageTax || !frequencyTax || !prescribedTax) return null;

              const nameFact = getFactForTaxonomy(nameTax.taxonomyId);
              const dosageFact = getFactForTaxonomy(dosageTax.taxonomyId);
              const frequencyFact = getFactForTaxonomy(frequencyTax.taxonomyId);
              const prescribedFact = getFactForTaxonomy(prescribedTax.taxonomyId);

              return (
                <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                    2. Informe os detalhes dos seus medicamentos:
                  </h4>
                  
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        Nome do Medicamento
                      </label>
                      <input
                        type="text"
                        value={nameFact?.valueText || ''}
                        onChange={(e) => handleFactChange(nameTax.taxonomyId, e.target.value)}
                        placeholder="Ex: Metformina, Losartana"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                        }}
                      />
                      <button
                        onClick={() => handleSaveFact(nameTax)}
                        disabled={isSaving || !factValues[nameTax.taxonomyId]}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: factValues[nameTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          cursor: factValues[nameTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Salvar
                      </button>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        Dosagem
                      </label>
                      <input
                        type="text"
                        value={dosageFact?.valueText || ''}
                        onChange={(e) => handleFactChange(dosageTax.taxonomyId, e.target.value)}
                        placeholder="Ex: 500mg, 50mg"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                        }}
                      />
                      <button
                        onClick={() => handleSaveFact(dosageTax)}
                        disabled={isSaving || !factValues[dosageTax.taxonomyId]}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: factValues[dosageTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          cursor: factValues[dosageTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Salvar
                      </button>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        Frequência
                      </label>
                      <input
                        type="text"
                        value={frequencyFact?.valueText || ''}
                        onChange={(e) => handleFactChange(frequencyTax.taxonomyId, e.target.value)}
                        placeholder="Ex: 1x ao dia, 2x ao dia"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                        }}
                      />
                      <button
                        onClick={() => handleSaveFact(frequencyTax)}
                        disabled={isSaving || !factValues[frequencyTax.taxonomyId]}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: factValues[frequencyTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          cursor: factValues[frequencyTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Salvar
                      </button>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        Prescrito Por
                      </label>
                      <input
                        type="text"
                        value={prescribedFact?.valueText || ''}
                        onChange={(e) => handleFactChange(prescribedTax.taxonomyId, e.target.value)}
                        placeholder="Ex: Dr. João Silva - Endocrinologista"
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                        }}
                      />
                      <button
                        onClick={() => handleSaveFact(prescribedTax)}
                        disabled={isSaving || !factValues[prescribedTax.taxonomyId]}
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.5rem 1rem',
                          backgroundColor: factValues[prescribedTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          cursor: factValues[prescribedTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  const renderMobilitySection = () => {
    const commonConditions = COMMON_CONDITIONS.mobility;
    const conditionTaxonomies = taxonomies.filter((t) => commonConditions.includes(t.slug));
    const accessibilityTaxonomies = taxonomies.filter((t) => 
      t.slug.includes('necessita-') && t.category === 'mobility'
    );

    return (
      <div>
        {/* Pergunta 1: Auxiliares de mobilidade */}
        {conditionTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              1. Quais auxiliares de mobilidade você utiliza? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {conditionTaxonomies.map((taxonomy) => {
                const fact = getFactForTaxonomy(taxonomy.taxonomyId);
                const isSelected = fact?.valueBoolean === true;

                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={async (e) => {
                        setIsSaving(true);
                        try {
                          if (e.target.checked) {
                            await upsertHealthFact({ taxonomyId: taxonomy.taxonomyId, valueBoolean: true });
                          } else {
                            const existingFact = getFactForTaxonomy(taxonomy.taxonomyId);
                            if (existingFact) {
                              await deleteHealthFact(existingFact.factId);
                            }
                          }
                          await loadSectionData();
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Pergunta 2: Necessidades de acessibilidade */}
        {accessibilityTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              2. Quais necessidades de acessibilidade você tem? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {accessibilityTaxonomies.map((taxonomy) => {
                const fact = getFactForTaxonomy(taxonomy.taxonomyId);
                const isSelected = fact?.valueBoolean === true;

                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={async (e) => {
                        setIsSaving(true);
                        try {
                          if (e.target.checked) {
                            await upsertHealthFact({ taxonomyId: taxonomy.taxonomyId, valueBoolean: true });
                          } else {
                            const existingFact = getFactForTaxonomy(taxonomy.taxonomyId);
                            if (existingFact) {
                              await deleteHealthFact(existingFact.factId);
                            }
                          }
                          await loadSectionData();
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMentalSection = () => {
    const commonConditions = COMMON_CONDITIONS.mental;
    const conditionTaxonomies = taxonomies.filter((t) => commonConditions.includes(t.slug));
    const inTherapy = facts.find((f) => {
      const tax = getTaxonomyBySlug('acompanhamento-psicologico');
      return tax && f.taxonomyId === tax.taxonomyId && f.valueBoolean === true;
    });

    return (
      <div>
        {/* Pergunta 1: Em acompanhamento psicológico? */}
        <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
            1. Você está em acompanhamento psicológico ou terapêutico?
          </h4>
          {(() => {
            const therapyTax = getTaxonomyBySlug('acompanhamento-psicologico');
            if (!therapyTax) return null;
            const fact = getFactForTaxonomy(therapyTax.taxonomyId);
            const value = fact?.valueBoolean ?? false;

            return (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={value}
                  onChange={async (e) => {
                    setIsSaving(true);
                    try {
                      if (e.target.checked) {
                        await upsertHealthFact({ taxonomyId: therapyTax.taxonomyId, valueBoolean: true });
                      } else {
                        const existingFact = getFactForTaxonomy(therapyTax.taxonomyId);
                        if (existingFact) {
                          await deleteHealthFact(existingFact.factId);
                        }
                      }
                      await loadSectionData();
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  style={{ marginRight: '0.5rem', width: '1.25rem', height: '1.25rem' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Sim, estou em acompanhamento</span>
              </label>
            );
          })()}
        </div>

        {/* Pergunta 2: Condições de saúde mental */}
        {conditionTaxonomies.length > 0 && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', backgroundColor: '#f9fafb' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
              2. Quais condições de saúde mental você tem? (selecione todas que se aplicam)
            </h4>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {conditionTaxonomies.map((taxonomy) => {
                const isSelected = selectedConditions.has(taxonomy.slug);
                return (
                  <label
                    key={taxonomy.taxonomyId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      padding: '0.75rem',
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      backgroundColor: isSelected ? '#eff6ff' : 'white',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleConditionToggle(taxonomy.slug, e.target.checked)}
                      disabled={isSaving}
                      style={{ marginRight: '0.75rem', width: '1.25rem', height: '1.25rem' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: isSelected ? '500' : '400' }}>
                      {taxonomy.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Pergunta 3: Medicamentos psiquiátricos (se em terapia ou tem condições) */}
        {(inTherapy || conditionTaxonomies.some((t) => selectedConditions.has(t.slug))) && (() => {
          const medTax = getTaxonomyBySlug('medicamentos-psiquiatricos');
          if (!medTax) return null;
          const fact = getFactForTaxonomy(medTax.taxonomyId);
          
          return (
            <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '600' }}>
                3. Medicamentos psiquiátricos em uso (opcional)
              </h4>
              <textarea
                value={fact?.valueText || ''}
                onChange={(e) => handleFactChange(medTax.taxonomyId, e.target.value)}
                placeholder="Ex: Sertralina 50mg, Fluoxetina 20mg"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <button
                onClick={() => handleSaveFact(medTax)}
                disabled={isSaving || !factValues[medTax.taxonomyId]}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: factValues[medTax.taxonomyId] && !isSaving ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: factValues[medTax.taxonomyId] && !isSaving ? 'pointer' : 'not-allowed',
                }}
              >
                Salvar
              </button>
            </div>
          );
        })()}
      </div>
    );
  };

  const currentSection = SECTIONS.find((s) => s.id === activeSection);

  return (
    <div className="profile-learning">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Raio-X de Saúde Inteligente</h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Sistema guiado de coleta de dados estruturados para matching preciso com clínicas.
          Responda as perguntas e seus dados serão organizados automaticamente.
        </p>
        <div style={{
          padding: '1rem',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '0.5rem',
          color: '#92400e',
          fontSize: '0.875rem',
          marginBottom: '1.5rem'
        }}>
          <strong>⚠️ Dado Sensível (LGPD Art. 11):</strong> As informações de saúde são dados sensíveis
          e requerem seu consentimento explícito. <strong>NÃO são usadas para diagnóstico, bloqueio ou alteração de preços.</strong>
        </div>
      </div>

      {/* Tabs de seções */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '2px solid #e5e7eb', flexWrap: 'wrap' }}>
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeSection === section.id ? '#3b82f6' : 'transparent',
              color: activeSection === section.id ? 'white' : '#374151',
              border: 'none',
              borderBottom: activeSection === section.id ? '2px solid #3b82f6' : '2px solid transparent',
              borderRadius: '0.5rem 0.5rem 0 0',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da seção ativa */}
      {currentSection && (
        <div>
          <h3 style={{ marginBottom: '0.5rem' }}>{currentSection.label}</h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}>
            {currentSection.description}
          </p>

          {/* Mensagem de erro */}
          {saveError && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '0.375rem',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              <strong>{saveError}</strong>
            </div>
          )}

          {/* Renderizar seção específica */}
          {activeSection === 'vision' && renderVisionSection()}
          {activeSection === 'dental' && renderDentalSection()}
          {activeSection === 'general' && renderGeneralSection()}
          {activeSection === 'medications' && renderMedicationsSection()}
          {activeSection === 'mobility' && renderMobilitySection()}
          {activeSection === 'mental' && renderMentalSection()}

          {/* Resumo de fatos salvos */}
          {facts.length > 0 && (
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
                ✓ Seu Raio-X ({facts.length} {facts.length === 1 ? 'fato' : 'fatos'} salvos)
              </h4>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {facts.map((fact) => {
                  const taxonomy = taxonomies.find((t) => t.taxonomyId === fact.taxonomyId);
                  if (!taxonomy) return null;

                  const value = fact.valueText || 
                    (fact.valueNumber !== null && fact.valueNumber !== undefined ? fact.valueNumber.toString() : '') ||
                    (fact.valueBoolean !== null && fact.valueBoolean !== undefined ? (fact.valueBoolean ? 'Sim' : 'Não') : '') || 
                    (fact.valueDate ? new Date(fact.valueDate).toLocaleDateString('pt-BR') : '');

                  return (
                    <div key={fact.factId} style={{
                      padding: '1rem',
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <strong>{taxonomy.name}:</strong> {value}
                          {fact.notes && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
                              {fact.notes}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteFact(fact.factId)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #ef4444',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

