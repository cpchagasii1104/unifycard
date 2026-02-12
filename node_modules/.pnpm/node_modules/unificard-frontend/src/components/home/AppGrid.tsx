// src/components/home/AppGrid.tsx
// Grade de aplicativos estilo smartphone - Launcher de apps
// Usa APPS_REGISTRY como fonte única de verdade

import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { getAppsForContext, mapActorTypeToContext, type AppDefinition } from '../../config/appsRegistry';
import './AppGrid.css';

// Mapeamento de categoria para cor (apenas visual)
const CATEGORY_COLORS: Record<AppDefinition['category'], string> = {
  core: 'blue',
  finance: 'green',
  commerce: 'orange',
  mobility: 'blue',
  hospitality: 'purple',
  services: 'blue',
  social: 'green',
  governance: 'purple',
  system: 'gray',
};

export default function AppGrid() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();

  // Mapear actor_type para contexto e filtrar apps
  const context = activeActor ? mapActorTypeToContext(activeActor.actor_type) : 'pf';
  const visibleApps = getAppsForContext(context);

  const handleAppClick = (app: AppDefinition) => {
    // Se status é 'wip', garantir navegação para /em-desenvolvimento?feature={id}
    if (app.status === 'wip') {
      navigate(`/em-desenvolvimento?feature=${app.id}`);
    } else {
      navigate(app.route);
    }
  };

  return (
    <div className="app-grid">
      <div className="app-grid-container">
        {visibleApps.map((app) => {
          const color = CATEGORY_COLORS[app.category];
          return (
            <button
              key={app.id}
              className={`app-card app-card-${color}`}
              onClick={() => handleAppClick(app)}
              type="button"
              aria-label={`Abrir ${app.name}`}
            >
              <div className="app-card-icon">{app.icon}</div>
              <div className="app-card-name">{app.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
