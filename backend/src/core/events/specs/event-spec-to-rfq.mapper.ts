// backend/src/core/events/specs/event-spec-to-rfq.mapper.ts
// Helper para converter EventSpec em CreateEventRFQInput
// ⚠️ REGRAS: Apenas mapear dados (snapshot declarativo). NÃO inferir, NÃO filtrar, NÃO decidir nada.
// P0-4: Mapear vocabulário do BirthdayWizard para RFQ

import type { EventSpec } from './event-spec.types';
import type { CreateEventRFQInput, RFQItem, RFQCriteria } from '@modules/events/event-rfq.types';

/**
 * 🔴 P0-4: Vocabulário fechado de categorias de serviços válidas
 * Valores devem corresponder a services.category (enum do sistema)
 */
const VALID_SERVICE_CATEGORIES = new Set([
  'venue_rental',
  'kids_entertainment',
  'dj_music',
  'band_music',
  'photography',
  'videography',
  'catering',
  'decoration',
  'cleaning',
  'security',
  'waitstaff',
  'bartending',
  'event_planning',
  'sound_equipment',
  'lighting',
  'stage_setup',
]);

/**
 * 🔴 P0-4: Mapeamento de valores do BirthdayWizard para categorias válidas
 */
const BIRTHDAY_TO_CATEGORY_MAP: Record<string, string> = {
  // support_services
  'LIMPEZA': 'cleaning',
  'GARCONS': 'waitstaff',
  'SEGURANCA': 'security',
  'DECORACAO': 'decoration',
  
  // activities.entertainment
  'BRINQUEDOS': 'kids_entertainment',
  'PISCINA_DE_BOLINHAS': 'kids_entertainment',
  'RECREADOR': 'kids_entertainment',
  'PERSONAGENS': 'kids_entertainment',
  
  // music.types
  'DJ': 'dj_music',
  'BANDA': 'band_music',
  'PLAYLIST': 'dj_music', // Playlist pode ser considerado DJ
  
  // audiovisual
  'photography': 'photography',
  'filming': 'videography',
  
  // location.desired_venue_types (se não tem local, precisa de venue_rental)
  'SALAO': 'venue_rental',
  'CHACARA': 'venue_rental',
  'CLUBE': 'venue_rental',
  'ESPACO_INFANTIL': 'venue_rental',
  'CASA_EVENTOS': 'venue_rental',
};

/**
 * Converte EventSpec em CreateEventRFQInput
 * ⚠️ REGRAS: Apenas mapear dados declarados. NÃO inferir necessidades.
 * 🔴 P0-4: Mapear vocabulário do BirthdayWizard para categorias válidas
 */
export function mapEventSpecToCreateRFQInput(
  eventSpec: EventSpec,
  eventId: string
): CreateEventRFQInput {
  const answers = eventSpec.answers;
  const items: RFQItem[] = [];
  const categorySet = new Set<string>(); // Evitar duplicatas

  // 🔴 P0-4: Mapear support_services[] → serviceCategories
  if (answers.support_services && Array.isArray(answers.support_services)) {
    for (const service of answers.support_services) {
      const category = BIRTHDAY_TO_CATEGORY_MAP[service];
      if (category && VALID_SERVICE_CATEGORIES.has(category)) {
        if (!categorySet.has(category)) {
          categorySet.add(category);
          items.push({
            type: 'need',
            id: category,
            category: category,
            description: `Serviço de ${service.toLowerCase()}`,
          });
        }
      } else {
        // 🔴 P0-4: Valor desconhecido → erro claro e auditável
        console.warn(`[P0-4] Categoria de serviço desconhecida no support_services: ${service}`);
      }
    }
  }

  // 🔴 P0-4: Mapear activities.entertainment[] → serviceCategories
  if (answers.activities?.entertainment && Array.isArray(answers.activities.entertainment)) {
    for (const entertainment of answers.activities.entertainment) {
      const category = BIRTHDAY_TO_CATEGORY_MAP[entertainment];
      if (category && VALID_SERVICE_CATEGORIES.has(category)) {
        if (!categorySet.has(category)) {
          categorySet.add(category);
          items.push({
            type: 'need',
            id: category,
            category: category,
            description: `Entretenimento: ${entertainment.toLowerCase()}`,
          });
        }
      } else {
        console.warn(`[P0-4] Categoria de entretenimento desconhecida: ${entertainment}`);
      }
    }
  }

  // 🔴 P0-4: Mapear music.types[] → serviceCategories
  if (answers.music?.types && Array.isArray(answers.music.types)) {
    for (const musicType of answers.music.types) {
      const category = BIRTHDAY_TO_CATEGORY_MAP[musicType];
      if (category && VALID_SERVICE_CATEGORIES.has(category)) {
        if (!categorySet.has(category)) {
          categorySet.add(category);
          items.push({
            type: 'need',
            id: category,
            category: category,
            description: `Música: ${musicType.toLowerCase()}`,
          });
        }
      } else {
        console.warn(`[P0-4] Tipo de música desconhecido: ${musicType}`);
      }
    }
  }

  // 🔴 P0-4: Mapear audiovisual.photography / filming → serviceCategories
  if (answers.audiovisual) {
    if (answers.audiovisual.photography === true) {
      const category = 'photography';
      if (!categorySet.has(category)) {
        categorySet.add(category);
        items.push({
          type: 'need',
          id: category,
          category: category,
          description: 'Fotografia do evento',
        });
      }
    }
    if (answers.audiovisual.filming === true) {
      const category = 'videography';
      if (!categorySet.has(category)) {
        categorySet.add(category);
        items.push({
          type: 'need',
          id: category,
          category: category,
          description: 'Filmagem do evento',
        });
      }
    }
  }

  // 🔴 P0-4: Mapear location.desired_venue_types[] → serviceCategories (venue_rental)
  // Se location.has_venue === false, precisa de venue_rental
  if (answers.location) {
    if (answers.location.has_venue === false) {
      const category = 'venue_rental';
      if (!categorySet.has(category)) {
        categorySet.add(category);
        items.push({
          type: 'need',
          id: category,
          category: category,
          description: 'Locação de espaço para evento',
        });
      }
    }
    
    // Se tem desired_venue_types, também indica necessidade de venue_rental
    if (answers.location.desired_venue_types && Array.isArray(answers.location.desired_venue_types)) {
      const category = 'venue_rental';
      if (!categorySet.has(category)) {
        categorySet.add(category);
        items.push({
          type: 'need',
          id: category,
          category: category,
          description: 'Locação de espaço para evento',
        });
      }
    }
  }

  // 🔴 P0-4: Se não houver items declarados, NÃO criar fallback genérico
  // Erro claro e auditável conforme especificação
  if (items.length === 0) {
    throw new Error(
      '[P0-4] EventSpec não contém serviços declarados suficientes para gerar RFQ. ' +
      'É necessário declarar pelo menos um serviço (support_services, activities.entertainment, music.types, audiovisual, ou location.desired_venue_types).'
    );
  }

  // 🔴 P0-4: Mapear location.region.city → localização do RFQ
  const location = answers.location?.region?.city || 
                   answers.location?.address?.cep || 
                   answers.location?.region?.area || 
                   null;

  // Mapear time_window para date do RFQ
  const date = answers.time_window?.date || 
               answers.time_window?.starts_at || 
               null;

  // Mapear critérios do RFQ
  const criteria: RFQCriteria = {
    date: date,
    location: location,
    locationLatitude: answers.location?.address?.latitude || null,
    locationLongitude: answers.location?.address?.longitude || null,
    notes: answers.project_name || answers.description || null,
    expectedPriceCents: null, // Não mapear preço do EventSpec para RFQ
  };

  return {
    eventId,
    items,
    criteria,
  };
}

