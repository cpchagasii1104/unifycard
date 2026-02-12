import type { PredefinedService } from '../api/categories';

interface PredefinedServicesManagerFormProps {
  services: PredefinedService[];
  errors: Record<number, string[]>;
  addService: () => void;
  removeService: (index: number) => void;
  updateService: (index: number, field: keyof PredefinedService, value: any) => void;
}

export default function PredefinedServicesManagerForm({
  services,
  errors,
  addService,
  removeService,
  updateService,
}: PredefinedServicesManagerFormProps) {
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



