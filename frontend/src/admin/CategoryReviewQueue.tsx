// src/admin/CategoryReviewQueue.tsx
// Componente para revisão de categorias criadas por IA
// Apenas admin pode acessar

import { useState, useEffect } from 'react';
import { CategoryStatus } from '@unificard/contracts';
import { apiFetch } from '../api/client';
import './CategoryReviewQueue.css';

interface PendingCategory {
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  level: number;
  path: string[];
  keywords: string[];
  countryCode: string | null;
  status: CategoryStatus;
  requiresReview: boolean;
  createdByAI: boolean;
  confidence?: number;
  originalText?: string;
  aiReasoning?: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingCategoriesResponse {
  ok: boolean;
  data: {
    categories: PendingCategory[];
    count: number;
  };
}

export default function CategoryReviewQueue() {
  const [categories, setCategories] = useState<PendingCategory[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPendingCategories();
  }, []);

  const loadPendingCategories = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/admin/categories/pending');
      const data: PendingCategoriesResponse = await response.json();

      if (data.ok && data.data) {
        setCategories(data.data.categories);
        setCount(data.data.count);
      } else {
        setError('Erro ao carregar categorias pendentes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (categoryId: string) => {
    if (processing.has(categoryId)) return;

    setProcessing((prev) => new Set(prev).add(categoryId));

    try {
      const response = await apiFetch(`/admin/categories/${categoryId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.ok) {
        // Remover da lista
        setCategories((prev) => prev.filter((c) => c.categoryId !== categoryId));
        setCount((prev) => prev - 1);
        alert('Categoria aprovada com sucesso!');
      } else {
        alert(`Erro: ${data.message || 'Erro ao aprovar categoria'}`);
      }
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : 'Erro ao aprovar categoria'}`);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  };

  const handleReject = async (categoryId: string) => {
    if (processing.has(categoryId)) return;

    const reason = prompt('Motivo da rejeição (opcional):');
    if (reason === null) return; // Usuário cancelou

    setProcessing((prev) => new Set(prev).add(categoryId));

    try {
      const response = await apiFetch(`/admin/categories/${categoryId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || undefined }),
      });

      const data = await response.json();

      if (data.ok) {
        // Remover da lista
        setCategories((prev) => prev.filter((c) => c.categoryId !== categoryId));
        setCount((prev) => prev - 1);
        alert('Categoria rejeitada com sucesso!');
      } else {
        alert(`Erro: ${data.message || 'Erro ao rejeitar categoria'}`);
      }
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : 'Erro ao rejeitar categoria'}`);
    } finally {
      setProcessing((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="category-review-queue">
        <div className="loading">Carregando categorias pendentes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="category-review-queue">
        <div className="error">{error}</div>
        <button onClick={loadPendingCategories} className="retry-button">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="category-review-queue">
      <header className="review-header">
        <h1>Revisão de Categorias</h1>
        <div className="review-stats">
          <span className="pending-count">{count} pendente{count !== 1 ? 's' : ''}</span>
        </div>
      </header>

      {categories.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma categoria pendente de aprovação.</p>
        </div>
      ) : (
        <div className="categories-list">
          {categories.map((category) => (
            <div key={category.categoryId} className="category-card">
              <div className="category-header">
                <h3 className="category-name">{category.name}</h3>
                <div className="category-badges">
                  {category.createdByAI && (
                    <span className="badge badge-ai">Criada por IA</span>
                  )}
                  {category.confidence !== undefined && (
                    <span className="badge badge-confidence">
                      Confiança: {(category.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="category-details">
                <div className="detail-row">
                  <strong>Slug:</strong> <code>{category.slug}</code>
                </div>
                {category.description && (
                  <div className="detail-row">
                    <strong>Descrição:</strong> {category.description}
                  </div>
                )}
                {category.path && category.path.length > 0 && (
                  <div className="detail-row">
                    <strong>Caminho:</strong> {category.path.join(' > ')}
                  </div>
                )}
                {category.keywords && category.keywords.length > 0 && (
                  <div className="detail-row">
                    <strong>Keywords:</strong> {category.keywords.join(', ')}
                  </div>
                )}
                {category.originalText && (
                  <div className="detail-row">
                    <strong>Texto original:</strong> <em>{category.originalText}</em>
                  </div>
                )}
                {category.aiReasoning && (
                  <div className="detail-row">
                    <strong>Raciocínio da IA:</strong> {category.aiReasoning}
                  </div>
                )}
                <div className="detail-row">
                  <strong>Criada em:</strong>{' '}
                  {new Date(category.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>

              <div className="category-actions">
                <button
                  className="action-button action-approve"
                  onClick={() => handleApprove(category.categoryId)}
                  disabled={processing.has(category.categoryId)}
                >
                  {processing.has(category.categoryId) ? 'Processando...' : '✅ Aprovar'}
                </button>
                <button
                  className="action-button action-reject"
                  onClick={() => handleReject(category.categoryId)}
                  disabled={processing.has(category.categoryId)}
                >
                  {processing.has(category.categoryId) ? 'Processando...' : '❌ Rejeitar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
















