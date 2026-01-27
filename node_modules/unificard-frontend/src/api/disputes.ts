// frontend/src/api/disputes.ts
// CONTINUOUS PRODUCTION: API Client para Disputas - SPRINT 11
// Cliente frontend para gerenciar disputas (usando localStorage como persistência temporária)

import { observePilotEvent } from '../services/pilot-observer.service';

import { apiFetch } from './client';
import type { Dispute, DisputeReason, DisputeStatus } from '../types/dispute';

// NOTA: Esta implementação usa localStorage como persistência temporária
// Em produção, isso deve ser substituído por endpoints backend reais
const DISPUTES_STORAGE_KEY = 'unify_disputes';

function getStoredDisputes(): Dispute[] {
  try {
    const stored = localStorage.getItem(DISPUTES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveDisputes(disputes: Dispute[]): void {
  try {
    localStorage.setItem(DISPUTES_STORAGE_KEY, JSON.stringify(disputes));
  } catch (err) {
    console.error('Erro ao salvar disputas:', err);
  }
}

/**
 * Lista disputas para um actor específico
 */
export async function listDisputes(actorId: string): Promise<Dispute[]> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // const response = await apiFetch(`/disputes?actor_id=${actorId}`, {}, { silent401: true });
  // return response.json();
  
  const disputes = getStoredDisputes();
  return disputes.filter(d => d.actorId === actorId);
}

/**
 * Lista disputas abertas para um actor
 */
export async function listOpenDisputes(actorId: string): Promise<Dispute[]> {
  const disputes = await listDisputes(actorId);
  return disputes.filter(d => d.status === 'open');
}

/**
 * Obtém uma disputa por ID
 */
export async function getDispute(disputeId: string): Promise<Dispute | null> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // const response = await apiFetch(`/disputes/${disputeId}`, {}, { silent401: true });
  // return response.json();
  
  const disputes = getStoredDisputes();
  return disputes.find(d => d.id === disputeId) || null;
}

/**
 * Cria uma nova disputa
 */
export async function createDispute(
  relatedActivityId: string,
  actorId: string,
  openedByUserId: string,
  reason: DisputeReason,
  description: string
): Promise<Dispute> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // const response = await apiFetch('/disputes', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     related_activity_id: relatedActivityId,
  //     actor_id: actorId,
  //     opened_by_user_id: openedByUserId,
  //     reason,
  //     description,
  //   }),
  // }, { silent401: false });
  // return response.json();
  
  const disputes = getStoredDisputes();
  const newDispute: Dispute = {
    id: `dispute_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    relatedActivityId,
    actorId,
    openedByUserId,
    openedAt: new Date().toISOString(),
    reason,
    description,
    status: 'open',
    metadata: {},
  };
  
  disputes.push(newDispute);
  saveDisputes(disputes);
  
  // Observar primeiro evento de disputa aberta
  observePilotEvent('first_dispute_opened', actorId, 'user', {
    reason,
  });
  
  return newDispute;
}

/**
 * Resolve uma disputa (marca como resolvida sem reversão)
 */
export async function resolveDispute(
  disputeId: string,
  resolvedByUserId: string,
  resolutionNote?: string
): Promise<Dispute> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // const response = await apiFetch(`/disputes/${disputeId}/resolve`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     resolved_by_user_id: resolvedByUserId,
  //     resolution_note: resolutionNote,
  //   }),
  // }, { silent401: false });
  // return response.json();
  
  const disputes = getStoredDisputes();
  const dispute = disputes.find(d => d.id === disputeId);
  if (!dispute) {
    throw new Error('Disputa não encontrada');
  }
  
  dispute.status = 'resolved';
  dispute.resolvedByUserId = resolvedByUserId;
  dispute.resolvedAt = new Date().toISOString();
  dispute.resolutionNote = resolutionNote;
  
  saveDisputes(disputes);
  
  return dispute;
}

/**
 * Rejeita uma disputa
 */
export async function rejectDispute(
  disputeId: string,
  resolvedByUserId: string,
  resolutionNote?: string
): Promise<Dispute> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // const response = await apiFetch(`/disputes/${disputeId}/reject`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     resolved_by_user_id: resolvedByUserId,
  //     resolution_note: resolutionNote,
  //   }),
  // }, { silent401: false });
  // return response.json();
  
  const disputes = getStoredDisputes();
  const dispute = disputes.find(d => d.id === disputeId);
  if (!dispute) {
    throw new Error('Disputa não encontrada');
  }
  
  dispute.status = 'rejected';
  dispute.resolvedByUserId = resolvedByUserId;
  dispute.resolvedAt = new Date().toISOString();
  dispute.resolutionNote = resolutionNote;
  
  saveDisputes(disputes);
  
  return dispute;
}

/**
 * Reverte uma disputa (aciona reversão técnica)
 */
export async function revertDispute(
  disputeId: string,
  resolvedByUserId: string,
  transactionId: string,
  resolutionNote?: string
): Promise<Dispute> {
  // TODO: Substituir por chamada real ao backend quando disponível
  // Primeiro, reverter a transação usando a API existente
  // await apiFetch(`/bank/transactions/${transactionId}/reverse`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     reason: 'dispute_resolution',
  //     dispute_id: disputeId,
  //   }),
  // }, { silent401: false });
  // 
  // Depois, atualizar a disputa
  // const response = await apiFetch(`/disputes/${disputeId}/revert`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     resolved_by_user_id: resolvedByUserId,
  //     reverted_transaction_id: transactionId,
  //     resolution_note: resolutionNote,
  //   }),
  // }, { silent401: false });
  // return response.json();
  
  const disputes = getStoredDisputes();
  const dispute = disputes.find(d => d.id === disputeId);
  if (!dispute) {
    throw new Error('Disputa não encontrada');
  }
  
  dispute.status = 'reverted';
  dispute.resolvedByUserId = resolvedByUserId;
  dispute.resolvedAt = new Date().toISOString();
  dispute.revertedTransactionId = transactionId;
  dispute.resolutionNote = resolutionNote;
  
  saveDisputes(disputes);
  
  return dispute;
}







