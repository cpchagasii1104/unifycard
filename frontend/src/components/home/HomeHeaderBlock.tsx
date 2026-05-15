// frontend/src/components/home/HomeHeaderBlock.tsx
// Bloco de TOPO da Home: saudação enriquecida + 3 cards visuais de visão geral + cards de grupos.
// 2026-05-15: redesign visual inspirado nas sugestões de Clayton (ChatGPT mockups).

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance } from '../../api/bank';
import { getMyGroups, getGroupBalance } from '../../api/groups';
import { getReferralEarnings } from '../../api/auth';
import { getUserRegionalFund } from '../../api/transparency';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import './HomeHeaderBlock.css';

interface GroupBalanceRow {
  groupId: string;
  name: string;
  balance: number;
  currency: string;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centsToReais(cents));

const formatBRLFromReais = (reais: number, currency = 'BRL') =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(reais);

// Cor consistente para um grupo a partir do seu ID (hash simples).
const groupColor = (groupId: string): string => {
  const palette = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(hash) % palette.length];
};

const initialsFromName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function HomeHeaderBlock() {
  const { sessionReady, activeActor } = useSession();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [regionalFundCents, setRegionalFundCents] = useState<number | null>(null);
  const [groupBalances, setGroupBalances] = useState<GroupBalanceRow[]>([]);
  const [referralEarningsCents, setReferralEarningsCents] = useState(0);

  const loadData = useCallback(async () => {
    if (!activeActor) return;

    const isUser = activeActor.actor_type === 'user';

    const [balanceR, groupsR, referralR, regionalR] = await Promise.allSettled([
      getBankBalance().catch(() => null),
      getMyGroups().catch(() => ({ groups: [] })),
      isUser ? getReferralEarnings().catch(() => null) : Promise.resolve(null),
      isUser ? getUserRegionalFund({ limit: 1 }).catch(() => null) : Promise.resolve(null),
    ]);

    // Saldo do usuário (cents canônico §4.7)
    if (balanceR.status === 'fulfilled' && balanceR.value) {
      setBalanceCents(balanceR.value.balanceCents ?? balanceR.value.balance ?? null);
    } else {
      setBalanceCents(null);
    }

    // Saldo do fundo regional
    if (regionalR.status === 'fulfilled' && regionalR.value) {
      setRegionalFundCents(regionalR.value.currentBalanceCents ?? 0);
    } else {
      setRegionalFundCents(null);
    }

    // Saldos por grupo via fan-out
    const groups = groupsR.status === 'fulfilled' ? groupsR.value.groups || [] : [];
    const balanceFetches = await Promise.allSettled(
      groups.map((g) => getGroupBalance(g.groupId).then((b) => ({ group: g, balance: b })))
    );
    const rows: GroupBalanceRow[] = balanceFetches
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((x): x is { group: typeof groups[number]; balance: any } => !!x && !!x.balance)
      .map(({ group, balance }) => ({
        groupId: group.groupId,
        name: group.name,
        balance: balance.balance,
        currency: balance.currency,
      }));
    setGroupBalances(rows);

    // Ganhos com indicação
    const referral = referralR.status === 'fulfilled' ? referralR.value : null;
    setReferralEarningsCents(referral?.totalCents ?? 0);
  }, [activeActor]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) return;
    loadData();
  }, [sessionReady, activeActor?.actor_id, loadData]);

  useEffect(() => {
    const handler = () => {
      if (sessionReady && isAuthenticated() && getTenantId() && activeActor) {
        loadData();
      }
    };
    window.addEventListener('active-actor-changed', handler);
    window.addEventListener('invalidate-queries', handler);
    return () => {
      window.removeEventListener('active-actor-changed', handler);
      window.removeEventListener('invalidate-queries', handler);
    };
  }, [sessionReady, activeActor, loadData]);

  if (!activeActor) return null;

  const firstName = (() => {
    if (!activeActor.display_name) return null;
    if (activeActor.actor_type === 'user') {
      return activeActor.display_name.trim().split(/\s+/)[0];
    }
    return activeActor.display_name;
  })();

  const isUser = activeActor.actor_type === 'user';
  const balanceToShow = balanceCents ?? 0;

  return (
    <div className="home-header-block">
      {/* Saudação enriquecida */}
      <div className="hhb-greeting">
        <div className="hhb-greeting-text">
          {firstName ? (
            <>
              <h1 className="hhb-greeting-title">
                Olá, <span className="hhb-greeting-name">{firstName}</span> <span className="hhb-emoji">👋</span>
              </h1>
              <p className="hhb-greeting-subtitle">Bem-vindo de volta ao UnifiCard</p>
            </>
          ) : (
            <h1 className="hhb-greeting-title">Bem-vindo ao UnifiCard</h1>
          )}
        </div>
        <button
          type="button"
          className="hhb-actor-switch"
          onClick={() => window.dispatchEvent(new CustomEvent('open-actor-dropdown'))}
          aria-label="Trocar usuário ou perfil ativo"
        >
          <span className="hhb-actor-label">Atuando como</span>
          <span className="hhb-actor-name">{activeActor.display_name}</span>
          <span className="hhb-actor-hint">▼ trocar</span>
        </button>
      </div>

      {/* 3 cards visuais de visão geral */}
      <div className="hhb-overview-cards">
        {isUser && (
          <div className="hhb-card hhb-card-regional">
            <div className="hhb-card-icon">🌍</div>
            <div className="hhb-card-body">
              <div className="hhb-card-label">Fundo Regional</div>
              <div className="hhb-card-value">{formatBRL(regionalFundCents ?? 0)}</div>
              <div className="hhb-card-hint">onde você mora</div>
            </div>
          </div>
        )}

        <div className="hhb-card hhb-card-balance">
          <div className="hhb-card-icon">💰</div>
          <div className="hhb-card-body">
            <div className="hhb-card-label">Meu saldo</div>
            <div className={`hhb-card-value ${balanceToShow < 0 ? 'negative' : ''}`}>
              {formatBRL(balanceToShow)}
            </div>
            <div className="hhb-card-hint">UnifyBank</div>
          </div>
        </div>

        {isUser && (
          <div className="hhb-card hhb-card-referral">
            <div className="hhb-card-icon">🎁</div>
            <div className="hhb-card-body">
              <div className="hhb-card-label">Indicações</div>
              <div className="hhb-card-value">{formatBRL(referralEarningsCents)}</div>
              <div className="hhb-card-hint">ganhos acumulados</div>
            </div>
          </div>
        )}
      </div>

      {/* Meus grupos — cards visuais */}
      {groupBalances.length > 0 && (
        <div className="hhb-groups-section">
          <div className="hhb-section-header">
            <h2 className="hhb-section-title">Meus grupos</h2>
            <span className="hhb-section-count">{groupBalances.length}</span>
          </div>
          <div className="hhb-groups-grid">
            {groupBalances.map((gb) => (
              <div key={gb.groupId} className="hhb-group-card">
                <div
                  className="hhb-group-avatar"
                  style={{ backgroundColor: groupColor(gb.groupId) }}
                  aria-hidden="true"
                >
                  {initialsFromName(gb.name)}
                </div>
                <div className="hhb-group-body">
                  <div className="hhb-group-name" title={gb.name}>{gb.name}</div>
                  <div className={`hhb-group-balance ${gb.balance < 0 ? 'negative' : ''}`}>
                    {formatBRLFromReais(gb.balance, gb.currency || 'BRL')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
