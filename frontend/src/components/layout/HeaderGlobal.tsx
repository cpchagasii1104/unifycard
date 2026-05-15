// src/components/layout/HeaderGlobal.tsx
// Header global reutilizável com ator ativo e saldo
// Dropdown de ator ativo + botão Rede Social

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance } from '../../api/bank';
import { getImpactBalance, type ImpactBalance } from '../../api/impact';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { isPilotMode } from '../../config/pilot';
import { centsToReais } from '../../utils/money';
import './HeaderGlobal.css';

interface WalletData {
  balanceCents: number;
  currency: string;
}

export default function HeaderGlobal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeActor, actors, isLoading: actorsLoading, setActiveActor } = useActiveActor();
  const { sessionReady } = useSession();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [impactBalance, setImpactBalance] = useState<ImpactBalance | null>(null);
  const [isActorDropdownOpen, setIsActorDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsActorDropdownOpen(false);
      }
    };

    if (isActorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isActorDropdownOpen]);

  const loadImpactBalance = useCallback(async () => {
    if (!activeActor) return;
    
    try {
      const balance = await getImpactBalance(
        activeActor.actor_id,
        activeActor.actor_type as 'user' | 'page'
      );
      setImpactBalance(balance);
    } catch (err) {
      console.warn('Erro ao carregar saldo de impacto (não crítico):', err);
      // Se falhar, mostrar 0
      setImpactBalance({
        actor_id: activeActor.actor_id,
        actor_type: activeActor.actor_type as 'user' | 'page',
        balance: 0,
      });
    }
  }, [activeActor]);

  // 🔴 Carregar wallet apenas quando sessão estiver pronta e autenticado
  useEffect(() => {
    // GUARD: Não fazer chamadas se:
    // - sessão não estiver pronta
    // - não estiver autenticado
    // - tenantId não existir
    // - activeActor não estiver definido (endpoints protegidos precisam de actor)
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setWallet({ balanceCents: 0, currency: 'BRL' });
      return;
    }

    loadWallet();
  }, [sessionReady, activeActor]);

  // Carregar impacto quando ator ativo muda
  useEffect(() => {
    if (activeActor) {
      loadImpactBalance();
    } else {
      setImpactBalance(null);
    }
  }, [activeActor?.actor_id, activeActor?.actor_type]);

  // Escutar eventos de mudança de impacto
  useEffect(() => {
    const handleImpactChanged = (event: CustomEvent<{ actor_id: string; actor_type: string }>) => {
      if (activeActor && 
          event.detail.actor_id === activeActor.actor_id && 
          event.detail.actor_type === activeActor.actor_type) {
        loadImpactBalance();
      }
    };

    window.addEventListener('impact-changed', handleImpactChanged as EventListener);
    return () => {
      window.removeEventListener('impact-changed', handleImpactChanged as EventListener);
    };
  }, [activeActor, loadImpactBalance]);

  const loadWallet = async () => {
    try {
      // Bug 1 fix (2026-05-14): Header consulta fonte canônica `/bank/balance` (bank_ledger via getBankBalance),
      // mesma fonte que HomeContextual usa. Endpoint legacy `/identity/wallet` lia via
      // `accountService.getAccountsByGlobalUserId` (cache stale / contas legacy) e retornava 0
      // mesmo quando bank_ledger tinha saldo real — gerava divergência visível entre Home e Header.
      const balanceResult = await getBankBalance();
      setWallet({
        balanceCents: balanceResult.balanceCents ?? balanceResult.balance ?? 0,
        currency: balanceResult.currency || 'BRL',
      });
    } catch (err: any) {
      console.warn('Erro ao carregar wallet:', err);
      setWallet({ balanceCents: 0, currency: 'BRL' });
    }
  };

  const formatBalance = (balanceReais: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(balanceReais);
  };

  const handleGoToBank = () => {
    navigate('/banco');
  };

  const handleGoToSocial = () => {
    navigate('/social');
  };

  const handleSelectActor = (actorId: string) => {
    setActiveActor(actorId);
    // Manter dropdown aberto para facilitar navegação
    // setIsActorDropdownOpen(false);
  };

  const getActorIcon = (actorType: string) => {
    if (actorType === 'user') return '👤';
    if (actorType === 'page') return '🏢';
    return '👥';
  };

  const isSocialPage = location.pathname.startsWith('/social') || 
                      location.pathname.startsWith('/grupos') ||
                      location.pathname.startsWith('/feed') ||
                      location.pathname.startsWith('/votacoes') ||
                      location.pathname.startsWith('/impacto');

  // Não mostrar "Carregando..." - deixar interface aparecer mesmo durante loading
  // O sistema tentará conectar automaticamente em background

  // 🔴 REGRA: Todas as empresas aparecem no seletor (independente de validation_status)
  // 🔧 FIX: Garantir que availableActors seja sempre um array antes de usar métodos de array
  const availableActors = Array.isArray(actors) ? actors : [];
  const personalActor = availableActors.find(a => a.actor_type === 'user');
  const companyActors = availableActors.filter(a => a.actor_type === 'page');

  return (
    <header className="header-global">
      <div className="header-content">
        {/* Botão Rede Social (sempre visível) */}
        {!isSocialPage && (
          <button 
            onClick={handleGoToSocial}
            className="header-button-social"
            title="Ir para Rede Social"
          >
            📱 Rede Social
          </button>
        )}

        {/* Ator Ativo com Dropdown - CONTINUOUS PRODUCTION: Seletor "Atuando como" */}
        <div className="header-actor" ref={dropdownRef}>
          <span className="header-actor-label">Atuando como:</span>
          {activeActor ? (
            <div className="actor-dropdown-container">
              <button
                className="actor-dropdown-trigger"
                onClick={() => setIsActorDropdownOpen(!isActorDropdownOpen)}
                type="button"
              >
                <div className="actor-display">
                  {activeActor.avatar_url ? (
                    <img 
                      src={activeActor.avatar_url} 
                      alt={activeActor.display_name} 
                      className="actor-avatar-header"
                    />
                  ) : (
                    <div className="actor-avatar-placeholder-header">
                      {getActorIcon(activeActor.actor_type)}
                    </div>
                  )}
                  <div className="actor-info-header">
                    <div className="actor-name-header">{activeActor.display_name}</div>
                    {activeActor.actor_type === 'page' && activeActor.user_role && (
                      <div className="actor-role-header">
                        {activeActor.user_role === 'owner' && '👑 Proprietário'}
                        {activeActor.user_role === 'director' && '💼 Diretor'}
                        {activeActor.user_role === 'manager' && '📋 Gerente'}
                        {activeActor.user_role === 'employee' && '👔 Funcionário'}
                      </div>
                    )}
                    {activeActor.actor_type === 'page' && activeActor.company_status === 'PROVISIONAL' && (
                      <div className="actor-status-badge provisional">⚠️ Em validação</div>
                    )}
                  </div>
                  <span className="actor-dropdown-arrow">
                    {isActorDropdownOpen ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {isActorDropdownOpen && (
                <div className="actor-dropdown-menu">
                  {/* Pessoa Física */}
                  {personalActor && (
                    <button
                      className={`actor-dropdown-item ${activeActor.actor_id === personalActor.actor_id ? 'active' : ''}`}
                      onClick={() => handleSelectActor(personalActor.actor_id)}
                      type="button"
                    >
                      <span className="actor-item-icon">{getActorIcon(personalActor.actor_type)}</span>
                      <div className="actor-item-info">
                        <div className="actor-item-name">{personalActor.display_name}</div>
                        <div className="actor-item-subtitle">Pessoa Física</div>
                      </div>
                      {activeActor.actor_id === personalActor.actor_id && (
                        <span className="actor-item-check">✓</span>
                      )}
                    </button>
                  )}

                  {/* Separador */}
                  {personalActor && companyActors.length > 0 && (
                    <div className="actor-dropdown-separator" />
                  )}

                  {/* Empresas */}
                  {companyActors.map((actor) => {
                    const isProvisional = actor.company_status === 'PROVISIONAL';
                    return (
                      <button
                        key={actor.actor_id}
                        className={`actor-dropdown-item ${activeActor.actor_id === actor.actor_id ? 'active' : ''}`}
                        onClick={() => handleSelectActor(actor.actor_id)}
                        type="button"
                      >
                        <span className="actor-item-icon">{getActorIcon(actor.actor_type)}</span>
                        <div className="actor-item-info">
                          <div className="actor-item-name">
                            {actor.display_name}
                            {isProvisional && (
                              <span className="actor-item-badge provisional">provisional</span>
                            )}
                          </div>
                          {actor.user_role && (
                            <div className="actor-item-subtitle">
                              {actor.user_role === 'owner' && '👑 Proprietário'}
                              {actor.user_role === 'director' && '💼 Diretor'}
                              {actor.user_role === 'manager' && '📋 Gerente'}
                              {actor.user_role === 'employee' && '👔 Funcionário'}
                            </div>
                          )}
                        </div>
                        {activeActor.actor_id === actor.actor_id && (
                          <span className="actor-item-check">✓</span>
                        )}
                      </button>
                    );
                  })}

                  {/* Botão cadastrar empresa */}
                  <div className="actor-dropdown-separator" />
                  <button
                    className="actor-dropdown-item actor-dropdown-item-action"
                    onClick={() => {
                      // Manter dropdown aberto para facilitar navegação
                      // setIsActorDropdownOpen(false);
                      navigate('/empresas');
                    }}
                    type="button"
                  >
                    <span className="actor-item-icon">➕</span>
                    <div className="actor-item-info">
                      <div className="actor-item-name">Cadastrar nova empresa</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="actor-display">
              {actorsLoading ? (
                <span style={{ opacity: 0.6 }}>Carregando...</span>
              ) : !Array.isArray(actors) || actors.length === 0 ? (
                <span style={{ opacity: 0.6 }}>Nenhum ator disponível</span>
              ) : (
                <span style={{ opacity: 0.6 }}>Selecione um ator</span>
              )}
            </div>
          )}
        </div>

        {/* Saldo e Ações */}
        <div className="header-actions">
          {wallet && (
            <div className="header-balance">
              <div className="balance-item">
                <span className="balance-label">Unify:</span>
                <span className="balance-value">{formatBalance(centsToReais(wallet.balanceCents))}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">Impacto:</span>
                <span className="balance-value">
                  {impactBalance ? impactBalance.balance.toLocaleString('pt-BR') : '0'}
                </span>
              </div>
            </div>
          )}
          <button 
            onClick={handleGoToBank}
            className="header-button-bank"
            title="Ir para Banco"
          >
            🏦 Ir para Banco
          </button>
        </div>
      </div>
      {/* SPRINT 15: Indicação discreta de piloto */}
      {isPilotMode() && (
        <div style={{
          position: 'absolute',
          bottom: '4px',
          right: '1rem',
          fontSize: '0.7rem',
          color: '#999',
          fontStyle: 'italic',
        }}>
          Você está participando do piloto inicial do sistema.
        </div>
      )}
    </header>
  );
}
