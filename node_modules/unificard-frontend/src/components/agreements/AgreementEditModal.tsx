// frontend/src/components/agreements/AgreementEditModal.tsx
// Modal para editar Agreement Draft
// 🔴 BLINDAGEM: Só permite editar se status for DRAFT ou PROPOSED

import { useState } from 'react';
import { updateAgreement, type Agreement, type UpdateAgreementInput } from '../../api/agreements';
import { showToast } from '../../utils/toast';
import './AgreementEditModal.css';

interface AgreementEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreement: Agreement;
  onSave: (agreement: Agreement) => void;
}

export default function AgreementEditModal({
  isOpen,
  onClose,
  agreement,
  onSave,
}: AgreementEditModalProps) {
  const [priceCents, setPriceCents] = useState<string>((agreement.priceCents / 100).toFixed(2));
  const [currency, setCurrency] = useState(agreement.currency);
  const [scope, setScope] = useState(agreement.scope);
  const [includedItems, setIncludedItems] = useState(agreement.includedItems.join('\n'));
  const [excludedItems, setExcludedItems] = useState(agreement.excludedItems.join('\n'));
  const [responsibilities, setResponsibilities] = useState(agreement.responsibilities || '');
  const [capacityAssumptions, setCapacityAssumptions] = useState(
    agreement.capacityAssumptions || ''
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!scope.trim()) {
      showToast('Escopo é obrigatório', 'error');
      return;
    }

    setIsSaving(true);

    try {
      const priceValue = parseFloat(priceCents.replace(',', '.'));
      if (isNaN(priceValue) || priceValue < 0) {
        showToast('Valor inválido', 'error');
        setIsSaving(false);
        return;
      }

      const input: UpdateAgreementInput = {
        priceCents: Math.round(priceValue * 100),
        currency,
        scope: scope.trim(),
        includedItems: includedItems
          .split('\n')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        excludedItems: excludedItems
          .split('\n')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
        responsibilities: responsibilities.trim() || undefined,
        capacityAssumptions: capacityAssumptions.trim() || undefined,
      };

      const updated = await updateAgreement(agreement.agreementId, input);
      onSave(updated);
      showToast('Acordo atualizado com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar acordo', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="agreement-edit-modal-overlay" onClick={onClose}>
      <div className="agreement-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Editar Acordo</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="form-group">
            <label>
              Valor (R$) *
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceCents}
                onChange={(e) => setPriceCents(e.target.value)}
                placeholder="0.00"
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Moeda
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="BRL">BRL (Real Brasileiro)</option>
                <option value="USD">USD (Dólar Americano)</option>
                <option value="EUR">EUR (Euro)</option>
              </select>
            </label>
          </div>

          <div className="form-group">
            <label>
              Escopo *
              <textarea
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Descreva o escopo do serviço..."
                rows={4}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Itens Inclusos (um por linha)
              <textarea
                value={includedItems}
                onChange={(e) => setIncludedItems(e.target.value)}
                placeholder="Equipamento 1&#10;Equipamento 2&#10;Serviço adicional"
                rows={4}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Itens Excluídos (um por linha)
              <textarea
                value={excludedItems}
                onChange={(e) => setExcludedItems(e.target.value)}
                placeholder="Item não incluído 1&#10;Item não incluído 2"
                rows={3}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Responsabilidades
              <textarea
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                placeholder="Quem fornece o quê..."
                rows={3}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Premissas de Capacidade
              <textarea
                value={capacityAssumptions}
                onChange={(e) => setCapacityAssumptions(e.target.value)}
                placeholder="Público estimado, carga técnica..."
                rows={2}
              />
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

