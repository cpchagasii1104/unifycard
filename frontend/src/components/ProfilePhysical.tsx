// src/components/ProfilePhysical.tsx
// Componente de perfil físico - autoexpressão declarativa
// 🔒 CONTRATO: Físico é um mapa declarativo de interesses, hábitos e práticas de vida.
// É autoexpressão voluntária, mutável e contextual.
// Físico NÃO é: profissão, saúde clínica, personalidade, score, identidade fixa, classificação humana.
// Preferências declaradas NÃO decidem nada no sistema.
//
// Fatia 4c (DECISION-0067): a seção de INTERESSES foi migrada do catálogo HARDCODED/blob para o C1
// actor-first/concept-first (/profile/interest/c1, árvore real scope='interest'). O catálogo fake
// (PREDEFINED_CONCEPTS com conceptId 'leisure.cinema'/'activity.swimming') foi REMOVIDO. O restante
// (hábitos/rotina/objetivos/lifestyle) CONTINUA no fluxo LEGADO (PUT /profile/physical) — intocado.

import { useEffect } from 'react';
import {
  getPhysicalProfile,
  updatePhysicalProfile,
} from '../api/physical';
import {
  getInterestC1,
  declareInterestConceptC1,
  retireInterestConceptC1,
} from '../api/interestC1';
import { getCategoryTree, type Category, type CategoryTree } from '../api/categories';
import { useProfilePhysicalState, type SelectedInterest } from '../hooks/useProfilePhysicalState';
import { useProfilePhysicalLogic } from '../hooks/useProfilePhysicalLogic';
import ProfilePhysicalForm from './ProfilePhysicalForm';
import { useSession } from '../contexts/SessionProvider';
import NotApplicableMessage from './NotApplicableMessage';
import './ProfilePhysical.css';

// ============================================================
// LIFESTYLE LEGADO (hábitos/rotina/objetivos) — fora do C1
// ============================================================
// Estes campos permanecem declarativos no blob legado (PUT /profile/physical). NÃO migram para o C1
// nesta fatia (DT-LIFESTYLE-SENSITIVE-IN-BLOB é frente própria). interests aqui é o valor do blob,
// preservado para o save legado (zero cleanup do blob) — a UI NÃO o edita mais.
interface PhysicalProfileData {
  // Valor legado do blob (UserInterest[]), preservado verbatim — a UI não o edita nesta fatia.
  interests: any[];
  habits: {
    smoking: 'não_fumo' | 'ocasionalmente' | 'regularmente' | null;
    drinking: 'não_bebo' | 'socialmente' | 'regularmente' | null;
  };
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

export default function ProfilePhysical() {
  const { activeActor, sessionReady } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="físico" />;
  }

  const {
    profileData,
    setProfileData,
    lifestyle,
    setLifestyle,
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

  // Mapeia declarações C1 → modelo local. Nome/path resolvidos via sourceCategoryId na árvore (breadcrumb/UI,
  // não identidade). Fallback honesto por conceptId quando a categoria não é resolvível (sem inventar category).
  const mapC1ToSelected = (
    concepts: { conceptId: string; sourceCategoryId: string | null }[],
    tree: CategoryTree[]
  ): SelectedInterest[] => {
    return concepts.map((c) => {
      const cat = c.sourceCategoryId ? findCategoryInTree(tree, c.sourceCategoryId) : null;
      return {
        categoryId: c.sourceCategoryId ?? c.conceptId, // chave de UI (breadcrumb se houver)
        conceptId: c.conceptId,
        categoryName: cat?.name ?? 'Interesse',
        categoryPath: cat?.path ?? [],
      };
    });
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setInterestError(null);
    try {
      // 🔴 Interesses: árvore real scope='interest' (conceptId surfaçado pela Fatia 4a) + declarações C1.
      const tree = await getCategoryTree('interest');
      setInterestTree(tree);
      const c1 = await getInterestC1();
      const loadedInterests = mapC1ToSelected(c1.concepts, tree);
      setSelectedInterests(loadedInterests);
      setInitialInterests(loadedInterests); // snapshot para o diff granular do save

      // Lifestyle/hábitos/rotina/objetivos: fluxo LEGADO (blob), intocado.
      const profile = await getPhysicalProfile().catch(() => ({
        globalUserId: '',
        interests: [],
        lifestyle: {
          drinks: null,
          smokes: null,
          relationshipStatus: null,
          sexualOrientation: null,
        },
        preferences: {},
        metadata: {},
      }));

      setLifestyle(profile.lifestyle);

      // 🔒 Carregar dados declarativos legados de metadata (se existir). interests do blob é PRESERVADO
      // (não editado pela UI), apenas carregado para reescrita verbatim no save (zero cleanup do blob).
      const physicalData = (profile.metadata && typeof profile.metadata === 'object' && 'physicalProfile' in profile.metadata)
        ? (profile.metadata.physicalProfile as Partial<PhysicalProfileData>)
        : undefined;

      if (physicalData) {
        setProfileData({
          interests: physicalData.interests || [],
          habits: physicalData.habits || {
            smoking: null,
            drinking: null,
          },
          weeklyRoutine: physicalData.weeklyRoutine || null,
          goals: physicalData.goals || [],
        });
      } else {
        // Migrar dados antigos se necessário
        setProfileData({
          interests: [],
          habits: {
            smoking: profile.lifestyle.smokes === 'never' ? 'não_fumo' :
                     profile.lifestyle.smokes === 'occasionally' ? 'ocasionalmente' :
                     profile.lifestyle.smokes === 'regularly' ? 'regularmente' : null,
            drinking: profile.lifestyle.drinks === 'never' ? 'não_bebo' :
                      profile.lifestyle.drinks === 'socially' ? 'socialmente' :
                      profile.lifestyle.drinks === 'regularly' ? 'regularmente' : null,
          },
          weeklyRoutine: null,
          goals: [],
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados';
      setError(errorMessage);
      console.error('Erro completo:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // INTERESSES (C1 actor-first/concept-first) — árvore real scope='interest'
  // ============================================================
  const toggleInterestCategory = (categoryId: string) => {
    const next = new Set(expandedInterests);
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    setExpandedInterests(next);
  };

  const isInterestSelected = (categoryId: string): boolean => {
    return isInterestSelectedLogic(categoryId, selectedInterests);
  };

  const addInterest = (category: Category) => {
    if (isInterestSelected(category.categoryId)) {
      return;
    }
    // TRAVA C1: declaração exige conceptId real surfaçado pelo backend (Fatia 4a). Sem fallback
    // conceptId ← categoryId, sem inventar conceito. Folha sem conceptId (ex.: raiz de navegação)
    // não é declarável.
    if (!category.conceptId) {
      setInterestError(
        'Este interesse ainda não está vinculado a um conceito no sistema e não pode ser declarado agora.'
      );
      return;
    }
    setSelectedInterests([
      ...selectedInterests,
      {
        categoryId: category.categoryId,
        conceptId: category.conceptId,
        categoryName: category.name,
        categoryPath: category.path,
      },
    ]);
    setInterestError(null);
  };

  const removeInterest = (categoryId: string) => {
    setSelectedInterests(selectedInterests.filter((s) => s.categoryId !== categoryId));
  };

  // ============================================================
  // LIFESTYLE LEGADO (hábitos/rotina/objetivos/estilo de vida) — intocado
  // ============================================================
  const updateHabits = (field: 'smoking' | 'drinking', value: PhysicalProfileData['habits']['smoking'] | PhysicalProfileData['habits']['drinking']) => {
    setProfileData({
      ...profileData,
      habits: {
        ...profileData.habits,
        [field]: value,
      },
    });
  };

  const updateWeeklyRoutine = (routine: PhysicalProfileData['weeklyRoutine']) => {
    setProfileData({
      ...profileData,
      weeklyRoutine: routine,
    });
  };

  const toggleGoal = (goal: 'estética' | 'bem_estar' | 'condicionamento') => {
    const currentGoals = profileData.goals;
    const isSelected = currentGoals.includes(goal);

    setProfileData({
      ...profileData,
      goals: isSelected
        ? currentGoals.filter(g => g !== goal)
        : [...currentGoals, goal],
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setInterestError(null);

    try {
      // 1) INTERESSES → C1 GRANULAR (diff contra o snapshot do load). conceptId = identidade;
      //    categoryId = breadcrumb (sourceCategoryId). Binário: novo→POST declare, removido→DELETE retire.
      const initialByConcept = new Map(initialInterests.map((s) => [s.conceptId, s]));
      const currentByConcept = new Map(selectedInterests.map((s) => [s.conceptId, s]));

      for (const cur of selectedInterests) {
        if (!initialByConcept.has(cur.conceptId)) {
          await declareInterestConceptC1({
            conceptId: cur.conceptId,
            sourceCategoryId: cur.categoryId,
          });
        }
      }
      for (const prev of initialInterests) {
        if (!currentByConcept.has(prev.conceptId)) {
          await retireInterestConceptC1(prev.conceptId);
        }
      }

      // 2) LIFESTYLE LEGADO — INTOCADO. interests:[] (já era o comportamento); blob preservado verbatim
      //    (profileData.interests = valor carregado, não editado). NÃO grava interesses como SSOT aqui.
      await updatePhysicalProfile({
        interests: [], // Não usar categorias
        lifestyle: {
          ...lifestyle,
          smokes: profileData.habits.smoking === 'não_fumo' ? 'never' :
                 profileData.habits.smoking === 'ocasionalmente' ? 'occasionally' :
                 (profileData.habits.smoking === 'regularmente' ? 'regularly' : null),
          drinks: profileData.habits.drinking === 'não_bebo' ? 'never' :
                 profileData.habits.drinking === 'socialmente' ? 'socially' :
                 (profileData.habits.drinking === 'regularmente' ? 'regularly' : null),
        },
        preferences: {},
        metadata: {
          physicalProfile: profileData, // 🔒 Dados declarativos legados (interests do blob preservado)
        },
      });

      // 3) Releitura do C1 → re-sincroniza o snapshot (próximo diff parte do estado real).
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

  // renderInterestTree: declarável = folha com conceptId real; raiz sem conceptId é só navegação/grupo.
  const renderInterestTree = (categories: CategoryTree[], level: number = 0): JSX.Element[] => {
    return categories.map((category) => {
      const hasChildren = category.children && category.children.length > 0;
      const isExpanded = expandedInterests.has(category.categoryId);
      const isSelected = isInterestSelected(category.categoryId);
      const declarable = !!category.conceptId;
      const pathDisplay = category.path.length > 0
        ? category.path.join(' > ') + ' > ' + category.name
        : category.name;

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
            <span className="interest-tree-name" title={pathDisplay}>
              {category.name}
            </span>
            {declarable ? (
              isSelected ? (
                <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Selecionado</span>
              ) : (
                <button
                  type="button"
                  onClick={() => addInterest(category)}
                  title={`Adicionar ${category.name}`}
                  style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  + Adicionar
                </button>
              )
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Navegue para ver interesses</span>
            )}
          </div>
          {hasChildren && isExpanded && (
            <div className="interest-tree-children">
              {renderInterestTree(category.children!, level + 1)}
            </div>
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
      lifestyle={lifestyle}
      isSaving={isSaving}
      interestTree={interestTree}
      selectedInterests={selectedInterests}
      isInterestSelected={isInterestSelected}
      removeInterest={removeInterest}
      renderInterestTree={renderInterestTree}
      updateHabits={updateHabits}
      updateWeeklyRoutine={updateWeeklyRoutine}
      toggleGoal={toggleGoal}
      setLifestyle={setLifestyle}
      handleSave={handleSave}
    />
  );
}
