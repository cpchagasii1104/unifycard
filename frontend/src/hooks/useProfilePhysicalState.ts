import { useState } from 'react';
import type { LifestyleInfo } from '../api/physical';
import type { CategoryTree } from '../api/categories';

// Interesse selecionado (C1 actor-first/concept-first, DECISION-0067). BINÁRIO: sem state/weight/priority.
// categoryId = breadcrumb (= source_category_id no C1); conceptId = identidade semântica (Lei 7).
export interface SelectedInterest {
  categoryId: string;
  conceptId: string;
  categoryName: string;
  categoryPath: string[];
}

// habits/weeklyRoutine/goals + interests permanecem no fluxo LEGADO (blob global_users.metadata).
// interests aqui é apenas o valor carregado do blob, PRESERVADO para o save legado (zero cleanup do blob).
// A seção de Interesses da UI NÃO usa mais este campo — ela usa selectedInterests (C1).
interface UserInterestLegacy {
  conceptId: string;
  label: string;
  state: 'gosto' | 'pratico_as_vezes' | 'pratico_regularmente';
  domain: string;
  isCustom: boolean;
}

interface PhysicalProfileData {
  interests: UserInterestLegacy[];
  habits: {
    smoking: 'não_fumo' | 'ocasionalmente' | 'regularmente' | null;
    drinking: 'não_bebo' | 'socialmente' | 'regularmente' | null;
  };
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

export function useProfilePhysicalState() {
  const [profileData, setProfileData] = useState<PhysicalProfileData>({
    interests: [],
    habits: {
      smoking: null,
      drinking: null,
    },
    weeklyRoutine: null,
    goals: [],
  });

  const [lifestyle, setLifestyle] = useState<LifestyleInfo>({
    drinks: null,
    smokes: null,
    relationshipStatus: null,
    sexualOrientation: null,
  });

  // C1 de Interesse (substitui o catálogo hardcoded — Fatia 4c).
  const [interestTree, setInterestTree] = useState<CategoryTree[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<SelectedInterest[]>([]);
  // Snapshot do C1 no load (diff granular do save: novo→POST, removido→DELETE).
  const [initialInterests, setInitialInterests] = useState<SelectedInterest[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<Set<string>>(new Set());
  const [interestError, setInterestError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
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
  };
}
