// src/pages/PerfilPage.tsx
// Página de perfil do usuário
// F-DISCOVERY-PUBLIC-PROFILE-SLICE-B: card "quem pode me encontrar" (vitrine pública) acima
// do perfil — projeção do backend (GET /public-profiles/mine), zero verdade local.

import Profile from '../components/Profile';
import PublicProfileVisibilityCard from '../components/PublicProfileVisibilityCard';

export default function PerfilPage() {
  return (
    <>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem 1rem 0' }}>
        <PublicProfileVisibilityCard />
      </div>
      <Profile />
    </>
  );
}


























