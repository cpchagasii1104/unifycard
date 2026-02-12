// src/pages/GroupVotesPage.tsx
// Lista de Votações do Grupo
// SPRINT: Groups MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listGroupVotes, type GroupVote, type VoteStatus } from '../api/group-votes';
import { getGroup } from '../api/groups';
import { showToast } from '../components/common/Toast';
import './GroupVotesPage.css';

export default function GroupVotesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState<string>('');
  const [votes, setVotes] = useState<GroupVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VoteStatus | 'ALL'>('ALL');

  useEffect(() => {
    if (id) {
      loadGroup();
      loadVotes();
    }
  }, [id, statusFilter]);

  const loadGroup = async () => {
    if (!id) return;
    try {
      const group = await getGroup(id);
      setGroupName(group.name);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };

  const loadVotes = async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      const status = statusFilter === 'ALL' ? undefined : statusFilter;
      const data = await listGroupVotes(id, status);
      setVotes(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar votações');
      showToast(err.message || 'Erro ao carregar votações', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusLabel = (status: VoteStatus): string => {
    return status === 'open' ? 'Aberta' : 'Encerrada';
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'Sem data de encerramento';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="group-votes-page">
        <div className="loading">Carregando votações...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-votes-page">
        <div className="error">
          <p>{error}</p>
          <button onClick={loadVotes}>Tentar novamente</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-votes-page">
      <div className="page-header">
        <button onClick={() => navigate(`/grupos/${id}`)}>← Voltar</button>
        <h1>Votações: {groupName}</h1>
      </div>

      <div className="filters">
        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as VoteStatus | 'ALL')}
          >
            <option value="ALL">Todas</option>
            <option value="open">Abertas</option>
            <option value="closed">Encerradas</option>
          </select>
        </div>
      </div>

      {votes.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma votação encontrada.</p>
        </div>
      ) : (
        <div className="votes-list">
          {votes.map((vote) => (
            <div
              key={vote.voteId}
              className="vote-item"
              onClick={() => navigate(`/grupos/${id}/votes/${vote.voteId}`)}
            >
              <div className="vote-header">
                <h3 className="vote-title">{vote.title}</h3>
                <span className={`vote-status status-${vote.status}`}>
                  {getStatusLabel(vote.status)}
                </span>
              </div>
              {vote.description && (
                <p className="vote-description">{vote.description}</p>
              )}
              <div className="vote-meta">
                <span className="vote-total">
                  {vote.totalVotes || 0} {vote.totalVotes === 1 ? 'voto' : 'votos'}
                </span>
                {vote.closesAt && (
                  <span className="vote-closes">
                    Encerra em: {formatDateTime(vote.closesAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




