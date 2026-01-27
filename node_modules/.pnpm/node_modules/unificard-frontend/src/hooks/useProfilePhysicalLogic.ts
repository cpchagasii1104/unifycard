type LifeDomain = 
  | 'atividades_e_praticas'
  | 'lazer_e_entretenimento'
  | 'leitura_e_conteudo'
  | 'musica_e_cultura'
  | 'gastronomia_e_consumo'
  | 'habitos_e_rotinas'
  | 'experiencias_viagens_e_eventos';

type ConceptId = string;

interface ConceptDefinition {
  conceptId: ConceptId;
  label: string;
  domain: LifeDomain;
}

interface UserInterest {
  conceptId: ConceptId;
  label: string;
  state: 'gosto' | 'pratico_as_vezes' | 'pratico_regularmente';
  domain: LifeDomain;
  isCustom: boolean;
}

const PREDEFINED_CONCEPTS: ConceptDefinition[] = [
  { conceptId: 'activity.swimming', label: 'Natação', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.running', label: 'Corrida', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.yoga', label: 'Yoga', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.cycling', label: 'Ciclismo', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.gym', label: 'Academia', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.dancing', label: 'Dança', domain: 'atividades_e_praticas' },
  { conceptId: 'activity.martial_arts', label: 'Artes Marciais', domain: 'atividades_e_praticas' },
  { conceptId: 'leisure.videogames', label: 'Videogames', domain: 'lazer_e_entretenimento' },
  { conceptId: 'leisure.board_games', label: 'Jogos de Tabuleiro', domain: 'lazer_e_entretenimento' },
  { conceptId: 'leisure.cinema', label: 'Cinema', domain: 'lazer_e_entretenimento' },
  { conceptId: 'leisure.theater', label: 'Teatro', domain: 'lazer_e_entretenimento' },
  { conceptId: 'leisure.karting', label: 'Karting', domain: 'lazer_e_entretenimento' },
  { conceptId: 'leisure.bowling', label: 'Boliche', domain: 'lazer_e_entretenimento' },
  { conceptId: 'content.reading', label: 'Leitura', domain: 'leitura_e_conteudo' },
  { conceptId: 'content.podcasts', label: 'Podcasts', domain: 'leitura_e_conteudo' },
  { conceptId: 'content.documentaries', label: 'Documentários', domain: 'leitura_e_conteudo' },
  { conceptId: 'content.writing', label: 'Escrita', domain: 'leitura_e_conteudo' },
  { conceptId: 'content.photography', label: 'Fotografia', domain: 'leitura_e_conteudo' },
  { conceptId: 'music.rock', label: 'Rock', domain: 'musica_e_cultura' },
  { conceptId: 'music.pop', label: 'Pop', domain: 'musica_e_cultura' },
  { conceptId: 'music.samba', label: 'Samba', domain: 'musica_e_cultura' },
  { conceptId: 'music.jazz', label: 'Jazz', domain: 'musica_e_cultura' },
  { conceptId: 'music.classical', label: 'Música Clássica', domain: 'musica_e_cultura' },
  { conceptId: 'music.electronic', label: 'Eletrônica', domain: 'musica_e_cultura' },
  { conceptId: 'culture.museums', label: 'Museus', domain: 'musica_e_cultura' },
  { conceptId: 'culture.art_galleries', label: 'Galerias de Arte', domain: 'musica_e_cultura' },
  { conceptId: 'food.cooking', label: 'Culinária', domain: 'gastronomia_e_consumo' },
  { conceptId: 'food.restaurants', label: 'Restaurantes', domain: 'gastronomia_e_consumo' },
  { conceptId: 'food.wine', label: 'Vinhos', domain: 'gastronomia_e_consumo' },
  { conceptId: 'food.craft_beer', label: 'Cerveja Artesanal', domain: 'gastronomia_e_consumo' },
  { conceptId: 'food.coffee', label: 'Café', domain: 'gastronomia_e_consumo' },
  { conceptId: 'habit.meditation', label: 'Meditação', domain: 'habitos_e_rotinas' },
  { conceptId: 'habit.morning_routine', label: 'Rotina Matinal', domain: 'habitos_e_rotinas' },
  { conceptId: 'habit.night_owl', label: 'Coruja Noturna', domain: 'habitos_e_rotinas' },
  { conceptId: 'habit.early_bird', label: 'Madrugador', domain: 'habitos_e_rotinas' },
  { conceptId: 'experience.travel', label: 'Viagens', domain: 'experiencias_viagens_e_eventos' },
  { conceptId: 'experience.adventure', label: 'Aventura', domain: 'experiencias_viagens_e_eventos' },
  { conceptId: 'experience.festivals', label: 'Festivais', domain: 'experiencias_viagens_e_eventos' },
  { conceptId: 'experience.concerts', label: 'Shows', domain: 'experiencias_viagens_e_eventos' },
  { conceptId: 'experience.sports_events', label: 'Eventos Esportivos', domain: 'experiencias_viagens_e_eventos' },
];

export function useProfilePhysicalLogic() {
  const generateCustomConceptId = (label: string, domain: LifeDomain): ConceptId => {
    const normalized = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
    
    const domainPrefix = domain.split('_')[0];
    return `custom.${domainPrefix}.${normalized}`;
  };

  const getInterestsByDomain = (domain: LifeDomain, interests: UserInterest[]): UserInterest[] => {
    return interests.filter(i => i.domain === domain);
  };

  const getConceptsByDomain = (domain: LifeDomain): ConceptDefinition[] => {
    return PREDEFINED_CONCEPTS.filter(c => c.domain === domain);
  };

  const isConceptSelected = (conceptId: ConceptId, interests: UserInterest[]): boolean => {
    return interests.some(i => i.conceptId === conceptId);
  };

  return {
    generateCustomConceptId,
    getInterestsByDomain,
    getConceptsByDomain,
    isConceptSelected,
    PREDEFINED_CONCEPTS,
  };
}



