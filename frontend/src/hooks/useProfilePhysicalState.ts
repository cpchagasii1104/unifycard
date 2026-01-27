import { useState } from 'react';
import type { LifestyleInfo } from '../api/physical';

type LifeDomain = 
  | 'atividades_e_praticas'
  | 'lazer_e_entretenimento'
  | 'leitura_e_conteudo'
  | 'musica_e_cultura'
  | 'gastronomia_e_consumo'
  | 'habitos_e_rotinas'
  | 'experiencias_viagens_e_eventos';

type InterestState = 'gosto' | 'pratico_as_vezes' | 'pratico_regularmente';

type ConceptId = string;

interface UserInterest {
  conceptId: ConceptId;
  label: string;
  state: InterestState;
  domain: LifeDomain;
  isCustom: boolean;
}

interface PhysicalProfileData {
  interests: UserInterest[];
  habits: {
    smoking: 'não_fumo' | 'ocasionalmente' | 'regularmente' | null;
    drinking: 'não_bebo' | 'socialmente' | 'regularmente' | null;
  };
  weeklyRoutine: 'leve' | 'moderada' | 'intensa' | null;
  goals: ('estética' | 'bem_estar' | 'condicionamento')[];
}

export function useProfilePhysicalState() {
  const [activeDomain, setActiveDomain] = useState<LifeDomain | null>(null);
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

  const [customInterestInput, setCustomInterestInput] = useState<Record<LifeDomain, string>>({
    atividades_e_praticas: '',
    lazer_e_entretenimento: '',
    leitura_e_conteudo: '',
    musica_e_cultura: '',
    gastronomia_e_consumo: '',
    habitos_e_rotinas: '',
    experiencias_viagens_e_eventos: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return {
    activeDomain,
    setActiveDomain,
    profileData,
    setProfileData,
    lifestyle,
    setLifestyle,
    customInterestInput,
    setCustomInterestInput,
    isLoading,
    setIsLoading,
    isSaving,
    setIsSaving,
    error,
    setError,
  };
}



