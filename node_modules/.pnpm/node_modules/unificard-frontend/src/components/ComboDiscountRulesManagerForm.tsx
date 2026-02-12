import type { ComboDiscountRule } from '../api/categories';

interface ComboDiscountRulesManagerFormProps {
  rules: ComboDiscountRule[];
  errors: Record<number, string[]>;
  addRule: () => void;
  removeRule: (index: number) => void;
  updateRule: (index: number, field: keyof ComboDiscountRule, value: any) => void;
}

export default function ComboDiscountRulesManagerForm({
  rules,
  errors,
  addRule,
  removeRule,
  updateRule,
}: ComboDiscountRulesManagerFormProps) {
  return (
    <div className="combo-discount-rules-manager">
      <div className="rules-header">
        <h4>Descontos para Combos (Múltiplos Serviços)</h4>
        <button type="button" onClick={addRule} className="add-rule-button">
          + Adicionar Regra
        </button>
      </div>
      
      <p className="rules-hint">
        Defina descontos progressivos quando o cliente contratar múltiplos serviços. 
        Exemplo: 5% de desconto ao contratar 2 serviços, 10% para 3 serviços, 15% para 4 ou mais.
      </p>

      {rules.length === 0 && (
        <div className="empty-rules">
          <p>Nenhuma regra de desconto para combos ainda.</p>
          <p className="hint">Clique em "Adicionar Regra" para começar.</p>
        </div>
      )}

      <div className="rules-list">
        {rules.map((rule, index) => (
          <div key={rule.ruleId} className="rule-card">
            <div className="rule-card-header">
              <h5>
                Desconto ao contratar {rule.minServices} ou mais serviços
              </h5>
              <button
                type="button"
                onClick={() => removeRule(index)}
                className="remove-rule-button"
                title="Remover"
              >
                ✕
              </button>
            </div>

            <div className="rule-fields">
              <div className="rule-field">
                <label>Mínimo de Serviços *</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={rule.minServices}
                  onChange={(e) => updateRule(index, 'minServices', parseInt(e.target.value) || 2)}
                  className={errors[index]?.some(e => e.includes('Mínimo')) ? 'error' : ''}
                  required
                />
                {errors[index]?.some(e => e.includes('Mínimo')) && (
                  <span className="field-error">{errors[index].find(e => e.includes('Mínimo'))}</span>
                )}
                <p className="field-hint">Número mínimo de serviços que o cliente deve contratar para receber o desconto</p>
              </div>

              <div className="rule-field">
                <label>Desconto (%) *</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={rule.discountPercentage}
                  onChange={(e) => updateRule(index, 'discountPercentage', parseFloat(e.target.value) || 0)}
                  className={errors[index]?.some(e => e.includes('Desconto')) ? 'error' : ''}
                  required
                />
                {errors[index]?.some(e => e.includes('Desconto')) && (
                  <span className="field-error">{errors[index].find(e => e.includes('Desconto'))}</span>
                )}
                <p className="field-hint">Desconto percentual aplicado (0-100%)</p>
              </div>

              <div className="rule-field">
                <label>Descrição (opcional)</label>
                <input
                  type="text"
                  value={rule.description || ''}
                  onChange={(e) => updateRule(index, 'description', e.target.value)}
                  placeholder="Ex: Desconto especial para múltiplos serviços..."
                  maxLength={500}
                />
                <p className="field-hint">{(rule.description || '').length}/500 caracteres</p>
              </div>

              <div className="rule-field-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={(e) => updateRule(index, 'isActive', e.target.checked)}
                  />
                  <span>Regra ativa (visível para clientes)</span>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rules.length > 0 && (
        <div className="combo-example">
          <h5>💡 Exemplo de Cálculo:</h5>
          <p>
            Se o cliente contratar <strong>{rules[0]?.minServices || 2} ou mais serviços</strong> e você tiver
            serviços pré-definidos (ex: "Trocar torneira: R$ 20", "Trocar tomada: R$ 15"), o sistema calculará:
          </p>
          <ul>
            <li>Valor total dos serviços selecionados</li>
            <li>Aplicação do desconto do combo (se aplicável)</li>
            <li>Valor final com desconto</li>
          </ul>
          <p className="example-note">
            <strong>Exemplo:</strong> Cliente contrata 3 serviços (R$ 20 + R$ 15 + R$ 25 = R$ 60). 
            Com desconto de 10% para 3+ serviços: R$ 60 - 10% = <strong>R$ 54</strong>
          </p>
        </div>
      )}
    </div>
  );
}



