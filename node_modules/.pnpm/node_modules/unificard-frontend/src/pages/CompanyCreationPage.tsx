// frontend/src/pages/CompanyCreationPage.tsx
// Formulário de Criação de Empresa (Nascimento Canônico)
//
// 🔴 REGRAS PÉTREAS:
// - Formulário estritamente declarativo
// - Nenhuma lógica de negócio
// - Nenhuma inferência
// - Nenhuma decisão implícita
// - Nenhuma criação de estado fora do Core
// - O formulário não representa empresa pronta, apenas intenção de nascimento

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetchJson } from '../api/client';
import { useSession } from '../contexts/SessionProvider';
import { getTenantId } from '../config/auth';
import './CompanyCreationPage.css';

type DocumentType = 'CPF' | 'CNPJ';

interface CreateCompanyFormData {
  legal_name: string;
  document_type: DocumentType;
  document_number: string;
  country: string;
}

export default function CompanyCreationPage() {
  const navigate = useNavigate();
  const { sessionReady } = useSession();
  const [formData, setFormData] = useState<CreateCompanyFormData>({
    legal_name: '',
    document_type: 'CNPJ',
    document_number: '',
    country: 'BR',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateCompanyFormData, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (field: keyof CreateCompanyFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo ao editar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    setSubmitError(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateCompanyFormData, string>> = {};

    if (!formData.legal_name.trim()) {
      newErrors.legal_name = 'Nome legal é obrigatório';
    }

    if (!formData.document_type) {
      newErrors.document_type = 'Tipo de documento é obrigatório';
    }

    if (!formData.document_number.trim()) {
      newErrors.document_number = 'Número do documento é obrigatório';
    } else {
      // Validar formato básico
      const normalized = formData.document_number.replace(/\D/g, '');
      if (formData.document_type === 'CPF' && normalized.length !== 11) {
        newErrors.document_number = 'CPF deve ter 11 dígitos';
      }
      if (formData.document_type === 'CNPJ' && normalized.length !== 14) {
        newErrors.document_number = 'CNPJ deve ter 14 dígitos';
      }
    }

    if (!formData.country || formData.country.length !== 2) {
      newErrors.country = 'País deve ser código ISO-3166 de 2 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionReady) {
      setSubmitError('Sessão não está pronta. Aguarde...');
      return;
    }

    const tenantId = getTenantId();
    if (!tenantId) {
      setSubmitError('Tenant não encontrado. Faça login novamente.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiFetchJson('/api/companies/canonical', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      // Sucesso: navegar para página de confirmação ou detalhes
      navigate(`/companies/${response.company.company_id}?created=true`);
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao criar empresa';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="company-creation-page">
      <div className="company-creation-container">
        <h1>Criar Empresa</h1>
        <p className="page-description">
          Preencha os dados legais da empresa. Esta é apenas a criação canônica da empresa.
        </p>

        <form onSubmit={handleSubmit} className="company-creation-form">
          {/* Nome Legal */}
          <div className="form-group">
            <label htmlFor="legal_name">
              Nome Legal (Razão Social) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="legal_name"
              value={formData.legal_name}
              onChange={(e) => handleChange('legal_name', e.target.value)}
              placeholder="Ex: Empresa Exemplo LTDA"
              required
              maxLength={500}
            />
            {errors.legal_name && (
              <span className="error-message">{errors.legal_name}</span>
            )}
          </div>

          {/* Tipo de Documento */}
          <div className="form-group">
            <label htmlFor="document_type">
              Tipo de Documento <span className="required">*</span>
            </label>
            <select
              id="document_type"
              value={formData.document_type}
              onChange={(e) => handleChange('document_type', e.target.value as DocumentType)}
              required
            >
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
            </select>
            {errors.document_type && (
              <span className="error-message">{errors.document_type}</span>
            )}
          </div>

          {/* Número do Documento */}
          <div className="form-group">
            <label htmlFor="document_number">
              Número do Documento <span className="required">*</span>
            </label>
            <input
              type="text"
              id="document_number"
              value={formData.document_number}
              onChange={(e) => handleChange('document_number', e.target.value)}
              placeholder={formData.document_type === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
              required
              maxLength={20}
            />
            {errors.document_number && (
              <span className="error-message">{errors.document_number}</span>
            )}
          </div>

          {/* País */}
          <div className="form-group">
            <label htmlFor="country">
              País (ISO-3166) <span className="required">*</span>
            </label>
            <input
              type="text"
              id="country"
              value={formData.country}
              onChange={(e) => handleChange('country', e.target.value.toUpperCase())}
              placeholder="BR"
              required
              maxLength={2}
              minLength={2}
            />
            {errors.country && (
              <span className="error-message">{errors.country}</span>
            )}
          </div>

          {submitError && (
            <div className="submit-error">
              {submitError}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={isSubmitting}
              className="submit-button"
            >
              {isSubmitting ? 'Criando...' : 'Criar Empresa'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cancel-button"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

