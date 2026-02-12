// frontend/src/pages/VenuePublicPage.tsx
// SPRINT 92: MENU + COMANDA (TAB) + QR ORDERING

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPublicMenu, openPublicTab, type Menu, type MenuItem } from '../api/venue';
import './VenuePublicPage.css';

export default function VenuePublicPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'menu' | 'events' | 'about'>('menu');
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [showOpenTabForm, setShowOpenTabForm] = useState(false);
  const [tableLabel, setTableLabel] = useState('');
  const [contactName, setContactName] = useState('');

  useEffect(() => {
    if (slug) {
      loadMenu();
    }
  }, [slug]);

  const loadMenu = async () => {
    try {
      setLoading(true);
      setError(null);
      const menuData = await getPublicMenu(slug!);
      setMenu(menuData);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar cardápio');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTab = async () => {
    try {
      setError(null);
      const result = await openPublicTab(slug!, {
        tableLabel: tableLabel || undefined,
        contact: contactName ? { name: contactName } : undefined,
      });
      setQrToken(result.qrToken);
      setShowOpenTabForm(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao abrir comanda');
    }
  };

  const handleViewTab = () => {
    if (qrToken) {
      navigate(`/t/${qrToken}`);
    }
  };

  if (loading) {
    return <div className="venue-page loading">Carregando...</div>;
  }

  if (error && !menu) {
    return <div className="venue-page error">{error}</div>;
  }

  return (
    <div className="venue-page">
      <div className="venue-header">
        <h1>{menu?.name || 'Estabelecimento'}</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="venue-tabs">
        <button
          className={activeTab === 'menu' ? 'active' : ''}
          onClick={() => setActiveTab('menu')}
        >
          Cardápio
        </button>
        <button
          className={activeTab === 'events' ? 'active' : ''}
          onClick={() => setActiveTab('events')}
        >
          Eventos
        </button>
        <button
          className={activeTab === 'about' ? 'active' : ''}
          onClick={() => setActiveTab('about')}
        >
          Sobre
        </button>
      </div>

      {activeTab === 'menu' && (
        <div className="menu-section">
          {!qrToken ? (
            <>
              <div className="menu-items">
                {menu?.items.map((item: MenuItem) => (
                  <div key={item.id} className={`menu-item ${!item.isAvailable ? 'unavailable' : ''}`}>
                    <div className="menu-item-info">
                      <h3>{item.displayName}</h3>
                      {item.description && <p>{item.description}</p>}
                      {!item.isAvailable && <span className="badge">Indisponível</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="menu-actions">
                <button className="btn-primary" onClick={() => setShowOpenTabForm(true)}>
                  Abrir Comanda
                </button>
              </div>
            </>
          ) : (
            <div className="tab-opened">
              <p>Comanda aberta!</p>
              <button className="btn-primary" onClick={handleViewTab}>
                Acompanhar Comanda
              </button>
            </div>
          )}

          {showOpenTabForm && (
            <div className="open-tab-form">
              <h3>Abrir Comanda</h3>
              <input
                type="text"
                placeholder="Mesa/Identificação (opcional)"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
              />
              <input
                type="text"
                placeholder="Seu nome (opcional)"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <div className="form-actions">
                <button className="btn-primary" onClick={handleOpenTab}>
                  Abrir
                </button>
                <button className="btn-secondary" onClick={() => setShowOpenTabForm(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'events' && (
        <div className="events-section">
          <p>Eventos em breve...</p>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="about-section">
          <p>Informações sobre o estabelecimento...</p>
        </div>
      )}
    </div>
  );
}





