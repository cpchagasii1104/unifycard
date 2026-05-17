// src/components/ProfileHealth.tsx
// Componente de perfil de saúde V4 - Sistema Inteligente de Coleta de Dados
// PRINCÍPIO: Perguntas condicionais e seleção estruturada para matching preciso

import { useEffect, useRef } from 'react';
import {
  getHealthTaxonomies,
  getHealthFacts,
  upsertHealthFact,
  deleteHealthFact,
  type HealthTaxonomy,
  type UserHealthFact,
  type HealthSection,
} from '../api/health';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import { useProfileHealthState } from '../hooks/useProfileHealthState';
import { useProfileHealthLogic } from '../hooks/useProfileHealthLogic';
import ProfileHealthForm from './ProfileHealthForm';
import './Profile.css';


export default function ProfileHealth() {
  const { activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="saúde" />;
  }

  const {
    activeSection,
    setActiveSection,
    taxonomies,
    setTaxonomies,
    facts,
    setFacts,
    selectedConditions,
    setSelectedConditions,
    factValues,
    setFactValues,
    factNotes,
    setFactNotes,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
    saveError,
    setSaveError,
  } = useProfileHealthState();
  const { getFactForTaxonomy: getFactForTaxonomyLogic, getTaxonomyBySlug: getTaxonomyBySlugLogic } = useProfileHealthLogic();

  const hasLoadedRef = useRef(false);
  const { sessionReady } = useSession();

  useEffect(() => {
    // GUARD: Não fazer chamadas de API antes de sessionReady
    if (!sessionReady) {
      setIsLoading(false);
      return;
    }
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [sessionReady]);

  useEffect(() => {
    loadSectionData();
  }, [activeSection]);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadSectionData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Não foi possível carregar dados de saúde.';
      setError(errorMessage);
      console.error('[ProfileHealth] Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSectionData = async () => {
    try {
      const [taxonomiesData, factsData] = await Promise.all([
        getHealthTaxonomies(activeSection),
        getHealthFacts(activeSection),
      ]);

      setTaxonomies(taxonomiesData);
      setFacts(factsData);

      // Preencher valores dos fatos existentes
      const values: Record<string, any> = {};
      const notes: Record<string, string> = {};
      const conditions = new Set<string>();
      
      factsData.forEach((fact) => {
        const taxonomy = taxonomiesData.find((t) => t.taxonomyId === fact.taxonomyId);
        if (taxonomy) {
          values[fact.taxonomyId] = 
            fact.valueText || 
            fact.valueNumber || 
            fact.valueBoolean || 
            fact.valueDate || 
            '';
          if (fact.notes) {
            notes[fact.taxonomyId] = fact.notes;
          }
          // Se é uma condição e está marcada como true, adicionar ao set
          if (fact.valueBoolean === true && taxonomy.factType === 'boolean') {
            conditions.add(taxonomy.slug);
          }
        }
      });

      setFactValues(values);
      setFactNotes(notes);
      setSelectedConditions(conditions);
    } catch (err) {
      console.error('[ProfileHealth] Erro ao carregar seção:', err);
      throw err;
    }
  };

  const getFactForTaxonomy = (taxonomyId: string): UserHealthFact | undefined => {
    return getFactForTaxonomyLogic(taxonomyId, facts);
  };

  const getTaxonomyBySlug = (slug: string): HealthTaxonomy | undefined => {
    return getTaxonomyBySlugLogic(slug, taxonomies);
  };

  const handleConditionToggle = async (conditionSlug: string, checked: boolean) => {
    const taxonomy = getTaxonomyBySlug(conditionSlug);
    if (!taxonomy) return;

    const newConditions = new Set(selectedConditions);
    if (checked) {
      newConditions.add(conditionSlug);
    } else {
      newConditions.delete(conditionSlug);
    }
    setSelectedConditions(newConditions);

    // Salvar/remover fato automaticamente
    setIsSaving(true);
    try {
      if (checked) {
        await upsertHealthFact({
          taxonomyId: taxonomy.taxonomyId,
          valueBoolean: true,
        });
        // Recarregar fatos
        await loadSectionData();
      } else {
        const fact = getFactForTaxonomy(taxonomy.taxonomyId);
        if (fact) {
          await deleteHealthFact(fact.factId);
          await loadSectionData();
        }
      }
    } catch (err) {
      console.error('[ProfileHealth] Erro ao salvar condição:', err);
      // Reverter seleção em caso de erro
      setSelectedConditions(selectedConditions);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFactChange = (taxonomyId: string, value: any) => {
    setFactValues((prev) => ({ ...prev, [taxonomyId]: value }));
    if (saveError) setSaveError(null);
  };

  const handleNotesChange = (taxonomyId: string, notes: string) => {
    setFactNotes((prev) => ({ ...prev, [taxonomyId]: notes }));
  };

  const handleSaveFact = async (taxonomy: HealthTaxonomy) => {
    const value = factValues[taxonomy.taxonomyId];
    const notes = factNotes[taxonomy.taxonomyId] || '';

    if (value === undefined || value === null || value === '') {
      setSaveError(`Por favor, preencha o valor para "${taxonomy.name}".`);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let input: any = {
        taxonomyId: taxonomy.taxonomyId,
        notes: notes || null,
      };

      if (taxonomy.factType === 'device' || taxonomy.slug.includes('uso-')) {
        input.valueBoolean = value === true || value === 'true' || value === 'Sim';
      } else if (taxonomy.slug.includes('data') || taxonomy.slug.includes('exame') || taxonomy.slug.includes('consulta') || taxonomy.slug.includes('checkup')) {
        input.valueDate = value;
      } else if (typeof value === 'number') {
        input.valueNumber = value;
      } else if (typeof value === 'boolean') {
        input.valueBoolean = value;
      } else {
        input.valueText = String(value);
      }

      await upsertHealthFact(input);
      await loadSectionData();
      setSaveError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar fato de saúde.';
      setSaveError(errorMessage);
      console.error('[ProfileHealth] Erro ao salvar fato:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFact = async (factId: string) => {
    if (!confirm('Tem certeza que deseja remover este fato de saúde?')) {
      return;
    }

    try {
      await deleteHealthFact(factId);
      await loadSectionData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover fato de saúde.';
      alert(errorMessage);
      console.error('[ProfileHealth] Erro ao remover fato:', err);
    }
  };


  if (isLoading) {
    return (
      <div className="profile-learning">
        <div className="loading">Carregando raio-X de saúde...</div>
      </div>
    );
  }

  if (error && taxonomies.length === 0) {
    return (
      <div className="profile-learning">
        <div className="error-message" style={{
          padding: '1.5rem',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#dc2626',
          marginTop: '1rem'
        }}>
          <strong>Erro ao carregar raio-X de saúde</strong>
          <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProfileHealthForm
      activeSection={activeSection}
      setActiveSection={setActiveSection}
      taxonomies={taxonomies}
      facts={facts}
      selectedConditions={selectedConditions}
      factValues={factValues}
      factNotes={factNotes}
      saveError={saveError}
      isSaving={isSaving}
      getFactForTaxonomy={getFactForTaxonomy}
      getTaxonomyBySlug={getTaxonomyBySlug}
      handleConditionToggle={handleConditionToggle}
      handleFactChange={handleFactChange}
      handleSaveFact={handleSaveFact}
      handleDeleteFact={handleDeleteFact}
      setIsSaving={setIsSaving}
      loadSectionData={loadSectionData}
      upsertHealthFact={async (input: any) => { await upsertHealthFact(input); }}
      deleteHealthFact={deleteHealthFact}
    />
  );
}
