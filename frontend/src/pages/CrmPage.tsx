// frontend/src/pages/CrmPage.tsx
// F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7) — CRM = PROJEÇÃO da aresta de relação
// tipada (Fatia 1), não módulo próprio. "Meus clientes/fornecedores/colaboradores" = a MESMA
// aresta (actor_relationships), filtrada por label, vista pela MINHA ótica. O antigo
// crm.*/contacts (schema fantasma) foi retirado — zero fonte paralela.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { getMyRelationships, type ActorRelationshipEdge, type RelationshipLabel } from '../api/relationships';
import { getActorProfile } from '../api/social-2.0';
import { listSuppliers, createSupplier, type Supplier } from '../api/suppliers';
import { showToast } from '../components/common/Toast';
import './CrmPage.css';

const TABS: { key: RelationshipLabel; label: string }[] = [
  { key: 'cliente', label: 'Clientes' },
  { key: 'fornecedor', label: 'Fornecedores' },
  { key: 'colaborador', label: 'Colaboradores' },
];

interface CounterpartRow {
  edge: ActorRelationshipEdge;
  counterpartActorId: string;
  displayName: string;
  avatarUrl: string | null;
}

export default function CrmPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [tab, setTab] = useState<RelationshipLabel>('cliente');
  const [rows, setRows] = useState<CounterpartRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierActorId, setNewSupplierActorId] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const load = useCallback(async () => {
    if (!activeActor?.actor_id) return;
    setLoading(true);
    setError(null);
    try {
      const edges = await getMyRelationships({ label: tab, status: 'accepted' });
      const resolved = await Promise.all(
        edges.map(async (edge) => {
          const counterpartActorId = edge.fromActorId === activeActor.actor_id ? edge.toActorId : edge.fromActorId;
          try {
            const profile = await getActorProfile(counterpartActorId);
            return {
              edge,
              counterpartActorId,
              displayName: profile.actor.display_name,
              avatarUrl: profile.actor.avatar_url,
            };
          } catch {
            return { edge, counterpartActorId, displayName: counterpartActorId, avatarUrl: null };
          }
        })
      );
      setRows(resolved);
      if (tab === 'fornecedor') {
        setSuppliers(await listSuppliers());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar CRM');
    } finally {
      setLoading(false);
    }
  }, [tab, activeActor?.actor_id]);

  useEffect(() => { load(); }, [load]);

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim() || creatingSupplier) return;
    setCreatingSupplier(true);
    try {
      await createSupplier({
        name: newSupplierName.trim(),
        actorId: newSupplierActorId.trim() || null,
      });
      setNewSupplierName('');
      setNewSupplierActorId('');
      setSuppliers(await listSuppliers());
      showToast('Fornecedor cadastrado.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      showToast(msg.includes('ACTOR_ID_INVALID') ? 'O actor informado não existe.' : 'Não foi possível cadastrar o fornecedor.', 'error');
    } finally {
      setCreatingSupplier(false);
    }
  };

  return (
    <div className="crm-page">
      <div className="crm-header">
        <h1>CRM</h1>
        <p className="crm-subtitle">Meus clientes, fornecedores e colaboradores — a partir das conexões reais.</p>
      </div>

      <nav className="crm-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">Carregando...</div>
      ) : (
        <>
          <h2 className="crm-section-title">No app</h2>
          {rows.length === 0 ? (
            <div className="empty-state">Nenhuma conexão classificada como {TABS.find((t) => t.key === tab)?.label.toLowerCase()} ainda.</div>
          ) : (
            <div className="contacts-list">
              {rows.map((row) => (
                <div key={row.edge.id} className="contact-card" onClick={() => navigate(`/profile/${row.counterpartActorId}`)}>
                  <div className="contact-info">
                    {row.avatarUrl && <img className="contact-avatar" src={row.avatarUrl} alt={row.displayName} />}
                    <h3>{row.displayName}</h3>
                  </div>
                  <div className="contact-actions">
                    <button className="btn-view">Ver perfil</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'fornecedor' && (
            <>
              <h2 className="crm-section-title">Cadastrados (ERP)</h2>
              {suppliers.length === 0 ? (
                <div className="empty-state">Nenhum fornecedor cadastrado ainda.</div>
              ) : (
                <div className="contacts-list">
                  {suppliers.map((s) => (
                    <div key={s.id} className="contact-card">
                      <div className="contact-info">
                        <h3>{s.name}</h3>
                        <div className="contact-details">
                          {s.taxId && <span className="detail-item">Doc: {s.taxId}</span>}
                          {s.email && <span className="detail-item">Email: {s.email}</span>}
                          {s.phone && <span className="detail-item">Tel: {s.phone}</span>}
                        </div>
                      </div>
                      {s.actorId ? (
                        <span className="crm-badge crm-badge-linked">vinculado ao app</span>
                      ) : (
                        <span className="crm-badge">externo</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="crm-new-supplier">
                <h3>Novo fornecedor</h3>
                <input
                  className="crm-input"
                  placeholder="Nome"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                />
                <input
                  className="crm-input"
                  placeholder="ID do actor no app (opcional — deixe vazio se for externo)"
                  value={newSupplierActorId}
                  onChange={(e) => setNewSupplierActorId(e.target.value)}
                />
                <button
                  className="crm-new-supplier-submit"
                  disabled={!newSupplierName.trim() || creatingSupplier}
                  onClick={handleCreateSupplier}
                >
                  {creatingSupplier ? 'Salvando…' : 'Cadastrar'}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
