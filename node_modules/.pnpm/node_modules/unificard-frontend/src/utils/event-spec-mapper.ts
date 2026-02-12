// frontend/src/utils/event-spec-mapper.ts
// Helpers de mapeamento para EventSpec
// ⚠️ REGRAS: Apenas mapear dados (snapshot declarativo). NÃO inferir, NÃO filtrar, NÃO decidir nada.

import type { MacroIntention, Subflow, QuestionnaireAnswers } from '../types/event-spec';
import type { WizardData } from '../components/events/EventCreationWizard';

/**
 * Mapeia event_type do wizard para macro_intention do EventSpec
 */
export function mapIntentionToMacroIntention(
  eventType: WizardData['event_type']
): MacroIntention {
  // Mapeamento direto baseado em event_type
  if (eventType === 'private') {
    return 'celebrate'; // Eventos privados geralmente são celebrações
  }
  if (eventType === 'social' || eventType === 'community') {
    return 'gather';
  }
  if (eventType === 'professional') {
    return 'teach';
  }
  if (eventType === 'cultural' || eventType === 'gastronomic') {
    return 'present';
  }
  // Fallback para outros tipos
  return 'other';
}

/**
 * Mapeia event_subtype do wizard para subflow do EventSpec
 */
export function mapSubtypeToSubflow(
  eventSubtype: string | null
): Subflow {
  // Mapeamento direto baseado em event_subtype
  if (eventSubtype === 'birthday') {
    return 'birthday_party';
  }
  if (eventSubtype === 'wedding') {
    return 'wedding';
  }
  if (eventSubtype === 'graduation') {
    return 'graduation';
  }
  // Fallback para outros subtipos
  return 'other';
}

/**
 * Mapeia WizardData para QuestionnaireAnswers (snapshot declarativo)
 */
export function mapWizardDataToAnswers(data: WizardData): QuestionnaireAnswers {
  const answers: QuestionnaireAnswers = {};

  // Step 2: Event Type
  if (data.event_type) {
    answers.event_type = data.event_type;
  }
  if (data.event_subtype) {
    answers.event_subtype = data.event_subtype;
  }
  if (data.custom_subtype_text) {
    answers.custom_subtype_text = data.custom_subtype_text;
  }

  // Step 2.5: Foundation
  if (data.foundation) {
    if (data.foundation.event_date) {
      answers.event_date = data.foundation.event_date;
    }
    if (data.foundation.event_time_start) {
      answers.event_time_start = data.foundation.event_time_start;
    }
    if (data.foundation.event_duration_hours) {
      answers.event_duration_hours = data.foundation.event_duration_hours;
    }
    if (data.foundation.event_time_end) {
      answers.event_time_end = data.foundation.event_time_end;
    }
    if (data.foundation.has_venue !== null && data.foundation.has_venue !== undefined) {
      answers.has_venue = data.foundation.has_venue;
    }
    if (data.foundation.city) {
      answers.city = data.foundation.city;
    }
    if (data.foundation.region) {
      answers.region = data.foundation.region;
    }
    if (data.foundation.desired_venue_type) {
      answers.desired_venue_type = data.foundation.desired_venue_type;
    }
    if (data.foundation.event_style) {
      answers.event_style = data.foundation.event_style;
    }
    if (data.foundation.desired_atmosphere) {
      answers.desired_atmosphere = data.foundation.desired_atmosphere;
    }
    if (data.foundation.theme_aesthetic) {
      answers.theme_aesthetic = data.foundation.theme_aesthetic;
    }
  }

  // Step 3: Context
  if (data.title) {
    answers.title = data.title;
  }
  if (data.description) {
    answers.description = data.description;
  }
  if (data.datetime_start) {
    answers.datetime_start = data.datetime_start;
  }
  if (data.datetime_end) {
    answers.datetime_end = data.datetime_end;
  }
  if (data.location_type) {
    answers.location_type = data.location_type;
  }
  if (data.location_name) {
    answers.location_name = data.location_name;
  }
  if (data.visibility) {
    answers.visibility = data.visibility;
  }

  // Step 3.5: Birthday Wizard
  if (data.birthday_wizard) {
    if (data.birthday_wizard.birthday_profile) {
      answers.birthday_profile = data.birthday_wizard.birthday_profile;
    }
    if (data.birthday_wizard.theme) {
      answers.birthday_theme = data.birthday_wizard.theme;
    }
    if (data.birthday_wizard.desired_space_type) {
      answers.desired_space_type = data.birthday_wizard.desired_space_type;
    }
    if (data.birthday_wizard.needed_infrastructure && data.birthday_wizard.needed_infrastructure.length > 0) {
      answers.needed_infrastructure = data.birthday_wizard.needed_infrastructure;
    }
    if (data.birthday_wizard.available_infrastructure && data.birthday_wizard.available_infrastructure.length > 0) {
      answers.available_infrastructure = data.birthday_wizard.available_infrastructure;
    }
    if (data.birthday_wizard.total_count !== null && data.birthday_wizard.total_count !== undefined) {
      answers.total_count = data.birthday_wizard.total_count;
    }
    if (data.birthday_wizard.adults_count !== null && data.birthday_wizard.adults_count !== undefined) {
      answers.adults_count = data.birthday_wizard.adults_count;
    }
    if (data.birthday_wizard.children_count !== null && data.birthday_wizard.children_count !== undefined) {
      answers.children_count = data.birthday_wizard.children_count;
    }
    if (data.birthday_wizard.wants_invite_system !== null && data.birthday_wizard.wants_invite_system !== undefined) {
      answers.wants_invite_system = data.birthday_wizard.wants_invite_system;
    }
    if (data.birthday_wizard.food_options && data.birthday_wizard.food_options.length > 0) {
      answers.food_options = data.birthday_wizard.food_options;
    }
    if (data.birthday_wizard.needed_services && data.birthday_wizard.needed_services.length > 0) {
      answers.needed_services = data.birthday_wizard.needed_services;
    }
    if (data.birthday_wizard.has_budget !== null && data.birthday_wizard.has_budget !== undefined) {
      answers.has_budget = data.birthday_wizard.has_budget;
    }
  }

  // Step 4: Economy
  if (data.economy_type) {
    answers.economy_type = data.economy_type;
  }
  if (data.ticket_price_cents !== null && data.ticket_price_cents !== undefined) {
    answers.ticket_price_cents = data.ticket_price_cents;
  }
  if (data.max_attendees !== null && data.max_attendees !== undefined) {
    answers.max_attendees = data.max_attendees;
  }

  return answers;
}



