// src/components/events/EventMetricsDashboard.tsx
// Dashboard de métricas de eventos
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import './EventMetricsDashboard.css';

export interface EventMetricsDashboard {
  eventId: string;
  eventTitle: string;
  eventState: 'PRE' | 'DURING' | 'POST';
  metrics: {
    totalViews: number;
    totalCTAClicks: number;
    totalConversions: number;
    totalAbandonments: number;
    conversionRate: number;
    ctaClickRate: number;
  };
  byState: {
    PRE?: { views: number; clicks: number; conversions: number };
    DURING?: { views: number; clicks: number; conversions: number };
    POST?: { views: number; clicks: number; conversions: number };
  };
  byCTAType: {
    ticket?: { clicks: number; conversions: number };
    consumption?: { clicks: number; conversions: number };
    parking?: { clicks: number; conversions: number };
  };
  bySource: {
    feed?: number;
    event_page?: number;
    direct?: number;
  };
  funnel: {
    views: number;
    ctaClicks: number;
    conversions: number;
    dropOffViewsToClicks: number;
    dropOffClicksToConversion: number;
  };
}

interface EventMetricsDashboardProps {
  eventId: string;
}

export default function EventMetricsDashboard({ eventId }: EventMetricsDashboardProps) {
  const [dashboard, setDashboard] = useState<EventMetricsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/api/events/${eventId}/dashboard`);
        const data = await response.json();
        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [eventId]);

  if (loading) {
    return <div className="metrics-dashboard-loading">Carregando métricas...</div>;
  }

  if (error || !dashboard) {
    return <div className="metrics-dashboard-error">{error || 'Dashboard não encontrado'}</div>;
  }

  const { metrics, byState, byCTAType, bySource, funnel } = dashboard;

  return (
    <div className="metrics-dashboard">
      <div className="metrics-dashboard-header">
        <h2 className="metrics-dashboard-title">📊 Métricas: {dashboard.eventTitle}</h2>
        <div className={`metrics-dashboard-state metrics-dashboard-state-${dashboard.eventState.toLowerCase()}`}>
          {dashboard.eventState}
        </div>
      </div>

      {/* Métricas Principais */}
      <div className="metrics-dashboard-grid">
        <div className="metrics-card">
          <div className="metrics-card-label">Visualizações</div>
          <div className="metrics-card-value">{metrics.totalViews}</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-label">Cliques em CTA</div>
          <div className="metrics-card-value">{metrics.totalCTAClicks}</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-label">Conversões</div>
          <div className="metrics-card-value metrics-card-value-success">{metrics.totalConversions}</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-label">Taxa de Conversão</div>
          <div className="metrics-card-value">{metrics.conversionRate.toFixed(2)}%</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-label">Taxa de Clique</div>
          <div className="metrics-card-value">{metrics.ctaClickRate.toFixed(2)}%</div>
        </div>
        <div className="metrics-card">
          <div className="metrics-card-label">Abandonos</div>
          <div className="metrics-card-value metrics-card-value-warning">{metrics.totalAbandonments}</div>
        </div>
      </div>

      {/* Funil */}
      <div className="metrics-section">
        <h3 className="metrics-section-title">🔽 Funil de Conversão</h3>
        <div className="metrics-funnel">
          <div className="funnel-step">
            <div className="funnel-step-label">Visualizações</div>
            <div className="funnel-step-value">{funnel.views}</div>
            <div className="funnel-step-bar" style={{ width: '100%' }}></div>
          </div>
          <div className="funnel-step">
            <div className="funnel-step-label">
              Cliques em CTA ({funnel.dropOffViewsToClicks.toFixed(1)}% desistiram)
            </div>
            <div className="funnel-step-value">{funnel.ctaClicks}</div>
            <div
              className="funnel-step-bar"
              style={{
                width: `${(funnel.ctaClicks / funnel.views) * 100}%`,
              }}
            ></div>
          </div>
          <div className="funnel-step">
            <div className="funnel-step-label">
              Conversões ({funnel.dropOffClicksToConversion.toFixed(1)}% desistiram)
            </div>
            <div className="funnel-step-value">{funnel.conversions}</div>
            <div
              className="funnel-step-bar funnel-step-bar-success"
              style={{
                width: `${(funnel.conversions / funnel.views) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Por Estado */}
      {(byState.PRE || byState.DURING || byState.POST) && (
        <div className="metrics-section">
          <h3 className="metrics-section-title">⏰ Métricas por Estado</h3>
          <div className="metrics-by-state">
            {byState.PRE && (
              <div className="metrics-state-card">
                <div className="metrics-state-card-header">PRE</div>
                <div className="metrics-state-card-body">
                  <div>Views: {byState.PRE.views}</div>
                  <div>Cliques: {byState.PRE.clicks}</div>
                  <div>Conversões: {byState.PRE.conversions}</div>
                </div>
              </div>
            )}
            {byState.DURING && (
              <div className="metrics-state-card">
                <div className="metrics-state-card-header">DURING</div>
                <div className="metrics-state-card-body">
                  <div>Views: {byState.DURING.views}</div>
                  <div>Cliques: {byState.DURING.clicks}</div>
                  <div>Conversões: {byState.DURING.conversions}</div>
                </div>
              </div>
            )}
            {byState.POST && (
              <div className="metrics-state-card">
                <div className="metrics-state-card-header">POST</div>
                <div className="metrics-state-card-body">
                  <div>Views: {byState.POST.views}</div>
                  <div>Cliques: {byState.POST.clicks}</div>
                  <div>Conversões: {byState.POST.conversions}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Por Tipo de CTA */}
      {(byCTAType.ticket || byCTAType.consumption || byCTAType.parking) && (
        <div className="metrics-section">
          <h3 className="metrics-section-title">🎯 Por Tipo de CTA</h3>
          <div className="metrics-by-cta">
            {byCTAType.ticket && (
              <div className="metrics-cta-card">
                <div className="metrics-cta-card-label">Ticket</div>
                <div className="metrics-cta-card-value">
                  {byCTAType.ticket.clicks} cliques → {byCTAType.ticket.conversions} conversões
                </div>
              </div>
            )}
            {byCTAType.consumption && (
              <div className="metrics-cta-card">
                <div className="metrics-cta-card-label">Consumo</div>
                <div className="metrics-cta-card-value">
                  {byCTAType.consumption.clicks} cliques → {byCTAType.consumption.conversions} conversões
                </div>
              </div>
            )}
            {byCTAType.parking && (
              <div className="metrics-cta-card">
                <div className="metrics-cta-card-label">Estacionamento</div>
                <div className="metrics-cta-card-value">
                  {byCTAType.parking.clicks} cliques → {byCTAType.parking.conversions} conversões
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Por Origem */}
      {(bySource.feed || bySource.event_page || bySource.direct) && (
        <div className="metrics-section">
          <h3 className="metrics-section-title">📍 Origem das Visualizações</h3>
          <div className="metrics-by-source">
            {bySource.feed && (
              <div className="metrics-source-item">
                <span>Feed:</span> <strong>{bySource.feed}</strong>
              </div>
            )}
            {bySource.event_page && (
              <div className="metrics-source-item">
                <span>Página do Evento:</span> <strong>{bySource.event_page}</strong>
              </div>
            )}
            {bySource.direct && (
              <div className="metrics-source-item">
                <span>Direto:</span> <strong>{bySource.direct}</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}













