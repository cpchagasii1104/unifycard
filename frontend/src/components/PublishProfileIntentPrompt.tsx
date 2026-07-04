// src/components/PublishProfileIntentPrompt.tsx
// F-DISCOVERY-INTENT-PROMPT — regra de Clayton (2026-07-03): "a pergunta de visibilidade aparece
// no momento em que a intenção a torna natural — nunca como formulário arbitrário".
// Este prompt entra nos fluxos de CRIAÇÃO (serviço/recurso/empresa = modo Operar = quer ser achado):
// se o perfil ainda não está na vitrine, oferece publicar JUNTO da criação (default LIGADO, conforme
// tabela de defaults do desenho selado: negócio nasce público). Se já está público, não aparece.
// Verdade 100% server-side (GET /mine decide se mostra; POST /publish grava) — nada persistido local.

import { useEffect, useState } from 'react';
import { getMyPublicProfile, publishMyProfile } from '../api/public-profiles';

interface Props {
  /** Texto do contexto, ex.: "Seu serviço será achável na busca." */
  contextLabel: string;
  /** Registra o callback que o form chama APÓS criação bem-sucedida (publica se marcado). */
  onRegister: (publishIfChecked: () => Promise<void>) => void;
}

export default function PublishProfileIntentPrompt({ contextLabel, onRegister }: Props) {
  const [show, setShow] = useState(false);
  const [checked, setChecked] = useState(true); // default ON — intenção de ser achado

  useEffect(() => {
    let alive = true;
    getMyPublicProfile()
      .then((p) => { if (alive) setShow(p?.visibility !== 'public'); })
      .catch(() => { if (alive) setShow(false); }); // fail-soft: prompt some, criação segue
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    onRegister(async () => {
      if (!show || !checked) return;
      try { await publishMyProfile('public'); } catch { /* não bloqueia a criação */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, checked]);

  if (!show) return null;

  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.6rem 0.8rem', background: '#eaecfb', border: '1px solid #4f5bd5', borderRadius: 10, fontSize: '0.8rem', color: '#23263b', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
      <span>
        <b>🌐 Publicar meu perfil na vitrine junto</b> — {contextLabel} Quem cria oferta normalmente
        quer ser encontrado; seu nome/foto/bio ficam acháveis (nunca dados privados). Dá pra mudar
        depois em Meu Perfil.
      </span>
    </label>
  );
}
