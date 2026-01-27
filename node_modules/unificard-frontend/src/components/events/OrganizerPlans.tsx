// src/components/events/OrganizerPlans.tsx
// Componente para exibir e gerenciar planos de organizador
import { useState, useEffect } from 'react';
import {
  getOrganizerPlans,
  getOrganizerSubscription,
  createOrganizerSubscription,
  cancelOrganizerSubscription,
  type OrganizerSubscription,
} from '../../api/events';
import './OrganizerPlans.css';

export interface OrganizerPlan {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  name: string;
  description: string;
  price: number | null;
  benefits: {
    maxEventsPerMonth: number | null;
    feedPriority: 'low' | 'normal' | 'high' | 'premium';
    metricsAccess: 'basic' | 'advanced' | 'full';
    insightsEnabled: boolean;
    customCTAEnabled: boolean;
    analyticsExportEnabled: boolean;
    supportLevel: 'community' | 'email' | 'priority' | 'dedicated';
  };
  recommended?: boolean;
}

interface OrganizerPlansProps {
  organizerId: string;
  currentPlan?: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    expiresAt: string | null;
    isExpired: boolean;
  };
}

export default function OrganizerPlans({ organizerId, currentPlan }: OrganizerPlansProps) {
  const [plans, setPlans] = useState<OrganizerPlan[]>([]);
  const [subscription, setSubscription] = useState<OrganizerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [plansData, subscriptionData] = await Promise.all([
          getOrganizerPlans(),
          getOrganizerSubscription(organizerId).catch(() => null),
        ]);
        setPlans(plansData.plans || []);
        setSubscription(subscriptionData);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [organizerId]);

  if (loading) {
    return <div className="organizer-plans-loading">Carregando planos...</div>;
  }

  const formatPrice = (price: number | null): string => {
    if (price === null) return 'Sob consulta';
    return `R$ ${price.toFixed(2)}/mês`;
  };

  const getPriorityLabel = (priority: string): string => {
    const labels: Record<string, string> = {
      low: 'Baixa',
      normal: 'Normal',
      high: 'Alta',
      premium: 'Premium',
    };
    return labels[priority] || priority;
  };

  const getSupportLabel = (support: string): string => {
    const labels: Record<string, string> = {
      community: 'Comunidade',
      email: 'Email',
      priority: 'Prioritário',
      dedicated: 'Dedicado',
    };
    return labels[support] || support;
  };

  return (
    <div className="organizer-plans">
      <div className="organizer-plans-header">
        <h2 className="organizer-plans-title">📦 Planos para Organizadores</h2>
        {currentPlan && (
          <div className="organizer-plans-current">
            Plano atual: <strong>{currentPlan.plan.toUpperCase()}</strong>
            {currentPlan.isExpired && <span className="organizer-plans-expired"> (Expirado)</span>}
            {subscription && subscription.status === 'active' && (
              <div className="organizer-plans-subscription-info">
                Válido até: {new Date(subscription.currentPeriodEnd).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="organizer-plans-grid">
        {plans.map((plan) => (
          <div
            key={plan.plan}
            className={`organizer-plan-card ${plan.recommended ? 'organizer-plan-card-recommended' : ''} ${
              currentPlan?.plan === plan.plan ? 'organizer-plan-card-current' : ''
            }`}
          >
            {plan.recommended && (
              <div className="organizer-plan-badge">⭐ Recomendado</div>
            )}
            {currentPlan?.plan === plan.plan && (
              <div className="organizer-plan-badge organizer-plan-badge-current">Seu Plano</div>
            )}

            <div className="organizer-plan-header">
              <h3 className="organizer-plan-name">{plan.name}</h3>
              <div className="organizer-plan-price">{formatPrice(plan.price)}</div>
              <div className="organizer-plan-description">{plan.description}</div>
            </div>

            <div className="organizer-plan-benefits">
              <div className="organizer-plan-benefit">
                <strong>Eventos/mês:</strong>{' '}
                {plan.benefits.maxEventsPerMonth === null
                  ? 'Ilimitado'
                  : plan.benefits.maxEventsPerMonth}
              </div>
              <div className="organizer-plan-benefit">
                <strong>Prioridade no Feed:</strong> {getPriorityLabel(plan.benefits.feedPriority)}
              </div>
              <div className="organizer-plan-benefit">
                <strong>Métricas:</strong> {plan.benefits.metricsAccess === 'basic' ? 'Básicas' : plan.benefits.metricsAccess === 'advanced' ? 'Avançadas' : 'Completas'}
              </div>
              {plan.benefits.insightsEnabled && (
                <div className="organizer-plan-benefit organizer-plan-benefit-check">
                  ✓ Insights e recomendações
                </div>
              )}
              {plan.benefits.customCTAEnabled && (
                <div className="organizer-plan-benefit organizer-plan-benefit-check">
                  ✓ CTAs personalizados
                </div>
              )}
              {plan.benefits.analyticsExportEnabled && (
                <div className="organizer-plan-benefit organizer-plan-benefit-check">
                  ✓ Exportar análises
                </div>
              )}
              <div className="organizer-plan-benefit">
                <strong>Suporte:</strong> {getSupportLabel(plan.benefits.supportLevel)}
              </div>
            </div>

            {currentPlan?.plan !== plan.plan && (
              <button
                className="organizer-plan-cta"
                disabled={upgrading === plan.plan}
                onClick={async () => {
                  if (plan.plan === 'free') {
                    // Downgrade para free (cancelar assinatura)
                    if (subscription) {
                      try {
                        await cancelOrganizerSubscription(organizerId, false);
                        alert('Assinatura cancelada. Plano alterado para Grátis.');
                        window.location.reload();
                      } catch (err) {
                        alert('Erro ao cancelar assinatura');
                      }
                    }
                    return;
                  }

                  // Upgrade para plano pago
                  setUpgrading(plan.plan);
                  try {
                    // TODO: Integrar com gateway de pagamento (Stripe, Pagar.me, etc.)
                    // Por enquanto, cria assinatura sem gateway (para testes)
                    await createOrganizerSubscription(organizerId, plan.plan);
                    alert(`Upgrade para ${plan.name} realizado com sucesso!`);
                    window.location.reload();
                  } catch (err) {
                    alert('Erro ao fazer upgrade. Verifique sua conexão e tente novamente.');
                  } finally {
                    setUpgrading(null);
                  }
                }}
              >
                {upgrading === plan.plan
                  ? 'Processando...'
                  : plan.plan === 'free'
                  ? 'Voltar para Grátis'
                  : 'Fazer Upgrade'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

