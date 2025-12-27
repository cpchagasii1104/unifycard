// src/components/home/HeroActionBlock.tsx
// Bloco Hero com ações principais

import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import './HeroActionBlock.css';

export default function HeroActionBlock() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  
  // Ajustar textos conforme tipo de ator (apenas visual)
  const isCompany = activeActor?.actor_type === 'page';
  const isPerson = activeActor?.actor_type === 'user';
  
  // Priorizar ações conforme horário
  const currentHour = new Date().getHours();
  const isMealTime = (currentHour >= 11 && currentHour <= 14) || (currentHour >= 18 && currentHour <= 21);
  const isBusinessHours = currentHour >= 9 && currentHour <= 18;
  
  // Título adaptado ao tipo de ator
  const heroTitle = isCompany 
    ? 'O que sua empresa precisa resolver agora?'
    : isPerson
    ? 'O que você quer resolver agora?'
    : 'O que você quer resolver agora?';

  // Cards com textos adaptados e navegação
  const allCards = isCompany ? [
    {
      icon: '🍕',
      title: 'Pedidos corporativos',
      description: 'Gerencie pedidos e refeições para sua equipe',
      subtitle: 'Restaurantes perto de você',
      path: '/social',
      priority: isMealTime ? 1 : 3,
      color: 'orange',
    },
    {
      icon: '👥',
      title: 'Contratar serviços',
      description: 'Encontre profissionais e serviços para sua empresa',
      subtitle: 'Profissionais recomendados',
      path: '/social',
      priority: isBusinessHours ? 1 : 2,
      color: 'blue',
    },
    {
      icon: '📅',
      title: 'Eventos corporativos',
      description: 'Organize e participe de eventos empresariais',
      subtitle: 'Eventos hoje',
      path: '/social',
      priority: 2,
      color: 'purple',
    },
    {
      icon: '💼',
      title: 'Gestão de equipe',
      description: 'Gerencie sua equipe e processos',
      subtitle: 'Ferramentas administrativas',
      path: '/dashboard',
      priority: 3,
      color: 'green',
    },
  ] : [
    {
      icon: '🍕',
      title: 'Pedir comida agora',
      description: 'Encontre restaurantes e faça pedidos',
      subtitle: 'Restaurantes perto de você',
      path: '/social',
      priority: isMealTime ? 1 : 3,
      color: 'orange',
    },
    {
      icon: '👥',
      title: 'Encontrar pessoas ou serviços',
      description: 'Conecte-se com profissionais e serviços locais',
      subtitle: 'Profissionais recomendados',
      path: '/social',
      priority: isBusinessHours ? 1 : 2,
      color: 'blue',
    },
    {
      icon: '📅',
      title: 'Ver o que está acontecendo hoje',
      description: 'Descubra eventos e atividades na sua região',
      subtitle: 'Eventos hoje',
      path: '/social',
      priority: 2,
      color: 'purple',
    },
    {
      icon: '🎯',
      title: 'Explorar oportunidades',
      description: 'Descubra novas conexões e possibilidades',
      subtitle: 'Sugestões inteligentes',
      path: '/social',
      priority: 3,
      color: 'green',
    },
  ];

  // Ordenar por prioridade (menor número = maior prioridade)
  const cards = [...allCards].sort((a, b) => a.priority - b.priority);

  const handleCardClick = (path: string) => {
    navigate(path);
  };

  return (
    <div className="hero-action-block">
      <h1 className="hero-title">{heroTitle}</h1>
      <div className="hero-cards-grid">
        {cards.map((card, index) => (
          <div 
            key={index} 
            className={`hero-card hero-card-${card.color}`}
            onClick={() => handleCardClick(card.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick(card.path);
              }
            }}
          >
            <div className="hero-card-header">
              <div className="hero-card-icon">{card.icon}</div>
              <div className="hero-card-badge">{index + 1}</div>
            </div>
            <h3 className="hero-card-title">{card.title}</h3>
            <p className="hero-card-description">{card.description}</p>
            <div className="hero-card-subtitle">{card.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

