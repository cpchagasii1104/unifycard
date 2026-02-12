// src/components/MyConfigurations.tsx
// Componente de configurações do usuário (PF/PJ, etc.)

import { useState, useEffect } from 'react';
import { getUserConfigurations, updateUserConfigurations, type UserType } from '../api/configurations';
import './MyConfigurations.css';

interface MyConfigurationsProps {
  onUserTypeChange?: (userType: UserType) => void;
}

export default function MyConfigurations({ onUserTypeChange }: MyConfigurationsProps) {
  const [userType, setUserType] = useState<UserType>('physical');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      const config = await getUserConfigurations();
      setUserType(config.userType);
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
      // Se der erro, usar valor padrão
      setUserType('physical');
    }
  };

  const handleUserTypeChange = async (newType: UserType) => {
    setUserType(newType);
    setError(null);
    setSuccess(null);

    if (onUserTypeChange) {
      onUserTypeChange(newType);
    }

    setIsSaving(true);
    try {
      await updateUserConfigurations({ userType: newType });
      setSuccess('Configurações salvas com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
      // Reverter para o valor anterior em caso de erro
      setUserType(userType);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="my-configurations">
      <h2>Minhas Configurações</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="config-section">
        <h3>Tipo de Usuário</h3>
        <p className="section-description">
          Selecione o tipo de conta que você deseja usar. Você pode alterar isso a qualquer momento.
        </p>

        <div className="user-type-options">
          <label className={`user-type-option ${userType === 'physical' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="userType"
              value="physical"
              checked={userType === 'physical'}
              onChange={() => handleUserTypeChange('physical')}
              disabled={isSaving}
            />
            <div className="option-content">
              <h4>Pessoa Física (PF)</h4>
              <p>Para profissionais autônomos, freelancers e prestadores de serviço individuais</p>
              <ul>
                <li>✓ Trabalho como pessoa física</li>
                <li>✓ Não tenho CNPJ</li>
                <li>✓ Presto serviços ou vendo produtos como autônomo</li>
              </ul>
            </div>
          </label>

          <label className={`user-type-option ${userType === 'legal' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="userType"
              value="legal"
              checked={userType === 'legal'}
              onChange={() => handleUserTypeChange('legal')}
              disabled={isSaving}
            />
            <div className="option-content">
              <h4>Pessoa Jurídica (PJ)</h4>
              <p>Para empresas, MEIs, microempresas e outras entidades com CNPJ</p>
              <ul>
                <li>✓ Tenho CNPJ</li>
                <li>✓ Trabalho como empresa</li>
                <li>✓ Preciso emitir notas fiscais</li>
              </ul>
            </div>
          </label>

          <label className={`user-type-option ${userType === 'both' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="userType"
              value="both"
              checked={userType === 'both'}
              onChange={() => handleUserTypeChange('both')}
              disabled={isSaving}
            />
            <div className="option-content">
              <h4>Ambos (PF + PJ)</h4>
              <p>Para quem trabalha tanto como pessoa física quanto jurídica</p>
              <ul>
                <li>✓ Tenho CNPJ mas também trabalho como PF</li>
                <li>✓ Preciso gerenciar ambos os perfis</li>
                <li>⚠️ Alguns serviços podem ter restrições</li>
              </ul>
            </div>
          </label>
        </div>

        {userType === 'both' && (
          <div className="warning-box">
            <strong>⚠️ Atenção:</strong> No Brasil, é comum que pessoas físicas trabalhem sem CNPJ.
            Se você trabalha como PF mas tem CNPJ, você pode escolher "Pessoa Física" e informar
            o CNPJ opcionalmente. Escolha "Ambos" apenas se você realmente precisa gerenciar
            dois perfis separados (um como PF e outro como PJ).
          </div>
        )}
      </div>

      {isSaving && (
        <div className="saving-indicator">
          <span>Salvando...</span>
        </div>
      )}
    </div>
  );
}

