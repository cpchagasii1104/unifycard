// backend/src/modules/wallet/actor-bank-destination.types.ts
//
// F4.0 — actor_bank_destinations (DECISION-0060, 2026-05-28).
//
// Tipos canônicos do catálogo de destinos externos DECLARADOS do actor.
// MVP: zero PSP, zero PIX/TED real, zero ledger.

export type ActorBankDestinationType = 'pix_key' | 'bank_account';

export type ActorBankDestinationPixKeyType =
  | 'cpf'
  | 'cnpj'
  | 'email'
  | 'phone'
  | 'random';

export type ActorBankDestinationAccountType = 'checking' | 'savings' | 'payment';

export type ActorBankDestinationHolderDocType = 'cpf' | 'cnpj';

export type ActorBankDestinationStatus =
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'archived';

export type ActorBankDestinationOwnershipMethod =
  | 'auto_tax_id_match'
  | 'manual_review'
  | 'psp_future';

/** Row do DB (snake_case). */
export interface ActorBankDestinationRow {
  id: string;
  tenant_id: string;
  actor_id: string;

  destination_type: ActorBankDestinationType;

  pix_key_type: ActorBankDestinationPixKeyType | null;
  pix_key_value_normalized: string | null;

  bank_code: string | null;
  bank_name: string | null;
  agency_number: string | null;
  account_number: string | null;
  account_digit: string | null;
  account_type: ActorBankDestinationAccountType | null;

  holder_name: string;
  holder_document: string;
  holder_document_type: ActorBankDestinationHolderDocType;

  status: ActorBankDestinationStatus;
  rejected_reason: string | null;
  archived_at: Date | null;

  ownership_verification_method: ActorBankDestinationOwnershipMethod | null;
  ownership_verified_at: Date | null;

  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/** Domain representation (camelCase). */
export interface ActorBankDestination {
  id: string;
  tenantId: string;
  actorId: string;
  destinationType: ActorBankDestinationType;

  pixKeyType: ActorBankDestinationPixKeyType | null;
  pixKeyValueNormalized: string | null;

  bankCode: string | null;
  bankName: string | null;
  agencyNumber: string | null;
  accountNumber: string | null;
  accountDigit: string | null;
  accountType: ActorBankDestinationAccountType | null;

  holderName: string;
  holderDocument: string;
  holderDocumentType: ActorBankDestinationHolderDocType;

  status: ActorBankDestinationStatus;
  rejectedReason: string | null;
  archivedAt: string | null;

  ownershipVerificationMethod: ActorBankDestinationOwnershipMethod | null;
  ownershipVerifiedAt: string | null;

  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Estados terminais — não admitem transições adicionais (exceto archived que é terminal puro). */
export const ACTOR_BANK_DESTINATION_TERMINAL_STATUSES: ActorBankDestinationStatus[] = ['archived'];

/** Estados ativos (cadastro vigente). Apenas 'verified' admite uso futuro em payout externo (F4.1+). */
export const ACTOR_BANK_DESTINATION_ACTIVE_STATUSES: ActorBankDestinationStatus[] = [
  'pending_verification',
  'verified',
];

export function toActorBankDestination(row: ActorBankDestinationRow): ActorBankDestination {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    destinationType: row.destination_type,
    pixKeyType: row.pix_key_type,
    pixKeyValueNormalized: row.pix_key_value_normalized,
    bankCode: row.bank_code,
    bankName: row.bank_name,
    agencyNumber: row.agency_number,
    accountNumber: row.account_number,
    accountDigit: row.account_digit,
    accountType: row.account_type,
    holderName: row.holder_name,
    holderDocument: row.holder_document,
    holderDocumentType: row.holder_document_type,
    status: row.status,
    rejectedReason: row.rejected_reason,
    archivedAt: row.archived_at ? row.archived_at.toISOString() : null,
    ownershipVerificationMethod: row.ownership_verification_method,
    ownershipVerifiedAt: row.ownership_verified_at ? row.ownership_verified_at.toISOString() : null,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
