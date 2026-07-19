// frontend/src/pages/InvitationAcceptPage.tsx
// DECISION-0189 (F5) — página do CONVIDADO: aceitar/recusar convite de acesso a empresa.
// O token chega por canal externo (o gestor envia); pode vir na URL (?token=) ou colado.
// O aceite é exclusivo da Identity convidada (o backend valida); o body NUNCA carrega
// permissões — elas foram persistidas na emissão. Token não vai para storage/analytics.

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { acceptCompanyInvitation, declineCompanyInvitation } from '../api/companyInvitations';

export default function InvitationAcceptPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ companyId: string; grantedKeys: string[]; reentry: boolean } | null>(null);

  const valid = /^[0-9a-f]{64}$/.test(token.trim());

  const handleAccept = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await acceptCompanyInvitation(token.trim());
      setDone(out);
    } catch (err: any) {
      setError(err.message || 'Convite não encontrado ou não aceitável');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    setError(null);
    try {
      await declineCompanyInvitation(token.trim());
      setError(null);
      setToken('');
      alert('Convite recusado. Nada foi concedido.');
    } catch (err: any) {
      setError(err.message || 'Convite não encontrado ou não aceitável');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '2rem auto', padding: '0 1rem' }}>
      <h2>Convite de acesso a empresa</h2>
      {!done ? (
        <>
          <p style={{ color: '#555', lineHeight: 1.5 }}>
            Cole abaixo o código de aceite que você recebeu. O convite é pessoal
            (vinculado à sua identidade) e de uso único.
          </p>
          <textarea
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="código de aceite (64 caracteres)"
            rows={3}
            style={{ width: '100%', fontFamily: 'monospace', padding: '0.5rem' }}
          />
          {error && <p style={{ color: '#b00020' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" disabled={!valid || busy} onClick={handleAccept}>
              {busy ? 'Processando…' : 'Aceitar convite'}
            </button>
            <button type="button" disabled={!valid || busy} onClick={handleDecline}>
              Recusar
            </button>
          </div>
        </>
      ) : (
        <div style={{ padding: '1rem', background: '#f0f7f0', border: '1px solid #b7dfb9', borderRadius: 6 }}>
          <p><strong>{done.reentry ? 'Acesso restabelecido.' : 'Convite aceito.'}</strong></p>
          <p>Permissões concedidas: {done.grantedKeys.length > 0 ? done.grantedKeys.join(', ') : 'nenhuma (vínculo sem permissões operacionais)'}.</p>
          <button type="button" onClick={() => navigate('/empresas')}>Ir para empresas</button>
        </div>
      )}
    </div>
  );
}
