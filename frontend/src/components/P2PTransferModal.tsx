// frontend/src/components/P2PTransferModal.tsx
// Modal mínimo de Transferência P2P — segundo contexto econômico ponta-a-ponta.
//
// Decisões UX mínimas (escopo MVP, frente Sub-B P2P UX):
//   - Destinatário: UUID direto (lookup email→UUID = frente futura)
//   - Valor: BRL com 2 casas decimais (convertido para cents na borda)
//   - 2-step: form → preview/confirmar (evita clique acidental)
//   - Pós-sucesso: fecha + onSuccess() recarrega Wallet
//
// Backend: POST /bank/p2p-transfer → motor canônico bankSplitEngine context='p2p_transfer'.

import { useState } from 'react';
import { p2pTransfer } from '../api/bank';
import { showToast } from './common/Toast';
import { centsToReais } from '../utils/money';
import './P2PTransferModal.css';

interface P2PTransferModalProps {
  currentBalanceCents: number;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'form' | 'preview' | 'processing' | 'success' | 'error';

export default function P2PTransferModal({ currentBalanceCents, onClose, onSuccess }: P2PTransferModalProps) {
  const [step, setStep] = useState<Step>('form');
  const [toUserId, setToUserId] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txId: string; remainingCents: number } | null>(null);

  const formatBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centsToReais(cents));

  const parseAmountCents = (str: string): number | null => {
    const normalized = str.replace(',', '.').trim();
    const reais = parseFloat(normalized);
    if (isNaN(reais) || reais <= 0) return null;
    return Math.round(reais * 100);
  };

  const isValidUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());

  const handleNext = () => {
    setError(null);
    const cents = parseAmountCents(amountStr);
    if (!isValidUuid(toUserId)) {
      setError('Destinatário inválido — informe o UUID do usuário destino');
      return;
    }
    if (cents === null) {
      setError('Valor inválido — informe um valor maior que zero (ex: 10,00)');
      return;
    }
    if (cents > currentBalanceCents) {
      setError(`Saldo insuficiente — você tem ${formatBRL(currentBalanceCents)}`);
      return;
    }
    setStep('preview');
  };

  const handleConfirm = async () => {
    const cents = parseAmountCents(amountStr);
    if (cents === null) return;
    setStep('processing');
    setError(null);
    try {
      const r = await p2pTransfer({ toUserId: toUserId.trim(), amountCents: cents });
      setResult({ txId: r.transaction.transactionId, remainingCents: r.fromAccountBalanceCents });
      setStep('success');
      showToast('Transferência realizada com sucesso!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao transferir';
      setError(msg);
      setStep('error');
      showToast(msg, 'error');
    }
  };

  const handleClose = () => {
    if (step === 'success' && onSuccess) onSuccess();
    onClose();
  };

  if (step === 'success' && result) {
    return (
      <div className="p2p-modal-overlay" onClick={handleClose}>
        <div className="p2p-modal" onClick={(e) => e.stopPropagation()}>
          <div className="p2p-success">
            <div className="p2p-success-icon">✓</div>
            <h2>Transferência concluída</h2>
            <p>Você transferiu <strong>{formatBRL(parseAmountCents(amountStr) ?? 0)}</strong></p>
            <div className="p2p-success-meta">
              <div><span>Saldo restante:</span> <strong>{formatBRL(result.remainingCents)}</strong></div>
              <div><span>Transação:</span> <code>{result.txId.substring(0, 8)}…</code></div>
            </div>
            <button className="p2p-action-primary" onClick={handleClose}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p2p-modal-overlay" onClick={onClose}>
      <div className="p2p-modal" onClick={(e) => e.stopPropagation()}>
        <div className="p2p-modal-header">
          <h2>Transferir</h2>
          <button className="p2p-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="p2p-modal-content">
          <div className="p2p-balance-line">
            <span>Saldo disponível:</span>
            <strong>{formatBRL(currentBalanceCents)}</strong>
          </div>

          {step === 'form' && (
            <>
              <label className="p2p-field">
                <span>Destinatário (UUID do usuário)</span>
                <input
                  type="text"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  placeholder="ex: 7e190a41-e25d-44f1-b174-31088702d386"
                  autoFocus
                />
              </label>

              <label className="p2p-field">
                <span>Valor (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="10,00"
                />
              </label>

              {error && <div className="p2p-error">{error}</div>}

              <div className="p2p-actions">
                <button className="p2p-action-secondary" onClick={onClose}>Cancelar</button>
                <button className="p2p-action-primary" onClick={handleNext}>Revisar</button>
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="p2p-preview">
                <div className="p2p-preview-row">
                  <span>Para:</span>
                  <code>{toUserId.substring(0, 8)}…{toUserId.substring(toUserId.length - 4)}</code>
                </div>
                <div className="p2p-preview-row">
                  <span>Valor:</span>
                  <strong>{formatBRL(parseAmountCents(amountStr) ?? 0)}</strong>
                </div>
                <div className="p2p-preview-row">
                  <span>Saldo após:</span>
                  <strong>{formatBRL(currentBalanceCents - (parseAmountCents(amountStr) ?? 0))}</strong>
                </div>
              </div>

              {error && <div className="p2p-error">{error}</div>}

              <div className="p2p-actions">
                <button className="p2p-action-secondary" onClick={() => setStep('form')}>Voltar</button>
                <button className="p2p-action-primary" onClick={handleConfirm}>Confirmar</button>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div className="p2p-processing">
              <div className="p2p-spinner" />
              <p>Processando transferência…</p>
            </div>
          )}

          {step === 'error' && (
            <>
              <div className="p2p-error">{error || 'Erro ao processar transferência'}</div>
              <div className="p2p-actions">
                <button className="p2p-action-secondary" onClick={onClose}>Fechar</button>
                <button className="p2p-action-primary" onClick={() => setStep('form')}>Tentar novamente</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
