/**
 * @unificard/contracts - Events
 * 
 * Tipos de domínio para eventos.
 * Fonte única de verdade para frontend e backend.
 */

/**
 * Status de um evento.
 */
export type EventStatus =
  | 'draft'         // Rascunho
  | 'published'     // Publicado
  | 'cancelled'    // Cancelado
  | 'completed';    // Concluído

/**
 * Tipo de evento.
 */
export type EventType =
  | 'workshop'      // Workshop
  | 'course'        // Curso
  | 'meetup'        // Meetup
  | 'conference'    // Conferência
  | 'seminar'       // Seminário
  | 'other';        // Outro












