// src/pages/SocialProfilePage.tsx
// Página de perfil social (actor)

import { useParams } from 'react-router-dom';
import ProfilePage from '../components/social/ProfilePage';

export default function SocialProfilePage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>ID do perfil não fornecido</div>;
  }

  return <ProfilePage actorId={id} />;
}













