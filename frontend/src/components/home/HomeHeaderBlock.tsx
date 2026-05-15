// frontend/src/components/home/HomeHeaderBlock.tsx
// Bloco de TOPO da Home: saudação personalizada + Situação Atual com todos os saldos.
// Renderizado por HomePage.tsx ANTES de SearchBar e AppGrid (acima dos aplicativos).
//
// 2026-05-15: extraído de HomeContextual.tsx por pedido de Clayton — saudação e saldos
// devem ficar no topo da página, acima da SearchBar e AppGrid. O resto do HomeContextual
// (transparência, pendências, saúde, cards de distribuição, workflow) permanece após
// SearchBar/AppGrid.

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '../../contexts/SessionProvider';
import { getBankBalance } from '../../api/bank';
import { getMyGroups, getGroupBalance } from '../../api/groups';
import { getReferralEarnings } from '../../api/auth';
import { isAuthenticated, getTenantId } from '../../config/auth';
import { centsToReais } from '../../utils/money';
import './HomeContextual.css';

interface GroupBalanceRow {
  groupId: string;
  name: string;
  balance: number;
  currency: string;
}

export default function HomeHeaderBlock() {
  const { sessionReady, activeActor } = useSession();
  const [balanceCents, setBalanceCents] = useState<number | null>(null);
  const [groupBalances, setGroupBalances] = useState<GroupBalanceRow[]>([]);
  const [referralEarningsCents, setReferralEarningsCents] = useState(0);
  const [referralEarningsCount, setReferralEarningsCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!activeActor) return;
    const [balanceR, groupsR, referralR] = await Promise.allSettled([
      getBankBalance().catch(() => null),
      getMyGroups().catch(() => ({ groups: [] })),
      activeActor.actor_type === 'user' ? getReferralEarnings().catch(() => null) : Promise.resolve(null),
    ]);

    // Saldo do usuário (cents canônico §4.7)
    if (balanceR.status === 'fulfilled' && balanceR.value) {
      setBalanceCents(balanceR.value.balanceCents ?? balanceR.value.balance ?? null);
    } else {
      setBalanceCents(null);
    }

    // Saldos por grupo via fan-out (mesma estratégia A5)
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
    setReferralEarningsCount(referral?.count ?? 0);
  }, [activeActor]);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) return;
    loadData();
  }, [sessionReady, activeActor?.actor_id, loadData]);

  // Recarregar ao trocar de actor ou invalidar queries
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

  const formatCentsAsBRL = (cents: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centsToReais(cents));

  const getActorTypeLabel = (actorType: string): string => {
    const labels: Record<string, string> = {
      user: 'Pessoa Física',
      page: 'Empresa',
      group: 'Grupo',
      channel: 'Canal',
    };
    return labels[actorType] || actorType;
  };

  // Primeiro nome do actor para saudação personalizada
  const firstName = (() => {
    if (!activeActor?.display_name) return null;
    if (activeActor.actor_type === 'user') {
      return activeActor.display_name.trim().split(/\s+/)[0];
    }
    return activeActor.display_name;
  })();

  const balanceToShow = balanceCents ?? 0;

  if (!activeActor) return null;

  return (
    <div className="home-header-block">
      {/* Saudação personalizada */}
      {firstName && (
        <div className="home-greeting">
          <h2 className="home-greeting-text">
            Olá <strong>{firstName}</strong>, o que deseja fazer hoje?
          </h2>
        </div>
      )}

      {/* Situação Atual — saldos */}
      <div className="home-situation">
        <h2>Situação Atual</h2>
        <div className="situation-content">
          {/* Botão clicável que abre o dropdown do Header global */}
          <button
            type="button"
            className="situation-actor situation-actor-button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-actor-dropdown'));
            }}
            aria-label="Trocar usuário ou perfil ativo"
          >
            <span className="situation-label">Atuando como:</span>
            <span className="situation-value">
              <strong>{activeActor.display_name}</strong>
              <span className="situation-type">({getActorTypeLabel(activeActor.actor_type)})</span>
            </span>
            <span className="situation-actor-hint">▼ trocar</span>
          </button>

          {/* Saldo do usuário selecionado */}
          <div className="situation-balance">
            <span className="situation-label">Saldo do usuário selecionado:</span>
            <span className={`situation-value ${balanceToShow >= 0 ? 'positive' : 'negative'}`}>
              {formatCentsAsBRL(balanceToShow)}
            </span>
          </div>

          {/* Ganhos com código de indicação (só para actor_type='user') */}
          {activeActor.actor_type === 'user' && (
            <div className="situation-balance">
              <span className="situation-label">Ganhos com o código de indicação:</span>
              <span className={`situation-value ${referralEarningsCents >= 0 ? 'positive' : 'negative'}`}>
                {formatCentsAsBRL(referralEarningsCents)}
              </span>
              {referralEarningsCount > 0 && (
                <span className="situation-type">
                  ({referralEarningsCount} indicação{referralEarningsCount > 1 ? 'ões' : ''})
                </span>
              )}
            </div>
          )}

          {/* Saldo de cada grupo (nome + valor) */}
          {groupBalances.length > 0 && (
            <div className="situation-group-balances">
              <div className="situation-label">Saldos dos grupos:</div>
              <ul className="group-balance-list">
                {groupBalances.map((gb) => (
                  <li key={gb.groupId} className="group-balance-item">
                    <span className="group-balance-name">{gb.name}</span>
                    <span className={`group-balance-value ${gb.balance >= 0 ? 'positive' : 'negative'}`}>
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: gb.currency || 'BRL',
                      }).format(gb.balance)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
