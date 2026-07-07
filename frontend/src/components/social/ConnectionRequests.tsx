// frontend/src/components/social/ConnectionRequests.tsx
// Achado de Clayton (2026-07-07, mockup FB "Adicionar aos amigos"→"Solicitar conexão"):
// solicitações de conexão RECEBIDAS com ACEITE CLASSIFICADO — quem recebe escolhe O QUE a pessoa é
// (amigo/família/conhecido/cliente/colaborador/fornecedor/parceiro) pela SUA ótica.
// ZERO verdade paralela: substrato = typed-edge actor_relationships (target_label, já governado);
// os labels PERMITIDOS vêm do SERVIDOR por item (regra de par server-side); o backend revalida tudo
// fail-closed no respond. A tela só projeta.
import { useCallback, useEffect, useState } from 'react';
import { getPendingReceivedRequests, respondRelationship, type PendingReceivedRequest, type RelationshipLabel } from '../../api/relationships';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../common/Toast';
import './ConnectionRequests.css';

const LABEL_PT: Record<string, string> = {
  amigo: 'Amigo', conhecido: 'Conhecido', familiar: 'Família', cliente: 'Cliente',
  colaborador: 'Colaborador', fornecedor: 'Fornecedor', parceiro: 'Parceiro',
};

// Frequência de feed (ideia Clayton 2026-07-07) — vocabulário governado; já configura no aceite.
const FEED_PRIORITY_PT: Array<{ value: string; label: string }> = [
  { value: 'padrao', label: 'Padrão' },
  { value: 'ver_primeiro', label: 'Ver primeiro' },
  { value: 'ver_mais', label: 'Ver mais' },
  { value: 'ver_menos', label: 'Ver menos' },
];

export default function ConnectionRequests() {
  const { activeActor } = useActiveActor();
  const [items, setItems] = useState<PendingReceivedRequest[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [chosenPriority, setChosenPriority] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!activeActor?.actor_id) { setItems([]); return; }
    getPendingReceivedRequests().then(setItems).catch(() => setItems([]));
  }, [activeActor?.actor_id]);

  useEffect(() => { load(); }, [load]);

  const act = async (item: PendingReceivedRequest, action: 'accept' | 'reject') => {
    const label = chosen[item.id];
    if (action === 'accept' && !label) {
      showToast('Escolha o que esta pessoa é pra você antes de aceitar.', 'error');
      return;
    }
    setBusy(item.id);
    try {
      await respondRelationship(
        item.id,
        action,
        action === 'accept' ? (label as RelationshipLabel) : undefined,
        action === 'accept' ? (chosenPriority[item.id] ?? 'padrao') : undefined
      );
      showToast(action === 'accept' ? `Conexão aceita como ${LABEL_PT[label] ?? label}.` : 'Solicitação recusada.', 'success');
      load();
    } catch (e) {
      showToast((e as Error)?.message || 'Falha ao responder a solicitação.', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return null; // sem pendências, sem ruído

  return (
    <div className="conn-requests">
      <div className="conn-requests-title">Solicitações de conexão</div>
      {items.map((item) => (
        <div key={item.id} className="conn-request-item">
          <div className="conn-request-who">
            <span className="conn-request-avatar">{item.fromActorType === 'page' ? '🏢' : item.fromActorType === 'group' ? '👥' : '👤'}</span>
            <div className="conn-request-text">
              <strong>{item.fromDisplayName}</strong>
              <span className="conn-request-hint">quer se conectar · te vê como {LABEL_PT[item.requesterLabel] ?? item.requesterLabel}</span>
            </div>
          </div>
          <div className="conn-request-actions">
            <select
              value={chosen[item.id] ?? ''}
              onChange={(e) => setChosen((m) => ({ ...m, [item.id]: e.target.value }))}
              disabled={busy === item.id}
              aria-label="O que esta pessoa é pra você?"
            >
              <option value="">O que essa pessoa é pra você?</option>
              {item.allowedTargetLabels.map((l) => (
                <option key={l} value={l}>{LABEL_PT[l] ?? l}</option>
              ))}
            </select>
            <select
              value={chosenPriority[item.id] ?? 'padrao'}
              onChange={(e) => setChosenPriority((m) => ({ ...m, [item.id]: e.target.value }))}
              disabled={busy === item.id}
              aria-label="Com que frequência ver os posts dessa pessoa?"
              title="Frequência no seu feed"
            >
              {FEED_PRIORITY_PT.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button type="button" className="conn-accept" disabled={busy === item.id} onClick={() => void act(item, 'accept')}>Aceitar</button>
            <button type="button" className="conn-reject" disabled={busy === item.id} onClick={() => void act(item, 'reject')}>Recusar</button>
          </div>
        </div>
      ))}
    </div>
  );
}
