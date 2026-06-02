// src/components/ProfilePhysical.tsx
// Componente de perfil físico - autoexpressão declarativa.
//
// F3 (DECISION-0071): a seção "Estilo de Vida" (relationship_status/drinks/smokes) migrou para o SSOT
// Lifestyle actor-first (`/profile/lifestyle`, consent obrigatório, visibility private). `sexualOrientation`
// foi REMOVIDO (fora do MVP). Interesses seguem no C1 (Fatia 4c). weeklyRoutine/goals permanecem no fluxo
// LEGADO (PUT /profile/physical, metadata.physicalProfile) — o frontend NÃO envia mais `lifestyle` ao legado
// (cleanup do blob é a F5; primeiro muda o tráfego, depois remove a estrada velha).

import { useEffect } from 'react';
import { getPhysicalProfile, updatePhysicalProfile } from '../api/physical';
import {
  getInterestC1,
  declareInterestConceptC1,
  retireInterestConceptC1,
} from '../api/interestC1';
import {
  getLifestyle,
  declareLifestyleAttribute,
  retireLifestyleAttribute,
  type LifestyleAttributeKey,
} from '../api/lifestyle';
import { getCategoryTree, type Category, type CategoryTree } from '../api/categories';
import {
  useProfilePhysicalState,
  type SelectedInterest,
  type LifestyleAttrsState,
  EMPTY_LIFESTYLE_ATTRS,
  LIFESTYLE_KEYS,
} from '../hooks/useProfilePhysicalState';
import { useProfilePhysicalLogic } from '../hooks/useProfilePhysicalLogic';
import ProfilePhysicalForm from './ProfilePhysicalForm';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import './ProfilePhysical.css';

// weeklyRoutine/goals (não sensíveis) permanecem no blob legado physicalProfile.
interface PhysicalProfileData {
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

const CONSENT_VERSION = 'v1';
const CONSENT_SOURCE = 'profile_physical';

export default function ProfilePhysical() {
  const { activeActor, sessionReady } = useSession();

  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="físico" />;
  }

  const {
    profileData,
    setProfileData,
    lifestyleAttrs,
    setLifestyleAttrs,
    initialLifestyleAttrs,
    setInitialLifestyleAttrs,
    lifestyleConsent,
    setLifestyleConsent,
    lifestyleError,
    setLifestyleError,
    interestTree,
    setInterestTree,
    selectedInterests,
    setSelectedInterests,
    initialInterests,
    setInitialInterests,
    expandedInterests,
    setExpandedInterests,
    interestError,
    setInterestError,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
  } = useProfilePhysicalState();
  const { isInterestSelected: isInterestSelectedLogic, findCategoryInTree } = useProfilePhysicalLogic();

  useEffect(() => {
    if (!sessionReady) {
      setIsLoading(false);
      return;
    }
    loadData();
  }, [sessionReady]);

  const mapC1ToSelected = (
    concepts: { conceptId: string; sourceCategoryId: string | null }[],
    tree: CategoryTree[]
  ): SelectedInterest[] => {
    return concepts.map((c) => {
      const cat = c.sourceCategoryId ? findCategoryInTree(tree, c.sourceCategoryId) : null;
      return {
        categoryId: c.sourceCategoryId ?? c.conceptId,
        conceptId: c.conceptId,
        categoryName: cat?.name ?? 'Interesse',
        categoryPath: cat?.path ?? [],
      };
    });
  };

  // Projeta os atributos ativos do SSOT Lifestyle no estado local (snake_case).
  const mapLifestyleToState = (
    attributes: { attributeKey: string; attributeValue: string | null; isActive: boolean }[]
  ): LifestyleAttrsState => {
    const next: LifestyleAttrsState = { ...EMPTY_LIFESTYLE_ATTRS };
    for (const a of attributes) {
      if (!a.isActive) continue;
      if (a.attributeKey === 'relationship_status') next.relationship_status = a.attributeValue;
      else if (a.attributeKey === 'drinks') next.drinks = a.attributeValue;
      else if (a.attributeKey === 'smokes') next.smokes = a.attributeValue;
    }
    return next;
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setInterestError(null);
    setLifestyleError(null);
    try {
      // Interesses (C1).
      const tree = await getCategoryTree('interest');
      setInterestTree(tree);
      const c1 = await getInterestC1();
      const loadedInterests = mapC1ToSelected(c1.concepts, tree);
      setSelectedInterests(loadedInterests);
      setInitialInterests(loadedInterests);

      // Estilo de vida (SSOT actor-first, F3).
      const ls = await getLifestyle().catch(() => ({ attributes: [] }));
      const attrs = mapLifestyleToState(ls.attributes);
      setLifestyleAttrs(attrs);
      setInitialLifestyleAttrs(attrs);

      // weeklyRoutine/goals: fluxo LEGADO (physicalProfile no blob), não sensível. NÃO lê lifestyle do legado
      // (o estilo de vida agora é o SSOT). Só `metadata.physicalProfile` é consumido aqui.
      const profile = await getPhysicalProfile().catch(() => null);
      const physicalData = (profile?.metadata && typeof profile.metadata === 'object' && 'physicalProfile' in profile.metadata)
        ? (profile.metadata.physicalProfile as Partial<PhysicalProfileData>)
        : undefined;
      setProfileData({
        weeklyRoutine: physicalData?.weeklyRoutine ?? null,
        goals: physicalData?.goals ?? [],
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      console.error('Erro completo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // INTERESSES (C1)
  // ============================================================
  const toggleInterestCategory = (categoryId: string) => {
    const next = new Set(expandedInterests);
    if (next.has(categoryId)) next.delete(categoryId);
    else next.add(categoryId);
    setExpandedInterests(next);
  };

  const isInterestSelected = (categoryId: string): boolean =>
    isInterestSelectedLogic(categoryId, selectedInterests);

  const addInterest = (category: Category) => {
    if (isInterestSelected(category.categoryId)) return;
    if (!category.conceptId) {
      setInterestError('Este interesse ainda não está vinculado a um conceito no sistema e não pode ser declarado agora.');
      return;
    }
    setSelectedInterests([
      ...selectedInterests,
      { categoryId: category.categoryId, conceptId: category.conceptId, categoryName: category.name, categoryPath: category.path },
    ]);
    setInterestError(null);
  };

  const removeInterest = (categoryId: string) => {
    setSelectedInterests(selectedInterests.filter((s) => s.categoryId !== categoryId));
  };

  // ============================================================
  // ESTILO DE VIDA (SSOT) + físico legado (weeklyRoutine/goals)
  // ============================================================
  const updateLifestyleAttr = (key: LifestyleAttributeKey, value: string) => {
    setLifestyleAttrs({ ...lifestyleAttrs, [key]: value || null });
    setLifestyleError(null);
  };

  const updateWeeklyRoutine = (routine: PhysicalProfileData['weeklyRoutine']) => {
    setProfileData({ ...profileData, weeklyRoutine: routine });
  };

  const toggleGoal = (goal: 'estética' | 'bem_estar' | 'condicionamento') => {
    const isSelected = profileData.goals.includes(goal);
    setProfileData({
      ...profileData,
      goals: isSelected ? profileData.goals.filter((g) => g !== goal) : [...profileData.goals, goal],
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setInterestError(null);
    setLifestyleError(null);

    try {
      // 1) ESTILO DE VIDA → SSOT (diff vs snapshot). declare (valor) exige CONSENTIMENTO; retire (limpo) não.
      const declares: { key: LifestyleAttributeKey; value: string }[] = [];
      const retires: LifestyleAttributeKey[] = [];
      for (const key of LIFESTYLE_KEYS) {
        const cur = lifestyleAttrs[key];
        const init = initialLifestyleAttrs[key];
        if (cur === init) continue;
        if (cur && cur.length > 0) declares.push({ key, value: cur });
        else if (init) retires.push(key); // estava setado, agora vazio → retira
      }

      if (declares.length > 0 && !lifestyleConsent) {
        setLifestyleError('Marque o consentimento para salvar as informações de estilo de vida (privadas).');
        setIsSaving(false);
        return;
      }

      for (const d of declares) {
        await declareLifestyleAttribute(d.key, d.value, { accepted: true, source: CONSENT_SOURCE, version: CONSENT_VERSION });
      }
      for (const k of retires) {
        await retireLifestyleAttribute(k);
      }
      if (declares.length > 0 || retires.length > 0) {
        const ls = await getLifestyle();
        const attrs = mapLifestyleToState(ls.attributes);
        setLifestyleAttrs(attrs);
        setInitialLifestyleAttrs(attrs);
      }

      // 2) INTERESSES → C1 GRANULAR (diff).
      const initialByConcept = new Map(initialInterests.map((s) => [s.conceptId, s]));
      const currentByConcept = new Map(selectedInterests.map((s) => [s.conceptId, s]));
      for (const cur of selectedInterests) {
        if (!initialByConcept.has(cur.conceptId)) {
          await declareInterestConceptC1({ conceptId: cur.conceptId, sourceCategoryId: cur.categoryId });
        }
      }
      for (const prev of initialInterests) {
        if (!currentByConcept.has(prev.conceptId)) {
          await retireInterestConceptC1(prev.conceptId);
        }
      }

      // 3) FÍSICO LEGADO (weeklyRoutine/goals). NÃO envia `lifestyle` (saiu para o SSOT); interests=[] no blob.
      await updatePhysicalProfile({
        preferences: {},
        metadata: {
          physicalProfile: { weeklyRoutine: profileData.weeklyRoutine, goals: profileData.goals },
        },
      });

      // 4) Re-sincroniza snapshot de interesses.
      const c1 = await getInterestC1();
      const refreshed = mapC1ToSelected(c1.concepts, interestTree);
      setSelectedInterests(refreshed);
      setInitialInterests(refreshed);

      alert('Interesses e gostos atualizados com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setIsSaving(false);
    }
  };

  const renderInterestTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedInterests.has(category.categoryId);
      const isSelected = isInterestSelected(category.categoryId);
      const declarable = !!category.conceptId;
      const pathDisplay = category.path.length > 0 ? category.path.join(' > ') + ' > ' + category.name : category.name;

      return (
        <div key={category.categoryId} className="interest-tree-item" style={{ paddingLeft: `${level * 1.5}rem`, marginBottom: '0.25rem' }}>
          <div className="interest-tree-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {hasChildren && (
              <button
                type="button"
                className="expand-button"
                onClick={() => toggleInterestCategory(category.categoryId)}
                aria-label={isExpanded ? 'Recolher' : 'Expandir'}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span style={{ display: 'inline-block', width: '1rem' }} />}
            <span className="interest-tree-name" title={pathDisplay}>{category.name}</span>
            {declarable ? (
              isSelected ? (
                <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Selecionado</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addInterest(category)}
                  title={`Adicionar ${category.name}`}
                  style={{ padding: '0.25rem 0.75rem', backgroundColor: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  + Adicionar
                </button>
              )
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Navegue para ver interesses</span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="interest-tree-children">{renderInterestTree(category.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="profile-physical">
        <h2>Interesses e Gostos</h2>
        <div className="loading">Carregando interesses e gostos...</div>
      </div>
    );
  }

  return (
    <ProfilePhysicalForm
      error={error}
      interestError={interestError}
      profileData={profileData}
      lifestyleAttrs={lifestyleAttrs}
      lifestyleConsent={lifestyleConsent}
      setLifestyleConsent={setLifestyleConsent}
      lifestyleError={lifestyleError}
      updateLifestyleAttr={updateLifestyleAttr}
      isSaving={isSaving}
      interestTree={interestTree}
      selectedInterests={selectedInterests}
      isInterestSelected={isInterestSelected}
      removeInterest={removeInterest}
      renderInterestTree={renderInterestTree}
      updateWeeklyRoutine={updateWeeklyRoutine}
      toggleGoal={toggleGoal}
      handleSave={handleSave}
    />
  );
}
