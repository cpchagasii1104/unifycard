// frontend/src/components/governance/GroupAllocationCard.tsx
// CONTINUOUS PRODUCTION: Card de Alocação de Grupos - SPRINT 4
// Visibilidade de como o usuário aloca dinheiro para grupos

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionProvider';
import { getUserGroupAllocations, type GroupAllocationView } from '../../api/group-allocation';
import { getGroup } from '../../api/groups';
import { isAuthenticated, getTenantId } from '../../config/auth';
import GuardedButton from '../operational/GuardedButton';
import { getNonActionText } from '../../utils/canonical-language';
import { getAbsenceText } from '../../utils/temporal-state';
import { InstitutionalPulse } from '../../utils/institutional-pulse';
import './GroupAllocationCard.css';

interface GroupAllocationCardProps {
  showEditLink?: boolean;
}

interface GroupAllocationWithName extends GroupAllocationView {
  groupName?: string;
}

export default function GroupAllocationCard({ showEditLink = true }: GroupAllocationCardProps) {
  const navigate = useNavigate();
  const { sessionReady, activeActor } = useSession();
  const [allocations, setAllocations] = useState<GroupAllocationWithName[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionReady || !isAuthenticated() || !getTenantId() || !activeActor) {
      setLoading(false);
      return;
    }

    loadAllocations();
  }, [sessionReady, activeActor?.actor_id]);

  const loadAllocations = async () => {
    setLoading(true);

    try {
      const allocs = await getUserGroupAllocations();
      
      // Garantir que allocs é sempre um array válido
      const safeAllocs = Array.isArray(allocs) ? allocs : [];
      
      // Carregar nomes dos grupos
      const allocationsWithNames = await Promise.all(
        safeAllocs.map(async (alloc) => {
          try {
            const group = await getGroup(alloc.groupId);
            return {
              ...alloc,
              groupName: group.name,
            };
          } catch {
            return {
              ...alloc,
              groupName: undefined,
            };
          }
        })
      );
      
      setAllocations(allocationsWithNames);
    } catch (err: any) {
      console.warn('Erro ao carregar alocações:', err);
      // Não tratar como erro crítico - pode ser que simplesmente não há alocações configuradas
      // Tratar como estado vazio em vez de erro
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPercentage = allocations.reduce((sum, a) => sum + (a.percentage * 100), 0);
  const regionalFundPercentage = 100 - totalPercentage;

  if (loading) {
    return (
      <div className="group-allocation-card">
        <div className="allocation-loading">
          <div className="skeleton skeleton-line" />
        </div>
      </div>
    );
  }

  // Removido tratamento de erro - agora trata como estado vazio

  return (
    <div className="group-allocation-card">
      <div className="allocation-header">
        <h3>Alocação para Grupos</h3>
        {showEditLink && (
          <GuardedButton
            actionType="allocate_groups"
            onClick={() => navigate('/grupos')}
            className="allocation-edit-link"
            showTooltip={false}
          >
            Ajustar
          </GuardedButton>
        )}
      </div>

      {allocations.length === 0 ? (
        <div className="allocation-empty">
          <p>Você não configurou alocação para grupos.</p>
          {/* SPRINT 17: Consequência da não-ação */}
          <p className="allocation-empty-hint" style={{ 
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            fontSize: '0.9rem',
            color: '#666',
            lineHeight: '1.4'
          }}>
            {getNonActionText('groupAllocation')}
          </p>
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
      ) : (
        <div className="allocation-content">
          <div className="allocation-list">
            {allocations.map((alloc) => (
              <div key={alloc.groupId} className="allocation-item">
                <div className="allocation-group">
                  <div className="allocation-group-name">
                    {alloc.groupName || `Grupo ${alloc.groupId.substring(0, 8)}...`}
                  </div>
                </div>
                <div className="allocation-percentage">
                  {(alloc.percentage * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {regionalFundPercentage > 0 && (
            <div className="allocation-residual">
              <div className="allocation-residual-label">Restante:</div>
              <div className="allocation-residual-value">
                {regionalFundPercentage.toFixed(1)}% → Fundo Regional
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


