import type { Company, CreateCompanyInput, RevenueFederalData, CompanyUserRole } from '../api/companies';
import DomainSelector from './company/DomainSelector';
import { formatCNPJ } from '../utils/cnpj';
import { COUNTRY_CODES, BRAZIL_AREA_CODES, isCellPhone } from '../utils/phone';
import { validateBrazilianPhone } from '../utils/validation';
import { getExpectationText } from '../utils/canonical-language';
import { IrreversibilityMarker } from '../utils/action-nature';
import { calculateTemporalState, getTemporalStateText, getAbsenceText } from '../utils/temporal-state';
import { ContinuityText } from '../utils/closure-continuity';
import { InstitutionalPulse } from '../utils/institutional-pulse';
import CompanyValidationModal from './CompanyValidationModal';
import CompanyMembersList from './CompanyMembersList';

interface PhoneData {
  id: string;
  type: 'fixo' | 'celular';
  countryCode: string;
  areaCode: string;
  number: string;
}

interface CompaniesManagerFormProps {
  error: string | null;
  success: string | null;
  showAddForm: boolean;
  setShowAddForm: (show: boolean) => void;
  isFetchingCNPJ: boolean;
  isSaving: boolean;
  uploadingCompanyId: string | null;
  validationModalCompany: { id: string; name: string } | null;
  setValidationModalCompany: (company: { id: string; name: string } | null) => void;
  formData: CreateCompanyInput;
  setFormData: (data: CreateCompanyInput | ((prev: CreateCompanyInput) => CreateCompanyInput)) => void;
  revenueData: RevenueFederalData | null;
  formErrors: Record<string, string>;
  setFormErrors: (errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  cepLoading: boolean;
  cepMessage: string | null;
  phones: PhoneData[];
  phoneErrors: Record<string, string>;
  setPhoneErrors: (errors: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  companies: Company[];
  handleCNPJChange: (value: string) => void;
  handleCEPChange: (value: string) => void;
  handleAddressFieldChange: (field: string, value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  addPhone: () => void;
  removePhone: (phoneId: string) => void;
  updatePhone: (phoneId: string, field: keyof PhoneData, value: string) => void;
  resetForm: () => void;
  handleDelete: (companyId: string) => void;
  handleFileInputChange: (companyId: string, e: React.ChangeEvent<HTMLInputElement>) => void;
  loadCompanies: () => void;
  navigate: (path: string) => void;
}

export default function CompaniesManagerForm({
  error,
  success,
  showAddForm,
  setShowAddForm,
  isFetchingCNPJ,
  isSaving,
  uploadingCompanyId,
  validationModalCompany,
  setValidationModalCompany,
  formData,
  setFormData,
  revenueData,
  formErrors,
  setFormErrors,
  cepLoading,
  cepMessage,
  phones,
  phoneErrors,
  setPhoneErrors,
  companies,
  handleCNPJChange,
  handleCEPChange,
  handleAddressFieldChange,
  handleSubmit,
  addPhone,
  removePhone,
  updatePhone,
  resetForm,
  handleDelete,
  handleFileInputChange,
  loadCompanies,
  navigate,
}: CompaniesManagerFormProps) {
  return (
    <div className="companies-manager">
      <div className="companies-header">
        <div className="companies-header-text">
          <h3>Minhas Empresas</h3>
          <p className="companies-description">
            Aqui você gerencia suas empresas, validações e permissões.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(!showAddForm);
            if (!showAddForm) {
              resetForm();
            }
          }}
          className="add-company-button"
        >
          {showAddForm ? '✕ Cancelar' : '+ Adicionar Empresa'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Formulário de Nova Empresa */}
      {showAddForm && (
        <form className="company-form" onSubmit={handleSubmit}>
          <h4>Nova Empresa</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cnpj">
                CNPJ *
                {isFetchingCNPJ && <span className="loading-indicator"> 🔄 Buscando...</span>}
              </label>
              <input
                id="cnpj"
                type="text"
                value={formData.cnpj}
                onChange={(e) => handleCNPJChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                className={formErrors.cnpj ? 'error' : ''}
                required
              />
              {formErrors.cnpj && <span className="field-error">{formErrors.cnpj}</span>}
              <p className="field-hint">
                Digite o CNPJ e os dados serão preenchidos automaticamente da Receita Federal
              </p>
            </div>
          </div>

          {revenueData && (
            <div className="revenue-data-preview">
              <h5>✅ Dados da Receita Federal</h5>
              <div className="revenue-info">
                <p><strong>Razão Social:</strong> {revenueData.razao_social}</p>
                {revenueData.nome_fantasia && (
                  <p><strong>Nome Fantasia:</strong> {revenueData.nome_fantasia}</p>
                )}
                <p><strong>Situação:</strong> {revenueData.situacao_cadastral}</p>
                {revenueData.porte && <p><strong>Porte:</strong> {revenueData.porte}</p>}
                {revenueData.natureza_juridica && (
                  <p><strong>Natureza Jurídica:</strong> {revenueData.natureza_juridica}</p>
                )}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="companyName">Razão Social *</label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName || ''}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className={formErrors.companyName ? 'error' : ''}
                required
              />
              {formErrors.companyName && <span className="field-error">{formErrors.companyName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="tradeName">Nome Fantasia</label>
              <input
                id="tradeName"
                type="text"
                value={formData.tradeName || ''}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
              />
            </div>
          </div>

          <h5>Endereço</h5>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="cep">CEP</label>
              <input
                id="cep"
                type="text"
                value={formData.address?.cep || ''}
                onChange={(e) => handleCEPChange(e.target.value)}
                placeholder="00000-000"
                maxLength={9}
              />
              {cepLoading && <span className="loading-indicator" style={{ fontSize: '12px', marginLeft: '8px' }}>🔄 Buscando...</span>}
              {cepMessage && (
                <p className="field-hint" style={{ 
                  marginTop: '4px', 
                  fontSize: '12px',
                  color: cepMessage.includes('Não foi possível') ? '#856404' : '#155724',
                  backgroundColor: cepMessage.includes('Não foi possível') ? '#fff3cd' : '#d4edda',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${cepMessage.includes('Não foi possível') ? '#ffc107' : '#28a745'}`
                }}>
                  {cepMessage}
                </p>
              )}
            </div>
            <div className="form-group form-group-large">
              <label htmlFor="address">Logradouro</label>
              <input
                id="address"
                type="text"
                value={formData.address?.address || ''}
                onChange={(e) => handleAddressFieldChange('address', e.target.value)}
              />
            </div>
            <div className="form-group form-group-small">
              <label htmlFor="addressNumber">Número</label>
              <input
                id="addressNumber"
                type="text"
                value={formData.address?.addressNumber || ''}
                onChange={(e) => handleAddressFieldChange('addressNumber', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="complement">Complemento</label>
              <input
                id="complement"
                type="text"
                value={formData.address?.complement || ''}
                onChange={(e) => handleAddressFieldChange('complement', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="neighborhood">Bairro</label>
              <input
                id="neighborhood"
                type="text"
                value={formData.address?.neighborhood || ''}
                onChange={(e) => handleAddressFieldChange('neighborhood', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="city">Cidade</label>
              <input
                id="city"
                type="text"
                value={formData.address?.city || ''}
                onChange={(e) => handleAddressFieldChange('city', e.target.value)}
              />
            </div>
            <div className="form-group form-group-small">
              <label htmlFor="state">UF</label>
              <input
                id="state"
                type="text"
                value={formData.address?.state || ''}
                onChange={(e) => handleAddressFieldChange('state', e.target.value)}
                maxLength={2}
              />
            </div>
          </div>

          <h5>Contato</h5>
          
          {/* 🔴 TELEFONES: Múltiplos com seleção de tipo */}
          <div className="phones-section">
            {phones.map((phone, index) => (
              <div key={phone.id} className="phone-group" style={{ marginBottom: '16px' }}>
                <div className="form-row" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label htmlFor={`phone-type-${phone.id}`}>
                      {index === 0 ? 'Tipo *' : 'Tipo'}
                    </label>
                    <select
                      id={`phone-type-${phone.id}`}
                      value={phone.type}
                      onChange={(e) => updatePhone(phone.id, 'type', e.target.value as 'fixo' | 'celular')}
                      className="phone-type-select"
                    >
                      <option value="celular">Celular</option>
                      <option value="fixo">Fixo</option>
                    </select>
                  </div>
                  
                  <div className="form-group" style={{ flex: '0 0 150px' }}>
                    <label htmlFor={`phone-country-${phone.id}`}>País</label>
                    <select
                      id={`phone-country-${phone.id}`}
                      value={phone.countryCode}
                      onChange={(e) => updatePhone(phone.id, 'countryCode', e.target.value)}
                      className="country-select"
                    >
                      {COUNTRY_CODES.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.flag} +{country.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {phone.countryCode === '55' && (
                    <div className="form-group" style={{ flex: '0 0 200px' }}>
                      <label htmlFor={`phone-area-${phone.id}`}>DDD</label>
                      <select
                        id={`phone-area-${phone.id}`}
                        value={phone.areaCode}
                        onChange={(e) => updatePhone(phone.id, 'areaCode', e.target.value)}
                        className="area-select"
                      >
                        {BRAZIL_AREA_CODES.map((area) => (
                          <option key={area.code} value={area.code}>
                            ({area.code}) {area.city} - {area.state}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="form-group" style={{ flex: '1' }}>
                    <label htmlFor={`phone-number-${phone.id}`}>
                      {index === 0 ? 'Número' : 'Número'}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <input
                        id={`phone-number-${phone.id}`}
                        type="tel"
                        value={phone.number}
                        onChange={(e) => {
                          const numbers = e.target.value.replace(/\D/g, '');
                          updatePhone(phone.id, 'number', numbers);
                        }}
                        onBlur={() => {
                          if (phone.countryCode === '55' && phone.number) {
                            const validation = validateBrazilianPhone(phone.areaCode, phone.number);
                            if (!validation.valid) {
                              setPhoneErrors({ ...phoneErrors, [phone.id]: validation.error || 'Telefone inválido' });
                            } else {
                              // Validar tipo
                              const isCell = isCellPhone(phone.areaCode, phone.number);
                              if (phone.type === 'celular' && !isCell) {
                                setPhoneErrors({ ...phoneErrors, [phone.id]: 'Celular deve ter 9 dígitos e começar com 9' });
                              } else if (phone.type === 'fixo' && isCell) {
                                setPhoneErrors({ ...phoneErrors, [phone.id]: 'Telefone fixo deve ter 8 dígitos' });
                              } else {
                                const newErrors = { ...phoneErrors };
                                delete newErrors[phone.id];
                                setPhoneErrors(newErrors);
                              }
                            }
                          }
                        }}
                        placeholder={phone.countryCode === '55' 
                          ? (phone.type === 'celular' ? '9XXXXXXXX' : 'XXXXXXXX')
                          : 'Número'}
                        maxLength={phone.countryCode === '55' ? (phone.type === 'celular' ? 9 : 8) : 15}
                        className={`phone-input ${phoneErrors[phone.id] ? 'error' : ''}`}
                        style={{ flex: '1' }}
                      />
                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePhone(phone.id)}
                          className="remove-phone-button"
                          style={{
                            marginTop: '24px',
                            padding: '8px 12px',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                          }}
                          title="Remover telefone"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {phoneErrors[phone.id] && (
                      <span className="field-error" style={{ display: 'block', marginTop: '4px' }}>
                        {phoneErrors[phone.id]}
                      </span>
                    )}
                    {!phoneErrors[phone.id] && phone.countryCode === '55' && phone.number && (
                      <p className="phone-hint" style={{ marginTop: '4px', fontSize: '12px', color: '#28a745' }}>
                        ✓ {phone.type === 'celular' ? 'Celular' : 'Telefone fixo'} válido
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {phones.length < 3 && (
              <button
                type="button"
                onClick={addPhone}
                className="add-phone-button"
                style={{
                  marginTop: '8px',
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                + Adicionar mais telefone
              </button>
            )}
            {formErrors.phones && (
              <span className="field-error" style={{ display: 'block', marginTop: '8px' }}>
                {formErrors.phones}
              </span>
            )}
          </div>
          
          <DomainSelector
            selectedDomains={formData.domains || ['market']}
            onDomainsChange={(domains) => {
              setFormData({ ...formData, domains });
              // Limpar erro de domínios quando selecionar
              if (formErrors.domains) {
                const newErrors = { ...formErrors };
                delete newErrors.domains;
                setFormErrors(newErrors);
              }
            }}
            required={true}
          />
          {formErrors.domains && (
            <span className="field-error" style={{ display: 'block', marginTop: '8px' }}>
              {formErrors.domains}
            </span>
          )}

          <div className="form-row" style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={formData.contact?.email || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contact: { ...formData.contact, email: e.target.value },
                  })
                }
              />
            </div>
            <div className="form-group">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                value={formData.contact?.website || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setFormData({
                    ...formData,
                    contact: { ...formData.contact, website: value },
                  });
                  // Limpar erro ao editar
                  if (formErrors.website) {
                    const newErrors = { ...formErrors };
                    delete newErrors.website;
                    setFormErrors(newErrors);
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  // Validar apenas se preenchido
                  if (value && value.length > 0) {
                    // Aceitar URLs com ou sem protocolo
                    const hasDomain = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)+/i.test(value);
                    
                    if (!hasDomain) {
                      setFormErrors({ ...formErrors, website: 'URL inválida' });
                    } else {
                      const newErrors = { ...formErrors };
                      delete newErrors.website;
                      setFormErrors(newErrors);
                    }
                  }
                }}
                placeholder="www.exemplo.com ou https://exemplo.com"
              />
              {formErrors.website && (
                <span className="field-error" style={{ display: 'block', marginTop: '4px' }}>
                  {formErrors.website}
                </span>
              )}
            </div>
          </div>

          <h5>Atividade</h5>
          {formData.activity?.mainActivityDescription && (
            <div className="activity-info">
              <p><strong>CNAE Principal:</strong> {formData.activity.mainActivityCode} - {formData.activity.mainActivityDescription}</p>
              {formData.activity.secondaryActivities && formData.activity.secondaryActivities.length > 0 && (
                <div>
                  <strong>CNAEs Secundários:</strong>
                  <ul>
                    {formData.activity.secondaryActivities.map((act, idx) => (
                      <li key={idx}>{act.code} - {act.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <h5>Seu Cargo na Empresa</h5>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="role">Cargo *</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as CompanyUserRole })}
                required
              >
                <option value="owner">Proprietário/Sócio</option>
                <option value="partner">Sócio</option>
                <option value="director">Diretor</option>
                <option value="manager">Gerente</option>
                <option value="employee">Funcionário</option>
                <option value="other">Outro</option>
              </select>
            </div>
            {formData.role === 'other' && (
              <div className="form-group">
                <label htmlFor="roleDescription">Descrição do Cargo</label>
                <input
                  id="roleDescription"
                  type="text"
                  value={formData.roleDescription || ''}
                  onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                  placeholder="Ex: Consultor, Assessor, etc."
                />
              </div>
            )}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isPrimary || false}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                />
                <span>Empresa Principal</span>
              </label>
            </div>
          </div>

          {/* Raio X da Empresa */}
          {revenueData && (
            <div className="company-xray">
              <h5>🔍 Raio X da Empresa</h5>
              <div className="xray-content">
                <div className="xray-section">
                  <h6>Informações Básicas</h6>
                  <ul>
                    <li><strong>CNPJ:</strong> {formatCNPJ(revenueData.cnpj)}</li>
                    <li><strong>Razão Social:</strong> {revenueData.razao_social}</li>
                    {revenueData.nome_fantasia && (
                      <li><strong>Nome Fantasia:</strong> {revenueData.nome_fantasia}</li>
                    )}
                    {revenueData.data_abertura && (
                      <li><strong>Data de Abertura:</strong> {new Date(revenueData.data_abertura).toLocaleDateString('pt-BR')}</li>
                    )}
                    <li><strong>Situação Cadastral:</strong> {revenueData.situacao_cadastral}</li>
                    {revenueData.porte && <li><strong>Porte:</strong> {revenueData.porte}</li>}
                    {revenueData.natureza_juridica && (
                      <li><strong>Natureza Jurídica:</strong> {revenueData.natureza_juridica}</li>
                    )}
                    {revenueData.capital_social && (
                      <li><strong>Capital Social:</strong> {revenueData.capital_social}</li>
                    )}
                  </ul>
                </div>

                <div className="xray-section">
                  <h6>Atividades (CNAE)</h6>
                  {revenueData.atividade_principal && revenueData.atividade_principal.length > 0 && (
                    <div>
                      <strong>Principal:</strong>
                      <ul>
                        {revenueData.atividade_principal.map((act, idx) => (
                          <li key={idx}>{act.code} - {act.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {revenueData.atividades_secundarias && revenueData.atividades_secundarias.length > 0 && (
                    <div>
                      <strong>Secundárias:</strong>
                      <ul>
                        {revenueData.atividades_secundarias.map((act, idx) => (
                          <li key={idx}>{act.code} - {act.text}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {revenueData.qsa && revenueData.qsa.length > 0 && (
                  <div className="xray-section">
                    <h6>Quadro Societário (QSA)</h6>
                    <ul>
                      {revenueData.qsa.map((socio, idx) => (
                        <li key={idx}>
                          <strong>{socio.nome}</strong> - {socio.qual}
                          {socio.pais_origem && ` (${socio.pais_origem})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <p className="xray-note">
                💡 Essas informações serão usadas para categorizar sua empresa e conectar com os módulos ERP, CRM e outros sistemas do Unificard.
              </p>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => setShowAddForm(false)} disabled={isSaving}>
              Cancelar
            </button>
            {/* SPRINT 17: Microtexto de expectativa */}
            <div className="expectation-text" style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              background: '#f8f9fa', 
              border: '1px solid #e0e0e0', 
              borderRadius: '4px',
              fontSize: '0.9rem',
              color: '#666',
              lineHeight: '1.4'
            }}>
              {getExpectationText('createCompany')}
            </div>
            {/* SPRINT 18: Marcação de irreversibilidade */}
            <IrreversibilityMarker />
            <button type="submit" disabled={isSaving || isFetchingCNPJ} className="save-button">
              {isSaving ? 'Salvando...' : 'Salvar Empresa'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Empresas */}
      {companies.length === 0 && !showAddForm && (
        <div className="empty-state">
          <p>Você ainda não cadastrou nenhuma empresa.</p>
          <p>Clique em "Adicionar Empresa" para começar.</p>
          {/* SPRINT 19: Diferenciar ausência */}
          <p style={{
            fontSize: '0.85rem',
            color: '#999',
            fontStyle: 'italic',
            marginTop: '0.5rem',
          }}>
            {getAbsenceText('not_happened')}
          </p>
          {/* SPRINT 22: Pulso institucional em estado vazio */}
          <InstitutionalPulse type="continuous" />
        </div>
      )}

      {companies.length > 0 && (
        <div className="companies-list">
          {companies.map((company) => (
            <div key={company.companyId} className="company-card">
              <div className="company-card-header">
                <div className="company-info">
                  <h4>
                    {company.companyName}
                    {company.userRole.isPrimary && <span className="primary-badge-inline"> (Principal)</span>}
                  </h4>
                  <p className="company-cnpj">CNPJ: {formatCNPJ(company.cnpj)}</p>
                  {company.address.city && (
                    <p className="company-location">Localização: {company.address.city}, {company.address.state}</p>
                  )}
                  {/* SPRINT 19: Estado temporal */}
                  {(() => {
                    const temporalState = calculateTemporalState(
                      company.createdAt,
                      company.updatedAt,
                      company.status === 'closed' ? company.updatedAt : undefined
                    );
                    const temporalText = getTemporalStateText(
                      temporalState,
                      'company',
                      company.createdAt,
                      company.updatedAt,
                      company.status === 'closed' ? company.updatedAt : undefined
                    );
                    return temporalText ? (
                      <p style={{
                        fontSize: '0.8rem',
                        color: '#999',
                        fontStyle: 'italic',
                        marginTop: '0.25rem',
                      }}>
                        {temporalText}
                      </p>
                    ) : null;
                  })()}
                  {/* SPRINT 20: Continuidade declarada para empresas ativas */}
                  {company.status === 'active' && company.companyStatus !== 'DRAFT' && (
                    <ContinuityText type="company" />
                  )}
                </div>
              </div>

              {/* Status sempre visível */}
              <div className="company-status-section">
                {company.companyStatus === 'PROVISIONAL' && (
                  <div className="status-message status-provisional">
                    <strong>⚠️ Empresa em validação</strong>
                    <p>Complete a validação presencial para habilitar todas as funcionalidades.</p>
                  </div>
                )}
                
                {company.companyStatus === 'VERIFIED' && (
                  <div className="status-message status-validated">
                    <strong>✅ Empresa validada</strong>
                    <p>Seus dados foram verificados e aprovados.</p>
                  </div>
                )}

                {company.companyStatus === 'DRAFT' && (
                  <div className="status-message status-draft">
                    <strong>📝 Rascunho</strong>
                    <p>Cadastro ainda não finalizado.</p>
                  </div>
                )}

                {company.companyStatus === 'APPROVED' && (
                  <div className="status-message status-validated">
                    <strong>✅ Empresa aprovada</strong>
                    <p>Empresa com acesso pleno ao sistema.</p>
                  </div>
                )}

                {company.companyStatus === 'SUSPENDED' && (
                  <div className="status-message status-pending">
                    <strong>🚫 Empresa suspensa</strong>
                    <p>Esta empresa foi suspensa e não pode realizar operações.</p>
                  </div>
                )}
              </div>

              {/* Lista de membros da empresa */}
              <CompanyMembersList companyId={company.companyId} />

              {/* Ações */}
              <div className="company-actions-section">
                <div className="company-actions-left">
                  {/* FASE 12: Botão de validação presencial para PROVISIONAL */}
                  {company.companyStatus === 'PROVISIONAL' && (
                    <button
                      type="button"
                      onClick={() => setValidationModalCompany({ id: company.companyId, name: company.companyName })}
                      className="validate-button"
                      title="Validar empresa presencialmente"
                    >
                      📱 Validar presencialmente
                    </button>
                  )}
                  
                  {company.companyStatus !== 'VERIFIED' && company.companyStatus !== 'PROVISIONAL' && company.companyStatus !== 'APPROVED' && (
                    <label className="upload-button-primary">
                      {uploadingCompanyId === company.companyId ? (
                        '⏳ Enviando...'
                      ) : (
                        '📄 Enviar comprovante (PDF)'
                      )}
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileInputChange(company.companyId, e)}
                        disabled={uploadingCompanyId === company.companyId}
                      />
                    </label>
                  )}
                </div>
                <div className="company-actions-right">
                  <button
                    type="button"
                    onClick={() => navigate(`/empresa/${company.companyId}`)}
                    className="open-dashboard-button"
                    title="Abrir painel da empresa"
                  >
                    Abrir Painel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(company.companyId)}
                    className="delete-button"
                    title="Remover empresa"
                    aria-label="Remover empresa"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FASE 12: Modal de validação presencial */}
      {validationModalCompany && (
        <CompanyValidationModal
          companyId={validationModalCompany.id}
          companyName={validationModalCompany.name}
          isOpen={!!validationModalCompany}
          onClose={() => {
            setValidationModalCompany(null);
            // Recarregar empresas após validação
            loadCompanies();
          }}
          onValidationRequested={() => {
            // Opcional: fazer algo quando QR é gerado
          }}
        />
      )}
    </div>
  );
}



