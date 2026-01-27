// frontend/src/components/compatibility/CompatibilityModal.tsx
// Modal de Compatibilidade antes de Booking
// 🔴 BLINDAGEM: Exige confirmação explícita, bloqueia se incompatível

import { useState, useEffect } from 'react';
import type { CompatibilityResult, ServiceSetupPackage, EventCapacityMetadata, VenueInfrastructureMetadata } from '../../types/compatibility';
import { evaluateCompatibility } from '../../api/compatibility';
import CompatibilityChecklist from './CompatibilityChecklist';
import ServiceSetupSelector from './ServiceSetupSelector';
import { getCapacityClass } from '../../types/compatibility';
import './CompatibilityModal.css';

interface CompatibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (setupId: string, compatibility: CompatibilityResult) => void;
  eventCapacity?: EventCapacityMetadata;
  venueInfrastructure?: VenueInfrastructureMetadata;
  serviceSetups: ServiceSetupPackage[];
  basePriceCents?: number;
  serviceId: string;
}

export default function CompatibilityModal({
  isOpen,
  onClose,
  onConfirm,
  eventCapacity,
  venueInfrastructure,
  serviceSetups,
  basePriceCents,
  serviceId,
}: CompatibilityModalProps) {
  const [selectedSetupId, setSelectedSetupId] = useState<string>('');
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    if (isOpen && serviceSetups.length > 0 && !selectedSetupId) {
      // Selecionar primeiro setup por padrão
      setSelectedSetupId(serviceSetups[0].id);
    }
  }, [isOpen, serviceSetups, selectedSetupId]);

  useEffect(() => {
    if (selectedSetupId && eventCapacity && venueInfrastructure) {
      evaluateCompatibilityForSetup();
    }
  }, [selectedSetupId, eventCapacity, venueInfrastructure, basePriceCents]);

  const evaluateCompatibilityForSetup = async () => {
    if (!selectedSetupId || !eventCapacity || !venueInfrastructure) return;

    const selectedSetup = serviceSetups.find(s => s.id === selectedSetupId);
    if (!selectedSetup) return;

    setIsEvaluating(true);
    try {
      const result = await evaluateCompatibility({
        eventCapacity: {
          expectedAttendance: eventCapacity.expectedAttendance,
          capacityClass: eventCapacity.capacityClass,
        },
        venueInfrastructure: {
          available: venueInfrastructure.available || [],
          unavailable: venueInfrastructure.unavailable || [],
          constraints: venueInfrastructure.constraints || [],
        },
        serviceSetup: {
          id: selectedSetup.id,
          label: selectedSetup.label,
          brings: selectedSetup.brings,
          requires: selectedSetup.requires,
          optional: selectedSetup.optional,
          minCapacityClass: selectedSetup.minCapacityClass,
          maxCapacityClass: selectedSetup.maxCapacityClass,
          priceModifier: selectedSetup.priceModifier,
        },
        basePriceCents,
      });

      setCompatibility(result);
    } catch (error: any) {
      console.error('Erro ao avaliar compatibilidade:', error);
      // Em caso de erro, criar resultado bloqueado
      setCompatibility({
        status: 'BLOCKED',
        missingRequired: [],
        missingOptional: [],
        extraAvailable: [],
        pricing: {
          reason: ['Erro ao avaliar compatibilidade'],
        },
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleConfirm = () => {
    if (compatibility && selectedSetupId) {
      onConfirm(selectedSetupId, compatibility);
    }
  };

  if (!isOpen) return null;

  const canProceed = compatibility?.status !== 'BLOCKED' && !compatibility?.requiresProductionAssistance;

  return (
    <div className="compatibility-modal-overlay" onClick={onClose}>
      <div className="compatibility-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Verificação de Compatibilidade Técnica</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {!eventCapacity || !venueInfrastructure ? (
            <div className="compatibility-warning">
              <p>⚠️ Informações de capacidade ou infraestrutura não disponíveis.</p>
              <p>Configure estas informações no evento antes de criar um booking.</p>
            </div>
          ) : (
            <>
              <ServiceSetupSelector
                setups={serviceSetups}
                selectedSetupId={selectedSetupId}
                onSelect={setSelectedSetupId}
              />

              {isEvaluating ? (
                <div className="evaluating">Avaliando compatibilidade...</div>
              ) : compatibility ? (
                <>
                  <CompatibilityChecklist result={compatibility} showPricing={true} />

                  {compatibility.requiresProductionAssistance && (
                    <div className="production-assistance-warning">
                      <h4>⚠️ Produção Assistida Obrigatória</h4>
                      <p>
                        Eventos XL/XXL requerem produção assistida. O booking direto está bloqueado.
                        Entre em contato com nossa equipe para contratar este serviço.
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          {compatibility && (
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={!canProceed || isEvaluating}
            >
              {compatibility.status === 'BLOCKED'
                ? 'Bloqueado - Verifique Itens'
                : compatibility.requiresProductionAssistance
                ? 'Requer Produção Assistida'
                : 'Confirmar e Continuar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}




