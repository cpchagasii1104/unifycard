// frontend/src/components/events/wizard/EventFoundationStep.tsx
// Bloco "Fundação do Evento" - Contexto mínimo antes de configuração detalhada
// Aplica-se apenas quando: macro_intention = 'celebrate' (event_type = 'private')

import { useState, useEffect, useRef, useCallback } from 'react';
import type { WizardData } from '../EventCreationWizard';
import { getSubtypesForIntention } from './eventSubtypeMapping';
import { discoverServices, type DiscoveredService } from '../../../api/service-discovery';
import { TemporalDateInput, TemporalTimeInput } from '../../temporal';
import { useAddressResolver } from '../../../hooks/useAddressResolver';
import './EventFoundationStep.css';

interface EventFoundationData {
  // 0. CEP DO LOCAL (PRIMEIRO PASSO - UNIFICADO PARA TODOS OS EVENTOS)
  venue_cep: string | null; // CEP do local do evento
  venue_address: string | null; // Endereço completo (logradouro)
  venue_address_number: string | null; // Número do endereço
  venue_complement: string | null; // Complemento
  venue_neighborhood: string | null; // Bairro
  venue_city: string | null; // Cidade
  venue_state: string | null; // Estado (UF)
  
  // 1. DATA DO EVENTO
  event_date: string | null;
  event_time_start: string | null;
  event_duration_hours: number | null; // Duração estimada OU event_time_end
  event_time_end: string | null; // Alternativa à duração
  
  // 2. LOCAL DO EVENTO (REFINO)
  has_venue: boolean | null;
  city: string | null; // Mantido para compatibilidade (será preenchido do CEP)
  region: string | null; // Região/bairro (opcional)
  desired_venue_type: string | null; // salão, chácara, casa, espaço aberto, outro
  
  // 3. TIPO DE CELEBRAÇÃO (já coletado no Step 2, apenas exibição)
  // Usa data.event_subtype
  
  // 4. IDENTIDADE INICIAL DO EVENTO (opcional)
  event_style: 'formal' | 'casual' | 'thematic' | 'other' | null;
  desired_atmosphere: 'family' | 'adult' | 'mixed' | 'other' | null;
  theme_aesthetic: string | null; // Texto livre
}

interface EventFoundationStepProps {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
}

export default function EventFoundationStep({ data, onUpdate }: EventFoundationStepProps) {
  // Inicializar foundation se não existir
  const foundation: EventFoundationData = data.foundation || {
    venue_cep: null,
    venue_address: null,
    venue_address_number: null,
    venue_complement: null,
    venue_neighborhood: null,
    venue_city: null,
    venue_state: null,
    event_date: null,
    event_time_start: null,
    event_duration_hours: null,
    event_time_end: null,
    has_venue: null,
    city: null,
    region: null,
    desired_venue_type: null,
    event_style: null,
    desired_atmosphere: null,
    theme_aesthetic: null,
  };

  const [useDuration, setUseDuration] = useState(foundation.event_duration_hours !== null);
  const [durationHours, setDurationHours] = useState(foundation.event_duration_hours?.toString() || '');
  const [endTime, setEndTime] = useState(foundation.event_time_end || '');
  
  // 🔴 MIGRAÇÃO: Usar hook canônico useAddressResolver (SSOT)
  const { address, loading: cepResolverLoading, error: cepResolverError, setCep: setCepResolver, resolve: resolveCep } = useAddressResolver();
  
  // Estado para mensagem de CEP
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  
  // Estado para busca de serviços (quando não tem local)
  const [foundServices, setFoundServices] = useState<DiscoveredService[]>([]);
  const [isSearchingServices, setIsSearchingServices] = useState(false);
  
  // 🔴 MIGRAÇÃO: Sincronizar loading e error do hook canônico
  useEffect(() => {
    if (cepResolverError) {
      setCepMessage(cepResolverError);
      setTimeout(() => setCepMessage(null), 5000);
    }
  }, [cepResolverError]);
  
  // 🔴 MIGRAÇÃO: Preencher campos quando address do hook canônico mudar
  const lastAddressRef = useRef<string | null>(null);
  useEffect(() => {
    if (address) {
      // Evitar reexecução se address não mudou
      const addressKey = `${address.logradouro}-${address.bairro}-${address.localidade}-${address.uf}`;
      if (lastAddressRef.current === addressKey) {
        return;
      }
      lastAddressRef.current = addressKey;
      
      updateFoundation({
        venue_address: address.logradouro || null,
        venue_neighborhood: address.bairro || null,
        venue_city: address.localidade || null,
        venue_state: address.uf || null,
        venue_complement: address.complemento || null,
        // Preencher também campos de compatibilidade
        city: address.localidade || null,
        region: address.bairro || null,
      });
      setCepMessage('Endereço preenchido automaticamente. Confira se está correto.');
      setTimeout(() => setCepMessage(null), 5000);
    }
  }, [address, updateFoundation]);

  // Obter subtipo selecionado para exibição
  const selectedSubtype = data.event_subtype;
  const subtypes = getSubtypesForIntention('celebrate');
  const subtypeOption = subtypes.find(s => s.value === selectedSubtype);
  const displaySubtype = data.event_subtype === 'other' && data.custom_subtype_text
    ? data.custom_subtype_text
    : subtypeOption?.label || selectedSubtype;

  const updateFoundation = (updates: Partial<EventFoundationData>) => {
    onUpdate({
      foundation: {
        ...foundation,
        ...updates,
      },
    });
  };

  // Handlers antigos removidos - agora usando componentes temporais canônicos

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDurationHours(value);
    const hours = value ? parseFloat(value) : null;
    updateFoundation({ 
      event_duration_hours: hours,
      event_time_end: null, // Limpar end time se usar duração
    });
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndTime(value);
    updateFoundation({ 
      event_time_end: value || null,
      event_duration_hours: null, // Limpar duração se usar end time
    });
  };

  const handleHasVenueChange = (hasVenue: boolean) => {
    updateFoundation({ 
      has_venue: hasVenue,
      // Se tem local, limpar campos de busca
      city: hasVenue ? null : foundation.city,
      region: hasVenue ? null : foundation.region,
      desired_venue_type: hasVenue ? null : foundation.desired_venue_type,
    });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFoundation({ city: e.target.value || null });
  };

  const handleRegionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFoundation({ region: e.target.value || null });
  };

  const handleVenueTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFoundation({ desired_venue_type: e.target.value || null });
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFoundation({ event_style: e.target.value as any || null });
  };

  const handleAtmosphereChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFoundation({ desired_atmosphere: e.target.value as any || null });
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateFoundation({ theme_aesthetic: e.target.value || null });
  };

  // 🔴 MIGRAÇÃO: Handler de mudança de CEP - delega ao hook canônico
  const handleCepChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    updateFoundation({ venue_cep: clean || null });
    
    // 🔴 MIGRAÇÃO: Atualizar hook canônico com origem 'user' (não dispara busca)
    setCepResolver(clean, 'user');
    
    // 🔴 MIGRAÇÃO: Se completar 8 dígitos DURANTE onChange, chamar resolve() explicitamente
    if (clean.length === 8) {
      resolveCep();
    }
  };

  // Buscar serviços quando não tem local e preencheu cidade/região
  useEffect(() => {
    // Apenas buscar se não tem local e tem cidade preenchida
    if (foundation.has_venue === false && foundation.city) {
      const searchServices = async () => {
        setIsSearchingServices(true);
        try {
          // Buscar serviços de espaços/locais na região
          // ⚠️ REGRA CANÔNICA: Busca apenas consultiva, não decisória
          const services = await discoverServices({
            // Filtrar por categoria de "espaço para eventos" se possível
            // Por enquanto, buscar todos os serviços da cidade (será refinado depois)
            city_id: undefined, // TODO: Mapear cidade para city_id se necessário
            actor_type: 'page', // Apenas empresas (não pessoas físicas)
            limit: 10, // Limitar resultados
          });
          
          // Filtrar serviços que podem ser espaços para eventos
          // (baseado em nome, categoria ou metadata)
          const venueServices = services.filter(service => {
            const name = service.name.toLowerCase();
            const description = (service.description || '').toLowerCase();
            const keywords = ['salão', 'chácara', 'espaço', 'local', 'evento', 'festa', 'recepção', 'hall'];
            return keywords.some(keyword => name.includes(keyword) || description.includes(keyword));
          });
          
          setFoundServices(venueServices);
        } catch (err) {
          console.warn('Erro ao buscar serviços de espaços:', err);
          setFoundServices([]);
        } finally {
          setIsSearchingServices(false);
        }
      };

      // Debounce: aguardar 500ms após última mudança
      const timeoutId = setTimeout(searchServices, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setFoundServices([]);
    }
  }, [foundation.has_venue, foundation.city, foundation.region]);

  return (
    <div className="step-container">
      <h2>Step 2.5 · Fundação do Evento</h2>
      <p className="step-description">
        Vamos coletar o contexto mínimo necessário antes de configurar os detalhes:
      </p>

      {/* 1. DATA DO EVENTO */}
      <div className="foundation-section">
        <h3 className="section-title">1. Data do Evento</h3>
        
        <div className="form-group">
          <TemporalDateInput
            id="event_date"
            label="Data do evento"
            value={foundation.event_date}
            onChange={(value) => updateFoundation({ event_date: value })}
            onBlur={(value, isValid) => {
              if (!isValid && value) {
                // Validação customizada já foi aplicada no componente
                return;
              }
            }}
            required
            customValidation={(value) => {
              if (!value) return null;
              
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const selected = new Date(value);
              selected.setHours(0, 0, 0, 0);
              
              if (selected < today) {
                return 'A data do evento não pode ser no passado.';
              }
              
              const maxDate = new Date();
              maxDate.setMonth(maxDate.getMonth() + 24);
              if (selected > maxDate) {
                return 'A data do evento não pode ser mais de 24 meses no futuro.';
              }
              
              return null;
            }}
            tabIndex={1}
          />
        </div>

        <div className="form-group">
          <TemporalTimeInput
            id="event_time_start"
            label="Horário de início"
            value={foundation.event_time_start}
            onChange={(value) => updateFoundation({ event_time_start: value })}
            required
            placeholder="Ex: 14:30 ou 1430"
            tabIndex={2}
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Duração ou horário de fim <span className="required">*</span>
          </label>
          <div className="duration-toggle">
            <button
              type="button"
              className={`toggle-button ${useDuration ? 'active' : ''}`}
              onClick={() => {
                setUseDuration(true);
                updateFoundation({ event_time_end: null });
              }}
            >
              Duração estimada
            </button>
            <button
              type="button"
              className={`toggle-button ${!useDuration ? 'active' : ''}`}
              onClick={() => {
                setUseDuration(false);
                updateFoundation({ event_duration_hours: null });
              }}
            >
              Horário de fim
            </button>
          </div>

          {useDuration ? (
            <div className="form-group-inline">
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={durationHours}
                onChange={handleDurationChange}
                placeholder="Ex: 4"
                className="form-input"
                required
                tabIndex={3}
              />
              <span className="input-suffix">horas</span>
            </div>
          ) : (
            <TemporalTimeInput
              id="event_time_end"
              value={endTime}
              onChange={(value) => {
                setEndTime(value || '');
                updateFoundation({ 
                  event_time_end: value,
                  event_duration_hours: null,
                });
              }}
              required
              placeholder="Ex: 20:00 ou 2000"
              tabIndex={3}
            />
          )}
        </div>
      </div>

      {/* 2. LOCAL DO EVENTO */}
      <div className="foundation-section">
        <h3 className="section-title">2. Local do Evento</h3>
        
        <div className="form-group">
          <label className="form-label">
            Você já tem um local definido? <span className="required">*</span>
          </label>
          <div className="yes-no-buttons">
            <button
              type="button"
              className={`yes-no-button ${foundation.has_venue === true ? 'selected' : ''}`}
              onClick={() => handleHasVenueChange(true)}
            >
              Sim
            </button>
            <button
              type="button"
              className={`yes-no-button ${foundation.has_venue === false ? 'selected' : ''}`}
              onClick={() => handleHasVenueChange(false)}
            >
              Não
            </button>
          </div>
        </div>

        {/* Se TEM local: mostrar CEP e endereço completo */}
        {foundation.has_venue === true && (
          <>
            <div className="form-group">
              <label htmlFor="venue_cep" className="form-label">
                CEP do local <span className="optional">(opcional - preenche automaticamente)</span>
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <input
                  id="venue_cep"
                  type="text"
                  value={foundation.venue_cep || ''}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="form-input"
                  style={{ flex: 1, maxWidth: '200px' }}
                  tabIndex={4}
                />
                {cepResolverLoading && (
                  <span style={{ fontSize: '0.875rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    🔄 Buscando...
                  </span>
                )}
              </div>
              {cepMessage && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  color: cepMessage.includes('Não foi possível') ? '#856404' : '#155724',
                  backgroundColor: cepMessage.includes('Não foi possível') ? '#fff3cd' : '#d4edda',
                  border: `1px solid ${cepMessage.includes('Não foi possível') ? '#ffc107' : '#28a745'}`,
                }}>
                  {cepMessage}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="venue_address" className="form-label">
                Endereço <span className="optional">(opcional)</span>
              </label>
              <input
                id="venue_address"
                type="text"
                value={foundation.venue_address || ''}
                onChange={(e) => updateFoundation({ venue_address: e.target.value || null })}
                placeholder="Ex: Rua das Flores"
                className="form-input"
                tabIndex={5}
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="venue_address_number" className="form-label">
                  Número <span className="optional">(opcional)</span>
                </label>
                <input
                  id="venue_address_number"
                  type="text"
                  value={foundation.venue_address_number || ''}
                  onChange={(e) => updateFoundation({ venue_address_number: e.target.value || null })}
                  placeholder="Ex: 123"
                  className="form-input"
                  tabIndex={6}
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="venue_complement" className="form-label">
                  Complemento <span className="optional">(opcional)</span>
                </label>
                <input
                  id="venue_complement"
                  type="text"
                  value={foundation.venue_complement || ''}
                  onChange={(e) => updateFoundation({ venue_complement: e.target.value || null })}
                  placeholder="Ex: Apto 101"
                  className="form-input"
                  tabIndex={7}
                />
              </div>
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="venue_neighborhood" className="form-label">
                  Bairro <span className="optional">(opcional)</span>
                </label>
                <input
                  id="venue_neighborhood"
                  type="text"
                  value={foundation.venue_neighborhood || ''}
                  onChange={(e) => updateFoundation({ venue_neighborhood: e.target.value || null })}
                  placeholder="Ex: Centro"
                  className="form-input"
                  tabIndex={8}
                />
              </div>
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="venue_city" className="form-label">
                  Cidade <span className="optional">(opcional)</span>
                </label>
                <input
                  id="venue_city"
                  type="text"
                  value={foundation.venue_city || ''}
                  onChange={(e) => updateFoundation({ venue_city: e.target.value || null })}
                  placeholder="Ex: São Paulo"
                  className="form-input"
                  tabIndex={9}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="venue_state" className="form-label">
                  Estado (UF) <span className="optional">(opcional)</span>
                </label>
                <input
                  id="venue_state"
                  type="text"
                  value={foundation.venue_state || ''}
                  onChange={(e) => updateFoundation({ venue_state: e.target.value.toUpperCase() || null })}
                  placeholder="SP"
                  maxLength={2}
                  className="form-input"
                  tabIndex={10}
                />
              </div>
            </div>
          </>
        )}

        {/* Se NÃO TEM local: mostrar opção de busca ou preenchimento manual */}
        {foundation.has_venue === false && (
          <>
            <div className="form-group">
              <label htmlFor="city" className="form-label">
                Cidade <span className="required">*</span>
              </label>
              <input
                id="city"
                type="text"
                value={foundation.city || ''}
                onChange={handleCityChange}
                placeholder="Ex: São Paulo"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="region" className="form-label">
                Região/Bairro <span className="optional">(opcional)</span>
              </label>
              <input
                id="region"
                type="text"
                value={foundation.region || ''}
                onChange={handleRegionChange}
                placeholder="Ex: Zona Sul, Centro"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="desired_venue_type" className="form-label">
                Tipo de local desejado
              </label>
              <select
                id="desired_venue_type"
                value={foundation.desired_venue_type || ''}
                onChange={handleVenueTypeChange}
                className="form-select"
              >
                <option value="">Selecione...</option>
                <option value="salão">Salão</option>
                <option value="chácara">Chácara</option>
                <option value="casa">Casa</option>
                <option value="espaço aberto">Espaço aberto</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {/* Busca de empresas/serviços de espaços na região */}
            {foundation.city && (
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">
                  Empresas encontradas na região
                  <span className="optional" style={{ marginLeft: '0.5rem' }}>
                    (sugestões - você pode continuar sem selecionar)
                  </span>
                </label>
                {isSearchingServices ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                    Buscando empresas na região...
                  </div>
                ) : foundServices.length > 0 ? (
                  <div style={{ 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '0.5rem', 
                    padding: '1rem',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    backgroundColor: '#f9fafb'
                  }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {foundServices.map(service => (
                        <li key={service.serviceId} style={{ 
                          padding: '0.75rem', 
                          borderBottom: '1px solid #e5e7eb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ display: 'block' }}>{service.name}</strong>
                            {service.shortDescription && (
                              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                {service.shortDescription}
                              </span>
                            )}
                            {service.actor?.display_name && (
                              <span style={{ fontSize: '0.75rem', color: '#9ca3af', display: 'block', marginTop: '0.25rem' }}>
                                {service.actor.display_name}
                              </span>
                            )}
                          </div>
                          {service.availability_summary?.has_availability && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              color: '#10b981',
                              padding: '0.25rem 0.5rem',
                              backgroundColor: '#d1fae5',
                              borderRadius: '0.25rem'
                            }}>
                              Disponível
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p style={{ 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      marginTop: '0.75rem', 
                      fontStyle: 'italic' 
                    }}>
                      ⚠️ Estas são apenas sugestões. Você pode continuar sem selecionar nenhuma empresa agora.
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                    Nenhuma empresa encontrada na região. Você pode continuar preenchendo os dados do evento.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. TIPO DE CELEBRAÇÃO (apenas exibição) */}
      <div className="foundation-section">
        <h3 className="section-title">3. Tipo de Celebração</h3>
        <div className="celebration-confirmation">
          <div className="confirmation-badge">
            <span className="confirmation-icon">✓</span>
            <span className="confirmation-text">{displaySubtype}</span>
          </div>
          <p className="confirmation-note">
            Tipo selecionado no passo anterior. Não pode ser alterado aqui.
          </p>
        </div>
      </div>

      {/* 4. IDENTIDADE INICIAL DO EVENTO (opcional) */}
      <div className="foundation-section">
        <h3 className="section-title">4. Identidade Inicial do Evento <span className="optional-label">(opcional)</span></h3>
        
        <div className="form-group">
          <label htmlFor="event_style" className="form-label">
            Estilo do evento
          </label>
          <select
            id="event_style"
            value={foundation.event_style || ''}
            onChange={handleStyleChange}
            className="form-select"
          >
            <option value="">Selecione...</option>
            <option value="formal">Formal</option>
            <option value="casual">Casual</option>
            <option value="thematic">Temático</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="desired_atmosphere" className="form-label">
            Ambiente desejado
          </label>
          <select
            id="desired_atmosphere"
            value={foundation.desired_atmosphere || ''}
            onChange={handleAtmosphereChange}
            className="form-select"
          >
            <option value="">Selecione...</option>
            <option value="family">Familiar</option>
            <option value="adult">Adulto</option>
            <option value="mixed">Misto</option>
            <option value="other">Outro</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="theme_aesthetic" className="form-label">
            Tema/Estética
          </label>
          <textarea
            id="theme_aesthetic"
            value={foundation.theme_aesthetic || ''}
            onChange={handleThemeChange}
            placeholder="Ex: cores específicas, tema de filme, época, etc."
            rows={3}
            className="form-textarea"
          />
        </div>
      </div>
    </div>
  );
}

