// src/components/PredefinedServicesManager.tsx
// Componente para gerenciar serviços pré-definidos com valores fixos

import { useState } from 'react';
import type { PredefinedService } from '../api/categories';
import { sanitizeString, validateMonetaryValue } from '../utils/validation';
import './PredefinedServicesManager.css';

interface PredefinedServicesManagerProps {
  services: PredefinedService[];
  onChange: (services: PredefinedService[]) => void;
  categoryName: string;
}

export default function PredefinedServicesManager({
  services,
  onChange,
  categoryName: _categoryName,
}: PredefinedServicesManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string[]>>({});

  const addService = () => {
    const newService: PredefinedService = {
      serviceId: `service-${Date.now()}`,
      name: '',
      description: '',
      basePrice: 0,
      discountPercentage: 0,
      finalPrice: 0,
      isActive: true,
    };
    onChange([...services, newService]);
    setEditingIndex(services.length);
  };

  const updateService = (index: number, field: keyof PredefinedService, value: any) => {
    const updated = [...services];
    
    // CORREÇÃO CRÍTICA: Não sanitizar description durante digitação (remove espaços!)
    // Sanitização apenas no submit, não na digitação
    if (typeof value === 'string') {
      if (field === 'description') {
        // Apenas limitar tamanho, NÃO fazer trim durante digitação
        value = value.substring(0, 500);
      } else if (field === 'name') {
        value = sanitizeString(value, 200);
      }
    }
    
    updated[index] = { ...updated[index], [field]: value };
    
    // Calcular preço final se basePrice ou discountPercentage mudou
    if (field === 'basePrice' || field === 'discountPercentage') {
      const basePrice = field === 'basePrice' ? value : updated[index].basePrice;
      const discount = field === 'discountPercentage' ? (value || 0) : (updated[index].discountPercentage || 0);
      updated[index].finalPrice = basePrice * (1 - discount / 100);
    }
    
    onChange(updated);

    // Validação em tempo real
    const validation = validateService(updated[index]);
    if (validation.valid) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    } else {
      setErrors((prev) => ({ ...prev, [index]: validation.errors }));
    }
  };

  const removeService = (index: number) => {
    const updated = services.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const validateService = (service: PredefinedService): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (!service.name || service.name.trim().length < 3) {
      errors.push('Nome do serviço deve ter pelo menos 3 caracteres');
    }
    
    const priceValidation = validateMonetaryValue(service.basePrice);
    if (!priceValidation.valid) {
      errors.push(priceValidation.error || 'Preço base inválido');
    }
    
    if (service.discountPercentage !== undefined) {
      if (service.discountPercentage < 0 || service.discountPercentage > 100) {
        errors.push('Desconto deve estar entre 0% e 100%');
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  return (
    <div className="predefined-services-manager">
      <div className="services-header">
        <h4>Serviços Pré-definidos</h4>
        <button type="button" onClick={addService} className="add-service-button">
          + Adicionar Serviço
        </button>
      </div>
      
      <p className="services-hint">
        Defina serviços com valores fixos (ex: "Trocar chuveiro: R$ 150", "Trocar torneira: R$ 80").
        Você pode oferecer descontos e os clientes podem solicitar orçamento personalizado.
      </p>

      {services.length === 0 && (
        <div className="empty-services">
          <p>Nenhum serviço pré-definido ainda.</p>
          <p className="hint">Clique em "Adicionar Serviço" para começar.</p>
        </div>
      )}

      <div className="services-list">
        {services.map((service, index) => (
          <div key={service.serviceId} className="service-card">
            <div className="service-card-header">
              <h5>
                {service.name || 'Novo Serviço'}
                {service.discountPercentage && service.discountPercentage > 0 && (
                  <span className="discount-badge">-{service.discountPercentage}%</span>
                )}
              </h5>
              <button
                type="button"
                onClick={() => removeService(index)}
                className="remove-service-button"
                title="Remover"
              >
                ✕
              </button>
            </div>

            <div className="service-fields">
              <div className="service-field">
                <label>Nome do Serviço *</label>
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => updateService(index, 'name', e.target.value)}
                  placeholder="Ex: Trocar chuveiro, Instalar torneira..."
                  className={errors[index]?.some(e => e.includes('Nome')) ? 'error' : ''}
                  required
                />
                {errors[index]?.some(e => e.includes('Nome')) && (
                  <span className="field-error">{errors[index].find(e => e.includes('Nome'))}</span>
                )}
              </div>

              <div className="service-field">
                <label>Descrição (opcional)</label>
                <textarea
                  value={service.description || ''}
                  onChange={(e) => updateService(index, 'description', e.target.value)}
                  placeholder="Detalhes do serviço..."
                  rows={2}
                  maxLength={500}
                />
                <p className="field-hint">{(service.description || '').length}/500 caracteres</p>
              </div>

              <div className="service-price-row">
                <div className="service-field">
                  <label>Preço Base (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="999999.99"
                    value={service.basePrice || ''}
                    onChange={(e) => updateService(index, 'basePrice', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className={errors[index]?.some(e => e.includes('Preço')) ? 'error' : ''}
                    required
                  />
                  {errors[index]?.some(e => e.includes('Preço')) && (
                    <span className="field-error">{errors[index].find(e => e.includes('Preço'))}</span>
                  )}
                </div>

                <div className="service-field">
                  <label>Desconto (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={service.discountPercentage || 0}
                    onChange={(e) => updateService(index, 'discountPercentage', parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={errors[index]?.some(e => e.includes('Desconto')) ? 'error' : ''}
                  />
                  {errors[index]?.some(e => e.includes('Desconto')) && (
                    <span className="field-error">{errors[index].find(e => e.includes('Desconto'))}</span>
                  )}
                  <p className="field-hint">Desconto opcional (0-100%)</p>
                </div>

                <div className="service-field final-price">
                  <label>Preço Final</label>
                  <div className="final-price-display">
                    R$ {service.finalPrice.toFixed(2)}
                  </div>
                  <p className="field-hint">
                    {service.discountPercentage && service.discountPercentage > 0
                      ? `Com ${service.discountPercentage}% de desconto`
                      : 'Sem desconto'}
                  </p>
                </div>
              </div>

              <div className="service-field-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={service.isActive}
                    onChange={(e) => updateService(index, 'isActive', e.target.checked)}
                  />
                  <span>Serviço ativo (visível para clientes)</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


