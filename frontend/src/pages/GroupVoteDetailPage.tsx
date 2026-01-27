// src/pages/GroupVoteDetailPage.tsx
// Detalhe de Votação do Grupo
// SPRINT: Groups MVP

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGroupVote, voteOnGroupVote, closeGroupVote, type VoteWithOptions } from '../api/group-votes';
import { getGroup } from '../api/groups';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import './GroupVoteDetailPage.css';

export default function GroupVoteDetailPage() {
  const { id, voteId } = useParams<{ id: string; voteId: string }>();
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [groupName, setGroupName] = useState<string>('');
  const [vote, setVote] = useState<VoteWithOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    if (id && voteId) {
      loadGroup();
      loadVote();
    }
  }, [id, voteId]);

  const loadGroup = async () => {
    if (!id) return;
    try {
      const group = await getGroup(id);
      setGroupName(group.name);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
    }
  };

  const loadVote = async () => {
    if (!id || !voteId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getGroupVote(id, voteId);
      setVote(data);
      if (data.userVoteOptionId) {
        setSelectedOptionId(data.userVoteOptionId);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar votação');
      showToast(err.message || 'Erro ao carregar votação', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (!id || !voteId || !selectedOptionId || !vote) return;
    if (vote.userVoted) {
      showToast('Você já votou nesta votação', 'error');
      return;
    }
    if (vote.status === 'closed') {
      showToast('Esta votação está encerrada', 'error');
      return;
    }

    setIsVoting(true);
    try {
      const updatedVote = await voteOnGroupVote(id, voteId, selectedOptionId);
      setVote(updatedVote);
      setSelectedOptionId(updatedVote.userVoteOptionId);
      showToast('Voto registrado com sucesso', 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao votar', 'error');
    } finally {
      setIsVoting(false);
    }
  };

  const handleCloseVote = async () => {
    if (!id || !voteId) return;
    if (!window.confirm('Tem certeza que deseja encerrar esta votação?')) {
      return;
    }

    try {
      await closeGroupVote(id, voteId);
      showToast('Votação encerrada com sucesso', 'success');
      loadVote();
    } catch (err: any) {
      showToast(err.message || 'Erro ao encerrar votação', 'error');
    }
  };

  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'Sem data';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const calculatePercentage = (count: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((count / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="group-vote-detail-page">
        <div className="loading">Carregando votação...</div>
      </div>
    );
  }

  if (error || !vote) {
    return (
      <div className="group-vote-detail-page">
        <div className="error">
          <p>{error || 'Votação não encontrada'}</p>
          <button onClick={() => navigate(`/grupos/${id}/votes`)}>Voltar para Lista</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-vote-detail-page">
      <div className="page-header">
        <button onClick={() => navigate(`/grupos/${id}/votes`)}>← Voltar</button>
        <h1>{vote.title}</h1>
        <span className={`vote-status status-${vote.status}`}>
          {vote.status === 'open' ? 'Aberta' : 'Encerrada'}
        </span>
      </div>

      <div className="vote-content">
        <div className="vote-main">
          {vote.description && (
            <div className="vote-section">
              <h2>Descrição</h2>
              <p className="vote-description">{vote.description}</p>
            </div>
          )}

          <div className="vote-section">
            <h2>Opções</h2>
            {vote.status === 'open' && !vote.userVoted ? (
              <div className="vote-options-voting">
                {vote.options.map((option) => (
                  <label key={option.optionId} className="vote-option-radio">
                    <input
                      type="radio"
                      name="vote-option"
                      value={option.optionId}
                      checked={selectedOptionId === option.optionId}
                      onChange={() => setSelectedOptionId(option.optionId)}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
                <button
                  onClick={handleVote}
                  disabled={!selectedOptionId || isVoting}
                  className="btn-vote"
                >
                  {isVoting ? 'Votando...' : 'Votar'}
                </button>
              </div>
            ) : (
              <div className="vote-options-results">
                {vote.options
                  .sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0))
                  .map((option) => {
                    const percentage = calculatePercentage(option.voteCount || 0, vote.totalVotes);
                    const isUserVote = vote.userVoteOptionId === option.optionId;
                    return (
                      <div
                        key={option.optionId}
                        className={`vote-option-result ${isUserVote ? 'user-vote' : ''}`}
                      >
                        <div className="vote-option-header">
                          <span className="vote-option-text">{option.text}</span>
                          {isUserVote && <span className="vote-option-your-vote">Seu voto</span>}
                        </div>
                        <div className="vote-option-bar">
                          <div
                            className="vote-option-bar-fill"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="vote-option-meta">
                          <span>{option.voteCount || 0} votos</span>
                          <span>{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="vote-section">
            <h2>Informações</h2>
            <div className="vote-info">
              <div className="info-item">
                <label>Total de votos:</label>
                <span>{vote.totalVotes}</span>
              </div>
              {vote.closesAt && (
                <div className="info-item">
                  <label>Encerra em:</label>
                  <span>{formatDateTime(vote.closesAt)}</span>
                </div>
              )}
              <div className="info-item">
                <label>Criada em:</label>
                <span>{formatDateTime(vote.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}




