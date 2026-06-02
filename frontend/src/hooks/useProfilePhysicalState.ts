import { useState } from 'react';
import type { CategoryTree } from '../api/categories';
import type { LifestyleAttributeKey } from '../api/lifestyle';

// Interesse selecionado (C1 actor-first/concept-first, DECISION-0067). BINÁRIO.
export interface SelectedInterest {
  categoryId: string;
  conceptId: string;
  categoryName: string;
  categoryPath: string[];
}

// weeklyRoutine/goals permanecem no fluxo LEGADO (blob global_users.metadata.physicalProfile) — não sensíveis.
// drinks/smokes/relationship_status saíram para o SSOT Lifestyle (F3). sexualOrientation foi REMOVIDO.
interface PhysicalProfileData {
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

// Atributos de lifestyle (SSOT actor-first, DECISION-0071/F3). Valores em snake_case (enums do schema).
export interface LifestyleAttrsState {
  relationship_status: string | null;
  drinks: string | null;
  smokes: string | null;
}

export const EMPTY_LIFESTYLE_ATTRS: LifestyleAttrsState = {
  relationship_status: null,
  drinks: null,
  smokes: null,
};

export const LIFESTYLE_KEYS: LifestyleAttributeKey[] = ['relationship_status', 'drinks', 'smokes'];

export function useProfilePhysicalState() {
  const [profileData, setProfileData] = useState<PhysicalProfileData>({
    weeklyRoutine: null,
    goals: [],
  });

  // SSOT Lifestyle (F3): atributos atuais + snapshot do load (diff granular: declare/retire) + consent + erro.
  const [lifestyleAttrs, setLifestyleAttrs] = useState<LifestyleAttrsState>({ ...EMPTY_LIFESTYLE_ATTRS });
  const [initialLifestyleAttrs, setInitialLifestyleAttrs] = useState<LifestyleAttrsState>({ ...EMPTY_LIFESTYLE_ATTRS });
  const [lifestyleConsent, setLifestyleConsent] = useState<boolean>(false);
  const [lifestyleError, setLifestyleError] = useState<string | null>(null);

  // C1 de Interesse (Fatia 4c).
  const [interestTree, setInterestTree] = useState<CategoryTree[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<SelectedInterest[]>([]);
  const [initialInterests, setInitialInterests] = useState<SelectedInterest[]>([]);
  const [expandedInterests, setExpandedInterests] = useState<Set<string>>(new Set());
  const [interestError, setInterestError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
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
  };
}
