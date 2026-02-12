// src/core/social/ports/actor-intent.port.ts
/**
 * Port: Actor Intent
 * 
 * Re-exporta tipos de intents de actor.
 * Implementação real está em @modules/social
 */

export enum ActorIntent {
  SHARE_CONTENT = 'SHARE_CONTENT',
  ANNOUNCE_EVENT = 'ANNOUNCE_EVENT',
  OFFER_SERVICE = 'OFFER_SERVICE',
  OFFER_PRODUCT = 'OFFER_PRODUCT',
  REQUEST_BOOKING = 'REQUEST_BOOKING',
  CREATE_PROJECT = 'CREATE_PROJECT',
  ANNOUNCE_JOB = 'ANNOUNCE_JOB',
  START_VOTE = 'START_VOTE',
  REQUEST_HELP = 'REQUEST_HELP',
  SEND_CTA = 'SEND_CTA',
  RECEIVE_PAYMENT = 'RECEIVE_PAYMENT',
}

export const LEGACY_INTENT_MAP: Record<string, ActorIntent> = {
  'personal': ActorIntent.SHARE_CONTENT,
  'friends': ActorIntent.SHARE_CONTENT,
  'event': ActorIntent.ANNOUNCE_EVENT,
  'service_offer': ActorIntent.OFFER_SERVICE,
  'product_offer': ActorIntent.OFFER_PRODUCT,
  'booking': ActorIntent.REQUEST_BOOKING,
  'project': ActorIntent.CREATE_PROJECT,
};





